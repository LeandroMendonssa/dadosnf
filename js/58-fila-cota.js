// 58-fila-cota.js — Fila local para quando o Firebase estoura a cota diária (2.55.12).
// Quando uma gravação falha por cota (ou fica sem resposta enquanto a cota está estourada), ela vai para uma fila neste aparelho
// (localStorage). A fila é reenviada sozinha: ao abrir o app e a cada 60 s enquanto houver itens. Quando o envio funciona, a fila esvazia.
// Leituras não mudam: o que já está no aparelho continua visível; o resto depende do Firebase.
// Sem cota estourada, as gravações seguem exatamente como antes (o app só guarda na fila quando a cota falha).
(function () {
    const CHAVE_FILA = 'filaCotaV1', CHAVE_FLAG = 'cotaEstouradaEm', PRAZO_MS = 15000;
    const lerFila = () => { try { return JSON.parse(localStorage.getItem(CHAVE_FILA) || '[]'); } catch (e) { return []; } };
    const gravarFila = f => { try { localStorage.setItem(CHAVE_FILA, JSON.stringify(f)); } catch (e) { console.warn('Fila de cota: sem espaço no aparelho', e); } };
    const flagAtiva = () => { try { return !!localStorage.getItem(CHAVE_FLAG); } catch (e) { return false; } };
    const ehCota = e => !!e && (e.code === 'resource-exhausted' || /Quota exceeded|RESOURCE_EXHAUSTED/i.test(String(e.message || '')));
    function marcarCota() { try { if (!localStorage.getItem(CHAVE_FLAG)) localStorage.setItem(CHAVE_FLAG, new Date().toISOString()); } catch (e) { } atualizarBannerFila(); }
    function desmarcarCota() { try { localStorage.removeItem(CHAVE_FLAG); } catch (e) { } atualizarBannerFila(); }

    // ---- conversão para guardar no aparelho (Date, Timestamp e FieldValue viram texto e voltam depois)
    function paraFila(v) {
        if (v === null || typeof v !== 'object') return v;
        if (v instanceof Date) return { __d: v.toISOString() };
        if (Array.isArray(v)) return v.map(paraFila);
        if (typeof v._methodName === 'string') {
            const m = v._methodName;
            if (/serverTimestamp/.test(m)) return { __fv: 'ts' };
            if (/deleteField/.test(m)) return { __fv: 'del' };
            if (/arrayUnion/.test(m)) return { __fv: 'au', e: (v._elements || []).map(paraFila) };
            if (/arrayRemove/.test(m)) return { __fv: 'ar', e: (v._elements || []).map(paraFila) };
            if (/increment/.test(m)) return { __fv: 'inc', n: v._operand };
            throw new Error('valor não suportado na fila: ' + m);
        }
        if (typeof v.toDate === 'function' && typeof v.seconds === 'number') return { __t: [v.seconds, v.nanoseconds] };
        const o = {}; Object.keys(v).forEach(k => { o[k] = paraFila(v[k]); }); return o;
    }
    function daFila(v) {
        if (v === null || typeof v !== 'object') return v;
        if (Array.isArray(v)) return v.map(daFila);
        const F = firebase.firestore.FieldValue, T = firebase.firestore.Timestamp;
        if (v.__d) return new Date(v.__d);
        if (v.__t) return new T(v.__t[0], v.__t[1]);
        if (v.__fv === 'ts') return F.serverTimestamp();
        if (v.__fv === 'del') return F.delete();
        if (v.__fv === 'au') return F.arrayUnion(...v.e.map(daFila));
        if (v.__fv === 'ar') return F.arrayRemove(...v.e.map(daFila));
        if (v.__fv === 'inc') return F.increment(v.n);
        const o = {}; Object.keys(v).forEach(k => { o[k] = daFila(v[k]); }); return o;
    }

    // ---- métodos originais (guardados antes de qualquer troca)
    const DR = firebase.firestore.DocumentReference.prototype, CR = firebase.firestore.CollectionReference.prototype;
    const originais = { set: DR.set, update: DR.update, delete: DR.delete };

    function enfileirar(caminho, op, args) {
        try {
            const f = lerFila();
            f.push({ id: 'f' + Date.now() + Math.random().toString(36).slice(2, 7), caminho, op, args: paraFila(args), em: new Date().toISOString() });
            gravarFila(f);
        } catch (e) { console.error('Fila de cota: não consegui guardar a gravação', e); if (typeof toast === 'function') toast('✕ Não foi possível guardar neste aparelho.'); }
        atualizarBannerFila();
    }

    // ---- envolve cada gravação: se a cota falhar (ou não responder enquanto a cota está estourada), guarda na fila
    function envolver(ref, op, args, chamar) {
        let p; try { p = chamar(); } catch (e) { return Promise.reject(e); }
        if (!p || typeof p.then !== 'function') return p;
        let feito = false, timer = null;
        const guardar = () => { marcarCota(); enfileirar(ref.path, op, args); };
        const pr = p.then(v => {
            feito = true; clearTimeout(timer);
            if (flagAtiva()) desmarcarCota();
            if (lerFila().length) setTimeout(filaDescarregar, 0);
            return v;
        }, e => {
            feito = true; clearTimeout(timer);
            if (ehCota(e)) { guardar(); return undefined; }
            throw e;
        });
        if (!flagAtiva()) return pr;
        // cota já estourada neste aparelho: não espera o Firebase para sempre
        return new Promise((res, rej) => {
            timer = setTimeout(() => { if (!feito) { feito = true; guardar(); res(); } }, PRAZO_MS);
            pr.then(res, rej);
        });
    }
    if (!DR.__filaCota) {
        DR.__filaCota = true;
        DR.set = function (...args) { return envolver(this, 'set', args, () => originais.set.apply(this, args)); };
        DR.update = function (...args) { return envolver(this, 'update', args, () => originais.update.apply(this, args)); };
        DR.delete = function (...args) { return envolver(this, 'delete', args, () => originais.delete.apply(this, args)); };
        // add: cria o id antes e grava com set, para que o reenvio não duplique
        CR.add = function (dados) { const ref = this.doc(); return ref.set(dados).then(() => ref); };
    }

    // ---- reenvio da fila
    let enviando = false;
    async function filaDescarregar() {
        if (enviando || !lerFila().length) return;
        enviando = true;
        try {
            let f = lerFila();
            while (f.length) {
                const it = f[0];
                const ref = firestore.doc(it.caminho);
                const args = it.args.map(daFila);
                await Promise.race([originais[it.op].apply(ref, it.op === 'delete' ? [] : args),
                    new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('Quota exceeded (sem resposta)'), { code: 'resource-exhausted' })), PRAZO_MS))]);
                f = lerFila().filter(x => x.id !== it.id); gravarFila(f);
                atualizarBannerFila();
            }
            desmarcarCota();
            if (typeof toast === 'function') toast('✓ Alterações guardadas neste aparelho foram enviadas.');
        } catch (e) {
            if (!ehCota(e)) console.warn('Fila de cota: envio parou', e);
        } finally { enviando = false; atualizarBannerFila(); }
    }

    // ---- aviso na tela
    function atualizarBannerFila() {
        let b = document.getElementById('fila-cota');
        const n = lerFila().length, ativa = flagAtiva();
        if (!n && !ativa) { if (b) b.remove(); return; }
        if (!b) { b = document.createElement('div'); b.id = 'fila-cota'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
        b.innerHTML = `<div><b>Limite diário do Firebase atingido</b><span>${n ? n + ' alteração(ões) guardada(s) neste aparelho. ' : ''}Elas são enviadas sozinhas quando o limite voltar.</span></div>`;
    }

    // ---- ligação com o aviso de erro que o app já mostra
    if (typeof window.erroFirebase === 'function' && !window.erroFirebase.__filaCota) {
        const original = window.erroFirebase;
        window.erroFirebase = function (msg, error) { if (ehCota(error)) marcarCota(); return original.apply(this, arguments); };
        window.erroFirebase.__filaCota = true;
    }
    window.addEventListener('load', () => { setTimeout(filaDescarregar, 8000); setInterval(filaDescarregar, 60000); atualizarBannerFila(); });
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/58-fila-cota.js'] = '2.55.12';

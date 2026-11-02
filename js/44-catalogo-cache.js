// 2.22.0 — Cache versionado dos catálogos grandes (produtos, fornecedores, associações e exceções de XML).
// Ideia: o app guarda a lista no aparelho (IndexedDB) e, ao abrir, lê UM documento de versão (config/catalogosVersao).
// Versão igual = usa a cópia local (quase zero leituras). Versão diferente = baixa a coleção uma vez e guarda de novo.
// Toda gravação nessas coleções (feita por este app) avisa a versão e atualiza só o documento alterado.
// Se algo falhar aqui, o app volta para a escuta normal do Firestore (nada deixa de funcionar).
const CATALOGOS = ['produtosSpData', 'fornecedoresSpData', 'associacoesSpData', 'associacoesFornecedor', 'xmlExcecoes'];
const CATALOGO_TTL_MS = 24 * 3600e3;            // segurança: depois de 24 h baixa tudo de novo
const CATALOGO_LIMITE_DOCS = 300;                // gravação em lote maior que isso: baixa a coleção inteira
const catalogoEstado = {};                       // nome → { mapa, cb, col, versao, em, uid }
let catalogoVersoesPromessa = null;
const catalogoDiag = {};                          // nome → { como, docs, erro, em } (aparece em Mais → Uso do Firebase)
function catalogoDiagInc(nome, campo) { const d = catalogoDiag[nome] = catalogoDiag[nome] || {}; d[campo] = (d[campo] || 0) + 1; }
function catalogoDiagSet(nome, o) { catalogoDiag[nome] = { ...(catalogoDiag[nome] || {}), ...o, em: Date.now() }; }
function catalogoDiagHTML() {
    const nomes = Object.keys(catalogoDiag); if (!nomes.length && !catalogoCacheDesligado()) return '';
    const rot = { copia: 'cópia local (sem leitura)', servidor: 'baixado do servidor', normal: 'escuta normal do Firestore' };
    return '<div class="ctl-card"><div class="xml-item-meta"><b>Cache dos catálogos</b>Como cada cadastro foi carregado nesta abertura</div>' + nomes.map(n => { const d = catalogoDiag[n]; return '<div class="uso-lin"><span>' + n + ' · ' + (rot[d.como] || d.como) + (d.ms != null ? ' · ' + d.ms + ' ms (ler ' + d.msLer + ', exibir ' + d.msCb + ')' : '') + (d.entregas > 1 ? ' · ' + d.entregas + ' entregas' : '') + (d.erro ? ' · ' + String(d.erro).replace(/[<>&]/g, '') : '') + '</span><b>' + (d.docs != null ? d.docs : '') + '</b></div>'; }).join('') + '<div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="catalogoAlternar()">' + (catalogoCacheDesligado() ? 'Ligar cache dos catálogos' : 'Desligar cache dos catálogos (teste)') + '</button></div></div>';
}

function catalogoNovoToken() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function catalogoVersaoRef() { return firestore.collection('config').doc('catalogosVersao'); }

// ---- armazenamento local (IndexedDB)
function catalogoDB() {
    return new Promise((ok, falha) => {
        const r = indexedDB.open('catalogoCacheV1', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('c', { keyPath: 'nome' });
        r.onsuccess = () => ok(r.result);
        r.onerror = () => falha(r.error);
    });
}
async function catalogoLer(nome) {
    const db = await catalogoDB();
    return new Promise((ok, falha) => { const q = db.transaction('c').objectStore('c').get(nome); q.onsuccess = () => ok(q.result || null); q.onerror = () => falha(q.error); });
}
async function catalogoGravar(reg) {
    const db = await catalogoDB();
    return new Promise((ok, falha) => { const t = db.transaction('c', 'readwrite'); t.objectStore('c').put(reg); t.oncomplete = () => ok(); t.onerror = () => falha(t.error); });
}

// ---- versões no servidor (uma leitura por abertura, compartilhada pelos cinco catálogos)
function catalogoVersoes() {
    if (!catalogoVersoesPromessa) catalogoVersoesPromessa = catalogoVersaoRef().get().then(d => (d.exists ? d.data() : {})).catch(() => null);
    return catalogoVersoesPromessa;
}
function catalogoSnapshot(mapa) {
    const docs = [...mapa.entries()].map(([id, dados]) => ({ id, exists: true, data: () => ({ ...dados }) }));
    return { docs, size: docs.length, empty: !docs.length, metadata: { fromCache: true, hasPendingWrites: false }, forEach: f => docs.forEach(f), docChanges: () => [] };
}

// Substitui "colecao.onSnapshot(cb, errCb)" para os catálogos. Devolve a função de desligar, como o Firestore.
// 2.22.2: entrega a cópia local NA HORA e confere a versão em seguida (sem esperar a rede); chave de desligar o cache.
function catalogoCacheDesligado() { try { return localStorage.getItem('catalogoCacheOff') === '1'; } catch (e) { return false; } }
function catalogoAlternar() {
    try { if (catalogoCacheDesligado()) localStorage.removeItem('catalogoCacheOff'); else localStorage.setItem('catalogoCacheOff', '1'); } catch (e) { }
    if (typeof toast === 'function') toast(catalogoCacheDesligado() ? 'Cache dos catálogos desligado. Feche e abra o app.' : 'Cache dos catálogos ligado. Feche e abra o app.');
    if (typeof renderUsoFirebase === 'function') renderUsoFirebase();
}
function catalogoOnSnapshot(nome, col, cb, errCb) {
    if (catalogoCacheDesligado()) { catalogoDiagSet(nome, { como: 'normal', docs: null, erro: 'cache desligado por você' }); return col.onSnapshot(cb, errCb); }
    let ativo = true, escutaNormal = null;
    const nomeCap = window.__capturandoDados || nome, marcar = () => { try { if (window.__primeiroSnapMarcar) window.__primeiroSnapMarcar(nomeCap); } catch (e) { } };
    const t0 = (window.performance && performance.now) ? performance.now() : Date.now(), agora = () => ((window.performance && performance.now) ? performance.now() : Date.now());
    const entregar = (mapa, como, extra) => {
        if (!ativo) return;
        const ti = agora();
        try { cb(catalogoSnapshot(mapa)); } catch (e) { console.error('Catálogo', nome, '— erro ao exibir:', e); }
        marcar();
        catalogoDiagInc(nome, 'entregas');
        catalogoDiagSet(nome, { como, docs: mapa.size, erro: '', ms: Math.round(agora() - t0), msCb: Math.round(agora() - ti), ...(extra || {}) });
    };
    (async () => {
        try {
            const uid = uidAtualCache();
            let reg = null; const tl = agora(); try { reg = await catalogoLer(nome); } catch (e) { reg = null; }
            catalogoDiagSet(nome, { msLer: Math.round(agora() - tl) });
            if (reg && (reg.uid !== uid || !reg.versao || (Date.now() - reg.em >= CATALOGO_TTL_MS))) reg = null;
            if (reg) {
                const est = catalogoEstado[nome] = { mapa: new Map(reg.docs), cb, col, versao: reg.versao, em: reg.em, uid };
                entregar(est.mapa, 'copia');                       // não espera a rede
            }
            const versoes = await catalogoVersoes();
            if (!ativo) return;
            const versaoSrv = versoes ? versoes[nome] : undefined;
            if (reg && (!versoes || versaoSrv === reg.versao)) return;   // cópia vale (ou sem rede: fica com ela)
            let versao = versaoSrv;
            if (versao === undefined) {                             // primeira vez: precisa conseguir gravar a versão; se não der, não usa o cache
                versao = catalogoNovoToken();
                try { await catalogoVersaoRef().set({ [nome]: versao }, { merge: true }); }
                catch (e) { throw Object.assign(new Error('sem permissão para gravar a versão'), { code: (e && e.code) || 'versao' }); }
            }
            let snap;
            try { snap = await col.get(); }
            catch (e) { if (reg) return; throw e; }
            const mapa = new Map(snap.docs.map(d => [d.id, d.data()])), em = Date.now();
            try { await catalogoGravar({ nome, uid, versao, em, docs: [...mapa.entries()] }); } catch (e) { catalogoDiagSet(nome, { erro: 'cópia local não gravou: ' + (e && (e.name || e.message)) }); console.warn('Catálogo: não consegui guardar a cópia local de', nome, e && e.message); }
            catalogoEstado[nome] = { mapa, cb, col, versao, em, uid };
            entregar(mapa, 'servidor');
        } catch (e) {
            console.warn('Catálogo', nome, '— usando escuta normal:', e && (e.code || e.message));
            catalogoDiagSet(nome, { como: 'normal', docs: null, erro: e && (e.code || e.message) });
            if (ativo && !escutaNormal) escutaNormal = col.onSnapshot(s => { marcar(); cb(s); }, er => { marcar(); if (errCb) errCb(er); });
        }
    })();
    return () => { ativo = false; delete catalogoEstado[nome]; if (escutaNormal) { const u = escutaNormal; escutaNormal = null; u(); } };
}

// ---- gravações: avisam a versão e atualizam só o documento alterado
const catalogoFila = {};   // nome → { ids: Map(id→apagou), timer }
function catalogoAlterado(nome, itens) {
    const f = catalogoFila[nome] = catalogoFila[nome] || { ids: new Map(), timer: null };
    itens.forEach(i => f.ids.set(i.id, !!i.del));
    clearTimeout(f.timer);
    f.timer = setTimeout(() => { const ids = f.ids; f.ids = new Map(); catalogoProcessar(nome, ids).catch(e => console.warn('Catálogo', nome, '— atualização:', e && e.message)); }, 800);
}
async function catalogoProcessar(nome, ids) {
    const uid = uidAtualCache(), est = catalogoEstado[nome], col = firestore.collection(nome);
    let mapa = est ? est.mapa : null, em = est ? est.em : Date.now();
    if (!mapa) {                                        // catálogo não foi carregado nesta sessão: ajusta a cópia guardada, se houver
        let reg = null; try { reg = await catalogoLer(nome); } catch (e) { reg = null; }
        if (!reg || reg.uid !== uid) { try { await catalogoVersaoRef().set({ [nome]: catalogoNovoToken() }, { merge: true }); } catch (e) { } return; }
        mapa = new Map(reg.docs); em = reg.em;
    }
    if (ids.size > CATALOGO_LIMITE_DOCS) {
        const snap = await col.get(); mapa = new Map(snap.docs.map(d => [d.id, d.data()])); em = Date.now();
    } else {
        const lista = [...ids.entries()];
        for (let i = 0; i < lista.length; i += 20) {
            await Promise.all(lista.slice(i, i + 20).map(async ([id, apagou]) => {
                if (apagou) { mapa.delete(id); return; }
                const d = await col.doc(id).get();
                if (d.exists) mapa.set(id, d.data()); else mapa.delete(id);
            }));
        }
    }
    const versao = catalogoNovoToken();
    try { await catalogoVersaoRef().set({ [nome]: versao }, { merge: true }); }
    catch (e) { catalogoDiagSet(nome, { erro: 'versão não gravou: ' + (e && e.code) }); try { await catalogoGravar({ nome, uid, versao: null, em: 0, docs: [] }); } catch (e2) { } return; }
    if (catalogoVersoesPromessa) catalogoVersoesPromessa = catalogoVersoesPromessa.then(v => ({ ...(v || {}), [nome]: versao }));
    try { await catalogoGravar({ nome, uid, versao, em, docs: [...mapa.entries()] }); } catch (e) { console.warn('Catálogo: cópia local de', nome, e && e.message); }
    if (est) { est.mapa = mapa; est.versao = versao; catalogoDiagInc(nome, 'entregas'); catalogoDiagInc(nome, 'porEscrita'); try { est.cb(catalogoSnapshot(mapa)); } catch (e) { console.error('Catálogo', nome, '— erro ao exibir:', e); } }
}
function catalogoDoCaminho(ref) {
    try { const p = String(ref.path || '').split('/'); return CATALOGOS.includes(p[0]) && p.length === 2 ? { nome: p[0], id: p[1] } : null; } catch (e) { return null; }
}
function catalogoInstalarEscritas(F) {
    const DR = F.DocumentReference && F.DocumentReference.prototype, CR = F.CollectionReference && F.CollectionReference.prototype, WB = F.WriteBatch && F.WriteBatch.prototype;
    if (DR) ['set', 'update', 'delete'].forEach(m => {
        const orig = DR[m]; if (!orig || orig.__cat) return;
        DR[m] = function (...a) {
            const info = catalogoDoCaminho(this), p = orig.apply(this, a);
            if (info && p && p.then) p.then(() => catalogoAlterado(info.nome, [{ id: info.id, del: m === 'delete' }])).catch(() => { });
            return p;
        };
        DR[m].__cat = true;
    });
    if (CR && CR.add && !CR.add.__cat) {
        const add = CR.add;
        CR.add = function (...a) {
            const nome = String(this.path || ''), p = add.apply(this, a);
            if (CATALOGOS.includes(nome) && p && p.then) p.then(ref => catalogoAlterado(nome, [{ id: ref.id, del: false }])).catch(() => { });
            return p;
        };
        CR.add.__cat = true;
    }
    if (WB) {
        ['set', 'update', 'delete'].forEach(m => {
            const orig = WB[m]; if (!orig || orig.__cat) return;
            WB[m] = function (ref, ...r) {
                const info = catalogoDoCaminho(ref);
                if (info) (this.__catOps = this.__catOps || []).push({ nome: info.nome, id: info.id, del: m === 'delete' });
                return orig.call(this, ref, ...r);
            };
            WB[m].__cat = true;
        });
        const commit = WB.commit;
        if (commit && !commit.__cat) {
            WB.commit = function (...a) {
                const ops = this.__catOps; this.__catOps = null;
                const p = commit.apply(this, a);
                if (ops && ops.length && p && p.then) p.then(() => { CATALOGOS.forEach(n => { const m = ops.filter(o => o.nome === n); if (m.length) catalogoAlterado(n, m); }); }).catch(() => { });
                return p;
            };
            WB.commit.__cat = true;
        }
    }
}
// ---- medição de travadas da tela (quanto tempo o app ficou sem responder) e relatório em texto
const travadas = [];
(function () { let ult = Date.now(); setInterval(() => { const n = Date.now(), d = n - ult - 250; ult = n; if (d > 300) { let t = ''; try { const a = document.querySelector('.app-screen.active'); t = a ? a.id : ''; } catch (e) { } travadas.push({ t: n, ms: d, tela: t }); if (travadas.length > 40) travadas.shift(); } }, 250); })();
function catalogoRelatorioTexto() {
    const L = [], hh = t => new Date(t).toLocaleTimeString('pt-BR'), N = x => (x == null ? '-' : x);
    let ver = ''; try { ver = document.querySelector('meta[name="app-versao"]').content; } catch (e) { }
    L.push('RELATÓRIO DO APP — versão ' + ver + ' — ' + new Date().toLocaleString('pt-BR'));
    L.push('Cache dos catálogos: ' + (catalogoCacheDesligado() ? 'DESLIGADO' : 'ligado') + ' | Cópia do Firestore: ' + (window.cacheLocalFirestore || '?'));
    try { L.push('Leituras do servidor: ' + usoFb.total + ' | da cópia: ' + usoFb.cache + ' | consultas get: ' + usoFb.get); } catch (e) { }
    const lista = (t, o) => { L.push(''); L.push(t); Object.entries(o || {}).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => L.push('  ' + k + ': ' + v)); };
    try { lista('POR COLEÇÃO', usoFb.col); lista('POR TELA', usoFb.tela); } catch (e) { }
    L.push(''); L.push('ABERTURAS HOJE');
    try { (usoFb.sessoes || []).filter(s => s.dia === usoFb.dia).slice().reverse().forEach(s => { const top = Object.entries(s.c || {}).sort((a, b) => b[1] - a[1])[0]; L.push('  ' + hh(s.t) + ' | servidor ' + s.n + ' | cópia ' + (s.k || 0) + (top ? ' | mais: ' + top[0] : '')); }); } catch (e) { }
    L.push(''); L.push('CACHE DOS CATÁLOGOS (nesta abertura)');
    Object.keys(catalogoDiag).forEach(n => { const d = catalogoDiag[n]; L.push('  ' + n + ': ' + d.como + ' | docs ' + N(d.docs) + ' | total ' + N(d.ms) + ' ms | ler ' + N(d.msLer) + ' ms | exibir ' + N(d.msCb) + ' ms | entregas ' + N(d.entregas) + ' | por gravação ' + N(d.porEscrita) + (d.erro ? ' | erro: ' + d.erro : '')); });
    L.push(''); L.push('TRAVADAS DA TELA (app sem responder >0,3 s), mais recentes por último');
    if (!travadas.length) L.push('  nenhuma'); travadas.forEach(x => L.push('  ' + hh(x.t) + ' | ' + (x.ms / 1000).toFixed(1) + ' s | tela ' + (x.tela || '?')));
    return L.join('\n');
}
try { if (window.firebase && firebase.firestore) catalogoInstalarEscritas(firebase.firestore); } catch (e) { console.warn('Cache de catálogos: gravações não monitoradas:', e); }
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/44-catalogo-cache.js'] = '2.22.4';

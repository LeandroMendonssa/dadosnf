// 27-equipamentos-ponte.js — Liga o módulo Equipamentos (js/26) ao app: Firestore, Controle de NFs e abertura da tela
// Parte do script do app (v2.5.0). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// Dados: coleção "equipamentos" (um documento por aparelho) e "equipamentosConfig/setores". Só grava o que mudou; e NUNCA grava antes
// de ter carregado com sucesso (senão uma falha de leitura poderia apagar a lista de setores com uma lista vazia).
(function () {
    const col = () => firestore.collection('equipamentos');
    const setoresDoc = () => firestore.collection('equipamentosConfig').doc('setores');
    const ultimo = new Map();      // id -> json já gravado
    let ultimoSetores = null, carregado = false, avisoEm = 0;
    const limpar = o => JSON.parse(JSON.stringify(o)); // remove undefined (o Firestore rejeita)
    function statusEquip(html) { // faixa dentro da própria tela (visível mesmo se o aviso rápido passar despercebido)
        const el = document.getElementById('equipamentos-status'); if (!el) return;
        el.style.display = html ? 'block' : 'none'; if (html) el.innerHTML = html;
    }
    function avisar(e, oque) {
        console.error('Equipamentos (' + oque + '):', e);
        statusEquip(e && e.code === 'permission-denied'
            ? '⚠ O Firebase não deixou <strong>' + oque + '</strong> os equipamentos (permission-denied). É preciso liberar as coleções <strong>equipamentos</strong> e <strong>equipamentosConfig</strong> nas regras do Firestore. Enquanto isso o cadastro não é gravado.'
            : '⚠ Erro ao ' + oque + ' os equipamentos: ' + ((e && (e.code || e.message)) || 'desconhecido') + '. Verifique a conexão e tente de novo.');
        if (Date.now() - avisoEm < 8000) return; avisoEm = Date.now();
        toast(e && e.code === 'permission-denied' ? '✕ O Firebase não liberou as coleções de equipamentos (regras de segurança).' : '✕ Erro ao ' + oque + ' equipamentos.');
    }

    // ---- NFs: XML (nfsProcessadas) + as que vieram só do ERP (entradasErp) ----
    const isoEmissao = s => { const m = String(s || '').match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : ''; };
    const isoBR = s => { const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
    const chaveNf = (nf, serie) => String(nf || '').trim() + '|' + String(serie || '').trim();
    function listarNfs() {
        const out = [], vistos = new Set();
        (typeof listaNfsProcessadas !== 'undefined' ? listaNfsProcessadas : []).forEach(n => {
            if (!n.nf) return; vistos.add(chaveNf(n.nf, n.serie));
            out.push({ num: String(n.nf), data: isoEmissao(n.emissao), forn: n.fornecedor || '', valor: n.valorTotal != null ? String(n.valorTotal) : '' });
        });
        (typeof listaEntradasErp !== 'undefined' ? listaEntradasErp : []).forEach(e => {
            if (!e.nf || vistos.has(chaveNf(e.nf, e.serie))) return;
            const f = e.financeiro || {}, v = f.totalNota != null ? f.totalNota : f.totalLancamentos;
            out.push({ num: String(e.nf), data: isoBR(e.data), forn: e.fornecedorNomeRelatorio || '', valor: v != null ? String(v) : '' });
        });
        out.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
        return out;
    }
    function abrirNf(num) {
        const n = (typeof listaNfsProcessadas !== 'undefined' ? listaNfsProcessadas : []).find(x => String(x.nf) === String(num));
        const e = !n ? (typeof listaEntradasErp !== 'undefined' ? listaEntradasErp : []).find(x => String(x.nf) === String(num)) : null;
        if (n) abrirEditorNf(n.id); else if (e) abrirEditorNf(e.id); else toast('NF não encontrada no Controle de NFs.');
    }

    window.EQP_CONFIG = {
        load: async () => {
            try {
                const [snap, cfg] = await Promise.all([col().get(), setoresDoc().get()]);
                const items = snap.docs.map(d => d.data());
                ultimo.clear(); items.forEach(i => ultimo.set(String(i.id), JSON.stringify(limpar(i))));
                const setores = cfg.exists ? (cfg.data().lista || []) : [];
                ultimoSetores = cfg.exists ? JSON.stringify(limpar(setores)) : null;
                carregado = true; statusEquip('');
                return { items, setores };
            } catch (e) { avisar(e, 'carregar'); throw e; }
        },
        save: st => {
            if (!carregado) { toast('Os equipamentos ainda não carregaram; aguarde um instante e tente de novo.'); return; }
            const ops = [], vivos = new Set();
            st.items.forEach(i => {
                const k = String(i.id), doc = limpar(i), j = JSON.stringify(doc); vivos.add(k);
                if (ultimo.get(k) !== j) { ops.push(b => b.set(col().doc(k), doc)); ultimo.set(k, j); }
            });
            ultimo.forEach((_, k) => { if (!vivos.has(k)) { ops.push(b => b.delete(col().doc(k))); ultimo.delete(k); } });
            const js = JSON.stringify(limpar(st.setores));
            if (js !== ultimoSetores) { ops.push(b => b.set(setoresDoc(), { lista: limpar(st.setores) })); ultimoSetores = js; }
            for (let i = 0; i < ops.length; i += 400) {
                const b = firestore.batch(); ops.slice(i, i + 400).forEach(f => f(b));
                b.commit().catch(e => avisar(e, 'salvar'));
            }
        },
        nf: { list: listarNfs, open: abrirNf }
    };

    // abre a tela (chamada por switchToScreen): monta uma vez, depois só atualiza
    window.montarOuMostrarEquipamentos = function () {
        if (typeof EQP === 'undefined') { toast('✕ Módulo de equipamentos não carregou.'); return; }
        statusEquip('');
        if (!window.__eqpMontado) {
            window.__eqpMontado = true;
            try { EQP.mount(document.getElementById('equipamentos-root')); }
            catch (e) { window.__eqpMontado = false; console.error('Erro ao montar Equipamentos:', e); statusEquip('⚠ Erro ao montar a tela de Equipamentos: ' + (e && e.message ? e.message : e)); }
        } else EQP.onShow();
    };
    // abre sozinha quando a tela fica ativa (não depende de o switchToScreen ter o gancho)
    (function () {
        const tela = document.getElementById('screen-equipamentos'); if (!tela || typeof MutationObserver !== 'function') return;
        let estavaAtiva = false;
        new MutationObserver(() => {
            const ativa = tela.classList.contains('active');
            if (ativa && !estavaAtiva) window.montarOuMostrarEquipamentos();
            estavaAtiva = ativa;
        }).observe(tela, { attributes: true, attributeFilter: ['class'] });
    })();
    // botão "Cadastrar equipamento desta NF" (Editor da NF): abre a tela de equipamentos já com os dados da nota
    window.cadastrarEquipamentoDaNf = function (nfId) {
        const n = (typeof listaNfsProcessadas !== 'undefined' ? listaNfsProcessadas : []).find(x => x.id === nfId);
        const e = !n ? (typeof listaEntradasErp !== 'undefined' ? listaEntradasErp : []).find(x => x.id === nfId) : null;
        const alvo = n ? listarNfs().find(x => x.num === String(n.nf)) : e ? listarNfs().find(x => x.num === String(e.nf)) : null;
        if (!alvo) return toast('NF não encontrada.');
        switchToScreen('screen-equipamentos', 'Equipamentos');
        if (typeof EQP !== 'undefined' && EQP.novoDaNF) EQP.novoDaNF(alvo);
    };
})();

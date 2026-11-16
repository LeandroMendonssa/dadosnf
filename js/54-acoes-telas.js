// 54-acoes-telas.js — Ações das telas de lista (2.41.0)
// Parte do script do app. Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// • Ícone "Selecionar" no canto superior direito de Cotações, Anotações e Controle de NFs (no Gerenciar ele já existia).
// • Botão "+" flutuante (acima da dock) em Cotações, Anotações e Gerenciar.
// • "Ordenar" em folha inferior (Cotações, Anotações, Gerenciar) — a escolha fica guardada neste aparelho.
// • Folha inferior genérica (também usada por "Baixar" do Resumo de pendências).
// ===================================================================
(function () {
    const $ = id => document.getElementById(id);
    const LS = 'ordenacao-telas-v1';
    let guard = {}; try { guard = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { guard = {}; }

    const OPCOES = {
        cotacoes: { titulo: 'Ordenar cotações', padrao: 'entrada', itens: [['entrada', 'Mais recentes primeiro'], ['antigas', 'Mais antigas primeiro'], ['cresc', 'Número do pedido (crescente)'], ['decresc', 'Número do pedido (decrescente)']] },
        anotacoes: { titulo: 'Ordenar anotações', padrao: 'recentes', itens: [['recentes', 'Mais recentes primeiro'], ['antigas', 'Mais antigas primeiro'], ['az', 'Título (A–Z, números crescentes)'], ['za', 'Título (Z–A, números decrescentes)']] },
        gerenciar: { titulo: 'Ordenar notas', padrao: 'recentes', itens: [['recentes', 'Mais recentes primeiro'], ['antigas', 'Mais antigas primeiro'], ['venc', 'Vencimento mais próximo'], ['forn', 'Fornecedor (A–Z)'], ['nfcresc', 'Número da NF (crescente)'], ['nfdecresc', 'Número da NF (decrescente)']] }
    };
    const atual = ctx => (guard[ctx] && OPCOES[ctx].itens.some(i => i[0] === guard[ctx])) ? guard[ctx] : OPCOES[ctx].padrao;
    const rotulo = ctx => (OPCOES[ctx].itens.find(i => i[0] === atual(ctx)) || [0, ''])[1];

    // ---------- folha inferior ----------
    function garantirFolha() {
        if ($('folha-acoes')) return;
        const v = document.createElement('div'); v.id = 'folha-veu'; v.className = 'folha-veu'; v.onclick = fecharFolhaAcoes;
        const f = document.createElement('div'); f.id = 'folha-acoes'; f.className = 'folha-acoes'; f.setAttribute('role', 'dialog');
        document.body.appendChild(v); document.body.appendChild(f);
    }
    function abrirFolhaAcoes(titulo, linhas) {
        garantirFolha(); fecharLeque();
        $('folha-acoes').innerHTML = '<div class="fa-alca"></div>' + (titulo ? `<div class="fa-tit">${titulo}</div>` : '')
            + linhas.map((l, i) => `<button type="button" class="fa-lin${l.atual ? ' atual' : ''}" data-i="${i}"><i class="${l.ic || 'fa-solid fa-arrow-down-up-across-line'}"></i><span>${l.t}</span>${l.atual ? '<i class="fa-solid fa-check fa-ok"></i>' : ''}</button>`).join('');
        $('folha-acoes').querySelectorAll('.fa-lin').forEach(b => b.onclick = () => { const l = linhas[+b.dataset.i]; fecharFolhaAcoes(); if (l && l.f) l.f(); });
        $('folha-veu').classList.add('on'); $('folha-acoes').classList.add('on');
    }
    function fecharFolhaAcoes() { const f = $('folha-acoes'), v = $('folha-veu'); if (f) f.classList.remove('on'); if (v) v.classList.remove('on'); }
    window.abrirFolhaAcoes = abrirFolhaAcoes; window.fecharFolhaAcoes = fecharFolhaAcoes;

    // ---------- ordenar ----------
    function atualizarRotulos() {
        [['cotacoes', 'cotacoes-ord-btn'], ['anotacoes', 'anot-ord-btn'], ['gerenciar', 'ger-ord-btn']].forEach(([ctx, id]) => {
            const b = $(id); if (b) b.innerHTML = `<i class="fa-solid fa-arrow-down-up-across-line"></i><span>${rotulo(ctx)}</span><i class="fa-solid fa-chevron-down ord-seta"></i>`;
        });
    }
    function aplicar(ctx) {
        if (ctx === 'cotacoes') { ordenacaoCotacoes = atual('cotacoes'); if (typeof renderListaCotacoes === 'function') renderListaCotacoes(); }
        else if (ctx === 'anotacoes') { if (typeof renderListaAnotacoes === 'function') renderListaAnotacoes(); }
        else if (ctx === 'gerenciar') { if (typeof rebuildNotasPendentesList === 'function') rebuildNotasPendentesList(); }
    }
    window.abrirOrdenar = function (ctx) {
        if (ctx === 'resumo-baixar') {
            return abrirFolhaAcoes('Baixar resumo como', [
                { ic: 'fa-solid fa-file-lines', t: 'TXT (texto simples)', f: () => baixarResumoPendencias('txt') },
                { ic: 'fa-solid fa-file-word', t: 'Word', f: () => baixarResumoPendencias('doc') },
                { ic: 'fa-solid fa-file-pdf', t: 'PDF', f: () => baixarResumoPendencias('pdf') }]);
        }
        const o = OPCOES[ctx]; if (!o) return;
        abrirFolhaAcoes(o.titulo, o.itens.map(([k, t]) => ({ t, atual: atual(ctx) === k, f: () => { guard[ctx] = k; try { localStorage.setItem(LS, JSON.stringify(guard)); } catch (e) { } atualizarRotulos(); aplicar(ctx); } })));
    };
    // usados pelos renders (js/09 e js/05)
    window.ordenarAnotacoesLista = function (lista) {
        const m = atual('anotacoes'); if (m === 'recentes') return lista;
        const dt = a => String(a.atualizadoEm || a.criadoEm || '');
        const tt = a => String(a.titulo || '');
        if (m === 'antigas') lista.sort((a, b) => dt(a).localeCompare(dt(b)));
        else if (m === 'az') lista.sort((a, b) => tt(a).localeCompare(tt(b), 'pt-BR', { numeric: true, sensitivity: 'base' }));
        else if (m === 'za') lista.sort((a, b) => tt(b).localeCompare(tt(a), 'pt-BR', { numeric: true, sensitivity: 'base' }));
        return lista;
    };
    function dataVenc(s) { s = String(s || ''); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return +(m[1] + m[2] + m[3]); m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? +(m[3] + m[2] + m[1]) : 99999999; }
    window.ordenarNotasGerenciar = function (lista) {
        const m = atual('gerenciar'); if (m === 'recentes') return lista;
        const nf = n => parseInt(String(n.nf || '').replace(/\D/g, ''), 10);
        const cmpNf = (a, b) => { const x = nf(a), y = nf(b); return (isNaN(x) ? 1e12 : x) - (isNaN(y) ? 1e12 : y); };
        if (m === 'antigas') lista.sort((a, b) => String(a.dataCriacao || '').localeCompare(String(b.dataCriacao || '')));
        else if (m === 'venc') lista.sort((a, b) => dataVenc(a.vencimento) - dataVenc(b.vencimento));
        else if (m === 'forn') lista.sort((a, b) => String(a.fornecedor || '').localeCompare(String(b.fornecedor || ''), 'pt-BR', { sensitivity: 'base' }));
        else if (m === 'nfcresc') lista.sort(cmpNf);
        else if (m === 'nfdecresc') lista.sort((a, b) => cmpNf(b, a));
        return lista;
    };

    // ---------- Selecionar (barra de ferramentas da tela): rótulo acompanha o estado ----------
    const IDS_SEL = ['btn-selecionar-cotacoes', 'btn-selecionar-anotacoes', 'select-mode-btn', 'controle-btn-selecionar'];
    function hdrSelAtualizar() {
        IDS_SEL.forEach(id => {
            const b = $(id); if (!b) return;
            const t = b.querySelector('.selb-t'); if (t) { const x = b.classList.contains('active') ? 'Cancelar' : 'Selecionar'; if (t.textContent !== x) t.textContent = x; }
        });
        fabAtualizar(); pedHdrAtualizar();
    }

    // ---------- Tela do pedido (P1): Exportar relatório e ⋯ no cabeçalho ----------
    function cotPedidoAtual() { return typeof centralPedidoAtual !== 'undefined' && centralPedidoAtual ? (listaCotacoes || []).find(c => String(c.pedido) === String(centralPedidoAtual)) : null; }
    window.pedHdrAtualizar = function () {
        const t = typeof telaAtivaId === 'function' ? telaAtivaId() : null;
        const ok = t === 'screen-central-pedido' && !!cotPedidoAtual();
        ['hdr-ped-exp', 'hdr-ped-mais'].forEach(id => { const b = $(id); if (b) b.style.display = ok ? 'flex' : 'none'; });
    };
    window.pedHdrExportar = function () { const c = cotPedidoAtual(); if (c) abrirExportarCotacao(String(c.pedido)); };
    window.pedHdrMais = function () {
        const c = cotPedidoAtual(); if (!c) return;
        const p = String(c.pedido), cnpjs = cnpjsFornecedoresDaCotacao(c), mapa = c.chegadasPorFornecedor || {};
        if (!cnpjs.length) { toast('Este pedido não tem fornecedores com CNPJ.'); return; }
        const linhas = [];
        if (cnpjs.some(x => !mapa[x])) linhas.push({ t: 'Marcar toda a cotação como entregue', ic: 'fa-solid fa-check-double', f: () => marcarTodosChegaramCotacao(p, true) });
        if (cnpjs.every(x => mapa[x] && mapa[x].tipo === 'cancelada')) linhas.push({ t: 'Desfazer cancelamento do pedido', ic: 'fa-solid fa-rotate-left', f: () => cancelarEntregaPedidoCotacao(p, false) });
        else if (cnpjs.some(x => !mapa[x])) linhas.push({ t: 'Entrega cancelada (pedido todo)', ic: 'fa-solid fa-ban', f: () => cancelarEntregaPedidoCotacao(p, true) });
        if (cnpjs.some(x => mapa[x])) linhas.push({ t: 'Voltar tudo para aguardando', ic: 'fa-solid fa-hourglass-half', f: () => marcarTodosChegaramCotacao(p, false) });
        if (!linhas.length) { toast('Nada a alterar neste pedido.'); return; }
        abrirFolhaAcoes('Pedido ' + p, linhas);
    };

    // ---------- botão "+" flutuante ----------
    function garantirFab() {
        if ($('fab-acoes')) return;
        const v = document.createElement('div'); v.id = 'fab-veu'; v.className = 'fab-veu'; v.onclick = fecharLeque;
        const l = document.createElement('div'); l.id = 'fab-leque'; l.className = 'fab-leque';
        const f = document.createElement('button'); f.id = 'fab-acoes'; f.type = 'button'; f.className = 'fab-acoes'; f.setAttribute('aria-label', 'Adicionar'); f.innerHTML = '<i class="fa-solid fa-plus"></i>'; f.onclick = fabClique;
        document.body.appendChild(v); document.body.appendChild(l); document.body.appendChild(f);
    }
    function fecharLeque() { const l = $('fab-leque'), v = $('fab-veu'), f = $('fab-acoes'); if (l) l.classList.remove('on'); if (v) v.classList.remove('on'); if (f) f.classList.remove('aberto'); }
    function fabAtualizar() {
        garantirFab();
        const t = typeof telaAtivaId === 'function' ? telaAtivaId() : null;
        const tem = ['screen-cotacoes', 'screen-anotacoes', 'screen-manage'].includes(t);
        const f = $('fab-acoes'); f.classList.toggle('visivel', tem);
        f.setAttribute('aria-label', t === 'screen-cotacoes' ? 'Adicionar cotação (XML)' : t === 'screen-manage' ? 'Adicionar NF, exportar ou importar' : 'Nova anotação ou auditoria');
        if (!tem) fecharLeque();
    }
    function fabClique() {
        const t = typeof telaAtivaId === 'function' ? telaAtivaId() : null;
        if ($('fab-leque').classList.contains('on')) return fecharLeque();
        if (t === 'screen-cotacoes') { const i = $('cotacao-xml-file-input'); if (i) i.click(); }
        else if (t === 'screen-manage') {
            const l = $('fab-leque');
            l.innerHTML = '<button type="button" data-a="nf"><i class="fa-solid fa-file-circle-plus"></i>Adicionar NF</button><button type="button" data-a="imp"><i class="fa-solid fa-file-import"></i>Importar relatório (ERP)</button>';
            l.querySelectorAll('button').forEach(b => b.onclick = () => { fecharLeque(); if (b.dataset.a === 'nf') switchToScreen('screen-xml-editor', 'Entrada de NF'); else switchToScreen('screen-import', 'Importar relatório (ERP)'); });
            requestAnimationFrame(() => { l.classList.add('on'); $('fab-veu').classList.add('on'); $('fab-acoes').classList.add('aberto'); });
        }
        else if (t === 'screen-anotacoes') {
            const l = $('fab-leque');
            l.innerHTML = '<button type="button" data-a="aud"><i class="fa-solid fa-clipboard-check"></i>Nova auditoria</button><button type="button" data-a="nota"><i class="fa-solid fa-note-sticky"></i>Nova anotação</button>';
            l.querySelectorAll('button').forEach(b => b.onclick = () => { fecharLeque(); if (b.dataset.a === 'aud') abrirNovaAuditoria(); else abrirNovaAnotacao(); });
            requestAnimationFrame(() => { l.classList.add('on'); $('fab-veu').classList.add('on'); $('fab-acoes').classList.add('aberto'); });
        }
    }

    // ---------- ligações ----------
    function ligar() {
        garantirFab(); garantirFolha(); atualizarRotulos(); ordenacaoCotacoes = atual('cotacoes'); hdrSelAtualizar();
        const sw = window.switchToScreen;
        if (typeof sw === 'function' && !sw.__acoes) {
            window.switchToScreen = function () { fecharFolhaAcoes(); fecharLeque(); const r = sw.apply(this, arguments); hdrSelAtualizar(); setTimeout(hdrSelAtualizar, 120); setTimeout(hdrSelAtualizar, 500); return r; };
            window.switchToScreen.__acoes = true;
        }
        const ds = window.dockSelecaoAtualizar;
        if (typeof ds === 'function' && !ds.__acoes) {
            window.dockSelecaoAtualizar = function () { const r = ds.apply(this, arguments); hdrSelAtualizar(); return r; };
            window.dockSelecaoAtualizar.__acoes = true;
        }
        if (window.MutationObserver) IDS_SEL.forEach(id => { const c = $(id); if (c) new MutationObserver(hdrSelAtualizar).observe(c, { attributes: true, attributeFilter: ['class'] }); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/54-acoes-telas.js'] = '2.52.0';

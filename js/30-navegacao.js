// 30-navegacao.js — Voltar ao ponto exato + links diretos com destaque (2.9.7)
// Parte do script do app (v2.9.7). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// --- 2.9.7: PILHA DE RETORNO ---
// ===================================================================
// Antes, o "Voltar" levava sempre à tela-pai fixa (ex.: do Pedido para a lista de Cotações), mesmo que você tivesse chegado
// ali vindo do Editor de uma NF. Agora, quando uma tela abre outra por um LINK dentro do app (Editor da NF → Pedido, Pedido →
// NF, Controle → Editor...), guardamos de onde você saiu — a tela, o que estava aberto nela (qual NF, qual pedido) e a posição
// da rolagem — e o "Voltar" (botão e gesto) devolve você exatamente ali. Trocar de aba pela barra zera a pilha.
// (pilhaRetorno e navRetornoAtiva ficam em 01-nucleo-config-estado.js; navRetornoAtiva>0 = navegação por link/retorno em andamento, não conta como "troca de aba")
const TELAS_SEM_RETORNO_POR_LINK = ['screen-cotacao-editor', 'screen-anotacoes-editor']; // essas já têm o próprio fluxo de voltar

function assinaturaContextoTela(id) {
    if (id === 'screen-nf-editor') return typeof nfEditorId !== 'undefined' ? String(nfEditorId || '') : '';
    if (id === 'screen-central-pedido') return typeof centralPedidoAtual !== 'undefined' ? String(centralPedidoAtual || '') : '';
    return '';
}
function capturarContextoTela() {
    const at = document.querySelector('.app-screen.active');
    if (!at || TELAS_SEM_RETORNO_POR_LINK.includes(at.id)) return null;
    const titEl = document.getElementById('main-header-title');
    const ctx = { telaId: at.id, titulo: titEl ? titEl.textContent : '', scroll: at.scrollTop, sig: assinaturaContextoTela(at.id) };
    if (at.id === 'screen-nf-editor' && ctx.sig) {
        const id = ctx.sig; ctx.restaurar = () => abrirEditorNf(id);
    } else if (at.id === 'screen-central-pedido' && ctx.sig) {
        const p = ctx.sig, fornAbertos = new Set(centralFornecedoresAbertos), prodAbertos = new Set(centralProdutosExpandidos);
        ctx.restaurar = () => {
            abrirCentralPedido(p);
            centralFornecedoresAbertos = fornAbertos; centralProdutosExpandidos = prodAbertos;
            renderCentralPedidoCompleto(p);
        };
    } else {
        const id = ctx.telaId, titulo = ctx.titulo; ctx.restaurar = () => switchToScreen(id, titulo);
    }
    return ctx;
}
function mostrarBotaoVoltarRetorno() {
    const b = document.getElementById('close-btn'), s = document.getElementById('sync-btn');
    if (b) b.style.display = 'flex';
    if (s) s.style.display = 'none';
}
function telaAtivaId() { const at = document.querySelector('.app-screen.active'); return at ? at.id : null; }
function topoDaPilhaPara(telaId) { const t = pilhaRetorno[pilhaRetorno.length - 1]; return t && t.alvoId === telaId ? t : null; }

function restaurarRolagem(telaId, y) {
    const el = document.getElementById(telaId); if (!el || !y) return;
    [0, 120, 420].forEach(ms => setTimeout(() => { el.scrollTop = y; }, ms));
}
// Chamado pelo botão Voltar e pelo gesto de voltar. Devolve true se tratou (voltou pelo retorno).
function voltarPelaPilha() {
    const id = telaAtivaId();
    const topo = pilhaRetorno[pilhaRetorno.length - 1];
    if (!topo) return false;
    if (topo.alvoId !== id) { pilhaRetorno.length = 0; return false; } // pilha velha (você foi para outro lugar)
    pilhaRetorno.pop();
    navRetornoAtiva++;
    try { topo.restaurar(); } finally { navRetornoAtiva--; }
    restaurarRolagem(topo.telaId, topo.scroll);
    return true;
}
function envolverComRetorno(nome) {
    const orig = window[nome];
    if (typeof orig !== 'function' || orig.__comRetorno) return;
    const w = function (...args) {
        const ctx = navRetornoAtiva ? null : capturarContextoTela();
        navRetornoAtiva++;
        let r;
        try { r = orig.apply(this, args); } catch (e) { navRetornoAtiva--; throw e; }
        const fim = () => {
            if (!ctx) return;
            const id = telaAtivaId();
            if (id && (id !== ctx.telaId || assinaturaContextoTela(id) !== ctx.sig)) {
                pilhaRetorno.push({ ...ctx, alvoId: id });
                if (pilhaRetorno.length > 25) pilhaRetorno.shift();
                mostrarBotaoVoltarRetorno();
            }
        };
        if (r && typeof r.then === 'function') return r.then(v => { navRetornoAtiva--; fim(); return v; }, e => { navRetornoAtiva--; throw e; });
        navRetornoAtiva--; fim();
        return r;
    };
    w.__comRetorno = true;
    window[nome] = w;
}
['abrirEditorNf', 'abrirCentralPedido', 'abrirControleNfs', 'verNoGerenciarNf'].forEach(envolverComRetorno);

// ===================================================================
// --- 2.9.7: ALVO COM DESTAQUE (como o "achar na página" da Apple) ---
// ===================================================================
// Espera o elemento existir (a tela de destino pode estar se desenhando), rola até ele e faz um brilho amarelo que some.
function destacarAlvo(buscar, opts) {
    const o = Object.assign({ tentativas: 30, intervalo: 80 }, opts || {});
    let n = 0;
    const t = setInterval(() => {
        let el = null;
        try { el = buscar(); } catch (e) { el = null; }
        if (el) {
            clearInterval(t);
            const rolar = () => { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); } };
            rolar(); setTimeout(rolar, 400); // de novo depois que as seções terminam de abrir
            el.classList.remove('alvo-destaque'); void el.offsetWidth; el.classList.add('alvo-destaque');
            setTimeout(() => el.classList.remove('alvo-destaque'), 3000);
        } else if (++n >= o.tentativas) clearInterval(t);
    }, o.intervalo);
}

// Pedido → cartão do fornecedor → item com divergência (abre o que estiver fechado e destaca).
function chaveFornecedorNoPedido(pedido, cnpj) {
    const cot = (listaCotacoes || []).find(c => String(c.pedido) === String(pedido));
    if (!cot || !cnpj) return null;
    const grupo = (typeof cnpjsDaMesmaEntidadeFornecedor === 'function') ? cnpjsDaMesmaEntidadeFornecedor(cnpj) : [normalizarCnpj(cnpj)];
    const f = (cot.fornecedores || []).find(x => mesmoCnpj(x.cnpj, cnpj) || cnpjEmLista(grupo, x.cnpj));
    return f ? f.cnpj : null;
}
function abrirItemComDivergenciaNoCartao(card) {
    const cab = card.querySelector('.central-prod .xml-item-badge.pendente') || card.querySelector('.central-prod .xml-item-badge.neutro'); // 2.16.0: em aberto primeiro; sem nenhuma, a pendência relatada
    const prod = cab ? cab.closest('.central-prod') : null;
    if (!prod) return card;
    if (!prod.classList.contains('aberto')) {
        const m = /toggleCentralProduto\('([^']*)'/.exec((prod.querySelector('.central-prod-cab') || {}).getAttribute ? prod.querySelector('.central-prod-cab').getAttribute('onclick') || '' : '');
        if (m) centralProdutosExpandidos.add(m[1]);
        prod.classList.add('aberto');
    }
    return prod.querySelector('.central-divergencia-bloco') || prod;
}
function irParaDivergenciaPedido(pedido, cnpj, codProduto) {
    if (!pedido) return toast('Esta NF não tem pedido vinculado.');
    abrirCentralPedido(String(pedido));
    const chave = chaveFornecedorNoPedido(pedido, cnpj);
    if (chave) { centralFornecedoresAbertos.add(chave); renderCentralPedidoCompleto(String(pedido)); }
    destacarAlvo(() => {
        const cards = [...document.querySelectorAll('#central-fornecedores-container .central-fornecedor')];
        const card = chave ? cards.find(c => c.dataset.cnpj === chave) : cards.find(c => c.querySelector('.central-prod .xml-item-badge.pendente'));
        if (!card) return null;
        if (!card.classList.contains('aberto')) card.classList.add('aberto');
        if (codProduto) { const p = abrirProdutoNoCartao(card, codProduto); if (p) return p; }
        return abrirItemComDivergenciaNoCartao(card);
    });
}
// Abre (se estiver fechado) o produto com este código dentro do cartão do fornecedor e devolve o elemento dele.
function abrirProdutoNoCartao(card, codProduto) {
    const prod = [...card.querySelectorAll('.central-prod')].find(p => { const cab = p.querySelector('.central-prod-cab'); return cab && (cab.getAttribute('onclick') || '').includes("'" + codProduto + "'"); });
    if (!prod) return null;
    if (!prod.classList.contains('aberto')) { centralProdutosExpandidos.add(codProduto); prod.classList.add('aberto'); }
    return prod;
}
// Relatórios → Divergências: abre o pedido já no fornecedor e no produto da divergência (ou só no fornecedor, se não tem produto).
function abrirDivergenciaRelatorio(i) {
    const x = relDivCache[i]; if (!x || !x.pedido) return;
    let cnpj = x.fornecedorCnpj || '';
    if (!cnpj && x.fornecedor) {
        const cot = listaCotacoes.find(c => String(c.pedido) === String(x.pedido));
        const alvo = upAud(x.fornecedor);
        const f = cot && (cot.fornecedores || []).find(f => upAud(nomeExibicaoFornecedor(f.razaoSocial, f.cnpj)) === alvo || upAud(f.razaoSocial || '') === alvo);
        if (f) cnpj = f.cnpj;
    }
    irParaDivergenciaPedido(x.pedido, cnpj, x.codProduto);
}
// Toque no selo/chip/quadro de divergências do cartão do fornecedor (já dentro do pedido).
function irParaDivergenciaCartao(cnpj) {
    centralFornecedoresAbertos.add(cnpj);
    destacarAlvo(() => {
        const card = [...document.querySelectorAll('#central-fornecedores-container .central-fornecedor')].find(c => c.dataset.cnpj === cnpj);
        if (!card) return null;
        card.classList.add('aberto');
        return abrirItemComDivergenciaNoCartao(card);
    });
}
// Selo de aptidão do Gerenciar NF → onde a divergência é resolvida (ou o fornecedor no pedido, se está conferida).
function irParaAptidaoNota(notaId) {
    const nota = notasPendentes.find(n => n.id === notaId); if (!nota) return;
    let ap = null; try { ap = calcularAptidaoSaidaNota(nota); } catch (e) { ap = null; }
    if (!ap || !ap.pedido) return toast('Esta nota ainda não tem pedido vinculado.');
    irParaDivergenciaPedido(ap.pedido, ap.cnpjFornecedor);
}
// Abre o pedido já no fornecedor (sem procurar divergência específica).
function irParaPedidoFornecedor(pedido, cnpj) { irParaDivergenciaPedido(pedido, cnpj); }

// Controle de NFs → onde resolver cada pendência.
function irParaPendenciaControle(chave, tipo) {
    const it = itemControlePorChave(chave); if (!it) return;
    if (tipo === 'erp' && it.nf) {
        abrirEditorNf(it.nf.id);
        if (typeof setAbaEditorNf === 'function') setAbaEditorNf('fin');
        destacarAlvo(() => document.querySelector('#nf-editor-conteudo [data-alvo="erp"]') || document.querySelector('#nf-editor-conteudo .nfe-chips'));
    } else if (tipo === 'xml') {
        const id = it.erp ? it.erp.id : (it.nf ? it.nf.id : null);
        if (!id) return;
        abrirEditorNf(id);
        destacarAlvo(() => document.querySelector('#nf-editor-conteudo [data-alvo="sem-xml"]'));
    } else if (tipo === 'gerenciar') {
        verNoGerenciarNf(chave);
        destacarAlvo(() => document.querySelector('#lista-notas-pendentes .nota-item'));
    } else if (tipo === 'divergencia') {
        const ped = it.pedido || (it.nf && it.nf.pedido);
        irParaDivergenciaPedido(ped, it.cnpj);
    }
}

// ===================================================================
// --- 2.9.9: MODO WEB (computador) x MODO APARELHO (iPhone/iPad) ---
// ===================================================================
// No computador (mouse + tela larga) o app não usa o movimento do iPhone (dock que encolhe, telas deslizando, cascata, folhas com mola);
// usa o movimento do macOS: curto, sem mola, só dissolver com um recuo mínimo (ver o bloco "2.9.9" do style.css). Dá para forçar
// pelo endereço: ?plataforma=web ou ?plataforma=aparelho.
(function () {
    'use strict';
    const mq = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)') : { matches: false, addEventListener() {} };
    function plataforma() {
        let forcada = '';
        try { forcada = new URLSearchParams(location.search).get('plataforma') || ''; } catch (e) { forcada = ''; }
        if (forcada === 'web' || forcada === 'aparelho') return forcada;
        return mq.matches ? 'web' : 'aparelho';
    }
    function aplicar() {
        const v = plataforma();
        if (document.body.getAttribute('data-plataforma') !== v) document.body.setAttribute('data-plataforma', v);
        if (typeof window.dockAtualizarRecolhimento === 'function') window.dockAtualizarRecolhimento();
        if (aplicar.ultima !== v) { // trocou de modo (ou primeira vez): redesenha a barra/menu lateral e a lista de ordem sem a divisão dock x Mais
            aplicar.ultima = v;
            try { if (typeof reordenarMenusDOM === 'function' && typeof appConfig !== 'undefined' && appConfig.personalizacao && appConfig.personalizacao.menuOrder) { reordenarMenusDOM(appConfig.personalizacao.menuOrder); if (document.getElementById('menu-reorder-list') && typeof popularListaReordenar === 'function') popularListaReordenar(); } } catch (e) { }
        }
    }
    window.aplicarPlataforma = aplicar;
    if (document.body) aplicar(); else document.addEventListener('DOMContentLoaded', aplicar);
    if (mq.addEventListener) mq.addEventListener('change', aplicar); else if (mq.addListener) mq.addListener(aplicar);
})();

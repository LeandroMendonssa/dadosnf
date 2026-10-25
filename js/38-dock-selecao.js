// 38-dock-selecao.js — Dock de seleção em lote (2.15.0)
// Parte do script do app. Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// Quando uma tela entra em "seleção em lote" (Gerenciar, Anotações, Controle de NFs), a dock principal dá lugar a uma dock de
// ações sobre o que foi marcado — a mesma cápsula fina das Anotações, que sobe com mola. Quem está selecionando não precisa trocar
// de tela até terminar: por isso só a seleção em lote troca a dock (nada de dock secundária em outras situações).
// Cada tela só avisa o estado (dockSelecaoAtualizar); as ações chamam as mesmas funções que já existiam nas barras antigas.
// Para incluir uma nova tela com seleção em lote: acrescentar uma entrada em DOCK_SELECAO_TELAS e chamar dockSelecaoAtualizar.
// ===================================================================
const DOCK_SELECAO_TELAS = {
    notas: {
        tela: 'screen-manage', sair: 'toggleSelectionModeNotas()', todas: 'selecionarTodasNotasToggle()',
        acoes: [
            { ic: 'fa-solid fa-clock', t: 'Marcar como pendente', f: 'bulkMarcarPendente(true)' },
            { ic: 'fa-solid fa-rotate-left', t: 'Remover pendência', f: 'bulkMarcarPendente(false)' },
            { ic: 'fa-solid fa-pen', t: 'Editar em lote', f: 'abrirEdicaoEmLoteNotas()' },
            { ic: 'fa-solid fa-box-archive', t: 'Arquivar selecionadas', f: 'bulkArquivarNotas()' },
            { ic: 'fa-solid fa-trash', t: 'Excluir selecionadas', f: 'bulkExcluirNotas()', perigo: true }
        ]
    },
    anotacoes: {
        tela: 'screen-anotacoes', sair: 'toggleModoSelecaoAnotacoes()',
        acoes: [{ ic: 'fab fa-whatsapp', t: 'Exportar relatório', f: 'exportarAnotacoesWhatsapp()', rotulo: 'Exportar', primaria: true }]
    },
    controle: {
        tela: 'screen-controle-nfs', sair: 'alternarSelecaoControle()',
        acoes: [
            { ic: 'fa-solid fa-circle-check', t: 'Enviada ao financeiro', f: 'marcarSelecionadasEnviadas()', rotulo: 'Financeiro' },
            { ic: 'fa-solid fa-file-circle-minus', t: 'Não vai ao financeiro', f: 'marcarSelecionadasDiretas()', rotulo: 'Direta' }
        ]
    }
};
const dockSelecaoEstado = {};   // ctx → { ativo, n, todas }
let dockSelecaoCtx = null;      // contexto cuja dock está montada agora

function dockSelecaoAtualizar(ctx, ativo, n, todas) {
    if (!DOCK_SELECAO_TELAS[ctx]) return;
    dockSelecaoEstado[ctx] = { ativo: !!ativo, n: n || 0, todas: !!todas };
    dockSelecaoReavaliar();
}
function dockSelecaoReavaliar() {
    const el = document.getElementById('dock-selecao'); if (!el) return;
    // vale o contexto cuja tela está aberta e em modo de seleção
    const ctx = Object.keys(DOCK_SELECAO_TELAS).find(c => dockSelecaoEstado[c] && dockSelecaoEstado[c].ativo && document.getElementById(DOCK_SELECAO_TELAS[c].tela) && document.getElementById(DOCK_SELECAO_TELAS[c].tela).classList.contains('active'));
    if (!ctx) { el.classList.remove('ds-on'); document.body.classList.remove('sel-lote'); return; }
    const cfg = DOCK_SELECAO_TELAS[ctx], st = dockSelecaoEstado[ctx];
    if (dockSelecaoCtx !== ctx) {   // monta (uma vez por tela)
        dockSelecaoCtx = ctx;
        el.innerHTML = `<button type="button" class="ds-bt ds-x" onclick="${cfg.sair}" aria-label="Cancelar seleção" title="Cancelar seleção"><i class="fa-solid fa-xmark"></i></button>`
            + `<span class="ds-cont" id="ds-cont"></span>`
            + (cfg.todas ? `<button type="button" class="ds-bt ds-txt" id="ds-todas" onclick="${cfg.todas}">Todas</button>` : '')
            + `<span class="ds-esp"></span>`
            + cfg.acoes.map(a => `<button type="button" class="ds-bt ds-acao${a.perigo ? ' perigo' : ''}${a.primaria ? ' pri' : ''}" onclick="${a.f}" title="${a.t}" aria-label="${a.t}"><i class="${a.ic}"></i>${a.rotulo ? `<span>${a.rotulo}</span>` : ''}</button>`).join('');
    }
    document.getElementById('ds-cont').textContent = st.n ? `${st.n} sel.` : 'Selecione';
    const bt = document.getElementById('ds-todas'); if (bt) bt.textContent = st.todas ? 'Nenhuma' : 'Todas';
    el.querySelectorAll('.ds-acao').forEach(b => b.disabled = st.n === 0);
    el.classList.add('ds-on'); document.body.classList.add('sel-lote');
}
// trocar de tela (ou sair dela) esconde/mostra a dock sem cada tela precisar avisar
(function observarTelas() {
    let t = 0;
    const re = () => { clearTimeout(t); t = setTimeout(dockSelecaoReavaliar, 30); };
    const alvo = document.querySelector('.main-content') || document.body;
    new MutationObserver(re).observe(alvo, { subtree: true, attributes: true, attributeFilter: ['class'] });
})();

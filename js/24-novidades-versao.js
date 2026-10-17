// 24-novidades-versao.js — Popup de novidades a cada versão nova (2.3.1)
// Parte do script do app. Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// --- 2.3.1: POPUP DE NOVIDADES ---
// ===================================================================
// Ao abrir o app numa versão que a pessoa ainda não viu (neste aparelho), aparece uma janela com as melhorias e atalhos para as
// telas a testar. O conteúdo vem da entrada mais recente de HISTORICO_FASES (14-historico-mudancas.js):
//   novidades:   ['frase curta', ...]                       (se faltar, usa o começo de "implementado")
//   testarLinks: [{ rotulo: 'Texto do botão', acao: 'controle-nfs' | 'pedido' | 'nf-erp' | 'historico-mudancas', arg: 'valor' }]
// "Visto" fica só neste aparelho (localStorage); se o navegador bloquear o armazenamento, o popup aparece de novo na próxima abertura.
const CHAVE_VERSAO_NOVIDADES = 'app.versaoNovidadesVista';
const ACOES_NOVIDADE = {
    'controle-nfs': () => abrirControleNfs(),
    'historico-mudancas': () => switchToScreen('screen-historico-mudancas', 'Histórico de Mudanças'),
    'pedido': arg => abrirCentralPedido(String(arg)),
    'nf-erp': arg => abrirEditorNf(String(arg))
};
let novidadesLinksAtuais = [];
let novidadesAgendado = false;

function lerVersaoNovidadesVista() { try { return localStorage.getItem(CHAVE_VERSAO_NOVIDADES); } catch (e) { return null; } }
function gravarVersaoNovidadesVista(v) { try { localStorage.setItem(CHAVE_VERSAO_NOVIDADES, String(v)); } catch (e) { /* sem armazenamento: aparece de novo */ } }

function mostrarNovidadesVersao(forcar) {
    const fase = (typeof HISTORICO_FASES !== 'undefined') ? HISTORICO_FASES[0] : null;
    const modal = document.getElementById('novidades-modal');
    if (!fase || !modal) return false;
    if (!forcar && lerVersaoNovidadesVista() === String(fase.numero)) return false;
    const tira = t => { const s = String(t); return s.length > 220 ? s.slice(0, 217).replace(/\s+\S*$/, '') + '…' : s; };
    const itens = (fase.novidades && fase.novidades.length ? fase.novidades : (fase.implementado || []).slice(0, 3).map(tira));
    novidadesLinksAtuais = (fase.testarLinks || []).filter(l => l && ACOES_NOVIDADE[l.acao]);
    document.getElementById('novidades-titulo').textContent = `Versão ${fase.numero}`;
    document.getElementById('novidades-corpo').innerHTML =
        `<div class="novidades-nome">${escRel(fase.nome)}</div>` +
        `<ul class="novidades-lista">${itens.map(i => `<li>${escRel(i)}</li>`).join('')}</ul>` +
        (novidadesLinksAtuais.length
            ? `<div class="novidades-testar"><strong>Para testar</strong><div class="novidades-links">${novidadesLinksAtuais.map((l, k) => `<button type="button" class="central-status-toggle" onclick="irParaNovidade(${k})">${escRel(l.rotulo)}</button>`).join('')}</div></div>`
            : '');
    modal.classList.add('active');
    return true;
}
function fecharNovidades() {
    const fase = (typeof HISTORICO_FASES !== 'undefined') ? HISTORICO_FASES[0] : null;
    if (fase) gravarVersaoNovidadesVista(fase.numero);
    const modal = document.getElementById('novidades-modal'); if (modal) modal.classList.remove('active');
}
function irParaNovidade(k) {
    const l = novidadesLinksAtuais[k]; if (!l) return;
    fecharNovidades();
    try { ACOES_NOVIDADE[l.acao](l.arg); } catch (e) { console.error('Erro ao abrir atalho de novidade:', e); toast('✕ Não consegui abrir essa tela.'); }
}
function irParaHistoricoDeMudancas() { fecharNovidades(); ACOES_NOVIDADE['historico-mudancas'](); }

// Espera o app aparecer (login feito e acesso aprovado) e não atropela outro popup aberto.
function agendarNovidadesVersao() {
    if (novidadesAgendado) return;
    novidadesAgendado = true;
    let tentativas = 0;
    const tentar = () => {
        const app = document.getElementById('app-container');
        const logado = app && app.style.display === 'flex';
        const outroModal = document.querySelector('.modal-screen.active');
        if (logado && !outroModal) { mostrarNovidadesVersao(false); return; }
        if (++tentativas < 20) setTimeout(tentar, 1500);
    };
    setTimeout(tentar, 2000);
}
auth.onAuthStateChanged(user => { if (user) agendarNovidadesVersao(); });

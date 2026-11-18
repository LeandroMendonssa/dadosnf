/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/60-instalacao-app.js'] = '2.57.4';
// 2.57.1: sugestão para instalar o app na tela inicial.
// Computador (Chrome/Edge) e Android: usa o botão do próprio navegador.
// iPhone (Safari): não há botão, então mostra o passo a passo.
// Aparece uma só vez por aparelho: depois de fechar (ou instalar), não volta (guardado no navegador, sem dado no Firebase).

let instEvento = null;
const INST_CHAVE_FECHADO = 'instAvisoFechadoEm';

function instJaInstalado() {
    return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
}
// 2.57.4: o aviso aparece só uma vez por aparelho. Depois de fechado (ou de aceitar a instalação), não volta mais.
function instJaMostrado() {
    try { return !!localStorage.getItem(INST_CHAVE_FECHADO); } catch (e) { return false; }
}
function instFechar() {
    const el = document.getElementById('inst-aviso');
    if (el) el.remove();
    try { localStorage.setItem(INST_CHAVE_FECHADO, String(Date.now())); } catch (e) { }
}
function instMostrar(titulo, texto, botao) {
    if (document.getElementById('inst-aviso') || instJaInstalado() || instJaMostrado()) return;
    // 2.57.3: não sobrepõe outras janelas (popup de novidades etc.); tenta de novo depois.
    if (document.querySelector('.modal-screen.active')) { setTimeout(() => instMostrar(titulo, texto, botao), 3000); return; }
    const el = document.createElement('div');
    el.id = 'inst-aviso';
    el.className = 'inst-aviso';
    el.innerHTML = `<div class="inst-txt"><b>${titulo}</b>${texto}</div>${botao ? `<button type="button" id="inst-botao">${botao}</button>` : ''}<button type="button" id="inst-fechar" aria-label="Fechar">Agora não</button>`;
    document.body.appendChild(el);
    document.getElementById('inst-fechar').onclick = instFechar;
    const b = document.getElementById('inst-botao');
    if (b) b.onclick = async () => {
        if (!instEvento) return;
        instEvento.prompt();
        try { await instEvento.userChoice; } catch (e) { }
        instEvento = null;
        instFechar();
    };
}

// Chrome/Edge (computador e Android): o navegador avisa quando o app pode ser instalado.
window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    instEvento = e;
    setTimeout(() => instMostrar('Instale o app', 'Abra direto pelo ícone, sem o navegador.', 'Instalar'), 4000);
});

// iPhone/iPad no Safari: não há botão de instalação; mostramos o caminho.
(function instAvisoIphone() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const safari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
    if (ios && safari) setTimeout(() => instMostrar('Adicione à Tela de Início', 'Toque em Compartilhar e depois em "Adicionar à Tela de Início".', ''), 4000);
})();

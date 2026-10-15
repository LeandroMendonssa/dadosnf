// 22-vidro-liquido.js — Liquid Glass na navegação (2.2.0)
// Parte do script do app (v2.2.0). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// --- 2.2.0: VIDRO NA NAVEGAÇÃO ---
// ===================================================================
// 1) mede a altura do cabeçalho de vidro (o conteúdo das telas começa abaixo dele e rola por baixo);
// 2) a pílula do dock desliza até a aba ativa; 3) o cabeçalho ganha uma linha de borda quando o conteúdo rola por baixo.
(function () {
    function cabecalho() { return document.querySelector('.main-content > .header'); }
    function medirCabecalho() {
        const h = cabecalho(); if (!h) return;
        const alt = Math.ceil(h.getBoundingClientRect().height);
        if (alt > 0) document.documentElement.style.setProperty('--header-h', alt + 'px');
    }
    function atualizarBordaCabecalho() {
        const h = cabecalho(); if (!h) return;
        const tela = document.querySelector('.app-screen.active');
        h.classList.toggle('scrolled', !!tela && tela.scrollTop > 6);
    }
    let primeiraPilula = true;
    function atualizarPilulaDock() {
        const barra = document.getElementById('tab-bar'); if (!barra) return;
        let pilula = barra.querySelector('.dock-pill');
        if (!pilula) { pilula = document.createElement('span'); pilula.className = 'dock-pill'; pilula.setAttribute('aria-hidden', 'true'); barra.insertBefore(pilula, barra.firstChild); }
        const ativa = barra.querySelector('.tab-item.active');
        if (!ativa || !ativa.offsetWidth) { pilula.style.opacity = '0'; return; } // dock escondido (teclado/desktop) ou sem aba ativa
        if (primeiraPilula) pilula.style.transition = 'none';
        pilula.style.opacity = '1';
        pilula.style.width = ativa.offsetWidth + 'px';
        pilula.style.height = ativa.offsetHeight + 'px';
        pilula.style.transform = `translate(${ativa.offsetLeft}px, ${ativa.offsetTop}px)`;
        if (primeiraPilula) { void pilula.offsetWidth; pilula.style.transition = ''; primeiraPilula = false; }
        // mantém a aba ativa à vista quando o dock rola na horizontal
        if (barra.scrollWidth > barra.clientWidth) {
            const alvo = ativa.offsetLeft - (barra.clientWidth - ativa.offsetWidth) / 2;
            barra.scrollTo({ left: Math.max(0, alvo), behavior: 'smooth' });
        }
    }
    function iniciarVidro() {
        medirCabecalho(); atualizarBordaCabecalho();
        const h = cabecalho();
        if (h && typeof ResizeObserver === 'function') new ResizeObserver(medirCabecalho).observe(h);
        const barra = document.getElementById('tab-bar');
        if (barra) {
            if (typeof MutationObserver === 'function') new MutationObserver(() => requestAnimationFrame(atualizarPilulaDock)).observe(barra, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
            if (typeof ResizeObserver === 'function') new ResizeObserver(() => requestAnimationFrame(atualizarPilulaDock)).observe(barra);
            requestAnimationFrame(atualizarPilulaDock);
        }
        const wrapper = document.querySelector('.screen-wrapper');
        if (wrapper) {
            wrapper.addEventListener('scroll', e => { if (e.target && e.target.classList && e.target.classList.contains('app-screen')) atualizarBordaCabecalho(); }, true);
            if (typeof MutationObserver === 'function') new MutationObserver(atualizarBordaCabecalho).observe(wrapper, { subtree: true, attributes: true, attributeFilter: ['class'] });
        }
        if (typeof MutationObserver === 'function') new MutationObserver(() => requestAnimationFrame(atualizarPilulaDock)).observe(document.body, { attributes: true, attributeFilter: ['class'] }); // teclado abre/fecha
        window.addEventListener('resize', () => { medirCabecalho(); requestAnimationFrame(atualizarPilulaDock); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarVidro); else iniciarVidro();
})();

// 22-vidro-liquido.js — Liquid Glass na navegação (2.4.2: dock sem engasgo na rolagem/volta; 2.2.0; 2.3.2: dock com troca suave, contraste, compacta ao rolar e opções na Personalização)
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
    // 2.3.2: "Reduzir Movimento" do aparelho. Respeitado por padrão, mas como FUSÃO suave (não corte seco); a opção "Sempre animar" ignora o ajuste.
    const mqReduz = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    function reduzMovimento() { return mqReduz.matches && document.body.getAttribute('data-dock-mov') !== 'sempre'; }
    let ultimoAlvo = '', fundindo = false, tFundir = 0;
    // 2.4.2: estado da rolagem da dock. Evita brigar com o dedo, com a inércia e com o "elástico" das pontas.
    let dockRolando = false, precisaExpandir = false, abaCentralizada = null, tFimRolagem = 0, quadroPendente = 0;
    // só a pílula (barato, sem mexer na rolagem): é o que roda a cada quadro durante o encolher/expandir
    function posicionarPilula() {
        const barra = document.getElementById('tab-bar'); if (!barra) return;
        let pilula = barra.querySelector('.dock-pill');
        if (!pilula) { pilula = document.createElement('span'); pilula.className = 'dock-pill'; pilula.setAttribute('aria-hidden', 'true'); barra.insertBefore(pilula, barra.firstChild); }
        const ativa = barra.querySelector('.tab-item.active');
        if (!ativa || !ativa.offsetWidth) { pilula.style.opacity = '0'; return; } // dock escondido (teclado/desktop) ou sem aba ativa
        barra.classList.toggle('dock-sem-rolagem', barra.scrollWidth <= barra.clientWidth + 1); // sem barra rolável, o arrasto de dedo escolhe a aba
        const alvo = `${ativa.offsetLeft},${ativa.offsetTop},${ativa.offsetWidth},${ativa.offsetHeight}`;
        const aplicar = () => {
            pilula.style.width = ativa.offsetWidth + 'px';
            pilula.style.height = ativa.offsetHeight + 'px';
            pilula.style.transform = `translate(${ativa.offsetLeft}px, ${ativa.offsetTop}px)`;
        };
        if (primeiraPilula) {
            pilula.style.transition = 'none'; pilula.style.opacity = '1'; aplicar();
            void pilula.offsetWidth; pilula.style.transition = ''; primeiraPilula = false;
        } else if (alvo !== ultimoAlvo && reduzMovimento() && !barra.classList.contains('dock-redim')) {
            // fusão: some no lugar antigo e reaparece suave no novo
            clearTimeout(tFundir); fundindo = true; pilula.style.opacity = '0';
            tFundir = setTimeout(() => { pilula.style.transition = 'none'; aplicar(); void pilula.offsetWidth; pilula.style.transition = ''; pilula.style.opacity = '1'; fundindo = false; }, 200);
        } else if (!fundindo) { pilula.style.opacity = '1'; aplicar(); }
        ultimoAlvo = alvo;
    }
    // leva a aba ativa para a vista, UMA vez por troca de aba, e só se ela estiver cortada.
    // (antes isso rodava a cada quadro e a cada mutação: cada chamada reiniciava a rolagem suave, o que causava o engasgo)
    function manterAtivaVisivel() {
        const barra = document.getElementById('tab-bar'); if (!barra) return;
        const ativa = barra.querySelector('.tab-item.active'); if (!ativa || !ativa.offsetWidth) return;
        if (barra.scrollWidth <= barra.clientWidth + 1) return;
        if (dockRolando || barra.classList.contains('dock-toque')) return; // nunca disputa com o dedo, a inércia ou o elástico das pontas
        if (ativa === abaCentralizada) return;                             // esta aba já foi tratada
        abaCentralizada = ativa;
        const margem = 10, ini = barra.scrollLeft, fim = ini + barra.clientWidth, esq = ativa.offsetLeft, dir = esq + ativa.offsetWidth;
        if (esq - margem >= ini && dir + margem <= fim) return;            // já está inteira à vista: não mexe na rolagem
        const max = barra.scrollWidth - barra.clientWidth;
        const alvo = Math.min(max, Math.max(0, esq - (barra.clientWidth - ativa.offsetWidth) / 2));
        if (Math.abs(alvo - ini) < 2) return;
        barra.scrollTo({ left: alvo, behavior: reduzMovimento() ? 'auto' : 'smooth' });
    }
    function atualizarPilulaDock() { posicionarPilula(); manterAtivaVisivel(); }
    // observers e resize chamam isto: no máximo uma atualização por quadro
    function agendarAtualizacao() { if (quadroPendente) return; quadroPendente = requestAnimationFrame(() => { quadroPendente = 0; atualizarPilulaDock(); }); }
    // enquanto a dock muda de tamanho, a pílula acompanha quadro a quadro (só a pílula; nunca a rolagem)
    function acompanharPilula(ms) {
        const barra = document.getElementById('tab-bar'); if (!barra) return;
        barra.classList.add('dock-redim');
        const t0 = performance.now();
        (function f() { posicionarPilula(); if (performance.now() - t0 < ms) requestAnimationFrame(f); else { barra.classList.remove('dock-redim'); posicionarPilula(); } })();
    }

    // ---------- dock recolhida por padrão; expande só quando você vai trocar de aba (2.4.1) ----------
    // Expande: ao tocar na dock, ao trocar de tela, ao rolar para cima com vontade. Recolhe: sozinha depois de uns segundos sem interação,
    // ao rolar para baixo e ao digitar num campo de texto.
    const ESPERA_RECOLHER = 2800;
    let telaRolagem = null, ultimoY = 0, acumSobe = 0, timerRecolher = null;
    function definirCompacta(v) {
        const barra = document.getElementById('tab-bar'); if (!barra || barra.classList.contains('compacta') === v) return;
        acompanharPilula(Math.round(parseFloat(getComputedStyle(barra).getPropertyValue('--dock-dur')) * 1000 || 500) + 80);
        barra.classList.toggle('compacta', v);
    }
    function encolherAtivo() {
        const b = document.body;
        return b.getAttribute('data-dock') !== 'classico' && b.getAttribute('data-dock-encolher') !== 'nao' && b.getAttribute('data-tab-icons') !== 'off' && !reduzMovimento();
    }
    function agendarRecolher() {
        clearTimeout(timerRecolher);
        if (!encolherAtivo()) return;
        timerRecolher = setTimeout(() => {
            const barra = document.getElementById('tab-bar');
            if (barra && (barra.classList.contains('dock-toque') || dockRolando)) { agendarRecolher(); return; } // dedo ou rolagem ainda na dock
            definirCompacta(true);
        }, ESPERA_RECOLHER);
    }
    function expandirDock() { definirCompacta(false); agendarRecolher(); }
    function atualizarRecolhimento() { // chamada quando a opção muda
        clearTimeout(timerRecolher);
        if (encolherAtivo()) agendarRecolher(); else definirCompacta(false);
    }
    window.dockAtualizarRecolhimento = atualizarRecolhimento;
    function aoRolarTela(tela) {
        if (!encolherAtivo()) { definirCompacta(false); return; }
        const y = tela.scrollTop;
        if (tela !== telaRolagem) { telaRolagem = tela; ultimoY = y; acumSobe = 0; return; }
        const d = y - ultimoY; if (Math.abs(d) < 3) return;
        ultimoY = y;
        if (d > 0) { acumSobe = 0; if (y > 80) { clearTimeout(timerRecolher); definirCompacta(true); } } // rolando para baixo: recolhe
        else { acumSobe += -d; if (acumSobe >= 60) expandirDock(); } // rolagem para cima com vontade: expande e recolhe de novo se parar
    }
    function aoTrocarTela() {
        const ativaTela = document.querySelector('.app-screen.active');
        if (ativaTela !== telaRolagem) { telaRolagem = ativaTela; ultimoY = ativaTela ? ativaTela.scrollTop : 0; acumSobe = 0; expandirDock(); }
    }
    function ehCampoDeTexto(el) {
        if (!el || !el.matches) return false;
        if (el.matches('textarea, [contenteditable="true"], [contenteditable=""]')) return true;
        return el.tagName === 'INPUT' && !/^(checkbox|radio|range|file|button|submit|reset|color|image)$/i.test(el.type || 'text');
    }
    document.addEventListener('focusin', e => { if (encolherAtivo() && ehCampoDeTexto(e.target)) { clearTimeout(timerRecolher); definirCompacta(true); } }); // digitando: a dock sai do caminho

    // ---------- toque: a pílula já começa a deslizar quando o dedo encosta, e acompanha se você arrastar ----------
    function iniciarToqueDock(barra) {
        let origem = null, xInicial = 0, previa = null, suprimirClique = false, tPre = 0;
        const abaSob = x => { let m = null, d = 1e9; barra.querySelectorAll('.tab-item').forEach(a => { const r = a.getBoundingClientRect(); const dist = Math.abs(x - (r.left + r.width / 2)); if (dist < d) { d = dist; m = a; } }); return m; };
        const pilula = () => barra.querySelector('.dock-pill');
        const semRolagem = () => barra.classList.contains('dock-sem-rolagem');
        const preMover = a => { // só visual; a navegação acontece no clique/soltar
            const pil = pilula(); if (!pil || !a || a === previa || reduzMovimento()) return; previa = a;
            pil.style.opacity = '1'; pil.style.width = a.offsetWidth + 'px'; pil.style.height = a.offsetHeight + 'px'; pil.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`;
        };
        const iniciarPrevia = () => { if (!origem || dockRolando) return; precisaExpandir = false; clearTimeout(timerRecolher); definirCompacta(false); preMover(origem); };
        barra.addEventListener('pointerdown', e => {
            const a = e.target.closest ? e.target.closest('.tab-item') : null; if (!a) return;
            origem = a; xInicial = e.clientX; previa = null; barra.classList.add('dock-toque'); clearTimeout(timerRecolher); clearTimeout(tPre);
            precisaExpandir = true;
            // dock sem rolagem: resposta imediata. Com rolagem: espera um instante para saber se é toque ou arrasto de rolagem
            if (semRolagem()) iniciarPrevia(); else tPre = setTimeout(iniciarPrevia, 110);
        });
        barra.addEventListener('pointermove', e => { if (origem && semRolagem() && Math.abs(e.clientX - xInicial) > 10) preMover(abaSob(e.clientX)); });
        // rolagem da dock (dedo, inércia, elástico das pontas ou rolagem programática): nada de animar a dock nem reposicionar a rolagem enquanto durar
        barra.addEventListener('scroll', () => {
            if (!dockRolando) { dockRolando = true; clearTimeout(tPre); if (previa) { previa = null; posicionarPilula(); } }
            clearTimeout(tFimRolagem);
            tFimRolagem = setTimeout(() => {
                dockRolando = false;
                if (!origem) { posicionarPilula(); if (precisaExpandir) { precisaExpandir = false; expandirDock(); } }
            }, 140);
        }, { passive: true });
        const encerrar = () => { clearTimeout(tPre); const tinha = !!previa; origem = null; previa = null; barra.classList.remove('dock-toque'); if (tinha) setTimeout(posicionarPilula, 0); if (!dockRolando && precisaExpandir) { precisaExpandir = false; expandirDock(); } else agendarRecolher(); };
        barra.addEventListener('pointerup', e => {
            if (!origem) return;
            const o = origem, arrastou = Math.abs(e.clientX - xInicial) > 10, destino = arrastou && !dockRolando ? abaSob(e.clientX) : o;
            encerrar();
            if (destino && destino !== o) { destino.click(); suprimirClique = true; setTimeout(() => { suprimirClique = false; }, 500); } // o clique nativo que vem depois (na aba de origem) é descartado
        });
        barra.addEventListener('pointercancel', encerrar);
        barra.addEventListener('click', e => { if (suprimirClique) { suprimirClique = false; e.stopPropagation(); e.preventDefault(); } }, true);
    }
    function iniciarVidro() {
        medirCabecalho(); atualizarBordaCabecalho();
        const h = cabecalho();
        if (h && typeof ResizeObserver === 'function') new ResizeObserver(medirCabecalho).observe(h);
        const barra = document.getElementById('tab-bar');
        if (barra) {
            if (typeof MutationObserver === 'function') new MutationObserver(agendarAtualizacao).observe(barra, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
            if (typeof ResizeObserver === 'function') new ResizeObserver(agendarAtualizacao).observe(barra);
            agendarAtualizacao();
            iniciarToqueDock(barra);
        }
        const wrapper = document.querySelector('.screen-wrapper');
        if (wrapper) {
            wrapper.addEventListener('scroll', e => { if (e.target && e.target.classList && e.target.classList.contains('app-screen')) { atualizarBordaCabecalho(); if (e.target.classList.contains('active')) aoRolarTela(e.target); } }, true);
            if (typeof MutationObserver === 'function') new MutationObserver(() => { atualizarBordaCabecalho(); aoTrocarTela(); }).observe(wrapper, { subtree: true, attributes: true, attributeFilter: ['class'] });
        }
        if (typeof MutationObserver === 'function') new MutationObserver(agendarAtualizacao).observe(document.body, { attributes: true, attributeFilter: ['class'] }); // teclado abre/fecha
        agendarRecolher(); // ao abrir o app a dock aparece completa e recolhe sozinha se você não mexer
        window.addEventListener('resize', () => { medirCabecalho(); agendarAtualizacao(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarVidro); else iniciarVidro();
})();


// ===================================================================
// --- 2.3.2: OPÇÕES DA DOCK (Configurações → Personalização) ---
// ===================================================================
// Tudo vem ligado por padrão: vidro líquido, espessura 60%, velocidade normal, encolher ao rolar e respeitar "Reduzir Movimento"
// do aparelho (com fusão suave). Guardado em appConfig.personalizacao junto das demais opções.
const VELOCIDADE_DOCK = { rapida: '.3s', normal: '.5s', lenta: '.8s' };
function aplicarDockPersonalizacao() {
    const c = (typeof appConfig !== 'undefined' && appConfig.personalizacao) || {};
    const b = document.body, barraDock = document.getElementById('tab-bar');
    const r = (barraDock || document.documentElement).style; // variáveis só na barra: mudar no documento inteiro refaz o estilo da página toda
    const defAttr = (nome, v) => { if (b.getAttribute(nome) !== v) b.setAttribute(nome, v); };
    defAttr('data-dock', c.dockEstilo === 'classico' ? 'classico' : 'liquido');
    defAttr('data-dock-encolher', c.dockEncolher === 'nao' ? 'nao' : 'sim');
    defAttr('data-dock-mov', c.dockMovimento === 'sempre' ? 'sempre' : 'respeitar');
    if (window.dockAtualizarRecolhimento && b.__dockEncolherVisto !== b.getAttribute('data-dock-encolher') + b.getAttribute('data-dock')) { b.__dockEncolherVisto = b.getAttribute('data-dock-encolher') + b.getAttribute('data-dock'); window.dockAtualizarRecolhimento(); }
    const esp = Number.isFinite(c.dockEspessura) ? Math.min(100, Math.max(0, c.dockEspessura)) : 60;
    const espTxt = (esp / 100).toFixed(2), durTxt = VELOCIDADE_DOCK[c.dockVelocidade] || VELOCIDADE_DOCK.normal;
    if (r.getPropertyValue('--dock-esp') !== espTxt) r.setProperty('--dock-esp', espTxt);
    if (r.getPropertyValue('--dock-dur') !== durTxt) r.setProperty('--dock-dur', durTxt);
    const set = (id, v) => { const el = document.getElementById(id); if (el && el.value !== String(v)) el.value = v; };
    set('dock-estilo', b.getAttribute('data-dock')); set('dock-velocidade', VELOCIDADE_DOCK[c.dockVelocidade] ? c.dockVelocidade : 'normal');
    set('dock-encolher', b.getAttribute('data-dock-encolher')); set('dock-movimento', b.getAttribute('data-dock-mov')); set('dock-espessura', esp);
    const val = document.getElementById('dock-espessura-valor'); if (val) val.textContent = esp + '%';
    const diag = document.getElementById('dock-movimento-diag');
    if (diag) {
        const reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        diag.textContent = reduz
            ? 'Seu aparelho está com "Reduzir Movimento" LIGADO (Ajustes > Acessibilidade > Movimento). ' + (b.getAttribute('data-dock-mov') === 'sempre' ? 'Aqui o app ignora e anima.' : 'A troca de aba usa fusão suave e a dock não encolhe.')
            : 'Seu aparelho está com "Reduzir Movimento" desligado: a pílula desliza normalmente.';
    }
}
function previaDockEspessura(v) {
    const barraDock = document.getElementById('tab-bar'); (barraDock || document.documentElement).style.setProperty('--dock-esp', (Number(v) / 100).toFixed(2));
    const val = document.getElementById('dock-espessura-valor'); if (val) val.textContent = v + '%';
}
function alterarDockOpcao(chave, valor) {
    appConfig.personalizacao[chave] = valor;
    aplicarDockPersonalizacao();
    salvarPersonalizacao();
}

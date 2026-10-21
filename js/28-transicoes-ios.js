// 28-transicoes-ios.js — 2.7.0: acabamento das transições no estilo do iPhone
//  • voltar arrastando da borda esquerda (telas internas)
//  • cascata sutil dos itens ao abrir uma tela
//  • carregamento na primeira abertura de cada tela: blocos com brilho ou texto (escolha em Personalização)
//  • duração da troca de aba escolhida pelo usuário
// O movimento de entrar/voltar/trocar aba em si é CSS (style.css) e é disparado por trocarTelaAnimada() (js/02).
(function () {
    'use strict';
    const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    const CURVA = 'cubic-bezier(.32,.72,0,1)', PUSH_MS = 440;
    const sempre = () => document.body.getAttribute('data-transition') === 'none';

    // ---------- duração da troca de aba + tipo de carregamento (Personalização) ----------
    window.aplicarTransicoesExtras = function () {
        const pz = (typeof appConfig !== 'undefined' && appConfig.personalizacao) || {};
        const ms = Math.min(700, Math.max(120, parseInt(pz.tabDuracao, 10) || 360));
        const v = ms + 'ms';
        if (document.documentElement.style.getPropertyValue('--aba-dur') !== v) document.documentElement.style.setProperty('--aba-dur', v);
        const sl = document.getElementById('tab-duracao-slider'), rot = document.getElementById('tab-duracao-valor');
        if (sl && document.activeElement !== sl) sl.value = ms;
        if (rot) rot.textContent = ms + ' ms';
        const ef = efeitoAba();
        if (document.body.getAttribute('data-aba-efeito') !== ef) document.body.setAttribute('data-aba-efeito', ef);
        document.querySelectorAll('#aba-efeito-options .transition-option').forEach(b => b.classList.toggle('active', b.dataset.value === ef));
        const cs = document.getElementById('cascata-select'); if (cs) cs.value = pz.cascata === 'nao' ? 'nao' : 'sim';
        const modo = pz.carregamento === 'texto' ? 'texto' : 'blocos';
        document.querySelectorAll('#carregamento-options .transition-option').forEach(b => b.classList.toggle('active', b.dataset.value === modo));
    };
    // efeito da troca de aba: escolha nova (abaEfeito) ou, para quem tinha marcado "Instantâneo" antes, instantâneo
    function efeitoAba() {
        const pz = (typeof appConfig !== 'undefined' && appConfig.personalizacao) || {};
        if (['padrao', 'empurrar', 'esmaecer', 'deslizar', 'subir', 'zoom', 'nenhum'].includes(pz.abaEfeito)) return pz.abaEfeito;
        return (pz.transicaoVersao === 2 && pz.transicaoTela === 'none') ? 'nenhum' : 'padrao';
    }
    window.escolherEfeitoAba = function (v) {
        appConfig.personalizacao.abaEfeito = v;
        aplicarTransicoesExtras();
        salvarPersonalizacao();
    };
    window.escolherCascata = function (v) {
        appConfig.personalizacao.cascata = v === 'nao' ? 'nao' : 'sim';
        salvarPersonalizacao();
    };
    window.escolherCarregamento = function (modo) {
        appConfig.personalizacao.carregamento = modo === 'texto' ? 'texto' : 'blocos';
        aplicarTransicoesExtras();
        salvarPersonalizacao();
    };
    document.addEventListener('DOMContentLoaded', () => {
        const sl = document.getElementById('tab-duracao-slider');
        if (!sl) return;
        sl.addEventListener('input', () => {
            const ms = parseInt(sl.value, 10) || 360;
            document.getElementById('tab-duracao-valor').textContent = ms + ' ms';
            document.documentElement.style.setProperty('--aba-dur', ms + 'ms');
        });
        sl.addEventListener('change', () => { appConfig.personalizacao.tabDuracao = parseInt(sl.value, 10) || 360; salvarPersonalizacao(); });
        aplicarTransicoesExtras();
    });

    // ---------- cascata sutil: os primeiros itens da tela entram um após o outro ----------
    function cascata(screenId, direcao) {
        if (RM.matches || sempre() || document.body.getAttribute('data-plataforma') === 'web' || (appConfig.personalizacao && appConfig.personalizacao.cascata === 'nao')) return;
        requestAnimationFrame(() => { // depois de a tela desenhar a própria lista (renderTelaMais etc.)
            const tela = document.getElementById(screenId);
            if (!tela || !tela.classList.contains('active')) return;
            const sel = '.card, .settings-list-group > li, .campo, .actions-row, .nota-item, .mais-item, .xml-filtro-toggle, .reorder-list-item, .anotacao-card, .divergencia-item';
            const alto = window.innerHeight || 800;
            let els = [...tela.querySelectorAll(sel)].filter(e => e.offsetHeight > 0 && !e.closest('.ld') && !e.closest('.transition-demo-stage') && e.getBoundingClientRect().top < alto);
            els = els.filter(e => !els.some(o => o !== e && o.contains(e))).slice(0, 9); // só o nível de cima, sem animar pai e filho juntos
            const d0 = direcao === 'troca' ? 60 : 150;
            els.forEach((el, i) => el.animate(
                [{ opacity: 0, transform: 'translateY(7px)' }, { opacity: 1, transform: 'none' }],
                { duration: 460, delay: d0 + i * 24, easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'backwards' }));
        });
    }

    // ---------- carregamento: sabe quando a primeira resposta de cada coleção chegou ----------
    const primeiroSnap = {};
    let hookOk = false;
    try {
        const Q = firebase.firestore.Query;
        if (Q && Q.prototype && !Q.prototype.__hookSnap) {
            const orig = Q.prototype.onSnapshot;
            Q.prototype.onSnapshot = function () {
                const a = Array.prototype.slice.call(arguments), nome = window.__capturandoDados;
                if (nome && typeof a[0] === 'function') {
                    const f = a[0]; let fez = false;
                    a[0] = function () { if (!fez) { fez = true; primeiroSnap[nome] = true; } return f.apply(this, arguments); };
                    const g = a[1];
                    if (typeof g === 'function') a[1] = function () { primeiroSnap[nome] = true; return g.apply(this, arguments); }; // erro também encerra a espera
                }
                return orig.apply(this, a);
            };
            Q.prototype.__hookSnap = true; hookOk = true;
        }
    } catch (e) { hookOk = false; }
    if (typeof assinarDados === 'function') {
        const original = assinarDados;
        assinarDados = function (nome) { window.__capturandoDados = nome; try { return original(nome); } finally { window.__capturandoDados = null; } };
    }

    const B = (w, h, r) => `<div class="ld-b" style="width:${w};height:${h};${r ? 'border-radius:' + r : ''}"></div>`;
    const linha = () => `<div class="ld-linha">${B('36px', '36px', '10px')}<div style="flex:1">${B('62%', '12px')}<div style="height:8px"></div>${B('38%', '10px')}</div>${B('44px', '18px', '99px')}</div>`;
    const MODELO = { 'screen-reports': 'cards', 'screen-import': 'cards' };
    function esqueleto(screenId) {
        if (MODELO[screenId] === 'cards') return `<div class="ld-sk">${B('55%', '30px', '10px')}${B('100%', '120px', '14px')}${B('100%', '120px', '14px')}${B('100%', '80px', '14px')}</div>`;
        return `<div class="ld-sk">${B('100%', '44px', '12px')}${B('100%', '34px', '10px')}<div class="ld-lista">${[1, 2, 3, 4, 5].map(linha).join('')}</div></div>`;
    }
    function mostrarCarregando(screenId, opts) {
        opts = opts || {};
        const tela = document.getElementById(screenId);
        if (!tela || tela.querySelector(':scope > .ld')) return;
        const nomes = (typeof DADOS_POR_TELA !== 'undefined' && DADOS_POR_TELA[screenId] || []).filter(n => typeof ASSINATURAS_DADOS !== 'undefined' && ASSINATURAS_DADOS[n]);
        const pendentes = () => nomes.filter(n => !primeiroSnap[n]);
        if (!opts.forcar && (!hookOk || !pendentes().length)) return;
        const modo = (appConfig.personalizacao && appConfig.personalizacao.carregamento) === 'texto' ? 'texto' : 'blocos';
        const ld = document.createElement('div');
        ld.className = 'ld';
        ld.setAttribute('aria-hidden', 'true');
        ld.innerHTML = modo === 'texto' ? '<div class="ld-texto">Carregando…</div>' : esqueleto(screenId);
        tela.appendChild(ld);
        const t0 = Date.now();
        const sair = () => {
            clearInterval(iv);
            if (RM.matches) { ld.remove(); return; }
            ld.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out', fill: 'forwards' }).finished.then(() => ld.remove(), () => ld.remove());
        };
        const iv = setInterval(() => {
            const dt = Date.now() - t0;
            if (!ld.isConnected) return clearInterval(iv);
            if (opts.forcar ? dt >= (opts.ms || 1800) : (dt >= 6000 || (dt >= 350 && !pendentes().length))) sair();
        }, 120);
    }
    window.mostrarCarregandoTela = mostrarCarregando;
    window.testarCarregamento = function () {
        const at = document.querySelector('.app-screen.active');
        if (at) mostrarCarregando(at.id, { forcar: true, ms: 1800 });
    };

    // ---------- voltar arrastando da borda esquerda ----------
    let edge = null, sw = null;
    const SEM_GESTO = ['screen-anotacoes-editor', 'screen-cotacao-editor'];
    function alvoVoltar() {
        const at = document.querySelector('.app-screen.active');
        if (!at || SEM_GESTO.includes(at.id)) return null;
        if (typeof voltarInternoDisponivel === 'function' && voltarInternoDisponivel()) return null; // artigo da Ajuda aberto: o Voltar sobe um nível, sem gesto de tela
        let id = null;
        const topoRet = typeof topoDaPilhaPara === 'function' ? topoDaPilhaPara(at.id) : null;
        if (topoRet) id = topoRet.telaId;
        else if (typeof destinoViaMais !== 'undefined' && at.id === destinoViaMais) id = destinoRetorno && destinoRetorno.para;
        else if (typeof closeBtnBackScreen !== 'undefined') id = closeBtnBackScreen[at.id];
        const prev = id && document.getElementById(id);
        return prev && prev !== at ? { at, prev } : null;
    }
    function limpaSwipe(s) {
        [s.at, s.prev].forEach(el => { el.getAnimations().forEach(a => a.cancel()); el.style.transform = ''; el.style.filter = ''; el.style.boxShadow = ''; el.style.willChange = ''; });
        s.prev.classList.remove('swipe-pre');
    }
    function criarBorda() {
        const w = document.querySelector('.screen-wrapper');
        if (!w || edge) return;
        edge = document.createElement('div'); edge.id = 'edge-voltar'; edge.hidden = true; w.appendChild(edge);
        edge.addEventListener('pointerdown', e => {
            if (sw || document.querySelector('.app-screen.saindo')) return;
            const alvo = alvoVoltar(); if (!alvo) return;
            sw = { x: e.clientX, t: performance.now(), dx: 0, W: w.offsetWidth || 1, at: alvo.at, prev: alvo.prev };
            edge.setPointerCapture(e.pointerId);
            sw.prev.classList.add('swipe-pre');
            sw.prev.style.transform = 'translate3d(-28%,0,0)'; sw.prev.style.filter = 'brightness(.7)';
            sw.at.style.willChange = 'transform'; sw.at.style.boxShadow = '-10px 0 30px rgba(0,0,0,.14)';
        });
        edge.addEventListener('pointermove', e => {
            if (!sw) return;
            sw.dx = Math.max(0, e.clientX - sw.x); const r = Math.min(1, sw.dx / sw.W);
            sw.at.style.transform = `translate3d(${sw.dx}px,0,0)`;
            sw.prev.style.transform = `translate3d(${-28 * (1 - r)}%,0,0)`;
            sw.prev.style.filter = `brightness(${.7 + .3 * r})`;
        });
        const fim = () => {
            if (!sw) return;
            const s = sw; sw = null;
            const r = Math.min(1, s.dx / s.W), ok = r > .35 || s.dx / Math.max(1, performance.now() - s.t) > .6;
            const du = RM.matches ? 1 : Math.max(180, PUSH_MS * (ok ? 1 - r : r));
            const opt = { duration: du, easing: CURVA, fill: 'forwards' };
            const pos = el => el.style.transform;
            const a = s.at.animate([{ transform: pos(s.at) || 'none' }, { transform: ok ? 'translate3d(100%,0,0)' : 'none' }], opt);
            s.prev.animate([{ transform: pos(s.prev), filter: s.prev.style.filter }, { transform: ok ? 'none' : 'translate3d(-28%,0,0)', filter: ok ? 'brightness(1)' : 'brightness(.7)' }], opt);
            a.finished.catch(() => { }).then(() => {
                if (ok) { window.__semAnimacaoTela = true; const b = document.getElementById('close-btn'); if (b) b.click(); setTimeout(() => { window.__semAnimacaoTela = false; }, 0); }
                limpaSwipe(s);
            });
        };
        edge.addEventListener('pointerup', fim); edge.addEventListener('pointercancel', fim);
    }
    function atualizarBorda(screenId) {
        if (!edge) criarBorda();
        if (!edge) return;
        const sub = (typeof closeBtnBackScreen !== 'undefined' && screenId in closeBtnBackScreen) || (typeof destinoViaMais !== 'undefined' && screenId === destinoViaMais);
        edge.hidden = !sub || SEM_GESTO.includes(screenId);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', criarBorda); else criarBorda();

    // chamado por switchToScreen (js/08) a cada troca de tela
    window.aoTrocarTelaIOS = function (screenId, direcao) {
        atualizarBorda(screenId);
        cascata(screenId, direcao);
        mostrarCarregando(screenId);
    };
})();

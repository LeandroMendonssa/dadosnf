// 00-uso-firebase.js — Contador de leituras do Firebase (2.20.5). Carrega ANTES de tudo para enxergar todos os listeners.
// Conta quantos documentos o Firestore entregou a ESTE aparelho (cada documento vindo do servidor = 1 leitura na cota; o que vem do cache local é grátis).
// Mostra por coleção, por tela e por abertura do app em Mais → Uso do Firebase. A cota de 50 mil/dia é do projeto inteiro: some os aparelhos.
// Guardado só no aparelho (localStorage 'usoFbV1'); não grava nada no Firebase.
const USO_FB_CHAVE = 'usoFbV1', USO_FB_LIMITE = 50000;
const usoFbDia = () => { try { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); } catch (e) { return new Date().toISOString().slice(0, 10); } };   // a cota zera à meia-noite do Pacífico (≈ 05:00 em Brasília)
const usoFbAparelho = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'iPhone/iPad' : /android/i.test(navigator.userAgent) ? 'Android' : 'Computador';
let usoFb = { dia: usoFbDia(), total: 0, cache: 0, get: 0, col: {}, tela: {}, sessoes: [] }, usoFbSessao = null, usoFbTimer = null;
function usoFbSalvar() { try { localStorage.setItem(USO_FB_CHAVE, JSON.stringify(usoFb)); } catch (e) { } }
(function usoFbIniciar() {
    try { const g = JSON.parse(localStorage.getItem(USO_FB_CHAVE) || 'null'); if (g && g.col) usoFb = { ...usoFb, ...g }; } catch (e) { }
    if (usoFb.dia !== usoFbDia()) usoFb = { dia: usoFbDia(), total: 0, cache: 0, get: 0, col: {}, tela: {}, sessoes: (usoFb.sessoes || []).slice(-30) };
    usoFbSessao = { t: Date.now(), ap: usoFbAparelho(), n: 0, k: 0, c: {}, dia: usoFb.dia };
    usoFb.sessoes = (usoFb.sessoes || []).concat(usoFbSessao).slice(-60);
    usoFbSalvar();
    window.addEventListener('pagehide', usoFbSalvar); document.addEventListener('visibilitychange', () => { if (document.hidden) usoFbSalvar(); });
})();
function usoFbSomar(colecao, n) {
    if (!n) return;
    if (usoFb.dia !== usoFbDia()) { usoFb = { dia: usoFbDia(), total: 0, cache: 0, get: 0, col: {}, tela: {}, sessoes: [usoFbSessao] }; usoFbSessao.dia = usoFb.dia; usoFbSessao.n = 0; usoFbSessao.k = 0; usoFbSessao.c = {}; }
    let tela = ''; try { const a = document.querySelector('.app-screen.active'); tela = a ? a.id.replace(/^screen-/, '') : 'abrindo'; } catch (e) { tela = '?'; }
    usoFb.total += n; usoFb.col[colecao] = (usoFb.col[colecao] || 0) + n; usoFb.tela[tela || 'abrindo'] = (usoFb.tela[tela || 'abrindo'] || 0) + n;
    usoFbSessao.n += n; usoFbSessao.c[colecao] = (usoFbSessao.c[colecao] || 0) + n;
    clearTimeout(usoFbTimer); usoFbTimer = setTimeout(usoFbSalvar, 1500);
}
function usoFbCopia(n) { if (!n) return; usoFb.cache = (usoFb.cache || 0) + n; usoFbSessao.k = (usoFbSessao.k || 0) + n; clearTimeout(usoFbTimer); usoFbTimer = setTimeout(usoFbSalvar, 1500); }
function usoFbContar(snap, ehGet) {   // do servidor = leitura cobrada; da cópia local = grátis (anotado à parte)
    try {
        if (!snap || !snap.metadata) return;
        const doCache = !!snap.metadata.fromCache;
        if (snap.docs && typeof snap.docChanges === 'function') {
            const ch = snap.docChanges();
            if (doCache) usoFbCopia(ch.length);
            else { ch.forEach(c => usoFbSomar(c.doc.ref.parent.id, 1)); if (ehGet) usoFb.get = (usoFb.get || 0) + ch.length; }
        } else if (snap.ref && snap.ref.parent) { if (doCache) usoFbCopia(1); else usoFbSomar(snap.ref.parent.id, 1); }
    } catch (e) { }
}
function usoFbInstalar(F) {
    const embrulhar = (P, nome, fn) => { const o = P && P[nome]; if (typeof o === 'function') P[nome] = fn(o); };
    const obs = o => function (...a) {
        const i = a.findIndex(x => typeof x === 'function' || (x && typeof x.next === 'function'));
        if (i >= 0) { const x = a[i]; a[i] = typeof x === 'function' ? function (s) { usoFbContar(s); return x.apply(this, arguments); } : { ...x, next: s => { usoFbContar(s); return x.next(s); } }; }
        return o.apply(this, a);
    };
    const get = o => function (...a) { return o.apply(this, a).then(s => { usoFbContar(s, true); return s; }); };
    [F.Query, F.DocumentReference].forEach(C => { if (C && C.prototype) { embrulhar(C.prototype, 'onSnapshot', obs); embrulhar(C.prototype, 'get', get); } });
}
try { if (window.firebase && firebase.firestore) usoFbInstalar(firebase.firestore); } catch (e) { console.warn('Contador de leituras indisponível:', e); }

// ---------------- tela Mais → Uso do Firebase ----------------
const usoFbN = n => Number(n || 0).toLocaleString('pt-BR');
const usoFbHora = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
function prepararUsoFirebase() { renderUsoFirebase(); clearInterval(window._usoFbRender); window._usoFbRender = setInterval(() => { const t = document.getElementById('screen-uso-firebase'); if (t && t.classList.contains('active')) renderUsoFirebase(); else clearInterval(window._usoFbRender); }, 2500); }
function usoFbLinhas(obj, total) {
    const l = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
    return l.length ? l.map(([k, v]) => `<div class="uso-lin"><span>${escRel(k)}</span><b>${usoFbN(v)}</b><i style="width:${Math.max(2, Math.round(v / (total || 1) * 100))}%"></i></div>`).join('') : '<div class="xml-item-meta">Nada ainda.</div>';
}
function renderUsoFirebase() {
    const el = document.getElementById('uso-firebase-conteudo'); if (!el) return;
    const pct = Math.min(100, Math.round(usoFb.total / USO_FB_LIMITE * 100)), sess = (usoFb.sessoes || []).filter(s => s.dia === usoFb.dia).slice().reverse();
    el.innerHTML = `<div class="ctl-card"><div class="xml-item-meta"><b>Hoje, neste aparelho</b>(${escRel(usoFbAparelho())})</div>
        <div class="xml-item-meta">Cópia dos dados neste aparelho: <b style="display:inline">${escRel(window.cacheLocalFirestore || 'desconhecido')}</b>. ${/ativo/.test(window.cacheLocalFirestore || '') ? 'Reabrir o app em seguida custa pouco.' : 'Sem ela, cada vez que o app abre ele lê tudo de novo.'}</div>
        <div class="uso-grande">${usoFbN(usoFb.total)}<small> leituras</small></div>
        <div class="uso-barra"><i style="width:${pct}%"></i></div>
        <div class="xml-item-meta">Vieram do servidor (cobradas): <b style="display:inline">${usoFbN(usoFb.total)}</b> · Da cópia no aparelho (grátis): <b style="display:inline">${usoFbN(usoFb.cache)}</b> · Consultas únicas (get): <b style="display:inline">${usoFbN(usoFb.get)}</b></div>
        <div class="xml-item-meta">O limite grátis é de ${usoFbN(USO_FB_LIMITE)} leituras por dia para o projeto inteiro, somando todos os aparelhos. A conta zera à meia-noite do Pacífico (por volta das 05:00 em Brasília). Cada aparelho mostra só o que gastou.</div></div>
        <div class="ctl-card"><div class="xml-item-meta"><b>Por coleção</b>Qual cadastro mais gastou</div>${usoFbLinhas(usoFb.col, usoFb.total)}</div>
        <div class="ctl-card"><div class="xml-item-meta"><b>Por tela</b>Em que tela você estava quando os dados chegaram</div>${usoFbLinhas(usoFb.tela, usoFb.total)}</div>
        <div class="ctl-card"><div class="xml-item-meta"><b>Aberturas do app hoje</b>Cada vez que o app foi aberto ou recarregado</div>
        ${sess.length ? sess.map(s => { const top = Object.entries(s.c || {}).sort((a, b) => b[1] - a[1])[0]; return `<div class="uso-lin"><span>${usoFbHora(s.t)} · ${escRel(s.ap)}${top ? ' · mais: ' + escRel(top[0]) : ''}</span><b>${usoFbN(s.n)}<small style="font-weight:400"> / ${usoFbN(s.k)} cópia</small></b></div>`; }).join('') : '<div class="xml-item-meta">Nenhuma ainda.</div>'}</div>
        <div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="usoFbZerar()">Zerar contagem deste aparelho</button></div>`;
}
function usoFbZerar() { showConfirmModal({ title: 'Zerar a contagem?', message: 'Só apaga o que este aparelho anotou. Não mexe no Firebase.', confirmText: 'Zerar', confirmClass: 'danger', onConfirm: () => { usoFb = { dia: usoFbDia(), total: 0, cache: 0, get: 0, col: {}, tela: {}, sessoes: [] }; usoFbSessao = { t: Date.now(), ap: usoFbAparelho(), n: 0, k: 0, c: {}, dia: usoFb.dia }; usoFb.sessoes.push(usoFbSessao); usoFbSalvar(); renderUsoFirebase(); } }); }

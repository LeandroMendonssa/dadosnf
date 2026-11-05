// 46-uso-aparelhos.js — Uso do Firebase de TODOS os aparelhos (2.23.3)
// Cada aparelho publica um resumo do próprio dia (leituras por coleção/tela, aberturas, cache dos catálogos, travadas) em UM documento
// compartilhado: config/usoAparelhos, campo aparelhos.<id>. A tela Mais → Uso do Firebase lê esse documento (1 leitura) e mostra
// o total geral do projeto e cada aparelho separado, mais um relatório para copiar. Nada de coleção nova (as regras do Firebase não mudam).
// Escrever custa 1 gravação (limite de 20 mil/dia); o aparelho publica no máximo a cada 4 minutos e só se algo mudou.
const USO_AP_ID_CHAVE = 'usoAparelhoId', USO_AP_NOME_CHAVE = 'usoAparelhoNome', USO_AP_INTERVALO = 4 * 60 * 1000;
let usoApCache = { carregado: false, carregando: false, erro: '', aparelhos: {}, em: 0 }, usoApUltimaAss = '', usoApUltimoPublicar = 0, usoApStatus = '';

function usoApId() {
    let id = ''; try { id = localStorage.getItem(USO_AP_ID_CHAVE) || ''; } catch (e) { }
    if (!id) { id = 'ap' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); try { localStorage.setItem(USO_AP_ID_CHAVE, id); } catch (e) { } }
    return id;
}
function usoApNavegador() {
    const u = navigator.userAgent;
    return /CriOS|Chrome\//.test(u) && !/Edg/.test(u) ? 'Chrome' : /Edg/.test(u) ? 'Edge' : /Firefox|FxiOS/.test(u) ? 'Firefox' : /Safari/.test(u) ? 'Safari' : 'Navegador';
}
function usoApNomePadrao() {
    const instalado = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    return usoFbAparelho() + ' · ' + (instalado ? 'atalho na tela' : usoApNavegador());
}
function usoApNome() { let n = ''; try { n = localStorage.getItem(USO_AP_NOME_CHAVE) || ''; } catch (e) { } return n || usoApNomePadrao(); }
function usoApRenomear() {
    const novo = prompt('Nome deste aparelho (aparece no relatório de uso):', usoApNome());
    if (novo === null) return;
    try { localStorage.setItem(USO_AP_NOME_CHAVE, novo.trim().slice(0, 40)); } catch (e) { }
    usoApPublicar(true);
    if (typeof renderUsoFirebase === 'function') renderUsoFirebase();
}
function usoApVersao() { try { return document.querySelector('meta[name="app-versao"]').content; } catch (e) { return ''; } }

// resumo compacto deste aparelho (o que vai para o documento compartilhado)
function usoApResumo() {
    const hoje = usoFb.dia, topo = c => Object.fromEntries(Object.entries(c || {}).sort((a, b) => b[1] - a[1]).slice(0, 6));
    let cat = {}; try { Object.keys(catalogoDiag).forEach(n => { const d = catalogoDiag[n]; cat[n] = { como: d.como || '', docs: d.docs || 0, ms: d.ms || 0 }; }); } catch (e) { }
    let trav = []; try { trav = travadas.slice(-8).map(x => ({ t: x.t, ms: x.ms, tela: x.tela || '' })); } catch (e) { }
    let nota = null; try { nota = JSON.parse(localStorage.getItem('notaDiag') || 'null'); } catch (e) { }
    return {
        id: usoApId(), nome: usoApNome(), ap: usoFbAparelho(), nav: usoApNavegador(), versao: usoApVersao(), em: new Date().toISOString(), dia: hoje,
        total: usoFb.total || 0, cache: usoFb.cache || 0, get: usoFb.get || 0, col: usoFb.col || {}, tela: usoFb.tela || {},
        sessoes: (usoFb.sessoes || []).filter(s => s.dia === hoje).slice(-15).map(s => ({ t: s.t, ap: s.ap, n: s.n || 0, k: s.k || 0, c: topo(s.c) })),
        cat, trav, nota, cacheCatalogos: (typeof catalogoCacheDesligado === 'function' && catalogoCacheDesligado()) ? 'desligado' : 'ligado', cacheFirestore: window.cacheLocalFirestore || ''
    };
}
async function usoApPublicar(forcar) {
    try {
        if (typeof firestore === 'undefined' || !firebase.auth().currentUser) return;
        if (document.hidden && !forcar) return;
        const r = usoApResumo(), ass = r.total + '|' + r.cache + '|' + r.get + '|' + r.sessoes.length + '|' + r.nome + '|' + r.versao + '|' + r.dia;
        if (!forcar && ass === usoApUltimaAss) return;
        if (!forcar && Date.now() - usoApUltimoPublicar < USO_AP_INTERVALO) return;
        usoApUltimaAss = ass; usoApUltimoPublicar = Date.now();
        const limpo = JSON.parse(JSON.stringify(r));   // o Firestore recusa campos undefined
        await firestore.collection('config').doc('usoAparelhos').set({ aparelhos: { [r.id]: limpo } }, { merge: true });
        usoApStatus = 'ok';
        if (usoApCache.carregado) usoApCache.aparelhos[r.id] = limpo;
    } catch (e) { usoApStatus = 'erro: ' + ((e && e.code) || (e && e.message) || e); }
}
async function usoApCarregar() {
    if (usoApCache.carregando) return; usoApCache.carregando = true; usoApCache.erro = '';
    try {
        await usoApPublicar(true);
        const d = await firestore.collection('config').doc('usoAparelhos').get();
        usoApCache.aparelhos = (d.exists && d.data().aparelhos) || {}; usoApCache.carregado = true; usoApCache.em = Date.now();
    } catch (e) { usoApCache.erro = (e && e.code) || (e && e.message) || String(e); }
    usoApCache.carregando = false;
    if (typeof renderUsoFirebase === 'function') renderUsoFirebase();
}
function usoApRemover(id) {
    showConfirmModal({
        title: 'Remover aparelho da lista?', message: 'Só tira este aparelho do relatório geral. Se ele ainda estiver em uso, volta a aparecer sozinho na próxima publicação.', confirmText: 'Remover', confirmClass: 'danger',
        onConfirm: async () => {
            try { await firestore.collection('config').doc('usoAparelhos').update({ ['aparelhos.' + id]: firebase.firestore.FieldValue.delete() }); delete usoApCache.aparelhos[id]; renderUsoFirebase(); toast('✓ Aparelho removido da lista.'); }
            catch (e) { toast('✕ Não foi possível remover.'); }
        }
    });
}
// lista de aparelhos para exibir: usa o dado ao vivo deste aparelho no lugar do publicado
function usoApLista() {
    const mapa = { ...usoApCache.aparelhos }, eu = usoApResumo(); mapa[eu.id] = eu;
    return Object.values(mapa).sort((a, b) => (b.id === eu.id) - (a.id === eu.id) || String(b.em).localeCompare(String(a.em)));
}
function usoApSomaDia(lista) {
    const hoje = usoFb.dia, s = { total: 0, cache: 0, get: 0, col: {}, tela: {}, aparelhos: 0 };
    lista.filter(a => a.dia === hoje).forEach(a => { s.aparelhos++; s.total += a.total || 0; s.cache += a.cache || 0; s.get += a.get || 0; Object.entries(a.col || {}).forEach(([k, v]) => { s.col[k] = (s.col[k] || 0) + v; }); Object.entries(a.tela || {}).forEach(([k, v]) => { s.tela[k] = (s.tela[k] || 0) + v; }); });
    return s;
}
const usoApQuando = iso => { try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return '-'; } };

// cartão da tela de uso
function usoAparelhosHTML() {
    const e = escRel, N = usoFbN, hoje = usoFb.dia;
    if (!usoApCache.carregado && !usoApCache.carregando && !usoApCache.erro) setTimeout(usoApCarregar, 0);
    const lista = usoApLista(), soma = usoApSomaDia(lista), pct = Math.min(100, Math.round(soma.total / USO_FB_LIMITE * 100)), eu = usoApId();
    let h = `<div class="ctl-card"><div class="xml-item-meta"><b>Todos os aparelhos · hoje</b>Soma do que cada aparelho publicou (dia da cota: ${e(hoje)})</div>
        <div class="uso-grande">${N(soma.total)}<small> de ${N(USO_FB_LIMITE)} leituras</small></div><div class="uso-barra"><i style="width:${pct}%"></i></div>
        <div class="xml-item-meta">${soma.aparelhos} aparelho(s) com uso hoje · da cópia local (grátis): <b style="display:inline">${N(soma.cache)}</b> · Pode faltar o que um aparelho ainda não publicou (publicam a cada ~4 min, ou ao tocar em Atualizar nele).</div>`;
    if (usoApCache.erro) h += `<div class="xml-item-meta" style="color:var(--danger)">Não foi possível ler o documento compartilhado (${e(String(usoApCache.erro))}). As regras do Firebase precisam liberar a leitura de config/usoAparelhos.</div>`;
    if (/^erro/.test(usoApStatus)) h += `<div class="xml-item-meta" style="color:var(--danger)">Este aparelho não conseguiu publicar o resumo (${e(usoApStatus)}).</div>`;
    h += `<div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="usoApCache.carregado=false;usoApCache.erro='';usoApCarregar()">${usoApCache.carregando ? 'Atualizando…' : 'Atualizar aparelhos'}</button></div></div>`;
    lista.forEach(a => {
        const ehEu = a.id === eu, hojeAp = a.dia === hoje, top = Object.entries(a.col || {}).sort((x, y) => y[1] - x[1]).slice(0, 4);
        h += `<div class="ctl-card"><div class="xml-item-meta"><b>${e(a.nome || a.ap)}${ehEu ? ' (este aparelho)' : ''}</b>${e(a.ap || '')} · app ${e(a.versao || '?')} · publicado ${e(usoApQuando(a.em))}</div>
        ${hojeAp ? `<div class="uso-grande" style="font-size:22px">${N(a.total)}<small> leituras hoje</small></div>
        <div class="xml-item-meta">Cópia local (grátis): <b style="display:inline">${N(a.cache)}</b> · get: <b style="display:inline">${N(a.get)}</b> · Aberturas hoje: <b style="display:inline">${(a.sessoes || []).length}</b></div>
        ${top.length ? usoFbLinhas(Object.fromEntries(top), a.total) : ''}` : `<div class="xml-item-meta">Sem uso no dia de hoje (último dia registrado: ${e(a.dia || '?')}).</div>`}
        ${ehEu ? `<div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="usoApRenomear()">Renomear este aparelho</button></div>` : `<div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="usoApRemover('${e(a.id)}')">Remover da lista</button></div>`}</div>`;
    });
    return h + `<div class="ctl-card"><div class="xml-item-meta"><b>Relatório de todos os aparelhos</b>Geral + cada aparelho, em texto para copiar</div>
        <div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="usoRelatorioGeralGerar()">Gerar relatório geral</button></div></div>`;
}

function usoRelatorioGeralTexto() {
    const L = [], N = x => (x == null ? '-' : Number(x).toLocaleString('pt-BR')), hh = t => new Date(t).toLocaleTimeString('pt-BR'), lista = usoApLista(), soma = usoApSomaDia(lista);
    L.push('RELATÓRIO GERAL — todos os aparelhos — ' + new Date().toLocaleString('pt-BR') + ' — dia da cota ' + usoFb.dia);
    L.push('Leituras hoje (soma): ' + N(soma.total) + ' de ' + N(USO_FB_LIMITE) + ' (' + Math.round(soma.total / USO_FB_LIMITE * 100) + '%) | da cópia local: ' + N(soma.cache) + ' | aparelhos com uso hoje: ' + soma.aparelhos + ' de ' + lista.length);
    L.push(''); L.push('POR APARELHO (leituras hoje)');
    lista.forEach(a => L.push('  ' + (a.id === usoApId() ? '* ' : '  ') + (a.nome || a.ap) + ' | app ' + (a.versao || '?') + ' | ' + (a.dia === usoFb.dia ? N(a.total) + ' leituras, ' + N(a.cache) + ' da cópia, ' + (a.sessoes || []).length + ' aberturas' : 'sem uso hoje (último dia ' + a.dia + ')') + ' | publicado ' + usoApQuando(a.em)));
    const lin = (t, o) => { L.push(''); L.push(t); const e = Object.entries(o || {}).sort((a, b) => b[1] - a[1]); if (!e.length) L.push('  nada'); e.forEach(([k, v]) => L.push('  ' + k + ': ' + N(v))); };
    lin('POR COLEÇÃO (soma de todos)', soma.col); lin('POR TELA (soma de todos)', soma.tela);
    lista.forEach(a => {
        L.push(''); L.push('================ ' + (a.nome || a.ap) + (a.id === usoApId() ? ' (este aparelho)' : '') + ' ================');
        L.push('App ' + (a.versao || '?') + ' | ' + (a.ap || '') + ' ' + (a.nav || '') + ' | cache dos catálogos: ' + (a.cacheCatalogos || '?') + ' | cópia do Firestore: ' + (a.cacheFirestore || '?') + ' | publicado ' + usoApQuando(a.em));
        if (a.dia !== usoFb.dia) { L.push('Sem uso hoje (último dia registrado: ' + a.dia + ').'); return; }
        L.push('Leituras: ' + N(a.total) + ' | da cópia: ' + N(a.cache) + ' | get: ' + N(a.get));
        lin('Por coleção', a.col); lin('Por tela', a.tela);
        L.push(''); L.push('Aberturas hoje');
        (a.sessoes || []).slice().reverse().forEach(s => { const t = Object.entries(s.c || {}).sort((x, y) => y[1] - x[1])[0]; L.push('  ' + hh(s.t) + ' | servidor ' + N(s.n) + ' | cópia ' + N(s.k) + (t ? ' | mais: ' + t[0] : '')); });
        L.push(''); L.push('Catálogos (última abertura)');
        const ks = Object.keys(a.cat || {}); if (!ks.length) L.push('  sem dado'); ks.forEach(n => L.push('  ' + n + ': ' + a.cat[n].como + ' | docs ' + N(a.cat[n].docs) + ' | ' + N(a.cat[n].ms) + ' ms'));
        L.push(''); L.push('Travadas recentes'); if (!(a.trav || []).length) L.push('  nenhuma'); (a.trav || []).forEach(x => L.push('  ' + hh(x.t) + ' | ' + (x.ms / 1000).toFixed(1) + ' s | tela ' + (x.tela || '?')));
        if (a.nota) L.push('Última anotação aberta: ' + N(a.nota.chars) + ' caracteres, ' + a.nota.imgs + ' imagem(ns), abriu em ' + a.nota.ms + ' ms');
    });
    return L.join('\n') + '\n';
}
function usoRelatorioGeralGerar() {
    const t = document.getElementById('uso-relatorio'); if (!t) return;
    const pronto = () => { t.value = usoRelatorioGeralTexto(); t.style.display = 'block'; t.focus(); t.select(); try { t.setSelectionRange(0, t.value.length); } catch (e) { } };
    if (usoApCache.carregado) return pronto();
    usoApCarregar().then(pronto);
}

// publica sozinho: logo depois de abrir (para pegar as primeiras leituras), a cada 4 min e ao sair do app
(function usoApIniciar() {
    setTimeout(() => usoApPublicar(false), 25000);
    setInterval(() => usoApPublicar(false), USO_AP_INTERVALO);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { usoApUltimoPublicar = 0; usoApPublicar(true); } });
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/46-uso-aparelhos.js'] = '2.23.3';

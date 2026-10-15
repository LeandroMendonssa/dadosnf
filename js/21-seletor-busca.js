// 21-seletor-busca.js — Seletor único com busca (2.1.2)
// Parte do script do app (v2.1.2). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// --- 2.1.2: UM SELETOR SÓ PARA TODO O APP ---
// ===================================================================
// Antes: um campo para digitar (que só filtrava depois do Enter) + uma lista nativa do sistema, em duas caixas. Agora é um
// campo só: ao tocar abre a lista completa logo abaixo, e a lista filtra a cada letra digitada. Serve para qualquer lista
// (itens da cotação, produtos SP Data, pedidos...), com a aparência do app.
const seletoresBusca = {};
const SB_LIMITE = 60;
function sbId(id) { return String(id).replace(/[^\w-]/g, '_'); }
function sbNorm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

// cfg: { placeholder, textoAtual, valorAtual, opcoes:[{valor,titulo,sub,especial}], fonte(texto)->opcoes (busca dinâmica),
//        minimo (letras para a fonte buscar), aoEscolher(valor, opcao), vazio }
function htmlSeletorBusca(idBruto, cfg) {
    const id = sbId(idBruto);
    seletoresBusca[id] = cfg;
    return `<div class="sb" id="sb-${id}" onclick="event.stopPropagation()">
        <div class="sb-campo">
            <input type="text" id="sb-in-${id}" class="sb-input" inputmode="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false"
                placeholder="${escRel(cfg.placeholder || 'Buscar…')}" value="${escRel(cfg.textoAtual || '')}"
                onfocus="sbAbrir('${id}')" oninput="sbFiltrar('${id}')" onkeydown="sbTecla(event, '${id}')">
            <button type="button" class="sb-seta" tabindex="-1" aria-label="Mostrar lista completa" onclick="sbAlternar('${id}')">▾</button>
        </div>
        <div class="sb-lista" id="sb-lista-${id}" hidden></div>
    </div>`;
}
function sbOpcoes(id, texto, tudo) {
    const cfg = seletoresBusca[id]; if (!cfg) return [];
    const t = sbNorm(texto).trim();
    const rotSug = cfg.grupoSugestoes || 'Sugestões pelo nome do item';
    if (cfg.fonte) {
        if (tudo || t.length < (cfg.minimo || 1)) return cfg.sugestoes ? (cfg.sugestoes() || []).map(o => ({ ...o, grupo: o.grupo || rotSug })) : [];
        return cfg.fonte(String(texto).trim());
    }
    const todas = cfg.opcoes || [];
    if (tudo || !t) {
        // sem texto: as sugestões (pelo nome do item do XML) vêm primeiro, depois o resto, e as opções especiais por último
        const sug = typeof cfg.sugestoes === 'function' ? (cfg.sugestoes() || []) : [];
        if (!sug.length) return todas;
        const jaSug = new Set(sug.map(o => String(o.valor)));
        const resto = todas.filter(o => !jaSug.has(String(o.valor)));
        return sug.map(o => ({ ...o, grupo: o.grupo || rotSug }))
            .concat(resto.filter(o => !o.especial).map(o => ({ ...o, grupo: cfg.grupoDemais || 'Todos os itens' })))
            .concat(resto.filter(o => o.especial).map(o => ({ ...o, grupo: 'Outras opções' })));
    }
    const tokens = t.split(/\s+/).filter(Boolean);
    const reais = todas.filter(o => !o.especial && tokens.every(tk => sbNorm((o.titulo || '') + ' ' + (o.sub || '') + ' ' + (o.busca || '')).includes(tk)));
    // opções especiais (ex.: "compra direta") vão para o FIM quando há texto digitado: nunca ficam na frente do melhor resultado
    return reais.concat(todas.filter(o => o.especial));
}
function sbRender(id, texto, tudo) {
    const cfg = seletoresBusca[id]; const lista = document.getElementById('sb-lista-' + id);
    if (!cfg || !lista) return;
    const todas = sbOpcoes(id, texto, tudo);
    cfg._atuais = todas.slice(0, SB_LIMITE);
    let grupoAnterior = null;
    const linhas = cfg._atuais.map((o, i) => (o.grupo && o.grupo !== grupoAnterior ? (grupoAnterior = o.grupo, `<div class="sb-grupo">${escRel(o.grupo)}</div>`) : '') + `<div class="sb-op ${o.especial ? 'sb-op-especial' : ''} ${cfg.valorAtual != null && String(o.valor) === String(cfg.valorAtual) ? 'sb-op-atual' : ''}" onclick="sbEscolher('${id}', ${i})">
        <div class="sb-op-titulo">${escRel(o.titulo)}</div>${o.sub ? `<div class="sb-op-sub">${escRel(o.sub)}</div>` : ''}</div>`).join('');
    const aviso = todas.length > SB_LIMITE ? `<div class="sb-aviso">${todas.length} resultados — mostrando ${SB_LIMITE}. Digite mais para refinar.</div>` : '';
    const semReais = !todas.some(o => !o.especial);
    const vazio = (!todas.length || (semReais && String(texto).trim() && !tudo)) ? `<div class="sb-vazio">${escRel(cfg.vazio || (String(texto).trim() ? 'Nada encontrado para “' + String(texto).trim() + '”.' : 'Digite para buscar.'))}</div>` : '';
    lista.innerHTML = linhas + aviso + vazio;
    lista.hidden = false;
}
function sbAbrir(id) {
    sbFecharTodos(id);
    const inp = document.getElementById('sb-in-' + id); if (!inp) return;
    sbRender(id, inp.value, true);        // ao tocar: lista completa
    try { inp.select(); } catch (e) { /* sem seleção de texto */ }
}
function sbAlternar(id) {
    const lista = document.getElementById('sb-lista-' + id); if (!lista) return;
    if (lista.hidden) sbAbrir(id); else lista.hidden = true;
}
function sbFiltrar(id) {
    const inp = document.getElementById('sb-in-' + id); if (!inp) return;
    sbRender(id, inp.value, false);       // ao digitar: filtra na hora, sem Enter
}
function sbTecla(ev, id) {
    if (ev.key === 'Escape') { const l = document.getElementById('sb-lista-' + id); if (l) l.hidden = true; return; }
    if (ev.key === 'Enter') {
        ev.preventDefault();
        // Enter escolhe o melhor resultado digitado — nunca uma opção especial, e nada se o campo está vazio
        const cfg = seletoresBusca[id]; const inp = document.getElementById('sb-in-' + id);
        if (!cfg || !cfg._atuais || !inp || !inp.value.trim()) return;
        const i = cfg._atuais.findIndex(o => !o.especial);
        if (i >= 0) sbEscolher(id, i);
    }
}
function sbEscolher(id, i) {
    const cfg = seletoresBusca[id]; const op = cfg && cfg._atuais ? cfg._atuais[i] : null; if (!op) return;
    const inp = document.getElementById('sb-in-' + id); if (inp) inp.value = op.titulo;
    const lista = document.getElementById('sb-lista-' + id); if (lista) lista.hidden = true;
    if (typeof cfg.aoEscolher === 'function') cfg.aoEscolher(op.valor, op);
}
function sbFecharTodos(exceto) {
    document.querySelectorAll('.sb-lista').forEach(l => { if (!exceto || l.id !== 'sb-lista-' + exceto) l.hidden = true; });
}
document.addEventListener('click', ev => { if (!(ev.target && ev.target.closest && ev.target.closest('.sb'))) sbFecharTodos(); });

// ---------- sugestão de item da cotação a partir do nome do item no XML (2.1.3) ----------
// 1º a regra estrita que o app já usa (todas as palavras / princípio ativo + dosagem). Se ela não achar nada — o que é comum
// quando o fornecedor abrevia ("ABS PGA 0 AG3/8 CIL3,0-70CM") — entra uma regra por parecença, só dentro dos itens JÁ filtrados
// (os do fornecedor), com os números pesando mais (3,0 não é 4,0) e aceitando prefixos (CIL = CILIND). Mostra no máximo 3 e a
// lista os identifica como "Parecidos pelo nome — confira": nunca vira escolha automática.
function tokensSugestaoNome(s) {
    const out = [];
    sbNorm(s).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean).forEach(w => (w.match(/[a-z]+|\d+/g) || []).forEach(p => out.push(p)));
    return out;
}
function pontuarParecidoNome(nomeXml, nomeCot) {
    const a = tokensSugestaoNome(nomeXml), b = tokensSugestaoNome(nomeCot);
    if (!a.length || !b.length) return 0;
    const usados = new Set(); let pontos = 0, total = 0;
    a.forEach(t => {
        const num = /^\d+$/.test(t); const peso = num ? 1.5 : (t.length >= 3 ? 1 : 0.3);
        total += peso;
        const j = b.findIndex((u, k) => !usados.has(k) && (u === t || (!num && t.length >= 3 && u.length >= 3 && (u.startsWith(t) || t.startsWith(u)))));
        if (j >= 0) { usados.add(j); pontos += peso; }
    });
    return total ? pontos / total : 0;
}
function sugestoesItemCotacao(nomeXml, itens) {
    const estritos = buscarSugestoesCotacao(nomeXml, itens);
    if (estritos.length) return { itens: estritos, aproximado: false };
    // Limiar medido com o histórico real de associações (398 itens): parecença >= 0,5, ou >= 0,3 quando o nome principal (palavra de
    // 4+ letras, ex.: NYLON, SEDA) também aparece no item da cotação. Nesse teste sugeriu em 120 itens e a associação correta estava
    // entre as 3 sugestões em 98% deles.
    const principais = tokensSugestaoNome(nomeXml).filter(t => /^[a-z]{4,}$/.test(t));
    const ranque = itens.map(it => {
        const nome = it.nomeOficial || it.descricao || '';
        const tk = tokensSugestaoNome(nome);
        return { it, p: pontuarParecidoNome(nomeXml, nome), principal: principais.some(t => tk.includes(t)) };
    }).filter(x => x.p >= 0.5 || (x.principal && x.p >= 0.3)).sort((x, y) => y.p - x.p).slice(0, 3);
    // se o 1º não se destaca do resto, ainda lista (até 3), mas sem quick-button; a pessoa confere
    return { itens: ranque.map(x => x.it), aproximado: true };
}

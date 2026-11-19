// 48-inicio-lote.js — Tela inicial (2.25.0) e busca de lote/validade.
// A tela inicial usa SÓ dados que o app já carrega na abertura (notas da relação): não gera leitura nova no Firebase.
// A busca de lote usa as NFs processadas (carregadas só quando você abre essa tela) e procura em itens[].lote / itens[].validade.
const escIni = s => (typeof escRel === 'function' ? escRel(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const MESES_INI = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'], DIAS_INI = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
function inicioSaudacao() { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
// 2.25.1: o nome e a contagem de fornecedores ficam guardados neste aparelho (por usuário) para a tela já abrir preenchida; depois se atualizam sozinhos.
const INI_CACHE_CHAVE = 'iniCacheV1';
function iniUid() { try { return (auth.currentUser && auth.currentUser.uid) || ''; } catch (e) { return ''; } }
function iniLerCache() { try { const c = JSON.parse(localStorage.getItem(INI_CACHE_CHAVE) || 'null'); return c && c.uid && c.uid === iniUid() ? c : {}; } catch (e) { return {}; } }
function iniGravarCache(parte) { try { const uid = iniUid(); if (!uid) return; localStorage.setItem(INI_CACHE_CHAVE, JSON.stringify(Object.assign({}, iniLerCache(), parte, { uid }))); } catch (e) { } }
function inicioPrimeiroNome() {
    let n = '';
    try { n = (typeof assinaturaRelatorio === 'function' && assinaturaRelatorio().nome) || (auth.currentUser && (auth.currentUser.displayName || '')) || ''; } catch (e) { }
    n = String(n).trim().split(/\s+/)[0] || '';
    if (n) { if (iniLerCache().nome !== n) iniGravarCache({ nome: n }); return n; }
    return iniLerCache().nome || '';
}
// Fornecedores que ainda não chegaram (nada entregue) + os que chegaram parcialmente com MAIS de 2 itens faltando (1 ou 2 itens faltando não conta).
// Só considera pedidos recentes (INI_JANELA_DIAS) para pedidos antigos esquecidos não inflarem o número. Usa só dados já carregados: nenhuma leitura nova.
const INI_JANELA_DIAS = 60, INI_MIN_ITENS_FALTANDO = 3;
let _iniSigForn = '', _iniCalculando = false;
function inicioContarFornecedores() {
    const lim = Date.now() - INI_JANELA_DIAS * 86400000, r = { nao: 0, achegar: 0, lista: [] };
    const nomeF = f => { let n = f.nome || f.fornecedor || f.razaoSocial || ''; try { n = nomeExibicaoFornecedor(n, f.cnpj || '') || n; } catch (e) { } return String(n); };
    comMemoComparacao(() => (listaCotacoes || []).forEach(cot => {
        const ref = Date.parse(cot.dataPedido || cot.atualizadoEm || '') || 0; if (ref && ref < lim) return;
        let comp; try { comp = compararFontesPedido(cot.pedido); } catch (e) { return; }
        const vistos = new Set();
        (cot.fornecedores || []).forEach(f => {
            const ch = normalizarCnpj(f.cnpj); if (!ch || vistos.has(ch)) return; vistos.add(ch);
            const itens = (cot.itens || []).filter(it => normalizarCnpj(it.cnpjFornecedor) === ch); if (!itens.length) return;
            let e; try { e = calcularEntregaFornecedorPedido(cot.pedido, f, comp.filter(x => normalizarCnpj(x.cnpjFornecedor) === ch)); } catch (er) { return; }
            const st = statusEntregaRelCot(e);
            if (st.chave === 'cancelada' || st.chave === 'concluida') return;
            const nomeItem = it => String(it.nomeOficial || it.descricao || it.codProduto || '');
            // 2.58.7: quantidade que ainda falta (total do pedido menos o que já entrou, quando dá para comparar) e unidade, se o item tiver
            const itemPend = it => {
                const q = numeroFlexivel(it.quantidade);
                const c = (comp || []).find(x => x.codProduto === it.codProduto && normalizarCnpj(x.cnpjFornecedor) === ch);
                const ent = c && c.quantidadeEntregue !== null && c.quantidadeEntregue !== undefined ? Number(c.quantidadeEntregue) || 0 : 0;
                const falta = (q === null || q === undefined) ? null : Math.max(0, Math.round((q - ent) * 100) / 100);
                return { n: nomeItem(it), q: falta, u: String(it.unidade || it.unidadeMedida || '').trim() };
            };
            const lim = String(cot.dataLimite || '');
            if (st.chave === 'pendente') { if (!/ERP/i.test(st.detalhe || '')) { r.nao++; r.lista.push({ p: String(cot.pedido), o: String(cot.origem || ''), f: nomeF(f), c: String(f.cnpj || ''), t: 'nao', n: itens.length, lim, prod: itens.map(itemPend) }); } return; }
            const faltam = itens.filter(it => situacaoItemRelCot(e, it.codProduto).falta).length;
            if (faltam >= INI_MIN_ITENS_FALTANDO) { r.achegar++; r.lista.push({ p: String(cot.pedido), o: String(cot.origem || ''), f: nomeF(f), c: String(f.cnpj || ''), t: 'achegar', n: faltam, lim, prod: itens.filter(it => situacaoItemRelCot(e, it.codProduto).falta).map(itemPend) }); }
        });
    }));
    return r;
}
// recalcula só quando os dados mudaram e fora do caminho de desenho da tela (não trava a abertura)
function inicioAtualizarFornecedores() {
    if (_iniCalculando || !listaCotacoes || !listaCotacoes.length) return;
    // 2.36.0: assinatura de TUDO que muda o resultado (datas de alteração, "chegou", decisões de duplicidade). Só CPU local, nenhuma leitura no Firebase.
    const mx = (l, ...ks) => (l || []).reduce((m, x) => { for (const k of ks) { const v = x && x[k]; if (v && String(v) > m) m = String(v); } return m; }, '');
    const nCheg = listaCotacoes.reduce((n, c) => n + Object.keys(c.chegadasPorFornecedor || {}).length, 0);
    const nDup = (listaNfsProcessadas || []).reduce((n, x) => n + (x.duplicidade && x.duplicidade.decisao ? 1 : 0), 0);
    const sig = [listaCotacoes.length, (listaNfsProcessadas || []).length, (listaEntradasErp || []).length, (listaAnotacoes || []).length, nCheg, nDup,
        mx(listaCotacoes, 'atualizadoEm'), mx(listaNfsProcessadas, 'processadoEm', 'atualizadoEm'), mx(listaEntradasErp, 'atualizadoEm', 'data')].join('|');
    if (sig === _iniSigForn) return;
    _iniCalculando = true;
    setTimeout(() => {
        try { const r = inicioContarFornecedores(); _iniSigForn = sig; iniGravarCache({ forn: r }); renderInicioSeAtivo(); } catch (e) { console.error('Início: fornecedores', e); }
        _iniCalculando = false;
    }, 50);
}
function inicioDados() {
    const abertas = (notasPendentes || []).filter(n => n && !n.enviada && n.vencimento);
    const dias = n => calcularDiasParaVencimento(n.vencimento);
    const venc = abertas.filter(n => dias(n) !== null && dias(n) < 0).length, hoje = abertas.filter(n => dias(n) === 0).length, aman = abertas.filter(n => dias(n) === 1).length;
    const proximas = abertas.filter(n => dias(n) !== null).sort((a, b) => dias(a) - dias(b)).slice(0, 4);
    return { venc, hoje, aman, naRelacao: abertas.length, proximas, dias };
}
// 2.51.0: os atalhos do Início são editáveis (quais aparecem e em que ordem). Qualquer tela do app pode virar atalho.
const INI_PADRAO = ['screen-xml-editor', 'add', 'screen-cotacoes', 'screen-controle-nfs', 'screen-manage', 'screen-anotacoes', 'lote', 'resumo', 'screen-agenda'];
const INI_ROTULO = { 'screen-agenda': 'Agenda' };
let iniEditando = false;
function iniCatalogo() {
    const cat = {
        add: { ic: 'fa-solid fa-plus-circle', t: 'Adicionar nota', a: "switchToScreen('screen-add','Adicionar')" },
        lote: { ic: 'fa-solid fa-barcode', t: 'Buscar lote', a: 'abrirBuscaLote()' },
        resumo: { ic: 'fa-solid fa-file-lines', t: 'Resumo de pendências', a: 'abrirResumoPendencias()' }
    };
    Object.keys(menuDetails).forEach(id => { if (id === 'screen-inicio') return; const d = menuDetails[id]; const t = INI_ROTULO[id] || d.title; cat[id] = { ic: d.icon, t, a: `abrirTelaMenu('${id}', '${String(d.title).replace(/'/g, "\\'")}')` }; });
    return cat;
}
function iniAtalhosAtuais() { const l = (appConfig.personalizacao || {}).atalhosInicio; return Array.isArray(l) ? l : INI_PADRAO; }
function iniGravarAtalhos(lista) { appConfig.personalizacao = appConfig.personalizacao || {}; appConfig.personalizacao.atalhosInicio = lista; if (typeof salvarPersonalizacao === 'function') salvarPersonalizacao(); renderInicio(); }
function iniEditarAtalhos(on) { iniEditando = !!on; renderInicio(); }
function iniAlternarAtalho(id) { const l = iniAtalhosAtuais().slice(), i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else l.push(id); iniGravarAtalhos(l); }
function iniMoverAtalho(id, dir) { const l = iniAtalhosAtuais().slice(), i = l.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; iniGravarAtalhos(l); }
function iniRestaurarAtalhos() { iniGravarAtalhos(INI_PADRAO.slice()); }
function htmlEdicaoAtalhos() {
    const cat = iniCatalogo(), ativos = iniAtalhosAtuais().filter(id => cat[id]), fora = Object.keys(cat).filter(id => !ativos.includes(id));
    const lin = (id, on, i) => `<div class="ini-ed-lin"><i class="${cat[id].ic}"></i><span>${escIni(cat[id].t)}</span>${on ? `<button type="button" class="ini-ed-b" aria-label="Subir" onclick="iniMoverAtalho('${id}', -1)" ${i === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button><button type="button" class="ini-ed-b" aria-label="Descer" onclick="iniMoverAtalho('${id}', 1)" ${i === ativos.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>` : ''}<button type="button" class="ini-ed-b ${on ? 'tira' : 'poe'}" aria-label="${on ? 'Remover' : 'Adicionar'}" onclick="iniAlternarAtalho('${id}')"><i class="fa-solid ${on ? 'fa-minus' : 'fa-plus'}"></i></button></div>`;
    return `<div class="ini-card ini-ed">${ativos.map((id, i) => lin(id, true, i)).join('')}</div>` + (fora.length ? `<div class="ini-tit">Outras telas</div><div class="ini-card ini-ed">${fora.map(id => lin(id, false, 0)).join('')}</div>` : '') + `<button type="button" class="ini-ed-rest" onclick="iniRestaurarAtalhos()">Restaurar atalhos padrão</button>`;
}
function renderInicio() {
    const el = document.getElementById('inicio-conteudo'); if (!el) return;
    ['cotacoes', 'nfsProcessadas', 'entradasErp', 'associacoesSpData', 'associacoesFornecedor'].forEach(n => { try { assinarDados(n); } catch (e) { } });   // já subiriam em segundo plano; aqui sobem logo ao abrir (sem leitura extra)
    inicioAtualizarFornecedores();
    const d = inicioDados(), agora = new Date(), nome = inicioPrimeiroNome(), pf = iniLerCache().forn;
    const kForn = pf
        ? `<button type="button" class="ini-k n" onclick="abrirFornecedoresAChegar()"><b>${pf.nao + pf.achegar}</b><span>fornecedores a chegar<br>${pf.nao} não chegaram · ${pf.achegar} com mais de 2 itens faltando</span></button>`
        : `<button type="button" class="ini-k n" onclick="abrirFornecedoresAChegar()"><b>…</b><span>fornecedores a chegar<br>calculando</span></button>`;
    const dataTxt = `${DIAS_INI[agora.getDay()]}, ${String(agora.getDate()).padStart(2, '0')} de ${MESES_INI[agora.getMonth()]}`;
    const k = (cls, n, txt, acao) => `<button type="button" class="ini-k ${cls}" onclick="${acao}"><b>${n}</b><span>${txt}</span></button>`;
    const at = (ic, txt, acao, forte) => `<button type="button" class="ini-at${forte ? ' forte' : ''}" onclick="${acao}"><i class="${ic}"></i><span>${txt}</span></button>`;
    const chipDias = n => { const x = d.dias(n); return x < 0 ? `<span class="ini-chip r">${-x} dia(s) atrás</span>` : x === 0 ? '<span class="ini-chip r">Hoje</span>' : x === 1 ? '<span class="ini-chip y">Amanhã</span>' : `<span class="ini-chip">${x} dias</span>`; };
    const linhasProx = d.proximas.map(n => {
        let nomeF = n.fornecedor || ''; try { nomeF = nomeExibicaoFornecedor(n.fornecedor, n.cnpj || '') || nomeF; } catch (e) { }
        return `<div class="ini-lin"><div>${escIni(nomeF)} ${escIni(n.nf || '')}<small>${escIni(n.vencimento)}${n.valor ? ' · R$ ' + escIni(n.valor) : ''}</small></div>${chipDias(n)}</div>`;
    }).join('') || '<div class="ini-vazio">Nenhuma NF aberta na relação.</div>';
    el.innerHTML = `
        <h1 class="ini-h1">${inicioSaudacao()}${nome ? ', ' + escIni(nome) : ''}</h1><div class="ini-sub">${dataTxt}</div>
        <form class="ini-busca" onsubmit="event.preventDefault(); inicioEnviarBusca(this.q.value)"><i class="fa-solid fa-magnifying-glass"></i><input name="q" type="search" placeholder="Buscar NF, fornecedor, pedido ou produto" autocomplete="off" enterkeyhint="search" oninput="inicioBuscarProdutos(this.value)"></form>
        <div id="ini-busca-res"></div>
        <div class="ini-tit">Atenção agora</div>
        <div class="ini-grid">
            ${k('r', d.venc, 'NFs vencidas na relação', "switchToScreen('screen-reports','Relatórios')")}
            ${k('y', d.hoje + d.aman, `vencem hoje (${d.hoje}) ou amanhã (${d.aman})`, "switchToScreen('screen-reports','Relatórios')")}
            ${k('g', d.naRelacao, 'NFs abertas na relação', "switchToScreen('screen-manage','Repasse de NF')")}
            ${kForn}
        </div>
        <div class="ini-tit ini-tit-ed">Atalhos<button type="button" class="ini-ed-btn" onclick="iniEditarAtalhos(${iniEditando ? 'false' : 'true'})">${iniEditando ? 'Concluir' : 'Editar'}</button></div>
        ${iniEditando ? htmlEdicaoAtalhos() : `<div class="ini-ats">${iniAtalhosAtuais().map((id, i) => { const c = iniCatalogo()[id]; return c ? at(c.ic, c.t, c.a, i === 0) : ''; }).join('')}</div>`}
        <div class="ini-tit">Próximos vencimentos</div>
        <div class="ini-card">${linhasProx}</div>`;
}
// 2.32.0: toque em "fornecedores a chegar" mostra QUEM e de qual PEDIDO (antes abria o gerador de resumo). Usa os mesmos dados do número.
function abrirFornecedoresAChegar() {
    const m = document.getElementById('forn-chegar-modal'); if (!m) return;
    m.classList.add('active');
    const corpo = document.getElementById('forn-chegar-lista');
    let pf = iniLerCache().forn;
    if (!pf || !Array.isArray(pf.lista) || (pf.lista.length && (!Array.isArray(pf.lista[0].prod) || (pf.lista[0].prod.length && typeof pf.lista[0].prod[0] !== 'object')))) {
        corpo.innerHTML = '<div class="ini-vazio">Calculando…</div>';
        setTimeout(() => { try { pf = inicioContarFornecedores(); iniGravarCache({ forn: pf }); } catch (e) { pf = null; } renderFornecedoresAChegar(pf); }, 30);
        return;
    }
    renderFornecedoresAChegar(pf);
}
// dias de atraso pela data limite do pedido (YYYY-MM-DD); sem data, não mostra chip
function iniChipAtraso(lim) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(lim || '')); if (!m) return '';
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dias = Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - hoje) / 86400000);
    if (dias < 0) return `<span class="ini-chip r">${-dias} dia(s) de atraso</span>`;
    if (dias === 0) return '<span class="ini-chip y">vence hoje</span>';
    if (dias <= 2) return `<span class="ini-chip y">vence em ${dias} dia(s)</span>`;
    return `<span class="ini-chip g">no prazo</span>`;
}
// 2.58.9: prazo como texto da linha (sem etiqueta)
function iniTextoAtraso(lim) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(lim || '')); if (!m) return '';
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dias = Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - hoje) / 86400000);
    if (dias < 0) return `<b class="ini-atr r">${-dias} dia(s) de atraso</b>`;
    if (dias === 0) return '<b class="ini-atr y">vence hoje</b>';
    if (dias <= 2) return `<b class="ini-atr y">vence em ${dias} dia(s)</b>`;
    return '<b class="ini-atr g">no prazo</b>';
}
function iniToggleProdutos(btn) {
    const box = btn.closest('.ini-forn') && btn.closest('.ini-forn').querySelector('.ini-prev'); if (!box) return;
    const abre = box.hidden; box.hidden = !abre; btn.setAttribute('aria-expanded', String(abre));
}
function renderFornecedoresAChegar(pf) {
    const corpo = document.getElementById('forn-chegar-lista'), tit = document.getElementById('forn-chegar-tit'); if (!corpo) return;
    const lista = (pf && pf.lista) || [];
    if (tit) tit.textContent = lista.length ? `${lista.length} fornecedor(es) a chegar` : 'Fornecedores a chegar';
    if (!lista.length) { corpo.innerHTML = '<div class="ini-vazio">Nenhum fornecedor pendente nos pedidos dos últimos ' + INI_JANELA_DIAS + ' dias.</div>'; return; }
    const por = {}; lista.forEach(x => { (por[x.p] = por[x.p] || { o: x.o, itens: [] }).itens.push(x); });
    const pedidos = Object.keys(por).sort((a, b) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0));
    corpo.innerHTML = pedidos.map(p => {
        const g = por[p]; g.itens.sort((a, b) => (a.t === b.t ? a.f.localeCompare(b.f, 'pt-BR') : a.t === 'nao' ? -1 : 1));
        return `<div class="ini-tit" style="margin-top:12px">Pedido ${escIni(p)}${g.o ? ' · ' + escIni(g.o) : ''}</div><div class="ini-card">` +
            g.itens.map(x => {
                const sit = x.t === 'nao' ? 'Não chegou (' + x.n + ' item(ns))' : 'Faltam ' + x.n + ' item(ns)';
                const st = `<span class="ini-chip ${x.t === 'nao' ? 'r' : 'y'}">${x.t === 'nao' ? 'Não chegou' : 'Parcial'}</span>`;
                const prevLinhas = (x.prod || []).map(it => `<div class="ini-tab-c">${escIni(it.n)}</div><div class="ini-tab-q">${it.q === null ? '—' : String(it.q).replace('.', ',')}${it.u ? `<small>${escIni(it.u)}</small>` : ''}</div>`).join('');
                const prev = prevLinhas ? `<div class="ini-tab"><div class="ini-tab-h">Material</div><div class="ini-tab-h d">Quantidade</div>${prevLinhas}</div>` : '<div class="ini-vazio">Sem produtos pendentes.</div>';
                return `<div class="ini-forn"><div class="ini-forn-linha"><button type="button" class="ini-forn-main" onclick="closeAllModals(); irParaFornecedorPedido('${escIni(p)}','${escIni(x.c || '')}')"><div>${escIni(x.f)}<small>${sit}${iniTextoAtraso(x.lim) ? ' · ' + iniTextoAtraso(x.lim) : ''}</small></div><div class="ini-forn-chips">${st}</div></button><button type="button" class="ini-seta" aria-expanded="false" aria-label="Ver produtos que faltam" onclick="iniToggleProdutos(this)"><i class="fa-solid fa-chevron-down"></i></button></div><div class="ini-prev" hidden>${prev}</div></div>`;
            }).join('') + '</div>';
        }).join('');
}
function renderInicioSeAtivo() {
    const t = document.getElementById('screen-inicio'); if (!t || !t.classList.contains('active')) return;
    const a = document.activeElement; if (a && a.closest && a.closest('.ini-busca')) return;   // 2.36.0: não apaga o que você está digitando
    renderInicio();
}
// 2.36.0: busca da tela inicial também acha PRODUTOS (nas cotações); toque no resultado leva ao fornecedor e ao produto no pedido.
function inicioBuscarProdutos(txt) {
    const box = document.getElementById('ini-busca-res'); if (!box) return;
    const termo = String(txt || '').trim().toUpperCase();
    if (termo.length < 2) { box.innerHTML = ''; return; }
    const blocos = []; let total = 0;
    (listaCotacoes || []).forEach(c => itensCorrespondentesCotacao(c, termo).forEach(it => { total++; if (blocos.length < 25) blocos.push(renderCardResultadoItem(c, it)); }));
    const verNfs = `<button type="button" class="central-status-toggle" style="margin:0 0 8px" onclick="inicioBuscar(document.querySelector('.ini-busca input').value)">Buscar “${escIni(String(txt).trim())}” nas NFs, fornecedores e pedidos</button>`;
    box.innerHTML = verNfs + (total ? `<div class="ini-tit">Produtos nas cotações (${total}${total > blocos.length ? ', mostrando ' + blocos.length : ''})</div>${blocos.join('')}` : '<div class="ini-vazio">Nenhum produto encontrado nas cotações.</div>');
}
function inicioEnviarBusca(txt) {
    const termo = String(txt || '').trim().toUpperCase(); if (!termo) return;
    const temProduto = (listaCotacoes || []).some(c => itensCorrespondentesCotacao(c, termo).length);
    if (temProduto) { inicioBuscarProdutos(txt); const i = document.querySelector('.ini-busca input'); if (i) i.blur(); return; }
    inicioBuscar(txt);
}
function inicioBuscar(txt) {
    txt = String(txt || '').trim(); if (!txt) return;
    abaControle = 'aberto'; filtroControle = txt; selecionadasControle.clear(); selecaoControleAtiva = false; limiteControle = 60;
    const b = document.getElementById('controle-busca'); if (b) b.value = txt;
    switchToScreen('screen-controle-nfs', 'Controle de NFs'); renderControleNfs();
}
// ---------- busca de lote ----------
function abrirBuscaLote() { switchToScreen('screen-lote', 'Buscar lote'); lotePreparar(); }
function lotePreparar() { const r = document.getElementById('lote-resultado'); if (r && !r.innerHTML) r.innerHTML = '<div class="ini-vazio">Digite o lote, o produto ou a validade e toque em Buscar.</div>'; }
function loteNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ''); }
function loteValidadeBR(v) { try { return typeof dataISOParaBR === 'function' ? (dataISOParaBR(v) || v) : v; } catch (e) { return v; } }
async function loteBuscar() {
    const qLote = document.getElementById('lote-q').value;
    const ql = loteNorm(qLote), qp = loteNorm(document.getElementById('lote-prod').value), qv = String(document.getElementById('lote-val').value || '').trim();
    const out = document.getElementById('lote-resultado');
    if (!ql && !qp && !qv) { out.innerHTML = '<div class="ini-vazio">Preencha pelo menos um campo.</div>'; return; }
    // validade digitada como mm/aaaa, dd/mm/aaaa ou aaaa-mm: compara em texto ISO
    const vIso = (() => { const t = qv.replace(/\s/g, ''); let m = t.match(/^(\d{1,2})\/(\d{4})$/); if (m) return `${m[2]}-${m[1].padStart(2, '0')}`; m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return t; })();
    const lista = typeof listaNfsProcessadas !== 'undefined' ? listaNfsProcessadas : [], achados = []; let semLote = 0;
    lista.forEach(nf => {
        const itens = nf.itens || []; if (!itens.some(i => i.lote)) semLote++;
        itens.forEach(i => {
            if (!i.lote && !qp) return;
            if (ql && !loteNorm(i.lote).includes(ql)) return;
            if (qp && !loteNorm(i.xProd).includes(qp)) return;
            if (qv && !String(i.validade || '').includes(vIso)) return;
            if (!i.lote && (ql || qv)) return;
            achados.push({ nf, i });
        });
    });
    achados.sort((a, b) => String(b.nf.emissao || '').localeCompare(String(a.nf.emissao || '')));
    // Modelo novo (NFs antigas): só quando se busca pelo lote, sem outros filtros
    let antigos = [], falhaAntigos = false;
    if (ql && !qp && !qv && typeof lotesBuscarLote === 'function' && lotesChave(qLote).length >= 4) {
        try { antigos = await lotesBuscarLote(qLote); } catch (e) { falhaAntigos = true; console.error('Modelo novo (lotes antigos):', e); }
    }
    const tagAtual = '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:color-mix(in srgb, var(--accent-color, #0a84ff) 14%, transparent);color:var(--accent-color, #0a84ff);">Dados atuais</span>';
    const tagNovo = '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--warning-bg, #fff6d6);color:var(--warning-text, #8a6d00);">Modelo novo · NF antiga</span>';
    const aviso = `<div class="ini-vazio">${lista.length} NF(s) processadas pesquisadas; ${semLote} sem lote gravado (NFs antigas ou sem lote no XML não aparecem aqui).</div>` + (falhaAntigos ? '<div class="ini-vazio">Não consegui consultar o modelo novo agora. Confira a internet.</div>' : '');
    const total = achados.length + antigos.length;
    if (!total) { out.innerHTML = '<div class="ini-vazio">Nada encontrado com esses dados.</div>' + aviso; return; }
    const htmlAtuais = achados.slice(0, 100).map(({ nf, i }) => {
        let forn = nf.fornecedor || ''; try { forn = nomeExibicaoFornecedor(nf.fornecedor, nf.cnpjFornecedor) || forn; } catch (e) { }
        const sp = i.codigoSpData ? `SP Data ${escIni(i.codigoSpData)}` : '';
        return `<button type="button" class="ini-res" onclick="abrirEditorNf('${escIni(nf.id)}')">${tagAtual}<br><b>${escIni(i.xProd || '')}</b>
            <span>Lote <b>${escIni(i.lote || '—')}</b>${i.validade ? ' · validade ' + escIni(loteValidadeBR(i.validade)) : ''}${i.quantidade ? ' · qtd ' + escIni(i.quantidade) : ''}</span>
            <small>NF ${escIni(nf.nf || '')} · ${escIni(forn)}${nf.pedido ? ' · pedido ' + escIni(nf.pedido) : ''}${sp ? ' · ' + sp : ''}</small></button>`;
    }).join('');
    const htmlNovo = antigos.slice(0, 30).map(a => {
        const tipo = a.dif === 0 ? 'Exata' : `Aproximada (${a.dif} dif.)`;
        return `<div class="lote-ant-linha">${tagNovo}
            <div style="margin-top:4px;"><b>${escIni(a.lote)}</b> <span class="lote-ant-tipo${a.dif === 0 ? '' : ' aprox'}">${tipo}</span></div>
            <div>NF ${escIni(a.nf)} · ${escIni(lotesDataBR(a.data))}</div>
            <div>${escIni(lotesNomeFornecedor(a.cnpj) || lotesCnpjFormatado(a.cnpj))}</div>
            <div class="lote-ant-arq">${escIni(a.caminho)}</div></div>`;
    }).join('');
    out.innerHTML = `<div class="ini-tit">${total} resultado(s)</div>` + htmlAtuais + (antigos.length ? `<div class="lote-ant-lista">${htmlNovo}</div>` + (antigos.length > 30 ? `<div class="ini-vazio">Mostrando 30 de ${antigos.length} do modelo novo.</div>` : '') : '') + aviso;
}
// entrar na tela inicial desenha o painel
(function () { const orig = switchToScreen; switchToScreen = function (id, t) { const r = orig.apply(this, arguments); if (id === 'screen-inicio') renderInicio(); return r; }; })();
window.addEventListener('load', () => { renderInicioSeAtivo(); setTimeout(renderInicioSeAtivo, 600); setTimeout(renderInicioSeAtivo, 2500); setInterval(renderInicioSeAtivo, 20000); setInterval(() => { const t = document.getElementById('screen-inicio'); if (t && t.classList.contains('active')) inicioAtualizarFornecedores(); }, 3000); });
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/48-inicio-lote.js'] = '2.58.9';

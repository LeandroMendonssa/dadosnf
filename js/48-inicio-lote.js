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
            if (st.chave === 'pendente') { if (!/ERP/i.test(st.detalhe || '')) { r.nao++; r.lista.push({ p: String(cot.pedido), o: String(cot.origem || ''), f: nomeF(f), c: String(f.cnpj || ''), t: 'nao', n: itens.length }); } return; }
            const faltam = itens.filter(it => situacaoItemRelCot(e, it.codProduto).falta).length;
            if (faltam >= INI_MIN_ITENS_FALTANDO) { r.achegar++; r.lista.push({ p: String(cot.pedido), o: String(cot.origem || ''), f: nomeF(f), c: String(f.cnpj || ''), t: 'achegar', n: faltam }); }
        });
    }));
    return r;
}
// recalcula só quando os dados mudaram e fora do caminho de desenho da tela (não trava a abertura)
function inicioAtualizarFornecedores() {
    if (_iniCalculando || !listaCotacoes || !listaCotacoes.length) return;
    const sig = [listaCotacoes.length, (listaNfsProcessadas || []).length, (listaEntradasErp || []).length, (listaCotacoes[0] || {}).atualizadoEm || '', (listaAnotacoes || []).length].join('|');
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
        <form class="ini-busca" onsubmit="event.preventDefault(); inicioBuscar(this.q.value)"><i class="fa-solid fa-magnifying-glass"></i><input name="q" type="search" placeholder="Buscar NF, fornecedor ou pedido" autocomplete="off" enterkeyhint="search"></form>
        <div class="ini-tit">Atenção agora</div>
        <div class="ini-grid">
            ${k('r', d.venc, 'NFs vencidas na relação', "switchToScreen('screen-reports','Relatórios')")}
            ${k('y', d.hoje + d.aman, `vencem hoje (${d.hoje}) ou amanhã (${d.aman})`, "switchToScreen('screen-reports','Relatórios')")}
            ${k('g', d.naRelacao, 'NFs abertas na relação', "switchToScreen('screen-manage','Gerenciar')")}
            ${kForn}
        </div>
        <div class="ini-tit">Atalhos</div>
        <div class="ini-ats">
            ${at('fa-solid fa-file-invoice', 'Entrada de NF', "switchToScreen('screen-xml-editor','Entrada de NF')", true)}
            ${at('fa-solid fa-plus-circle', 'Adicionar nota', "switchToScreen('screen-add','Adicionar')")}
            ${at('fa-solid fa-file-contract', 'Cotações', "switchToScreen('screen-cotacoes','Cotações')")}
            ${at('fa-solid fa-list-check', 'Controle de NFs', "switchToScreen('screen-controle-nfs','Controle de NFs')")}
            ${at('fa-solid fa-tasks', 'Gerenciar', "switchToScreen('screen-manage','Gerenciar')")}
            ${at('fa-solid fa-sticky-note', 'Anotações', "switchToScreen('screen-anotacoes','Anotações')")}
            ${at('fa-solid fa-barcode', 'Buscar lote', "abrirBuscaLote()")}
            ${at('fa-solid fa-file-lines', 'Resumo de pendências', 'abrirResumoPendencias()')}
            ${at('fa-solid fa-calendar-days', 'Agenda', "switchToScreen('screen-agenda','Agenda de trabalho'); if (typeof prepararAgenda==='function') prepararAgenda()")}
        </div>
        <div class="ini-tit">Próximos vencimentos</div>
        <div class="ini-card">${linhasProx}</div>`;
}
// 2.32.0: toque em "fornecedores a chegar" mostra QUEM e de qual PEDIDO (antes abria o gerador de resumo). Usa os mesmos dados do número.
function abrirFornecedoresAChegar() {
    const m = document.getElementById('forn-chegar-modal'); if (!m) return;
    m.classList.add('active');
    const corpo = document.getElementById('forn-chegar-lista');
    let pf = iniLerCache().forn;
    if (!pf || !Array.isArray(pf.lista)) {
        corpo.innerHTML = '<div class="ini-vazio">Calculando…</div>';
        setTimeout(() => { try { pf = inicioContarFornecedores(); iniGravarCache({ forn: pf }); } catch (e) { pf = null; } renderFornecedoresAChegar(pf); }, 30);
        return;
    }
    renderFornecedoresAChegar(pf);
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
            g.itens.map(x => `<button type="button" class="ini-lin" style="width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left" onclick="closeAllModals(); irParaFornecedorPedido('${escIni(p)}','${escIni(x.c || '')}')"><div>${escIni(x.f)}<small>${x.t === 'nao' ? 'Não chegou (' + x.n + ' item(ns))' : 'Faltam ' + x.n + ' item(ns)'}</small></div><span class="ini-chip ${x.t === 'nao' ? 'r' : 'y'}">${x.t === 'nao' ? 'Não chegou' : 'Parcial'}</span></button>`).join('') + '</div>';
    }).join('');
}
function renderInicioSeAtivo() { const t = document.getElementById('screen-inicio'); if (t && t.classList.contains('active')) renderInicio(); }
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
function loteBuscar() {
    const ql = loteNorm(document.getElementById('lote-q').value), qp = loteNorm(document.getElementById('lote-prod').value), qv = String(document.getElementById('lote-val').value || '').trim();
    const out = document.getElementById('lote-resultado');
    if (!ql && !qp && !qv) { out.innerHTML = '<div class="ini-vazio">Preencha pelo menos um campo.</div>'; return; }
    // validade digitada como mm/aaaa, dd/mm/aaaa ou aaaa-mm: compara em texto ISO
    const vIso = (() => { const t = qv.replace(/\s/g, ''); let m = t.match(/^(\d{1,2})\/(\d{4})$/); if (m) return `${m[2]}-${m[1].padStart(2, '0')}`; m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; m = t.match(/^(\d{4})-(\d{2})/); return m ? t : t; })();
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
    const aviso = `<div class="ini-vazio">${lista.length} NF(s) processadas pesquisadas; ${semLote} sem lote gravado (NFs antigas ou sem lote no XML não aparecem).</div>`;
    if (!achados.length) { out.innerHTML = '<div class="ini-vazio">Nada encontrado com esses dados.</div>' + aviso; return; }
    out.innerHTML = `<div class="ini-tit">${achados.length} resultado(s)${achados.length > 100 ? ' (mostrando 100)' : ''}</div>` + achados.slice(0, 100).map(({ nf, i }) => {
        let forn = nf.fornecedor || ''; try { forn = nomeExibicaoFornecedor(nf.fornecedor, nf.cnpjFornecedor) || forn; } catch (e) { }
        const sp = i.codigoSpData ? `SP Data ${escIni(i.codigoSpData)}` : '';
        return `<button type="button" class="ini-res" onclick="abrirEditorNf('${escIni(nf.id)}')"><b>${escIni(i.xProd || '')}</b>
            <span>Lote <b>${escIni(i.lote || '—')}</b>${i.validade ? ' · validade ' + escIni(loteValidadeBR(i.validade)) : ''}${i.quantidade ? ' · qtd ' + escIni(i.quantidade) : ''}</span>
            <small>NF ${escIni(nf.nf || '')} · ${escIni(forn)}${nf.pedido ? ' · pedido ' + escIni(nf.pedido) : ''}${sp ? ' · ' + sp : ''}</small></button>`;
    }).join('') + aviso;
}
// entrar na tela inicial desenha o painel
(function () { const orig = switchToScreen; switchToScreen = function (id, t) { const r = orig.apply(this, arguments); if (id === 'screen-inicio') renderInicio(); return r; }; })();
window.addEventListener('load', () => { renderInicioSeAtivo(); setTimeout(renderInicioSeAtivo, 600); setTimeout(renderInicioSeAtivo, 2500); setInterval(renderInicioSeAtivo, 20000); });
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/48-inicio-lote.js'] = '2.34.0';

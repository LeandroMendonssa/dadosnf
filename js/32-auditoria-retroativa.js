// 32-auditoria-retroativa.js — Auditoria retroativa das NFs do ERP (2.11.0)
// Parte do script do app. Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// Duas peças:
//  C) Reavaliação automática: o código do produto da cotação gravado em cada item do ERP é uma "foto" do momento da importação.
//     Quando uma associação SP Data nova aparece, os itens antigos ficam defasados. reavaliarItensErp() completa esses itens sozinha.
//     Só PREENCHE ou CORRIGE para um código existente; nunca apaga um código (dados ainda carregando não podem zerar nada).
//  B) Tela "Auditoria Retroativa": mostra, por NF do ERP, o que o app entendeu (pedido e itens), o que ligou sozinho e o que está pendente.

let reavaliandoItensErp = false;
let retroFiltro = 'todas';
let retroLimite = 60;

function codigoProdutoAtualDoItemErp(item) {
    const a = listaAssociacoesSpData.find(x => x.spDataCodigo === item.codigoSpData && !ehChaveDiretaSpData(x.codigoSmartCompras));
    return a ? a.codigoSmartCompras : null;
}
// Entradas do ERP com itens cujo código gravado difere do que as associações atuais indicam (só quando hoje existe um código).
function entradasErpComItensDefasados() {
    const r = [];
    listaEntradasErp.forEach(e => {
        let n = 0;
        const itens = (e.itens || []).map(it => {
            const novo = codigoProdutoAtualDoItemErp(it);
            if (novo && it.codigoSmartComprasRelacionado !== novo) { n++; return { ...it, codigoSmartComprasRelacionado: novo }; }
            return it;
        });
        if (n) r.push({ entrada: e, itens, n });
    });
    return r;
}
async function reavaliarItensErp(manual) {
    if (reavaliandoItensErp) return;
    if (!manual && (!dadosAppInscritos || !listaAssociacoesSpData.length || !listaEntradasErp.length)) return; // ainda carregando
    const defasadas = entradasErpComItensDefasados();
    if (!defasadas.length) { if (manual) toast('Nenhum item defasado: tudo já está atualizado.'); return; }
    reavaliandoItensErp = true;
    try {
        let total = 0;
        for (const d of defasadas) { await entradasErpCollection.doc(d.entrada.id).update({ itens: d.itens, itensReavaliadosEm: new Date().toISOString() }); total += d.n; }
        toast(`✓ ${total} item(ns) do ERP atualizado(s) com as associações mais recentes.`);
    } catch (e) { console.error('Erro ao reavaliar itens do ERP:', e); if (manual) toast('✕ Erro ao atualizar os itens.'); }
    finally { reavaliandoItensErp = false; }
}

// ---------------- conferência da sugestão de pedido (2.11.3) ----------------
// Reúne num lugar só o que você conferiria olhando a cotação: valor total, datas e itens da NF dentro do pedido sugerido.
function diasEntreISO(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
function dataBRdeISO(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'; }
function conferenciaPedidoSugerido(e, pedido) {
    const cot = listaCotacoes.find(c => String(c.pedido) === String(pedido)); if (!cot) return null;
    const v = e.vinculo || {};
    const cnpj = v.cnpjFornecedor || e.cnpjFornecedor || '';
    const entidade = cnpjsDaMesmaEntidadeFornecedor(cnpj);
    const doForn = i => mesmoCnpj(i.cnpjFornecedor, cnpj) || cnpjEmLista(entidade, i.cnpjFornecedor);
    const checks = [];
    // valor total
    const vNf = e.financeiro && e.financeiro.totalNota != null ? e.financeiro.totalNota : numeroFlexivel(e.valor);
    const vCot = (cot.itens || []).filter(doForn).reduce((sm, i) => { const t = numeroFlexivel(i.precoTotal); if (t !== null) return sm + t; const q = numeroFlexivel(i.quantidade), u = numeroFlexivel(i.precoUnitario); return sm + (q !== null && u !== null ? q * u : 0); }, 0);
    if (vNf != null && vCot > 0) {
        const dif = (vNf - vCot) / vCot * 100;
        checks.push({ ok: Math.abs(dif) <= 5 ? 'ok' : (Math.abs(dif) <= 15 ? 'aviso' : 'erro'), rotulo: 'Valor total', texto: `NF R$ ${formatValorBR(vNf)} × cotado R$ ${formatValorBR(vCot)} (${dif > 0 ? '+' : ''}${dif.toFixed(1).replace('.', ',')}%)` });
    } else checks.push({ ok: 'aviso', rotulo: 'Valor total', texto: 'Sem valor para comparar.' });
    // datas
    const dNf = converterDataBRparaISO(e.data) || '', dPed = dataISOSimples(cot.dataPedido), dLim = dataISOSimples(cot.dataLimite);
    if (dNf && dPed) {
        const apos = diasEntreISO(dPed, dNf), aposLim = dLim ? diasEntreISO(dLim, dNf) : null;
        const ok = apos < 0 ? 'erro' : (aposLim !== null && aposLim > 45 ? 'aviso' : 'ok');
        checks.push({ ok, rotulo: 'Datas', texto: `Pedido em ${dataBRdeISO(dPed)}${dLim ? ' (limite ' + dataBRdeISO(dLim) + ')' : ''} · NF em ${dataBRdeISO(dNf)} — ${apos < 0 ? Math.abs(apos) + ' dia(s) ANTES do pedido' : apos + ' dia(s) depois do pedido'}${aposLim !== null && aposLim > 0 ? ', ' + aposLim + ' depois do limite' : ''}` });
    } else checks.push({ ok: 'aviso', rotulo: 'Datas', texto: 'Sem data para comparar.' });
    // itens
    const itensCot = (cot.itens || []).filter(doForn);
    const linhas = (e.itens || []).map(it => {
        const cod = it.codigoSmartComprasRelacionado || codigoProdutoAtualDoItemErp(it);
        let ci = cod ? itensCot.find(i => i.codProduto === cod) : null, via = ci ? 'produto' : '';
        let outro = null;
        if (!ci && cod) outro = (cot.itens || []).find(i => i.codProduto === cod);
        if (!ci && !outro) { ci = itensCot.find(i => nomesProdutoCombinam(it.nome, i.nomeOficial || i.descricao || '')); if (ci) via = 'nome'; }
        let st = ci ? 'ok' : (outro ? 'aviso' : (cod ? 'erro' : 'aviso'));
        let det = '';
        if (ci) {
            const q = numeroFlexivel(ci.quantidade), u = numeroFlexivel(ci.precoUnitario);
            const mesmoPreco = u !== null && Math.abs((it.valorUnitario || 0) - u) < 0.01;
            det = `cotado ${q !== null ? numeroLimpo(q) : '?'} × R$ ${u !== null ? formatValorBR(u) : '?'} · NF ${numeroLimpo(it.quantidade)} × R$ ${formatValorBR(it.valorUnitario || 0)}`;
            if (via === 'nome') det += ' (casou pelo nome)';
            if (!mesmoPreco && via === 'produto') { st = 'aviso'; det += ' — valor unitário difere (pode ser unidade diferente)'; }
        } else if (outro) det = 'está no pedido, mas ganho por outro fornecedor';
        else if (cod) det = 'o produto não está neste pedido';
        else det = 'sem produto da cotação ligado';
        return { nome: it.nome, st, det };
    });
    const nOk = linhas.filter(l => l.st === 'ok').length;
    checks.push({ ok: !linhas.length ? 'aviso' : (nOk / linhas.length >= 0.6 ? 'ok' : (nOk ? 'aviso' : 'erro')), rotulo: 'Itens', texto: `${nOk} de ${linhas.length} item(ns) da NF estão na cotação deste fornecedor` });
    const bate = checks.every(c => c.ok === 'ok');
    const grave = checks.some(c => c.ok === 'erro');
    return { cot, checks, linhas, veredito: bate ? 'bate' : (grave ? 'nao' : 'conferir') };
}
function htmlConferenciaSugestao(e, pedido) {
    const c = conferenciaPedidoSugerido(e, pedido);
    if (!c) return `<div class="xml-item-meta">Pedido ${escRel(pedido)} não encontrado nas cotações.</div>`;
    const ic = { ok: '✓', aviso: '⚠', erro: '✕' };
    return `<div class="retro-conf"><div class="retro-conf-tit">Pedido ${escRel(pedido)}${c.cot.origem ? ' — ' + escRel(c.cot.origem) : ''}</div>
        ${c.checks.map(k => `<div class="retro-ck ${k.ok}"><span class="retro-ck-i">${ic[k.ok]}</span><span><b>${k.rotulo}:</b> ${escRel(k.texto)}</span></div>`).join('')}
        <details class="retro-det"><summary>Itens da NF × cotação</summary>${c.linhas.map(l => `<div class="retro-linha"><span>${escRel(l.nome)}<br><small>${escRel(l.det)}</small></span><span class="retro-it ${l.st === 'ok' ? 'ok' : (l.st === 'erro' ? 'err' : 'm')}">${l.st === 'ok' ? '✓' : (l.st === 'erro' ? '✕' : '⚠')}</span></div>`).join('')}</details>
        <div class="nfe-acoes"><button type="button" class="central-status-toggle" onclick="abrirCentralPedido('${escRel(pedido)}')">Abrir o pedido ${escRel(pedido)}</button>
            <button type="button" class="central-status-toggle" onclick="confirmarVinculoErpComPedido('${escRel(e.id)}', '${escRel(pedido)}')">Confirmar ${escRel(pedido)}</button></div></div>`;
}
function candidatosPedidoErp(e) {
    const v = e.vinculo || {};
    const lista = (v.candidatos || []).map(c => String(c.pedido)).filter(Boolean);
    if (v.pedido && !lista.includes(String(v.pedido))) lista.unshift(String(v.pedido));
    return lista;
}

// ---------------- análise por NF ----------------
function analiseRetroativaErp() {
    const defas = new Map(entradasErpComItensDefasados().map(d => [d.entrada.id, d.n]));
    const temXml = new Set(listaNfsProcessadas.map(n => n.id));
    return listaEntradasErp.map(e => {
        const itens = e.itens || [];
        const ligados = itens.filter(i => i.codigoSmartComprasRelacionado || codigoProdutoAtualDoItemErp(i)).length;
        const v = e.vinculo || {};
        const direta = e.statusFluxo === 'historico_direto';
        const pedidoSt = direta ? 'direta' : (v.status || 'sem_associacao');
        const ver = (pedidoSt === 'sugerido' && v.pedido) ? ((conferenciaPedidoSugerido(e, v.pedido) || {}).veredito || null) : null;
        return { e, itens, ligados, semProduto: itens.length - ligados, defasados: defas.get(e.id) || 0, pedidoSt, pedido: v.pedido ? String(v.pedido) : '', motivo: v.motivo || '', xml: temXml.has(e.id), veredito: ver };
    });
}
function resumoRetroativo(an) {
    const c = { total: an.length, confirmado: 0, sugerido: 0, sem: 0, direta: 0, itens: 0, ligados: 0, defasados: 0 };
    an.forEach(a => {
        if (a.pedidoSt === 'confirmado') c.confirmado++; else if (a.pedidoSt === 'sugerido') c.sugerido++; else if (a.pedidoSt === 'direta') c.direta++; else c.sem++;
        c.itens += a.itens.length; c.ligados += a.ligados; c.defasados += a.defasados;
    });
    return c;
}
const RETRO_FILTROS = [['todas', 'Todas'], ['sugerido', 'Pedido sugerido'], ['sem', 'Sem pedido'], ['semproduto', 'Itens sem produto'], ['defasados', 'Itens defasados']];
function passaFiltroRetro(a) {
    if (retroRecemConfirmadas.has(a.e.id)) return true;
    if (retroFiltro === 'sugerido') return a.pedidoSt === 'sugerido';
    if (retroFiltro === 'sem') return a.pedidoSt === 'sem_associacao';
    if (retroFiltro === 'semproduto') return a.semProduto > 0;
    if (retroFiltro === 'defasados') return a.defasados > 0;
    return true;
}
const retroRecemConfirmadas = new Set(); // NFs confirmadas nesta visita: ficam no lugar, marcadas, para você não ficar na dúvida
function prepararAuditoriaRetroativa() { retroFiltro = 'todas'; retroLimite = 60; retroRecemConfirmadas.clear(); renderAuditoriaRetroativa(); }
function renderAuditoriaRetroSeAtiva() {
    const t = document.getElementById('screen-auditoria-retro');
    if (t && t.classList.contains('active')) renderAuditoriaRetroativa();
}
function filtrarRetro(f) { retroFiltro = f; retroLimite = 60; renderAuditoriaRetroativa(); }
function maisRetro() { retroLimite += 60; renderAuditoriaRetroativa(); }

function renderAuditoriaRetroativa() {
    const el = document.getElementById('retro-conteudo'); if (!el) return;
    const an = analiseRetroativaErp();
    const c = resumoRetroativo(an);
    const sug = an.filter(a => a.pedidoSt === 'sugerido' && a.pedido && a.veredito === 'bate');
    const apr = typeof propostasAprendizadoRetro === 'function' ? propostasAprendizadoRetro() : { sp: [], fornecedor: [], conflitos: 0 }; // js/35 ausente: a tela abre mesmo assim
    const pct = c.itens ? Math.round(c.ligados * 100 / c.itens) : 0;
    const resumo = `<div class="card"><div class="xml-item-meta"><strong>O que o app entendeu das NFs do ERP</strong></div>
        <div class="retro-grade">
            <div><b>${c.total}</b><span>NFs do ERP</span></div>
            <div><b>${c.confirmado}</b><span>pedido confirmado</span></div>
            <div><b>${c.sugerido}</b><span>pedido sugerido</span></div>
            <div><b>${c.sem}</b><span>sem pedido</span></div>
            <div><b>${c.ligados}/${c.itens}</b><span>itens com produto (${pct}%)</span></div>
            <div><b>${c.defasados}</b><span>itens defasados</span></div>
        </div>
        <div class="xml-item-meta">Você não precisa associar NF por NF: os itens se ligam ao produto da cotação pelo código SP Data, e o pedido é encontrado pelo CNPJ, pelos itens e pelo valor. O que depende de você aparece abaixo como sugestão ou pendência.</div>
        <div class="nfe-acoes">${c.defasados ? `<button type="button" class="central-status-toggle" onclick="reavaliarItensErp(true)">Atualizar ${c.defasados} item(ns) defasado(s)</button>` : ''}
            ${sug.length ? `<button type="button" class="central-status-toggle" onclick="confirmarSugestoesRetro()">Confirmar as ${sug.length} que batem em tudo</button>` : ''}
            ${(apr.sp.length || apr.fornecedor.length) ? `<button type="button" class="central-status-toggle" onclick="aprenderRetroativoConfirmar()">Aprender ${apr.fornecedor.length + apr.sp.length} associação(ões) dos pedidos confirmados</button>` : ''}</div></div>`;
    const chips = `<div class="retro-chips">${RETRO_FILTROS.map(([k, t]) => `<button type="button" class="retro-chip${retroFiltro === k ? ' on' : ''}" onclick="filtrarRetro('${k}')">${t}</button>`).join('')}</div>`;
    const ordem = { sugerido: 0, sem_associacao: 1, confirmado: 2, direta: 3 };
    const lista = an.filter(passaFiltroRetro).sort((x, y) => (y.defasados > 0) - (x.defasados > 0) || (ordem[x.pedidoSt] - ordem[y.pedidoSt]) || (y.semProduto - x.semProduto));
    const cards = lista.slice(0, retroLimite).map(a => {
        const e = a.e;
        const nome = tituloFornNf(e.fornecedorNomeEditado || nomeExibicaoFornecedor(e.fornecedorNomeRelatorio || '', e.cnpjFornecedor) || e.fornecedorNomeRelatorio || '(sem fornecedor)', e.cnpjFornecedor, e.nf);
        const rot = retroRecemConfirmadas.has(e.id) ? ['ok', '✓ Confirmado: pedido ' + a.pedido] : { confirmado: ['ok', 'Pedido ' + a.pedido], sugerido: ['', 'Sugerido ' + a.pedido], sem_associacao: ['m', 'Sem pedido'], direta: ['m', 'Direta'] }[a.pedidoSt] || ['m', a.pedidoSt];
        const motivo = a.pedidoSt === 'sugerido' ? `Evidências: ${((e.vinculo && e.vinculo.evidencias) || []).map(escRel).join(' ')}` : (a.pedidoSt === 'sem_associacao' ? escRel(a.motivo) : (a.pedidoSt === 'direta' ? 'Marcada como "Não vai ao financeiro": não precisa de pedido.' : ''));
        const itensHtml = a.itens.map(it => {
            const cod = it.codigoSmartComprasRelacionado, novo = codigoProdutoAtualDoItemErp(it);
            const st = !cod && !novo ? '<span class="retro-it m">sem produto</span>' : (!cod && novo ? '<span class="retro-it err">defasado</span>' : '<span class="retro-it ok">produto ' + escRel(cod) + '</span>');
            return `<div class="retro-linha"><span>${escRel(it.nome)} · ${escRel(qdtFmt(it.quantidade))}</span>${st}</div>`;
        }).join('');
        return `<div class="ctl-card">
            <div class="ctl-top"><div class="ctl-av">${escRel(iniciaisControle(e.fornecedorNomeRelatorio || ''))}</div>
                <div class="ctl-nm"><b>${escRel(nome)}</b><small>${escRel(e.data || '—')} · ${a.xml ? 'XML no app' : 'só ERP'}</small></div>
                <span class="ctl-st ${rot[0]}">${escRel(rot[1])}</span></div>
            <div class="ctl-inf">${a.ligados}/${a.itens.length} item(ns) com produto${a.defasados ? ` · <strong>${a.defasados} defasado(s)</strong>` : ''}</div>
            ${motivo ? `<div class="ctl-inf retro-motivo">${motivo}</div>` : ''}
            ${a.pedidoSt === 'sugerido' ? `<details class="retro-det retro-conf-det"><summary>Conferir a sugestão${a.veredito ? ' — ' + ({ bate: '✓ bate em tudo', conferir: '⚠ conferir', nao: '✕ não parece' }[a.veredito]) : ''}</summary>${candidatosPedidoErp(e).map(p => htmlConferenciaSugestao(e, p)).join('')}</details>` : ''}
            <details class="retro-det"><summary>Ver itens</summary>${itensHtml || '<div class="xml-item-meta">Sem itens.</div>'}</details>
            <div class="ctl-bar" style="grid-template-columns:repeat(${a.pedidoSt === 'sugerido' && a.pedido ? 2 : 1},1fr)">
                ${a.pedidoSt === 'sugerido' && a.pedido ? `<button type="button" onclick="confirmarVinculoErpComPedido('${escRel(e.id)}', '${escRel(a.pedido)}')">${ICONES_CTRL.fin}<span>Confirmar ${escRel(a.pedido)}</span></button>` : ''}
                <button type="button" onclick="abrirEditorNf('${escRel(e.id)}')">${ICONES_CTRL.ed}<span>Abrir NF</span></button></div>
        </div>`;
    }).join('');
    el.innerHTML = resumo + chips + (cards || '<div class="empty-state">Nenhuma NF neste filtro.</div>')
        + (lista.length > retroLimite ? `<div class="nfe-acoes"><button type="button" class="central-status-toggle" onclick="maisRetro()">Mostrar mais (${lista.length - retroLimite})</button></div>` : '');
}
function confirmarSugestoesRetro() {
    const sug = analiseRetroativaErp().filter(a => a.pedidoSt === 'sugerido' && a.pedido && a.veredito === 'bate');
    if (!sug.length) return toast('Nenhuma sugestão bate em tudo (valor, datas e itens): confira as demais uma a uma.');
    showConfirmModal({
        title: 'Confirmar sugestões de pedido',
        message: `Confirmar o pedido sugerido para ${sug.length} NF(s) do ERP? Só entram as que batem em tudo: valor total até 5% de diferença, data da NF depois do pedido (e até 45 dias após o limite) e pelo menos 60% dos itens na cotação do fornecedor. As demais ficam para você conferir uma a uma. Dá para desfazer em cada NF depois.`,
        confirmText: 'Confirmar todas', confirmClass: 'warning',
        onConfirm: async () => { for (const a of sug) await confirmarVinculoErpComPedido(a.e.id, a.pedido); toast(`✓ ${sug.length} vínculo(s) confirmado(s).`); }
    });
}

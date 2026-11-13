/* 2.33.0 — NF DUPLICADA (NF inteira, não item a item).
   Regra: uma NF é duplicada quando TODOS os seus itens já chegaram em outra(s) NF(s) do MESMO pedido e do mesmo fornecedor,
   com número de NF diferente. Mesmo número = atualização (nunca avisa). Se qualquer item for novo (ainda não chegou),
   NÃO é duplicidade: segue como divergência por item. Só leitura: nada é gravado até você decidir. */
const DUP_ROTULO = {
    aceito: 'Aceito — ficamos com o material',
    devolucao_total: 'Não aceito — devolução total',
    devolucao_parcial: 'Não aceito — devolução parcial',
    nao_duplicada: 'Não é duplicidade'
};
let _dupTela = {};              // decisão tomada na NF aberta na tela, ainda não salva: chave -> {decisao,...}
let _dupCache = { ref: null, n: -1, map: new Map() };

function dupPedidosDaNf(n) { return [n.pedido, ...(n.pedidos || [])].filter(Boolean).map(String); }
function dupFmtQ(q) { return String(Math.round((Number(q) || 0) * 1000) / 1000).replace('.', ','); }

// alvo = {nf, cnpj, pedidos[], itens:[{cod, cProd, q, nome}]}; candidatas = NFs já salvas contra as quais comparar.
function dupAnalisar(alvo, candidatas) {
    if (!alvo.itens.length) return null;
    const ent = cnpjsDaMesmaEntidadeFornecedor(alvo.cnpj), num = normNfNumero(alvo.nf);
    const ped = new Set(alvo.pedidos.filter(Boolean).map(String));
    if (candidatas.some(n => normNfNumero(n.nf) === num)) return null;   // mesmo número = atualização, nunca duplicidade
    const outras = candidatas.filter(n => normNfNumero(n.nf) !== num && Array.isArray(n.itens) && n.itens.length
        && (mesmoCnpj(n.cnpjFornecedor, alvo.cnpj) || cnpjEmLista(ent, n.cnpjFornecedor))
        && dupPedidosDaNf(n).some(p => ped.has(p)));
    if (!outras.length) return null;
    const m = new Map();
    outras.forEach(o => o.itens.forEach(i => {
        const q = Number(i.quantidade) || 0;
        [['s:' + i.codigoSmartCompras, i.codigoSmartCompras], ['c:' + i.cProd, i.cProd]].forEach(([k, v]) => {
            if (!v) return;
            const r = m.get(k) || { q: 0, nfs: new Set() };
            r.q += q; r.nfs.add(String(o.nf)); m.set(k, r);
        });
    }));
    const orig = new Set(); let qtdDif = 0; const itens = [];
    for (const it of alvo.itens) {
        const r = (it.cod && m.get('s:' + it.cod)) || (it.cProd && m.get('c:' + it.cProd));
        if (!r) return null;                       // há item novo → não é duplicidade
        r.nfs.forEach(x => orig.add(x));
        if (Math.abs(r.q - it.q) > 0.01) qtdDif++;
        itens.push({ nome: it.nome, q: it.q, qOrig: r.q });
    }
    const pedidoComum = dupPedidosDaNf(outras.find(o => orig.has(String(o.nf)))).find(p => ped.has(p)) || [...ped][0] || '';
    return { orig: [...orig], pedido: pedidoComum, itens, qtdDif };
}
function dupItensDeNfSalva(nf) {
    return (nf.itens || []).map(i => ({ cod: i.codigoSmartCompras || null, cProd: i.cProd, q: Number(i.quantidade) || 0, nome: String(i.xProd || i.cProd || '').split(' (')[0].slice(0, 60) }));
}
// NF já salva: compara só com as salvas ANTES dela (a mais antiga é a original; assim as duas nunca se acusam).
function dupInfo(nf) {
    if (!nf || !Array.isArray(nf.itens)) return null;
    if (_dupCache.ref !== listaNfsProcessadas || _dupCache.n !== listaNfsProcessadas.length) _dupCache = { ref: listaNfsProcessadas, n: listaNfsProcessadas.length, map: new Map() };
    const k = String(nf.id || nf.nf), semCache = k.endsWith('#tela');
    if (!semCache && _dupCache.map.has(k)) return _dupCache.map.get(k);
    const antes = listaNfsProcessadas.filter(o => o.id !== nf.id && ((o.processadoEm || '') < (nf.processadoEm || '') || ((o.processadoEm || '') === (nf.processadoEm || '') && String(o.id) < String(nf.id))));
    let r = null;
    try { r = dupAnalisar({ nf: nf.nf, cnpj: nf.cnpjFornecedor, pedidos: dupPedidosDaNf(nf), itens: dupItensDeNfSalva(nf) }, antes); } catch (e) { r = null; }
    if (!semCache) _dupCache.map.set(k, r);
    return r;
}
// Fica fora da soma de recebido do pedido (some o "quantidade acima" item a item), salvo se você disse "não é duplicidade".
function dupExcluida(nf) {
    const r = dupInfo(nf);
    return !!r && !(nf.duplicidade && nf.duplicidade.decisao === 'nao_duplicada');
}
function dupInvalidar() { _dupCache = { ref: null, n: -1, map: new Map() }; }

// NF aberta na tela (XML ainda não salvo ou em edição).
function dupDaTela() {
    if (typeof nfeInfoAtual === 'undefined' || !nfeInfoAtual || !itensXmlDetectados.length) return null;
    const mont = montarNfProcessadaAtual(); if (!mont) return null;
    const d = mont.doc;
    const r = dupAnalisar({ nf: d.nf, cnpj: d.cnpjFornecedor, pedidos: dupPedidosDaNf(d), itens: dupItensDeNfSalva(d) }, listaNfsProcessadas.filter(o => o.id !== mont.chave));
    return r ? { ...r, chave: mont.chave, nf: d.nf } : null;
}
function dupDecisaoDe(chave) {
    if (_dupTela[chave]) return _dupTela[chave];
    const s = listaNfsProcessadas.find(n => n.id === chave);
    return (s && s.duplicidade) || null;
}
function dupRotuloDecisao(d) { return d && d.decisao ? DUP_ROTULO[d.decisao] + (d.decisao === 'devolucao_parcial' && (d.itensDevolver || []).length ? ` (${d.itensDevolver.length} item(ns))` : '') : 'Sem decisão ainda'; }

// ---- Entrada de NF ----
function htmlDuplicidadeNfXml() {
    let r = null;
    try { r = dupDaTela(); } catch (e) { return ''; }
    if (!r) return '';
    const dec = dupDecisaoDe(r.chave);
    if (dec && dec.decisao === 'nao_duplicada') return `<div class="card dup-nf-alerta ok"><div class="dup-nf-tit">NF ${escRel(String(r.nf))}: marcada como NÃO duplicada</div><button type="button" class="central-status-toggle" onclick="dupAbrirDecisao('tela','${escRel(r.chave)}')">Mudar decisão</button></div>`;
    return `<div class="card dup-nf-alerta"><div class="dup-nf-tit">⚠ Possível NF duplicada</div>
        <div class="dup-nf-linha">Todos os <b>${r.itens.length}</b> itens da NF <b>${escRel(String(r.nf))}</b> já chegaram na NF <b>${r.orig.map(x => escRel(x)).join(', ')}</b>${r.pedido ? ' (pedido ' + escRel(String(r.pedido)) + ')' : ''}.${r.qtdDif ? ` Em ${r.qtdDif} item(ns) a quantidade difere.` : ''}</div>
        <div class="dup-nf-obs">Situação: <b>${escRel(dupRotuloDecisao(dec))}</b>. Pode salvar sem decidir: fica como “Pedido duplicado” em aberto na Central do pedido.</div>
        <div style="margin-top:8px"><button type="button" class="actions-button" onclick="dupAbrirDecisao('tela','${escRel(r.chave)}')">${dec && dec.decisao ? 'Mudar decisão' : 'Decidir agora'}</button></div></div>`;
}

// ---- Decisão (folha) ----
function dupAbrirDecisao(modo, chave) {
    let info, nfNum, itens;
    if (modo === 'tela') { info = dupDaTela(); if (!info) return toast('Não há mais duplicidade detectada nesta NF.'); nfNum = info.nf; itens = info.itens; }
    else { const nf = listaNfsProcessadas.find(n => n.id === chave); if (!nf) return; info = dupInfo(nf); if (!info) return toast('Não há duplicidade detectada nesta NF.'); nfNum = nf.nf; itens = info.itens; }
    const dec = dupDecisaoDe(chave) || {};
    let m = document.getElementById('dup-modal');
    if (!m) { m = document.createElement('div'); m.id = 'dup-modal'; m.className = 'modal-screen'; document.body.appendChild(m); }
    const op = (v, t) => `<label class="dup-op"><input type="radio" name="dup-dec" value="${v}" ${dec.decisao === v ? 'checked' : ''} onchange="dupMostrarItens()"> ${t}</label>`;
    m.innerHTML = `<div class="modal-content"><h2>NF ${escRel(String(nfNum))} em duplicidade</h2>
        <p style="font-size:12px;color:var(--text-light);margin:0 0 8px">Os mesmos itens já vieram na NF ${info.orig.map(x => escRel(x)).join(', ')}${info.pedido ? ' (pedido ' + escRel(String(info.pedido)) + ')' : ''}.</p>
        ${op('aceito', 'Aceito — ficamos com o material')}${op('devolucao_total', 'Não aceito — devolução total')}${op('devolucao_parcial', 'Não aceito — devolução parcial')}${op('nao_duplicada', 'Não é duplicidade (contar normalmente)')}
        <div id="dup-itens" style="display:none;max-height:30vh;overflow:auto;margin:6px 0">${itens.map((it, i) => `<label class="dup-op"><input type="checkbox" class="dup-item" data-i="${i}" ${(dec.itensDevolver || []).includes(it.nome) ? 'checked' : ''}> ${escRel(it.nome)} <span class="xml-item-meta">(${dupFmtQ(it.q)})</span></label>`).join('')}</div>
        <div class="confirm-actions"><button type="button" class="actions-button is-ghost" onclick="closeAllModals()">Cancelar</button><button type="button" class="actions-button" onclick="dupSalvarDecisao('${modo}','${escRel(chave)}')">Salvar decisão</button></div></div>`;
    m._dupItens = itens; m._dupInfo = info;
    m.classList.add('active'); dupMostrarItens();
}
function dupMostrarItens() {
    const r = document.querySelector('#dup-modal input[name="dup-dec"]:checked'), b = document.getElementById('dup-itens');
    if (b) b.style.display = (r && r.value === 'devolucao_parcial') ? 'block' : 'none';
}
async function dupSalvarDecisao(modo, chave) {
    const m = document.getElementById('dup-modal'); if (!m) return;
    const r = m.querySelector('input[name="dup-dec"]:checked'); if (!r) return toast('Escolha uma das opções.');
    const dec = { decisao: r.value, orig: m._dupInfo.orig, pedido: m._dupInfo.pedido || '', em: new Date().toISOString() };
    if (r.value === 'devolucao_parcial') {
        dec.itensDevolver = [...m.querySelectorAll('.dup-item:checked')].map(c => m._dupItens[Number(c.dataset.i)].nome);
        if (!dec.itensDevolver.length) return toast('Marque os itens a devolver.');
    }
    closeAllModals();
    if (modo === 'tela') {
        _dupTela[chave] = dec;
        if (typeof renderAssociacaoCotacaoXml === 'function') renderAssociacaoCotacaoXml();
        toast('✓ Decisão registrada. Ela é gravada junto com a NF ao salvar.');
        return;
    }
    const nf = listaNfsProcessadas.find(n => n.id === chave); if (!nf) return;
    try { await nfsProcessadasCollection.doc(chave).update({ duplicidade: dec }); nf.duplicidade = dec; dupInvalidar(); toast('✓ Decisão da NF duplicada registrada.'); }
    catch (e) { return toast('Não foi possível gravar a decisão.'); }
    if (nf.pedido && typeof renderCentralPedidoCompleto === 'function') renderCentralPedidoCompleto(nf.pedido);
}

// ---- Central do pedido: UM grupo por NF duplicada ----
function dupNfsDoFornecedorPedido(pedido, cnpj) {
    return listaNfsProcessadas.filter(n => dupPedidosDaNf(n).includes(String(pedido)) && (mesmoCnpj(n.cnpjFornecedor, cnpj) || cnpjEmLista(cnpjsDaMesmaEntidadeFornecedor(cnpj), n.cnpjFornecedor)))
        .map(n => ({ n, info: dupInfo(n) })).filter(x => x.info && !(x.n.duplicidade && x.n.duplicidade.decisao === 'nao_duplicada'));
}
function htmlDuplicidadeCentral(pedido, cnpj) {
    const lista = dupNfsDoFornecedorPedido(pedido, cnpj);
    if (!lista.length) return '';
    return lista.map(({ n, info }) => {
        const dec = n.duplicidade || null, aberto = !(dec && dec.decisao);
        const id = escRel(String(n.id));
        return `<div class="card dup-nf-alerta ${aberto ? '' : 'ok'}" onclick="event.stopPropagation()">
            <div class="dup-nf-tit">${aberto ? '⚠ Pedido duplicado' : '✓ Duplicidade resolvida'} — NF ${escRel(String(n.nf))} recebida em duplicidade</div>
            <div class="dup-nf-linha">Todos os ${info.itens.length} itens já vieram na NF ${info.orig.map(x => escRel(x)).join(', ')}. Situação: <b>${escRel(dupRotuloDecisao(dec))}</b>.</div>
            <details class="dup-nf-linha"><summary>Ver itens</summary><ul>${info.itens.map(i => `<li>${escRel(i.nome)} — ${dupFmtQ(i.q)}${Math.abs(i.q - i.qOrig) > 0.01 ? ` (na NF original: ${dupFmtQ(i.qOrig)})` : ''}</li>`).join('')}</ul></details>
            <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="central-status-toggle" onclick="dupAbrirDecisao('salva','${id}')">${aberto ? 'Resolver' : 'Mudar decisão'}</button>
            <button type="button" class="central-status-toggle" onclick="dupGerarAuditoria('${escRel(String(pedido))}','${id}')">Gerar auditoria (1)</button></div></div>`;
    }).join('');
}
function dupQtdAbertasFornecedor(pedido, cnpj) { return dupNfsDoFornecedorPedido(pedido, cnpj).filter(x => !(x.n.duplicidade && x.n.duplicidade.decisao)).length; }

// ---- Auditoria ----
function dupTextoDesfecho(dec) {
    if (!dec || !dec.decisao) return 'Aguardando decisão.';
    if (dec.decisao === 'aceito') return 'Aceito: ficamos com o material.';
    if (dec.decisao === 'devolucao_total') return 'Não aceito: devolução total da NF.';
    return 'Não aceito: devolução parcial' + ((dec.itensDevolver || []).length ? ' (' + dec.itensDevolver.join('; ') + ')' : '') + '.';
}
function dupGerarAuditoria(pedido, nfId) {
    const nf = listaNfsProcessadas.find(n => n.id === nfId); if (!nf) return;
    const info = dupInfo(nf); if (!info) return toast('Não há duplicidade detectada nesta NF.');
    const cotacao = listaCotacoes.find(c => c.pedido === pedido);
    const fornecedor = cotacao && (cotacao.fornecedores || []).find(f => mesmoCnpj(f.cnpj, nf.cnpjFornecedor));
    const aberta = document.getElementById('screen-auditoria-nova').classList.contains('active') && document.getElementById('aud-pedido').value.trim() === pedido;
    if (!aberta) {
        abrirNovaAuditoria();
        document.getElementById('aud-pedido').value = pedido;
        buscarCotacaoParaAuditoria();
        if (fornecedor) document.getElementById('aud-fornecedor').value = nomeExibicaoFornecedor(fornecedor.razaoSocial, fornecedor.cnpj);
    }
    const campoNf = document.getElementById('aud-nf');
    campoNf.value = [...new Set([...campoNf.value.split(',').map(s => s.trim()).filter(Boolean), String(nf.nf), ...info.orig])].join(', ');
    const campos = { nfDuplicada: String(nf.nf), nfOriginal: info.orig.join(', '), pedido: String(pedido), desfecho: dupTextoDesfecho(nf.duplicidade), observacao: '' };
    const ja = divergenciasAuditoria.find(d => d.tipo === 'nf_duplicada' && d.campos && d.campos.nfDuplicada === campos.nfDuplicada);
    if (ja) { ja.campos = { ...ja.campos, ...campos, observacao: ja.campos.observacao || '' }; }
    else {
        divergenciasAuditoria.forEach(d => d.aberto = false);
        divergenciasAuditoria.push({ id: ++contadorDivergenciaId, tipo: 'nf_duplicada', aberto: true, materiais: [], observacao: '', campos });
    }
    renderDivergenciasAuditoria();
    switchToScreen('screen-auditoria-nova', 'Nova Auditoria');
    toast('Auditoria de NF duplicada preparada — confira e salve.');
}
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/53-nf-duplicada.js'] = '2.33.0';

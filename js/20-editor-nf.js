// 20-editor-nf.js — Editor da NF (2.0.7; 2.3.1: também abre NF que veio só do ERP)
// Parte do script do app (v2.0.7). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// --- 2.0.7: EDITOR DA NF ---
// ===================================================================
// Uma tela só para uma NF já processada: cabeçalho (fornecedor, nº, valor, vencimento, pedido, situação), itens editáveis
// (associação com a cotação, SP Data e fator de conversão) e as divergências SÓ dessa NF. Tudo é gravado nos mesmos
// registros que o resto do app lê (nfsProcessadas + memória de associações), então Histórico, Controle, Cotação e Central
// do pedido mostram o mesmo dado, esteja a NF recebida, na relação ou arquivada.
let nfEditorId = null;

function abrirEditorNf(nfId) {
    if (nfId !== nfEditorId) { nfEditorAbertos.clear(); nfEditorMostrarOutros = false; }
    const nf = listaNfsProcessadas.find(n => n.id === nfId);
    const erpSo = !nf ? listaEntradasErp.find(e => e.id === nfId) : null; // 2.3.1: NF que veio só do relatório do ERP (sem XML)
    if (!nf && !erpSo) return toast('NF não encontrada.');
    nfEditorId = nfId;
    const ativa = document.querySelector('.app-screen.active');
    const origem = ativa && ativa.id !== 'screen-nf-editor' ? ativa.id : (screenParentMap['screen-nf-editor'] || 'screen-controle-nfs');
    screenParentMap['screen-nf-editor'] = origem; closeBtnBackScreen['screen-nf-editor'] = origem; // o "voltar" leva de volta a quem abriu
    const tituloTela = nf ? tituloFornNf(nf.fornecedor || (nf.xmlDados && nf.xmlDados.emit && nf.xmlDados.emit.xNome), nf.cnpjFornecedor, nf.nf) : tituloFornNf(erpSo.fornecedorNomeRelatorio, erpSo.cnpjFornecedor, erpSo.nf);
    switchToScreen('screen-nf-editor', tituloTela || `NF ${nf ? nf.nf : erpSo.nf}`);
    renderEditorNf();
}
function renderEditorNfSeAtivo() {
    agendarRender('editorNf', () => {
        const tela = document.getElementById('screen-nf-editor');
        if (!(tela && tela.classList.contains('active') && nfEditorId)) return;
        // não redesenha enquanto a pessoa digita num campo do editor (senão o texto e a lista abertos somem)
        const ae = document.activeElement;
        if (ae && ae.tagName === 'INPUT' && ae.closest && ae.closest('#nf-editor-conteudo')) { renderEditorNfSeAtivo(); return; }
        renderEditorNf();
    }, 1200);
}

const ROTULO_STATUS_ERP = { pre_selecao: 'em pré-seleção', selecionada_financeiro: 'enviada à relação', arquivada: 'arquivada', historico_direto: 'histórico direto' };
const ROTULO_SITUACAO_NF = { recebida: 'Recebida (aguardando decisão)', na_relacao: 'Na relação de pagamento', em_espera: 'Em espera', arquivada: 'Arquivada', direta: 'Entrada direta' };


// ===================================================================
// --- 2.0.8: PEDIDO PROVÁVEL DA NF ---
// ===================================================================
// Cada NF pertence a UM pedido. Se ela foi vinculada ao pedido errado (ex.: cotação escolhida errada ao processar o XML),
// o app passa a "ver" divergências que não existem — as divergências fantasma. Aqui o app compara os itens da NF com a
// cotação de cada pedido e avisa quando a NF encaixa muito melhor em outro pedido; mover é um toque.
function codigosSmartComprasDaNf(nf, erp) {
    const dosItens = (nf.itens || []).map(i => i.codigoSmartCompras).filter(Boolean);
    const lista = dosItens.length ? dosItens : (erp ? (erp.itens || []).map(i => i.codigoSmartComprasRelacionado).filter(Boolean) : []);
    return [...new Set(lista.map(String))];
}
// null = sem evidência (poucos itens, sem pedido ou sem cotação do pedido atual) · senão { pedidoAtual, itensAtual, total, candidatos:[{pedido, itens, ganhos}] }
function analisarPedidoDaNf(nf, erp) {
    const codigos = codigosSmartComprasDaNf(nf, erp);
    if (codigos.length < 2 || !nf.pedido) return null; // um item só não prova nada
    const cnpj = normalizarCnpj(nf.cnpjFornecedor);
    const medir = c => {
        const cotados = new Set((c.itens || []).map(i => String(i.codProduto)));
        const ganhos = new Set((c.itens || []).filter(i => cnpj && normalizarCnpj(i.cnpjFornecedor) === cnpj).map(i => String(i.codProduto)));
        return { pedido: c.pedido, itens: codigos.filter(x => cotados.has(x)).length, ganhos: codigos.filter(x => ganhos.has(x)).length };
    };
    const todos = listaCotacoes.map(medir);
    const atual = todos.find(r => String(r.pedido) === String(nf.pedido));
    if (!atual || atual.itens / codigos.length >= 0.5) return null;
    const candidatos = todos.filter(r => String(r.pedido) !== String(nf.pedido) && r.itens / codigos.length >= 0.75)
        .sort((a, b) => b.itens - a.itens || b.ganhos - a.ganhos);
    if (!candidatos.length) return null;
    const melhor = candidatos[0];
    const empatados = candidatos.filter(c => c.itens === melhor.itens && c.ganhos === melhor.ganhos);
    return { pedidoAtual: nf.pedido, itensAtual: atual.itens, total: codigos.length, candidatos: empatados.length > 1 ? empatados : [melhor], ambiguo: empatados.length > 1 };
}
function textoPedidoProvavel(an) {
    const c = an.candidatos[0];
    return an.ambiguo
        ? `Esta NF parece não ser do pedido ${an.pedidoAtual} (só ${an.itensAtual} de ${an.total} itens estão na cotação dele). Pedidos que encaixam: ${an.candidatos.map(x => x.pedido).join(', ')}.`
        : `Esta NF parece ser do pedido ${c.pedido}: ${c.itens} de ${an.total} itens estão na cotação dele; no pedido ${an.pedidoAtual}, ao qual está vinculada, só ${an.itensAtual} de ${an.total}.`;
}
function nfComErpDoControle(nf) {
    const it = montarControleNfs().find(x => x.nf && x.nf.id === nf.id);
    return it ? it.erp : null;
}
function moverNfParaPedido(nfId, pedidoNovo) {
    const nf = listaNfsProcessadas.find(n => n.id === nfId);
    if (!nf || !pedidoNovo) return;
    if (String(nf.pedido) === String(pedidoNovo)) return toast('A NF já está nesse pedido.');
    if ((nf.pedidos || []).length > 1) return toast('Esta NF está em mais de um pedido; ajuste na Entrada de NF.');
    const erp = nfComErpDoControle(nf);
    showConfirmModal({
        title: 'Mover NF para outro pedido',
        message: `NF ${nf.nf} — ${nf.fornecedor || ''}\nPedido: ${nf.pedido || '(nenhum)'} → ${pedidoNovo}\n\nOs itens da NF${erp ? ' e a entrada do ERP' : ''} passam a ser comparados com a cotação do pedido ${pedidoNovo}. Auditorias já geradas para o pedido antigo não são alteradas.`,
        confirmText: 'Mover', confirmClass: 'warning',
        onConfirm: async () => {
            try {
                const atualizacao = { pedido: String(pedidoNovo) };
                if ((nf.pedidos || []).length === 1) atualizacao.pedidos = [String(pedidoNovo)];
                await nfsProcessadasCollection.doc(nfId).update(atualizacao);
                if (erp) await confirmarVinculoErpComPedido(erp.id, String(pedidoNovo));
                toast(`✓ NF ${nf.nf} movida para o pedido ${pedidoNovo}.`);
            } catch (err) { console.error('Erro ao mover NF de pedido:', err); toast('✕ Erro ao mover a NF.'); }
        }
    });
}
function trocarPedidoDaNfEditor(nfId) {
    const campo = document.getElementById('nfed-pedido'); if (!campo || !campo.value) return;
    moverNfParaPedido(nfId, campo.value);
}

function cotacoesDaNf(nf) {
    const pedidos = [...new Set([nf.pedido, ...(nf.pedidos || [])].filter(Boolean))];
    return pedidos.map(p => listaCotacoes.find(c => c.pedido === p)).filter(Boolean);
}
function nomeItemCotacao(ic) { return (ic.nomeOficial || ic.descricao || '').toString(); }

// ---------- 2.1.0: dados completos do XML (guardados junto da NF) ----------
function xmlTxtEl(el, tag) {
    if (!el) return '';
    const n = el.getElementsByTagName(tag)[0];
    return n ? String(n.textContent || '').trim() : '';
}
function extrairXmlCompletoParaSalvar() {
    if (!xmlDocAtual) return null;
    const d = xmlDocAtual;
    const q = tag => d.getElementsByTagName(tag)[0] || null;
    const ide = q('ide'), emit = q('emit'), dest = q('dest'), tot = q('ICMSTot'), transp = q('transp'), cobr = q('cobr'), infAdic = q('infAdic'), infNFe = q('infNFe');
    const endereco = el => ({ xLgr: xmlTxtEl(el, 'xLgr'), nro: xmlTxtEl(el, 'nro'), xBairro: xmlTxtEl(el, 'xBairro'), xMun: xmlTxtEl(el, 'xMun'), UF: xmlTxtEl(el, 'UF'), CEP: xmlTxtEl(el, 'CEP'), fone: xmlTxtEl(el, 'fone') });
    const itens = Array.from(d.getElementsByTagName('det')).map((det, idx) => {
        const prod = det.getElementsByTagName('prod')[0] || null;
        const imp = det.getElementsByTagName('imposto')[0] || null;
        const icms = imp ? imp.getElementsByTagName('ICMS')[0] : null;
        const icmsF = icms && icms.firstElementChild ? icms.firstElementChild : null;
        const ipi = imp ? imp.getElementsByTagName('IPI')[0] : null;
        const ipiF = ipi ? (ipi.getElementsByTagName('IPITrib')[0] || ipi.getElementsByTagName('IPINT')[0] || null) : null;
        const pis = imp ? imp.getElementsByTagName('PIS')[0] : null;
        const pisF = pis && pis.firstElementChild ? pis.firstElementChild : null;
        const cof = imp ? imp.getElementsByTagName('COFINS')[0] : null;
        const cofF = cof && cof.firstElementChild ? cof.firstElementChild : null;
        const rastros = Array.from(prod ? prod.getElementsByTagName('rastro') : []).map(r => ({ nLote: xmlTxtEl(r, 'nLote'), qLote: xmlTxtEl(r, 'qLote'), dFab: xmlTxtEl(r, 'dFab'), dVal: xmlTxtEl(r, 'dVal') }));
        return {
            nItem: det.getAttribute('nItem') || String(idx + 1),
            cProd: xmlTxtEl(prod, 'cProd'), cEAN: xmlTxtEl(prod, 'cEAN'), xProd: xmlTxtEl(prod, 'xProd'), NCM: xmlTxtEl(prod, 'NCM'), CEST: xmlTxtEl(prod, 'CEST'), CFOP: xmlTxtEl(prod, 'CFOP'),
            uCom: xmlTxtEl(prod, 'uCom'), qCom: xmlTxtEl(prod, 'qCom'), vUnCom: xmlTxtEl(prod, 'vUnCom'), vProd: xmlTxtEl(prod, 'vProd'), vDesc: xmlTxtEl(prod, 'vDesc'),
            cEANTrib: xmlTxtEl(prod, 'cEANTrib'), uTrib: xmlTxtEl(prod, 'uTrib'), qTrib: xmlTxtEl(prod, 'qTrib'), vUnTrib: xmlTxtEl(prod, 'vUnTrib'), xPed: xmlTxtEl(prod, 'xPed'),
            infAdProd: xmlTxtEl(det, 'infAdProd'),
            impostos: {
                ICMS: icmsF ? { origem: xmlTxtEl(icms, 'orig'), CST: xmlTxtEl(icms, 'CST') || xmlTxtEl(icms, 'CSOSN'), vBC: xmlTxtEl(icmsF, 'vBC'), pICMS: xmlTxtEl(icmsF, 'pICMS'), vICMS: xmlTxtEl(icmsF, 'vICMS') } : null,
                IPI: ipiF ? { CST: xmlTxtEl(ipiF, 'CST'), vBC: xmlTxtEl(ipiF, 'vBC'), pIPI: xmlTxtEl(ipiF, 'pIPI'), vIPI: xmlTxtEl(ipiF, 'vIPI') } : null,
                PIS: pisF ? { CST: xmlTxtEl(pisF, 'CST'), vBC: xmlTxtEl(pisF, 'vBC'), pPIS: xmlTxtEl(pisF, 'pPIS'), vPIS: xmlTxtEl(pisF, 'vPIS') } : null,
                COFINS: cofF ? { CST: xmlTxtEl(cofF, 'CST'), vBC: xmlTxtEl(cofF, 'vBC'), pCOFINS: xmlTxtEl(cofF, 'pCOFINS'), vCOFINS: xmlTxtEl(cofF, 'vCOFINS') } : null
            },
            rastros
        };
    });
    const xmlTexto = xmlTextoAtual ? String(xmlTextoAtual) : '';
    return {
        chave: infNFe ? String(infNFe.getAttribute('Id') || '').replace(/^NFe/, '') : '',
        natOp: xmlTxtEl(ide, 'natOp'), mod: xmlTxtEl(ide, 'mod'), tpNF: xmlTxtEl(ide, 'tpNF'), finNFe: xmlTxtEl(ide, 'finNFe'),
        dhEmi: xmlTxtEl(ide, 'dhEmi') || xmlTxtEl(ide, 'dEmi'), dhSaiEnt: xmlTxtEl(ide, 'dhSaiEnt') || xmlTxtEl(ide, 'dSaiEnt'),
        emit: { xNome: xmlTxtEl(emit, 'xNome'), xFant: xmlTxtEl(emit, 'xFant'), CNPJ: xmlTxtEl(emit, 'CNPJ'), IE: xmlTxtEl(emit, 'IE'), ...endereco(emit) },
        dest: { xNome: xmlTxtEl(dest, 'xNome'), CNPJ: xmlTxtEl(dest, 'CNPJ') || xmlTxtEl(dest, 'CPF'), IE: xmlTxtEl(dest, 'IE'), ...endereco(dest) },
        totais: {
            vBC: xmlTxtEl(tot, 'vBC'), vICMS: xmlTxtEl(tot, 'vICMS'), vBCST: xmlTxtEl(tot, 'vBCST'), vST: xmlTxtEl(tot, 'vST'), vProd: xmlTxtEl(tot, 'vProd'),
            vFrete: xmlTxtEl(tot, 'vFrete'), vSeg: xmlTxtEl(tot, 'vSeg'), vDesc: xmlTxtEl(tot, 'vDesc'), vII: xmlTxtEl(tot, 'vII'), vIPI: xmlTxtEl(tot, 'vIPI'),
            vPIS: xmlTxtEl(tot, 'vPIS'), vCOFINS: xmlTxtEl(tot, 'vCOFINS'), vOutro: xmlTxtEl(tot, 'vOutro'), vNF: xmlTxtEl(tot, 'vNF'), vTotTrib: xmlTxtEl(tot, 'vTotTrib')
        },
        transp: { modFrete: xmlTxtEl(transp, 'modFrete'), xNome: xmlTxtEl(transp, 'xNome'), CNPJ: xmlTxtEl(transp, 'CNPJ'), placa: xmlTxtEl(transp, 'placa'), qVol: xmlTxtEl(transp, 'qVol'), esp: xmlTxtEl(transp, 'esp'), pesoB: xmlTxtEl(transp, 'pesoB'), pesoL: xmlTxtEl(transp, 'pesoL') },
        cobranca: {
            nFat: xmlTxtEl(cobr, 'nFat'), vOrig: xmlTxtEl(cobr, 'vOrig'), vLiq: xmlTxtEl(cobr, 'vLiq'),
            duplicatas: Array.from(d.getElementsByTagName('dup')).map(x => ({ nDup: xmlTxtEl(x, 'nDup'), dVenc: xmlTxtEl(x, 'dVenc'), vDup: xmlTxtEl(x, 'vDup') }))
        },
        pagamentos: Array.from(d.getElementsByTagName('detPag')).map(x => ({ tPag: xmlTxtEl(x, 'tPag'), vPag: xmlTxtEl(x, 'vPag') })),
        infCpl: xmlTxtEl(infAdic, 'infCpl'), infAdFisco: xmlTxtEl(infAdic, 'infAdFisco'),
        itens,
        xmlOriginal: xmlTexto.length <= 500000 ? xmlTexto : ''
    };
}

// ---------- editor em abas (mesmo padrão da Entrada de NF) ----------
let nfEditorAba = 'itens';
let nfEditorMostrarOutros = false; // por padrão, só os itens que ESTE fornecedor ganhou na cotação
function alternarOutrosFornecedoresEditorNf() { nfEditorMostrarOutros = !nfEditorMostrarOutros; renderEditorNf(); }
const nfEditorAbertos = new Set(); // itens com a edição aberta (sobrevive aos redesenhos)
function toggleEdicaoItemNf(idx) {
    const linha = document.getElementById('nfed-edit-' + idx); if (!linha) return;
    const abrir = linha.style.display === 'none';
    linha.style.display = abrir ? '' : 'none';
    if (abrir) nfEditorAbertos.add(idx); else nfEditorAbertos.delete(idx);
}
function setAbaEditorNf(aba) {
    nfEditorAba = aba;
    document.querySelectorAll('#nf-editor-conteudo .xml-aba-pane').forEach(p => p.classList.toggle('ativa', p.dataset.aba === aba));
    document.querySelectorAll('#nf-editor-conteudo .xml-abas .xml-filtro-btn').forEach(b => b.classList.toggle('active', b.dataset.aba === aba));
}
function fmtMoedaXml(v) {
    const t = String(v == null ? '' : v).trim(); if (!t) return '—';
    const n = Number(t.replace(',', '.')); return Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : t;
}
function fmtNumXml(v, casas) {
    const t = String(v == null ? '' : v).trim(); if (!t) return '—';
    const n = Number(t.replace(',', '.')); return Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: casas || 4 }) : t;
}
function fmtDataXml(v) {
    const s = String(v || ''); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '—');
}
function xmlItemDe(nf, it, idx) {
    const lista = (nf.xmlDados && nf.xmlDados.itens) || [];
    if (!lista.length) return null;
    if (it.nItem) { const x = lista.find(y => String(y.nItem) === String(it.nItem)); if (x) return x; }
    return lista.find(y => y.cProd === it.cProd && y.xProd === it.xProd) || lista.find(y => y.cProd === it.cProd) || lista[idx] || null;
}
function linhaXml(rotulo, valor) { return `<div class="xml-item-meta"><span class="txt-aux">${escRel(rotulo)}:</span> ${escRel(valor || '—')}</div>`; }
function blocoEndereco(p) {
    if (!p) return '';
    const end = [p.xLgr, p.nro].filter(Boolean).join(', ') + (p.xBairro ? ' - ' + p.xBairro : '');
    const cid = [p.xMun, p.UF].filter(Boolean).join('/') + (p.CEP ? ' · CEP ' + p.CEP : '');
    return [end, cid, p.fone ? 'Fone ' + p.fone : ''].filter(Boolean).map(x => `<div class="xml-item-meta">${escRel(x)}</div>`).join('');
}
const MODFRETE_XML = { '0': 'Por conta do emitente', '1': 'Por conta do destinatário', '2': 'Por conta de terceiros', '3': 'Próprio por conta do remetente', '4': 'Próprio por conta do destinatário', '9': 'Sem frete' };

function renderEditorNf() {
    const el = document.getElementById('nf-editor-conteudo'); if (!el) return;
    const nf = listaNfsProcessadas.find(n => n.id === nfEditorId);
    if (!nf) { const erpSo = listaEntradasErp.find(e => e.id === nfEditorId); if (erpSo) return renderEditorNfErp(erpSo, el); }
    if (!nf) { el.innerHTML = '<div class="card"><p class="desc-tela">Esta NF não existe mais.</p></div>'; return; }
    const xd = nf.xmlDados || null;
    const ctrl = montarControleNfs().find(it => it.nf && it.nf.id === nf.id) || {};
    const erp = ctrl.erp || null;
    const cotacoes = cotacoesDaNf(nf);
    const badge = (cls, txt) => `<span class="xml-item-badge ${cls}">${txt}</span>`;
    const badgeErp = erp ? badge(erp.statusFluxo === 'pre_selecao' ? 'pendente' : 'pronto', 'ERP: ' + escRel(ROTULO_STATUS_ERP[erp.statusFluxo] || erp.statusFluxo || 'importada')) : badge('neutro', 'ERP: não importada');
    const situacaoTxt = ROTULO_SITUACAO_NF[ctrl.situacao] || '—';
    const fornecedorNome = ctrl.nomeFornecedor || nf.fornecedor || (xd && xd.emit && xd.emit.xNome) || '';
    const cnpjFor = nf.cnpjFornecedor || (xd && xd.emit && xd.emit.CNPJ) || '';
    const vencPrim = (xd && xd.cobranca && xd.cobranca.duplicatas[0] && xd.cobranca.duplicatas[0].dVenc) || (nf.vencimentos && nf.vencimentos[0]) || '';
    const pedidosBotoes = [...new Set([nf.pedido, ...(nf.pedidos || [])].filter(Boolean))]
        .map(p => `<button type="button" class="central-status-toggle" onclick="abrirCentralPedido('${escRel(p)}')">Abrir pedido ${escRel(p)}</button>`).join(' ');

    // ---- pedido provável + troca de pedido ----
    const analise = analisarPedidoDaNf(nf, erp);
    const alertaPedido = analise ? `<div class="card nfe-alerta">
        <div class="nfe-alerta-tit">⚠ Pedido possivelmente errado</div>
        <div class="nfe-alerta-txt">${escRel(textoPedidoProvavel(analise))}</div>
        <div class="nfe-acoes">${analise.candidatos.map(c => `<button type="button" class="central-status-toggle" onclick="moverNfParaPedido('${nf.id}', '${escRel(c.pedido)}')">Mover para o pedido ${escRel(c.pedido)}</button>`).join(' ')}</div>
    </div>` : '';
    const pedidosDisponiveis = listaCotacoes.map(c => String(c.pedido)).sort((x, y) => y.localeCompare(x, undefined, { numeric: true }));
    const opcoesPedido = pedidosDisponiveis.filter(p => String(p) !== String(nf.pedido))
        .map(p => { const c = listaCotacoes.find(x => String(x.pedido) === p); return { valor: p, titulo: `Pedido ${p}`, sub: c ? `${(c.itens || []).length} itens cotados` : '' }; });
    const trocaPedido = opcoesPedido.length ? `<div class="nfe-trocar"><span class="nfe-rot">Mover esta NF para outro pedido</span>
        ${htmlSeletorBusca('nfed-pedido', { placeholder: 'Buscar pedido…', opcoes: opcoesPedido, aoEscolher: valor => moverNfParaPedido(nf.id, valor) })}</div>` : '';

    // ---- cabeçalho ----
    const valorTopo = fmtMoedaXml(xd ? xd.totais.vNF : (nf.valorTotal || ctrl.valorTxt));
    const cabecalho = `<div class="card nfe-topo">
        <div class="nfe-topo-linha">
            <div class="nfe-id">
                <div class="nfe-titulo">${escRel(tituloFornNf(fornecedorNome, cnpjFor, nf.nf))}</div>
                <div class="nfe-sub">NF ${escRel(nf.nf)}${nf.serie ? ' · série ' + escRel(nf.serie) : ''}${cnpjFor ? ' · CNPJ ' + escRel(cnpjFor) : ''}</div>
                ${(nomeExibicaoFornecedor(fornecedorNome, cnpjFor) || fornecedorNome) !== fornecedorNome ? `<div class="nfe-forn">${escRel(fornecedorNome)}</div>` : ''}
            </div>
            <div class="nfe-valor"><span class="nfe-rot">Valor total</span><strong>R$ ${escRel(valorTopo)}</strong></div>
        </div>
        <div class="nfe-grade">
            <div><span class="nfe-rot">Emissão</span><strong>${escRel(fmtDataXml(nf.emissao || (xd && xd.dhEmi)))}</strong></div>
            <div><span class="nfe-rot">1º vencimento</span><strong>${escRel(fmtDataXml(vencPrim))}</strong></div>
            <div><span class="nfe-rot">Pedido</span><strong>${escRel(nf.pedido || '—')}</strong></div>
        </div>
        <div class="nfe-chips">${badge('pronto', 'XML ✓')} ${badgeErp} ${badge('neutro', escRel(situacaoTxt))}${xd ? '' : ' ' + badge('pendente', 'XML completo não guardado')}</div>
        <div class="nfe-acoes">${pedidosBotoes || ''} <button type="button" class="central-status-toggle" onclick="abrirNfNoHistorico('${escRel(nf.serie ? nf.nf + '_' + nf.serie : String(nf.nf))}', '${escRel(nf.nf)}')">Ver no Controle de NFs</button> <button type="button" class="central-status-toggle" onclick="cadastrarEquipamentoDaNf('${escRel(nf.id)}')">Cadastrar equipamento desta NF</button></div>
        ${trocaPedido}
    </div>`;

    // ---- abas ----
    const abas = [['itens', 'Itens'], ['fin', 'Financeiro'], ['fiscal', 'Fiscal'], ['partes', 'Emitente/Dest.'], ['transp', 'Transporte'], ['xml', 'XML']];
    const tabs = `<div class="xml-filtro-toggle xml-abas">${abas.map(([k, l]) => `<button type="button" class="xml-filtro-btn ${k === nfEditorAba ? 'active' : ''}" data-aba="${k}" onclick="setAbaEditorNf('${k}')">${l}</button>`).join('')}</div>`;
    const semXml = `<div class="card"><div class="xml-item-meta">Esta NF foi processada antes da versão 2.1.0, então o XML completo não ficou guardado. Reprocesse o XML na Entrada de NF para preencher esta aba. Itens, pedido, fator e associações já funcionam.</div></div>`;
    const pane = (k, html) => `<div class="xml-aba-pane ${k === nfEditorAba ? 'ativa' : ''}" data-aba="${k}">${html}</div>`;

    // ---- Itens ----
    let divergHTML = '';
    cotacoes.forEach(c => {
        const itens = compararFontesPedido(c.pedido, { nfIds: [nf.id] }).filter(i => i.temNf && i.divergencias.some(d => d.tipo !== 'nao_faturado'));
        itens.forEach(i => {
            divergHTML += `<div class="xml-item-linha pendente"><div class="xml-produto-nome">${escRel(i.nome)}</div><div class="xml-item-cotacao">${i.divergencias.filter(d => d.tipo !== 'nao_faturado').map(d => '• ' + textoDivergenciaNatural(d)).join('<br>')}</div></div>`;
        });
    });
    const divergencias = `<div class="card"><div class="xml-item-meta"><strong>Divergências desta NF</strong></div>${divergHTML || '<div class="xml-item-meta">✓ Nenhuma divergência (cotação × NF × ERP) nos itens desta NF.</div>'}</div>`;
    const itensCotacao = cotacoes.flatMap(c => (c.itens || []).map(ic => ({ ...ic, _pedido: c.pedido })));
    const todosCot = itensCotacao;
    // 2.1.3: só os itens que ESTE fornecedor ganhou (inclui CNPJs do mesmo fornecedor no SP Data); sem cair em "todos" quando ele
    // não ganhou nada — nesse caso aparece o aviso e o botão para mostrar os de outros fornecedores.
    const valForn = validarFornecedorSpData(nf.cnpjFornecedor);
    const cnpjsForn = valForn && valForn.encontrado ? [normalizarCnpj(nf.cnpjFornecedor), ...(valForn.cnpjsRelacionados || [])] : [normalizarCnpj(nf.cnpjFornecedor)];
    const doForn = todosCot.filter(ic => cnpjEmLista(cnpjsForn, ic.cnpjFornecedor) || mesmaRaizCnpj(nf.cnpjFornecedor, ic.cnpjFornecedor));
    const vistos = new Set();
    const cotDoForn = (nfEditorMostrarOutros ? todosCot : doForn).filter(ic => { const k = ic._pedido + '|' + ic.codProduto; if (vistos.has(k)) return false; vistos.add(k); return true; });
    const fornGanhouTudo = doForn.length >= todosCot.length;
    const fmtUnitXml = v => { const t = String(v == null ? '' : v).trim(); const n = Number(t.replace(',', '.')); return (t && Number.isFinite(n)) ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'; };
    const linhas = (nf.itens || []).map((it, idx) => {
        const fator = Number(it.fatorAplicado) || 1;
        const qtdXml = numeroLimpo(Number(it.quantidade) / fator);
        const ic = todosCot.find(x => x.codProduto === it.codigoSmartCompras) || null;
        const produto = it.codigoSpData ? listaProdutosSpData.find(p => p.codigo === it.codigoSpData) : null;
        const itemErp = erp ? (erp.itens || []).find(x => it.codigoSpData && x.codigoSpData === it.codigoSpData) : null;
        const xi = xmlItemDe(nf, it, idx);
        const rast = xi && xi.rastros && xi.rastros[0] ? xi.rastros[0] : null;
        const lote = it.lote || (rast && rast.nLote) || '';
        const validade = it.validade || (rast && rast.dVal) || '';
        const fab = rast && rast.dFab ? rast.dFab : '';
        const descLinhas = [
            lote || validade ? `Lote ${escRel(lote || '—')} · Val ${escRel(fmtDataXml(validade))}${fab ? ' · Fab ' + escRel(fmtDataXml(fab)) : ''}` : 'Lote/validade não informados',
        ];
        let erpTxt = '';
        if (erp) {
            if (!itemErp) erpTxt = `<span class="xml-item-badge neutro">ERP: item não encontrado</span>`;
            else {
                const qOk = Number(itemErp.quantidade) === Number(it.quantidade);
                const vOk = Math.abs(Number(itemErp.valorUnitario) - Number(it.valorUnitario)) < 0.01;
                erpTxt = `<span class="xml-item-badge ${qOk && vOk ? 'pronto' : 'pendente'}">${qOk && vOk ? '✓' : '⚠'} ERP: qtd ${itemErp.quantidade} · unit. ${itemErp.valorUnitario}</span>`;
            }
        }
        const opcoesCot = (ic && !cotDoForn.includes(ic) ? [ic, ...cotDoForn] : cotDoForn).map(x => `<option value="${escRel(x.codProduto)}" ${x.codProduto === it.codigoSmartCompras ? 'selected' : ''}>${escRel(x.codProduto)} — ${escRel(nomeItemCotacao(x)).slice(0, 70)}</option>`).join('');
        const propostas = propostasCorrecaoConversao({ pedido: nf.pedido, cotacao: cotacoes[0] || null }, it)
            .map(p => `<button type="button" class="central-status-toggle" onclick="corrigirConversaoNfItem('${nf.id}', ${idx}, ${p.fator})">${escRel(p.rotulo)}</button>`).join(' ');
        // Valores como na NF (XML). Sem XML completo, usa o que foi salvo (já convertido pelo fator).
        const uCom = xi ? xi.uCom : '—';
        const qNf = xi ? xi.qCom : qtdXml;
        const vUnNf = xi ? xi.vUnCom : (Number(it.valorUnitario) * fator);
        const vTotNf = xi ? xi.vProd : (Number(it.valorUnitario) * fator * Number(qNf));
        const codigoNf = xi ? xi.cProd : it.cProd;
        const ncm = xi ? xi.NCM : '';
        const cfop = xi ? xi.CFOP : '';
        const descricao = xi ? xi.xProd : it.xProd;
        const conversao = fator !== 1 ? `<div class="nf-sub">Entrada no estoque: ${qdtFmt(it.quantidade)} un. (fator ${fator})</div>` : '';
        const linhaPrincipal = `<tr class="nf-linha" onclick="toggleEdicaoItemNf(${idx})">
            <td>${escRel(codigoNf)}</td>
            <td><div class="nf-desc">${escRel(descricao)}</div><div class="nf-sub">${descLinhas.join('')}</div>${conversao}${erpTxt ? `<div class="nf-sub">${erpTxt}</div>` : ''}</td>
            <td class="num">${escRel(ncm || '—')}</td>
            <td class="num">${escRel(cfop || '—')}</td>
            <td class="num">${escRel(uCom || '—')}</td>
            <td class="num">${escRel(fmtNumXml(qNf, 4))}</td>
            <td class="num">${escRel(fmtUnitXml(vUnNf))}</td>
            <td class="num"><strong>${escRel(fmtMoedaXml(vTotNf))}</strong></td>
        </tr>`;
        const nomeIc = ic ? nomeItemCotacao(ic) : '';
        const baseAssoc = ic && !cotDoForn.includes(ic) ? [ic, ...cotDoForn] : cotDoForn;
        const paraOpcao = x => ({
            valor: x.codProduto,
            titulo: `${x.codProduto} — ${nomeItemCotacao(x)}`,
            sub: [x.embalagem, x.quantidade ? 'Qtd ' + x.quantidade : '', 'pedido ' + x._pedido].filter(Boolean).join(' · ')
        });
        const opcoesAssoc = baseAssoc.map(paraOpcao);
        // sugestão pelo nome do item do XML (mesma regra usada na Entrada de NF e no SP Data)
        const nomeXmlItem = (xi && xi.xProd) || it.xProd || '';
        const sugRes = nomeXmlItem ? sugestoesItemCotacao(nomeXmlItem, baseAssoc) : { itens: [], aproximado: false };
        const sugeridos = sugRes.itens;
        const sugestaoRapida = !ic && !sugRes.aproximado && sugeridos.length > 0 && sugeridos.length <= 4
            ? `<div class="nfe-dica" style="margin:0 0 6px">Sugestão pelo nome do item:</div><div class="nfe-acoes" style="margin:0 0 8px">${sugeridos.map(x => `<button type="button" class="central-status-toggle" onclick="trocarSmartComprasNfItem('${nf.id}', ${idx}, '${escRel(x.codProduto)}')">Usar: ${escRel(x.codProduto)} — ${escRel(nomeItemCotacao(x)).slice(0, 48)}</button>`).join(' ')}</div>` : '';
        const botaoOutros = todosCot.length && !fornGanhouTudo
            ? `<button type="button" class="nfe-link" onclick="alternarOutrosFornecedoresEditorNf()">${nfEditorMostrarOutros ? 'Mostrar só os itens ganhos por este fornecedor' : 'Mostrar itens de outros fornecedores'}</button>` : '';
        const avisoSemItens = todosCot.length && !cotDoForn.length && !nfEditorMostrarOutros
            ? '<div class="nfe-dica" style="margin:0 0 6px">Este fornecedor não ganhou nenhum item neste pedido.</div>' : '';
        const seletorAssoc = baseAssoc.length || todosCot.length
            ? sugestaoRapida + avisoSemItens + (opcoesAssoc.length ? htmlSeletorBusca(`nfed-cot-${idx}`, { placeholder: 'Buscar item da cotação por código ou nome…', opcoes: opcoesAssoc, valorAtual: it.codigoSmartCompras, sugestoes: () => sugeridos.map(x => ({ ...paraOpcao(x), grupo: sugRes.aproximado ? 'Parecidos pelo nome — confira' : undefined })), aoEscolher: valor => trocarSmartComprasNfItem(nf.id, idx, valor) }) : '') + botaoOutros
            : '<div class="nfe-dica">Sem cotação cadastrada para o pedido desta NF.</div>';
        const seletorSp = htmlSeletorBusca(`nfed-sp-${idx}`, {
            placeholder: 'Buscar produto SP Data por nome ou código…', valorAtual: it.codigoSpData, minimo: 2,
            fonte: texto => buscarSugestoesSpData(texto).map(p => ({ valor: p.codigo, titulo: `${p.codigo} — ${p.nome}`, sub: p.unidade ? 'un. ' + p.unidade : '' })),
            vazio: 'Nenhum produto encontrado. Tente outro trecho do nome ou o código.',
            sugestoes: () => it.xProd ? buscarSugestoesSpData(it.xProd).slice(0, 8).map(p => ({ valor: p.codigo, titulo: `${p.codigo} — ${p.nome}`, sub: 'sugestão pelo nome do item' })) : [],
            aoEscolher: valor => definirSpDataNfItem(nf.id, idx, valor)
        });
        const linhaEdicao = `<tr id="nfed-edit-${idx}" class="nf-edit" style="display:${nfEditorAbertos.has(idx) ? '' : 'none'}"><td colspan="8">
            <div class="nfe-sec">
                <div class="nfe-sec-tit">Item da cotação ${ic ? '' : badge('pendente', 'sem associação')}</div>
                <div class="nfe-atual ${ic ? '' : 'falta'}">${ic ? `${escRel(it.codigoSmartCompras)} — ${escRel(nomeIc)}<small>pedido ${escRel(ic._pedido)}</small>` : (it.codigoSmartCompras ? `SmartCompras ${escRel(it.codigoSmartCompras)} <small>não está na cotação do pedido</small>` : 'Nenhum item da cotação associado')}</div>
                ${seletorAssoc}
            </div>
            <div class="nfe-sec">
                <div class="nfe-sec-tit">Produto SP Data ${it.codigoSpData ? '' : badge('pendente', 'sem SP Data')}</div>
                <div class="nfe-atual ${it.codigoSpData ? '' : 'falta'}">${it.codigoSpData ? `${escRel(it.codigoSpData)} — ${escRel(produto ? produto.nome : '(produto não encontrado)')}` : 'Nenhum produto SP Data associado'}</div>
                ${seletorSp}
            </div>
            <div class="nfe-sec">
                <div class="nfe-sec-tit">Fator de conversão</div>
                ${propostas ? `<div class="nfe-acoes" style="margin:0 0 8px">${propostas}</div>` : ''}
                <div class="nfe-fator-linha">
                    <div class="nfe-fator-campo"><span>×</span><input type="text" inputmode="decimal" id="nfed-fator-${idx}" value="${fator}"></div>
                    <button type="button" class="nfe-btn" onclick="aplicarFatorManualNfItem('${nf.id}', ${idx}, 'nfed-fator-${idx}')">Aplicar fator</button>
                </div>
                <div class="nfe-dica">XML ${qdtFmt(qtdXml)} × fator ${fator} = ${qdtFmt(it.quantidade)} un. no estoque.</div>
            </div>
        </td></tr>`;
        return linhaPrincipal + linhaEdicao;
    });
    const totalXml = xd ? xd.itens.reduce((s, x) => s + (Number(String(x.vProd).replace(',', '.')) || 0), 0) : null;
    const rodape = xd ? `<tr class="nf-total"><td colspan="7" class="num">Total dos produtos (XML)</td><td class="num"><strong>${escRel(fmtMoedaXml(totalXml))}</strong></td></tr>` : '';
    const itensHTML = `<div class="nf-danfe-wrap"><table class="nf-danfe">
        <thead><tr><th>Código</th><th>Descrição</th><th class="num">NCM</th><th class="num">CFOP</th><th class="num">UN</th><th class="num">Quant.</th><th class="num">Vl. unit.</th><th class="num">Vl. total</th></tr></thead>
        <tbody>${linhas.join('')}${rodape}</tbody></table></div>
        <div class="xml-item-meta" style="margin:6px 4px">Toque em um item para associar, trocar o SP Data ou aplicar o fator.</div>`;
    const itensPaneXml = itensHTML;
    const paneItens = divergencias + `<div class="xml-item-meta" style="margin:12px 4px 4px"><strong>Itens da NF (${(nf.itens || []).length})</strong></div>` + itensPaneXml;

    // ---- Financeiro ----
    const nota = ctrl.nota, legado = ctrl.notaLegado;
    const linhasPag = [];
    if (nota) linhasPag.push(`Nota ${nota.emEspera ? 'em espera' : 'na relação'}: valor ${escRel(nota.valor || '—')} · vencimento ${escRel(nota.vencimento || '—')}${nota.obs ? ' · ' + escRel(nota.obs) : ''}`);
    if (legado) linhasPag.push(`Nota arquivada em ${escRel(legado.dataHistorico || '—')}: valor ${escRel(legado.valor || '—')} · vencimento ${escRel(legado.vencimento || '—')}${legado.obs ? ' · ' + escRel(legado.obs) : ''}`);
    if (erp) linhasPag.push(`ERP: lançada em ${escRel(erp.data || '—')}${erp.vencimento ? ' · vencimento ' + escRel(erp.vencimento) : ''}${erp.financeiro && erp.financeiro.totalNota ? ' · total ' + escRel(formatarValorMonetarioBR(erp.financeiro.totalNota)) : ''}`);
    const pagHTML = linhasPag.length ? `<div class="card" data-alvo="erp"><div class="xml-item-meta"><strong>Pagamento e ERP</strong></div>${linhasPag.map(l => `<div class="xml-item-meta">${l}</div>`).join('')}</div>` : '';
    const paneFin = !xd ? semXml : `
        <div class="card"><div class="xml-item-meta"><strong>Duplicatas (cobrança)</strong>${xd.cobranca.nFat ? ' · fatura ' + escRel(xd.cobranca.nFat) : ''}</div>
            ${xd.cobranca.duplicatas.length ? xd.cobranca.duplicatas.map(dp => `<div class="xml-item-meta">Parcela ${escRel(dp.nDup || '—')} · vence <strong>${escRel(fmtDataXml(dp.dVenc))}</strong> · ${escRel(fmtMoedaXml(dp.vDup))}</div>`).join('') : '<div class="xml-item-meta">Sem duplicatas no XML.</div>'}
            ${xd.cobranca.vOrig ? `<div class="xml-item-meta">Original ${escRel(fmtMoedaXml(xd.cobranca.vOrig))} · líquido ${escRel(fmtMoedaXml(xd.cobranca.vLiq))}</div>` : ''}
        </div>
        <div class="card"><div class="xml-item-meta"><strong>Pagamento informado no XML</strong></div>
            ${xd.pagamentos.length ? xd.pagamentos.map(pg => `<div class="xml-item-meta">Forma ${escRel(pg.tPag || '—')} · ${escRel(fmtMoedaXml(pg.vPag))}</div>`).join('') : '<div class="xml-item-meta">Não informado.</div>'}
        </div>
        <div class="card"><div class="xml-item-meta"><strong>Totais da nota</strong></div>
            ${linhaXml('Produtos', fmtMoedaXml(xd.totais.vProd))}${linhaXml('Desconto', fmtMoedaXml(xd.totais.vDesc))}${linhaXml('Frete', fmtMoedaXml(xd.totais.vFrete))}${linhaXml('Seguro', fmtMoedaXml(xd.totais.vSeg))}${linhaXml('Outras despesas', fmtMoedaXml(xd.totais.vOutro))}
            <div class="xml-item-meta"><strong>Total da NF: ${escRel(fmtMoedaXml(xd.totais.vNF))}</strong></div>
        </div>
        ${pagHTML}`;

    // ---- Fiscal ----
    const paneFiscal = !xd ? semXml : `
        <div class="card"><div class="xml-item-meta"><strong>Tributos da nota</strong></div>
            ${linhaXml('Base ICMS', fmtMoedaXml(xd.totais.vBC))}${linhaXml('ICMS', fmtMoedaXml(xd.totais.vICMS))}${linhaXml('ICMS-ST (base / valor)', fmtMoedaXml(xd.totais.vBCST) + ' / ' + fmtMoedaXml(xd.totais.vST))}
            ${linhaXml('IPI', fmtMoedaXml(xd.totais.vIPI))}${linhaXml('PIS', fmtMoedaXml(xd.totais.vPIS))}${linhaXml('COFINS', fmtMoedaXml(xd.totais.vCOFINS))}${linhaXml('II (importação)', fmtMoedaXml(xd.totais.vII))}
            ${linhaXml('Aprox. tributos (vTotTrib)', fmtMoedaXml(xd.totais.vTotTrib))}
        </div>
        ${xd.itens.map(x => `<div class="card">
            <div class="xml-produto-nome">${escRel(x.xProd)}</div>
            <div class="xml-item-meta">Item ${escRel(x.nItem)} · NCM ${escRel(x.NCM || '—')}${x.CEST ? ' · CEST ' + escRel(x.CEST) : ''} · CFOP ${escRel(x.CFOP || '—')}</div>
            ${(x.impostos||{}).ICMS ? linhaXml('ICMS', `CST/CSOSN ${(x.impostos||{}).ICMS.CST || '—'} · base ${fmtMoedaXml((x.impostos||{}).ICMS.vBC)} · ${fmtNumXml((x.impostos||{}).ICMS.pICMS, 2)}% = ${fmtMoedaXml((x.impostos||{}).ICMS.vICMS)}`) : ''}
            ${(x.impostos||{}).IPI ? linhaXml('IPI', `CST ${(x.impostos||{}).IPI.CST || '—'} · ${fmtNumXml((x.impostos||{}).IPI.pIPI, 2)}% = ${fmtMoedaXml((x.impostos||{}).IPI.vIPI)}`) : ''}
            ${(x.impostos||{}).PIS ? linhaXml('PIS', `CST ${(x.impostos||{}).PIS.CST || '—'} · ${fmtNumXml((x.impostos||{}).PIS.pPIS, 2)}% = ${fmtMoedaXml((x.impostos||{}).PIS.vPIS)}`) : ''}
            ${(x.impostos||{}).COFINS ? linhaXml('COFINS', `CST ${(x.impostos||{}).COFINS.CST || '—'} · ${fmtNumXml((x.impostos||{}).COFINS.pCOFINS, 2)}% = ${fmtMoedaXml((x.impostos||{}).COFINS.vCOFINS)}`) : ''}
        </div>`).join('')}`;

    // ---- Partes ----
    const panePartes = !xd ? semXml : `
        <div class="card"><div class="xml-produto-nome">Emitente</div>
            <div class="xml-item-meta"><strong>${escRel(xd.emit.xNome)}</strong>${xd.emit.xFant ? ' · ' + escRel(xd.emit.xFant) : ''}</div>
            ${linhaXml('CNPJ', xd.emit.CNPJ)}${linhaXml('IE', xd.emit.IE)}${blocoEndereco(xd.emit)}
        </div>
        <div class="card"><div class="xml-produto-nome">Destinatário</div>
            <div class="xml-item-meta"><strong>${escRel(xd.dest.xNome)}</strong></div>
            ${linhaXml('CNPJ/CPF', xd.dest.CNPJ)}${linhaXml('IE', xd.dest.IE)}${blocoEndereco(xd.dest)}
        </div>`;

    // ---- Transporte ----
    const paneTransp = !xd ? semXml : `
        <div class="card"><div class="xml-produto-nome">Transporte</div>
            ${linhaXml('Modalidade do frete', MODFRETE_XML[xd.transp.modFrete] || xd.transp.modFrete)}
            ${linhaXml('Transportadora', xd.transp.xNome)}${linhaXml('CNPJ', xd.transp.CNPJ)}${linhaXml('Placa', xd.transp.placa)}
            ${linhaXml('Volumes', [xd.transp.qVol, xd.transp.esp].filter(Boolean).join(' ') || '')}
            ${linhaXml('Peso bruto / líquido (kg)', [xd.transp.pesoB, xd.transp.pesoL].filter(Boolean).join(' / ') || '')}
        </div>`;

    // ---- XML ----
    const paneXml = !xd ? semXml : `
        <div class="card"><div class="xml-produto-nome">Identificação</div>
            ${linhaXml('Chave de acesso', xd.chave)}${linhaXml('Natureza da operação', xd.natOp)}${linhaXml('Modelo', xd.mod)}
            ${linhaXml('Tipo', xd.tpNF === '1' ? 'Saída' : xd.tpNF === '0' ? 'Entrada' : xd.tpNF)}${linhaXml('Finalidade', xd.finNFe)}
            ${linhaXml('Emissão', xd.dhEmi)}${linhaXml('Saída/entrada', xd.dhSaiEnt)}
        </div>
        <div class="card"><div class="xml-produto-nome">Informações complementares</div>
            <div class="xml-item-meta">${escRel(xd.infCpl || '—')}</div>
            ${xd.infAdFisco ? `<div class="xml-item-meta"><strong>Fisco:</strong> ${escRel(xd.infAdFisco)}</div>` : ''}
        </div>
        <div class="card"><details><summary class="xml-item-meta"><strong>XML original</strong> (${xd.xmlOriginal ? Math.round(xd.xmlOriginal.length / 1024) + ' KB' : 'não guardado (arquivo grande)'})</summary>
            <pre style="white-space:pre-wrap;word-break:break-all;font-size:11px;max-height:320px;overflow:auto">${escRel(xd.xmlOriginal || '')}</pre>
        </details></div>`;

    // 2.3.0: itens fora do pedido desta NF e NF sem pedido
    const foraNf = nf.pedido ? itensForaDoPedido(nf.pedido).filter(x => x.nfId === nf.id) : [];
    const alertaFora = foraNf.length ? `<div class="card nfe-alerta"><div class="nfe-alerta-tit">⚠ ${foraNf.length} item(ns) fora do pedido ${escRel(nf.pedido)}</div>
        ${foraNf.map(x => `<div class="nfe-alerta-txt" style="margin-top:8px"><strong>${escRel(x.nome)}</strong> — ${x.tipo === 'fora_cotacao' ? 'não está na cotação deste pedido' : 'na cotação foi ganho por ' + escRel(x.ganhador)}</div>`).join('')}
        <div class="nfe-dica" style="margin-top:8px">Se a NF for de outro pedido, mova-a em "Mover esta NF para outro pedido".</div></div>` : '';
    el.innerHTML = htmlNfSemPedido(nf) + alertaPedido + alertaFora + cabecalho + tabs +
        pane('itens', paneItens) + pane('fin', paneFin) + pane('fiscal', paneFiscal) + pane('partes', panePartes) + pane('transp', paneTransp) + pane('xml', paneXml);
}
function qdtFmt(v) { return String(numeroLimpo(Number(v))); }

// ---- edições (gravam na NF salva e na memória de associações) ----
function trocarSmartComprasNfItem(nfId, idx, codigo) {
    const nf = listaNfsProcessadas.find(n => n.id === nfId); const it = nf && nf.itens && nf.itens[idx];
    if (!it || !codigo) return toast('Escolha um item da cotação.');
    if (codigo === it.codigoSmartCompras) return toast('Esse já é o item associado.');
    const ic = cotacoesDaNf(nf).flatMap(c => c.itens || []).find(x => x.codProduto === codigo);
    const assocSp = listaAssociacoesSpData.find(a => a.codigoSmartCompras === codigo);
    const novoSp = assocSp ? assocSp.spDataCodigo : (it.codigoSpData || '');
    const prodNovo = novoSp ? listaProdutosSpData.find(p => p.codigo === novoSp) : null;
    showConfirmModal({
        title: 'Trocar associação com a cotação',
        message: `NF ${nf.nf} — ${it.xProd}\nAssociar a: ${codigo} — ${ic ? nomeItemCotacao(ic) : ''}\nSP Data: ${novoSp ? novoSp + (prodNovo ? ' — ' + prodNovo.nome : '') : 'nenhum'}${assocSp ? '' : (it.codigoSpData ? ' (mantido o atual: este item da cotação ainda não tem SP Data associado)' : '')}\n\nVale também para as próximas NFs deste produto deste fornecedor.`,
        confirmText: 'Associar', confirmClass: 'warning',
        onConfirm: async () => {
            try {
                const agora = new Date().toISOString();
                const chave = chaveAssociacaoFornecedor(nf.cnpjFornecedor, it.cProd);
                const existente = bancoAssociacoesFornecedor[chave];
                const historico = existente ? [...(existente.historico || [])] : [];
                historico.push({ codigoSmartCompras: codigo, confirmadoEm: agora, tipo: existente ? 'correcao' : 'confirmacao' });
                const novos = nf.itens.map((x, k) => k !== idx ? x : { ...x, codigoSmartCompras: codigo, codigoSpData: novoSp });
                await nfsProcessadasCollection.doc(nfId).update({ itens: novos });
                await associacoesFornecedorCollection.doc(chave).set({
                    cnpjFornecedor: nf.cnpjFornecedor, codigoFornecedor: it.cProd, codigoSmartCompras: codigo,
                    ...(nf.pedido ? { pedido: nf.pedido } : {}), nfNumero: nf.nf || '', confirmadoEm: agora, historico
                });
                toast('✓ Associação trocada.');
            } catch (e) { console.error('Erro ao trocar associação:', e); toast('✕ Erro ao trocar a associação.'); }
        }
    });
}
function definirSpDataNfItem(nfId, idx, codigo) {
    const nf = listaNfsProcessadas.find(n => n.id === nfId); const it = nf && nf.itens && nf.itens[idx];
    const prod = listaProdutosSpData.find(p => p.codigo === codigo);
    if (!it || !prod) return;
    if (codigo === it.codigoSpData) return toast('Esse já é o produto SP Data.');
    showConfirmModal({
        title: 'Trocar produto SP Data',
        message: `NF ${nf.nf} — ${it.xProd}\nSP Data: ${it.codigoSpData || 'nenhum'} → ${codigo} — ${prod.nome}${it.codigoSmartCompras ? '\n\nA associação do item SmartCompras ' + it.codigoSmartCompras + ' com o SP Data também será atualizada.' : ''}`,
        confirmText: 'Trocar', confirmClass: 'warning',
        onConfirm: async () => {
            try {
                const novos = nf.itens.map((x, k) => k !== idx ? x : { ...x, codigoSpData: codigo });
                await nfsProcessadasCollection.doc(nfId).update({ itens: novos });
                if (it.codigoSmartCompras) await confirmarAssociacaoSpData(it.codigoSmartCompras, codigo, { silencioso: true });
                toast('✓ Produto SP Data atualizado.');
            } catch (e) { console.error('Erro ao trocar SP Data:', e); toast('✕ Erro ao trocar o produto SP Data.'); }
        }
    });
}


// ===================================================================
// --- 2.3.1: EDITOR DA NF PARA NF QUE VEIO SÓ DO ERP (sem XML) ---
// ===================================================================
// A NF só existe no relatório do ERP: não há XML para editar valores/vencimento (isso exige processar o XML na Entrada de NF).
// Aqui dá para ver os itens, conferir com a cotação e, principalmente, TROCAR O PEDIDO ao qual a NF está vinculada.
function pedidoDoErpSo(erp) { return erp && erp.vinculo && erp.vinculo.status === 'confirmado' && erp.vinculo.pedido ? String(erp.vinculo.pedido) : null; }
// Pedido provável pelos códigos dos itens: quantos itens da NF o fornecedor (ou empresa do mesmo grupo) GANHOU em cada cotação.
function sugerirPedidoErp(erp) {
    const codigos = [...new Set((erp.itens || []).map(i => i.codigoSmartComprasRelacionado).filter(Boolean).map(String))];
    const cn = erp.cnpjFornecedor; if (!codigos.length || !cn) return [];
    const r = [];
    listaCotacoes.forEach(c => {
        const ganhos = new Set((c.itens || []).filter(i => normalizarCnpj(i.cnpjFornecedor) === normalizarCnpj(cn) || mesmaRaizCnpj(cn, i.cnpjFornecedor)).map(i => String(i.codProduto)));
        const n = codigos.filter(x => ganhos.has(x)).length;
        if (n) r.push({ pedido: String(c.pedido), itens: n, total: codigos.length });
    });
    r.sort((a, b) => b.itens - a.itens);
    if (!r.length || r[0].itens / codigos.length < 0.5) return [];
    return r.filter(x => x.itens === r[0].itens);
}
function moverErpParaPedido(erpId, pedidoNovo) {
    const erp = listaEntradasErp.find(e => e.id === erpId); if (!erp || !pedidoNovo) return;
    const atual = pedidoDoErpSo(erp);
    if (atual === String(pedidoNovo)) return toast('A NF já está nesse pedido.');
    showConfirmModal({
        title: atual ? 'Mover NF para outro pedido' : 'Vincular NF a um pedido',
        message: `NF ${erp.nf} — ${erp.fornecedorNomeRelatorio || ''}\nPedido: ${atual || '(nenhum)'} → ${pedidoNovo}\n\nA NF passa a ser comparada com a cotação do pedido ${pedidoNovo}. Auditorias já geradas para o pedido anterior não são alteradas.`,
        confirmText: atual ? 'Mover' : 'Vincular', confirmClass: 'warning',
        onConfirm: () => confirmarVinculoErpComPedido(erpId, String(pedidoNovo))
    });
}
function renderEditorNfErp(erp, el) {
    const ctrl = montarControleNfs().find(it => it.erp && it.erp.id === erp.id) || {};
    const pedido = pedidoDoErpSo(erp);
    const cot = pedido ? listaCotacoes.find(c => String(c.pedido) === pedido) : null;
    const badge = (cls, txt) => `<span class="xml-item-badge ${cls}">${txt}</span>`;
    const fin = erp.financeiro || {};
    const valor = formatValorBR(fin.totalNota != null ? fin.totalNota : (fin.totalLancamentos || 0));
    const venc = (erp.parcelas && erp.parcelas[0] && erp.parcelas[0].data) || erp.vencimento || '';
    const fornNome = erp.fornecedorNomeEditado || ctrl.nomeFornecedor || erp.fornecedorNomeRelatorio || '';
    const codigos = (erp.itens || []).map(i => i.codigoSmartComprasRelacionado).filter(Boolean);

    // ---- pedido provável (vínculo gravado não bate com os itens) ----
    const analise = pedido ? analisarPedidoDaNf({ pedido, cnpjFornecedor: erp.cnpjFornecedor, itens: [] }, erp) : null;
    const sugestao = (!pedido && !erp.semPedido) ? sugerirPedidoErp(erp) : [];
    const botoesMover = ps => ps.map(p => `<button type="button" class="central-status-toggle" onclick="moverErpParaPedido('${escRel(erp.id)}', '${escRel(p)}')">${pedido ? 'Mover para' : 'Vincular ao'} pedido ${escRel(p)}</button>`).join(' ');
    const alerta = analise ? `<div class="card nfe-alerta"><div class="nfe-alerta-tit">⚠ Pedido possivelmente errado</div>
            <div class="nfe-alerta-txt">${escRel(textoPedidoProvavel(analise))}</div><div class="nfe-acoes">${botoesMover(analise.candidatos.map(c => c.pedido))}</div></div>`
        : (sugestao.length ? `<div class="card nfe-alerta"><div class="nfe-alerta-tit">⚠ NF sem pedido confirmado</div>
            <div class="nfe-alerta-txt">Pelos itens que o fornecedor ganhou, esta NF parece ser de um destes pedidos. Confira antes de vincular.</div><div class="nfe-acoes">${botoesMover(sugestao.map(s => s.pedido))}</div></div>` : '');

    // ---- troca de pedido manual ----
    const opcoes = listaCotacoes.map(c => String(c.pedido)).filter(p => p !== pedido).sort((x, y) => y.localeCompare(x, undefined, { numeric: true }))
        .map(p => { const c = listaCotacoes.find(x => String(x.pedido) === p); return { valor: p, titulo: `Pedido ${p}`, sub: c ? `${(c.itens || []).length} itens cotados` : '' }; });
    const troca = opcoes.length ? `<div class="nfe-trocar"><span class="nfe-rot">${pedido ? 'Mover esta NF para outro pedido' : 'Vincular esta NF a um pedido'}</span>
        ${htmlSeletorBusca('nfed-pedido', { placeholder: 'Buscar pedido…', opcoes, aoEscolher: valor => moverErpParaPedido(erp.id, valor) })}</div>` : '';

    // ---- cabeçalho ----
    const cabecalho = `<div class="card nfe-topo">
        <div class="nfe-topo-linha"><div class="nfe-id"><div class="nfe-titulo">${escRel(tituloFornNf(fornNome, erp.cnpjFornecedor, erp.nf))}</div>
            <div class="nfe-sub">NF ${escRel(erp.nf)}${erp.serie ? ' · série ' + escRel(erp.serie) : ''}${erp.cnpjFornecedor ? ' · CNPJ ' + escRel(erp.cnpjFornecedor) : ''}</div>
            ${(nomeExibicaoFornecedor(fornNome, erp.cnpjFornecedor) || fornNome) !== fornNome ? `<div class="nfe-forn">${escRel(fornNome)}</div>` : ''}</div>
            <div class="nfe-valor"><span class="nfe-rot">Valor total</span><strong>R$ ${escRel(valor)}</strong></div></div>
        <div class="nfe-grade">
            <div><span class="nfe-rot">Emissão</span><strong>${escRel(erp.data || '—')}</strong></div>
            <div><span class="nfe-rot">1º vencimento</span><strong>${escRel(venc || '—')}</strong></div>
            <div><span class="nfe-rot">Pedido</span><strong>${escRel(pedido || '—')}</strong></div></div>
        <div class="nfe-chips">${badge('pendente', 'Só no relatório do ERP')} ${badge('pronto', 'ERP: ' + escRel(ROTULO_STATUS_ERP[erp.statusFluxo] || erp.statusFluxo || 'importada'))} ${badge('neutro', escRel(ROTULO_SITUACAO_NF[ctrl.situacao] || '—'))}</div>
        <div class="nfe-acoes">${pedido ? `<button type="button" class="central-status-toggle" onclick="abrirCentralPedido('${escRel(pedido)}')">Abrir pedido ${escRel(pedido)}</button>` : ''}
            <button type="button" class="central-status-toggle" onclick="abrirControleNfs()">Ver no Controle de NFs</button> <button type="button" class="central-status-toggle" onclick="cadastrarEquipamentoDaNf('${escRel(erp.id)}')">Cadastrar equipamento desta NF</button></div>
        ${troca}
    </div>`;

    // ---- itens (conferência com a cotação do pedido) ----
    const nomeGanhador = i => { const f = cot && (cot.fornecedores || []).find(f => normalizarCnpj(f.cnpj) === normalizarCnpj(i.cnpjFornecedor)); return f ? nomeExibicaoFornecedor(f.razaoSocial, f.cnpj) : (i.cnpjFornecedor || ''); };
    const linhas = (erp.itens || []).map(it => {
        const cod = it.codigoSmartComprasRelacionado ? String(it.codigoSmartComprasRelacionado) : '';
        let chip = badge('neutro', pedido ? 'sem item da cotação associado' : 'sem pedido');
        let cotTxt = '';
        if (cot && cod) {
            const doCod = (cot.itens || []).filter(i => String(i.codProduto) === cod);
            if (!doCod.length) chip = badge('pendente', 'não está na cotação do pedido ' + escRel(pedido));
            else {
                cotTxt = nomeItemCotacao(doCod[0]);
                chip = doCod.some(i => mesmoGrupoFornecedor(erp.fornecedorNomeRelatorio || '', erp.cnpjFornecedor, nomeGanhador(i), i.cnpjFornecedor))
                    ? badge('pronto', 'na cotação, ganho por este fornecedor')
                    : badge('pendente', 'na cotação, ganho por ' + escRel([...new Set(doCod.map(nomeGanhador))].join(' / ')));
            }
        }
        return `<div class="xml-item-linha"><div class="xml-produto-nome">${escRel(it.nome)}</div>
            <div class="xml-item-meta">${escRel(qdtFmt(it.quantidade))} ${escRel(it.unidade || '')} × R$ ${escRel(formatValorBR(it.valorUnitario || 0))} = R$ ${escRel(formatValorBR(it.valorTotal || 0))}</div>
            ${cotTxt ? `<div class="xml-item-cotacao">Cotação: ${escRel(cotTxt)}</div>` : ''}<div style="margin-top:6px">${chip}</div></div>`;
    }).join('');
    const itens = `<div class="card"><div class="xml-item-meta"><strong>Itens lançados no ERP (${(erp.itens || []).length})</strong></div>${linhas || '<div class="xml-item-meta">Sem itens no relatório.</div>'}</div>`;
    const aviso = `<div class="card" data-alvo="sem-xml"><div class="xml-item-meta">Esta NF veio só do relatório do ERP, sem XML. Aqui você confere os itens e troca o pedido; para editar valores, vencimento e associação item a item, processe o XML dela na Entrada de NF.</div></div>`;
    el.innerHTML = alerta + cabecalho + htmlDadosNfErp(erp, fornNome, pedido) + aviso + itens;
}

// 2.10.7: edição dos dados da NF que só veio do ERP — nome do fornecedor, recurso e "sem pedido".
function htmlDadosNfErp(erp, fornNome, pedido) {
    const id = escRel(erp.id);
    const opcoesRec = (typeof observacoesSugeridas !== 'undefined' ? observacoesSugeridas : []).filter(Boolean);
    const atual = erp.recursoManual || '';
    const sel = `<select class="input-box" onchange="definirRecursoErpSo('${id}', this.value)"><option value="">(não definido)</option>${opcoesRec.map(o => `<option value="${escRel(o)}"${o === atual ? ' selected' : ''}>${escRel(o)}</option>`).join('')}</select>`;
    return `<div class="card" data-alvo="dados-nf"><div class="xml-item-meta"><strong>Dados desta NF</strong></div>
        <div class="nfe-trocar"><span class="nfe-rot">Nome do fornecedor</span>
            <div style="display:flex;gap:6px"><input type="text" id="nfed-nome-forn" class="input-box" value="${escRel(fornNome)}" style="flex:1"><button type="button" class="central-status-toggle" onclick="salvarNomeFornecedorErpSo('${id}')">Salvar</button></div>
            <div class="xml-item-meta">O nome fica lembrado: nas próximas importações do ERP com este nome, o fornecedor já vem certo.</div></div>
        <div class="nfe-trocar"><span class="nfe-rot">Recurso</span>${sel}</div>
        <div class="nfe-trocar"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" ${erp.semPedido && !pedido ? 'checked' : ''} ${pedido ? 'disabled' : ''} onchange="definirSemPedidoErpSo('${id}', this.checked)"> <span>Esta NF não tem pedido (compra direta)</span></label>${pedido ? '<div class="xml-item-meta">Há pedido vinculado; para marcar “sem pedido”, mova a NF para nenhum pedido primeiro.</div>' : ''}</div></div>`;
}
async function definirRecursoErpSo(id, valor) {
    try { await entradasErpCollection.doc(id).update({ recursoManual: valor || '' }); toast(valor ? '✓ Recurso definido.' : '✓ Recurso removido.'); }
    catch (e) { console.error(e); toast('✕ Erro ao salvar o recurso.'); }
}
async function definirSemPedidoErpSo(id, marcado) {
    try { await entradasErpCollection.doc(id).update({ semPedido: !!marcado }); toast(marcado ? '✓ Marcada como sem pedido.' : '✓ Marca de “sem pedido” removida.'); }
    catch (e) { console.error(e); toast('✕ Erro ao salvar.'); }
}
async function salvarNomeFornecedorErpSo(id) {
    const erp = listaEntradasErp.find(e => e.id === id); const inp = document.getElementById('nfed-nome-forn');
    if (!erp || !inp) return;
    const novo = nomeTextoSeguro(inp.value).trim().toUpperCase();
    if (!novo) return toast('Digite o nome do fornecedor.');
    try {
        await entradasErpCollection.doc(id).update({ fornecedorNomeEditado: novo });
        const original = nomeTextoSeguro(erp.fornecedorNomeRelatorio).trim().toUpperCase();
        if (original && original !== novo) {
            apelidosFornecedores[original] = novo;
            await settingsDocRef.set({ apelidosFornecedores: { [original]: novo } }, { merge: true });
            await adicionarFornecedor(novo, true);
        }
        toast('✓ Nome do fornecedor salvo.');
    } catch (e) { console.error(e); toast('✕ Erro ao salvar o nome.'); }
}

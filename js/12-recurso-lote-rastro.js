// 12-recurso-lote-rastro.js — Recurso pelas cotações e lote/validade (Fase 43)
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===== Determinação do recurso pelas cotações (regra de negócio) =====
// Recurso público/externo (C/C) exige NO MÍNIMO 3 fornecedores disputando o
// item. Com menos (1 ou 2 cotaram), a compra é feita com Recurso Próprio.
// O número de fornecedores que cotaram cada item vem do relatório de
// fornecedores ganhadores do PRÓPRIO pedido (listaRelatorioGanhadores) — fato
// objetivo, comparado por código. Histórico de outros pedidos NÃO é base: o
// mesmo produto pode ser comprado ora com C/C, ora com Recurso Próprio.
// Sem o relatório (ou sem o item nele) o sistema não chuta: a escolha fica
// manual. Grava no MESMO lugar de sempre (cotacao.recursosPorItem).
// Mínimos: os dois campos de Configurações → Análise de cotações mandam;
// vazios, valem 3 (C/C) e 1 (Recurso Próprio).
function minimoFornecedoresCC() { const n = parseInt(appConfig.minimoCotacoesCC, 10); return n >= 1 ? n : 3; }
function minimoFornecedoresProprio() { const n = parseInt(appConfig.minimoCotacoesRecursoProprio, 10); return n >= 1 ? n : 1; }
function participantesDoItem(pedido, codigo) {
    const rel = listaRelatorioGanhadores.find(r => r.pedido === pedido);
    const item = rel && codigo ? (rel.itens || []).find(g => g.codigo === codigo) : null;
    const n = item ? Number(item.participantes) : NaN;
    return Number.isFinite(n) ? n : null;
}
function determinarRecursoPorCotacao(pedido, codigo) {
    const n = participantesDoItem(pedido, codigo);
    if (n === null) return null;
    const minimo = minimoFornecedoresCC();
    if (n >= minimo) return { tipo: 'cc', participantes: n, minimo };
    if (n >= minimoFornecedoresProprio()) return { tipo: 'proprio', participantes: n, minimo };
    return null;
}
function codigosSmartComprasDestaNf() {
    return [...new Set(itensXmlDetectados
        .filter(item => !item.semCotacao)
        .map(item => bancoAssociacoesFornecedor[chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, item.cProd)])
        .filter(Boolean)
        .map(a => a.codigoSmartCompras))];
}
// Chamado ao salvar a NF (o salvamento é a confirmação do usuário): define, de
// uma vez, o recurso dos itens desta NF que ainda não têm e que a regra acima
// consegue determinar. Os demais ficam pra escolha manual.
// Recurso de UM item da NF em edição (antes de salvar). Nada aqui grava.
// Null = o item ainda não tem base (sem associação).
function recursoPrevistoItemXml(item, status) {
    if (!nfeInfoAtual) return null;
    if (item.semCotacao) {
        const cotDireta = pedidoSelecionadoXml ? listaCotacoes.find(c => c.pedido === pedidoSelecionadoXml) : null;
        const destino = (cotDireta && cotDireta.origem) || destinoSemCotacaoXml;
        const chaveRec = 'd:' + item.cProd;
        if (!destino) return { chaveRec, semDestino: true };
        const rasc = recursosRascunhoXml[chaveRec] || null;
        const proprio = calcularRecursoOficial(destino, 'proprio');
        return { chaveRec, direto: true, cc: calcularRecursoOficial(destino, 'cc'), proprio, valor: rasc || proprio, motivo: rasc ? 'definido manualmente' : 'sem cotação do SmartCompras → Recurso Próprio' };
    }
    if (!status || !status.associacao) return null;
    const codigo = status.associacao.codigoSmartCompras;
    const temItem = c => (c.itens || []).some(i => i.codProduto === codigo);
    const cotDaAssociacao = status.associacao.pedido ? listaCotacoes.find(c => c.pedido === status.associacao.pedido) : null;
    const cot = (cotDaAssociacao && temItem(cotDaAssociacao)) ? cotDaAssociacao
        : listaCotacoes.find(c => c.pedido === pedidoSelecionadoXml && temItem(c))
        || cotacoesSelecionadasXml().map(p => listaCotacoes.find(c => c.pedido === p)).find(c => c && temItem(c))
        || listaCotacoes.find(temItem);
    const chaveRec = 'c:' + codigo;
    if (!cot || !cot.origem) return { chaveRec, semOrigem: true };
    const existente = (cot.recursosPorItem || {})[codigo] || null;
    const det = determinarRecursoPorCotacao(cot.pedido, codigo);
    const esperado = det ? calcularRecursoOficial(cot.origem, det.tipo) : null;
    const detTipo = det ? det.tipo : null;
    const rasc = recursosRascunhoXml[chaveRec] || null;
    const valor = rasc || existente || esperado;
    const conforme = det ? `conforme as cotações: ${det.participantes} fornecedor(es) cotaram (C/C exige ${det.minimo} ou mais)` : 'já definido';
    let motivo = '';
    if (rasc) motivo = esperado && rasc !== esperado ? `definido manualmente (as cotações indicariam ${esperado})` : 'definido manualmente';
    else if (existente) motivo = esperado && existente !== esperado ? `já definido (as cotações indicariam ${esperado})` : conforme;
    else if (det) motivo = conforme;
    return { chaveRec, cotacao: cot, codigo, cc: calcularRecursoOficial(cot.origem, 'cc'), proprio: calcularRecursoOficial(cot.origem, 'proprio'), valor, motivo, detTipo };
}


// ===================================================================
// --- FASE 43: LOTE E VALIDADE ESCRITOS EM TEXTO (xProd / infAdProd) ---
// ===================================================================
// O SPData só lê <rastro><nLote/><qLote/><dVal/></rastro>. Muitos fornecedores escrevem lote e validade em texto livre no fim do
// nome do produto (ex.: "LOTE: X DT VAL: dd/mm/aaaa" ou "Lote * Data Venc..: X * dd/mm/aaaa"). Desde a 2.0.3 o app LÊ esse texto e
// já coloca o <rastro> no XML sozinho — sem pedir confirmação nem digitação. Só ficam de fora (com aviso) os casos em que a validade
// é impossível (ex.: ano 3000, data que não existe, anterior à emissão). Quando o item já tem <rastro> no XML, nada é mexido.
// infCpl (texto geral da NF) não é usado: não dá pra saber a qual item o lote pertence.
function extrairLoteValidadeTexto(texto, fonte, emissaoISO) {
    const t = String(texto || '').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    const DATA = '(\\d{1,2})[\\/.\\-](\\d{1,2})[\\/.\\-](\\d{4}|\\d{2})(?![\\d])';
    const MESANO = '(\\d{1,2})[\\/.\\-](\\d{4})(?![\\d\\/])';
    const LOTE_TOKEN = '([A-Za-z0-9][A-Za-z0-9\\/\\-._]*)';
    const ROTULO_LOTE = '(?:LOTE|LT)\\b\\.?';
    const ROTULO_VAL = '(?:DT\\.?\\s*|DATA\\s*(?:DE\\s*)?)?(?:VENCIMENTO|VENC|VALIDADE|VALID|VAL)\\w*\\.*';
    let lote = null, d = null, m;
    // 1) rótulos juntos e valores juntos: "Lote * Data Venc..: N1154 * 30/06/2031"
    m = t.match(new RegExp('\\b' + ROTULO_LOTE + '[\\s*|;:/\\-]*' + ROTULO_VAL + '[\\s.:*|;\\-]*' + LOTE_TOKEN + '\\s*[*|;,/\\-]*\\s*' + DATA, 'i'));
    if (m) { lote = m[1]; d = { dia: m[2], mes: m[3], ano: m[4] }; }
    // 2) rótulo e valor lado a lado: "LOTE: X ... DT VAL: dd/mm/aaaa" (ou mm/aaaa)
    if (!lote) {
        const mL = t.match(new RegExp('\\b' + ROTULO_LOTE + '[\\s*|;:#\\-]*(?:N[º°o]\\.?\\s*)?' + LOTE_TOKEN, 'i'));
        const mV = t.match(new RegExp('\\b' + ROTULO_VAL + '[\\s.:*|;\\-]*' + DATA, 'i'));
        const mM = !mV ? t.match(new RegExp('\\b' + ROTULO_VAL + '[\\s.:*|;\\-]*' + MESANO, 'i')) : null;
        if (mL && (mV || mM)) {
            lote = mL[1];
            if (mV) d = { dia: mV[1], mes: mV[2], ano: mV[3] };
            else { const ult = new Date(Date.UTC(Number(mM[2]), Number(mM[1]), 0)).getUTCDate(); d = { dia: String(ult), mes: mM[1], ano: mM[2] }; }
        }
    }
    if (!lote || !d) return null;
    lote = lote.replace(/[.\-_\/]+$/, '');
    if (!lote || /^(DT|VAL|VALIDADE|VENC|VENCIMENTO|DATA|N)$/i.test(lote)) return null;
    let ano = Number(d.ano); if (d.ano.length === 2) ano += 2000;
    const dia = Number(d.dia), mes = Number(d.mes);
    const dd = String(dia).padStart(2, '0'), mm = String(mes).padStart(2, '0');
    const validadeBR = `${dd}/${mm}/${ano}`;
    const iso = `${ano}-${mm}-${dd}`;
    const dt = new Date(Date.UTC(ano, mes - 1, dia));
    const calendarioOk = dt.getUTCFullYear() === ano && dt.getUTCMonth() === mes - 1 && dt.getUTCDate() === dia;
    let motivo = null;
    if (!calendarioOk) motivo = 'data inexistente';
    else if (ano < 2000 || ano > 2099) motivo = `ano ${ano} fora do esperado`;
    else if (emissaoISO && iso < String(emissaoISO).slice(0, 10)) motivo = 'anterior à emissão da NF';
    return { fonte, lote, validadeBR, validadeISO: motivo ? null : iso, valida: !motivo, motivo };
}
function dataISOParaBR(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; }

const ELEMENTOS_ANTES_DO_RASTRO = ['cProd','cEAN','cBarra','xProd','NCM','NVE','CEST','indEscala','CNPJFab','cBenef','EXTIPI','CFOP','uCom','qCom','vUnCom','vProd','cEANTrib','cBarraTrib','uTrib','qTrib','vUnTrib','vFrete','vSeg','vDesc','vOutro','indTot','DI','detExport','xPed','nItemPed','nFCI'];
// Cria (ou atualiza) o <rastro> do item no XML de saída, na posição do leiaute da NF-e (depois de nFCI e antes de med/infProdEmb...).
// Idempotente: "Salvar" e "Baixar" chamam várias vezes. qLote = quantidade de SAÍDA (já convertida), como o SPData confere.
function aplicarRastroDecididoNoXml(item) {
    if (item.rastros.length) return; // já tem <rastro> no XML: não mexe (a conversão de qLote é tratada à parte)
    const prod = item.prod;
    if (!item.rastroDecidido) {
        if (item.rastroEl && item.rastroEl.parentNode) item.rastroEl.parentNode.removeChild(item.rastroEl);
        item.rastroEl = null; return;
    }
    const doc = prod.ownerDocument, ns = prod.namespaceURI;
    const mk = (nome, texto) => { const e = ns ? doc.createElementNS(ns, nome) : doc.createElement(nome); e.textContent = texto; return e; };
    if (item.rastroEl && item.rastroEl.parentNode) item.rastroEl.parentNode.removeChild(item.rastroEl);
    const r = ns ? doc.createElementNS(ns, 'rastro') : doc.createElement('rastro');
    r.appendChild(mk('nLote', item.rastroDecidido.lote));
    r.appendChild(mk('qLote', (item.qComOriginal * item.fator).toFixed(3)));
    r.appendChild(mk('dVal', item.rastroDecidido.validadeISO));
    let ref = null;
    Array.from(prod.children).forEach(c => { if (ELEMENTOS_ANTES_DO_RASTRO.includes(c.localName)) ref = c; });
    if (ref && ref.nextSibling) prod.insertBefore(r, ref.nextSibling); else prod.appendChild(r);
    item.rastroEl = r;
}

// 2.0.3: o lote lido do texto entra no XML automaticamente (ver detecção em 10-entrada-nf-xml.js). Aqui só há o resultado e,
// se você não quiser aquele lote, um "Remover" (e "Aplicar" para voltar atrás). Nenhum campo para digitar.
function aplicarLoteXml(idx) {
    const it = itensXmlDetectados[idx]; if (!it || !it.loteCandidato || !it.loteCandidato.valida) return;
    it.rastroDecidido = { lote: it.loteCandidato.lote, validadeISO: it.loteCandidato.validadeISO, origem: 'texto' };
    renderAssociacaoCotacaoXml();
}
function removerLoteXml(idx) { const it = itensXmlDetectados[idx]; if (!it) return; it.rastroDecidido = null; renderAssociacaoCotacaoXml(); }

function htmlLoteXml(item, idx) {
    const chip = (classe, txt) => `<span class="xml-item-badge ${classe}">${txt}</span>`;
    if (item.rastros.length) {
        const r = item.rastros[0];
        return `<div class="xml-item-lote">${chip('pronto', 'Lote no XML')} <span class="xml-item-meta">${escRel(r.nLote)}${r.dVal ? ' · validade ' + escRel(dataISOParaBR(r.dVal) || r.dVal) : ''}${item.rastros.length > 1 ? ` (+${item.rastros.length - 1} lote(s))` : ''}</span></div>`;
    }
    if (item.rastroDecidido) {
        const d = item.rastroDecidido;
        return `<div class="xml-item-lote">${chip('pronto', '✓ Lote entra no XML')} <span class="xml-item-meta">${escRel(d.lote)} · validade ${dataISOParaBR(d.validadeISO)}</span>
            <div class="xml-item-acao"><button type="button" class="link-discreto" onclick="removerLoteXml(${idx})">Remover</button></div></div>`;
    }
    const c = item.loteCandidato;
    if (c && c.valida) {
        return `<div class="xml-item-lote">${chip('neutro', 'Lote removido')} <span class="xml-item-meta">${escRel(c.lote)} · validade ${escRel(c.validadeBR)}</span>
            <div class="xml-item-acao"><button type="button" class="link-discreto" onclick="aplicarLoteXml(${idx})">Aplicar</button></div></div>`;
    }
    if (c) return `<div class="xml-item-lote"><div class="xml-item-meta xml-lote-aviso">Lote ${escRel(c.lote)} / validade ${escRel(c.validadeBR)} no texto do produto não entraram no XML: ${escRel(c.motivo)}.</div></div>`;
    return '';
}

function htmlRecursoItemXml(item, idx, status) {
    const r = recursoPrevistoItemXml(item, status);
    if (!r) return '';
    if (r.semDestino) return '<em>Recurso: defina o destino (Santa Casa/CTI) desta NF pra definir o recurso.</em>';
    if (r.semOrigem) return '<em>Recurso: a cotação deste item não tem a Origem (Santa Casa/CTI) definida.</em>';
    if (r.valor) {
        const trocarPara = r.valor === r.cc ? 'proprio' : 'cc';
        const rotulo = trocarPara === 'cc' ? r.cc : r.proprio;
        const forcandoContraRegra = r.detTipo && r.valor !== (r.detTipo === 'cc' ? r.cc : r.proprio); // já é uma exceção manual — sempre reversível
        const valeAPenaSugerirTroca = r.detTipo !== 'cc' || forcandoContraRegra; // "trocar" só faz sentido abaixo do mínimo (ou desfazendo uma exceção)
        const acaoHTML = valeAPenaSugerirTroca
            ? `<button type="button" class="central-status-toggle" onclick="definirRecursoNfXml(${idx}, '${trocarPara}')">Trocar pra ${escRel(rotulo)}</button>`
            : `<button type="button" class="link-discreto" onclick="definirRecursoNfXml(${idx}, '${trocarPara}')">Corrigir recurso</button>`;
        return `Recurso: <strong>${escRel(r.valor)}</strong> — ${escRel(r.motivo)} ${acaoHTML}`;
    }
    return `<em>Recurso: não dá pra definir pelas cotações — este pedido não tem o relatório de fornecedores ganhadores com este item. Escolha:</em> `
        + `<button type="button" class="central-status-toggle" onclick="definirRecursoNfXml(${idx}, 'cc')">${escRel(r.cc)}</button> `
        + `<button type="button" class="central-status-toggle" onclick="definirRecursoNfXml(${idx}, 'proprio')">${escRel(r.proprio)}</button>`;
}

async function gravarRecursoCotacaoXml(cotacao, novos) {
    await cotacoesCollection.doc(cotacao.pedido).set({ recursosPorItem: novos }, { merge: true });
    cotacao.recursosPorItem = { ...(cotacao.recursosPorItem || {}), ...novos };
}

// Antes de salvar, a escolha fica só na tela (rascunho); depois de salvar,
// trocar o recurso grava na hora (cotação, ou a própria NF nos itens diretos).
async function definirRecursoNfXml(idx, tipo) {
    const item = itensXmlDetectados[idx];
    if (!item) return;
    const r = recursoPrevistoItemXml(item, statusItemXml(item));
    if (!r || r.semDestino || r.semOrigem) return;
    const oficial = tipo === 'cc' ? r.cc : r.proprio;
    if (!oficial) return;
    recursosRascunhoXml[r.chaveRec] = oficial;
    if (nfSalvaXml) {
        try {
            if (r.direto) await salvarNfProcessada();
            else await gravarRecursoCotacaoXml(r.cotacao, { [r.codigo]: oficial });
        } catch (e) {
            console.error('Erro ao salvar o recurso:', e);
            toast('✕ Erro ao salvar o recurso. Tente novamente.');
        }
    }
    renderAssociacaoCotacaoXml();
}

// Ao salvar a NF (a confirmação do usuário): grava na cotação o recurso dos
// itens (o que a regra das cotações determinou e/ou o que foi trocado na
// tela). Nunca sobrescreve um recurso já definido sem uma troca explícita.
async function aplicarRecursoPorCotacaoNf() {
    if (!nfeInfoAtual) return [];
    const porCotacao = new Map();
    itensXmlDetectados.forEach(item => {
        if (item.semCotacao) return;
        const r = recursoPrevistoItemXml(item, statusItemXml(item));
        if (!r || !r.valor || !r.cotacao) return;
        if ((r.cotacao.recursosPorItem || {})[r.codigo] === r.valor) return;
        if (!porCotacao.has(r.cotacao)) porCotacao.set(r.cotacao, {});
        porCotacao.get(r.cotacao)[r.codigo] = r.valor;
    });
    const aplicados = [];
    for (const [cotacao, novos] of porCotacao) {
        try { await gravarRecursoCotacaoXml(cotacao, novos); aplicados.push(...Object.keys(novos)); }
        catch (e) { console.error('Erro ao definir recurso pelas cotações:', e); }
    }
    return aplicados;
}

async function baixarXmlConvertido() {
    if (!xmlDocAtual) return;
    if (!verificarBloqueioEAvisar()) return;
    confirmarAlteracoesEExecutar(executarBaixarXmlConvertido);
}

async function executarBaixarXmlConvertido() {
    await salvarExcecoesConversao(aplicarConversaoNoXmlDom());

    const serializer = new XMLSerializer();
    let xmlString = serializer.serializeToString(xmlDocAtual);
    if (!xmlString.startsWith('<?xml')) xmlString = '<?xml version="1.0" encoding="UTF-8"?>' + xmlString;

    const blob = new Blob([xmlString], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivoXmlOriginal.replace(/\.xml$/i, '') + '-corrigido.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('✓ XML corrigido baixado!');
}

// ============================================================
// MÓDULO DE AUDITORIA — formulário estruturado de divergências de
// materiais recebidos. Gera automaticamente Anotação, WhatsApp e E-mail
// a partir dos mesmos dados, sem repetição de digitação.
// Reaproveita: anotacoesTextoCollection, appConfig/settingsDocRef, toast(),
// switchToScreen(), showConfirmModal(). Não altera nenhuma dessas funções.
// ============================================================

let divergenciasAuditoria = [];
let contadorDivergenciaId = 0;
let saidaAuditoriaAtiva = 'mensagem';

// Definição dos tipos de divergência e seus campos dinâmicos. Pra adicionar um
// tipo novo no futuro, basta acrescentar uma entrada aqui — o formulário e a
// geração de texto se adaptam sozinhos.
// Três tipos-pilares fixos (item 13 da rodada de correção), definidos pela
// combinação exata de onde o produto aparece ou não: cotação / NF / físico.
// Os demais tipos (produto diferente, avaria, carta de correção, valor,
// especificação) continuam existindo por não serem redundantes com esses
// três — descrevem problemas de natureza diferente (identidade do produto,
// condição física, preço), não disponibilidade/quantidade.
// Cada tipo com multiMaterial:true permite adicionar VÁRIOS materiais dentro
// da MESMA ocorrência (mesmo pedido/NF/fornecedor) — não precisa mais criar
// uma auditoria separada por material.
const TIPOS_DIVERGENCIA_AUDITORIA = {
    'nao_faturado': { label: 'Não faturado', multiMaterial: true, campos: [
        { key: 'produto', label: 'Produto', maiusculo: true },
        { key: 'quantidade', label: 'Quantidade' }
    ]},
    'nao_entregue': { label: 'Não entregue', multiMaterial: true, campos: [
        { key: 'produto', label: 'Produto', maiusculo: true },
        { key: 'quantidade', label: 'Quantidade' }
    ]},
    'nao_cotado': { label: 'Não foi cotado', multiMaterial: true, campos: [
        { key: 'produto', label: 'Produto', maiusculo: true },
        { key: 'quantidade', label: 'Quantidade' }
    ]},
    'produto_diferente': { label: 'Produto diferente do pedido', multiMaterial: true, campos: [
        { key: 'produtoPedido', label: 'Produto Pedido', maiusculo: true },
        { key: 'produtoFaturado', label: 'Produto Faturado', maiusculo: true },
        { key: 'quantidade', label: 'Quantidade' },
        { key: 'unidade', label: 'Unidade', placeholder: 'frascos' }
    ]},
    'quantidade_diferente': { label: 'Quantidade faturada diferente da cotada', multiMaterial: true, campos: [
        { key: 'produto', label: 'Produto', maiusculo: true },
        { key: 'quantidadeCotada', label: 'Quantidade Cotada' },
        { key: 'quantidadeFaturada', label: 'Quantidade Faturada' },
        { key: 'unidade', label: 'Unidade', placeholder: 'frascos' }
    ]},
    'avariado': { label: 'Material avariado', multiMaterial: true, campos: [
        { key: 'produto', label: 'Produto', maiusculo: true },
        { key: 'quantidade', label: 'Quantidade' },
        { key: 'unidade', label: 'Unidade', placeholder: 'ampolas' },
        { key: 'tipoDano', label: 'Tipo de Avaria', placeholder: 'quebradas' },
        { key: 'lote', label: 'Lote', obrigatorio: true },
        { key: 'validade', label: 'Validade', obrigatorio: true }
    ]},
    'solicitar_carta_correcao': { label: 'Solicitar carta de correção — lote/validade', multiMaterial: true, campos: [
        { key: 'produto', label: 'Produto', maiusculo: true },
        { key: 'loteInformado', label: 'Lote Informado (na NF)' },
        { key: 'loteRecebido', label: 'Lote Recebido (físico)' },
        { key: 'validadeInformada', label: 'Validade Informada (na NF)' },
        { key: 'validadeRecebida', label: 'Validade Recebida (físico)' }
    ]},
    'valor_diferente': { label: 'Valor diferente do pedido', multiMaterial: true, campos: [
        { key: 'produto', label: 'Produto', maiusculo: true },
        { key: 'quantidade', label: 'Quantidade' },
        { key: 'valorCotado', label: 'Valor Cotado' },
        { key: 'valorFaturado', label: 'Valor Faturado' }
    ]},
    'desacordo_especificacao': { label: 'Produto em desacordo com a especificação', multiMaterial: true, campos: [
        { key: 'produto', label: 'Produto', maiusculo: true },
        { key: 'especificacaoEsperada', label: 'Especificação Pedida' },
        { key: 'especificacaoRecebida', label: 'Especificação Recebida' }
    ]},
    'fornecedor_nao_entregou': { label: 'Fornecedor não entregou o pedido', multiMaterial: false, campos: [
        { key: 'fornecedorNome', label: 'Fornecedor (se diferente do informado acima)', maiusculo: true },
        { key: 'diasEmAberto', label: 'Dias em aberto sem entrega' },
        { key: 'observacao', label: 'Observação', textarea: true }
    ]},
    'frete_indevido': { label: 'Frete em desacordo com a cotação (CIF/FOB)', multiMaterial: false, campos: [
        { key: 'condicaoCotada', label: 'Condição cotada/aprovada', placeholder: 'CIF' },
        { key: 'condicaoCobrada', label: 'Condição efetivamente cobrada', placeholder: 'FOB' },
        { key: 'valorFrete', label: 'Valor do frete cobrado' },
        { key: 'observacao', label: 'Observação', textarea: true }
    ]},
    'outro': { label: 'Outro', multiMaterial: true, campos: [
        { key: 'produto', label: 'Produto (opcional)', maiusculo: true },
        { key: 'observacao', label: 'Descreva a ocorrência', textarea: true }
    ]}
};

function upAud(s) { return (s || '').toString().toUpperCase(); }

function abrirNovaAuditoria() {
    limparFormularioAuditoria();
    document.getElementById('card-resultado-auditoria').style.display = 'none';
    document.getElementById('config-textos-body').style.display = 'none';
    document.getElementById('config-chevron').style.transform = 'rotate(0)';
    switchToScreen('screen-auditoria-nova', 'Nova Auditoria');
}

// Limpa só os campos de ENTRADA (pedido/nf/fornecedor/divergências) — usada
// tanto por abrirNovaAuditoria() (abre a tela do zero, esconde resultado
// anterior) quanto por finalizarAposSalvarAuditoria() (fica na tela, mas
// MANTÉM o resultado gerado visível e editável — ver item 8).
function limparFormularioAuditoria() {
    divergenciasAuditoria = [];
    contadorDivergenciaId = 0;
    ['aud-pedido', 'aud-nf', 'aud-obs-geral'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('aud-fornecedor').value = '';
    document.getElementById('aud-destinatario').value = 'Marisa';
    document.getElementById('aud-data').value = new Date().toISOString().slice(0, 10);
    cotacaoEncontradaAuditoria = null;
    atualizarInfoCotacaoAuditoria();
    renderDivergenciasAuditoria();
}
function finalizarAposSalvarAuditoria() {
    limparFormularioAuditoria();
}

// Ao digitar/sair do campo Pedido, procura a cotação cadastrada (manual ou
// importada via XML) pra esse pedido. Se achar, sugere o fornecedor (via
// datalist — o usuário ainda pode digitar outro nome livremente) e os
// produtos daquele fornecedor nos campos de divergência, pra reduzir
// digitação durante a conferência.
function buscarCotacaoParaAuditoria() {
    const pedido = document.getElementById('aud-pedido').value.trim();
    cotacaoEncontradaAuditoria = pedido ? (listaCotacoes.find(c => c.pedido === pedido) || null) : null;
    atualizarInfoCotacaoAuditoria();
    atualizarDatalistFornecedoresAuditoria();
    atualizarDatalistProdutosAuditoria();
}

function atualizarInfoCotacaoAuditoria() {
    const info = document.getElementById('aud-cotacao-info');
    if (!info) return;
    if (!cotacaoEncontradaAuditoria) { info.style.display = 'none'; info.textContent = ''; return; }
    const c = cotacaoEncontradaAuditoria;
    const qtdForn = (c.fornecedores || []).length;
    const qtdItens = (c.itens || []).length;
    info.textContent = `✓ Cotação encontrada${c.origem ? ' — ' + c.origem : ''} · ${qtdForn} fornecedor${qtdForn === 1 ? '' : 'es'} · ${qtdItens} ${qtdItens === 1 ? 'item' : 'itens'} cadastrado${qtdItens === 1 ? '' : 's'}`;
    info.style.display = 'block';
}

function atualizarDatalistFornecedoresAuditoria() {
    const datalist = document.getElementById('datalist-fornecedores-cotacao');
    if (!datalist) return;
    const fornecedores = cotacaoEncontradaAuditoria ? (cotacaoEncontradaAuditoria.fornecedores || []) : [];
    // Sugere o apelido cadastrado (mesmo cadastro usado na importação do ERP)
    // em vez do nome completo/burocrático vindo do XML, quando existir um.
    datalist.innerHTML = fornecedores.map(f => `<option value="${nomeExibicaoFornecedor(f.razaoSocial, f.cnpj)}">`).join('');
}

// Nome do produto que o sistema já conhece pra este item da cotação — a
// associação dupla já existente (código SmartCompras -> SP Data) resolve
// isso; a Observação/descrição do SmartCompras só entra como fallback,
// quando o item ainda não tem SP Data associado (nunca cria uma terceira
// associação nova pra isso).
function nomeConhecidoItemCotacao(it) {
    const assoc = it.codProduto ? listaAssociacoesSpData.find(a => a.codigoSmartCompras === it.codProduto) : null;
    const produtoSpData = assoc ? listaProdutosSpData.find(p => p.codigo === assoc.spDataCodigo) : null;
    return produtoSpData ? produtoSpData.nome : (it.descricao || '');
}

// Datalist de produtos filtrada pelo fornecedor já digitado no campo
// Fornecedor (se bater com algum da cotação) — senão mostra todos os
// produtos da cotação, já que o usuário pode digitar o fornecedor depois.
// Mostra o NOME DO PRODUTO já conhecido pelo sistema como valor principal
// (Ponto 2 desta atualização) — código e observação original do SmartCompras
// ficam como informação complementar no atributo "label" (a maioria dos
// navegadores mostra os dois lado a lado). Um produto que ainda não foi
// faturado (não aparece em nenhuma NF) continua na lista normalmente, já
// que a fonte aqui é sempre a cotação completa, nunca a NF.
function atualizarDatalistProdutosAuditoria() {
    const datalist = document.getElementById('datalist-produtos-cotacao');
    if (!datalist) return;
    if (!cotacaoEncontradaAuditoria) { datalist.innerHTML = ''; return; }
    const nomeFornecedorDigitado = upAud(document.getElementById('aud-fornecedor').value.trim());
    // Compara tanto com o nome completo quanto com o apelido, já que o campo
    // Fornecedor agora pode ter sido preenchido com qualquer um dos dois.
    const fornMatch = (cotacaoEncontradaAuditoria.fornecedores || []).find(f =>
        upAud(f.razaoSocial) === nomeFornecedorDigitado || upAud(nomeExibicaoFornecedor(f.razaoSocial)) === nomeFornecedorDigitado
    );
    const itens = cotacaoEncontradaAuditoria.itens || [];
    const itensFiltrados = fornMatch ? itens.filter(it => normalizarCnpj(it.cnpjFornecedor) === normalizarCnpj(fornMatch.cnpj)) : itens;

    const vistos = new Set();
    const opcoes = [];
    itensFiltrados.forEach(it => {
        const nome = nomeConhecidoItemCotacao(it);
        if (!nome || vistos.has(nome)) return;
        vistos.add(nome);
        const complementar = [
            it.codProduto ? `Cód. ${it.codProduto}` : null,
            it.descricao && it.descricao !== nome ? it.descricao : null
        ].filter(Boolean).join(' · ');
        opcoes.push(`<option value="${escRel(nome)}"${complementar ? ` label="${escRel(complementar)}"` : ''}>`);
    });
    datalist.innerHTML = opcoes.join('');
}


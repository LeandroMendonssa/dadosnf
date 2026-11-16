// 04-relatorios-base.js — Relatórios e contadores, abas e indicadores/filtros (Fase 15)
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// --- RELATÓRIOS E CONTADORES ---

function atualizarContadorExportacao() {
    if(DOM.totalNotasExport) {
        DOM.totalNotasExport.textContent = notasPendentes.filter(n => !n.emEspera).length;
    }
}

function parseDataBR(dataStr) {
    if(!dataStr || dataStr.length < 10) return null;
    const partes = dataStr.split('/');
    // Cria data: Ano, Mês (base 0), Dia
    return new Date(partes[2], partes[1] - 1, partes[0]);
}

function calcularDiasParaVencimento(dataVencimentoStr) {
    const dataVenc = parseDataBR(dataVencimentoStr);
    if(!dataVenc) return null;
    
    const hoje = new Date();
    hoje.setHours(0,0,0,0); // Zera hora para comparar apenas datas
    
    const diffTime = dataVenc - hoje;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays;
}

function atualizarRelatorios() {
    if(!DOM.listaRelatorios) return;
    DOM.listaRelatorios.innerHTML = '';
    
    // Filtra notas que vencem em até 7 dias (incluindo as atrasadas)
    const notasAlerta = notasPendentes.filter(nota => {
        const dias = calcularDiasParaVencimento(nota.vencimento);
        return dias !== null && dias <= 7;
    }).sort((a,b) => {
        // Ordena: data mais antiga (urgente) primeiro
        const dateA = parseDataBR(a.vencimento) || new Date(9999,0,1);
        const dateB = parseDataBR(b.vencimento) || new Date(9999,0,1);
        return dateA - dateB;
    });

    if (notasAlerta.length === 0) {
        DOM.listaRelatorios.innerHTML = `<div class="empty-state">Nenhuma nota próxima do vencimento.</div>`;
        return;
    }

    notasAlerta.forEach(nota => {
        const dias = calcularDiasParaVencimento(nota.vencimento);
        let statusClass = '';
        let textoPrazo = '';

        if (dias < 0) {
            statusClass = 'vencimento-hoje'; // Atrasada (usa mesma cor de hoje/urgente)
            textoPrazo = `Venceu há ${Math.abs(dias)} dias`;
        } else if (dias === 0) {
            statusClass = 'vencimento-hoje';
            textoPrazo = 'Vence HOJE';
        } else {
            statusClass = 'vencimento-proximo';
            textoPrazo = `Vence em ${dias} dias`;
        }

        const div = document.createElement('div');
        div.className = `nota-item ${statusClass}`;
        div.innerHTML = `
            <div class="nota-info">${nota.fornecedor} ${nota.nf||''}</div>
            <div class="nota-detalhes" style="color: var(--text-dark); font-weight: 600;">${textoPrazo} (${nota.vencimento})</div>
            <div class="nota-detalhes">Valor: ${nota.valor||'N/A'} | Obs: ${nota.obs||'-'}</div>
        `;
        DOM.listaRelatorios.appendChild(div);
    });
}

// --- ÁREA DE RELATÓRIOS: abas de consulta ---
// Tudo aqui é somente leitura sobre os arrays que já existem em memória
// (notasPendentes, historicoNotas, listaCotacoes, listaAnotacoes). Não
// mexe em nenhuma estrutura das Fases 1-5 nem cria coleção nova.

function escRel(s) { return (s === undefined || s === null) ? '' : String(s).replace(/</g, '&lt;'); }

function normalizarBuscaRel(s) {
    return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Chamada nos mesmos pontos que já atualizavam a antiga tela de Relatórios
// (notas) e também nos listeners de cotações/anotações, pra manter as
// abas novas em sincronia com o restante do app sem precisar de listener
// próprio.
function atualizarAreaRelatorios() {
    atualizarRelatorios();
}









// ===================================================================
// --- FASE 15: INDICADORES E FILTROS DO RELATÓRIOS ---
// ===================================================================
// Tudo calculado na hora e só leitura, sobre os mesmos arrays que as abas
// já usam (notasPendentes, historicoNotas, listaCotacoes, listaAnotacoes) —
// sem coleção nova, sem IA e sem estimativa. Um dado que os registros não
// permitem determinar fica DE FORA do filtro correspondente (nunca é
// adivinhado). Os números dos indicadores usam exatamente os mesmos filtros
// das listas: tocar num indicador abre a lista dos registros que o compõem.
let relatoriosFiltros = { de: '', ate: '', fornecedor: '', fornecedorExato: false, destino: '', recurso: '', tipo: '', produto: '' };
let relCtxCache = { refs: null, map: new Map() };


// Aceita 'aaaa-mm-dd' (campos de data), 'dd/mm/aaaa' (NFs) e ISO com hora.
function dataRel(str) {
    if (!str) return null;
    const t = String(str).trim();
    if (t.includes('T')) { const d = new Date(t); return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    return null;
}
// Com período ativo, registro sem data válida não entra (não dá pra afirmar que está no período).
function dentroPeriodoRel(str) {
    const { de, ate } = relatoriosFiltros;
    if (!de && !ate) return true;
    const d = dataRel(str);
    if (!d) return false;
    if (de && d < dataRel(de)) return false;
    if (ate && d > dataRel(ate)) return false;
    return true;
}
function fornecedorCasaRel(nome) {
    const f = normalizarBuscaRel(relatoriosFiltros.fornecedor).trim();
    if (!f) return true;
    const n = normalizarBuscaRel(nome).trim();
    return relatoriosFiltros.fornecedorExato ? n === f : n.includes(f);
}

// Pedido/destino/recurso de uma NF vêm SÓ da mesma regra já usada na aptidão
// pra saída (NF conferida na Entrada Segura → pedido → cotação). Sem esse
// vínculo o dado é "não informado". Guardado em cache até algum array mudar.
function contextoNotaRel(nota) {
    const refs = [notasPendentes, historicoNotas, listaCotacoes, listaNfsProcessadas, listaEntradasErp, listaAnotacoes];
    if (!relCtxCache.refs || refs.some((r, i) => r !== relCtxCache.refs[i])) relCtxCache = { refs, map: new Map() };
    const chave = `${nota._statusRel || ''}:${nota.id}`;
    if (!relCtxCache.map.has(chave)) {
        let ctx = null;
        try { ctx = calcularAptidaoSaidaNota(nota); } catch (e) { ctx = null; }
        relCtxCache.map.set(chave, ctx);
    }
    return relCtxCache.map.get(chave);
}

function todasNotasRel() {
    return [...notasPendentes.map(n => ({ ...n, _statusRel: 'pendente' })), ...historicoNotas.map(n => ({ ...n, _statusRel: 'arquivada' }))];
}
function notaPassaFiltrosRel(n) {
    const f = relatoriosFiltros;
    if (!dentroPeriodoRel(n.data)) return false;
    if (!fornecedorCasaRel(n.fornecedor)) return false;
    if (f.recurso && (n.obs || '').toString().trim() !== f.recurso) return false;
    if (f.destino) { const ctx = contextoNotaRel(n); if (!ctx || ctx.destino !== f.destino) return false; }
    return true;
}
function notaCasaTermoRel(n, termo) {
    if (!termo) return true;
    if (normalizarBuscaRel(n.fornecedor).includes(termo) || normalizarBuscaRel(n.nf).includes(termo)) return true;
    const ctx = contextoNotaRel(n);
    return !!(ctx && ctx.pedido && normalizarBuscaRel(ctx.pedido).includes(termo));
}

function pedidoPassaFiltrosRel(c) {
    const f = relatoriosFiltros;
    if (!dentroPeriodoRel(c.dataPedido)) return false;
    if (f.destino && c.origem !== f.destino) return false;
    if (f.recurso && !Object.values(c.recursosPorItem || {}).includes(f.recurso)) return false;
    if (normalizarBuscaRel(f.fornecedor).trim() && !(c.fornecedores || []).some(x => fornecedorCasaRel(x.razaoSocial) || fornecedorCasaRel(nomeExibicaoFornecedor(x.razaoSocial)))) return false;
    return true;
}
function pedidoCasaTermoRel(c, termo) {
    if (!termo) return true;
    const fornecedoresTexto = (c.fornecedores || []).map(f => f.razaoSocial || '').join(' ');
    return normalizarBuscaRel(c.pedido).includes(termo)
        || normalizarBuscaRel(c.origem).includes(termo)
        || normalizarBuscaRel(fornecedoresTexto).includes(termo);
}

// Produto de uma divergência: só quando o próprio registro traz o produto
// (materiais estruturados). Tipos sem produto ficam fora do ranking de produtos.
function produtosDivergenciaRel(d) {
    const def = TIPOS_DIVERGENCIA_AUDITORIA[d.tipo];
    const nomes = (!def || def.multiMaterial)
        ? materiaisDaDivergencia(d).map(m => m.produto || m.produtoPedido)
        : [(d.campos || {}).produto];
    return [...new Set(nomes.map(n => (n || '').toString().trim().toUpperCase()).filter(Boolean))];
}
// Uma "auditoria" = uma ocorrência registrada em "Nova Auditoria".
function auditoriasBaseRel() {
    const f = relatoriosFiltros;
    const lista = [];
    listaAnotacoes.forEach(a => (a.ocorrencias || []).forEach((oc, ocIdx) => {
        const x = { pedido: a.pedido || '', anotStatus: a.status || '', fornecedorCnpj: oc.fornecedorCnpj || '', fornecedor: oc.fornecedor || '', notaFiscal: oc.notaFiscal || '', data: dataRel(oc.data) ? oc.data : (oc.criadoEm || ''), observacaoGeral: oc.observacaoGeral || '', divergencias: oc.divergencias || [], anotId: a.id, ocIdx };
        if (!dentroPeriodoRel(x.data) || !fornecedorCasaRel(x.fornecedor)) return;
        if (f.destino) { const cot = listaCotacoes.find(c => c.pedido === x.pedido); if (!cot || cot.origem !== f.destino) return; }
        lista.push(x);
    }));
    return lista;
}
function divPassaFiltrosRel(d) {
    const f = relatoriosFiltros;
    if (f.tipo && d.tipo !== f.tipo) return false;
    if (f.produto && !produtosDivergenciaRel(d).includes(f.produto)) return false;
    return true;
}
function auditoriasRel() {
    const f = relatoriosFiltros;
    const base = auditoriasBaseRel();
    return (f.tipo || f.produto) ? base.filter(x => x.divergencias.some(divPassaFiltrosRel)) : base;
}
// 2.10.5: item da cotação a que a divergência se refere (pelo vínculo de código ou pelo nome do produto), se houver.
function itemCotacaoDaDivergenciaRel(pedido, d, cnpj) {
    const cot = listaCotacoes.find(c => String(c.pedido) === String(pedido)); if (!cot) return null;
    const mats = materiaisDaDivergencia(d);
    const cods = mats.map(m => m.codProduto).filter(Boolean);
    const nomes = mats.map(m => m.produto || m.produtoPedido).filter(Boolean);
    const itens = (cot.itens || []).filter(it => !cnpj || !it.cnpjFornecedor || normalizarCnpj(it.cnpjFornecedor) === normalizarCnpj(cnpj));
    return itens.find(it => cods.includes(it.codProduto)) || itens.find(it => nomes.some(n => nomesProdutoCombinam(n, it.nomeOficial || it.descricao || it.codProduto))) || null;
}
// Situação "de verdade": a gravada na divergência; se é registro antigo (sem situação), vale o que o app já sabe — anotação concluída ou
// item marcado como resolvido na cotação — em vez de ficar "Pendente" para sempre.
function itemChegouParaRel(pedido, item) {
    const cot = listaCotacoes.find(c => String(c.pedido) === String(pedido));
    if (!cot || !item) return false;
    if ((cot.chegadasPorFornecedor || {})[normalizarCnpj(item.cnpjFornecedor)]) return true;
    try {
        const linha = compararFontesPedido(cot.pedido).find(l => String(l.codProduto) === String(item.codProduto) && normalizarCnpj(l.cnpjFornecedor) === normalizarCnpj(item.cnpjFornecedor));
        return !!(linha && (linha.temNf || linha.temErp) && !linha.divergencias.some(v => v.tipo === 'nao_faturado'));
    } catch (e) { return false; }
}
function statusEfetivoDivergenciaRel(d, x, item) {
    // 2.10.7: "não faturado" pendente some quando o item já chegou (marcado "já chegou", NF do app ou ERP associado).
    if ((d.status || 'pendente') === 'pendente' && d.tipo === 'nao_faturado' && item && itemChegouParaRel(x.pedido, item)) return 'resolvida';
    if (d.status) return d.status;
    if (x.anotStatus === 'concluido') return 'resolvida';
    const cot = listaCotacoes.find(c => String(c.pedido) === String(x.pedido));
    if (item && cot && (cot.resolvidosPorItem || {})[item.codProduto]) return 'resolvida';
    return 'pendente';
}
function divergenciasRel() {
    const todas = [];
    auditoriasBaseRel().forEach(x => x.divergencias.filter(divPassaFiltrosRel).forEach(d => {
        const item = itemCotacaoDaDivergenciaRel(x.pedido, d, x.fornecedorCnpj);
        // 2.19.0: auditoria nova só conta como relatada depois que você marca (relatado:false = gerada, ainda não relatada)
        const cotRel = listaCotacoes.find(c => String(c.pedido) === String(x.pedido));
        const relatadoDiv = d.relatado !== false || !!(item && cotRel && (cotRel.relatadosPorItem || {})[item.codProduto]);
        todas.push({ relatado: relatadoDiv, pedido: x.pedido, fornecedor: x.fornecedor, fornecedorCnpj: x.fornecedorCnpj || (item && item.cnpjFornecedor) || '', notaFiscal: x.notaFiscal, tipo: d.tipo, data: x.data, status: statusEfetivoDivergenciaRel(d, x, item), linhas: linhasDeMateriais(d), produtos: produtosDivergenciaRel(d), codProduto: item ? item.codProduto : '', registros: 1, origens: [{ anotId: x.anotId, ocIdx: x.ocIdx, dIdx: x.divergencias.indexOf(d) }] });
    }));
    // Registro refeito a cada etapa (identificação, depois resolução...) do MESMO pedido + tipo + produto vira UMA divergência: vale o mais recente.
    const mapa = new Map(), resultado = [];
    todas.forEach(x => {
        if (!x.produtos.length) { resultado.push(x); return; }
        const k = [x.pedido, x.tipo, x.produtos.join('|')].join('::');
        const ant = mapa.get(k);
        if (!ant) { mapa.set(k, x); resultado.push(x); return; }
        ant.registros++;
        const orig = ant.origens.concat(x.origens);
        if (String(x.data) >= String(ant.data)) { const r = ant.registros; Object.assign(ant, x, { registros: r }); }
        ant.origens = orig;
    });
    return resultado;
}
function auditoriaCasaTermoRel(x, termo) {
    return normalizarBuscaRel(x.pedido).includes(termo) || normalizarBuscaRel(x.fornecedor).includes(termo) || normalizarBuscaRel(x.notaFiscal).includes(termo);
}
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/04-relatorios-base.js'] = '2.49.0';

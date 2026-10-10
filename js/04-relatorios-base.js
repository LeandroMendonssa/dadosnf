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
    renderAbaAtivaRelatorios();
}

function mudarAbaRelatorios(aba) {
    relatoriosAbaAtiva = aba;
    ['pedidos', 'notas', 'divergencias', 'auditorias'].forEach(a => {
        const btn = document.getElementById(`relatorios-tab-btn-${a}`);
        if (btn) btn.classList.toggle('active', a === aba);
    });
    const busca = document.getElementById('relatorios-busca');
    if (busca) busca.placeholder = aba === 'notas'
        ? 'Buscar por fornecedor ou NF...'
        : (aba === 'divergencias' || aba === 'auditorias')
            ? 'Buscar por pedido, fornecedor ou NF...'
            : 'Buscar por pedido, origem ou fornecedor...';
    const subfiltroNotas = document.getElementById('relatorios-subfiltro-notas');
    if (subfiltroNotas) subfiltroNotas.style.display = aba === 'notas' ? 'flex' : 'none';
    const subfiltroDivergencias = document.getElementById('relatorios-subfiltro-divergencias');
    if (subfiltroDivergencias) subfiltroDivergencias.style.display = aba === 'divergencias' ? 'flex' : 'none';
    renderAbaAtivaRelatorios();
}

function filtrarRelatorios(valor) {
    relatoriosFiltroTexto = valor || '';
    renderAbaAtivaRelatorios();
}

function filtrarStatusNotasRelatorio(status) {
    relatoriosFiltroStatusNotas = status;
    ['pendente', 'arquivada', 'todas'].forEach(s => {
        const btn = document.getElementById(`relatorios-filtro-notas-${s}`);
        if (btn) btn.classList.toggle('active', s === status);
    });
    renderAbaAtivaRelatorios();
}

function filtrarStatusDivergenciaRelatorio(status) {
    relatoriosFiltroStatusDivergencia = status;
    ['pendente', 'resolvida', 'encerrada', 'todas'].forEach(s => {
        const btn = document.getElementById(`relatorios-filtro-div-${s}`);
        if (btn) btn.classList.toggle('active', s === status);
    });
    renderAbaAtivaRelatorios();
}

function renderAbaAtivaRelatorios() { agendarRender('relatorios', renderAbaAtivaRelatoriosAgora); }
function renderAbaAtivaRelatoriosAgora() {
    const container = document.getElementById('relatorios-conteudo-aba');
    if (!container) return; // tela de relatórios ainda não está no DOM (login, etc.)
    preencherOpcoesFiltrosRelatorio();
    renderFiltrosAtivosRelatorio();
    renderIndicadoresRelatorio();
    if (relatoriosAbaAtiva === 'notas') renderRelatorioNotas(container);
    else if (relatoriosAbaAtiva === 'divergencias') renderRelatorioDivergencias(container);
    else if (relatoriosAbaAtiva === 'auditorias') renderRelatorioAuditorias(container);
    else renderRelatorioPedidos(container);
}

function renderRelatorioPedidos(container) {
    const termo = normalizarBuscaRel(relatoriosFiltroTexto);
    const resumo = document.getElementById('relatorios-resumo');

    if (avisoFiltroInaplicavelRel('pedidos', container)) return;
    let pedidos = listaCotacoes.filter(c => pedidoPassaFiltrosRel(c) && pedidoCasaTermoRel(c, termo));

    if (resumo) resumo.textContent = `${pedidos.length} pedido(s) encontrado(s)`;

    if (pedidos.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhum pedido encontrado.</div>';
        return;
    }

    container.innerHTML = pedidos.map(c => {
        const nota = listaAnotacoes.find(a => a.pedido === c.pedido);
        const todasDivergencias = [];
        (nota && nota.ocorrencias ? nota.ocorrencias : []).forEach(oc => (oc.divergencias || []).forEach(d => todasDivergencias.push(d)));
        const pendentes = todasDivergencias.filter(d => (d.status || 'pendente') === 'pendente').length;
        const numFornecedores = (c.fornecedores || []).length;

        return `<div class="nota-item" style="cursor:pointer;" onclick="abrirCentralPedido('${c.pedido}')">
            <div class="nota-info">${escRel(c.pedido)} ${c.origem ? `<span class="txt-suave">— ${escRel(c.origem)}</span>` : ''}</div>
            <div class="nota-detalhes">${numFornecedores} fornecedor(es) cotado(s)${c.dataPedido ? ` | Pedido em ${escRel(c.dataPedido)}` : ''}</div>
            <div class="nota-detalhes">${todasDivergencias.length ? `${todasDivergencias.length} divergência(s) registrada(s)${pendentes ? `, <strong style="color:var(--button-danger);">${pendentes} pendente(s)</strong>` : ''}` : 'Nenhuma divergência registrada'}</div>
        </div>`;
    }).join('');
}

function renderRelatorioNotas(container) {
    const termo = normalizarBuscaRel(relatoriosFiltroTexto);
    const resumo = document.getElementById('relatorios-resumo');
    if (avisoFiltroInaplicavelRel('notas', container)) return;

    let notas = [];
    if (relatoriosFiltroStatusNotas === 'pendente') notas = notasPendentes.map(n => ({ ...n, _statusRel: 'pendente' }));
    else if (relatoriosFiltroStatusNotas === 'arquivada') notas = historicoNotas.map(n => ({ ...n, _statusRel: 'arquivada' }));
    else notas = [...notasPendentes.map(n => ({ ...n, _statusRel: 'pendente' })), ...historicoNotas.map(n => ({ ...n, _statusRel: 'arquivada' }))];

    notas = notas.filter(n => notaPassaFiltrosRel(n) && notaCasaTermoRel(n, termo));

    if (resumo) resumo.textContent = `${notas.length} nota(s) encontrada(s)${relatoriosFiltros.destino ? ' — NFs sem pedido/destino identificado ficam fora do filtro de Destino' : ''}`;

    if (notas.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhuma nota encontrada.</div>';
        return;
    }

    container.innerHTML = notas.map(n => {
        const badgeClass = n._statusRel === 'pendente' ? 'status-pendente' : 'status-encerrada';
        const badgeTexto = n._statusRel === 'pendente' ? 'Pendente' : 'Arquivada';
        return `<div class="nota-item">
            <div class="nota-info">${escRel(n.fornecedor)} ${escRel(n.nf)} <span class="central-status-badge ${badgeClass}">${badgeTexto}</span></div>
            <div class="nota-detalhes">Venc: ${escRel(n.vencimento) || 'N/A'} | Valor: ${escRel(n.valor) || 'N/A'}</div>
            ${n.obs ? `<div class="nota-detalhes">Obs: ${escRel(n.obs)}</div>` : ''}
        </div>`;
    }).join('');
}

function renderRelatorioDivergencias(container) {
    const termo = normalizarBuscaRel(relatoriosFiltroTexto);
    const resumo = document.getElementById('relatorios-resumo');

    if (avisoFiltroInaplicavelRel('divergencias', container)) return;
    const todas = divergenciasRel();

    let filtradas = relatoriosFiltroStatusDivergencia === 'todas' ? todas : todas.filter(x => x.status === relatoriosFiltroStatusDivergencia);
    if (termo) filtradas = filtradas.filter(x => auditoriaCasaTermoRel(x, termo));

    if (resumo) resumo.textContent = `${filtradas.length} divergência(s) encontrada(s)`;

    const rankingsHTML = htmlRankingsRel(filtradas);
    if (filtradas.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhuma divergência encontrada.</div>';
        return;
    }

    container.innerHTML = rankingsHTML + filtradas.map(x => {
        const def = TIPOS_DIVERGENCIA_AUDITORIA[x.tipo];
        const badgeTexto = x.status === 'pendente' ? 'Pendente' : x.status === 'resolvida' ? 'Resolvida' : 'Encerrada';
        const linhasHTML = x.linhas.length ? x.linhas.map(l => `<div class="central-item-linha">${escRel(l)}</div>`).join('') : '';
        return `<div class="nota-item" ${x.pedido ? `style="cursor:pointer;" onclick="abrirCentralPedido('${x.pedido}')"` : ''}>
            <div class="nota-info">${escRel(x.pedido) || 'Sem pedido'} ${x.fornecedor ? `<span class="txt-suave">— ${escRel(upAud(x.fornecedor))}</span>` : ''} <span class="central-status-badge status-${x.status}">${badgeTexto}</span></div>
            <div class="nota-detalhes">${def ? escRel(def.label) : escRel(x.tipo)}${x.notaFiscal ? ` | NF ${escRel(x.notaFiscal)}` : ''}</div>
            ${linhasHTML}
        </div>`;
    }).join('');
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
let relRankingAtual = { tipo: [], fornecedor: [], produto: [] };
let relCtxCache = { refs: null, map: new Map() };
// Filtros que não existem pra um tipo de registro (ex.: NF não tem "tipo de
// divergência"; divergência não tem "recurso" seguro) — nesse caso a aba avisa
// em vez de mostrar um número que não reflete o filtro.
const REL_INAPLICAVEL = { notas: ['tipo', 'produto'], pedidos: ['tipo', 'produto'], auditorias: ['recurso'], divergencias: ['recurso'] };
const REL_NOMES_FILTRO = { tipo: 'Tipo de divergência', produto: 'Produto', recurso: 'Recurso' };
const REL_NOMES_DATASET = { notas: 'notas', pedidos: 'pedidos', auditorias: 'auditorias', divergencias: 'divergências' };

function filtrosInaplicaveisRel(dataset) {
    return REL_INAPLICAVEL[dataset].filter(k => relatoriosFiltros[k]).map(k => REL_NOMES_FILTRO[k]);
}
function avisoFiltroInaplicavelRel(dataset, container) {
    const ina = filtrosInaplicaveisRel(dataset);
    if (!ina.length) return false;
    const resumo = document.getElementById('relatorios-resumo');
    if (resumo) resumo.textContent = '';
    container.innerHTML = `<div class="empty-state">O filtro "${ina.join('", "')}" não se aplica a ${REL_NOMES_DATASET[dataset]}. Limpe-o pra ver estes registros.</div>`;
    return true;
}

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
    const nomes = def && def.multiMaterial
        ? (d.materiais || []).map(m => m.produto || m.produtoPedido)
        : [(d.campos || {}).produto];
    return [...new Set(nomes.map(n => (n || '').toString().trim().toUpperCase()).filter(Boolean))];
}
// Uma "auditoria" = uma ocorrência registrada em "Nova Auditoria".
function auditoriasBaseRel() {
    const f = relatoriosFiltros;
    const lista = [];
    listaAnotacoes.forEach(a => (a.ocorrencias || []).forEach(oc => {
        const x = { pedido: a.pedido || '', fornecedor: oc.fornecedor || '', notaFiscal: oc.notaFiscal || '', data: dataRel(oc.data) ? oc.data : (oc.criadoEm || ''), observacaoGeral: oc.observacaoGeral || '', divergencias: oc.divergencias || [] };
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
function divergenciasRel() {
    const todas = [];
    auditoriasBaseRel().forEach(x => x.divergencias.filter(divPassaFiltrosRel).forEach(d => {
        todas.push({ pedido: x.pedido, fornecedor: x.fornecedor, notaFiscal: x.notaFiscal, tipo: d.tipo, status: d.status || 'pendente', linhas: linhasDeMateriais(d), produtos: produtosDivergenciaRel(d) });
    }));
    return todas;
}
function auditoriaCasaTermoRel(x, termo) {
    return normalizarBuscaRel(x.pedido).includes(termo) || normalizarBuscaRel(x.fornecedor).includes(termo) || normalizarBuscaRel(x.notaFiscal).includes(termo);
}

function renderRelatorioAuditorias(container) {
    const termo = normalizarBuscaRel(relatoriosFiltroTexto);
    const resumo = document.getElementById('relatorios-resumo');
    if (avisoFiltroInaplicavelRel('auditorias', container)) return;
    let lista = auditoriasRel();
    if (termo) lista = lista.filter(x => auditoriaCasaTermoRel(x, termo));
    if (resumo) resumo.textContent = `${lista.length} auditoria(s) encontrada(s)`;
    if (lista.length === 0) { container.innerHTML = '<div class="empty-state">Nenhuma auditoria encontrada.</div>'; return; }
    lista.sort((a, b) => ((dataRel(b.data) || 0) - (dataRel(a.data) || 0)));
    container.innerHTML = lista.map(x => {
        const tipos = [...new Set(x.divergencias.map(d => (TIPOS_DIVERGENCIA_AUDITORIA[d.tipo] || {}).label || d.tipo))];
        const dataTxt = dataRel(x.data) ? dataRel(x.data).toLocaleDateString('pt-BR') : 'sem data';
        return `<div class="nota-item" ${x.pedido ? `style="cursor:pointer;" onclick="abrirCentralPedido('${x.pedido}')"` : ''}>
            <div class="nota-info">${escRel(x.pedido) || 'Sem pedido'} ${x.fornecedor ? `<span class="txt-suave">— ${escRel(upAud(x.fornecedor))}</span>` : ''}</div>
            <div class="nota-detalhes">${x.notaFiscal ? `NF ${escRel(x.notaFiscal)} | ` : ''}${dataTxt} | ${x.divergencias.length} divergência(s)${tipos.length ? `: ${escRel(tipos.join(', '))}` : ''}</div>
            ${x.observacaoGeral ? `<div class="nota-detalhes">${escRel(x.observacaoGeral)}</div>` : ''}
        </div>`;
    }).join('');
}

// --- Indicadores (números em destaque) ---
function calcularIndicadoresRel() {
    const termo = normalizarBuscaRel(relatoriosFiltroTexto);
    const notas = filtrosInaplicaveisRel('notas').length ? null : todasNotasRel().filter(n => notaPassaFiltrosRel(n) && notaCasaTermoRel(n, termo));
    const pedidos = filtrosInaplicaveisRel('pedidos').length ? null : listaCotacoes.filter(c => pedidoPassaFiltrosRel(c) && pedidoCasaTermoRel(c, termo));
    const auditorias = filtrosInaplicaveisRel('auditorias').length ? null : auditoriasRel().filter(x => !termo || auditoriaCasaTermoRel(x, termo));
    const divergencias = filtrosInaplicaveisRel('divergencias').length ? null : divergenciasRel().filter(x => !termo || auditoriaCasaTermoRel(x, termo));
    return { notas, pedidos, auditorias, divergencias };
}
function renderIndicadoresRelatorio() {
    const el = document.getElementById('relatorios-indicadores');
    if (!el) return;
    const ind = calcularIndicadoresRel();
    const card = (aba, rotulo, lista, sub) => `<div class="kpi" onclick="irParaAbaRelatorio('${aba}')">
        <div class="kpi-label">${rotulo}</div>
        <div class="kpi-value">${lista ? lista.length : '—'}</div>
        <div class="kpi-sub">${lista ? sub : 'filtro não se aplica'}</div>
    </div>`;
    const total = ind.notas ? ind.notas.reduce((t, n) => t + parseValorBR(n.valor), 0) : 0;
    const semValor = ind.notas ? ind.notas.filter(n => parseValorBR(n.valor) === 0).length : 0;
    const divPend = ind.divergencias ? ind.divergencias.filter(d => d.status === 'pendente').length : 0;
    const audComDiv = ind.auditorias ? ind.auditorias.filter(a => a.divergencias.length).length : 0;
    el.innerHTML = `<div class="kpi-grid">
        ${card('notas', 'NFs', ind.notas, `R$ ${formatValorBR(total)}${semValor ? ` · ${semValor} sem valor` : ''}`)}
        ${card('pedidos', 'Pedidos', ind.pedidos, 'cotações registradas')}
        ${card('auditorias', 'Auditorias', ind.auditorias, `${audComDiv} com divergência`)}
        ${card('divergencias', 'Divergências', ind.divergencias, `${divPend} pendente(s)`)}
    </div>`;
}
// Tocar no indicador abre a lista que o compõe (mesmos filtros; status = todas,
// pra a lista ter exatamente a contagem do indicador).
function irParaAbaRelatorio(aba) {
    if (aba === 'notas') filtrarStatusNotasRelatorio('todas');
    if (aba === 'divergencias') filtrarStatusDivergenciaRelatorio('todas');
    mudarAbaRelatorios(aba);
}

// --- Rankings da aba Divergências (por tipo, fornecedor e produto) ---
function htmlRankingsRel(divs) {
    const contar = (chaveFn, rotuloFn) => {
        const m = new Map();
        divs.forEach(d => chaveFn(d).forEach(k => {
            const atual = m.get(k.chave) || { chave: k.chave, label: k.label, n: 0 };
            atual.n++;
            m.set(k.chave, atual);
        }));
        return [...m.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
    };
    relRankingAtual = {
        tipo: contar(d => [{ chave: d.tipo, label: (TIPOS_DIVERGENCIA_AUDITORIA[d.tipo] || {}).label || d.tipo }]),
        fornecedor: contar(d => [{ chave: normalizarBuscaRel(d.fornecedor).trim() || '(sem)', label: upAud(d.fornecedor) || 'Fornecedor não informado' }]),
        produto: contar(d => d.produtos.map(p => ({ chave: p, label: p })))
    };
    const bloco = (tipo, titulo) => {
        const itens = relRankingAtual[tipo];
        if (!itens.length) return '';
        const linhas = itens.slice(0, 10).map((it, i) => `<div class="rank-linha" onclick="filtrarPorRankingRelatorio('${tipo}', ${i})"><span>${escRel(it.label)}</span><strong>${it.n}</strong></div>`).join('');
        return `<div class="rank-bloco"><div class="rank-titulo">${titulo}${itens.length > 10 ? ` (10 de ${itens.length})` : ''}</div>${linhas}</div>`;
    };
    return `<div class="rank-bloco">${bloco('tipo', 'Divergências por tipo')}${bloco('fornecedor', 'Divergências por fornecedor')}${bloco('produto', 'Produtos com mais divergências')}<div class="txt-aux">Toque numa linha pra filtrar a lista abaixo por ela.</div></div>`;
}
function filtrarPorRankingRelatorio(tipo, idx) {
    const it = (relRankingAtual[tipo] || [])[idx];
    if (!it) return;
    if (it.chave === '(sem)') return toast('Sem fornecedor informado nestes registros — não há como filtrar por ele.');
    if (tipo === 'tipo') relatoriosFiltros.tipo = it.chave;
    else if (tipo === 'fornecedor') { relatoriosFiltros.fornecedor = it.label; relatoriosFiltros.fornecedorExato = true; }
    else relatoriosFiltros.produto = it.chave;
    sincronizarCamposFiltrosRelatorio();
    renderAbaAtivaRelatorios();
}

// --- Filtros ---
function definirFiltroRelatorio(campo, valor) {
    relatoriosFiltros[campo] = valor || '';
    if (campo === 'fornecedor') relatoriosFiltros.fornecedorExato = false; // digitado à mão = busca parcial
    renderAbaAtivaRelatorios();
}
function limparFiltrosRelatorio() {
    relatoriosFiltros = { de: '', ate: '', fornecedor: '', fornecedorExato: false, destino: '', recurso: '', tipo: '', produto: '' };
    sincronizarCamposFiltrosRelatorio();
    renderAbaAtivaRelatorios();
}
function sincronizarCamposFiltrosRelatorio() {
    [['de', 'rel-f-de'], ['ate', 'rel-f-ate'], ['fornecedor', 'rel-f-fornecedor'], ['destino', 'rel-f-destino'], ['recurso', 'rel-f-recurso'], ['tipo', 'rel-f-tipo']].forEach(([k, id]) => {
        const el = document.getElementById(id);
        if (el) el.value = relatoriosFiltros[k];
    });
}
// Opções vêm só do que existe nos registros (nada inventado); só reescreve
// quando a lista muda, pra não atrapalhar a digitação/seleção.
function preencherOpcoesFiltrosRelatorio() {
    const unicos = arr => { const m = new Map(); arr.forEach(v => { const t = (v || '').toString().trim(); if (t && !m.has(normalizarBuscaRel(t))) m.set(normalizarBuscaRel(t), t); }); return [...m.values()].sort((a, b) => a.localeCompare(b, 'pt-BR')); };
    const atualiza = (id, assinatura, montar) => {
        const el = document.getElementById(id);
        if (!el || el.dataset.assinatura === assinatura) return;
        el.dataset.assinatura = assinatura;
        const valor = el.value;
        montar(el);
        el.value = valor;
    };
    const recursos = unicos([...notasPendentes.map(n => n.obs), ...historicoNotas.map(n => n.obs), ...listaCotacoes.flatMap(c => Object.values(c.recursosPorItem || {}))]);
    atualiza('rel-f-recurso', recursos.join('|'), el => { el.innerHTML = '<option value="">Todos</option>' + recursos.map(r => `<option value="${escRel(r).replace(/"/g, '&quot;')}">${escRel(r)}</option>`).join(''); });
    const fornecedores = unicos([...notasPendentes.map(n => n.fornecedor), ...historicoNotas.map(n => n.fornecedor), ...listaAnotacoes.flatMap(a => (a.ocorrencias || []).map(oc => oc.fornecedor)), ...listaCotacoes.flatMap(c => (c.fornecedores || []).map(f => f.razaoSocial))]);
    atualiza('rel-f-fornecedores', fornecedores.join('|'), el => { el.innerHTML = fornecedores.map(f => `<option value="${escRel(f).replace(/"/g, '&quot;')}"></option>`).join(''); });
    const tipos = Object.keys(TIPOS_DIVERGENCIA_AUDITORIA);
    atualiza('rel-f-tipo', tipos.join('|'), el => { el.innerHTML = '<option value="">Todos</option>' + tipos.map(t => `<option value="${t}">${escRel(TIPOS_DIVERGENCIA_AUDITORIA[t].label)}</option>`).join(''); });
}
function renderFiltrosAtivosRelatorio() {
    const el = document.getElementById('relatorios-filtros-ativos');
    if (!el) return;
    const f = relatoriosFiltros;
    const partes = [];
    if (f.de || f.ate) partes.push(`Período: ${f.de ? dataRel(f.de).toLocaleDateString('pt-BR') : '…'} a ${f.ate ? dataRel(f.ate).toLocaleDateString('pt-BR') : '…'}`);
    if (f.fornecedor) partes.push(`Fornecedor: ${f.fornecedor}${f.fornecedorExato ? ' (exato)' : ''}`);
    if (f.destino) partes.push(`Destino: ${f.destino}`);
    if (f.recurso) partes.push(`Recurso: ${f.recurso}`);
    if (f.tipo) partes.push(`Tipo: ${(TIPOS_DIVERGENCIA_AUDITORIA[f.tipo] || {}).label || f.tipo}`);
    if (f.produto) partes.push(`Produto: ${f.produto}`);
    if (!partes.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = 'flex';
    el.innerHTML = `<span style="flex:1;">Filtros ativos: ${partes.map(escRel).join(' · ')}</span><button type="button" class="action-chip edit-chip" onclick="limparFiltrosRelatorio()">Limpar</button>`;
}


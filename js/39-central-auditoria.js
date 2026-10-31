// 39-central-auditoria.js — Central de auditoria (2.19.0)
// Uma lista única de ocorrências, UMA por item, vinda de compararFontesPedido (mesma fonte da Central do pedido, da Entrada de NF,
// da Central de notificações e dos relatórios). Aqui você relata, aplica o fator de unidade, exclui (e restaura). Nada é calculado
// por conta própria: o estado vem de estadoOcorrenciaItem (detectada = em aberto · relatada · resolvida · excluída = descartada).

let audFiltro = 'detectada';
let audBusca = '';
let audAbertos = new Set();
let audLimite = 40;

function prepararCentralAuditoria() { audFiltro = 'detectada'; audBusca = ''; audAbertos = new Set(); audLimite = 40; renderCentralAuditoria(); }
function renderCentralAuditoriaSeAtiva() { const t = document.getElementById('screen-auditoria-central'); if (t && t.classList.contains('active')) renderCentralAuditoria(); }

// Todas as ocorrências (uma por item de cotação com divergência, auditoria ligada ou exclusão).
function listarOcorrenciasAuditoria() {
    const out = [];
    listaCotacoes.forEach(cot => {
        let comp = [];
        try { comp = compararFontesPedido(cot.pedido); } catch (e) { return; }
        comp.forEach(i => {
            const excluida = !!i.descartado && (i.divergenciasDescartadas || []).length > 0;
            if (!i.divergencias.length && !(i.auditorias || []).length && !excluida) return;
            const forn = (cot.fornecedores || []).find(f => mesmoCnpj(f.cnpj, i.cnpjFornecedor));
            const divs = excluida ? i.divergenciasDescartadas : i.divergencias;
            out.push({
                pedido: String(cot.pedido), codProduto: i.codProduto, nome: i.nome,
                fornecedor: forn ? nomeExibicaoFornecedor(forn.razaoSocial, forn.cnpj) : '',
                nfs: i.nfs || [], divs, estado: excluida ? 'excluida' : i.estado, naoChegou: !excluida && !!i.soNaoChegou, item: i
            });
        });
    });
    const peso = { detectada: 0, naochegou: 1, relatada: 2, resolvida: 3, excluida: 4 };
    out.forEach(o => { o.grupo = o.estado === 'detectada' && o.naoChegou ? 'naochegou' : o.estado; });
    out.sort((a, b) => (peso[a.grupo] - peso[b.grupo]) || (Number(b.pedido) - Number(a.pedido)) || String(a.fornecedor).localeCompare(String(b.fornecedor)) || String(a.nome).localeCompare(String(b.nome)));
    return out;
}
function textoOcorrenciaAud(o) { return o.divs.map(d => textoDivergenciaNatural(d)).join(' '); }
function sugestaoUnidadeAud(o) {
    const d = o.divs.find(x => x.tipo === 'unidade_diferente' && !x.aplicado);
    return d ? { fator: d.fator, par: d.par } : null;
}
function seloAud(estado, o) {
    if (estado === 'excluida') return '<span class="xml-item-badge neutro">Excluída</span>';
    const qtd = o ? o.divs.filter(d => !d.aplicado).length : 0;
    return seloEstadoOcorrencia(estado, qtd, o ? o.naoChegou : false);
}
function audAlternarAberto(chave) { if (audAbertos.has(chave)) audAbertos.delete(chave); else audAbertos.add(chave); renderCentralAuditoria(); }
function audFiltrar(f) { audFiltro = f; audLimite = 40; renderCentralAuditoria(); }
function audMais() { audLimite += 40; renderCentralAuditoria(); }
function audBuscar(v) { audBusca = v || ''; audLimite = 40; renderCentralAuditoria(); const el = document.getElementById('aud-busca'); if (el) { el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) { } } }
function audAplicarFator(pedido, cod, par, fator) { alterarFatorUnidadeItem(pedido, cod, par, fator); }
function audFatorManual(pedido, cod, par) {
    const el = document.getElementById('aud-fator-' + pedido + '-' + cod);
    const v = el ? Number(String(el.value).replace(',', '.')) : NaN;
    if (!(v > 0)) return toast('Informe um fator maior que zero.');
    alterarFatorUnidadeItem(pedido, cod, par, v);
}
// Relata de uma vez todas as ocorrências em aberto de um fornecedor+pedido (ex.: vários "não faturado").
async function audRelatarVarias(pedido, fornecedor) {
    const alvo = listarOcorrenciasAuditoria().filter(o => o.grupo === audFiltro && o.pedido === pedido && o.fornecedor === fornecedor);
    for (const o of alvo) await gravarMarcaItemCotacao(pedido, 'relatadosPorItem', o.codProduto, { data: dataLocalISO() });
    toast(`✓ ${alvo.length} ocorrência(s) marcada(s) como relatada(s).`);
    refrescarTelasOcorrencias();
}

function renderCentralAuditoria() {
    const el = document.getElementById('auditoria-central-conteudo'); if (!el) return;
    const todas = listarOcorrenciasAuditoria();
    const conta = e => todas.filter(o => o.grupo === e).length;
    const rot = { detectada: 'Em aberto', naochegou: 'Não chegou', relatada: 'Relatadas', resolvida: 'Resolvidas', excluida: 'Excluídas' };
    const dica = {
        detectada: 'O app achou a diferença e você ainda não relatou. Conta como pendente.',
        naochegou: 'Itens da cotação que ainda não vieram em NF. Não é divergência (pode vir em outra NF), mas dá para relatar igual.',
        relatada: 'Já avisado ao responsável. Não pede mais atenção sua.',
        resolvida: 'Você viu e resolveu (ou foi só a unidade). Fica aqui para consulta.',
        excluida: 'Falsos positivos que você excluiu. Dá para restaurar.'
    };
    const termo = normalizarBuscaRel(audBusca);
    let lista = todas.filter(o => o.grupo === audFiltro);
    if (termo) lista = lista.filter(o => normalizarBuscaRel([o.pedido, o.fornecedor, o.nome, o.nfs.join(' ')].join(' ')).includes(termo));
    const chips = ['detectada', 'naochegou', 'relatada', 'resolvida', 'excluida'].map(k => `<button type="button" class="retro-chip${audFiltro === k ? ' on' : ''}" onclick="audFiltrar('${k}')">${rot[k]} (${conta(k)})</button>`).join('');
    const corpo = lista.slice(0, audLimite).map(o => {
        const chave = o.pedido + '::' + o.codProduto;
        const aberto = audAbertos.has(chave);
        const p = escRel(o.pedido), c = escRel(o.codProduto);
        const sug = sugestaoUnidadeAud(o);
        const aplicada = o.divs.find(d => d.tipo === 'unidade_diferente' && d.aplicado);
        const acoes = [];
        if (o.estado === 'detectada') acoes.push(`<button type="button" class="central-status-toggle" onclick="relatarOcorrenciaItem('${p}','${c}')">Marcar como relatada</button>`);
        if (o.estado === 'relatada' && o.item.relatadoManual) acoes.push(`<button type="button" class="central-status-toggle" onclick="desfazerRelatoOcorrenciaItem('${p}','${c}')">Voltar para em aberto</button>`);
        if (o.estado === 'excluida') acoes.push(`<button type="button" class="central-status-toggle" onclick="restaurarOcorrenciaItem('${p}','${c}')">Restaurar</button>`);
        else acoes.push(`<button type="button" class="central-status-toggle is-danger" onclick="descartarOcorrenciaItem('${p}','${c}')">Excluir</button>`);
        const sugHTML = sug ? `<div class="aud-sug"><b>Parece só diferença de unidade.</b> Quantidade e valor mudaram em proporção inversa e o total fecha. Se ${sug.par === 'nf_erp' ? '1 un. do ERP' : '1 un. da NF'} = ${sug.fator >= 1 ? sug.fator : '1/' + Math.round(1 / sug.fator)} ${sug.par === 'nf_erp' ? 'da NF' : 'da cotação'}, não há divergência real.
            <div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="audAplicarFator('${p}','${c}','${sug.par}',${sug.fator})">Aplicar fator ${sug.fator >= 1 ? sug.fator : '1/' + Math.round(1 / sug.fator)}</button></div></div>` : '';
        const aplicadaHTML = aplicada ? `<div class="aud-sug ok"><b>Fator ${aplicada.fator >= 1 ? aplicada.fator : '1/' + Math.round(1 / aplicada.fator)} aplicado.</b> Vale para este produto nas próximas NFs.
            <div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="audAplicarFator('${p}','${c}','${aplicada.par}',null)">Desfazer fator</button></div></div>` : '';
        const detalhe = aberto ? `<div class="aud-detalhe">
            ${sugHTML}${aplicadaHTML}
            ${!sug && !aplicada && o.divs.some(d => d.tipo === 'quantidade_cotada_nf' || d.tipo === 'valor_cotado_nf' || d.tipo === 'quantidade_nf_erp' || d.tipo === 'valor_nf_erp') ? `<div class="xml-item-meta">Se for só diferença de unidade/embalagem, informe o fator:</div>
            <div class="xml-item-acao"><input type="number" min="0" step="any" class="form-field aud-fator" id="aud-fator-${p}-${c}" placeholder="un. por embalagem">
            ${o.divs.some(d => d.tipo === 'quantidade_cotada_nf' || d.tipo === 'valor_cotado_nf') ? `<button type="button" class="central-status-toggle" onclick="audFatorManual('${p}','${c}','cotacao_nf')">Aplicar (NF × cotação)</button>` : ''}
            ${o.divs.some(d => d.tipo === 'quantidade_nf_erp' || d.tipo === 'valor_nf_erp') ? `<button type="button" class="central-status-toggle" onclick="audFatorManual('${p}','${c}','nf_erp')">Aplicar (ERP × NF)</button>` : ''}</div>` : ''}
            <div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="abrirCentralPedido('${p}'); switchToScreen('screen-central-pedido','Central do pedido')">Abrir o pedido</button>
            ${o.estado === 'detectada' && o.divs.some(d => !d.aplicado && d.tipo !== 'unidade_diferente') ? `<button type="button" class="central-status-toggle" onclick="registrarDivergenciaDaComparacao('${p}','${c}')">Gerar texto da auditoria</button>` : ''}</div>
        </div>` : '';
        return `<div class="ctl-card aud-card">
            <div class="ctl-top"><div class="ctl-nm"><b>${escRel(o.nome)}</b><small>${escRel(o.fornecedor || 'Fornecedor')} · pedido ${p}${o.nfs.length ? ' · NF ' + escRel(o.nfs.join(', ')) : ''}</small></div>${seloAud(o.estado, o)}</div>
            <div class="aud-txt">${o.divs.map(d => '• ' + escRel(textoDivergenciaNatural(d))).join('<br>')}</div>
            <div class="xml-item-acao">${acoes.join('')}<button type="button" class="central-status-toggle" onclick="audAlternarAberto('${escRel(chave)}')">${aberto ? 'Fechar' : 'Abrir'}</button></div>
            ${detalhe}
        </div>`;
    }).join('');
    // atalho: relatar todas de um fornecedor+pedido quando há várias em aberto
    let lote = '';
    if (audFiltro === 'detectada' || audFiltro === 'naochegou') {
        const grupos = new Map();
        lista.forEach(o => { const k = o.pedido + '||' + o.fornecedor; grupos.set(k, (grupos.get(k) || 0) + 1); });
        lote = [...grupos.entries()].filter(([, n]) => n > 1).map(([k, n]) => { const [ped, forn] = k.split('||'); return `<button type="button" class="central-status-toggle" onclick="audRelatarVarias('${escRel(ped)}','${escRel(forn).replace(/'/g, '&#39;')}')">Relatar as ${n} de ${escRel(forn || 'fornecedor')} (pedido ${escRel(ped)})</button>`; }).join('');
        if (lote) lote = `<div class="xml-item-acao aud-lote">${lote}</div>`;
    }
    el.innerHTML = `<div class="card"><div class="xml-item-meta">Todas as ocorrências, uma por item. Salvar uma NF só cria ocorrências em aberto: ficam "relatadas" quando você marca aqui.</div>
        <div class="retro-chips" style="margin-top:var(--space-3)">${chips}</div>
        <input type="search" class="form-field" id="aud-busca" placeholder="Buscar pedido, fornecedor ou produto" value="${escRel(audBusca)}" oninput="audBuscar(this.value)" style="margin-top:8px">
        <div class="xml-item-meta" style="margin-top:6px">${dica[audFiltro]}</div></div>`
        + lote
        + (audFiltro === 'detectada' && /^\d+$/.test(String(audBusca).trim()) && lista.length ? `<div class="xml-item-acao aud-lote"><button type="button" class="central-status-toggle" onclick="exportarDivergenciasPedido('${escRel(String(audBusca).trim())}')">Exportar as divergências do pedido ${escRel(String(audBusca).trim())}</button></div>` : '')
        + (corpo || `<div class="card"><div class="xml-item-meta">Nada neste estado.</div></div>`)
        + (lista.length > audLimite ? `<div class="actions"><button type="button" class="actions-button is-neutral" onclick="audMais()">Mostrar mais (${lista.length - audLimite})</button></div>` : '');
}

// 2.19.1: exporta (compartilha/copia) de uma vez as ocorrências em aberto de TODOS os fornecedores de um pedido, num texto só, agrupado por
// fornecedor. Não depende de abrir uma auditoria por vez. Depois pergunta se marca tudo como relatado (copiar/enviar não relata sozinho).
function textoDivergenciasPedido(pedido) {
    const todas = listarOcorrenciasAuditoria().filter(o => o.pedido === String(pedido) && o.estado === 'detectada');
    if (!todas.length) return { texto: '', ocorrencias: [] };
    const porForn = new Map();
    todas.forEach(o => { const k = o.fornecedor || 'Fornecedor não identificado'; if (!porForn.has(k)) porForn.set(k, []); porForn.get(k).push(o); });
    const blocos = [];
    porForn.forEach((lista, forn) => {
        const nfs = [...new Set(lista.flatMap(o => o.nfs))];
        const reais = lista.filter(o => !o.naoChegou);
        const nc = lista.filter(o => o.naoChegou);
        const linhas = [];
        reais.forEach(o => o.divs.filter(d => !d.aplicado && d.tipo !== 'unidade_diferente').forEach(d => linhas.push('• ' + textoDivergenciaNatural(d))));
        if (nc.length) linhas.push(`Itens que ainda não chegaram: ${nc.map(o => o.nome).join('; ')}.`);
        if (linhas.length) blocos.push(`*${forn}*${nfs.length ? ' — NF ' + nfs.join(', ') : ''}\n${linhas.join('\n')}`);
    });
    return { texto: blocos.length ? `*Pedido ${pedido} — divergências*\n\n` + blocos.join('\n\n———\n\n') : '', ocorrencias: todas };
}
async function exportarDivergenciasPedido(pedido) {
    if (!pedido) return;
    const { texto, ocorrencias } = textoDivergenciasPedido(pedido);
    if (!texto) return toast('Nenhuma divergência em aberto neste pedido para exportar.');
    let enviou = false;
    try {
        if (navigator.share) { await navigator.share({ title: 'Divergências do pedido ' + pedido, text: texto }); enviou = true; }
        else { await navigator.clipboard.writeText(texto); enviou = true; toast('✓ Divergências copiadas! Cole onde quiser.'); }
    } catch (e) { /* cancelou o compartilhamento */ }
    if (!enviou) return;
    showConfirmModal({
        title: 'Marcar como relatadas?',
        message: `Você exportou ${ocorrencias.length} ocorrência(s) do pedido ${pedido}. Marcar todas como relatadas? Se ainda não enviou a ninguém, deixe em aberto.`,
        confirmText: 'Marcar como relatadas', confirmClass: 'warning',
        onConfirm: async () => {
            for (const o of ocorrencias) await gravarMarcaItemCotacao(String(pedido), 'relatadosPorItem', o.codProduto, { data: dataLocalISO() });
            toast(`✓ ${ocorrencias.length} ocorrência(s) marcada(s) como relatada(s).`);
            refrescarTelasOcorrencias();
        }
    });
}

// 2.19.2: as telas que comparam vários pedidos de uma vez (Cotações, Mais, Atenção, Controle, Gerenciar, Central, Auditoria) rodam dentro de
// comMemoComparacao: cada pedido é comparado uma vez só por redesenho. Isso derrubou o tempo da troca de aba de ~3 s para menos de 0,3 s nos seus dados.
['renderTelaMais', 'rebuildNotasPendentesList', 'renderListaCotacoes', 'renderControleNfs', 'itensDeAtencao', 'renderBannerAtencao', 'renderAtencao',
 'renderCentralPedidoCompleto', 'renderCentralAuditoria', 'renderAbaAtivaRelatoriosAgora', 'renderHistoricoNfsAgora'].forEach(nome => {
    const orig = window[nome];
    if (typeof orig !== 'function') return;
    window[nome] = function () { return comMemoComparacao(() => orig.apply(this, arguments)); };
});

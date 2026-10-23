// 34-atencao.js — "O que precisa de atenção" (2.11.3)
// Parte do script do app. Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// Junta num painel só o que está parado ou envelhecendo, ordenado por urgência, com um toque que leva à tela que resolve.
// Só leitura: nenhuma regra de dados muda; tudo é calculado dos dados que o app já carrega.

let atencaoAbertos = new Set(['alta']);
function irParaRetroFiltro(f) { switchToScreen('screen-auditoria-retro', 'Auditoria Retroativa'); prepararAuditoriaRetroativa(); filtrarRetro(f); }
function irParaRelatorioDivergencias() { switchToScreen('screen-reports', 'Relatórios'); mudarAbaRelatorios('divergencias'); }

function diasDesdeISO(iso) { return iso ? Math.round((new Date(dataLocalISO() + 'T12:00:00') - new Date(String(iso).slice(0, 10) + 'T12:00:00')) / 86400000) : null; }

function itensDeAtencao() {
    const grupos = [];
    const add = (nivel, id, titulo, dica, linhas, acaoGeral) => { if (linhas.length) grupos.push({ nivel, id, titulo, dica, linhas, acaoGeral }); };
    const hoje = dataLocalISO();

    // ---- ALTA: nota na relação com vencimento vencido
    const vencidas = notasPendentes.filter(n => !n.enviada && n.vencimento).map(n => ({ n, iso: converterDataBRparaISO(n.vencimento) })).filter(x => x.iso && x.iso < hoje)
        .sort((a, b) => a.iso.localeCompare(b.iso));
    add('alta', 'notas-vencidas', 'Notas na relação com vencimento vencido', 'Ainda não foram enviadas ao financeiro.',
        vencidas.map(x => ({ t: `${x.n.fornecedor || '(sem fornecedor)'} · NF ${x.n.nf || '—'}`, s: `venceu em ${x.n.vencimento} (${diasDesdeISO(x.iso)} dia(s) atrás) · R$ ${x.n.valor || '—'}`, fn: "switchToScreen('screen-manage','Gerenciar NF')" })));

    // ---- ALTA: pedidos com prazo vencido e nenhum sinal de entrega
    const nfPorPedido = new Set(), erpPorPedido = new Set();
    listaNfsProcessadas.forEach(n => [n.pedido, ...(n.pedidos || [])].filter(Boolean).forEach(p => nfPorPedido.add(String(p))));
    listaEntradasErp.forEach(e => { const p = pedidoDoErpConfirmado(e); if (p) erpPorPedido.add(String(p)); });
    const semEntrega = listaCotacoes.filter(c => { const lim = (c.dataLimite || '').slice(0, 10); return lim && lim < hoje && !nfPorPedido.has(String(c.pedido)) && !erpPorPedido.has(String(c.pedido)) && !Object.keys(c.chegadasPorFornecedor || {}).length && (c.itens || []).length; })
        .sort((a, b) => String(a.dataLimite).localeCompare(String(b.dataLimite)));
    add('alta', 'pedidos-sem-entrega', 'Pedidos com prazo vencido e sem sinal de entrega', 'Sem NF no app, sem NF do ERP ligada e sem marca de "já chegou".',
        semEntrega.map(c => ({ t: `Pedido ${c.pedido}${c.origem ? ' — ' + c.origem : ''}`, s: `prazo ${dataBRdeISO(c.dataLimite)} (${diasDesdeISO(c.dataLimite)} dia(s) atrás) · ${(c.fornecedores || []).length} fornecedor(es)`, fn: `abrirCentralPedido('${escRel(c.pedido)}')` })));

    // ---- MÉDIA: divergências pendentes
    const pendDiv = [];
    listaAnotacoes.forEach(a => (a.ocorrencias || []).forEach(oc => (oc.divergencias || []).forEach(d => { const st = d.status || (a.status === 'concluido' ? 'resolvida' : 'pendente'); if (st === 'pendente') pendDiv.push({ a, d }); })));
    add('media', 'divergencias', 'Divergências pendentes', 'Abra em Relatórios → Divergências para resolver ou excluir.',
        pendDiv.map(x => ({ t: `Pedido ${x.a.pedido || '—'}${x.a.fornecedor ? ' · ' + x.a.fornecedor : ''}`, s: (TIPOS_DIVERGENCIA_AUDITORIA[x.d.tipo] || {}).label || x.d.tipo, fn: 'irParaRelatorioDivergencias()' })));

    // ---- MÉDIA: NFs do ERP com pedido sugerido / itens defasados
    const an = analiseRetroativaErp();
    const sug = an.filter(a => a.pedidoSt === 'sugerido');
    add('media', 'sugestoes', 'NFs do ERP com pedido sugerido para confirmar', 'A Auditoria Retroativa mostra a conferência de valor, datas e itens.',
        sug.map(a => ({ t: tituloFornNf(a.e.fornecedorNomeEditado || a.e.fornecedorNomeRelatorio || '', a.e.cnpjFornecedor, a.e.nf), s: a.pedido ? `sugerido: pedido ${a.pedido}` + ({ bate: ' · bate em tudo', conferir: ' · conferir', nao: ' · não parece' }[a.veredito] || '') : 'mais de um pedido candidato', fn: "irParaRetroFiltro('sugerido')" })));
    const def = an.filter(a => a.defasados > 0);
    add('media', 'defasados', 'Itens do ERP defasados', 'Atualizam sozinhos; o botão na Auditoria Retroativa faz na hora.',
        def.map(a => ({ t: tituloFornNf(a.e.fornecedorNomeEditado || a.e.fornecedorNomeRelatorio || '', a.e.cnpjFornecedor, a.e.nf), s: `${a.defasados} item(ns)`, fn: "irParaRetroFiltro('defasados')" })));

    // ---- MÉDIA: NFs do ERP paradas na pré-seleção
    const pre = listaEntradasErp.filter(e => e.statusFluxo === 'pre_selecao').map(e => ({ e, iso: converterDataBRparaISO(e.data) })).filter(x => x.iso && diasDesdeISO(x.iso) > 7).sort((a, b) => a.iso.localeCompare(b.iso));
    add('media', 'pre-selecao', 'NFs do ERP esperando decisão há mais de 7 dias', 'Decidir no Controle de NFs: relação, financeiro ou "não vai ao financeiro".',
        pre.map(x => ({ t: tituloFornNf(x.e.fornecedorNomeEditado || x.e.fornecedorNomeRelatorio || '', x.e.cnpjFornecedor, x.e.nf), s: `lançada em ${x.e.data} (${diasDesdeISO(x.iso)} dia(s))`, fn: `abrirEditorNf('${escRel(x.e.id)}')` })));

    // ---- MÉDIA: NF com XML sem pedido e sem marca de compra direta
    const semPed = listaNfsProcessadas.filter(n => nfSemPedidoPendente(n));
    add('media', 'nf-sem-pedido', 'NFs com XML sem pedido', 'Vincule a um pedido ou marque como compra direta.',
        semPed.map(n => ({ t: tituloFornNf(n.fornecedor || '', n.cnpjFornecedor, n.nf), s: 'sem pedido e sem marca de compra direta', fn: `abrirEditorNf('${escRel(n.id)}')` })));

    // ---- BAIXA: itens de NF sem recurso / sem produto
    const semRec = [];
    listaNfsProcessadas.forEach(n => {
        const cot = n.pedido ? listaCotacoes.find(c => String(c.pedido) === String(n.pedido)) : null;
        const qtd = (n.itens || []).filter(i => { const r = i.semCotacao ? i.recurso : (cot && i.codigoSmartCompras ? (cot.recursosPorItem || {})[i.codigoSmartCompras] : null); return !r; }).length;
        if (qtd) semRec.push({ n, qtd });
    });
    add('baixa', 'sem-recurso', 'NFs com itens sem recurso definido', 'Defina no Editor da NF (Dados desta NF → recurso da NF inteira).',
        semRec.map(x => ({ t: tituloFornNf(x.n.fornecedor || '', x.n.cnpjFornecedor, x.n.nf), s: `${x.qtd} de ${(x.n.itens || []).length} item(ns) sem recurso`, fn: `abrirEditorNf('${escRel(x.n.id)}')` })));
    const semProd = listaNfsProcessadas.map(n => ({ n, qtd: (n.itens || []).filter(i => !i.semCotacao && !i.codigoSmartCompras).length })).filter(x => x.qtd);
    add('baixa', 'sem-produto', 'NFs com itens sem produto da cotação', 'Associe o produto no Editor da NF ou na Entrada de NF.',
        semProd.map(x => ({ t: tituloFornNf(x.n.fornecedor || '', x.n.cnpjFornecedor, x.n.nf), s: `${x.qtd} item(ns) sem associação`, fn: `abrirEditorNf('${escRel(x.n.id)}')` })));
    const semCnpj = listaFornecedoresSpData.filter(f => !(f.cnpjs || []).length);
    add('baixa', 'forn-sem-cnpj', 'Fornecedores sem CNPJ no SP Data', 'Sem CNPJ, o app não acha o pedido das NFs do ERP sozinho.',
        semCnpj.length ? [{ t: `${semCnpj.length} fornecedor(es) sem CNPJ`, s: 'abrir o cadastro de Fornecedores', fn: "switchToScreen('screen-fornecedores','Fornecedores')" }] : []);
    return grupos;
}
function totalAtencao() { try { return itensDeAtencao().reduce((s, g) => s + (g.nivel === 'baixa' ? 0 : g.linhas.length), 0); } catch (e) { return 0; } }

const ATENCAO_NIVEIS = { alta: ['Urgente', 'err'], media: ['Importante', ''], baixa: ['Quando der', 'm'] };
function toggleGrupoAtencao(id) { if (atencaoAbertos.has(id)) atencaoAbertos.delete(id); else atencaoAbertos.add(id); renderAtencao(); }
function prepararAtencao() { atencaoAbertos = new Set(itensDeAtencao().filter(g => g.nivel === 'alta').map(g => g.id)); renderAtencao(); }
function renderAtencaoSeAtiva() { const t = document.getElementById('screen-atencao'); if (t && t.classList.contains('active')) renderAtencao(); }
function renderAtencao() {
    const el = document.getElementById('atencao-conteudo'); if (!el) return;
    const grupos = itensDeAtencao();
    if (!grupos.length) { el.innerHTML = '<div class="card"><div class="xml-item-meta">✓ Nada parado por aqui. Tudo em dia.</div></div>'; return; }
    const ordem = { alta: 0, media: 1, baixa: 2 };
    grupos.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
    el.innerHTML = `<div class="card"><div class="xml-item-meta">O que está parado ou envelhecendo, do mais urgente ao menos. Toque num grupo para abrir e num item para ir direto à tela que resolve.</div></div>`
        + grupos.map(g => {
            const aberto = atencaoAbertos.has(g.id), [rot, cls] = ATENCAO_NIVEIS[g.nivel];
            return `<div class="ctl-card atn-grupo">
                <div class="ctl-top" onclick="toggleGrupoAtencao('${g.id}')" style="cursor:pointer"><div class="ctl-nm"><b>${escRel(g.titulo)}</b><small>${escRel(g.dica)}</small></div>
                    <span class="ctl-st ${cls}">${g.linhas.length}</span></div>
                <div class="ctl-inf"><span class="ctl-st ${cls}" style="font-size:11px;padding:3px 9px">${rot}</span> <a class="ctl-pend-link" onclick="toggleGrupoAtencao('${g.id}')">${aberto ? 'Fechar' : 'Ver itens'}</a></div>
                ${aberto ? g.linhas.slice(0, 12).map(l => `<div class="retro-linha atn-linha" onclick="${l.fn}" style="cursor:pointer"><span>${escRel(l.t)}<br><small>${escRel(l.s)}</small></span><span class="atn-seta">›</span></div>`).join('') + (g.linhas.length > 12 ? `<div class="xml-item-meta" style="margin-top:6px">…e mais ${g.linhas.length - 12}.</div>` : '') : ''}
            </div>`;
        }).join('');
}
// Faixa no topo do Controle de NFs: só aparece quando há algo urgente ou importante.
function renderBannerAtencao() {
    const el = document.getElementById('controle-atencao-banner'); if (!el) return;
    const n = totalAtencao();
    el.innerHTML = n ? `<button type="button" class="atn-banner" onclick="switchToScreen('screen-atencao','O que precisa de atenção'); prepararAtencao()"><span><b>${n}</b> ite${n === 1 ? 'm precisa' : 'ns precisam'} de atenção</span><span class="atn-seta">›</span></button>` : '';
}

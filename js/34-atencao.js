// 34-atencao.js — "O que precisa de atenção" (2.11.3)
// Parte do script do app. Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// Junta num painel só o que está parado ou envelhecendo, ordenado por urgência, com um toque que leva à tela que resolve.
// Só leitura: nenhuma regra de dados muda; tudo é calculado dos dados que o app já carrega.

let atencaoAbertos = new Set(['alta']);
let atencaoModo = 'urgencia'; // 'urgencia' | 'pedido' | 'fornecedor'
function mudarModoAtencao(m) { atencaoModo = m; atencaoAbertos = new Set(); renderAtencao(); }
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
        vencidas.map(x => ({ forn: x.n.fornecedor || '', pedido: '', t: `${x.n.fornecedor || '(sem fornecedor)'} · NF ${x.n.nf || '—'}`, s: `venceu em ${x.n.vencimento} (${diasDesdeISO(x.iso)} dia(s) atrás) · R$ ${x.n.valor || '—'}`, fn: "switchToScreen('screen-manage','Gerenciar NF')" })));

    // ---- ALTA: pedidos com prazo vencido e nenhum sinal de entrega
    const nfPorPedido = new Set(), erpPorPedido = new Set();
    listaNfsProcessadas.forEach(n => [n.pedido, ...(n.pedidos || [])].filter(Boolean).forEach(p => nfPorPedido.add(String(p))));
    listaEntradasErp.forEach(e => { const p = pedidoDoErpConfirmado(e); if (p) erpPorPedido.add(String(p)); });
    const semEntrega = listaCotacoes.filter(c => { const lim = (c.dataLimite || '').slice(0, 10); return lim && lim < hoje && !nfPorPedido.has(String(c.pedido)) && !erpPorPedido.has(String(c.pedido)) && !Object.keys(c.chegadasPorFornecedor || {}).length && (c.itens || []).length; })
        .sort((a, b) => String(a.dataLimite).localeCompare(String(b.dataLimite)));
    add('alta', 'pedidos-sem-entrega', 'Pedidos com prazo vencido e sem sinal de entrega', 'Sem NF no app, sem NF do ERP ligada e sem marca de "já chegou".',
        semEntrega.map(c => ({ pedido: String(c.pedido), forn: '', t: `Pedido ${c.pedido}${c.origem ? ' — ' + c.origem : ''}`, s: `prazo ${dataBRdeISO(c.dataLimite)} (${diasDesdeISO(c.dataLimite)} dia(s) atrás) · ${(c.fornecedores || []).length} fornecedor(es)`, fn: `abrirCentralPedido('${escRel(c.pedido)}')` })));

    // ---- MÉDIA (Importante): ocorrências detectadas e ainda SEM relato (2.17.0). Mesma contagem "em aberto" do cartão do pedido.
    const semRelato = [], naoChegou = [];
    listaCotacoes.forEach(c => {
        const p = String(c.pedido); if (!nfPorPedido.has(p) && !erpPorPedido.has(p)) return; // sem NF não há o que comparar
        let comp = []; try { comp = compararFontesPedido(c.pedido); } catch (e) { return; }
        const abertas = comp.filter(x => x.estado === 'detectada' && !x.soNaoChegou);
        if (abertas.length) semRelato.push({ c, abertas });
        const nc = comp.filter(x => x.estado === 'detectada' && x.soNaoChegou); // 2.19.1: "não chegou" é um aviso à parte, discreto
        if (nc.length) naoChegou.push({ c, nc });
    });
    add('media', 'ocorrencias-sem-relato', 'Ocorrências detectadas sem relato', 'O app achou diferença entre cotação e NF e ninguém relatou ainda. Abra o pedido e registre a auditoria.',
        semRelato.map(({ c, abertas }) => ({ pedido: String(c.pedido), forn: [...new Set(abertas.map(x => { const f = (c.fornecedores || []).find(y => normalizarCnpj(y.cnpj) === normalizarCnpj(x.cnpjFornecedor)); return f ? nomeExibicaoFornecedor(f.razaoSocial, f.cnpj) : ''; }).filter(Boolean))].join(', '), t: `Pedido ${c.pedido}${c.origem ? ' — ' + c.origem : ''}`, s: `${abertas.length} ocorrência(s) em aberto`, fn: `abrirCentralPedido('${escRel(String(c.pedido))}')` })));

    add('baixa', 'itens-nao-chegaram', 'Itens que ainda não chegaram', 'Itens da cotação que ainda não vieram em NF. Não é divergência: pode vir em outra NF. Dá para relatar na Auditoria.',
        naoChegou.map(({ c, nc }) => ({ pedido: String(c.pedido), forn: [...new Set(nc.map(x => { const f = (c.fornecedores || []).find(y => normalizarCnpj(y.cnpj) === normalizarCnpj(x.cnpjFornecedor)); return f ? nomeExibicaoFornecedor(f.razaoSocial, f.cnpj) : ''; }).filter(Boolean))].join(', '), t: `Pedido ${c.pedido}${c.origem ? ' — ' + c.origem : ''}`, s: `${nc.length} item(ns) não chegaram`, fn: `abrirCentralPedido('${escRel(String(c.pedido))}')` })));

    // ---- MÉDIA: divergências pendentes
    // 2.11.6: usa a MESMA lista da tela Relatórios → Divergências (divergenciasRel), com a mesma regra de status
    // ("não faturado" de item que já chegou conta como resolvido), só que sem os filtros da tela.
    const filtrosTela = relatoriosFiltros; relatoriosFiltros = { de: '', ate: '', fornecedor: '', fornecedorExato: false, destino: '', recurso: '', tipo: '', produto: '' };
    let pendDiv = []; try { pendDiv = divergenciasRel().filter(x => x.status === 'pendente' && x.relatado !== false); } finally { relatoriosFiltros = filtrosTela; }
    // 2.16.0: auditoria aberta = pendência RELATADA (já está com o responsável): pesa como resolvida, então sai da contagem de "precisa de atenção".
    add('baixa', 'divergencias', 'Pendências relatadas', 'Já relatadas ao responsável. Mesma lista de Relatórios → Divergências. Toque para abrir o pedido.',
        pendDiv.map(x => ({ pedido: String(x.pedido || ''), forn: x.fornecedor || '', t: `Pedido ${x.pedido || '—'}${x.fornecedor ? ' · ' + x.fornecedor : ''}`, s: (TIPOS_DIVERGENCIA_AUDITORIA[x.tipo] || {}).label || x.tipo, fn: `abrirCentralPedido('${escRel(x.pedido)}')` })));

    // ---- MÉDIA: NFs do ERP com pedido sugerido / itens defasados
    // 2.12.0: as pendências de cada NF vêm da visão única (mesma regra do Controle, do Editor e da Auditoria): uma NF com pedido já
    // confirmado pelo XML não aparece mais como "pedido sugerido" só porque o lançamento do ERP ficou com a sugestão antiga.
    const an = analiseRetroativaErp();
    const nfsDe = id => pendenciasNf(id);
    add('media', 'sugestoes', 'NFs do ERP com pedido sugerido para confirmar', 'A Auditoria Retroativa mostra a conferência de valor, datas e itens.',
        nfsDe('pedido-sugerido').map(({ v }) => { const c = v.erp ? conferenciaPedidoSugerido(v.erp, v.pedidoSugerido) : null; const ver = c && c.veredito; return { pedido: String(v.pedidoSugerido || ''), forn: v.fornecedor, t: tituloFornNf(v.fornecedor, v.cnpj, v.numeroNf), s: `sugerido: pedido ${v.pedidoSugerido}` + ({ bate: ' · bate em tudo', conferir: ' · conferir', nao: ' · não parece' }[ver] || ''), fn: "irParaRetroFiltro('sugerido')" }; }));
    const def = an.filter(a => a.defasados > 0);
    add('media', 'defasados', 'Itens do ERP defasados', 'Atualizam sozinhos; o botão na Auditoria Retroativa faz na hora.',
        def.map(a => ({ pedido: a.pedido || '', forn: a.e.fornecedorNomeEditado || a.e.fornecedorNomeRelatorio || '', t: tituloFornNf(a.e.fornecedorNomeEditado || a.e.fornecedorNomeRelatorio || '', a.e.cnpjFornecedor, a.e.nf), s: `${a.defasados} item(ns)`, fn: "irParaRetroFiltro('defasados')" })));

    // ---- MÉDIA: NFs do ERP paradas na pré-seleção e NFs com XML sem pedido (da visão única)
    add('media', 'pre-selecao', 'NFs do ERP esperando decisão há mais de 7 dias', 'Decidir no Controle de NFs: relação, financeiro ou "não vai ao financeiro".',
        nfsDe('decisao-parada').map(({ v, p }) => ({ pedido: String(v.pedido || v.pedidoSugerido || ''), forn: v.fornecedor, t: tituloFornNf(v.fornecedor, v.cnpj, v.numeroNf), s: p.texto, fn: `abrirEditorNf('${escRel(v.id)}')` })));
    add('media', 'nf-sem-pedido', 'NFs com XML sem pedido', 'Vincule a um pedido ou marque como compra direta.',
        nfsDe('sem-pedido').map(({ v, p }) => ({ pedido: String(v.pedido || v.pedidoSugerido || ''), forn: v.fornecedor, t: tituloFornNf(v.fornecedor, v.cnpj, v.numeroNf), s: p.texto, fn: `abrirEditorNf('${escRel(v.id)}')` })));

    // ---- BAIXA: itens de NF sem recurso / sem produto (da visão única)
    add('baixa', 'sem-recurso', 'NFs com itens sem recurso definido', 'Defina no Editor da NF (Dados desta NF → recurso da NF inteira).',
        nfsDe('sem-recurso').map(({ v, p }) => ({ pedido: String(v.pedido || v.pedidoSugerido || ''), forn: v.fornecedor, t: tituloFornNf(v.fornecedor, v.cnpj, v.numeroNf), s: p.texto, fn: `abrirEditorNf('${escRel(v.id)}')` })));
    add('baixa', 'sem-produto', 'NFs com itens sem produto da cotação', 'Associe o produto no Editor da NF ou na Entrada de NF.',
        nfsDe('sem-produto').map(({ v, p }) => ({ pedido: String(v.pedido || v.pedidoSugerido || ''), forn: v.fornecedor, t: tituloFornNf(v.fornecedor, v.cnpj, v.numeroNf), s: p.texto, fn: `abrirEditorNf('${escRel(v.id)}')` })));
    const semCnpj = listaFornecedoresSpData.filter(f => !(f.cnpjs || []).length);
    add('baixa', 'forn-sem-cnpj', 'Fornecedores sem CNPJ no SP Data', 'Sem CNPJ, o app não acha o pedido das NFs do ERP sozinho.',
        semCnpj.length ? [{ pedido: '', forn: '', t: `${semCnpj.length} fornecedor(es) sem CNPJ`, s: 'abrir o cadastro de Fornecedores', fn: "switchToScreen('screen-fornecedores','Fornecedores')" }] : []);
    return grupos;
}
function totalAtencao() { try { return itensDeAtencao().reduce((s, g) => s + (g.nivel === 'baixa' ? 0 : g.linhas.length), 0); } catch (e) { return 0; } }

const ATENCAO_NIVEIS = { alta: ['Urgente', 'err'], media: ['Importante', ''], baixa: ['Quando der', 'm'] };
function toggleGrupoAtencao(id) { if (atencaoAbertos.has(id)) atencaoAbertos.delete(id); else atencaoAbertos.add(id); renderAtencao(); }
function prepararAtencao() { atencaoModo = 'urgencia'; atencaoAbertos = new Set(itensDeAtencao().filter(g => g.nivel === 'alta').map(g => g.id)); renderAtencao(); }
function renderAtencaoSeAtiva() { const t = document.getElementById('screen-atencao'); if (t && t.classList.contains('active')) renderAtencao(); }
function renderAtencao() {
    const el = document.getElementById('atencao-conteudo'); if (!el) return;
    const grupos = itensDeAtencao();
    if (!grupos.length) { el.innerHTML = '<div class="card"><div class="xml-item-meta">✓ Nada parado por aqui. Tudo em dia.</div></div>'; return; }
    const ordem = { alta: 0, media: 1, baixa: 2 };
    grupos.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
    const abas = `<div class="retro-chips">${[['urgencia', 'Por urgência'], ['pedido', 'Por pedido'], ['fornecedor', 'Por fornecedor']].map(([k, t]) => `<button type="button" class="retro-chip${atencaoModo === k ? ' on' : ''}" onclick="mudarModoAtencao('${k}')">${t}</button>`).join('')}</div>`;
    if (atencaoModo !== 'urgencia') {
        // 2.12.3: as mesmas pendências, reunidas por pedido ou por fornecedor (o que acontece com o mesmo pedido/fornecedor em vários lugares fica junto)
        const mapa = new Map(), sem = [];
        grupos.forEach(g => g.linhas.forEach(l => {
            const chave = atencaoModo === 'pedido' ? (l.pedido ? 'Pedido ' + l.pedido : '') : String(l.forn || '').trim().toUpperCase();
            if (!chave) { sem.push({ g, l }); return; }
            if (!mapa.has(chave)) mapa.set(chave, []);
            mapa.get(chave).push({ g, l });
        }));
        const blocos = [...mapa.entries()].sort((a, b) => b[1].length - a[1].length);
        if (sem.length) blocos.push([atencaoModo === 'pedido' ? 'Sem pedido definido' : 'Sem fornecedor definido', sem]);
        el.innerHTML = abas + blocos.map(([nome, ls]) => {
            const aberto = atencaoAbertos.has(nome);
            return `<div class="ctl-card atn-grupo"><div class="ctl-top" onclick="toggleGrupoAtencao(${JSON.stringify(nome).replace(/"/g, '&quot;')})" style="cursor:pointer"><div class="ctl-nm"><b>${escRel(nome)}</b></div><span class="ctl-st">${ls.length}</span></div>
                ${aberto ? ls.map(({ g, l }) => `<div class="retro-linha atn-linha" onclick="${l.fn}" style="cursor:pointer"><span>${escRel(l.t)}<br><small>${escRel(g.titulo)} · ${escRel(l.s)}</small></span><span class="atn-seta">›</span></div>`).join('') : `<div class="ctl-inf"><a class="ctl-pend-link" onclick="toggleGrupoAtencao(${JSON.stringify(nome).replace(/"/g, '&quot;')})">Ver itens</a></div>`}</div>`;
        }).join('');
        return;
    }
    el.innerHTML = abas + `<div class="card"><div class="xml-item-meta">O que está parado ou envelhecendo, do mais urgente ao menos. Toque num grupo para abrir e num item para ir direto à tela que resolve.</div></div>`
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
    el.innerHTML = n ? `<button type="button" class="atn-banner" onclick="switchToScreen('screen-atencao','Central de notificações'); prepararAtencao()"><span><b>${n}</b> ite${n === 1 ? 'm precisa' : 'ns precisam'} de atenção</span><span class="atn-seta">›</span></button>` : '';
}

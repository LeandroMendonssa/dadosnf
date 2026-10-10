// 17-historico-controle-nfs.js — Histórico de NFs (Fase 6) e Controle de NFs (Fase 38)
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// --- HISTÓRICO (FASE 6): visão consolidada Ano → Mês → NF ---
// ===================================================================
// Só leitura/junção sobre dados que já existem — nfsProcessadas, entradasErp,
// listaCotacoes, listaAnotacoes, listaFornecedoresSpData — nenhuma coleção
// nova, nenhuma cópia gravada no Firestore. Organiza pela data de
// lançamento/entrada (nunca vencimento). Uma NF nunca aparece duplicada
// porque a junção usa a mesma chave natural (nf_serie) que nfsProcessadas e
// entradasErp já usam como id de documento — não é uma chave nova inventada
// aqui, então continua funcionando com dados antigos gravados antes desta
// tela existir.
//
// Ajuste pedido após a primeira entrega: o usuário não deve ter a sensação
// de que existem dois Históricos. Por isso NÃO existe mais uma aba separada
// "Notas arquivadas" — o antigo arquivo simples (historicoNotas, do fluxo
// manual de Gerenciar Notas) aparece DENTRO da mesma linha do tempo Ano→Mês,
// como um tipo de registro claramente identificado como legado (ver
// montarHistoricoNotasLegado). Ele NÃO é cruzado/deduplicado com
// nfsProcessadas/entradasErp porque seu campo "nf" é texto livre digitado
// manualmente, sem série garantida — não existe uma chave natural confiável
// em comum pra fazer esse casamento com segurança. Continua sendo uma fonte
// de dados tecnicamente separada (coleção "historico" já existente,
// preservada sem alteração), só deixou de ter uma UI própria de destaque.

let historicoFiltroTexto = '';
// Abre automaticamente no Ano/Mês corrente — não fica esperando o usuário
// clicar em Ano e depois Mês pra ver algo. Se não houver registro no mês
// atual, a navegação permanece nele (ver renderHistoricoNfs) e mostra que
// está vazio, em vez de redirecionar pra outro período.
const HOJE_HISTORICO = new Date();
let historicoAnoSelecionado = String(HOJE_HISTORICO.getFullYear());
let historicoMesSelecionado = String(HOJE_HISTORICO.getMonth() + 1).padStart(2, '0');
let historicoNfExpandida = null;

const NOMES_MESES_HISTORICO = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ===================================================================
// --- FASE 38: CONTROLE DE NFs ---
// ===================================================================
// Visão única do ciclo da NF, SÓ LEITURA do que já existe (nada de coleção nova):
//   Em aberto  = Recebida (entrou por XML/relatório ERP e ainda não está na relação) + Na relação + Em espera
//   Arquivadas = foi pro financeiro (ERP "arquivada" ou nota arquivada)
//   Diretas    = não vai ao financeiro (fornecedor ignorado no ERP, ou marcada NF a NF)
// Junta XML + ERP pela mesma chave nf_serie (igual ao Histórico). Nota digitada à mão NÃO é cruzada com
// XML/ERP por nome (não existe chave confiável): ela só entra ligada a uma NF quando o vínculo é explícito
// (notaVinculadaId, gravado ao importar do ERP ou ao "Enviar para a relação" daqui).
let abaControle = 'aberto';
let filtroControle = '';
let selecaoControleAtiva = false;
const selecionadasControle = new Set();
let limiteControle = 60;
let envioPendenteControle = null; // { chave, nf, erpId, nfId } — "Enviar para a relação" aguardando o Salvar do Adicionar

function renderControleSeAtivo() {
    agendarRender('controle', () => {
        const tela = document.getElementById('screen-controle-nfs');
        if (tela && tela.classList.contains('active')) renderControleNfs();
    });
}

function montarControleNfs() {
    const itens = [];
    const notasPorId = {};
    notasPendentes.forEach(n => { notasPorId[n.id] = n; });
    const notasLigadas = new Set();
    // 2.0.5: pareamento pelo número da NF (ver parearNfsEErps) — XML + ERP da mesma NF viram uma linha só.
    const chaveNorm = (n, serie) => { const k = normNfNumero(n); if (!k) return null; const sr = normSerieNf(serie); return sr ? `${k}_${sr}` : k; };
    const porChave = parearNfsEErps(listaNfsProcessadas, listaEntradasErp, (nf, erp) => { const r = nf || erp; return chaveNorm(r.nf, r.serie); });

    Object.keys(porChave).forEach(ch => {
        const { nf, erp } = porChave[ch];
        const numeroNf = (nf && nf.nf) || (erp && erp.nf) || ch;
        const cnpj = (nf && nf.cnpjFornecedor) || (erp && erp.cnpjFornecedor) || null;
        const docForn = cnpj ? listaFornecedoresSpData.find(f => (f.cnpjs || []).some(c => c.cnpj === cnpj)) : null;
        const nomeFornecedor = nomeTextoSeguro(docForn ? (docForn.nomeExibido || docForn.nomeReal) : ((nf && nf.fornecedor) || (erp && erp.fornecedorNomeRelatorio) || ''));
        let dataISO = null;
        if (erp && erp.data) dataISO = converterDataBRparaISO(erp.data);
        if (!dataISO && nf && nf.emissao) dataISO = nf.emissao.slice(0, 10);
        if (!dataISO && nf && nf.processadoEm) dataISO = nf.processadoEm.slice(0, 10);

        let situacao = 'recebida', subtipo = null, nota = null;
        const notaId = (erp && erp.notaVinculadaId) || (nf && nf.notaVinculadaId) || null;
        if (erp && erp.statusFluxo === 'arquivada') situacao = 'arquivada';
        else if (erp && erp.statusFluxo === 'historico_direto') { situacao = 'direta'; subtipo = erp.bloqueioFornecedor ? 'fornecedor' : (erp.marcadaDireta ? 'marcada' : 'fornecedor'); }
        else if (!erp && nf && nf.semFinanceiro) { situacao = 'direta'; subtipo = 'marcada'; }
        else if (notaId && notasPorId[notaId]) { nota = notasPorId[notaId]; notasLigadas.add(nota.id); situacao = nota.emEspera ? 'em_espera' : 'na_relacao'; }
        else if (!erp && nf && nf.notaVinculadaId && historicoNotas.some(h => h.nfChave === nf.id)) situacao = 'arquivada'; // nota ligada já foi arquivada
        // (nota ligada que sumiu sem ser arquivada = foi excluída: a NF volta a pedir decisão)
        // Fase 44: cada dado tem fallback — nota ligada > ERP > XML (valor total e 1º vencimento da duplicata).
        const vencXml = nf && Array.isArray(nf.vencimentos) && nf.vencimentos[0] ? String(nf.vencimentos[0]).slice(0, 10).split('-').reverse().join('/') : '';
        const parcelaErp = erp && Array.isArray(erp.parcelas) && erp.parcelas[0] ? erp.parcelas[0] : null;
        const valorTxt = (nota && nota.valor) || (erp && erp.valor && String(erp.valor)) || (nf && nf.valorTotal ? formatarValorMonetarioBR(nf.valorTotal) : '') || (parcelaErp && parcelaErp.valor ? formatarValorMonetarioBR(parcelaErp.valor) : '');
        const venc = (nota && nota.vencimento) || (erp && erp.vencimento) || (parcelaErp && parcelaErp.data) || vencXml || '';
        itens.push({ chave: 'nf:' + ch, tipo: 'nf', ch, numeroNf, serie: (nf && nf.serie) || (erp && erp.serie) || '', nomeFornecedor, cnpj, dataISO, situacao, subtipo, nota, nf, erp, valorTxt, venc,
            pedido: (nf && nf.pedido) || (erp && erp.vinculo && erp.vinculo.status === 'confirmado' && erp.vinculo.pedido) || null });
    });
    // 2.0.5: nota digitada em "Adicionar" (ou já arquivada) com o MESMO nº de uma NF "Recebida" é a mesma NF: junta na linha
    // da NF em vez de aparecer duas vezes. O fornecedor só confirma (mesma regra do pareamento acima).
    const nfsRecebidas = itens.filter(it => it.tipo === 'nf' && it.situacao === 'recebida');
    const acharNfDaNota = (numero, nomeForn, valor) => {
        const num = normNfNumero(numero); if (!num) return null;
        const descNota = descFornecedor(null, nomeForn);
        let melhor = null, forca = 0;
        nfsRecebidas.forEach(it => {
            if (it.nota || it.notaLegado || normNfNumero(it.numeroNf) !== num) return;
            const descNf = descFornecedor(it.cnpj, it.nomeFornecedor, it.nf && it.nf.fornecedor, it.erp && it.erp.fornecedorNomeRelatorio);
            const f = forcaMesmoFornecedor(descNota, descNf, valor, it.valorTxt);
            if (f > forca) { forca = f; melhor = it; }
        });
        return melhor;
    };
    notasPendentes.forEach(n => {
        if (notasLigadas.has(n.id)) return;
        const alvo = acharNfDaNota(n.nf, n.fornecedor, n.valor);
        if (!alvo) return;
        alvo.nota = n; alvo.situacao = n.emEspera ? 'em_espera' : 'na_relacao'; notasLigadas.add(n.id);
        if (!alvo.valorTxt) alvo.valorTxt = n.valor || ''; if (!alvo.venc) alvo.venc = n.vencimento || '';
    });
    // notas digitadas à mão (ou de outro caminho) que não estão ligadas a nenhuma NF
    notasPendentes.forEach(n => {
        if (notasLigadas.has(n.id)) return;
        itens.push({ chave: 'nota:' + n.id, tipo: 'nota', numeroNf: n.nf || '(sem NF)', serie: '', nomeFornecedor: nomeTextoSeguro(n.fornecedor), cnpj: null, dataISO: (n.dataCriacao || '').slice(0, 10) || null,
            situacao: n.emEspera ? 'em_espera' : 'na_relacao', subtipo: null, nota: n, nf: null, erp: null, valorTxt: n.valor || '', venc: n.vencimento || '', pedido: null });
    });
    // notas já arquivadas; as que vieram de uma NF (erpChave/nfChave) já aparecem pela própria NF
    montarHistoricoNotasLegado().forEach(l => {
        const n = l.notaLegado;
        if (n.erpChave || n.nfChave) return;
        const alvoLegado = acharNfDaNota(l.numeroNf, l.nomeFornecedor, n.valor);
        if (alvoLegado) { alvoLegado.notaLegado = n; alvoLegado.situacao = 'arquivada'; return; } // 2.0.5: já era esta NF
        itens.push({ chave: l.chave, tipo: 'legado', numeroNf: l.numeroNf, serie: '', nomeFornecedor: l.nomeFornecedor, cnpj: null, dataISO: l.dataISO,
            situacao: 'arquivada', subtipo: null, nota: n, nf: null, erp: null, valorTxt: n.valor || '', venc: n.vencimento || '', pedido: null });
    });
    // Fase 41: NF "Recebida" que parece já existir como nota (mesmo nº + mesmo valor): sinaliza, nunca junta sozinho.
    const legadosLivres = historicoNotas.filter(h => !h.erpChave && !h.nfChave);
    itens.forEach(it => {
        if (it.tipo !== 'nf' || it.situacao !== 'recebida') return;
        const bate = n => normNfNumero(n.nf) === normNfNumero(it.numeroNf) && valoresNfIguais(n.valor, it.valorTxt);
        const pend = notasPendentes.filter(n => !notasLigadas.has(n.id) && bate(n));
        const hist = legadosLivres.filter(bate);
        if (pend.length === 1) it.possivelNota = { tipo: 'pendente', nota: pend[0] };
        else if (!pend.length && hist.length === 1) it.possivelNota = { tipo: 'historico', nota: hist[0] };
    });
    itens.sort((a, b) => (b.dataISO || '').localeCompare(a.dataISO || ''));
    return itens;
}

function abaDoItemControle(it) {
    if (it.situacao === 'arquivada') return 'arquivadas';
    if (it.situacao === 'direta') return 'diretas';
    return 'aberto';
}

function alternarAbaControle(aba) { abaControle = aba; limiteControle = 60; selecionadasControle.clear(); renderControleNfs(); }
function filtrarControle(texto) { filtroControle = texto || ''; limiteControle = 60; renderControleNfs(); }
function carregarMaisControle() { limiteControle += 60; renderControleNfs(); }
function alternarSelecaoControle() { selecaoControleAtiva = !selecaoControleAtiva; selecionadasControle.clear(); renderControleNfs(); }
function toggleSelecionadaControle(chave) { if (selecionadasControle.has(chave)) selecionadasControle.delete(chave); else selecionadasControle.add(chave); renderControleNfs(); }

function renderCardControleNf(it) {
    const rotulos = { recebida: ['neutro', 'Recebida'], na_relacao: ['azul', 'Na relação'], em_espera: ['pendente', '⏳ Em espera'], arquivada: ['pronto', '✓ Enviada ao financeiro'], direta: ['neutro', 'Direta'] };
    const [classe, rotulo] = rotulos[it.situacao];
    const chips = [`<span class="xml-item-badge ${classe}">${rotulo}</span>`];
    if (it.situacao === 'direta') chips.push(`<span class="xml-item-badge neutro">${it.subtipo === 'marcada' ? 'Marcada por você' : 'Fornecedor ignorado'}</span>`);
    if (it.tipo === 'nf') {
        if (it.nf) chips.push('<span class="xml-item-badge pronto">XML ✓</span>');
        if (it.erp) chips.push(`<span class="xml-item-badge ${it.nf ? 'pronto' : 'neutro'}">${it.nf ? 'ERP ✓' : 'só ERP'}</span>`);
        if (it.situacao === 'recebida' && it.erp && it.erp.avisoJaExisteNotaManual) chips.push('<span class="xml-item-badge pendente">Já tem nota manual na relação</span>');
        if (it.possivelNota) chips.push(`<span class="xml-item-badge pendente">Parece já existir como nota ${it.possivelNota.tipo === 'pendente' ? 'na relação' : 'arquivada'} (mesmo nº e valor)</span>`);
    } else if (it.tipo === 'nota') chips.push('<span class="xml-item-badge neutro">Nota manual</span>');
    else chips.push('<span class="xml-item-badge neutro">Registro simples</span>');
    const dataTxt = it.dataISO ? formatarDataBRSimples(it.dataISO) : '';
    const sub = [it.valorTxt ? 'R$ ' + escRel(String(it.valorTxt).replace(/^R\$\s*/, '')) : '', it.venc ? 'Venc. ' + escRel(it.venc) : '', it.pedido ? 'Pedido ' + escRel(it.pedido) : ''].filter(Boolean).join(' · ');
    const chaveJs = it.chave.replace(/'/g, "\\'");
    let acoes = '';
    if (it.tipo === 'nf' && it.situacao === 'recebida') {
        const principal = it.possivelNota
            ? `<button type="button" class="action-chip edit-chip" onclick="event.stopPropagation(); vincularNfANota('${chaveJs}')">É a mesma nota — vincular</button>`
            : `<button type="button" class="action-chip edit-chip" onclick="event.stopPropagation(); enviarNfParaRelacao('${chaveJs}')">Enviar para a relação</button>`;
        acoes = `${principal}<button type="button" class="action-chip" onclick="event.stopPropagation(); marcarNfDireta('${chaveJs}')">Não vai ao financeiro</button>`;
    } else if (it.situacao === 'na_relacao' || it.situacao === 'em_espera') {
        acoes = `<button type="button" class="action-chip" onclick="event.stopPropagation(); verNoGerenciarNf('${chaveJs}')">Ver no Gerenciar NF</button>`;
    } else if (it.situacao === 'direta' && it.subtipo === 'marcada') {
        acoes = `<button type="button" class="action-chip" onclick="event.stopPropagation(); voltarNfParaAberto('${chaveJs}')">Voltar para Em aberto</button>`;
    } else if (it.situacao === 'direta') {
        acoes = `<div class="nota-data">Fornecedor ignorado no ERP — para voltar, libere o fornecedor em Fornecedores.</div>`;
    }
    const selecionavel = selecaoControleAtiva && it.tipo === 'nf' && it.situacao === 'recebida';
    const check = selecionavel ? `<label class="controle-check" onclick="event.stopPropagation()"><input type="checkbox" ${selecionadasControle.has(it.chave) ? 'checked' : ''} onchange="toggleSelecionadaControle('${chaveJs}')"></label>` : '';
    return `<div class="nota-item controle-item" data-controle-chave="${escRel(it.chave)}">
        <div class="nota-topo">${check}<div style="flex:1;min-width:0"><div class="nota-info">${escRel(it.nomeFornecedor || '(sem fornecedor)')} · NF ${escRel(it.numeroNf)}${it.serie ? '/' + escRel(it.serie) : ''}</div>
            ${sub ? `<div class="nota-sub">${sub}</div>` : ''}</div>${dataTxt ? `<span class="nota-prazo">${dataTxt}</span>` : ''}</div>
        <div class="nota-chips">${chips.join('')}</div>
        ${acoes ? `<div class="actions-row controle-acoes">${acoes}</div>` : ''}
    </div>`;
}

function renderControleNfs() {
    const lista = document.getElementById('controle-lista');
    if (!lista) return;
    const todos = montarControleNfs();
    const contagem = { aberto: 0, arquivadas: 0, diretas: 0 };
    todos.forEach(it => { contagem[abaDoItemControle(it)]++; });
    document.querySelectorAll('#controle-abas .xml-filtro-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.aba === abaControle);
        const c = b.querySelector('.controle-cont'); if (c) c.textContent = contagem[b.dataset.aba];
    });
    const termo = normalizarBuscaRel(filtroControle);
    let visiveis = todos.filter(it => abaDoItemControle(it) === abaControle);
    if (termo) visiveis = visiveis.filter(it => normalizarBuscaRel([it.numeroNf, it.nomeFornecedor, it.pedido, it.cnpj].filter(Boolean).join(' ')).includes(termo));
    const barra = document.getElementById('controle-barra-selecao');
    if (barra) {
        const podeSelecionar = abaControle === 'aberto' && visiveis.some(it => it.tipo === 'nf' && it.situacao === 'recebida');
        document.getElementById('controle-btn-selecionar').style.display = podeSelecionar || selecaoControleAtiva ? '' : 'none';
        document.getElementById('controle-btn-selecionar').textContent = selecaoControleAtiva ? 'Concluir' : 'Selecionar';
        barra.style.display = selecaoControleAtiva ? 'flex' : 'none';
        document.getElementById('controle-sel-info').textContent = `${selecionadasControle.size} selecionada(s)`;
        document.getElementById('controle-sel-direta').disabled = selecionadasControle.size === 0;
    }
    const subtitulos = { aberto: 'Tudo que ainda não foi para o financeiro', arquivadas: 'NFs que já foram para o financeiro', diretas: 'NFs que não passam pelo financeiro' };
    const vazios = { aberto: 'Nada em aberto.', arquivadas: 'Nenhuma NF arquivada ainda.', diretas: 'Nenhuma NF direta.' };
    const pagina = visiveis.slice(0, limiteControle);
    const nProvaveis = todos.filter(it => it.possivelNota).length;
    const avisoProvaveis = (abaControle === 'aberto' && nProvaveis && !termo) ? `<div class="gerenciar-aviso-recursos" style="display:flex;"><span>${nProvaveis} NF(s) parecem já existir como nota (mesmo nº e valor)</span><button type="button" class="action-chip" onclick="vincularTodasProvaveis()">Vincular todas</button></div>` : '';
    lista.innerHTML = `<div class="controle-subtitulo">${subtitulos[abaControle]}</div>` + avisoProvaveis +
        (pagina.length ? pagina.map(renderCardControleNf).join('') : `<div class="empty-state">${termo ? 'Nada encontrado para essa busca.' : vazios[abaControle]}</div>`) +
        (visiveis.length > pagina.length ? `<div class="actions mt-3"><button type="button" class="actions-button is-neutral" onclick="carregarMaisControle()">Carregar mais (${visiveis.length - pagina.length} restante(s))</button></div>` : '');
}

function itemControlePorChave(chave) { return montarControleNfs().find(it => it.chave === chave); }

// Fase 41: "É a mesma nota" — liga a NF (XML/ERP) à nota que já existe. Só por ação sua (ou "Vincular todas", com confirmação).
async function vincularItemControle(it) {
    if (!it || !it.possivelNota) return false;
    const { tipo, nota } = it.possivelNota;
    if (tipo === 'pendente') {
        if (it.erp) await entradasErpCollection.doc(it.erp.id).update({ statusFluxo: 'selecionada_financeiro', notaVinculadaId: nota.id });
        if (it.nf) await nfsProcessadasCollection.doc(it.nf.id).update({ notaVinculadaId: nota.id });
    } else {
        const marca = {}; if (it.erp) marca.erpChave = it.erp.id; if (it.nf) marca.nfChave = it.nf.id;
        await historicoCollection.doc(nota.id).update(marca);
        if (it.erp) await entradasErpCollection.doc(it.erp.id).update({ statusFluxo: 'arquivada' });
        if (it.nf && !it.erp) await nfsProcessadasCollection.doc(it.nf.id).update({ notaVinculadaId: nota.id });
    }
    return true;
}
async function vincularNfANota(chave) {
    try {
        if (await vincularItemControle(itemControlePorChave(chave))) toast('✓ NF vinculada à nota existente.');
    } catch (e) { console.error('Erro ao vincular NF à nota:', e); toast('✕ Erro ao vincular a NF.'); }
}
function vincularTodasProvaveis() {
    const alvos = montarControleNfs().filter(it => it.possivelNota);
    if (!alvos.length) return;
    showConfirmModal({
        title: 'Vincular NFs às notas existentes?',
        message: `${alvos.length} NF(s) têm o mesmo número e o mesmo valor de uma nota que já existe (na relação ou arquivada). Vincular cada uma à sua nota? Nada é apagado.`,
        confirmText: 'Vincular todas', confirmClass: 'success',
        onConfirm: async () => {
            let n = 0;
            for (const it of alvos) { try { if (await vincularItemControle(it)) n++; } catch (e) { console.error('Erro ao vincular', it.chave, e); } }
            toast(`✓ ${n} NF(s) vinculada(s).`);
        }
    });
}

async function marcarNfDireta(chave) {
    const it = itemControlePorChave(chave); if (!it || it.tipo !== 'nf') return;
    try {
        if (it.erp) await entradasErpCollection.doc(it.erp.id).update({ statusFluxo: 'historico_direto', marcadaDireta: true, bloqueioFornecedor: false });
        else if (it.nf) await nfsProcessadasCollection.doc(it.nf.id).update({ semFinanceiro: true });
        toast('✓ NF marcada como direta — saiu de "Em aberto" (aba Diretas).');
    } catch (e) { console.error('Erro ao marcar NF direta:', e); toast('✕ Erro ao marcar a NF.'); }
}
async function voltarNfParaAberto(chave) {
    const it = itemControlePorChave(chave); if (!it || it.tipo !== 'nf') return;
    try {
        if (it.erp && it.erp.marcadaDireta) await entradasErpCollection.doc(it.erp.id).update({ statusFluxo: 'pre_selecao', marcadaDireta: false });
        else if (!it.erp && it.nf) await nfsProcessadasCollection.doc(it.nf.id).update({ semFinanceiro: false });
        toast('✓ NF de volta para "Em aberto".');
    } catch (e) { console.error('Erro ao voltar NF:', e); toast('✕ Erro ao atualizar a NF.'); }
}
function marcarSelecionadasDiretas() {
    const chaves = [...selecionadasControle];
    if (!chaves.length) return;
    showConfirmModal({
        title: 'Não vai ao financeiro', message: `Marcar ${chaves.length} NF(s) como diretas? Elas saem de "Em aberto" e ficam na aba Diretas (dá para voltar depois).`,
        confirmText: 'Marcar', confirmClass: 'warning',
        onConfirm: async () => { for (const ch of chaves) await marcarNfDireta(ch); selecionadasControle.clear(); selecaoControleAtiva = false; renderControleNfs(); }
    });
}
// "Enviar para a relação" (Fase 44): a NF já tem fornecedor, valor, vencimento e recurso — a nota é criada
// direto em notasPendentes (com a checagem de duplicidade) e a NF/ERP já fica ligada a ela. Só abre o formulário
// quando falta um dado que o app não tem como saber (aí explica qual).
let envioControleEmAndamento = false;
function dadosEnvioNfParaRelacao(it) {
    let fornecedor = nomeTextoSeguro(it.nomeFornecedor).toUpperCase();
    if (fornecedor && !(it.cnpj && listaFornecedoresSpData.some(f => (f.cnpjs || []).some(c => c.cnpj === it.cnpj)))) {
        const ap = encontrarApelidoFornecedor(fornecedor);
        if (typeof ap === 'string' && ap) fornecedor = ap.toUpperCase();
    }
    const hoje = new Date();
    return {
        fornecedor,
        nf: String(it.numeroNf || '').trim(),
        valor: it.valorTxt ? String(it.valorTxt).replace(/^R\$\s*/, '').trim() : '',
        vencimento: String(it.venc || '').trim(),
        obs: sugerirRecursoImportacaoErp({ nf: it.numeroNf, serie: it.serie }) || '',
        data: `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`
    };
}
async function criarNotaDoControle(it, d) {
    const checklistInicial = Object.keys(checklistDefinition).reduce((acc, key) => ({ ...acc, [key]: false }), {});
    checklistInicial.tirarFoto = false;
    const ref = await notasCollection.add({
        data: d.data, nf: d.nf, vencimento: d.vencimento, valor: d.valor, fornecedor: d.fornecedor, obs: d.obs,
        enviada: false, dataCriacao: (new Date).toISOString(), checklist: checklistInicial
    });
    await adicionarFornecedor(d.fornecedor, true);
    try {
        if (it.erp) await entradasErpCollection.doc(it.erp.id).update({ statusFluxo: 'selecionada_financeiro', notaVinculadaId: ref.id });
        if (it.nf) await nfsProcessadasCollection.doc(it.nf.id).update({ notaVinculadaId: ref.id });
    } catch (e) { console.error('Erro ao ligar a NF à nota criada:', e); }
    return ref.id;
}
async function enviarNfParaRelacao(chave) {
    if (envioControleEmAndamento) return;
    const it = itemControlePorChave(chave); if (!it || it.tipo !== 'nf') return;
    const d = dadosEnvioNfParaRelacao(it);
    const faltando = [!d.fornecedor && 'fornecedor', !d.valor && 'valor', !d.vencimento && 'vencimento'].filter(Boolean);
    if (faltando.length) {
        // Falta dado que o app não tem (ex.: NF antiga processada antes de guardar o vencimento, sem ERP): completa à mão.
        envioPendenteControle = { chave, nf: it.numeroNf, erpId: it.erp ? it.erp.id : null, nfId: it.nf ? it.nf.id : null };
        limparFormularioPrincipal(false);
        DOM.nf.value = d.nf; DOM.forn.value = d.fornecedor; DOM.venc.value = d.vencimento; DOM.valor.value = d.valor;
        if (d.obs && [...DOM.obs.options].some(o => o.value === d.obs)) DOM.obs.value = d.obs;
        switchToScreen('screen-add', 'Adicionar');
        toast(`Esta NF não tem ${faltando.join(' / ')} registrado — complete e toque em Salvar.`);
        return;
    }
    const duplicata = verificarDuplicidade(d.fornecedor, d.nf, d.valor);
    const executar = async () => {
        envioControleEmAndamento = true;
        try {
            await criarNotaDoControle(it, d);
            toast(`✓ NF ${d.nf} enviada para a relação.`);
        } catch (e) { console.error('Erro ao enviar NF para a relação:', e); toast('✕ Erro ao enviar a NF para a relação.'); }
        finally { envioControleEmAndamento = false; }
    };
    if (duplicata) {
        showConfirmModal({
            title: 'Nota Duplicada',
            message: `Já existe uma nota ${duplicata.origem === 'historico' ? 'ARQUIVADA (histórico)' : 'PENDENTE'} para "${d.fornecedor}" com a NF "${d.nf}". Enviar mesmo assim?`,
            confirmText: 'Sim, Enviar', confirmClass: 'warning', onConfirm: executar
        });
        return;
    }
    await executar();
}
async function vincularNotaCriadaAoControle(notaId, nfDigitada) {
    const p = envioPendenteControle;
    if (!p) return;
    envioPendenteControle = null;
    const norm = v => String(v || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (norm(p.nf) !== norm(nfDigitada)) return; // o usuário digitou outra NF — não liga nada por adivinhação
    try {
        if (p.erpId) await entradasErpCollection.doc(p.erpId).update({ statusFluxo: 'selecionada_financeiro', notaVinculadaId: notaId });
        if (p.nfId) await nfsProcessadasCollection.doc(p.nfId).update({ notaVinculadaId: notaId });
    } catch (e) { console.error('Erro ao ligar a NF à nota criada:', e); }
}
function registrarOrigemNaNotaArquivada(notaData, notaId) {
    const e = listaEntradasErp.find(x => x.notaVinculadaId === notaId); if (e) notaData.erpChave = e.id;
    const n = listaNfsProcessadas.find(x => x.notaVinculadaId === notaId); if (n) notaData.nfChave = n.id;
}
function verNoGerenciarNf(chave) {
    const it = itemControlePorChave(chave); if (!it || !it.nota) return;
    abaGerenciar = it.nota.emEspera ? 'espera' : 'saida';
    switchToScreen('screen-manage', 'Gerenciar NF');
    const campo = document.getElementById('gerenciar-search');
    if (campo) campo.value = it.numeroNf || '';
    filtroGerenciarTexto = it.numeroNf || '';
    rebuildNotasPendentesList();
    aplicarFiltroGerenciar();
}
function abrirControleNfs() {
    destinoViaMais = 'screen-controle-nfs';
    destinoRetorno = { para: 'screen-manage', titulo: 'Gerenciar NF' };
    switchToScreen('screen-controle-nfs', 'Controle de NFs');
}

// Junta nfsProcessadas + entradasErp pela mesma chave (nf_serie). Cobre os 3
// casos possíveis: NF processada por XML e já vinculada ao ERP; NF só
// processada por XML (ERP ainda não chegou); e NF que entrou só pelo
// relatório do ERP sem nunca ter passado pelo Editor XML (ex.: fornecedor
// bloqueado ou qualquer outro caso em que não há XML disponível — esse fluxo
// de identificação/pré-seleção/bloqueio é da Fase 5, do agente 1; aqui só
// exibimos o resultado, não alteramos como ele chega) — os três ficam
// marcados com uma origem diferente, sem se confundir.
// ===================================================================
// --- 2.0.5: O NÚMERO DA NF MANDA; O FORNECEDOR SÓ CONFIRMA ---
// ===================================================================
// A mesma NF chega por até 3 caminhos (XML do app, relatório do ERP, nota digitada em "Adicionar") e antes cada tela
// casava de um jeito. Agora há uma regra só: mesmo número (sem zeros à esquerda, série ignorada) = mesma NF, a não ser que o
// fornecedor CONTRADIGA (CNPJ de outra empresa e nome diferente e valor diferente) — aí são NFs de fornecedores distintos
// que por acaso têm o mesmo número, e ficam separadas.
const PALAVRAS_GENERICAS_FORNECEDOR = new Set(['LTDA', 'EPP', 'ME', 'EIRELI', 'SA', 'CIA', 'DE', 'DO', 'DA', 'DOS', 'DAS', 'E', 'COM', 'COMERCIO', 'IND', 'INDUSTRIA', 'PRODUTOS', 'HOSPITALAR', 'HOSPITALARES', 'DISTRIBUIDORA', 'DIST', 'MEDICAMENTOS', 'MEDICOS']);
function tokensFornecedor(nome) {
    const t = String(nome == null ? '' : nome).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ');
    return t.split(/\s+/).filter(w => w.length >= 2 && !PALAVRAS_GENERICAS_FORNECEDOR.has(w));
}
// true = parecem o mesmo fornecedor · false = parecem diferentes · null = sem como comparar
function nomesFornecedorCompativeis(a, b) {
    const ta = tokensFornecedor(a), tb = tokensFornecedor(b);
    if (!ta.length || !tb.length) return null;
    const ja = ta.join(' '), jb = tb.join(' ');
    if (ja === jb) return true;
    if (ja.length >= 6 && jb.length >= 6 && (ja.startsWith(jb) || jb.startsWith(ja))) return true; // nome cortado pelo ERP
    const menor = Math.min(ta.length, tb.length);
    const comuns = ta.filter(w => tb.includes(w)).length;
    return comuns >= Math.min(2, menor) && comuns / menor >= 0.5;
}
function descFornecedor(cnpj, ...nomes) {
    const doc = cnpj ? listaFornecedoresSpData.find(f => (f.cnpjs || []).some(c => c.cnpj === cnpj)) : null;
    const todos = nomes.concat(doc ? [doc.nomeExibido, doc.nomeReal] : []).map(nomeTextoSeguro).filter(Boolean);
    return { cnpj: cnpj || null, nomes: todos };
}
// Força da evidência de que dois registros são do mesmo fornecedor: 3 = CNPJ (mesma entidade) · 2 = nome compatível ·
// 1 = nada contradiz (falta informação ou o valor é igual) · 0 = contradição.
function forcaMesmoFornecedor(a, b, valorA, valorB) {
    if (a.cnpj && b.cnpj && cnpjEmLista(cnpjsDaMesmaEntidadeFornecedor(a.cnpj), b.cnpj)) return 3;
    let nomeConflito = false;
    for (const x of a.nomes) for (const y of b.nomes) {
        const r = nomesFornecedorCompativeis(x, y);
        if (r === true) return 2;
        if (r === false) nomeConflito = true;
    }
    if (valoresNfIguais(valorA, valorB)) return 1;
    if (!nomeConflito && !(a.cnpj && b.cnpj)) return 1;
    return 0;
}
// Junta NFs do app e entradas do ERP pelo número. Devolve { chave: { nf, erp, nfExtras, erpExtras } }; quando há mais de um
// registro da mesma NF (ex.: ERP importado duas vezes com séries diferentes) um é o principal e os demais ficam em *Extras.
function parearNfsEErps(nfs, erps, chaveFn) {
    const clusters = [], porNumero = {};
    const adicionar = (tipo, reg, desc, valor) => {
        const num = normNfNumero(reg.nf); if (!num) return;
        const lista = porNumero[num] = porNumero[num] || [];
        let melhor = null, forca = 0;
        lista.forEach(c => {
            const f = Math.max(...c.membros.map(m => forcaMesmoFornecedor(m.desc, desc, m.valor, valor)));
            if (f > forca) { forca = f; melhor = c; }
        });
        if (!melhor) { melhor = { membros: [], nfs: [], erps: [] }; lista.push(melhor); clusters.push(melhor); }
        melhor.membros.push({ desc, valor });
        (tipo === 'nf' ? melhor.nfs : melhor.erps).push(reg);
    };
    nfs.forEach(nf => adicionar('nf', nf, descFornecedor(nf.cnpjFornecedor, nf.fornecedor), nf.valorTotal));
    erps.forEach(e => adicionar('erp', e, descFornecedor(e.cnpjFornecedor, e.fornecedorNomeRelatorio), e.valor));
    const resultado = {};
    clusters.forEach(c => {
        const nfsOrd = [...c.nfs].sort((a, b) => String(b.processadoEm || '').localeCompare(String(a.processadoEm || '')));
        const pontos = e => (e.vinculo && e.vinculo.status === 'confirmado' ? 2 : 0) + (e.statusFluxo && e.statusFluxo !== 'pre_selecao' ? 1 : 0);
        const erpsOrd = [...c.erps].sort((a, b) => pontos(b) - pontos(a));
        const nf = nfsOrd[0] || null, erp = erpsOrd[0] || null;
        let chave = chaveFn(nf, erp), n = 2;
        while (resultado[chave]) chave = `${chaveFn(nf, erp)}#${n++}`;
        resultado[chave] = { nf, erp, nfExtras: nfsOrd.slice(1), erpExtras: erpsOrd.slice(1) };
    });
    return resultado;
}

function montarHistoricoNfs() {
    // Entrada do ERP ainda em pré-seleção (Fase 5) é decisão pendente — não aparece na linha do tempo até ser decidida.
    // 2.0.5: pareamento pelo número da NF (ver parearNfsEErps).
    const porChave = parearNfsEErps(listaNfsProcessadas, listaEntradasErp.filter(e => e.statusFluxo !== 'pre_selecao'),
        (nf, erp) => { const r = nf || erp; return r.serie ? `${r.nf}_${r.serie}` : String(r.nf); });

    return Object.keys(porChave).map(chave => {
        const { nf, erp } = porChave[chave];
        const numeroNf = (nf && nf.nf) || (erp && erp.nf) || chave;
        const serie = (nf && nf.serie) || (erp && erp.serie) || '';
        const cnpjFornecedor = (nf && nf.cnpjFornecedor) || (erp && erp.cnpjFornecedor) || null;
        const nomeFornecedorBruto = (nf && nf.fornecedor) || (erp && erp.fornecedorNomeRelatorio) || '';
        const docFornecedor = cnpjFornecedor ? listaFornecedoresSpData.find(f => (f.cnpjs || []).some(c => c.cnpj === cnpjFornecedor)) : null;
        const nomeFornecedor = docFornecedor ? (docFornecedor.nomeExibido || docFornecedor.nomeReal) : nomeFornecedorBruto;
        const pedido = (nf && nf.pedido) || (erp && erp.vinculo && erp.vinculo.status === 'confirmado' && erp.vinculo.pedido) || null;
        const cotacao = pedido ? listaCotacoes.find(c => c.pedido === pedido) : null;
        const anotacao = pedido ? listaAnotacoes.find(a => a.pedido === pedido) : null;

        // Data de organização: prioriza a data de lançamento no ERP (mais
        // fiel a "entrada"), depois a emissão real da NF-e, e só em último
        // caso a data em que foi processada dentro do app. Nunca vencimento.
        let dataISO = null;
        if (erp && erp.data) dataISO = converterDataBRparaISO(erp.data);
        if (!dataISO && nf && nf.emissao) dataISO = nf.emissao.slice(0, 10);
        if (!dataISO && nf && nf.processadoEm) dataISO = nf.processadoEm.slice(0, 10);
        const [ano, mes] = dataISO ? dataISO.split('-') : [null, null];

        // Ocorrências/divergências do pedido que mencionam esta NF
        // especificamente (mesmo critério já usado em Relatórios); quando a
        // ocorrência não amarra a uma NF, aparece em todas as NFs do pedido.
        const divergenciasDaNf = [];
        if (anotacao) {
            (anotacao.ocorrencias || []).forEach(oc => {
                if (oc.notaFiscal && oc.notaFiscal !== numeroNf) return;
                (oc.divergencias || []).forEach(d => divergenciasDaNf.push(d));
            });
        }

        const origem = nf && erp ? 'completo' : nf ? 'xml_sem_erp' : 'somente_erp';

        return { chave: 'nf:' + chave, tipo: 'nf', numeroNf, serie, ano, mes, dataISO, cnpjFornecedor, nomeFornecedor, pedido, cotacao, anotacao, divergenciasDaNf, nf, erp, origem };
    });
}

// Registro legado (historicoNotas / "Gerenciar Notas → Arquivar") — fluxo
// manual de controle de pagamento anterior à Fase 6. Entra na MESMA linha do
// tempo, marcado com tipo 'nota_legado', sem tentar casar com uma NF real
// (ver nota no topo do arquivo sobre por que isso não é feito).
function montarHistoricoNotasLegado() {
    return historicoNotas.map(nota => {
        // dataHistorico é gravada como new Date().toLocaleString('pt-BR'),
        // formato "DD/MM/AAAA, HH:MM:SS".
        const m = (nota.dataHistorico || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        const ano = m ? m[3] : null;
        const mes = m ? m[2] : null;
        const dataISO = m ? `${m[3]}-${m[2]}-${m[1]}` : null;
        return {
            chave: 'legado:' + nota.id, tipo: 'nota_legado', numeroNf: nota.nf || '(sem NF)',
            serie: '', ano, mes, dataISO, cnpjFornecedor: null, nomeFornecedor: nota.fornecedor,
            pedido: null, cotacao: null, anotacao: null, divergenciasDaNf: [],
            nf: null, erp: null, origem: 'nota_legado', notaLegado: nota
        };
    });
}

// Linha do tempo única do Histórico — o que a tela realmente usa. NFs "reais"
// (Fase 6) e notas simples arquivadas (legado) convivem juntas, ordenadas
// só por data, cada uma com sua própria identificação visual.
function montarLinhaDoTempoHistorico() {
    return [...montarHistoricoNfs(), ...montarHistoricoNotasLegado()];
}

function textoBuscavelHistoricoNf(item) {
    if (item.tipo === 'nota_legado') {
        return normalizarBuscaRel([item.numeroNf, item.nomeFornecedor, item.notaLegado.obs].filter(Boolean).join(' '));
    }
    const partes = [
        item.numeroNf, item.serie, item.nomeFornecedor, item.cnpjFornecedor, item.pedido,
        item.cotacao ? item.cotacao.origem : '',
        ...(item.nf ? item.nf.itens.map(i => `${i.cProd} ${i.xProd} ${i.codigoSmartCompras || ''} ${i.codigoSpData || ''}`) : []),
        ...(item.erp ? (item.erp.itens || []).map(i => `${i.codigoSpData || ''} ${i.nome || ''}`) : [])
    ];
    return normalizarBuscaRel(partes.filter(Boolean).join(' '));
}

// Paginação do Histórico: mesmo padrão do resto do app (lote + botão "Carregar
// mais (N restante(s))"). A lista de dentro do mês/da busca aparece em lotes,
// e o limite recomeça do primeiro lote a cada nova busca ou troca de ano/mês.
// Expandir/recolher um card NÃO reinicia o limite.
const LOTE_HISTORICO = 40;
let limiteExibicaoHistorico = LOTE_HISTORICO;
function carregarMaisHistorico() {
    limiteExibicaoHistorico += LOTE_HISTORICO;
    renderHistoricoNfs();
}
function htmlListaHistoricoPaginada(itens) {
    const visiveis = itens.slice(0, limiteExibicaoHistorico);
    let html = visiveis.map(item => renderCardHistoricoNf(item)).join('');
    if (itens.length > visiveis.length) {
        html += `<div class="actions mt-3"><button type="button" class="actions-button is-neutral" onclick="carregarMaisHistorico()">Carregar mais (${itens.length - visiveis.length} restante(s))</button></div>`;
    }
    return html;
}

function filtrarHistoricoNfs(texto) {
    historicoFiltroTexto = texto || '';
    limiteExibicaoHistorico = LOTE_HISTORICO;
    renderHistoricoNfs();
}

function selecionarAnoHistorico(ano) {
    historicoAnoSelecionado = ano;
    historicoMesSelecionado = null;
    historicoNfExpandida = null;
    limiteExibicaoHistorico = LOTE_HISTORICO;
    renderHistoricoNfs();
}
function selecionarMesHistorico(mes) {
    historicoMesSelecionado = mes;
    historicoNfExpandida = null;
    limiteExibicaoHistorico = LOTE_HISTORICO;
    renderHistoricoNfs();
}
function voltarNavegacaoHistorico() {
    if (historicoMesSelecionado) historicoMesSelecionado = null;
    else if (historicoAnoSelecionado) historicoAnoSelecionado = null;
    historicoNfExpandida = null;
    limiteExibicaoHistorico = LOTE_HISTORICO;
    renderHistoricoNfs();
}
function toggleDetalheHistoricoNf(chave) {
    historicoNfExpandida = historicoNfExpandida === chave ? null : chave;
    renderHistoricoNfs();
}

// ===================================================================
// --- 2.0.4: DA COTAÇÃO ATÉ A NF, E CORREÇÃO DA CONVERSÃO EM UM TOQUE ---
// ===================================================================
// "Abrir NF" nas divergências da cotação leva direto ao card da NF no Histórico (já aberto, com os itens).
function abrirNfNoHistorico(chave, numeroNf) {
    historicoAnoSelecionado = null; historicoMesSelecionado = null;
    historicoFiltroTexto = String(numeroNf || '');
    historicoNfExpandida = chave;
    limiteExibicaoHistorico = LOTE_HISTORICO;
    const busca = document.getElementById('historico-busca'); if (busca) busca.value = historicoFiltroTexto;
    switchToScreen('screen-history', (menuDetails['screen-history'] && menuDetails['screen-history'].title) || 'Histórico');
    renderHistoricoNfsAgora();
    window.scrollTo({ top: 0 });
}
function abrirNfDaDivergencia(pedido, numeroNf) {
    const alvo = String(numeroNf);
    const nf = listaNfsProcessadas.find(n => String(n.nf) === alvo && (n.pedido === pedido || (n.pedidos || []).includes(pedido)))
        || listaNfsProcessadas.find(n => String(n.nf) === alvo);
    if (!nf) return toast('NF não encontrada no histórico.');
    abrirNfNoHistorico(nf.serie ? `${nf.nf}_${nf.serie}` : String(nf.nf), nf.nf);
}
function numeroLimpo(v) { return parseFloat(Number(v).toFixed(4)); }
// Propostas de correção para um item da NF salva — calculadas pelo app, o usuário só toca:
//  - voltar à quantidade que está no XML (fator 1), quando algum fator foi aplicado;
//  - igualar à quantidade da cotação, quando existe um fator "redondo" que faz as duas baterem.
function propostasCorrecaoConversao(item, i) {
    const fator = Number(i.fatorAplicado) || 1;
    const qXml = Number(i.quantidade) / fator;
    if (!(qXml > 0)) return [];
    const propostas = [];
    if (fator !== 1) propostas.push({ fator: 1, qtd: numeroLimpo(qXml), rotulo: `Voltar à quantidade do XML (${numeroLimpo(qXml)})` });
    const cot = item.cotacao || (item.pedido ? listaCotacoes.find(c => c.pedido === item.pedido) : null);
    const itemCot = cot && i.codigoSmartCompras ? (cot.itens || []).find(c => c.codProduto === i.codigoSmartCompras) : null;
    const cotado = itemCot ? parseFloat(itemCot.quantidade) : NaN;
    if (cotado > 0 && Math.abs(cotado - Number(i.quantidade)) > 0.0001) {
        const f = cotado / qXml;
        const redondo = Number.isFinite(f) && f > 0 && Math.abs(f * 1e6 - Math.round(f * 1e6)) < 1e-3;
        if (redondo && !propostas.some(p => Math.abs(p.fator - f) < 1e-9)) propostas.push({ fator: parseFloat(f.toFixed(6)), qtd: numeroLimpo(cotado), rotulo: `Igualar à cotação (${numeroLimpo(cotado)}, fator ${parseFloat(f.toFixed(6))})` });
    }
    return propostas;
}
function htmlCorrecaoConversaoNfItem(item, i, idx) {
    if (!item.nf) return '';
    const fator = Number(i.fatorAplicado) || 1;
    const resumo = ` <span class="txt-aux">(XML: ${numeroLimpo(Number(i.quantidade) / fator)} × fator ${fator})</span>`;
    const botoes = propostasCorrecaoConversao(item, i).map(p =>
        `<button type="button" class="central-status-toggle" onclick="event.stopPropagation(); corrigirConversaoNfItem('${item.nf.id}', ${idx}, ${p.fator})">${escRel(p.rotulo)}</button>`).join(' ');
    // 2.0.6: qualquer fator pode ser aplicado, sem precisar subir o XML de novo.
    const idCampo = `fator-nf-${item.nf.id}-${idx}`.replace(/[^\w-]/g, '_');
    const manual = `<span class="xml-item-meta">Fator:</span> <input type="text" inputmode="decimal" id="${idCampo}" value="${fator}" style="width:70px" onclick="event.stopPropagation()">
        <button type="button" class="central-status-toggle" onclick="event.stopPropagation(); aplicarFatorManualNfItem('${item.nf.id}', ${idx}, '${idCampo}')">Aplicar fator</button>`;
    return resumo + `<div class="xml-item-acao">${botoes ? botoes + ' ' : ''}${manual}</div>`;
}
function aplicarFatorManualNfItem(nfId, idx, idCampo) {
    const campo = document.getElementById(idCampo); if (!campo) return;
    const f = parseFloat(String(campo.value).replace(',', '.'));
    if (!Number.isFinite(f) || f <= 0) return toast('Informe um fator maior que zero (ex.: 1, 10, 0,5).');
    corrigirConversaoNfItem(nfId, idx, parseFloat(f.toFixed(6)));
}
function corrigirConversaoNfItem(nfId, idx, novoFator) {
    const nf = listaNfsProcessadas.find(n => n.id === nfId);
    const it = nf && nf.itens && nf.itens[idx];
    if (!it) return toast('Item não encontrado.');
    const fatorAnt = Number(it.fatorAplicado) || 1;
    const qXml = Number(it.quantidade) / fatorAnt, vXml = Number(it.valorUnitario) * fatorAnt;
    const novaQtd = numeroLimpo(qXml * novoFator), novoValor = numeroLimpo(vXml / novoFator);
    // O fator também pode estar memorizado para este produto/fornecedor (vale para as próximas NFs): se for o mesmo errado, corrige junto.
    const chaveExc = `${nf.cnpjFornecedor}::${it.cProd}`.replace(/\//g, '_');
    const jaMemorizado = bancoExcecoesXml[chaveExc] !== undefined;
    if (novoFator === fatorAnt) return toast('Esse já é o fator aplicado.');
    showConfirmModal({
        title: 'Corrigir conversão',
        message: `NF ${nf.nf} — ${it.xProd}\nQuantidade: ${it.quantidade} → ${novaQtd}\nValor unitário: ${it.valorUnitario} → ${novoValor}\nFator: ${fatorAnt} → ${novoFator}\nO fator ${novoFator} será lembrado para as próximas NFs deste produto deste fornecedor.\n\nCorrige só o registro da NF salva (o XML original não é alterado).`,
        confirmText: 'Corrigir', confirmClass: 'warning',
        onConfirm: async () => {
            try {
                const novos = nf.itens.map((x, k) => k !== idx ? x : { ...x, quantidade: novaQtd, valorUnitario: novoValor, fatorAplicado: novoFator });
                await nfsProcessadasCollection.doc(nfId).update({ itens: novos });
                await xmlExcecoesCollection.doc(chaveExc).set({ fator: novoFator, atualizadoEm: new Date().toISOString() }, { merge: true });
                toast(`✓ Conversão corrigida: ${novaQtd}.`);
            } catch (e) { console.error('Erro ao corrigir conversão:', e); toast('✕ Erro ao corrigir a conversão.'); }
        }
    });
}

function renderCardHistoricoNf(item) {
    if (item.tipo === 'nota_legado') {
        const n = item.notaLegado;
        return `<div class="nota-item" style="flex-direction:column;align-items:stretch;gap:4px;">
            <div class="nota-info">${escRel(item.nomeFornecedor)} ${escRel(item.numeroNf)} <span class="txt-aux">(registro simples arquivado)</span></div>
            <div class="nota-detalhes">Arquivado em ${escRel(n.dataHistorico)} · Venc: ${escRel(n.vencimento) || 'N/A'} · Valor: ${escRel(n.valor) || 'N/A'}</div>
            ${n.obs ? `<div class="nota-detalhes">Obs: ${escRel(n.obs)}</div>` : ''}
        </div>`;
    }

    const expandido = historicoNfExpandida === item.chave;
    const origemLabel = item.origem === 'somente_erp' ? 'Só ERP (sem XML processado)' : item.origem === 'xml_sem_erp' ? 'Só XML (ERP ainda não vinculado)' : 'XML + ERP';
    const dataExibicao = item.dataISO ? formatarDataBRSimples(item.dataISO) : 'Data não identificada';

    let detalheHTML = '';
    if (expandido) {
        const itensHTML = (item.nf && item.nf.itens && item.nf.itens.length)
            ? item.nf.itens.map((i, idxItem) => `<div class="central-item-linha">${escRel(i.xProd)} — cód. fornecedor ${escRel(i.cProd)}${i.codigoSmartCompras ? ' · SmartCompras ' + escRel(i.codigoSmartCompras) : ''}${i.codigoSpData ? ' · SP Data ' + escRel(i.codigoSpData) : ''} · qtd ${i.quantidade}${htmlCorrecaoConversaoNfItem(item, i, idxItem)}</div>`).join('')
            : '<div class="nota-detalhes"><em>Sem itens de XML processados pra esta NF.</em></div>';

        const vinculoLabels = { confirmado: 'confirmado', sugerido: 'sugerido — precisa de confirmação', sem_associacao: 'sem associação' };
        const vinculo = item.erp && item.erp.vinculo;
        const evidenciasHTML = vinculo && vinculo.evidencias && vinculo.evidencias.length
            ? `<div class="nota-detalhes">Evidências: ${vinculo.evidencias.map(escRel).join(' · ')}</div>`
            : (vinculo && vinculo.motivo ? `<div class="nota-detalhes"><em>${escRel(vinculo.motivo)}</em></div>` : '');
        // Fase 8: sugestão de vínculo ERP→pedido só se torna real com
        // confirmação do usuário — nunca automática. Quando há mais de um
        // pedido candidato (mesmo fornecedor, mesmo valor compatível), lista
        // todos e deixa o usuário escolher; nunca decide sozinho.
        const confirmarVinculoHTML = vinculo && vinculo.status === 'sugerido'
            ? `<div class="xml-item-acao" onclick="event.stopPropagation()" style="display:flex;flex-direction:column;gap:4px;margin-top:4px;">
                ${(vinculo.candidatos && vinculo.candidatos.length ? vinculo.candidatos : [{ pedido: vinculo.pedido }]).map(c => c.pedido ? `<button type="button" class="central-status-toggle" onclick="confirmarVinculoErpComPedido('${item.erp.id}', '${escRel(c.pedido)}')">Confirmar vínculo com o Pedido ${escRel(c.pedido)}</button>` : '').join('')}
              </div>`
            : '';
        const erpHTML = item.erp
            ? `<div class="nota-detalhes">ERP: lançada em ${escRel(item.erp.data || '-')}${item.erp.vencimento ? ', vencimento ' + escRel(item.erp.vencimento) : ''}${vinculo && vinculo.status ? ' · vínculo: ' + escRel(vinculoLabels[vinculo.status] || vinculo.status) : ''}</div>
                ${evidenciasHTML}
                ${confirmarVinculoHTML}`
            : '<div class="nota-detalhes"><em>Ainda não vinculada a uma entrada de ERP.</em></div>';
        // Fase 5: uma NF de origem ERP já arquivada (ou que foi direto pro
        // histórico por bloqueio de fornecedor) pode ser desarquivada
        // temporariamente pra ser trabalhada de novo — sempre com
        // confirmação, sobre o mesmo registro (nunca duplica).
        const podeReabrirErp = item.erp && (item.erp.statusFluxo === 'arquivada' || item.erp.statusFluxo === 'historico_direto');
        const reabrirErpHTML = podeReabrirErp
            ? `<div class="xml-item-acao" onclick="event.stopPropagation()"><button type="button" class="central-status-toggle" onclick="abrirEntradaErpComConfirmacao('${item.erp.id}', () => renderHistoricoNfs())">Desarquivar temporariamente</button></div>`
            : '';

        const divergHTML = item.divergenciasDaNf.length
            ? item.divergenciasDaNf.map(d => {
                const def = TIPOS_DIVERGENCIA_AUDITORIA[d.tipo];
                const linhas = linhasDeMateriais(d);
                return `<div class="central-item-linha"><strong>${def ? escRel(def.label) : escRel(d.tipo)}</strong> (${escRel(d.status || 'pendente')})${linhas.length ? '<br>' + linhas.map(escRel).join('<br>') : ''}</div>`;
            }).join('')
            : '<div class="nota-detalhes"><em>Nenhuma divergência registrada pra este pedido.</em></div>';

        detalheHTML = `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border-color);" onclick="event.stopPropagation()">
            <div class="nota-detalhes"><strong>Itens</strong></div>
            ${itensHTML}
            ${erpHTML}
            ${reabrirErpHTML}
            <div class="nota-detalhes" style="margin-top:6px;"><strong>Auditoria/Divergências</strong></div>
            ${divergHTML}
            ${item.pedido ? `<div class="xml-item-acao" style="margin-top:8px;"><button type="button" class="central-status-toggle" onclick="abrirCentralPedido('${escRel(item.pedido)}')">Ver Pedido completo (comunicação, comparação, histórico)</button></div>` : ''}
        </div>`;
    }

    return `<div class="nota-item" style="flex-direction:column;align-items:stretch;gap:4px;cursor:pointer;" onclick="toggleDetalheHistoricoNf('${item.chave}')">
        <div class="nota-info">NF ${escRel(item.numeroNf)}${item.serie ? '/' + escRel(item.serie) : ''} ${item.nomeFornecedor ? '— ' + escRel(item.nomeFornecedor) : ''}</div>
        <div class="nota-detalhes">${dataExibicao} · ${origemLabel}${item.pedido ? ' · Pedido ' + escRel(item.pedido) : ''}${item.divergenciasDaNf.length ? ' · ' + item.divergenciasDaNf.length + ' divergência(s)' : ''}</div>
        ${detalheHTML}
    </div>`;
}

function renderHistoricoNfs() { agendarRender('historicoNfs', renderHistoricoNfsAgora); }
function renderHistoricoNfsAgora() {
    const nav = document.getElementById('historico-nfs-navegacao');
    const lista = document.getElementById('historico-nfs-lista');
    if (!nav || !lista) return;

    const todos = montarLinhaDoTempoHistorico();
    const termo = normalizarBuscaRel(historicoFiltroTexto.trim());

    const acaoLegadoHTML = historicoNotas.length
        ? `<div class="acao-legado"><button type="button" class="central-status-toggle is-danger" onclick="limparHistorico()">Limpar registros simples arquivados (legado) — ${historicoNotas.length}</button></div>`
        : '';

    // Busca sobrepõe a navegação: mostra resultado achatado de qualquer Ano/Mês.
    if (termo) {
        nav.innerHTML = '';
        const encontrados = todos.filter(item => textoBuscavelHistoricoNf(item).includes(termo))
            .sort((a, b) => (b.dataISO || '').localeCompare(a.dataISO || ''));
        lista.innerHTML = (encontrados.length
            ? htmlListaHistoricoPaginada(encontrados)
            : '<div class="empty-state">Nenhum registro encontrado.</div>') + acaoLegadoHTML;
        return;
    }

    if (historicoAnoSelecionado && historicoMesSelecionado) {
        const doMes = todos.filter(item => item.ano === historicoAnoSelecionado && item.mes === historicoMesSelecionado)
            .sort((a, b) => (b.dataISO || '').localeCompare(a.dataISO || ''));
        nav.innerHTML = `<button type="button" class="central-status-toggle" onclick="voltarNavegacaoHistorico()">← ${NOMES_MESES_HISTORICO[parseInt(historicoMesSelecionado, 10) - 1]}/${historicoAnoSelecionado}</button>`;
        lista.innerHTML = (doMes.length ? htmlListaHistoricoPaginada(doMes) : '<div class="empty-state">Nenhum registro neste mês.</div>') + acaoLegadoHTML;
        return;
    }

    if (historicoAnoSelecionado) {
        const doAno = todos.filter(item => item.ano === historicoAnoSelecionado);
        const meses = [...new Set(doAno.map(item => item.mes))].sort((a, b) => b.localeCompare(a));
        nav.innerHTML = `<button type="button" class="central-status-toggle" onclick="voltarNavegacaoHistorico()">← ${historicoAnoSelecionado}</button>`;
        lista.innerHTML = meses.length
            ? meses.map(mes => `<div class="nota-item" style="cursor:pointer;" onclick="selecionarMesHistorico('${mes}')">
                <div class="nota-info">${NOMES_MESES_HISTORICO[parseInt(mes, 10) - 1]}</div>
                <div class="nota-detalhes">${doAno.filter(item => item.mes === mes).length} registro(s)</div>
            </div>`).join('')
            : '<div class="empty-state">Nenhum registro neste ano.</div>';
        return;
    }

    const anos = [...new Set(todos.map(item => item.ano).filter(Boolean))].sort((a, b) => b.localeCompare(a));
    nav.innerHTML = '';
    lista.innerHTML = anos.length
        ? anos.map(ano => `<div class="nota-item" style="cursor:pointer;" onclick="selecionarAnoHistorico('${ano}')">
            <div class="nota-info">${ano}</div>
            <div class="nota-detalhes">${todos.filter(item => item.ano === ano).length} registro(s)</div>
        </div>`).join('')
        : '<div class="empty-state">Nenhum registro no histórico ainda. Processe uma NF pelo Editor XML ou importe o relatório do ERP.</div>';
}

// Preenche a lista legada (historicoNotas) — mantida por compatibilidade e
// pelo botão "Limpar registros simples arquivados" acima, mas não tem mais
// uma tela própria: os mesmos dados já aparecem dentro da linha do tempo
// unificada. Blindada com verificação de existência porque os elementos
// dedicados (lista-historico/historico-actions) não fazem mais parte da UI
// principal do Histórico.
function popularListaHistorico(){
    if (!DOM.listaHistorico || !DOM.historicoActions) return;
    DOM.listaHistorico.innerHTML='';if(historicoNotas.length===0){DOM.listaHistorico.innerHTML=`<div class="empty-state">O histórico está vazio.</div>`;DOM.historicoActions.style.display='none'}else{DOM.historicoActions.style.display='grid';historicoNotas.forEach(nota=>{const div=document.createElement('div');div.classList.add('nota-item');div.innerHTML=`<div class="nota-info">${nota.fornecedor} ${nota.nf||''}</div><div class="nota-detalhes">Venc: ${nota.vencimento||'N/A'} | Valor: ${nota.valor||'N/A'} | Obs: ${nota.obs||'N/A'}</div><div class="nota-data">Arquivado em: ${nota.dataHistorico}</div>`;DOM.listaHistorico.appendChild(div)})}
}
async function reconstruirPainelFotosEdit(notaId){const nota=notasPendentes.find(n=>n.id===notaId);if(!nota)return;const painelEdicao=document.querySelector(`div[data-note-id="${notaId}"] .edit-panel`);painelEdicao.innerHTML=`<div class="panel-content"><div class="campo"><label>Fornecedor</label><input type="text" class="fornEdit" value="${nota.fornecedor||''}"></div><div class="campo"><label>NF</label><input type="text" class="nfEdit" value="${nota.nf||''}"></div><div class="campo"><label>Vencimento</label><input type="text" class="vencEdit" value="${nota.vencimento||''}" oninput="formatarDataInput(this)"></div><div class="campo"><label>Valor</label><input type="text" class="valorEdit" value="${nota.valor||''}" onblur="formatarValorBlur(event)"></div><div class="campo"><label>Observações</label><select class="obsEdit">${DOM.obs.innerHTML}</select></div><div class="actions"><button class="actions-button is-success" onclick="salvarEdicao('${nota.id}')"><span class="icon-wrapper"><i class="fa-solid fa-save"></i><span class="material-icons">save</span></span> Salvar</button></div></div>`;const selObs=painelEdicao.querySelector('.obsEdit');const recAtual=nota.obs||'';if(recAtual&&![...selObs.options].some(o=>o.value===recAtual)){selObs.insertAdjacentHTML('beforeend',`<option value="${recAtual.replace(/"/g,'&quot;')}">${recAtual}</option>`);}selObs.value=recAtual||recursoSugeridoDaNota(nota)||'';}
async function compartilharLista(){const texto=DOM.saida.value;if(!texto.trim())return toast("Nada para compartilhar.");if(navigator.share){await navigator.share({title:'Relação de Notas Fiscais',text:texto})}else{await navigator.clipboard.writeText(texto);toast("Copiado!")}}
async function exportar(){if(DOM.saida.value==="")return toast("Nada para copiar.");await navigator.clipboard.writeText(DOM.saida.value);toast("✓ Lista copiada!")}

// ===================================================================

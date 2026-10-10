// 16-spdata-textos.js — Produtos SP Data, textos padrão e geração de texto
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===== CRUD básico de produtos SP Data (Código, renomear, inativar) =====
// A importação em massa (colar relatório) continua existindo como está —
// isto só acrescenta as funções básicas que faltavam pra um produto
// individual: ver a lista de fato (antes só mostrava a contagem),
// cadastrar um novo sem precisar montar um "relatório" de 1 linha,
// renomear e inativar/reativar. Nada disso mexe na associação
// SmartCompras↔SP Data já existente (associacoesSpData), só no cadastro
// em si. "Inativar" nunca apaga o doc — produtos já associados em cotações
// antigas continuam resolvendo normalmente; inativo só para de aparecer
// como sugestão em NOVAS associações.
let filtroProdutosSpData = '';
let produtoSpDataEditando = new Set();
let limiteExibicaoSpData = 40;

function filtrarProdutosSpData(texto) {
    filtroProdutosSpData = texto;
    limiteExibicaoSpData = 40;
    renderListaProdutosSpData();
}

function toggleFormNovoProdutoSpData() {
    const form = document.getElementById('spdata-form-novo');
    if (!form) return;
    const abrindo = form.style.display === 'none';
    form.style.display = abrindo ? 'block' : 'none';
    if (abrindo) {
        document.getElementById('spdata-novo-codigo').value = '';
        document.getElementById('spdata-novo-nome').value = '';
        document.getElementById('spdata-novo-unidade').value = '';
    }
}

async function salvarNovoProdutoSpData() {
    const codigo = document.getElementById('spdata-novo-codigo').value.trim();
    const nome = document.getElementById('spdata-novo-nome').value.trim();
    const unidade = document.getElementById('spdata-novo-unidade').value.trim();
    if (!codigo || !nome) return toast('Preencha ao menos código e nome.');
    if (listaProdutosSpData.some(p => p.codigo === codigo)) return toast(`✕ Já existe um produto com o código ${codigo}.`);
    try {
        await produtosSpDataCollection.doc(codigo).set({
            codigo, nome, unidade,
            ativo: true,
            nomeEditadoManualmente: true,
            importadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        });
        toast('✓ Produto cadastrado.');
        toggleFormNovoProdutoSpData();
    } catch (e) {
        console.error('Erro ao cadastrar produto SP Data:', e);
        toast('✕ Erro ao cadastrar. Tente novamente.');
    }
}

function toggleEditarNomeProdutoSpData(codigo) {
    if (produtoSpDataEditando.has(codigo)) produtoSpDataEditando.delete(codigo);
    else produtoSpDataEditando.add(codigo);
    renderListaProdutosSpData();
}

async function salvarNomeProdutoSpData(codigo) {
    const nomeInput = document.getElementById(`spdata-nome-input-${codigo}`);
    const unidadeInput = document.getElementById(`spdata-unidade-input-${codigo}`);
    if (!nomeInput) return;
    const nome = nomeInput.value.trim();
    if (!nome) return toast('O nome não pode ficar em branco.');
    const fatorInput = document.getElementById(`spdata-fator-input-${codigo}`);
    const fatorTxt = fatorInput ? fatorInput.value.trim() : '';
    const fatorFixo = fatorTxt ? parseInt(fatorTxt, 10) : null;
    if (fatorTxt && !(fatorFixo >= 1)) return toast('Fator fixo inválido: use um número inteiro maior que zero ou deixe em branco.');
    const atual = listaProdutosSpData.find(p => p.codigo === codigo) || {};
    try {
        await produtosSpDataCollection.doc(codigo).update({
            nome,
            unidade: unidadeInput ? unidadeInput.value.trim() : '',
            nomeEditadoManualmente: !!atual.nomeEditadoManualmente || nome !== (atual.nome || ''),
            fatorFixo: fatorFixo,
            atualizadoEm: new Date().toISOString()
        });
        produtoSpDataEditando.delete(codigo);
        renderListaProdutosSpData(); // o snapshot do banco pode chegar antes de sair do modo edição
        toast('✓ Produto atualizado.');
    } catch (e) {
        console.error('Erro ao renomear produto SP Data:', e);
        toast('✕ Erro ao salvar. Tente novamente.');
    }
}

// O recurso já foi determinado quando esta NF passou pela Entrada de NF
// (pelas cotações, Fase 20/21) — aqui só é reaproveitado, nunca recalculado
// nem decidido do zero. Só sugere quando todos os itens da NF concordam no
// mesmo recurso; havendo mais de um, fica em branco pra decisão manual.
function sugerirRecursoImportacaoErp(nota) {
    const nfSalva = listaNfsProcessadas.find(nf => nf.nf === nota.nf && (nf.serie || '') === (nota.serie || ''));
    if (!nfSalva || !(nfSalva.itens || []).length) return '';
    const recursos = new Set((nfSalva.itens || []).map(it => {
        if (it.semCotacao) return it.recurso || null;
        if (!it.codigoSmartCompras) return null;
        const cot = listaCotacoes.find(c => c.pedido === (it.pedidoItem || nfSalva.pedido));
        return cot && cot.recursosPorItem ? (cot.recursosPorItem[it.codigoSmartCompras] || null) : null;
    }).filter(Boolean));
    return recursos.size === 1 ? [...recursos][0] : '';
}
async function alternarIgnorarDivergenciaProdutoSpData(codigo) {
    const produto = listaProdutosSpData.find(p => p.codigo === codigo);
    if (!produto) return toast('Associe o SP Data deste item primeiro.');
    const novo = !produto.ignorarDivergenciaUnidade;
    try {
        await produtosSpDataCollection.doc(codigo).update({ ignorarDivergenciaUnidade: novo, atualizadoEm: new Date().toISOString() });
        produto.ignorarDivergenciaUnidade = novo;
        toast(novo ? '✓ Divergência de quantidade/valor unitário deste produto passa a ser ignorada.' : '✓ Este produto volta a ser conferido normalmente.');
        if (nfeInfoAtual) renderAssociacaoCotacaoXml();
    } catch (e) {
        console.error('Erro ao sinalizar produto SP Data:', e);
        toast('✕ Erro ao salvar. Tente novamente.');
    }
}
async function alternarAtivoProdutoSpData(codigo) {
    const produto = listaProdutosSpData.find(p => p.codigo === codigo);
    if (!produto) return;
    const novoAtivo = produto.ativo === false; // ausência de campo = ativo (produtos importados antes desta função existir)
    try {
        await produtosSpDataCollection.doc(codigo).update({ ativo: novoAtivo, atualizadoEm: new Date().toISOString() });
        toast(novoAtivo ? '✓ Produto reativado.' : '✓ Produto inativado — deixa de ser sugerido em novas associações.');
    } catch (e) {
        console.error('Erro ao alternar ativo do produto SP Data:', e);
        toast('✕ Erro ao salvar. Tente novamente.');
    }
}

function renderListaProdutosSpData() {
    const totalEl = document.getElementById('spdata-total-cadastrados');
    const container = document.getElementById('spdata-lista-produtos');
    if (totalEl) totalEl.textContent = `${listaProdutosSpData.length} produto(s) cadastrado(s) atualmente.`;
    if (!container) return;

    const termo = normalizarBuscaRel(filtroProdutosSpData);
    const filtrados = listaProdutosSpData
        .filter(p => !termo || normalizarBuscaRel(p.codigo).includes(termo) || normalizarBuscaRel(p.nome).includes(termo))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    if (filtrados.length === 0) {
        container.innerHTML = '<div class="central-item-vazio">Nenhum produto encontrado.</div>';
        return;
    }

    const visiveis = filtrados.slice(0, limiteExibicaoSpData);
    container.innerHTML = visiveis.map(p => {
        const inativo = p.ativo === false;
        const editando = produtoSpDataEditando.has(p.codigo);
        if (editando) {
            return `<div class="nota-item" style="flex-direction:column;align-items:stretch;gap:6px;">
                <div class="campo"><label>Nome</label><input type="text" class="form-field" id="spdata-nome-input-${p.codigo}" value="${escRel(p.nome || '')}"></div>
                <div class="campo"><label>Unidade</label><input type="text" class="form-field" id="spdata-unidade-input-${p.codigo}" value="${escRel(p.unidade || '')}"></div>
                <div class="campo"><label>Fator fixo (unidades por embalagem) — opcional</label><input type="number" min="1" step="1" class="form-field" id="spdata-fator-input-${p.codigo}" value="${p.fatorFixo > 0 ? p.fatorFixo : ''}" placeholder="Deixe em branco se não se aplica"></div>
                <div class="actions-row">
                    <button class="actions-button is-success" onclick="salvarNomeProdutoSpData('${p.codigo}')"><span class="icon-wrapper"><i class="fa-solid fa-check"></i></span> Salvar</button>
                    <button class="actions-button is-neutral" onclick="toggleEditarNomeProdutoSpData('${p.codigo}')">Cancelar</button>
                </div>
            </div>`;
        }
        return `<div class="nota-item" style="flex-direction:column;align-items:stretch;gap:4px;${inativo ? 'opacity:0.55;' : ''}">
            <div class="nota-info">${escRel(p.codigo)} — ${escRel(p.nome || '')}${inativo ? ' <span style="font-size:12px;color:var(--button-danger);">(inativo)</span>' : ''}</div>
            <div class="nota-detalhes">${p.unidade ? 'Unidade: ' + escRel(p.unidade) : ''}${p.fatorFixo > 0 ? (p.unidade ? ' · ' : '') + 'Fator fixo: ' + p.fatorFixo : ''}</div>
            <div class="actions-row">
                <button type="button" class="central-status-toggle" onclick="toggleEditarNomeProdutoSpData('${p.codigo}')">Editar</button>
                <button type="button" class="central-status-toggle" onclick="alternarAtivoProdutoSpData('${p.codigo}')">${inativo ? 'Reativar' : 'Inativar'}</button>
                <button type="button" class="central-status-toggle" onclick="alternarIgnorarDivergenciaProdutoSpData('${p.codigo}')">${p.ignorarDivergenciaUnidade ? 'Voltar a conferir unidade' : 'Ignorar divergência de unidade'}</button>
            </div>
        </div>`;
    }).join('');

    if (filtrados.length > visiveis.length) {
        container.innerHTML += `<div class="actions" style="margin-top:12px;">
            <button type="button" class="actions-button is-neutral" onclick="carregarMaisProdutosSpData()">Carregar mais (${filtrados.length - visiveis.length} restante(s))</button>
        </div>`;
    }
}
function carregarMaisProdutosSpData() {
    limiteExibicaoSpData += 40;
    renderListaProdutosSpData();
}

// Idempotente: reimportar o mesmo relatório não duplica nada — cada produto
// é gravado por set() no doc cujo id é o próprio código SP Data, então
// reimportar só reescreve os mesmos campos. importadoEm é preservado do
// cadastro original quando o produto já existia (não fica "reimportado"
// toda vez que o inventário é atualizado).
async function confirmarImportacaoSpData() {
    if (!inventarioSpDataPendente) return;
    const produtos = inventarioSpDataPendente;
    const agora = new Date().toISOString();
    const porCodigo = new Map(listaProdutosSpData.map(p => [p.codigo, p]));
    let novos = 0, atualizados = 0;

    try {
        for (let i = 0; i < produtos.length; i += 400) {
            const lote = produtos.slice(i, i + 400);
            const batch = firestore.batch();
            lote.forEach(p => {
                const existente = porCodigo.get(p.codigo);
                const dados = {
                    codigo: p.codigo,
                    // Reimportar o inventário nunca reverte uma renomeação manual nem
                    // reativa silenciosamente um produto inativado — mesmo raciocínio
                    // já usado pra nomeOficial na reimportação de cotação.
                    nome: (existente && existente.nomeEditadoManualmente) ? existente.nome : p.nome,
                    unidade: p.unidade,
                    quantidadeInventario: p.quantidade,
                    precoInventario: p.preco,
                    ativo: existente && existente.ativo === false ? false : true,
                    nomeEditadoManualmente: existente ? !!existente.nomeEditadoManualmente : false,
                    ignorarDivergenciaUnidade: existente ? !!existente.ignorarDivergenciaUnidade : false,
                    fatorFixo: existente && existente.fatorFixo > 0 ? existente.fatorFixo : null,
                    importadoEm: existente ? existente.importadoEm : agora,
                    atualizadoEm: agora
                };
                if (existente) atualizados++; else novos++;
                batch.set(produtosSpDataCollection.doc(p.codigo), dados);
            });
            await batch.commit();
        }
        toast(`✓ Importação concluída: ${novos} novo(s), ${atualizados} atualizado(s).`);
        cancelarImportacaoSpData();
        atualizarContagemSpData();
    } catch (e) {
        console.error('Erro ao importar produtos SP Data:', e);
        toast('✕ Erro ao importar. Tente novamente.');
    }
}

// --- Sugestão de associação por nome — nunca decide sozinho, só filtra
// candidatos. Correspondência exata primeiro; senão, todo token do nome do
// item precisa aparecer no nome do produto SP Data (sem fuzzy matching,
// sem IA — comparação de texto objetiva). ---
function normalizarTextoBusca(s) {
    return upAud(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
// Mesmo critério de buscarSugestoesSpData na base (token a token — nunca
// aproximação/distância de texto), com um 3º nível pensado especificamente
// pra cotação: o nome do XML do fornecedor costuma incluir sal químico,
// forma farmacêutica e embalagem que o "Comentario" da cotação não repete
// (ex.: XML "MIDAZOLAM CLORIDRATO 5MG/ML SOL INJ 10ML" × cotação "MIDAZOLAM
// 5MG/ML CX C/100AP X 10ML") — exigir que TODA palavra bata simplesmente
// nunca sugere nesses casos, que são a maioria. O 3º nível some pra exigir só
// duas coisas concretas, sempre com token exato/abreviação (nunca distância
// de texto): a primeira palavra (o princípio ativo, quase sempre líder no
// nome) e, se o nome do XML tiver alguma dosagem numérica (ex. "5MG/ML"),
// essa mesma dosagem também precisa aparecer no nome da cotação.
function buscarSugestoesCotacao(nomeItem, itens) {
    const alvo = normalizarTextoBusca(nomeItem);
    if (!alvo) return [];
    const tokensAlvo = alvo.split(/\s+/).filter(Boolean);
    if (!tokensAlvo.length) return [];
    const nomeDoItem = it => normalizarTextoBusca(it.nomeOficial || it.descricao || '');
    const exatas = itens.filter(it => nomeDoItem(it) === alvo);
    if (exatas.length) return exatas;
    const tokenBate = (a, b) => a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));
    const todasAsPalavras = itens.filter(it => {
        const tokensItem = nomeDoItem(it).split(/\s+/).filter(Boolean);
        return tokensAlvo.every(ta => tokensItem.some(ti => tokenBate(ta, ti)));
    });
    if (todasAsPalavras.length) return todasAsPalavras;
    const primeira = tokensAlvo[0];
    if (!primeira || primeira.length < 4) return [];
    const dosagensAlvo = tokensAlvo.filter(t => /\d/.test(t));
    return itens.filter(it => {
        const tokensItem = nomeDoItem(it).split(/\s+/).filter(Boolean);
        if (!tokensItem.some(ti => tokenBate(primeira, ti))) return false;
        return !dosagensAlvo.length || dosagensAlvo.some(d => tokensItem.some(ti => tokenBate(d, ti)));
    });
}
function buscarSugestoesSpData(nomeItem) {
    const alvo = normalizarTextoBusca(nomeItem);
    // CAUSA RAIZ (item 451 desaparecendo da lista de associação): esta busca
    // só comparava contra p.nome — nunca contra p.codigo — mesmo o campo de
    // busca (renderBuscaAssociacaoSpData) anunciando "Buscar por nome ou
    // código...". Um produto SP Data cujo nome não contém o código digitado
    // (caso normal: nome é descritivo, código é numérico) nunca aparecia
    // quando buscado pelo código, qualquer que fosse o produto — não é uma
    // exceção do 451, é a regra geral de busca que ignorava código. Corrigido
    // de forma geral: busca por código (exato ou como trecho) além do nome.
    const alvoCodigo = String(nomeItem || '').trim();
    if (!alvo && !alvoCodigo) return [];
    // Produto inativado não entra como sugestão pra NOVA associação — mas
    // continua resolvendo normalmente onde já estiver associado (ver
    // renderAssociacaoSpDataWidget, que busca direto em listaProdutosSpData
    // sem passar por aqui).
    const disponiveis = listaProdutosSpData.filter(p => p.ativo !== false);
    const exatas = disponiveis.filter(p => (alvo && normalizarTextoBusca(p.nome) === alvo) || (alvoCodigo && String(p.codigo || '').trim() === alvoCodigo));
    if (exatas.length > 0) return exatas;
    const tokensAlvo = alvo ? alvo.split(/\s+/).filter(Boolean) : [];
    return disponiveis.filter(p => {
        const nomeProd = normalizarTextoBusca(p.nome);
        const bateNome = tokensAlvo.length > 0 && tokensAlvo.every(t => nomeProd.includes(t));
        const bateCodigo = alvoCodigo && String(p.codigo || '').trim().includes(alvoCodigo);
        return bateNome || bateCodigo;
    });
}

// Confirma (ou corrige) uma associação. Histórico append-only: uma correção
// nunca apaga a entrada anterior, só acrescenta uma nova e atualiza qual é
// a atual (spDataCodigo no nível raiz do doc).
async function confirmarAssociacaoSpData(codigoSmartCompras, spDataCodigo, opcoes) {
    opcoes = opcoes || {};
    if (!codigoSmartCompras || !spDataCodigo) return;
    const agora = new Date().toISOString();
    const existente = listaAssociacoesSpData.find(a => a.codigoSmartCompras === codigoSmartCompras);
    const jaEraEssa = existente && existente.spDataCodigo === spDataCodigo;
    const historico = existente ? [...(existente.historico || [])] : [];
    if (!jaEraEssa) historico.push({ spDataCodigo, confirmadoEm: agora, tipo: existente ? 'correcao' : (opcoes.origemAutomatica ? 'confirmacao_automatica_erp' : 'confirmacao') });

    try {
        await associacoesSpDataCollection.doc(codigoSmartCompras).set({
            codigoSmartCompras, spDataCodigo, confirmadoEm: agora, historico
        });
        if (!opcoes.silencioso) toast('✓ Associação confirmada.');
        if (centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
        if (nfeInfoAtual) renderAssociacaoCotacaoXml();
    } catch (e) {
        console.error('Erro ao confirmar associação SP Data:', e);
        if (!opcoes.silencioso) toast('✕ Erro ao associar. Tente novamente.');
    }
}

// --- Configuração dos textos padrão (persistida no Firestore, igual às
// outras personalizações do app — settingsDocRef já mescla qualquer campo
// novo automaticamente em appConfig, então não precisou mexer nesse listener). ---
let configTextosCarregados = false;
function toggleConfigTextos() {
    const body = document.getElementById('config-textos-body');
    const chevron = document.getElementById('config-chevron');
    const abrindo = body.style.display === 'none';
    body.style.display = abrindo ? 'block' : 'none';
    chevron.style.transform = abrindo ? 'rotate(180deg)' : 'rotate(0)';
    if (abrindo) preencherCamposConfigTextos();
}
function preencherCamposConfigTextos() {
    configTextosCarregados = true;
    Object.keys(appConfig.auditoriaTextos).forEach(key => {
        const el = document.getElementById('cfg-' + key);
        if (el) el.value = appConfig.auditoriaTextos[key];
    });
}
function salvarCamposConfigTextos() {
    // CAUSA RAIZ DO BUG (item 7): esta função lia os campos cfg-* às cegas,
    // mesmo quando o painel "Configurar Textos Padrão" nunca tinha sido
    // aberto — nesse caso os <textarea>/<input> continuam vazios (nunca
    // populados por preencherCamposConfigTextos), e a leitura sobrescrevia o
    // texto padrão de verdade com string vazia toda vez que "Gerar
    // Auditoria" rodava. Só "Restaurar Padrão" resolvia porque ele é quem
    // populava os campos pela primeira vez. Agora só lê do DOM se o painel
    // já foi aberto/preenchido nesta sessão.
    if (!configTextosCarregados) return;
    const novo = { ...appConfig.auditoriaTextos };
    Object.keys(novo).forEach(key => {
        const el = document.getElementById('cfg-' + key);
        if (el) novo[key] = el.value;
    });
    appConfig.auditoriaTextos = novo;
    settingsDocRef.set({ auditoriaTextos: novo }, { merge: true }).catch(e => console.error('Erro ao salvar textos da auditoria:', e));
}
function restaurarTextosPadrao() {
    appConfig.auditoriaTextos = { ...AUDITORIA_TEXTOS_DEFAULT };
    settingsDocRef.set({ auditoriaTextos: appConfig.auditoriaTextos }, { merge: true }).catch(e => console.error('Erro ao restaurar textos:', e));
    preencherCamposConfigTextos();
    toast('✓ Textos restaurados ao padrão.');
}

// --- Geração de texto — determinística, sem IA, baseada nos campos
// preenchidos e no tipo de cada divergência. ---
// Linha natural por MATERIAL (não mais por ocorrência inteira) — cada tipo
// define sua própria frase, seguindo o padrão pedido: sem aspas, sem
// parênteses artificiais, como uma mensagem real de trabalho.
function linhaMaterial(tipo, m) {
    switch (tipo) {
        case 'nao_faturado':
            return `${upAud(m.produto)}, quantidade ${m.quantidade || '?'}, não foi faturado.`;
        case 'nao_entregue':
            return `${upAud(m.produto)}, quantidade ${m.quantidade || '?'}, não foi entregue.`;
        case 'nao_cotado':
            return `${upAud(m.produto)}, quantidade ${m.quantidade || '?'}, não constava na cotação.`;
        case 'produto_diferente':
            return `Solicitamos ${upAud(m.produtoPedido)}${m.quantidade ? ', ' + m.quantidade + (m.unidade ? ' ' + m.unidade : '') : ''}, porém foi faturado ${upAud(m.produtoFaturado)}.`;
        case 'quantidade_diferente':
            return `${upAud(m.produto)}: cotado ${m.quantidadeCotada || '?'}${m.unidade ? ' ' + m.unidade : ''}, porém faturado ${m.quantidadeFaturada || '?'}${m.unidade ? ' ' + m.unidade : ''}.`;
        case 'solicitar_carta_correcao':
            return `${upAud(m.produto)}: solicitamos carta de correção, lote informado ${m.loteInformado || '?'} e recebido ${m.loteRecebido || '?'}, validade informada ${m.validadeInformada || '?'} e recebida ${m.validadeRecebida || '?'}.`;
        case 'valor_diferente':
            return `${upAud(m.produto)}, quantidade ${m.quantidade || '?'}: cotado a ${m.valorCotado || '?'}, faturado a ${m.valorFaturado || '?'}.`;
        case 'desacordo_especificacao':
            return `${upAud(m.produto)}: pedimos especificação ${m.especificacaoEsperada || '?'}, porém recebemos ${m.especificacaoRecebida || '?'}.`;
        case 'outro':
            return `${m.produto ? upAud(m.produto) + ': ' : ''}${m.observacao || ''}`;
        default:
            return '';
    }
}

// Avaria gera um PARÁGRAFO PRÓPRIO por material (não uma linha de lista),
// seguindo exatamente o modelo de referência fornecido — não o formato
// genérico de bullet usado pelos outros tipos.
function paragrafoAvaria(m, ctx) {
    const dataFmt = ctx.data ? formatarDataBRSimples(ctx.data) : '[DATA]';
    const unidade = m.unidade || 'unidades';
    const tipoDano = m.tipoDano || 'avariadas';
    let texto = `Gostaria de informar que, no dia ${dataFmt}, após recebermos os materiais do fornecedor ${ctx.fornecedor || '[FORNECEDOR]'} foram identificadas ${m.quantidade || '?'} ${unidade} danificadas (${tipoDano}) do medicamento ${upAud(m.produto)}, referente ao Pedido nº ${ctx.pedido || '[PEDIDO]'}, N.F. ${ctx.nf || '[NF]'}.`;
    if (m.lote || m.validade) {
        texto += `\n\nAs ${unidade} pertencem ao lote ${m.lote || '?'}, com validade para ${m.validade || '?'}.`;
    }
    texto += '\n\nSegue em anexo o registro fotográfico das unidades avariadas.';
    return texto;
}

function contextoAuditoriaAtual() {
    return {
        fornecedor: upAud(document.getElementById('aud-fornecedor').value),
        nf: document.getElementById('aud-nf').value.trim(),
        pedido: document.getElementById('aud-pedido').value.trim(),
        data: document.getElementById('aud-data').value
    };
}

// FORNECEDOR — N.F. — PEDIDO: primeira linha da mensagem, sempre em negrito
// (item 9/17) — a NF aparece mesmo sem cotação/pedido preenchido.
function gerarCabecalhoAuditoria() {
    const ctx = contextoAuditoriaAtual();
    const partes = [ctx.fornecedor, ctx.nf ? `N.F. ${ctx.nf}` : '', ctx.pedido ? `Pedido ${ctx.pedido}` : ''].filter(Boolean);
    return partes.join(' — ');
}

// Corpo da mensagem (usada tanto pra salvar como anotação quanto pra
// compartilhar) — os tipos "normais" viram linhas por material, avaria vira
// parágrafos próprios, cada um separado por linha em branco.
function gerarCorpoAuditoria() {
    const ctx = contextoAuditoriaAtual();
    const blocos = [];
    divergenciasAuditoria.filter(d => d.tipo).forEach(d => {
        const def = TIPOS_DIVERGENCIA_AUDITORIA[d.tipo];
        if (!def) return;
        if (!def.multiMaterial) {
            const texto = textoOcorrenciaUnica(d.tipo, d.campos);
            if (texto) blocos.push(texto);
            return;
        }
        (d.materiais || []).forEach(m => {
            if (d.tipo === 'avariado') { blocos.push(paragrafoAvaria(m.campos, ctx)); return; }
            const linha = linhaMaterial(d.tipo, m.campos);
            if (linha) blocos.push(linha);
        });
        if (d.observacao) blocos.push(d.observacao);
    });
    return blocos;
}

function gerarAnotacaoOuWhatsappAuditoria() {
    const blocos = gerarCorpoAuditoria();
    const obsGeral = document.getElementById('aud-obs-geral').value.trim();
    let texto = gerarCabecalhoAuditoria() + '\n\n' + blocos.join('\n\n');
    if (obsGeral) texto += (blocos.length ? '\n\n' : '') + obsGeral;
    return texto.trim();
}
function gerarEmailAuditoria() {
    const t = appConfig.auditoriaTextos;
    const destinatario = document.getElementById('aud-destinatario').value.trim() || 'Marisa';
    const ctx = contextoAuditoriaAtual();
    const obsGeral = document.getElementById('aud-obs-geral').value.trim();

    // Reaproveita exatamente os mesmos blocos de texto da mensagem/anotação
    // (gerarCorpoAuditoria) — antes o e-mail tinha sua própria lógica de
    // agrupamento por tipo, duplicando praticamente o mesmo conteúdo com uma
    // formatação diferente. Agora o e-mail é: saudação + os mesmos blocos +
    // anexo de fotos (se houver avaria) + fechamento.
    let partes = [t.saudacao.replace(/{DESTINATARIO}/g, destinatario).replace(/{FORNECEDOR}/g, ctx.fornecedor || '[FORNECEDOR]').replace(/{NF}/g, ctx.nf || '[NF]').replace(/{PEDIDO}/g, ctx.pedido || '[PEDIDO]')];
    if (obsGeral) partes.push(obsGeral);

    partes.push(...gerarCorpoAuditoria());

    const temAvaria = divergenciasAuditoria.some(d => d.tipo === 'avariado' && (d.materiais || []).length > 0);
    if (temAvaria) partes.push(t.fotosAnexo);
    partes.push(t.fechamento);
    return partes.join('\n\n');
}

// Constrói o HTML exibido nos blocos editáveis — primeira linha (cabeçalho
// FORNECEDOR — N.F. — PEDIDO) sempre em negrito de verdade via <strong>,
// resto do texto normal. white-space:pre-wrap (CSS já existente) preserva as
// quebras de linha do restante mesmo sem <br>.
function montarHtmlComPrimeiraLinhaNegrito(texto) {
    const [primeiraLinha, ...resto] = texto.split('\n\n');
    const restoTexto = resto.join('\n\n');
    return `<strong>${primeiraLinha.replace(/</g, '&lt;')}</strong>${restoTexto ? '\n\n' + restoTexto.replace(/</g, '&lt;') : ''}`;
}
// Mesma lógica, mas gerando blocos <p> com <br> (formato usado dentro da
// anotação no editor de texto rico, que não tem white-space:pre-wrap) — a
// primeira linha também vem em <strong>, igual ao bloco exibido na tela.
function textoParaBlocoHtmlAnotacao(textoPlano) {
    const blocos = textoPlano.split('\n\n');
    return blocos.map((bloco, i) => {
        const linhasHtml = bloco.split('\n').map(l => l.replace(/</g, '&lt;')).join('<br>');
        return i === 0 ? `<p><strong>${linhasHtml}</strong></p>` : `<p>${linhasHtml}</p>`;
    }).join('');
}

function gerarSaidasAuditoria() {
    const temFornecedor = document.getElementById('aud-fornecedor').value.trim();
    const temObsGeral = document.getElementById('aud-obs-geral').value.trim();
    const temDivergencias = divergenciasAuditoria.some(d => d.tipo);
    // Observação livre vinculada ao pedido (sem nenhuma divergência
    // estruturada) não precisa de Fornecedor pra fazer sentido — mas uma
    // divergência estruturada continua exigindo, já que fornecedor é
    // identificação da ocorrência.
    if (!temFornecedor && !temObsGeral) { toast('✕ Preencha ao menos o Fornecedor, ou registre uma observação livre.'); return; }
    if (temDivergencias && !temFornecedor) { toast('✕ Preencha o Fornecedor pra registrar uma divergência.'); return; }
    // Lote e validade são obrigatórios pra avaria (item 15) — a saída padrão
    // depende diretamente desses dois dados pra fazer sentido como mensagem.
    const avariaSemLoteOuValidade = divergenciasAuditoria.some(d => d.tipo === 'avariado' &&
        (d.materiais || []).some(m => !m.campos.lote || !m.campos.validade));
    if (avariaSemLoteOuValidade) { toast('✕ Preencha Lote e Validade em todos os materiais avariados.'); return; }
    salvarCamposConfigTextos();
    document.getElementById('output-mensagem').innerHTML = montarHtmlComPrimeiraLinhaNegrito(gerarAnotacaoOuWhatsappAuditoria());
    document.getElementById('output-email').innerHTML = gerarEmailAuditoria().replace(/</g, '&lt;');
    document.getElementById('card-resultado-auditoria').style.display = 'block';
    document.getElementById('card-resultado-auditoria').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('✓ Textos gerados!');
}
function mostrarSaidaAuditoria(qual, btnEl) {
    saidaAuditoriaAtiva = qual;
    document.querySelectorAll('#card-resultado-auditoria .output-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#card-resultado-auditoria .output-block').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    document.getElementById('output-' + qual).classList.add('active');
}
// Sempre lê o conteúdo AO VIVO do bloco editável (innerText), nunca uma
// string regenerada — o usuário pode ter revisado/editado o texto depois de
// gerado (item 8), e essa edição precisa ser respeitada em copiar, salvar e
// compartilhar.
function textoAtualSaidaAuditoria() {
    return document.getElementById('output-' + saidaAuditoriaAtiva).innerText.trim();
}
async function copiarSaidaAuditoriaAtual() {
    await navigator.clipboard.writeText(textoAtualSaidaAuditoria());
    toast('✓ Copiado!');
}
// Compartilhar usa o mecanismo nativo do dispositivo (WhatsApp, Mensagens,
// e-mail etc — o usuário escolhe), no lugar da antiga saída "WhatsApp"
// separada, que tinha exatamente o mesmo conteúdo da anotação.
async function compartilharSaidaAuditoriaAtual() {
    const texto = textoAtualSaidaAuditoria();
    if (!texto) return toast('Nada para compartilhar.');
    if (navigator.share) {
        try { await navigator.share({ text: texto }); }
        catch (e) { /* usuário cancelou o share sheet — não é erro */ }
    } else {
        await navigator.clipboard.writeText(texto);
        toast('✓ Copiado! Cole onde quiser compartilhar.');
    }
}

// --- Salvar: cria a anotação automaticamente, com os dados estruturados da
// auditoria preservados junto (não só o texto final), pra permitir filtros e
// relatórios no futuro sem redigitação. Não mexe em salvarAnotacaoAtual(). ---
async function salvarAuditoriaComoAnotacao() {
    const pedido = document.getElementById('aud-pedido').value.trim();
    const nfCampo = document.getElementById('aud-nf').value.trim();
    const fornecedor = upAud(document.getElementById('aud-fornecedor').value);
    const dataAud = document.getElementById('aud-data').value;
    const observacaoGeral = document.getElementById('aud-obs-geral').value.trim();

    // CORREÇÃO ESTRUTURAL 1: antes só salvava d.campos, que pra tipos
    // multiMaterial fica vazio (produto/quantidade moraram em d.materiais[]
    // desde que passou a suportar vários materiais por ocorrência) — os
    // dados estruturados da auditoria ficavam incompletos, só existindo de
    // verdade no texto gerado. Agora salva materiais[] de verdade.
    const divergenciasAtuais = divergenciasAuditoria.filter(d => d.tipo).map(d => {
        const def = TIPOS_DIVERGENCIA_AUDITORIA[d.tipo];
        // Toda divergência nasce com status "pendente" e uma primeira entrada
        // de histórico ("identificação") — sem isso, a mudança de status
        // depois não tinha o que "reabrir": faltava o fato original.
        const statusEHistorico = {
            status: 'pendente',
            historico: [{ tipo: 'identificacao', data: dataAud || new Date().toISOString().slice(0, 10), observacao: '' }]
        };
        if (def && def.multiMaterial) {
            return { tipo: d.tipo, materiais: (d.materiais || []).map(m => ({ ...m.campos })), observacao: d.observacao || '', ...statusEHistorico };
        }
        return { tipo: d.tipo, campos: { ...d.campos }, ...statusEHistorico };
    });

    if (divergenciasAtuais.length === 0 && !observacaoGeral) {
        return toast('Adicione ao menos uma divergência ou observação antes de salvar.');
    }

    // CORREÇÃO ESTRUTURAL 2: liga a ocorrência ao fornecedor por CNPJ (não só
    // por nome) quando o pedido tem cotação e o fornecedor digitado bate com
    // um dos fornecedores dela — mesma checagem já usada pra filtrar o
    // datalist de produtos, reaproveitada aqui.
    const nomeFornecedorDigitado = upAud(document.getElementById('aud-fornecedor').value.trim());
    const fornMatch = cotacaoEncontradaAuditoria ? (cotacaoEncontradaAuditoria.fornecedores || []).find(f =>
        upAud(f.razaoSocial) === nomeFornecedorDigitado || upAud(nomeExibicaoFornecedor(f.razaoSocial)) === nomeFornecedorDigitado
    ) : null;
    const fornecedorCnpj = fornMatch ? fornMatch.cnpj : '';

    const agora = new Date().toISOString();
    const novaOcorrencia = { notaFiscal: nfCampo, fornecedor, fornecedorCnpj, data: dataAud, observacaoGeral, divergencias: divergenciasAtuais, criadoEm: agora };

    // Lê o texto JÁ REVISADO no bloco "Mensagem" (o usuário pode ter editado
    // ou formatado depois de gerar, item 8) em vez de regenerar do zero —
    // respeita qualquer ajuste manual feito antes de salvar. Só recorre a
    // gerarAnotacaoOuWhatsappAuditoria() como fallback se por algum motivo o
    // bloco ainda não foi gerado.
    const elMensagem = document.getElementById('output-mensagem');
    const conteudoTexto = (elMensagem && elMensagem.innerText.trim()) ? elMensagem.innerText.trim() : gerarAnotacaoOuWhatsappAuditoria();
    const blocoHTML = textoParaBlocoHtmlAnotacao(conteudoTexto);

    // Upsert por pedido: se já existe uma anotação pra esse mesmo pedido —
    // seja uma auditoria anterior OU a anotação "resumo vivo" criada
    // automaticamente na importação da cotação (tipo:'cotacao') — a nova
    // ocorrência é ANEXADA ao conteúdo existente (sem apagar nada, inclusive
    // o cabeçalho da cotação ou edições manuais) em vez de criar uma anotação
    // nova. O pedido vira um documento vivo só, sem fragmentar em várias
    // páginas pra cada NF/fornecedor conferido nem duplicar a anotação que a
    // cotação já criou.
    // Auditorias sem pedido preenchido continuam criando uma anotação nova
    // por vez (não há chave de agrupamento confiável nesse caso).
    const existente = pedido ? listaAnotacoes.find(a => a.pedido === pedido) : null;

    try {
        if (existente) {
            const conteudoAtualizado = (existente.conteudo || '') + '<p>&nbsp;</p><hr>' + blocoHTML;
            const ocorrencias = [...(existente.ocorrencias || []), novaOcorrencia];
            await anotacoesTextoCollection.doc(existente.id).update({
                conteudo: conteudoAtualizado,
                ocorrencias,
                // BUG CORRIGIDO: "nfCampo || existente.notaFiscal" virava
                // undefined quando os DOIS eram vazios/ausentes — exatamente
                // o caso de uma anotação criada automaticamente pela cotação
                // (que nunca teve notaFiscal/fornecedor) recebendo uma
                // auditoria com NF em branco. Firestore rejeita undefined
                // com invalid-argument. Agora sempre cai numa string vazia.
                notaFiscal: nfCampo || existente.notaFiscal || '',
                fornecedor: fornecedor || existente.fornecedor || '',
                atualizadoEm: agora
            });
            toast(`✓ Ocorrência adicionada à auditoria do pedido ${pedido}!`);
        } else {
            const titulo = pedido || (nfCampo ? `NF ${nfCampo}` : 'Auditoria');
            const dados = {
                titulo,
                conteudo: blocoHTML,
                tipo: 'auditoria',
                pedido,
                notaFiscal: nfCampo,
                fornecedor,
                data: dataAud,
                observacaoGeral,
                ocorrencias: [novaOcorrencia],
                atualizadoEm: agora,
                criadoEm: agora
            };
            await anotacoesTextoCollection.add(dados);
            toast('✓ Auditoria salva como anotação!');
        }
        // Limpa só o FORMULÁRIO (pronto pra registrar a próxima ocorrência),
        // mas mantém o card de resultado visível e editável — salvar não deve
        // encerrar a chance de revisar/formatar/compartilhar o e-mail ou a
        // mensagem que acabaram de ser gerados (item 8).
        finalizarAposSalvarAuditoria();
    } catch (e) {
        console.error('Erro ao salvar auditoria:', e);
        toast('✕ Erro ao salvar. Tente novamente.');
    }
}

// ===================================================================

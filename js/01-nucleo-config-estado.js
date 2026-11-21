// 01-nucleo-config-estado.js — Configuração do Firebase, referências, estado global, elementos DOM e menus
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = { 
    apiKey: "AIzaSyBbJnhZuL5f9v7KYjJRa1uGY9g17JXkYlo", 
    authDomain: "dadosnf-38b2f.firebaseapp.com", 
    projectId: "dadosnf-38b2f", 
    storageBucket: "dadosnf-38b2f.firebasestorage.app", 
    messagingSenderId: "103044936313", 
    appId: "1:103044936313:web:e0f1ad680cd31445a1daa8" 
};

// Inicializa Firebase apenas se ainda não foi inicializado
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();
// 2.20.4: guarda uma cópia dos dados no aparelho (IndexedDB). Ao reabrir o app em até ~30 min, o Firestore só cobra a leitura do que mudou, em vez de reler tudo.
// Falha sem problema (aba anônima, navegador sem suporte): o app segue como antes.
window.cacheLocalFirestore = 'tentando';   // mostrado em Mais → Uso do Firebase
try { firestore.enablePersistence({ synchronizeTabs: true }).then(() => { window.cacheLocalFirestore = 'ativo'; }).catch(e => { window.cacheLocalFirestore = 'indisponível (' + ((e && e.code) || 'erro') + ')'; console.warn('Cache local do Firestore indisponível:', e && e.code); }); } catch (e) { window.cacheLocalFirestore = 'indisponível (' + ((e && e.code) || 'erro') + ')'; console.warn('Cache local do Firestore:', e); }

// --- REFERÊNCIAS ---
const notasCollection = firestore.collection('notas');
const historicoCollection = firestore.collection('historico');
const anotacoesTextoCollection = firestore.collection('anotacoesTexto');
const settingsDocRef = firestore.collection('config').doc('appSettings');
const xmlExcecoesCollection = firestore.collection('xmlExcecoes');
const cotacoesCollection = firestore.collection('cotacoes');
const produtosSpDataCollection = firestore.collection('produtosSpData');
const associacoesSpDataCollection = firestore.collection('associacoesSpData');
// entradasErp/{nf_serie} — histórico independente do relatório de entrada do
// ERP/SP Data (fonte 3: "o que foi efetivamente lançado"). Nunca escreve em
// cotacoes/notas/NF-XML.
const entradasErpCollection = firestore.collection('entradasErp');
// fornecedoresSpData/{codigo} — cadastro oficial de fornecedores do SP Data
// (código → CNPJ(s), nome real, nome exibido), importado do relatório de
// cadastro. Existe pra resolver o codigoFornecedorSpData que vem no
// relatório de entrada em CNPJ real, e então casar com o CNPJ da NF/XML.
// Guarda um ARRAY de CNPJs por código (nunca assume 1:1) — ver
// salvarCadastroFornecedoresSpData().
const fornecedoresSpDataCollection = firestore.collection('fornecedoresSpData');
// nfsProcessadas/{nf_serie} — o "lado NF" da comparação de 3 fontes (Cotação
// × NF/XML × ERP). Antes disso, o detalhe de quantidade/valor por item da
// NF só existia em memória enquanto a Entrada de NF estava aberta — some
// depois do download. Gravado automaticamente ao baixar o XML corrigido
// (mesmo momento em que já salvamos as exceções de conversão), sem mudar
// nada do fluxo de download em si.
const nfsProcessadasCollection = firestore.collection('nfsProcessadas');
// relatorioGanhadores/{pedido} — relatório "fornecedores ganhadores" do
// SmartCompras, complementar à cotação já existente (nunca uma segunda
// cotação). Um doc por pedido, contendo por item: código, quantidade e
// quantidade de fornecedores que participaram daquela cotação específica
// (contada pela tabela de empresas de cada produto, nunca pelos blocos
// gerais do relatório). Reimportar o mesmo pedido substitui o doc inteiro —
// não há necessidade de histórico aqui, é sempre o retrato mais recente do
// relatório.
const relatorioGanhadoresCollection = firestore.collection('relatorioGanhadores');
// associacoesFornecedor/{cnpjEmit::codigoFornecedor} — NF-e → código do
// fornecedor → item da cotação (fase 2 do roadmap). Liga o código estruturado
// do fornecedor (cProd, vindo do XML da NF-e) ao codigoSmartCompras do item
// correspondente na cotação. A ligação até o SP Data é feita pela
// associacoesSpDataCollection já existente (chave = codigoSmartCompras).
const associacoesFornecedorCollection = firestore.collection('associacoesFornecedor');

// --- ESTADO GLOBAL ---
let notasPendentes = [], historicoNotas = [], fornecedoresSugeridos = [], observacoesSugeridas = [], apelidosFornecedores = {};

// --- SELEÇÃO EM LOTE (notas e fornecedores) ---
let selectionModeNotas = false;
let notasSelecionadas = new Set();
let selectionModeFornecedores = false;
let fornecedoresIgnorados = new Set();
// 2.56.0: recurso fixo por fornecedor, pelo CNPJ (só dígitos) → recurso oficial (ex.: 'C/C CTI'). Vale como padrão na Entrada de NF.
let recursosFixosCnpj = {};
// Bloqueio por CNPJ (mais confiável que nome) — usado pelo fluxo de
// pré-seleção de NFs do ERP (Fase 5). O bloqueio antigo por nome continua
// existindo e sendo usado onde já era usado (checklist de Adicionar Nota);
// este é aditivo, não substitui aquele.
let fornecedoresIgnoradosCnpj = new Set();

// --- ANOTAÇÕES (múltiplas notas com texto rico) ---
let listaAnotacoes = [];
let anotacaoAtualId = null;
let filtroAnotacoesTexto = '';
let selecaoAnotacoesAtiva = false;
let anotacoesSelecionadas = new Set();
let listaCotacoes = [];
let listaProdutosSpData = [];
let listaAssociacoesSpData = [];
let listaFornecedoresSpData = [];
let listaNfsProcessadas = [];
let listaRelatorioGanhadores = [];
let cotacaoEmEdicaoPedido = null; // null = nova cotação; string = editando cotação existente (doc id = pedido)
let fornecedoresCotacaoAtual = []; // rascunho em memória enquanto o formulário está aberto
let contadorFornecedorCotacaoId = 0;
let cotacaoEncontradaAuditoria = null; // cotação associada ao pedido digitado na Nova Auditoria, se existir
let migracaoAnotacoesAntigasFeita = false;
let fornecedoresSelecionados = new Set();
let filtroFornecedoresTexto = '';
let isChecklistUpdate = false;
let isInitialLoad = true;

let relatoriosFiltroTexto = '';
let relatoriosFiltroStatusNotas = 'pendente'; // 'pendente' | 'arquivada' | 'todas'
let relatoriosFiltroStatusDivergencia = 'pendente'; // 'pendente' | 'resolvida' | 'encerrada' | 'todas'

// Configuração Padrão
// Textos padrão do módulo de Auditoria (usado como valor inicial e para o
// botão "Restaurar Padrão"). Definido antes do appConfig pra poder reutilizar.
// Simplificado: os textos por tipo de divergência (avariado, quantidade_diferente
// etc) foram removidos porque o e-mail agora reaproveita os mesmos blocos de
// texto natural da mensagem/anotação (gerarCorpoAuditoria), em vez de ter sua
// própria lógica de agrupamento por tipo com um cabeçalho fixo por grupo.
const AUDITORIA_TEXTOS_DEFAULT = {
    saudacao: '{DESTINATARIO}, boa tarde!\n\nRecebemos do fornecedor {FORNECEDOR} os materiais referentes à NF {NF}, do pedido do SmartCompras número {PEDIDO}.',
    fotosAnexo: 'Seguem em anexo as fotos para comprovação.',
    fechamento: 'Atenciosamente,',
    // 2.10.3: nome de quem recebe o e-mail (vazio = a saudação sai sem nome) e modelos de frase por tipo de divergência.
    destinatario: '',
    modelo_nao_faturado: '{produto}, quantidade {quantidade}, não foi faturado.',
    modelo_nao_entregue: '{produto}, quantidade {quantidade}, não foi entregue.',
    modelo_nao_cotado: '{produto}, quantidade {quantidade}, não constava na cotação.',
    modelo_produto_diferente: 'Solicitamos {produtoPedido}[[, {quantidade}[[ {unidade}]]]], porém foi faturado {produtoFaturado}.',
    modelo_quantidade_diferente: '{produto}: cotado {quantidadeCotada}[[ {unidade}]], porém faturado {quantidadeFaturada}[[ {unidade}]].',
    modelo_avariado: 'Gostaria de informar que, no dia {data}, após recebermos os materiais do fornecedor {fornecedor} foram identificadas {quantidade} {unidade} danificadas ({tipoDano}) do medicamento {produto}, referente ao Pedido nº {pedido}, N.F. {nf}.[[\n\nAs {unidade} pertencem ao lote {lote}, com validade para {validade}.]]\n\nSegue em anexo o registro fotográfico das unidades avariadas.',
    modelo_solicitar_carta_correcao: '{produto}: solicitamos carta de correção, lote informado {loteInformado} e recebido {loteRecebido}, validade informada {validadeInformada} e recebida {validadeRecebida}.',
    modelo_valor_diferente: '{produto}, quantidade {quantidade}: cotado a {valorCotado}, faturado a {valorFaturado}[[ (diferença de {diferencaUnitaria} {sentidoDiferenca} por unidade[[ e de {diferencaTotal} {sentidoDiferenca} no total]])]].',
    modelo_desacordo_especificacao: '{produto}: pedimos especificação {especificacaoEsperada}, porém recebemos {especificacaoRecebida}.',
    modelo_fornecedor_nao_entregou: '[[{fornecedorNome}: ]]ainda não entregou o pedido[[, já são {diasEmAberto} dias em aberto]].[[ {observacao}]]',
    modelo_nf_duplicada: 'A NF {nfDuplicada}[[, referente ao pedido {pedido}]], veio em duplicidade: todos os itens já haviam sido entregues na NF {nfOriginal}.[[ {desfecho}]][[ {observacao}]]',
    modelo_frete_indevido: 'A cotação foi aprovada com frete {condicaoCotada}, porém o fornecedor cobrou frete[[ no valor de {valorFrete}]][[ ({condicaoCobrada})]], em desacordo com a condição aprovada.[[ {observacao}]]',
    modelo_outro: '[[{produto}: ]]{observacao}'
};

let appConfig = {
    personalizacao: { 
        theme: 'light', iconTheme: 'solid', font: 'arial', animationSpeed: 2, transicaoTela: 'ios', transicaoVersao: 2, tabDuracao: 360, carregamento: 'blocos', cascata: 'sim', densidade: 'confortavel', mostrarIconesAbas: 'on',
        menuOrder: ['screen-inicio', 'screen-manage', 'screen-reports', 'screen-cotacoes', 'screen-xml-editor', 'screen-anotacoes', 'screen-settings'],
        // Fase 32: destinos tirados da barra inferior (vão pra tela "Mais"). Vazio = todos na barra.
        menuHidden: []
    },
    anotacoes: '', fornecedores: [], observacoes: ["C/C CTI", "C/C SANTA CASA", "Recurso Proprio Santa Casa", "Recurso Proprio CTI", "PAGO", "REMESSA"],
    auditoriaTextos: { ...AUDITORIA_TEXTOS_DEFAULT }
};

// --- ELEMENTOS DOM CACHEADOS ---
const DOM = {
    data: document.getElementById('data'),
    nf: document.getElementById('nf'),
    venc: document.getElementById('venc'),
    valor: document.getElementById('valor'),
    forn: document.getElementById('forn'),
    obs: document.getElementById('obs'),
    saida: document.getElementById('saida'),
    listaNotas: document.getElementById('lista-notas-pendentes'),
    listaHistorico: document.getElementById('lista-historico'),
    listaRelatorios: document.getElementById('lista-relatorios'),
    totalNotasExport: document.getElementById('total-notas-export'),
    fornDatalist: document.getElementById('fornecedores-sugeridos'),
    listaFornManage: document.getElementById('lista-fornecedores-manage'),
    listaObsManage: document.getElementById('lista-observacoes-manage'),
    obsManageInput: document.getElementById('obs-manage'),
    historicoActions: document.getElementById('historico-actions')
};

// --- DEFINIÇÃO DE MENUS E ÍCONES ---
const menuDetails = {
    'screen-atencao': { icon: 'fa-solid fa-bell', material: 'notifications', title: 'Central de notificações', prep: 'prepararAtencao()',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M12 2a6 6 0 0 0-6 6c0 7-3 9-3 9h18s-3-2-3-9a6 6 0 0 0-6-6z"/><path d="M10 19h4a2 2 0 0 1-4 0z"/></svg>`},
    'screen-agenda': { icon: 'fa-solid fa-calendar-days', material: 'event', title: 'Agenda de trabalho', prep: 'prepararAgenda()',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M3 10h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v2h18V6a2 2 0 0 0-2-2z"/></svg>`},
    'screen-auditoria-central': { icon: 'fa-solid fa-magnifying-glass-chart', material: 'checklist', title: 'Auditoria', prep: 'prepararAuditoriaUnificada()',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M8 12.5v-2M10.5 12.5v-4M13 12.5v-3"/></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><circle opacity="0.4" cx="10.5" cy="10.5" r="7.5"/><path d="M15.8 15.8 21 21" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M7.5 13v-2.6h1.5V13zM9.8 13V8h1.5v5zM12.1 13V9.3h1.5V13z"/></svg>`},
    'screen-assistente': { icon: 'fa-solid fa-comments', material: 'forum', title: 'Assistente', prep: 'prepararAssistente()',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"></path></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M21 12a9 9 0 1 1-17 4L3 21l5-1a9 9 0 0 0 13-8z"/></svg>`},
    'screen-inicio': { icon: 'fa-solid fa-house', material: 'home', title: 'Início',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"></path><path d="M5 10v10h5v-6h4v6h5V10"></path></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M5 10l7-6 7 6v10h-5v-6h-4v6H5z"/><path d="M12 2.6l10 8.7-1.3 1.5L12 5.3l-8.7 7.5L2 11.3z"/></svg>` },
    'screen-equipamentos': { icon: 'fa-solid fa-laptop-medical', material: 'devices_other', title: 'Equipamentos',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="11" rx="2"></rect><path d="M2 19h20"></path></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><rect opacity="0.4" x="4" y="5" width="16" height="11" rx="2"/><path d="M2 18h20a1 1 0 0 1 0 2H2a1 1 0 0 1 0-2z"/></svg>` },
    'screen-controle-nfs': { icon: 'fa-solid fa-folder-open', material: 'fact_check', title: 'Controle de NFs',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5h6l2 2h8v3M3 7v12h15l3-9H6l-3 9"/></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M3 7V5h6l2 2h8v3H6l-3 9z"/><path d="M6 10h16l-3.2 9.2a1 1 0 0 1-.9.8H3z"/></svg>`},
    'screen-manage': { icon: 'fa-solid fa-right-left', material: 'article', title: 'Repasse de NF',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h15l-3-3M20 16H5l3 3"/></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><rect opacity="0.4" x="2" y="3" width="20" height="18" rx="4"/><path d="M5.5 8.5h12.5l-2.7-2.7M18.5 15.5H6l2.7 2.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`},
    'screen-reports': { icon: 'fa-solid fa-calendar-alt', material: 'event_note', title: 'Relatórios', 
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M21 10H3v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10z"></path><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v2h18V6a2 2 0 0 0-2-2z"></path></svg>`},
    'screen-anotacoes': { icon: 'fa-solid fa-sticky-note', material: 'note_alt', title: 'Anotações',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M20 9h-7V2l7 7z"/><path d="M6 2h7.5L20 8.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg>`},
    'screen-cotacoes': { icon: 'fa-solid fa-file-signature', material: 'request_quote', title: 'Cotações',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5h8l5 5V21a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 21z"/><path d="M14 2.5V8h5"/><path d="M8.5 17c1.5-3 2.5 1 3.5-1s1.5 0 3-1"/></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M6 2.5h8l5 5V21.5H6z"/><path d="M8.5 17c1.5-3 2.5 1 3.5-1s1.5 0 3-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="#fff" stroke-width="1.8"/></svg>`},
    'screen-xml-editor': { icon: 'fa-solid fa-file-import', material: 'receipt_long', title: 'Entrada de NF',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5h8l5 5V21a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 21z"/><path d="M14 2.5V8h5"/><path d="M9 14h6M12.5 11.5 15 14l-2.5 2.5"/></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M6 2.5h8l5 5V21.5H6z"/><path d="M9 14h6M12.5 11.5 15 14l-2.5 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="#fff" stroke-width="1.8"/></svg>`},
    'screen-settings': { icon: 'fa-solid fa-cog', material: 'settings', title: 'Ajustes',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33A1.65 1.65 0 0 0 14 20.91V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.51-1A1.65 1.65 0 0 0 7.4 19.4l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.51 1 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>`},
};

// leandromendonssa
const pilhaRetorno = []; // 2.9.7: pilha de retorno (ver 30-navegacao.js)
let navRetornoAtiva = 0;
let destinoViaMais = null; // Fase 36: destino aberto pela tela "Mais" (ganha o Voltar para ela)
let destinoRetorno = { para: 'screen-mais', titulo: 'Mais' }; // Fase 38: para onde o Voltar do destino acima leva
const screenParentMap = { 'screen-resumo-pend': 'screen-inicio', 'screen-danfe-fonte': 'screen-settings', 'screen-lote': 'screen-inicio', 'screen-personalizacao': 'screen-settings', 'screen-pz-aparencia': 'screen-settings', 'screen-pz-animacoes': 'screen-settings', 'screen-pz-dock': 'screen-settings', 'screen-pz-menus': 'screen-settings', 'screen-pz-logo': 'screen-settings', 'screen-pz-assinatura': 'screen-settings', 'screen-fornecedores': 'screen-settings', 'screen-observacoes': 'screen-settings', 'screen-import': 'screen-manage', 'screen-export': 'screen-manage', 'screen-conta': 'screen-settings', 'screen-aprovacoes': 'screen-settings', 'screen-backup': 'screen-settings', 'screen-spdata': 'screen-settings', 'screen-historico-mudancas': 'screen-settings', 'screen-ajuda': 'screen-settings', 'screen-uso-firebase': 'screen-settings', 'screen-config-smartcompras': 'screen-settings', 'screen-config-analise-cotacoes': 'screen-settings', 'screen-dev': 'screen-settings', 'screen-ling': 'screen-settings', 'screen-cotacao-editor': 'screen-central-pedido', 'screen-central-pedido': 'screen-cotacoes', 'screen-anotacoes-editor': 'screen-anotacoes', 'screen-auditoria-nova': 'screen-anotacoes' };
const closeBtnBackScreen = { 'screen-resumo-pend': 'screen-inicio', 'screen-danfe-fonte': 'screen-dev', 'screen-lote': 'screen-inicio', 'screen-personalizacao': 'screen-settings', 'screen-pz-aparencia': 'screen-personalizacao', 'screen-pz-animacoes': 'screen-personalizacao', 'screen-pz-dock': 'screen-personalizacao', 'screen-pz-menus': 'screen-personalizacao', 'screen-pz-logo': 'screen-personalizacao', 'screen-pz-assinatura': 'screen-personalizacao', 'screen-fornecedores': 'screen-settings', 'screen-observacoes': 'screen-settings', 'screen-import': 'screen-manage', 'screen-export': 'screen-manage', 'screen-conta': 'screen-settings', 'screen-aprovacoes': 'screen-settings', 'screen-backup': 'screen-settings', 'screen-spdata': 'screen-settings', 'screen-historico-mudancas': 'screen-settings', 'screen-ajuda': 'screen-settings', 'screen-uso-firebase': 'screen-dev', 'screen-config-smartcompras': 'screen-dev', 'screen-config-analise-cotacoes': 'screen-settings', 'screen-dev': 'screen-settings', 'screen-ling': 'screen-dev', 'screen-cotacao-editor': 'screen-central-pedido', 'screen-central-pedido': 'screen-cotacoes', 'screen-anotacoes-editor': 'screen-anotacoes', 'screen-auditoria-nova': 'screen-anotacoes' };
const speedTextMap = { 0: 'Off', 1: 'Lenta', 2: 'Normal', 3: 'Rápida' };
const speedValueMap = { 0: '0s', 1: '0.6s', 2: '0.35s', 3: '0.2s' };
const checklistDefinition={tirarFoto:"Tirar Foto",entradaSistema:"Entrada no sistema",produtosTransferidos:"Produtos transferidos",fotosNoServidor:"Fotos no servidor",cotacaoNoServidor:"Cotação no Servidor",notaEscaneada:"Nota Escaneada",estaNaPlanilha:"Está na planilha",cotacaoAnexada:"Cotação Anexada",notaCarimbada:"Nota Carimbada"};
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/01-nucleo-config-estado.js'] = '2.68.0';

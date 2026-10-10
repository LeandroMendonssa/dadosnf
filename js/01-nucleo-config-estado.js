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

// --- ÁREA DE RELATÓRIOS: apenas leitura/consulta sobre dados já existentes
// (notas, cotações/pedidos, anotações/ocorrências). Não cria nenhuma coleção
// ou estrutura nova no Firestore.
let relatoriosAbaAtiva = 'pedidos'; // 'pedidos' | 'notas' | 'divergencias'
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
    fechamento: 'Atenciosamente,'
};

let appConfig = {
    personalizacao: { 
        theme: 'light', iconTheme: 'solid', font: 'sans', animationSpeed: 2, transicaoTela: 'fade', densidade: 'confortavel', mostrarIconesAbas: 'on',
        menuOrder: ['screen-add', 'screen-manage', 'screen-export', 'screen-reports', 'screen-history', 'screen-cotacoes', 'screen-xml-editor', 'screen-anotacoes', 'screen-settings'],
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
    'screen-add': { icon: 'fa-solid fa-plus-circle', material: 'add_circle', title: 'Adicionar', 
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/><path d="M13 11h3a1 1 0 0 1 0 2h-3v3a1 1 0 0 1-2 0v-3H8a1 1 0 0 1 0-2h3V8a1 1 0 0 1 2 0v3z"/></svg>`},
    'screen-controle-nfs': { icon: 'fa-solid fa-list-check', material: 'fact_check', title: 'Controle de NFs',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l2 2 4-4"></path><rect x="4" y="4" width="16" height="16" rx="3"></rect></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><rect opacity="0.4" x="3" y="3" width="18" height="18" rx="4"/><path d="M10.5 14.5l-2-2 1.2-1.2.8.8 3-3 1.2 1.2z"/></svg>`},
    'screen-manage': { icon: 'fa-solid fa-tasks', material: 'article', title: 'Gerenciar',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 15H8v-2h8v2zm0-4H8v-2h8v2zM14 9V4l5 5h-5z"/></svg>`},
    'screen-reports': { icon: 'fa-solid fa-calendar-alt', material: 'event_note', title: 'Relatórios', 
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M21 10H3v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10z"></path><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v2h18V6a2 2 0 0 0-2-2z"></path></svg>`},
    'screen-export': { icon: 'fa-solid fa-file-export', material: 'ios_share', title: 'Exportar',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M12 15V3l4 5h-3v7h-2z"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4h2v4a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-4h2z"/></svg>`},
    'screen-history': { icon: 'fa-solid fa-history', material: 'history', title: 'Histórico',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M3.51 15A9 9 0 1 0 12 3a9 9 0 0 0-8.49 6H1l6 6V9H1a10 10 0 0 1 .1-2.06z"/><path d="M12 7v5l3.5 2-1 1.73L11 13.73V7h1z"/></svg>`},
    'screen-anotacoes': { icon: 'fa-solid fa-sticky-note', material: 'note_alt', title: 'Anotações',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M20 9h-7V2l7 7z"/><path d="M6 2h7.5L20 8.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg>`},
    'screen-cotacoes': { icon: 'fa-solid fa-file-contract', material: 'request_quote', title: 'Cotações',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="15" y2="17"></line></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M9 13h6v1H9zm0 4h6v1H9z"/></svg>`},
    'screen-xml-editor': { icon: 'fa-solid fa-file-invoice', material: 'receipt_long', title: 'Entrada de NF',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"></path><line x1="9" y1="8" x2="15" y2="8"></line><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="12" y2="16"></line></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M16 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><path d="M9 8h6v1H9zm0 4h6v1H9zm0 4h3v1H9z"/></svg>`},
    'screen-settings': { icon: 'fa-solid fa-cog', material: 'settings', title: 'Ajustes',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33A1.65 1.65 0 0 0 14 20.91V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.51-1A1.65 1.65 0 0 0 7.4 19.4l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.51 1 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>`},
};

let destinoViaMais = null; // Fase 36: destino aberto pela tela "Mais" (ganha o Voltar para ela)
let destinoRetorno = { para: 'screen-mais', titulo: 'Mais' }; // Fase 38: para onde o Voltar do destino acima leva
const screenParentMap = { 'screen-personalizacao': 'screen-settings', 'screen-fornecedores': 'screen-settings', 'screen-observacoes': 'screen-settings', 'screen-import': 'screen-mais', 'screen-conta': 'screen-settings', 'screen-aprovacoes': 'screen-settings', 'screen-backup': 'screen-settings', 'screen-spdata': 'screen-settings', 'screen-historico-mudancas': 'screen-settings', 'screen-cotacao-editor': 'screen-central-pedido', 'screen-central-pedido': 'screen-cotacoes', 'screen-anotacoes-editor': 'screen-anotacoes', 'screen-auditoria-nova': 'screen-anotacoes' };
const closeBtnBackScreen = { 'screen-personalizacao': 'screen-settings', 'screen-fornecedores': 'screen-settings', 'screen-observacoes': 'screen-settings', 'screen-import': 'screen-mais', 'screen-conta': 'screen-settings', 'screen-aprovacoes': 'screen-settings', 'screen-backup': 'screen-settings', 'screen-spdata': 'screen-settings', 'screen-historico-mudancas': 'screen-settings', 'screen-cotacao-editor': 'screen-central-pedido', 'screen-central-pedido': 'screen-cotacoes', 'screen-anotacoes-editor': 'screen-anotacoes', 'screen-auditoria-nova': 'screen-anotacoes' };
const speedTextMap = { 0: 'Off', 1: 'Lenta', 2: 'Normal', 3: 'Rápida' };
const speedValueMap = { 0: '0s', 1: '0.6s', 2: '0.35s', 3: '0.2s' };
const checklistDefinition={tirarFoto:"Tirar Foto",entradaSistema:"Entrada no sistema",produtosTransferidos:"Produtos transferidos",fotosNoServidor:"Fotos no servidor",cotacaoNoServidor:"Cotação no Servidor",notaEscaneada:"Nota Escaneada",estaNaPlanilha:"Está na planilha",cotacaoAnexada:"Cotação Anexada",notaCarimbada:"Nota Carimbada"};


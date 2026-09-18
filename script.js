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
        menuOrder: ['screen-cotacoes', 'screen-xml-editor', 'screen-add', 'screen-manage', 'screen-reports', 'screen-export', 'screen-history', 'screen-anotacoes', 'screen-settings'] 
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
    fornManageInput: document.getElementById('forn-manage'),
    listaObsManage: document.getElementById('lista-observacoes-manage'),
    obsManageInput: document.getElementById('obs-manage'),
    historicoActions: document.getElementById('historico-actions')
};

// --- DEFINIÇÃO DE MENUS E ÍCONES ---
const menuDetails = {
    'screen-add': { icon: 'fa-solid fa-plus-circle', material: 'add_circle', title: 'Adicionar', 
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/><path d="M13 11h3a1 1 0 0 1 0 2h-3v3a1 1 0 0 1-2 0v-3H8a1 1 0 0 1 0-2h3V8a1 1 0 0 1 2 0v3z"/></svg>`},
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

const screenParentMap = { 'screen-personalizacao': 'screen-settings', 'screen-fornecedores': 'screen-settings', 'screen-observacoes': 'screen-settings', 'screen-import': 'screen-settings', 'screen-conta': 'screen-settings', 'screen-aprovacoes': 'screen-settings', 'screen-backup': 'screen-settings', 'screen-spdata': 'screen-settings', 'screen-historico-mudancas': 'screen-settings', 'screen-cotacao-editor': 'screen-central-pedido', 'screen-central-pedido': 'screen-cotacoes', 'screen-anotacoes-editor': 'screen-anotacoes', 'screen-auditoria-nova': 'screen-anotacoes' };
const closeBtnBackScreen = { 'screen-personalizacao': 'screen-settings', 'screen-fornecedores': 'screen-settings', 'screen-observacoes': 'screen-settings', 'screen-import': 'screen-settings', 'screen-conta': 'screen-settings', 'screen-aprovacoes': 'screen-settings', 'screen-backup': 'screen-settings', 'screen-spdata': 'screen-settings', 'screen-historico-mudancas': 'screen-settings', 'screen-cotacao-editor': 'screen-central-pedido', 'screen-central-pedido': 'screen-cotacoes', 'screen-anotacoes-editor': 'screen-anotacoes', 'screen-auditoria-nova': 'screen-anotacoes' };
const speedTextMap = { 0: 'Off', 1: 'Lenta', 2: 'Normal', 3: 'Rápida' };
const speedValueMap = { 0: '0s', 1: '0.6s', 2: '0.35s', 3: '0.2s' };
const checklistDefinition={tirarFoto:"Tirar Foto",entradaSistema:"Entrada no sistema",produtosTransferidos:"Produtos transferidos",fotosNoServidor:"Fotos no servidor",cotacaoNoServidor:"Cotação no Servidor",notaEscaneada:"Nota Escaneada",estaNaPlanilha:"Está na planilha",cotacaoAnexada:"Cotação Anexada",notaCarimbada:"Nota Carimbada"};

// --- FUNÇÕES DE SETUP (LAYOUT) ---
// window.innerHeight pode reportar um valor errado/desatualizado logo na
// abertura da página (ex: navegador em tela dividida/snap do Windows, barras
// de endereço móveis que ainda estão animando), cortando o rodapé do app até
// algum evento de resize "de verdade" acontecer depois. Por isso: preferimos
// visualViewport.height quando disponível (mais confiável), e recalculamos em
// vários momentos-gatilho, não só uma vez.
const setAppHeight = () => {
    const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${h}px`);
};
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 150));
window.addEventListener('load', setAppHeight);
// Rede de segurança: reforça o cálculo pouco depois da carga inicial, pra
// cobrir casos em que o navegador ainda está terminando de ajustar o layout
// da janela (comum em tela dividida) quando o app já rodou o cálculo inicial.
setTimeout(setAppHeight, 300);
setTimeout(setAppHeight, 1000);

// O visualViewport encolhe tanto quando o teclado abre quanto em ajustes reais
// de layout (ex: barra de endereço do navegador recolhendo). Só nos interessa
// tratar isso como "abriu o app-height" no segundo caso — quando o teclado
// abre, NÃO recalculamos --app-height (senão a tab-bar, que é filha do
// container com essa altura, sobe junto e fica flutuando por cima do
// teclado). Em vez disso, só escondemos a tab-bar via classe no body, o que
// libera o espaço que ela ocupava sem mover mais nada.
const KEYBOARD_HEIGHT_THRESHOLD = 120;

const setupKeyboardListener = () => {
    if (!('visualViewport' in window)) return;

    const aplicarEstadoTeclado = (isKeyboardOpen, keyboardHeight) => {
        document.body.classList.toggle('keyboard-open', isKeyboardOpen);
        if (isKeyboardOpen) {
            // Aplica o padding extra na tela ativa no momento (qualquer uma —
            // Anotações, Auditoria, Adicionar etc.), não só numa tela fixa.
            const telaAtiva = document.querySelector('.app-screen.active');
            if (telaAtiva) {
                telaAtiva.style.paddingBottom = `${keyboardHeight + 24}px`;
                const focado = document.activeElement;
                if (focado && telaAtiva.contains(focado) && typeof focado.scrollIntoView === 'function') {
                    setTimeout(() => focado.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
                }
            }
        } else {
            document.querySelectorAll('.app-screen').forEach(s => s.style.paddingBottom = '');
            setAppHeight();
        }
    };

    window.visualViewport.addEventListener('resize', () => {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        aplicarEstadoTeclado(keyboardHeight > KEYBOARD_HEIGHT_THRESHOLD, keyboardHeight);
    });

    // Rede de segurança: se o campo perder o foco e nada mais assumir o foco
    // logo em seguida, força fechar o estado de "teclado aberto". Cobre os
    // casos em que o navegador não dispara o resize do visualViewport de
    // forma confiável ao fechar o teclado — é isso que fazia a barra de
    // navegação ficar "travada" escondida mesmo depois do teclado sumir.
    document.addEventListener('focusout', () => {
        setTimeout(() => {
            const ativo = document.activeElement;
            const aindaEditando = ativo && (ativo.tagName === 'INPUT' || ativo.tagName === 'TEXTAREA' || ativo.tagName === 'SELECT' || ativo.isContentEditable);
            if (!aindaEditando) aplicarEstadoTeclado(false, 0);
        }, 250);
    });
};

function escolherTransicaoTela(tipo) {
    appConfig.personalizacao.transicaoTela = tipo;
    document.body.setAttribute('data-transition', tipo);
    atualizarSelecaoTransicao(tipo);
    salvarPersonalizacao();
}

function atualizarSelecaoTransicao(tipo) {
    document.querySelectorAll('.transition-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === tipo);
    });
}

let transicaoDemoAlternada = false;
function testarTransicaoTela() {
    const a = document.getElementById('transition-demo-a');
    const b = document.getElementById('transition-demo-b');
    transicaoDemoAlternada = !transicaoDemoAlternada;
    a.classList.toggle('active', !transicaoDemoAlternada);
    b.classList.toggle('active', transicaoDemoAlternada);
}

function alterarDensidade(valor) {
    appConfig.personalizacao.densidade = valor;
    document.body.setAttribute('data-density', valor);
    salvarPersonalizacao();
}

function alterarIconesAbas(valor) {
    appConfig.personalizacao.mostrarIconesAbas = valor;
    document.body.setAttribute('data-tab-icons', valor);
    salvarPersonalizacao();
}

function aplicarPersonalizacoes() {
    const { theme, iconTheme, font, animationSpeed, menuOrder, transicaoTela, densidade, mostrarIconesAbas } = appConfig.personalizacao;
    document.documentElement.setAttribute('data-font', font); document.body.setAttribute('data-theme', theme); document.body.setAttribute('data-icon-theme', iconTheme);
    document.body.setAttribute('data-transition', transicaoTela || 'fade');
    document.body.setAttribute('data-density', densidade || 'confortavel');
    document.body.setAttribute('data-tab-icons', mostrarIconesAbas || 'on');
    document.documentElement.style.setProperty('--transition-duration', speedValueMap[animationSpeed]);
    document.querySelector('#theme-select').value = theme; document.querySelector('#icon-theme-select').value = iconTheme; document.querySelector('#font-select').value = font;
    document.querySelector('#animation-speed-slider').value = animationSpeed;
    document.getElementById('animation-speed-value').textContent = speedTextMap[animationSpeed];
    atualizarSelecaoTransicao(transicaoTela || 'fade');
    document.querySelector('#density-select').value = densidade || 'confortavel';
    document.querySelector('#tab-icons-select').value = mostrarIconesAbas || 'on';
    reordenarMenusDOM(menuOrder || Object.keys(menuDetails)); popularListaReordenar();
    atualizarPreviewLogo();
    // Bolinha de novidade: calculada só a partir da lista de novidades já vistas
    // (ver NOVIDADES_APP) — não depende de dados novos nem de listeners.
    atualizarBolinhasNovidade();
    const currentActiveScreen = document.querySelector('.app-screen.active');
    if (currentActiveScreen) { const screenId = currentActiveScreen.id;
        const parentScreenId = screenParentMap[screenId] || screenId; document.querySelectorAll('.tab-item, .sidebar-item').forEach(item => { item.classList.toggle('active', item.dataset.screen === parentScreenId); });
    }
}
    
function reordenarMenusDOM(order) {
    const tabBar = document.getElementById('tab-bar');
    const sidebarNav = document.getElementById('sidebar-nav');
    tabBar.innerHTML = ''; sidebarNav.innerHTML = '';
    order.forEach(screenId => {
        const details = menuDetails[screenId];
        if (details) {
            const iconHTML = `<span class="icon-wrapper"><i class="${details.icon}"></i><span class="material-icons">${details.material}</span>${details.outlineSvg || ''}${details.duotoneSvg || ''}</span>`;
            const tabButton = document.createElement('button'); tabButton.className = 'tab-item'; tabButton.dataset.screen = screenId; tabButton.dataset.title = details.title;
            tabButton.innerHTML = `${iconHTML}<span>${details.title}</span>`;
            tabButton.addEventListener('click', (e) => { e.preventDefault(); switchToScreen(screenId, details.title); });
            tabBar.appendChild(tabButton);
            const sidebarLi = document.createElement('li'); const sidebarA = document.createElement('a'); sidebarA.className = 'sidebar-item'; sidebarA.dataset.screen = screenId; sidebarA.dataset.title = details.title;
            sidebarA.innerHTML = `${iconHTML}<span>${details.title}</span>`;
            sidebarA.addEventListener('click', (e) => { e.preventDefault(); switchToScreen(screenId, details.title); });
            sidebarLi.appendChild(sidebarA); sidebarNav.appendChild(sidebarLi);
        }
    });
}

// --- LÓGICA DE DADOS E FIREBASE ---

// Função Auxiliar: Verificar Duplicidade
function verificarDuplicidade(novoForn, novaNF) {
    if (!novaNF) return null; // Se não tem NF, não verifica
    
    // Normaliza strings para evitar erros por espaços ou minúsculas (ex: "ABC " == "abc")
    const normalize = (str) => str ? str.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
    const nfNormalizada = normalize(novaNF);
    const fornNormalizado = normalize(novoForn);

    const bate = (nota) => {
        const notaNF = normalize(nota.nf);
        const notaForn = normalize(nota.fornecedor);
        // Regra: Mesmo fornecedor E (mesma NF ou NF parecida)
        // Aqui usamos igualdade estrita na normalização, o que pega "123.456" igual a "123456"
        return notaForn === fornNormalizado && notaNF === nfNormalizada;
    };

    const pendente = notasPendentes.find(bate);
    if (pendente) return { nota: pendente, origem: 'pendente' };

    // Também verifica notas já arquivadas no Histórico — evita reimportar uma
    // NF de um relatório do ERP que já foi processada e arquivada antes (o
    // problema de "esquecer qual foi a última NF importada").
    const arquivada = historicoNotas.find(bate);
    if (arquivada) return { nota: arquivada, origem: 'historico' };

    return null;
}

async function salvarNota(){
    const fornecedor = DOM.forn.value.trim().toUpperCase();
    const nf = DOM.nf.value.trim();
    
    if(!fornecedor) {
        DOM.forn.classList.add('input-error');
        setTimeout(() => DOM.forn.classList.remove('input-error'), 500);
        return toast("O campo 'Fornecedor' é obrigatório.");
    }

    // VERIFICAÇÃO DE DUPLICIDADE
    const duplicata = verificarDuplicidade(fornecedor, nf);
    
    if (duplicata) {
        DOM.nf.classList.add('input-error');
        DOM.forn.classList.add('input-error');
        setTimeout(() => {
            DOM.nf.classList.remove('input-error');
            DOM.forn.classList.remove('input-error');
        }, 1000);

        const mensagemOrigem = duplicata.origem === 'historico'
            ? `Já existe uma nota ARQUIVADA (histórico) para o fornecedor "${fornecedor}" com a NF "${nf}".`
            : `Já existe uma nota PENDENTE para o fornecedor "${fornecedor}" com a NF "${nf}".`;

        showConfirmModal({
            title: "Nota Duplicada",
            message: `${mensagemOrigem} Deseja salvar mesmo assim?`,
            confirmText: "Sim, Salvar",
            confirmClass: "warning",
            onConfirm: () => executaSalvamento(fornecedor, nf)
        });
        return;
    }

    await executaSalvamento(fornecedor, nf);
}

async function executaSalvamento(fornecedor, nf) {
    const salvarBtn = document.getElementById('salvarBtn');
    salvarBtn.disabled = true;
    salvarBtn.innerHTML = '<span class="icon-wrapper"><i class="fa-solid fa-spinner fa-spin"></i></span> Salvando...';

    try{
        const checklistInicial = Object.keys(checklistDefinition).reduce((acc,key)=>({...acc,[key]:!1}),{});
        checklistInicial.tirarFoto = false; 

        await notasCollection.add({
            data: DOM.data.value.trim(),
            nf: nf,
            vencimento: DOM.venc.value.trim(),
            valor: DOM.valor.value.trim(),
            fornecedor,
            obs: DOM.obs.value.trim(),
            enviada: false,
            dataCriacao: (new Date).toISOString(),
            checklist: checklistInicial
        });

        await adicionarFornecedor(fornecedor, true);
        
        toast("✓ Nota salva com sucesso!")
        
        // Limpa tudo e foca na NF para a próxima nota
        limparFormularioPrincipal(true); 

    } catch(e) {
        console.error("Erro ao salvar nota:", e);
        toast("✕ Erro ao salvar a nota.");
    } finally {
        salvarBtn.disabled = false;
        // Reseta o visual do botão (chamando a função de limpar sem foco apenas para resetar o texto do botão)
        const botaoOriginal = document.getElementById('salvarBtn');
        botaoOriginal.innerHTML = `<span class="icon-wrapper"><i class="fa-solid fa-save"></i><span class="material-icons">save</span></span> Salvar`;
    }
}

// Função de limpeza atualizada (SEMPRE limpa tudo)
function limparFormularioPrincipal(comFoco=true){
    const today = new Date();
    DOM.data.value = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
    
    // Limpa todos os campos incondicionalmente
    DOM.forn.value = "";
    DOM.obs.value = "";
    DOM.nf.value = "";
    DOM.venc.value = "";
    DOM.valor.value = "";
    
    // Reset do Botão (Visual)
    const salvarBtn = document.getElementById('salvarBtn');
    salvarBtn.innerHTML = `<span class="icon-wrapper"><i class="fa-solid fa-save"></i><span class="material-icons">save</span></span> Salvar`;
    
    if(comFoco) setTimeout(()=>DOM.nf.focus(), 350);
}

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
    ['pedidos', 'notas', 'divergencias'].forEach(a => {
        const btn = document.getElementById(`relatorios-tab-btn-${a}`);
        if (btn) btn.classList.toggle('active', a === aba);
    });
    const busca = document.getElementById('relatorios-busca');
    if (busca) busca.placeholder = aba === 'notas'
        ? 'Buscar por fornecedor ou NF...'
        : aba === 'divergencias'
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

function renderAbaAtivaRelatorios() {
    const container = document.getElementById('relatorios-conteudo-aba');
    if (!container) return; // tela de relatórios ainda não está no DOM (login, etc.)
    if (relatoriosAbaAtiva === 'notas') renderRelatorioNotas(container);
    else if (relatoriosAbaAtiva === 'divergencias') renderRelatorioDivergencias(container);
    else renderRelatorioPedidos(container);
}

function renderRelatorioPedidos(container) {
    const termo = normalizarBuscaRel(relatoriosFiltroTexto);
    const resumo = document.getElementById('relatorios-resumo');

    let pedidos = listaCotacoes.slice();
    if (termo) {
        pedidos = pedidos.filter(c => {
            const fornecedoresTexto = (c.fornecedores || []).map(f => f.razaoSocial || '').join(' ');
            return normalizarBuscaRel(c.pedido).includes(termo)
                || normalizarBuscaRel(c.origem).includes(termo)
                || normalizarBuscaRel(fornecedoresTexto).includes(termo);
        });
    }

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
            <div class="nota-info">${escRel(c.pedido)} ${c.origem ? `<span style="font-weight:400;color:var(--text-light);">— ${escRel(c.origem)}</span>` : ''}</div>
            <div class="nota-detalhes">${numFornecedores} fornecedor(es) cotado(s)${c.dataPedido ? ` | Pedido em ${escRel(c.dataPedido)}` : ''}</div>
            <div class="nota-detalhes">${todasDivergencias.length ? `${todasDivergencias.length} divergência(s) registrada(s)${pendentes ? `, <strong style="color:var(--button-danger);">${pendentes} pendente(s)</strong>` : ''}` : 'Nenhuma divergência registrada'}</div>
        </div>`;
    }).join('');
}

function renderRelatorioNotas(container) {
    const termo = normalizarBuscaRel(relatoriosFiltroTexto);
    const resumo = document.getElementById('relatorios-resumo');

    let notas = [];
    if (relatoriosFiltroStatusNotas === 'pendente') notas = notasPendentes.map(n => ({ ...n, _statusRel: 'pendente' }));
    else if (relatoriosFiltroStatusNotas === 'arquivada') notas = historicoNotas.map(n => ({ ...n, _statusRel: 'arquivada' }));
    else notas = [...notasPendentes.map(n => ({ ...n, _statusRel: 'pendente' })), ...historicoNotas.map(n => ({ ...n, _statusRel: 'arquivada' }))];

    if (termo) {
        notas = notas.filter(n => normalizarBuscaRel(n.fornecedor).includes(termo) || normalizarBuscaRel(n.nf).includes(termo));
    }

    if (resumo) resumo.textContent = `${notas.length} nota(s) encontrada(s)`;

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

    const todas = [];
    listaAnotacoes.forEach(nota => {
        if (!nota.pedido) return;
        (nota.ocorrencias || []).forEach(oc => {
            (oc.divergencias || []).forEach(d => {
                todas.push({ pedido: nota.pedido, fornecedor: oc.fornecedor, notaFiscal: oc.notaFiscal, tipo: d.tipo, status: d.status || 'pendente', linhas: linhasDeMateriais(d) });
            });
        });
    });

    let filtradas = relatoriosFiltroStatusDivergencia === 'todas' ? todas : todas.filter(x => x.status === relatoriosFiltroStatusDivergencia);
    if (termo) {
        filtradas = filtradas.filter(x => normalizarBuscaRel(x.pedido).includes(termo) || normalizarBuscaRel(x.fornecedor).includes(termo) || normalizarBuscaRel(x.notaFiscal).includes(termo));
    }

    if (resumo) resumo.textContent = `${filtradas.length} divergência(s) encontrada(s)`;

    if (filtradas.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhuma divergência encontrada.</div>';
        return;
    }

    container.innerHTML = filtradas.map(x => {
        const def = TIPOS_DIVERGENCIA_AUDITORIA[x.tipo];
        const badgeTexto = x.status === 'pendente' ? 'Pendente' : x.status === 'resolvida' ? 'Resolvida' : 'Encerrada';
        const linhasHTML = x.linhas.length ? x.linhas.map(l => `<div class="central-item-linha">${escRel(l)}</div>`).join('') : '';
        return `<div class="nota-item" style="cursor:pointer;" onclick="abrirCentralPedido('${x.pedido}')">
            <div class="nota-info">${escRel(x.pedido)} ${x.fornecedor ? `<span style="font-weight:400;color:var(--text-light);">— ${escRel(upAud(x.fornecedor))}</span>` : ''} <span class="central-status-badge status-${x.status}">${badgeTexto}</span></div>
            <div class="nota-detalhes">${def ? escRel(def.label) : escRel(x.tipo)}${x.notaFiscal ? ` | NF ${escRel(x.notaFiscal)}` : ''}</div>
            ${linhasHTML}
        </div>`;
    }).join('');
}

// --- LISTENERS DE DADOS ---
function iniciarListenerConfiguracoes() { 
    return settingsDocRef.onSnapshot(doc => { 
      try {
        if (doc.exists) { 
            const data = doc.data(); 
            // Sanitiza: remove entradas que não sejam texto (ex: null/undefined que
            // possam ter ficado na lista por algum motivo), pra nunca travar a tela
            // de carregamento por causa de um item inválido na lista de fornecedores.
            fornecedoresSugeridos = (Array.isArray(data.fornecedores) ? data.fornecedores : []).filter(f => typeof f === 'string' && f.trim() !== '');
            observacoesSugeridas = data.observacoes || appConfig.observacoes; 
            apelidosFornecedores = data.apelidosFornecedores || {}; 
            fornecedoresIgnorados = new Set((Array.isArray(data.fornecedoresIgnorados) ? data.fornecedoresIgnorados : []).filter(f => typeof f === 'string' && f.trim() !== ''));
            fornecedoresIgnoradosCnpj = new Set((Array.isArray(data.fornecedoresIgnoradosCnpj) ? data.fornecedoresIgnoradosCnpj : []).filter(f => typeof f === 'string' && f.trim() !== ''));
            if (document.getElementById('lista-cadastro-fornecedores-spdata')) renderListaFornecedoresUnificada();
            
            // Lógica de merge das configurações salvas
            appConfig = { 
                ...appConfig, 
                ...data, 
                personalizacao: { ...appConfig.personalizacao, ...(data.personalizacao || {}) }, 
                // BUG CORRIGIDO: auditoriaTextos não tinha merge profundo com os
                // padrões (diferente de personalizacao, que já tinha). Se o Firestore
                // guardava um objeto parcial (ex: só a chave alterada uma vez, antes
                // de "salvarCamposConfigTextos" existir preencher tudo), as chaves
                // ausentes ficavam undefined pra sempre, e só "Restaurar Padrão"
                // (que substitui o objeto inteiro) resolvia — daí o e-mail aparecer
                // vazio até isso ser clicado.
                auditoriaTextos: { ...AUDITORIA_TEXTOS_DEFAULT, ...(data.auditoriaTextos || {}) },
            }; 

            // --- CORREÇÃO: FORÇA A INCLUSÃO DA NOVA ABA 'RELATÓRIOS' ---
            // Se o usuário já tinha uma ordem salva sem 'screen-reports', insere ela agora.
            if (appConfig.personalizacao.menuOrder && !appConfig.personalizacao.menuOrder.includes('screen-reports')) {
                // Insere 'screen-reports' na posição 2 (logo após Gerenciar)
                appConfig.personalizacao.menuOrder.splice(2, 0, 'screen-reports');
            }
            // ------------------------------------------------------------

            // --- CORREÇÃO: FORÇA A INCLUSÃO DE 'COTAÇÕES' E 'ENTRADA DE NF' ---
            // Essas duas telas deixaram de ser subitens de Ajustes e viraram abas
            // principais; quem já tinha uma ordem salva sem elas precisa recebê-las
            // agora, senão ficam inacessíveis pelo menu principal.
            if (appConfig.personalizacao.menuOrder) {
                if (!appConfig.personalizacao.menuOrder.includes('screen-cotacoes')) {
                    appConfig.personalizacao.menuOrder.unshift('screen-cotacoes');
                }
                if (!appConfig.personalizacao.menuOrder.includes('screen-xml-editor')) {
                    appConfig.personalizacao.menuOrder.splice(1, 0, 'screen-xml-editor');
                }
            }
            // ------------------------------------------------------------

            // --- REFINO FASE 12: 'Seleção Saída' deixou de ser uma aba
            // própria (unificada dentro de Gerenciar NF) — remove a entrada
            // de quem já tinha recebido essa migração antes, senão fica um
            // item "fantasma" (inofensivo, mas sem tela) na ordem salva.
            if (appConfig.personalizacao.menuOrder) {
                const idx = appConfig.personalizacao.menuOrder.indexOf('screen-selecao-saida');
                if (idx !== -1) appConfig.personalizacao.menuOrder.splice(idx, 1);
            }
            // ------------------------------------------------------------

        } else { 
            settingsDocRef.set({ observacoes: appConfig.observacoes }, { merge: true }); 
        } 
        
        popularDatalist(); 
        popularObservacoesList(); 
        popularListaApelidos(); 
        
        
        aplicarPersonalizacoes(); 
      } catch (e) {
        // Nunca deixa a tela de carregamento travada por causa de um erro
        // inesperado aqui — loga o erro pra investigar, mas libera a tela.
        console.error('Erro ao processar configurações:', e);
        toast('Algumas configurações não carregaram corretamente.');
      } finally {
        if (isInitialLoad) { 
            mostrarLoaderApp(false);
            isInitialLoad = false; 
        } 
      }
    }, error => { 
        console.error("Erro config:", error); 
        toast("Erro ao carregar configurações."); 
        mostrarLoaderApp(false);
    }); 
}

// Guarda as funções de "desinscrever" de cada listener do Firestore, pra poder
// parar tudo no logout e reinscrever do zero no próximo login (senão os
// listeners continuam tentando ler dados sem permissão, ou ficam "mortos" e
// não voltam a funcionar mesmo depois de logar de novo).
let dataUnsubscribers = [];
let dadosAppInscritos = false;

function iniciarDadosAppSeNecessario() {
    if (dadosAppInscritos) return;
    dadosAppInscritos = true;
    carregarEstado();
}

function pararDadosApp() {
    dadosAppInscritos = false;
    dataUnsubscribers.forEach(unsub => { try { unsub(); } catch (e) {} });
    dataUnsubscribers = [];
    isInitialLoad = true;
}

async function carregarEstado(){
    dataUnsubscribers.push(iniciarListenerConfiguracoes());
    
    dataUnsubscribers.push(notasCollection.orderBy('dataCriacao','desc').onSnapshot(snapshot => {
        if(snapshot.metadata.hasPendingWrites && (isChecklistUpdate || snapshot.docChanges().some(c => c.type === 'modified'))){
            isChecklistUpdate = false;
            notasPendentes = snapshot.docs.map(doc => ({id:doc.id, ...doc.data()}));
            return;
        }
        handleSnapshotChanges(snapshot);
    }, error => toast("Erro ao carregar dados.")));
    
    dataUnsubscribers.push(historicoCollection.orderBy('dataHistorico','desc').onSnapshot(snapshot => {
        historicoNotas = snapshot.docs.map(doc => ({id:doc.id, ...doc.data()}));
        popularListaHistorico();
        renderAbaAtivaRelatorios();
    }, error => console.error("Erro ao carregar histórico:", error)));

    dataUnsubscribers.push(xmlExcecoesCollection.onSnapshot(snapshot => {
        bancoExcecoesXml = {};
        snapshot.docs.forEach(doc => { bancoExcecoesXml[doc.id] = doc.data().fator; });
    }, error => console.error("Erro ao carregar exceções de XML:", error)));

    dataUnsubscribers.push(cotacoesCollection.orderBy('atualizadoEm', 'desc').onSnapshot(snapshot => {
        listaCotacoes = snapshot.docs.map(doc => ({ pedido: doc.id, ...doc.data() }));
        if (document.getElementById('lista-cotacoes-container')) renderListaCotacoes();
        if (document.getElementById('central-fornecedores-container') && centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
        renderAbaAtivaRelatorios();
        if (document.getElementById('historico-nfs-navegacao')) renderHistoricoNfs();
    }, error => console.error("Erro ao carregar cotações:", error)));

    dataUnsubscribers.push(produtosSpDataCollection.onSnapshot(snapshot => {
        listaProdutosSpData = snapshot.docs.map(doc => ({ codigo: doc.id, ...doc.data() }));
        if (document.getElementById('spdata-lista-produtos')) renderListaProdutosSpData();
    }, error => console.error("Erro ao carregar produtos SP Data:", error)));

    dataUnsubscribers.push(associacoesSpDataCollection.onSnapshot(snapshot => {
        listaAssociacoesSpData = snapshot.docs.map(doc => ({ codigoSmartCompras: doc.id, ...doc.data() }));
        if (document.getElementById('central-fornecedores-container') && centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
        if (document.getElementById('xml-card-associacao') && nfeInfoAtual) renderAssociacaoCotacaoXml();
    }, error => console.error("Erro ao carregar associações SP Data:", error)));

    dataUnsubscribers.push(associacoesFornecedorCollection.onSnapshot(snapshot => {
        bancoAssociacoesFornecedor = {};
        snapshot.docs.forEach(doc => { bancoAssociacoesFornecedor[doc.id] = doc.data(); });
        if (document.getElementById('xml-card-associacao') && nfeInfoAtual) renderAssociacaoCotacaoXml();
    }, error => console.error("Erro ao carregar associações de fornecedor:", error)));

    // Histórico entradasErp: consumido pela tela de Histórico (Fase 6) via
    // montarHistoricoNfs(), sem coleção própria — só junta com nfsProcessadas
    // pela mesma chave natural (nf_serie) que as duas já usam.
    dataUnsubscribers.push(entradasErpCollection.onSnapshot(snapshot => {
        listaEntradasErp = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (document.getElementById('historico-nfs-navegacao')) renderHistoricoNfs();
    }, error => console.error("Erro ao carregar histórico de entradas do ERP:", error)));

    dataUnsubscribers.push(fornecedoresSpDataCollection.onSnapshot(snapshot => {
        listaFornecedoresSpData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (document.getElementById('lista-cadastro-fornecedores-spdata')) renderListaFornecedoresUnificada();
        if (DOM.fornDatalist) popularDatalist();
    }, error => console.error("Erro ao carregar cadastro de fornecedores SP Data:", error)));

    dataUnsubscribers.push(nfsProcessadasCollection.onSnapshot(snapshot => {
        listaNfsProcessadas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (document.getElementById('central-fornecedores-container') && centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
        if (document.getElementById('historico-nfs-navegacao')) renderHistoricoNfs();
    }, error => console.error("Erro ao carregar NFs processadas:", error)));

    dataUnsubscribers.push(relatorioGanhadoresCollection.onSnapshot(snapshot => {
        listaRelatorioGanhadores = snapshot.docs.map(doc => doc.data());
        if (document.getElementById('central-fornecedores-container') && centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
    }, error => console.error("Erro ao carregar relatório de fornecedores ganhadores:", error)));

    dataUnsubscribers.push(anotacoesTextoCollection.orderBy('atualizadoEm','desc').onSnapshot(async snapshot => {
        listaAnotacoes = snapshot.docs.map(doc => ({id:doc.id, ...doc.data()}));

        // Migração única: se não existe nenhuma anotação nova ainda, mas havia
        // texto no campo antigo (uma anotação só), traz ele pra cá como a
        // primeira anotação, pra não perder o que já estava escrito.
        if (!migracaoAnotacoesAntigasFeita) {
            migracaoAnotacoesAntigasFeita = true;
            if (listaAnotacoes.length === 0 && appConfig.anotacoes && appConfig.anotacoes.trim()) {
                const conteudoMigrado = appConfig.anotacoes.trim().split('\n').map(l => `<div>${l || '<br>'}</div>`).join('');
                try {
                    await anotacoesTextoCollection.add({
                        titulo: 'Anotação',
                        conteudo: conteudoMigrado,
                        criadoEm: new Date().toISOString(),
                        atualizadoEm: new Date().toISOString()
                    });
                } catch (e) { console.error('Erro ao migrar anotação antiga:', e); }
                return; // o próprio snapshot vai disparar de novo com a nota migrada
            }
        }

        renderListaAnotacoes();
        renderAbaAtivaRelatorios();
        if (document.getElementById('historico-nfs-navegacao')) renderHistoricoNfs();
    }, error => console.error("Erro ao carregar anotações:", error)));
}

function handleSnapshotChanges(snapshot){
    const newNotas = snapshot.docs.map(doc => ({id:doc.id, ...doc.data()}));
    notasPendentes = newNotas;
    rebuildNotasPendentesList();
    
    // Atualiza funcionalidades dependentes. Notas marcadas como "pendente" (em
    // espera) ficam de fora do texto de exportação.
    DOM.saida.value = buildSaidaText(notasPendentes.filter(n => !n.emEspera));
    atualizarContadorExportacao();
    atualizarAreaRelatorios();
}

// --- OUTRAS FUNÇÕES AUXILIARES ---
function rebuildNotasPendentesList(){
    if(!DOM.listaNotas) return;

    DOM.listaNotas.classList.toggle('selection-mode', selectionModeNotas);
    atualizarContadorGerenciar();
    renderFiltrosSelecaoSaida();

    const createNotaHTML = nota => {
        const holdBadgeHTML = nota.emEspera ? `<span class="badge-pendente"><i class="fa-solid fa-clock"></i> Pendente</span>` : '';
        const holdChipHTML = nota.emEspera
            ? `<button class="action-chip hold-chip active" onclick="toggleEmEspera('${nota.id}')"><i class="fa-solid fa-rotate-left"></i> Retomar</button>`
            : `<button class="action-chip hold-chip" onclick="toggleEmEspera('${nota.id}')"><i class="fa-solid fa-clock"></i> Pendente</button>`;
        const recursoHTML = nota.obs ? ` | Recurso: ${nota.obs}` : '';
        // Fase 11/12: aptidão pra saída + dados complementares (pedido,
        // CNPJ, destino, recurso confirmado) — sempre visível aqui, mesmo
        // fora do modo de seleção, só informativo, nunca bloqueia nada.
        const aptidao = calcularAptidaoSaidaNota(nota);
        const aptidaoHTML = `<span class="xml-item-badge ${aptidao.badge}" title="${aptidao.label.replace(/"/g, '&quot;')}">${aptidao.label}</span>`;
        const complementoPartes = [
            aptidao.pedido ? `Pedido ${aptidao.pedido}` : null,
            aptidao.destino || null,
            aptidao.cnpjFornecedor ? formatarCnpjExibicao(aptidao.cnpjFornecedor) : null,
            (aptidao.recursos && aptidao.recursos.length) ? `Recurso: ${aptidao.recursos.join(', ')}` : null
        ].filter(Boolean);
        const complementoHTML = complementoPartes.length ? `<div class="nota-data">${complementoPartes.join(' · ')}</div>` : '';

        // Checkbox: seleção em lote (edição) OU seleção pra saída (Fase 12)
        // — nunca os dois ao mesmo tempo, os modos são mutuamente exclusivos
        // (ver toggleModoSelecaoSaida/toggleSelectionModeNotas).
        const checkboxHTML = modoSelecaoSaida
            ? `<label class="nota-select-checkbox" onclick="event.stopPropagation()" title="Selecionar pra saída/repasse"><input type="checkbox" ${nota.selecionadaSaida ? 'checked' : ''} onchange="toggleSelecaoSaidaNota('${nota.id}')"></label>`
            : `<label class="nota-select-checkbox" onclick="event.stopPropagation()"><input type="checkbox" ${notasSelecionadas.has(nota.id) ? 'checked' : ''} onchange="toggleNotaSelecionada('${nota.id}')"></label>`;

        return `${checkboxHTML}<div class="nota-info">${nota.fornecedor} ${nota.nf||''} ${holdBadgeHTML}</div>${complementoHTML}<div class="nota-data">Criada em: ${(new Date(nota.dataCriacao)).toLocaleString('pt-BR')}</div><div class="nota-detalhes">Venc: ${nota.vencimento||'N/A'} | Valor: ${nota.valor||'N/A'}${recursoHTML}</div><div class="nota-detalhes">${aptidaoHTML}</div><div class="actions-row"><button class="action-chip edit-chip" onclick="toggleEditPanel(this, '${nota.id}')"><i class="fa-solid fa-pen"></i> Editar</button>${holdChipHTML}<button class="action-chip delete-chip" onclick="deletarNota('${nota.id}')"><i class="fa-solid fa-trash"></i> Excluir</button></div><div class="edit-panel"></div>`;
    };

    // Fase 12: no modo "Selecionar pra Saída", filtra também por situação —
    // mesma lista/mesmos cards, nunca uma segunda fonte de dados.
    const notasParaExibir = modoSelecaoSaida
        ? notasPendentes.filter(nota => statusBateFiltroSaida(calcularAptidaoSaidaNota(nota), nota))
        : notasPendentes;

    const contadorSaidaEl = document.getElementById('manage-saida-contador');
    if (contadorSaidaEl) {
        if (modoSelecaoSaida) {
            const totalSelecionadas = notasPendentes.filter(n => n.selecionadaSaida).length;
            contadorSaidaEl.textContent = `${notasParaExibir.length} nota(s) neste filtro · ${totalSelecionadas} selecionada(s) no total`;
            contadorSaidaEl.style.display = '';
        } else {
            contadorSaidaEl.style.display = 'none';
        }
    }
    if(notasParaExibir.length===0){
        DOM.listaNotas.innerHTML=`<div class="empty-state">${modoSelecaoSaida ? 'Nenhuma NF encontrada para este filtro.' : 'Nenhuma nota pendente.'}</div>`;
        return;
    }
    
    // Diffing simples
    const domNoteIds = new Set(Array.from(DOM.listaNotas.children).map(li=>li.dataset.noteId));
    const newNoteIds = new Set(notasParaExibir.map(n=>n.id));
    for(const id of domNoteIds){ if(!newNoteIds.has(id)){ const el=DOM.listaNotas.querySelector(`div[data-note-id="${id}"]`); if(el)el.remove(); } }
    const getNotaClassName = (nota) => `nota-item ${nota.enviada?'nota-enviada':''} ${nota.emEspera?'nota-pendente':''} ${nota.selecionadaSaida?'nota-selecionada-saida':''}`.trim();
    notasParaExibir.forEach((nota,index)=>{
        const existingEl = DOM.listaNotas.querySelector(`div[data-note-id="${nota.id}"]`);
        const newHTML = createNotaHTML(nota);
        if(existingEl){
            if(existingEl.innerHTML!==newHTML){
                existingEl.innerHTML=newHTML;
                existingEl.className=getNotaClassName(nota);
                if(!document.hidden) existingEl.classList.add('highlight-update');
            }
        } else {
            const div=document.createElement('div');
            div.className=getNotaClassName(nota);
            div.dataset.noteId=nota.id;
            div.innerHTML=newHTML;
            const referenceNode=DOM.listaNotas.children[index];
            DOM.listaNotas.insertBefore(div,referenceNode||null);
            if(!document.hidden) div.classList.add('highlight-update');
        }
    });
    aplicarFiltroGerenciar();
}

// --- SELEÇÃO EM LOTE DE NOTAS (Gerenciar) ---

let filtroGerenciarTexto = '';

// Busca por NF ou fornecedor na tela Gerenciar. Só esconde/mostra os cards já
// renderizados (não re-renderiza), pra não perder painéis abertos/edições em
// andamento. Reaplicada automaticamente a cada atualização da lista.
function filtrarNotasGerenciar(texto) {
    filtroGerenciarTexto = texto;
    aplicarFiltroGerenciar();
}

function aplicarFiltroGerenciar() {
    const termo = filtroGerenciarTexto.trim().toUpperCase();
    document.querySelectorAll('#lista-notas-pendentes .nota-item').forEach(el => {
        if (!termo) { el.style.display = ''; return; }
        const nota = notasPendentes.find(n => n.id === el.dataset.noteId);
        if (!nota) { el.style.display = ''; return; }
        const aptidao = calcularAptidaoSaidaNota(nota);
        const alvo = [nota.nf, nota.fornecedor, aptidao.pedido].filter(Boolean).join(' ').toUpperCase();
        el.style.display = alvo.includes(termo) ? '' : 'none';
    });
}

function atualizarContadorGerenciar() {
    const counterEl = document.getElementById('manage-counter');
    if (!counterEl) return;
    const total = notasPendentes.length;
    const pendentesCount = notasPendentes.filter(n => n.emEspera).length;
    counterEl.textContent = `${total} nota${total === 1 ? '' : 's'}${pendentesCount > 0 ? ` · ${pendentesCount} pendente${pendentesCount === 1 ? '' : 's'}` : ''}`;
}

// ===================================================================
// --- FASE 12 (unificada com Gerenciar NF, Fase 12-refino): SELEÇÃO ---
// --- DE NFs PARA SAÍDA/REPASSE ---
// ===================================================================
// Não é mais uma tela separada: "Gerenciar NF" e "Seleção Saída" mostravam
// praticamente a mesma coisa, então a seleção pra saída passou a ser um
// MODO dentro da própria tela Gerenciar NF (botão no cabeçalho, igual ao
// modo de seleção em lote já existente) — mesma lista, mesmos cards, mesmos
// botões de Editar/Pendente/Excluir (zero lógica de edição duplicada). A
// seleção em si continua sendo só um campo booleano (selecionadaSaida) na
// MESMA nota — não duplica, não recria e não altera a NF original.
let modoSelecaoSaida = false;
let filtroSelecaoSaidaStatus = 'todas';

const FILTROS_STATUS_SAIDA = [
    { valor: 'todas', label: 'Todas' },
    { valor: 'apta', label: 'Aptas' },
    { valor: 'pendencia', label: 'Com pendência/divergência' },
    { valor: 'nao_conferida', label: 'Não conferidas' },
    { valor: 'selecionadas', label: 'Selecionadas' }
];

function renderFiltrosSelecaoSaida() {
    const el = document.getElementById('manage-saida-filtros');
    if (!el) return;
    el.style.display = modoSelecaoSaida ? '' : 'none';
    el.innerHTML = FILTROS_STATUS_SAIDA.map(f =>
        `<button type="button" class="manage-toolbar-btn${filtroSelecaoSaidaStatus === f.valor ? ' active' : ''}" onclick="filtrarSelecaoSaidaStatus('${f.valor}')">${f.label}</button>`
    ).join('');
}

function filtrarSelecaoSaidaStatus(valor) {
    filtroSelecaoSaidaStatus = valor;
    rebuildNotasPendentesList();
}

// Modo "Selecionar pra Saída" — mutuamente exclusivo com o modo de edição
// em lote (os dois usam o mesmo espaço de checkbox no card; não faz sentido
// os dois ao mesmo tempo).
function toggleModoSelecaoSaida() {
    modoSelecaoSaida = !modoSelecaoSaida;
    if (modoSelecaoSaida && selectionModeNotas) {
        selectionModeNotas = false;
        notasSelecionadas.clear();
        const selBtn = document.getElementById('select-mode-btn');
        if (selBtn) selBtn.classList.remove('active');
        const toolbarBtn = document.getElementById('bulk-select-all-notas');
        if (toolbarBtn) toolbarBtn.style.display = 'none';
        atualizarBulkBarNotas();
    }
    const btn = document.getElementById('saida-mode-btn');
    if (btn) btn.classList.toggle('active', modoSelecaoSaida);
    rebuildNotasPendentesList();
}

// Toggle da seleção pra saída — independente da seleção em lote de Gerenciar
// NF (notasSelecionadas/toggleNotaSelecionada, que serve pra edição em
// lote): aqui o campo persistido é outro (selecionadaSaida), pra não
// confundir os dois conceitos. Atualiza a tela na hora, sem esperar o
// round-trip do Firestore — mesmo padrão já usado em toggleEmEspera.
async function toggleSelecaoSaidaNota(id) {
    const nota = notasPendentes.find(n => n.id === id);
    if (!nota) return;
    const novoValor = !nota.selecionadaSaida;
    nota.selecionadaSaida = novoValor;
    rebuildNotasPendentesList();
    try {
        await notasCollection.doc(id).update({ selecionadaSaida: novoValor });
    } catch (e) {
        console.error('Erro ao marcar seleção pra saída:', e);
        nota.selecionadaSaida = !novoValor;
        rebuildNotasPendentesList();
        toast('✕ Não foi possível salvar a seleção. Tente novamente.');
    }
}

function statusBateFiltroSaida(aptidao, nota) {
    if (filtroSelecaoSaidaStatus === 'todas') return true;
    if (filtroSelecaoSaidaStatus === 'selecionadas') return !!nota.selecionadaSaida;
    if (filtroSelecaoSaidaStatus === 'apta') return aptidao.status === 'apta' || aptidao.status === 'divergencia_com_auditoria_resolvida';
    if (filtroSelecaoSaidaStatus === 'pendencia') return aptidao.status === 'auditoria_pendente' || aptidao.status === 'divergencia_sem_auditoria';
    if (filtroSelecaoSaidaStatus === 'nao_conferida') return aptidao.status === 'nao_conferida' || aptidao.status === 'sem_pedido' || aptidao.status === 'ambigua' || aptidao.status === 'sem_nf';
    return true;
}

// ===================================================================
// --- FASE 14: PDF DA SAÍDA DE TEXTO (aba Exportar) ---
// ===================================================================
// O PDF é só mais um formato da MESMA saída da aba Exportar: ele lê, linha a
// linha, o texto que está na caixa de saída (montado por getLinha/buildSaidaText),
// então contém exatamente as mesmas NFs, na mesma ordem (inclusive depois de
// "Ordenar por Recurso"). Não tem seleção própria e não depende de
// repasse/protocolo. Modelo em papel: DATA/NF/VENCIMENTO/VALOR TOTAL/FORNECEDOR/
// RECEBIDO COMPRAS/RECEBIDO CONTÁBIL/OBSERVAÇÕES + assinaturas.
function linhasDaSaidaAtual() {
    return (DOM.saida.value || '').split('\n').filter(l => l.trim() !== '').map(l => {
        const c = l.split('\t');
        return { data: c[0] || '', nf: c[1] || '', vencimento: c[2] || '', valor: c[3] || '', fornecedor: c[5] || '', obs: c[8] || '' };
    });
}

function gerarPdfSaida() {
    if (typeof jspdf === 'undefined') { toast('✕ A biblioteca de PDF ainda não carregou — aguarde um instante e tente de novo.'); return; }
    const linhas = linhasDaSaidaAtual();
    if (!linhas.length) { toast('Nada para gerar — a saída de texto está vazia.'); return; }

    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    // Cabeçalho: logo (se configurada em Configurações → Personalização) +
    // título do documento.
    const logo = appConfig.personalizacao && appConfig.personalizacao.logoBase64;
    if (logo) {
        try { doc.addImage(logo, 'PNG', margin, y - 10, 55, 42); } catch (e) { console.error('Logo inválida pro PDF:', e); }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('PROTOCOLO', pageWidth / 2, y + 5, { align: 'center' });
    doc.text('REPASSE NF', pageWidth / 2, y + 22, { align: 'center' });
    y += 55;

    // Tabela — mesmas colunas do documento de referência, nada inventado.
    const colunas = [
        { titulo: 'DATA', largura: 60 },
        { titulo: 'NF', largura: 60 },
        { titulo: 'VENCIMENTO', largura: 75 },
        { titulo: 'VALOR TOTAL', largura: 80 },
        { titulo: 'FORNECEDOR', largura: 140 },
        { titulo: 'RECEBIDO COMPRAS', largura: 95 },
        { titulo: 'RECEBIDO CONTÁBIL', largura: 95 },
        { titulo: 'OBSERVAÇÕES', largura: 0 }
    ];
    const larguraFixa = colunas.slice(0, -1).reduce((s, c) => s + c.largura, 0);
    colunas[colunas.length - 1].largura = Math.max(100, (pageWidth - margin * 2) - larguraFixa);

    const alturaLinha = 22;
    const desenharCabecalhoTabela = () => {
        let x = margin;
        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        colunas.forEach(col => {
            doc.rect(x, y, col.largura, alturaLinha);
            doc.text(col.titulo, x + col.largura / 2, y + 14, { align: 'center' });
            x += col.largura;
        });
        y += alturaLinha;
    };
    desenharCabecalhoTabela();

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    linhas.forEach((nota) => {
        const obs = nota.obs;
        if (y + alturaLinha > pageHeight - 90) { doc.addPage(); y = margin; desenharCabecalhoTabela(); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); }
        let x = margin;
        const celulas = [nota.data || '', nota.nf || '', nota.vencimento || '', nota.valor ? `R$ ${nota.valor}` : '', nota.fornecedor || '', '', ''];
        celulas.forEach((valor, i) => {
            doc.rect(x, y, colunas[i].largura, alturaLinha);
            if (valor) doc.text(String(valor), x + colunas[i].largura / 2, y + 14, { align: 'center' });
            x += colunas[i].largura;
        });
        doc.rect(x, y, colunas[7].largura, alturaLinha);
        if (obs) {
            doc.setFont('helvetica', 'bold');
            doc.text(String(obs), x + colunas[7].largura / 2, y + 14, { align: 'center' });
            doc.setFont('helvetica', 'normal');
        }
        y += alturaLinha;
    });

    // Assinaturas — igual ao documento de referência.
    y += 70;
    if (y > pageHeight - 30) { doc.addPage(); y = margin + 70; }
    const larguraAssinatura = (pageWidth - margin * 2) / 3;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    ['DATA', 'ASSINATURA CONTÁBIL', 'ASSINATURA ALMOXARIFADO'].forEach((label, i) => {
        const cx = margin + larguraAssinatura * i;
        doc.line(cx, y, cx + larguraAssinatura - 25, y);
        doc.text(label, cx, y + 12);
    });

    const hoje = new Date();
    const carimbo = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`;
    doc.save(`Saida_NFs_${carimbo}.pdf`);
    toast('✓ PDF gerado.');
}

function toggleSelectionModeNotas() {
    selectionModeNotas = !selectionModeNotas;
    if (!selectionModeNotas) notasSelecionadas.clear();
    if (selectionModeNotas && modoSelecaoSaida) {
        modoSelecaoSaida = false;
        const saidaBtn = document.getElementById('saida-mode-btn');
        if (saidaBtn) saidaBtn.classList.remove('active');
    }
    const btn = document.getElementById('select-mode-btn');
    if (btn) btn.classList.toggle('active', selectionModeNotas);
    const toolbarBtn = document.getElementById('bulk-select-all-notas');
    if (toolbarBtn) toolbarBtn.style.display = selectionModeNotas ? 'inline-flex' : 'none';
    rebuildNotasPendentesList();
    atualizarBulkBarNotas();
}

function toggleNotaSelecionada(id) {
    if (notasSelecionadas.has(id)) notasSelecionadas.delete(id);
    else notasSelecionadas.add(id);
    atualizarBulkBarNotas();
    const el = document.querySelector(`div[data-note-id="${id}"]`);
    if (el) el.classList.toggle('nota-selected', notasSelecionadas.has(id));
}

function selecionarTodasNotasToggle() {
    if (notasSelecionadas.size === notasPendentes.length) {
        notasSelecionadas.clear();
    } else {
        notasSelecionadas = new Set(notasPendentes.map(n => n.id));
    }
    rebuildNotasPendentesList();
    atualizarBulkBarNotas();
}

function atualizarBulkBarNotas() {
    const bar = document.getElementById('bulk-action-bar-notas');
    if (!bar) return;
    bar.classList.toggle('active', selectionModeNotas);
    const count = notasSelecionadas.size;
    const countEl = document.getElementById('bulk-count-notas');
    if (countEl) countEl.textContent = `${count} selecionada${count === 1 ? '' : 's'}`;
    const selectAllBtn = document.getElementById('bulk-select-all-notas');
    if (selectAllBtn) selectAllBtn.textContent = (count === notasPendentes.length && count > 0) ? 'Nenhuma' : 'Todas';
    document.querySelectorAll('#bulk-action-bar-notas .bulk-buttons button').forEach(b => b.disabled = count === 0);
}

async function bulkMarcarPendente(valor) {
    const ids = Array.from(notasSelecionadas);
    if (ids.length === 0) return;
    try {
        const batch = firestore.batch();
        ids.forEach(id => {
            const nota = notasPendentes.find(n => n.id === id);
            if (nota) nota.emEspera = valor;
            batch.update(notasCollection.doc(id), { emEspera: valor });
        });
        rebuildNotasPendentesList();
        DOM.saida.value = buildSaidaText(notasPendentes.filter(n => !n.emEspera));
        atualizarContadorExportacao();
        await batch.commit();
        toast(valor ? `⏳ ${ids.length} nota(s) marcada(s) como pendente.` : `✓ ${ids.length} nota(s) removida(s) da pendência.`);
    } catch (e) {
        console.error('Erro ao atualizar notas em lote:', e);
        toast('✕ Erro ao atualizar as notas selecionadas.');
    }
}

function bulkExcluirNotas() {
    const ids = Array.from(notasSelecionadas);
    if (ids.length === 0) return;
    showConfirmModal({
        title: 'Excluir Notas Selecionadas',
        message: `Deseja excluir ${ids.length} nota(s) permanentemente? Essa ação não pode ser desfeita.`,
        confirmText: 'Excluir',
        confirmClass: 'danger',
        onConfirm: async () => {
            try {
                const batch = firestore.batch();
                ids.forEach(id => batch.delete(notasCollection.doc(id)));
                await batch.commit();
                notasSelecionadas.clear();
                toggleSelectionModeNotas();
                toast(`🗑️ ${ids.length} nota(s) excluída(s).`);
            } catch (e) {
                console.error('Erro ao excluir notas em lote:', e);
                toast('✕ Erro ao excluir as notas selecionadas.');
            }
        }
    });
}

function abrirEdicaoEmLoteNotas() {
    if (notasSelecionadas.size === 0) return;
    document.getElementById('bulk-edit-count').textContent = notasSelecionadas.size;
    document.getElementById('bulk-edit-forn').value = '';
    document.getElementById('bulk-edit-venc').value = '';
    document.getElementById('bulk-edit-obs').innerHTML = DOM.obs.innerHTML;
    document.getElementById('bulk-edit-obs').value = '';
    document.getElementById('bulk-edit-notas-modal').classList.add('active');
}

function fecharEdicaoEmLoteNotas() {
    document.getElementById('bulk-edit-notas-modal').classList.remove('active');
}

async function salvarEdicaoEmLoteNotas() {
    const ids = Array.from(notasSelecionadas);
    if (ids.length === 0) return fecharEdicaoEmLoteNotas();

    const forn = document.getElementById('bulk-edit-forn').value.trim().toUpperCase();
    const venc = document.getElementById('bulk-edit-venc').value.trim();
    const obs = document.getElementById('bulk-edit-obs').value;

    const updateData = {};
    if (forn) updateData.fornecedor = forn;
    if (venc) updateData.vencimento = venc;
    if (obs) updateData.obs = obs;

    if (Object.keys(updateData).length === 0) {
        toast('Preencha ao menos um campo para alterar.');
        return;
    }

    try {
        const batch = firestore.batch();
        ids.forEach(id => {
            const nota = notasPendentes.find(n => n.id === id);
            if (nota) Object.assign(nota, updateData);
            batch.update(notasCollection.doc(id), updateData);
        });
        await batch.commit();
        if (forn) await adicionarFornecedor(forn, true);
        rebuildNotasPendentesList();
        DOM.saida.value = buildSaidaText(notasPendentes.filter(n => !n.emEspera));
        fecharEdicaoEmLoteNotas();
        toast(`✓ ${ids.length} nota(s) atualizada(s).`);
    } catch (e) {
        console.error('Erro ao editar notas em lote:', e);
        toast('✕ Erro ao editar as notas selecionadas.');
    }
}

// --- FUNÇÕES DE EXPORTAÇÃO E ORDENAÇÃO ---
function getLinha(nota){
    let v=nota.vencimento,o=nota.obs;
    if(nota.obs==="REMESSA"){v="REMESSA";o="Recurso Proprio Santa Casa"}
    return[nota.data,nota.nf,v,nota.valor,"",nota.fornecedor,"","",o].join("\t")
}

function buildSaidaText(notas){ return notas.map(getLinha).join("\n"); }

function ordenarExportacao() {
    const notasParaExportar = notasPendentes.filter(n => !n.emEspera);
    if (notasParaExportar.length === 0) return toast("Nada para ordenar.");
    const notasOrdenadas = [...notasParaExportar].sort((a, b) => {
        const recursoA = (a.obs || '').toUpperCase();
        const recursoB = (b.obs || '').toUpperCase();
        if (recursoA < recursoB) return -1;
        if (recursoA > recursoB) return 1;
        return 0;
    });
    DOM.saida.value = buildSaidaText(notasOrdenadas);
    toast("Lista reordenada por Recurso!");
}

// --- SETUP GERAL (Event Listeners) ---
document.addEventListener('DOMContentLoaded', () => {
    setAppHeight(); setupKeyboardListener();

    // Arrastar-e-soltar no editor de XML
    const xmlDropzone = document.getElementById('xml-dropzone');
    if (xmlDropzone) {
        xmlDropzone.addEventListener('dragover', e => { e.preventDefault(); xmlDropzone.classList.add('drag'); });
        xmlDropzone.addEventListener('dragleave', () => xmlDropzone.classList.remove('drag'));
        xmlDropzone.addEventListener('drop', e => {
            e.preventDefault();
            xmlDropzone.classList.remove('drag');
            if (e.dataTransfer.files[0]) handleArquivoXml(e.dataTransfer.files[0]);
        });
    }
    
    document.querySelectorAll('.settings-list-group a[data-screen]').forEach(link => { link.addEventListener('click', (e) => { e.preventDefault(); switchToScreen(link.dataset.screen, link.dataset.title); }); });
    document.getElementById('close-btn').addEventListener('click', () => {
        const activeScreen = document.querySelector('.app-screen.active');
        const activeId = activeScreen ? activeScreen.id : null;
        if (activeId === 'screen-anotacoes-editor') {
            voltarParaListaAnotacoes();
            return;
        }
        if (activeId === 'screen-cotacao-editor') {
            const alvo = origemTelaCotacaoEditor === 'screen-central-pedido' && centralPedidoAtual ? null : origemTelaCotacaoEditor;
            if (alvo === 'screen-cotacoes') { switchToScreen('screen-cotacoes', 'Cotações'); return; }
            if (centralPedidoAtual) { abrirCentralPedido(centralPedidoAtual); return; }
        }
        const voltarPara = closeBtnBackScreen[activeId] || 'screen-settings';
        const tituloVoltar = (menuDetails[voltarPara] && menuDetails[voltarPara].title) || 'Ajustes';
        switchToScreen(voltarPara, tituloVoltar);
    });
    
    document.getElementById('theme-select').addEventListener('change', (e) => { appConfig.personalizacao.theme = e.target.value; salvarPersonalizacao(); });
    document.getElementById('icon-theme-select').addEventListener('change', (e) => { appConfig.personalizacao.iconTheme = e.target.value; salvarPersonalizacao(); });
    document.getElementById('font-select').addEventListener('change', (e) => { appConfig.personalizacao.font = e.target.value; salvarPersonalizacao(); });

    const speedSlider = document.getElementById('animation-speed-slider');
    speedSlider.addEventListener('input', (e) => { document.getElementById('animation-speed-value').textContent = speedTextMap[e.target.value]; });
    speedSlider.addEventListener('change', (e) => { appConfig.personalizacao.animationSpeed = parseInt(e.target.value, 10); salvarPersonalizacao(); });
    
      
    limparFormularioPrincipal(false);
});

// Enter avança pro próximo campo do formulário — comportamento que já
// existia só na tela "Adicionar Nota", agora generalizado via delegação de
// evento pra funcionar em qualquer tela, inclusive campos renderizados
// dinamicamente (divergências da Auditoria, fornecedores da Cotação). Nunca
// interfere em <textarea> nem no editor de texto rico, onde Enter precisa
// continuar criando uma nova linha.
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const el = event.target;
    if (!el || el.tagName === 'TEXTAREA') return;
    if (el.closest && el.closest('#anotacao-corpo, .rte-editor, [contenteditable="true"]')) return;
    if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT') return;
    if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') return;
    const screen = el.closest('.app-screen');
    if (!screen) return;
    const camposFocaveis = Array.from(screen.querySelectorAll('input.form-field, select.form-field, textarea.form-field'))
        .filter(f => !f.disabled && f.offsetParent !== null);
    const idx = camposFocaveis.indexOf(el);
    if (idx === -1) return;
    event.preventDefault();
    const proximo = camposFocaveis[idx + 1];
    if (proximo) { proximo.focus(); if (typeof proximo.select === 'function' && proximo.tagName === 'INPUT') proximo.select(); }
    else if (el.id === 'aud-obs-geral') { /* último campo da auditoria — não faz nada especial */ }
    else { const salvarBtn = document.getElementById('salvarBtn'); if (salvarBtn && screen.id === 'screen-add') salvarBtn.click(); }
});

// --- MANIPULAÇÃO DE STRINGS E FORMATAÇÃO ---
function formatarDataInput(input){
    let v=input.value.replace(/\D/g,'').substring(0,8);
    if(v.length>4) v=`${v.slice(0,2)}/${v.slice(2,4)}/${v.slice(4)}`;
    else if(v.length>2) v=`${v.slice(0,2)}/${v.slice(2)}`;
    input.value=v;
}
function formatarValorBlur(event){
    let v=event.target.value.replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,'');
    if(v) event.target.value=parseFloat(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

// --- FUNÇÕES DE UI / MODAIS ---
function openModal(id){closeAllModals();document.getElementById(id)?.classList.add('active')}
function closeAllModals(){document.querySelectorAll('.modal-screen.active').forEach(modal=>modal.classList.remove('active'))}
function personalizarMensagem(texto, ehSucesso){
    const nome = primeiroNomeUsuario();
    if (!nome || !ehSucesso) return texto;
    return `${texto.replace(/[.!]+$/, '')}, ${nome}!`;
}
function toast(msg){
    const t = document.getElementById('toast');
    const iconEl = document.getElementById('toast-icon');
    const textEl = document.getElementById('toast-text');
    const ehSucesso = msg.startsWith('✓');
    const ehErro = msg.startsWith('✕');
    const texto = (ehSucesso || ehErro) ? msg.slice(1).trim() : msg;
    iconEl.className = 'toast-icon' + (ehSucesso ? ' success' : ehErro ? ' error' : '');
    iconEl.innerHTML = ehSucesso ? '<i class="fa-solid fa-circle-check"></i>' : ehErro ? '<i class="fa-solid fa-circle-exclamation"></i>' : '';
    textEl.textContent = personalizarMensagem(texto, ehSucesso);
    t.style.display = 'flex';
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => t.style.display = 'none', 2000);
}

function showConfirmModal({title,message,confirmText="Confirmar",confirmClass="danger",onConfirm}){
    const modal=document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent=title;
    document.getElementById('confirm-message').textContent=message;
    const confirmBtn=document.getElementById('confirm-btn');
    confirmBtn.textContent=confirmText;
    
    // Ajuste de classe do botão (cor do texto/borda — botão nunca é preenchido)
    confirmBtn.classList.remove('is-danger', 'is-success', 'is-warning');
    if(confirmClass === 'danger') confirmBtn.classList.add('is-danger');
    else if(confirmClass === 'success') confirmBtn.classList.add('is-success');
    else if(confirmClass === 'warning') confirmBtn.classList.add('is-warning');
    
    const cancelBtn=document.getElementById('cancel-btn');
    const confirmHandler=()=>{onConfirm();closeAllModals();cleanup()};
    const cancelHandler=()=>{closeAllModals();cleanup()};
    const cleanup=()=>{confirmBtn.removeEventListener('click',confirmHandler);cancelBtn.removeEventListener('click',cancelHandler)};
    confirmBtn.addEventListener('click',confirmHandler);
    cancelBtn.addEventListener('click',cancelHandler);
    modal.classList.add('active');
}

// --- FUNÇÕES DE SEGURANÇA E LOGIN (Firebase Authentication) ---
const auth = firebase.auth();
const checkmarkSVG = `<svg class="check-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>`;

let confirmationResultTelefone = null;
let recaptchaVerifier = null;

// Traduz os códigos de erro mais comuns do Firebase Auth para mensagens em
// português. O código original vai entre parênteses pra facilitar diagnóstico
// (o Google/telefone estão dando erro — isso ajuda a identificar qual é).
function traduzErroAuth(error) {
    const mapa = {
        'auth/invalid-email': 'E-mail inválido.',
        'auth/user-disabled': 'Esta conta foi desativada.',
        'auth/user-not-found': 'E-mail ou senha incorretos.',
        'auth/wrong-password': 'E-mail ou senha incorretos.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente em alguns minutos.',
        'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
        'auth/popup-closed-by-user': 'Login cancelado.',
        'auth/popup-blocked': 'O navegador bloqueou a janela de login. Tentando de outro jeito...',
        'auth/operation-not-supported-in-this-environment': 'Este navegador não suporta esse tipo de login aqui.',
        'auth/unauthorized-domain': 'Este domínio não está autorizado no Firebase (Authentication → Settings → Authorized domains).',
        'auth/invalid-phone-number': 'Número de telefone inválido. Use o formato +55 11 91234-5678.',
        'auth/invalid-verification-code': 'Código incorreto.',
        'auth/code-expired': 'Código expirado. Envie um novo.',
        'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
        'auth/requires-recent-login': 'Por segurança, verifique sua senha novamente.',
        'auth/captcha-check-failed': 'A verificação do reCAPTCHA falhou. Tente novamente.',
        'auth/argument-error': 'Configuração inválida para este tipo de login.',
    };
    console.error('Erro Auth:', error.code, error.message);
    const base = mapa[error.code] || 'Ocorreu um erro ao entrar.';
    return `${base} (${error.code || 'sem código'})`;
}

function mostrarLoaderApp(mostrar) {
    const appLoader = document.getElementById('app-loader');
    if (!appLoader) return;
    appLoader.classList.toggle('app-loader-hidden', !mostrar);
    document.body.classList.toggle('is-loading', mostrar);
}

// Coleção onde ficam registradas as contas que entraram via Google/telefone
// (autocadastro). Contas de e-mail/senha são criadas manualmente por você no
// Console do Firebase, então essas já contam como aprovadas por definição.
// Google/telefone criam um pedido de acesso aqui, com aprovado:false, e você
// aprova mudando esse campo para true direto no Firestore (Console → Firestore
// Database → acessosAutorizados → o documento da pessoa → aprovado: true).
async function verificarAprovacaoAcesso(user) {
    const provedores = user.providerData.map(p => p.providerId);
    if (provedores.includes('password')) return true;
    try {
        const ref = firestore.collection('acessosAutorizados').doc(user.uid);
        const snap = await ref.get();
        if (!snap.exists) {
            await ref.set({
                email: user.email || null,
                telefone: user.phoneNumber || null,
                nome: user.displayName || '',
                aprovado: false,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
            await auth.signOut();
            mostrarEtapaPendente('Seu acesso foi solicitado e está aguardando aprovação. Assim que for liberado, você poderá entrar normalmente.');
            return false;
        }
        if (snap.data().aprovado !== true) {
            await auth.signOut();
            mostrarEtapaPendente('Sua conta ainda não foi aprovada. Peça para o administrador liberar seu acesso.');
            return false;
        }
        return true;
    } catch (e) {
        console.error('Erro ao verificar aprovação:', e);
        await auth.signOut();
        document.getElementById('login-error-message').textContent = 'Não foi possível verificar seu acesso. Tente novamente.';
        return false;
    }
}

// onAuthStateChanged é a fonte da verdade sobre o login — dispara na carga inicial
// e sempre que o usuário entra/sai, em qualquer aba/dispositivo com a sessão ativa.
auth.onAuthStateChanged(async (user) => {
    if (user) {
        mostrarLoaderApp(true);
        const permitido = await verificarAprovacaoAcesso(user);
        if (!permitido) return; // signOut() já disparou onAuthStateChanged de novo com user=null

        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        atualizarTelaConta(user);
        atualizarPainelAprovacoes(user);
        iniciarDadosAppSeNecessario();
    } else {
        pararDadosApp();
        atualizarPainelAprovacoes(null);
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        mostrarLoaderApp(false);
    }
});

function atualizarTelaConta(user) {
    const emailEl = document.getElementById('conta-email');
    const providerEl = document.getElementById('conta-provider');
    if (!emailEl || !providerEl) return;
    const provedores = user.providerData.map(p => p.providerId);
    const usaSenha = provedores.includes('password');
    emailEl.textContent = user.email || user.phoneNumber || 'Conta';
    providerEl.textContent = usaSenha ? 'Login por e-mail e senha'
        : provedores.includes('google.com') ? 'Login pelo Google'
        : provedores.includes('phone') ? 'Login por telefone'
        : 'Conta';
    document.getElementById('conta-senha-card').style.display = usaSenha ? 'block' : 'none';
    document.getElementById('conta-senha-indisponivel').style.display = usaSenha ? 'none' : 'block';
    const nomeInput = document.getElementById('conta-nome-input');
    if (nomeInput) nomeInput.value = user.displayName || '';
}

// --- Contas com "acesso especial": podem aprovar/revogar outras contas
// direto pelo app, sem precisar entrar no Console do Firebase. ---
const ADMIN_EMAILS = ['aseleandro@gmail.com', 'leandromendoncadesign@gmail.com'];
function isContaAdmin(user) { return !!user && !!user.email && ADMIN_EMAILS.includes(user.email.toLowerCase()); }

let unsubAprovacoes = null;
function atualizarPainelAprovacoes(user) {
    const menuItem = document.getElementById('menu-aprovacoes');
    if (!isContaAdmin(user)) {
        if (menuItem) menuItem.style.display = 'none';
        if (unsubAprovacoes) { unsubAprovacoes(); unsubAprovacoes = null; }
        return;
    }
    if (menuItem) menuItem.style.display = '';
    if (unsubAprovacoes) return; // já inscrito, não duplica o listener
    unsubAprovacoes = firestore.collection('acessosAutorizados').orderBy('criadoEm', 'desc').onSnapshot(snapshot => {
        renderListaAprovacoes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, error => console.error('Erro ao carregar aprovações:', error));
}
function renderListaAprovacoes(lista) {
    const container = document.getElementById('lista-aprovacoes');
    if (!container) return;
    if (lista.length === 0) { container.innerHTML = '<li class="empty-state">Nenhum pedido de acesso ainda.</li>'; return; }
    container.innerHTML = lista.map(item => {
        const identificacao = item.email || item.telefone || item.id;
        const aprovado = item.aprovado === true;
        return `<li class="approval-item">
            <div class="approval-item-info">
                <div class="approval-item-email">${identificacao}</div>
                <div class="approval-item-status${aprovado ? ' aprovado' : ''}">${aprovado ? '✓ Aprovado' : 'Pendente'}${item.nome ? ' · ' + item.nome : ''}</div>
            </div>
            <button class="action-chip ${aprovado ? 'delete-chip' : 'edit-chip'}" onclick="alternarAprovacaoAcesso('${item.id}', ${!aprovado})">${aprovado ? 'Revogar' : 'Aprovar'}</button>
        </li>`;
    }).join('');
}
function alternarAprovacaoAcesso(uid, novoValor) {
    firestore.collection('acessosAutorizados').doc(uid).update({ aprovado: novoValor })
        .then(() => toast(novoValor ? '✓ Acesso aprovado!' : '✓ Acesso revogado.'))
        .catch(() => toast('✕ Não foi possível atualizar.'));
}

// --- Login por e-mail/senha ---
function handleLoginEmail() {
    const emailInput = document.getElementById('login-email-input');
    const passwordInput = document.getElementById('login-password-input');
    const errorMessage = document.getElementById('login-error-message');
    errorMessage.textContent = '';
    if (!emailInput.value.trim() || !passwordInput.value) { errorMessage.textContent = 'Preencha e-mail e senha.'; return; }
    auth.signInWithEmailAndPassword(emailInput.value.trim(), passwordInput.value)
        .then(() => { passwordInput.value = ''; })
        .catch(error => {
            errorMessage.textContent = traduzErroAuth(error);
            passwordInput.classList.add('shake');
            setTimeout(() => passwordInput.classList.remove('shake'), 820);
        });
}

function handleForgotPassword() {
    const emailInput = document.getElementById('login-email-input');
    const errorMessage = document.getElementById('login-error-message');
    if (!emailInput.value.trim()) { errorMessage.textContent = 'Digite seu e-mail acima para recuperar a senha.'; return; }
    auth.sendPasswordResetEmail(emailInput.value.trim())
        .then(() => toast('✓ E-mail de redefinição enviado!'))
        .catch(error => { errorMessage.textContent = traduzErroAuth(error); });
}

// --- Login com Google ---
async function handleLoginGoogle() {
    const errorEl = document.getElementById('login-error-message');
    errorEl.textContent = '';
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        const precisaFallback = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(error.code);
        if (precisaFallback) {
            try { await auth.signInWithRedirect(provider); } catch (error2) { errorEl.textContent = traduzErroAuth(error2); }
            return;
        }
        errorEl.textContent = traduzErroAuth(error);
    }
}
// Se o login com Google caiu no fallback de redirect (fora de popup), o
// resultado chega aqui quando a página recarrega depois do redirect.
auth.getRedirectResult().catch(error => {
    if (error && error.code) {
        const errorEl = document.getElementById('login-error-message');
        if (errorEl) errorEl.textContent = traduzErroAuth(error);
    }
});

// --- Login por telefone (SMS) ---
function mostrarEtapaTelefone() {
    document.getElementById('login-intro').style.display = 'block';
    document.getElementById('login-email-step').style.display = 'none';
    document.getElementById('login-phone-step').style.display = 'block';
    document.getElementById('login-phone-code-step').style.display = 'none';
    document.getElementById('login-pending-step').style.display = 'none';
    if (!recaptchaVerifier) {
        recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { size: 'normal' });
        recaptchaVerifier.render();
    }
}
function voltarParaEmailStep() {
    document.getElementById('login-intro').style.display = 'block';
    document.getElementById('login-email-step').style.display = 'block';
    document.getElementById('login-phone-step').style.display = 'none';
    document.getElementById('login-phone-code-step').style.display = 'none';
    document.getElementById('login-pending-step').style.display = 'none';
}
function mostrarEtapaPendente(mensagem) {
    document.getElementById('login-intro').style.display = 'none';
    document.getElementById('login-email-step').style.display = 'none';
    document.getElementById('login-phone-step').style.display = 'none';
    document.getElementById('login-phone-code-step').style.display = 'none';
    document.getElementById('login-pending-step').style.display = 'block';
    document.getElementById('login-pending-message').textContent = mensagem;
}
function enviarCodigoTelefone() {
    const phoneInput = document.getElementById('login-phone-input');
    const errorMessage = document.getElementById('login-phone-error-message');
    errorMessage.textContent = '';
    if (!phoneInput.value.trim()) { errorMessage.textContent = 'Digite seu telefone com DDI (ex: +55 11 91234-5678).'; return; }
    auth.signInWithPhoneNumber(phoneInput.value.trim(), recaptchaVerifier)
        .then(result => {
            confirmationResultTelefone = result;
            document.getElementById('login-phone-step').style.display = 'none';
            document.getElementById('login-phone-code-step').style.display = 'block';
            setTimeout(() => document.getElementById('login-phone-code-input').focus(), 50);
        })
        .catch(error => {
            errorMessage.textContent = traduzErroAuth(error);
            if (recaptchaVerifier) recaptchaVerifier.render().then(widgetId => grecaptcha.reset(widgetId));
        });
}
function confirmarCodigoTelefone() {
    const codeInput = document.getElementById('login-phone-code-input');
    const errorMessage = document.getElementById('login-phone-code-error-message');
    if (!confirmationResultTelefone) return;
    confirmationResultTelefone.confirm(codeInput.value.trim())
        .catch(error => {
            errorMessage.textContent = traduzErroAuth(error);
            codeInput.classList.add('shake');
            setTimeout(() => codeInput.classList.remove('shake'), 820);
        });
}

// --- Logout ---
function handleLogout() {
    showConfirmModal({
        title: 'Sair da Conta',
        message: 'Você precisará entrar novamente para acessar suas notas.',
        confirmText: 'Sair',
        confirmClass: 'danger',
        onConfirm: () => auth.signOut()
    });
}

// --- Alterar senha (reautenticação + updatePassword real no Firebase) ---
function abrirModalSenhaComVerificacao() {
    document.getElementById('security-check-screen').style.display = 'flex';
    setTimeout(() => document.getElementById('security-check-password-input').focus(), 50);
}
function handleSecurityCheck() {
    const input = document.getElementById('security-check-password-input');
    const errorMessage = document.getElementById('security-check-error-message');
    const user = auth.currentUser;
    if (!user || !user.email) { errorMessage.textContent = 'Não foi possível verificar a conta.'; return; }
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, input.value);
    user.reauthenticateWithCredential(credential)
        .then(() => {
            document.getElementById('security-check-screen').style.display = 'none';
            input.value = '';
            errorMessage.textContent = '';
            document.getElementById('password-change-screen').style.display = 'flex';
            setTimeout(() => document.getElementById('new-password-input').focus(), 50);
        })
        .catch(error => {
            errorMessage.textContent = traduzErroAuth(error);
            input.classList.add('shake');
            setTimeout(() => { input.classList.remove('shake'); input.value = ''; }, 820);
        });
}
function cancelSecurityCheck() { document.getElementById('security-check-screen').style.display = 'none'; document.getElementById('security-check-password-input').value = ''; }
function closePasswordChangeScreen() { document.getElementById('password-change-screen').style.display = 'none'; document.getElementById('new-password-input').value = ''; document.getElementById('confirm-password-input').value = ''; }
function handleSaveNewPassword() {
    const n = document.getElementById('new-password-input');
    const c = document.getElementById('confirm-password-input');
    const e = document.getElementById('password-error-message');
    if (n.value.length < 6) { e.textContent = 'Mínimo 6 caracteres.'; return; }
    if (n.value !== c.value) { e.textContent = 'Senhas não conferem.'; c.classList.add('shake'); setTimeout(() => c.classList.remove('shake'), 820); return; }
    const user = auth.currentUser;
    user.updatePassword(n.value)
        .then(() => { toast('✓ Senha alterada!'); closePasswordChangeScreen(); })
        .catch(error => { e.textContent = traduzErroAuth(error); });
}

// --- Nome de exibição (usado pra personalizar as mensagens do app) ---
function primeiroNomeUsuario() {
    const nome = (auth.currentUser && auth.currentUser.displayName) ? auth.currentUser.displayName.trim() : '';
    return nome ? nome.split(' ')[0] : '';
}
function salvarNomeConta() {
    const input = document.getElementById('conta-nome-input');
    const user = auth.currentUser;
    if (!user || !input) return;
    const nome = input.value.trim();
    user.updateProfile({ displayName: nome })
        .then(() => toast(nome ? '✓ Nome salvo!' : '✓ Nome removido.'))
        .catch(error => toast('✕ Não foi possível salvar o nome.'));
}

// --- Backup completo dos dados (JSON) ---
// Busca tudo direto do Firestore (não confia só no que já está em memória, pra
// garantir que o backup reflita o estado real e completo do banco) e gera um
// arquivo .json pra download local — não depende do Firebase pra existir.
async function baixarBackupCompleto() {
    const statusEl = document.getElementById('backup-status');
    statusEl.textContent = 'Preparando backup...';
    try {
        const [notasSnap, historicoSnap, anotacoesSnap, configSnap] = await Promise.all([
            notasCollection.get(),
            historicoCollection.get(),
            anotacoesTextoCollection.get(),
            settingsDocRef.get()
        ]);

        // Timestamps do Firestore não viram JSON puro sozinhos — convertemos pra
        // string ISO aqui, senão o campo simplesmente some no JSON.stringify.
        const serializar = (data) => {
            const out = { ...data };
            Object.keys(out).forEach(k => {
                if (out[k] && typeof out[k].toDate === 'function') out[k] = out[k].toDate().toISOString();
            });
            return out;
        };

        const backup = {
            geradoEm: new Date().toISOString(),
            versaoApp: 'notas-fiscais-backup-v1',
            notasPendentes: notasSnap.docs.map(d => ({ id: d.id, ...serializar(d.data()) })),
            historico: historicoSnap.docs.map(d => ({ id: d.id, ...serializar(d.data()) })),
            anotacoes: anotacoesSnap.docs.map(d => ({ id: d.id, ...serializar(d.data()) })),
            configuracoes: configSnap.exists ? serializar(configSnap.data()) : {}
        };

        const nomeArquivo = `backup-notas-fiscais-${new Date().toISOString().slice(0, 10)}.json`;
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const total = backup.notasPendentes.length + backup.historico.length + backup.anotacoes.length;
        statusEl.textContent = `✓ Backup baixado — ${total} registro(s) no total.`;
        toast('✓ Backup baixado!');
    } catch (e) {
        console.error('Erro ao gerar backup:', e);
        statusEl.textContent = 'Não foi possível gerar o backup. Tente novamente.';
        toast('✕ Erro ao gerar backup.');
    }
}

// --- MANAGE E CONFIGURAÇÕES ---
const debounce = (func, delay) => { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; };

// Funções de Gerenciamento (Fornecedores/Pedidos/Obs)
async function adicionarFornecedor(forn, noToast = false) {const f = String(forn || '').trim().toUpperCase();if (f && !fornecedoresSugeridos.includes(f)) {fornecedoresSugeridos.push(f);await settingsDocRef.set({ fornecedores: fornecedoresSugeridos }, { merge: true });if (!noToast) toast(`Fornecedor ${f} adicionado!`);}}
async function adicionarFornecedorManage(){const f=DOM.fornManageInput.value.trim();if(f){await adicionarFornecedor(f);DOM.fornManageInput.value=''}}
async function deletarFornecedor(f){showConfirmModal({title:"Excluir Fornecedor",message:`Excluir "${f}"?`,onConfirm:async()=>{fornecedoresSugeridos = fornecedoresSugeridos.filter(item => item !== f);await settingsDocRef.update({fornecedores:firebase.firestore.FieldValue.arrayRemove(f)});toast(`Fornecedor ${f} excluído.`)}})}
function popularDatalist(){DOM.fornDatalist.innerHTML='';const nomesUnificados=[...new Set([...fornecedoresSugeridos, ...listaFornecedoresSpData.map(f=>f.nomeExibido||f.nomeReal).filter(Boolean)])];nomesUnificados.sort().forEach(f=>DOM.fornDatalist.innerHTML+=`<option value="${f}"></option>`);popularListaFornecedores()}

function popularListaFornecedores(){
    DOM.listaFornManage.classList.toggle('selection-mode', selectionModeFornecedores);
    const termo = filtroFornecedoresTexto.trim().toUpperCase();
    const lista = fornecedoresSugeridos.slice().sort().filter(f => !termo || String(f).toUpperCase().includes(termo));

    const counterEl = document.getElementById('forn-counter');
    if (counterEl) counterEl.textContent = `${lista.length} de ${fornecedoresSugeridos.length} fornecedor${fornecedoresSugeridos.length === 1 ? '' : 'es'}`;

    if (lista.length === 0) {
        DOM.listaFornManage.innerHTML = `<li style="justify-content:center; color: var(--text-light);">Nenhum fornecedor encontrado.</li>`;
        atualizarBulkBarFornecedores();
        return;
    }

    let html = '';
    let letraAtual = '';
    lista.forEach(f => {
        const fStr = String(f);
        const letra = fStr.charAt(0).toUpperCase();
        if (letra !== letraAtual) {
            letraAtual = letra;
            html += `<li class="manage-list-header">${letra}</li>`;
        }
        const fEsc = fStr.replace(/'/g, "\\'");
        const checked = fornecedoresSelecionados.has(f) ? 'checked' : '';
        const ignorado = fornecedoresIgnorados.has(f);
        html += `<li class="${fornecedoresSelecionados.has(f) ? 'forn-selected' : ''} ${ignorado ? 'forn-ignorado' : ''}">
            <label class="forn-select-checkbox"><input type="checkbox" ${checked} onchange="toggleFornecedorSelecionado('${fEsc}')"></label>
            <span class="forn-nome">${fStr}${ignorado ? '<span class="badge-ignorado">Ignorado no ERP</span>' : ''}</span>
            <button class="forn-ignore-btn ${ignorado ? 'active' : ''}" onclick="toggleFornecedorIgnorado('${fEsc}')" title="${ignorado ? 'Voltar a considerar na importação do ERP' : 'Ignorar este fornecedor na importação do ERP'}"><i class="fa-solid fa-ban"></i></button>
            <button onclick="deletarFornecedor('${fEsc}')"><i class="fa-solid fa-times-circle"></i></button>
        </li>`;
    });
    DOM.listaFornManage.innerHTML = html;

    atualizarBulkBarFornecedores();
}

// --- SELEÇÃO EM LOTE E FILTRO DE FORNECEDORES ---

function filtrarFornecedores(texto) {
    filtroFornecedoresTexto = texto;
    popularListaFornecedores();
}

function toggleSelectionModeFornecedores() {
    selectionModeFornecedores = !selectionModeFornecedores;
    if (!selectionModeFornecedores) fornecedoresSelecionados.clear();
    const btn = document.getElementById('forn-select-mode-btn');
    if (btn) btn.textContent = selectionModeFornecedores ? 'Cancelar Seleção' : 'Selecionar Múltiplos';
    const toolbarBtn = document.getElementById('bulk-select-all-fornecedores');
    if (toolbarBtn) toolbarBtn.style.display = selectionModeFornecedores ? 'inline-flex' : 'none';
    popularListaFornecedores();
}

function toggleFornecedorSelecionado(nome) {
    if (fornecedoresSelecionados.has(nome)) fornecedoresSelecionados.delete(nome);
    else fornecedoresSelecionados.add(nome);
    atualizarBulkBarFornecedores();
    document.querySelectorAll('#lista-fornecedores-manage li').forEach(li => {
        const span = li.querySelector('.forn-nome');
        if (span && span.textContent === nome) li.classList.toggle('forn-selected', fornecedoresSelecionados.has(nome));
    });
}

function selecionarTodosFornecedoresVisiveisToggle() {
    const termo = filtroFornecedoresTexto.trim().toUpperCase();
    const visiveis = fornecedoresSugeridos.filter(f => !termo || String(f).toUpperCase().includes(termo));
    const todosSelecionados = visiveis.length > 0 && visiveis.every(f => fornecedoresSelecionados.has(f));
    if (todosSelecionados) visiveis.forEach(f => fornecedoresSelecionados.delete(f));
    else visiveis.forEach(f => fornecedoresSelecionados.add(f));
    popularListaFornecedores();
}

function atualizarBulkBarFornecedores() {
    const bar = document.getElementById('bulk-action-bar-fornecedores');
    if (!bar) return;
    bar.classList.toggle('active', selectionModeFornecedores);
    const count = fornecedoresSelecionados.size;
    const countEl = document.getElementById('bulk-count-fornecedores');
    if (countEl) countEl.textContent = `${count} selecionado${count === 1 ? '' : 's'}`;
    document.querySelectorAll('#bulk-action-bar-fornecedores .bulk-buttons button').forEach(b => b.disabled = count === 0);
}

// --- FORNECEDORES IGNORADOS NA IMPORTAÇÃO DO ERP ---
// Fornecedores marcados aqui continuam na lista normalmente (autocomplete,
// notas manuais, etc.) mas são automaticamente excluídos da pré-visualização
// ao importar o relatório do ERP — pra quem não precisa acompanhar certos
// fornecedores por esse fluxo.

async function toggleFornecedorIgnorado(nome) {
    const ignorarAgora = !fornecedoresIgnorados.has(nome);
    if (ignorarAgora) fornecedoresIgnorados.add(nome);
    else fornecedoresIgnorados.delete(nome);

    popularListaFornecedores();

    try {
        await settingsDocRef.set({ fornecedoresIgnorados: Array.from(fornecedoresIgnorados) }, { merge: true });
        toast(ignorarAgora ? `🚫 "${nome}" não entrará mais nas importações do ERP.` : `✓ "${nome}" volta a ser considerado nas importações.`);
    } catch (e) {
        console.error('Erro ao atualizar fornecedores ignorados:', e);
        toast('✕ Erro ao salvar. Tente de novo.');
    }
}

async function bulkIgnorarFornecedores(valor) {
    const nomes = Array.from(fornecedoresSelecionados);
    if (nomes.length === 0) return;
    nomes.forEach(nome => { if (valor) fornecedoresIgnorados.add(nome); else fornecedoresIgnorados.delete(nome); });

    popularListaFornecedores();

    try {
        await settingsDocRef.set({ fornecedoresIgnorados: Array.from(fornecedoresIgnorados) }, { merge: true });
        toast(valor ? `🚫 ${nomes.length} fornecedor(es) marcado(s) como ignorado(s) no ERP.` : `✓ ${nomes.length} fornecedor(es) voltaram a ser considerados.`);
    } catch (e) {
        console.error('Erro ao atualizar fornecedores ignorados em lote:', e);
        toast('✕ Erro ao salvar. Tente de novo.');
    }
}

async function bulkExcluirFornecedores() {
    const nomes = Array.from(fornecedoresSelecionados);
    if (nomes.length === 0) return;
    showConfirmModal({
        title: 'Excluir Fornecedores',
        message: `Excluir ${nomes.length} fornecedor(es) selecionado(s) da lista? Isso não afeta notas já cadastradas com esse nome.`,
        confirmText: 'Excluir',
        confirmClass: 'danger',
        onConfirm: async () => {
            try {
                fornecedoresSugeridos = fornecedoresSugeridos.filter(f => !fornecedoresSelecionados.has(f));
                await settingsDocRef.set({ fornecedores: fornecedoresSugeridos }, { merge: true });
                toast(`🗑️ ${nomes.length} fornecedor(es) excluído(s).`);
                toggleSelectionModeFornecedores();
            } catch (e) {
                console.error('Erro ao excluir fornecedores em lote:', e);
                toast('✕ Erro ao excluir fornecedores.');
            }
        }
    });
}

// --- APELIDOS DE FORNECEDORES ---
// Mapeia o nome completo/legal do fornecedor (como aparece no ERP/nota) para o
// apelido curto que o usuário prefere usar (ex: "COMERCIAL CIRURGICA
// RIOCLARENSE" -> "RIOCLARENSE", "MINAS SUL EMPREENDIMENTOS LTDA" -> "MINAS SUL").
// Usado principalmente na importação do relatório do ERP, para preencher o
// campo Fornecedor já com o nome curto certo, sem precisar editar toda vez.

async function adicionarApelidoFornecedor() {
    const nomeCompletoInput = document.getElementById('alias-nome-completo');
    const apelidoInput = document.getElementById('alias-apelido');
    const nomeCompleto = nomeCompletoInput.value.trim().toUpperCase();
    const apelido = apelidoInput.value.trim().toUpperCase();

    if (!nomeCompleto || !apelido) {
        return toast('Preencha o nome completo e o apelido.');
    }

    apelidosFornecedores[nomeCompleto] = apelido;
    const updateData = {};
    updateData[`apelidosFornecedores.${nomeCompleto}`] = apelido;
    try {
        await settingsDocRef.update(updateData);
    } catch (error) {
        if (error.code === 'not-found') {
            await settingsDocRef.set({ apelidosFornecedores: { [nomeCompleto]: apelido } }, { merge: true });
        } else {
            return toast('Falha ao salvar o apelido.');
        }
    }

    await adicionarFornecedor(apelido, true);

    nomeCompletoInput.value = '';
    apelidoInput.value = '';
    toast(`Apelido "${apelido}" cadastrado!`);
}

async function deletarApelidoFornecedor(nomeCompleto) {
    showConfirmModal({
        title: 'Excluir Apelido',
        message: `Excluir o apelido para "${nomeCompleto}"?`,
        onConfirm: async () => {
            delete apelidosFornecedores[nomeCompleto];
            const updateData = {};
            updateData[`apelidosFornecedores.${nomeCompleto}`] = firebase.firestore.FieldValue.delete();
            try {
                await settingsDocRef.update(updateData);
                toast('Apelido excluído.');
            } catch (error) {
                toast('Falha ao excluir.');
            }
        }
    });
}

function popularListaApelidos() {
    const lista = document.getElementById('lista-apelidos-manage');
    if (!lista) return;
    lista.innerHTML = '';
    const nomesCompletos = Object.keys(apelidosFornecedores).sort();
    if (nomesCompletos.length === 0) {
        lista.innerHTML = `<li style="justify-content:center; color: var(--text-light);">Nenhum apelido cadastrado ainda.</li>`;
        return;
    }
    nomesCompletos.forEach(nomeCompleto => {
        const apelido = apelidosFornecedores[nomeCompleto];
        lista.innerHTML += `<li><div><strong>${apelido}</strong><div style="font-size:12px; color:var(--text-light);">${nomeCompleto}</div></div> <button onclick="deletarApelidoFornecedor('${nomeCompleto.replace(/'/g, "\\'")}')"><i class="fa-solid fa-times-circle"></i></button></li>`;
    });
}

// --- IMPORTAÇÃO EM MASSA DE FORNECEDORES ---
// Permite colar/subir uma lista (ex: exportada da planilha mestre de repasse de
// notas) com um fornecedor por linha, e adicionar todos de uma vez só — em vez
// de precisar cadastrar um por um.

let listaFornecedoresParaImportar = [];

async function colarListaFornecedores() {
    const textarea = document.getElementById('import-forn-textarea');
    try {
        const texto = await navigator.clipboard.readText();
        textarea.value = texto;
        toast('Texto colado!');
    } catch (err) {
        toast('Permissão negada ou não suportada. Cole manualmente (Ctrl+V).');
    }
}

function handleFornecedoresFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const texto = decodificarArquivoTexto(e.target.result);
        document.getElementById('import-forn-textarea').value = texto;
        toast('Arquivo carregado! Clique em "Processar Lista".');
    };
    reader.onerror = () => toast('Erro ao ler o arquivo.');
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function processarListaFornecedores() {
    try {
        const textareaEl = document.getElementById('import-forn-textarea');
        if (!textareaEl) return toast('Erro interno: campo de texto não encontrado. Atualize a página (Ctrl+Shift+R) e tente de novo.');
        const texto = textareaEl.value;
        if (!texto || !texto.trim()) {
            return toast('Cole ou envie a lista antes de processar.');
        }

        // Aceita um nome por linha (ou separados por vírgula/ponto e vírgula, caso
        // venha de uma célula só).
        const nomesBrutos = texto.split(/[\n,;]+/).map(n => n.trim().toUpperCase()).filter(Boolean);
        const nomesUnicos = [...new Set(nomesBrutos)];

        const existentes = new Set((fornecedoresSugeridos || []).map(f => f.toUpperCase()));
        const novos = nomesUnicos.filter(n => !existentes.has(n));
        const jaExistiam = nomesUnicos.length - novos.length;

        listaFornecedoresParaImportar = novos;
        const container = document.getElementById('import-forn-preview');

        if (novos.length === 0) {
            container.innerHTML = `<div class="empty-state">Nenhum fornecedor novo encontrado${jaExistiam > 0 ? ` (${jaExistiam} já estavam cadastrados)` : ''}.</div>`;
            return;
        }

        container.innerHTML = `
        <div class="card import-summary">
            <strong>${novos.length}</strong> fornecedor(es) novo(s) serão adicionados${jaExistiam > 0 ? ` (${jaExistiam} já existiam e foram ignorados)` : ''}.
            <div style="max-height:220px; overflow-y:auto; margin-top:12px; padding:12px; background:var(--bg-primary); border-radius:10px; font-size:13px; color:var(--text-dark); line-height:1.7;">
                ${novos.map(n => `<div>• ${n}</div>`).join('')}
            </div>
            <div class="actions" style="margin-top:16px;">
                <button class="actions-button is-success" onclick="confirmarImportacaoFornecedores()">
                    <span class="icon-wrapper"><i class="fa-solid fa-check-double"></i></span> Importar ${novos.length} Fornecedor(es)
                </button>
            </div>
        </div>`;
    } catch (e) {
        console.error('Erro ao processar lista de fornecedores:', e);
        toast('✕ Erro ao processar a lista. Veja o console para detalhes.');
    }
}

async function confirmarImportacaoFornecedores() {
    if (listaFornecedoresParaImportar.length === 0) return;

    showConfirmModal({
        title: 'Confirmar Importação',
        message: `Adicionar ${listaFornecedoresParaImportar.length} fornecedor(es) à lista?`,
        confirmText: 'Sim, Importar',
        confirmClass: 'success',
        onConfirm: async () => {
            try {
                const novaLista = [...fornecedoresSugeridos, ...listaFornecedoresParaImportar];
                await settingsDocRef.set({ fornecedores: novaLista }, { merge: true });
                toast(`✓ ${listaFornecedoresParaImportar.length} fornecedor(es) importado(s)!`);
                listaFornecedoresParaImportar = [];
                document.getElementById('import-forn-preview').innerHTML = '';
                document.getElementById('import-forn-textarea').value = '';
            } catch (e) {
                console.error('Erro ao importar fornecedores:', e);
                toast('✕ Erro ao importar fornecedores.');
            }
        }
    });
}

// Procura um apelido cadastrado para um nome de fornecedor vindo do ERP.
// O nome do ERP costuma vir truncado (ex: "COMERCIAL CIRURGICA RIOCLARENS"),
// por isso o match considera prefixo em qualquer direção, além do match exato.
function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function encontrarApelidoFornecedor(nomeOrigem) {
    const nome = (nomeOrigem || '').trim().toUpperCase();
    if (!nome) return null;

    // 1) Alias explícito cadastrado (nome completo -> apelido), com match de prefixo
    //    (cobre nomes truncados pelo ERP no final, ex: "...RIOCLARENS" -> "...RIOCLARENSE")
    if (apelidosFornecedores[nome]) return apelidosFornecedores[nome];
    for (const chave in apelidosFornecedores) {
        if (chave.startsWith(nome) || nome.startsWith(chave)) {
            return apelidosFornecedores[chave];
        }
    }

    // 2) Fornecedores já cadastrados na lista (nomes curtos conhecidos). Procura
    //    se algum deles aparece como PALAVRA em qualquer posição do nome que veio
    //    do ERP — não só no começo. É assim que "COMERCIAL CIRURGICA RIOCLARENSE"
    //    casa com o fornecedor "RIOCLARENSE" já cadastrado, mesmo sendo a última
    //    palavra. Em caso de mais de um bater, usa o nome conhecido mais longo
    //    (mais específico).
    const candidatos = fornecedoresSugeridos.filter(f => {
        if (!f || typeof f !== 'string' || f.length < 3) return false; // evita siglas de 1-2 letras darem falso positivo
        const regex = new RegExp('\\b' + escapeRegex(f) + '\\b');
        return regex.test(nome);
    });
    if (candidatos.length > 0) {
        candidatos.sort((a, b) => b.length - a.length);
        return candidatos[0];
    }

    return null;
}

// Aplica o apelido cadastrado automaticamente quando o usuário digita/cola o
// nome completo do fornecedor no formulário de adicionar nota manualmente.
function aplicarApelidoNoCampo(input) {
    const valor = input.value.trim();
    if (!valor) return;
    const apelido = encontrarApelidoFornecedor(valor);
    if (apelido && apelido.toUpperCase() !== valor.toUpperCase()) {
        input.value = apelido;
        toast(`Apelido aplicado: ${apelido}`);
    }
}
async function adicionarObservacao(obs,noToast=false){const o=obs.trim();if(o&&!observacoesSugeridas.includes(o)){observacoesSugeridas.push(o);await settingsDocRef.set({ observacoes: observacoesSugeridas }, { merge: true });if(!noToast)toast(`Obs "${o}" adicionada!`)}}
function adicionarObservacaoManage(){const o=DOM.obsManageInput.value.trim();if(o){adicionarObservacao(o);DOM.obsManageInput.value=''}}
async function deletarObservacao(o){showConfirmModal({title:"Excluir Observação",message:`Excluir "${o}"?`,onConfirm:async()=>{observacoesSugeridas=observacoesSugeridas.filter(i=>i!==o);await settingsDocRef.update({observacoes:firebase.firestore.FieldValue.arrayRemove(o)});toast(`Obs "${o}" excluída.`)}})}
function popularObservacoesList(){DOM.obs.innerHTML='<option value="">Recurso a ser pago</option>';observacoesSugeridas.sort().forEach(o=>DOM.obs.innerHTML+=`<option value="${o}">${o}</option>`);DOM.listaObsManage.innerHTML='';observacoesSugeridas.sort().forEach(o=>DOM.listaObsManage.innerHTML+=`<li>${o} <button onclick="deletarObservacao('${o}')"><i class="fa-solid fa-times-circle"></i></button></li>`)}


// --- FUNÇÕES DE LISTAGEM/HISTÓRICO ---
// ===================================================================
// --- INDICADOR DE NOVIDADE (bolinha reutilizável, nunca persiste) ---
// ===================================================================
// Mecanismo genérico pra marcar qualquer aba/recurso do app como "tem algo
// novo aqui, vale ver" — igual à bolinha de notificação de qualquer app.
// Não é amarrado a nenhum evento específico (não é "chegou NF do ERP"): é
// só um screenId + duração. Pode ser usado tanto pra avisar de dados novos
// quanto pra apontar uma funcionalidade/melhoria recém-lançada que merece
// ser vista/testada — quem chama decide o motivo, a bolinha só mostra.
// É puro estado de tela: nunca é salva no Firestore/localStorage, então
// nunca persiste de verdade — some sozinha depois de um tempo, e some
// imediatamente ao abrir a aba (ou quando quem chamou decidir limpar antes).
function mostrarNotificacaoAba(screenId, duracaoMs = 60000) {
    document.querySelectorAll(`.tab-item[data-screen="${screenId}"], .sidebar-item[data-screen="${screenId}"]`).forEach(el => {
        if (el.classList.contains('active') || el.querySelector('.nav-notification-dot')) return;
        const dot = document.createElement('span');
        dot.className = 'nav-notification-dot';
        (el.querySelector('.icon-wrapper') || el).appendChild(dot);
        setTimeout(() => dot.remove(), duracaoMs);
    });
}
function limparNotificacaoAba(screenId) {
    document.querySelectorAll(`.tab-item[data-screen="${screenId}"] .nav-notification-dot:not([data-novidade]), .sidebar-item[data-screen="${screenId}"] .nav-notification-dot:not([data-novidade])`).forEach(el => el.remove());
}

// ===================================================================
// --- NOVIDADES DO APP (bolinha persistente, controlada por "já vista") ---
// ===================================================================
// Regra permanente: toda funcionalidade nova/modificada/que mudou de lugar
// ganha uma entrada aqui (id único + tela onde a novidade está) e uma entrada
// no Histórico de Mudanças. A bolinha aparece na aba (ou na aba-pai, quando a
// tela fica dentro de Configurações) enquanto o id NÃO estiver em
// appConfig.novidadesVistas, e some de vez quando o usuário abre a tela da
// novidade — o id é gravado no documento de configurações (arrayUnion).
// Não depende de dados novos nem de listeners de dados: só da lista de vistas.
const NOVIDADES_APP = [
    { id: 'fase14-pdf-exportar', tela: 'screen-export' },
    { id: 'fase14-importar-simplificado', tela: 'screen-import' },
    { id: 'fase14-logo-personalizacao', tela: 'screen-personalizacao' }
];
function novidadesVistasIds() { return Array.isArray(appConfig.novidadesVistas) ? appConfig.novidadesVistas : []; }
function atualizarBolinhasNovidade() {
    const vistas = new Set(novidadesVistasIds());
    const abasComNovidade = new Set(NOVIDADES_APP.filter(n => !vistas.has(n.id)).map(n => screenParentMap[n.tela] || n.tela));
    document.querySelectorAll('.tab-item[data-screen], .sidebar-item[data-screen]').forEach(el => {
        const dotAtual = el.querySelector('.nav-notification-dot[data-novidade]');
        const deve = abasComNovidade.has(el.dataset.screen);
        if (deve && !dotAtual) {
            const dot = document.createElement('span');
            dot.className = 'nav-notification-dot';
            dot.setAttribute('data-novidade', '1');
            (el.querySelector('.icon-wrapper') || el).appendChild(dot);
        } else if (!deve && dotAtual) {
            dotAtual.remove();
        }
    });
}
function marcarNovidadeVista(telaId) {
    const vistas = novidadesVistasIds();
    const novas = NOVIDADES_APP.filter(n => n.tela === telaId && !vistas.includes(n.id)).map(n => n.id);
    if (!novas.length) return;
    appConfig.novidadesVistas = [...vistas, ...novas];
    atualizarBolinhasNovidade();
    settingsDocRef.set({ novidadesVistas: firebase.firestore.FieldValue.arrayUnion(...novas) }, { merge: true })
        .catch(error => console.error('Erro ao salvar novidades vistas:', error));
}

function switchToScreen(screenId, title) { if (!document.getElementById(screenId) || document.getElementById(screenId).classList.contains('active')) return; const telaAnterior = document.querySelector('.app-screen.active'); if (telaAnterior && telaAnterior.id === 'screen-anotacoes-editor' && screenId !== 'screen-anotacoes-editor') { clearTimeout(autoSaveAnotacaoTimeout); salvarAnotacaoAtual(false); } closeAllModals(); const headerTitle = document.getElementById('main-header-title'); const subMenuScreens = Object.keys(closeBtnBackScreen); document.getElementById('sync-btn').style.display = subMenuScreens.includes(screenId) ? 'none' : 'flex'; document.getElementById('close-btn').style.display = subMenuScreens.includes(screenId) ? 'flex' : 'none'; const selectBtn = document.getElementById('select-mode-btn'); if (selectBtn) selectBtn.style.display = (screenId === 'screen-manage') ? 'flex' : 'none'; const saidaBtn = document.getElementById('saida-mode-btn'); if (saidaBtn) saidaBtn.style.display = (screenId === 'screen-manage') ? 'flex' : 'none'; const counterEl = document.getElementById('manage-counter'); if (counterEl) counterEl.style.display = (screenId === 'screen-manage') ? 'inline-flex' : 'none'; if (screenId !== 'screen-manage' && selectionModeNotas) { selectionModeNotas = false; notasSelecionadas.clear(); if (selectBtn) selectBtn.classList.remove('active'); rebuildNotasPendentesList(); atualizarBulkBarNotas(); } if (screenId !== 'screen-manage' && modoSelecaoSaida) { modoSelecaoSaida = false; if (saidaBtn) saidaBtn.classList.remove('active'); rebuildNotasPendentesList(); } headerTitle.classList.add('title-changing'); setTimeout(() => { headerTitle.textContent = title; headerTitle.classList.remove('title-changing'); }, 175); document.querySelectorAll('.app-screen.active').forEach(s => s.classList.remove('active')); document.getElementById(screenId).classList.add('active'); const parentScreenId = screenParentMap[screenId] || screenId; document.querySelectorAll('.tab-item, .sidebar-item').forEach(item => { item.classList.toggle('active', item.dataset.screen === parentScreenId); }); limparNotificacaoAba(parentScreenId); if (screenId === 'screen-cotacoes') renderListaCotacoes(); if (screenId === 'screen-historico-mudancas') renderHistoricoMudancas(); marcarNovidadeVista(screenId); }
function popularListaReordenar() { const list = document.getElementById('menu-reorder-list'); list.innerHTML = ''; const order = appConfig.personalizacao.menuOrder; order.forEach((screenId, index) => { const details = menuDetails[screenId]; if (details) { const li = document.createElement('div'); li.className = 'reorder-list-item'; li.innerHTML = ` <div class="name"> <span class="icon-wrapper"><i class="${details.icon}"></i><span class="material-icons">${details.material}</span>${details.outlineSvg || ''}${details.duotoneSvg || ''}</span> <span>${details.title}</span> </div> <div class="actions"> <button onclick="moveMenuItem('${screenId}', 'up')" ${index === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button> <button onclick="moveMenuItem('${screenId}', 'down')" ${index === order.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button> </div> `; list.appendChild(li); } }); }
function moveMenuItem(screenId, direction) { const order = appConfig.personalizacao.menuOrder; const index = order.indexOf(screenId); if (index === -1) return; if (direction === 'up' && index > 0) { [order[index], order[index - 1]] = [order[index - 1], order[index]]; } else if (direction === 'down' && index < order.length - 1) { [order[index], order[index + 1]] = [order[index + 1], order[index]]; } salvarPersonalizacao(); }
function salvarPersonalizacao() { settingsDocRef.set({ personalizacao: appConfig.personalizacao }, { merge: true }).catch(error => console.error("Erro ao salvar personalização: ", error)); }

// ===================================================================
// --- FASE 14: LOGO DA INSTITUIÇÃO (usada nos PDFs da aba Exportar) ---
// ===================================================================
// Mecanismo mínimo: a logo (PNG) é lida como base64 e guardada dentro do
// mesmo documento/coleção de configurações já usado por toda a
// personalização (settingsDocRef, appConfig.personalizacao) — nenhuma
// coleção nova, nenhum Firebase Storage, nada complexo.
function atualizarPreviewLogo() {
    const img = document.getElementById('logo-preview-img');
    const container = document.getElementById('logo-preview-container');
    const btnRemover = document.getElementById('logo-remove-btn');
    if (!img || !container) return;
    const logo = appConfig.personalizacao && appConfig.personalizacao.logoBase64;
    if (logo) {
        img.src = logo;
        container.style.display = 'block';
        if (btnRemover) btnRemover.style.display = 'inline-flex';
    } else {
        container.style.display = 'none';
        if (btnRemover) btnRemover.style.display = 'none';
    }
}

function handleLogoUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.type !== 'image/png') { toast('✕ Envie um arquivo PNG.'); event.target.value = ''; return; }
    if (file.size > 1024 * 1024) { toast('✕ Logo muito grande (máx. 1 MB). Use uma imagem menor.'); event.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
        appConfig.personalizacao.logoBase64 = reader.result;
        salvarPersonalizacao();
        atualizarPreviewLogo();
        toast('✓ Logo salva — será usada nos próximos PDFs da aba Exportar.');
    };
    reader.onerror = () => toast('✕ Não foi possível ler o arquivo.');
    reader.readAsDataURL(file);
    event.target.value = '';
}

function removerLogo() {
    appConfig.personalizacao.logoBase64 = null;
    salvarPersonalizacao();
    atualizarPreviewLogo();
    toast('Logo removida.');
}

function sincronizarManualmente(button){const syncButton=document.getElementById('sync-btn');if(syncButton.disabled)return;syncButton.disabled=true;const icon = syncButton.querySelector('.icon-wrapper i, .icon-wrapper svg'); if(icon) icon.classList.add('fa-spin'); toast("Sincronizando...");setTimeout(()=>{toast("✓ Dados atualizados.");syncButton.disabled=false;if(icon) icon.classList.remove('fa-spin'); if(icon) icon.classList.add('sync-success');setTimeout(()=>icon.classList.remove('sync-success'),800)},1250)}
function toggleEditPanel(btn,notaId){const notaItem=btn.closest('.nota-item');const editPanel=notaItem.querySelector('.edit-panel');document.querySelectorAll('.edit-panel.show').forEach(p=>{if(p!==editPanel)p.classList.remove('show')});const isVisible=editPanel.classList.toggle('show');if(isVisible&&editPanel.innerHTML===''){reconstruirPainelFotosEdit(notaId)}}
async function salvarEdicao(id){const notaItem=document.querySelector(`div[data-note-id="${id}"]`);const data={fornecedor:notaItem.querySelector(`.fornEdit`).value.trim().toUpperCase(),nf:notaItem.querySelector(`.nfEdit`).value.trim(),vencimento:notaItem.querySelector(`.vencEdit`).value.trim(),valor:notaItem.querySelector(`.valorEdit`).value.trim(),obs:notaItem.querySelector(`.obsEdit`).value.trim()};await notasCollection.doc(id).update(data);await adicionarFornecedor(data.fornecedor,true);toast('✓ Nota editada!');notaItem.querySelector('.edit-panel').classList.remove('show')}
function generateUniqueId(){return`${Date.now()}-${Math.random().toString(36).substr(2,9)}`}
async function deletarNota(id){showConfirmModal({title:"Confirmar Exclusão",message:"Deseja excluir esta nota permanentemente?",onConfirm:async()=>{await notasCollection.doc(id).delete();toast("🗑️ Nota excluída!")}})}

// Marca/desmarca uma nota como "pendente" (em espera). Notas pendentes continuam
// aparecendo na aba Gerenciar, mas ficam de fora do texto gerado na aba Exportar,
// até serem desmarcadas de novo.
async function toggleEmEspera(id) {
    const nota = notasPendentes.find(n => n.id === id);
    if (!nota) return;
    const novoValor = !nota.emEspera;

    // Atualiza a tela imediatamente (badge, borda e texto de exportação), sem
    // depender do listener do Firestore: ele tem uma otimização (pensada
    // originalmente só pro checklist) que pula o re-render quando detecta uma
    // escrita ainda pendente de confirmação — o que fazia esse toggle parecer
    // que "não funcionava" até o listener eventualmente sincronizar.
    nota.emEspera = novoValor;
    rebuildNotasPendentesList();
    DOM.saida.value = buildSaidaText(notasPendentes.filter(n => !n.emEspera));
    atualizarContadorExportacao();

    try {
        await notasCollection.doc(id).update({ emEspera: novoValor });
        toast(novoValor ? '⏳ Nota marcada como pendente (fora da exportação).' : '✓ Nota removida da pendência (volta a aparecer na exportação).');
    } catch (e) {
        // Escrita falhou: desfaz a mudança local pra não ficar dessincronizado.
        nota.emEspera = !novoValor;
        rebuildNotasPendentesList();
        DOM.saida.value = buildSaidaText(notasPendentes.filter(n => !n.emEspera));
        atualizarContadorExportacao();
        console.error('Erro ao marcar nota como pendente:', e);
        toast('✕ Erro ao atualizar a nota.');
    }
}
// "Arquivar tudo" só deve arquivar as notas que já podem sair da relação —
// uma nota marcada como pendente (emEspera) continua retida até o usuário
// resolver/desmarcar a pendência explicitamente (toggleEmEspera). Nunca cria
// um segundo registro pra isso: é o mesmo doc, só filtrado antes de decidir
// o que move pro histórico.
async function limpar(){
    const notasParaArquivar = notasPendentes.filter(n => !n.emEspera);
    const notasPendentesRestantes = notasPendentes.filter(n => n.emEspera);
    showConfirmModal({
        title: "Confirmar Arquivamento",
        message: notasParaArquivar.length === 0
            ? `Todas as ${notasPendentes.length} nota(s) atuais estão marcadas como pendentes e não serão arquivadas até serem resolvidas.`
            : `Arquivar ${notasParaArquivar.length} nota(s)?${notasPendentesRestantes.length ? ` As ${notasPendentesRestantes.length} nota(s) pendente(s) permanecerão ativas na relação.` : ''}`,
        confirmText: "Arquivar",
        confirmClass: "success",
        onConfirm: async () => {
            if (notasParaArquivar.length === 0) return toast("Nada para arquivar — só restam notas pendentes.");
            const batch = firestore.batch();
            for (const nota of notasParaArquivar) {
                const {id, ...notaData} = nota;
                notaData.dataHistorico = (new Date).toLocaleString('pt-BR');
                batch.set(historicoCollection.doc(), notaData);
                batch.delete(notasCollection.doc(id));
                // Se esta nota nasceu de uma entrada do relatório ERP
                // (selecionarEntradaErpParaFinanceiro), sincroniza o status
                // lá também — "arquivada" passa a valer pros dois lados,
                // sem duplicar registro.
                const entradaVinculada = listaEntradasErp.find(e => e.notaVinculadaId === id);
                if (entradaVinculada) batch.update(entradasErpCollection.doc(entradaVinculada.id), { statusFluxo: 'arquivada' });
            }
            await batch.commit();
            toast(`${notasParaArquivar.length} nota(s) arquivada(s).${notasPendentesRestantes.length ? ` ${notasPendentesRestantes.length} pendente(s) mantida(s) na relação.` : ''}`);
        }
    });
}
async function limparHistorico(){showConfirmModal({title:"Limpar Histórico?",message:"Esta ação é irreversível.",onConfirm:async()=>{if(historicoNotas.length===0)return;const batch=firestore.batch();historicoNotas.forEach(nota=>batch.delete(historicoCollection.doc(nota.id)));await batch.commit();toast("Histórico limpo!")}})}
function toggleChecklist(btn,notaId){const notaItem=btn.closest('.nota-item');const checklistContainer=notaItem.querySelector('.checklist-container');const editPanel=notaItem.querySelector('.edit-panel');document.querySelectorAll('.edit-panel.show, .checklist-container.show').forEach(p=>{if(p!==checklistContainer)p.classList.remove('show')});if(editPanel.classList.contains('show'))editPanel.classList.remove('show');checklistContainer.classList.toggle('show')}
function gerarHtmlChecklist(nota){let html='';const checklistData=nota.checklist||{};for(const key in checklistDefinition){const isChecked=checklistData[key]?'checked':'';html+=`<div class="checklist-item"><input type="checkbox" id="check-${key}-${nota.id}" ${isChecked} onchange="atualizarChecklist('${nota.id}', '${key}', this.checked)"><label for="check-${key}-${nota.id}">${checklistDefinition[key]}</label></div>`}return html}
function atualizarChecklist(notaId,tarefa,isChecked){isChecklistUpdate=!0;const updateData={};updateData[`checklist.${tarefa}`]=isChecked;notasCollection.doc(notaId).update(updateData).catch(error=>toast("Erro ao salvar progresso."));const nota=notasPendentes.find(n=>n.id===notaId);if(!nota)return;if(!nota.checklist)nota.checklist={};nota.checklist[tarefa]=isChecked;const totalTasks=Object.keys(checklistDefinition).length;const completedTasks=Object.values(nota.checklist).filter(Boolean).length;const progressPercent=(completedTasks/totalTasks)*100;const notaItemEl=document.querySelector(`div[data-note-id="${notaId}"]`);if(notaItemEl){const progressBar=notaItemEl.querySelector('.progress-bar');const progressButton=notaItemEl.querySelector('.progress-btn');if(progressBar)progressBar.style.width=`${progressPercent}%`;if(progressButton)progressButton.textContent=`Progresso: ${completedTasks}/${totalTasks}`}}
// --- SISTEMA DE ANOTAÇÕES (múltiplas notas, texto rico, tabelas) ---

function stripHtmlAnotacao(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    // textContent concatena blocos (<p>, <div>, <li>...) sem nenhum espaço
    // entre eles — "RIOCLARENSE Ped. 1698" + "Pedido: SERINGA..." virava
    // "RIOCLARENSE Ped. 1698Pedido: SERINGA..." colado. Insere um espaço no
    // fim de cada bloco antes de extrair o texto, sem criar quebra de linha.
    tmp.querySelectorAll('p, div, li, h1, h2, h3, h4, br').forEach(el => {
        el.insertAdjacentText('afterend', ' ');
    });
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

function renderListaAnotacoes() {
    const container = document.getElementById('lista-anotacoes-container');
    if (!container) return;

    const termo = filtroAnotacoesTexto.trim().toUpperCase();
    const lista = listaAnotacoes.filter(a => {
        if (!termo) return true;
        const titulo = (a.titulo || '').toUpperCase();
        const texto = stripHtmlAnotacao(a.conteudo).toUpperCase();
        return titulo.includes(termo) || texto.includes(termo);
    });

    if (lista.length === 0) {
        container.innerHTML = `<div class="empty-state">${listaAnotacoes.length === 0 ? 'Nenhuma anotação ainda. Toque em "Nova Anotação" para começar.' : 'Nenhuma anotação encontrada.'}</div>`;
        return;
    }

    container.innerHTML = lista.map(a => {
        const snippet = stripHtmlAnotacao(a.conteudo).slice(0, 90) || 'Sem conteúdo ainda...';
        const data = a.atualizadoEm ? new Date(a.atualizadoEm).toLocaleString('pt-BR') : '';
        const concluida = a.status === 'concluido';
        const sinalizada = !!a.sinalizada;
        const selecionada = selecaoAnotacoesAtiva && anotacoesSelecionadas.has(a.id);
        return `<div class="nota-item anotacao-item ${concluida ? 'anotacao-concluida' : ''} ${selecionada ? 'nota-selected' : ''}" onclick="${selecaoAnotacoesAtiva ? `toggleSelecaoAnotacao('${a.id}')` : (a.pedido ? `abrirCentralPedido('${a.pedido}')` : `abrirAnotacao('${a.id}')`)}">            <div class="nota-info">${a.titulo || 'Sem título'}${concluida ? ' <span class="badge-concluida">Concluída</span>' : ''}</div>
            <div class="nota-detalhes">${snippet}${snippet.length >= 90 ? '…' : ''}</div>
            <div class="nota-data">Atualizado em: ${data}</div>
            ${!selecaoAnotacoesAtiva ? `<div class="anotacao-card-actions">
                <button type="button" class="anotacao-icon-btn ${sinalizada ? 'is-flagged' : ''}" title="Sinalizar" onclick="event.stopPropagation(); toggleFlagAnotacao('${a.id}')"><i class="fa-solid fa-flag"></i></button>
                <button type="button" class="anotacao-icon-btn ${concluida ? 'is-done' : ''}" title="${concluida ? 'Reabrir' : 'Concluir'}" onclick="event.stopPropagation(); toggleConcluidaAnotacao('${a.id}')"><i class="fa-solid fa-check"></i></button>
                <button type="button" class="anotacao-icon-btn is-delete" title="Excluir" onclick="event.stopPropagation(); excluirAnotacaoRapida('${a.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>` : ''}
        </div>`;
    }).join('');
}

function toggleFlagAnotacao(id) {
    const nota = listaAnotacoes.find(a => a.id === id);
    if (!nota) return;
    const novoValor = !nota.sinalizada;
    anotacoesTextoCollection.doc(id).update({ sinalizada: novoValor })
        .catch(e => { console.error('Erro ao sinalizar anotação:', e); toast('✕ Erro ao sinalizar.'); });
}

function toggleConcluidaAnotacao(id) {
    const nota = listaAnotacoes.find(a => a.id === id);
    if (!nota) return;
    const novoStatus = nota.status === 'concluido' ? null : 'concluido';
    anotacoesTextoCollection.doc(id).update({ status: novoStatus })
        .then(() => toast(novoStatus ? '✓ Marcada como concluída.' : 'Reaberta.'))
        .catch(e => { console.error('Erro ao concluir anotação:', e); toast('✕ Erro ao atualizar.'); });
}

function excluirAnotacaoRapida(id) {
    const nota = listaAnotacoes.find(a => a.id === id);
    showConfirmModal({
        title: 'Excluir Anotação',
        message: `Deseja excluir "${nota ? (nota.titulo || 'Sem título') : 'esta anotação'}" permanentemente?`,
        confirmText: 'Excluir',
        confirmClass: 'danger',
        onConfirm: async () => {
            try {
                await anotacoesTextoCollection.doc(id).delete();
                toast('🗑️ Anotação excluída.');
            } catch (e) {
                console.error('Erro ao excluir anotação:', e);
                toast('✕ Erro ao excluir.');
            }
        }
    });
}

function filtrarAnotacoes(texto) {
    filtroAnotacoesTexto = texto;
    renderListaAnotacoes();
}

// --- Seleção múltipla para exportar relatório consolidado pro WhatsApp
// (vários pedidos diferentes numa mensagem só, sem redigitar). ---
function toggleModoSelecaoAnotacoes() {
    selecaoAnotacoesAtiva = !selecaoAnotacoesAtiva;
    anotacoesSelecionadas.clear();
    const btn = document.getElementById('btn-selecionar-anotacoes');
    const barra = document.getElementById('anotacoes-bulk-bar');
    if (btn) btn.classList.toggle('active', selecaoAnotacoesAtiva);
    if (barra) barra.style.display = selecaoAnotacoesAtiva ? 'flex' : 'none';
    atualizarContadorSelecaoAnotacoes();
    renderListaAnotacoes();
}
function toggleSelecaoAnotacao(id) {
    if (anotacoesSelecionadas.has(id)) anotacoesSelecionadas.delete(id);
    else anotacoesSelecionadas.add(id);
    atualizarContadorSelecaoAnotacoes();
    renderListaAnotacoes();
}
function atualizarContadorSelecaoAnotacoes() {
    const el = document.getElementById('anotacoes-selecao-contador');
    if (el) el.textContent = anotacoesSelecionadas.size > 0 ? `${anotacoesSelecionadas.size} selecionada(s)` : 'Toque nas anotações para selecionar';
}
async function exportarAnotacoesWhatsapp() {
    if (anotacoesSelecionadas.size === 0) return toast('Selecione ao menos uma anotação.');
    const selecionadas = listaAnotacoes.filter(a => anotacoesSelecionadas.has(a.id));
    // Mantém a ordem em que aparecem na lista (mais recentes primeiro), não a
    // ordem de clique.
    const blocos = selecionadas.map(a => {
        const texto = stripHtmlAnotacao(a.conteudo).trim();
        return `*${a.titulo || 'Sem título'}*${texto ? '\n' + texto : ''}`;
    });
    const relatorio = blocos.join('\n\n———\n\n');
    if (navigator.share) {
        try {
            await navigator.share({ title: 'Relatório de Anotações', text: relatorio });
        } catch (e) {
            // usuário cancelou o share sheet — não é erro
        }
    } else {
        await navigator.clipboard.writeText(relatorio);
        toast('✓ Relatório copiado! Cole no WhatsApp.');
    }
}

function abrirNovaAnotacao() {
    voltarAnotacaoEditorParaCentral = null; // reseta — só a Central religa essa flag explicitamente
    anotacaoAtualId = null;
    document.getElementById('anotacao-titulo').value = '';
    document.getElementById('anotacao-corpo').innerHTML = '';
    aplicarEstadoEspacamentoEditor('', false);
    switchToScreen('screen-anotacoes-editor', 'Nova Anotação');
    setTimeout(() => { document.getElementById('anotacao-titulo').focus(); atualizarEstadoToolbarAnotacao(); }, 300);
}

function abrirAnotacao(id, viaCentral) {
    const nota = listaAnotacoes.find(a => a.id === id);
    if (!nota) return;
    if (!viaCentral) voltarAnotacaoEditorParaCentral = null; // reseta se aberta direto da lista, não da Central
    anotacaoAtualId = id;
    document.getElementById('anotacao-titulo').value = nota.titulo || '';
    document.getElementById('anotacao-corpo').innerHTML = nota.conteudo || '';
    aplicarEstadoEspacamentoEditor(nota.espacamentoLinha || '', !!nota.paragrafoCompacto);
    switchToScreen('screen-anotacoes-editor', nota.titulo || 'Anotação');
    setTimeout(atualizarEstadoToolbarAnotacao, 300);
}

// ============================================================
// CENTRAL DO PEDIDO — tela própria (não mais um painel dentro do editor de
// anotação). cotacoes/{pedido} continua sendo a única fonte da cotação;
// anotacoesTexto continua sendo a única fonte de ocorrências/divergências/
// status/histórico. Esta tela só JUNTA as duas na apresentação — nenhum
// dado é copiado de um lado pro outro.
//
// STATUS de uma divergência: 'pendente' (padrão, inclusive pra ocorrências
// antigas sem esse campo — nunca migramos histórico antigo só pra
// adicionar o campo), 'resolvida' (problema corrigido de fato) ou
// 'encerrada' (caso finalizado sem necessariamente ter sido corrigido).
// HISTÓRICO é append-only: uma mudança de status NUNCA apaga ou reescreve
// uma entrada anterior, só acrescenta uma nova. O texto que foi gerado e
// salvo no momento da identificação nunca muda retroativamente.
// ============================================================
let centralPedidoAtual = null;
let centralFornecedoresAbertos = new Set();
let centralStatusFormAberto = new Set();
let voltarAnotacaoEditorParaCentral = null; // guarda o pedido, se o editor de texto foi aberto a partir da Central

const ROTULOS_HISTORICO = { identificacao: 'Identificado', resolucao: 'Resolvido', encerramento: 'Encerrado', reabertura: 'Reaberto' };

function abrirCentralPedido(pedido) {
    if (!pedido) return;
    centralPedidoAtual = pedido;
    centralFornecedoresAbertos = new Set();
    centralStatusFormAberto = new Set();
    switchToScreen('screen-central-pedido', pedido);
    renderCentralPedidoCompleto(pedido);
}

// Linhas de texto (uma por material) de UMA divergência — reaproveita
// linhaMaterial()/paragrafoAvaria(), já usados na geração de texto da
// Auditoria (mesma lógica, não duplicada).
// Texto natural de uma ocorrência que NÃO é por material (multiMaterial:
// false) — hoje "fornecedor não entregou" e "frete em desacordo". Extraído
// como função própria pra não duplicar a mesma string em dois lugares
// (Central do Pedido via linhasDeMateriais, e a saída da Auditoria via
// gerarCorpoAuditoria) — um ajusta, o outro acompanha automaticamente.
function textoOcorrenciaUnica(tipo, c) {
    if (tipo === 'fornecedor_nao_entregou') {
        return `${c.fornecedorNome ? upAud(c.fornecedorNome) + ': ' : ''}ainda não entregou o pedido${c.diasEmAberto ? ', já são ' + c.diasEmAberto + ' dias em aberto' : ''}.${c.observacao ? ' ' + c.observacao : ''}`;
    }
    if (tipo === 'frete_indevido') {
        return `A cotação foi aprovada com frete ${c.condicaoCotada ? upAud(c.condicaoCotada) : '?'}, porém o fornecedor cobrou frete${c.valorFrete ? ' no valor de ' + c.valorFrete : ''}${c.condicaoCobrada ? ' (' + upAud(c.condicaoCobrada) + ')' : ''}, em desacordo com a condição aprovada.${c.observacao ? ' ' + c.observacao : ''}`;
    }
    return '';
}

function linhasDeMateriais(d) {
    const def = TIPOS_DIVERGENCIA_AUDITORIA[d.tipo];
    if (!def) return [];
    if (def.multiMaterial) return (d.materiais || []).map(m => d.tipo === 'avariado' ? `${upAud(m.produto)} — material avariado` : linhaMaterial(d.tipo, m)).filter(Boolean);
    const texto = textoOcorrenciaUnica(d.tipo, d.campos || {});
    return texto ? [texto] : [];
}

// Bloco de UMA divergência: linhas de material + status + histórico +
// controle pra mudar o status. ocIdx/divIdx são os índices reais dentro de
// nota.ocorrencias[ocIdx].divergencias[divIdx] — é como alterarStatusDivergenciaCentral
// sabe exatamente o que atualizar no Firestore.
function renderBlocoDivergencia(d, oc, ocIdx, divIdx) {
    const status = d.status || 'pendente'; // ocorrências antigas sem status viram "pendente" só na exibição
    const linhas = linhasDeMateriais(d);
    if (linhas.length === 0) return '';
    const linhasHTML = linhas.map(l => `<div class="central-item-linha">${l.replace(/</g, '&lt;')}</div>`).join('');

    const historico = d.historico || [];
    const historicoHTML = historico.length ? `<div class="central-historico">
        ${historico.map(h => `<div class="central-historico-item">${formatarDataBRSimples(h.data)} — ${ROTULOS_HISTORICO[h.tipo] || h.tipo}${h.observacao ? ': ' + h.observacao.replace(/</g, '&lt;') : ''}</div>`).join('')}
    </div>` : '';

    const key = `${ocIdx}-${divIdx}`;
    const formAberto = centralStatusFormAberto.has(key);
    const statusFormHTML = formAberto ? `
        <div class="central-status-form">
            <select id="central-status-select-${key}" class="form-field">
                <option value="pendente" ${status === 'pendente' ? 'selected' : ''}>Pendente</option>
                <option value="resolvida" ${status === 'resolvida' ? 'selected' : ''}>Resolvida</option>
                <option value="encerrada" ${status === 'encerrada' ? 'selected' : ''}>Encerrada</option>
            </select>
            <input type="text" id="central-status-obs-${key}" class="form-field" placeholder="Observação (opcional)">
            <button type="button" class="actions-button is-success" onclick="confirmarAlteracaoStatusCentral('${oc._anotacaoId}', ${ocIdx}, ${divIdx})">Atualizar Status</button>
        </div>` : '';

    return `<div class="central-divergencia-bloco">
        ${linhasHTML}
        <div class="central-divergencia-meta">
            <span class="central-status-badge status-${status}">${status === 'pendente' ? 'Pendente' : status === 'resolvida' ? 'Resolvida' : 'Encerrada'}</span>
            ${oc.notaFiscal ? `<span class="central-nf-tag">NF ${oc.notaFiscal}</span>` : ''}
            <button type="button" class="central-status-toggle" onclick="toggleCentralStatusForm('${key}')">${formAberto ? 'Cancelar' : 'Alterar status'}</button>
        </div>
        ${historicoHTML}
        ${statusFormHTML}
    </div>`;
}

function renderCentralPedidoCompleto(pedido) {
    const cotacao = listaCotacoes.find(c => c.pedido === pedido);
    const nota = listaAnotacoes.find(a => a.pedido === pedido);

    document.getElementById('central-titulo-pedido').textContent = cotacao && cotacao.origem ? `${pedido} — ${cotacao.origem}` : pedido;

    const headerCard = document.getElementById('central-header-card');
    const semCotacao = document.getElementById('central-sem-cotacao');
    if (cotacao) {
        headerCard.style.display = 'block';
        semCotacao.style.display = 'none';
        document.getElementById('central-origem').value = cotacao.origem || '';
        document.getElementById('central-data-pedido').value = cotacao.dataPedido || '';
        document.getElementById('central-data-limite').value = cotacao.dataLimite || '';
        document.getElementById('central-observacao-cotacao').value = cotacao.observacao || '';
    } else {
        headerCard.style.display = 'none';
        semCotacao.style.display = 'block';
    }

    // Todas as divergências de todas as ocorrências, achatadas, guardando os
    // índices reais (ocIdx/divIdx) pra alteração de status saber onde mexer,
    // e o id da anotação (pra Firestore) embutido em cada ocorrência.
    const todasDivergencias = [];
    (nota && nota.ocorrencias ? nota.ocorrencias : []).forEach((oc, ocIdx) => {
        const ocComId = { ...oc, _anotacaoId: nota.id };
        (oc.divergencias || []).forEach((d, divIdx) => todasDivergencias.push({ d, oc: ocComId, ocIdx, divIdx }));
    });

    const container = document.getElementById('central-fornecedores-container');

    if (cotacao) {
        const fornecedoresHTML = (cotacao.fornecedores || []).map(f => {
            const nomeExibicao = nomeExibicaoFornecedor(f.razaoSocial, f.cnpj);
            const produtos = (cotacao.itens || []).filter(it => it.cnpjFornecedor === f.cnpj);
            const divergenciasForn = todasDivergencias.filter(x => x.oc.fornecedorCnpj === f.cnpj);
            const aberto = centralFornecedoresAbertos.has(f.cnpj);

            const produtosHTML = produtos.length
                ? produtos.map(it => renderLinhaProduto(it, `${f.cnpj}-${it.codProduto}`)).join('')
                : '<div class="central-item-vazio">Nenhum produto cotado registrado.</div>';

            const divergenciasHTML = divergenciasForn.length
                ? divergenciasForn.map(x => renderBlocoDivergencia(x.d, x.oc, x.ocIdx, x.divIdx)).join('')
                : '<div class="central-item-vazio">Nenhuma divergência registrada com este fornecedor ainda.</div>';

            return `<div class="central-fornecedor">
                <div class="central-fornecedor-header" onclick="toggleCentralFornecedor('${f.cnpj}')">
                    <i class="fa-solid fa-chevron-${aberto ? 'down' : 'right'}"></i>
                    <span>${nomeExibicao}${f.cnpj ? ` <span style="font-weight:400;color:var(--text-light);font-size:11px;">— CNPJ ${formatarCnpjExibicao(f.cnpj)}</span>` : ''}</span>
                </div>
                <div class="central-fornecedor-body" style="display:${aberto ? 'block' : 'none'};">
                    <div class="central-secao-titulo">Produtos Cotados</div>
                    ${produtosHTML}
                    <div class="central-secao-titulo">Comparação Cotação × NF × ERP</div>
                    ${renderComparacaoFornecedorHTML(pedido, f.cnpj)}
                    <div class="central-secao-titulo">Divergências</div>
                    ${divergenciasHTML}
                </div>
            </div>`;
        }).join('');

        const semFornecedor = todasDivergencias.filter(x => !x.oc.fornecedorCnpj);
        const semFornecedorHTML = semFornecedor.length ? `<div class="central-fornecedor">
            <div class="central-fornecedor-header" onclick="toggleCentralFornecedor('_sem_cnpj')">
                <i class="fa-solid fa-chevron-${centralFornecedoresAbertos.has('_sem_cnpj') ? 'down' : 'right'}"></i>
                <span>Outras ocorrências (sem fornecedor identificado na cotação)</span>
            </div>
            <div class="central-fornecedor-body" style="display:${centralFornecedoresAbertos.has('_sem_cnpj') ? 'block' : 'none'};">
                ${semFornecedor.map(x => `<div style="margin-bottom:6px;font-size:11px;color:var(--text-light);">${x.oc.fornecedor ? upAud(x.oc.fornecedor) : 'Fornecedor não identificado'}</div>${renderBlocoDivergencia(x.d, x.oc, x.ocIdx, x.divIdx)}`).join('')}
            </div>
        </div>` : '';

        container.innerHTML = fornecedoresHTML + semFornecedorHTML;
    } else if (nota) {
        // Sem cotação cadastrada, mas já existem ocorrências registradas (ex:
        // auditorias antigas de antes da cotação existir) — mostra tudo junto,
        // sem agrupamento por fornecedor (não há CNPJ pra agrupar por).
        container.innerHTML = todasDivergencias.length
            ? todasDivergencias.map(x => `<div style="margin-bottom:6px;font-size:11px;color:var(--text-light);">${x.oc.fornecedor ? upAud(x.oc.fornecedor) : 'Fornecedor não identificado'}</div>${renderBlocoDivergencia(x.d, x.oc, x.ocIdx, x.divIdx)}`).join('')
            : '<div class="central-item-vazio">Nenhuma ocorrência registrada ainda.</div>';
    } else {
        container.innerHTML = '';
    }

    document.getElementById('central-btn-texto-livre').style.display = nota ? '' : 'none';

    // Anotação embutida no próprio contexto do pedido (correção desta rodada):
    // mesma anotação/estrutura de sempre (anotacoesTextoCollection, casada
    // por `pedido`), só que exibida e editável aqui, sem precisar navegar pra
    // Anotações. Guarda contra sobrescrever o que a pessoa está digitando: só
    // substitui o conteúdo do campo se ele não estiver com foco no momento.
    centralAnotacaoId = nota ? nota.id : null;
    const anotCard = document.getElementById('central-anotacao-card');
    const anotVazia = document.getElementById('central-anotacao-vazia');
    if (anotCard && anotVazia) {
        if (nota) {
            anotCard.style.display = 'block';
            anotVazia.style.display = 'none';
            const campo = document.getElementById('central-anotacao-conteudo');
            if (campo && document.activeElement !== campo) campo.innerHTML = nota.conteudo || '';
        } else {
            anotCard.style.display = 'none';
            anotVazia.style.display = 'block';
        }
    }

}

let centralAnotacaoId = null;
let autoSaveAnotacaoInlineCentralTimeout = null;

function agendarSalvarAnotacaoInlineCentral() {
    clearTimeout(autoSaveAnotacaoInlineCentralTimeout);
    autoSaveAnotacaoInlineCentralTimeout = setTimeout(salvarAnotacaoInlineCentral, 1200);
}

async function salvarAnotacaoInlineCentral() {
    if (!centralAnotacaoId) return;
    const campo = document.getElementById('central-anotacao-conteudo');
    if (!campo) return;
    try {
        await anotacoesTextoCollection.doc(centralAnotacaoId).update({ conteudo: campo.innerHTML, atualizadoEm: new Date().toISOString() });
    } catch (e) {
        console.error('Erro ao salvar anotação inline da Central:', e);
    }
}

// Reaproveita a mesma criação usada na cotação (criarOuAtualizarAnotacaoDaCotacao)
// — sem estrutura de dados nova. Preenche o campo na hora, sem esperar o
// listener em tempo real, pra já aparecer editável assim que criada.
async function criarAnotacaoInlineCentral() {
    if (!centralPedidoAtual) return;
    const cotacao = listaCotacoes.find(c => c.pedido === centralPedidoAtual);
    const origem = cotacao ? cotacao.origem : '';
    const dataPedido = cotacao ? cotacao.dataPedido : '';
    const dataLimite = cotacao ? cotacao.dataLimite : '';
    const fornecedores = cotacao ? cotacao.fornecedores : [];
    try {
        const id = await criarOuAtualizarAnotacaoDaCotacao(centralPedidoAtual, origem, dataPedido, dataLimite, fornecedores);
        if (!id) return toast('✕ Erro ao criar anotação.');
        centralAnotacaoId = id;
        document.getElementById('central-anotacao-card').style.display = 'block';
        document.getElementById('central-anotacao-vazia').style.display = 'none';
        document.getElementById('central-anotacao-conteudo').innerHTML = montarCabecalhoAnotacaoCotacao(centralPedidoAtual, origem, dataPedido, dataLimite, fornecedores);
    } catch (e) {
        console.error('Erro ao criar anotação do pedido:', e);
        toast('✕ Erro ao criar anotação.');
    }
}

// Produto sempre mostra o que realmente veio do XML — nunca inventa uma
// descrição. Quando o fornecedor não preencheu o campo de descrição (existe
// no XML real: alguns itens vêm com <Comentario></Comentario> vazio),
// mostra isso como ausência de dado, nunca como se fosse o nome do produto,
// e o código do fornecedor fica sempre visível (base pra associação futura
// de código externo → interno).
// Reconstrói a cotação com fidelidade total (regra definitiva combinada) —
// nunca usa observação/fabricante/código como substituto do nome oficial.
// Nome oficial só existe depois que o relatório do SmartCompras for colado
// e cruzado (código + CNPJ); até lá, fica marcado como pendente de
// complementação, nunca escondido nem inventado.
let centralProdutosExpandidos = new Set();
let centralAssociacaoBuscaAberta = new Set();

function renderAssociacaoSpDataWidget(it, chaveUnica) {
    if (!it.codProduto) return '';
    const chaveWidget = `assoc-${chaveUnica}`;
    const associacao = listaAssociacoesSpData.find(a => a.codigoSmartCompras === it.codProduto);
    const buscaAberta = centralAssociacaoBuscaAberta.has(chaveWidget);

    if (associacao) {
        const produto = listaProdutosSpData.find(p => p.codigo === associacao.spDataCodigo);
        const linha = produto ? `${produto.codigo} — ${produto.nome} — ${produto.unidade}` : `${associacao.spDataCodigo} (produto não encontrado no cadastro atual)`;
        return `<div class="central-spdata-linha">
            <span><strong>SP Data:</strong> ${linha}</span>
            <button type="button" class="central-status-toggle" onclick="event.stopPropagation(); toggleBuscaAssociacaoSpData('${chaveWidget}')">${buscaAberta ? 'Cancelar' : 'Corrigir'}</button>
        </div>${buscaAberta ? renderBuscaAssociacaoSpData(it, chaveWidget) : ''}`;
    }

    return `<div class="central-spdata-linha central-item-sem-desc">
        <span>SP Data: não associado</span>
        <button type="button" class="central-status-toggle" onclick="event.stopPropagation(); toggleBuscaAssociacaoSpData('${chaveWidget}')">${buscaAberta ? 'Cancelar' : 'Associar'}</button>
    </div>${buscaAberta ? renderBuscaAssociacaoSpData(it, chaveWidget) : ''}`;
}
function toggleBuscaAssociacaoSpData(chaveWidget) {
    if (centralAssociacaoBuscaAberta.has(chaveWidget)) centralAssociacaoBuscaAberta.delete(chaveWidget);
    else centralAssociacaoBuscaAberta.add(chaveWidget);
    // Este widget é reaproveitado tanto na Central do Pedido quanto na
    // Entrada de NF (associação SP Data direto na tela, sem sair pra
    // Cotações) — re-renderiza só o(s) contexto(s) realmente ativo(s).
    if (centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
    if (nfeInfoAtual) renderAssociacaoCotacaoXml();
}
// Sugestões iniciais aparecem ao abrir (baseadas no nome oficial do item, se
// houver); busca manual atualiza só a lista de resultados via DOM direto
// (não re-renderiza a Central inteira), senão o campo de texto perderia o
// foco a cada letra digitada.
function renderBuscaAssociacaoSpData(it, chaveWidget) {
    const sugestoesIniciais = it.nomeOficial ? buscarSugestoesSpData(it.nomeOficial) : [];
    const listaInicialHTML = sugestoesIniciais.length
        ? sugestoesIniciais.slice(0, 8).map(p => `<div class="central-spdata-opcao" onclick="event.stopPropagation(); confirmarAssociacaoSpData('${it.codProduto}', '${p.codigo}')"><strong>${p.codigo}</strong> — ${p.nome} — ${p.unidade}</div>`).join('')
        : '<div class="central-item-vazio">Nenhuma sugestão automática — busque manualmente pelo nome ou código.</div>';
    return `<div class="central-spdata-busca" onclick="event.stopPropagation()">
        <input type="text" class="form-field" placeholder="Buscar por nome ou código..." oninput="atualizarBuscaAssociacaoSpData('${chaveWidget}', '${it.codProduto}', this.value)">
        <div class="central-spdata-opcoes" id="spdata-resultados-${chaveWidget}">${listaInicialHTML}</div>
    </div>`;
}
function atualizarBuscaAssociacaoSpData(chaveWidget, codigoItem, texto) {
    const container = document.getElementById(`spdata-resultados-${chaveWidget}`);
    if (!container) return;
    const candidatos = texto.trim() ? buscarSugestoesSpData(texto) : [];
    container.innerHTML = candidatos.length
        ? candidatos.slice(0, 8).map(p => `<div class="central-spdata-opcao" onclick="event.stopPropagation(); confirmarAssociacaoSpData('${codigoItem}', '${p.codigo}')"><strong>${p.codigo}</strong> — ${p.nome} — ${p.unidade}</div>`).join('')
        : '<div class="central-item-vazio">Nenhum produto encontrado.</div>';
}

function renderLinhaProduto(it, chaveUnica) {
    const nomeOficialSmartCompras = it.nomeOficial ? upAud(it.nomeOficial) : null;
    const observacao = it.descricao && it.descricao !== '---' ? upAud(it.descricao) : '';
    const marca = it.fabricante && it.fabricante !== '---' ? it.fabricante : '';
    const expandido = centralProdutosExpandidos.has(chaveUnica);

    // Depois que existe associação confirmada com o SP Data, a identidade
    // interna (SP Data) passa a ser a identificação PRINCIPAL exibida na
    // lista — nada do SmartCompras é apagado, só deixa de ser o título e
    // passa pros detalhes expandidos (ver detalhesHTML abaixo).
    const associacaoSpData = it.codProduto ? listaAssociacoesSpData.find(a => a.codigoSmartCompras === it.codProduto) : null;
    const produtoSpData = associacaoSpData ? listaProdutosSpData.find(p => p.codigo === associacaoSpData.spDataCodigo) : null;

    // Relatório de fornecedores ganhadores (fonte complementar à cotação):
    // mostra quantos fornecedores realmente cotaram este item específico —
    // é um fato objetivo, nunca decide recurso/pagamento sozinho.
    const relatorioGanhadoresPedido = centralPedidoAtual ? listaRelatorioGanhadores.find(r => r.pedido === centralPedidoAtual) : null;
    const itemGanhadores = relatorioGanhadoresPedido && it.codProduto ? relatorioGanhadoresPedido.itens.find(g => g.codigo === it.codProduto) : null;
    const participantesResumo = itemGanhadores ? ` · ${itemGanhadores.participantes} fornecedor(es) cotaram` : '';
    const participantesDetalheHTML = itemGanhadores
        ? `<div>Fornecedores que cotaram este item: <strong>${itemGanhadores.participantes}</strong>${itemGanhadores.participantes >= 3 ? ' ✓' : ' (menos de 3 participantes)'}</div><div>Vencedor: ${itemGanhadores.fornecedorVencedor ? itemGanhadores.fornecedorVencedor.nome : '<em>não identificado</em>'}</div>${itemGanhadores.empresas.length ? `<div style="font-size:11px;color:var(--text-light);">Participantes: ${itemGanhadores.empresas.map(e => e.nome).join(', ')}</div>` : ''}`
        : '';

    const tituloHTML = produtoSpData
        ? `<div class="central-item-desc-linha">${produtoSpData.codigo} — ${produtoSpData.nome}</div>`
        : nomeOficialSmartCompras
            ? `<div class="central-item-desc-linha">${nomeOficialSmartCompras}</div>`
            : `<div class="central-item-desc-linha central-item-sem-desc">Nome oficial: pendente de complementação (importe o relatório do SmartCompras)</div>`;

    // Recurso confirmado na entrada da NF/XML (Parte 2/4 da correção) — só
    // exibição, nunca uma ação de escolher aqui.
    const recursoItem = (centralPedidoAtual && it.codProduto) ? (() => {
        const c = listaCotacoes.find(x => x.pedido === centralPedidoAtual);
        return c && c.recursosPorItem ? c.recursosPorItem[it.codProduto] : null;
    })() : null;
    const recursoHTML = recursoItem
        ? `<div>Recurso: <strong>${recursoItem}</strong></div>`
        : (it.codProduto ? '<div style="color:var(--text-light);"><em>Recurso: ainda não confirmado (definido na entrada da NF)</em></div>' : '');

    const detalhesHTML = expandido ? `<div class="central-item-detalhes" onclick="event.stopPropagation()">
        ${produtoSpData ? `<div>SP Data: ${produtoSpData.codigo}</div><div>Nome oficial SP Data: ${produtoSpData.nome}</div>` : ''}
        ${it.codProduto ? `<div>Código SmartCompras: ${it.codProduto}</div>` : ''}
        ${nomeOficialSmartCompras ? `<div>Nome oficial SmartCompras: ${nomeOficialSmartCompras}</div>` : ''}
        ${observacao ? `<div>Descrição/observação original SmartCompras: ${observacao}</div>` : ''}
        ${marca ? `<div>Marca: ${marca}</div>` : ''}
        ${it.embalagem ? `<div>Embalagem: ${it.embalagem}</div>` : ''}
        ${it.quantidade ? `<div>Quantidade: ${it.quantidade}</div>` : ''}
        ${it.precoUnitario ? `<div>Valor Unitário: R$ ${it.precoUnitario}</div>` : ''}
        ${it.precoTotal ? `<div>Valor Total: R$ ${it.precoTotal}</div>` : ''}
        ${recursoHTML}
        ${participantesDetalheHTML}
        ${renderAssociacaoSpDataWidget(it, chaveUnica)}
    </div>` : '';

    const resumoMeta = [it.codProduto ? `Cód. ${it.codProduto}` : '', it.quantidade ? `Qtd ${it.quantidade}` : ''].filter(Boolean).join(' · ');

    return `<div class="central-item-linha" onclick="toggleCentralProduto('${chaveUnica}')">
        ${tituloHTML}
        <div class="central-item-meta">${resumoMeta}${participantesResumo}<i class="fa-solid fa-chevron-${expandido ? 'up' : 'down'} central-item-chevron"></i></div>
        ${detalhesHTML}
    </div>`;
}
function toggleCentralProduto(chave) {
    if (centralProdutosExpandidos.has(chave)) centralProdutosExpandidos.delete(chave);
    else centralProdutosExpandidos.add(chave);
    renderCentralPedidoCompleto(centralPedidoAtual);
}

function toggleCentralFornecedor(cnpj) {
    if (centralFornecedoresAbertos.has(cnpj)) centralFornecedoresAbertos.delete(cnpj);
    else centralFornecedoresAbertos.add(cnpj);
    renderCentralPedidoCompleto(centralPedidoAtual);
}
function toggleCentralStatusForm(key) {
    if (centralStatusFormAberto.has(key)) centralStatusFormAberto.delete(key);
    else centralStatusFormAberto.add(key);
    renderCentralPedidoCompleto(centralPedidoAtual);
}

async function confirmarAlteracaoStatusCentral(anotacaoId, ocIdx, divIdx) {
    const key = `${ocIdx}-${divIdx}`;
    const select = document.getElementById(`central-status-select-${key}`);
    const obsInput = document.getElementById(`central-status-obs-${key}`);
    const novoStatus = select.value;
    const observacao = obsInput.value.trim();

    const nota = listaAnotacoes.find(a => a.id === anotacaoId);
    if (!nota) return;
    // Clona profundamente antes de mexer — nunca muta o array em memória
    // direto, só depois que o Firestore confirmar a escrita.
    const ocorrencias = JSON.parse(JSON.stringify(nota.ocorrencias || []));
    const oc = ocorrencias[ocIdx];
    if (!oc || !oc.divergencias || !oc.divergencias[divIdx]) return;
    const d = oc.divergencias[divIdx];
    d.status = novoStatus;
    if (!d.historico) d.historico = [];
    // HISTÓRICO NUNCA É APAGADO — só acrescenta uma entrada nova. O texto
    // gerado/salvo na anotação continua exatamente como estava.
    const tipoEntrada = novoStatus === 'resolvida' ? 'resolucao' : novoStatus === 'encerrada' ? 'encerramento' : 'reabertura';
    d.historico.push({ tipo: tipoEntrada, data: new Date().toISOString().slice(0, 10), observacao });

    try {
        await anotacoesTextoCollection.doc(anotacaoId).update({ ocorrencias, atualizadoEm: new Date().toISOString() });
        toast('✓ Status atualizado.');
        centralStatusFormAberto.delete(key);
        renderCentralPedidoCompleto(centralPedidoAtual);
    } catch (e) {
        console.error('Erro ao atualizar status da divergência:', e);
        toast('✕ Erro ao atualizar status.');
    }
}

// Origem/Data do Pedido/Data Limite/Observação editáveis direto na Central
// (igual ao Gerenciador de NF: abrir, editar, salvar, sem trocar de tela) —
// grava só esses campos em cotacoes/{pedido}, nunca mexe em fornecedores/
// itens (esses continuam vindo só da importação do XML ou cadastro manual).
async function salvarCabecalhoCotacaoCentral() {
    if (!centralPedidoAtual) return;
    const dados = {
        origem: document.getElementById('central-origem').value,
        dataPedido: document.getElementById('central-data-pedido').value,
        dataLimite: document.getElementById('central-data-limite').value,
        observacao: document.getElementById('central-observacao-cotacao').value.trim(),
        atualizadoEm: new Date().toISOString()
    };
    try {
        await cotacoesCollection.doc(centralPedidoAtual).set(dados, { merge: true });
        const nota = listaAnotacoes.find(a => a.pedido === centralPedidoAtual);
        if (nota) {
            const novoTitulo = dados.origem ? `${centralPedidoAtual} - ${dados.origem}` : centralPedidoAtual;
            if (novoTitulo !== nota.titulo) await anotacoesTextoCollection.doc(nota.id).update({ titulo: novoTitulo });
        }
        toast('✓ Salvo.');
        // Sem isso, o título/dados na tela ficavam desatualizados até a
        // próxima ação que disparasse um re-render — o listener do Firestore
        // não está amarrado a essa tela.
        renderCentralPedidoCompleto(centralPedidoAtual);
    } catch (e) {
        console.error('Erro ao salvar dados do pedido:', e);
        toast('✕ Erro ao salvar.');
    }
}

function iniciarAuditoriaDoPedidoCentral() {
    const pedido = centralPedidoAtual;
    abrirNovaAuditoria();
    document.getElementById('aud-pedido').value = pedido;
    buscarCotacaoParaAuditoria();
}

function abrirTextoLivreDoPedidoCentral() {
    const nota = listaAnotacoes.find(a => a.pedido === centralPedidoAtual);
    if (!nota) return toast('Nenhuma anotação encontrada para este pedido ainda.');
    voltarAnotacaoEditorParaCentral = centralPedidoAtual;
    abrirAnotacao(nota.id, true);
}

function voltarParaListaAnotacoes() {
    if (voltarAnotacaoEditorParaCentral) {
        const pedido = voltarAnotacaoEditorParaCentral;
        voltarAnotacaoEditorParaCentral = null;
        abrirCentralPedido(pedido);
        return;
    }
    switchToScreen('screen-anotacoes', 'Anotações');
}

let autoSaveAnotacaoTimeout = null;
function agendarAutoSaveAnotacao() {
    atualizarEstadoToolbarAnotacao();
    clearTimeout(autoSaveAnotacaoTimeout);
    autoSaveAnotacaoTimeout = setTimeout(() => salvarAnotacaoAtual(false), 1200);
}

async function salvarAnotacaoAtual(mostrarToast) {
    const tituloEl = document.getElementById('anotacao-titulo');
    const corpoEl = document.getElementById('anotacao-corpo');
    if (!tituloEl || !corpoEl) return;

    const titulo = tituloEl.value.trim();
    const conteudo = corpoEl.innerHTML;

    // Nada digitado ainda numa anotação nova: não cria lixo no banco.
    if (!anotacaoAtualId && !titulo && !stripHtmlAnotacao(conteudo)) {
        if (mostrarToast) toast('Nada para salvar.');
        return;
    }

    const dados = {
        titulo: titulo || 'Sem título',
        conteudo,
        espacamentoLinha: editorEspacamentoLinhaAtual,
        paragrafoCompacto: editorParagrafoCompactoAtual,
        atualizadoEm: new Date().toISOString()
    };

    try {
        if (anotacaoAtualId) {
            await anotacoesTextoCollection.doc(anotacaoAtualId).update(dados);
        } else {
            dados.criadoEm = dados.atualizadoEm;
            const ref = await anotacoesTextoCollection.add(dados);
            anotacaoAtualId = ref.id;
        }
        if (mostrarToast) toast('✓ Anotação salva!');
    } catch (e) {
        console.error('Erro ao salvar anotação:', e);
        if (mostrarToast) toast('✕ Erro ao salvar anotação.');
    }
}

async function copiarTextoAnotacao() {
    const corpoEl = document.getElementById('anotacao-corpo');
    const texto = corpoEl ? corpoEl.innerText.trim() : '';
    if (!texto) return toast('Nada para copiar.');
    await navigator.clipboard.writeText(texto);
    toast('✓ Texto copiado!');
}

async function colarTextoAnotacao() {
    const corpoEl = document.getElementById('anotacao-corpo');
    if (!corpoEl) return;
    try {
        const texto = await navigator.clipboard.readText();
        if (!texto) return toast('Área de transferência vazia.');
        corpoEl.focus();
        document.execCommand('insertText', false, texto);
        agendarAutoSaveAnotacao();
        toast('✓ Texto colado!');
    } catch (e) {
        console.error('Erro ao colar:', e);
        toast('✕ Não foi possível colar. Verifique a permissão de área de transferência.');
    }
}

function limparTextoAnotacao() {
    const corpoEl = document.getElementById('anotacao-corpo');
    if (!corpoEl || !stripHtmlAnotacao(corpoEl.innerHTML)) return toast('Já está vazio.');
    showConfirmModal({
        title: 'Limpar Texto',
        message: 'Isso vai apagar todo o texto desta anotação. O título é mantido.',
        confirmText: 'Limpar',
        confirmClass: 'danger',
        onConfirm: () => {
            corpoEl.innerHTML = '';
            agendarAutoSaveAnotacao();
            toast('✓ Texto limpo.');
        }
    });
}

function excluirAnotacaoAtual() {
    if (!anotacaoAtualId) {
        // anotação nova, ainda não salva - só descarta e volta pra lista sem criar nada
        clearTimeout(autoSaveAnotacaoTimeout);
        document.getElementById('anotacao-titulo').value = '';
        document.getElementById('anotacao-corpo').innerHTML = '';
        switchToScreen('screen-anotacoes', 'Anotações');
        return;
    }
    showConfirmModal({
        title: 'Excluir Anotação',
        message: 'Deseja excluir esta anotação permanentemente?',
        confirmText: 'Excluir',
        confirmClass: 'danger',
        onConfirm: async () => {
            try {
                clearTimeout(autoSaveAnotacaoTimeout);
                await anotacoesTextoCollection.doc(anotacaoAtualId).delete();
                anotacaoAtualId = null;
                document.getElementById('anotacao-titulo').value = '';
                document.getElementById('anotacao-corpo').innerHTML = '';
                toast('🗑️ Anotação excluída.');
                switchToScreen('screen-anotacoes', 'Anotações');
            } catch (e) {
                console.error('Erro ao excluir anotação:', e);
                toast('✕ Erro ao excluir.');
            }
        }
    });
}

// Formatação de texto rico (negrito, itálico, títulos, listas). execCommand
// ainda funciona bem pra esses comandos básicos em todos os navegadores atuais,
// apesar de "deprecated" — é a forma mais simples de dar edição tipo
// Word/Notion sem precisar de uma biblioteca externa pesada.
function formatarTextoAnotacao(comando, valor) {
    document.getElementById('anotacao-corpo').focus();
    document.execCommand(comando, false, valor || null);
    agendarAutoSaveAnotacao();
    atualizarEstadoToolbarAnotacao();
}

// --- Estado visual da toolbar (negrito/itálico/sublinhado/bloco ativos, e
// undo/redo habilitados) — precisa refletir o estado REAL do cursor/seleção
// a cada momento, não um valor fixo marcado uma vez. Atualiza via
// selectionchange (filtrado pro editor de anotações), a cada digitação, e
// logo depois de qualquer comando de formatação disparado pelos botões.
function atualizarEstadoToolbarAnotacao() {
    const editor = document.getElementById('anotacao-corpo');
    if (!editor) return;
    ['bold', 'italic', 'underline'].forEach(cmd => {
        const btn = document.querySelector(`.rte-toolbar button[data-cmd="${cmd}"]`);
        if (!btn) return;
        try { btn.classList.toggle('active', document.queryCommandState(cmd)); } catch (e) {}
    });
    let blocoAtual = '';
    try { blocoAtual = (document.queryCommandValue('formatBlock') || '').toUpperCase(); } catch (e) {}
    document.querySelectorAll('.rte-toolbar button[data-block]').forEach(btn => {
        const alvo = btn.dataset.block;
        const ehParagrafoPadrao = alvo === 'P' && (blocoAtual === '' || blocoAtual === 'DIV' || blocoAtual === 'P');
        btn.classList.toggle('active', blocoAtual === alvo || ehParagrafoPadrao);
    });
    ['undo', 'redo'].forEach(cmd => {
        const btn = document.querySelector(`.rte-toolbar button[data-cmd="${cmd}"]`);
        if (!btn) return;
        try { btn.disabled = !document.queryCommandEnabled(cmd); } catch (e) { /* navegador sem suporte — deixa habilitado */ }
    });
}
document.addEventListener('selectionchange', () => {
    const editor = document.getElementById('anotacao-corpo');
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !editor.contains(sel.anchorNode)) return;
    atualizarEstadoToolbarAnotacao();
});

// --- Popovers da barra de ferramentas (cor, tamanho, grade de tabela) ---
// Guarda a seleção de texto feita no editor antes de abrir um popover — clicar
// num botão da toolbar tiraria o foco do editor e perderia a seleção, então
// salvamos o Range aqui (o onmousedown com preventDefault nos botões evita que
// o navegador desfaça a seleção antes mesmo do clique acontecer).
let rteSelecaoSalva = null;
function salvarSelecaoRte() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && document.getElementById('anotacao-corpo').contains(sel.anchorNode)) {
        rteSelecaoSalva = sel.getRangeAt(0).cloneRange();
    }
}
function restaurarSelecaoRte() {
    const editor = document.getElementById('anotacao-corpo');
    editor.focus();
    if (rteSelecaoSalva) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(rteSelecaoSalva);
    }
}
function fecharPopoversRte() {
    document.querySelectorAll('.rte-popover').forEach(p => { p.style.display = 'none'; p.style.left = '0'; p.style.right = 'auto'; });
}
function toggleRtePopover(id) {
    salvarSelecaoRte();
    const pop = document.getElementById(id);
    const estavaAberto = pop.style.display === 'block';
    fecharPopoversRte();
    pop.style.display = estavaAberto ? 'none' : 'block';
    if (id === 'rte-table-popover') montarGradeTabela();
    if (id === 'rte-size-popover') atualizarSizePopoverAtivo();
    if (id === 'rte-spacing-popover') atualizarPopoverEspacamentoAtivo();
    if (!estavaAberto) posicionarPopoverDentroDaTela(pop);
}
// Os botões de tamanho/espaçamento/tabela ficam perto da borda direita da
// toolbar (ela tem 2 fileiras de ícones, muitos botões). O popover sempre
// abria alinhado à esquerda do próprio botão (left:0) sem checar se cabia na
// tela — perto da borda direita ele estourava pra fora e ficava flutuando
// sobre o conteúdo, cortado. Agora mede a posição real antes de mostrar e
// alinha pela direita quando não há espaço suficiente à esquerda.
function posicionarPopoverDentroDaTela(pop) {
    // BUG: limpar left/right pra '' não remove o "left:0" que já vem do CSS
    // base (.rte-popover{left:0}) — ao setar só "right:0" depois, os dois
    // ficavam ativos ao mesmo tempo, e um elemento position:absolute com
    // left E right definidos estica pra preencher o espaço inteiro entre os
    // dois, virando a largura absurda do print. Agora sempre define os DOIS
    // lados explicitamente (um em 'auto', nunca deixando o CSS base valer).
    pop.style.left = '0';
    pop.style.right = 'auto';
    const rect = pop.getBoundingClientRect();
    const margem = 8;
    if (rect.right > window.innerWidth - margem) {
        pop.style.left = 'auto';
        pop.style.right = '0';
    }
    // Reavalia depois de trocar de lado — se ainda estourar pela esquerda
    // (popover mais largo que o espaço disponível), prende na borda da tela.
    const rect2 = pop.getBoundingClientRect();
    if (rect2.left < margem) {
        const wrap = pop.closest('.rte-popover-wrap');
        const wrapRect = wrap.getBoundingClientRect();
        pop.style.right = 'auto';
        pop.style.left = (margem - wrapRect.left) + 'px';
    }
}
document.addEventListener('click', (event) => {
    if (!event.target.closest('.rte-popover-wrap')) fecharPopoversRte();
});

// --- Cor do texto ---
function aplicarCorTextoAnotacao(cor) {
    restaurarSelecaoRte();
    document.execCommand('foreColor', false, cor || 'inherit');
    fecharPopoversRte();
    agendarAutoSaveAnotacao();
}

// --- Tamanho do texto (em px) ---
// execCommand('fontSize') só aceita valores de 1 a 7 (sem controle em px), então
// envolvemos a seleção manualmente num <span style="font-size:Npx">.
function aplicarTamanhoTextoAnotacao(px) {
    restaurarSelecaoRte();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { fecharPopoversRte(); return; }
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = px + 'px';
    try {
        range.surroundContents(span);
    } catch (e) {
        // Seleção atravessa múltiplos elementos (ex: parte de duas linhas) —
        // nesse caso, extrai o conteúdo e envolve manualmente.
        span.appendChild(range.extractContents());
        range.insertNode(span);
    }
    sel.removeAllRanges();
    fecharPopoversRte();
    agendarAutoSaveAnotacao();
}

// Detecta o tamanho de fonte no ponto do cursor/seleção, subindo pela árvore
// do DOM até achar um <span style="font-size:...">. Usado só pra marcar a
// opção certa com um check quando o popover abre — não é fixo, reflete o
// estado real.
function obterTamanhoFonteAtual() {
    const editor = document.getElementById('anotacao-corpo');
    const sel = window.getSelection();
    if (!editor || !sel || !sel.rangeCount) return 16;
    let node = sel.anchorNode;
    if (node && node.nodeType !== 1) node = node.parentNode;
    while (node && node !== editor && editor.contains(node)) {
        if (node.style && node.style.fontSize) {
            const px = parseInt(node.style.fontSize, 10);
            if (!isNaN(px)) return px;
        }
        node = node.parentNode;
    }
    return 16;
}
function atualizarSizePopoverAtivo() {
    const atual = obterTamanhoFonteAtual();
    document.querySelectorAll('.rte-size-option[data-size]').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.size, 10) === atual);
    });
}

// --- Espaçamento entre linhas / parágrafos ---
// Aplicado ao documento inteiro (não por parágrafo — mantém a implementação
// simples, como pedido), e persistido como campo próprio da anotação, então
// volta a aparecer do jeito que foi deixado da próxima vez que a nota abrir.
const ESPACAMENTOS_LINHA_ANOTACAO = { simples: '1.35', '115': '1.55', '15': '1.9', duplo: '2.3' };
let editorEspacamentoLinhaAtual = '';
let editorParagrafoCompactoAtual = false;
function aplicarEstadoEspacamentoEditor(valorLineHeight, compacto) {
    const editor = document.getElementById('anotacao-corpo');
    if (!editor) return;
    editor.style.lineHeight = valorLineHeight || '';
    editor.classList.toggle('rte-compacto', !!compacto);
    editorEspacamentoLinhaAtual = valorLineHeight || '';
    editorParagrafoCompactoAtual = !!compacto;
}
function aplicarEspacamentoLinhaAnotacao(chave) {
    const valor = ESPACAMENTOS_LINHA_ANOTACAO[chave] || '';
    const editor = document.getElementById('anotacao-corpo');
    if (editor) editor.style.lineHeight = valor;
    editorEspacamentoLinhaAtual = valor;
    atualizarPopoverEspacamentoAtivo();
    fecharPopoversRte();
    agendarAutoSaveAnotacao();
}
function alternarParagrafoCompactoAnotacao() {
    const editor = document.getElementById('anotacao-corpo');
    if (!editor) return;
    editorParagrafoCompactoAtual = !editorParagrafoCompactoAtual;
    editor.classList.toggle('rte-compacto', editorParagrafoCompactoAtual);
    atualizarPopoverEspacamentoAtivo();
    agendarAutoSaveAnotacao();
}
function atualizarPopoverEspacamentoAtivo() {
    document.querySelectorAll('.rte-size-option[data-spacing]').forEach(btn => {
        btn.classList.toggle('active', (ESPACAMENTOS_LINHA_ANOTACAO[btn.dataset.spacing] || '') === editorEspacamentoLinhaAtual);
    });
    const btnCompacto = document.getElementById('rte-btn-compacto');
    if (btnCompacto) btnCompacto.classList.toggle('active', editorParagrafoCompactoAtual);
}

// --- Tabela: grade visual estilo Word/Google Docs, em vez de prompt() ---
function montarGradeTabela() {
    const grid = document.getElementById('rte-table-grid');
    const label = document.getElementById('rte-table-grid-label');
    if (grid.childElementCount > 0) return; // já montada, só reaproveita
    for (let l = 1; l <= 6; l++) {
        for (let c = 1; c <= 6; c++) {
            const cell = document.createElement('div');
            cell.dataset.linhas = l;
            cell.dataset.colunas = c;
            cell.onmouseenter = () => destacarGradeTabela(l, c);
            cell.onclick = () => { inserirTabelaAnotacao(l, c); };
            grid.appendChild(cell);
        }
    }
    grid.onmouseleave = () => { label.textContent = 'Selecione o tamanho'; destacarGradeTabela(0, 0); };
}
function destacarGradeTabela(linhas, colunas) {
    document.getElementById('rte-table-grid-label').textContent = linhas && colunas ? `${linhas} x ${colunas}` : 'Selecione o tamanho';
    document.querySelectorAll('#rte-table-grid div').forEach(cell => {
        const l = parseInt(cell.dataset.linhas), c = parseInt(cell.dataset.colunas);
        cell.classList.toggle('rte-cell-hover', l <= linhas && c <= colunas);
    });
}

// Insere uma tabela editável no ponto do cursor — permite montar ou colar um
// pedaço de planilha (ao copiar células do Excel/Google Sheets e colar aqui
// dentro, o navegador já preserva a tabela automaticamente também).
function inserirTabelaAnotacao(linhas, colunas) {
    if (!linhas || !colunas) return;
    restaurarSelecaoRte();

    let html = '<table class="anotacao-tabela"><tbody>';
    for (let i = 0; i < linhas; i++) {
        html += '<tr>';
        for (let j = 0; j < colunas; j++) {
            html += '<td>&nbsp;</td>';
        }
        html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';

    document.execCommand('insertHTML', false, html);
    fecharPopoversRte();
    agendarAutoSaveAnotacao();
}

// ============================================================
// MÓDULO DE EDITOR DE XML (NF-e) — converte quantidades de caixa/pacote
// pra unidade de dispensação, ajustando qCom/vUnCom/qTrib/vUnTrib e os
// lotes (<rastro>) automaticamente, preservando os valores fiscais
// (impostos, totais, chave de autorização) intocados. O fator de conversão
// vem do texto do produto (regex) ou do banco de exceções salvo por
// fornecedor+produto (Firestore, coleção xmlExcecoes), pra não precisar
// adivinhar de novo na próxima nota do mesmo item.
// Validado item a item contra uma NF-e real antes de entrar no app.
// ============================================================

let xmlDocAtual = null;
let nomeArquivoXmlOriginal = 'nfe-corrigida.xml';
let itensXmlDetectados = [];
let bancoExcecoesXml = {};

// --- Associação NF-e → código do fornecedor → item da cotação (fase 2) ---
let nfeInfoAtual = null; // { cnpjEmit, nNF } da NF-e atualmente carregada no editor
let bancoAssociacoesFornecedor = {}; // chave (cnpjEmit::cProd) -> doc de associacoesFornecedor
let pedidoSelecionadoXml = null; // pedido/cotação escolhido pra associar os itens desta NF-e
let associacaoFornecedorBuscaAberta = new Set();
let conflitoPedidoXmlInfo = null; // {pedidos:[{pedido, itens:[xProd,...]}]} quando itens já associados apontam pra pedidos diferentes — nunca escolhe sozinho nesse caso
let pedidoSugestaoXmlInfo = null; // {candidatos:[{pedido, valorCotado, diffPercentual}], valorNf} — Fase 9: CNPJ bate com mais de uma cotação; sugere por valor compatível, nunca decide sozinho
let pedidoOrigemXml = null; // 'automatico' | 'manual' | null — só pra indicar na tela como o pedido foi definido, não influencia a lógica
let filtroItensXml = 'todos'; // 'todos' | 'pendencias' — filtro visual da lista de itens, não altera nenhum dado
let mostrarOutrosFornecedoresXml = false; // por padrão a seleção de item prioriza o fornecedor identificado pelo CNPJ; só amplia quando pedido explicitamente

function detectarFatorXml(xProd) {
    const texto = xProd.toUpperCase();
    const matchFD = texto.match(/\bFD\s?(\d+)\b/);
    const matchC = texto.match(/C\/\s?(\d+)/); // exige dígito logo após "C/" — não confunde com "C/VASO" etc.
    const matchCX = !matchC ? texto.match(/\bCX\s?(\d+)\b/) : null;

    let fator = 1, suspeito = false;
    if (matchFD && matchC) fator = parseInt(matchFD[1], 10) * parseInt(matchC[1], 10);
    else if (matchC) fator = parseInt(matchC[1], 10);
    else if (matchCX) fator = parseInt(matchCX[1], 10);
    else suspeito = true;
    return { fator: fator || 1, suspeito };
}

function chaveExcecaoXml(cnpjEmit, item) {
    return `${cnpjEmit}::${item.cEAN || item.cProd}`.replace(/\//g, '_');
}

function handleArquivoXml(file) {
    if (!file) return;
    nomeArquivoXmlOriginal = file.name;
    document.getElementById('xml-nome-arquivo').textContent = file.name;
    const reader = new FileReader();
    reader.onload = (e) => processarXmlTexto(e.target.result);
    reader.readAsText(file, 'UTF-8');
}

function processarXmlTexto(texto) {
    const parser = new DOMParser();
    xmlDocAtual = parser.parseFromString(texto, 'application/xml');
    if (xmlDocAtual.querySelector('parsererror')) {
        toast('✕ Esse arquivo não é um XML válido.');
        xmlDocAtual = null;
        return;
    }

    const cnpjEmit = xmlDocAtual.querySelector('emit CNPJ')?.textContent || '';
    const nNF = xmlDocAtual.querySelector('ide nNF')?.textContent || '';
    const dets = Array.from(xmlDocAtual.getElementsByTagName('det'));

    // Identificação da NF (Parte 6): só dados estruturados que já existem no
    // XML, nada inferido/adivinhado — pra confirmar visualmente, antes de
    // qualquer processamento, que é o arquivo certo. infCpl (informações
    // complementares) é só pra CONSULTA humana — nunca usado pra decidir
    // pedido/produto automaticamente (fornecedor às vezes escreve o número
    // do pedido ali, mas não é dado estruturado confiável).
    const nfeIdentificacao = {
        fornecedor: xmlDocAtual.querySelector('emit xNome')?.textContent || '',
        cnpjEmit,
        nNF,
        serie: xmlDocAtual.querySelector('ide serie')?.textContent || '',
        emissao: xmlDocAtual.querySelector('ide dhEmi')?.textContent || xmlDocAtual.querySelector('ide dEmi')?.textContent || '',
        vencimentos: Array.from(xmlDocAtual.querySelectorAll('cobr dup dVenc')).map(el => el.textContent).filter(Boolean),
        valorTotal: xmlDocAtual.querySelector('total ICMSTot vNF')?.textContent || '',
        qtdItens: dets.length,
        infCpl: xmlDocAtual.querySelector('infAdic infCpl')?.textContent || ''
    };

    itensXmlDetectados = dets.map(detEl => {
        const prod = detEl.getElementsByTagName('prod')[0];
        const get = (tag) => prod.getElementsByTagName(tag)[0]?.textContent || '';
        const xProd = get('xProd');
        const item = {
            prod,
            xProd,
            cProd: get('cProd'),
            cEAN: get('cEAN'),
            ncm: get('NCM'),
            qComEl: prod.getElementsByTagName('qCom')[0],
            vUnComEl: prod.getElementsByTagName('vUnCom')[0],
            qTribEl: prod.getElementsByTagName('qTrib')[0],
            vUnTribEl: prod.getElementsByTagName('vUnTrib')[0],
            uComEl: prod.getElementsByTagName('uCom')[0],
            uTribEl: prod.getElementsByTagName('uTrib')[0],
            qComOriginal: parseFloat(prod.getElementsByTagName('qCom')[0]?.textContent || '0'),
            vUnComOriginal: parseFloat(prod.getElementsByTagName('vUnCom')[0]?.textContent || '0'),
            qTribOriginal: parseFloat(prod.getElementsByTagName('qTrib')[0]?.textContent || '0'),
            vUnTribOriginal: parseFloat(prod.getElementsByTagName('vUnTrib')[0]?.textContent || '0'),
            rastros: Array.from(prod.getElementsByTagName('rastro')).map(r => ({
                qLoteEl: r.getElementsByTagName('qLote')[0],
                qLoteOriginal: parseFloat(r.getElementsByTagName('qLote')[0]?.textContent || '0')
            })),
            // Substituição controlada de código (Editor XML, base de
            // histórico): cProd nunca é sobrescrito — cProdNovo é o único
            // campo usado na hora de gerar a saída (ver
            // aplicarConversaoNoXmlDom), e só é preenchido depois de uma
            // decisão explícita do usuário (nunca automaticamente).
            cProdNovo: null,
            decisaoTomada: 'nao_decidido', // 'nao_decidido' | 'aplicado_sp_data' | 'aplicado_manual' | 'mantido_original'
            possibilidadeEscolhida: null
        };
        const chave = chaveExcecaoXml(cnpjEmit, item);
        item.chaveExcecao = chave;
        if (bancoExcecoesXml[chave] !== undefined) {
            item.fator = bancoExcecoesXml[chave];
            item.deExcecao = true;
            item.suspeitoOriginal = false;
            item.conferido = true;
        } else {
            const det = detectarFatorXml(xProd);
            item.fator = det.fator;
            item.suspeito = det.suspeito;
            // "suspeitoOriginal" nunca muda depois de definido — é o que
            // decide, no download, se vale salvar a confirmação como exceção
            // (mesmo quando o fator confirmado continua sendo 1). "suspeito"
            // (mutável) é só o que ainda falta confirmar agora.
            item.suspeitoOriginal = det.suspeito;
            item.conferido = !det.suspeito;
        }
        // Consulta o histórico já existente (fornecedor->SmartCompras->SP
        // Data), considerando outros CNPJs da mesma entidade — só leitura,
        // nenhuma decisão automática. Alimenta o painel "Associações
        // conhecidas" no render dos itens.
        item.associacoesConhecidas = consultarAssociacoesConhecidasParaXml(cnpjEmit, item.cProd);
        return item;
    });

    document.getElementById('xml-card-associacao').style.display = 'block';
    document.getElementById('xml-acoes-finais').style.display = 'flex';
    renderIdentificacaoXml(nfeIdentificacao);

    // Base da associação com a cotação (fase 2 do roadmap): já identifica o
    // fornecedor/NF e tenta achar o pedido sozinho antes de pedir seleção
    // manual — sem inventar nada, só reaproveitando associações já
    // confirmadas em NFs anteriores.
    nfeInfoAtual = { cnpjEmit, nNF, fornecedor: nfeIdentificacao.fornecedor, serie: nfeIdentificacao.serie, emissao: nfeIdentificacao.emissao, valorTotal: nfeIdentificacao.valorTotal };
    associacaoFornecedorBuscaAberta = new Set();

    // 1ª prioridade: pelas associações de fornecedor já confirmadas dos
    // itens desta NF (mais forte que CNPJ, porque já foi confirmado à mão
    // antes). Se os itens já associados apontarem pra pedidos diferentes,
    // não escolhe nenhum — fica como conflito pra resolução manual.
    const pedidosPorItem = itensXmlDetectados.map(item => {
        const chave = chaveAssociacaoFornecedor(cnpjEmit, item.cProd);
        const associacao = bancoAssociacoesFornecedor[chave];
        if (!associacao) return null;
        const cotacaoDoItem = listaCotacoes.find(c => (c.itens || []).some(it => it.codProduto === associacao.codigoSmartCompras));
        return cotacaoDoItem ? { pedido: cotacaoDoItem.pedido, item } : null;
    }).filter(Boolean);
    const pedidosDistintos = [...new Set(pedidosPorItem.map(p => p.pedido))];

    conflitoPedidoXmlInfo = null;
    pedidoSugestaoXmlInfo = null;
    pedidoOrigemXml = null;
    if (pedidosDistintos.length === 1) {
        pedidoSelecionadoXml = pedidosDistintos[0];
        pedidoOrigemXml = 'automatico';
    } else if (pedidosDistintos.length > 1) {
        pedidoSelecionadoXml = null;
        conflitoPedidoXmlInfo = {
            pedidos: pedidosDistintos.map(pedido => ({
                pedido,
                itens: pedidosPorItem.filter(p => p.pedido === pedido).map(p => p.item.xProd)
            }))
        };
    } else {
        // 2ª prioridade (regra já existente): CNPJ do emitente bate com
        // exatamente uma cotação.
        const cotacoesDoFornecedor = listaCotacoes.filter(c => (c.fornecedores || []).some(f => f.cnpj === cnpjEmit));
        if (cotacoesDoFornecedor.length === 1) {
            pedidoSelecionadoXml = cotacoesDoFornecedor[0].pedido;
            pedidoOrigemXml = 'automatico';
        } else if (cotacoesDoFornecedor.length > 1) {
            // Fase 9: CNPJ bate com MAIS de uma cotação — nunca escolhe
            // sozinho, mas sugere por evidência de valor (mesma lógica
            // determinística já usada na reconciliação do ERP, Fase 8:
            // valor total da NF compatível com o valor total cotado pra
            // esse fornecedor, dentro da mesma tolerância). Nunca usa data
            // isolada. Sempre exige confirmação explícita do usuário.
            pedidoSelecionadoXml = null;
            const valorNf = numeroFlexivel(nfeIdentificacao.valorTotal);
            const candidatos = cotacoesDoFornecedor.map(cotacao => {
                const fornecedorMatch = (cotacao.fornecedores || []).find(f => f.cnpj === cnpjEmit);
                const valorCotado = valorTotalCotacaoPorFornecedor(cotacao, fornecedorMatch.cnpj);
                const diffPercentual = (valorNf !== null && valorCotado > 0) ? Math.abs(valorCotado - valorNf) / valorCotado : null;
                return { pedido: cotacao.pedido, valorCotado, diffPercentual };
            }).filter(c => c.diffPercentual !== null && c.diffPercentual <= TOLERANCIA_VALOR_RECONCILIACAO_ERP)
              .sort((a, b) => a.diffPercentual - b.diffPercentual);
            if (candidatos.length) pedidoSugestaoXmlInfo = { candidatos, valorNf };
        } else {
            pedidoSelecionadoXml = null;
        }
    }

    // Filtro padrão da lista de itens: prioriza pendências quando existirem
    // (sem esconder a opção de ver todos, que fica sempre disponível no
    // controle), senão mostra todos — não faz sentido abrir já filtrado
    // numa NF sem nenhuma pendência.
    filtroItensXml = itensXmlDetectados.some(item => !statusItemXml(item).pronto) ? 'pendencias' : 'todos';
    mostrarOutrosFornecedoresXml = false;

    renderAssociacaoCotacaoXml();
}

// Formata datas do XML (dhEmi vem com hora/timezone, dEmi já vem só a data) e
// valores monetários pra exibição BR — só formatação visual, não altera o
// dado nem participa de nenhum cálculo.
function formatarDataCompletaBR(valor) {
    if (!valor) return '';
    const dataParte = valor.split('T')[0];
    const partes = dataParte.split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : valor;
}
function formatarValorMonetarioBR(valor) {
    const n = parseFloat(valor);
    if (isNaN(n)) return '';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderIdentificacaoXml(info) {
    const card = document.getElementById('xml-card-identificacao');
    const container = document.getElementById('xml-identificacao-container');
    if (!card || !container) return;

    const linhas = [
        info.fornecedor ? `<div><strong>Fornecedor:</strong> ${info.fornecedor}</div>` : '',
        info.cnpjEmit ? `<div><strong>CNPJ:</strong> ${info.cnpjEmit}</div>` : '',
        info.nNF ? `<div><strong>NF:</strong> ${info.nNF}</div>` : '',
        info.serie ? `<div><strong>Série:</strong> ${info.serie}</div>` : '',
        info.emissao ? `<div><strong>Emissão:</strong> ${formatarDataCompletaBR(info.emissao)}</div>` : '',
        info.vencimentos.length ? `<div><strong>Vencimento${info.vencimentos.length > 1 ? 's' : ''}:</strong> ${info.vencimentos.map(formatarDataCompletaBR).join(', ')}</div>` : '',
        info.valorTotal ? `<div><strong>Valor total:</strong> R$ ${formatarValorMonetarioBR(info.valorTotal)}</div>` : '',
        `<div><strong>Itens:</strong> ${info.qtdItens}</div>`
    ].filter(Boolean).join('');

    container.innerHTML = linhas || '<div class="central-item-vazio">Não foi possível identificar os dados da NF neste XML.</div>';

    // Informações adicionais/observações (infCpl) — só pra consulta humana.
    // Fornecedor às vezes escreve número de pedido ali, mas nunca é usado
    // pelo sistema pra decidir pedido/produto — só os dados estruturados e
    // as associações já confirmadas fazem isso (ver processarXmlTexto).
    const infoAdicEl = document.getElementById('xml-identificacao-infadic');
    if (infoAdicEl) {
        infoAdicEl.style.display = info.infCpl ? 'block' : 'none';
        infoAdicEl.querySelector('.xml-infadic-texto').textContent = info.infCpl;
    }

    card.style.display = 'block';
}

// Formata uma quantidade pra exibição: remove zeros desnecessários à direita
// e usa vírgula decimal (padrão BR). Não afeta o valor usado internamente
// (qCom/qTrib continuam com toFixed(4) na hora de gravar no XML) — isso é
// só a apresentação na tela. Ex.: 2 → "2", 20 → "20", 20.5 → "20,5".
function formatarQuantidadeXml(numero) {
    return numero.toFixed(4).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

function formatarPreviewXml(item) {
    const qtdFinal = item.fator === 1 ? item.qComOriginal : (item.qComOriginal * item.fator);
    const qtdFinalFmt = formatarQuantidadeXml(qtdFinal);
    if (item.fator === 1) {
        return `Sem conversão · Quantidade final: <b>${qtdFinalFmt} ${item.uComEl.textContent}</b>`;
    }
    const unidadeDestino = document.getElementById('xml-unidade-destino').value;
    const novoValor = (item.vUnComOriginal / item.fator).toFixed(7);
    return `${formatarQuantidadeXml(item.qComOriginal)} ${item.uComEl.textContent} → Quantidade final: <b>${qtdFinalFmt} ${unidadeDestino}</b> a R$ ${novoValor}`;
}

// Cruza o CNPJ da NF com o cadastro de fornecedores do SP Data (que já
// suporta vários CNPJs por código — nunca assume 1:1). Só informativo: não
// bloqueia nada quando não encontra, só sinaliza pra conferência.
function validarFornecedorSpData(cnpjEmit) {
    const docs = listaFornecedoresSpData.filter(f => f.cnpjs.some(c => c.cnpj === cnpjEmit));
    if (docs.length === 0) return { encontrado: false, ambiguo: false };
    if (docs.length > 1) {
        // Mesmo CNPJ cadastrado sob mais de um código de fornecedor — situação
        // real de ambiguidade (ver análise do FORNECEDORES.txt). Nunca escolhe
        // sozinho; vira pendência de conferência.
        return { encontrado: false, ambiguo: true, candidatos: docs.map(d => ({ codigo: d.codigo, nome: d.nomeReal })) };
    }
    const doc = docs[0];
    return {
        encontrado: true, ambiguo: false,
        codigo: doc.codigo, nomeReal: doc.nomeReal, nomeExibido: doc.nomeExibido,
        cnpjsRelacionados: doc.cnpjs.map(c => c.cnpj)
    };
}

// Estado de UM item — usado tanto pelo resumo quanto pela renderização da
// lista (pra badge/destaque) e pelo filtro "somente pendências". "pronto"
// exige as DUAS coisas: associação+SP Data resolvidos E nenhuma conversão
// pendente — um item pode estar associado e ainda não estar totalmente
// pronto (correção desta rodada: antes "resolvido" só olhava associação).
function statusItemXml(item) {
    const chave = chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, item.cProd);
    const associacao = bancoAssociacoesFornecedor[chave];
    const associacaoSpData = associacao ? listaAssociacoesSpData.find(a => a.codigoSmartCompras === associacao.codigoSmartCompras) : null;
    const produtoSpData = associacaoSpData ? listaProdutosSpData.find(p => p.codigo === associacaoSpData.spDataCodigo) : null;
    const conversaoPendente = !!item.suspeito; // "suspeito" só continua true até confirmação explícita (edição OU botão Confirmar) — nunca mais "não mudou = não conferi"

    const motivos = [];
    if (!associacao) motivos.push('Sem associação');
    else if (!produtoSpData) motivos.push('Sem SP Data');
    if (conversaoPendente) motivos.push('Conferir conversão');

    return { chave, associacao, produtoSpData, conversaoPendente, motivos, pronto: motivos.length === 0 };
}

// Estado derivado da NF — nada é armazenado, tudo recalculado a partir do
// que já está em memória (itensXmlDetectados, associações, pedido). É a
// mesma cadeia NF → associacoesFornecedor → item da cotação →
// associacoesSpData, só que resumida pra dizer "o que falta resolver".
// Fase 9: distingue BLOQUEIO (impede salvar — situação em que gravar sem
// decisão explícita seria inseguro: pedido ambíguo entre candidatos
// conflitantes, ou conversão de unidade suspeita ainda não confirmada, já
// que o fator vira número gravado na NF) de ALERTA (não impede salvar —
// recuperável depois pela própria tela de associação/SP Data: sem
// associação, sem SP Data, pedido simplesmente ainda não identificado, ou
// item esperado da cotação que não apareceu nesta NF — pode vir numa NF
// seguinte do mesmo pedido, já implementado em compararFontesPedido).
function calcularResumoPendenciasXml() {
    if (!nfeInfoAtual || !itensXmlDetectados.length) return null;

    let totalmentePronto = 0, semAssociacao = 0, semSpData = 0, conversaoPendente = 0;
    itensXmlDetectados.forEach(item => {
        const s = statusItemXml(item);
        if (s.pronto) totalmentePronto++;
        if (!s.associacao) semAssociacao++;
        else if (!s.produtoSpData) semSpData++;
        if (s.conversaoPendente) conversaoPendente++;
    });

    const bloqueios = [];
    const alertas = [];

    if (conflitoPedidoXmlInfo) {
        bloqueios.push(`Itens desta NF apontam pra pedidos diferentes (${conflitoPedidoXmlInfo.pedidos.map(p => p.pedido).join(' e ')}) — selecione manualmente o pedido correto.`);
    } else if (!pedidoSelecionadoXml) {
        alertas.push('Pedido/cotação ainda não identificado — selecione manualmente (ou confirme a sugestão, se houver uma).');
    }
    if (semAssociacao > 0) alertas.push(`${semAssociacao} item(ns) sem associação com a cotação — pode salvar e associar depois.`);
    if (semSpData > 0) alertas.push(`${semSpData} item(ns) associados à cotação mas ainda sem SP Data — pode salvar e associar depois.`);
    if (conversaoPendente > 0) bloqueios.push(`${conversaoPendente} item(ns) com possível conversão de unidade sem confirmação — a quantidade gravada depende desse fator, confirme antes de salvar.`);

    // Itens que a cotação deste pedido/fornecedor espera, mas que não
    // aparecem NESTA NF nem em nenhuma NF já salva desse pedido — nunca
    // "não entregue": o mesmo pedido pode ter outra NF depois. Reaproveita
    // listaCotacoes/listaNfsProcessadas direto (mesma fonte de
    // compararFontesPedido), sem o filtro "pedidoTemNf" de lá — aqui
    // queremos o alerta já na primeira NF do pedido, não só a partir da
    // segunda. Só um alerta informativo, nunca bloqueia.
    if (pedidoSelecionadoXml) {
        const cotacaoSelecionada = listaCotacoes.find(c => c.pedido === pedidoSelecionadoXml);
        if (cotacaoSelecionada) {
            const validacaoFornecedorAlerta = validarFornecedorSpData(nfeInfoAtual.cnpjEmit);
            const cnpjsFornecedorNf = validacaoFornecedorAlerta.encontrado
                ? [nfeInfoAtual.cnpjEmit, ...validacaoFornecedorAlerta.cnpjsRelacionados]
                : [nfeInfoAtual.cnpjEmit];
            const codigosDestaNf = itensXmlDetectados
                .map(item => bancoAssociacoesFornecedor[chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, item.cProd)])
                .filter(Boolean).map(a => a.codigoSmartCompras);
            const codigosJaEmOutraNfDoPedido = new Set(
                listaNfsProcessadas.filter(nf => nf.pedido === pedidoSelecionadoXml)
                    .flatMap(nf => (nf.itens || []).map(it => it.codigoSmartCompras))
            );
            const itensCotacaoDesteFornecedor = (cotacaoSelecionada.itens || []).filter(it => cnpjsFornecedorNf.includes(it.cnpjFornecedor));
            const codigosUnicos = [...new Set(itensCotacaoDesteFornecedor.map(it => it.codProduto).filter(Boolean))];
            const codigosAusentes = codigosUnicos.filter(cod => !codigosDestaNf.includes(cod) && !codigosJaEmOutraNfDoPedido.has(cod));
            if (codigosAusentes.length > 0) {
                const nomes = codigosAusentes.map(cod => {
                    const it = itensCotacaoDesteFornecedor.find(x => x.codProduto === cod);
                    return it ? (it.nomeOficial || it.descricao || cod) : cod;
                });
                alertas.push(`${codigosAusentes.length} item(ns) da cotação deste pedido/fornecedor ainda não apareceram em nenhuma NF (${nomes.join(', ')}) — pode vir numa NF seguinte, não é um problema desta NF.`);
            }
        }
    }

    return {
        totalItens: itensXmlDetectados.length,
        totalmentePronto, semAssociacao, semSpData, conversaoPendente,
        validacaoFornecedor: validarFornecedorSpData(nfeInfoAtual.cnpjEmit),
        bloqueios, alertas,
        pronta: bloqueios.length === 0 && alertas.length === 0,
        podeSalvar: bloqueios.length === 0
    };
}

function renderResumoPendenciasXml() {
    const el = document.getElementById('xml-estado-nf');
    if (!el) return;
    const resumo = calcularResumoPendenciasXml();
    if (!resumo) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const estadoClasse = resumo.pronta ? 'pronto' : (resumo.podeSalvar ? 'atencao' : 'pendente');
    el.className = `xml-estado-card ${estadoClasse}`;

    const validacaoHTML = resumo.validacaoFornecedor.encontrado
        ? `<div class="xml-estado-validacao">Fornecedor no cadastro SP Data: ${resumo.validacaoFornecedor.codigo} — ${resumo.validacaoFornecedor.nomeExibido || resumo.validacaoFornecedor.nomeReal} (CNPJ confere)</div>`
        : resumo.validacaoFornecedor.ambiguo
            ? `<div class="xml-estado-validacao">⚠ Este CNPJ está cadastrado em mais de um fornecedor SP Data (${resumo.validacaoFornecedor.candidatos.map(c => c.codigo + ' — ' + c.nome).join(' / ')}) — ambíguo, confira manualmente.</div>`
            : `<div class="xml-estado-validacao">CNPJ não encontrado no cadastro de fornecedores SP Data (não impede a entrada, só não foi possível confirmar).</div>`;

    let corpoHTML;
    if (resumo.pronta) {
        corpoHTML = `<div class="xml-estado-linha"><span class="xml-item-badge pronto">✓ Pronta</span><strong>${resumo.totalItens} item(ns) — todos totalmente prontos. Pode salvar.</strong></div>`;
    } else if (!resumo.podeSalvar) {
        corpoHTML = `<div class="xml-estado-linha"><span class="xml-item-badge pendente">⛔ Bloqueado</span><strong>Resolva antes de salvar</strong></div>
           <div class="xml-estado-lista">${resumo.bloqueios.map(p => '• ' + p).join('<br>')}</div>
           ${resumo.alertas.length ? `<div class="xml-estado-lista">${resumo.alertas.map(p => '• ' + p).join('<br>')}</div>` : ''}`;
    } else {
        corpoHTML = `<div class="xml-estado-linha"><span class="xml-item-badge pendente">⚠ Pode salvar, com alerta(s)</span><strong>${resumo.totalmentePronto} de ${resumo.totalItens} totalmente pronto(s)</strong></div>
           <div class="xml-estado-lista">${resumo.alertas.map(p => '• ' + p).join('<br>')}</div>`;
    }

    el.innerHTML = corpoHTML + validacaoHTML;

    // O botão principal agora é "Salvar NF" — reflete o estado (verde
    // quando pronta, alerta quando há pendência não-bloqueante, e continua
    // clicável mesmo bloqueada — o gate no clique é quem decide se passa,
    // pra sempre explicar o motivo em vez de simplesmente desabilitar.
    const btnSalvar = document.getElementById('xml-btn-salvar');
    if (btnSalvar) {
        btnSalvar.className = 'actions-button ' + (resumo.pronta ? 'is-success' : 'is-warning');
        const icone = btnSalvar.querySelector('i');
        if (icone) icone.className = resumo.pronta ? 'fa-solid fa-check' : 'fa-solid fa-triangle-exclamation';
    }
}


function renderTabelaItensXml() {
    renderAssociacaoCotacaoXml();
}

function atualizarFatorXml(idx, valor) {
    const fator = parseInt(valor, 10) || 1;
    itensXmlDetectados[idx].fator = fator;
    itensXmlDetectados[idx].suspeito = false;
    itensXmlDetectados[idx].conferido = true;
    itensXmlDetectados[idx].deExcecao = false;
    renderTabelaItensXml();
}
// "Alterado" e "conferido" são conceitos diferentes: antes, um item suspeito
// só saía da pendência se o valor do fator mudasse (onchange). Se o usuário
// olhava e concordava que o fator sugerido (ou o padrão 1) já estava certo,
// não tinha como confirmar sem mexer no número. Este botão resolve isso —
// confirma sem exigir alteração.
function confirmarFatorXml(idx) {
    itensXmlDetectados[idx].suspeito = false;
    itensXmlDetectados[idx].conferido = true;
    renderTabelaItensXml();
}
function atualizarCProdXml(idx, valor) {
    const item = itensXmlDetectados[idx];
    if (!item) return;
    const v = valor.trim();
    item.cProdNovo = v || null;
    item.possibilidadeEscolhida = null; // edição manual substitui qualquer sugestão do histórico
    item.decisaoTomada = (item.cProdNovo && item.cProdNovo !== item.cProd) ? 'aplicado_manual' : 'nao_decidido';
}
function limparBancoExcecoesXml() {
    showConfirmModal({
        title: 'Limpar Banco de Exceções',
        message: 'Isso apaga todas as correções de fator lembradas por fornecedor/produto. Você vai precisar corrigir de novo na próxima vez que aparecerem.',
        confirmText: 'Limpar',
        confirmClass: 'danger',
        onConfirm: async () => {
            const snapshot = await xmlExcecoesCollection.get();
            const batch = firestore.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            toast('✓ Banco de exceções limpo.');
            if (xmlDocAtual) renderTabelaItensXml();
        }
    });
}

// ============================================================
// ASSOCIAÇÃO NF-e → CÓDIGO DO FORNECEDOR → ITEM DA COTAÇÃO — Fase 2
// Primeira etapa da cadeia do roadmap (NF-e → fornecedor → cotação → SP
// Data). O código do fornecedor vem exclusivamente do campo estruturado
// cProd do XML (nunca de observação/descrição). A ligação até o SP Data
// continua sendo feita depois, pela tela de associação SP Data já
// existente (Central do Pedido) — aqui só se resolve o primeiro elo.
// Histórico append-only, mesmo padrão de confirmarAssociacaoSpData: uma
// correção nunca apaga a associação anterior, só acrescenta e atualiza
// qual é a atual.
// ============================================================

function chaveAssociacaoFornecedor(cnpjEmit, codigoFornecedor) {
    return `${cnpjEmit}::${codigoFornecedor}`.replace(/\//g, '_');
}

// ===================================================================
// --- HISTÓRICO DE ASSOCIAÇÕES (base para o futuro Editor XML) ---
// ===================================================================
// Só consulta o que já existe — nenhuma coleção nova, nenhum campo novo,
// nenhuma escrita. A cadeia Fornecedor/CNPJ → código do fornecedor → código
// SmartCompras → código SP Data → produto já é histórica (append-only) em
// duas coleções diferentes:
//   associacoesFornecedor (chave cnpjEmit::códigoFornecedor) -> codigoSmartCompras, com historico[]
//   associacoesSpData     (chave codigoSmartCompras)         -> spDataCodigo,       com historico[]
// e o nome do produto vem de produtosSpData. NF/data de origem já ficam em
// nfsProcessadas e no campo confirmadoEm/nfNumero de cada entrada.
//
// Como um mesmo fornecedor pode ter mais de um CNPJ (matriz/filial/CD já
// vinculados manualmente em fornecedoresSpData via entidadesRelacionadas —
// ver módulo de Fornecedores), a consulta olha o histórico em TODOS os CNPJs
// da mesma entidade, não só no CNPJ exato do XML atual — sem decidir nada
// sozinha, só reunindo o que já foi confirmado no passado.
//
// Não implementa nenhuma identidade de produto nem decide equivalência: só
// devolve os fatos já confirmados, do mais recente pro mais antigo, pra um
// dia o Editor XML apresentar como sugestão ao usuário confirmar.

// Reaproveita a mesma ideia de agrupamento por entidadesRelacionadas usada em
// listaFornecedoresUnificada(), mas partindo de um CNPJ (não de um id de
// documento). Só leitura.
function cnpjsDaMesmaEntidadeFornecedor(cnpj) {
    const docInicial = listaFornecedoresSpData.find(f => (f.cnpjs || []).some(c => c.cnpj === cnpj));
    if (!docInicial) return [cnpj];
    const porId = {};
    listaFornecedoresSpData.forEach(f => { porId[f.id] = f; });
    const visitado = new Set();
    const pilha = [docInicial.id];
    const cnpjsDoGrupo = new Set([cnpj]);
    while (pilha.length) {
        const atualId = pilha.pop();
        if (visitado.has(atualId) || !porId[atualId]) continue;
        visitado.add(atualId);
        (porId[atualId].cnpjs || []).forEach(c => cnpjsDoGrupo.add(c.cnpj));
        (porId[atualId].entidadesRelacionadas || []).forEach(outroId => { if (!visitado.has(outroId)) pilha.push(outroId); });
    }
    return [...cnpjsDoGrupo];
}

// Consulta (não decide, não grava nada) o histórico de associações já
// confirmadas pra um código de produto do fornecedor (cProd, como vem do
// XML), considerando todos os CNPJs da mesma entidade de fornecedor.
// Retorna uma lista do mais recente pro mais antigo — cada item é um fato já
// confirmado no passado, nunca uma sugestão calculada por semelhança.
function consultarHistoricoAssociacaoFornecedor(cnpjEmit, codigoFornecedor) {
    if (!cnpjEmit || !codigoFornecedor) return [];
    const cnpjsRelacionados = cnpjsDaMesmaEntidadeFornecedor(cnpjEmit);
    const resultados = [];

    cnpjsRelacionados.forEach(cnpj => {
        const chave = chaveAssociacaoFornecedor(cnpj, codigoFornecedor);
        const associacao = bancoAssociacoesFornecedor[chave];
        if (!associacao) return;

        const entradasHistorico = (associacao.historico && associacao.historico.length)
            ? associacao.historico
            : [{ codigoSmartCompras: associacao.codigoSmartCompras, confirmadoEm: associacao.confirmadoEm, tipo: 'confirmacao' }];

        entradasHistorico.forEach(h => {
            const assocSpData = listaAssociacoesSpData.find(a => a.codigoSmartCompras === h.codigoSmartCompras);
            // Também considera o histórico da 2ª ponta (SmartCompras -> SP
            // Data), não só o valor vigente hoje — uma correção antiga nessa
            // ponta não pode ficar invisível pro futuro Editor.
            const entradasSpData = (assocSpData && assocSpData.historico && assocSpData.historico.length)
                ? assocSpData.historico
                : (assocSpData ? [{ spDataCodigo: assocSpData.spDataCodigo, confirmadoEm: assocSpData.confirmadoEm, tipo: 'confirmacao' }] : [{ spDataCodigo: null, confirmadoEm: null, tipo: null }]);

            entradasSpData.forEach(hs => {
                const produto = hs.spDataCodigo ? listaProdutosSpData.find(p => p.codigo === hs.spDataCodigo) : null;
                resultados.push({
                    cnpjFornecedor: cnpj,
                    codigoFornecedor,
                    codigoSmartCompras: h.codigoSmartCompras,
                    spDataCodigo: hs.spDataCodigo,
                    produtoNome: produto ? produto.nome : null,
                    // Campos originais desta função — preservados como
                    // estavam, refletindo a ponta fornecedor->SmartCompras.
                    confirmadoEm: h.confirmadoEm || null,
                    tipo: h.tipo || 'confirmacao',
                    nfNumero: associacao.nfNumero || null,
                    // Novos, aditivos: detalham cada ponta separadamente e
                    // sinalizam (sem decidir nada) qual é a vigente hoje.
                    confirmadoEmSmartCompras: h.confirmadoEm || null,
                    atualParaFornecedor: associacao.codigoSmartCompras === h.codigoSmartCompras,
                    confirmadoEmSpData: hs.confirmadoEm || null,
                    tipoSpData: hs.tipo || null,
                    atualParaSpData: assocSpData ? assocSpData.spDataCodigo === hs.spDataCodigo : false
                });
            });
        });
    });

    return resultados.sort((a, b) => {
        const dataA = [a.confirmadoEmSmartCompras, a.confirmadoEmSpData].filter(Boolean).sort().pop() || '';
        const dataB = [b.confirmadoEmSmartCompras, b.confirmadoEmSpData].filter(Boolean).sort().pop() || '';
        return dataB.localeCompare(dataA);
    });
}

// Camada de consulta/decisão assistida pro futuro Editor XML: dado o CNPJ do
// emitente + o código do produto no XML (cProd), responde "o que já sabemos
// sobre isso?" reunindo TODAS as associações históricas conhecidas em
// possibilidades distintas, sem escolher nenhuma automaticamente. Reaproveita
// consultarHistoricoAssociacaoFornecedor (nenhuma lógica de junção
// duplicada) e só organiza/enriquece o que ela já retorna:
//   - agrupa ocorrências repetidas do mesmo par (codigoSmartCompras + spDataCodigo)
//     numa única "possibilidade", sem descartar nenhuma ocorrência (cada uma
//     continua disponível em `ocorrencias`);
//   - cruza com nfsProcessadas pra trazer as NFs que realmente bateram com
//     esse fornecedor/código, além da NF gravada na hora da confirmação;
//   - inclui o nome de exibição do fornecedor, pra dar contexto.
// Não decide nada: quem escolhe é sempre o usuário, no futuro Editor.
function consultarAssociacoesConhecidasParaXml(cnpjEmit, codigoFornecedor) {
    const historico = consultarHistoricoAssociacaoFornecedor(cnpjEmit, codigoFornecedor);
    const docFornecedor = listaFornecedoresSpData.find(f => (f.cnpjs || []).some(c => c.cnpj === cnpjEmit));
    const cnpjsConsiderados = cnpjsDaMesmaEntidadeFornecedor(cnpjEmit);

    const nfsRelacionadas = listaNfsProcessadas
        .filter(nf => cnpjsConsiderados.includes(nf.cnpjFornecedor) && (nf.itens || []).some(it => it.cProd === codigoFornecedor))
        .map(nf => ({ nf: nf.nf, serie: nf.serie || null, processadoEm: nf.processadoEm || null, cnpjFornecedor: nf.cnpjFornecedor }))
        .sort((a, b) => (b.processadoEm || '').localeCompare(a.processadoEm || ''));

    const porPossibilidade = {};
    historico.forEach(h => {
        const chavePossibilidade = `${h.codigoSmartCompras || '·'}::${h.spDataCodigo || '·'}`;
        if (!porPossibilidade[chavePossibilidade]) {
            porPossibilidade[chavePossibilidade] = {
                codigoSmartCompras: h.codigoSmartCompras,
                spDataCodigo: h.spDataCodigo,
                produtoNome: h.produtoNome,
                cnpjsQueConfirmaram: new Set(),
                ocorrencias: []
            };
        }
        const p = porPossibilidade[chavePossibilidade];
        p.cnpjsQueConfirmaram.add(h.cnpjFornecedor);
        p.ocorrencias.push({
            cnpjFornecedor: h.cnpjFornecedor,
            confirmadoEmSmartCompras: h.confirmadoEmSmartCompras,
            atualParaFornecedor: h.atualParaFornecedor,
            confirmadoEmSpData: h.confirmadoEmSpData,
            atualParaSpData: h.atualParaSpData,
            nfNumero: h.nfNumero
        });
    });

    const possibilidades = Object.values(porPossibilidade).map(p => {
        const ocorrenciasOrdenadas = p.ocorrencias.slice().sort((a, b) => {
            const dataA = [a.confirmadoEmSmartCompras, a.confirmadoEmSpData].filter(Boolean).sort().pop() || '';
            const dataB = [b.confirmadoEmSmartCompras, b.confirmadoEmSpData].filter(Boolean).sort().pop() || '';
            return dataB.localeCompare(dataA);
        });
        return {
            codigoSmartCompras: p.codigoSmartCompras,
            spDataCodigo: p.spDataCodigo,
            produtoNome: p.produtoNome,
            // "Vigente hoje" pra pelo menos um dos CNPJs considerados, nas
            // duas pontas — só informativo, o futuro Editor decide o que
            // fazer com isso, nunca é aplicado sozinho.
            atual: ocorrenciasOrdenadas.some(o => o.atualParaFornecedor && o.atualParaSpData),
            vezesConfirmada: ocorrenciasOrdenadas.length,
            primeiraConfirmacaoEm: ocorrenciasOrdenadas[ocorrenciasOrdenadas.length - 1]?.confirmadoEmSmartCompras || null,
            ultimaConfirmacaoEm: ocorrenciasOrdenadas[0]?.confirmadoEmSmartCompras || null,
            cnpjsQueConfirmaram: [...p.cnpjsQueConfirmaram],
            ocorrencias: ocorrenciasOrdenadas
        };
    }).sort((a, b) => (b.ultimaConfirmacaoEm || '').localeCompare(a.ultimaConfirmacaoEm || ''));

    return {
        cnpjConsultado: cnpjEmit,
        codigoFornecedor,
        fornecedorNome: docFornecedor ? (docFornecedor.nomeExibido || docFornecedor.nomeReal) : null,
        cnpjsConsiderados,
        temAssociacaoConhecida: possibilidades.length > 0,
        possibilidades,
        nfsRelacionadas
    };
}

// Fase 9: aplica a sugestão de pedido (por evidência de valor) só quando o
// usuário confirma explicitamente — nunca automático, mesmo com um único
// candidato dentro da tolerância.
function confirmarPedidoSugeridoXml(pedido) {
    pedidoSelecionadoXml = pedido;
    pedidoOrigemXml = 'manual';
    pedidoSugestaoXmlInfo = null;
    renderAssociacaoCotacaoXml();
}

function selecionarPedidoAssociacaoXml(pedido) {
    pedidoSelecionadoXml = pedido || null;
    pedidoOrigemXml = pedido ? 'manual' : null;
    pedidoSugestaoXmlInfo = null;
    renderAssociacaoCotacaoXml();
}

function alternarFiltroItensXml(modo) {
    filtroItensXml = modo;
    renderAssociacaoCotacaoXml();
}

function alternarOutrosFornecedoresXml() {
    mostrarOutrosFornecedoresXml = !mostrarOutrosFornecedoresXml;
    renderAssociacaoCotacaoXml();
}

// Busca textual dentro do seletor de item da cotação (código SmartCompras ou
// nome/parte do nome) — determinística, sem fuzzy match: só esconde/mostra
// as opções via correspondência de substring no texto já renderizado
// (código, nome, fabricante, embalagem, quantidade já estão nesse texto).
function filtrarOpcoesItemXml(chave, termo) {
    const select = document.getElementById(`assoc-forn-select-${chave}`);
    if (!select) return;
    const t = termo.trim().toUpperCase();
    Array.from(select.options).forEach(opt => {
        if (!opt.value) { opt.style.display = ''; return; }
        opt.style.display = (!t || opt.textContent.toUpperCase().includes(t)) ? '' : 'none';
    });
}

function toggleCorrecaoAssociacaoFornecedor(chave) {
    if (associacaoFornecedorBuscaAberta.has(chave)) associacaoFornecedorBuscaAberta.delete(chave);
    else associacaoFornecedorBuscaAberta.add(chave);
    renderAssociacaoCotacaoXml();
}

function renderAssociacaoCotacaoXml() {
    const container = document.getElementById('xml-associacao-container');
    const seletorPedido = document.getElementById('xml-associacao-pedido');
    const captionEl = document.getElementById('xml-pedido-caption');
    if (!container || !seletorPedido || !nfeInfoAtual) return;

    // O CNPJ da NF pode ser diferente do CNPJ cadastrado na cotação (CDs/
    // filiais do mesmo fornecedor) — por isso o seletor sempre lista TODAS
    // as cotações, nunca só as que têm esse CNPJ. O CNPJ ainda serve como
    // sinal pra pré-selecionar automaticamente (só quando é o único jeito
    // determinístico de decidir, ver processarXmlTexto), mas nunca como
    // filtro que esconde opções — a seleção manual precisa continuar
    // sempre disponível.
    const pedidosOrdenados = ordenarCotacoes(listaCotacoes);
    seletorPedido.innerHTML = '<option value="">Selecione o pedido/cotação...</option>' +
        pedidosOrdenados.map(c => `<option value="${c.pedido}" ${pedidoSelecionadoXml === c.pedido ? 'selected' : ''}>${c.pedido}${c.origem ? ' — ' + c.origem : ''}</option>`).join('');

    if (pedidosOrdenados.length === 0) {
        container.innerHTML = '<div class="central-item-vazio">Nenhuma cotação cadastrada ainda. Cadastre a cotação correspondente pra poder associar os itens desta NF-e.</div>';
        if (captionEl) captionEl.textContent = '';
        renderResumoPendenciasXml();
        return;
    }

    const cotacaoAtual = listaCotacoes.find(c => c.pedido === pedidoSelecionadoXml);
    // Não filtra por CNPJ aqui: depois que o usuário escolheu a cotação, ele
    // já resolveu a ambiguidade — mostrar só os itens do fornecedor "certo"
    // por CNPJ esconderia justamente os casos de CD/filial que motivaram
    // essa correção. Cada opção mostra o fornecedor pra escolha ficar clara.
    const itensDaCotacao = cotacaoAtual ? (cotacaoAtual.itens || []) : [];

    // Uma única exibição do pedido escolhido: o valor já está no <select>
    // acima, então aqui só a legenda com como foi definido (item 6/7 desta
    // rodada — antes o pedido aparecia duas vezes na tela).
    if (captionEl) {
        if (!cotacaoAtual) {
            captionEl.textContent = '';
        } else {
            const origemTexto = pedidoOrigemXml === 'automatico' ? '✓ identificado automaticamente' : pedidoOrigemXml === 'manual' ? 'selecionado manualmente' : '';
            captionEl.textContent = [origemTexto, cotacaoAtual.origem ? `Destino: ${cotacaoAtual.origem}` : '', `${(cotacaoAtual.fornecedores || []).length} fornecedor(es)`].filter(Boolean).join(' · ');
        }
    }

    // Aviso de conflito de pedido: itens já associados apontam pra pedidos
    // diferentes — nunca escolhe sozinho, só avisa.
    const conflitoHTML = conflitoPedidoXmlInfo ? `<div class="xml-item-linha pendente">
        <span>⚠ <strong>Itens desta NF já associados apontam pra pedidos diferentes:</strong><br>${conflitoPedidoXmlInfo.pedidos.map(p => `Pedido ${p.pedido}: ${p.itens.join(', ')}`).join('<br>')}<br>Selecione manualmente o pedido correto acima.</span>
    </div>` : '';

    // Fase 9: sugestão de pedido quando o CNPJ bate com mais de uma cotação
    // e o valor total da NF é compatível com uma (ou mais) delas — nunca
    // decide sozinho, sempre pede confirmação explícita.
    const sugestaoPedidoHTML = pedidoSugestaoXmlInfo ? `<div class="xml-item-linha pendente">
        <span>💡 <strong>Pedido ainda não identificado — CNPJ do fornecedor bate com mais de uma cotação.</strong> Sugestão por valor compatível (NF: R$ ${formatValorBR(pedidoSugestaoXmlInfo.valorNf)}):</span>
        ${pedidoSugestaoXmlInfo.candidatos.map(c => `<div class="xml-item-acao" style="margin-top:4px;">
            <button type="button" class="central-status-toggle" onclick="confirmarPedidoSugeridoXml('${escRel(c.pedido)}')">Confirmar Pedido ${escRel(c.pedido)}</button>
            <span class="xml-item-meta">cotado R$ ${formatValorBR(c.valorCotado)} (diferença ${(c.diffPercentual * 100).toFixed(1)}%)</span>
        </div>`).join('')}
    </div>` : '';

    // Cada item carrega seu índice original (pra atualizarFatorXml/
    // atualizarCProdXml, que dependem da posição real em itensXmlDetectados)
    // e seu status já calculado uma vez — reaproveitado tanto pro filtro
    // quanto pro resumo.
    const itensComStatus = itensXmlDetectados.map((item, idx) => ({ item, idx, status: statusItemXml(item) }));
    const totalPendentes = itensComStatus.filter(x => !x.status.pronto).length;

    // Filtro "somente pendências" (item 5 desta rodada): só aparece quando
    // existe pendência — não faz sentido oferecer o filtro numa NF 100%
    // pronta. Nunca altera itensXmlDetectados, só o que é renderizado.
    const filtroHTML = totalPendentes > 0 ? `<div class="xml-filtro-toggle">
        <button type="button" class="xml-filtro-btn ${filtroItensXml === 'pendencias' ? 'active' : ''}" onclick="alternarFiltroItensXml('pendencias')">Somente pendências (${totalPendentes})</button>
        <button type="button" class="xml-filtro-btn ${filtroItensXml === 'todos' ? 'active' : ''}" onclick="alternarFiltroItensXml('todos')">Todos os itens (${itensComStatus.length})</button>
    </div>` : '';

    const itensParaExibir = (totalPendentes > 0 && filtroItensXml === 'pendencias')
        ? itensComStatus.filter(x => !x.status.pronto)
        : itensComStatus;

    // Prioriza os itens do fornecedor identificado por CNPJ (item 2/3 desta
    // rodada) — só como ORDEM/FILTRO PADRÃO da lista de seleção, nunca
    // escondendo definitivamente: o botão "mostrar outros fornecedores"
    // sempre revela o restante. Se a cotação não tiver nenhum item desse
    // fornecedor, mostra todos direto (não faz sentido restringir a zero).
    const validacaoFornecedorXml = validarFornecedorSpData(nfeInfoAtual.cnpjEmit);
    const cnpjsFornecedorIdentificado = validacaoFornecedorXml.encontrado
        ? [nfeInfoAtual.cnpjEmit, ...validacaoFornecedorXml.cnpjsRelacionados]
        : [nfeInfoAtual.cnpjEmit];
    const itensDoFornecedorIdentificado = itensDaCotacao.filter(it => cnpjsFornecedorIdentificado.includes(it.cnpjFornecedor));
    const restringeFornecedor = itensDoFornecedorIdentificado.length > 0 && itensDoFornecedorIdentificado.length < itensDaCotacao.length;
    const itensParaOpcoes = (restringeFornecedor && !mostrarOutrosFornecedoresXml) ? itensDoFornecedorIdentificado : itensDaCotacao;

    const linhasItens = itensParaExibir.map(({ item, idx, status }) => {
        const buscaAberta = associacaoFornecedorBuscaAberta.has(status.chave);
        let cotacaoSpDataHTML, acaoHTML = '';

        if (!cotacaoAtual && !status.associacao) {
            cotacaoSpDataHTML = 'Selecione o pedido acima pra associar este item à cotação.';
        } else {
            const opcoesHTML = itensParaOpcoes.map(it => {
                const fornecedorIt = (cotacaoAtual.fornecedores || []).find(f => f.cnpj === it.cnpjFornecedor);
                const nomeForn = fornecedorIt ? nomeExibicaoFornecedor(fornecedorIt.razaoSocial, fornecedorIt.cnpj) : (it.cnpjFornecedor || 'fornecedor não identificado');
                const detalhes = [it.fabricante && it.fabricante !== '---' ? it.fabricante : '', it.embalagem || '', it.quantidade ? `Qtd ${it.quantidade}` : ''].filter(Boolean).join(' · ');
                return `<option value="${it.codProduto}">${it.codProduto} — ${it.nomeOficial || it.descricao || 'sem nome'} (${nomeForn})${detalhes ? ' — ' + detalhes : ''}</option>`;
            }).join('');
            const buscaHTML = `<div class="central-spdata-busca" onclick="event.stopPropagation()">
                <input type="text" class="form-field" placeholder="Buscar por código ou nome..." oninput="filtrarOpcoesItemXml('${status.chave}', this.value)">
                <select class="form-field" id="assoc-forn-select-${status.chave}" size="6" onchange="confirmarSelecaoAssociacaoFornecedor('${status.chave}')">
                    <option value="">Selecione o item da cotação...</option>
                    ${opcoesHTML}
                </select>
                ${restringeFornecedor ? `<button type="button" class="central-status-toggle" onclick="alternarOutrosFornecedoresXml()">${mostrarOutrosFornecedoresXml ? 'Mostrar só do fornecedor identificado' : 'Mostrar itens de outros fornecedores'}</button>` : ''}
            </div>`;

            if (status.associacao) {
                // Fornecedor da cotação correspondente: SEMPRE derivado do item já
                // associado (cnpjFornecedor do próprio item na cotação) — nenhuma
                // associação/coleção nova, só leitura do que já existe. Busca em
                // TODAS as cotações (não só a selecionada): uma NF pode legitimamente
                // ter itens de pedidos diferentes (ver conflitoPedidoXmlInfo acima) —
                // achar o item numa cotação diferente da selecionada não é erro, só
                // precisa dizer isso claramente em vez de "não encontrado".
                let itemCotacao = itensDaCotacao.find(it => it.codProduto === status.associacao.codigoSmartCompras);
                let cotacaoDoItem = cotacaoAtual;
                if (!itemCotacao) {
                    for (const c of listaCotacoes) {
                        const achado = (c.itens || []).find(it => it.codProduto === status.associacao.codigoSmartCompras);
                        if (achado) { itemCotacao = achado; cotacaoDoItem = c; break; }
                    }
                }
                const pedidoDiferente = itemCotacao && cotacaoDoItem && cotacaoAtual && cotacaoDoItem.pedido !== cotacaoAtual.pedido;
                const nomeItem = itemCotacao
                    ? (itemCotacao.nomeOficial || itemCotacao.descricao || status.associacao.codigoSmartCompras)
                    : `${status.associacao.codigoSmartCompras} (item não encontrado em nenhuma cotação cadastrada)`;
                const fornecedorCotacao = itemCotacao && cotacaoDoItem ? (cotacaoDoItem.fornecedores || []).find(f => f.cnpj === itemCotacao.cnpjFornecedor) : null;
                const nomeFornecedorCotacao = fornecedorCotacao ? nomeExibicaoFornecedor(fornecedorCotacao.razaoSocial, fornecedorCotacao.cnpj) : '';

                // SP Data direto na Entrada de NF (sem sair pra Cotações): reaproveita
                // o mesmo widget/associação já usados na Central do Pedido —
                // codigoSmartCompras → associacoesSpData, nenhuma estrutura nova.
                const spDataWidgetHTML = renderAssociacaoSpDataWidget(
                    { codProduto: status.associacao.codigoSmartCompras, nomeOficial: itemCotacao ? itemCotacao.nomeOficial : null },
                    'nf-' + status.chave
                );

                cotacaoSpDataHTML = `Cotação: ${nomeItem}${nomeFornecedorCotacao ? ` (${nomeFornecedorCotacao})` : ''}${pedidoDiferente ? ` <em style="color:var(--text-light);">(pedido ${cotacaoDoItem.pedido}, diferente do selecionado)</em>` : ''}${spDataWidgetHTML}`;
            } else {
                cotacaoSpDataHTML = 'Não associado à cotação.';
            }

            acaoHTML = `<button type="button" class="central-status-toggle" onclick="toggleCorrecaoAssociacaoFornecedor('${status.chave}')">${buscaAberta ? 'Cancelar' : (status.associacao ? 'Corrigir' : 'Associar')}</button>${buscaAberta ? buscaHTML : ''}`;
        }

        // Item unificado: produto + código do fornecedor + conversão (fator/
        // quantidade) + cotação/SP Data + estado, tudo num único bloco — não
        // precisa mais comparar duas listas separadas pra entender um item.
        const codigoSaidaDiferente = item.cProdNovo && item.cProdNovo !== item.cProd;
        return `<div class="xml-item-linha ${status.pronto ? '' : 'pendente'}">
            <div class="xml-item-topo">
                <div>
                    <div class="xml-produto-nome">${item.xProd}${item.deExcecao ? ' <span class="badge-excecao">lembrado</span>' : ''}</div>
                    <div class="xml-item-meta">Cód. fornecedor: <input type="text" class="cprod-input" value="${item.cProdNovo || item.cProd}" onchange="atualizarCProdXml(${idx}, this.value)">${item.ncm ? ` · NCM ${escRel(item.ncm)}` : ''}</div>
                    ${codigoSaidaDiferente ? `<div class="xml-item-meta">Original: <strong>${escRel(item.cProd)}</strong> → Saída: <strong>${escRel(item.cProdNovo)}</strong>${item.possibilidadeEscolhida && item.possibilidadeEscolhida.produtoNome ? ' (' + escRel(item.possibilidadeEscolhida.produtoNome) + ')' : ''}</div>` : ''}
                </div>
                <span class="xml-item-badge ${status.pronto ? 'pronto' : 'pendente'}">${status.pronto ? '✓ Pronto' : status.motivos.join(' · ')}</span>
            </div>
            <div class="xml-item-conversao">
                Fator: <input type="number" min="1" class="fator-input ${item.suspeito ? 'suspeito' : ''}" value="${item.fator}" onchange="atualizarFatorXml(${idx}, this.value)">
                ${item.suspeito ? `<button type="button" class="central-status-toggle" onclick="confirmarFatorXml(${idx})">✓ Confirmar fator</button>` : ''}
                <span class="xml-preview-linha">${formatarPreviewXml(item)}</span>
            </div>
            <div class="xml-item-cotacao">${cotacaoSpDataHTML}</div>
            ${acaoHTML ? `<div class="xml-item-acao">${acaoHTML}</div>` : ''}
            ${renderPainelAssociacoesConhecidasXml(item, idx)}
        </div>`;
    }).join('');

    container.innerHTML = conflitoHTML + sugestaoPedidoHTML + filtroHTML + linhasItens;
    renderResumoPendenciasXml();
    renderResumoCodigosXml();
}

// ============================================================
// SUBSTITUIÇÃO CONTROLADA DE CÓDIGO (Editor XML — base de histórico)
// ============================================================
// Painel "Associações conhecidas": mostra, por item, o que o histórico já
// existente (consultarAssociacoesConhecidasParaXml) sabe sobre esse
// fornecedor/código — nunca decide sozinho, só apresenta pro usuário
// escolher. "atual: true" numa possibilidade só indica que ela é a vigente
// hoje na estrutura histórica correspondente, não que é "o produto certo".
function renderPainelAssociacoesConhecidasXml(item, idx) {
    const info = item.associacoesConhecidas;
    if (!info) return '';
    const cnpjAtualNf = nfeInfoAtual ? nfeInfoAtual.cnpjEmit : null;

    if (!info.temAssociacaoConhecida) {
        return `<div class="xml-item-cotacao" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border-color);">
            <span class="xml-item-badge neutro">Nenhuma associação encontrada</span>
            <div class="nota-detalhes" style="margin-top:4px;">Nenhum histórico ainda pra este fornecedor/código. O código original é mantido — edite o campo "Cód. fornecedor" acima se quiser informar outro manualmente.</div>
        </div>`;
    }

    const situacaoTexto = info.possibilidades.length === 1 ? 'Associação conhecida' : `Mais de uma associação encontrada (${info.possibilidades.length})`;
    const situacaoClasse = info.possibilidades.length === 1 ? 'pronto' : 'pendente';

    const possibilidadesHTML = info.possibilidades.map((p, pIdx) => {
        const foraDoCnpjAtual = cnpjAtualNf && !p.cnpjsQueConfirmaram.includes(cnpjAtualNf);
        const selecionada = item.possibilidadeEscolhida && item.possibilidadeEscolhida.codigoSmartCompras === p.codigoSmartCompras && item.possibilidadeEscolhida.spDataCodigo === p.spDataCodigo;
        const nfsTexto = p.ocorrencias.filter(o => o.nfNumero).map(o => o.nfNumero);
        const nfsUnicas = [...new Set(nfsTexto)].slice(0, 5);
        const detalhes = [
            `Confirmada ${p.vezesConfirmada}x`,
            p.primeiraConfirmacaoEm ? `desde ${formatarDataCompletaBR(p.primeiraConfirmacaoEm)}` : '',
            (p.ultimaConfirmacaoEm && p.ultimaConfirmacaoEm !== p.primeiraConfirmacaoEm) ? `última em ${formatarDataCompletaBR(p.ultimaConfirmacaoEm)}` : '',
            p.atual ? 'vigente hoje' : 'substituída depois por outra associação',
            foraDoCnpjAtual ? `encontrada no CNPJ ${p.cnpjsQueConfirmaram.join(', ')} da mesma entidade` : '',
            nfsUnicas.length ? `NF(s): ${nfsUnicas.join(', ')}` : ''
        ].filter(Boolean).join(' · ');

        return `<div class="xml-item-linha" style="margin-top:6px;">
            <div class="xml-item-topo">
                <div>
                    <div class="xml-produto-nome">${p.spDataCodigo ? `SP Data ${escRel(p.spDataCodigo)}` : `SmartCompras ${escRel(p.codigoSmartCompras)} (sem código SP Data ainda)`}${p.produtoNome ? ' — ' + escRel(p.produtoNome) : ''}</div>
                    <div class="xml-item-meta">${detalhes}</div>
                </div>
                ${selecionada ? '<span class="xml-item-badge pronto">✓ Selecionada</span>' : ''}
            </div>
            ${p.spDataCodigo
                ? `<div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="aplicarPossibilidadeConhecidaXml(${idx}, ${pIdx})">${selecionada ? 'Selecionada — usar esta' : 'Usar esta associação'}</button></div>`
                : `<div class="nota-detalhes"><em>Sem código SP Data confirmado ainda pra esta associação — nada pra aplicar na saída por enquanto.</em></div>`
            }
        </div>`;
    }).join('');

    return `<div class="xml-item-cotacao" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border-color);">
        <span class="xml-item-badge ${situacaoClasse}">${situacaoTexto}</span>
        ${possibilidadesHTML}
        <div class="xml-item-acao" style="margin-top:6px;">
            <button type="button" class="central-status-toggle" onclick="manterCodigoOriginalXml(${idx})">${item.decisaoTomada === 'mantido_original' ? '✓ Mantendo código original' : 'Manter código original'}</button>
        </div>
    </div>`;
}

// Aplica (só na saída, ver aplicarConversaoNoXmlDom) o código SP Data de uma
// possibilidade do histórico — NUNCA grava em associacoesFornecedor/
// associacoesSpData, é só a escolha do usuário pra ESTE XML. O código
// original (item.cProd) nunca é sobrescrito.
function aplicarPossibilidadeConhecidaXml(idx, possibilidadeIdx) {
    const item = itensXmlDetectados[idx];
    if (!item || !item.associacoesConhecidas) return;
    const possibilidade = item.associacoesConhecidas.possibilidades[possibilidadeIdx];
    if (!possibilidade) return;
    if (!possibilidade.spDataCodigo) return toast('Essa possibilidade ainda não tem código SP Data — nada pra aplicar na saída.');
    item.cProdNovo = possibilidade.spDataCodigo;
    item.possibilidadeEscolhida = possibilidade;
    item.decisaoTomada = 'aplicado_sp_data';
    renderAssociacaoCotacaoXml();
    toast(`✓ Código de saída definido: ${possibilidade.spDataCodigo}. O código original (${item.cProd}) continua preservado internamente.`);
}

// Confirmação explícita de "não usar nenhuma associação encontrada" — o
// item já ficaria com o código original por padrão mesmo sem essa ação, mas
// registrar a decisão deixa isso visível no resumo (item 12 do pedido).
function manterCodigoOriginalXml(idx) {
    const item = itensXmlDetectados[idx];
    if (!item) return;
    item.cProdNovo = null;
    item.possibilidadeEscolhida = null;
    item.decisaoTomada = 'mantido_original';
    renderAssociacaoCotacaoXml();
    toast('Código original mantido pra este item.');
}

// Visão geral (item 12 do pedido): quantos itens estão em cada situação.
// Só leitura/contagem — não altera nada, não bloqueia nada.
function calcularResumoCodigosXml() {
    if (!itensXmlDetectados.length) return null;
    let semAssociacao = 0, unica = 0, multipla = 0, confirmados = 0, mantidosOriginal = 0;
    itensXmlDetectados.forEach(item => {
        const info = item.associacoesConhecidas;
        if (!info || !info.temAssociacaoConhecida) semAssociacao++;
        else if (info.possibilidades.length === 1) unica++;
        else multipla++;
        if (item.decisaoTomada === 'aplicado_sp_data' || item.decisaoTomada === 'aplicado_manual') confirmados++;
        if (!item.cProdNovo || item.cProdNovo === item.cProd) mantidosOriginal++;
    });
    return { total: itensXmlDetectados.length, semAssociacao, unica, multipla, confirmados, mantidosOriginal };
}

function renderResumoCodigosXml() {
    const el = document.getElementById('xml-resumo-codigos');
    if (!el) return;
    const r = calcularResumoCodigosXml();
    if (!r) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = `<div class="nota-detalhes" style="line-height:1.7;">
        <strong>Situação dos códigos (${r.total} item(ns)):</strong><br>
        ${r.semAssociacao} sem associação conhecida · ${r.unica} com associação única · ${r.multipla} com múltiplas possibilidades<br>
        ${r.confirmados} confirmado(s) pelo usuário (código de saída diferente do original) · ${r.mantidosOriginal} com código original mantido na saída
    </div>`;
}

// Reúne os itens que terão o código do XML de saída diferente do original —
// usado tanto no resumo quanto na confirmação final antes de gerar o XML
// (itens 13/14 do pedido).
function calcularAlteracoesCodigoXml() {
    return itensXmlDetectados.filter(item => item.cProdNovo && item.cProdNovo !== item.cProd);
}

// Confirmação final antes de gerar o XML de saída (Salvar NF ou Baixar XML):
// se algum item tiver código de saída diferente do original, mostra
// exatamente "original → escolhido" pra cada um e só prossegue depois de
// confirmação explícita. Sem alterações pendentes, segue direto (não
// introduz atrito pra quem não está usando essa funcionalidade).
function confirmarAlteracoesEExecutar(acao) {
    const alteracoes = calcularAlteracoesCodigoXml();
    if (alteracoes.length === 0) { acao(); return; }
    const linhas = alteracoes.map(item => `• ${item.xProd}: ${item.cProd} → ${item.cProdNovo}${item.possibilidadeEscolhida && item.possibilidadeEscolhida.produtoNome ? ' (' + item.possibilidadeEscolhida.produtoNome + ')' : ''}`).join('\n');
    showConfirmModal({
        title: 'Confirmar códigos antes de gerar o XML',
        message: `${alteracoes.length} item(ns) terão o código alterado na saída, o original continua preservado internamente:\n\n${linhas}\n\nConfirmar e continuar?`,
        confirmText: 'Confirmar e continuar',
        confirmClass: 'success',
        onConfirm: acao
    });
}

function confirmarSelecaoAssociacaoFornecedor(chave) {
    const select = document.getElementById(`assoc-forn-select-${chave}`);
    const codigoSmartCompras = select ? select.value : '';
    if (!codigoSmartCompras) return toast('✕ Selecione um item da cotação antes de confirmar.');
    confirmarAssociacaoFornecedor(chave, codigoSmartCompras);
}

async function confirmarAssociacaoFornecedor(chave, codigoSmartCompras) {
    if (!chave || !codigoSmartCompras || !nfeInfoAtual) return;
    const item = itensXmlDetectados.find(i => chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, i.cProd) === chave);
    if (!item) return;

    const agora = new Date().toISOString();
    const existente = bancoAssociacoesFornecedor[chave];
    const jaEraEssa = existente && existente.codigoSmartCompras === codigoSmartCompras;
    const historico = existente ? [...(existente.historico || [])] : [];
    if (!jaEraEssa) historico.push({ codigoSmartCompras, confirmadoEm: agora, tipo: existente ? 'correcao' : 'confirmacao' });

    try {
        await associacoesFornecedorCollection.doc(chave).set({
            cnpjFornecedor: nfeInfoAtual.cnpjEmit,
            codigoFornecedor: item.cProd,
            codigoSmartCompras,
            nfNumero: nfeInfoAtual.nNF || '',
            confirmadoEm: agora,
            historico
        });
        associacaoFornecedorBuscaAberta.delete(chave);
        toast('✓ Associação com a cotação confirmada.');
    } catch (e) {
        console.error('Erro ao confirmar associação de fornecedor:', e);
        toast('✕ Erro ao associar. Tente novamente.');
    }
}

// Grava o "lado NF" da comparação de 3 fontes (Cotação × NF/XML × ERP),
// automaticamente a cada download — mesmos dados já calculados na tela
// (associação fornecedor→cotação→SP Data, quantidade/valor já com a
// conversão aplicada). Não cria associação nova nenhuma, só um retrato do
// que foi faturado nesta NF especificamente.
async function salvarNfProcessada() {
    if (!nfeInfoAtual || !itensXmlDetectados.length) return;
    const chave = nfeInfoAtual.serie ? `${nfeInfoAtual.nNF}_${nfeInfoAtual.serie}` : nfeInfoAtual.nNF;
    if (!chave) return;

    const itens = itensXmlDetectados.map(item => {
        const chaveAssoc = chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, item.cProd);
        const associacao = bancoAssociacoesFornecedor[chaveAssoc];
        const associacaoSpData = associacao ? listaAssociacoesSpData.find(a => a.codigoSmartCompras === associacao.codigoSmartCompras) : null;
        return {
            cProd: item.cProd,
            xProd: item.xProd,
            codigoSmartCompras: associacao ? associacao.codigoSmartCompras : null,
            codigoSpData: associacaoSpData ? associacaoSpData.spDataCodigo : null,
            quantidade: parseFloat((item.qComOriginal * item.fator).toFixed(4)),
            valorUnitario: parseFloat((item.vUnComOriginal / item.fator).toFixed(4)),
            fatorAplicado: item.fator
        };
    });

    await nfsProcessadasCollection.doc(chave).set({
        nf: nfeInfoAtual.nNF,
        serie: nfeInfoAtual.serie,
        cnpjFornecedor: nfeInfoAtual.cnpjEmit,
        fornecedor: nfeInfoAtual.fornecedor,
        emissao: nfeInfoAtual.emissao,
        valorTotal: nfeInfoAtual.valorTotal,
        pedido: pedidoSelecionadoXml,
        itens,
        processadoEm: new Date().toISOString()
    });
}

// ===================================================================
// --- COMPARAÇÃO DE 3 FONTES: COTAÇÃO × NF/XML × ERP (por pedido) ---
// ===================================================================
// Só leitura/derivação — nenhuma associação nova, nenhuma gravação
// automática de divergência. Casa os itens pelas chaves que já existem:
// codigoSmartCompras (cotação ↔ NF) e codigoSpData (NF ↔ ERP, via
// entradasErp.itens[].codigoSpData e vinculo.pedido).
function compararFontesPedido(pedido) {
    const cotacao = listaCotacoes.find(c => c.pedido === pedido);
    if (!cotacao) return [];

    const nfsDoPedido = listaNfsProcessadas.filter(nf => nf.pedido === pedido);
    const entradasErpDoPedido = listaEntradasErp.filter(e => e.vinculo && e.vinculo.status === 'confirmado' && e.vinculo.pedido === pedido);
    // Só sinaliza "não faturado" quando o pedido já tem alguma NF processada —
    // um pedido que ainda nem começou a ser atendido não é uma divergência,
    // é só um pedido em aberto. E soma TODAS as NFs do pedido antes de
    // concluir que um item ficou faltando (pode vir em outra NF depois).
    const pedidoTemNf = nfsDoPedido.length > 0;

    return (cotacao.itens || []).map(itemCotacao => {
        const nome = itemCotacao.nomeOficial || itemCotacao.descricao || itemCotacao.codProduto;
        const itensNf = nfsDoPedido.flatMap(nf => (nf.itens || [])
            .filter(it => it.codigoSmartCompras === itemCotacao.codProduto)
            .map(it => ({ ...it, nfNumero: nf.nf })));
        const quantidadeFaturada = itensNf.length ? itensNf.reduce((s, it) => s + it.quantidade, 0) : null;
        const valorUnitarioFaturado = itensNf.length ? itensNf[itensNf.length - 1].valorUnitario : null;
        const codigoSpData = itensNf.find(it => it.codigoSpData)?.codigoSpData || null;
        const nfsQueFaturaram = [...new Set(itensNf.map(it => it.nfNumero))];

        const itensErp = codigoSpData ? entradasErpDoPedido.flatMap(e => (e.itens || []).filter(it => it.codigoSpData === codigoSpData)) : [];
        const quantidadeLancada = itensErp.length ? itensErp.reduce((s, it) => s + it.quantidade, 0) : null;

        const divergencias = [];
        if (!itensNf.length) {
            if (pedidoTemNf) {
                divergencias.push({ tipo: 'nao_faturado', nome, quantidadeCotada: itemCotacao.quantidade });
            }
        } else {
            if (Number(itemCotacao.quantidade) !== quantidadeFaturada) {
                divergencias.push({ tipo: 'quantidade_cotada_nf', nome, quantidadeCotada: itemCotacao.quantidade, quantidadeFaturada, nfs: nfsQueFaturaram });
            }
            if (quantidadeLancada !== null && quantidadeLancada !== quantidadeFaturada) {
                divergencias.push({ tipo: 'quantidade_nf_erp', nome, quantidadeFaturada, quantidadeLancada, nfs: nfsQueFaturaram });
            }
            if (valorUnitarioFaturado !== null && itemCotacao.precoUnitario && Math.abs(parseFloat(itemCotacao.precoUnitario) - valorUnitarioFaturado) > 0.005) {
                divergencias.push({ tipo: 'valor_cotado_nf', nome, valorCotado: parseFloat(itemCotacao.precoUnitario), valorFaturado: valorUnitarioFaturado, nfs: nfsQueFaturaram });
            }
        }

        return {
            codProduto: itemCotacao.codProduto,
            cnpjFornecedor: itemCotacao.cnpjFornecedor,
            nome,
            quantidadeCotada: itemCotacao.quantidade,
            quantidadeFaturada, quantidadeLancada,
            temNf: itensNf.length > 0, temErp: itensErp.length > 0,
            nfs: nfsQueFaturaram,
            divergencias
        };
    });
}

// Monta a frase da divergência em linguagem natural (não burocrática), pra
// já entrar pronta no campo de observação da Nova Auditoria — o usuário
// ainda pode editar antes de salvar.
function textoDivergenciaNatural(div) {
    switch (div.tipo) {
        case 'nao_faturado':
            return `O produto ${div.nome} foi incluído na cotação (${div.quantidadeCotada} un.), porém ainda não foi faturado em nenhuma NF já processada deste pedido — pode ser complementado por outra NF.`;
        case 'quantidade_cotada_nf':
            return `Foi pedido ${div.nome} na quantidade de ${div.quantidadeCotada}, porém foi faturado na quantidade de ${div.quantidadeFaturada}${div.nfs && div.nfs.length ? `, pela NF ${div.nfs.join(', ')}` : ''}.`;
        case 'quantidade_nf_erp':
            return `${div.nome} foi faturado com quantidade ${div.quantidadeFaturada}${div.nfs && div.nfs.length ? ` (NF ${div.nfs.join(', ')})` : ''}, mas foi lançado no ERP com quantidade ${div.quantidadeLancada}.`;
        case 'valor_cotado_nf':
            return `${div.nome} foi cotado a R$ ${div.valorCotado.toFixed(2)}, porém foi faturado a R$ ${div.valorFaturado.toFixed(2)}${div.nfs && div.nfs.length ? ` (NF ${div.nfs.join(', ')})` : ''}.`;
        default:
            return `Divergência em ${div.nome}.`;
    }
}

// ===================================================================
// --- FASE 11: APTIDÃO PARA SAÍDA (só leitura — nada é persistido aqui) ---
// ===================================================================
// Cruza a nota financeira (notasCollection) com o que a Entrada Segura e a
// Auditoria já sabem, pra dizer "está apta ou não, e por quê" — sem criar
// nenhum campo/coleção nova e sem bloquear nada (a seleção de fato pra
// repasse é a Fase 12). Reaproveita compararFontesPedido (mesma fonte da
// Central do Pedido/Auditoria) e listaAnotacoes (Fase 10).
//
// Nunca decide por aproximação: só liga a nota à NF processada quando o
// número da NF bate (normalizado, igual à regra já usada em
// verificarDuplicidade) — e, quando a nota veio da pré-seleção do ERP
// (entradaVinculada), também exige o mesmo CNPJ, pra nunca cruzar com a NF
// errada de outro fornecedor que por acaso tenha o mesmo número.
// Calcula a aptidão pra saída de uma nota (Fase 11) e, junto, os dados
// complementares que a Fase 12 (seleção pra saída/repasse) precisa mostrar
// pra decisão — pedido, CNPJ, destino e recurso(s) — sempre reaproveitando
// os mesmos dados já resolvidos aqui dentro (nfProcessada/cotação), nunca
// uma segunda consulta/lógica paralela. Quando um dado não é conhecido,
// fica ausente/null — a tela mostra "não informado", nunca adivinha.
function calcularAptidaoSaidaNota(nota) {
    const normalize = (str) => str ? str.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
    if (!normalize(nota.nf)) return { status: 'sem_nf', label: 'Sem número de NF — não é possível conferir', badge: 'neutro' };
    const nfNormalizada = normalize(nota.nf);

    // Se esta nota nasceu da pré-seleção do ERP, já sabemos o CNPJ — usa
    // isso pra achar a NF processada certa sem ambiguidade.
    const entradaVinculada = listaEntradasErp.find(e => e.notaVinculadaId === nota.id);
    const cnpjConhecido = entradaVinculada ? entradaVinculada.cnpjFornecedor : null;

    const candidatas = listaNfsProcessadas.filter(nf => normalize(nf.nf) === nfNormalizada && (!cnpjConhecido || nf.cnpjFornecedor === cnpjConhecido));

    if (candidatas.length === 0) {
        return { status: 'nao_conferida', label: 'Ainda não passou pela Entrada Segura (XML/NF)', badge: 'neutro', cnpjFornecedor: cnpjConhecido || null };
    }
    if (candidatas.length > 1) {
        return { status: 'ambigua', label: 'Mais de uma NF processada com este número — confira manualmente', badge: 'neutro' };
    }

    const nfProcessada = candidatas[0];
    if (!nfProcessada.pedido) {
        return { status: 'sem_pedido', label: 'Conferida, mas sem pedido/cotação vinculado', badge: 'neutro', cnpjFornecedor: nfProcessada.cnpjFornecedor || null };
    }

    const cotacao = listaCotacoes.find(c => c.pedido === nfProcessada.pedido);
    const codigosDestaNf = (nfProcessada.itens || []).map(it => it.codigoSmartCompras).filter(Boolean);
    const destino = cotacao ? (cotacao.origem || null) : null;
    const recursos = cotacao ? [...new Set(codigosDestaNf.map(cod => (cotacao.recursosPorItem || {})[cod]).filter(Boolean))] : [];
    const base = { pedido: nfProcessada.pedido, cnpjFornecedor: nfProcessada.cnpjFornecedor || null, destino, recursos };

    const divergenciasDestaNf = compararFontesPedido(nfProcessada.pedido)
        .filter(item => codigosDestaNf.includes(item.codProduto))
        .flatMap(item => item.divergencias);

    if (divergenciasDestaNf.length === 0) {
        return { status: 'apta', label: '✓ Conferida — sem divergência com a cotação/ERP', badge: 'pronto', ...base };
    }

    // Há divergência — mas isso não é "não apta" por si só (o documento é
    // explícito: divergência pode só exigir registro). Só distingue se já
    // foi registrada em auditoria e se essa auditoria ainda está pendente.
    const anotacao = listaAnotacoes.find(a => a.pedido === nfProcessada.pedido);
    const temDivergenciaPendente = anotacao && (anotacao.ocorrencias || []).some(oc => (oc.divergencias || []).some(d => d.status === 'pendente'));

    if (temDivergenciaPendente) {
        return { status: 'auditoria_pendente', label: '⚠ Divergência registrada em auditoria, ainda pendente', badge: 'pendente', ...base };
    }
    if (anotacao) {
        return { status: 'divergencia_com_auditoria_resolvida', label: 'Divergência já registrada e resolvida em auditoria', badge: 'pronto', ...base };
    }
    return { status: 'divergencia_sem_auditoria', label: '⚠ Divergência com a cotação/ERP — ainda sem auditoria registrada', badge: 'pendente', ...base };
}

// Comparação Cotação × NF × ERP, só os itens deste fornecedor — embutida
// dentro do card do fornecedor na Central do Pedido (não é mais uma seção
// separada). Só aparece quando há algo relevante pra mostrar (item já
// faturado/lançado, ou item pendente de faturamento quando o pedido já tem
// alguma NF processada).
function renderComparacaoFornecedorHTML(pedido, cnpjFornecedor) {
    const itens = compararFontesPedido(pedido).filter(item => item.cnpjFornecedor === cnpjFornecedor && (item.temNf || item.temErp || item.divergencias.length));
    if (itens.length === 0) return '<div class="central-item-vazio">Nenhuma NF processada ainda pra este fornecedor neste pedido.</div>';

    return itens.map(item => {
        const statusHTML = item.divergencias.length
            ? `<span class="xml-item-badge pendente">⚠ ${item.divergencias.length} diverg.</span>`
            : `<span class="xml-item-badge pronto">✓ Confere</span>`;
        const fontesHTML = `Cotado: ${item.quantidadeCotada ?? '—'} · Faturado (NF): ${item.quantidadeFaturada ?? '—'} · Lançado (ERP): ${item.quantidadeLancada ?? '—'}`;
        return `<div class="xml-item-linha ${item.divergencias.length ? 'pendente' : ''}">
            <div class="xml-item-topo">
                <div class="xml-produto-nome">${item.nome}</div>
                ${statusHTML}
            </div>
            <div class="xml-item-meta">${fontesHTML}</div>
            ${item.divergencias.length ? `<div class="xml-item-cotacao">${item.divergencias.map(d => '• ' + textoDivergenciaNatural(d)).join('<br>')}</div>
            <div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="registrarDivergenciaDaComparacao('${pedido}', '${item.codProduto}')">Gerar auditoria</button></div>` : ''}
        </div>`;
    }).join('');
}

// Mapa entre os tipos internos de compararFontesPedido e os tipos
// estruturados que JÁ EXISTEM em TIPOS_DIVERGENCIA_AUDITORIA — nunca cria um
// tipo novo, só liga o que os dois lados já têm. 'quantidade_nf_erp' fica
// de fora de propósito: é uma comparação NF×ERP, não cotado×faturado, e
// nenhum tipo estruturado atual descreve isso com precisão — forçar um
// rótulo errado seria pior do que deixar 'outro' com o texto natural, que é
// exatamente a situação em que o usuário deve escolher/reclassificar.
const MAPA_TIPO_DIVERGENCIA_COMPARACAO = {
    'nao_faturado': 'nao_faturado',
    'quantidade_cotada_nf': 'quantidade_diferente',
    'valor_cotado_nf': 'valor_diferente'
};

// Monta os campos do material estruturado a partir da divergência já
// calculada pela comparação — usa só o que a comparação já apurou
// (quantidade cotada/faturada, valor cotado/faturado), nunca inventa dado.
function camposMaterialDivergencia(tipoEstruturado, item, div) {
    const campos = { produto: item.nome };
    if (tipoEstruturado === 'nao_faturado') {
        campos.quantidade = div.quantidadeCotada;
    } else if (tipoEstruturado === 'quantidade_diferente') {
        campos.quantidadeCotada = div.quantidadeCotada;
        campos.quantidadeFaturada = div.quantidadeFaturada;
    } else if (tipoEstruturado === 'valor_diferente') {
        campos.quantidade = div.quantidadeFaturada != null ? div.quantidadeFaturada : div.quantidadeCotada;
        campos.valorCotado = div.valorCotado != null ? div.valorCotado.toFixed(2) : '';
        campos.valorFaturado = div.valorFaturado != null ? div.valorFaturado.toFixed(2) : '';
    }
    return campos;
}

// Abre a Nova Auditoria (já existente) já com pedido, fornecedor e a(s)
// divergência(s) pré-preenchida(s) — nunca grava sozinho, só prepara o
// rascunho; o usuário confere, ajusta se quiser, e salva como sempre fez.
//
// Ponto 1 desta atualização: cada divergência agora nasce com o TIPO
// ESTRUTURADO correto (NÃO FATURADO, QUANTIDADE DIFERENTE, VALOR DIFERENTE)
// sempre que a comparação já der evidência suficiente pra isso — nunca cai
// em "Outro" como padrão. Quando duas divergências de tipos diferentes
// existem no mesmo pedido, cada uma vira um card estruturado separado (nunca
// mistura tipos no mesmo card); quando o mesmo tipo se repete em itens
// diferentes, entram como materiais adicionais do MESMO card (é assim que a
// estrutura de "multiMaterial" já existente foi desenhada pra funcionar).
//
// Fase 10: se já existe um rascunho aberto pro MESMO pedido (usuário clicou
// "Gerar auditoria" em mais de um item divergente da mesma NF/pedido), a
// nova divergência é ACRESCENTADA ao rascunho em vez de abrirNovaAuditoria()
// resetar tudo. Só abre/limpa quando é de fato um pedido diferente do que já
// estava sendo preenchido.
function registrarDivergenciaDaComparacao(pedido, codProduto) {
    const item = compararFontesPedido(pedido).find(i => i.codProduto === codProduto);
    const cotacao = listaCotacoes.find(c => c.pedido === pedido);
    if (!item || !cotacao) return;
    const fornecedor = (cotacao.fornecedores || []).find(f => f.cnpj === item.cnpjFornecedor);

    const telaJaAberta = document.getElementById('screen-auditoria-nova').classList.contains('active');
    const mesmoPedidoNoRascunho = telaJaAberta && document.getElementById('aud-pedido').value.trim() === pedido;

    if (!mesmoPedidoNoRascunho) {
        abrirNovaAuditoria();
        document.getElementById('aud-pedido').value = pedido;
        buscarCotacaoParaAuditoria();
        if (fornecedor) document.getElementById('aud-fornecedor').value = nomeExibicaoFornecedor(fornecedor.razaoSocial, fornecedor.cnpj);
    }

    // NF: acumula números diferentes em vez de sobrescrever — o mesmo
    // pedido pode ter mais de uma NF, e a divergência de um item pode citar
    // uma NF diferente da do item anterior já preparado.
    if (item.nfs && item.nfs.length) {
        const campoNf = document.getElementById('aud-nf');
        const nfsAtuais = campoNf.value.split(',').map(s => s.trim()).filter(Boolean);
        campoNf.value = [...new Set([...nfsAtuais, ...item.nfs])].join(', ');
    }

    // Recurso do item (quando já confirmado na entrada da NF) — reaproveita
    // cotacao.recursosPorItem, nunca inventa nem pede de novo aqui.
    const recurso = (cotacao.recursosPorItem || {})[codProduto];
    let algumaMudanca = false;

    item.divergencias.forEach(div => {
        const tipoEstruturado = MAPA_TIPO_DIVERGENCIA_COMPARACAO[div.tipo];

        if (!tipoEstruturado) {
            // Sem tipo estruturado que bata de verdade com essa evidência —
            // fica em "Outro" com o texto natural, editável e reclassificável
            // manualmente. Isso não é usar "Outro" como padrão: é o caso
            // explícito em que não há categoria certa pra forçar.
            const textoDivergencia = textoDivergenciaNatural(div) + (recurso ? ` (Recurso: ${recurso})` : '');
            const jaExisteOutro = divergenciasAuditoria.some(d => d.tipo === 'outro' && d.campos && d.campos.produto === item.nome && d.observacao === textoDivergencia);
            if (!jaExisteOutro) {
                divergenciasAuditoria.forEach(d => d.aberto = false);
                divergenciasAuditoria.push({ id: ++contadorDivergenciaId, tipo: 'outro', aberto: true, materiais: [], observacao: textoDivergencia, campos: { produto: item.nome } });
                algumaMudanca = true;
            }
            return;
        }

        // Um card por tipo estruturado — acumula materiais, nunca mistura
        // tipos diferentes no mesmo card, nunca duplica o mesmo produto
        // dentro do mesmo tipo.
        const novosCampos = camposMaterialDivergencia(tipoEstruturado, item, div);
        let card = divergenciasAuditoria.find(d => d.tipo === tipoEstruturado);
        if (!card) {
            card = { id: ++contadorDivergenciaId, tipo: tipoEstruturado, aberto: true, materiais: [], observacao: '', campos: {} };
            divergenciasAuditoria.forEach(d => d.aberto = false);
            divergenciasAuditoria.push(card);
            algumaMudanca = true;
        }
        const materialExistente = card.materiais.find(m => m.campos.produto === item.nome);
        if (materialExistente) {
            Object.assign(materialExistente.campos, novosCampos);
        } else {
            card.materiais.push({ id: ++contadorMaterialId, campos: novosCampos });
            algumaMudanca = true;
        }
        const linhaRecurso = recurso ? `Recurso ${item.nome}: ${recurso}` : null;
        if (linhaRecurso && !card.observacao.includes(linhaRecurso)) {
            card.observacao = (card.observacao ? card.observacao + '\n' : '') + linhaRecurso;
        }
    });

    renderDivergenciasAuditoria();
    switchToScreen('screen-auditoria-nova', 'Nova Auditoria');
    toast(mesmoPedidoNoRascunho
        ? (algumaMudanca ? '✓ Divergência acrescentada ao rascunho, já classificada.' : 'Essa divergência já estava no rascunho.')
        : 'Divergência pré-preenchida e classificada a partir da comparação — confira e salve.');
}

// Extrai a aplicação de fator/unidade no DOM do XML em memória, separada de
// "salvar" e "baixar" — as duas ações precisam do XML corrigido, mas só
// Salvar grava o histórico (nfsProcessadas). Reaproveita os mesmos valores
// originais (qComOriginal etc.), então chamar de novo é seguro/idempotente.
function aplicarConversaoNoXmlDom() {
    const unidadeDestino = document.getElementById('xml-unidade-destino').value.trim() || 'UN';
    const excecoesParaSalvar = {};

    itensXmlDetectados.forEach(item => {
        const fator = item.fator;
        if (item.cProdNovo && item.cProdNovo !== item.cProd) {
            const cProdEl = item.prod.getElementsByTagName('cProd')[0];
            if (cProdEl) cProdEl.textContent = item.cProdNovo;
        }
        if (fator !== 1) {
            item.qComEl.textContent = (item.qComOriginal * fator).toFixed(4);
            item.vUnComEl.textContent = (item.vUnComOriginal / fator).toFixed(7);
            item.qTribEl.textContent = (item.qTribOriginal * fator).toFixed(4);
            item.vUnTribEl.textContent = (item.vUnTribOriginal / fator).toFixed(7);
            item.rastros.forEach(r => { r.qLoteEl.textContent = (r.qLoteOriginal * fator).toFixed(3); });
        }
        // Salva a exceção quando o fator não é 1 (comportamento já existente)
        // OU quando o item começou suspeito e foi confirmado — mesmo que a
        // confirmação tenha mantido o fator em 1 (Caso A: "é 1:1 mesmo",
        // sem isso a próxima NF desse fornecedor/produto voltaria a pedir
        // confirmação de novo, o que contraria a reutilização do que já foi
        // conferido).
        if (fator !== 1 || item.suspeitoOriginal) {
            excecoesParaSalvar[item.chaveExcecao] = fator;
        }
        item.uComEl.textContent = unidadeDestino;
        item.uTribEl.textContent = unidadeDestino;
    });

    return excecoesParaSalvar;
}

async function salvarExcecoesConversao(excecoesParaSalvar) {
    try {
        await Promise.all(Object.entries(excecoesParaSalvar).map(([chave, fator]) =>
            xmlExcecoesCollection.doc(chave).set({ fator, atualizadoEm: new Date().toISOString() }, { merge: true })
        ));
    } catch (e) { console.error('Erro ao salvar exceções de XML:', e); }
}

// Gate de pendências, reaproveitado tanto por Salvar quanto por Baixar — não
// avança silenciosamente com pendência impeditiva, avisa exatamente o que
// falta. Uma NF já totalmente resolvida segue direto, sem burocracia extra.
// Fase 9: só bloqueia mesmo quando há BLOQUEIO real (ver
// calcularResumoPendenciasXml) — usado tanto por "Salvar NF" quanto por
// "Baixar XML", já que os dois gravam/derivam a partir dos mesmos dados
// (fator de conversão, código de saída).
function verificarBloqueioEAvisar() {
    const resumo = calcularResumoPendenciasXml();
    if (resumo && !resumo.podeSalvar) {
        showConfirmModal({
            title: 'NF ainda possui pendências que impedem continuar',
            message: `Esta NF tem ${resumo.bloqueios.length} pendência(s) que precisam ser resolvidas antes:\n${resumo.bloqueios.map(p => '• ' + p).join('\n')}\n\nResolva na seção "Itens da NF" antes de continuar.`,
            confirmText: 'Entendi',
            confirmClass: 'warning',
            onConfirm: () => {}
        });
        return false;
    }
    return true;
}

// "Salvar NF" é a ação principal que conclui o processamento — grava
// nfsProcessadas (o "lado NF" da comparação de 3 fontes) e as exceções de
// conversão, e mostra na hora se há divergência com a cotação/ERP. Baixar o
// XML fica como ação independente (ver baixarXmlConvertido), pra quando o
// arquivo realmente precisa ser gerado — não é mais obrigatório baixar só
// pra salvar o processamento.
//
// Fase 9: bloqueio real (ver verificarBloqueioEAvisar) impede continuar.
// Alerta (não-bloqueante) sempre pede confirmação explícita antes de
// salvar — nunca salva silenciosamente por trás de uma pendência que o
// usuário talvez não tenha notado, mas também nunca impede quem já
// decidiu que quer salvar assim mesmo e resolver o resto depois.
async function salvarEntradaNF() {
    if (!xmlDocAtual) return;
    if (!verificarBloqueioEAvisar()) return;
    const resumo = calcularResumoPendenciasXml();
    if (resumo && resumo.alertas.length > 0) {
        showConfirmModal({
            title: 'Salvar mesmo com alerta(s)?',
            message: `Esta NF tem ${resumo.alertas.length} alerta(s) que não impedem salvar, mas merecem atenção:\n${resumo.alertas.map(p => '• ' + p).join('\n')}\n\nPode ser resolvido depois. Deseja salvar assim mesmo?`,
            confirmText: 'Salvar assim mesmo',
            confirmClass: 'warning',
            onConfirm: () => confirmarAlteracoesEExecutar(executarSalvarEntradaNF)
        });
        return;
    }
    confirmarAlteracoesEExecutar(executarSalvarEntradaNF);
}

async function executarSalvarEntradaNF() {
    const excecoes = aplicarConversaoNoXmlDom();
    await salvarExcecoesConversao(excecoes);

    try {
        await salvarNfProcessada();
    } catch (e) {
        console.error('Erro ao salvar NF processada:', e);
        toast('✕ Erro ao salvar a NF. Tente novamente.');
        return;
    }

    // Cadastro automático por CNPJ (não bloqueia o salvamento da NF se falhar).
    if (nfeInfoAtual) await garantirFornecedorPorCnpjXml(nfeInfoAtual.cnpjEmit, nfeInfoAtual.fornecedor);

    renderResultadoSalvarNF();
    renderSugestaoRecursoNf();
    toast('✓ NF salva.');
}

// Mostra, direto na Entrada de NF (sem trocar de tela), o resultado da
// comparação Cotação × NF × ERP só pros itens desta NF — reaproveita
// compararFontesPedido/textoDivergenciaNatural, os mesmos usados na Central
// do Pedido. "Gerar auditoria" só prepara o rascunho, nunca salva sozinho.
function renderResultadoSalvarNF() {
    const el = document.getElementById('xml-resultado-salvar');
    if (!el) return;
    if (!pedidoSelecionadoXml || !nfeInfoAtual) { el.style.display = 'none'; return; }

    const codigosDestaNf = itensXmlDetectados
        .map(item => bancoAssociacoesFornecedor[chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, item.cProd)])
        .filter(Boolean)
        .map(a => a.codigoSmartCompras);

    const comparacao = compararFontesPedido(pedidoSelecionadoXml).filter(item => codigosDestaNf.includes(item.codProduto));
    if (comparacao.length === 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';

    const temDivergencia = comparacao.some(item => item.divergencias.length > 0);
    const cabecalho = `<div class="xml-estado-card ${temDivergencia ? 'pendente' : 'pronto'}"><div class="xml-estado-linha">${
        temDivergencia
            ? '<span class="xml-item-badge pendente">⚠ Divergência com a cotação/ERP</span>'
            : '<span class="xml-item-badge pronto">✓ Confere com a cotação/ERP</span>'
    }</div></div>`;

    const itensComDivergencia = comparacao.filter(item => item.divergencias.length > 0).map(item => `<div class="xml-item-linha pendente">
        <div class="xml-item-topo"><div class="xml-produto-nome">${item.nome}</div></div>
        <div class="xml-item-cotacao">${item.divergencias.map(d => '• ' + textoDivergenciaNatural(d)).join('<br>')}</div>
        <div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="registrarDivergenciaDaComparacao('${pedidoSelecionadoXml}', '${item.codProduto}')">Gerar auditoria</button></div>
    </div>`).join('');

    el.innerHTML = cabecalho + itensComDivergencia;
}

// ===== Determinação assistida de recurso (correção conceitual da Fase 7) =====
// O recurso NÃO é mais escolhido item a item dentro da cotação. A cotação
// não sabe quantas NFs vão sair dela; quem sabe é a NF/XML que está
// entrando agora. Por isso a sugestão/confirmação acontece aqui, no
// salvamento da NF — reaproveitando sugerirRecursoPorHistorico (já existia
// na Fase 7, só não era chamado neste ponto) e gravando no MESMO lugar de
// sempre (cotacao.recursosPorItem), nunca uma estrutura nova. Sem IA, sem
// fuzzy matching: a única fonte é o histórico de recursosPorItem já
// confirmado noutras cotações pro mesmo código SmartCompras. Sem esse
// histórico, o sistema não chuta — mostra que não conseguiu determinar e
// deixa a escolha manual como exceção, não como fluxo principal.
function renderSugestaoRecursoNf() {
    const el = document.getElementById('xml-sugestao-recurso');
    if (!el) return;
    if (!pedidoSelecionadoXml || !nfeInfoAtual) { el.style.display = 'none'; return; }

    const cotacao = listaCotacoes.find(c => c.pedido === pedidoSelecionadoXml);
    if (!cotacao) { el.style.display = 'none'; return; }

    const codigosDestaNf = [...new Set(itensXmlDetectados
        .map(item => bancoAssociacoesFornecedor[chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, item.cProd)])
        .filter(Boolean)
        .map(a => a.codigoSmartCompras))];

    // Só os itens desta NF que ainda não têm recurso confirmado — um item
    // já confirmado (nesta ou numa NF anterior do mesmo pedido) não volta a
    // pedir decisão de novo.
    const pendentes = codigosDestaNf.filter(codigo => !(cotacao.recursosPorItem || {})[codigo]);
    if (pendentes.length === 0) { el.style.display = 'none'; return; }

    if (!cotacao.origem) {
        el.style.display = 'block';
        el.innerHTML = `<div class="xml-estado-card pendente"><div class="xml-estado-linha">⚠ Defina a Origem (Santa Casa/CTI) desta cotação (${escRel(cotacao.pedido)}) pra poder confirmar o recurso dos itens.</div></div>`;
        return;
    }

    el.style.display = 'block';
    const linhasHTML = pendentes.map(codigo => {
        const itemCotacao = (cotacao.itens || []).find(it => it.codProduto === codigo);
        const nome = itemCotacao ? (itemCotacao.nomeOficial || itemCotacao.descricao || codigo) : codigo;
        const sugestao = sugerirRecursoPorHistorico(codigo, pedidoSelecionadoXml);
        const ccOficial = calcularRecursoOficial(cotacao.origem, 'cc');
        const proprioOficial = calcularRecursoOficial(cotacao.origem, 'proprio');
        const sugestaoHTML = sugestao
            ? `<div class="xml-item-cotacao">💡 Sugestão com base no histórico (usado ${sugestao.totalOcorrencias}x pra este código, mais recente no pedido ${escRel(sugestao.pedidoMaisRecente)}): <strong>${escRel(sugestao.recursoMaisRecente)}</strong></div>
               <div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="aplicarRecursoSugerido('${escRel(pedidoSelecionadoXml)}','${escRel(codigo)}','${escRel(sugestao.recursoMaisRecente)}')">Confirmar sugestão</button></div>`
            : `<div class="xml-item-cotacao"><em>Não foi possível determinar com segurança — sem histórico pra este código. Confirme manualmente:</em></div>`;
        return `<div class="xml-item-linha pendente">
            <div class="xml-item-topo"><div class="xml-produto-nome">${escRel(upAud(nome))}</div></div>
            ${sugestaoHTML}
            <div class="xml-item-acao">
                <button type="button" class="central-status-toggle" onclick="definirRecursoItem('${escRel(pedidoSelecionadoXml)}','${escRel(codigo)}','cc')">${escRel(ccOficial)}</button>
                <button type="button" class="central-status-toggle" onclick="definirRecursoItem('${escRel(pedidoSelecionadoXml)}','${escRel(codigo)}','proprio')">${escRel(proprioOficial)}</button>
            </div>
        </div>`;
    }).join('');

    el.innerHTML = `<div class="xml-diff-titulo">Recurso pendente de confirmação (${pendentes.length} item(ns) desta NF)</div>${linhasHTML}`;
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
    const itensFiltrados = fornMatch ? itens.filter(it => it.cnpjFornecedor === fornMatch.cnpj) : itens;

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

// --- Divergências (cards em acordeão) ---
let contadorMaterialId = 0;
function adicionarDivergencia() {
    divergenciasAuditoria.forEach(d => d.aberto = false);
    divergenciasAuditoria.push({ id: ++contadorDivergenciaId, tipo: '', aberto: true, materiais: [], observacao: '', campos: {} });
    renderDivergenciasAuditoria();
}
function removerDivergencia(id) {
    divergenciasAuditoria = divergenciasAuditoria.filter(d => d.id !== id);
    renderDivergenciasAuditoria();
}
function toggleDivergencia(id) {
    const d = divergenciasAuditoria.find(d => d.id === id);
    d.aberto = !d.aberto;
    renderDivergenciasAuditoria();
}
function mudarTipoDivergencia(id, tipo) {
    const d = divergenciasAuditoria.find(d => d.id === id);
    d.tipo = tipo;
    d.campos = {};
    d.observacao = '';
    const def = TIPOS_DIVERGENCIA_AUDITORIA[tipo];
    d.materiais = (def && def.multiMaterial) ? [{ id: ++contadorMaterialId, campos: {} }] : [];
    renderDivergenciasAuditoria();
}
// Campos de ocorrência única (só usado por tipos com multiMaterial:false,
// ex: "Fornecedor não entregou o pedido" — não faz sentido por material).
function atualizarCampoDivergencia(id, key, valor, maiusculo) {
    const d = divergenciasAuditoria.find(d => d.id === id);
    d.campos[key] = maiusculo ? upAud(valor) : valor;
}
function atualizarCampoDivergenciaCheckbox(id, key, checked) {
    const d = divergenciasAuditoria.find(d => d.id === id);
    d.campos[key] = checked;
}
function atualizarObservacaoOcorrencia(id, valor) {
    const d = divergenciasAuditoria.find(d => d.id === id);
    d.observacao = valor;
}

// --- Materiais dentro de uma mesma ocorrência de divergência ---
function adicionarMaterialDivergencia(divergenciaId) {
    const d = divergenciasAuditoria.find(d => d.id === divergenciaId);
    if (!d) return;
    d.materiais.push({ id: ++contadorMaterialId, campos: {} });
    renderDivergenciasAuditoria();
}
function removerMaterialDivergencia(divergenciaId, materialId) {
    const d = divergenciasAuditoria.find(d => d.id === divergenciaId);
    if (!d) return;
    d.materiais = d.materiais.filter(m => m.id !== materialId);
    renderDivergenciasAuditoria();
}
function atualizarCampoMaterial(divergenciaId, materialId, key, valor, maiusculo) {
    const d = divergenciasAuditoria.find(d => d.id === divergenciaId);
    if (!d) return;
    const m = d.materiais.find(m => m.id === materialId);
    if (!m) return;
    m.campos[key] = maiusculo ? upAud(valor) : valor;

    // Item 12: se o produto digitado bate com um item da cotação encontrada
    // pro pedido, preenche a quantidade automaticamente — só se o campo
    // ainda estiver vazio, pra nunca sobrescrever uma correção manual.
    if (key === 'produto' || key === 'produtoPedido') {
        preencherQuantidadeDaCotacao(m, valor);
        renderDivergenciasAuditoria();
    }
}
function preencherQuantidadeDaCotacao(material, nomeProduto) {
    if (!cotacaoEncontradaAuditoria || material.campos.quantidade) return;
    const alvo = upAud(nomeProduto).trim();
    if (!alvo) return;
    const item = (cotacaoEncontradaAuditoria.itens || []).find(it => upAud(nomeConhecidoItemCotacao(it)) === alvo);
    if (item && item.quantidade) material.campos.quantidade = item.quantidade;
}
function renderDivergenciasAuditoria() {
    const container = document.getElementById('lista-divergencias');
    if (divergenciasAuditoria.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhuma divergência adicionada ainda.</div>';
        return;
    }
    container.innerHTML = divergenciasAuditoria.map((d, idx) => {
        const def = TIPOS_DIVERGENCIA_AUDITORIA[d.tipo];
        const primeiroProduto = def && d.materiais && d.materiais[0] ? (d.materiais[0].campos.produto || d.materiais[0].campos.produtoFaturado) : (d.campos && (d.campos.produto || d.campos.fornecedorNome));
        const sufixoQtd = def && d.materiais && d.materiais.length > 1 ? ` (+${d.materiais.length - 1})` : '';
        const tituloTexto = def
            ? `${def.label}${primeiroProduto ? ' — ' + upAud(primeiroProduto) + sufixoQtd : ''}`
            : '<span style="color:var(--text-light);font-weight:400;">Selecione o tipo...</span>';
        const opcoesTipo = Object.entries(TIPOS_DIVERGENCIA_AUDITORIA).map(([key, val]) =>
            `<option value="${key}" ${d.tipo === key ? 'selected' : ''}>${val.label}</option>`).join('');

        const renderCampo = (c, valor, onBlurAttr) => {
            const listaAttr = (c.key === 'produto' || c.key === 'produtoPedido' || c.key === 'produtoFaturado') ? ' list="datalist-produtos-cotacao"' : '';
            const labelTexto = c.obrigatorio ? `${c.label} *` : c.label;
            if (c.textarea) {
                return `<div class="campo"><label>${labelTexto}</label><textarea class="form-field" ${onBlurAttr}>${valor}</textarea></div>`;
            }
            return `<div class="campo"><label>${labelTexto}</label><input type="text" class="form-field ${c.maiusculo ? 'uppercase-field' : ''}" placeholder="${c.placeholder || ''}" value="${valor}"${listaAttr} ${onBlurAttr}></div>`;
        };

        let corpoCampos = '';
        if (def && def.multiMaterial) {
            const materiaisHTML = (d.materiais || []).map((m, midx) => {
                const camposMaterial = def.campos.map(c => {
                    const valor = m.campos[c.key] || '';
                    const onBlurAttr = `onblur="atualizarCampoMaterial(${d.id}, ${m.id}, '${c.key}', this.value, ${!!c.maiusculo})"`;
                    return renderCampo(c, valor, onBlurAttr);
                }).join('');
                return `<div class="material-divergencia">
                    <div class="material-divergencia-header">
                        <span>Material ${midx + 1}</span>
                        ${d.materiais.length > 1 ? `<button type="button" class="divergencia-del" onclick="removerMaterialDivergencia(${d.id}, ${m.id})"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </div>
                    ${camposMaterial}
                </div>`;
            }).join('');
            corpoCampos = `${materiaisHTML}
                <div class="actions-row"><button type="button" class="actions-button is-neutral" onclick="adicionarMaterialDivergencia(${d.id})"><span class="icon-wrapper"><i class="fa-solid fa-plus"></i></span> Adicionar Material</button></div>
                <div class="campo"><label>Observação da Ocorrência (opcional)</label><textarea class="form-field" onblur="atualizarObservacaoOcorrencia(${d.id}, this.value)">${d.observacao || ''}</textarea></div>`;
        } else if (def) {
            corpoCampos = def.campos.map(c => {
                const valor = d.campos[c.key] || '';
                const onBlurAttr = `onblur="atualizarCampoDivergencia(${d.id}, '${c.key}', this.value, ${!!c.maiusculo})"`;
                return renderCampo(c, valor, onBlurAttr);
            }).join('');
        }

        return `
        <div class="divergencia ${d.aberto ? 'open' : ''}">
            <div class="divergencia-header" onclick="toggleDivergencia(${d.id})">
                <div class="divergencia-num">${idx + 1}</div>
                <div class="divergencia-titulo">${tituloTexto}</div>
                <i class="fa-solid fa-chevron-down divergencia-chevron"></i>
                <button type="button" class="divergencia-del" onclick="event.stopPropagation(); removerDivergencia(${d.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="divergencia-body">
                <div class="divergencia-body-inner">
                    <div class="campo">
                        <label>Tipo de Divergência</label>
                        <select class="form-field" onchange="mudarTipoDivergencia(${d.id}, this.value)" onclick="event.stopPropagation()">
                            <option value="">Selecione...</option>${opcoesTipo}
                        </select>
                    </div>
                    ${corpoCampos}
                </div>
            </div>
        </div>`;
    }).join('');

    // Correção do bug em que uma divergência com muitos materiais ficava
    // cortada: a animação de abrir/fechar usa max-height no CSS, mas um
    // valor fixo nunca acompanha corretamente uma lista de materiais que
    // cresce (Adicionar Material) ou encolhe (Remover Material). Aqui,
    // depois de desenhar, cada divergência aberta recebe o max-height do seu
    // próprio tamanho real (scrollHeight) — funciona com qualquer
    // quantidade de materiais, sem depender de adivinhar um teto.
    requestAnimationFrame(() => {
        container.querySelectorAll('.divergencia.open .divergencia-body').forEach(el => {
            el.style.maxHeight = el.scrollHeight + 'px';
        });
    });
}

// ============================================================
// COTAÇÕES — Fase 3: cadastro manual (Pedido, Origem, datas e
// fornecedores). Doc id no Firestore = o próprio número do pedido, pra
// permitir buscar por pedido sem query (útil na Fase 5, quando a Auditoria
// vai consultar isso automaticamente). O array `itens` fica reservado —
// ainda vazio nesta fase — pra ser populado pela importação do XML do
// SmartCompras na Fase 4, sem precisar migrar o formato do documento.
// ============================================================

const ORIGENS_COTACAO = ['Santa Casa', 'CTI'];

let filtroCotacoesTexto = '';
let ordenacaoCotacoes = 'entrada'; // 'entrada' (padrão, mais recente primeiro) ou 'pedido' (numérico)

function filtrarCotacoes(texto) {
    filtroCotacoesTexto = texto;
    renderListaCotacoes();
}
function alternarOrdenacaoCotacoes(valor) {
    ordenacaoCotacoes = valor;
    renderListaCotacoes();
}

// Cotação "bate" na pesquisa se o termo aparecer em qualquer um dos campos
// estruturados de identificação do produto já existentes em cotacao.itens.
// Retorna os itens correspondentes (não só um booleano) porque o resultado
// da pesquisa passou a mostrar o item encontrado diretamente, não só a
// cotação. Busca 100% local em listaCotacoes — sem consulta ao Firestore a
// cada tecla, sem fuzzy matching, só correspondência textual parcial.
function itensCorrespondentesCotacao(cotacao, termo) {
    return (cotacao.itens || []).filter(it =>
        (it.nomeOficial || '').toUpperCase().includes(termo) ||
        (it.descricao || '').toUpperCase().includes(termo) ||
        (it.fabricante || '').toUpperCase().includes(termo) ||
        (it.embalagem || '').toUpperCase().includes(termo) ||
        (it.codProduto || '').toUpperCase().includes(termo)
    );
}

function renderCardCotacao(c) {
    const qtdFornecedores = (c.fornecedores || []).length;
    const dataLimite = c.dataLimite ? formatarDataBRSimples(c.dataLimite) : '';
    return `<div class="nota-item" onclick="abrirCentralPedido('${c.pedido}')">
        <div class="nota-info">${c.pedido}${c.origem ? ' - ' + c.origem : ''}</div>
        <div class="nota-detalhes">${qtdFornecedores} fornecedor${qtdFornecedores === 1 ? '' : 'es'}${dataLimite ? ' · Limite: ' + dataLimite : ''}</div>
    </div>`;
}

// Resultado de pesquisa por produto: mostra o ITEM encontrado com o contexto
// necessário (pedido + fornecedor), não só "esta cotação contém algo" — é o
// que permite responder direto "em quais pedidos esse produto aparece e com
// qual fornecedor", sem abrir fornecedor por fornecedor manualmente. Se o
// mesmo produto aparecer com mais de um fornecedor na cotação, cada um vira
// uma linha separada (um por item correspondente).
function renderCardResultadoItem(cotacao, item) {
    const fornecedor = (cotacao.fornecedores || []).find(f => f.cnpj === item.cnpjFornecedor);
    const nomeProduto = item.nomeOficial ? upAud(item.nomeOficial) : (item.descricao ? upAud(item.descricao) : 'Produto sem nome identificado');
    const nomeFornecedor = fornecedor ? nomeExibicaoFornecedor(fornecedor.razaoSocial, fornecedor.cnpj) : (item.cnpjFornecedor || 'Fornecedor não identificado');
    const associacao = item.codProduto ? listaAssociacoesSpData.find(a => a.codigoSmartCompras === item.codProduto) : null;
    const produtoSpData = associacao ? listaProdutosSpData.find(p => p.codigo === associacao.spDataCodigo) : null;
    const detalhes = [
        item.codProduto ? `Cód. SmartCompras ${item.codProduto}` : '',
        item.fabricante && item.fabricante !== '---' ? item.fabricante : '',
        item.embalagem ? item.embalagem : '',
        item.quantidade ? `Qtd ${item.quantidade}` : '',
        item.precoUnitario ? `R$ ${item.precoUnitario}` : '',
        produtoSpData ? `SP Data ${produtoSpData.codigo}` : ''
    ].filter(Boolean).join(' · ');
    return `<div class="nota-item" onclick="abrirCentralPedido('${cotacao.pedido}')">
        <div class="nota-info">${nomeProduto}</div>
        <div class="nota-detalhes">Pedido ${cotacao.pedido}${cotacao.origem ? ' - ' + cotacao.origem : ''} · ${nomeFornecedor}${detalhes ? ' · ' + detalhes : ''}</div>
    </div>`;
}

function ordenarCotacoes(lista) {
    // 'entrada' já vem nessa ordem da query (orderBy atualizadoEm desc, ver
    // listener); só precisa reordenar explicitamente pro modo 'pedido'.
    if (ordenacaoCotacoes !== 'pedido') return lista;
    return [...lista].sort((a, b) => {
        const na = parseInt(a.pedido, 10), nb = parseInt(b.pedido, 10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
        return a.pedido.localeCompare(b.pedido);
    });
}

function renderListaCotacoes() {
    const container = document.getElementById('lista-cotacoes-container');
    if (!container) return;

    const termo = filtroCotacoesTexto.trim().toUpperCase();
    const lista = ordenarCotacoes(listaCotacoes);

    if (!termo) {
        if (lista.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhuma cotação cadastrada ainda.</div>';
            return;
        }
        container.innerHTML = lista.map(renderCardCotacao).join('');
        return;
    }

    // Com termo preenchido: pedido/origem/fornecedor continuam mostrando a
    // cotação inteira (como sempre foi); um match por produto mostra os
    // itens encontrados diretamente, com pedido e fornecedor no contexto.
    const blocos = [];
    lista.forEach(c => {
        const nomesFornecedores = (c.fornecedores || []).map(f => (f.razaoSocial || '').toUpperCase()).join(' ');
        const matchDireto = c.pedido.toUpperCase().includes(termo) || (c.origem || '').toUpperCase().includes(termo) || nomesFornecedores.includes(termo);
        const itensMatch = itensCorrespondentesCotacao(c, termo);
        if (itensMatch.length > 0) {
            itensMatch.forEach(it => blocos.push(renderCardResultadoItem(c, it)));
        } else if (matchDireto) {
            blocos.push(renderCardCotacao(c));
        }
    });

    container.innerHTML = blocos.length ? blocos.join('') : '<div class="empty-state">Nenhuma cotação encontrada.</div>';
}


function formatarDataBRSimples(iso) {
    if (!iso) return '';
    const partes = iso.split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}` : iso;
}

let origemTelaCotacaoEditor = 'screen-cotacoes'; // pra onde "Voltar"/fechar deve levar ao sair de screen-cotacao-editor

function abrirNovaCotacao() {
    // "Nova Cotação" é acionada tanto da lista de Cotações quanto de dentro
    // da Central (quando o pedido ainda não tem cotação cadastrada) — o
    // botão de voltar precisa saber pra qual das duas telas retornar.
    const telaAtiva = document.querySelector('.app-screen.active');
    origemTelaCotacaoEditor = (telaAtiva && telaAtiva.id === 'screen-central-pedido') ? 'screen-central-pedido' : 'screen-cotacoes';
    cotacaoEmEdicaoPedido = null;
    fornecedoresCotacaoAtual = [];
    contadorFornecedorCotacaoId = 0;
    document.getElementById('cot-pedido').value = '';
    document.getElementById('cot-pedido').disabled = false;
    document.getElementById('cot-origem').value = '';
    document.getElementById('cot-data-pedido').value = new Date().toISOString().slice(0, 10);
    document.getElementById('cot-data-limite').value = '';
    document.getElementById('cot-observacao').value = '';
    document.getElementById('btn-excluir-cotacao').style.display = 'none';
    renderFornecedoresCotacao();
    switchToScreen('screen-cotacao-editor', 'Nova Cotação');
}

async function abrirCotacaoParaEdicao(pedido) {
    origemTelaCotacaoEditor = 'screen-central-pedido';
    let c = listaCotacoes.find(c => c.pedido === pedido);
    if (!c) {
        // Fallback pra quando o listener em tempo real ainda não refletiu uma
        // escrita que acabou de acontecer (ex: logo após importar um XML) —
        // busca direto no Firestore em vez de falhar silenciosamente.
        try {
            const doc = await cotacoesCollection.doc(pedido).get();
            if (doc.exists) c = { pedido, ...doc.data() };
        } catch (e) {
            console.error('Erro ao buscar cotação:', e);
        }
    }
    if (!c) return;
    cotacaoEmEdicaoPedido = pedido;
    contadorFornecedorCotacaoId = 0;
    // Mantém TODOS os campos originais do fornecedor (não só razaoSocial/cnpj)
    // — um fornecedor importado do XML carrega prazoEntrega, validadeProposta
    // etc, e não pode perder isso só porque o usuário abriu a tela manual e
    // salvou de novo sem mexer nesses campos.
    fornecedoresCotacaoAtual = (c.fornecedores || []).map(f => ({ id: ++contadorFornecedorCotacaoId, ...f }));
    document.getElementById('cot-pedido').value = c.pedido;
    document.getElementById('cot-pedido').disabled = true; // pedido é o id do documento — não dá pra editar depois de criado
    document.getElementById('cot-origem').value = c.origem || '';
    document.getElementById('cot-data-pedido').value = c.dataPedido || '';
    document.getElementById('cot-data-limite').value = c.dataLimite || '';
    document.getElementById('cot-observacao').value = c.observacao || '';
    document.getElementById('btn-excluir-cotacao').style.display = '';
    renderFornecedoresCotacao();
    switchToScreen('screen-cotacao-editor', `Cotação ${pedido}`);
}

function adicionarFornecedorCotacao() {
    fornecedoresCotacaoAtual.push({ id: ++contadorFornecedorCotacaoId, razaoSocial: '', cnpj: '' });
    renderFornecedoresCotacao();
}
function removerFornecedorCotacao(id) {
    fornecedoresCotacaoAtual = fornecedoresCotacaoAtual.filter(f => f.id !== id);
    renderFornecedoresCotacao();
}
function atualizarFornecedorCotacaoCampo(id, key, valor) {
    const f = fornecedoresCotacaoAtual.find(f => f.id === id);
    if (f) f[key] = key === 'razaoSocial' ? upAud(valor) : valor;
}
function renderFornecedoresCotacao() {
    const container = document.getElementById('lista-fornecedores-cotacao');
    if (!container) return;
    if (fornecedoresCotacaoAtual.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhum fornecedor adicionado ainda.</div>';
        return;
    }
    container.innerHTML = fornecedoresCotacaoAtual.map(f => {
        const apelido = encontrarApelidoFornecedor(f.razaoSocial);
        return `
        <div class="fornecedor-cotacao-row">
            <div class="campo"><label>Razão Social${apelido ? ` (apelido: ${apelido})` : ''}</label><input type="text" class="form-field uppercase-field" value="${f.razaoSocial}" placeholder="COMERCIAL CIRÚRGICA RIOCLARENSE" onblur="atualizarFornecedorCotacaoCampo(${f.id}, 'razaoSocial', this.value)"></div>
            <div class="campo"><label>CNPJ</label><input type="text" class="form-field" value="${f.cnpj}" placeholder="67.729.178/0002-20" onblur="atualizarFornecedorCotacaoCampo(${f.id}, 'cnpj', this.value)"></div>
            <button type="button" class="divergencia-del" onclick="removerFornecedorCotacao(${f.id})"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }).join('');
}

async function salvarCotacao() {
    const pedido = document.getElementById('cot-pedido').value.trim();
    if (!pedido) return toast('Informe o número do pedido.');

    // Doc id = pedido, então um pedido já cadastrado nunca deve ser
    // sobrescrito silenciosamente ao tentar "criar" de novo — só editando.
    if (!cotacaoEmEdicaoPedido && listaCotacoes.some(c => c.pedido === pedido)) {
        return toast(`Já existe uma cotação para o pedido ${pedido}. Abra ela pra editar.`);
    }

    const agora = new Date().toISOString();
    const dados = {
        origem: document.getElementById('cot-origem').value,
        dataPedido: document.getElementById('cot-data-pedido').value,
        dataLimite: document.getElementById('cot-data-limite').value,
        observacao: document.getElementById('cot-observacao').value.trim(),
        fornecedores: fornecedoresCotacaoAtual.filter(f => f.razaoSocial.trim() || f.cnpj.trim()).map(f => {
            const { id, ...resto } = f;
            return { ...resto, razaoSocial: f.razaoSocial.trim(), cnpj: f.cnpj.trim() };
        }),
        atualizadoEm: agora
    };

    try {
        if (cotacaoEmEdicaoPedido) {
            await cotacoesCollection.doc(pedido).set(dados, { merge: true });
            toast('✓ Cotação atualizada!');
        } else {
            dados.itens = []; // reservado para a importação do XML (Fase 4)
            dados.versaoAtual = 1;
            dados.origemDado = 'manual';
            dados.criadoEm = agora;
            await cotacoesCollection.doc(pedido).set(dados);
            toast('✓ Cotação cadastrada!');
        }
        await criarOuAtualizarAnotacaoDaCotacao(pedido, dados.origem, dados.dataPedido, dados.dataLimite, dados.fornecedores);
        // Editar/criar cotação de dentro da Central deve voltar pra Central
        // (não pra lista crua) — só volta pra lista quando "Nova Cotação" foi
        // aberta de lá mesmo, sem nenhum pedido de contexto ainda.
        if (origemTelaCotacaoEditor === 'screen-central-pedido') await abrirCentralPedido(pedido);
        else switchToScreen('screen-cotacoes', 'Cotações');
    } catch (e) {
        console.error('Erro ao salvar cotação:', e);
        toast('✕ Erro ao salvar. Tente novamente.');
    }
}

// ===================================================================
// --- FASE 7: ANÁLISE DAS COTAÇÕES POR ITEM ---
// ===================================================================
// Só leitura/junção sobre o que já existe (cotacao.itens, vindos do XML do
// SmartCompras — Fase 4; listaRelatorioGanhadores, relatório complementar já
// existente) + UMA gravação nova e pequena: cotacao.recursosPorItem, um mapa
// { codigoSmartCompras: <string oficial> } no próprio documento da cotação
// (não é coleção nova, não duplica cotação). Como não é tocado por
// confirmarImportacaoXmlSmartCompras (que só sobrescreve fornecedores/itens/
// datas via merge:true), sobrevive automaticamente a reimportações — sem
// precisar de nenhuma lógica extra de mesclagem.
//
// IMPORTANTE — modelo de negócio confirmado:
//   ENTIDADE (Santa Casa/CTI) já é uma característica do PEDIDO inteiro
//   (campo cotacao.origem, já existente — nada a fazer aqui).
//   RECURSO (C/C vs Recurso Próprio) pode variar POR ITEM dentro do mesmo
//   pedido — por isso fica em recursosPorItem, indexado pelo código do item,
//   nunca num campo único "recurso do pedido".
//
// As 4 strings abaixo são valores oficiais de integração com a planilha do
// processo — nunca alterar capitalização, acentuação, ordem das palavras ou
// criar abreviações/alternativas. Esta é a ÚNICA fonte dessas strings no
// código; todo o resto do app deve montá-las através de calcularRecursoOficial.
const RECURSOS_OFICIAIS = {
    'Santa Casa': { cc: 'C/C SANTA CASA', proprio: 'Recurso Proprio Santa Casa' },
    'CTI': { cc: 'C/C CTI', proprio: 'Recurso Proprio CTI' }
};
function calcularRecursoOficial(origemPedido, tipo) {
    const mapa = RECURSOS_OFICIAIS[origemPedido];
    if (!mapa) return null;
    return tipo === 'cc' ? mapa.cc : tipo === 'proprio' ? mapa.proprio : null;
}

// Sugestão de recurso baseada em evidência concreta: o MESMO código
// SmartCompras já teve um recurso confirmado em OUTRA cotação antes. Nunca
// por nome de produto (evidência frágil) — só pelo código, que é o
// identificador concreto disponível hoje nessa cadeia. Nunca aplica
// sozinho, só sugere; a confirmação é sempre uma ação manual do usuário.
function sugerirRecursoPorHistorico(codProduto, pedidoAtual) {
    if (!codProduto) return null;
    const ocorrencias = [];
    listaCotacoes.forEach(c => {
        if (c.pedido === pedidoAtual) return;
        const valor = (c.recursosPorItem || {})[codProduto];
        if (valor) ocorrencias.push({ pedido: c.pedido, recurso: valor, atualizadoEm: c.atualizadoEm || '' });
    });
    if (!ocorrencias.length) return null;
    ocorrencias.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
    const contagem = {};
    ocorrencias.forEach(o => contagem[o.recurso] = (contagem[o.recurso] || 0) + 1);
    return { recursoMaisRecente: ocorrencias[0].recurso, pedidoMaisRecente: ocorrencias[0].pedido, totalOcorrencias: ocorrencias.length, contagem };
}

// Grava o recurso confirmado de um item — reaproveita exatamente a mesma
// estrutura da Fase 7 (cotacao.recursosPorItem), só que agora quem chama é
// o fluxo de entrada do XML/NF (Parte 4/5/6 da correção), não mais uma
// escolha manual dentro da tela de Análise por item.
async function definirRecursoItem(pedido, codigo, tipo) {
    if (!codigo || !pedido) return;
    const cotacao = listaCotacoes.find(c => c.pedido === pedido);
    if (!cotacao) return;
    if (!cotacao.origem) return toast('Defina a Origem do pedido (Santa Casa/CTI) na cotação antes de confirmar o recurso.');
    const recursoOficial = tipo ? calcularRecursoOficial(cotacao.origem, tipo) : null;
    try {
        const campo = `recursosPorItem.${codigo}`;
        if (recursoOficial) {
            await cotacoesCollection.doc(cotacao.pedido).set({ [campo]: recursoOficial }, { merge: true });
            toast(`✓ Recurso confirmado: ${recursoOficial}`);
        } else {
            await cotacoesCollection.doc(cotacao.pedido).update({ [campo]: firebase.firestore.FieldValue.delete() });
            toast('Recurso removido deste item.');
        }
        if (document.getElementById('xml-sugestao-recurso') && pedidoSelecionadoXml === pedido) renderSugestaoRecursoNf();
    } catch (e) {
        console.error('Erro ao definir recurso do item:', e);
        toast('✕ Erro ao salvar. Tente novamente.');
    }
}
function aplicarRecursoSugerido(pedido, codigo, recursoOficial) {
    definirRecursoItem(pedido, codigo, recursoOficial.startsWith('C/C') ? 'cc' : 'proprio');
}

// Configuração dos mínimos de cotações esperados por tipo de recurso — só
// existe pra dar um "condição atendida/verificar" com base real, nunca um
// número inventado pelo sistema. Fica vazio até o usuário definir.
// ===================================================================
// --- CONFIGURAÇÕES → HISTÓRICO DE MUDANÇAS DO APLICATIVO ---
// ===================================================================
// Registro funcional/documental do desenvolvimento — não é versionamento
// técnico nem log automático de código. É estático dentro do app (sem
// coleção nova no Firestore, como pedido): cada atualização futura só
// precisa acrescentar uma entrada neste array, com "o que mudou" + "o que
// testar". A entrada mais recente é sempre a fase atual, destacada na tela.
const HISTORICO_FASES = [
    {
        numero: 14, nome: 'PDF na Saída de Texto + Importar simplificado + Logo (revisão das Fases 13-14)', status: 'atual',
        implementado: [
            'Aba Exportar: novo botão "Gerar PDF" ao lado de Copiar, Compartilhar e Arquivar Tudo. O PDF usa exatamente a mesma lista (e a mesma ordem, inclusive depois de "Ordenar por Recurso") da saída de texto, no modelo em papel já usado (DATA, NF, VENCIMENTO, VALOR TOTAL, FORNECEDOR, RECEBIDO COMPRAS, RECEBIDO CONTÁBIL, OBSERVAÇÕES + assinaturas).',
            'Indicador de novidade (bolinha) reutilizável e persistente: cada novidade tem um id e a bolinha fica na aba até o usuário abrir a tela da novidade — depois nunca mais reaparece (fica registrado nas configurações, sem coleção nova).'
        ],
        mudou: [
            'Repasse/Protocolo saiu da interface: telas de revisão, lista e detalhe, botões "Revisar e Confirmar Saída"/"Ver Repasses", selo "Repasse" no card e o botão de caminhão (seleção pra saída) em Gerenciar NF. Os repasses já gravados continuam no banco, nada foi apagado, e o protocolo não é necessário pra gerar PDF.',
            'Importar Relatório: removidos a Pré-seleção e o botão "Enviar pro Financeiro" (só criavam a mesma NF que "Importar Selecionadas" já cria). Fluxo antigo preservado: colar/subir relatório, buscar por NF ou fornecedor, ver novas × já processadas, marcar e levar pro Gerenciar NF. As NFs importadas agora ficam ligadas à entrada do ERP, e arquivar sincroniza com o ERP.',
            'Logo: a configuração continua em Configurações → Personalização, agora no topo da tela e com nome que indica o uso nos PDFs da aba Exportar.',
            'Saída de texto, Copiar, Compartilhar e Arquivar Tudo não mudaram.'
        ],
        testar: [
            'Exportar: com notas na lista, tocar em Gerar PDF e conferir que as NFs e a ordem são as mesmas da caixa de texto; usar "Ordenar por Recurso" e gerar de novo; marcar uma NF como pendente e conferir que ela fica fora do texto e do PDF.',
            'Enviar uma logo em Configurações → Personalização (agora no topo) e conferir no PDF; sem logo, o PDF deve sair normalmente.',
            'Confirmar que Copiar, Compartilhar e Arquivar Tudo continuam iguais.',
            'Importar: colar o relatório, buscar por NF e por fornecedor, conferir novas × já processadas, marcar e importar — a lista "Pré-seleção" não deve mais existir.',
            'Depois de importar, arquivar a NF e conferir no Histórico que a NF de origem ERP aparece como arquivada.',
            'Cadastrar uma NF manualmente (sem cotação/ERP), informar o recurso à mão e gerar texto e PDF — nada deve bloquear.',
            'Bolinhas: devem aparecer em Exportar e em Configurações; abrir Exportar, Importar Relatório e Personalização apaga a bolinha correspondente, e recarregar a página não traz de volta as já vistas.'
        ]
    },
    {
        numero: 13, nome: 'Saída/Repasse e Protocolo', status: 'concluida',
        implementado: [
            'NFs marcadas no modo "Selecionar pra Saída" (Fase 12) agora podem ser reunidas num repasse formal: botão "Revisar e Confirmar Saída" mostra um resumo (destino, valor total, fornecedores, pedidos, recursos) antes de confirmar.',
            'Cada repasse recebe um protocolo único e localizável (formato SAI-AAAAMMDD-NNN).',
            'Nova tela "Ver Repasses" (dentro de Gerenciar NF) lista os repasses já confirmados e permite abrir cada um pra ver quais NFs fizeram parte.',
            'Possível remover uma NF da revisão antes de confirmar — nunca exclui ou altera a NF original.',
            'Repasse pode ser marcado como "Concluído/Arquivado" depois de confirmado.'
        ],
        mudou: [
            'Novos botões dentro do modo "Selecionar pra Saída": "Revisar e Confirmar Saída" e "Ver Repasses".',
            'Se as NFs selecionadas tiverem destinos diferentes (Santa Casa e CTI misturados), a confirmação é bloqueada até resolver.',
            'Uma NF que já fez parte de um repasse confirmado passa a mostrar um selo "Repasse [protocolo]" no card de Gerenciar NF.',
            'Revisão (Fase 14): as telas de Repasse/Protocolo foram retiradas da interface; os repasses já criados permanecem no banco.'
        ],
        testar: []

    },
    {
        numero: '12 (refino)', nome: 'Unificação Gerenciar NF × Seleção Saída + Histórico de Mudanças', status: 'concluida',
        implementado: [
            '"Seleção Saída" deixou de ser uma tela própria — agora é um modo dentro de Gerenciar NF (botão no cabeçalho), com filtro por situação e checkbox de seleção pra saída.',
            'Card de Gerenciar NF passou a mostrar sempre pedido, CNPJ, destino e recurso confirmado, além do selo de aptidão (Fase 11).',
            'Edição (fornecedor, NF, vencimento, valor) já é a mesma de sempre — nunca existiu uma segunda implementação.',
            'Indicador de novidade corrigido: agora dispara só uma vez por carregamento do app (antes podia reaparecer sempre que uma configuração fosse salva) e aponta pra aba Gerenciar NF.',
            'Esta tela de Histórico de Mudanças, dentro de Configurações.'
        ],
        mudou: [
            'A aba "Seleção Saída" não existe mais separadamente — use o botão de caminhão no cabeçalho de Gerenciar NF.',
            'Busca de Gerenciar NF agora também encontra por número do pedido.'
        ], testar: []
    },
    {
        numero: 12, nome: 'Seleção de NFs para Saída/Repasse', status: 'concluida',
        implementado: [
            'Conceito de "aptidão para saída" (apta, com divergência, com auditoria pendente, não conferida, ambígua, sem pedido) calculado a partir de dados já existentes — Entrada Segura, Auditoria, ERP.',
            'Seleção de NFs candidatas a uma futura saída/repasse, sem duplicar ou recriar a NF.'
        ],
        mudou: ['(depois unificado com Gerenciar NF no refino acima).'],
        testar: []
    },
    {
        numero: 11, nome: 'Financeiro / Aptidão para Saída', status: 'concluida',
        implementado: [
            'Função que cruza a nota financeira com a NF processada (Entrada Segura) e a Auditoria pra determinar a situação de conferência — sem criar nenhum campo/coleção nova, só leitura.'
        ], mudou: [], testar: []
    },
    {
        numero: 10, nome: 'Auditoria Integrada', status: 'concluida',
        implementado: [
            'Auditoria passou a nascer como consequência da conferência da NF/Cotação/ERP — "Gerar auditoria" pré-preenche pedido, fornecedor, NF, produto, quantidade cotada/faturada.',
            'Divergência nasce com o TIPO ESTRUTURADO correto (NÃO FATURADO, QUANTIDADE DIFERENTE, VALOR DIFERENTE) sempre que a comparação já dá evidência — "Outro" deixou de ser usado como padrão.',
            'Seleção de material pela divergência passou a mostrar o nome do produto (associação SP Data), não a Observação bruta do SmartCompras.'
        ], mudou: [], testar: []
    },
    {
        numero: 9, nome: 'Entrada Segura da NF', status: 'concluida',
        implementado: [
            'Distinção entre BLOQUEIO (impede salvar — conflito de pedido, conversão de unidade suspeita) e ALERTA (avisa mas deixa salvar — sem associação SP Data, item ainda não faturado nesta NF).',
            'Sugestão de qual cotação/pedido provavelmente corresponde à NF, quando o CNPJ bate com mais de uma cotação, por evidência de valor compatível — nunca por data isolada.'
        ], mudou: [], testar: []
    },
    {
        numero: 8, nome: 'Reconciliação ERP', status: 'concluida',
        implementado: [
            'Vínculo NF↔pedido com 3 estados (confirmado/sugerido/sem associação), sempre com evidências explícitas — nunca por coincidência de data isolada.',
            'Preenchimento automático de associação SP Data a partir do ERP quando quantidade e valor batem exatamente com um único item.',
            '"Alimentar Histórico do ERP" separado de "Enviar pro Financeiro" — reimportar o mesmo relatório nunca duplica NF.'
        ], mudou: [], testar: []
    },
    {
        numero: '2–7', nome: 'Consolidação Pedido → Cotação → Fornecedor → NF → ERP', status: 'concluida',
        implementado: [
            'Central do Pedido como ponto único de consulta (fornecedor, CNPJ, itens, SP Data, NFs relacionadas).',
            'Suporte nativo a um pedido com várias NFs e a NF parcial (nunca "1 pedido = 1 NF").'
        ], mudou: [], testar: []
    },
    {
        numero: 1, nome: 'Correção da associação SP Data + remoção de tela redundante', status: 'concluida',
        implementado: [
            'Busca de associação SP Data corrigida pra considerar também o código, não só o nome.',
            'Tela geral "Ver cotações por item" removida — associação continua só no contexto do produto dentro da cotação/fornecedor.'
        ], mudou: [], testar: []
    }
];

function renderHistoricoMudancas() {
    const container = document.getElementById('historico-mudancas-lista');
    if (!container) return;
    container.innerHTML = HISTORICO_FASES.map(fase => {
        const atual = fase.status === 'atual';
        const listaHTML = (titulo, itens) => itens && itens.length
            ? `<div class="nota-detalhes"><strong>${titulo}:</strong><br>${itens.map(i => '• ' + escRel(i)).join('<br>')}</div>` : '';
        return `<div class="card" style="margin-bottom:12px;${atual ? 'border:2px solid var(--accent-color);' : ''}">
            <div class="nota-info">${atual ? '<span class="xml-item-badge pronto">FASE ATUAL</span> ' : ''}Fase ${escRel(fase.numero)} — ${escRel(fase.nome)}</div>
            ${listaHTML('O que foi implementado', fase.implementado)}
            ${listaHTML('O que mudou nesta versão', fase.mudou)}
            ${listaHTML('O que testar', fase.testar)}
        </div>`;
    }).join('');
}

function abrirConfigAnaliseCotacoes() {
    document.getElementById('config-minimo-cc').value = appConfig.minimoCotacoesCC || '';
    document.getElementById('config-minimo-proprio').value = appConfig.minimoCotacoesRecursoProprio || '';
}
async function salvarMinimosCotacoes() {
    const cc = document.getElementById('config-minimo-cc').value;
    const proprio = document.getElementById('config-minimo-proprio').value;
    try {
        await settingsDocRef.set({
            minimoCotacoesCC: cc ? parseInt(cc, 10) : null,
            minimoCotacoesRecursoProprio: proprio ? parseInt(proprio, 10) : null
        }, { merge: true });
        toast('✓ Configuração salva.');
    } catch (e) {
        console.error('Erro ao salvar mínimos de cotações:', e);
        toast('✕ Erro ao salvar.');
    }
}

// Nome de exibição de um fornecedor: reaproveita o MESMO cadastro de apelidos
// já usado na importação do relatório de NFs do ERP (apelidosFornecedores /
// encontrarApelidoFornecedor) — não é um cadastro paralelo. Preferência por
// CNPJ fica registrada como limitação: o cadastro de apelidos hoje é indexado
// por nome (não por CNPJ), então o match continua sendo por nome/prefixo.
// Nome de exibição do fornecedor — fonte ÚNICA usada em todo o app (Central
// do Pedido, cotação, auditoria, Entrada de NF). Unifica o que antes eram
// dois caminhos separados: agora, quando há CNPJ disponível, consulta
// primeiro o cadastro oficial fornecedoresSpData (determinístico — CNPJ é
// dado concreto, não precisa de heurística de texto). Sem CNPJ ou CNPJ ainda
// não cadastrado, cai pro nome exato no mesmo cadastro e, por último, pro
// alias antigo por texto (encontrarApelidoFornecedor) — mantido só como
// último recurso, sem apagar nada do que já existia.
function nomeExibicaoFornecedor(razaoSocial, cnpj) {
    if (cnpj) {
        const doc = listaFornecedoresSpData.find(f => f.cnpjs.some(c => c.cnpj === cnpj));
        if (doc) return doc.nomeExibido || doc.nomeReal || razaoSocial || '';
    }
    if (!razaoSocial) return '';
    const porNome = listaFornecedoresSpData.find(f => (f.nomeReal || '').toUpperCase() === razaoSocial.toUpperCase());
    if (porNome) return porNome.nomeExibido || porNome.nomeReal;
    return encontrarApelidoFornecedor(razaoSocial) || razaoSocial;
}

// Anotação "resumo vivo" do pedido — criada automaticamente na primeira
// importação da cotação (título "PEDIDO - ORIGEM", cabeçalho com datas e
// fornecedores). A MESMA anotação (casada por número de pedido, sem filtrar
// por tipo) é reaproveitada depois pela Auditoria (salvarAuditoriaComoAnotacao
// já faz upsert por pedido, ver Fase 2) — evita criar uma anotação separada
// pra cada acontecimento do pedido.
function montarCabecalhoAnotacaoCotacao(pedido, origem, dataPedido, dataLimite, fornecedores) {
    const linhas = [];
    if (dataPedido) linhas.push(`DATA DO PEDIDO: ${formatarDataBRSimples(dataPedido)}`);
    if (dataLimite) linhas.push(`LIMITE: ${formatarDataBRSimples(dataLimite)}`);
    linhas.push('FORNECEDORES:');
    (fornecedores || []).forEach(f => linhas.push(nomeExibicaoFornecedor(f.razaoSocial, f.cnpj)));
    return '<p>' + linhas.map(l => l.replace(/</g, '&lt;')).join('<br>') + '</p>';
}

async function criarOuAtualizarAnotacaoDaCotacao(pedido, origem, dataPedido, dataLimite, fornecedores) {
    if (!pedido) return null;
    const titulo = origem ? `${pedido} - ${origem}` : pedido;
    const existente = listaAnotacoes.find(a => a.pedido === pedido);
    try {
        if (!existente) {
            const ref = await anotacoesTextoCollection.add({
                titulo,
                conteudo: montarCabecalhoAnotacaoCotacao(pedido, origem, dataPedido, dataLimite, fornecedores),
                tipo: 'cotacao',
                pedido,
                atualizadoEm: new Date().toISOString(),
                criadoEm: new Date().toISOString()
            });
            return ref.id;
        } else {
            // Só re-escreve o cabeçalho se ainda não houver nenhuma ocorrência de
            // auditoria registrada nessa anotação — depois que a Auditoria começa
            // a anexar conteúdo, mexer no bloco de cabeçalho fica arriscado demais
            // (o conteúdo já não é mais só o header, é um documento vivo com
            // histórico). O título (pedido - origem) sempre pode ser atualizado,
            // já que é só metadado, não mexe no corpo salvo.
            const dadosUpdate = { titulo };
            if (!existente.ocorrencias || existente.ocorrencias.length === 0) {
                dadosUpdate.conteudo = montarCabecalhoAnotacaoCotacao(pedido, origem, dataPedido, dataLimite, fornecedores);
            }
            await anotacoesTextoCollection.doc(existente.id).update(dadosUpdate);
            return existente.id;
        }
    } catch (e) {
        console.error('Erro ao criar/atualizar anotação da cotação:', e);
        return null;
    }
}

function excluirCotacao() {
    if (!cotacaoEmEdicaoPedido) return;
    const pedido = cotacaoEmEdicaoPedido;
    showConfirmModal({
        title: 'Excluir Cotação',
        message: `Deseja excluir a cotação do pedido ${pedido} permanentemente?`,
        confirmText: 'Excluir',
        confirmClass: 'danger',
        onConfirm: async () => {
            try {
                await cotacoesCollection.doc(pedido).delete();
                toast('🗑️ Cotação excluída.');
                switchToScreen('screen-cotacoes', 'Cotações');
            } catch (e) {
                console.error('Erro ao excluir cotação:', e);
                toast('✕ Erro ao excluir.');
            }
        }
    });
}

// ============================================================
// IMPORTAÇÃO DO XML DO SMARTCOMPRAS — Fase 4
// O XML é tratado como uma fotografia da cotação no momento da importação
// (nunca sobrescreve silenciosamente): pedido novo cria a cotação; pedido já
// cadastrado gera uma NOVA VERSÃO com o snapshot anterior preservado numa
// subcoleção, e mostra um diff antes de confirmar.
// ============================================================

let importacaoXmlPendente = null; // { parsed, cotacaoExistente, diff }

function textoTag(el, tag) {
    const node = el.querySelector(tag);
    return node && node.textContent ? node.textContent.trim() : '';
}

function parseXmlSmartCompras(xmlTexto) {
    const doc = new DOMParser().parseFromString(xmlTexto, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('XML inválido ou corrompido.');

    const cabecalho = doc.querySelector('Cabecalho');
    const pedido = cabecalho ? textoTag(cabecalho, 'PDC') : '';
    if (!pedido) throw new Error('Não foi possível identificar o número do pedido (PDC) no XML.');

    const fornecedores = Array.from(doc.querySelectorAll('Fornecedores > Fornecedor')).map(f => ({
        cnpj: textoTag(f, 'CNPJ'),
        razaoSocial: upAud(textoTag(f, 'Razao_Social')),
        faturamentoMinimo: textoTag(f, 'Faturamento_Minimo'),
        prazoEntrega: textoTag(f, 'Prazo_Entrega'),
        validadeProposta: textoTag(f, 'Validade_Proposta'),
        formaPagamento: textoTag(f, 'Id_Forma_Pagamento'),
        frete: textoTag(f, 'Frete'),
        dataConfirmacao: textoTag(f, 'Data_Confirmacao')
    })).filter(f => f.cnpj);

    const itens = Array.from(doc.querySelectorAll('Itens > Item')).map(item => {
        const resposta = item.querySelector('Resposta');
        const progEntrega = item.querySelector('Programacao_Entrega');
        return {
            codProduto: textoTag(item, 'Cod_Produto'),
            quantidade: textoTag(item, 'Quantidade'),
            dataProgramada: progEntrega ? textoTag(progEntrega, 'Data') : '',
            qtdProgramada: progEntrega ? textoTag(progEntrega, 'Quantidade') : '',
            cnpjFornecedor: resposta ? textoTag(resposta, 'CNPJ') : '',
            fabricante: resposta ? textoTag(resposta, 'Fabricante') : '',
            embalagem: resposta ? textoTag(resposta, 'Embalagem') : '',
            precoUnitario: resposta ? textoTag(resposta, 'Preco_Unitario') : '',
            precoTotal: resposta ? textoTag(resposta, 'Preco_Total') : '',
            descricao: upAud(resposta ? textoTag(resposta, 'Comentario') : '')
        };
    }).filter(it => it.codProduto);

    return {
        pedido,
        dataVencimento: cabecalho ? textoTag(cabecalho, 'Data_Vencimento') : '',
        horaVencimento: cabecalho ? textoTag(cabecalho, 'Hora_Vencimento') : '',
        fornecedores,
        itens
    };
}

// Data limite sugerida = a mais tardia entre as datas programadas de entrega
// dos itens (é quando TODO o pedido deveria estar entregue). Só uma sugestão
// — nunca substitui uma data limite que o usuário já tenha definido na mão.
function sugerirDataLimiteXml(itens) {
    const datas = itens.map(it => it.dataProgramada).filter(Boolean).map(d => {
        const [dia, mes, ano] = d.split('/');
        return ano && mes && dia ? `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}` : null;
    }).filter(Boolean);
    if (datas.length === 0) return '';
    return datas.sort().pop();
}

// dd/mm/aaaa (formato do XML SmartCompras) -> aaaa-mm-dd (formato do <input type=date>)
function converterDataBRparaISO(dataBR) {
    if (!dataBR) return '';
    const [dia, mes, ano] = dataBR.split('/');
    return (dia && mes && ano) ? `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}` : '';
}
function somarDiasISO(dataISO, dias) {
    if (!dataISO) return '';
    const d = new Date(dataISO + 'T00:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
}

function calcularDiffCotacao(antiga, nova) {
    const diffs = [];
    const fornAntigos = new Map((antiga.fornecedores || []).map(f => [f.cnpj, f]));
    const fornNovos = new Map((nova.fornecedores || []).map(f => [f.cnpj, f]));
    fornNovos.forEach((f, cnpj) => { if (!fornAntigos.has(cnpj)) diffs.push(`+ Fornecedor adicionado: ${f.razaoSocial}`); });
    fornAntigos.forEach((f, cnpj) => { if (!fornNovos.has(cnpj)) diffs.push(`− Fornecedor removido: ${f.razaoSocial}`); });

    const itensAntigos = new Map((antiga.itens || []).map(it => [it.codProduto, it]));
    const itensNovos = new Map((nova.itens || []).map(it => [it.codProduto, it]));
    itensNovos.forEach((novo, cod) => {
        const velho = itensAntigos.get(cod);
        if (!velho) { diffs.push(`+ Item novo: ${novo.descricao || cod}`); return; }
        if (velho.quantidade !== novo.quantidade) diffs.push(`↕ ${novo.descricao || cod}: quantidade alterada de ${velho.quantidade} para ${novo.quantidade}`);
        if (velho.cnpjFornecedor !== novo.cnpjFornecedor) {
            const nomeAntigo = (antiga.fornecedores || []).find(f => f.cnpj === velho.cnpjFornecedor)?.razaoSocial || velho.cnpjFornecedor || '?';
            const nomeNovo = (nova.fornecedores || []).find(f => f.cnpj === novo.cnpjFornecedor)?.razaoSocial || novo.cnpjFornecedor || '?';
            diffs.push(`↕ ${novo.descricao || cod}: fornecedor alterado de ${nomeAntigo} para ${nomeNovo}`);
        }
        if (velho.precoUnitario !== novo.precoUnitario) diffs.push(`↕ ${novo.descricao || cod}: preço alterado de ${velho.precoUnitario} para ${novo.precoUnitario}`);
        if (velho.descricao !== novo.descricao) diffs.push(`↕ Produto alterado: "${velho.descricao}" → "${novo.descricao}"`);
        if (velho.dataProgramada !== novo.dataProgramada) diffs.push(`↕ ${novo.descricao || cod}: data de entrega alterada de ${velho.dataProgramada} para ${novo.dataProgramada}`);
    });
    itensAntigos.forEach((velho, cod) => { if (!itensNovos.has(cod)) diffs.push(`− Item removido: ${velho.descricao || cod}`); });

    return diffs;
}

function handleArquivoXmlSmartCompras(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = parseXmlSmartCompras(e.target.result);
            const existente = listaCotacoes.find(c => c.pedido === parsed.pedido) || null;
            const diff = existente ? calcularDiffCotacao(existente, parsed) : [];
            importacaoXmlPendente = { parsed, existente, diff };
            renderPreviewImportacaoXml();
        } catch (err) {
            console.error('Erro ao importar XML SmartCompras:', err);
            toast('✕ ' + (err.message || 'Erro ao ler o XML.'));
        }
    };
    reader.readAsText(file, 'UTF-8');
    document.getElementById('cotacao-xml-file-input').value = '';
}

function renderPreviewImportacaoXml() {
    const { parsed, existente, diff } = importacaoXmlPendente;
    // O card de prévia mora em screen-cotacoes — se o import foi disparado a
    // partir do editor de uma cotação específica ("Atualizar via XML"),
    // muda pra lá antes de mostrar, senão o usuário não veria a prévia.
    switchToScreen('screen-cotacoes', 'Cotações');
    const card = document.getElementById('card-preview-importacao-xml');
    const resumoEl = document.getElementById('resumo-importacao-xml');
    const diffEl = document.getElementById('diff-importacao-xml');

    const proximaVersao = existente ? (existente.versaoAtual || 1) + 1 : 1;
    resumoEl.innerHTML = `
        <div class="xml-resumo-linha"><strong>Pedido:</strong> ${parsed.pedido}</div>
        <div class="xml-resumo-linha"><strong>Vencimento da cotação:</strong> ${parsed.dataVencimento || '—'} ${parsed.horaVencimento || ''}</div>
        <div class="xml-resumo-linha"><strong>Fornecedores:</strong> ${parsed.fornecedores.length}</div>
        <div class="xml-resumo-linha"><strong>Itens:</strong> ${parsed.itens.length}</div>
        <div class="xml-resumo-linha"><strong>${existente ? `Versão ${proximaVersao} (atual: v${existente.versaoAtual || 1})` : 'Nova cotação (versão 1)'}</strong></div>
    `;

    if (existente && diff.length > 0) {
        diffEl.innerHTML = `<div class="xml-diff-titulo">O que mudou desde a última importação:</div><ul class="xml-diff-lista">${diff.map(l => `<li>${l.replace(/</g, '&lt;')}</li>`).join('')}</ul>`;
    } else if (existente) {
        diffEl.innerHTML = `<div class="xml-diff-titulo">Nenhuma mudança detectada em relação à versão atual.</div>`;
    } else {
        diffEl.innerHTML = '';
    }

    card.style.display = 'block';
}

// ===================================================================
// --- RELATÓRIO "FORNECEDORES GANHADORES" (SmartCompras) — complementa a
// cotação já existente com a quantidade de participantes por item.
// ===================================================================
// Formato real (validado contra relatório de pedido #1708): o texto se
// repete uma vez por fornecedor vencedor dentro do mesmo pedido; dentro de
// cada bloco, cada produto vem como
//   "Cód: <código>\t<nome>\tQtd: <qtd> <unidade>"
// seguido do cabeçalho "Empresa\t..." e uma linha por empresa participante
// (identificada por ter pelo menos 2 valores "R$" na linha). A tabela
// termina na primeira linha sem "R$" (próximo "Cód:", "Total:" ou fim).
function parseRelatorioFornecedoresGanhadores(texto) {
    const t = String(texto || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const linhas = t.split('\n');

    const pedidoMatch = t.match(/pedido #(\d+)/i);
    const pedido = pedidoMatch ? pedidoMatch[1] : null;
    const descricaoMatch = t.match(/Descri[cç][aã]o:\s*(.+)/i);
    const descricao = descricaoMatch ? descricaoMatch[1].trim() : '';

    const itens = [];
    const excecoes = [];
    // O relatório não marca o vencedor dentro da tabela de participantes —
    // só existe formatação visual (✓) no PDF, que não é dado estruturado. O
    // dado confiável é: o texto se repete uma vez por bloco de fornecedor
    // vencedor, e cada bloco começa com o nome do fornecedor seguido da
    // linha "CNPJ: ...". Todo item "Cód:" encontrado DENTRO de um bloco
    // pertence ao fornecedor daquele bloco. Nunca usa nome parecido — só a
    // posição estrutural (nome imediatamente antes da linha CNPJ:).
    let fornecedorAtual = null;
    let i = 0;
    while (i < linhas.length) {
        const cnpjMatch = linhas[i].match(/^CNPJ:\s*([\d.\/-]+)/);
        if (cnpjMatch && i > 0 && linhas[i - 1].trim()) {
            fornecedorAtual = { nome: linhas[i - 1].trim(), cnpj: cnpjMatch[1].replace(/\D/g, '') };
            i++;
            continue;
        }

        const codMatch = linhas[i].match(/^C[oó]d:\s*([^\t]*)\t(.+?)\tQtd:\s*([\d.,]+)\s*(\S*)/i);
        if (codMatch) {
            const codigo = codMatch[1].trim();
            const nomeProduto = codMatch[2].trim();
            const quantidade = parseValorBR(codMatch[3]);
            const unidade = codMatch[4].trim();

            let j = i + 1;
            if (linhas[j] && /^Empresa\t/i.test(linhas[j])) j++;

            const empresas = [];
            while (j < linhas.length) {
                const l = linhas[j];
                // O relatório real separa cada linha de participante por uma
                // linha em branco — isso NÃO é fim da tabela, só espaçamento
                // visual. Pular sem contar, sem parar.
                if (!l.trim()) { j++; continue; }
                // Linha de participante tem pelo menos 2 valores "R$" (val.
                // da proposta e valor total) — assim que isso não bater mais
                // (próximo "Cód:", "Total:" ou próximo fornecedor), a
                // tabela deste produto realmente terminou.
                if ((l.match(/R\$\s*[\d.,]+/g) || []).length < 2) break;
                const partes = l.split('\t');
                empresas.push({
                    nome: (partes[0] || '').trim(),
                    dataValidade: (partes[1] || '').trim(),
                    marca: (partes[2] || '').trim(),
                    valorProposta: (partes[3] || '').trim(),
                    valorTotal: (partes[4] || '').trim()
                });
                j++;
            }

            if (!codigo) {
                excecoes.push({ motivo: 'Sem código SmartCompras identificável', nomeProduto });
            } else if (!fornecedorAtual) {
                excecoes.push({ motivo: 'Item fora de um bloco de fornecedor reconhecido — vencedor não identificado', nomeProduto, codigo });
            } else {
                itens.push({ codigo, nomeProduto, quantidade, unidade, participantes: empresas.length, empresas, fornecedorVencedor: fornecedorAtual });
            }
            i = j;
            continue;
        }
        i++;
    }

    return { pedido, descricao, itens, excecoes };
}

let relatorioGanhadoresPendente = null;

function processarRelatorioGanhadoresColado() {
    const texto = document.getElementById('ganhadores-textarea').value;
    if (!texto || !texto.trim()) return toast('Cole ou envie o relatório antes de processar.');
    const resultado = parseRelatorioFornecedoresGanhadores(texto);
    const preview = document.getElementById('ganhadores-preview');
    if (!resultado.pedido) {
        preview.style.display = 'block';
        document.getElementById('ganhadores-resumo').innerHTML = '<div class="central-item-vazio">Não foi possível identificar o número do pedido neste texto — confira se é o relatório certo.</div>';
        document.getElementById('ganhadores-actions').style.display = 'none';
        return;
    }
    relatorioGanhadoresPendente = resultado;
    const cotacaoExiste = listaCotacoes.some(c => c.pedido === resultado.pedido);
    preview.style.display = 'block';
    document.getElementById('ganhadores-resumo').innerHTML = `
        <div><strong>Pedido:</strong> ${resultado.pedido}${resultado.descricao ? ` — ${resultado.descricao}` : ''}</div>
        <div style="font-size:12px;color:var(--text-light);margin-top:4px;">${cotacaoExiste ? '✓ Cotação já cadastrada — os dados ficarão visíveis nos itens dela.' : '⚠ Ainda não existe cotação cadastrada pra este pedido — os dados ficam guardados e serão exibidos automaticamente assim que ela for importada.'}</div>
        <div style="margin-top:8px;">${resultado.itens.length} item(ns) reconhecido(s):</div>
        ${resultado.itens.map(it => `<div class="xml-item-meta">${it.codigo} — ${it.nomeProduto} — ${it.participantes} fornecedor(es) cotaram — vencedor: ${it.fornecedorVencedor.nome}</div>`).join('')}
        ${resultado.excecoes.length ? `<div style="margin-top:8px;color:var(--button-warning);">${resultado.excecoes.length} exceção(ões): ${resultado.excecoes.map(e => e.motivo + ' (' + e.nomeProduto + ')').join('; ')}</div>` : ''}
    `;
    document.getElementById('ganhadores-actions').style.display = 'flex';
}

function handleRelatorioGanhadoresFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('ganhadores-textarea').value = decodificarArquivoTexto(e.target.result);
        toast('Arquivo carregado! Clique em "Processar".');
    };
    reader.onerror = () => toast('Erro ao ler o arquivo.');
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function cancelarImportacaoGanhadores() {
    relatorioGanhadoresPendente = null;
    document.getElementById('ganhadores-preview').style.display = 'none';
    document.getElementById('ganhadores-textarea').value = '';
}

// Reimportar o mesmo pedido substitui o doc inteiro (não duplica): o
// relatório reflete o estado final da cotação, não precisa de histórico
// incremental por item.
async function confirmarImportacaoGanhadores() {
    if (!relatorioGanhadoresPendente) return;
    const dados = relatorioGanhadoresPendente;
    try {
        const r = await salvarRelatorioGanhadoresEComplementarCotacao(dados);
        toast(r.cotacaoExiste
            ? `✓ Relatório do pedido ${dados.pedido} importado — ${dados.itens.length} item(ns), ${r.nomesComplementados} nome(s) complementado(s) na cotação.`
            : `✓ Relatório do pedido ${dados.pedido} importado — ${dados.itens.length} item(ns).`);
        cancelarImportacaoGanhadores();
        if (centralPedidoAtual === dados.pedido) renderCentralPedidoCompleto(centralPedidoAtual);
    } catch (e) {
        console.error('Erro ao importar relatório de fornecedores ganhadores:', e);
        toast('✕ Erro ao importar o relatório.');
    }
}

function cancelarImportacaoXml() {
    importacaoXmlPendente = null;
    document.getElementById('card-preview-importacao-xml').style.display = 'none';
}

// Reimportar o XML de um pedido já cadastrado sobrescreve itens com os dados
// crus da nova versão — mas o nomeOficial de cada item NUNCA vem do XML, só
// do relatório do SmartCompras colado depois (cruzarRelatorioComCotacao). Sem
// isso, reimportar apagava silenciosamente o nome oficial já complementado.
// Casa pelo mesmo par usado no cruzamento: codProduto + cnpjFornecedor.
// (O recurso por item, Fase 7, fica num campo próprio no nível da cotação —
// recursosPorItem — e não é tocado aqui, então sobrevive ao reimport
// automaticamente graças ao merge:true da escrita abaixo.)
function preservarNomeOficialAoReimportar(itensAntigos, itensNovosXml) {
    if (!itensAntigos || !itensAntigos.length) return itensNovosXml;
    return itensNovosXml.map(novo => {
        const antigo = itensAntigos.find(it => it.codProduto === novo.codProduto && it.cnpjFornecedor === novo.cnpjFornecedor);
        return (antigo && antigo.nomeOficial) ? { ...novo, nomeOficial: antigo.nomeOficial } : novo;
    });
}

async function confirmarImportacaoXmlSmartCompras() {
    if (!importacaoXmlPendente) return;
    const { parsed, existente, diff } = importacaoXmlPendente;
    const agora = new Date().toISOString();
    const proximaVersao = existente ? (existente.versaoAtual || 1) + 1 : 1;
    const dataLimiteSugerida = sugerirDataLimiteXml(parsed.itens);

    try {
        // Snapshot imutável desta importação — nunca sobrescrito, mesmo que
        // o pedido seja reimportado depois.
        await cotacoesCollection.doc(parsed.pedido).collection('versoes').doc(String(proximaVersao)).set({
            importadoEm: agora,
            fornecedores: parsed.fornecedores,
            itens: parsed.itens,
            dataVencimento: parsed.dataVencimento,
            horaVencimento: parsed.horaVencimento,
            diffDaAnterior: diff
        });

        const dadosPrincipal = {
            fornecedores: parsed.fornecedores,
            itens: parsed.itens,
            dataVencimento: parsed.dataVencimento,
            horaVencimento: parsed.horaVencimento,
            versaoAtual: proximaVersao,
            origemDado: 'xml',
            atualizadoEm: agora
        };

        if (existente) {
            // Nunca mexe em origem/dataLimite/observação já preenchidas pelo
            // usuário — só os campos que vêm do XML são atualizados. E o
            // nomeOficial (relatório do SmartCompras) é preservado item a
            // item, já que o XML reimportado nunca traz esse campo.
            dadosPrincipal.itens = preservarNomeOficialAoReimportar(existente.itens, parsed.itens);
            await cotacoesCollection.doc(parsed.pedido).set(dadosPrincipal, { merge: true });
            toast(`✓ Pedido ${parsed.pedido} atualizado para a versão ${proximaVersao}!`);
        } else {
            // Data do Pedido = data de finalização do pedido no XML (Data_Vencimento
            // do Cabeçalho) — antes ficava com a data do dia da importação, que não
            // tem relação com quando o pedido de fato fechou. Data Limite sugerida =
            // Data do Pedido + 5 dias (prazo padrão), sempre editável manualmente.
            const dataPedidoDoXml = converterDataBRparaISO(parsed.dataVencimento);
            dadosPrincipal.origem = '';
            dadosPrincipal.dataPedido = dataPedidoDoXml || new Date().toISOString().slice(0, 10);
            dadosPrincipal.dataLimite = dataPedidoDoXml ? somarDiasISO(dataPedidoDoXml, 5) : '';
            dadosPrincipal.observacao = '';
            dadosPrincipal.criadoEm = agora;
            await cotacoesCollection.doc(parsed.pedido).set(dadosPrincipal);
            toast(`✓ Pedido ${parsed.pedido} importado! Defina a Origem (Santa Casa/CTI) — datas já sugeridas a partir do XML.`);
            // Anotação "resumo vivo" do pedido, criada automaticamente na primeira
            // importação — só nesse branch (cotação nova), nunca no de reimportação/
            // atualização, que não deve ser alterado.
            await criarOuAtualizarAnotacaoDaCotacao(parsed.pedido, '', dadosPrincipal.dataPedido, dadosPrincipal.dataLimite, dadosPrincipal.fornecedores);
        }

        if (dataLimiteSugerida && existente) {
            toast(`Sugestão de data limite de entrega: ${dataLimiteSugerida.split('-').reverse().join('/')} (baseada no XML — confirme manualmente).`);
        }

        // Se um relatório de fornecedores ganhadores já tinha sido colado
        // ANTES desta cotação existir (Parte 3 da correção — pode acontecer
        // nos dois sentidos), complementa o nome oficial agora, sem esperar
        // o usuário colar de novo. Usa dadosPrincipal.itens (o que acabou
        // de ser gravado) direto, não a lista em cache — o snapshot local
        // ainda não teve tempo de refletir esta escrita.
        const relatorioPendente = listaRelatorioGanhadores.find(r => r.pedido === parsed.pedido);
        if (relatorioPendente) {
            const cruzamento = cruzarRelatorioComCotacao({ pedido: parsed.pedido, itens: dadosPrincipal.itens }, agruparGanhadoresPorFornecedor(relatorioPendente.itens));
            if (cruzamento.atualizacoes.length > 0) {
                const itensComplementados = dadosPrincipal.itens.map(it => {
                    const match = cruzamento.atualizacoes.find(a => a.codProduto === it.codProduto && a.cnpjFornecedor === it.cnpjFornecedor);
                    return match ? { ...it, nomeOficial: match.nomeOficial } : it;
                });
                await cotacoesCollection.doc(parsed.pedido).update({ itens: itensComplementados, atualizadoEm: new Date().toISOString() });
                toast(`✓ ${cruzamento.atualizacoes.length} nome(s) de produto complementado(s) a partir do relatório de ganhadores já importado.`);
            }
        }

        cancelarImportacaoXml();
        await abrirCentralPedido(parsed.pedido);
    } catch (e) {
        console.error('Erro ao importar cotação:', e);
        toast('✕ Erro ao importar. Tente novamente.');
    }
}

// ============================================================
// RELATÓRIO TEXTUAL DO SMARTCOMPRAS — complementa o XML com o nome oficial
// do produto (informação que o XML simplesmente não exporta). Entrada
// textual determinística, colada direto do navegador — sem OCR, sem
// reconhecimento visual, sem adivinhação.
//
// REGRA DEFINITIVA (várias rodadas de revisão até chegar aqui):
// - O cruzamento confirmado (código SmartCompras + CNPJ do fornecedor,
//   dentro do MESMO pedido) só prova que XML e relatório descrevem o mesmo
//   ITEM DAQUELA COTAÇÃO. Isso NUNCA cria uma identidade de produto entre
//   pedidos diferentes — essa identidade definitiva será o código do SP
//   Data, numa fase futura ainda não implementada.
// - Nome oficial do relatório enriquece o item (campo novo: nomeOficial),
//   nunca substitui nem se mistura com a observação do fornecedor
//   (campo já existente: descricao — mantido como está no banco pra não
//   tocar no caminho de escrita do XML já testado).
// - Nenhum número dentro de uma observação (ex: "(301982)" na observação da
//   agulha) é extraído ou interpretado como código de fornecedor — isso é
//   texto livre, nunca fonte de identidade.
// - Sem correspondência exata (código+CNPJ) → item fica de fora, mostrado
//   como pendente, nunca "no chute".
// ============================================================

// Converte o resultado plano de parseRelatorioFornecedoresGanhadores (uma
// linha por item, com o fornecedor vencedor embutido) pro formato agrupado
// por fornecedor que cruzarRelatorioComCotacao espera. É só uma
// reorganização dos MESMOS dados já parseados — nenhuma nova leitura de
// texto, nenhuma identificação adicional.
function agruparGanhadoresPorFornecedor(itensGanhadores) {
    const porCnpj = {};
    itensGanhadores.forEach(it => {
        const cnpj = it.fornecedorVencedor.cnpj;
        if (!porCnpj[cnpj]) porCnpj[cnpj] = { cnpj, razaoSocial: it.fornecedorVencedor.nome, itens: [] };
        porCnpj[cnpj].itens.push({ codigo: it.codigo, produto: it.nomeProduto, quantidade: String(it.quantidade) });
    });
    return { fornecedores: Object.values(porCnpj) };
}

// Cruza o relatório já parseado com a cotação já cadastrada — determinístico
// por código SmartCompras + CNPJ, nada mais. Quantidade/valor unitário só
// servem de checagem cruzada (avisa se não bater, nunca decide sozinho).
function cruzarRelatorioComCotacao(cotacao, relatorio) {
    const atualizacoes = []; // { codProduto, cnpjFornecedor, nomeOficial }
    const semCorrespondencia = [];
    const divergenciasDetectadas = [];

    relatorio.fornecedores.forEach(fRel => {
        fRel.itens.forEach(itRel => {
            const itemCotacao = (cotacao.itens || []).find(it => it.codProduto === itRel.codigo && it.cnpjFornecedor === fRel.cnpj);
            if (!itemCotacao) {
                semCorrespondencia.push({ codigo: itRel.codigo, produto: itRel.produto, fornecedor: fRel.razaoSocial });
                return;
            }
            atualizacoes.push({ codProduto: itRel.codigo, cnpjFornecedor: fRel.cnpj, nomeOficial: itRel.produto });

            const qtdXml = parseFloat((itemCotacao.quantidade || '').replace(/\./g, '').replace(',', '.'));
            const qtdRel = parseFloat((itRel.quantidade || '').replace(/\./g, '').replace(',', '.'));
            if (!isNaN(qtdXml) && !isNaN(qtdRel) && qtdXml !== qtdRel) {
                divergenciasDetectadas.push(`${itRel.produto}: quantidade no XML (${itemCotacao.quantidade}) difere do relatório (${itRel.quantidade})`);
            }
        });
    });

    return { atualizacoes, semCorrespondencia, divergenciasDetectadas };
}

// ===== Lógica central única — usada pelos DOIS pontos de entrada =====
// (tela geral de Cotações e Central do Pedido). Resolve o bug relatado: os
// dois pontos de entrada tinham parsers DIFERENTES — só parseRelatorioFor-
// necedoresGanhadores realmente casa com o formato real do relatório (a
// identificação do fornecedor vencedor é sempre estrutural: nome
// imediatamente antes da linha "CNPJ:", nunca por nome aproximado). O outro
// parser (parseRelatorioSmartCompras, removido) esperava um cabeçalho de
// tabela que o relatório real não tem, então nunca reconhecia os
// fornecedores corretamente nesse ponto de entrada — essa era a causa real,
// não um problema de exibição.
//
// Grava em DOIS lugares já existentes, nunca numa coleção nova:
// 1) relatorioGanhadores/{pedido} — registro completo (todos os
//    participantes por item, contagem de cotações) usado pela Central do
//    Pedido e pela Fase 7 (Analisar por item).
// 2) cotacoes/{pedido}.itens[].nomeOficial — só quando já existe cotação
//    cadastrada pra esse pedido, complementando o nome oficial do produto
//    (o XML não traz isso). Nunca cria nem redefine outros campos do item.
async function salvarRelatorioGanhadoresEComplementarCotacao(resultado) {
    await relatorioGanhadoresCollection.doc(resultado.pedido).set({
        pedido: resultado.pedido,
        descricao: resultado.descricao,
        itens: resultado.itens,
        excecoes: resultado.excecoes,
        importadoEm: new Date().toISOString()
    });

    const cotacao = listaCotacoes.find(c => c.pedido === resultado.pedido);
    if (!cotacao) return { cotacaoExiste: false, nomesComplementados: 0 };

    const relatorioAgrupado = agruparGanhadoresPorFornecedor(resultado.itens);
    const cruzamento = cruzarRelatorioComCotacao(cotacao, relatorioAgrupado);
    if (cruzamento.atualizacoes.length > 0) {
        const novosItens = (cotacao.itens || []).map(it => {
            const match = cruzamento.atualizacoes.find(a => a.codProduto === it.codProduto && a.cnpjFornecedor === it.cnpjFornecedor);
            return match ? { ...it, nomeOficial: match.nomeOficial } : it;
        });
        await cotacoesCollection.doc(resultado.pedido).update({ itens: novosItens, atualizadoEm: new Date().toISOString() });
    }
    return { cotacaoExiste: true, nomesComplementados: cruzamento.atualizacoes.length, semCorrespondencia: cruzamento.semCorrespondencia, divergenciasDetectadas: cruzamento.divergenciasDetectadas };
}

// ----- Ponto de entrada: Central do Pedido -----
let relatorioSmartComprasPendente = null;

function processarRelatorioSmartComprasColado() {
    const texto = document.getElementById('relatorio-smartcompras-texto').value.trim();
    if (!texto) return toast('Cole o texto do relatório antes de processar.');
    if (!centralPedidoAtual) return;

    const resultado = parseRelatorioFornecedoresGanhadores(texto);
    if (!resultado.pedido) return toast('✕ Não consegui interpretar esse texto. Confira se é o relatório de fornecedores ganhadores.');
    if (resultado.pedido !== centralPedidoAtual) {
        return toast(`✕ Esse relatório é do pedido ${resultado.pedido}, mas você está na Central do pedido ${centralPedidoAtual}.`);
    }
    if (resultado.itens.length === 0) return toast('✕ Nenhum fornecedor/item reconhecido nesse texto.');

    const cotacao = listaCotacoes.find(c => c.pedido === centralPedidoAtual);
    const cruzamento = cotacao ? cruzarRelatorioComCotacao(cotacao, agruparGanhadoresPorFornecedor(resultado.itens)) : null;
    relatorioSmartComprasPendente = resultado;

    const resumoEl = document.getElementById('relatorio-smartcompras-resumo');
    let html = `<div class="xml-resumo-linha"><strong>Fornecedores no relatório:</strong> ${new Set(resultado.itens.map(it => it.fornecedorVencedor.cnpj)).size}</div>`;
    html += `<div class="xml-resumo-linha"><strong>Itens no relatório:</strong> ${resultado.itens.length}</div>`;
    if (!cotacao) {
        html += `<div class="xml-resumo-linha">⚠ Ainda não existe cotação cadastrada pra este pedido — o relatório fica guardado e o complemento de nome acontece automaticamente assim que a cotação for importada.</div>`;
    } else {
        html += `<div class="xml-resumo-linha"><strong>Nomes que serão complementados:</strong> ${cruzamento.atualizacoes.length}</div>`;
        if (cruzamento.semCorrespondencia.length > 0) {
            html += `<div class="xml-diff-titulo">Itens do relatório sem correspondência na cotação (não afetados):</div><ul class="xml-diff-lista">${cruzamento.semCorrespondencia.map(x => `<li>${x.codigo} — ${x.produto} (${x.fornecedor})</li>`).join('')}</ul>`;
        }
        if (cruzamento.divergenciasDetectadas.length > 0) {
            html += `<div class="xml-diff-titulo">Possíveis divergências detectadas (revisar, não corrigidas automaticamente):</div><ul class="xml-diff-lista">${cruzamento.divergenciasDetectadas.map(l => `<li>${l}</li>`).join('')}</ul>`;
        }
    }
    if (resultado.excecoes.length) {
        html += `<div class="xml-diff-titulo">${resultado.excecoes.length} exceção(ões) no relatório:</div><ul class="xml-diff-lista">${resultado.excecoes.map(e => `<li>${e.motivo} (${e.nomeProduto})</li>`).join('')}</ul>`;
    }
    resumoEl.innerHTML = html;
    document.getElementById('relatorio-smartcompras-preview').style.display = 'block';
}

function cancelarRelatorioSmartCompras() {
    relatorioSmartComprasPendente = null;
    document.getElementById('relatorio-smartcompras-preview').style.display = 'none';
    document.getElementById('relatorio-smartcompras-texto').value = '';
}

async function confirmarRelatorioSmartCompras() {
    if (!relatorioSmartComprasPendente) return;
    try {
        const r = await salvarRelatorioGanhadoresEComplementarCotacao(relatorioSmartComprasPendente);
        toast(r.cotacaoExiste ? `✓ Relatório salvo — ${r.nomesComplementados} nome(s) de produto complementado(s).` : '✓ Relatório salvo — será aplicado à cotação assim que ela for importada.');
        cancelarRelatorioSmartCompras();
        if (centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
    } catch (e) {
        console.error('Erro ao salvar relatório de fornecedores ganhadores:', e);
        toast('✕ Erro ao salvar. Tente novamente.');
    }
}

// ============================================================
// PRODUTOS SP DATA — camada de identidade padronizada, independente da
// cotação. produtosSpData/{codigoSpData} é a fonte da verdade do cadastro;
// associacoesSpData/{codigoSmartCompras} é a camada que liga um código
// externo (SmartCompras) a essa identidade. Nada disso toca em
// cotacoes/{pedido}.itens[] — a associação é resolvida ao vivo na Central,
// nunca gravada dentro do item, pra uma correção futura refletir em todos
// os pedidos que usam aquele código automaticamente.
//
// Parser já validado com o arquivo real (2.665 produtos, zero duplicidade,
// largura de coluna confirmada pela borda do relatório, ISO-8859-1) — só
// portado pra JS aqui, sem repetir a validação.
// ============================================================

function parseInventarioSpData(texto) {
    const linhas = texto.split('\n');
    const produtos = [];
    // Posições fixas de coluna (mesmas encontradas nos '+' da borda do
    // relatório real): Código, Nome, Unidade, Quantidade, Contagem, Preço.
    const P = { codigo: [0, 7], nome: [7, 45], unidade: [45, 54], quantidade: [54, 67], preco: [81, 95] };
    linhas.forEach(l => {
        if (!/^\s*\d+\s/.test(l) || l.includes('Pag:')) return; // pula cabeçalho/rodapé/linhas de total
        const codigo = l.slice(P.codigo[0], P.codigo[1]).trim();
        const nome = l.slice(P.nome[0], P.nome[1]).trim();
        const unidade = l.slice(P.unidade[0], P.unidade[1]).trim();
        const quantidade = l.slice(P.quantidade[0], P.quantidade[1]).trim();
        const preco = l.slice(P.preco[0], P.preco[1]).trim();
        if (!codigo || !nome) return;
        produtos.push({ codigo, nome: upAud(nome), unidade, quantidade, preco });
    });
    return produtos;
}

let inventarioSpDataPendente = null;

function processarInventarioSpDataColado() {
    const texto = document.getElementById('spdata-inventario-texto').value;
    if (!texto.trim()) return toast('Cole o texto do relatório antes de processar.');
    const produtos = parseInventarioSpData(texto);
    if (produtos.length === 0) return toast('✕ Nenhum produto reconhecido nesse texto.');

    const codigosExistentes = new Set(listaProdutosSpData.map(p => p.codigo));
    const novos = produtos.filter(p => !codigosExistentes.has(p.codigo)).length;
    const atualizados = produtos.length - novos;

    inventarioSpDataPendente = produtos;
    document.getElementById('spdata-resumo').innerHTML = `
        <div class="xml-resumo-linha"><strong>Produtos no relatório:</strong> ${produtos.length}</div>
        <div class="xml-resumo-linha"><strong>Novos:</strong> ${novos}</div>
        <div class="xml-resumo-linha"><strong>Já cadastrados (serão atualizados):</strong> ${atualizados}</div>
    `;
    document.getElementById('spdata-preview').style.display = 'block';
}

function cancelarImportacaoSpData() {
    inventarioSpDataPendente = null;
    document.getElementById('spdata-preview').style.display = 'none';
    document.getElementById('spdata-inventario-texto').value = '';
}
function atualizarContagemSpData() {
    renderListaProdutosSpData();
}

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
    try {
        await produtosSpDataCollection.doc(codigo).update({
            nome,
            unidade: unidadeInput ? unidadeInput.value.trim() : '',
            nomeEditadoManualmente: true,
            atualizadoEm: new Date().toISOString()
        });
        produtoSpDataEditando.delete(codigo);
        toast('✓ Produto atualizado.');
    } catch (e) {
        console.error('Erro ao renomear produto SP Data:', e);
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
                <div class="actions-row">
                    <button class="actions-button is-success" onclick="salvarNomeProdutoSpData('${p.codigo}')"><span class="icon-wrapper"><i class="fa-solid fa-check"></i></span> Salvar</button>
                    <button class="actions-button is-neutral" onclick="toggleEditarNomeProdutoSpData('${p.codigo}')">Cancelar</button>
                </div>
            </div>`;
        }
        return `<div class="nota-item" style="flex-direction:column;align-items:stretch;gap:4px;${inativo ? 'opacity:0.55;' : ''}">
            <div class="nota-info">${escRel(p.codigo)} — ${escRel(p.nome || '')}${inativo ? ' <span style="font-size:11px;color:var(--button-danger);">(inativo)</span>' : ''}</div>
            <div class="nota-detalhes">${p.unidade ? 'Unidade: ' + escRel(p.unidade) : ''}</div>
            <div class="actions-row">
                <button type="button" class="central-status-toggle" onclick="toggleEditarNomeProdutoSpData('${p.codigo}')">Renomear</button>
                <button type="button" class="central-status-toggle" onclick="alternarAtivoProdutoSpData('${p.codigo}')">${inativo ? 'Reativar' : 'Inativar'}</button>
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

// Junta nfsProcessadas + entradasErp pela mesma chave (nf_serie). Cobre os 3
// casos possíveis: NF processada por XML e já vinculada ao ERP; NF só
// processada por XML (ERP ainda não chegou); e NF que entrou só pelo
// relatório do ERP sem nunca ter passado pelo Editor XML (ex.: fornecedor
// bloqueado ou qualquer outro caso em que não há XML disponível — esse fluxo
// de identificação/pré-seleção/bloqueio é da Fase 5, do agente 1; aqui só
// exibimos o resultado, não alteramos como ele chega) — os três ficam
// marcados com uma origem diferente, sem se confundir.
function montarHistoricoNfs() {
    const porChave = {};
    listaNfsProcessadas.forEach(nf => {
        const chave = nf.serie ? `${nf.nf}_${nf.serie}` : nf.nf;
        if (!chave) return;
        porChave[chave] = porChave[chave] || {};
        porChave[chave].nf = nf;
    });
    listaEntradasErp.forEach(erp => {
        // Entrada ainda em pré-seleção (Fase 5) é uma decisão pendente do
        // usuário — não é um registro concluído, então não deve aparecer na
        // linha do tempo do Histórico ainda. Some some depois de decidida
        // (arquivada, historico_direto ou selecionada_financeiro).
        if (erp.statusFluxo === 'pre_selecao') return;
        const chave = erp.serie ? `${erp.nf}_${erp.serie}` : erp.nf;
        if (!chave) return;
        porChave[chave] = porChave[chave] || {};
        porChave[chave].erp = erp;
    });

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

function filtrarHistoricoNfs(texto) {
    historicoFiltroTexto = texto || '';
    renderHistoricoNfs();
}

function selecionarAnoHistorico(ano) {
    historicoAnoSelecionado = ano;
    historicoMesSelecionado = null;
    historicoNfExpandida = null;
    renderHistoricoNfs();
}
function selecionarMesHistorico(mes) {
    historicoMesSelecionado = mes;
    historicoNfExpandida = null;
    renderHistoricoNfs();
}
function voltarNavegacaoHistorico() {
    if (historicoMesSelecionado) historicoMesSelecionado = null;
    else if (historicoAnoSelecionado) historicoAnoSelecionado = null;
    historicoNfExpandida = null;
    renderHistoricoNfs();
}
function toggleDetalheHistoricoNf(chave) {
    historicoNfExpandida = historicoNfExpandida === chave ? null : chave;
    renderHistoricoNfs();
}

function renderCardHistoricoNf(item) {
    if (item.tipo === 'nota_legado') {
        const n = item.notaLegado;
        return `<div class="nota-item" style="flex-direction:column;align-items:stretch;gap:4px;">
            <div class="nota-info">${escRel(item.nomeFornecedor)} ${escRel(item.numeroNf)} <span style="font-size:10px;color:var(--text-light);font-weight:400;">(registro simples arquivado)</span></div>
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
            ? item.nf.itens.map(i => `<div class="central-item-linha">${escRel(i.xProd)} — cód. fornecedor ${escRel(i.cProd)}${i.codigoSmartCompras ? ' · SmartCompras ' + escRel(i.codigoSmartCompras) : ''}${i.codigoSpData ? ' · SP Data ' + escRel(i.codigoSpData) : ''} · qtd ${i.quantidade}</div>`).join('')
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

function renderHistoricoNfs() {
    const nav = document.getElementById('historico-nfs-navegacao');
    const lista = document.getElementById('historico-nfs-lista');
    if (!nav || !lista) return;

    const todos = montarLinhaDoTempoHistorico();
    const termo = normalizarBuscaRel(historicoFiltroTexto.trim());

    const acaoLegadoHTML = historicoNotas.length
        ? `<div style="margin-top:8px;"><button type="button" class="central-status-toggle" onclick="limparHistorico()">Limpar registros simples arquivados (legado) — ${historicoNotas.length}</button></div>`
        : '';

    // Busca sobrepõe a navegação: mostra resultado achatado de qualquer Ano/Mês.
    if (termo) {
        nav.innerHTML = '';
        const encontrados = todos.filter(item => textoBuscavelHistoricoNf(item).includes(termo))
            .sort((a, b) => (b.dataISO || '').localeCompare(a.dataISO || ''));
        lista.innerHTML = (encontrados.length
            ? encontrados.map(item => renderCardHistoricoNf(item)).join('')
            : '<div class="empty-state">Nenhum registro encontrado.</div>') + acaoLegadoHTML;
        return;
    }

    if (historicoAnoSelecionado && historicoMesSelecionado) {
        const doMes = todos.filter(item => item.ano === historicoAnoSelecionado && item.mes === historicoMesSelecionado)
            .sort((a, b) => (b.dataISO || '').localeCompare(a.dataISO || ''));
        nav.innerHTML = `<button type="button" class="central-status-toggle" onclick="voltarNavegacaoHistorico()">← ${NOMES_MESES_HISTORICO[parseInt(historicoMesSelecionado, 10) - 1]}/${historicoAnoSelecionado}</button>`;
        lista.innerHTML = (doMes.length ? doMes.map(item => renderCardHistoricoNf(item)).join('') : '<div class="empty-state">Nenhum registro neste mês.</div>') + acaoLegadoHTML;
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
async function reconstruirPainelFotosEdit(notaId){const nota=notasPendentes.find(n=>n.id===notaId);if(!nota)return;const painelEdicao=document.querySelector(`div[data-note-id="${notaId}"] .edit-panel`);painelEdicao.innerHTML=`<div class="panel-content"><div class="campo"><label>Fornecedor</label><input type="text" class="fornEdit" value="${nota.fornecedor||''}"></div><div class="campo"><label>NF</label><input type="text" class="nfEdit" value="${nota.nf||''}"></div><div class="campo"><label>Vencimento</label><input type="text" class="vencEdit" value="${nota.vencimento||''}" oninput="formatarDataInput(this)"></div><div class="campo"><label>Valor</label><input type="text" class="valorEdit" value="${nota.valor||''}" onblur="formatarValorBlur(event)"></div><div class="campo"><label>Observações</label><select class="obsEdit">${DOM.obs.innerHTML}</select></div><div class="actions"><button class="actions-button is-success" onclick="salvarEdicao('${nota.id}')"><span class="icon-wrapper"><i class="fa-solid fa-save"></i><span class="material-icons">save</span></span> Salvar</button></div></div>`;painelEdicao.querySelector('.obsEdit').value=nota.obs||'';}
async function compartilharLista(){const texto=DOM.saida.value;if(!texto.trim())return toast("Nada para compartilhar.");if(navigator.share){await navigator.share({title:'Relação de Notas Fiscais',text:texto})}else{await navigator.clipboard.writeText(texto);toast("Copiado!")}}
async function exportar(){if(DOM.saida.value==="")return toast("Nada para copiar.");await navigator.clipboard.writeText(DOM.saida.value);toast("✓ Lista copiada!")}

// ===================================================================
// --- IMPORTAÇÃO DE RELATÓRIO DO ERP (Relação de Notas Fiscais) ---
// ===================================================================
// Formato de origem: relatório TXT tipo "Sistema de Gestao Hospitalar -
// Controle de Estoque - Relacao de notas fiscais". Cada nota fiscal vem
// em um bloco com cabeçalho "Nota fiscal: NNNN Documento: NN", seguido
// dos itens, do resumo financeiro (Frete/Total da nota) e de uma tabela
// "Seq. Vencimento Valor" com uma ou mais parcelas.
//
// Regras de reconhecimento:
// 1) Vencimento usado = data da 1ª parcela (Seq 1) da tabela de vencimentos.
// 2) Data da nota = "Data de emissão" quando existir no relatório; quando
//    não houver (caso deste formato, que só traz "lançada em"), usa-se a
//    data de lançamento como substituta.
// 3) Valor total = soma de todas as parcelas do quadro de vencimentos, já
//    que esse valor reflete frete e ajustes (ex.: um caso real do relatório
//    tem "Total da nota" sem o frete, mas o quadro de vencimentos já soma
//    o frete). Se a soma das parcelas ficar MENOR que o "Total da nota"
//    declarado, é sinal de que a tabela de vencimentos foi cortada por uma
//    quebra de página (também observado no relatório real) — nesse caso
//    usa-se o "Total da nota" e a nota é marcada com aviso para revisão.

let notasImportadasPreview = [];
let mostrarApenasNovasImportacao = true;

function parseValorBR(str) {
    if (!str) return 0;
    const limpo = String(str).trim().replace(/\./g, '').replace(',', '.');
    const n = parseFloat(limpo);
    return isNaN(n) ? 0 : n;
}

function formatValorBR(num) {
    return (num || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Colunas de largura fixa da tabela de itens (mesmo estilo já usado no
// importador de inventário do SP Data — ver P em confirmarImportacaoSpData).
// Posições calculadas a partir da linha separadora "+------+----...+" do
// próprio relatório real (0409.TXT): cada '+' marca o limite de uma coluna.
const COLUNAS_ITEM_ERP = { codigo: [0, 7], nome: [7, 48], unidade: [48, 55], lc: [55, 58], quantidade: [58, 71], icms: [71, 82], ipi: [82, 94], desconto: [94, 105], valorUnitario: [105, 119], valorTotal: [119, 132] };

// Extrai os itens de um bloco de NF já isolado por parseRelatorioERP. O
// "Código" de cada linha É o código do produto no SP Data (produtosSpData) —
// não precisa de nenhuma associação intermediária pra chegar lá. Usa posição
// fixa de coluna (não regex) pra não se confundir com nomes de produto que
// têm números/parênteses/barras. Uma linha só é aceita como item quando o
// código é só dígitos E a unidade não é vazia nem só dígitos — isso separa
// itens de linhas de rodapé, da tabela de vencimentos e de cabeçalhos de
// página repetidos (quando a nota quebra em mais de uma página).
function extrairItensBlocoErp(blocoTexto) {
    return blocoTexto.split('\n').reduce((itens, linhaOriginal) => {
        const linha = linhaOriginal.padEnd(132, ' ');
        const seg = (chave) => linha.slice(COLUNAS_ITEM_ERP[chave][0], COLUNAS_ITEM_ERP[chave][1]).trim();
        const codigo = seg('codigo');
        const unidade = seg('unidade');
        if (!/^\d+$/.test(codigo) || !unidade || /^\d+$/.test(unidade)) return itens;
        itens.push({
            codigoSpData: codigo,
            nome: seg('nome'),
            unidade,
            quantidade: parseValorBR(seg('quantidade')),
            icmsPercentual: parseValorBR(seg('icms').replace('%', '')),
            ipiPercentual: parseValorBR(seg('ipi').replace('%', '')),
            descontoPercentual: parseValorBR(seg('desconto').replace('%', '')),
            valorUnitario: parseValorBR(seg('valorUnitario')),
            valorTotal: parseValorBR(seg('valorTotal'))
        });
        return itens;
    }, []);
}

function parseRelatorioERP(textoOriginal) {
    const t = String(textoOriginal || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Localiza todos os cabeçalhos de bloco "Nota fiscal: NNN Documento: NN"
    const blockStartRe = /\|\s*Nota fiscal:\s*(\d+)\s+Documento:\s*(\d+)/g;
    const starts = [];
    let m;
    while ((m = blockStartRe.exec(t)) !== null) {
        starts.push({ pos: m.index, nf: m[1], doc: m[2] });
    }
    if (starts.length === 0) return [];
    starts.push({ pos: t.length, nf: null, doc: null });

    // Agrupa blocos repetidos (o mesmo NF+Documento aparece de novo quando
    // o relatório quebra de página no meio de uma nota)
    const blocks = [];
    let i = 0;
    while (i < starts.length - 1) {
        const atual = starts[i];
        let j = i + 1;
        let end = starts[j].pos;
        while (j < starts.length - 1 && starts[j].nf === atual.nf && starts[j].doc === atual.doc) {
            j++;
            end = starts[j].pos;
        }
        blocks.push({ nf: atual.nf, doc: atual.doc, texto: t.slice(atual.pos, end) });
        i = j;
    }

    return blocks.map(({ nf, doc, texto: bloco }) => {
        const avisos = [];

        // Fornecedor: código de cadastro no SP Data (útil por si só, e é a
        // chave que futuramente vai resolver o CNPJ via cadastro oficial de
        // fornecedores) + nome, na mesma linha do relatório.
        const fornMatch = bloco.match(/Fornecedor:\s*(\d+)\s+(.+?)\s+Qtde\.\s*lan[cç]amentos/i);
        const codigoFornecedorSpData = fornMatch ? fornMatch[1] : '';
        const fornecedor = fornMatch ? fornMatch[2].trim().toUpperCase().replace(/\s+/g, ' ') : '';
        if (!fornecedor) avisos.push('Não foi possível identificar o fornecedor — confira manualmente.');

        const serieMatch = bloco.match(/S[eé]rie:\s*(\S+)/i);
        const serie = serieMatch ? serieMatch[1] : '';

        // Data da nota: usa "Data de emissão" se existir; senão, "lançada em"
        let data = '';
        const emissaoMatch = bloco.match(/Data\s*de\s*Emiss[aã]o\s*[:.]*\s*(\d{2}\/\d{2}\/\d{4})/i) || bloco.match(/Emiss[aã]o\s*[:.]*\s*(\d{2}\/\d{2}\/\d{4})/i);
        const lancadaMatch = bloco.match(/lan[cç]ada em\s+(\d{2}\/\d{2}\/\d{4})/i);
        if (emissaoMatch) {
            data = emissaoMatch[1];
        } else if (lancadaMatch) {
            data = lancadaMatch[1];
        } else {
            avisos.push('Data de emissão/lançamento não encontrada — preencha manualmente.');
        }

        // Quadro "Seq. Vencimento Valor"
        const vencRe = /^\s*(\d{1,3})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.]+,\d{2})/gm;
        const parcelas = [];
        let vm;
        while ((vm = vencRe.exec(bloco)) !== null) {
            parcelas.push({ seq: parseInt(vm[1], 10), data: vm[2], valor: parseValorBR(vm[3]) });
        }
        parcelas.sort((a, b) => a.seq - b.seq);

        const totalNotaMatch = bloco.match(/Total da nota\.*:\s*([\d.]+,\d{2})/i);
        const freteMatch = bloco.match(/Frete\.*:\s*([\d.]+,\d{2})/i);
        const totalNota = totalNotaMatch ? parseValorBR(totalNotaMatch[1]) : null;
        const frete = freteMatch ? parseValorBR(freteMatch[1]) : 0;

        // Demais campos financeiros do rodapé — só leitura/armazenamento,
        // nenhum entra no cálculo de `valor` (mantido como já era, pra não
        // mudar o que o fluxo de Adicionar Nota já usa).
        const seguroMatch = bloco.match(/Seguro\.*:\s*([\d.]+,\d{2})/i);
        const icmsValorMatch = bloco.match(/ICMS\s+de\s+[\d.,]+\s*%\.*:\s*([\d.]+,\d{2})/i);
        const outrasDespesasMatch = bloco.match(/Outras despesas\.*:\s*([\d.]+,\d{2})/i);
        const descontosObtidosMatch = bloco.match(/Descontos obtidos\.*:\s*([\d.]+,\d{2})/i);
        const fatorAjustagemMatch = bloco.match(/Fator de ajustagem\.*:\s*([\d.,]+)/i);
        const totalLancamentosMatch = bloco.match(/Total dos lan[cç]amentos\.*:\s*([\d.]+,\d{2})/i);
        const financeiro = {
            totalLancamentos: totalLancamentosMatch ? parseValorBR(totalLancamentosMatch[1]) : null,
            frete,
            seguro: seguroMatch ? parseValorBR(seguroMatch[1]) : 0,
            icmsValor: icmsValorMatch ? parseValorBR(icmsValorMatch[1]) : 0,
            outrasDespesas: outrasDespesasMatch ? parseValorBR(outrasDespesasMatch[1]) : 0,
            descontosObtidos: descontosObtidosMatch ? parseValorBR(descontosObtidosMatch[1]) : 0,
            fatorAjustagem: fatorAjustagemMatch ? fatorAjustagemMatch[1] : '',
            totalNota
        };

        const itens = extrairItensBlocoErp(bloco);

        let vencimento = '';
        let valorTotalNum = 0;

        if (parcelas.length > 0) {
            vencimento = parcelas[0].data;
            const somaParcelas = parcelas.reduce((s, p) => s + p.valor, 0);

            if (totalNota !== null && somaParcelas < totalNota - 0.01) {
                // Soma das parcelas não cobre o total da nota: provável quebra
                // de página cortando o quadro de vencimentos no meio.
                valorTotalNum = totalNota;
                avisos.push(`Quadro de vencimentos parece incompleto (soma das parcelas R$ ${formatValorBR(somaParcelas)} é menor que o total da nota R$ ${formatValorBR(totalNota)}). Foi usado o total da nota — confira as datas de vencimento.`);
            } else {
                valorTotalNum = somaParcelas;
            }
            if (parcelas.length > 1) {
                avisos.push(`Nota parcelada em ${parcelas.length}x. Foi usado o vencimento da 1ª parcela (${vencimento}) e o valor total soma todas as parcelas.`);
            }
        } else {
            avisos.push('Quadro de vencimentos não encontrado — usada a data de lançamento e o total da nota. Confira o vencimento manualmente.');
            vencimento = data;
            valorTotalNum = (totalNota !== null ? totalNota : 0) + frete;
        }

        return {
            nf: (nf || '').trim(),
            documento: doc,
            serie,
            codigoFornecedorSpData,
            fornecedor,
            data,
            vencimento,
            valor: formatValorBR(valorTotalNum),
            parcelas: parcelas.length,
            parcelasDetalhe: parcelas,
            itens,
            financeiro,
            avisos
        };
    });
}

// ===================================================================
// --- HISTÓRICO DE ENTRADAS DO ERP (entradasErp) ---
// ===================================================================
// Fonte independente: cada bloco de NF do relatório vira um doc, tal como
// veio do relatório (nf, série, código do fornecedor no SP Data, itens[]
// com o código SP Data direto, financeiro{}, parcelas). Nunca escreve em
// cotacoes/notas/associações — é só uma terceira fonte de leitura.
//
// Agora que o cadastro oficial de fornecedores (fornecedoresSpData) existe,
// o CNPJ é resolvido a partir do codigoFornecedorSpData na hora de salvar
// (ver vincularEntradaErpComNf) e gravado em `cnpjFornecedor` quando
// encontrado — nunca por semelhança de nome, e nunca escolhendo um CNPJ
// arbitrário quando o código tem mais de um cadastrado (nesse caso o vínculo
// fica pendente, ver a função de vínculo abaixo).
let listaEntradasErp = [];

function chaveEntradaErp(bloco) {
    return bloco.serie ? `${bloco.nf}_${bloco.serie}` : bloco.nf;
}

// ===================================================================
// --- CADASTRO OFICIAL DE FORNECEDORES DO SP DATA (fornecedoresSpData) ---
// ===================================================================
// Fonte: relatório de cadastro de fornecedores (pipe-delimited, largura
// fixa por campo). Campo 0 = código (com zeros à esquerda), campo 1 = CNPJ,
// campo 3 = nome real (razão social), campo 4 = nome exibido (fantasia).
// Resolve o codigoFornecedorSpData que vem no relatório de entrada em
// CNPJ(s) reais — nunca por nome.

// CNPJs "placeholder"/genéricos vistos no cadastro real (todos zeros, ou um
// valor repetido em dezenas de fornecedores sem relação nenhuma entre si —
// claramente um preenchimento padrão do sistema, não um CNPJ de verdade).
// Nunca tratar esses como vínculo válido.
const CNPJS_PLACEHOLDER_SPDATA = new Set(['00000000000000', '00000000000191']);
function cnpjValidoSpData(cnpj) {
    const limpo = String(cnpj || '').replace(/\D/g, '');
    if (limpo.length !== 14) return false;
    if (CNPJS_PLACEHOLDER_SPDATA.has(limpo)) return false;
    if (/^(\d)\1{13}$/.test(limpo)) return false; // todos os dígitos iguais
    return true;
}

function parseCadastroFornecedoresSpData(textoOriginal) {
    const t = String(textoOriginal || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const linhas = t.split('\n').filter(l => l.trim());
    const registros = [];
    linhas.forEach(linha => {
        const campos = linha.split('|');
        if (campos.length < 5) return; // linha fora do formato esperado — ignora, não inventa
        const codigo = String(parseInt(campos[0], 10));
        if (!codigo || codigo === 'NaN') return;
        const cnpjBruto = (campos[1] || '').trim();
        const nomeReal = (campos[3] || '').trim();
        const nomeExibido = (campos[4] || '').trim();
        registros.push({
            codigo,
            cnpj: cnpjValidoSpData(cnpjBruto) ? cnpjBruto.replace(/\D/g, '') : null,
            nomeReal,
            nomeExibido
        });
    });
    return registros;
}

// Mescla os registros novos no cadastro já carregado (listaFornecedoresSpData).
// Nunca sobrescreve nem remove um CNPJ já associado a um código — só
// acrescenta. Um código pode acumular mais de um CNPJ ao longo de
// reimportações (matriz/filial, recadastro etc.) — a estrutura nunca assume
// 1:1. Se o mesmo CNPJ for reimportado pro mesmo código, só atualiza o nome.
async function salvarCadastroFornecedoresSpData(registrosNovos) {
    if (!registrosNovos || !registrosNovos.length) return { novos: 0, atualizados: 0, cnpjsNovos: 0, ignorados: 0 };
    const agora = new Date().toISOString();
    const porCodigo = {};
    let ignorados = 0;
    registrosNovos.forEach(r => {
        if (!r.codigo) { ignorados++; return; }
        (porCodigo[r.codigo] = porCodigo[r.codigo] || []).push(r);
    });

    const existenteMap = {};
    listaFornecedoresSpData.forEach(doc => { existenteMap[doc.codigo] = doc; });

    let cnpjsNovos = 0, novos = 0, atualizados = 0;
    const codigos = Object.keys(porCodigo);
    for (let i = 0; i < codigos.length; i += 400) {
        const lote = codigos.slice(i, i + 400);
        const batch = firestore.batch();
        lote.forEach(codigo => {
            const registros = porCodigo[codigo];
            const existente = existenteMap[codigo];
            const cnpjsAtuais = existente ? [...existente.cnpjs] : [];
            registros.forEach(r => {
                if (!r.cnpj) { ignorados++; return; }
                const idx = cnpjsAtuais.findIndex(c => c.cnpj === r.cnpj);
                if (idx === -1) {
                    cnpjsAtuais.push({ cnpj: r.cnpj, nomeReal: r.nomeReal, nomeExibido: r.nomeExibido, importadoEm: agora });
                    cnpjsNovos++;
                } else {
                    cnpjsAtuais[idx] = { ...cnpjsAtuais[idx], nomeReal: r.nomeReal };
                }
            });
            const ultimoRegistro = registros[registros.length - 1];
            // Apelido definido manualmente pelo usuário nunca é sobrescrito por
            // uma reimportação — só usa o nomeExibido do relatório enquanto
            // ninguém tiver editado manualmente ainda.
            const apelidoManual = existente && existente.apelidoEditadoManualmente;
            batch.set(fornecedoresSpDataCollection.doc(codigo), {
                codigo,
                nomeReal: ultimoRegistro.nomeReal || (existente ? existente.nomeReal : ''),
                nomeExibido: apelidoManual ? existente.nomeExibido : (ultimoRegistro.nomeExibido || (existente ? existente.nomeExibido : '')),
                apelidoEditadoManualmente: apelidoManual || false,
                cnpjs: cnpjsAtuais,
                atualizadoEm: agora
            }, { merge: true });
            if (existente) atualizados++; else novos++;
        });
        await batch.commit();
    }
    return { novos, atualizados, cnpjsNovos, ignorados };
}

// Retorna os CNPJs válidos cadastrados pra um código de fornecedor do SP
// Data. Pode vir vazio (código sem CNPJ confiável cadastrado) — nesse caso o
// vínculo com a NF fica pendente, nunca é assumido.
function resolverCnpjsFornecedorSpData(codigo) {
    const doc = listaFornecedoresSpData.find(d => d.codigo === String(codigo));
    return doc ? doc.cnpjs.map(c => c.cnpj) : [];
}

function formatarCnpjExibicao(cnpj) {
    if (!cnpj || cnpj.length !== 14) return cnpj || '';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

// --- UI: importação do cadastro (tela Fornecedores) ---
let cadastroFornecedoresSpDataPreview = [];

function handleFornecedoresSpDataFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('import-fornspdata-textarea').value = decodificarArquivoTexto(e.target.result);
        toast('Arquivo carregado! Clique em "Processar Cadastro".');
    };
    reader.onerror = () => toast('Erro ao ler o arquivo.');
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

async function colarCadastroFornecedoresSpData() {
    const textarea = document.getElementById('import-fornspdata-textarea');
    try {
        textarea.value = await navigator.clipboard.readText();
        toast('Texto colado!');
    } catch (err) {
        toast('Permissão negada ou não suportada. Cole manualmente (Ctrl+V).');
    }
}

function processarCadastroFornecedoresSpData() {
    const textarea = document.getElementById('import-fornspdata-textarea');
    const texto = textarea ? textarea.value : '';
    if (!texto || !texto.trim()) return toast('Cole ou envie o arquivo do cadastro antes de processar.');
    const registros = parseCadastroFornecedoresSpData(texto);
    const preview = document.getElementById('import-fornspdata-preview');
    if (registros.length === 0) {
        preview.innerHTML = '<div class="empty-state">Nenhum fornecedor reconhecido neste texto. Confira o formato do arquivo.</div>';
        return;
    }
    cadastroFornecedoresSpDataPreview = registros;
    const semCnpj = registros.filter(r => !r.cnpj).length;
    preview.innerHTML = `
        <div class="central-item-vazio" style="margin-top:12px;">
            ${registros.length} fornecedor(es) reconhecido(s)${semCnpj ? `, ${semCnpj} sem CNPJ válido identificado` : ''}.
        </div>
        <div class="actions" style="margin-top:10px;">
            <button class="actions-button" onclick="confirmarImportacaoCadastroFornecedoresSpData()"><span class="icon-wrapper"><i class="fa-solid fa-check"></i></span> Confirmar Importação</button>
        </div>`;
    toast(`${registros.length} fornecedor(es) encontrado(s)!`);
}

async function confirmarImportacaoCadastroFornecedoresSpData() {
    if (!cadastroFornecedoresSpDataPreview.length) return;
    try {
        const r = await salvarCadastroFornecedoresSpData(cadastroFornecedoresSpDataPreview);
        toast(`✓ ${r.novos} novo(s), ${r.atualizados} atualizado(s), ${r.cnpjsNovos} CNPJ(s) novo(s)${r.ignorados ? `, ${r.ignorados} ignorado(s)` : ''}.`);
        cadastroFornecedoresSpDataPreview = [];
        document.getElementById('import-fornspdata-preview').innerHTML = '';
        document.getElementById('import-fornspdata-textarea').value = '';
    } catch (e) {
        console.error('Erro ao importar cadastro de fornecedores SP Data:', e);
        toast('✕ Erro ao importar o cadastro.');
    }
}

let filtroCadastroFornecedoresSpDataTexto = '';
// Desempenho: a lista de fornecedores tende a crescer bastante, e renderizar
// centenas de cards de uma vez (cada um com inputs de edição em potencial)
// trava a tela ao abrir. Em vez de paginação por página numerada, mostra um
// lote inicial e um botão "Carregar mais" — mais simples, sem trocar a
// arquitetura, e a busca continua rodando sobre a lista inteira (só a
// exibição é que é incremental).
const LOTE_FORNECEDORES = 40;
let limiteExibicaoFornecedores = LOTE_FORNECEDORES;
function filtrarCadastroFornecedoresSpData(texto) {
    filtroCadastroFornecedoresSpDataTexto = texto;
    limiteExibicaoFornecedores = LOTE_FORNECEDORES; // toda nova busca recomeça do lote 1
    renderListaFornecedoresUnificada();
}
function carregarMaisFornecedores() {
    limiteExibicaoFornecedores += LOTE_FORNECEDORES;
    renderListaFornecedoresUnificada();
}

// Edição do fornecedor: razão social, apelido/nome de exibição, e adicionar
// CNPJ manualmente. Nunca remove um CNPJ já cadastrado (histórico
// preservado) — só permite acrescentar. Uma vez editado manualmente, a
// reimportação do relatório nunca mais sobrescreve o apelido (ver
// salvarCadastroFornecedoresSpData).
let fornecedorEditando = new Set();
function toggleEditarApelidoFornecedor(chave) {
    if (fornecedorEditando.has(chave)) fornecedorEditando.delete(chave);
    else fornecedorEditando.add(chave);
    renderListaFornecedoresUnificada();
}

// Une os cadastros só pra exibição/busca — nenhum dado é migrado nem
// duplicado, cada fornecedor continua persistido na coleção de origem
// (fornecedoresSpData ou a lista simples/apelidos antiga). Fornecedores que
// já existem no cadastro oficial (por nome real, apelido/nome de exibição ou
// alias legado já vinculado manualmente) não aparecem duplicados vindos da
// lista simples — nunca por semelhança, só por correspondência exata com
// algo que já está gravado no cadastro oficial.
//
// Também agrupa, só pra exibição/busca, fornecedores com CNPJ que já foram
// vinculados manualmente como sendo a mesma entidade (matriz/filial/CD) via
// `entidadesRelacionadas` (ver vincularEntidadesFornecedor). Cada documento
// continua exatamente como está — nenhum CNPJ é movido ou apagado, o grupo é
// só uma lente pra mostrar "isso tudo é a mesma empresa".
function listaFornecedoresUnificada() {
    const porId = {};
    listaFornecedoresSpData.forEach(f => { porId[f.id] = f; });
    const visitado = new Set();
    const grupos = [];
    listaFornecedoresSpData.forEach(f => {
        if (visitado.has(f.id)) return;
        const grupo = [];
        const pilha = [f.id];
        while (pilha.length) {
            const atualId = pilha.pop();
            if (visitado.has(atualId) || !porId[atualId]) continue;
            visitado.add(atualId);
            grupo.push(porId[atualId]);
            (porId[atualId].entidadesRelacionadas || []).forEach(outroId => { if (!visitado.has(outroId)) pilha.push(outroId); });
        }
        grupos.push(grupo);
    });

    const nomesJaNoSpData = new Set();
    listaFornecedoresSpData.forEach(f => {
        if (f.nomeReal) nomesJaNoSpData.add(f.nomeReal.toUpperCase());
        if (f.nomeExibido) nomesJaNoSpData.add(f.nomeExibido.toUpperCase());
        (f.aliasesLegado || []).forEach(a => nomesJaNoSpData.add(String(a).toUpperCase()));
    });

    const doSpData = grupos.map(grupo => {
        // Fornecedor com código do SP Data já cadastrado tem prioridade como
        // registro "principal" de exibição — mas nenhum campo dos outros
        // documentos do grupo é descartado, só não vira o cabeçalho do card.
        const principal = grupo.find(d => d.codigo) || grupo[0];
        const todosCnpjs = [];
        grupo.forEach(d => (d.cnpjs || []).forEach(c => todosCnpjs.push({ ...c, docId: d.id, docCodigo: d.codigo })));
        const todosAliases = [...new Set(grupo.flatMap(d => d.aliasesLegado || []))];
        return {
            origem: 'spdata', chave: 'sp:' + principal.id,
            nomeReal: principal.nomeReal, nomeExibido: principal.nomeExibido,
            apelidoEditadoManualmente: principal.apelidoEditadoManualmente,
            cnpjs: todosCnpjs, aliasesLegado: todosAliases,
            docs: grupo
        };
    });

    const doLegado = fornecedoresSugeridos
        .filter(nome => !nomesJaNoSpData.has(String(nome).toUpperCase()))
        .map(nome => ({
            origem: 'legado', chave: 'lg:' + nome,
            nomeReal: nome, nomeExibido: apelidosFornecedores[String(nome).toUpperCase()] || '',
            apelidoEditadoManualmente: !!apelidosFornecedores[String(nome).toUpperCase()], cnpjs: [], docs: []
        }));
    return [...doSpData, ...doLegado].sort((a, b) => (a.nomeReal || '').localeCompare(b.nomeReal || ''));
}

// Vincula manualmente um fornecedor da lista simples/legada a um fornecedor
// já cadastrado (com código/CNPJ), como confirmação explícita do usuário de
// que é a mesma empresa. NUNCA é automático e NUNCA apaga o nome legado da
// lista simples (fornecedoresSugeridos) — ele continua existindo, por
// exemplo no autocomplete de "Adicionar Nota" e em notas antigas que já o
// referenciam. Só passa a valer como um alias de busca do fornecedor
// principal e some da lista de "possíveis duplicados".
async function vincularFornecedorLegadoAoCadastro(nomeLegado, idFornecedor) {
    const doc = listaFornecedoresSpData.find(f => f.id === idFornecedor);
    if (!doc) return toast('✕ Fornecedor cadastrado não encontrado.');
    try {
        await fornecedoresSpDataCollection.doc(idFornecedor).update({
            aliasesLegado: firebase.firestore.FieldValue.arrayUnion(nomeLegado)
        });
        toast(`✓ "${nomeLegado}" vinculado a ${doc.nomeReal}. O cadastro antigo não foi apagado, mas a busca agora encontra este fornecedor também por esse nome.`);
    } catch (e) {
        console.error('Erro ao vincular fornecedor legado:', e);
        toast('✕ Erro ao vincular fornecedor.');
    }
}

// Vincula dois fornecedores com CNPJ já cadastrados como sendo a MESMA
// entidade/empresa (ex.: matriz e filial, cada uma com seu próprio CNPJ).
// Nunca é automático — só acontece quando o usuário escolhe explicitamente.
// Nenhum CNPJ é movido, apagado ou sobrescrito: os dois documentos continuam
// existindo exatamente como estão, só passam a ser exibidos/buscados juntos.
async function vincularEntidadesFornecedor(idA, idB) {
    if (!idA || !idB) return toast('Selecione um fornecedor pra vincular.');
    if (idA === idB) return toast('Selecione um fornecedor diferente.');
    try {
        const batch = firestore.batch();
        batch.update(fornecedoresSpDataCollection.doc(idA), { entidadesRelacionadas: firebase.firestore.FieldValue.arrayUnion(idB) });
        batch.update(fornecedoresSpDataCollection.doc(idB), { entidadesRelacionadas: firebase.firestore.FieldValue.arrayUnion(idA) });
        await batch.commit();
        toast('✓ Vinculados como o mesmo fornecedor. Nenhum CNPJ foi apagado ou movido.');
    } catch (e) {
        console.error('Erro ao vincular entidades de fornecedor:', e);
        toast('✕ Erro ao vincular fornecedores.');
    }
}

async function salvarApelidoFornecedor(chave) {
    const nomeRealInput = document.getElementById(`nomereal-input-${chave}`);
    const apelidoInput = document.getElementById(`apelido-input-${chave}`);
    if (!nomeRealInput || !apelidoInput) return;
    const [origem, id] = [chave.slice(0, 2), chave.slice(3)];
    try {
        if (origem === 'sp') {
            await fornecedoresSpDataCollection.doc(id).update({
                nomeReal: nomeRealInput.value.trim(),
                nomeExibido: apelidoInput.value.trim(),
                apelidoEditadoManualmente: true
            });
        } else {
            // Fornecedor da lista simples (sem código/CNPJ ainda) — apelido
            // fica no mesmo dicionário já usado por encontrarApelidoFornecedor,
            // sem criar estrutura nova.
            const nomeAtual = id.toUpperCase();
            const updateData = {};
            updateData[`apelidosFornecedores.${nomeAtual}`] = apelidoInput.value.trim();
            await settingsDocRef.set(updateData, { merge: true });
        }
        fornecedorEditando.delete(chave);
        toast('✓ Fornecedor atualizado.');
    } catch (e) {
        console.error('Erro ao salvar fornecedor:', e);
        toast('✕ Erro ao salvar.');
    }
}
async function adicionarCnpjFornecedorManual(id) {
    const input = document.getElementById(`novo-cnpj-input-sp:${id}`);
    if (!input) return;
    const cnpj = input.value.replace(/\D/g, '');
    if (!cnpjValidoSpData(cnpj)) return toast('✕ CNPJ inválido ou é um valor placeholder — confira os dígitos.');
    const doc = listaFornecedoresSpData.find(f => f.id === id);
    if (doc && doc.cnpjs.some(c => c.cnpj === cnpj)) return toast('Esse CNPJ já está cadastrado pra este fornecedor.');
    try {
        const cnpjsAtuais = doc ? [...doc.cnpjs] : [];
        cnpjsAtuais.push({ cnpj, nomeReal: doc ? doc.nomeReal : '', nomeExibido: doc ? doc.nomeExibido : '', importadoEm: new Date().toISOString() });
        await fornecedoresSpDataCollection.doc(id).update({ cnpjs: cnpjsAtuais });
        input.value = '';
        toast('✓ CNPJ adicionado.');
    } catch (e) {
        console.error('Erro ao adicionar CNPJ:', e);
        toast('✕ Erro ao adicionar CNPJ.');
    }
}

// Cria automaticamente um fornecedor identificado por CNPJ quando uma NF via
// XML é salva e o CNPJ do emitente ainda não pertence a nenhum fornecedor
// cadastrado. Usa o mesmo cadastro (fornecedoresSpData), sem código do SP
// Data ainda (fica null — pode ser associado manualmente depois, quando o
// código correspondente for identificado). ID determinístico (xml-<cnpj>)
// evita criar duplicado se o mesmo CNPJ novo aparecer em duas NFs seguidas.
// Se o CNPJ já existir em qualquer fornecedor (com ou sem código), reaproveita
// e não cria nada.
async function garantirFornecedorPorCnpjXml(cnpj, razaoSocialXml) {
    if (!cnpj) return;
    const jaExiste = listaFornecedoresSpData.some(f => (f.cnpjs || []).some(c => c.cnpj === cnpj));
    if (jaExiste) return;
    try {
        const agora = new Date().toISOString();
        await fornecedoresSpDataCollection.doc('xml-' + cnpj).set({
            codigo: null,
            nomeReal: razaoSocialXml || '',
            nomeExibido: '',
            apelidoEditadoManualmente: false,
            cnpjs: [{ cnpj, nomeReal: razaoSocialXml || '', nomeExibido: '', importadoEm: agora }],
            origemCadastro: 'xml',
            atualizadoEm: agora
        }, { merge: true });
    } catch (e) {
        // Não interrompe o salvamento da NF por causa disso — só loga.
        console.error('Erro ao cadastrar fornecedor automaticamente a partir do XML:', e);
    }
}

function renderListaFornecedoresUnificada() {
    const container = document.getElementById('lista-cadastro-fornecedores-spdata');
    if (!container) return;
    // Bug antigo: quando o termo buscado não tinha nenhum dígito (ex.: busca
    // por nome), `termo.replace(/\D/g,'')` virava string vazia, e
    // `"qualquerCoisa".includes('')` é sempre true em JS — isso fazia TODO
    // fornecedor com CNPJ cadastrado aparecer em QUALQUER busca por nome,
    // misturado com os resultados corretos. Por isso só compara CNPJ quando
    // o termo realmente contém dígitos.
    const termoOriginal = filtroCadastroFornecedoresSpDataTexto.trim();
    const termo = normalizarBuscaRel(termoOriginal);
    const termoNumerico = termoOriginal.replace(/\D/g, '');
    const todos = listaFornecedoresUnificada();
    const lista = todos.filter(f => {
        if (!termoOriginal) return true;
        if ((f.docs || []).some(d => normalizarBuscaRel(d.codigo).includes(termo))) return true;
        if (normalizarBuscaRel(f.nomeReal).includes(termo)) return true;
        if (normalizarBuscaRel(f.nomeExibido).includes(termo)) return true;
        if ((f.aliasesLegado || []).some(a => normalizarBuscaRel(a).includes(termo))) return true;
        if (termoNumerico && f.cnpjs.some(c => c.cnpj.includes(termoNumerico))) return true;
        return false;
    });

    const contadorEl = document.getElementById('contador-fornecedores-spdata');
    if (contadorEl) contadorEl.textContent = `${todos.length} fornecedor(es) cadastrado(s)`;

    if (lista.length === 0) {
        container.innerHTML = `<div class="empty-state">${todos.length === 0 ? 'Nenhum fornecedor cadastrado ainda.' : 'Nenhum fornecedor encontrado.'}</div>`;
        return;
    }

    // Só renderiza o lote atual — a lista completa pode ter centenas de
    // fornecedores, e montar todos os cards de uma vez (cada um com inputs
    // de edição em potencial) trava a tela ao abrir.
    const visiveis = lista.slice(0, limiteExibicaoFornecedores);

    const opcoesLegadoHTML = listaFornecedoresSpData
        .slice()
        .sort((a, b) => (a.nomeReal || '').localeCompare(b.nomeReal || ''))
        .map(f => `<option value="${f.id}">${escRel(f.nomeReal)}${f.cnpjs.length ? ' — ' + formatarCnpjExibicao(f.cnpjs[0].cnpj) : ''}</option>`)
        .join('');

    container.innerHTML = visiveis.map(f => {
        if (f.origem === 'legado') {
            const vincularHTML = `<div class="central-spdata-busca" style="margin-top:6px;" onclick="event.stopPropagation()">
                <label style="font-size:11px;color:var(--text-light);">É o mesmo fornecedor que um já cadastrado com CNPJ? Vincule aqui (não apaga este registro):</label>
                <select class="form-field" id="vincular-select-${f.chave}"><option value="">Selecione o fornecedor cadastrado...</option>${opcoesLegadoHTML}</select>
                <button type="button" class="central-status-toggle" onclick="vincularFornecedorLegadoSelecionado('${f.chave}', '${escRel(f.nomeReal)}')">Vincular</button>
            </div>`;
            return `<div class="nota-item" style="cursor:default;flex-direction:column;align-items:stretch;gap:4px;">
                <div class="nota-info">${f.nomeReal} <span style="font-size:10px;color:var(--text-light);font-weight:400;">(cadastro simples)</span></div>
                <div class="nota-detalhes"><em>Cadastro simples, sem código/CNPJ — importe o relatório oficial de fornecedores pra identificação automática por CNPJ.</em></div>
                ${vincularHTML}
            </div>`;
        }

        // Fornecedor com CNPJ (origem spdata/xml) — pode ter mais de um
        // documento no grupo (matriz/filial vinculados manualmente).
        const idsDoGrupo = new Set(f.docs.map(d => d.id));
        const opcoesVincularEntidadeHTML = listaFornecedoresSpData
            .filter(d => !idsDoGrupo.has(d.id))
            .sort((a, b) => (a.nomeReal || '').localeCompare(b.nomeReal || ''))
            .map(d => `<option value="${d.id}">${d.codigo ? d.codigo + ' — ' : ''}${escRel(d.nomeReal)}</option>`)
            .join('');
        const principalId = f.docs.find(d => d.codigo)?.id || f.docs[0].id;

        // Fase 5: bloqueio por CNPJ — NFs deste fornecedor (vindas do
        // relatório ERP) vão direto pro Histórico, sem passar por
        // pré-seleção/financeiro. Opera sobre todos os CNPJs do grupo.
        const bloqueado = f.cnpjs.length > 0 && f.cnpjs.some(c => fornecedoresIgnoradosCnpj.has(c.cnpj));
        const bloqueioHTML = f.cnpjs.length > 0
            ? `<div class="nota-detalhes">${bloqueado ? '🔒 Bloqueado — NFs do ERP vão direto pro Histórico' : 'NFs do ERP são tratadas normalmente'} <button type="button" class="central-status-toggle" onclick="alternarBloqueioFornecedorCnpj('${f.chave}')">${bloqueado ? 'Desbloquear' : 'Bloquear do financeiro'}</button></div>`
            : '';

        const subDocsHTML = f.docs.map(doc => {
            const chaveDoc = 'sp:' + doc.id;
            const cnpjsDoc = doc.cnpjs || [];
            const cnpjsHTML = cnpjsDoc.length
                ? cnpjsDoc.map(c => formatarCnpjExibicao(c.cnpj)).join('<br>')
                : '<em>Sem CNPJ cadastrado — associações por este código ficam pendentes.</em>';
            const editando = fornecedorEditando.has(chaveDoc);
            const edicaoHTML = editando
                ? `<div class="central-spdata-busca" onclick="event.stopPropagation()">
                    <label style="font-size:11px;color:var(--text-light);">Razão social</label>
                    <input type="text" class="form-field" id="nomereal-input-${chaveDoc}" value="${doc.nomeReal || ''}">
                    <label style="font-size:11px;color:var(--text-light);">Nome de exibição no app</label>
                    <input type="text" class="form-field" id="apelido-input-${chaveDoc}" value="${doc.nomeExibido || ''}" placeholder="Nome de exibição no app">
                    <button type="button" class="central-status-toggle" onclick="salvarApelidoFornecedor('${chaveDoc}')">Salvar</button>
                    <label style="font-size:11px;color:var(--text-light);margin-top:8px;display:block;">Adicionar CNPJ (nunca remove os existentes)</label>
                    <input type="text" class="form-field" id="novo-cnpj-input-${chaveDoc}" placeholder="Só números">
                    <button type="button" class="central-status-toggle" onclick="adicionarCnpjFornecedorManual('${doc.id}')">+ Adicionar CNPJ</button>
                </div>`
                : `<div class="nota-detalhes">Nome no app: ${doc.nomeExibido || '<em>(usa a razão social)</em>'}${doc.apelidoEditadoManualmente ? ' <span class="badge-excecao">editado</span>' : ''} <button type="button" class="central-status-toggle" onclick="toggleEditarApelidoFornecedor('${chaveDoc}')">Editar</button></div>`;
            return `<div style="padding:8px 0;${f.docs.length > 1 ? 'border-top:1px solid var(--border-color);' : ''}">
                <div class="nota-detalhes"><strong>${doc.codigo ? doc.codigo + ' — ' : (doc.origemCadastro === 'xml' ? 'Identificado por XML — ' : '')}CNPJ(s): ${cnpjsDoc.length}</strong><br>${cnpjsHTML}</div>
                ${edicaoHTML}
            </div>`;
        }).join('');

        const aliasesHTML = f.aliasesLegado.length ? `<div class="nota-detalhes">Também conhecido como: ${f.aliasesLegado.map(escRel).join(', ')}</div>` : '';
        const vincularEntidadeHTML = `<div class="central-spdata-busca" style="margin-top:6px;" onclick="event.stopPropagation()">
            <label style="font-size:11px;color:var(--text-light);">É a mesma empresa que outro CNPJ já cadastrado (matriz/filial/CD)? Vincule aqui (nenhum CNPJ é apagado ou movido):</label>
            <select class="form-field" id="vincular-entidade-select-${f.chave}"><option value="">Selecione outro fornecedor cadastrado...</option>${opcoesVincularEntidadeHTML}</select>
            <button type="button" class="central-status-toggle" onclick="vincularEntidadeSelecionada('${f.chave}', '${principalId}')">Vincular</button>
        </div>`;

        return `<div class="nota-item" style="cursor:default;flex-direction:column;align-items:stretch;gap:4px;">
            <div class="nota-info">${f.nomeReal}${f.docs.length > 1 ? ` <span style="font-size:10px;color:var(--text-light);font-weight:400;">(${f.docs.length} CNPJs vinculados)</span>` : ''}</div>
            ${bloqueioHTML}
            ${subDocsHTML}
            ${aliasesHTML}
            ${vincularEntidadeHTML}
        </div>`;
    }).join('');

    if (lista.length > visiveis.length) {
        container.innerHTML += `<div class="actions" style="margin-top:12px;">
            <button type="button" class="actions-button is-neutral" onclick="carregarMaisFornecedores()">Carregar mais (${lista.length - visiveis.length} restante(s))</button>
        </div>`;
    }
}

function vincularFornecedorLegadoSelecionado(chave, nomeLegado) {
    const select = document.getElementById(`vincular-select-${chave}`);
    if (!select || !select.value) return toast('Selecione o fornecedor cadastrado ao qual deseja vincular.');
    vincularFornecedorLegadoAoCadastro(nomeLegado, select.value);
}

function vincularEntidadeSelecionada(chave, principalId) {
    const select = document.getElementById(`vincular-entidade-select-${chave}`);
    if (!select || !select.value) return toast('Selecione o fornecedor a vincular.');
    vincularEntidadesFornecedor(principalId, select.value);
}

// ===================================================================
// --- VÍNCULO ENTRADA ERP ↔ NF/XML ↔ COTAÇÃO (leitura, não cria associação) ---
// ===================================================================
// Cadeia: código do fornecedor (relatório ERP) → CNPJ(s) cadastrados
// (fornecedoresSpData) → bate com o cnpjFornecedor de uma associação
// fornecedor→item já confirmada (associacoesFornecedor) → mesma NF+? (usa o
// nfNumero gravado nessa associação) → o codigoSmartCompras dessa associação
// aponta pro item da cotação → a cotação que contém esse item é o pedido.
//
// Só confirma quando a NF do relatório ERP bate com o nfNumero já registrado
// em alguma associação cujo CNPJ está entre os cadastrados pro código do
// fornecedor do relatório. Nunca escolhe um CNPJ quando há mais de um: basta
// UM deles bater com uma associação existente pra confirmar; se nenhum bater
// (ou não houver associação pra nenhum deles), fica pendente — nunca grava
// vínculo assumido.
// Converte um número que pode vir em dois formatos diferentes já presentes
// no app: formato BR de relatório impresso ("1.234,56", usado pelo ERP — ver
// parseValorBR) ou texto simples com ponto decimal, tal como o XML do
// SmartCompras grava em Quantidade/Preco_Unitario/Preco_Total (ver
// parseXmlSmartCompras). Nunca inventa separador: decide pela presença de
// vírgula decimal.
function numeroFlexivel(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isNaN(v) ? null : v;
    const s = String(v).trim();
    if (!s) return null;
    const n = /,\d{1,4}\s*$/.test(s) ? parseValorBR(s) : parseFloat(s);
    return isNaN(n) ? null : n;
}

// Soma o valor total cotado (Preco_Total, com fallback pra
// Quantidade × Preco_Unitario quando Preco_Total vier vazio) dos itens de um
// fornecedor específico dentro de uma cotação — usado só como EVIDÊNCIA de
// reconciliação (Fase 8), nunca como fonte de verdade do valor da cotação.
function valorTotalCotacaoPorFornecedor(cotacao, cnpj) {
    return (cotacao.itens || [])
        .filter(it => it.cnpjFornecedor === cnpj)
        .reduce((soma, it) => {
            const total = numeroFlexivel(it.precoTotal);
            if (total !== null) return soma + total;
            const qtd = numeroFlexivel(it.quantidade);
            const unit = numeroFlexivel(it.precoUnitario);
            return soma + (qtd !== null && unit !== null ? qtd * unit : 0);
        }, 0);
}

// Tolerância pra considerar o valor total do ERP "compatível" com o valor
// cotado de um fornecedor dentro de um pedido — evidência de reconciliação,
// nunca decide sozinha (sempre combinada com CNPJ, nunca com data isolada).
// 5% cobre frete/desconto/ajustes comuns entre cotação e nota fiscal real
// sem abrir demais pra falsos positivos.
const TOLERANCIA_VALOR_RECONCILIACAO_ERP = 0.05;

// ===================================================================
// --- FASE 8: RECONCILIAÇÃO ERP → NF/PEDIDO (CONFIRMADA/SUGERIDA/SEM) ---
// ===================================================================
// Três estados, sempre determinísticos e auditáveis (nunca fuzzy matching,
// nunca IA, nunca "mesma data = mesmo pedido" isolada):
//
// 'confirmado'      — já existe uma NF/XML processada (associacoesFornecedor)
//                      pro mesmo número de NF + CNPJ cadastrado. Igual à
//                      lógica original, preservada sem alteração de critério.
// 'sugerido'        — não há XML processado pra esta NF ainda, mas o CNPJ do
//                      fornecedor (cadastro oficial, nunca por nome) bate com
//                      o fornecedor de um ou mais pedidos, E o valor total
//                      cotado pra esse fornecedor nesse pedido é compatível
//                      (dentro da tolerância) com o valor total da NF do ERP.
//                      Sempre lista as evidências usadas e, quando mais de
//                      um pedido bate, todos os candidatos — nunca escolhe
//                      um sozinho.
// 'sem_associacao'  — sem CNPJ cadastrado, sem pedido do fornecedor, ou CNPJ
//                      bate mas nenhum pedido tem valor compatível.
function vincularEntradaErpComNf(bloco) {
    const cnpjsFornecedor = resolverCnpjsFornecedorSpData(bloco.codigoFornecedorSpData);

    if (cnpjsFornecedor.length === 0) {
        return { status: 'sem_associacao', motivo: 'Código de fornecedor sem CNPJ cadastrado no SP Data (ou cadastro ainda não importado).', evidencias: [], cnpjsFornecedor: [], cnpjFornecedor: null, pedido: null, candidatos: [] };
    }

    const associacoesCorrespondentes = Object.values(bancoAssociacoesFornecedor)
        .filter(a => a.nfNumero === bloco.nf && cnpjsFornecedor.includes(a.cnpjFornecedor));

    if (associacoesCorrespondentes.length > 0) {
        // Todas as associações correspondentes devem concordar no mesmo CNPJ —
        // se não concordarem (situação anômala), não decide sozinho.
        const cnpjsBatidos = [...new Set(associacoesCorrespondentes.map(a => a.cnpjFornecedor))];
        if (cnpjsBatidos.length > 1) {
            return { status: 'sem_associacao', motivo: 'Mais de um CNPJ cadastrado para este fornecedor bate com esta NF — ambíguo, precisa de confirmação manual.', evidencias: [], cnpjsFornecedor, cnpjFornecedor: null, pedido: null, candidatos: [] };
        }

        // Localiza a cotação/pedido a partir do(s) item(ns) já confirmados.
        const codigosSmartCompras = [...new Set(associacoesCorrespondentes.map(a => a.codigoSmartCompras))];
        let pedido = null;
        for (const cotacao of listaCotacoes) {
            if ((cotacao.itens || []).some(it => codigosSmartCompras.includes(it.codProduto))) { pedido = cotacao.pedido; break; }
        }

        return {
            status: 'confirmado',
            motivo: '',
            evidencias: ['NF/XML já processada e associada a este fornecedor e a este número de NF.'],
            cnpjsFornecedor,
            cnpjFornecedor: cnpjsBatidos[0],
            pedido,
            candidatos: []
        };
    }

    // Sem XML já processado pra esta NF — tenta reconciliar por evidência:
    // CNPJ do fornecedor (cadastro oficial) + valor total compatível com
    // algum pedido desse mesmo fornecedor. Nunca usa só data.
    const valorErp = parseValorBR(bloco.valor);
    const candidatos = [];
    listaCotacoes.forEach(cotacao => {
        const fornecedorMatch = (cotacao.fornecedores || []).find(f => cnpjsFornecedor.includes(f.cnpj));
        if (!fornecedorMatch) return;
        const valorCotado = valorTotalCotacaoPorFornecedor(cotacao, fornecedorMatch.cnpj);
        const diff = Math.abs(valorCotado - valorErp);
        const diffPercentual = valorCotado > 0 ? diff / valorCotado : null;
        const valorCompativel = valorCotado > 0 && diffPercentual !== null && diffPercentual <= TOLERANCIA_VALOR_RECONCILIACAO_ERP;
        const dataDentroPeriodo = !!(bloco.data && cotacao.dataPedido && cotacao.dataLimite &&
            converterDataBRparaISO(bloco.data) >= cotacao.dataPedido && converterDataBRparaISO(bloco.data) <= cotacao.dataLimite);
        candidatos.push({
            pedido: cotacao.pedido, cnpjFornecedor: fornecedorMatch.cnpj,
            valorCotado, valorErp, diffPercentual, valorCompativel, dataDentroPeriodo
        });
    });

    const compativeis = candidatos.filter(c => c.valorCompativel);
    if (compativeis.length > 0) {
        compativeis.sort((a, b) => a.diffPercentual - b.diffPercentual);
        const evidenciasBase = (c) => {
            const ev = [
                `CNPJ do fornecedor cadastrado bate com o pedido ${c.pedido}.`,
                `Valor compatível: cotado R$ ${formatValorBR(c.valorCotado)} × NF do ERP R$ ${formatValorBR(c.valorErp)} (diferença ${(c.diffPercentual * 100).toFixed(1)}%).`
            ];
            if (c.dataDentroPeriodo) ev.push('Data da NF dentro do período do pedido (evidência complementar — nunca usada isoladamente).');
            return ev;
        };
        return {
            status: 'sugerido',
            motivo: compativeis.length > 1 ? `${compativeis.length} pedido(s) do mesmo fornecedor com valor compatível — escolha manualmente.` : 'Evidências suficientes para sugerir, mas sem NF/XML processada confirmando — requer confirmação humana.',
            evidencias: evidenciasBase(compativeis[0]),
            cnpjsFornecedor,
            cnpjFornecedor: compativeis[0].cnpjFornecedor,
            pedido: compativeis.length === 1 ? compativeis[0].pedido : null,
            candidatos: compativeis.map(c => ({ pedido: c.pedido, evidencias: evidenciasBase(c) }))
        };
    }

    if (candidatos.length > 0) {
        return {
            status: 'sem_associacao',
            motivo: `Fornecedor cadastrado tem ${candidatos.length} pedido(s), mas nenhum com valor total compatível com esta NF do ERP (R$ ${formatValorBR(valorErp)}).`,
            evidencias: [],
            cnpjsFornecedor,
            cnpjFornecedor: candidatos[0].cnpjFornecedor,
            pedido: null,
            candidatos: []
        };
    }

    return {
        status: 'sem_associacao',
        motivo: 'Nenhum pedido/cotação cadastrado para este fornecedor (CNPJ oficial) ainda.',
        evidencias: [],
        cnpjsFornecedor,
        cnpjFornecedor: null,
        pedido: null,
        candidatos: []
    };
}

// Permite ao usuário confirmar manualmente um vínculo 'sugerido' (ou escolher
// entre candidatos empatados) — nunca automático. Preserva o registro
// original (evidências, motivo) e só substitui o status/pedido. Reaproveita
// o mesmo doc de entradasErp, nunca cria uma segunda estrutura.
async function confirmarVinculoErpComPedido(chave, pedidoEscolhido) {
    const entrada = listaEntradasErp.find(e => e.id === chave);
    if (!entrada || !pedidoEscolhido) return;
    try {
        const novoVinculo = { ...entrada.vinculo, status: 'confirmado', pedido: pedidoEscolhido, confirmadoManualmente: true, confirmadoEm: new Date().toISOString() };
        await entradasErpCollection.doc(chave).update({ vinculo: novoVinculo });
        toast(`✓ Vínculo confirmado com o pedido ${pedidoEscolhido}.`);
        // Agora que o pedido é certeza, tenta preencher automaticamente as
        // associações de SP Data que ainda faltarem nesse fornecedor/pedido
        // (ver reconciliarAssociacoesSpDataViaErp) — mesma regra determinística
        // usada na importação, nunca decide em caso de ambiguidade.
        const resultado = reconciliarAssociacoesSpDataViaErp({ ...entrada, vinculo: novoVinculo });
        if (resultado.pares.length) {
            for (const p of resultado.pares) await confirmarAssociacaoSpData(p.codigoSmartCompras, p.spDataCodigo, { silencioso: true, origemAutomatica: true });
            toast(`✓ Vínculo confirmado · ${resultado.pares.length} associação(ões) de SP Data preenchida(s) automaticamente a partir do ERP.`);
        }
        renderHistoricoNfs();
    } catch (e) {
        console.error('Erro ao confirmar vínculo ERP → pedido:', e);
        toast('✕ Erro ao confirmar vínculo.');
    }
}

// ===================================================================
// --- FASE 8: PREENCHIMENTO AUTOMÁTICO DE ASSOCIAÇÃO SP DATA VIA ERP ---
// ===================================================================
// Só atua quando o vínculo NF↔pedido já é uma CERTEZA (status 'confirmado' —
// seja pela associação de XML já existente, seja por confirmação manual de
// uma sugestão) — nunca a partir de uma sugestão ainda não confirmada.
// Casa item da cotação (sem associação SP Data ainda) com item do ERP
// (que já traz o código SP Data direto) pela QUANTIDADE e VALOR UNITÁRIO —
// dados concretos da mesma nota fiscal, nunca por semelhança de nome/texto.
// Só associa quando existe exatamente UM item do ERP compatível: ambiguidade
// nunca decide sozinha, fica como estava (associação manual, já existente).
function reconciliarAssociacoesSpDataViaErp(entrada) {
    if (!entrada || !entrada.vinculo || entrada.vinculo.status !== 'confirmado' || !entrada.vinculo.pedido) return { pares: [] };
    const cotacao = listaCotacoes.find(c => c.pedido === entrada.vinculo.pedido);
    if (!cotacao) return { pares: [] };
    const cnpj = entrada.vinculo.cnpjFornecedor;

    const itensCotacaoSemAssociacao = (cotacao.itens || []).filter(it =>
        it.cnpjFornecedor === cnpj && it.codProduto &&
        !listaAssociacoesSpData.some(a => a.codigoSmartCompras === it.codProduto)
    );
    if (!itensCotacaoSemAssociacao.length) return { pares: [] };

    const itensErp = entrada.itens || [];
    const usados = new Set();
    const pares = [];

    itensCotacaoSemAssociacao.forEach(itCot => {
        const qtdCot = numeroFlexivel(itCot.quantidade);
        const precoCot = numeroFlexivel(itCot.precoUnitario);
        if (qtdCot === null || precoCot === null) return;
        const candidatosIdx = itensErp.reduce((acc, itErp, idx) => {
            if (usados.has(idx)) return acc;
            if (Math.abs(itErp.quantidade - qtdCot) < 0.001 && Math.abs(itErp.valorUnitario - precoCot) < 0.01) acc.push(idx);
            return acc;
        }, []);
        if (candidatosIdx.length === 1) {
            usados.add(candidatosIdx[0]);
            pares.push({ codigoSmartCompras: itCot.codProduto, spDataCodigo: itensErp[candidatosIdx[0]].codigoSpData });
        }
    });

    return { pares };
}

// Cruza cada item do bloco ERP (código SP Data) com associacoesSpData, só
// quando já existe uma associação confirmada item da cotação → SP Data.
// Não sobrescreve o item original — devolve uma cópia com um campo extra.
function enriquecerItensEntradaErp(itens) {
    return itens.map(item => {
        const associacao = listaAssociacoesSpData.find(a => a.spDataCodigo === item.codigoSpData);
        return { ...item, codigoSmartComprasRelacionado: associacao ? associacao.codigoSmartCompras : null };
    });
}

async function salvarEntradasErp(blocosParsed) {
    if (!blocosParsed || !blocosParsed.length) return { salvos: 0, erros: 0, associacoesSpDataAutomaticas: 0 };
    const agora = new Date().toISOString();
    // Mapa dos docs já existentes — usado só pra decidir o statusFluxo (ver
    // resolverStatusFluxoEntradaErp), que precisa ser "grudento" em
    // reimportação: uma entrada já arquivada não deve voltar a pedir decisão.
    const existentesMap = {};
    listaEntradasErp.forEach(e => { existentesMap[e.id] = e; });
    // Acumula pares candidatos à associação automática de SP Data (Fase 8)
    // durante o parse dos blocos — só é aplicado DEPOIS que o batch de
    // entradasErp confirmar commit, e nunca duas vezes pro mesmo item da
    // cotação dentro da mesma importação (evita conflito se duas NFs desta
    // mesma leva, por algum motivo, parecessem bater com o mesmo item).
    const paresAutoAssociacao = [];
    const codigosSmartComprasJaEnfileirados = new Set();
    let salvos = 0, erros = 0;
    for (let i = 0; i < blocosParsed.length; i += 400) {
        const lote = blocosParsed.slice(i, i + 400);
        const batch = firestore.batch();
        lote.forEach(bloco => {
            if (!bloco.nf) { erros++; return; }
            const chave = chaveEntradaErp(bloco);
            const vinculo = vincularEntradaErpComNf(bloco);
            const fluxo = resolverStatusFluxoEntradaErp(bloco, vinculo, existentesMap[chave]);
            const itensEnriquecidos = enriquecerItensEntradaErp(bloco.itens);
            batch.set(entradasErpCollection.doc(chave), {
                nf: bloco.nf,
                serie: bloco.serie,
                documento: bloco.documento,
                codigoFornecedorSpData: bloco.codigoFornecedorSpData,
                fornecedorNomeRelatorio: bloco.fornecedor,
                cnpjFornecedor: vinculo.cnpjFornecedor, // null até confirmado — nunca escolhido arbitrariamente
                data: bloco.data,
                vencimento: bloco.vencimento,
                itens: itensEnriquecidos,
                financeiro: bloco.financeiro,
                parcelas: bloco.parcelasDetalhe,
                avisos: bloco.avisos,
                vinculo, // {status: 'confirmado'|'sugerido'|'sem_associacao', motivo, evidencias, cnpjsFornecedor, cnpjFornecedor, pedido?, candidatos?} — referência, não altera nada original
                statusFluxo: fluxo.statusFluxo,
                notaVinculadaId: fluxo.notaVinculadaId,
                avisoJaExisteNotaManual: fluxo.avisoJaExisteNotaManual,
                atualizadoEm: agora
            });
            salvos++;

            // Fase 8: só tenta preencher associação de SP Data quando o
            // vínculo já saiu 'confirmado' nesta própria importação (NF/XML
            // já processada) — uma sugestão nunca alimenta isso sozinha.
            if (vinculo.status === 'confirmado' && vinculo.pedido) {
                const { pares } = reconciliarAssociacoesSpDataViaErp({ vinculo, itens: itensEnriquecidos });
                pares.forEach(p => {
                    if (!codigosSmartComprasJaEnfileirados.has(p.codigoSmartCompras)) {
                        codigosSmartComprasJaEnfileirados.add(p.codigoSmartCompras);
                        paresAutoAssociacao.push(p);
                    }
                });
            }
        });
        try {
            await batch.commit();
        } catch (e) {
            console.error('Erro ao salvar lote de entradasErp:', e);
            erros += lote.length;
            salvos -= lote.length;
        }
    }

    let associacoesSpDataAutomaticas = 0;
    for (const par of paresAutoAssociacao) {
        try {
            await confirmarAssociacaoSpData(par.codigoSmartCompras, par.spDataCodigo, { silencioso: true, origemAutomatica: true });
            associacoesSpDataAutomaticas++;
        } catch (e) {
            console.error('Erro ao aplicar associação automática de SP Data via ERP:', e);
        }
    }

    return { salvos, erros, associacoesSpDataAutomaticas };
}

// ===== Fase 5 — pré-seleção / bloqueio / financeiro (entradas do ERP) =====
// Incorporado do Agente 1: decide se uma entrada do relatório ERP fica em
// pré-seleção aguardando decisão manual, vai direto pro histórico (fornecedor
// bloqueado por CNPJ) ou já reconhece que foi arquivada manualmente antes.
// "Grudento" em reimportação: se já existe um doc e ele já saiu da
// pré-seleção (foi selecionado, arquivado, ou já foi direto pro histórico),
// o novo import NUNCA reseta isso sozinho — evita o cenário de uma NF já
// arquivada aparecer de novo como se precisasse de uma nova decisão.
function resolverStatusFluxoEntradaErp(bloco, vinculo, docExistente) {
    if (docExistente && docExistente.statusFluxo && docExistente.statusFluxo !== 'pre_selecao') {
        return {
            statusFluxo: docExistente.statusFluxo,
            notaVinculadaId: docExistente.notaVinculadaId || null,
            avisoJaExisteNotaManual: docExistente.avisoJaExisteNotaManual || false
        };
    }

    const cnpjsPossiveis = vinculo.cnpjFornecedor
        ? [vinculo.cnpjFornecedor]
        : (vinculo.cnpjsFornecedor && vinculo.cnpjsFornecedor.length ? vinculo.cnpjsFornecedor : resolverCnpjsFornecedorSpData(bloco.codigoFornecedorSpData));

    if (cnpjsPossiveis.some(c => fornecedoresIgnoradosCnpj.has(c))) {
        return { statusFluxo: 'historico_direto', notaVinculadaId: null, avisoJaExisteNotaManual: false };
    }

    // Reaproveita a checagem de duplicidade já existente (fluxo manual de
    // Adicionar Nota) — pelo nome do fornecedor tal como veio no relatório
    // ERP, já que é isso que o cadastro manual também usa.
    const duplicata = verificarDuplicidade(bloco.fornecedor, bloco.nf);
    if (duplicata && duplicata.origem === 'historico') {
        // A mesma NF já foi processada e arquivada manualmente antes — não
        // cria um segundo registro pedindo decisão de novo, só reconhece que
        // já foi pro financeiro.
        return { statusFluxo: 'arquivada', notaVinculadaId: null, avisoJaExisteNotaManual: true };
    }
    if (duplicata && duplicata.origem === 'pendente') {
        // Ainda está sendo tratada manualmente — fica em pré-seleção, mas
        // sinaliza pro usuário não duplicar o trabalho.
        return { statusFluxo: 'pre_selecao', notaVinculadaId: null, avisoJaExisteNotaManual: true };
    }

    return { statusFluxo: 'pre_selecao', notaVinculadaId: null, avisoJaExisteNotaManual: false };
}

// Bloqueio por CNPJ: fornecedor cujas NFs (vindas do relatório ERP) nunca
// passam pelo processo de financeiro — vão direto pro Histórico (ver
// salvarEntradasErp/resolverStatusFluxoEntradaErp). Independente do bloqueio
// antigo por nome, que continua servindo o checklist de Adicionar Nota como
// sempre serviu. Opera sobre o grupo unificado (listaFornecedoresUnificada),
// já que um mesmo fornecedor pode ter mais de um CNPJ/documento vinculado.
function fornecedorBloqueadoPorCnpj(cnpj) {
    return fornecedoresIgnoradosCnpj.has(cnpj);
}
async function alternarBloqueioFornecedorCnpj(chave) {
    const grupo = listaFornecedoresUnificada().find(f => f.chave === chave);
    if (!grupo || !grupo.cnpjs.length) return toast('Cadastre pelo menos um CNPJ pra este fornecedor antes de bloquear.');
    const algumBloqueado = grupo.cnpjs.some(c => fornecedoresIgnoradosCnpj.has(c.cnpj));
    const novoConjunto = new Set(fornecedoresIgnoradosCnpj);
    grupo.cnpjs.forEach(c => { if (algumBloqueado) novoConjunto.delete(c.cnpj); else novoConjunto.add(c.cnpj); });
    try {
        await settingsDocRef.set({ fornecedoresIgnoradosCnpj: Array.from(novoConjunto) }, { merge: true });
        toast(algumBloqueado ? '✓ Fornecedor liberado — NFs do relatório ERP voltam a ser tratadas normalmente.' : '✓ Fornecedor bloqueado — NFs do relatório ERP vão direto pro Histórico.');
    } catch (e) {
        console.error('Erro ao alternar bloqueio de fornecedor:', e);
        toast('✕ Erro ao salvar.');
    }
}

// Reabrir uma entrada já arquivada (ou que foi direto pro histórico) — nunca
// silencioso: sempre confirma antes, porque "arquivada" tem um significado
// físico concreto (já foi pro financeiro) que não deve ser desfeito sem
// querer. Reabrir não cria um segundo registro — volta a trabalhar no mesmo
// doc, só muda o status de volta pra pré-seleção. Usada no card expandido da
// NF de origem ERP no Histórico novo (ver renderCardHistoricoNf).
function abrirEntradaErpComConfirmacao(chave, callback) {
    const entrada = listaEntradasErp.find(e => e.id === chave);
    if (!entrada) return;
    if (entrada.statusFluxo !== 'arquivada' && entrada.statusFluxo !== 'historico_direto') { callback(); return; }
    showConfirmModal({
        title: 'NF já está arquivada',
        message: `Esta NF (${entrada.nf}) já está arquivada — já foi tratada como concluída. Deseja desarquivar temporariamente pra trabalhar com ela de novo? O registro não é duplicado, você volta a editar o mesmo.`,
        confirmText: 'Desarquivar temporariamente',
        confirmClass: 'warning',
        onConfirm: async () => {
            try {
                await entradasErpCollection.doc(chave).update({ statusFluxo: 'pre_selecao', notaVinculadaId: null });
                toast('✓ NF desarquivada — importe o relatório de novo e marque a NF pra levá-la de volta ao Gerenciar NF.');
                callback();
            } catch (e) {
                console.error('Erro ao desarquivar entrada do ERP:', e);
                toast('✕ Erro ao desarquivar.');
            }
        }
    });
}
// ===== fim Fase 5 =====

async function colarRelatorioImportacao() {
    const textarea = document.getElementById('import-textarea');
    try {
        const texto = await navigator.clipboard.readText();
        textarea.value = texto;
        toast('Texto colado!');
    } catch (err) {
        toast('Permissão negada ou não suportada. Cole manualmente (Ctrl+V).');
    }
}

// Lê o arquivo TXT enviado pelo usuário. Relatórios desse tipo de ERP costumam
// vir salvos em ISO-8859-1/Windows-1252 (por causa de acentos), então
// detectamos automaticamente: tentamos ler como UTF-8 primeiro e, se aparecer
// muito caractere de substituição (sinal de acentuação quebrada), lemos de
// novo como ISO-8859-1.
function decodificarArquivoTexto(buffer) {
    const bytes = new Uint8Array(buffer);
    let textoUtf8 = '';
    try {
        textoUtf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch (e) {
        textoUtf8 = '';
    }
    const caracteresQuebrados = (textoUtf8.match(/\uFFFD/g) || []).length;
    if (caracteresQuebrados > 3) {
        return new TextDecoder('iso-8859-1').decode(bytes);
    }
    return textoUtf8;
}

function handleImportFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.txt') && file.type && !file.type.startsWith('text/')) {
        toast('Selecione um arquivo .txt do relatório.');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const texto = decodificarArquivoTexto(e.target.result);
        document.getElementById('import-textarea').value = texto;
        toast('Arquivo carregado! Clique em "Processar Relatório".');
    };
    reader.onerror = () => toast('Erro ao ler o arquivo.');
    reader.readAsArrayBuffer(file);

    event.target.value = ''; // permite selecionar o mesmo arquivo de novo depois
}

function processarRelatorioImportacao() {
    try {
        const textarea = document.getElementById('import-textarea');
        if (!textarea) return toast('Erro interno: campo de texto não encontrado. Atualize a página (Ctrl+Shift+R) e tente de novo.');
        const texto = textarea.value;

        if (!texto || !texto.trim()) {
            return toast('Cole o texto do relatório antes de processar.');
        }

        const notas = parseRelatorioERP(texto);

        if (notas.length === 0) {
            document.getElementById('import-preview-container').innerHTML = `<div class="empty-state">Nenhuma nota fiscal foi reconhecida neste texto. Verifique se o conteúdo colado é o relatório correto.</div>`;
            return;
        }

        notasImportadasPreview = notas;
        mostrarApenasNovasImportacao = true;
        renderPreviewImportacao();
        toast(`${notas.length} nota(s) encontrada(s)!`);
    } catch (e) {
        console.error('Erro ao processar relatório:', e);
        toast('✕ Erro ao processar o relatório. Veja o console para detalhes.');
    }
}

// Alimenta o histórico/reconciliação do ERP (entradasErp) com TODAS as NFs
// reconhecidas no relatório colado, independente do checkbox de seleção —
// NUNCA cria nota no financeiro (notasCollection). Ação separada de
// confirmarImportacaoLote porque o usuário pode querer só consolidar os
// dados do ERP (Pré-seleção, Histórico, reconciliação da Fase 8) sem decidir
// ainda quais NFs específicas precisam de nota financeira agora. Idempotente
// (chaveEntradaErp = nf_serie, sempre .set() por chave) — pode ser clicado
// de novo com o mesmo relatório sem duplicar nada.
async function salvarHistoricoErpSemFinanceiro() {
    if (!notasImportadasPreview.length) return toast('Nada pra salvar — processe um relatório primeiro.');
    try {
        const resultado = await salvarEntradasErp(notasImportadasPreview);
        let msg = `✓ Histórico do ERP atualizado: ${resultado.salvos} nota(s) processada(s)`;
        if (resultado.associacoesSpDataAutomaticas > 0) msg += ` · +${resultado.associacoesSpDataAutomaticas} associação(ões) de SP Data preenchida(s) automaticamente`;
        if (resultado.erros > 0) msg += ` · ${resultado.erros} erro(s)`;
        toast(msg);
    } catch (e) {
        console.error('Erro ao salvar histórico do ERP:', e);
        toast('✕ Erro ao salvar o histórico do ERP.');
    }
}

function renderPreviewImportacao() {
    const container = document.getElementById('import-preview-container');
    if (!container) return;

    if (notasImportadasPreview.length === 0) {
        container.innerHTML = '';
        return;
    }

    const linhas = notasImportadasPreview.map((nota, idx) => {
        const apelidoEncontrado = encontrarApelidoFornecedor(nota.fornecedor);
        const fornecedorExibido = apelidoEncontrado || nota.fornecedor;
        const duplicata = verificarDuplicidade(fornecedorExibido, nota.nf);
        const ignorado = fornecedoresIgnorados.has(fornecedorExibido) || fornecedoresIgnorados.has(nota.fornecedor);

        let status = 'novo';
        if (ignorado) status = 'ignorado';
        else if (duplicata) status = 'duplicata';

        return { nota, idx, apelidoEncontrado, fornecedorExibido, duplicata, ignorado, status };
    });

    const totalNovas = linhas.filter(l => l.status === 'novo').length;
    const totalProcessadas = linhas.length - totalNovas;

    const itensHTML = linhas.map(({ nota, idx, apelidoEncontrado, fornecedorExibido, duplicata, ignorado, status }) => {
        const avisosHTML = nota.avisos.length
            ? `<div class="import-avisos">${nota.avisos.map(a => `<div class="import-aviso"><i class="fa-solid fa-triangle-exclamation"></i> ${a}</div>`).join('')}</div>`
            : '';
        const badgeIgnorado = ignorado ? `<div class="import-badge import-badge-ignorado"><i class="fa-solid fa-ban"></i> Fornecedor ignorado — não entra na importação</div>` : '';
        const badgeDup = !duplicata ? '' : (
            duplicata.origem === 'historico'
                ? `<div class="import-badge import-badge-historico"><i class="fa-solid fa-box-archive"></i> Já foi arquivada antes${duplicata.nota.dataHistorico ? ` (em ${duplicata.nota.dataHistorico})` : ''}</div>`
                : `<div class="import-badge"><i class="fa-solid fa-triangle-exclamation"></i> Já existe uma nota pendente com este fornecedor + NF</div>`
        );
        const badgeApelido = apelidoEncontrado ? `<div class="import-badge import-badge-info"><i class="fa-solid fa-wand-magic-sparkles"></i> Apelido aplicado automaticamente (nome no relatório: "${nota.fornecedor}")</div>` : '';

        return `
        <div class="nota-item import-item" data-import-idx="${idx}" data-status="${status}">
            <label class="import-checkbox-row">
                <input type="checkbox" class="import-check" data-idx="${idx}" ${status === 'novo' ? 'checked' : ''} onchange="atualizarContadorImportacao()">
                <span>Importar esta nota${nota.parcelas > 1 ? ` (parcelada ${nota.parcelas}x)` : ''}</span>
            </label>
            ${badgeIgnorado}
            ${badgeDup}
            ${badgeApelido}
            <div class="campo"><label>Fornecedor</label><input type="text" class="form-field import-field-forn" data-idx="${idx}" data-original="${nota.fornecedor}" value="${fornecedorExibido}" onblur="handleEdicaoFornecedorImportacao(this)"></div>
            <div class="campo"><label>NF</label><input type="text" class="form-field import-field-nf" data-idx="${idx}" value="${nota.nf}"></div>
            <div class="campo"><label>Data</label><input type="text" class="form-field import-field-data" data-idx="${idx}" value="${nota.data}" oninput="formatarDataInput(this)"></div>
            <div class="campo"><label>Vencimento</label><input type="text" class="form-field import-field-venc" data-idx="${idx}" value="${nota.vencimento}" oninput="formatarDataInput(this)"></div>
            <div class="campo"><label>Valor Total</label><input type="text" class="form-field import-field-valor" data-idx="${idx}" value="${nota.valor}" onblur="formatarValorBlur(event)"></div>
            <div class="campo"><label>Recurso</label><select class="import-field-obs" data-idx="${idx}">${DOM.obs.innerHTML}</select></div>
            ${avisosHTML}
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="card import-summary">
            <strong>${notasImportadasPreview.length}</strong> nota(s) fiscal(is) encontrada(s). Revise os campos abaixo (notas com aviso ⚠️ merecem atenção extra) e confirme a importação.
            <div class="import-toggle-novas">
                <div class="import-toggle-info"><strong>${totalNovas}</strong> nova${totalNovas === 1 ? '' : 's'} · <span>${totalProcessadas} já processada${totalProcessadas === 1 ? '' : 's'}</span></div>
                <button id="import-toggle-novas-btn" class="manage-toolbar-btn" onclick="toggleMostrarApenasNovasImportacao()">${mostrarApenasNovasImportacao ? `Mostrar Todas (${notasImportadasPreview.length})` : 'Mostrar Apenas Novas'}</button>
            </div>
            <div class="actions" style="margin-top:10px;">
                <button class="actions-button is-neutral" onclick="salvarHistoricoErpSemFinanceiro()">
                    <span class="icon-wrapper"><i class="fa-solid fa-database"></i></span>
                    Alimentar Histórico do ERP (todas as ${notasImportadasPreview.length}, sem gerar nota no financeiro)
                </button>
            </div>
            <div class="nota-detalhes" style="margin-top:2px;">Essa opção só salva os dados no histórico/reconciliação do ERP — não cria nada em Gerenciar Notas. Pode clicar quantas vezes quiser com o mesmo relatório, sem duplicar.</div>
            <div class="campo" style="margin-top:12px;"><input type="text" id="import-search" class="form-field" placeholder="Buscar por NF ou fornecedor..." oninput="filtrarPreviewImportacao(this.value)"></div>
            <div class="actions" style="gap: 10px; margin-top: 8px;">
                <button class="actions-button is-neutral" onclick="selecionarTodasImportacao(false)">Desmarcar Todas</button>
                <button class="actions-button is-neutral" onclick="selecionarTodasImportacao(true)">Marcar Todas</button>
            </div>
            <div class="import-bulk-recurso">
                <select id="import-bulk-recurso-select">${DOM.obs.innerHTML}</select>
                <button class="actions-button" onclick="aplicarRecursoEmLoteImportacao()">Aplicar Recurso às Marcadas</button>
            </div>
        </div>
        ${itensHTML}
        <div class="actions" style="margin-top: 8px;">
            <button class="actions-button is-success" onclick="confirmarImportacaoLote()">
                <span class="icon-wrapper"><i class="fa-solid fa-check-double"></i></span>
                Importar Selecionadas (<span id="import-count-selected">${totalNovas}</span>)
            </button>
        </div>`;

    aplicarFiltrosPreviewImportacao();
    atualizarContadorImportacao();
}

// Aplica em conjunto o filtro de busca (NF/fornecedor) e o filtro de status
// ("mostrar apenas novas"), sem re-renderizar — preserva qualquer edição que
// o usuário já tenha feito nos campos.
function aplicarFiltrosPreviewImportacao() {
    const termo = (document.getElementById('import-search')?.value || '').trim().toUpperCase();
    document.querySelectorAll('.import-item').forEach(item => {
        const passaStatus = !mostrarApenasNovasImportacao || item.dataset.status === 'novo';
        let passaBusca = true;
        if (termo) {
            const nf = item.querySelector('.import-field-nf')?.value || '';
            const forn = item.querySelector('.import-field-forn')?.value || '';
            passaBusca = nf.toUpperCase().includes(termo) || forn.toUpperCase().includes(termo);
        }
        item.style.display = (passaStatus && passaBusca) ? '' : 'none';
    });
}

function filtrarPreviewImportacao() {
    aplicarFiltrosPreviewImportacao();
}

function toggleMostrarApenasNovasImportacao() {
    mostrarApenasNovasImportacao = !mostrarApenasNovasImportacao;
    const btn = document.getElementById('import-toggle-novas-btn');
    if (btn) btn.textContent = mostrarApenasNovasImportacao ? `Mostrar Todas (${notasImportadasPreview.length})` : 'Mostrar Apenas Novas';
    aplicarFiltrosPreviewImportacao();
}

// Aplica o Recurso escolhido a todas as notas atualmente marcadas (checkbox
// "Importar esta nota") — útil depois de buscar por um grupo de NFs e marcar
// só elas.
function aplicarRecursoEmLoteImportacao() {
    const recurso = document.getElementById('import-bulk-recurso-select').value;
    if (!recurso) return toast('Escolha um recurso antes de aplicar.');
    const marcadas = document.querySelectorAll('.import-check:checked');
    if (marcadas.length === 0) return toast('Nenhuma nota marcada para importar.');
    marcadas.forEach(chk => {
        const idx = chk.dataset.idx;
        const select = document.querySelector(`.import-field-obs[data-idx="${idx}"]`);
        if (select) select.value = recurso;
    });
    toast(`✓ Recurso aplicado a ${marcadas.length} nota(s) marcada(s).`);
}

// Aprendizado automático de apelido: quando o usuário corrige o nome do
// fornecedor de uma linha (ex: de "COMERCIAL CIRURGICA RIOCLARENS" pra
// "RIOCLARENSE"), o app salva essa correspondência como apelido permanente
// (pra já vir certo em relatórios futuros) e aplica a mesma correção nas
// outras linhas dessa mesma importação que ainda estejam com o nome original.
async function handleEdicaoFornecedorImportacao(input) {
    const original = input.dataset.original;
    const novo = input.value.trim().toUpperCase();
    input.value = novo;

    if (!original || !novo || novo.toUpperCase() === original.toUpperCase()) return;
    if (apelidosFornecedores[original] === novo) return; // já estava salvo, nada a fazer

    apelidosFornecedores[original] = novo;
    try {
        await settingsDocRef.update({ [`apelidosFornecedores.${original}`]: novo });
    } catch (e) {
        try {
            await settingsDocRef.set({ apelidosFornecedores: { [original]: novo } }, { merge: true });
        } catch (e2) {
            console.error('Erro ao salvar apelido automático:', e2);
        }
    }
    await adicionarFornecedor(novo, true);
    popularListaApelidos();

    let outrasAfetadas = 0;
    document.querySelectorAll('.import-field-forn').forEach(el => {
        if (el === input) return;
        if (el.dataset.original === original && el.value.trim().toUpperCase() === original.toUpperCase()) {
            el.value = novo;
            outrasAfetadas++;
        }
    });

    toast(outrasAfetadas > 0
        ? `✓ Apelido "${novo}" salvo e aplicado a mais ${outrasAfetadas} nota(s) com "${original}".`
        : `✓ Apelido "${novo}" salvo para "${original}" — próximos relatórios já vêm certo.`);
}

function selecionarTodasImportacao(marcar) {
    document.querySelectorAll('.import-item').forEach(item => {
        if (item.style.display === 'none') return;
        const chk = item.querySelector('.import-check');
        if (chk) chk.checked = marcar;
    });
    atualizarContadorImportacao();
}

function atualizarContadorImportacao() {
    const total = document.querySelectorAll('.import-check:checked').length;
    const span = document.getElementById('import-count-selected');
    if (span) span.textContent = total;
}

async function confirmarImportacaoLote() {
    const checks = Array.from(document.querySelectorAll('.import-check'));
    const selecionadas = checks.filter(c => c.checked);

    if (selecionadas.length === 0) {
        return toast('Nenhuma nota marcada para importar. Se é só pra salvar os dados do ERP, use "Alimentar Histórico do ERP" acima.');
    }

    showConfirmModal({
        title: 'Confirmar Importação',
        message: `Criar ${selecionadas.length} nota(s) fiscal(is) na lista de notas pendentes (Gerenciar Notas)? O histórico do ERP dessas notas também será salvo/atualizado junto.`,
        confirmText: 'Sim, Importar',
        confirmClass: 'success',
        onConfirm: async () => {
            try {
                const batch = firestore.batch();
                const fornecedoresNovos = new Set();
                const vinculosErp = [];
                const checklistInicial = Object.keys(checklistDefinition).reduce((acc, key) => ({ ...acc, [key]: false }), {});
                checklistInicial.tirarFoto = false;

                selecionadas.forEach(chk => {
                    const idx = chk.dataset.idx;
                    const fornecedor = document.querySelector(`.import-field-forn[data-idx="${idx}"]`).value.trim().toUpperCase();
                    const nf = document.querySelector(`.import-field-nf[data-idx="${idx}"]`).value.trim();
                    const data = document.querySelector(`.import-field-data[data-idx="${idx}"]`).value.trim();
                    const vencimento = document.querySelector(`.import-field-venc[data-idx="${idx}"]`).value.trim();
                    const valor = document.querySelector(`.import-field-valor[data-idx="${idx}"]`).value.trim();
                    const obsEl = document.querySelector(`.import-field-obs[data-idx="${idx}"]`);
                    const obs = obsEl ? obsEl.value : '';

                    if (!fornecedor) return;

                    const novaNotaRef = notasCollection.doc();
                    vinculosErp.push({ idx, notaId: novaNotaRef.id });
                    batch.set(novaNotaRef, {
                        data,
                        nf,
                        vencimento,
                        valor,
                        fornecedor,
                        obs,
                        enviada: false,
                        dataCriacao: (new Date).toISOString(),
                        checklist: checklistInicial
                    });

                    if (fornecedor) fornecedoresNovos.add(fornecedor);
                });

                await batch.commit();

                for (const f of fornecedoresNovos) {
                    await adicionarFornecedor(f, true);
                }

                // Histórico entradasErp: salva TODOS os blocos reconhecidos no
                // relatório colado (não só as notas marcadas pra checklist) —
                // é uma fonte independente, isolada num try/catch próprio pra
                // uma falha aqui nunca comprometer a importação de notas que
                // acabou de funcionar acima.
                let msgEntradasErp = '';
                try {
                    const resultado = await salvarEntradasErp(notasImportadasPreview);
                    // Liga cada NF criada acima à sua entrada do ERP (mesmo registro,
                    // sem duplicar): as NFs marcadas deixam de ficar como "não
                    // decididas" e o arquivamento passa a sincronizar com o ERP.
                    await Promise.all(vinculosErp.map(v => {
                        const bloco = notasImportadasPreview[v.idx];
                        if (!bloco || !bloco.nf) return null;
                        return entradasErpCollection.doc(chaveEntradaErp(bloco))
                            .update({ statusFluxo: 'selecionada_financeiro', notaVinculadaId: v.notaId })
                            .catch(e => console.error('Erro ao vincular NF à entrada do ERP:', e));
                    }));
                    if (resultado.salvos > 0) msgEntradasErp = ` (+${resultado.salvos} no histórico de entradas do ERP)`;
                    if (resultado.associacoesSpDataAutomaticas > 0) msgEntradasErp += ` · +${resultado.associacoesSpDataAutomaticas} associação(ões) de SP Data preenchida(s) automaticamente`;
                } catch (e) {
                    console.error('Erro ao salvar histórico entradasErp:', e);
                }

                toast(`✓ ${selecionadas.length} nota(s) importada(s) com sucesso!${msgEntradasErp}`);

                notasImportadasPreview = [];
                document.getElementById('import-preview-container').innerHTML = '';
                document.getElementById('import-textarea').value = '';
            } catch (e) {
                console.error('Erro ao importar notas:', e);
                toast('✕ Erro ao importar as notas.');
            }
        }
    });
}
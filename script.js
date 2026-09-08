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

// --- ESTADO GLOBAL ---
let notasPendentes = [], historicoNotas = [], fornecedoresSugeridos = [], observacoesSugeridas = [], apelidosFornecedores = {};

// --- SELEÇÃO EM LOTE (notas e fornecedores) ---
let selectionModeNotas = false;
let notasSelecionadas = new Set();
let selectionModeFornecedores = false;
let fornecedoresIgnorados = new Set();

// --- ANOTAÇÕES (múltiplas notas com texto rico) ---
let listaAnotacoes = [];
let anotacaoAtualId = null;
let filtroAnotacoesTexto = '';
let selecaoAnotacoesAtiva = false;
let anotacoesSelecionadas = new Set();
let listaCotacoes = [];
let listaProdutosSpData = [];
let listaAssociacoesSpData = [];
let cotacaoEmEdicaoPedido = null; // null = nova cotação; string = editando cotação existente (doc id = pedido)
let fornecedoresCotacaoAtual = []; // rascunho em memória enquanto o formulário está aberto
let contadorFornecedorCotacaoId = 0;
let cotacaoEncontradaAuditoria = null; // cotação associada ao pedido digitado na Nova Auditoria, se existir
let migracaoAnotacoesAntigasFeita = false;
let fornecedoresSelecionados = new Set();
let filtroFornecedoresTexto = '';
let isChecklistUpdate = false;
let isInitialLoad = true;

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
        menuOrder: ['screen-add', 'screen-manage', 'screen-reports', 'screen-export', 'screen-history', 'screen-anotacoes', 'screen-settings'] 
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
    'screen-settings': { icon: 'fa-solid fa-cog', material: 'settings', title: 'Ajustes',
        outlineSvg: `<svg class="icon-svg-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
        duotoneSvg: `<svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><path opacity="0.4" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33A1.65 1.65 0 0 0 14 20.91V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.51-1A1.65 1.65 0 0 0 7.4 19.4l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.51 1 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>`},
};

const screenParentMap = { 'screen-personalizacao': 'screen-settings', 'screen-fornecedores': 'screen-settings', 'screen-observacoes': 'screen-settings', 'screen-import': 'screen-settings', 'screen-conta': 'screen-settings', 'screen-aprovacoes': 'screen-settings', 'screen-backup': 'screen-settings', 'screen-xml-editor': 'screen-settings', 'screen-spdata': 'screen-settings', 'screen-cotacoes': 'screen-settings', 'screen-cotacao-editor': 'screen-central-pedido', 'screen-central-pedido': 'screen-cotacoes', 'screen-anotacoes-editor': 'screen-anotacoes', 'screen-auditoria-nova': 'screen-anotacoes' };
const closeBtnBackScreen = { 'screen-personalizacao': 'screen-settings', 'screen-fornecedores': 'screen-settings', 'screen-observacoes': 'screen-settings', 'screen-import': 'screen-settings', 'screen-conta': 'screen-settings', 'screen-aprovacoes': 'screen-settings', 'screen-backup': 'screen-settings', 'screen-xml-editor': 'screen-settings', 'screen-spdata': 'screen-settings', 'screen-cotacoes': 'screen-settings', 'screen-cotacao-editor': 'screen-central-pedido', 'screen-central-pedido': 'screen-cotacoes', 'screen-anotacoes-editor': 'screen-anotacoes', 'screen-auditoria-nova': 'screen-anotacoes' };
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
    }, error => console.error("Erro ao carregar histórico:", error)));

    dataUnsubscribers.push(xmlExcecoesCollection.onSnapshot(snapshot => {
        bancoExcecoesXml = {};
        snapshot.docs.forEach(doc => { bancoExcecoesXml[doc.id] = doc.data().fator; });
    }, error => console.error("Erro ao carregar exceções de XML:", error)));

    dataUnsubscribers.push(cotacoesCollection.orderBy('atualizadoEm', 'desc').onSnapshot(snapshot => {
        listaCotacoes = snapshot.docs.map(doc => ({ pedido: doc.id, ...doc.data() }));
        if (document.getElementById('lista-cotacoes-container')) renderListaCotacoes();
        if (document.getElementById('central-fornecedores-container') && centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
    }, error => console.error("Erro ao carregar cotações:", error)));

    dataUnsubscribers.push(produtosSpDataCollection.onSnapshot(snapshot => {
        listaProdutosSpData = snapshot.docs.map(doc => ({ codigo: doc.id, ...doc.data() }));
    }, error => console.error("Erro ao carregar produtos SP Data:", error)));

    dataUnsubscribers.push(associacoesSpDataCollection.onSnapshot(snapshot => {
        listaAssociacoesSpData = snapshot.docs.map(doc => ({ codigoSmartCompras: doc.id, ...doc.data() }));
        if (document.getElementById('central-fornecedores-container') && centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
    }, error => console.error("Erro ao carregar associações SP Data:", error)));

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
    atualizarRelatorios();
}

// --- OUTRAS FUNÇÕES AUXILIARES ---
function rebuildNotasPendentesList(){
    if(!DOM.listaNotas) return;

    DOM.listaNotas.classList.toggle('selection-mode', selectionModeNotas);
    atualizarContadorGerenciar();
    
    const createNotaHTML = nota => {
        const holdBadgeHTML = nota.emEspera ? `<span class="badge-pendente"><i class="fa-solid fa-clock"></i> Pendente</span>` : '';
        const holdChipHTML = nota.emEspera
            ? `<button class="action-chip hold-chip active" onclick="toggleEmEspera('${nota.id}')"><i class="fa-solid fa-rotate-left"></i> Retomar</button>`
            : `<button class="action-chip hold-chip" onclick="toggleEmEspera('${nota.id}')"><i class="fa-solid fa-clock"></i> Pendente</button>`;
        const recursoHTML = nota.obs ? ` | Recurso: ${nota.obs}` : '';
        const checked = notasSelecionadas.has(nota.id) ? 'checked' : '';
        return`<label class="nota-select-checkbox" onclick="event.stopPropagation()"><input type="checkbox" ${checked} onchange="toggleNotaSelecionada('${nota.id}')"></label><div class="nota-info">${nota.fornecedor} ${nota.nf||''} ${holdBadgeHTML}</div><div class="nota-data">Criada em: ${(new Date(nota.dataCriacao)).toLocaleString('pt-BR')}</div><div class="nota-detalhes">Venc: ${nota.vencimento||'N/A'} | Valor: ${nota.valor||'N/A'}${recursoHTML}</div><div class="actions-row"><button class="action-chip edit-chip" onclick="toggleEditPanel(this, '${nota.id}')"><i class="fa-solid fa-pen"></i> Editar</button>${holdChipHTML}<button class="action-chip delete-chip" onclick="deletarNota('${nota.id}')"><i class="fa-solid fa-trash"></i> Excluir</button></div><div class="edit-panel"></div>`;
    };

    if(notasPendentes.length===0){
        DOM.listaNotas.innerHTML=`<div class="empty-state">Nenhuma nota pendente.</div>`;
        return;
    }
    
    // Diffing simples
    const domNoteIds = new Set(Array.from(DOM.listaNotas.children).map(li=>li.dataset.noteId));
    const newNoteIds = new Set(notasPendentes.map(n=>n.id));
    for(const id of domNoteIds){ if(!newNoteIds.has(id)){ const el=DOM.listaNotas.querySelector(`div[data-note-id="${id}"]`); if(el)el.remove(); } }
    const getNotaClassName = (nota) => `nota-item ${nota.enviada?'nota-enviada':''} ${nota.emEspera?'nota-pendente':''}`.trim();
    notasPendentes.forEach((nota,index)=>{
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
        const nf = (nota.nf || '').toUpperCase();
        const forn = (nota.fornecedor || '').toUpperCase();
        el.style.display = (nf.includes(termo) || forn.includes(termo)) ? '' : 'none';
    });
}

function atualizarContadorGerenciar() {
    const counterEl = document.getElementById('manage-counter');
    if (!counterEl) return;
    const total = notasPendentes.length;
    const pendentesCount = notasPendentes.filter(n => n.emEspera).length;
    counterEl.textContent = `${total} nota${total === 1 ? '' : 's'}${pendentesCount > 0 ? ` · ${pendentesCount} pendente${pendentesCount === 1 ? '' : 's'}` : ''}`;
}

function toggleSelectionModeNotas() {
    selectionModeNotas = !selectionModeNotas;
    if (!selectionModeNotas) notasSelecionadas.clear();
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
function popularDatalist(){DOM.fornDatalist.innerHTML='';fornecedoresSugeridos.sort().forEach(f=>DOM.fornDatalist.innerHTML+=`<option value="${f}"></option>`);popularListaFornecedores()}

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
function switchToScreen(screenId, title) { if (!document.getElementById(screenId) || document.getElementById(screenId).classList.contains('active')) return; const telaAnterior = document.querySelector('.app-screen.active'); if (telaAnterior && telaAnterior.id === 'screen-anotacoes-editor' && screenId !== 'screen-anotacoes-editor') { clearTimeout(autoSaveAnotacaoTimeout); salvarAnotacaoAtual(false); } closeAllModals(); const headerTitle = document.getElementById('main-header-title'); const subMenuScreens = Object.keys(closeBtnBackScreen); document.getElementById('sync-btn').style.display = subMenuScreens.includes(screenId) ? 'none' : 'flex'; document.getElementById('close-btn').style.display = subMenuScreens.includes(screenId) ? 'flex' : 'none'; const selectBtn = document.getElementById('select-mode-btn'); if (selectBtn) selectBtn.style.display = (screenId === 'screen-manage') ? 'flex' : 'none'; const counterEl = document.getElementById('manage-counter'); if (counterEl) counterEl.style.display = (screenId === 'screen-manage') ? 'inline-flex' : 'none'; if (screenId !== 'screen-manage' && selectionModeNotas) { selectionModeNotas = false; notasSelecionadas.clear(); if (selectBtn) selectBtn.classList.remove('active'); rebuildNotasPendentesList(); atualizarBulkBarNotas(); } headerTitle.classList.add('title-changing'); setTimeout(() => { headerTitle.textContent = title; headerTitle.classList.remove('title-changing'); }, 175); document.querySelectorAll('.app-screen.active').forEach(s => s.classList.remove('active')); document.getElementById(screenId).classList.add('active'); const parentScreenId = screenParentMap[screenId] || screenId; document.querySelectorAll('.tab-item, .sidebar-item').forEach(item => { item.classList.toggle('active', item.dataset.screen === parentScreenId); }); }
function popularListaReordenar() { const list = document.getElementById('menu-reorder-list'); list.innerHTML = ''; const order = appConfig.personalizacao.menuOrder; order.forEach((screenId, index) => { const details = menuDetails[screenId]; if (details) { const li = document.createElement('div'); li.className = 'reorder-list-item'; li.innerHTML = ` <div class="name"> <span class="icon-wrapper"><i class="${details.icon}"></i><span class="material-icons">${details.material}</span>${details.outlineSvg || ''}${details.duotoneSvg || ''}</span> <span>${details.title}</span> </div> <div class="actions"> <button onclick="moveMenuItem('${screenId}', 'up')" ${index === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button> <button onclick="moveMenuItem('${screenId}', 'down')" ${index === order.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button> </div> `; list.appendChild(li); } }); }
function moveMenuItem(screenId, direction) { const order = appConfig.personalizacao.menuOrder; const index = order.indexOf(screenId); if (index === -1) return; if (direction === 'up' && index > 0) { [order[index], order[index - 1]] = [order[index - 1], order[index]]; } else if (direction === 'down' && index < order.length - 1) { [order[index], order[index + 1]] = [order[index + 1], order[index]]; } salvarPersonalizacao(); }
function salvarPersonalizacao() { settingsDocRef.set({ personalizacao: appConfig.personalizacao }, { merge: true }).catch(error => console.error("Erro ao salvar personalização: ", error)); }
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
async function limpar(){showConfirmModal({title:"Confirmar Arquivamento",message:`Arquivar ${notasPendentes.length} nota(s)?`,confirmText:"Arquivar",confirmClass:"success",onConfirm:async()=>{if(notasPendentes.length===0)return toast("Nada para arquivar.");const batch=firestore.batch();for(const nota of notasPendentes){const{id,...notaData}=nota;notaData.dataHistorico=(new Date).toLocaleString('pt-BR');batch.set(historicoCollection.doc(),notaData);batch.delete(notasCollection.doc(id));}await batch.commit();toast("Notas arquivadas.")}})}
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
function linhasDeMateriais(d) {
    const def = TIPOS_DIVERGENCIA_AUDITORIA[d.tipo];
    if (!def) return [];
    if (def.multiMaterial) return (d.materiais || []).map(m => d.tipo === 'avariado' ? `${upAud(m.produto)} — material avariado` : linhaMaterial(d.tipo, m)).filter(Boolean);
    if (d.tipo === 'fornecedor_nao_entregou') {
        const c = d.campos || {};
        return [`ainda não entregou o pedido${c.diasEmAberto ? ', já são ' + c.diasEmAberto + ' dias em aberto' : ''}.${c.observacao ? ' ' + c.observacao : ''}`];
    }
    return [];
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
            const nomeExibicao = nomeExibicaoFornecedor(f.razaoSocial);
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
                    <span>${nomeExibicao}</span>
                </div>
                <div class="central-fornecedor-body" style="display:${aberto ? 'block' : 'none'};">
                    <div class="central-secao-titulo">Produtos Cotados</div>
                    ${produtosHTML}
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
    renderCentralPedidoCompleto(centralPedidoAtual);
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
    const nomeOficial = it.nomeOficial ? upAud(it.nomeOficial) : null;
    const observacao = it.descricao && it.descricao !== '---' ? upAud(it.descricao) : '';
    const marca = it.fabricante && it.fabricante !== '---' ? it.fabricante : '';
    const expandido = centralProdutosExpandidos.has(chaveUnica);

    const tituloHTML = nomeOficial
        ? `<div class="central-item-desc-linha">${nomeOficial}</div>`
        : `<div class="central-item-desc-linha central-item-sem-desc">Nome oficial: pendente de complementação (importe o relatório do SmartCompras)</div>`;

    const detalhesHTML = expandido ? `<div class="central-item-detalhes" onclick="event.stopPropagation()">
        ${it.codProduto ? `<div>Código SmartCompras: ${it.codProduto}</div>` : ''}
        ${observacao ? `<div>Observação do Fornecedor: ${observacao}</div>` : ''}
        ${marca ? `<div>Marca: ${marca}</div>` : ''}
        ${it.embalagem ? `<div>Embalagem: ${it.embalagem}</div>` : ''}
        ${it.quantidade ? `<div>Quantidade: ${it.quantidade}</div>` : ''}
        ${it.precoUnitario ? `<div>Valor Unitário: R$ ${it.precoUnitario}</div>` : ''}
        ${it.precoTotal ? `<div>Valor Total: R$ ${it.precoTotal}</div>` : ''}
        ${renderAssociacaoSpDataWidget(it, chaveUnica)}
    </div>` : '';

    const resumoMeta = [it.codProduto ? `Cód. ${it.codProduto}` : '', it.quantidade ? `Qtd ${it.quantidade}` : ''].filter(Boolean).join(' · ');

    return `<div class="central-item-linha" onclick="toggleCentralProduto('${chaveUnica}')">
        ${tituloHTML}
        <div class="central-item-meta">${resumoMeta}<i class="fa-solid fa-chevron-${expandido ? 'up' : 'down'} central-item-chevron"></i></div>
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
    const dets = Array.from(xmlDocAtual.getElementsByTagName('det'));

    itensXmlDetectados = dets.map(detEl => {
        const prod = detEl.getElementsByTagName('prod')[0];
        const get = (tag) => prod.getElementsByTagName(tag)[0]?.textContent || '';
        const xProd = get('xProd');
        const item = {
            prod,
            xProd,
            cProd: get('cProd'),
            cEAN: get('cEAN'),
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
            }))
        };
        const chave = chaveExcecaoXml(cnpjEmit, item);
        item.chaveExcecao = chave;
        if (bancoExcecoesXml[chave] !== undefined) {
            item.fator = bancoExcecoesXml[chave];
            item.deExcecao = true;
        } else {
            const det = detectarFatorXml(xProd);
            item.fator = det.fator;
            item.suspeito = det.suspeito;
        }
        return item;
    });

    document.getElementById('xml-card-itens').style.display = 'block';
    document.getElementById('xml-acoes-finais').style.display = 'flex';
    renderTabelaItensXml();
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

function renderTabelaItensXml() {
    const tbody = document.getElementById('xml-tbody-itens');
    tbody.innerHTML = itensXmlDetectados.map((item, idx) => `
        <tr>
            <td>
                <div class="xml-produto-nome">${item.xProd}</div>
                ${item.deExcecao ? '<span class="badge-excecao">lembrado</span>' : ''}
            </td>
            <td><input type="number" min="1" class="fator-input ${item.suspeito ? 'suspeito' : ''}" value="${item.fator}" onchange="atualizarFatorXml(${idx}, this.value)"></td>
            <td><input type="text" class="cprod-input" value="${item.cProd}" onchange="atualizarCProdXml(${idx}, this.value)"></td>
            <td class="xml-preview-linha">${formatarPreviewXml(item)}</td>
        </tr>
    `).join('');

    const totalConvertidos = itensXmlDetectados.filter(i => i.fator !== 1).length;
    const totalSuspeitos = itensXmlDetectados.filter(i => i.suspeito).length;
    document.getElementById('xml-resumo').textContent =
        `${itensXmlDetectados.length} item(ns) — ${totalConvertidos} serão convertidos` +
        (totalSuspeitos ? `, ${totalSuspeitos} sem padrão detectado (confira o fator manualmente)` : '');
}

function atualizarFatorXml(idx, valor) {
    const fator = parseInt(valor, 10) || 1;
    itensXmlDetectados[idx].fator = fator;
    itensXmlDetectados[idx].suspeito = false;
    itensXmlDetectados[idx].deExcecao = false;
    renderTabelaItensXml();
}
function atualizarCProdXml(idx, valor) {
    itensXmlDetectados[idx].cProdNovo = valor.trim();
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

async function baixarXmlConvertido() {
    if (!xmlDocAtual) return;
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
            excecoesParaSalvar[item.chaveExcecao] = fator;
        }
        item.uComEl.textContent = unidadeDestino;
        item.uTribEl.textContent = unidadeDestino;
    });

    // Lembra as correções pra próxima nota do mesmo fornecedor/produto.
    try {
        await Promise.all(Object.entries(excecoesParaSalvar).map(([chave, fator]) =>
            xmlExcecoesCollection.doc(chave).set({ fator, atualizadoEm: new Date().toISOString() }, { merge: true })
        ));
    } catch (e) { console.error('Erro ao salvar exceções de XML:', e); }

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
    datalist.innerHTML = fornecedores.map(f => `<option value="${nomeExibicaoFornecedor(f.razaoSocial)}">`).join('');
}

// Datalist de produtos filtrada pelo fornecedor já digitado no campo
// Fornecedor (se bater com algum da cotação) — senão mostra todos os
// produtos da cotação, já que o usuário pode digitar o fornecedor depois.
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
    const nomesUnicos = [...new Set(itensFiltrados.map(it => it.descricao).filter(Boolean))];
    datalist.innerHTML = nomesUnicos.map(nome => `<option value="${nome}">`).join('');
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
    const item = (cotacaoEncontradaAuditoria.itens || []).find(it => upAud(it.descricao) === alvo);
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

function renderListaCotacoes() {
    const container = document.getElementById('lista-cotacoes-container');
    if (!container) return;

    const termo = filtroCotacoesTexto.trim().toUpperCase();
    let lista = listaCotacoes.filter(c => {
        if (!termo) return true;
        const nomesFornecedores = (c.fornecedores || []).map(f => (f.razaoSocial || '').toUpperCase()).join(' ');
        return c.pedido.toUpperCase().includes(termo) || (c.origem || '').toUpperCase().includes(termo) || nomesFornecedores.includes(termo);
    });

    // 'entrada' já vem nessa ordem da query (orderBy atualizadoEm desc, ver
    // listener); só precisa reordenar explicitamente pro modo 'pedido'.
    if (ordenacaoCotacoes === 'pedido') {
        lista = [...lista].sort((a, b) => {
            const na = parseInt(a.pedido, 10), nb = parseInt(b.pedido, 10);
            if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
            return a.pedido.localeCompare(b.pedido);
        });
    }

    if (lista.length === 0) {
        container.innerHTML = `<div class="empty-state">${listaCotacoes.length === 0 ? 'Nenhuma cotação cadastrada ainda.' : 'Nenhuma cotação encontrada.'}</div>`;
        return;
    }
    container.innerHTML = lista.map(c => {
        const qtdFornecedores = (c.fornecedores || []).length;
        const dataLimite = c.dataLimite ? formatarDataBRSimples(c.dataLimite) : '';
        return `<div class="nota-item" onclick="abrirCentralPedido('${c.pedido}')">
            <div class="nota-info">${c.pedido}${c.origem ? ' - ' + c.origem : ''}</div>
            <div class="nota-detalhes">${qtdFornecedores} fornecedor${qtdFornecedores === 1 ? '' : 'es'}${dataLimite ? ' · Limite: ' + dataLimite : ''}</div>
        </div>`;
    }).join('');
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

// Nome de exibição de um fornecedor: reaproveita o MESMO cadastro de apelidos
// já usado na importação do relatório de NFs do ERP (apelidosFornecedores /
// encontrarApelidoFornecedor) — não é um cadastro paralelo. Preferência por
// CNPJ fica registrada como limitação: o cadastro de apelidos hoje é indexado
// por nome (não por CNPJ), então o match continua sendo por nome/prefixo.
function nomeExibicaoFornecedor(razaoSocial) {
    if (!razaoSocial) return '';
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
    (fornecedores || []).forEach(f => linhas.push(nomeExibicaoFornecedor(f.razaoSocial)));
    return '<p>' + linhas.map(l => l.replace(/</g, '&lt;')).join('<br>') + '</p>';
}

async function criarOuAtualizarAnotacaoDaCotacao(pedido, origem, dataPedido, dataLimite, fornecedores) {
    if (!pedido) return;
    const titulo = origem ? `${pedido} - ${origem}` : pedido;
    const existente = listaAnotacoes.find(a => a.pedido === pedido);
    try {
        if (!existente) {
            await anotacoesTextoCollection.add({
                titulo,
                conteudo: montarCabecalhoAnotacaoCotacao(pedido, origem, dataPedido, dataLimite, fornecedores),
                tipo: 'cotacao',
                pedido,
                atualizadoEm: new Date().toISOString(),
                criadoEm: new Date().toISOString()
            });
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
        }
    } catch (e) {
        console.error('Erro ao criar/atualizar anotação da cotação:', e);
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

function cancelarImportacaoXml() {
    importacaoXmlPendente = null;
    document.getElementById('card-preview-importacao-xml').style.display = 'none';
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
            // usuário — só os campos que vêm do XML são atualizados.
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

function parseRelatorioSmartCompras(texto) {
    const linhas = texto.split('\n').map(l => l.replace(/\r$/, ''));
    const mPedido = texto.match(/pedido #(\d+)/i);
    const pedido = mPedido ? mPedido[1] : '';

    const fornecedores = [];
    let i = 0;
    while (i < linhas.length) {
        const linha = linhas[i];
        if (/^CNPJ:\s*[\d.\/-]+/.test(linha.trim())) {
            const cnpjMatch = linha.match(/CNPJ:\s*([\d.\/-]+)/);
            const cnpj = cnpjMatch ? cnpjMatch[1] : '';
            let j = i - 1;
            while (j >= 0 && linhas[j].trim() === '') j--;
            const razaoSocial = linhas[j] ? linhas[j].trim() : '';

            let k = i + 1;
            while (k < linhas.length && !/^C[oó]digo\s*\t?Produto/i.test(linhas[k].trim())) {
                if (/^CNPJ:\s*[\d.\/-]+/.test(linhas[k].trim())) break;
                k++;
            }
            if (k >= linhas.length || !/^C[oó]digo/i.test(linhas[k].trim())) { i++; continue; }

            const itens = [];
            let linhaIdx = k + 1;
            while (linhaIdx < linhas.length) {
                const l = linhas[linhaIdx].trim();
                if (l.startsWith('Total:')) break;
                if (!l) { linhaIdx++; continue; }
                if (l.startsWith('Observações:')) { linhaIdx++; continue; }

                const partes = linhas[linhaIdx].split('\t').map(p => p.trim()).filter(p => p !== '');
                if (partes.length >= 6) {
                    const [codigo, produto, marca, qtd, valorUnitStr, valorTotalStr] = partes;
                    const proxima = linhas[linhaIdx + 1] ? linhas[linhaIdx + 1].trim() : '';
                    const observacao = proxima.startsWith('Observações:') ? proxima.replace('Observações:', '').trim() : '';
                    itens.push({
                        codigo,
                        produto: upAud(produto),
                        marca: (marca === '---') ? '' : marca,
                        quantidade: qtd,
                        valorUnitario: valorUnitStr.replace('R$', '').trim(),
                        valorTotal: valorTotalStr.replace('R$', '').trim(),
                        observacaoRelatorio: (observacao === '---' || observacao === '') ? '' : observacao
                    });
                    linhaIdx += proxima.startsWith('Observações:') ? 2 : 1;
                } else {
                    linhaIdx++;
                }
            }
            fornecedores.push({ razaoSocial, cnpj, itens });
            i = linhaIdx;
            continue;
        }
        i++;
    }
    return { pedido, fornecedores };
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

let relatorioSmartComprasPendente = null;

function processarRelatorioSmartComprasColado() {
    const texto = document.getElementById('relatorio-smartcompras-texto').value.trim();
    if (!texto) return toast('Cole o texto do relatório antes de processar.');
    if (!centralPedidoAtual) return;
    const cotacao = listaCotacoes.find(c => c.pedido === centralPedidoAtual);
    if (!cotacao) return toast('Nenhuma cotação cadastrada para este pedido ainda.');

    let relatorio;
    try {
        relatorio = parseRelatorioSmartCompras(texto);
    } catch (e) {
        console.error('Erro ao interpretar o relatório:', e);
        return toast('✕ Não consegui interpretar esse texto. Confira se é o relatório de fornecedores ganhadores.');
    }
    if (relatorio.fornecedores.length === 0) return toast('✕ Nenhum fornecedor reconhecido nesse texto.');
    if (relatorio.pedido && relatorio.pedido !== centralPedidoAtual) {
        return toast(`✕ Esse relatório é do pedido ${relatorio.pedido}, mas você está na Central do pedido ${centralPedidoAtual}.`);
    }

    const cruzamento = cruzarRelatorioComCotacao(cotacao, relatorio);
    relatorioSmartComprasPendente = { relatorio, cruzamento };

    const resumoEl = document.getElementById('relatorio-smartcompras-resumo');
    const totalItensRelatorio = relatorio.fornecedores.reduce((s, f) => s + f.itens.length, 0);
    let html = `<div class="xml-resumo-linha"><strong>Fornecedores no relatório:</strong> ${relatorio.fornecedores.length}</div>`;
    html += `<div class="xml-resumo-linha"><strong>Itens no relatório:</strong> ${totalItensRelatorio}</div>`;
    html += `<div class="xml-resumo-linha"><strong>Nomes que serão complementados:</strong> ${cruzamento.atualizacoes.length}</div>`;
    if (cruzamento.semCorrespondencia.length > 0) {
        html += `<div class="xml-diff-titulo">Itens do relatório sem correspondência na cotação (não afetados):</div><ul class="xml-diff-lista">${cruzamento.semCorrespondencia.map(x => `<li>${x.codigo} — ${x.produto} (${x.fornecedor})</li>`).join('')}</ul>`;
    }
    if (cruzamento.divergenciasDetectadas.length > 0) {
        html += `<div class="xml-diff-titulo">Possíveis divergências detectadas (revisar, não corrigidas automaticamente):</div><ul class="xml-diff-lista">${cruzamento.divergenciasDetectadas.map(l => `<li>${l}</li>`).join('')}</ul>`;
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
    if (!relatorioSmartComprasPendente || !centralPedidoAtual) return;
    const cotacao = listaCotacoes.find(c => c.pedido === centralPedidoAtual);
    if (!cotacao) return;

    // Só acrescenta nomeOficial nos itens que bateram — todo o resto do item
    // (código, observação do fornecedor, marca do XML, valores) permanece
    // exatamente como veio do XML, intocado.
    const { atualizacoes } = relatorioSmartComprasPendente.cruzamento;
    const novosItens = (cotacao.itens || []).map(it => {
        const match = atualizacoes.find(a => a.codProduto === it.codProduto && a.cnpjFornecedor === it.cnpjFornecedor);
        return match ? { ...it, nomeOficial: match.nomeOficial } : it;
    });

    try {
        await cotacoesCollection.doc(centralPedidoAtual).update({ itens: novosItens, atualizadoEm: new Date().toISOString() });
        toast(`✓ ${atualizacoes.length} nome(s) de produto complementado(s).`);
        cancelarRelatorioSmartCompras();
        renderCentralPedidoCompleto(centralPedidoAtual);
    } catch (e) {
        console.error('Erro ao salvar relatório do SmartCompras:', e);
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
    const el = document.getElementById('spdata-total-cadastrados');
    if (el) el.textContent = `${listaProdutosSpData.length} produto(s) cadastrado(s) atualmente.`;
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
                    nome: p.nome,
                    unidade: p.unidade,
                    quantidadeInventario: p.quantidade,
                    precoInventario: p.preco,
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
    if (!alvo) return [];
    const exatas = listaProdutosSpData.filter(p => normalizarTextoBusca(p.nome) === alvo);
    if (exatas.length > 0) return exatas;
    const tokensAlvo = alvo.split(/\s+/).filter(Boolean);
    return listaProdutosSpData.filter(p => {
        const nomeProd = normalizarTextoBusca(p.nome);
        return tokensAlvo.every(t => nomeProd.includes(t));
    });
}

// Confirma (ou corrige) uma associação. Histórico append-only: uma correção
// nunca apaga a entrada anterior, só acrescenta uma nova e atualiza qual é
// a atual (spDataCodigo no nível raiz do doc).
async function confirmarAssociacaoSpData(codigoSmartCompras, spDataCodigo) {
    if (!codigoSmartCompras || !spDataCodigo) return;
    const agora = new Date().toISOString();
    const existente = listaAssociacoesSpData.find(a => a.codigoSmartCompras === codigoSmartCompras);
    const jaEraEssa = existente && existente.spDataCodigo === spDataCodigo;
    const historico = existente ? [...(existente.historico || [])] : [];
    if (!jaEraEssa) historico.push({ spDataCodigo, confirmadoEm: agora, tipo: existente ? 'correcao' : 'confirmacao' });

    try {
        await associacoesSpDataCollection.doc(codigoSmartCompras).set({
            codigoSmartCompras, spDataCodigo, confirmadoEm: agora, historico
        });
        toast('✓ Associação confirmada.');
        renderCentralPedidoCompleto(centralPedidoAtual);
    } catch (e) {
        console.error('Erro ao confirmar associação SP Data:', e);
        toast('✕ Erro ao associar. Tente novamente.');
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
    return ctx.fornecedor + (ctx.nf ? ` — N.F. ${ctx.nf}` : '') + (ctx.pedido ? ` — Pedido ${ctx.pedido}` : '');
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
            const c = d.campos;
            if (d.tipo === 'fornecedor_nao_entregou') {
                const texto = `${c.fornecedorNome ? upAud(c.fornecedorNome) + ': ' : ''}ainda não entregou o pedido${c.diasEmAberto ? ', já são ' + c.diasEmAberto + ' dias em aberto' : ''}.${c.observacao ? ' ' + c.observacao : ''}`;
                blocos.push(texto);
            }
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
    if (!document.getElementById('aud-fornecedor').value.trim()) { toast('✕ Preencha ao menos o Fornecedor.'); return; }
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

function popularListaHistorico(){DOM.listaHistorico.innerHTML='';if(historicoNotas.length===0){DOM.listaHistorico.innerHTML=`<div class="empty-state">O histórico está vazio.</div>`;DOM.historicoActions.style.display='none'}else{DOM.historicoActions.style.display='grid';historicoNotas.forEach(nota=>{const div=document.createElement('div');div.classList.add('nota-item');div.innerHTML=`<div class="nota-info">${nota.fornecedor} ${nota.nf||''}</div><div class="nota-detalhes">Venc: ${nota.vencimento||'N/A'} | Valor: ${nota.valor||'N/A'} | Obs: ${nota.obs||'N/A'}</div><div class="nota-data">Arquivado em: ${nota.dataHistorico}</div>`;DOM.listaHistorico.appendChild(div)})}}
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

        const fornMatch = bloco.match(/Fornecedor:\s*\d+\s+(.+?)\s+Qtde\.\s*lan[cç]amentos/i);
        const fornecedor = fornMatch ? fornMatch[1].trim().toUpperCase().replace(/\s+/g, ' ') : '';
        if (!fornecedor) avisos.push('Não foi possível identificar o fornecedor — confira manualmente.');

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
            fornecedor,
            data,
            vencimento,
            valor: formatValorBR(valorTotalNum),
            parcelas: parcelas.length,
            avisos
        };
    });
}

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
        return toast('Nenhuma nota selecionada para importar.');
    }

    showConfirmModal({
        title: 'Confirmar Importação',
        message: `Importar ${selecionadas.length} nota(s) fiscal(is) para a lista de notas pendentes?`,
        confirmText: 'Sim, Importar',
        confirmClass: 'success',
        onConfirm: async () => {
            try {
                const batch = firestore.batch();
                const fornecedoresNovos = new Set();
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

                toast(`✓ ${selecionadas.length} nota(s) importada(s) com sucesso!`);

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
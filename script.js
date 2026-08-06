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
const settingsDocRef = firestore.collection('config').doc('appSettings');

// --- ESTADO GLOBAL ---
let notasPendentes = [], historicoNotas = [], fornecedoresSugeridos = [], observacoesSugeridas = [], pedidosRecursos = {}, apelidosFornecedores = {};

// --- SELEÇÃO EM LOTE (notas e fornecedores) ---
let selectionModeNotas = false;
let notasSelecionadas = new Set();
let selectionModeFornecedores = false;
let fornecedoresIgnorados = new Set();
let fornecedoresSelecionados = new Set();
let filtroFornecedoresTexto = '';
let isChecklistUpdate = false;
let isInitialLoad = true;

// Configuração Padrão
let appConfig = {
    personalizacao: { 
        theme: 'light', iconTheme: 'solid', font: 'sans', animationSpeed: 2, 
        menuOrder: ['screen-add', 'screen-manage', 'screen-reports', 'screen-export', 'screen-history', 'screen-anotacoes', 'screen-settings'] 
    },
    anotacoes: '', pedidosRecursos: {}, fornecedores: [], observacoes: ["C/C CTI", "C/C SANTA CASA", "Recurso Proprio Santa Casa", "Recurso Proprio CTI", "PAGO", "REMESSA"]
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
    listaPedidos: document.getElementById('lista-pedidos'),
    listaFornManage: document.getElementById('lista-fornecedores-manage'),
    fornManageInput: document.getElementById('forn-manage'),
    pedidoNumInput: document.getElementById('pedido-num'),
    pedidoRecursoSelect: document.getElementById('pedido-recurso'),
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

const screenParentMap = { 'screen-personalizacao': 'screen-settings', 'screen-fornecedores': 'screen-settings', 'screen-pedidos': 'screen-settings', 'screen-observacoes': 'screen-settings', 'screen-import': 'screen-settings' };
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
if (window.visualViewport) { window.visualViewport.addEventListener('resize', setAppHeight); }
// Rede de segurança: reforça o cálculo pouco depois da carga inicial, pra
// cobrir casos em que o navegador ainda está terminando de ajustar o layout
// da janela (comum em tela dividida) quando o app já rodou o cálculo inicial.
setTimeout(setAppHeight, 300);
setTimeout(setAppHeight, 1000);

const setupKeyboardListener = () => {
    if (!('visualViewport' in window)) return;
    const notesScreen = document.getElementById('screen-anotacoes');
    window.visualViewport.addEventListener('resize', () => {
        if (!notesScreen.classList.contains('active')) return;
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        const bottomPadding = 24; 
        if (keyboardHeight > 100) { 
            notesScreen.style.paddingBottom = `${keyboardHeight + bottomPadding}px`;
            setTimeout(() => notesScreen.scrollTop = notesScreen.scrollHeight, 100);
        } else { 
            notesScreen.style.paddingBottom = ''; 
        }
    });
};

function aplicarPersonalizacoes() {
    const { theme, iconTheme, font, animationSpeed, menuOrder } = appConfig.personalizacao;
    document.documentElement.setAttribute('data-font', font); document.body.setAttribute('data-theme', theme); document.body.setAttribute('data-icon-theme', iconTheme);
    document.documentElement.style.setProperty('--transition-duration', speedValueMap[animationSpeed]);
    document.querySelector('#theme-select').value = theme; document.querySelector('#icon-theme-select').value = iconTheme; document.querySelector('#font-select').value = font;
    document.querySelector('#animation-speed-slider').value = animationSpeed;
    document.getElementById('animation-speed-value').textContent = speedTextMap[animationSpeed];
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
    settingsDocRef.onSnapshot(doc => { 
      try {
        if (doc.exists) { 
            const data = doc.data(); 
            // Sanitiza: remove entradas que não sejam texto (ex: null/undefined que
            // possam ter ficado na lista por algum motivo), pra nunca travar a tela
            // de carregamento por causa de um item inválido na lista de fornecedores.
            fornecedoresSugeridos = (Array.isArray(data.fornecedores) ? data.fornecedores : []).filter(f => typeof f === 'string' && f.trim() !== '');
            observacoesSugeridas = data.observacoes || appConfig.observacoes; 
            pedidosRecursos = data.pedidosRecursos || {}; 
            apelidosFornecedores = data.apelidosFornecedores || {}; 
            fornecedoresIgnorados = new Set((Array.isArray(data.fornecedoresIgnorados) ? data.fornecedoresIgnorados : []).filter(f => typeof f === 'string' && f.trim() !== ''));
            
            // Lógica de merge das configurações salvas
            appConfig = { 
                ...appConfig, 
                ...data, 
                personalizacao: { ...appConfig.personalizacao, ...(data.personalizacao || {}) }, 
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
        popularListaPedidos(); 
        popularListaApelidos(); 
        
        const anotacoesTextarea = document.getElementById('anotacoes-textarea'); 
        if(anotacoesTextarea.value !== appConfig.anotacoes) { 
            anotacoesTextarea.value = appConfig.anotacoes || ''; 
        } 
        
        aplicarPersonalizacoes(); 
      } catch (e) {
        // Nunca deixa a tela de carregamento travada por causa de um erro
        // inesperado aqui — loga o erro pra investigar, mas libera a tela.
        console.error('Erro ao processar configurações:', e);
        toast('Algumas configurações não carregaram corretamente.');
      } finally {
        if (isInitialLoad) { 
            document.body.classList.remove('is-loading'); 
            const appLoader = document.getElementById('app-loader'); 
            if (appLoader) appLoader.classList.add('app-loader-hidden'); 
            isInitialLoad = false; 
        } 
      }
    }, error => { 
        console.error("Erro config:", error); 
        toast("Erro ao carregar configurações."); 
        document.body.classList.remove('is-loading'); 
        const appLoader = document.getElementById('app-loader'); 
        if (appLoader) appLoader.classList.add('app-loader-hidden'); 
    }); 
}

async function carregarEstado(){
    iniciarListenerConfiguracoes();
    
    notasCollection.orderBy('dataCriacao','desc').onSnapshot(snapshot => {
        if(snapshot.metadata.hasPendingWrites && (isChecklistUpdate || snapshot.docChanges().some(c => c.type === 'modified'))){
            isChecklistUpdate = false;
            notasPendentes = snapshot.docs.map(doc => ({id:doc.id, ...doc.data()}));
            return;
        }
        handleSnapshotChanges(snapshot);
    }, error => toast("Erro ao carregar dados."));
    
    historicoCollection.orderBy('dataHistorico','desc').onSnapshot(snapshot => {
        historicoNotas = snapshot.docs.map(doc => ({id:doc.id, ...doc.data()}));
        popularListaHistorico();
    }, error => console.error("Erro ao carregar histórico:", error));
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
        const totalTasks=Object.keys(checklistDefinition).length;
        const completedTasks=nota.checklist?Object.values(nota.checklist).filter(Boolean).length:0;
        const holdBadgeHTML = nota.emEspera ? `<span class="badge-pendente"><i class="fa-solid fa-hourglass-half"></i> Pendente</span>` : '';
        const holdBtnHTML = `<button class="hold-btn icon-only ${nota.emEspera ? 'active' : ''}" onclick="toggleEmEspera('${nota.id}')" title="${nota.emEspera ? 'Remover da pendência (volta a aparecer na exportação)' : 'Marcar como pendente (não aparece na exportação)'}"><span class="icon-wrapper"><i class="fa-solid fa-hourglass-half"></i></span></button>`;
        const recursoHTML = nota.obs ? ` | Recurso: ${nota.obs}` : '';
        const checked = notasSelecionadas.has(nota.id) ? 'checked' : '';
        return`<label class="nota-select-checkbox" onclick="event.stopPropagation()"><input type="checkbox" ${checked} onchange="toggleNotaSelecionada('${nota.id}')"></label><div class="nota-info">${nota.fornecedor} ${nota.nf||''} ${holdBadgeHTML}</div><div class="nota-data">Criada em: ${(new Date(nota.dataCriacao)).toLocaleString('pt-BR')}</div><div class="nota-detalhes">Venc: ${nota.vencimento||'N/A'} | Valor: ${nota.valor||'N/A'}${recursoHTML}</div><div class="actions-row"><div class="actions-group"><button class="progress-btn" onclick="toggleChecklist(this, '${nota.id}')">Progresso: ${completedTasks}/${totalTasks}</button></div><div class="actions-group">${holdBtnHTML}<button class="edit-btn icon-only" onclick="toggleEditPanel(this, '${nota.id}')"><span class="icon-wrapper"><i class="fa-solid fa-pen"></i><span class="material-icons">edit</span></span></button><button class="delete-btn icon-only" onclick="deletarNota('${nota.id}')"><span class="icon-wrapper"><i class="fa-solid fa-trash"></i><span class="material-icons">delete</span></span></button></div></div><div class="edit-panel"></div><div class="checklist-container"><div class="panel-content">${gerarHtmlChecklist(nota)}</div></div>`;
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
}

// --- SELEÇÃO EM LOTE DE NOTAS (Gerenciar) ---

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
    setAppHeight(); setupKeyboardListener(); checkLogin(); 
    
    document.querySelectorAll('.settings-list-group a[data-screen]').forEach(link => { link.addEventListener('click', (e) => { e.preventDefault(); switchToScreen(link.dataset.screen, link.dataset.title); }); });
    document.getElementById('close-btn').addEventListener('click', () => switchToScreen('screen-settings', 'Ajustes'));
    
    document.getElementById('theme-select').addEventListener('change', (e) => { appConfig.personalizacao.theme = e.target.value; salvarPersonalizacao(); });
    document.getElementById('icon-theme-select').addEventListener('change', (e) => { appConfig.personalizacao.iconTheme = e.target.value; salvarPersonalizacao(); });
    document.getElementById('font-select').addEventListener('change', (e) => { appConfig.personalizacao.font = e.target.value; salvarPersonalizacao(); });

    const speedSlider = document.getElementById('animation-speed-slider');
    speedSlider.addEventListener('input', (e) => { document.getElementById('animation-speed-value').textContent = speedTextMap[e.target.value]; });
    speedSlider.addEventListener('change', (e) => { appConfig.personalizacao.animationSpeed = parseInt(e.target.value, 10); salvarPersonalizacao(); });
    
    document.getElementById('anotacoes-textarea').addEventListener('input', debounce(salvarAnotacoesAutomatico, 1000));
      
    carregarEstado(); 
    limparFormularioPrincipal(false);

    const formFields = document.querySelectorAll('#screen-add .form-field');
    formFields.forEach((field, index) => { 
        field.addEventListener('keydown', (event) => { 
            if (event.key === 'Enter' && field.tagName !== 'TEXTAREA') { 
                event.preventDefault(); 
                const nextField = formFields[index + 1]; 
                if (nextField) { nextField.focus(); } else { document.getElementById('salvarBtn').click(); } 
            } 
        }); 
    });
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
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.style.display='block';clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.style.display='none',2000)}

function showConfirmModal({title,message,confirmText="Confirmar",confirmClass="danger",onConfirm}){
    const modal=document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent=title;
    document.getElementById('confirm-message').textContent=message;
    const confirmBtn=document.getElementById('confirm-btn');
    confirmBtn.textContent=confirmText;
    
    // Ajuste de classes do botão
    confirmBtn.style.backgroundColor = '';
    if(confirmClass === 'danger') confirmBtn.style.backgroundColor = 'var(--button-danger)';
    else if(confirmClass === 'success') confirmBtn.style.backgroundColor = 'var(--button-success)';
    else if(confirmClass === 'warning') confirmBtn.style.backgroundColor = 'var(--button-warning)';
    
    const cancelBtn=document.getElementById('cancel-btn');
    const confirmHandler=()=>{onConfirm();closeAllModals();cleanup()};
    const cancelHandler=()=>{closeAllModals();cleanup()};
    const cleanup=()=>{confirmBtn.removeEventListener('click',confirmHandler);cancelBtn.removeEventListener('click',cancelHandler)};
    confirmBtn.addEventListener('click',confirmHandler);
    cancelBtn.addEventListener('click',cancelHandler);
    modal.classList.add('active');
}

// --- FUNÇÕES DE SEGURANÇA E LOGIN ---
const checkmarkSVG = `<svg class="check-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>`;
function checkLogin() { if (localStorage.getItem('isLoggedIn') === 'true') { document.getElementById('app-container').style.display = 'flex'; document.getElementById('login-screen').style.display = 'none'; } else { document.getElementById('app-container').style.display = 'none'; document.getElementById('login-screen').style.display = 'flex'; } }
function handleLogin() { const passwordInput = document.getElementById('password-input'); const errorMessage = document.getElementById('error-message'); const loginIcon = document.getElementById('login-icon'); const senhaCorreta = localStorage.getItem('userPassword') || '1206'; if (passwordInput.value === senhaCorreta) { localStorage.setItem('isLoggedIn', 'true'); errorMessage.textContent = ''; loginIcon.classList.replace('fa-lock', 'fa-unlock'); loginIcon.parentElement.classList.add('unlocked'); setTimeout(checkLogin, 500); } else { errorMessage.textContent = 'Senha incorreta.'; passwordInput.classList.add('shake'); setTimeout(() => { passwordInput.classList.remove('shake'); passwordInput.value = ''; }, 820); } }
document.getElementById('password-input').addEventListener('keyup', (event) => { if (event.key === "Enter") { event.preventDefault(); handleLogin(); } });
function abrirModalSenhaComVerificacao() { document.getElementById('security-check-screen').style.display = 'flex'; setTimeout(() => document.getElementById('security-check-password-input').focus(), 50); }
function handleSecurityCheck() { const input = document.getElementById('security-check-password-input'); const errorMessage = document.getElementById('security-check-error-message'); const senhaCorreta = localStorage.getItem('userPassword') || '1206'; if (input.value === senhaCorreta) { document.getElementById('security-check-screen').style.display = 'none'; input.value = ''; errorMessage.textContent = ''; document.getElementById('password-change-screen').style.display = 'flex'; setTimeout(() => document.getElementById('new-password-input').focus(), 50); } else { errorMessage.textContent = 'Senha incorreta.'; input.classList.add('shake'); setTimeout(() => { input.classList.remove('shake'); input.value = ''; }, 820); } }
function cancelSecurityCheck() { document.getElementById('security-check-screen').style.display = 'none'; document.getElementById('security-check-password-input').value = ''; }
function closePasswordChangeScreen() { document.getElementById('password-change-screen').style.display = 'none'; document.getElementById('new-password-input').value = ''; document.getElementById('confirm-password-input').value = ''; }
function handleSaveNewPassword() { const n = document.getElementById('new-password-input'); const c = document.getElementById('confirm-password-input'); const e = document.getElementById('password-error-message'); if (n.value.trim().length < 4) { e.textContent = 'Mínimo 4 dígitos.'; return; } if (n.value !== c.value) { e.textContent = 'Senhas não conferem.'; c.classList.add('shake'); setTimeout(() => c.classList.remove('shake'), 820); return; } localStorage.setItem('userPassword', n.value); toast('✓ Senha alterada!'); closePasswordChangeScreen(); }

// --- MANAGE E CONFIGURAÇÕES ---
const debounce = (func, delay) => { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; };
const salvarAnotacoesAutomatico = () => { appConfig.anotacoes = document.getElementById('anotacoes-textarea').value; settingsDocRef.set({ anotacoes: appConfig.anotacoes }, { merge: true }).catch(error => { console.error("Erro no salvamento automático:", error); }); };
const salvarAnotacoesManual = () => { const saveButton = document.getElementById('anotacoes-salvar-btn'); const originalContent = saveButton.innerHTML; saveButton.disabled = true; saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; appConfig.anotacoes = document.getElementById('anotacoes-textarea').value; settingsDocRef.set({ anotacoes: appConfig.anotacoes }, { merge: true }).then(() => { saveButton.innerHTML = `${checkmarkSVG} Salvo!`; setTimeout(() => { saveButton.innerHTML = originalContent; saveButton.disabled = false; }, 1500); }).catch(error => { toast('Erro ao salvar.'); saveButton.innerHTML = originalContent; saveButton.disabled = false; }); };

// Funções de Anotações (Copiar/Colar/Limpar)
async function colarAnotacoes() { try { const text = await navigator.clipboard.readText(); const textarea = document.getElementById('anotacoes-textarea'); const start = textarea.selectionStart; const end = textarea.selectionEnd; const val = textarea.value; textarea.value = val.substring(0, start) + text + val.substring(end); textarea.selectionStart = textarea.selectionEnd = start + text.length; textarea.focus(); salvarAnotacoesAutomatico(); toast("Texto colado!"); } catch (err) { toast("Permissão negada ou não suportada."); } }
function copiarAnotacoes() { const b = document.getElementById('anotacoes-copiar-btn'); const o = b.innerHTML; const t = document.getElementById('anotacoes-textarea').value; if (!t.trim()) { toast("Nada para copiar."); return; } b.disabled = true; navigator.clipboard.writeText(t).then(() => { b.innerHTML = `${checkmarkSVG} Copiado!`; setTimeout(() => { b.innerHTML = o; b.disabled = false; }, 1500); }).catch(() => { toast('Erro ao copiar.'); b.innerHTML = o; b.disabled = false; }); }
function limparAnotacoes() { showConfirmModal({ title: "Limpar Anotações?", message: "Apagar todo o conteúdo?", confirmText: "Limpar", onConfirm: () => { document.getElementById('anotacoes-textarea').value = ''; salvarAnotacoesAutomatico(); toast("Anotações limpas."); } }); }

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
                <button class="actions-button" style="background-color: var(--button-success);" onclick="confirmarImportacaoFornecedores()">
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
async function adicionarPedido() { const pNum = DOM.pedidoNumInput.value.trim(); const r = DOM.pedidoRecursoSelect.value; if (!pNum || !r) { return toast('Preencha o pedido e o recurso.'); } const updateData = {}; updateData[`pedidosRecursos.${pNum}`] = r; DOM.pedidoNumInput.value = ''; DOM.pedidoRecursoSelect.value = ''; try { await settingsDocRef.update(updateData); toast(`Pedido ${pNum} adicionado!`); } catch (error) { if (error.code === 'not-found') { await settingsDocRef.set({ pedidosRecursos: { [pNum]: r } }, { merge: true }); toast(`Pedido ${pNum} adicionado!`); } else { toast(`Falha ao adicionar.`); } } }
async function deletarPedido(p) { showConfirmModal({ title: "Excluir Pedido", message: `Excluir pedido "${p}"?`, onConfirm: async () => { const updateData = {}; updateData[`pedidosRecursos.${p}`] = firebase.firestore.FieldValue.delete(); try { await settingsDocRef.update(updateData); toast(`Pedido ${p} excluído.`); } catch (error) { toast(`Falha ao excluir.`); } } }); }
function popularListaPedidos(){DOM.listaPedidos.innerHTML='';const pedidosOrdenados=Object.keys(pedidosRecursos).sort((a,b)=>Number(a)-Number(b));pedidosOrdenados.forEach(p=>{DOM.listaPedidos.innerHTML+=`<li>${p} - ${pedidosRecursos[p]} <button onclick="deletarPedido('${p}')"><i class="fa-solid fa-times-circle"></i></button></li>`})}

// --- FUNÇÕES DE LISTAGEM/HISTÓRICO ---
function switchToScreen(screenId, title) { if (!document.getElementById(screenId) || document.getElementById(screenId).classList.contains('active')) return; closeAllModals(); const headerTitle = document.getElementById('main-header-title'); const subMenuScreens = ['screen-fornecedores', 'screen-pedidos', 'screen-observacoes', 'screen-personalizacao']; document.getElementById('sync-btn').style.display = subMenuScreens.includes(screenId) ? 'none' : 'flex'; document.getElementById('close-btn').style.display = subMenuScreens.includes(screenId) ? 'flex' : 'none'; const selectBtn = document.getElementById('select-mode-btn'); if (selectBtn) selectBtn.style.display = (screenId === 'screen-manage') ? 'flex' : 'none'; if (screenId !== 'screen-manage' && selectionModeNotas) { selectionModeNotas = false; notasSelecionadas.clear(); if (selectBtn) selectBtn.classList.remove('active'); rebuildNotasPendentesList(); atualizarBulkBarNotas(); } headerTitle.classList.add('title-changing'); setTimeout(() => { headerTitle.textContent = title; headerTitle.classList.remove('title-changing'); }, 175); document.querySelectorAll('.app-screen.active').forEach(s => s.classList.remove('active')); document.getElementById(screenId).classList.add('active'); const parentScreenId = screenParentMap[screenId] || screenId; document.querySelectorAll('.tab-item, .sidebar-item').forEach(item => { item.classList.toggle('active', item.dataset.screen === parentScreenId); }); }
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
function popularListaHistorico(){DOM.listaHistorico.innerHTML='';if(historicoNotas.length===0){DOM.listaHistorico.innerHTML=`<div class="empty-state">O histórico está vazio.</div>`;DOM.historicoActions.style.display='none'}else{DOM.historicoActions.style.display='grid';historicoNotas.forEach(nota=>{const div=document.createElement('div');div.classList.add('nota-item');div.innerHTML=`<div class="nota-info">${nota.fornecedor} ${nota.nf||''}</div><div class="nota-detalhes">Venc: ${nota.vencimento||'N/A'} | Valor: ${nota.valor||'N/A'} | Obs: ${nota.obs||'N/A'}</div><div class="nota-data">Arquivado em: ${nota.dataHistorico}</div>`;DOM.listaHistorico.appendChild(div)})}}
async function reconstruirPainelFotosEdit(notaId){const nota=notasPendentes.find(n=>n.id===notaId);if(!nota)return;const painelEdicao=document.querySelector(`div[data-note-id="${notaId}"] .edit-panel`);painelEdicao.innerHTML=`<div class="panel-content"><div class="campo"><label>Fornecedor</label><input type="text" class="fornEdit" value="${nota.fornecedor||''}"></div><div class="campo"><label>NF</label><input type="text" class="nfEdit" value="${nota.nf||''}"></div><div class="campo"><label>Vencimento</label><input type="text" class="vencEdit" value="${nota.vencimento||''}" oninput="formatarDataInput(this)"></div><div class="campo"><label>Valor</label><input type="text" class="valorEdit" value="${nota.valor||''}" onblur="formatarValorBlur(event)"></div><div class="campo"><label>Observações</label><select class="obsEdit">${DOM.obs.innerHTML}</select></div><div class="actions"><button class="actions-button" style="background:var(--button-success);" onclick="salvarEdicao('${nota.id}')"><span class="icon-wrapper"><i class="fa-solid fa-save"></i><span class="material-icons">save</span></span> Salvar</button></div></div>`;painelEdicao.querySelector('.obsEdit').value=nota.obs||'';}
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
            <div class="actions" style="grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px;">
                <button class="actions-button" style="background-color: var(--text-light);" onclick="selecionarTodasImportacao(false)">Desmarcar Todas</button>
                <button class="actions-button" style="background-color: var(--text-light);" onclick="selecionarTodasImportacao(true)">Marcar Todas</button>
            </div>
            <div class="import-bulk-recurso">
                <select id="import-bulk-recurso-select">${DOM.obs.innerHTML}</select>
                <button class="actions-button" style="background-color: var(--accent-color);" onclick="aplicarRecursoEmLoteImportacao()">Aplicar Recurso às Marcadas</button>
            </div>
        </div>
        ${itensHTML}
        <div class="actions" style="margin-top: 8px;">
            <button class="actions-button" style="background-color: var(--button-success);" onclick="confirmarImportacaoLote()">
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
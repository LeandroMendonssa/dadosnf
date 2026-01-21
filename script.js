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
let notasPendentes = [], historicoNotas = [], fornecedoresSugeridos = [], observacoesSugeridas = [], pedidosRecursos = {};
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

const screenParentMap = { 'screen-personalizacao': 'screen-settings', 'screen-fornecedores': 'screen-settings', 'screen-pedidos': 'screen-settings', 'screen-observacoes': 'screen-settings' };
const speedTextMap = { 0: 'Off', 1: 'Lenta', 2: 'Normal', 3: 'Rápida' };
const speedValueMap = { 0: '0s', 1: '0.6s', 2: '0.35s', 3: '0.2s' };
const checklistDefinition={tirarFoto:"Tirar Foto",entradaSistema:"Entrada no sistema",produtosTransferidos:"Produtos transferidos",fotosNoServidor:"Fotos no servidor",cotacaoNoServidor:"Cotação no Servidor",notaEscaneada:"Nota Escaneada",estaNaPlanilha:"Está na planilha",cotacaoAnexada:"Cotação Anexada",notaCarimbada:"Nota Carimbada"};

// --- FUNÇÕES DE SETUP (LAYOUT) ---
const setAppHeight = () => { document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`); };
window.addEventListener('resize', setAppHeight);

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

    return notasPendentes.find(nota => {
        const notaNF = normalize(nota.nf);
        const notaForn = normalize(nota.fornecedor);
        
        // Regra: Mesmo fornecedor E (mesma NF ou NF parecida)
        // Aqui usamos igualdade estrita na normalização, o que pega "123.456" igual a "123456"
        const mesmoFornecedor = notaForn === fornNormalizado;
        const mesmaNF = notaNF === nfNormalizada;
        
        return mesmoFornecedor && mesmaNF;
    });
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

        showConfirmModal({
            title: "Nota Duplicada",
            message: `Já existe uma nota para o fornecedor "${fornecedor}" com a NF "${nf}". Deseja salvar mesmo assim?`,
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
        DOM.totalNotasExport.textContent = notasPendentes.length;
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
        if (doc.exists) { 
            const data = doc.data(); 
            fornecedoresSugeridos = data.fornecedores || []; 
            observacoesSugeridas = data.observacoes || appConfig.observacoes; 
            pedidosRecursos = data.pedidosRecursos || {}; 
            
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
        
        const anotacoesTextarea = document.getElementById('anotacoes-textarea'); 
        if(anotacoesTextarea.value !== appConfig.anotacoes) { 
            anotacoesTextarea.value = appConfig.anotacoes || ''; 
        } 
        
        aplicarPersonalizacoes(); 
        
        if (isInitialLoad) { 
            document.body.classList.remove('is-loading'); 
            isInitialLoad = false; 
        } 
    }, error => { 
        console.error("Erro config:", error); 
        toast("Erro ao carregar configurações."); 
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
    
    // Atualiza funcionalidades dependentes
    DOM.saida.value = buildSaidaText(notasPendentes);
    atualizarContadorExportacao();
    atualizarRelatorios();
}

// --- OUTRAS FUNÇÕES AUXILIARES ---
function rebuildNotasPendentesList(){
    if(!DOM.listaNotas) return;
    
    const createNotaHTML = nota => {
        const shareBtnHTML=`<button class="whatsapp-btn icon-only" onclick="compartilharNota('${nota.id}')"><i class="fab fa-whatsapp"></i></button>`;
        const totalTasks=Object.keys(checklistDefinition).length;
        const completedTasks=nota.checklist?Object.values(nota.checklist).filter(Boolean).length:0;
        const progressPercent=totalTasks>0?(completedTasks/totalTasks)*100:0;
        return`<div class="nota-info">${nota.fornecedor} ${nota.nf||''}</div><div class="nota-data">Criada em: ${(new Date(nota.dataCriacao)).toLocaleString('pt-BR')}</div><div class="nota-detalhes">Venc: ${nota.vencimento||'N/A'} | Valor: ${nota.valor||'N/A'}</div><div class="progress-bar-container"><div class="progress-bar" style="width: ${progressPercent}%"></div></div><div class="actions-row"><div class="actions-group"><button class="progress-btn" onclick="toggleChecklist(this, '${nota.id}')">Progresso: ${completedTasks}/${totalTasks}</button></div><div class="actions-group">${shareBtnHTML}<button class="edit-btn icon-only" onclick="toggleEditPanel(this, '${nota.id}')"><span class="icon-wrapper"><i class="fa-solid fa-pen"></i><span class="material-icons">edit</span></span></button><button class="delete-btn icon-only" onclick="deletarNota('${nota.id}')"><span class="icon-wrapper"><i class="fa-solid fa-trash"></i><span class="material-icons">delete</span></span></button></div></div><div class="edit-panel"></div><div class="checklist-container"><div class="panel-content">${gerarHtmlChecklist(nota)}</div></div>`;
    };

    if(notasPendentes.length===0){
        DOM.listaNotas.innerHTML=`<div class="empty-state">Nenhuma nota pendente.</div>`;
        return;
    }
    
    // Diffing simples
    const domNoteIds = new Set(Array.from(DOM.listaNotas.children).map(li=>li.dataset.noteId));
    const newNoteIds = new Set(notasPendentes.map(n=>n.id));
    for(const id of domNoteIds){ if(!newNoteIds.has(id)){ const el=DOM.listaNotas.querySelector(`div[data-note-id="${id}"]`); if(el)el.remove(); } }
    notasPendentes.forEach((nota,index)=>{
        const existingEl = DOM.listaNotas.querySelector(`div[data-note-id="${nota.id}"]`);
        const newHTML = createNotaHTML(nota);
        if(existingEl){
            if(existingEl.innerHTML!==newHTML){
                existingEl.innerHTML=newHTML;
                existingEl.className=`nota-item ${nota.enviada?'nota-enviada':''}`;
                if(!document.hidden) existingEl.classList.add('highlight-update');
            }
        } else {
            const div=document.createElement('div');
            div.className=`nota-item`;
            div.dataset.noteId=nota.id;
            div.innerHTML=newHTML;
            const referenceNode=DOM.listaNotas.children[index];
            DOM.listaNotas.insertBefore(div,referenceNode||null);
            if(!document.hidden) div.classList.add('highlight-update');
        }
    });
}

// --- FUNÇÕES DE EXPORTAÇÃO E ORDENAÇÃO ---
function getLinha(nota){
    let v=nota.vencimento,o=nota.obs;
    if(nota.obs==="REMESSA"){v="REMESSA";o="Recurso Proprio Santa Casa"}
    return[nota.data,nota.nf,v,nota.valor,"",nota.fornecedor,"","",o].join("\t")
}

function buildSaidaText(notas){ return notas.map(getLinha).join("\n"); }

function ordenarExportacao() {
    if (notasPendentes.length === 0) return toast("Nada para ordenar.");
    const notasOrdenadas = [...notasPendentes].sort((a, b) => {
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
async function adicionarFornecedor(forn, noToast = false) {const f = forn.trim().toUpperCase();if (f && !fornecedoresSugeridos.includes(f)) {fornecedoresSugeridos.push(f);await settingsDocRef.set({ fornecedores: fornecedoresSugeridos }, { merge: true });if (!noToast) toast(`Fornecedor ${f} adicionado!`);}}
async function adicionarFornecedorManage(){const f=DOM.fornManageInput.value.trim();if(f){await adicionarFornecedor(f);DOM.fornManageInput.value=''}}
async function deletarFornecedor(f){showConfirmModal({title:"Excluir Fornecedor",message:`Excluir "${f}"?`,onConfirm:async()=>{fornecedoresSugeridos = fornecedoresSugeridos.filter(item => item !== f);await settingsDocRef.update({fornecedores:firebase.firestore.FieldValue.arrayRemove(f)});toast(`Fornecedor ${f} excluído.`)}})}
function popularDatalist(){DOM.fornDatalist.innerHTML='';fornecedoresSugeridos.sort().forEach(f=>DOM.fornDatalist.innerHTML+=`<option value="${f}"></option>`);popularListaFornecedores()}
function popularListaFornecedores(){DOM.listaFornManage.innerHTML='';fornecedoresSugeridos.sort().forEach(f=>DOM.listaFornManage.innerHTML+=`<li>${f} <button onclick="deletarFornecedor('${f}')"><i class="fa-solid fa-times-circle"></i></button></li>`)}
async function adicionarObservacao(obs,noToast=false){const o=obs.trim();if(o&&!observacoesSugeridas.includes(o)){observacoesSugeridas.push(o);await settingsDocRef.set({ observacoes: observacoesSugeridas }, { merge: true });if(!noToast)toast(`Obs "${o}" adicionada!`)}}
function adicionarObservacaoManage(){const o=DOM.obsManageInput.value.trim();if(o){adicionarObservacao(o);DOM.obsManageInput.value=''}}
async function deletarObservacao(o){showConfirmModal({title:"Excluir Observação",message:`Excluir "${o}"?`,onConfirm:async()=>{observacoesSugeridas=observacoesSugeridas.filter(i=>i!==o);await settingsDocRef.update({observacoes:firebase.firestore.FieldValue.arrayRemove(o)});toast(`Obs "${o}" excluída.`)}})}
function popularObservacoesList(){DOM.obs.innerHTML='<option value="">Recurso a ser pago</option>';observacoesSugeridas.sort().forEach(o=>DOM.obs.innerHTML+=`<option value="${o}">${o}</option>`);DOM.listaObsManage.innerHTML='';observacoesSugeridas.sort().forEach(o=>DOM.listaObsManage.innerHTML+=`<li>${o} <button onclick="deletarObservacao('${o}')"><i class="fa-solid fa-times-circle"></i></button></li>`)}
async function adicionarPedido() { const pNum = DOM.pedidoNumInput.value.trim(); const r = DOM.pedidoRecursoSelect.value; if (!pNum || !r) { return toast('Preencha o pedido e o recurso.'); } const updateData = {}; updateData[`pedidosRecursos.${pNum}`] = r; DOM.pedidoNumInput.value = ''; DOM.pedidoRecursoSelect.value = ''; try { await settingsDocRef.update(updateData); toast(`Pedido ${pNum} adicionado!`); } catch (error) { if (error.code === 'not-found') { await settingsDocRef.set({ pedidosRecursos: { [pNum]: r } }, { merge: true }); toast(`Pedido ${pNum} adicionado!`); } else { toast(`Falha ao adicionar.`); } } }
async function deletarPedido(p) { showConfirmModal({ title: "Excluir Pedido", message: `Excluir pedido "${p}"?`, onConfirm: async () => { const updateData = {}; updateData[`pedidosRecursos.${p}`] = firebase.firestore.FieldValue.delete(); try { await settingsDocRef.update(updateData); toast(`Pedido ${p} excluído.`); } catch (error) { toast(`Falha ao excluir.`); } } }); }
function popularListaPedidos(){DOM.listaPedidos.innerHTML='';const pedidosOrdenados=Object.keys(pedidosRecursos).sort((a,b)=>Number(a)-Number(b));pedidosOrdenados.forEach(p=>{DOM.listaPedidos.innerHTML+=`<li>${p} - ${pedidosRecursos[p]} <button onclick="deletarPedido('${p}')"><i class="fa-solid fa-times-circle"></i></button></li>`})}

// --- FUNÇÕES DE LISTAGEM/HISTÓRICO ---
function switchToScreen(screenId, title) { if (!document.getElementById(screenId) || document.getElementById(screenId).classList.contains('active')) return; closeAllModals(); const headerTitle = document.getElementById('main-header-title'); const subMenuScreens = ['screen-fornecedores', 'screen-pedidos', 'screen-observacoes', 'screen-personalizacao']; document.getElementById('sync-btn').style.display = subMenuScreens.includes(screenId) ? 'none' : 'flex'; document.getElementById('close-btn').style.display = subMenuScreens.includes(screenId) ? 'flex' : 'none'; headerTitle.classList.add('title-changing'); setTimeout(() => { headerTitle.textContent = title; headerTitle.classList.remove('title-changing'); }, 175); document.querySelectorAll('.app-screen.active').forEach(s => s.classList.remove('active')); document.getElementById(screenId).classList.add('active'); const parentScreenId = screenParentMap[screenId] || screenId; document.querySelectorAll('.tab-item, .sidebar-item').forEach(item => { item.classList.toggle('active', item.dataset.screen === parentScreenId); }); }
function popularListaReordenar() { const list = document.getElementById('menu-reorder-list'); list.innerHTML = ''; const order = appConfig.personalizacao.menuOrder; order.forEach((screenId, index) => { const details = menuDetails[screenId]; if (details) { const li = document.createElement('div'); li.className = 'reorder-list-item'; li.innerHTML = ` <div class="name"> <span class="icon-wrapper"><i class="${details.icon}"></i><span class="material-icons">${details.material}</span>${details.outlineSvg || ''}${details.duotoneSvg || ''}</span> <span>${details.title}</span> </div> <div class="actions"> <button onclick="moveMenuItem('${screenId}', 'up')" ${index === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button> <button onclick="moveMenuItem('${screenId}', 'down')" ${index === order.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button> </div> `; list.appendChild(li); } }); }
function moveMenuItem(screenId, direction) { const order = appConfig.personalizacao.menuOrder; const index = order.indexOf(screenId); if (index === -1) return; if (direction === 'up' && index > 0) { [order[index], order[index - 1]] = [order[index - 1], order[index]]; } else if (direction === 'down' && index < order.length - 1) { [order[index], order[index + 1]] = [order[index + 1], order[index]]; } salvarPersonalizacao(); }
function salvarPersonalizacao() { settingsDocRef.set({ personalizacao: appConfig.personalizacao }, { merge: true }).catch(error => console.error("Erro ao salvar personalização: ", error)); }
function sincronizarManualmente(button){const syncButton=document.getElementById('sync-btn');if(syncButton.disabled)return;syncButton.disabled=true;const icon = syncButton.querySelector('.icon-wrapper i, .icon-wrapper svg'); if(icon) icon.classList.add('fa-spin'); toast("Sincronizando...");setTimeout(()=>{toast("✓ Dados atualizados.");syncButton.disabled=false;if(icon) icon.classList.remove('fa-spin'); if(icon) icon.classList.add('sync-success');setTimeout(()=>icon.classList.remove('sync-success'),800)},1250)}
function toggleEditPanel(btn,notaId){const notaItem=btn.closest('.nota-item');const editPanel=notaItem.querySelector('.edit-panel');document.querySelectorAll('.edit-panel.show').forEach(p=>{if(p!==editPanel)p.classList.remove('show')});const isVisible=editPanel.classList.toggle('show');if(isVisible&&editPanel.innerHTML===''){reconstruirPainelFotosEdit(notaId)}}
async function salvarEdicao(id){const notaItem=document.querySelector(`div[data-note-id="${id}"]`);const data={fornecedor:notaItem.querySelector(`.fornEdit`).value.trim().toUpperCase(),nf:notaItem.querySelector(`.nfEdit`).value.trim(),vencimento:notaItem.querySelector(`.vencEdit`).value.trim(),valor:notaItem.querySelector(`.valorEdit`).value.trim(),obs:notaItem.querySelector(`.obsEdit`).value.trim()};await notasCollection.doc(id).update(data);await adicionarFornecedor(data.fornecedor,true);toast('✓ Nota editada!');notaItem.querySelector('.edit-panel').classList.remove('show')}
function generateUniqueId(){return`${Date.now()}-${Math.random().toString(36).substr(2,9)}`}
async function deletarNota(id){showConfirmModal({title:"Confirmar Exclusão",message:"Deseja excluir esta nota permanentemente?",onConfirm:async()=>{await notasCollection.doc(id).delete();toast("🗑️ Nota excluída!")}})}
async function limpar(){showConfirmModal({title:"Confirmar Arquivamento",message:`Arquivar ${notasPendentes.length} nota(s)?`,confirmText:"Arquivar",confirmClass:"success",onConfirm:async()=>{if(notasPendentes.length===0)return toast("Nada para arquivar.");const batch=firestore.batch();for(const nota of notasPendentes){const{id,...notaData}=nota;notaData.dataHistorico=(new Date).toLocaleString('pt-BR');batch.set(historicoCollection.doc(),notaData);batch.delete(notasCollection.doc(id));}await batch.commit();toast("Notas arquivadas.")}})}
async function limparHistorico(){showConfirmModal({title:"Limpar Histórico?",message:"Esta ação é irreversível.",onConfirm:async()=>{if(historicoNotas.length===0)return;const batch=firestore.batch();historicoNotas.forEach(nota=>batch.delete(historicoCollection.doc(nota.id)));await batch.commit();toast("Histórico limpo!")}})}
async function compartilharNota(id){const nota=notasPendentes.find(n=>n.id===id);const textToShare = `${nota.fornecedor} ${nota.nf||''}`;if(navigator.share){try {await navigator.share({text: textToShare});toast("✓ Compartilhado!");} catch (error) {if(error.name!=='AbortError') toast("Erro.");}} else {try {await navigator.clipboard.writeText(textToShare);toast("Copiado!");} catch (err) {toast("Erro ao copiar.");}}}
function toggleChecklist(btn,notaId){const notaItem=btn.closest('.nota-item');const checklistContainer=notaItem.querySelector('.checklist-container');const editPanel=notaItem.querySelector('.edit-panel');document.querySelectorAll('.edit-panel.show, .checklist-container.show').forEach(p=>{if(p!==checklistContainer)p.classList.remove('show')});if(editPanel.classList.contains('show'))editPanel.classList.remove('show');checklistContainer.classList.toggle('show')}
function gerarHtmlChecklist(nota){let html='';const checklistData=nota.checklist||{};for(const key in checklistDefinition){const isChecked=checklistData[key]?'checked':'';html+=`<div class="checklist-item"><input type="checkbox" id="check-${key}-${nota.id}" ${isChecked} onchange="atualizarChecklist('${nota.id}', '${key}', this.checked)"><label for="check-${key}-${nota.id}">${checklistDefinition[key]}</label></div>`}return html}
function atualizarChecklist(notaId,tarefa,isChecked){isChecklistUpdate=!0;const updateData={};updateData[`checklist.${tarefa}`]=isChecked;notasCollection.doc(notaId).update(updateData).catch(error=>toast("Erro ao salvar progresso."));const nota=notasPendentes.find(n=>n.id===notaId);if(!nota)return;if(!nota.checklist)nota.checklist={};nota.checklist[tarefa]=isChecked;const totalTasks=Object.keys(checklistDefinition).length;const completedTasks=Object.values(nota.checklist).filter(Boolean).length;const progressPercent=(completedTasks/totalTasks)*100;const notaItemEl=document.querySelector(`div[data-note-id="${notaId}"]`);if(notaItemEl){const progressBar=notaItemEl.querySelector('.progress-bar');const progressButton=notaItemEl.querySelector('.progress-btn');if(progressBar)progressBar.style.width=`${progressPercent}%`;if(progressButton)progressButton.textContent=`Progresso: ${completedTasks}/${totalTasks}`}}
function popularListaHistorico(){DOM.listaHistorico.innerHTML='';if(historicoNotas.length===0){DOM.listaHistorico.innerHTML=`<div class="empty-state">O histórico está vazio.</div>`;DOM.historicoActions.style.display='none'}else{DOM.historicoActions.style.display='grid';historicoNotas.forEach(nota=>{const div=document.createElement('div');div.classList.add('nota-item');div.innerHTML=`<div class="nota-info">${nota.fornecedor} ${nota.nf||''}</div><div class="nota-detalhes">Venc: ${nota.vencimento||'N/A'} | Valor: ${nota.valor||'N/A'} | Obs: ${nota.obs||'N/A'}</div><div class="nota-data">Arquivado em: ${nota.dataHistorico}</div>`;DOM.listaHistorico.appendChild(div)})}}
async function reconstruirPainelFotosEdit(notaId){const nota=notasPendentes.find(n=>n.id===notaId);if(!nota)return;const painelEdicao=document.querySelector(`div[data-note-id="${notaId}"] .edit-panel`);painelEdicao.innerHTML=`<div class="panel-content"><div class="campo"><label>Fornecedor</label><input type="text" class="fornEdit" value="${nota.fornecedor||''}"></div><div class="campo"><label>NF</label><input type="text" class="nfEdit" value="${nota.nf||''}"></div><div class="campo"><label>Vencimento</label><input type="text" class="vencEdit" value="${nota.vencimento||''}" oninput="formatarDataInput(this)"></div><div class="campo"><label>Valor</label><input type="text" class="valorEdit" value="${nota.valor||''}" onblur="formatarValorBlur(event)"></div><div class="campo"><label>Observações</label><select class="obsEdit">${DOM.obs.innerHTML}</select></div><div class="actions"><button class="actions-button" style="background:var(--button-success);" onclick="salvarEdicao('${nota.id}')"><span class="icon-wrapper"><i class="fa-solid fa-save"></i><span class="material-icons">save</span></span> Salvar</button></div></div>`;painelEdicao.querySelector('.obsEdit').value=nota.obs||'';}
async function compartilharLista(){const texto=DOM.saida.value;if(!texto.trim())return toast("Nada para compartilhar.");if(navigator.share){await navigator.share({title:'Relação de Notas Fiscais',text:texto})}else{await navigator.clipboard.writeText(texto);toast("Copiado!")}}
async function exportar(){if(DOM.saida.value==="")return toast("Nada para copiar.");await navigator.clipboard.writeText(DOM.saida.value);toast("✓ Lista copiada!")}
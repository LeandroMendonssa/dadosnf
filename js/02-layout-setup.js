// 02-layout-setup.js — Setup do layout (campos, telas, navegação)
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// --- FUNÇÕES DE SETUP (LAYOUT) ---
// window.innerHeight pode reportar um valor errado/desatualizado logo na
// abertura da página (ex: navegador em tela dividida/snap do Windows, barras
// de endereço móveis que ainda estão animando), cortando o rodapé do app até
// algum evento de resize "de verdade" acontecer depois. Por isso: preferimos
// visualViewport.height quando disponível (mais confiável), e recalculamos em
// vários momentos-gatilho, não só uma vez.
// Campos que abrem o teclado do celular (checkbox, botão, data etc. não abrem).
const TIPOS_SEM_TECLADO = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'file', 'color', 'date', 'time', 'datetime-local', 'month', 'week', 'image'];
const campoDeTexto = el => !!el && ((el.tagName === 'INPUT' && !TIPOS_SEM_TECLADO.includes((el.type || 'text').toLowerCase())) || el.tagName === 'TEXTAREA' || el.isContentEditable === true);
const telaDeToque = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
let alturaViewportRepouso = 0; // altura do viewport SEM teclado (última medida em repouso)

const setAppHeight = () => {
    // Com o teclado aberto (ou um campo de texto em edição no celular) a altura
    // do app fica CONGELADA. Alguns navegadores encolhem a janela/visualViewport
    // ao abrir o teclado e, se a altura fosse recalculada aí, o app encolheria e
    // a barra de navegação "subiria" pro topo, deixando a tela vazia embaixo.
    if (document.body.classList.contains('keyboard-open') || (telaDeToque && campoDeTexto(document.activeElement))) return;
    const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    alturaViewportRepouso = h;
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
const TECLADO_ESTIMADO = 300; // usado até o navegador informar a altura real do teclado

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
            window.scrollTo(0, 0);
        }
    };

    // A medição da altura do teclado varia por navegador (em alguns, a janela
    // inteira encolhe junto e a diferença some). Por isso, no celular, um campo
    // de texto em edição já conta como "teclado aberto", medindo ou não.
    const alturaDoTeclado = () => Math.max(window.innerHeight - window.visualViewport.height, alturaViewportRepouso - window.visualViewport.height, 0);
    const emEdicao = () => telaDeToque && campoDeTexto(document.activeElement);

    window.visualViewport.addEventListener('resize', () => {
        const medida = alturaDoTeclado();
        aplicarEstadoTeclado(medida > KEYBOARD_HEIGHT_THRESHOLD || emEdicao(), medida > KEYBOARD_HEIGHT_THRESHOLD ? medida : TECLADO_ESTIMADO);
    });

    // Ao tocar num campo, o estado já muda ANTES do teclado terminar de abrir:
    // a barra some e a altura congela sem esperar (nem depender de) nenhum resize.
    document.addEventListener('focusin', (e) => {
        if (!telaDeToque || !campoDeTexto(e.target)) return;
        const medida = alturaDoTeclado();
        aplicarEstadoTeclado(true, medida > KEYBOARD_HEIGHT_THRESHOLD ? medida : TECLADO_ESTIMADO);
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
    // Fase 38: destino novo (ex.: Controle de NFs) que não está na ordem salva entra no fim e começa em "Mais".
    {
        const cfgP = appConfig.personalizacao;
        if (!Array.isArray(cfgP.menuHidden)) cfgP.menuHidden = [];
        const novos = Object.keys(menuDetails).filter(id => !(cfgP.menuOrder || []).includes(id));
        if (novos.length) { cfgP.menuOrder = [...(cfgP.menuOrder || []), ...novos]; cfgP.menuHidden = [...new Set([...cfgP.menuHidden, ...novos])]; }
    }
    const { theme, iconTheme, font, animationSpeed, menuOrder, transicaoTela, densidade, mostrarIconesAbas } = appConfig.personalizacao;
    if (!Array.isArray(appConfig.personalizacao.menuHidden)) appConfig.personalizacao.menuHidden = [];
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
    const currentActiveScreen = document.querySelector('.app-screen.active');
    if (currentActiveScreen) { const screenId = currentActiveScreen.id;
        const parentScreenId = screenParentMap[screenId] || screenId; document.querySelectorAll('.tab-item, .sidebar-item').forEach(item => { item.classList.toggle('active', item.dataset.screen === (item.classList.contains('tab-item') ? abaDaBarra(screenId) : parentScreenId)); });
    }
}
    
// Fase 32: destinos fora da barra (aparecem na tela "Mais"). Na ordem do menu.
function menuEscondidos(order) {
    const hidden = (appConfig.personalizacao && appConfig.personalizacao.menuHidden) || [];
    return (order || appConfig.personalizacao.menuOrder || []).filter(id => hidden.includes(id) && menuDetails[id]);
}
// Em qual aba da barra um destino aparece: ele mesmo, ou "Mais" se estiver escondido.
function abaDaBarra(screenId) {
    const pai = screenParentMap[screenId] || screenId;
    if (pai === 'screen-mais') return 'screen-mais';
    return menuEscondidos().includes(pai) ? 'screen-mais' : pai;
}
function abrirDestinoPeloMais(id, title) { destinoViaMais = id; destinoRetorno = { para: 'screen-mais', titulo: 'Mais' }; switchToScreen(id, title); }
function renderTelaMais() {
    const lista = document.getElementById('mais-lista');
    if (!lista) return;
    const linha = (onclick, iconeHTML, nome) => `<button type="button" class="mais-item" onclick="${onclick}"><span class="icon-wrapper">${iconeHTML}</span><span class="mais-item-nome">${nome}</span><i class="fa-solid fa-chevron-right mais-item-seta"></i></button>`;
    // Ferramentas: ficam sempre aqui (não são configuração)
    const ferramentas = linha("switchToScreen('screen-import', 'Importar Relatório (ERP)')", '<i class="fa-solid fa-file-import"></i>', 'Importar Relatório (ERP)');
    const itens = menuEscondidos();
    const fora = itens.map(id => {
        const d = menuDetails[id];
        return linha(`abrirDestinoPeloMais('${id}', '${d.title}')`, `<i class="${d.icon}"></i><span class="material-icons">${d.material}</span>${d.outlineSvg || ''}${d.duotoneSvg || ''}`, d.title);
    }).join('');
    lista.innerHTML = `<div class="mais-secao-titulo">Ferramentas</div><div class="mais-grupo">${ferramentas}</div>` +
        (itens.length ? `<div class="mais-secao-titulo">Atalhos</div><div class="mais-grupo">${fora}</div>` : '');
}
function reordenarMenusDOM(order) {
    const tabBar = document.getElementById('tab-bar');
    const sidebarNav = document.getElementById('sidebar-nav');
    tabBar.innerHTML = ''; sidebarNav.innerHTML = '';
    const escondidos = menuEscondidos(order);
    order.forEach(screenId => {
        const details = menuDetails[screenId];
        if (details) {
            const iconHTML = `<span class="icon-wrapper"><i class="${details.icon}"></i><span class="material-icons">${details.material}</span>${details.outlineSvg || ''}${details.duotoneSvg || ''}</span>`;
            if (!escondidos.includes(screenId)) {
                const tabButton = document.createElement('button'); tabButton.className = 'tab-item'; tabButton.dataset.screen = screenId; tabButton.dataset.title = details.title;
                tabButton.innerHTML = `${iconHTML}<span>${details.title}</span>`;
                tabButton.addEventListener('click', (e) => { e.preventDefault(); switchToScreen(screenId, details.title); });
                tabBar.appendChild(tabButton);
            }
            const sidebarLi = document.createElement('li'); const sidebarA = document.createElement('a'); sidebarA.className = 'sidebar-item'; sidebarA.dataset.screen = screenId; sidebarA.dataset.title = details.title;
            sidebarA.innerHTML = `${iconHTML}<span>${details.title}</span>`;
            sidebarA.addEventListener('click', (e) => { e.preventDefault(); switchToScreen(screenId, details.title); });
            sidebarLi.appendChild(sidebarA); sidebarNav.appendChild(sidebarLi);
        }
    });
    // Fase 40: na tela larga a barra inferior some e o menu lateral é o único caminho — a ferramenta que vive em "Mais" precisa estar nele.
    {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'sidebar-item'; a.dataset.screen = 'screen-mais'; a.dataset.title = 'Importar Relatório (ERP)';
        a.innerHTML = '<span class="icon-wrapper"><i class="fa-solid fa-file-import"></i><span class="material-icons">upload_file</span></span><span>Importar Relatório (ERP)</span>';
        a.addEventListener('click', (e) => { e.preventDefault(); switchToScreen('screen-import', 'Importar Relatório (ERP)'); });
        li.appendChild(a); sidebarNav.appendChild(li);
    }
    // Botão "Mais": sempre ativo — guarda as ferramentas (Importar Relatório ERP) e os destinos tirados da barra.
    {
        const mais = document.createElement('button'); mais.className = 'tab-item'; mais.dataset.screen = 'screen-mais'; mais.dataset.title = 'Mais';
        mais.innerHTML = `<span class="icon-wrapper"><i class="fa-solid fa-ellipsis"></i><span class="material-icons">more_horiz</span><svg class="icon-svg-outline" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg><svg class="icon-svg-duotone" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></span><span>Mais</span>`;
        mais.addEventListener('click', (e) => { e.preventDefault(); switchToScreen('screen-mais', 'Mais'); });
        tabBar.appendChild(mais);
    }
    renderTelaMais();
    const ativa = document.querySelector('.app-screen.active');
    if (ativa) document.querySelectorAll('.tab-item, .sidebar-item').forEach(item => item.classList.toggle('active', item.dataset.screen === (item.classList.contains('tab-item') ? abaDaBarra(ativa.id) : (screenParentMap[ativa.id] || ativa.id))));
}


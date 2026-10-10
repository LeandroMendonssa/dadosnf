// 05-listeners-dados.js — Listeners do Firestore e lista de notas pendentes
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// --- LISTENERS DE DADOS ---
function iniciarListenerConfiguracoes() { 
    return settingsDocRef.onSnapshot(doc => { 
      try {
        if (doc.exists) { 
            const data = doc.data(); 
            // Sanitiza: remove entradas que não sejam texto (ex: null/undefined que
            // possam ter ficado na lista por algum motivo), pra nunca travar a tela
            // de carregamento por causa de um item inválido na lista de fornecedores.
            fornecedoresSugeridos = (Array.isArray(data.fornecedores) ? data.fornecedores : []).filter(f => typeof f === 'string' && f.trim() !== '' && nomeTextoSeguro(f));
            // Fase 44: remove do banco (uma vez) o lixo "[object Object]" que um bug antigo gravou como fornecedor/apelido.
            {
                const lixoForn = (Array.isArray(data.fornecedores) ? data.fornecedores : []).filter(f => typeof f === 'string' && /object object/i.test(f));
                const lixoApel = Object.keys(data.apelidosFornecedores || {}).filter(k => /object object/i.test(k) || /object object/i.test(String(data.apelidosFornecedores[k])));
                if ((lixoForn.length || lixoApel.length) && !window.__limpezaObjectObjectFeita) {
                    window.__limpezaObjectObjectFeita = true;
                    const args = [];
                    if (lixoForn.length) args.push('fornecedores', firebase.firestore.FieldValue.arrayRemove(...lixoForn));
                    lixoApel.forEach(k => args.push(new firebase.firestore.FieldPath('apelidosFornecedores', k), firebase.firestore.FieldValue.delete()));
                    settingsDocRef.update(...args).catch(e => console.error('Erro ao limpar fornecedor inválido:', e));
                }
            }
            observacoesSugeridas = data.observacoes || appConfig.observacoes; 
            apelidosFornecedores = Object.fromEntries(Object.entries(data.apelidosFornecedores || {}).filter(([k, v]) => nomeTextoSeguro(k) && nomeTextoSeguro(v))); 
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
    assinaturasFeitas = {};
    clearTimeout(timerSegundoPlano);
    isInitialLoad = true;
}

// Fase 44.1: na abertura chegam ~13 listeners do Firestore em sequência e cada um redesenhava telas pesadas
// (Relatórios, Histórico de NFs, Controle). Aqui vários pedidos de redesenho seguidos viram um só.
const renderAgendado = {};
function agendarRender(nome, fn, atrasoMs = 150) {
    if (renderAgendado[nome]) clearTimeout(renderAgendado[nome]);
    renderAgendado[nome] = setTimeout(() => {
        renderAgendado[nome] = null;
        try { fn(); } catch (e) { console.error('Erro ao redesenhar (' + nome + '):', e); }
    }, atrasoMs);
}

// Fase 2.0.2: assinatura sob demanda. Cada coleção tem a sua função de assinar; só as essenciais
// (configurações, notas, histórico, fornecedores) sobem na abertura. As demais sobem quando a tela que
// as usa abre (DADOS_POR_TELA) ou, no máximo, em segundo plano logo depois da abertura, uma por vez.
const ASSINATURAS_DADOS = {
    notas: () => {
        return notasCollection.orderBy('dataCriacao','desc').onSnapshot(snapshot => {
            if(snapshot.metadata.hasPendingWrites && (isChecklistUpdate || snapshot.docChanges().some(c => c.type === 'modified'))){
                isChecklistUpdate = false;
                notasPendentes = snapshot.docs.map(doc => ({id:doc.id, ...doc.data()}));
                return;
            }
            handleSnapshotChanges(snapshot);
        }, error => toast("Erro ao carregar dados."));
    },
    historico: () => {
        return historicoCollection.orderBy('dataHistorico','desc').onSnapshot(snapshot => {
            historicoNotas = snapshot.docs.map(doc => ({id:doc.id, ...doc.data()}));
            popularListaHistorico();
            renderAbaAtivaRelatorios();
        }, error => console.error("Erro ao carregar histórico:", error));
    },
    xmlExcecoes: () => {
        return xmlExcecoesCollection.onSnapshot(snapshot => {
            bancoExcecoesXml = {};
            snapshot.docs.forEach(doc => { bancoExcecoesXml[doc.id] = doc.data().fator; });
        }, error => console.error("Erro ao carregar exceções de XML:", error));
    },
    cotacoes: () => {
        return cotacoesCollection.orderBy('atualizadoEm', 'desc').onSnapshot(snapshot => {
            listaCotacoes = snapshot.docs.map(doc => ({ pedido: doc.id, ...doc.data() }));
            if (document.getElementById('lista-cotacoes-container')) renderListaCotacoes();
            if (document.getElementById('central-fornecedores-container') && centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
            renderAbaAtivaRelatorios();
            if (document.getElementById('historico-nfs-navegacao')) renderHistoricoNfs(); renderControleSeAtivo();
        }, error => console.error("Erro ao carregar cotações:", error));
    },
    produtosSpData: () => {
        return produtosSpDataCollection.onSnapshot(snapshot => {
            listaProdutosSpData = snapshot.docs.map(doc => ({ codigo: doc.id, ...doc.data() }));
            if (document.getElementById('spdata-lista-produtos')) renderListaProdutosSpData();
        }, error => console.error("Erro ao carregar produtos SP Data:", error));
    },
    associacoesSpData: () => {
        return associacoesSpDataCollection.onSnapshot(snapshot => {
            listaAssociacoesSpData = snapshot.docs.map(doc => ({ codigoSmartCompras: doc.id, ...doc.data() }));
            if (document.getElementById('central-fornecedores-container') && centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
            if (document.getElementById('xml-card-associacao') && nfeInfoAtual) renderAssociacaoCotacaoXml();
        }, error => console.error("Erro ao carregar associações SP Data:", error));
    },
    associacoesFornecedor: () => {
        return associacoesFornecedorCollection.onSnapshot(snapshot => {
            bancoAssociacoesFornecedor = {};
            snapshot.docs.forEach(doc => { bancoAssociacoesFornecedor[doc.id] = doc.data(); });
            if (document.getElementById('xml-card-associacao') && nfeInfoAtual) renderAssociacaoCotacaoXml();
        }, error => console.error("Erro ao carregar associações de fornecedor:", error));
    },
    // Histórico entradasErp: consumido pela tela de Histórico (Fase 6) via
    // montarHistoricoNfs(), sem coleção própria — só junta com nfsProcessadas
    // pela mesma chave natural (nf_serie) que as duas já usam.
    entradasErp: () => {
        return entradasErpCollection.onSnapshot(snapshot => {
            listaEntradasErp = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (document.getElementById('historico-nfs-navegacao')) renderHistoricoNfs(); renderControleSeAtivo();
        }, error => console.error("Erro ao carregar histórico de entradas do ERP:", error));
    },
    fornecedoresSpData: () => {
        return fornecedoresSpDataCollection.onSnapshot(snapshot => {
            listaFornecedoresSpData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (document.getElementById('lista-cadastro-fornecedores-spdata')) renderListaFornecedoresUnificada();
            if (DOM.fornDatalist) popularDatalist();
        }, error => console.error("Erro ao carregar cadastro de fornecedores SP Data:", error));
    },
    nfsProcessadas: () => {
        return nfsProcessadasCollection.onSnapshot(snapshot => {
            listaNfsProcessadas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (document.getElementById('central-fornecedores-container') && centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
            if (document.getElementById('historico-nfs-navegacao')) renderHistoricoNfs(); renderControleSeAtivo();
        }, error => console.error("Erro ao carregar NFs processadas:", error));
    },
    relatorioGanhadores: () => {
        return relatorioGanhadoresCollection.onSnapshot(snapshot => {
            listaRelatorioGanhadores = snapshot.docs.map(doc => doc.data());
            if (document.getElementById('central-fornecedores-container') && centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
        }, error => console.error("Erro ao carregar relatório de fornecedores ganhadores:", error));
    },
    anotacoes: () => {
        return anotacoesTextoCollection.orderBy('atualizadoEm','desc').onSnapshot(async snapshot => {
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
            if (document.getElementById('historico-nfs-navegacao')) renderHistoricoNfs(); renderControleSeAtivo();
        }, error => console.error("Erro ao carregar anotações:", error));
    }
};

const DADOS_ESSENCIAIS = ['notas', 'historico', 'fornecedoresSpData'];
const DADOS_SEGUNDO_PLANO = ['cotacoes', 'nfsProcessadas', 'entradasErp', 'associacoesSpData', 'associacoesFornecedor', 'produtosSpData', 'relatorioGanhadores', 'anotacoes', 'xmlExcecoes'];
const DADOS_TODOS_TELAS = ['cotacoes', 'nfsProcessadas', 'entradasErp', 'associacoesSpData', 'associacoesFornecedor', 'produtosSpData', 'relatorioGanhadores', 'anotacoes', 'xmlExcecoes', 'fornecedoresSpData'];
// Quais coleções cada tela precisa. Telas que não aparecem aqui usam só o que já sobe na abertura.
const DADOS_POR_TELA = {
    'screen-reports': ['cotacoes', 'anotacoes'],
    'screen-history': ['nfsProcessadas', 'entradasErp', 'cotacoes'],
    'screen-controle-nfs': ['nfsProcessadas', 'entradasErp', 'cotacoes'],
    'screen-xml-editor': ['nfsProcessadas', 'xmlExcecoes', 'associacoesFornecedor', 'associacoesSpData', 'cotacoes', 'produtosSpData', 'entradasErp'],
    'screen-spdata': ['produtosSpData', 'associacoesSpData'],
    'screen-cotacoes': ['cotacoes', 'associacoesSpData', 'produtosSpData', 'nfsProcessadas', 'relatorioGanhadores', 'entradasErp', 'associacoesFornecedor'],
    'screen-cotacao-editor': ['cotacoes', 'associacoesSpData', 'produtosSpData', 'nfsProcessadas', 'relatorioGanhadores', 'entradasErp', 'associacoesFornecedor'],
    'screen-central-pedido': ['cotacoes', 'associacoesSpData', 'produtosSpData', 'nfsProcessadas', 'relatorioGanhadores', 'entradasErp', 'associacoesFornecedor'],
    'screen-auditoria-nova': ['cotacoes', 'associacoesSpData', 'produtosSpData', 'nfsProcessadas', 'relatorioGanhadores', 'entradasErp', 'associacoesFornecedor'],
    'screen-anotacoes': ['anotacoes'],
    'screen-anotacoes-editor': ['anotacoes'],
    'screen-import': ['entradasErp', 'nfsProcessadas', 'cotacoes', 'associacoesSpData', 'associacoesFornecedor', 'produtosSpData'],
    'screen-backup': DADOS_TODOS_TELAS
};
let assinaturasFeitas = {};
let timerSegundoPlano = null;

function assinarDados(nome) {
    if (assinaturasFeitas[nome] || !ASSINATURAS_DADOS[nome]) return;
    assinaturasFeitas[nome] = true;
    try { dataUnsubscribers.push(ASSINATURAS_DADOS[nome]()); }
    catch (e) { assinaturasFeitas[nome] = false; console.error('Erro ao assinar ' + nome + ':', e); }
}
function garantirDadosDaTela(screenId) {
    if (!dadosAppInscritos) return;
    (DADOS_POR_TELA[screenId] || []).forEach(assinarDados);
}
// Sobe o que faltar, uma coleção por vez (a cada 350 ms), pra nunca travar a tela de uma vez só.
function agendarAssinaturasSegundoPlano() {
    clearTimeout(timerSegundoPlano);
    const fila = DADOS_SEGUNDO_PLANO.filter(n => !assinaturasFeitas[n]);
    const proximo = () => {
        if (!dadosAppInscritos) return;
        const nome = fila.shift();
        if (!nome) return;
        assinarDados(nome);
        timerSegundoPlano = setTimeout(proximo, 350);
    };
    timerSegundoPlano = setTimeout(proximo, 1500);
}

async function carregarEstado(){
    dataUnsubscribers.push(iniciarListenerConfiguracoes());
    DADOS_ESSENCIAIS.forEach(assinarDados);
    agendarAssinaturasSegundoPlano();
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
    renderControleSeAtivo(); // Fase 38
    if(!DOM.listaNotas) return;

    DOM.listaNotas.classList.toggle('selection-mode', selectionModeNotas);
    atualizarContadorGerenciar();
    atualizarAvisoRecursosGerenciar(); // Fase 40

    const createNotaHTML = nota => {
        const holdBadgeHTML = nota.emEspera ? `<span class="badge-pendente"><i class="fa-solid fa-clock"></i> Pendente</span>` : '';
        const holdChipHTML = nota.emEspera
            ? `<button class="action-chip hold-chip active" onclick="toggleEmEspera('${nota.id}')"><i class="fa-solid fa-rotate-left"></i> Retomar</button>`
            : `<button class="action-chip hold-chip" onclick="toggleEmEspera('${nota.id}')"><i class="fa-solid fa-clock"></i> Pendente</button>`;
        const arquivarChipHTML = `<button class="action-chip" onclick="event.stopPropagation(); arquivarNotaIndividual('${nota.id}')"><i class="fa-solid fa-box-archive"></i> Arquivar</button>`;
        const recursoHTML = nota.obs ? ` | Recurso: ${nota.obs}` : '';
        // Fase 11/12: aptidão pra saída + dados complementares (pedido,
        // CNPJ, destino, recurso confirmado) — sempre visível aqui, mesmo
        // fora do modo de seleção, só informativo, nunca bloqueia nada.
        const aptidao = calcularAptidaoSaidaNota(nota);
        const recSugerido = (!nota.obs && aptidao.recursos && aptidao.recursos.length === 1) ? aptidao.recursos[0] : '';
        const aplicarRecursoHTML = recSugerido ? `<button class="action-chip" onclick="event.stopPropagation(); aplicarRecursoSugeridoNota('${nota.id}')">Aplicar recurso: ${recSugerido}</button>` : '';
        const aptidaoHTML = `<span class="xml-item-badge ${aptidao.badge}" title="${aptidao.label.replace(/"/g, '&quot;')}">${aptidao.label}</span>`;
        const complementoPartes = [
            aptidao.pedido ? `Pedido ${aptidao.pedido}` : null,
            aptidao.destino || null,
            aptidao.cnpjFornecedor ? formatarCnpjExibicao(aptidao.cnpjFornecedor) : null,
            (aptidao.recursos && aptidao.recursos.length) ? `Recurso: ${aptidao.recursos.join(', ')}` : null
        ].filter(Boolean);
        const complementoHTML = complementoPartes.length ? `<div class="nota-data">${complementoPartes.join(' · ')}</div>` : '';

        // Checkbox da seleção em lote (edição)
        const checkboxHTML = `<label class="nota-select-checkbox" onclick="event.stopPropagation()"><input type="checkbox" ${notasSelecionadas.has(nota.id) ? 'checked' : ''} onchange="toggleNotaSelecionada('${nota.id}')"></label>`;

        // Fase 32: cabeçalho compacto (quem · NF / valor · vencimento / prazo) + chips; o resto continua igual.
        const diasVenc = calcularDiasParaVencimento(nota.vencimento);
        const prazoHTML = diasVenc === null ? '' : diasVenc < 0
            ? `<span class="nota-prazo atrasada">Venceu há ${Math.abs(diasVenc)} dia${Math.abs(diasVenc) === 1 ? '' : 's'}</span>`
            : diasVenc === 0 ? `<span class="nota-prazo atrasada">Vence hoje</span>`
            : `<span class="nota-prazo ${diasVenc <= 3 ? 'proximo' : ''}">Vence em ${diasVenc} dia${diasVenc === 1 ? '' : 's'}</span>`;
        return `${checkboxHTML}<div class="nota-topo"><div><div class="nota-info">${nota.fornecedor} ${nota.nf||''} ${holdBadgeHTML}</div><div class="nota-sub">${nota.valor||'N/A'} · Venc. ${nota.vencimento||'N/A'}${nota.obs ? ' · ' + nota.obs : ''}</div></div>${prazoHTML}</div><div class="nota-chips">${aptidaoHTML}${aplicarRecursoHTML}</div>${complementoHTML}<div class="nota-data">Criada em: ${(new Date(nota.dataCriacao)).toLocaleString('pt-BR')}</div><div class="actions-row"><button class="action-chip edit-chip" onclick="toggleEditPanel(this, '${nota.id}')"><i class="fa-solid fa-pen"></i> Editar</button>${holdChipHTML}${arquivarChipHTML}<button class="action-chip delete-chip" onclick="deletarNota('${nota.id}')"><i class="fa-solid fa-trash"></i> Excluir</button></div><div class="edit-panel"></div>`;
    };

    // Fase 38: Gerenciar NF = só o que foi escolhido pra Saída de Texto; as retidas (Pendente) ficam na aba "Em espera".
    const notasParaExibir = notasPendentes.filter(n => abaGerenciar === 'espera' ? !!n.emEspera : !n.emEspera);
    if(notasParaExibir.length===0){
        DOM.listaNotas.innerHTML=`<div class="empty-state">${abaGerenciar === 'espera' ? 'Nenhuma nota em espera.' : 'Nenhuma nota na relação para saída.'}</div>`;
        return;
    }
    
    // Fase 38: tirar a mensagem de "vazio" de antes (ao trocar de aba ela ficava embaixo dos cartões)
    DOM.listaNotas.querySelectorAll(':scope > .empty-state').forEach(el => el.remove());
    // Diffing simples
    const domNoteIds = new Set(Array.from(DOM.listaNotas.children).map(li=>li.dataset.noteId));
    const newNoteIds = new Set(notasParaExibir.map(n=>n.id));
    for(const id of domNoteIds){ if(!newNoteIds.has(id)){ const el=DOM.listaNotas.querySelector(`div[data-note-id="${id}"]`); if(el)el.remove(); } }
    const getNotaClassName = (nota) => `nota-item ${nota.enviada?'nota-enviada':''} ${nota.emEspera?'nota-pendente':''}`.trim();
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

let abaGerenciar = 'saida';
function alternarAbaGerenciar(aba) {
    abaGerenciar = aba;
    if (notasSelecionadas.size) { notasSelecionadas.clear(); atualizarBulkBarNotas(); } // Fase 40: a seleção não atravessa abas
    rebuildNotasPendentesList();
}
function atualizarContadorGerenciar() {
    const contSaida = document.getElementById('gerenciar-cont-saida'), contEspera = document.getElementById('gerenciar-cont-espera');
    if (contSaida) contSaida.textContent = notasPendentes.filter(n => !n.emEspera).length;
    if (contEspera) contEspera.textContent = notasPendentes.filter(n => n.emEspera).length;
    document.querySelectorAll('#gerenciar-abas .xml-filtro-btn').forEach(b => b.classList.toggle('active', b.dataset.aba === abaGerenciar));
    const counterEl = document.getElementById('manage-counter');
    if (!counterEl) return;
    const total = notasPendentes.length;
    const pendentesCount = notasPendentes.filter(n => n.emEspera).length;
    // Fase 33: texto curto pra não espremer o título "Gerenciar NF"; o completo fica no title.
    counterEl.textContent = `${total}${pendentesCount > 0 ? ` · ${pendentesCount} pend.` : ''}`;
    counterEl.title = `${total} nota${total === 1 ? '' : 's'}${pendentesCount > 0 ? ` · ${pendentesCount} pendente${pendentesCount === 1 ? '' : 's'}` : ''}`;
}


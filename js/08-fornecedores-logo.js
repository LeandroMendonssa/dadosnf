// 08-fornecedores-logo.js — Fornecedores (seleção, ignorados, apelidos, importação em massa) e logo
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
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
        lista.innerHTML += `<li><div><strong>${apelido}</strong><div class="txt-aux">${nomeCompleto}</div></div> <button onclick="deletarApelidoFornecedor('${nomeCompleto.replace(/'/g, "\\'")}')"><i class="fa-solid fa-times-circle"></i></button></li>`;
    });
}

// --- IMPORTAÇÃO EM MASSA DE FORNECEDORES ---
// Permite colar/subir uma lista (ex: exportada da planilha mestre de repasse de
// notas) com um fornecedor por linha, e adicionar todos de uma vez só — em vez
// de precisar cadastrar um por um.






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
    if (nomeTextoSeguro(apelidosFornecedores[nome])) return apelidosFornecedores[nome];
    for (const chave in apelidosFornecedores) {
        if (!nomeTextoSeguro(chave) || !nomeTextoSeguro(apelidosFornecedores[chave])) continue;
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
function switchToScreen(screenId, title) { if (!document.getElementById(screenId) || document.getElementById(screenId).classList.contains('active')) return; const telaAnterior = document.querySelector('.app-screen.active'); if (telaAnterior && telaAnterior.id === 'screen-anotacoes-editor' && screenId !== 'screen-anotacoes-editor') { clearTimeout(autoSaveAnotacaoTimeout); salvarAnotacaoAtual(false); } closeAllModals(); garantirDadosDaTela(screenId); const headerTitle = document.getElementById('main-header-title'); if (screenId === 'screen-mais' || (menuDetails[screenId] && screenId !== destinoViaMais)) destinoViaMais = null; const subMenuScreens = Object.keys(closeBtnBackScreen).concat(destinoViaMais ? [destinoViaMais] : []); document.getElementById('sync-btn').style.display = subMenuScreens.includes(screenId) ? 'none' : 'flex'; document.getElementById('close-btn').style.display = subMenuScreens.includes(screenId) ? 'flex' : 'none'; const selectBtn = document.getElementById('select-mode-btn'); if (selectBtn) selectBtn.style.display = (screenId === 'screen-manage') ? 'flex' : 'none'; const counterEl = document.getElementById('manage-counter'); if (counterEl) counterEl.style.display = (screenId === 'screen-manage') ? 'inline-flex' : 'none'; if (screenId !== 'screen-manage' && selectionModeNotas) { selectionModeNotas = false; notasSelecionadas.clear(); if (selectBtn) selectBtn.classList.remove('active'); rebuildNotasPendentesList(); atualizarBulkBarNotas(); } headerTitle.classList.add('title-changing'); setTimeout(() => { headerTitle.textContent = title; headerTitle.classList.remove('title-changing'); }, 175); document.querySelectorAll('.app-screen.active').forEach(s => s.classList.remove('active')); document.getElementById(screenId).classList.add('active'); const parentScreenId = screenParentMap[screenId] || screenId; document.querySelectorAll('.tab-item, .sidebar-item').forEach(item => { item.classList.toggle('active', item.dataset.screen === (item.classList.contains('tab-item') ? abaDaBarra(screenId) : parentScreenId)); }); if (screenId === 'screen-mais') renderTelaMais(); if (screenId === 'screen-controle-nfs') renderControleNfs(); if (screenId === 'screen-cotacoes') renderListaCotacoes(); if (screenId === 'screen-historico-mudancas') renderHistoricoMudancas(); }
function popularListaReordenar() { const list = document.getElementById('menu-reorder-list'); list.innerHTML = ''; const order = appConfig.personalizacao.menuOrder; const hidden = appConfig.personalizacao.menuHidden || []; order.forEach((screenId, index) => { const details = menuDetails[screenId]; if (details) { const naBarra = !hidden.includes(screenId); const li = document.createElement('div'); li.className = 'reorder-list-item' + (naBarra ? '' : ' fora-da-barra'); li.innerHTML = ` <div class="name"> <span class="icon-wrapper"><i class="${details.icon}"></i><span class="material-icons">${details.material}</span>${details.outlineSvg || ''}${details.duotoneSvg || ''}</span> <span>${details.title}</span> </div> <div class="actions"> <label class="menu-barra-toggle" title="Mostrar na barra inferior"><input type="checkbox" ${naBarra ? 'checked' : ''} onchange="toggleMenuNaBarra('${screenId}', this.checked)"><span>${naBarra ? 'Na barra' : 'Em Mais'}</span></label> <button onclick="moveMenuItem('${screenId}', 'up')" ${index === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button> <button onclick="moveMenuItem('${screenId}', 'down')" ${index === order.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button> </div> `; list.appendChild(li); } }); }
// Fase 32: escolher quais destinos ficam na barra inferior. Os que saem vão pra tela "Mais" (o botão aparece sozinho); todos na barra = sem "Mais".
function toggleMenuNaBarra(screenId, naBarra) { const cfg = appConfig.personalizacao; const hidden = new Set(cfg.menuHidden || []); if (naBarra) hidden.delete(screenId); else hidden.add(screenId); cfg.menuHidden = [...hidden]; reordenarMenusDOM(cfg.menuOrder); popularListaReordenar(); salvarPersonalizacao(); }
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
async function salvarEdicao(id){const notaItem=document.querySelector(`div[data-note-id="${id}"]`);const data={fornecedor:notaItem.querySelector(`.fornEdit`).value.trim().toUpperCase(),nf:notaItem.querySelector(`.nfEdit`).value.trim(),vencimento:notaItem.querySelector(`.vencEdit`).value.trim(),valor:notaItem.querySelector(`.valorEdit`).value.trim(),obs:notaItem.querySelector(`.obsEdit`).value.trim()};const notaLocal=notasPendentes.find(n=>n.id===id);if(notaLocal)Object.assign(notaLocal,data);await notasCollection.doc(id).update(data);await adicionarFornecedor(data.fornecedor,true);DOM.saida.value=buildSaidaText(notasPendentes.filter(n=>!n.emEspera));atualizarContadorExportacao();toast('✓ Nota editada!');notaItem.querySelector('.edit-panel').classList.remove('show')}
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
// Mesma lógica de limpar() (arquivamento em lote), só que pra uma nota só —
// pra não precisar excluir uma nota do Gerenciar quando ela já foi resolvida.
async function arquivarNotaIndividual(id) {
    const nota = notasPendentes.find(n => n.id === id);
    if (!nota) return;
    showConfirmModal({
        title: 'Arquivar esta nota?',
        message: `Arquivar ${nota.fornecedor} ${nota.nf || ''}? Ela sai da relação ativa e vai pro Histórico.`,
        confirmText: 'Arquivar',
        confirmClass: 'success',
        onConfirm: async () => {
            const { id: _id, ...notaData } = nota;
            notaData.dataHistorico = (new Date).toLocaleString('pt-BR');
            registrarOrigemNaNotaArquivada(notaData, id); // Fase 38
            const batch = firestore.batch();
            batch.set(historicoCollection.doc(), notaData);
            batch.delete(notasCollection.doc(id));
            const entradaVinculada = listaEntradasErp.find(e => e.notaVinculadaId === id);
            if (entradaVinculada) batch.update(entradasErpCollection.doc(entradaVinculada.id), { statusFluxo: 'arquivada' });
            await batch.commit();
            toast('✓ Nota arquivada.');
        }
    });
}
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
                registrarOrigemNaNotaArquivada(notaData, id); // Fase 38
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

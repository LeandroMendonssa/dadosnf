// 06-exportar-pdf.js — PDF da saída de texto e exportação
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
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
    doc.setFontSize(18);
    doc.text('PROTOCOLO DE REPASSE NF', pageWidth / 2, y + 17, { align: 'center' });
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
        doc.setFontSize(8);
        colunas.forEach(col => {
            doc.rect(x, y, col.largura, alturaLinha);
            doc.setFont('helvetica', 'bold');
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

    // Assinaturas — fixas no rodapé da última página (a tabela já para 90pt
    // acima do fim da página), com cada nome centralizado sob a sua linha.
    const yAssinatura = pageHeight - 60;
    const larguraAssinatura = (pageWidth - margin * 2) / 3;
    const larguraLinha = larguraAssinatura - 25;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    ['DATA', 'ASSINATURA CONTÁBIL', 'ASSINATURA ALMOXARIFADO'].forEach((label, i) => {
        const cx = margin + larguraAssinatura * i;
        doc.line(cx, yAssinatura, cx + larguraLinha, yAssinatura);
        doc.text(label, cx + larguraLinha / 2, yAssinatura + 12, { align: 'center' });
    });

    const hoje = new Date();
    const carimbo = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`;
    doc.save(`Saida_NFs_${carimbo}.pdf`);
    toast('✓ PDF gerado.');
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
    const daAba = notasDaAbaGerenciar(); // Fase 40: "todas" = as da aba aberta (nunca as de outra aba, que estão escondidas)
    if (daAba.length > 0 && daAba.every(n => notasSelecionadas.has(n.id))) {
        notasSelecionadas.clear();
    } else {
        notasSelecionadas = new Set(daAba.map(n => n.id));
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
    const daAbaBulk = notasDaAbaGerenciar();
    if (selectAllBtn) selectAllBtn.textContent = (daAbaBulk.length > 0 && daAbaBulk.every(n => notasSelecionadas.has(n.id))) ? 'Nenhuma' : 'Todas';
    document.querySelectorAll('#bulk-action-bar-notas .bulk-buttons button').forEach(b => b.disabled = count === 0);
}

// Fase 40: arquivar em massa as notas selecionadas (mesma lógica de arquivarNotaIndividual/limpar, em lotes).
function bulkArquivarNotas() {
    const ids = Array.from(notasSelecionadas).filter(id => notasPendentes.some(n => n.id === id));
    if (ids.length === 0) return;
    const comEspera = ids.filter(id => (notasPendentes.find(n => n.id === id) || {}).emEspera).length;
    showConfirmModal({
        title: 'Arquivar notas selecionadas?',
        message: `Arquivar ${ids.length} nota(s)? Elas saem da relação ativa e vão para o Histórico.${comEspera ? ` Atenção: ${comEspera} delas está(ão) em espera (Pendente).` : ''}`,
        confirmText: 'Arquivar',
        confirmClass: 'success',
        onConfirm: async () => {
            try {
                for (let i = 0; i < ids.length; i += 150) {
                    const batch = firestore.batch();
                    ids.slice(i, i + 150).forEach(id => {
                        const nota = notasPendentes.find(n => n.id === id);
                        if (!nota) return;
                        const { id: _id, ...notaData } = nota;
                        notaData.dataHistorico = (new Date).toLocaleString('pt-BR');
                        registrarOrigemNaNotaArquivada(notaData, id);
                        batch.set(historicoCollection.doc(), notaData);
                        batch.delete(notasCollection.doc(id));
                        const entradaVinculada = listaEntradasErp.find(e => e.notaVinculadaId === id);
                        if (entradaVinculada) batch.update(entradasErpCollection.doc(entradaVinculada.id), { statusFluxo: 'arquivada' });
                    });
                    await batch.commit();
                }
                notasSelecionadas.clear();
                if (selectionModeNotas) toggleSelectionModeNotas();
                toast(`✓ ${ids.length} nota(s) arquivada(s).`);
            } catch (e) {
                console.error('Erro ao arquivar notas em lote:', e);
                toast('✕ Erro ao arquivar as notas selecionadas.');
            }
        }
    });
}

// Fase 40: o "Recurso: ..." do cartão vem do que foi confirmado na Entrada de NF (aptidao.recursos); a Saída de Texto e o campo
// de edição usam nota.obs. Quando a nota não tem obs e a NF tem UM recurso só, ele pode ser aplicado (nunca adivinha se houver mais de um).
function recursoSugeridoDaNota(nota) {
    if (!nota || (nota.obs && String(nota.obs).trim())) return '';
    try { const ap = calcularAptidaoSaidaNota(nota); return (ap.recursos && ap.recursos.length === 1) ? ap.recursos[0] : ''; } catch (e) { return ''; }
}
async function aplicarRecursoSugeridoNota(id) {
    const nota = notasPendentes.find(n => n.id === id); if (!nota) return;
    const rec = recursoSugeridoDaNota(nota); if (!rec) return toast('Sem recurso único conhecido para esta nota — escolha em Editar.');
    try {
        nota.obs = rec;
        await notasCollection.doc(id).update({ obs: rec });
        DOM.saida.value = buildSaidaText(notasPendentes.filter(n => !n.emEspera)); atualizarContadorExportacao();
        rebuildNotasPendentesList();
        toast(`✓ Recurso aplicado: ${rec}`);
    } catch (e) { console.error('Erro ao aplicar recurso:', e); toast('✕ Erro ao aplicar o recurso.'); }
}
async function aplicarRecursosSugeridosTodos() {
    const alvos = notasPendentes.map(n => ({ n, rec: recursoSugeridoDaNota(n) })).filter(x => x.rec);
    if (!alvos.length) return toast('Nenhuma nota sem recurso com recurso conhecido.');
    try {
        for (let i = 0; i < alvos.length; i += 400) {
            const batch = firestore.batch();
            alvos.slice(i, i + 400).forEach(({ n, rec }) => { n.obs = rec; batch.update(notasCollection.doc(n.id), { obs: rec }); });
            await batch.commit();
        }
        DOM.saida.value = buildSaidaText(notasPendentes.filter(n => !n.emEspera)); atualizarContadorExportacao();
        rebuildNotasPendentesList();
        toast(`✓ Recurso aplicado em ${alvos.length} nota(s).`);
    } catch (e) { console.error('Erro ao aplicar recursos:', e); toast('✕ Erro ao aplicar os recursos.'); }
}
function atualizarAvisoRecursosGerenciar() {
    const el = document.getElementById('gerenciar-aplicar-recursos'); if (!el) return;
    const n = notasPendentes.filter(x => recursoSugeridoDaNota(x)).length;
    el.style.display = n ? 'flex' : 'none';
    const t = document.getElementById('gerenciar-aplicar-recursos-txt'); if (t) t.textContent = `${n} nota(s) sem recurso, mas o recurso já é conhecido pela Entrada de NF`;
}

function notasDaAbaGerenciar() { return notasPendentes.filter(n => abaGerenciar === 'espera' ? !!n.emEspera : !n.emEspera); }

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
        if (activeId && activeId === destinoViaMais) { destinoViaMais = null; const r = destinoRetorno; destinoRetorno = { para: 'screen-mais', titulo: 'Mais' }; switchToScreen(r.para, r.titulo); return; }
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
        const tituloVoltar = voltarPara === 'screen-mais' ? 'Mais' : ((menuDetails[voltarPara] && menuDetails[voltarPara].title) || 'Ajustes');
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


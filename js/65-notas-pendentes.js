// 65-notas-pendentes.js — Notas pendentes (2.73.0)
// NFs paradas comigo por falta de carta de correção, nota fiscal de devolução ou cotação. Enquanto houver pendência a NF não vai ao financeiro,
// o aviso de "esperando decisão" para, e ela passa a aparecer num grupo próprio da Central de notificações e no cartão "Notas pendentes" da Início.
// Dado novo (mínimo): campo pendenciaEntrega { motivos: [...], desde: 'AAAA-MM-DD' } no documento da própria NF (nfsProcessadas, ou entradasErp se só veio do ERP).
// Só leitura da visão única (js/36); nada de contagem paralela.
const MOTIVOS_PEND_ENTREGA = [['carta_correcao', 'Carta de correção'], ['nf_devolucao', 'Nota fiscal de devolução'], ['cotacao', 'Cotação']];
function pendEntregaDe(nf, erp) {
    const ok = x => x && x.pendenciaEntrega && Array.isArray(x.pendenciaEntrega.motivos) && x.pendenciaEntrega.motivos.length ? x.pendenciaEntrega : null;
    return ok(nf) || ok(erp) || null;
}
function rotuloMotivosPend(pe) { return (pe && pe.motivos || []).map(m => (MOTIVOS_PEND_ENTREGA.find(x => x[0] === m) || [m, m])[1]).join(', '); }
// leandromendonssa
function avisoVencParada(dias) {
    if (dias == null) return 'sem vencimento informado';
    if (dias < 0) return `vencida há ${-dias} dia${dias === -1 ? '' : 's'}`;
    return dias === 0 ? 'vence hoje' : `vence em ${dias} dia${dias === 1 ? '' : 's'}`;
}
// NFs paradas comigo (ainda não enviadas ao financeiro), as de vencimento mais próximo primeiro
function notasParadasComigo() {
    return visoesNf().map(v => ({ v, pe: pendEntregaDe(v.nf, v.erp) })).filter(x => x.pe && !['arquivada', 'direta'].includes(x.v.situacao))
        .map(x => ({ ...x, dias: x.v.venc ? calcularDiasParaVencimento(x.v.venc) : null }))
        .sort((a, b) => (a.dias == null ? 9999 : a.dias) - (b.dias == null ? 9999 : b.dias));
}
// linha informativa no cartão do Controle de NFs
function htmlPendenciaEntregaCard(it) {
    const pe = pendEntregaDe(it.nf, it.erp); if (!pe || ['arquivada', 'direta'].includes(it.situacao)) return '';
    const dias = it.venc ? calcularDiasParaVencimento(it.venc) : null;
    return `<div class="ctl-inf pend-ent${dias != null && dias <= 0 ? ' urgente' : ''}"><b>Pendente para o financeiro:</b> ${escRel(rotuloMotivosPend(pe))} · ${escRel(avisoVencParada(dias))}</div>`;
}
function abrirPendenciaEntrega(id) {
    const v = typeof visaoNfPorId === 'function' ? visaoNfPorId(id) : null;
    const nf = listaNfsProcessadas.find(n => n.id === id), erp = !nf ? listaEntradasErp.find(e => e.id === id) : null;
    if (!nf && !erp) return toast('NF não encontrada.');
    const pe = pendEntregaDe(v ? v.nf : nf, v ? v.erp : erp); const marcados = new Set(pe ? pe.motivos : []);
    let m = document.getElementById('pend-entrega-modal');
    if (!m) { m = document.createElement('div'); m.id = 'pend-entrega-modal'; m.className = 'modal-screen'; document.body.appendChild(m); }
    const num = nf ? nf.nf : erp.nf;
    m.innerHTML = `<div class="modal-content"><h2>Pendente para o financeiro</h2>
        <p>NF ${escRel(num)}. Marque o que está faltando. Enquanto houver pendência, a NF não vai ao financeiro e o aviso de "esperando decisão" para.</p>
        ${MOTIVOS_PEND_ENTREGA.map(([k, r]) => `<label class="pend-opt"><input type="checkbox" value="${k}" ${marcados.has(k) ? 'checked' : ''}><span>${r}</span></label>`).join('')}
        <div class="confirm-actions pend-acoes"><button type="button" class="actions-button" onclick="closeAllModals()">Cancelar</button>
        ${pe ? `<button type="button" class="actions-button is-danger" onclick="salvarPendenciaEntrega('${escRel(id)}', true)">Remover</button>` : ''}
        <button type="button" class="actions-button is-primary" onclick="salvarPendenciaEntrega('${escRel(id)}', false)">Salvar</button></div></div>`;
    m.classList.add('active');
}
async function salvarPendenciaEntrega(id, remover) {
    const v = visaoNfPorId(id);
    const nf = (v && v.nf) || listaNfsProcessadas.find(n => n.id === id) || null, erp = (v && v.erp) || (!nf ? listaEntradasErp.find(e => e.id === id) : null) || null;
    if (!nf && !erp) return;
    const motivos = remover ? [] : [...document.querySelectorAll('#pend-entrega-modal input[type=checkbox]:checked')].map(x => x.value);
    const atual = pendEntregaDe(nf, erp), hoje = dataLocalISO();
    const valor = motivos.length ? { motivos, desde: (atual && atual.desde) || hoje, atualizadoEm: new Date().toISOString() } : firebase.firestore.FieldValue.delete();
    try {
        const alvoPrincipal = nf ? nfsProcessadasCollection.doc(nf.id) : entradasErpCollection.doc(erp.id);
        await alvoPrincipal.update({ pendenciaEntrega: valor });
        // se o outro documento da mesma NF (ERP ou XML) tinha a marca, limpa para não ficar duas verdades
        if (nf && erp && erp.pendenciaEntrega) await entradasErpCollection.doc(erp.id).update({ pendenciaEntrega: firebase.firestore.FieldValue.delete() });
        // 2.75.0: NF com pendência para o financeiro sai do Repasse de NF (a nota fica retida e só aparece no Controle de NF).
        // Ao resolver a pendência a nota NÃO volta sozinha: fica disponível no Controle com o botão "Enviar à relação".
        const notaId = (nf && nf.notaVinculadaId) || (erp && erp.notaVinculadaId) || null;
        const nota = notaId ? notasPendentes.find(n => n.id === notaId) : null;
        if (nota && motivos.length && !nota.pendFin) { try { await notasCollection.doc(nota.id).update({ pendFin: true }); } catch (e) { console.warn('pendFin', e); } }
        closeAllModals();
        toastRico({ titulo: motivos.length ? 'Pendência registrada' : 'Pendência removida', detalhe: `NF ${(nf || erp).nf}${motivos.length ? ' · ' + motivos.map(k => (MOTIVOS_PEND_ENTREGA.find(x => x[0] === k) || [k, k])[1]).join(', ') + (nota ? ' · saiu do Repasse de NF' : '') : (nota && nota.pendFin ? ' · já pode voltar para a relação (botão no Controle de NF)' : '')}` });
        ['renderControleNfs', 'renderEditorNf', 'renderInicio'].forEach(f => { try { if (typeof window[f] === 'function') window[f](); } catch (e) { } });
    } catch (e) { console.error('Erro ao salvar pendência de entrega:', e); toast('✕ Erro ao salvar. Tente novamente.'); }
}
// Resumo na Início (mesma ideia de "fornecedores a chegar"): lista as NFs paradas; tocar leva à NF no Controle de NFs
function abrirNotasPendentesResumo() {
    let m = document.getElementById('notas-pend-modal');
    if (!m) { m = document.createElement('div'); m.id = 'notas-pend-modal'; m.className = 'modal-screen'; document.body.appendChild(m); }
    const np = notasParadasComigo();
    const lin = x => { const n = (x.v.nf || x.v.erp).nf, urg = x.dias != null && x.dias <= 0;
        const nomeF = nomeExibicaoFornecedor(x.v.fornecedor, x.v.cnpj || '') || x.v.fornecedor || '';
        return `<button type="button" class="ini-ativ" onclick="irParaNotaPendente('${escRel(String(n))}')"><span class="ini-ai">${avatarFornConteudo(nomeF)}</span><span class="ini-at2"><b>${escRel(nomeF)} ${escRel(String(n))}</b><small>${escRel(rotuloMotivosPend(x.pe))}</small></span><span class="ini-ar"><span class="ini-chip ${urg ? 'r' : 'y'}">${escRel(avisoVencParada(x.dias))}</span></span></button>`; };
    m.innerHTML = `<div class="modal-content"><h2>${np.length ? np.length + ' nota(s) pendente(s)' : 'Notas pendentes'}</h2>
        <p style="font-size:12px;color:var(--text-light);margin:0 0 4px">NFs paradas comigo por carta de correção, nota de devolução ou cotação, da mais urgente para a menos. Toque para abrir a NF no Controle de NFs.</p>
        <div style="max-height:60vh;overflow:auto">${np.length ? np.map(lin).join('') : '<div class="ini-vazio">Nenhuma NF parada. Para marcar, abra a NF no Controle de NFs.</div>'}</div>
        <div class="confirm-actions"><button type="button" class="actions-button" onclick="closeAllModals()">Fechar</button>${np.length ? `<button type="button" class="actions-button is-primary" onclick="abrirRelatorioNotasPendentes()"><span class="icon-wrapper"><i class="fa-solid fa-file-lines"></i></span> Relatório</button>` : ''}</div></div>`;
    m.classList.add('active');
}
// 2.73.13: relatório das NFs paradas comigo, nos mesmos moldes do Resumo de pendências (texto editável; copiar, PDF, Word e TXT)
function textoRelatorioNotasPendentes() {
    const np = notasParadasComigo(), L = [dataExtensoResumo(), 'RESUMO DE NOTAS PENDENTES DE ENTREGA AO FINANCEIRO', ''];
    if (!np.length) L.push('Nenhuma NF parada no momento.', '');
    MOTIVOS_PEND_ENTREGA.forEach(([k, rot]) => {
        const grupo = np.filter(x => x.pe.motivos.includes(k)); if (!grupo.length) return;
        L.push('GRUPO ' + rot.toUpperCase() + ' (' + grupo.length + ')', '');
        grupo.forEach(x => {
            const v = x.v, n = (v.nf || v.erp).nf, nomeF = String(nomeExibicaoFornecedor(v.fornecedor, v.cnpj || '') || v.fornecedor || '').toUpperCase();
            const outros = x.pe.motivos.filter(m => m !== k).map(m => (MOTIVOS_PEND_ENTREGA.find(y => y[0] === m) || [m, m])[1]);
            // data do primeiro vencimento da NF; sem vencimento, a data de emissão
            let quando = ''; if (v.venc) quando = 'vencimento ' + v.venc; else if (v.dataISO) quando = 'emissão ' + dataBRdeISO(v.dataISO);
            L.push(`${nomeF} - N.F. ${n}`, [quando, outros.length ? 'também falta: ' + outros.join(', ') : ''].filter(Boolean).join(' · ') + '.', '');
        });
    });
    return L.join('\n').replace(/\n{4,}/g, '\n\n\n').trimEnd() + '\n';
}
function abrirRelatorioNotasPendentes() {
    closeAllModals();
    let m = document.getElementById('rel-notas-pend-modal');
    if (!m) { m = document.createElement('div'); m.id = 'rel-notas-pend-modal'; m.className = 'modal-screen'; document.body.appendChild(m); }
    m.innerHTML = `<div class="modal-content"><h2>Relatório de notas pendentes</h2>
        <p style="font-size:12px;color:var(--text-light);margin:0 0 8px">NFs paradas comigo, agrupadas pelo que falta. Você pode editar o texto antes de copiar ou gerar o arquivo.</p>
        <textarea id="rel-notas-pend-texto" class="form-field" style="width:100%;min-height:42vh;font-size:13px;line-height:1.4" spellcheck="false"></textarea>
        <div class="confirm-actions pend-acoes">
            <button type="button" class="actions-button is-primary" onclick="copiarRelatorioNotasPendentes()"><span class="icon-wrapper"><i class="fa-solid fa-copy"></i></span> Copiar</button>
            <button type="button" class="actions-button is-neutral" onclick="baixarRelatorioNotasPendentes('pdf')"><span class="icon-wrapper"><i class="fa-solid fa-file-pdf"></i></span> PDF</button>
            <button type="button" class="actions-button is-neutral" onclick="baixarRelatorioNotasPendentes('doc')"><span class="icon-wrapper"><i class="fa-solid fa-file-word"></i></span> Word</button>
            <button type="button" class="actions-button is-neutral" onclick="baixarRelatorioNotasPendentes('txt')"><span class="icon-wrapper"><i class="fa-solid fa-file-lines"></i></span> TXT</button>
            <button type="button" class="actions-button" style="grid-column:1/-1" onclick="closeAllModals()">Fechar</button></div></div>`;
    document.getElementById('rel-notas-pend-texto').value = textoRelatorioNotasPendentes();
    m.classList.add('active');
}
async function copiarRelatorioNotasPendentes() {
    const a = document.getElementById('rel-notas-pend-texto'); if (!a || !a.value.trim()) return toast('Nada para copiar.');
    try { await navigator.clipboard.writeText(a.value); toast('✓ Relatório copiado.'); } catch (e) { a.focus(); a.select(); toast('Selecione e copie o texto.'); }
}
async function baixarRelatorioNotasPendentes(formato) {
    const a = document.getElementById('rel-notas-pend-texto'), texto = a ? a.value : ''; if (!texto.trim()) return toast('Nada para exportar.');
    const base = 'Notas-pendentes-' + dataLocalISO();
    try {
        let ok = false;
        if (formato === 'doc') ok = await entregarArquivoRelCot(base + '.doc', new Blob(['\ufeff', htmlResumoPendencias(texto)], { type: 'application/msword' }));
        else if (formato === 'pdf') {
            if (typeof jspdf === 'undefined') return toast('✕ A biblioteca de PDF ainda não carregou — aguarde um instante e tente de novo.');
            ok = await entregarArquivoRelCot(base + '.pdf', gerarPdfResumoPendencias(texto).output('blob'));
        } else ok = await entregarArquivoRelCot(base + '.txt', new Blob([texto], { type: 'text/plain;charset=utf-8' }));
        if (ok) toast('✓ Arquivo gerado.');
    } catch (err) { console.error('Relatório de notas pendentes:', err); toast('✕ Erro ao gerar o arquivo.'); }
}
window.abrirRelatorioNotasPendentes = abrirRelatorioNotasPendentes; window.copiarRelatorioNotasPendentes = copiarRelatorioNotasPendentes; window.baixarRelatorioNotasPendentes = baixarRelatorioNotasPendentes;
function irParaNotaPendente(numero) { closeAllModals(); abrirNfNoHistorico('', numero); }
// Editor de NF: a pendência faz parte do cartão da NF (etiqueta junto das demais + botão junto dos botões), sem bloco solto no topo
function chipPendenciaEntrega(id) {
    const v = visaoNfPorId(id); if (!v || ['arquivada', 'direta'].includes(v.situacao)) return '';
    const pe = pendEntregaDe(v.nf, v.erp); if (!pe) return '';
    const dias = v.venc ? calcularDiasParaVencimento(v.venc) : null;
    return ` <span class="xml-item-badge ${dias != null && dias <= 0 ? 'pendente' : 'neutro'}">Pendente: ${escRel(rotuloMotivosPend(pe))} · ${escRel(avisoVencParada(dias))}</span>`;
}
function botaoPendenciaEntrega(id) {
    const v = visaoNfPorId(id); if (!v || ['arquivada', 'direta'].includes(v.situacao)) return '';
    return ` <button type="button" class="central-status-toggle" onclick="abrirPendenciaEntrega('${escRel(id)}')">${pendEntregaDe(v.nf, v.erp) ? 'Editar pendência' : 'Pendente p/ financeiro'}</button>`;
}
window.chipPendenciaEntrega = chipPendenciaEntrega; window.botaoPendenciaEntrega = botaoPendenciaEntrega;
// Voltar: quem abre a Central, a Auditoria ou o Controle por atalho passa a empilhar o retorno (como o Editor da NF já fazia)
['irParaRetroFiltro', 'iniAbrirPrioridade', 'abrirNfNoHistorico', 'irParaPendenciaControle'].forEach(n => { try { envolverComRetorno(n); } catch (e) { } });
// 2.73.3: recolhimento da devolução com NF de devolução informada tira sozinho o motivo "Nota fiscal de devolução" da pendência
(function () {
    if (typeof confirmarRecolhimentoDevolucao !== 'function') return;
    const o = confirmarRecolhimentoDevolucao;
    confirmarRecolhimentoDevolucao = async function (nfId, idx) {
        const nfDev = ((document.getElementById('dev-nf') || {}).value || '').trim();
        const r = await o.apply(this, arguments);
        try {
            if (!nfDev) return r;
            const v = visaoNfPorId(nfId), pe = v && pendEntregaDe(v.nf, v.erp);
            if (!pe || !pe.motivos.includes('nf_devolucao')) return r;
            const resto = pe.motivos.filter(m => m !== 'nf_devolucao');
            const doc = v.nf ? nfsProcessadasCollection.doc(v.nf.id) : entradasErpCollection.doc(v.erp.id);
            await doc.update({ pendenciaEntrega: resto.length ? { ...pe, motivos: resto, atualizadoEm: new Date().toISOString() } : firebase.firestore.FieldValue.delete() });
            toastRico({ titulo: resto.length ? 'Pendência atualizada' : 'Pendência resolvida', detalhe: `NF ${(v.nf || v.erp).nf} · nota de devolução recebida${resto.length ? '. Falta: ' + rotuloMotivosPend({ motivos: resto }) : '. Já pode ir ao financeiro.'}` });
        } catch (e) { console.warn('pendência x devolução', e); }
        return r;
    };
})();
window.abrirNotasPendentesResumo = abrirNotasPendentesResumo; window.irParaNotaPendente = irParaNotaPendente;
// Devolve ao Repasse de NF a nota retida por pendência (ação do usuário, nunca automática)
async function liberarNotaParaRelacao(chave) {
    const it = itemControlePorChave(chave); if (!it || !it.nota) return;
    if (pendEntregaDe(it.nf, it.erp)) return toast('Ainda há pendência para o financeiro nesta NF.');
    try { await notasCollection.doc(it.nota.id).update({ pendFin: firebase.firestore.FieldValue.delete() }); toastRico({ titulo: `NF ${it.numeroNf} enviada para a relação`, acao: 'Ver', onAcao: () => switchToScreen('screen-manage', 'Repasse de NF') }); }
    catch (e) { console.error('liberarNotaParaRelacao', e); toast('✕ Erro ao enviar para a relação.'); }
}
window.liberarNotaParaRelacao = liberarNotaParaRelacao;
window.abrirPendenciaEntrega = abrirPendenciaEntrega; window.salvarPendenciaEntrega = salvarPendenciaEntrega;

// Pendência impede o envio ao financeiro (por qualquer caminho que arquiva o item do Controle)
(function () {
    if (typeof arquivarItemControle === 'function') {
        const o = arquivarItemControle;
        arquivarItemControle = function (it) { if (it && pendEntregaDe(it.nf, it.erp)) throw new Error('NF com pendência de entrega'); return o.apply(this, arguments); };
    }
    if (typeof enviarNfAoFinanceiro === 'function') {
        const o = enviarNfAoFinanceiro;
        enviarNfAoFinanceiro = function (chave) {
            const it = itemControlePorChave(chave), pe = it && pendEntregaDe(it.nf, it.erp);
            if (pe) { toastRico({ titulo: 'Ainda não dá para enviar', detalhe: `Pendente: ${rotuloMotivosPend(pe)}. Remova a pendência quando resolver.`, acao: 'Ver pendência', onAcao: () => abrirPendenciaEntrega((it.nf || it.erp).id) }); return; }
            return o.apply(this, arguments);
        };
    }
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/65-notas-pendentes.js'] = '2.75.0';

// 71-divergencias-cards.js — Central do Pedido: aba Divergências (cards por fornecedor), tela dedicada de edição, seleção em lote e aba Alterações (2.75.0)
// Parte do script do app. Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// Aba Divergências da Central do Pedido: todas as divergências das auditorias do pedido, agrupadas por fornecedor, cada uma num card enxuto
// (tipo, NF, status, linhas de material, item acompanhado, histórico). "Editar" abre uma TELA PRÓPRIA (screen-div-editar), igual ao registro da
// auditoria (mesmos tipos e campos de TIPOS_DIVERGENCIA_AUDITORIA, vínculo ao item da cotação e botões "Puxar"). Salvar nunca apaga nada:
// acrescenta {tipo:'edicao'} ao histórico da divergência com a VERSÃO ANTERIOR guardada (campo "antes"), mantém o codProduto (as notificações
// seguem a divergência) e refaz o texto de exportar a partir dos campos. Antes de gravar, compara com o que está ao vivo (mesmo padrão do js/68:
// sem leitura nova) e avisa se outro aparelho mudou a divergência. Seleção em lote usa a dock de seleção (js/38). A aba Alterações lê
// historicoSmartCompras/{pedido} (js/59).
// ===================================================================
let dvcEdit = null;            // { key, ocIdx, divIdx, anotId, ident, ctx, orig, d }  — orig = foto ao abrir a edição; d = rascunho em edição
let dvcSelAtivo = false;
const dvcSel = new Set();      // chaves "ocIdx-divIdx"
let dvcMatSeq = 0;
const dvcAlteracoesCache = {}; // pedido → { entradas, atualizadoEm } | null

const DVC_STATUS = { pendente: 'Pendência relatada', gerada: 'Gerada, não relatada', resolvida: 'Resolvida', encerrada: 'Encerrada' };

// leandromendonssa
function dvcNota() { return (listaAnotacoes || []).find(a => String(a.pedido) === String(centralPedidoAtual)) || null; }
function dvcClone(x) { return JSON.parse(JSON.stringify(x)); }
function dvcStatusDe(d) { const s = d.status || 'pendente'; return (s === 'pendente' && d.relatado === false) ? 'gerada' : s; }
function dvcItensCotacao() {
    const c = (listaCotacoes || []).find(x => String(x.pedido) === String(centralPedidoAtual));
    const vistos = new Set(), r = [];
    ((c && c.itens) || []).forEach(it => { if (it.codProduto && !vistos.has(it.codProduto)) { vistos.add(it.codProduto); r.push(it); } });
    return r;
}
function dvcItemPorCod(cod) { return dvcItensCotacao().find(i => i.codProduto === cod) || null; }
function dvcNomeItem(it) { try { return upAud(nomeConhecidoItemCotacao(it) || it.descricao || it.codProduto); } catch (e) { return upAud(it.descricao || it.codProduto || ''); } }
function dvcCampoProduto(def) { return (def.campos.find(c => c.key === 'produto' || c.key === 'produtoPedido') || {}).key || null; }

// Todas as divergências do pedido, achatadas, com os índices reais dentro de nota.ocorrencias[ocIdx].divergencias[divIdx]
function dvcLista() {
    const nota = dvcNota(); if (!nota) return [];
    const r = [];
    (nota.ocorrencias || []).forEach((oc, ocIdx) => (oc.divergencias || []).forEach((d, divIdx) => {
        if (!linhasDeMateriais(d).length) return;
        r.push({ key: `${ocIdx}-${divIdx}`, d, oc, ocIdx, divIdx, anotId: nota.id });
    }));
    return r;
}
function dvcNomeForn(oc) { return upAud(nomeExibicaoFornecedor(oc.fornecedor, oc.fornecedorCnpj) || oc.fornecedor || 'Fornecedor não identificado'); }

// ---------- texto de exportação (sempre regenerado dos campos) ----------
function dvcTextoUma(x) {
    const cab = [dvcNomeForn(x.oc), x.oc.notaFiscal ? 'NF ' + x.oc.notaFiscal : '', 'Pedido ' + centralPedidoAtual].filter(Boolean).join(' — ');
    return `*${cab}*\n` + linhasDeMateriais(x.d).map(l => '• ' + l).join('\n');
}
function dvcTextoVarias(itens) {
    const porForn = new Map();
    itens.forEach(x => { const k = dvcNomeForn(x.oc); if (!porForn.has(k)) porForn.set(k, []); porForn.get(k).push(x); });
    const blocos = [];
    porForn.forEach((lista, forn) => {
        const nfs = [...new Set(lista.flatMap(x => String(x.oc.notaFiscal || '').split(',').map(t => t.trim()).filter(Boolean)))];
        blocos.push(`*${forn}*${nfs.length ? ' — NF ' + nfs.join(', ') : ''}\n` + lista.flatMap(x => linhasDeMateriais(x.d).map(l => '• ' + l)).join('\n'));
    });
    return `*Pedido ${centralPedidoAtual} — divergências*\n\n` + blocos.join('\n\n———\n\n');
}
async function dvcCompartilhar(texto, titulo) {
    try {
        if (navigator.share) { await navigator.share({ title: titulo, text: texto }); return true; }
        await navigator.clipboard.writeText(texto); toast('✓ Texto copiado! Cole onde quiser.'); return true;
    } catch (e) { return false; }   // cancelou
}
function dvcPerguntarRelatar(itens) {
    const nao = itens.filter(x => dvcStatusDe(x.d) === 'gerada');
    if (!nao.length) return;
    showConfirmModal({
        title: 'Marcar como relatadas?',
        message: `${nao.length} divergência(s) ainda estavam como "gerada, não relatada". Marcar como relatadas? Se ainda não enviou a ninguém, deixe como está.`,
        confirmText: 'Marcar como relatadas', confirmClass: 'warning',
        onConfirm: () => dvcMarcarRelatadas(nao.map(x => x.key))
    });
}
async function dvcMarcarRelatadas(chaves) {
    const nota = dvcNota(); if (!nota) return;
    const ocorrencias = dvcClone(nota.ocorrencias || []);
    chaves.forEach(k => {
        const [o, i] = k.split('-').map(Number); const d = ((ocorrencias[o] || {}).divergencias || [])[i]; if (!d) return;
        d.status = 'pendente'; d.relatado = true; (d.historico = d.historico || []).push({ tipo: 'relato', data: dataLocalISO(), observacao: 'Exportada' });
    });
    try { await anotacoesTextoCollection.doc(nota.id).update({ ocorrencias, atualizadoEm: new Date().toISOString() }); toast(`✓ ${chaves.length} marcada(s) como relatada(s).`); }
    catch (e) { console.error(e); toast('✕ Erro ao atualizar.'); }
}
async function dvcExportar(key) {
    const x = dvcLista().find(i => i.key === key); if (!x) return;
    if (await dvcCompartilhar(dvcTextoUma(x), 'Divergência — pedido ' + centralPedidoAtual)) dvcPerguntarRelatar([x]);
}

// ---------- seleção em lote (dock) ----------
function dvcSelEntrar() {
    dvcSelAtivo = true; dvcSel.clear(); dvcSelAvisar(); dvcRender();
}
function dvcSelSair() { dvcSelAtivo = false; dvcSel.clear(); dvcSelAvisar(); dvcRender(); }
function dvcSelAvisar() {
    const tot = dvcLista().length;
    if (typeof dockSelecaoAtualizar === 'function') dockSelecaoAtualizar('divpedido', dvcSelAtivo, dvcSel.size, tot > 0 && dvcSel.size === tot);
}
function dvcSelToggle(key) { if (dvcSel.has(key)) dvcSel.delete(key); else dvcSel.add(key); dvcSelAvisar(); dvcRender(); }
function dvcSelTodas() {
    const l = dvcLista(); if (dvcSel.size === l.length) dvcSel.clear(); else l.forEach(x => dvcSel.add(x.key));
    dvcSelAvisar(); dvcRender();
}
async function dvcCompartilharSel() {
    const itens = dvcLista().filter(x => dvcSel.has(x.key)); if (!itens.length) return;
    if (await dvcCompartilhar(dvcTextoVarias(itens), 'Divergências do pedido ' + centralPedidoAtual)) { dvcSelSair(); dvcPerguntarRelatar(itens); }
}
if (typeof DOCK_SELECAO_TELAS !== 'undefined') {
    DOCK_SELECAO_TELAS.divpedido = {
        tela: 'screen-central-pedido', sair: 'dvcSelSair()', todas: 'dvcSelTodas()',
        acoes: [{ ic: 'fa-solid fa-share-nodes', t: 'Compartilhar selecionadas', f: 'dvcCompartilharSel()', rotulo: 'Compartilhar', primaria: true }]
    };
}

// ---------- edição estruturada (tela dedicada) ----------
// Rascunho editável de uma divergência (também usado para ler o que está AO VIVO na hora de salvar).
function dvcRascunho(d) {
    d = d || {}; const def = TIPOS_DIVERGENCIA_AUDITORIA[d.tipo];
    const r = { tipo: d.tipo || '', observacao: d.observacao || '', campos: dvcClone(d.campos || {}), materiais: [], status: dvcStatusDe(d), obsStatus: '' };
    if (!def || def.multiMaterial) r.materiais = materiaisDaDivergencia(d).map(m => ({ id: ++dvcMatSeq, campos: dvcClone(m), ref: m.codProduto || null }));
    r.materiais.forEach(m => { m.campos = Object.assign({}, m.campos); delete m.campos.codProduto; });
    return r;
}
function dvcIdent(x) { return [x.oc.fornecedor || '', x.oc.notaFiscal || ''].join('|'); }
function dvcAbrirEdicao(key) {
    const x = dvcLista().find(i => i.key === key); if (!x) return;
    const rasc = dvcRascunho(x.d);
    dvcEdit = { key, ocIdx: x.ocIdx, divIdx: x.divIdx, anotId: x.anotId, ident: dvcIdent(x), ctx: { forn: dvcNomeForn(x.oc), nf: x.oc.notaFiscal || '', data: x.oc.data || '' }, orig: dvcClone(rasc), d: rasc };
    if (dvcSelAtivo) { dvcSelAtivo = false; dvcSel.clear(); dvcSelAvisar(); }
    // "Voltar" leva de volta à aba Divergências, no ponto em que você estava (pilha de retorno do js/30)
    const ctx = typeof capturarContextoTela === 'function' ? capturarContextoTela() : null, pedido = String(centralPedidoAtual);
    if (ctx) ctx.restaurar = () => { abrirCentralPedido(pedido); alternarAbaCentral('divergencias'); };
    dvcRenderEditor(false);
    navRetornoAtiva++;
    try { switchToScreen('screen-div-editar', 'Editar divergência'); } finally { navRetornoAtiva--; }
    const tela = document.getElementById('screen-div-editar'); if (tela) tela.scrollTop = 0;
    if (ctx && telaAtivaId() === 'screen-div-editar') { pilhaRetorno.push({ ...ctx, alvoId: 'screen-div-editar' }); if (pilhaRetorno.length > 25) pilhaRetorno.shift(); mostrarBotaoVoltarRetorno(); }
}
function dvcFecharEdicao() {
    dvcEdit = null;
    if (typeof voltarPelaPilha === 'function' && voltarPelaPilha()) return;
    switchToScreen('screen-central-pedido', String(centralPedidoAtual)); alternarAbaCentral('divergencias');
}
function dvcCancelarEdicao() {
    if (dvcEdit && dvcDiff().length) return showConfirmModal({ title: 'Descartar as alterações?', message: 'O que você mudou nesta divergência ainda não foi salvo.', confirmText: 'Descartar', confirmClass: 'danger', onConfirm: dvcFecharEdicao });
    dvcFecharEdicao();
}
// O botão Voltar do topo também pergunta antes de descartar alterações não salvas.
document.addEventListener('click', ev => {
    const b = ev.target && ev.target.closest && ev.target.closest('#close-btn'); if (!b) return;
    if (typeof telaAtivaId !== 'function' || telaAtivaId() !== 'screen-div-editar' || !dvcEdit || !dvcDiff().length) return;
    ev.stopImmediatePropagation(); ev.preventDefault(); dvcCancelarEdicao();
}, true);
function dvcMudarTipo(tipo) {
    const e = dvcEdit; if (!e) return;
    const def = TIPOS_DIVERGENCIA_AUDITORIA[tipo];
    e.d.tipo = tipo; e.d.campos = {}; e.d.materiais = (def && def.multiMaterial) ? [{ id: ++dvcMatSeq, campos: {}, ref: null }] : [];
    dvcRenderEditor(true);
}
function dvcCampo(mid, key, valor, maiusculo) {
    const e = dvcEdit; if (!e) return;
    const v = maiusculo ? upAud(valor) : valor;
    if (mid === null) e.d.campos[key] = v;
    else { const m = e.d.materiais.find(x => x.id === mid); if (!m) return; m.campos[key] = v; if ((key === 'produto' || key === 'produtoPedido') && !String(v).trim()) m.ref = null; }
    dvcAtualizarDiff();
}
function dvcObs(v) { if (dvcEdit) { dvcEdit.d.observacao = v; dvcAtualizarDiff(); } }
function dvcStatusMudou(v) {
    if (!dvcEdit) return; dvcEdit.d.status = v; dvcAtualizarDiff();
    document.querySelectorAll('#div-editar-conteudo .dvc-st-grid button').forEach(b => b.classList.toggle('on', b.dataset.st === v));
}
function dvcObsStatus(v) { if (dvcEdit) { dvcEdit.d.obsStatus = v; } }
function dvcAddMaterial() { if (dvcEdit) { dvcEdit.d.materiais.push({ id: ++dvcMatSeq, campos: {}, ref: null }); dvcRenderEditor(true); } }
function dvcDelMaterial(mid) { if (dvcEdit) { dvcEdit.d.materiais = dvcEdit.d.materiais.filter(m => m.id !== mid); dvcRenderEditor(true); } }
function dvcVincular(mid, cod) {
    const e = dvcEdit; if (!e) return; const m = e.d.materiais.find(x => x.id === mid); if (!m) return;
    m.ref = cod || null;
    const it = cod ? dvcItemPorCod(cod) : null, def = TIPOS_DIVERGENCIA_AUDITORIA[e.d.tipo], ch = def && dvcCampoProduto(def);
    if (it && ch && !m.campos[ch]) m.campos[ch] = dvcNomeItem(it);
    if (it && !m.campos.quantidade && it.quantidade && (def.campos.some(c => c.key === 'quantidade'))) m.campos.quantidade = String(it.quantidade);
    dvcRenderEditor(true);
}
function dvcUsarNome(mid) {
    const e = dvcEdit; if (!e) return; const m = e.d.materiais.find(x => x.id === mid); if (!m || !m.ref) return;
    const it = dvcItemPorCod(m.ref), def = TIPOS_DIVERGENCIA_AUDITORIA[e.d.tipo], ch = def && dvcCampoProduto(def);
    if (it && ch) m.campos[ch] = dvcNomeItem(it); dvcRenderEditor(true);
}

// "Puxar": traz o número das fontes do app para o campo (cotação, NF/XML, ERP) — só pelo item ligado
const DVC_PUXAR = {
    quantidade: [['cotação', 'cot_qtd'], ['NF', 'nf_qtd'], ['ERP', 'erp_qtd']],
    quantidadeCotada: [['cotação', 'cot_qtd']],
    quantidadeFaturada: [['NF', 'nf_qtd'], ['ERP', 'erp_qtd']],
    valorCotado: [['cotação', 'cot_preco']],
    valorFaturado: [['NF', 'nf_preco']],
    lote: [['NF', 'nf_lote']], loteInformado: [['NF', 'nf_lote']],
    validade: [['NF', 'nf_validade']], validadeInformada: [['NF', 'nf_validade']]
};
function dvcFonte(cod, fonte) {
    const num = v => (v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v))) ? '' : String(v).replace('.', ',');
    const cot = dvcItemPorCod(cod);
    if (fonte === 'cot_qtd') return cot ? num(cot.quantidade) : '';
    if (fonte === 'cot_preco') return cot ? num(cot.precoUnitario) : '';
    if (fonte === 'nf_qtd' || fonte === 'erp_qtd') {
        let c = null; try { c = compararFontesPedido(String(centralPedidoAtual)).find(i => i.codProduto === cod); } catch (er) { /* sem comparação */ }
        return c ? num(fonte === 'nf_qtd' ? c.quantidadeFaturada : c.quantidadeLancada) : '';
    }
    const nfs = (listaNfsProcessadas || []).filter(nf => nf.pedido === String(centralPedidoAtual) || (nf.pedidos && nf.pedidos.includes(String(centralPedidoAtual))));
    const its = nfs.flatMap(nf => (nf.itens || []).filter(it => it.codigoSmartCompras === cod && it.tratamento !== 'trocado'));
    if (!its.length) return '';
    const it = its[its.length - 1], r = (it.rastros || [])[0];
    if (fonte === 'nf_preco') return num(it.valorUnitario);
    if (fonte === 'nf_lote') return (r && r.nLote) || (it.rastroDecidido && it.rastroDecidido.lote) || '';
    if (fonte === 'nf_validade') { const v = (r && r.dVal) || (it.rastroDecidido && it.rastroDecidido.validadeISO) || ''; return /^\d{4}-\d{2}-\d{2}/.test(v) ? formatarDataBRSimples(v.slice(0, 10)) : v; }
    return '';
}
function dvcPuxar(mid, key, fonte) {
    const e = dvcEdit; if (!e) return; const m = e.d.materiais.find(x => x.id === mid); if (!m || !m.ref) return;
    const v = dvcFonte(m.ref, fonte);
    if (!v) return toast('Esse dado não está disponível para este item.');
    m.campos[key] = v; dvcRenderEditor(true);
}

// ---------- diferenças ("Vai ficar no histórico") ----------
function dvcDiff() { return dvcEdit ? dvcDiffEntre(dvcEdit.orig, dvcEdit.d) : []; }
function dvcDiffEntre(o, n) {
    const out = [], vz = v => (v === undefined || v === null || String(v).trim() === '') ? '—' : String(v);
    const rot = TIPOS_DIVERGENCIA_AUDITORIA;
    if (o.tipo !== n.tipo) out.push(`Tipo: de ${(rot[o.tipo] || {}).label || vz(o.tipo)} para ${(rot[n.tipo] || {}).label || vz(n.tipo)}`);
    const def = rot[n.tipo];
    const lbl = k => ((def && def.campos.find(c => c.key === k)) || {}).label || k;
    const cmp = (a, b, pre) => { new Set([...Object.keys(a || {}), ...Object.keys(b || {})]).forEach(k => { if (String((a || {})[k] || '').trim() !== String((b || {})[k] || '').trim()) out.push(`${pre}${lbl(k)}: de ${vz((a || {})[k])} para ${vz((b || {})[k])}`); }); };
    if (def && !def.multiMaterial) cmp(o.campos, n.campos, '');
    else {
        const max = Math.max(o.materiais.length, n.materiais.length);
        for (let i = 0; i < max; i++) {
            const a = o.materiais[i], b = n.materiais[i], pre = max > 1 ? `Material ${i + 1} · ` : '';
            if (!a) out.push(`Material ${i + 1} incluído: ${vz((b.campos.produto || b.campos.produtoPedido || ''))}`);
            else if (!b) out.push(`Material ${i + 1} removido: ${vz(a.campos.produto || a.campos.produtoPedido)}`);
            else { cmp(a.campos, b.campos, pre); if ((a.ref || '') !== (b.ref || '')) out.push(`${pre}Item da cotação: de ${vz(a.ref)} para ${vz(b.ref)}`); }
        }
    }
    if (String(o.observacao || '').trim() !== String(n.observacao || '').trim()) out.push(`Observação: de ${vz(o.observacao)} para ${vz(n.observacao)}`);
    if (o.status !== n.status) out.push(`Status: de ${DVC_STATUS[o.status]} para ${DVC_STATUS[n.status]}`);
    return out;
}
function dvcAtualizarDiff() {
    const el = document.getElementById('dvc-diff'); if (!el) return;
    const l = dvcDiff();
    el.innerHTML = l.length ? `<div class="dvc-diff-t">Vai ficar no histórico</div>` + l.map(t => `<div class="dvc-diff-l">${escRel(t)}</div>`).join('') : `<div class="dvc-diff-vazio">Nenhuma mudança ainda.</div>`;
}
// Divergência que está AO VIVO agora (os ouvintes do Firestore a mantêm atualizada: não faz leitura nova)
function dvcAoVivo() {
    const e = dvcEdit; if (!e) return null;
    const nota = (listaAnotacoes || []).find(a => a.id === e.anotId); if (!nota) return null;
    const oc = (nota.ocorrencias || [])[e.ocIdx], d = oc && (oc.divergencias || [])[e.divIdx];
    if (!d || dvcIdent({ oc }) !== e.ident) return null;   // a posição mudou ou ela foi apagada em outro aparelho
    return { nota, oc, d };
}
async function dvcSalvar() {
    const e = dvcEdit; if (!e) return;
    const diff = dvcDiff(); if (!diff.length) return toast('Nada foi alterado.');
    const n = e.d, def = TIPOS_DIVERGENCIA_AUDITORIA[n.tipo];
    if (!n.tipo || !def) return toast('Escolha o tipo da divergência.');
    if (def.multiMaterial && !n.materiais.length) return toast('Mantenha ao menos um material.');
    const vivo = dvcAoVivo();
    if (!vivo) return toast('Esta divergência não existe mais ou mudou de lugar: foi alterada em outro aparelho. Volte e abra de novo.');
    // aviso de conflito (padrão do js/68): se outro aparelho mudou esta divergência enquanto a edição estava aberta, mostra o que mudou e pergunta
    const difs = dvcDiffEntre(e.orig, dvcRascunho(vivo.d));
    if (difs.length && typeof conflitoPerguntar === 'function') return conflitoPerguntar('Esta divergência mudou em outro aparelho', difs, dvcGravar);
    return dvcGravar();
}
async function dvcGravar() {
    const e = dvcEdit; if (!e) return;
    const n = e.d, def = TIPOS_DIVERGENCIA_AUDITORIA[n.tipo], diff = dvcDiff();
    const vivo = dvcAoVivo(); if (!vivo) return toast('Esta divergência não existe mais: foi alterada em outro aparelho.');
    const ocorrencias = dvcClone(vivo.nota.ocorrencias || []);
    const d = ocorrencias[e.ocIdx].divergencias[e.divIdx];
    // versão anterior guardada na própria linha de histórico (opção "Ver versão anterior"): nada se perde
    const antes = { tipo: d.tipo }; ['campos', 'materiais', 'observacao'].forEach(k => { if (d[k] !== undefined) antes[k] = dvcClone(d[k]); });
    const statusAntes = dvcStatusDe(d);
    d.tipo = n.tipo;
    if (def.multiMaterial) {
        d.materiais = n.materiais.map(m => ({ ...m.campos, ...(m.ref ? { codProduto: m.ref } : {}) }));   // mesmo formato gravado pela auditoria (codProduto mantém o vínculo)
        d.observacao = n.observacao || ''; delete d.campos;
    } else { d.campos = { ...n.campos }; delete d.materiais; delete d.observacao; }
    d.historico = d.historico || [];
    if (statusAntes !== n.status) {
        if (n.status === 'gerada') { d.status = 'pendente'; d.relatado = false; } else { d.status = n.status; if (n.status === 'pendente') d.relatado = true; }
        const t = n.status === 'resolvida' ? 'resolucao' : n.status === 'encerrada' ? 'encerramento' : n.status === 'gerada' ? 'geracao' : (statusAntes === 'pendente' ? 'relato' : 'reabertura');
        d.historico.push({ tipo: t, data: dataLocalISO(), observacao: n.obsStatus || '' });
    }
    // HISTÓRICO NUNCA É APAGADO — a edição entra como mais uma linha, com o que mudou e a versão anterior.
    d.historico.push({ tipo: 'edicao', data: dataLocalISO(), observacao: diff.filter(t => !t.startsWith('Status:')).join('; ') || 'Editada', antes });
    try {
        await anotacoesTextoCollection.doc(e.anotId).update({ ocorrencias, atualizadoEm: new Date().toISOString() });
        toast('✓ Divergência atualizada.');
        dvcFecharEdicao();
        if (typeof refrescarTelasOcorrencias === 'function') refrescarTelasOcorrencias(); else dvcRender();
    } catch (er) { console.error('Erro ao salvar edição da divergência:', er); toast('✕ Erro ao salvar. Tente novamente.'); }
}

// ---------- desenho ----------
// leandromendonssa
function dvcHtmlCampo(c, valor, mid, m, def) {
    const ehProd = c.key === 'produto' || c.key === 'produtoPedido';
    const attr = `oninput="dvcCampo(${mid === null ? 'null' : mid}, '${c.key}', this.value, ${!!c.maiusculo})"`;
    const label = c.obrigatorio ? c.label + ' *' : c.label;
    let corpo;
    if (c.textarea) corpo = `<textarea class="form-field" ${attr}>${escRel(valor)}</textarea>`;
    else corpo = `<input type="text" class="form-field ${c.maiusculo ? 'uppercase-field' : ''}" placeholder="${escRel(c.placeholder || '')}" value="${escRel(valor).replace(/"/g, '&quot;')}" ${attr}>`;
    let extra = '';
    if (ehProd && m) {
        const it = m.ref ? dvcItemPorCod(m.ref) : null;
        if (it) { const real = dvcNomeItem(it), igual = upAud(m.campos[c.key] || '') === real; extra = `<div class="aud-vinculo ok">🔗 Ligado ao item <b>${escRel(it.codProduto)}</b>: ${escRel(real)}${igual ? '' : ` · <a onclick="dvcUsarNome(${m.id})">usar este nome</a>`} · <a onclick="dvcVincular(${m.id}, '')">desligar</a></div>`; }
        else {
            const itens = dvcItensCotacao();
            if (itens.length) extra = `<div class="aud-vinculo"><select class="form-field" onchange="dvcVincular(${m.id}, this.value)"><option value="">Ligar a um item da cotação…</option>${itens.map(i => `<option value="${escRel(i.codProduto)}">${escRel(i.codProduto)} — ${escRel(dvcNomeItem(i))}</option>`).join('')}</select></div>`;
        }
    }
    if (m && m.ref && DVC_PUXAR[c.key]) {
        const bots = DVC_PUXAR[c.key].filter(([, f]) => dvcFonte(m.ref, f)).map(([rot, f]) => `<button type="button" class="dvc-puxar" onclick="dvcPuxar(${m.id}, '${c.key}', '${f}')"><i class="fa-solid fa-arrow-down-long"></i> Puxar ${rot}</button>`).join('');
        if (bots) extra += `<div class="dvc-puxar-row">${bots}</div>`;
    }
    return `<div class="campo"><label>${escRel(label)}</label>${corpo}${extra}</div>`;
}
function dvcHtmlEditor() {
    const e = dvcEdit, n = e.d, def = TIPOS_DIVERGENCIA_AUDITORIA[n.tipo], cx = e.ctx || {};
    const opcoes = Object.entries(TIPOS_DIVERGENCIA_AUDITORIA).map(([k, v]) => `<option value="${k}" ${n.tipo === k ? 'selected' : ''}>${escRel(v.label)}</option>`).join('');
    let corpo = '';
    if (def && def.multiMaterial) {
        corpo = n.materiais.map((m, i) => `<div class="material-divergencia">
            <div class="material-divergencia-header"><span>Material ${i + 1}</span>${n.materiais.length > 1 ? `<button type="button" class="divergencia-del" onclick="dvcDelMaterial(${m.id})" aria-label="Remover material"><i class="fa-solid fa-trash"></i></button>` : ''}</div>
            ${def.campos.map(c => dvcHtmlCampo(c, m.campos[c.key] || '', m.id, m, def)).join('')}</div>`).join('')
            + `<div class="actions-row"><button type="button" class="actions-button is-neutral" onclick="dvcAddMaterial()"><span class="icon-wrapper"><i class="fa-solid fa-plus"></i></span> Adicionar material</button></div>`
            + `<div class="campo"><label>Observação da ocorrência (opcional)</label><textarea class="form-field" oninput="dvcObs(this.value)">${escRel(n.observacao || '')}</textarea></div>`;
    } else if (def) corpo = def.campos.map(c => dvcHtmlCampo(c, n.campos[c.key] || '', null, null, def)).join('');
    const nomes = (def && def.multiMaterial ? n.materiais.map(m => m.campos[dvcCampoProduto(def)] || '').filter(Boolean) : []).join(' · ');
    const stBts = Object.entries(DVC_STATUS).map(([k, v]) => `<button type="button" data-st="${k}" class="${n.status === k ? 'on' : ''}" onclick="dvcStatusMudou('${k}')">${v}</button>`).join('');
    return `<div class="card dvc-ctx">
            <span class="dvc-ctx-tag">${[cx.nf ? 'NF ' + escRel(cx.nf) : '', cx.data ? escRel(formatarDataBRSimples(cx.data)) : ''].filter(Boolean).join(' · ') || 'Divergência'}</span>
            <span class="dvc-ctx-t">${escRel(def ? def.label : (n.tipo || 'Divergência'))}</span>
            <span class="dvc-ctx-m">${escRel(cx.forn || '')}${nomes ? ' — ' + escRel(nomes) : ''}</span></div>
        <div class="card dvc-ed">
        <div class="campo"><label>Tipo de divergência</label><select class="form-field" onchange="dvcMudarTipo(this.value)"><option value="">Selecione...</option>${opcoes}</select></div>
        ${corpo}
        <div class="campo"><label>Status</label><div class="dvc-st-grid">${stBts}</div></div>
        <div class="campo"><label>Observação do status (opcional)</label><input type="text" class="form-field" oninput="dvcObsStatus(this.value)" value="${escRel(n.obsStatus || '').replace(/"/g, '&quot;')}"></div></div>
        <div class="card"><div class="dvc-diff" id="dvc-diff" style="margin:0;"></div>
        <p class="xml-item-meta" style="margin:10px 0 0;">Ao salvar, a divergência continua ligada a este produto, a este pedido e a esta NF. As notificações passam a usar os valores novos. A versão anterior fica guardada no histórico e nada é apagado.</p></div>
        <div class="actions-row dvc-acoes">
            <button type="button" class="actions-button is-success" onclick="dvcSalvar()"><span class="icon-wrapper"><i class="fa-solid fa-check"></i></span> Salvar alterações</button>
            <button type="button" class="actions-button is-neutral" onclick="dvcCancelarEdicao()">Cancelar</button>
        </div>`;
}
function dvcRenderEditor(manter) {
    const el = document.getElementById('div-editar-conteudo'); if (!el || !dvcEdit) return;
    const tela = document.getElementById('screen-div-editar'), y = manter && tela ? tela.scrollTop : 0;
    el.innerHTML = dvcHtmlEditor();
    dvcAtualizarDiff();
    if (manter && tela) tela.scrollTop = y;   // a tela não "pula" ao ligar um item, puxar um valor ou trocar o tipo
}
function dvcHtmlCard(x) {
    const d = x.d, def = TIPOS_DIVERGENCIA_AUDITORIA[d.tipo], st = dvcStatusDe(d);
    const sel = dvcSelAtivo && dvcSel.has(x.key);
    const cods = [...new Set(materiaisDaDivergencia(d).map(m => m.codProduto).filter(Boolean))];
    const acomp = cods.map(c => { const it = dvcItemPorCod(c); return `${escRel(c)}${it ? ' — ' + escRel(dvcNomeItem(it)) : ''}`; });
    const hist = d.historico || [];
    const dataOc = x.oc.data ? formatarDataBRSimples(x.oc.data) : '';
    const click = dvcSelAtivo ? ` onclick="dvcSelToggle('${x.key}')"` : '';
    return `<div class="ctl-card dvc-card${dvcSelAtivo ? ' selecionavel' : ''}${sel ? ' sel' : ''}" id="dvc-${x.key}"${click}>
        <div class="dvc-topo">${dvcSelAtivo ? `<span class="dvc-chk${sel ? ' on' : ''}"><i class="fa-solid fa-check"></i></span>` : ''}<span class="cdv-tipo">${escRel(def ? def.label : (d.tipo || 'Ocorrência'))}</span><span class="central-status-badge status-${st === 'gerada' ? 'encerrada' : st}">${escRel(DVC_STATUS[st])}</span></div>
        <div class="dvc-meta">${[x.oc.notaFiscal ? 'NF ' + escRel(x.oc.notaFiscal) : '', dataOc ? escRel(dataOc) : ''].filter(Boolean).join(' · ')}</div>
        <div class="cdv-texto">${linhasDeMateriais(d).map(l => `<div class="cdv-linha">${escRel(l)}</div>`).join('')}</div>
        ${acomp.length ? `<div class="dvc-acomp"><i class="fa-solid fa-link"></i> Acompanhando: ${acomp.join(' · ')}</div>` : ''}
        ${hist.length ? `<button type="button" class="dvc-hist-bt" onclick="event.stopPropagation(); dvcAbrirHistorico('${x.key}')">Histórico (${hist.length}) <i class="fa-solid fa-chevron-right"></i></button>` : ''}
        ${dvcSelAtivo ? '' : `<div class="actions-row dvc-acoes"><button type="button" class="actions-button is-neutral" onclick="dvcExportar('${x.key}')"><span class="icon-wrapper"><i class="fa-solid fa-share-nodes"></i></span> Exportar</button><button type="button" class="actions-button" onclick="dvcAbrirEdicao('${x.key}')"><span class="icon-wrapper"><i class="fa-solid fa-pen"></i></span> Editar</button></div>`}
    </div>`;
}
// Histórico numa folha por baixo (não empurra a lista); linhas de edição têm "Ver versão anterior"
function dvcAbrirHistorico(key) {
    const x = dvcLista().find(i => i.key === key); if (!x) return;
    const ROT = { identificacao: 'Relatada na auditoria', resolucao: 'Resolvida', encerramento: 'Encerrada', reabertura: 'Reaberta', relato: 'Relatada', geracao: 'Gerada', edicao: 'Editada' };
    const linhas = (x.d.historico || []).slice().reverse().map(h => {
        const antes = h.antes ? (linhasDeMateriais(h.antes).map(l => `<div>${escRel(l)}</div>`).join('') + (h.antes.observacao ? `<div>Observação: ${escRel(h.antes.observacao)}</div>` : '')) : '';
        return `<li class="${h.tipo === 'edicao' ? 'ed' : ''}">${escRel(ROT[h.tipo] || h.tipo)}${h.observacao ? ' — ' + escRel(h.observacao) : ''}<small>${escRel(formatarDataBRSimples(h.data))}</small>${h.antes ? `<button type="button" class="dvc-ver" onclick="dvcVerAnterior(this)">Ver versão anterior</button><div class="dvc-snap" style="display:none;">${antes || 'Sem texto guardado.'}</div>` : ''}</li>`;
    }).join('');
    if (!document.getElementById('dvc-folha')) {
        const v = document.createElement('div'); v.id = 'dvc-folha-veu'; v.className = 'folha-veu'; v.onclick = dvcFecharHistorico;
        const f = document.createElement('div'); f.id = 'dvc-folha'; f.className = 'folha-acoes dvc-folha'; f.setAttribute('role', 'dialog');
        document.body.appendChild(v); document.body.appendChild(f);
    }
    document.getElementById('dvc-folha').innerHTML = `<div class="fa-alca"></div><div class="fa-tit">Histórico da divergência</div><ul class="dvc-hi">${linhas}</ul><div class="actions-row"><button type="button" class="actions-button is-neutral" onclick="dvcFecharHistorico()">Fechar</button></div>`;
    document.getElementById('dvc-folha-veu').classList.add('on'); document.getElementById('dvc-folha').classList.add('on');
}
function dvcFecharHistorico() { ['dvc-folha', 'dvc-folha-veu'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('on'); }); }
function dvcVerAnterior(bt) {
    const box = bt.nextElementSibling, abre = box.style.display === 'none';
    box.style.display = abre ? '' : 'none'; bt.textContent = abre ? 'Ocultar versão anterior' : 'Ver versão anterior';
}
function dvcRender() {
    const el = document.getElementById('central-div-cards'); if (!el) return;
    const lista = dvcLista();
    const barra = document.getElementById('central-div-barra'), vazio = document.getElementById('central-div-vazio'), cont = document.getElementById('central-aba-div-n');
    if (barra) barra.style.display = lista.length ? '' : 'none';
    if (vazio) vazio.style.display = lista.length ? 'none' : '';
    if (cont) { cont.textContent = lista.length; cont.style.display = lista.length ? '' : 'none'; }
    if (!lista.length) { el.innerHTML = ''; return; }
    const porForn = new Map();
    lista.forEach(x => { const k = dvcNomeForn(x.oc); if (!porForn.has(k)) porForn.set(k, []); porForn.get(k).push(x); });
    el.innerHTML = [...porForn.entries()].map(([forn, itens]) => `<div class="dvc-forn"><div class="dvc-forn-nome">${escRel(forn)} <span>${itens.length}</span></div>${itens.map(dvcHtmlCard).join('')}</div>`).join('');
    const bt = document.getElementById('central-div-selecionar'); if (bt) bt.classList.toggle('active', dvcSelAtivo);
}

// ---------- aba Alterações (histórico do SmartCompras) ----------
async function dvcCarregarAlteracoes(forcar) {
    const el = document.getElementById('central-alteracoes-conteudo'); if (!el || !centralPedidoAtual) return;
    const pedido = String(centralPedidoAtual);
    if (!forcar && dvcAlteracoesCache[pedido] !== undefined) return dvcRenderAlteracoes(pedido);
    el.innerHTML = `<div class="card"><div class="xml-item-meta">Carregando…</div></div>`;
    try {
        const doc = await firestore.collection('historicoSmartCompras').doc(pedido).get();
        dvcAlteracoesCache[pedido] = doc.exists ? { entradas: (doc.data().entradas || []), atualizadoEm: doc.data().atualizadoEm || '' } : null;
    } catch (e) { console.error(e); el.innerHTML = `<div class="card"><div class="xml-item-meta">Não consegui carregar agora. Confira a conexão e toque em Atualizar.</div><div class="actions-row mt-3"><button type="button" class="actions-button is-neutral" onclick="dvcCarregarAlteracoes(true)">Atualizar</button></div></div>`; return; }
    if (String(centralPedidoAtual) === pedido) dvcRenderAlteracoes(pedido);
}
function dvcRenderAlteracoes(pedido) {
    const el = document.getElementById('central-alteracoes-conteudo'); if (!el) return;
    const r = dvcAlteracoesCache[pedido];
    const quando = r && r.atualizadoEm ? `Importado em ${new Date(r.atualizadoEm).toLocaleString('pt-BR')}` : '';
    el.innerHTML = r && r.entradas.length
        ? `<div class="card dvc-alt">${smartHistRenderLista(pedido, r.entradas, '')}${quando ? `<p class="dvc-alt-q">${escRel(quando)}</p>` : ''}</div><div class="actions-row"><button type="button" class="actions-button is-neutral" onclick="dvcCarregarAlteracoes(true)"><span class="icon-wrapper"><i class="fa-solid fa-rotate"></i></span> Atualizar</button></div>`
        : `<div class="card"><div class="xml-item-meta">Nenhuma alteração do SmartCompras guardada para este pedido. Importe o histórico pelo marcador do SmartCompras e ele aparece aqui.</div><div class="actions-row mt-3"><button type="button" class="actions-button is-neutral" onclick="dvcCarregarAlteracoes(true)">Atualizar</button></div></div>`;
}

// ---------- ligações com a Central ----------
(function ligar() {
    const antesAba = window.alternarAbaCentral;
    window.alternarAbaCentral = function (aba) {
        antesAba.apply(this, arguments);
        if (aba !== 'divergencias' && dvcSelAtivo) dvcSelSair();
        if (aba === 'alteracoes') dvcCarregarAlteracoes(false);
    };
    const antesRender = window.renderCentralPedidoCompleto;
    window.renderCentralPedidoCompleto = function (pedido) {
        const r = antesRender.apply(this, arguments);
        try { dvcRender(); } catch (e) { console.error('Erro ao desenhar divergências:', e); }
        return r;
    };
    const antesAbrir = window.abrirCentralPedido;
    window.abrirCentralPedido = function (pedido) {
        dvcEdit = null; dvcSelAtivo = false; dvcSel.clear(); dvcFecharHistorico(); dvcSelAvisar();
        return antesAbrir.apply(this, arguments);
    };
})();
// a tela de edição é uma "sub-tela" da Central do Pedido (botão Voltar no topo e transição de entrada/saída)
if (typeof closeBtnBackScreen !== 'undefined') { closeBtnBackScreen['screen-div-editar'] = 'screen-central-pedido'; screenParentMap['screen-div-editar'] = screenParentMap['screen-central-pedido'] || 'screen-cotacoes'; }
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/71-divergencias-cards.js'] = '2.75.0';

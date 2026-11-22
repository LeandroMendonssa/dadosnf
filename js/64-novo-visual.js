// ===================================================================
// 2.70.0 — NOVO VISUAL (redesign): tudo aqui pode ser desligado em Personalização > Aparência > "Novo visual".
// Desligado = o app volta a ficar exatamente como era na 2.69.0 (nada daqui roda e o CSS "body.nv" deixa de valer).
// Reaproveita as funções existentes (nada de contagem ou fonte de dados paralela).
// ===================================================================
// O "Novo visual" agora é um TEMA (Personalização > Aparência > Tema: "Operacional (claro/escuro)").
// Só vale quando body[data-theme] começa com "operacional"; qualquer outro tema = visual padrão do app.
function novoVisualOn() { const t = document.body && document.body.getAttribute('data-theme'); return !!t && t.indexOf('operacional') === 0; }
function nvAplicar() {
    const on = novoVisualOn(); document.body.classList.toggle('nv', on);
    ['renderInicio', 'renderControleNfs', 'renderCentralAuditoria'].forEach(f => { try { if (typeof window[f] === 'function') window[f](); } catch (e) { } });
    nvStepper();
}
window.novoVisualOn = novoVisualOn;
try { new MutationObserver(() => { if (document.body.classList.contains('nv') !== novoVisualOn()) nvAplicar(); }).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { }

// ---------- Módulo 3: fornecedores no pedido (mesma regra da Início: calcularEntregaFornecedorPedido + statusEntregaRelCot) ----------
let _nvFornCache = { t: 0, m: new Map() };
function contagemFornecedoresPedido(cot) {
    if (!cot) return null;
    const agora = Date.now(); if (agora - _nvFornCache.t > 2500) _nvFornCache = { t: agora, m: new Map() };
    const k = String(cot.pedido); if (_nvFornCache.m.has(k)) return _nvFornCache.m.get(k);
    let r = null;
    try {
        const feitos = [];
        comMemoComparacao(() => {
            const comp = compararFontesPedido(cot.pedido), vistos = new Set();
            (cot.fornecedores || []).forEach(f => {
                const ch = normalizarCnpj(f.cnpj); if (!ch || vistos.has(ch)) return; vistos.add(ch);
                if (!(cot.itens || []).some(it => normalizarCnpj(it.cnpjFornecedor) === ch)) return;
                const e = calcularEntregaFornecedorPedido(cot.pedido, f, comp.filter(x => normalizarCnpj(x.cnpjFornecedor) === ch));
                const st = statusEntregaRelCot(e);
                if (st.chave === 'cancelada') return;
                feitos.push(st.chave === 'concluida');
            });
        });
        if (feitos.length) r = { total: feitos.length, entregaram: feitos.filter(Boolean).length, pendentes: feitos.filter(x => !x).length, lista: feitos };
    } catch (e) { r = null; }
    _nvFornCache.m.set(k, r); return r;
}
function nvLinhaFornecedores(cot) {
    const c = contagemFornecedoresPedido(cot); if (!c) return '';
    return `<div class="nv-forn"><div class="nv-forn-l"><span><b>${c.total}</b> fornecedor${c.total === 1 ? '' : 'es'}</span><span><b class="ok">${c.entregaram}</b> entregaram · <b class="${c.pendentes ? 'pd' : ''}">${c.pendentes}</b> pendente${c.pendentes === 1 ? '' : 's'}</span></div><div class="nv-segs">${c.lista.map(x => `<i class="${x ? 'ok' : ''}"></i>`).join('')}</div></div>`;
}
(function () {
    function injeta(html, extra) { const i = html.lastIndexOf('</div>'); return i < 0 ? html : html.slice(0, i) + extra + html.slice(i); }
    if (typeof renderCardCotacao === 'function') { const o = renderCardCotacao; renderCardCotacao = function (c) { const h = o(c); try { return novoVisualOn() ? injeta(h, nvLinhaFornecedores(c)) : h; } catch (e) { return h; } }; }
    if (typeof renderCardControleNf === 'function') {
        const o = renderCardControleNf;
        renderCardControleNf = function (it) {
            const h = o(it); if (!novoVisualOn()) return h;
            try { const cot = it.pedido ? (listaCotacoes || []).find(c => String(c.pedido) === String(it.pedido)) : null; const l = cot ? nvLinhaFornecedores(cot) : ''; if (!l) return h; const i = h.indexOf('<div class="ctl-bar'); return i > 0 ? h.slice(0, i) + l + h.slice(i) : injeta(h, l); } catch (e) { return h; }
        };
    }
})();

// ---------- Módulo 4: contadores da Central de Auditoria ----------
(function () {
    if (typeof renderCentralAuditoria !== 'function') return;
    const o = renderCentralAuditoria;
    renderCentralAuditoria = function () {
        o.apply(this, arguments);
        try {
            const el = document.getElementById('auditoria-central-conteudo'); if (!el || !novoVisualOn()) return;
            const todas = listarOcorrenciasAuditoria(), n = g => todas.filter(x => x.grupo === g).length;
            const t = [['detectada', 'Detectadas', 'r', 'Precisam de análise'], ['relatada', 'Relatadas', 'b', 'Aguardando retorno'], ['resolvida', 'Resolvidas', 'g', 'Histórico preservado'], ['excluida', 'Excluídas', 'm', 'Não contabilizadas']];
            const html = `<div class="nv-pagehead"><div><div class="nv-eyebrow">CONTROLE E RASTREABILIDADE</div><h1>Central de auditoria</h1><p class="nv-sub">Acompanhe cada ocorrência desde a identificação até a resolução.</p></div></div>
                <div class="nv-kpis">${t.map(([k, r, c, cap]) => `<button type="button" class="nv-kpi ${c}${audFiltro === k ? ' on' : ''}" onclick="audFiltrar('${k}')"><span class="nv-kt">${r}<i class="nv-dot ${c}"></i></span><b>${n(k)}</b><small>${cap}</small></button>`).join('')}</div>`;
            el.querySelectorAll('.nv-kpis,.nv-pagehead').forEach(x => x.remove());
            el.insertAdjacentHTML('afterbegin', html);
        } catch (e) { }
    };
})();

// ---------- Módulo 5: Entrada de NF — etapas + confirmação de salvamento ----------
let nvEtapa = 1;
function nvStepper() {
    const tela = document.getElementById('screen-xml-editor'); if (!tela) return;
    let el = document.getElementById('nv-stepper');
    if (!novoVisualOn()) { if (el) el.remove(); const c = document.getElementById('nv-salva'); if (c) c.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'nv-stepper'; el.className = 'nv-stepper'; tela.insertBefore(el, tela.firstChild); }
    const manual = tela.classList.contains('modo-manual');
    const rot = [manual ? 'Origem manual' : 'Identificação', manual ? 'Preencher dados' : 'Conferência dos itens', 'Revisão e salvar'];
    el.innerHTML = `<div class="nv-pagehead"><div><div class="nv-eyebrow">PROCESSAMENTO</div><h1>Entrada de NF</h1><p class="nv-sub">${manual ? 'Cadastro manual: preencha os dados da nota e salve.' : 'Conferência contínua: identifique a nota, revise os itens e finalize.'}</p></div></div><div class="nv-steps">${rot.map((r, i) => `<div class="nv-step${nvEtapa === i + 1 ? ' current' : ''}${nvEtapa > i + 1 ? ' done' : ''}">0${i + 1} · ${r}</div>`).join('')}</div>`;
}
function nvEtapaAuto() { const tela = document.getElementById('screen-xml-editor'); const manual = tela && tela.classList.contains('modo-manual'); nvEtapa = manual ? 2 : (typeof xmlDocAtual !== 'undefined' && xmlDocAtual && !(xmlDocAtual.querySelector && xmlDocAtual.querySelector('parsererror')) ? 2 : 1); nvStepper(); }
(function () {
    const envolve = (nome, depois) => { if (typeof window[nome] !== 'function') return; const o = window[nome]; window[nome] = function () { const r = o.apply(this, arguments); try { depois(); } catch (e) { } return r; }; };
    envolve('definirModoEntrada', () => { const c = document.getElementById('nv-salva'); if (c) c.remove(); nvEtapaAuto(); });
    envolve('processarXmlTexto', () => { const c = document.getElementById('nv-salva'); if (c) c.remove(); nvEtapaAuto(); });
})();
function nvEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function nvNfSalva(d) {
    if (!novoVisualOn()) return;
    const tela = document.getElementById('screen-xml-editor'); if (!tela) return;
    nvEtapa = 4; nvStepper();
    let c = document.getElementById('nv-salva'); if (c) c.remove();
    c = document.createElement('div'); c.id = 'nv-salva'; c.className = 'nv-salva';
    const id = String(d.id || '').replace(/'/g, "\\'"), nf = String(d.nf || '').replace(/'/g, "\\'");
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const b = (t, fn, pri) => `<button type="button" class="actions-button ${pri ? 'is-primary' : 'is-neutral'}" onclick="${fn}">${t}</button>`;
    c.innerHTML = `<div class="nv-salva-h"><span class="nv-salva-ic">✓</span><div><b>NF ${nvEsc(d.nf)} salva</b><small>${nvEsc([d.fornecedor, d.valor ? 'R$ ' + String(d.valor).replace(/^R\$\s*/, '') : '', 'registrada hoje às ' + hora].filter(Boolean).join(' · '))}</small></div><button type="button" class="nv-x" aria-label="Fechar" onclick="this.closest('.nv-salva').remove()">×</button></div>
        <div class="nv-salva-b">${b('Abrir NF', `abrirNfNoHistorico('${id}','${nf}')`, true)}${d.manual ? b('Ver na relação', "switchToScreen('screen-manage','Repasse de NF')") : b('Baixar PDF', `baixarDanfePdfDaNf('${id}')`) + b('Baixar XML', `baixarXmlDaNf('${id}')`) + b('Editar', `abrirEditorNf('${id}')`)}${b('Nova entrada', d.manual ? "nvNovaEntrada(true)" : "nvNovaEntrada(false)")}</div>`;
    const ref = document.getElementById('nv-stepper'); tela.insertBefore(c, ref ? ref.nextSibling : tela.firstChild);
    try { tela.scrollTop = 0; window.scrollTo(0, 0); const sc = document.querySelector('.app-screen.active'); if (sc) sc.scrollTop = 0; } catch (e) { }
}
function nvNovaEntrada(manual) {
    const c = document.getElementById('nv-salva'); if (c) c.remove();
    nvEtapa = manual ? 2 : 1; nvStepper();
    if (manual) { const e = document.getElementById('nf'); if (e) e.focus(); } else { const f = document.getElementById('xml-file-input'); if (f) f.click(); }
}
window.nvNfSalva = nvNfSalva; window.nvNovaEntrada = nvNovaEntrada;
document.addEventListener('DOMContentLoaded', () => { document.body.classList.toggle('nv', novoVisualOn()); nvStepper(); });
document.body.classList.toggle('nv', novoVisualOn());
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/64-novo-visual.js'] = '2.72.0';

// 55-hub-relatorios.js — Relatórios como central de modalidades que emitem de verdade (2.46.0)
// Cada modalidade: período (chips) + "o que incluir" + prévia em papel + Copiar/Baixar (TXT, Word, PDF com margens ABNT) no fim da página.
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const e = s => (typeof escRel === 'function' ? escRel(s) : String(s == null ? '' : s));
    const CHAVE = 'relHubOpcoesV1';
    const MOD = {
        pendencias: { nome: 'Resumo de pendências', ic: 'fa-clipboard-list', desc: 'Pedidos com entregas pendentes, para enviar ao fornecedor.', abre: true },
        divergencias: { nome: 'Divergências por fornecedor', ic: 'fa-triangle-exclamation', desc: 'Divergências agrupadas por fornecedor, no período.', periodo: true, tog: [['pendente', 'Pendentes', true], ['resolvida', 'Resolvidas', false], ['encerrada', 'Encerradas', false]] },
        entregas: { nome: 'Entregas por pedido', ic: 'fa-truck-ramp-box', desc: 'Situação de entrega de cada fornecedor, pedido a pedido (situação atual).', periodo: false, tog: [['aguardando', 'Aguardando', true], ['parcial', 'Parciais', true], ['completa', 'Completas', false], ['cancelada', 'Canceladas', false]] },
        financeiro: { nome: 'NFs enviadas ao financeiro', ic: 'fa-file-invoice-dollar', desc: 'Notas arquivadas (enviadas) no período.', periodo: true, tog: [['venc', 'Vencimento', true], ['valor', 'Valor', true], ['pend', 'Incluir notas ainda não enviadas', false]] },
        auditorias: { nome: 'Auditorias do período', ic: 'fa-magnifying-glass-chart', desc: 'Auditorias registradas no período, com tipos de divergência.', periodo: true, tog: [['obs', 'Observações', false]] }
    };
    let estado = { aba: null, periodo: '30', de: '', ate: '', tog: {} };
    try { const s = JSON.parse(localStorage.getItem(CHAVE) || 'null'); if (s && s.tog) estado.tog = s.tog; if (s && s.periodo) estado.periodo = s.periodo; } catch (_) { }
    const guardar = () => { try { localStorage.setItem(CHAVE, JSON.stringify({ tog: estado.tog, periodo: estado.periodo })); } catch (_) { } };
    const togOn = (m, k, pad) => { const t = estado.tog[m]; return t && k in t ? !!t[k] : pad; };

    // ---------- período ----------
    function intervalo() {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        if (estado.periodo === '7') return { de: new Date(hoje - 6 * 864e5), ate: hoje, txt: 'últimos 7 dias' };
        if (estado.periodo === '30') return { de: new Date(hoje - 29 * 864e5), ate: hoje, txt: 'últimos 30 dias' };
        if (estado.periodo === 'mes') return { de: new Date(hoje.getFullYear(), hoje.getMonth(), 1), ate: hoje, txt: 'este mês' };
        const de = typeof dataRel === 'function' ? dataRel(estado.de) : null, ate = typeof dataRel === 'function' ? dataRel(estado.ate) : null;
        const f = d => d ? d.toLocaleDateString('pt-BR') : '…';
        return { de, ate, txt: f(de) + ' a ' + f(ate) };
    }
    function noPeriodo(str) {
        const { de, ate } = intervalo(); const d = typeof dataRel === 'function' ? dataRel(str) : null;
        if (!d) return false; if (de && d < de) return false; if (ate && d > ate) return false; return true;
    }
    const fd = str => { const d = typeof dataRel === 'function' ? dataRel(str) : null; return d ? d.toLocaleDateString('pt-BR') : 'sem data'; };
    const up = s => String(s || '').trim().toUpperCase();

    // ---------- modelos ----------
    function modeloDivergencias() {
        const lim = () => { if (typeof limparFiltrosRelatorio === 'function') { try { relatoriosFiltros = { de: '', ate: '', fornecedor: '', fornecedorExato: false, destino: '', recurso: '', tipo: '', produto: '' }; } catch (_) { } } };
        lim();
        const ok = { pendente: togOn('divergencias', 'pendente', true), resolvida: togOn('divergencias', 'resolvida', false), encerrada: togOn('divergencias', 'encerrada', false) };
        const lista = divergenciasRel().filter(d => noPeriodo(d.data) && ok[d.status === 'resolvida' ? 'resolvida' : d.status === 'encerrada' ? 'encerrada' : 'pendente']);
        const por = new Map();
        lista.forEach(d => { const k = up(d.fornecedor) || 'SEM FORNECEDOR'; if (!por.has(k)) por.set(k, []); por.get(k).push(d); });
        const secoes = [...por.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([k, ds]) => ({
            t: `${k} (${ds.length})`,
            linhas: ds.sort((a, b) => (dataRel(b.data) || 0) - (dataRel(a.data) || 0)).map(d => {
                const tipo = (typeof TIPOS_DIVERGENCIA_AUDITORIA !== 'undefined' && (TIPOS_DIVERGENCIA_AUDITORIA[d.tipo] || {}).label) || d.tipo;
                return `Pedido ${d.pedido || '—'}${d.notaFiscal ? ' · NF ' + d.notaFiscal : ''} · ${tipo}${(d.produtos || []).length ? ' · ' + d.produtos.join(', ') : ''} · ${d.status === 'resolvida' ? 'resolvida' : d.status === 'encerrada' ? 'encerrada' : 'pendente'} · ${fd(d.data)}`;
            })
        }));
        return { titulo: 'DIVERGÊNCIAS POR FORNECEDOR', periodo: intervalo().txt, secoes, vazio: 'Nenhuma divergência no período.', total: lista.length };
    }
    function modeloEntregas() {
        const ok = { aguardando: togOn('entregas', 'aguardando', true), parcial: togOn('entregas', 'parcial', true), completa: togOn('entregas', 'completa', false), cancelada: togOn('entregas', 'cancelada', false) };
        const rot = { aguardando: 'aguardando', parcial: 'parcial', parcial_relatada: 'parcial (falta relatada)', completa: 'entregue', cancelada: 'entrega cancelada', erp_sem_itens: 'NF no ERP sem itens' };
        const secoes = []; let total = 0;
        (listaCotacoes || []).forEach(c => {
            const linhas = [];
            try {
                const comp = compararFontesPedido(c.pedido);
                (c.fornecedores || []).forEach(f => {
                    const compF = comp.filter(x => normalizarCnpj(x.cnpjFornecedor) === normalizarCnpj(f.cnpj));
                    const en = calcularEntregaFornecedorPedido(c.pedido, f, compF); if (!en) return;
                    const grupo = en.estado === 'cancelada' ? 'cancelada' : en.estado === 'completa' ? 'completa' : (en.estado === 'parcial' || en.estado === 'parcial_relatada') ? 'parcial' : 'aguardando';
                    if (!ok[grupo]) return;
                    linhas.push(`${up(typeof nomeExibicaoFornecedor === 'function' ? nomeExibicaoFornecedor(f.razaoSocial, f.cnpj) : f.razaoSocial)} — ${rot[en.estado] || en.estado}`); total++;
                });
            } catch (_) { }
            if (linhas.length) secoes.push({ t: `PEDIDO ${c.pedido}`, linhas });
        });
        return { titulo: 'ENTREGAS POR PEDIDO', periodo: 'situação atual', secoes, vazio: 'Nada a listar com os filtros escolhidos.', total };
    }
    function modeloFinanceiro() {
        const incV = togOn('financeiro', 'venc', true), incVal = togOn('financeiro', 'valor', true), incP = togOn('financeiro', 'pend', false);
        const base = (historicoNotas || []).map(n => ({ ...n, _s: 'enviada' })).concat(incP ? (notasPendentes || []).map(n => ({ ...n, _s: 'não enviada' })) : []);
        const lista = base.filter(n => noPeriodo(n.data));
        const por = new Map();
        lista.forEach(n => { const k = up(n.fornecedor) || 'SEM FORNECEDOR'; if (!por.has(k)) por.set(k, []); por.get(k).push(n); });
        const secoes = [...por.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([k, ns]) => ({ t: `${k} (${ns.length})`, linhas: ns.map(n => `NF ${n.nf || '—'}${incV && n.vencimento ? ' · venc. ' + n.vencimento : ''}${incVal && n.valor ? ' · ' + n.valor : ''}${incP ? ' · ' + n._s : ''}`) }));
        return { titulo: 'NOTAS FISCAIS ENVIADAS AO FINANCEIRO', periodo: intervalo().txt, secoes, vazio: 'Nenhuma nota no período.', total: lista.length };
    }
    function modeloAuditorias() {
        try { relatoriosFiltros = { de: '', ate: '', fornecedor: '', fornecedorExato: false, destino: '', recurso: '', tipo: '', produto: '' }; } catch (_) { }
        const obs = togOn('auditorias', 'obs', false);
        const lista = auditoriasBaseRel().filter(x => noPeriodo(x.data)).sort((a, b) => (dataRel(b.data) || 0) - (dataRel(a.data) || 0));
        const secoes = lista.length ? [{
            t: `AUDITORIAS (${lista.length})`, linhas: lista.map(x => {
                const tipos = [...new Set((x.divergencias || []).map(d => (typeof TIPOS_DIVERGENCIA_AUDITORIA !== 'undefined' && (TIPOS_DIVERGENCIA_AUDITORIA[d.tipo] || {}).label) || d.tipo))];
                return `${fd(x.data)} · Pedido ${x.pedido || '—'}${x.fornecedor ? ' · ' + up(x.fornecedor) : ''}${x.notaFiscal ? ' · NF ' + x.notaFiscal : ''} · ${(x.divergencias || []).length} divergência(s)${tipos.length ? ': ' + tipos.join(', ') : ''}${obs && x.observacaoGeral ? ' — ' + x.observacaoGeral : ''}`;
            })
        }] : [];
        return { titulo: 'AUDITORIAS DO PERÍODO', periodo: intervalo().txt, secoes, vazio: 'Nenhuma auditoria no período.', total: lista.length };
    }
    const FAB = { divergencias: modeloDivergencias, entregas: modeloEntregas, financeiro: modeloFinanceiro, auditorias: modeloAuditorias };

    // ---------- saídas ----------
    function dataExtenso() { return typeof dataExtensoResumo === 'function' ? dataExtensoResumo() : new Date().toLocaleDateString('pt-BR'); }
    function texto(m) {
        const L = [dataExtenso(), m.titulo, 'Período: ' + m.periodo, ''];
        if (!m.secoes.length) L.push(m.vazio, '');
        m.secoes.forEach(s => { L.push(s.t); s.linhas.forEach(l => L.push('- ' + l)); L.push(''); });
        return L.join('\n').trimEnd() + '\n';
    }
    function html(m) {
        let h = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${e(m.titulo)}</title>
<style>@page WordSection1{size:21cm 29.7cm;margin:2cm 2cm 2cm 2cm}div.WordSection1{page:WordSection1}body{font-family:Arial,sans-serif;font-size:10.5pt;color:#111111}p{margin:0}</style></head><body><div class="WordSection1">
<p style="text-align:right;font-size:9.5pt;font-style:italic">${e(dataExtenso())}</p>
<p style="font-size:15pt;font-weight:bold;text-align:center;margin:14pt 0 4pt">${e(m.titulo)}</p><p style="text-align:center;font-size:9.5pt;margin-bottom:14pt">Período: ${e(m.periodo)}</p>`;
        if (!m.secoes.length) h += `<p>${e(m.vazio)}</p>`;
        m.secoes.forEach(s => { h += `<p style="font-weight:bold;margin:12pt 0 4pt">${e(s.t)}</p>`; s.linhas.forEach(l => { h += `<p style="margin:0 0 3pt 10pt">• ${e(l)}</p>`; }); });
        return h + '</div></body></html>';
    }
    function pdf(m) {
        const { jsPDF } = jspdf, doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), ML = 57, MR = 57, MT = 57, MB = 57, LARG = W - ML - MR;
        let y = MT;
        const fonte = (t, s) => { doc.setFont('helvetica', s || 'normal'); doc.setFontSize(t); doc.setTextColor(17, 17, 17); };
        const gar = h => { if (y + h > H - MB) { doc.addPage(); y = MT; } };
        fonte(9.5, 'italic'); doc.text(dataExtenso(), W - MR, y, { align: 'right' }); y += 26;
        fonte(15, 'bold'); doc.splitTextToSize(m.titulo, LARG).forEach(l => { doc.text(l, W / 2, y, { align: 'center' }); y += 19; });
        fonte(9.5); doc.text('Período: ' + m.periodo, W / 2, y + 2, { align: 'center' }); y += 26;
        if (!m.secoes.length) { fonte(10.5); doc.text(m.vazio, ML, y); }
        m.secoes.forEach(s => {
            const tl = doc.splitTextToSize(s.t, LARG); gar(tl.length * 14 + 30); y += 6; fonte(10.5, 'bold'); tl.forEach(l => { doc.text(l, ML, y); y += 14; }); y += 2;
            fonte(10.5); s.linhas.forEach(l => { const ls = doc.splitTextToSize('• ' + l, LARG - 10); gar(ls.length * 14.5 + 3); ls.forEach(x => { doc.text(x, ML + 10, y); y += 14.5; }); y += 3; });
        });
        return doc;
    }

    // ---------- telas ----------
    function renderHub() {
        const el = $('rel-hub'); if (!el) return;
        el.innerHTML = '<div class="rel-intro">Escolha o relatório que quer emitir. Todos geram texto, Word ou PDF com margens iguais de 2 cm.</div>' + Object.entries(MOD).map(([k, m]) =>
            `<button type="button" class="mais-item rel-hub-item" onclick="relAbrir('${k}')"><span class="icon-wrapper"><i class="fa-solid ${m.ic}"></i></span><span class="mais-item-nome">${e(m.nome)}<small class="rel-desc">${e(m.desc)}</small></span><i class="fa-solid fa-chevron-right mais-item-seta"></i></button>`).join('');
    }
    function renderDetalhe() {
        const el = $('rel-detalhe'), k = estado.aba; if (!el || !k) return;
        const md = MOD[k], m = FAB[k]();
        const chips = md.periodo ? `<div class="rel-sec">Período</div><div class="rel-chips">${[['7', '7 dias'], ['30', '30 dias'], ['mes', 'Este mês'], ['custom', 'Personalizado']].map(([v, t]) => `<button type="button" class="rel-chip${estado.periodo === v ? ' on' : ''}" onclick="relPeriodo('${v}')">${t}</button>`).join('')}</div>
            ${estado.periodo === 'custom' ? `<div class="rel-datas"><div class="campo"><label>De</label><input type="date" class="form-field" value="${e(estado.de)}" onchange="relDatas('de',this.value)"></div><div class="campo"><label>Até</label><input type="date" class="form-field" value="${e(estado.ate)}" onchange="relDatas('ate',this.value)"></div></div>` : ''}` : '<div class="rel-sec">Período</div><div class="rel-nota">Este relatório mostra a situação atual.</div>';
        const togs = (md.tog || []).length ? `<div class="rel-sec">O que incluir</div>${md.tog.map(([t, r, p]) => `<label class="rel-tog"><input type="checkbox" ${togOn(k, t, p) ? 'checked' : ''} onchange="relTog('${k}','${t}',this.checked)"><span>${e(r)}</span></label>`).join('')}` : '';
        const corpo = m.secoes.length ? m.secoes.map(s => `<div class="rel-p-sec">${e(s.t)}</div>${s.linhas.map(l => `<div class="rel-p-lin">• ${e(l)}</div>`).join('')}`).join('') : `<div class="rel-p-lin">${e(m.vazio)}</div>`;
        el.innerHTML = `<button type="button" class="rel-voltar" onclick="relVoltar()"><i class="fa-solid fa-chevron-left"></i> Relatórios</button>
            <h3 class="rel-titulo">${e(md.nome)}</h3>${chips}${togs}
            <div class="rel-sec">Prévia · ${m.total} registro(s)</div>
            <div class="rp-papel rel-papel"><div class="rel-p-data">${e(dataExtenso())}</div><div class="rel-p-tit">${e(m.titulo)}</div><div class="rel-p-per">Período: ${e(m.periodo)}</div>${corpo}</div>
            <div class="rp-rodape"><button type="button" class="actions-button is-neutral" onclick="relCopiar()"><i class="fa-solid fa-copy"></i> Copiar</button><button type="button" class="actions-button is-primary" onclick="relBaixar()"><i class="fa-solid fa-download"></i> Baixar</button></div>`;
    }
    function mostrar() {
        const h = $('rel-hub'), d = $('rel-detalhe'); if (!h || !d) return;
        h.style.display = estado.aba ? 'none' : ''; d.style.display = estado.aba ? '' : 'none';
        if (estado.aba) renderDetalhe(); else renderHub();
    }
    window.relAbrir = function (k) { if (MOD[k].abre) { if (typeof abrirResumoPendencias === 'function') abrirResumoPendencias(); return; } estado.aba = k; mostrar(); const t = $('screen-reports'); if (t) t.scrollTop = 0; };
    window.relVoltar = function () { estado.aba = null; mostrar(); };
    window.relPeriodo = function (v) { estado.periodo = v; guardar(); renderDetalhe(); };
    window.relDatas = function (c, v) { estado[c] = v; renderDetalhe(); };
    window.relTog = function (m, t, v) { (estado.tog[m] = estado.tog[m] || {})[t] = v; guardar(); renderDetalhe(); };
    window.relCopiar = async function () {
        if (!estado.aba) return; const t = texto(FAB[estado.aba]());
        try { await navigator.clipboard.writeText(t); toast('✓ Relatório copiado.'); } catch (_) { toast('Não consegui copiar automaticamente.'); }
    };
    window.relBaixar = function () {
        if (!estado.aba) return; const k = estado.aba;
        const baixar = async fmt => {
            const m = FAB[k](), base = 'Relatorio-' + k + '-' + new Date().toISOString().slice(0, 10);
            try {
                let ok = false;
                if (fmt === 'doc') ok = await entregarArquivoRelCot(base + '.doc', new Blob(['﻿', html(m)], { type: 'application/msword' }));
                else if (fmt === 'pdf') { if (typeof jspdf === 'undefined') return toast('✕ A biblioteca de PDF ainda não carregou — tente de novo em instantes.'); ok = await entregarArquivoRelCot(base + '.pdf', pdf(m).output('blob')); }
                else ok = await entregarArquivoRelCot(base + '.txt', new Blob([texto(m)], { type: 'text/plain;charset=utf-8' }));
                if (ok) toast('✓ Arquivo gerado.');
            } catch (err) { console.error('Relatório:', err); toast('✕ Erro ao gerar o arquivo.'); }
        };
        abrirFolhaAcoes('Baixar relatório (margens ABNT: 3 cm esquerda/topo, 2 cm direita/baixo)', [
            { t: 'PDF', ic: 'fa-solid fa-file-pdf', f: () => baixar('pdf') }, { t: 'Word', ic: 'fa-solid fa-file-word', f: () => baixar('doc') }, { t: 'Texto (TXT)', ic: 'fa-solid fa-file-lines', f: () => baixar('txt') }]);
    };
    window.relatoriosHubTexto = (k) => (FAB[k] ? texto(FAB[k]()) : '');
    window.relatoriosHubPdf = (k) => pdf(FAB[k]());
    window.relatoriosHubHtml = (k) => html(FAB[k]());
    const t = $('screen-reports');
    if (t) { renderHub(); let ativa = t.classList.contains('active'); new MutationObserver(() => { const a = t.classList.contains('active'); if (a && !ativa) mostrar(); ativa = a; }).observe(t, { attributes: true, attributeFilter: ['class'] }); }
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/55-hub-relatorios.js'] = '2.47.0';

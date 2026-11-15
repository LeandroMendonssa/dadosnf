// 55-hub-relatorios.js — Relatórios como central de modalidades que emitem de verdade (2.46.0; layout de relatório e filtros na 2.47.0)
// Cada modalidade: período, fornecedor, produto, "o que incluir", prévia em papel e Copiar/Baixar (TXT, Word, PDF) no fim da página.
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const e = s => (typeof escRel === 'function' ? escRel(s) : String(s == null ? '' : s));
    const CHAVE = 'relHubOpcoesV2';
    const MOD = {
        pendencias: { nome: 'Resumo de pendências', curto: 'Pendências', ic: 'fa-clipboard-list', desc: 'Pedidos com entregas pendentes, para enviar ao fornecedor.', abre: true },
        divergencias: { nome: 'Divergências por fornecedor', curto: 'Divergências', ic: 'fa-triangle-exclamation', desc: 'Cada divergência com produto, quantidades e valores, agrupada por fornecedor.', periodo: true, forn: true, prod: true, tog: [['pendente', 'Pendentes', true], ['resolvida', 'Resolvidas', false], ['encerrada', 'Encerradas', false]] },
        entregas: { nome: 'Entregas por pedido', curto: 'Entregas', ic: 'fa-truck-ramp-box', desc: 'Situação de cada fornecedor em cada pedido, com o que falta chegar (situação atual).', periodo: false, forn: true, prod: true, tog: [['aguardando', 'Aguardando', true], ['parcial', 'Parciais', true], ['completa', 'Completas', false], ['cancelada', 'Canceladas', false]] },
        financeiro: { nome: 'NFs enviadas ao financeiro', curto: 'NFs', ic: 'fa-file-invoice-dollar', desc: 'Notas arquivadas (enviadas) no período, por fornecedor, com total.', periodo: true, forn: true, prod: false, tog: [['venc', 'Vencimento', true], ['valor', 'Valor e total', true], ['pend', 'Incluir notas ainda não enviadas', false]] },
        auditorias: { nome: 'Auditorias do período', curto: 'Auditorias', ic: 'fa-magnifying-glass-chart', desc: 'Auditorias registradas no período, com o detalhe de cada divergência.', periodo: true, forn: true, prod: true, tog: [['obs', 'Observações da auditoria', false]] }
    };
    const ORDEM = ['divergencias', 'entregas', 'financeiro', 'auditorias', 'pendencias'];
    let estado = { aba: null, periodo: '30', de: '', ate: '', tog: {}, f: {} };
    try { const s = JSON.parse(localStorage.getItem(CHAVE) || 'null'); if (s) { if (s.tog) estado.tog = s.tog; if (s.periodo) estado.periodo = s.periodo; } } catch (_) { }
    const guardar = () => { try { localStorage.setItem(CHAVE, JSON.stringify({ tog: estado.tog, periodo: estado.periodo })); } catch (_) { } };
    const togOn = (m, k, pad) => { const t = estado.tog[m]; return t && k in t ? !!t[k] : pad; };
    const filtro = m => (estado.f[m] = estado.f[m] || { forn: '', prod: '' });

    // ---------- util ----------
    const up = s => String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const fd = str => { const d = typeof dataRel === 'function' ? dataRel(str) : null; return d ? d.toLocaleDateString('pt-BR') : 'sem data'; };
    const rotTipo = t => (typeof TIPOS_DIVERGENCIA_AUDITORIA !== 'undefined' && (TIPOS_DIVERGENCIA_AUDITORIA[t] || {}).label) || t;
    const brl = n => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const valNum = v => { const n = parseFloat(String(v || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
    function intervalo() {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        if (estado.periodo === '7') return { de: new Date(hoje - 6 * 864e5), ate: hoje, txt: 'últimos 7 dias' };
        if (estado.periodo === '30') return { de: new Date(hoje - 29 * 864e5), ate: hoje, txt: 'últimos 30 dias' };
        if (estado.periodo === 'mes') return { de: new Date(hoje.getFullYear(), hoje.getMonth(), 1), ate: hoje, txt: 'este mês' };
        const de = dataRel(estado.de), ate = dataRel(estado.ate), f = d => d ? d.toLocaleDateString('pt-BR') : '…';
        return { de, ate, txt: f(de) + ' a ' + f(ate) };
    }
    function noPeriodo(str) { const { de, ate } = intervalo(), d = dataRel(str); if (!d) return false; if (de && d < de) return false; if (ate && d > ate) return false; return true; }
    // nome do fornecedor: o apelido da entidade (cadastros ligados viram um só); sem CNPJ, nomes que são prefixo de palavra inteira se reúnem ao mais curto
    function resolvedorNomes(regs) {
        const disp = r => up((typeof nomeExibicaoFornecedor === 'function' && nomeExibicaoFornecedor(r.nome, r.cnpj)) || r.nome) || 'SEM FORNECEDOR';
        const base = [...new Set(regs.map(disp))].sort((a, b) => a.length - b.length), canon = new Map();
        base.forEach(k => { const b = base.find(o => o !== k && canon.get(o) === o && k.startsWith(o + ' ')); canon.set(k, b || k); });
        return r => canon.get(disp(r));
    }
    function aplicaForn(m, nome) { const f = filtro(m).forn; return !f || nome === f; }
    function aplicaProd(m, textos) { const p = norm(filtro(m).prod).trim(); return !p || textos.some(t => norm(t).includes(p)); }

    // ---------- modelos: { titulo, periodo, filtros, resumo, secoes:[{t, itens:[{cab, tag, tipo, det:[]}]}], vazio, fornecedores:[], produtos:[], total } ----------
    function limparFiltrosAntigos() { try { relatoriosFiltros = { de: '', ate: '', fornecedor: '', fornecedorExato: false, destino: '', recurso: '', tipo: '', produto: '' }; } catch (_) { } }
    function agrupar(itens, chaveForn) {
        const por = new Map(); itens.forEach(i => { const k = chaveForn(i); if (!por.has(k)) por.set(k, []); por.get(k).push(i); });
        return [...por.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
    }
    function descFiltros(m) { const f = filtro(m), L = []; if (f.forn) L.push('Fornecedor: ' + f.forn); if (f.prod.trim()) L.push('Produto: ' + f.prod.trim()); return L.join(' · '); }

    function modeloDivergencias() {
        limparFiltrosAntigos();
        const todas = divergenciasRel().filter(d => noPeriodo(d.data));
        const res = resolvedorNomes(todas.map(d => ({ nome: d.fornecedor, cnpj: d.fornecedorCnpj })));
        todas.forEach(d => { d._f = res({ nome: d.fornecedor, cnpj: d.fornecedorCnpj }); d._s = d.status === 'resolvida' ? 'resolvida' : d.status === 'encerrada' ? 'encerrada' : 'pendente'; });
        const ok = { pendente: togOn('divergencias', 'pendente', true), resolvida: togOn('divergencias', 'resolvida', false), encerrada: togOn('divergencias', 'encerrada', false) };
        const base = todas.filter(d => ok[d._s]);
        const lista = base.filter(d => aplicaForn('divergencias', d._f) && aplicaProd('divergencias', (d.produtos || []).concat(d.linhas || [])));
        const secoes = agrupar(lista, d => d._f).map(([k, ds]) => ({
            t: `${k} — ${ds.length} divergência(s)`,
            itens: ds.sort((a, b) => (dataRel(b.data) || 0) - (dataRel(a.data) || 0)).map(d => ({
                cab: `Pedido ${d.pedido || '—'}${d.notaFiscal ? ' · NF ' + d.notaFiscal : ''} · ${fd(d.data)}`, tag: d._s.toUpperCase(), tipo: rotTipo(d.tipo),
                det: (d.linhas && d.linhas.length ? d.linhas : (d.produtos || [])).map(x => String(x).replace(/\s+/g, ' ').trim())
            }))
        }));
        const c = s => lista.filter(d => d._s === s).length;
        return { titulo: 'DIVERGÊNCIAS POR FORNECEDOR', periodo: intervalo().txt, filtros: descFiltros('divergencias'), resumo: `${lista.length} divergência(s) · ${c('pendente')} pendente(s) · ${c('resolvida')} resolvida(s) · ${c('encerrada')} encerrada(s) · ${secoes.length} fornecedor(es)`, secoes, vazio: 'Nenhuma divergência com os filtros escolhidos.', total: lista.length, fornecedores: [...new Set(base.map(d => d._f))].sort(), produtos: [...new Set(base.flatMap(d => d.produtos || []))].sort() };
    }
    function modeloEntregas() {
        const ok = { aguardando: togOn('entregas', 'aguardando', true), parcial: togOn('entregas', 'parcial', true), completa: togOn('entregas', 'completa', false), cancelada: togOn('entregas', 'cancelada', false) };
        const rot = { aguardando: 'AGUARDANDO', parcial: 'PARCIAL', parcial_relatada: 'PARCIAL (FALTA RELATADA)', completa: 'ENTREGUE', cancelada: 'ENTREGA CANCELADA', erp_sem_itens: 'NF NO ERP SEM ITENS' };
        const regs = [];
        (listaCotacoes || []).forEach(c => {
            try {
                const comp = compararFontesPedido(c.pedido);
                (c.fornecedores || []).forEach(f => {
                    const compF = comp.filter(x => normalizarCnpj(x.cnpjFornecedor) === normalizarCnpj(f.cnpj));
                    const en = calcularEntregaFornecedorPedido(c.pedido, f, compF); if (!en) return;
                    const grupo = en.estado === 'cancelada' ? 'cancelada' : en.estado === 'completa' ? 'completa' : (en.estado === 'parcial' || en.estado === 'parcial_relatada') ? 'parcial' : 'aguardando';
                    regs.push({ pedido: c.pedido, nome: f.razaoSocial || f.nome || '', cnpj: f.cnpj, en, grupo });
                });
            } catch (_) { }
        });
        const res = resolvedorNomes(regs.map(r => ({ nome: r.nome, cnpj: r.cnpj })));
        regs.forEach(r => { r._f = res({ nome: r.nome, cnpj: r.cnpj }); r.falta = (r.en.faltando || []).map(i => String((i && (i.nomeComQuantidade || i.nome)) || i)); r.todos = (r.en.itens || []).map(i => i.nome || ''); });
        const base = regs.filter(r => ok[r.grupo]);
        const lista = base.filter(r => aplicaForn('entregas', r._f) && aplicaProd('entregas', r.todos.concat(r.falta)));
        const porPed = new Map(); lista.forEach(r => { if (!porPed.has(r.pedido)) porPed.set(r.pedido, []); porPed.get(r.pedido).push(r); });
        const secoes = [...porPed.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0]), 'pt-BR', { numeric: true })).map(([p, rs]) => ({
            t: `PEDIDO ${p}`,
            itens: rs.sort((a, b) => a._f.localeCompare(b._f, 'pt-BR')).map(r => {
                const det = []; const en = r.en;
                if (en.total) det.push(`${en.cobertos || 0} de ${en.total} item(ns) recebido(s)`);
                if (r.falta.length) det.push('Falta chegar: ' + r.falta.join('; '));
                const nfs = (en.nfsApp || []).map(n => n.nf).concat((en.nfsErp || []).map(n => n.nf || n.numero)).filter(Boolean); if (nfs.length) det.push('NF: ' + [...new Set(nfs)].join(', '));
                if (en.dataChegada) det.push('Chegada: ' + fd(en.dataChegada));
                return { cab: r._f, tag: rot[en.estado] || String(en.estado).toUpperCase(), tipo: '', det };
            })
        }));
        return { titulo: 'ENTREGAS POR PEDIDO', periodo: 'situação atual', filtros: descFiltros('entregas'), resumo: `${lista.length} fornecedor(es) em ${secoes.length} pedido(s)`, secoes, vazio: 'Nada a listar com os filtros escolhidos.', total: lista.length, fornecedores: [...new Set(base.map(r => r._f))].sort(), produtos: [...new Set(base.flatMap(r => r.todos))].filter(Boolean).sort() };
    }
    function modeloFinanceiro() {
        const incV = togOn('financeiro', 'venc', true), incVal = togOn('financeiro', 'valor', true), incP = togOn('financeiro', 'pend', false);
        const brutas = (historicoNotas || []).map(n => ({ ...n, _s: 'ENVIADA' })).concat(incP ? (notasPendentes || []).map(n => ({ ...n, _s: 'NÃO ENVIADA' })) : []).filter(n => noPeriodo(n.data));
        const res = resolvedorNomes(brutas.map(n => ({ nome: n.fornecedor, cnpj: n.cnpj || n.cnpjFornecedor })));
        brutas.forEach(n => { n._f = res({ nome: n.fornecedor, cnpj: n.cnpj || n.cnpjFornecedor }); });
        const lista = brutas.filter(n => aplicaForn('financeiro', n._f));
        let totalGeral = 0;
        const secoes = agrupar(lista, n => n._f).map(([k, ns]) => {
            const tot = ns.reduce((s, n) => s + valNum(n.valor), 0); totalGeral += tot;
            return { t: `${k} — ${ns.length} nota(s)${incVal && tot ? ' · ' + brl(tot) : ''}`, itens: ns.sort((a, b) => (dataRel(b.data) || 0) - (dataRel(a.data) || 0)).map(n => ({ cab: `NF ${n.nf || '—'} · ${fd(n.data)}`, tag: incP ? n._s : '', tipo: '', det: [[incV && n.vencimento ? 'Vencimento ' + n.vencimento : '', incVal && n.valor ? 'Valor ' + (/^R\$/.test(n.valor) ? n.valor : 'R$ ' + n.valor) : ''].filter(Boolean).join(' · ')].filter(Boolean) })) };
        });
        return { titulo: 'NOTAS FISCAIS ENVIADAS AO FINANCEIRO', periodo: intervalo().txt, filtros: descFiltros('financeiro'), resumo: `${lista.length} nota(s) · ${secoes.length} fornecedor(es)${incVal && totalGeral ? ' · total ' + brl(totalGeral) : ''}`, secoes, vazio: 'Nenhuma nota no período.', total: lista.length, fornecedores: [...new Set(brutas.map(n => n._f))].sort(), produtos: [] };
    }
    function modeloAuditorias() {
        limparFiltrosAntigos();
        const obs = togOn('auditorias', 'obs', false);
        const brutas = auditoriasBaseRel().filter(x => noPeriodo(x.data));
        const res = resolvedorNomes(brutas.map(x => ({ nome: x.fornecedor, cnpj: x.fornecedorCnpj })));
        brutas.forEach(x => { x._f = res({ nome: x.fornecedor, cnpj: x.fornecedorCnpj }); x._lin = (x.divergencias || []).map(d => ({ tipo: rotTipo(d.tipo), linhas: (() => { try { return linhasDeMateriais(d); } catch (_) { return []; } })() })); });
        const lista = brutas.filter(x => aplicaForn('auditorias', x._f) && aplicaProd('auditorias', x._lin.flatMap(l => l.linhas)));
        const secoes = agrupar(lista, x => x._f).map(([k, xs]) => ({
            t: `${k} — ${xs.length} auditoria(s)`,
            itens: xs.sort((a, b) => (dataRel(b.data) || 0) - (dataRel(a.data) || 0)).map(x => ({
                cab: `Pedido ${x.pedido || '—'}${x.notaFiscal ? ' · NF ' + x.notaFiscal : ''} · ${fd(x.data)}`, tag: (x.divergencias || []).length ? (x.divergencias.length + ' DIVERGÊNCIA(S)') : 'SEM DIVERGÊNCIA', tipo: '',
                det: x._lin.flatMap(l => [l.tipo + (l.linhas.length ? ':' : '')].concat(l.linhas.map(t => '   ' + String(t).replace(/\s+/g, ' ').trim()))).concat(obs && x.observacaoGeral ? ['Obs.: ' + x.observacaoGeral] : [])
            }))
        }));
        return { titulo: 'AUDITORIAS DO PERÍODO', periodo: intervalo().txt, filtros: descFiltros('auditorias'), resumo: `${lista.length} auditoria(s) · ${secoes.length} fornecedor(es)`, secoes, vazio: 'Nenhuma auditoria no período.', total: lista.length, fornecedores: [...new Set(brutas.map(x => x._f))].sort(), produtos: [...new Set(brutas.flatMap(x => x._lin.flatMap(l => l.linhas)))].map(t => String(t).split(/[:,—]/)[0].trim()).filter(Boolean).sort().filter((v, i, a) => a.indexOf(v) === i) };
    }
    const FAB = { divergencias: modeloDivergencias, entregas: modeloEntregas, financeiro: modeloFinanceiro, auditorias: modeloAuditorias };

    // ---------- saídas ----------
    function dataExtenso() { return typeof dataExtensoResumo === 'function' ? dataExtensoResumo() : new Date().toLocaleDateString('pt-BR'); }
    function texto(m) {
        const L = [m.titulo, 'Emitido em ' + dataExtenso().replace(/\.$/, ''), 'Período: ' + m.periodo]; if (m.filtros) L.push('Filtros: ' + m.filtros); L.push(m.resumo, '');
        if (!m.secoes.length) L.push(m.vazio, '');
        m.secoes.forEach(s => { L.push(s.t, '-'.repeat(Math.min(60, s.t.length))); s.itens.forEach(i => { L.push(`${i.cab}${i.tag ? ' [' + i.tag + ']' : ''}`); if (i.tipo) L.push('  ' + i.tipo); i.det.forEach(d => L.push('  ' + d)); L.push(''); }); });
        return L.join('\n').trimEnd() + '\n';
    }
    function html(m) {
        let h = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${e(m.titulo)}</title>
<style>@page WordSection1{size:21cm 29.7cm;margin:2cm 2cm 2cm 2cm}div.WordSection1{page:WordSection1}body{font-family:Arial,sans-serif;font-size:10pt;color:#111111}p{margin:0}.s{font-weight:bold;font-size:11pt;border-bottom:1px solid #444444;margin:14pt 0 5pt;padding-bottom:2pt}.c{font-weight:bold;margin-top:6pt}.d{margin-left:12pt;color:#333333}</style></head><body><div class="WordSection1">
<p style="font-size:16pt;font-weight:bold">${e(m.titulo)}</p><p style="font-size:9pt;color:#444444">Emitido em ${e(dataExtenso().replace(/\.$/, ''))} · Período: ${e(m.periodo)}${m.filtros ? ' · ' + e(m.filtros) : ''}</p><p style="margin:6pt 0 4pt"><b>${e(m.resumo)}</b></p>`;
        if (!m.secoes.length) h += `<p>${e(m.vazio)}</p>`;
        m.secoes.forEach(s => { h += `<p class="s">${e(s.t)}</p>`; s.itens.forEach(i => { h += `<p class="c">${e(i.cab)}${i.tag ? ' — ' + e(i.tag) : ''}</p>`; if (i.tipo) h += `<p class="d"><i>${e(i.tipo)}</i></p>`; i.det.forEach(d => { h += `<p class="d">${e(d).replace(/^(\s+)/, m2 => '&nbsp;'.repeat(m2.length))}</p>`; }); }); });
        return h + '</div></body></html>';
    }
    function pdf(m) {
        const { jsPDF } = jspdf, doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), ML = 57, MR = 57, MT = 57, MB = 57, LARG = W - ML - MR;
        let y = MT;
        const fonte = (t, s, c) => { doc.setFont('helvetica', s || 'normal'); doc.setFontSize(t); const k = c == null ? 17 : c; doc.setTextColor(k, k, k); };
        const gar = h => { if (y + h > H - MB) { doc.addPage(); y = MT; } };
        const quebra = (t, w, tam, est) => { fonte(tam, est); return doc.splitTextToSize(String(t), w); };
        quebra('x', 10, 16, 'bold').length; fonte(16, 'bold'); quebra(m.titulo, LARG, 16, 'bold').forEach(l => { doc.text(l, ML, y + 12); y += 20; });
        fonte(9, 'normal', 80); quebra('Emitido em ' + dataExtenso().replace(/\.$/, '') + ' · Período: ' + m.periodo + (m.filtros ? ' · ' + m.filtros : ''), LARG, 9).forEach(l => { fonte(9, 'normal', 80); doc.text(l, ML, y + 8); y += 12; });
        y += 4; quebra(m.resumo, LARG, 10, 'bold').forEach(l => { fonte(10, 'bold'); doc.text(l, ML, y + 9); y += 13; }); y += 4;
        if (!m.secoes.length) { fonte(10.5); doc.text(m.vazio, ML, y + 10); }
        m.secoes.forEach(s => {
            const tl = quebra(s.t, LARG, 11, 'bold'); gar(tl.length * 15 + 40); y += 8;
            tl.forEach(l => { fonte(11, 'bold'); doc.text(l, ML, y + 11); y += 15; });
            doc.setDrawColor(90); doc.setLineWidth(0.6); doc.line(ML, y, W - MR, y); y += 8;
            s.itens.forEach(i => {
                const tagW = i.tag ? (fonte(8.5, 'bold'), doc.getTextWidth(i.tag) + 4) : 0;
                const cl = quebra(i.cab, LARG - tagW - 8, 10, 'bold'), dets = [];
                if (i.tipo) quebra(i.tipo, LARG - 14, 10, 'italic').forEach(l => dets.push([l, 'italic']));
                i.det.forEach(d => { const rec = (d.match(/^\s*/) || [''])[0].length; quebra(d.trim(), LARG - 14 - rec * 3, 10).forEach(l => dets.push([l, 'normal', rec * 3])); });
                gar(cl.length * 13 + Math.min(dets.length, 3) * 13 + 8);
                cl.forEach((l, k) => { fonte(10, 'bold'); doc.text(l, ML, y + 10); if (k === 0 && i.tag) { fonte(8.5, 'bold', 70); doc.text(i.tag, W - MR, y + 10, { align: 'right' }); } y += 13; });
                dets.forEach(([l, est, rec]) => { gar(13); fonte(10, est, est === 'italic' ? 60 : 40); doc.text(l, ML + 14 + (rec || 0), y + 10); y += 13; });
                y += 7;
            });
        });
        return doc;
    }

    // ---------- telas ----------
    function renderHub() {
        const el = $('rel-hub'); if (!el) return;
        el.innerHTML = '<div class="rel-intro">Escolha o relatório que quer emitir. Todos podem ser copiados ou baixados em PDF, Word ou texto.</div><div class="mais-grupo">' + ORDEM.map(k => { const m = MOD[k]; return `<button type="button" class="mais-item rel-hub-item" onclick="relAbrir('${k}')"><span class="icon-wrapper"><i class="fa-solid ${m.ic}"></i></span><span class="mais-item-nome">${e(m.nome)}<small class="rel-desc">${e(m.desc)}</small></span><i class="fa-solid fa-chevron-right mais-item-seta"></i></button>`; }).join('') + '</div>';
    }
    function renderDetalhe() {
        const el = $('rel-detalhe'), k = estado.aba; if (!el || !k) return;
        const md = MOD[k], m = FAB[k](), f = filtro(k);
        const abas = `<div class="rel-abas"><button type="button" class="rel-chip" onclick="relVoltar()">Todos</button>${ORDEM.map(x => `<button type="button" class="rel-chip${x === k ? ' on' : ''}" onclick="relAbrir('${x}')">${e(MOD[x].curto)}</button>`).join('')}</div>`;
        const per = md.periodo ? `<div class="rel-sec">Período</div><div class="rel-chips">${[['7', '7 dias'], ['30', '30 dias'], ['mes', 'Este mês'], ['custom', 'Personalizado']].map(([v, t]) => `<button type="button" class="rel-chip${estado.periodo === v ? ' on' : ''}" onclick="relPeriodo('${v}')">${t}</button>`).join('')}</div>${estado.periodo === 'custom' ? `<div class="rel-datas"><div class="campo"><label>De</label><input type="date" class="form-field" value="${e(estado.de)}" onchange="relDatas('de',this.value)"></div><div class="campo"><label>Até</label><input type="date" class="form-field" value="${e(estado.ate)}" onchange="relDatas('ate',this.value)"></div></div>` : ''}` : '<div class="rel-sec">Período</div><div class="rel-nota">Este relatório mostra a situação atual.</div>';
        const fil = (md.forn || md.prod) ? `<div class="rel-sec">Isolar</div><div class="rel-datas">${md.forn ? `<div class="campo"><label>Fornecedor</label><select class="form-field" onchange="relFiltro('forn',this.value)"><option value="">Todos</option>${m.fornecedores.map(n => `<option value="${e(n)}"${n === f.forn ? ' selected' : ''}>${e(n)}</option>`).join('')}</select></div>` : ''}${md.prod ? `<div class="campo"><label>Produto</label><input type="search" class="form-field" id="rel-prod" list="rel-prod-lista" placeholder="Digite parte do nome" value="${e(f.prod)}" onchange="relFiltro('prod',this.value)"><datalist id="rel-prod-lista">${m.produtos.slice(0, 300).map(n => `<option value="${e(n)}">`).join('')}</datalist></div>` : ''}</div>` : '';
        const togs = (md.tog || []).length ? `<div class="rel-sec">O que incluir</div><div class="rel-togs">${md.tog.map(([t, r, p]) => `<label class="rel-tog"><input type="checkbox" ${togOn(k, t, p) ? 'checked' : ''} onchange="relTog('${k}','${t}',this.checked)"><span>${e(r)}</span></label>`).join('')}</div>` : '';
        const corpo = m.secoes.length ? m.secoes.map(s => `<div class="rel-p-sec">${e(s.t)}</div>${s.itens.map(i => `<div class="rel-p-it"><div class="rel-p-cab"><span>${e(i.cab)}</span>${i.tag ? `<span class="rel-p-tag">${e(i.tag)}</span>` : ''}</div>${i.tipo ? `<div class="rel-p-tipo">${e(i.tipo)}</div>` : ''}${i.det.map(d => `<div class="rel-p-det">${e(d).replace(/^(\s+)/, m2 => '&nbsp;'.repeat(m2.length * 2))}</div>`).join('')}</div>`).join('')}`).join('') : `<div class="rel-p-det">${e(m.vazio)}</div>`;
        const ativo = document.activeElement && document.activeElement.id === 'rel-prod';
        el.innerHTML = `${abas}<h3 class="rel-titulo">${e(md.nome)}</h3>${per}${fil}${togs}
            <div class="rel-sec">Prévia</div>
            <div class="rp-papel rel-papel"><div class="rel-p-tit">${e(m.titulo)}</div><div class="rel-p-per">Emitido em ${e(dataExtenso().replace(/\.$/, ''))} · Período: ${e(m.periodo)}${m.filtros ? ' · ' + e(m.filtros) : ''}</div><div class="rel-p-res">${e(m.resumo)}</div>${corpo}</div>
            <div class="rp-rodape"><button type="button" class="actions-button is-neutral" onclick="relCopiar()"><i class="fa-solid fa-copy"></i> Copiar</button><button type="button" class="actions-button is-primary" onclick="relBaixar()"><i class="fa-solid fa-download"></i> Baixar</button></div>`;
        if (ativo) { const p = $('rel-prod'); if (p) p.focus(); }
    }
    function mostrar() {
        const h = $('rel-hub'), d = $('rel-detalhe'); if (!h || !d) return;
        h.style.display = estado.aba ? 'none' : ''; d.style.display = estado.aba ? '' : 'none';
        if (estado.aba) renderDetalhe(); else renderHub();
    }
    window.relAbrir = function (k) { if (MOD[k].abre) { if (typeof abrirResumoPendencias === 'function') abrirResumoPendencias(); return; } estado.aba = k; mostrar(); const t = $('screen-reports'); if (t) t.scrollTop = 0; };
    window.relVoltar = function () { estado.aba = null; mostrar(); const t = $('screen-reports'); if (t) t.scrollTop = 0; };
    window.relPeriodo = function (v) { estado.periodo = v; guardar(); renderDetalhe(); };
    window.relDatas = function (c, v) { estado[c] = v; renderDetalhe(); };
    window.relFiltro = function (c, v) { filtro(estado.aba)[c] = v; renderDetalhe(); };
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
        abrirFolhaAcoes('Baixar relatório', [
            { t: 'PDF', ic: 'fa-solid fa-file-pdf', f: () => baixar('pdf') }, { t: 'Word', ic: 'fa-solid fa-file-word', f: () => baixar('doc') }, { t: 'Texto (TXT)', ic: 'fa-solid fa-file-lines', f: () => baixar('txt') }]);
    };
    window.relatoriosHubTexto = (k) => (FAB[k] ? texto(FAB[k]()) : '');
    window.relatoriosHubPdf = (k) => pdf(FAB[k]());
    window.relatoriosHubHtml = (k) => html(FAB[k]());
    const t = $('screen-reports');
    if (t) { renderHub(); let ativa = t.classList.contains('active'); new MutationObserver(() => { const a = t.classList.contains('active'); if (a && !ativa) mostrar(); ativa = a; }).observe(t, { attributes: true, attributeFilter: ['class'] }); }
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/55-hub-relatorios.js'] = '2.48.1';

// 48-inicio-lote.js — Tela inicial (2.25.0) e busca de lote/validade.
// A tela inicial usa SÓ dados que o app já carrega na abertura (notas da relação): não gera leitura nova no Firebase.
// A busca de lote usa as NFs processadas (carregadas só quando você abre essa tela) e procura em itens[].lote / itens[].validade.
const escIni = s => (typeof escRel === 'function' ? escRel(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const MESES_INI = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'], DIAS_INI = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
function inicioSaudacao() { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
function inicioPrimeiroNome() {
    try { const n = (typeof assinaturaRelatorio === 'function' && assinaturaRelatorio().nome) || (auth.currentUser && (auth.currentUser.displayName || '')) || ''; return String(n).trim().split(/\s+/)[0] || ''; } catch (e) { return ''; }
}
function inicioDados() {
    const abertas = (notasPendentes || []).filter(n => n && !n.enviada && n.vencimento);
    const dias = n => calcularDiasParaVencimento(n.vencimento);
    const venc = abertas.filter(n => dias(n) !== null && dias(n) < 0).length, hoje = abertas.filter(n => dias(n) === 0).length, aman = abertas.filter(n => dias(n) === 1).length;
    const proximas = abertas.filter(n => dias(n) !== null).sort((a, b) => dias(a) - dias(b)).slice(0, 4);
    return { venc, hoje, aman, naRelacao: abertas.length, proximas, dias };
}
function renderInicio() {
    const el = document.getElementById('inicio-conteudo'); if (!el) return;
    const d = inicioDados(), agora = new Date(), nome = inicioPrimeiroNome();
    const dataTxt = `${DIAS_INI[agora.getDay()]}, ${String(agora.getDate()).padStart(2, '0')} de ${MESES_INI[agora.getMonth()]}`;
    const k = (cls, n, txt, acao) => `<button type="button" class="ini-k ${cls}" onclick="${acao}"><b>${n}</b><span>${txt}</span></button>`;
    const at = (ic, txt, acao, forte) => `<button type="button" class="ini-at${forte ? ' forte' : ''}" onclick="${acao}"><i class="${ic}"></i><span>${txt}</span></button>`;
    const chipDias = n => { const x = d.dias(n); return x < 0 ? `<span class="ini-chip r">${-x} dia(s) atrás</span>` : x === 0 ? '<span class="ini-chip r">Hoje</span>' : x === 1 ? '<span class="ini-chip y">Amanhã</span>' : `<span class="ini-chip">${x} dias</span>`; };
    const linhasProx = d.proximas.map(n => {
        let nomeF = n.fornecedor || ''; try { nomeF = nomeExibicaoFornecedor(n.fornecedor, n.cnpj || '') || nomeF; } catch (e) { }
        return `<div class="ini-lin"><div>${escIni(nomeF)} ${escIni(n.nf || '')}<small>${escIni(n.vencimento)}${n.valor ? ' · R$ ' + escIni(n.valor) : ''}</small></div>${chipDias(n)}</div>`;
    }).join('') || '<div class="ini-vazio">Nenhuma NF aberta na relação.</div>';
    el.innerHTML = `
        <h1 class="ini-h1">${inicioSaudacao()}${nome ? ', ' + escIni(nome) : ''}</h1><div class="ini-sub">${dataTxt}</div>
        <form class="ini-busca" onsubmit="event.preventDefault(); inicioBuscar(this.q.value)"><i class="fa-solid fa-magnifying-glass"></i><input name="q" type="search" placeholder="Buscar NF, fornecedor ou pedido" autocomplete="off" enterkeyhint="search"></form>
        <div class="ini-tit">Atenção agora</div>
        <div class="ini-grid">
            ${k('r', d.venc, 'NFs vencidas na relação', "switchToScreen('screen-reports','Relatórios')")}
            ${k('y', d.hoje + d.aman, `vencem hoje (${d.hoje}) ou amanhã (${d.aman})`, "switchToScreen('screen-reports','Relatórios')")}
            ${k('g', d.naRelacao, 'NFs abertas na relação', "switchToScreen('screen-manage','Gerenciar')")}
            ${k('n', '→', 'Pendências de entrega dos pedidos', 'abrirResumoPendencias()')}
        </div>
        <div class="ini-tit">Atalhos</div>
        <div class="ini-ats">
            ${at('fa-solid fa-file-invoice', 'Entrada de NF', "switchToScreen('screen-xml-editor','Entrada de NF')", true)}
            ${at('fa-solid fa-plus-circle', 'Adicionar nota', "switchToScreen('screen-add','Adicionar')")}
            ${at('fa-solid fa-file-contract', 'Cotações', "switchToScreen('screen-cotacoes','Cotações')")}
            ${at('fa-solid fa-list-check', 'Controle de NFs', "switchToScreen('screen-controle-nfs','Controle de NFs')")}
            ${at('fa-solid fa-tasks', 'Gerenciar', "switchToScreen('screen-manage','Gerenciar')")}
            ${at('fa-solid fa-sticky-note', 'Anotações', "switchToScreen('screen-anotacoes','Anotações')")}
            ${at('fa-solid fa-barcode', 'Buscar lote', "abrirBuscaLote()")}
            ${at('fa-solid fa-file-lines', 'Resumo de pendências', 'abrirResumoPendencias()')}
            ${at('fa-solid fa-calendar-days', 'Agenda', "switchToScreen('screen-agenda','Agenda de trabalho'); if (typeof prepararAgenda==='function') prepararAgenda()")}
        </div>
        <div class="ini-tit">Próximos vencimentos</div>
        <div class="ini-card">${linhasProx}</div>`;
}
function renderInicioSeAtivo() { const t = document.getElementById('screen-inicio'); if (t && t.classList.contains('active')) renderInicio(); }
function inicioBuscar(txt) {
    txt = String(txt || '').trim(); if (!txt) return;
    abaControle = 'aberto'; filtroControle = txt; selecionadasControle.clear(); selecaoControleAtiva = false; limiteControle = 60;
    const b = document.getElementById('controle-busca'); if (b) b.value = txt;
    switchToScreen('screen-controle-nfs', 'Controle de NFs'); renderControleNfs();
}
// ---------- busca de lote ----------
function abrirBuscaLote() { switchToScreen('screen-lote', 'Buscar lote'); lotePreparar(); }
function lotePreparar() { const r = document.getElementById('lote-resultado'); if (r && !r.innerHTML) r.innerHTML = '<div class="ini-vazio">Digite o lote, o produto ou a validade e toque em Buscar.</div>'; }
function loteNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ''); }
function loteValidadeBR(v) { try { return typeof dataISOParaBR === 'function' ? (dataISOParaBR(v) || v) : v; } catch (e) { return v; } }
function loteBuscar() {
    const ql = loteNorm(document.getElementById('lote-q').value), qp = loteNorm(document.getElementById('lote-prod').value), qv = String(document.getElementById('lote-val').value || '').trim();
    const out = document.getElementById('lote-resultado');
    if (!ql && !qp && !qv) { out.innerHTML = '<div class="ini-vazio">Preencha pelo menos um campo.</div>'; return; }
    // validade digitada como mm/aaaa, dd/mm/aaaa ou aaaa-mm: compara em texto ISO
    const vIso = (() => { const t = qv.replace(/\s/g, ''); let m = t.match(/^(\d{1,2})\/(\d{4})$/); if (m) return `${m[2]}-${m[1].padStart(2, '0')}`; m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; m = t.match(/^(\d{4})-(\d{2})/); return m ? t : t; })();
    const lista = typeof listaNfsProcessadas !== 'undefined' ? listaNfsProcessadas : [], achados = []; let semLote = 0;
    lista.forEach(nf => {
        const itens = nf.itens || []; if (!itens.some(i => i.lote)) semLote++;
        itens.forEach(i => {
            if (!i.lote && !qp) return;
            if (ql && !loteNorm(i.lote).includes(ql)) return;
            if (qp && !loteNorm(i.xProd).includes(qp)) return;
            if (qv && !String(i.validade || '').includes(vIso)) return;
            if (!i.lote && (ql || qv)) return;
            achados.push({ nf, i });
        });
    });
    achados.sort((a, b) => String(b.nf.emissao || '').localeCompare(String(a.nf.emissao || '')));
    const aviso = `<div class="ini-vazio">${lista.length} NF(s) processadas pesquisadas; ${semLote} sem lote gravado (NFs antigas ou sem lote no XML não aparecem).</div>`;
    if (!achados.length) { out.innerHTML = '<div class="ini-vazio">Nada encontrado com esses dados.</div>' + aviso; return; }
    out.innerHTML = `<div class="ini-tit">${achados.length} resultado(s)${achados.length > 100 ? ' (mostrando 100)' : ''}</div>` + achados.slice(0, 100).map(({ nf, i }) => {
        let forn = nf.fornecedor || ''; try { forn = nomeExibicaoFornecedor(nf.fornecedor, nf.cnpjFornecedor) || forn; } catch (e) { }
        const sp = i.codigoSpData ? `SP Data ${escIni(i.codigoSpData)}` : '';
        return `<button type="button" class="ini-res" onclick="abrirEditorNf('${escIni(nf.id)}')"><b>${escIni(i.xProd || '')}</b>
            <span>Lote <b>${escIni(i.lote || '—')}</b>${i.validade ? ' · validade ' + escIni(loteValidadeBR(i.validade)) : ''}${i.quantidade ? ' · qtd ' + escIni(i.quantidade) : ''}</span>
            <small>NF ${escIni(nf.nf || '')} · ${escIni(forn)}${nf.pedido ? ' · pedido ' + escIni(nf.pedido) : ''}${sp ? ' · ' + sp : ''}</small></button>`;
    }).join('') + aviso;
}
// entrar na tela inicial desenha o painel
(function () { const orig = switchToScreen; switchToScreen = function (id, t) { const r = orig.apply(this, arguments); if (id === 'screen-inicio') renderInicio(); return r; }; })();
window.addEventListener('load', () => { setTimeout(renderInicioSeAtivo, 600); setInterval(renderInicioSeAtivo, 20000); });
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/48-inicio-lote.js'] = '2.25.0';

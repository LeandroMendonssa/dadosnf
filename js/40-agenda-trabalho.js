// 40-agenda-trabalho.js — Agenda de trabalho (2.20.0)
// Parte do script do app. Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// Lembretes do trabalho num lugar só: entregas (reagentes, controle), reuniões e outros lembretes. Cada lembrete tem uma data (ou uma janela
// "de/até"), hora opcional, repetição opcional e avisos (véspera, no dia). Fica em "Mais → Agenda de trabalho" e também na Central de notificações.
//
// Dados: um documento só, config/agendaTrabalho = { itens: { <id>: { id, tipo, titulo, empresa, de, ate, hora, rep, vespera, dia, obs, feitas, origem } } }.
//   • tipo: 'entrega' | 'reuniao' | 'lembrete'      • rep: 'n' (não repete) | 's1' (toda semana) | 's4' (a cada 4 semanas) | 'm' (todo mês) | 'a' (todo ano)
//   • feitas: { d20261106: { em: '2026-11-06' } }   → ocorrência (pela data de início) já entregue/concluída; "em" = dia em que de fato aconteceu.
//   Gravar/apagar mexe só no campo do lembrete (merge), então dois aparelhos não se atropelam.
// Escolha de avisos por pessoa: config/prefs_<uid>.avisos = { entregas, reunioes, lembretes, nfVencendo, ocorrencias, pedidosParados, definido }.
//   Elas valem para as notificações no iPhone (etapa seguinte); a Central de notificações do app mostra tudo.
// ===================================================================
let listaAgenda = {};          // id → lembrete
let prefsAvisos = null;        // null = a pessoa ainda não escolheu
let agendaAba = 'proximos';    // 'proximos' | 'historico'
let agendaForm = null;         // lembrete em edição (null = fechado)
let agendaMarcando = null;     // { id, campo } aguardando a data real da entrega
let agendaPrefsAberto = false;
let agendaPerguntouNestaSessao = false;
const AGENDA_TIPOS = { entrega: 'Entrega', reuniao: 'Reunião', lembrete: 'Lembrete' };
const AGENDA_REPETE = { n: 'Não repete', s1: 'Toda semana', s4: 'A cada 4 semanas', m: 'Todo mês', a: 'Todo ano' };
const AGENDA_AVISOS = [
    ['entregas', 'Entregas (reagentes, controle)', 'Véspera e dia da entrega, e se passar da janela sem marcar'],
    ['reunioes', 'Reuniões', 'Véspera e antes do horário marcado'],
    ['lembretes', 'Outros lembretes', 'Véspera e no dia'],
    ['nfVencendo', 'NFs vencendo hoje ou amanhã', 'Notas da relação perto do vencimento'],
    ['ocorrencias', 'Ocorrências em aberto sem relato', 'Divergências que o app achou e você ainda não relatou (no iPhone, em breve)'],
    ['pedidosParados', 'Pedidos parados', 'Prazo vencido e sem sinal de entrega (no iPhone, em breve)']
];

// ---------------- datas (sempre texto AAAA-MM-DD, no dia local) ----------------
function agParse(iso) { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, m - 1, d, 12); }
function agIso(d) { return d.toLocaleDateString('en-CA'); }
function agAdd(iso, n) { const d = agParse(iso); d.setDate(d.getDate() + n); return agIso(d); }
function agDiff(a, b) { return Math.round((agParse(b) - agParse(a)) / 86400000); }
function agAddMes(iso, n, diaBase) { const d = agParse(iso); const y = d.getFullYear(), m = d.getMonth() + n; const ult = new Date(y, m + 1, 0).getDate(); return agIso(new Date(y, m, Math.min(diaBase, ult), 12)); }
function agFmt(iso, comAno) { const d = agParse(iso); const s = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getDay()] + ' ' + iso.slice(8, 10) + '/' + iso.slice(5, 7); return comAno ? s + '/' + iso.slice(0, 4) : s; }
function agQuando(o) {
    const base = o.ate > o.de ? `${agFmt(o.de)} a ${agFmt(o.ate)}` : agFmt(o.de);
    return base + (o.item.hora ? ' · ' + o.item.hora : '');
}

// ---------------- ocorrências (a mesma regra vai valer no envio de notificações) ----------------
function agOcorrencias(it, ini, fim) {
    const dur = it.ate && it.ate > it.de ? agDiff(it.de, it.ate) : 0, out = [];
    const push = s => { const e = agAdd(s, dur); if (e >= ini && s <= fim) out.push({ id: it.id, item: it, de: s, ate: e, campo: 'd' + s.replace(/-/g, '') }); };
    const rep = it.rep || 'n';
    if (!it.de) return out;
    if (rep === 'n') push(it.de);
    else if (rep === 's1' || rep === 's4') {
        const passo = rep === 's1' ? 7 : 28, k = Math.max(0, Math.floor((agDiff(it.de, ini) - dur) / passo));
        for (let s = agAdd(it.de, k * passo); s <= fim; s = agAdd(s, passo)) push(s);
    } else if (rep === 'm') { const dia = Number(it.de.slice(8)); for (let n = 0; n < 600; n++) { const s = agAddMes(it.de, n, dia); if (s > fim) break; push(s); } }
    else if (rep === 'a') { const dia = Number(it.de.slice(8)); for (let n = 0; n < 60; n++) { const s = agAddMes(it.de, 12 * n, dia); if (s > fim) break; push(s); } }
    return out;
}
// estado: feita | atrasada (entrega que passou da janela sem marcar) | passou | agora (hoje ou dentro da janela) | vespera (começa amanhã) | futura
function agLista(diasAtras, diasFrente) {
    const hoje = dataLocalISO(), amanha = agAdd(hoje, 1), ini = agAdd(hoje, -diasAtras), fim = agAdd(hoje, diasFrente), todas = [];
    Object.values(listaAgenda || {}).forEach(it => {
        if (!it || !it.de) return;
        agOcorrencias(it, ini, fim).forEach(o => {
            const feita = (it.feitas || {})[o.campo];
            o.feita = feita || null;
            o.estado = feita ? 'feita' : (o.ate < hoje ? (it.tipo === 'entrega' ? 'atrasada' : 'passou') : (o.de <= hoje ? 'agora' : (o.de === amanha ? 'vespera' : 'futura')));
            todas.push(o);
        });
    });
    return todas.sort((a, b) => a.de.localeCompare(b.de) || String(a.item.hora || '').localeCompare(String(b.item.hora || '')));
}

// ---------------- gravação ----------------
function agendaDocRef() { return firestore.collection('config').doc('agendaTrabalho'); }
async function agendaGravar(id, dados) {
    try { await agendaDocRef().set({ itens: { [id]: dados } }, { merge: true }); return true; }
    catch (e) { erroFirebase('Erro ao gravar a agenda:', e); toast('✕ Não consegui salvar. Tente novamente.'); return false; }
}
async function agendaApagarCampo(caminho) {
    try { await agendaDocRef().update({ [caminho]: firebase.firestore.FieldValue.delete() }); return true; }
    catch (e) { erroFirebase('Erro ao alterar a agenda:', e); toast('✕ Não consegui alterar. Tente novamente.'); return false; }
}
ASSINATURAS_DADOS.agenda = () => agendaDocRef().onSnapshot(doc => {
    listaAgenda = (doc.exists && doc.data() && doc.data().itens) || {};
    renderAgendaSeAtiva();
    if (typeof renderAtencaoSeAtiva === 'function') renderAtencaoSeAtiva();
}, error => erroFirebase('Erro ao carregar a agenda:', error));
if (DADOS_ESSENCIAIS.indexOf('agenda') < 0) DADOS_ESSENCIAIS.push('agenda');

// ---------------- tela ----------------
function escA(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function renderAgendaSeAtiva() { const t = document.getElementById('screen-agenda'); if (t && t.classList.contains('active')) renderAgenda(); }
function prepararAgenda() {
    agendaForm = null; agendaMarcando = null; agendaAba = 'proximos';
    agendaPrefsAberto = !(prefsAvisos && prefsAvisos.definido);
    renderAgenda();
    if (!(prefsAvisos && prefsAvisos.definido) && !agendaPerguntouNestaSessao) {
        agendaPerguntouNestaSessao = true;
        showConfirmModal({ title: 'Quais avisos você quer receber?', message: 'Escolha o que deve avisar: entregas, reuniões, lembretes, NFs vencendo, ocorrências em aberto e pedidos parados. Dá para mudar quando quiser.', confirmText: 'Escolher agora', confirmClass: 'success',
            onConfirm: () => { agendaPrefsAberto = true; renderAgenda(); const c = document.getElementById('ag-prefs'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
    }
}
function agendaMudarAba(a) { agendaAba = a; renderAgenda(); }
function agendaAlternarPrefs() { agendaPrefsAberto = !agendaPrefsAberto; renderAgenda(); }

function agendaCartao(o) {
    const it = o.item, p = escA(it.id), c = escA(o.campo);
    const rot = { atrasada: ['err', 'Passou da janela'], agora: ['', o.de === dataLocalISO() ? 'Hoje' : 'Em andamento'], vespera: ['m', 'Amanhã'], futura: ['m', ''], feita: ['ok', it.tipo === 'entrega' ? 'Entregue' : 'Concluído'], passou: ['m', 'Passou'] }[o.estado];
    const sub = [it.empresa, agQuando(o), AGENDA_REPETE[it.rep] && it.rep !== 'n' ? AGENDA_REPETE[it.rep].toLowerCase() : ''].filter(Boolean).join(' · ');
    const feitaTxt = o.feita ? `<div class="xml-item-meta">${it.tipo === 'entrega' ? 'Entregue' : 'Concluído'} em ${agFmt(o.feita.em || o.de, true)}</div>` : '';
    const marcando = agendaMarcando && agendaMarcando.id === it.id && agendaMarcando.campo === o.campo;
    const acoes = [];
    if (o.feita) acoes.push(`<button type="button" class="central-status-toggle" onclick="agendaDesfazerFeita('${p}','${c}')">Desfazer</button>`);
    else if (marcando) acoes.push(`<label class="xml-item-meta">${it.tipo === 'entrega' ? 'Entregue em' : 'Concluído em'} <input type="date" class="form-field ag-data" id="ag-feita-em" value="${dataLocalISO()}"></label><button type="button" class="central-status-toggle" onclick="agendaConfirmarFeita()">Salvar</button><button type="button" class="central-status-toggle" onclick="agendaMarcando=null;renderAgenda()">Cancelar</button>`);
    else acoes.push(`<button type="button" class="central-status-toggle" onclick="agendaMarcarFeita('${p}','${c}')">${it.tipo === 'entrega' ? 'Marcar como entregue' : 'Concluir'}</button>`);
    acoes.push(`<button type="button" class="central-status-toggle" onclick="agendaEditar('${p}')">Editar</button><button type="button" class="central-status-toggle is-danger" onclick="agendaExcluir('${p}')">Excluir</button>`);
    return `<div class="ctl-card ag-card"><div class="ctl-top"><div class="ctl-nm"><b>${escRel(it.titulo || AGENDA_TIPOS[it.tipo])}</b><small>${escRel(sub)}</small></div>${rot[1] ? `<span class="ctl-st ${rot[0]}">${rot[1]}</span>` : ''}</div>
        ${it.obs ? `<div class="aud-txt">${escRel(it.obs)}</div>` : ''}${feitaTxt}<div class="xml-item-acao">${acoes.join('')}</div></div>`;
}

function agendaFormHTML() {
    const f = agendaForm; if (!f) return '';
    const ehEnt = f.tipo === 'entrega', ehReu = f.tipo === 'reuniao';
    const opt = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${v}</option>`).join('');
    return `<div class="card ag-form"><div class="xml-item-meta"><b>${f.id ? 'Editar lembrete' : 'Novo lembrete'}</b></div>
        <label class="ag-lab">Tipo<select class="form-field" id="ag-tipo" onchange="agendaTrocarTipo(this.value)">${opt(AGENDA_TIPOS, f.tipo)}</select></label>
        <label class="ag-lab">Título<input type="text" class="form-field" id="ag-titulo" value="${escA(f.titulo)}" placeholder="${ehEnt ? 'Ex.: Entrega de reagentes' : ehReu ? 'Ex.: Reunião de compras' : 'Ex.: Conferir contrato'}"></label>
        <label class="ag-lab">${ehEnt ? 'Empresa' : ehReu ? 'Local ou com quem' : 'Detalhe'}<input type="text" class="form-field" id="ag-empresa" value="${escA(f.empresa)}"></label>
        <div class="ag-linha"><label class="ag-lab">${ehEnt || f.ate ? 'De' : 'Data'}<input type="date" class="form-field" id="ag-de" value="${escA(f.de)}"></label>
            <label class="ag-lab">${ehReu ? 'Hora' : 'Hora (opcional)'}<input type="time" class="form-field" id="ag-hora" value="${escA(f.hora)}"></label></div>
        ${ehReu ? '' : `<label class="ag-lab">Até (se for uma janela, opcional)<input type="date" class="form-field" id="ag-ate" value="${escA(f.ate)}"></label>`}
        <label class="ag-lab">Repetir<select class="form-field" id="ag-rep">${opt(AGENDA_REPETE, f.rep)}</select></label>
        <div class="ag-checks"><label><input type="checkbox" id="ag-vespera"${f.vespera ? ' checked' : ''}> Avisar na véspera</label><label><input type="checkbox" id="ag-dia"${f.dia ? ' checked' : ''}> Avisar no dia</label></div>
        <label class="ag-lab">Observação<textarea class="form-field" id="ag-obs" rows="2">${escRel(f.obs || '')}</textarea></label>
        <div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="agendaSalvarForm()">Salvar</button><button type="button" class="central-status-toggle" onclick="agendaFecharForm()">Cancelar</button></div></div>`;
}
function agendaLerForm() {
    const v = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    return { tipo: v('ag-tipo') || 'lembrete', titulo: v('ag-titulo'), empresa: v('ag-empresa'), de: v('ag-de'), ate: v('ag-ate'), hora: v('ag-hora'), rep: v('ag-rep') || 'n',
        vespera: !!(document.getElementById('ag-vespera') || {}).checked, dia: !!(document.getElementById('ag-dia') || {}).checked, obs: v('ag-obs') };
}
function agendaNovo(tipo) { agendaForm = { tipo: tipo || 'lembrete', titulo: '', empresa: '', de: dataLocalISO(), ate: '', hora: '', rep: 'n', vespera: true, dia: true, obs: '' }; renderAgenda(); const f = document.querySelector('.ag-form'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function agendaEditar(id) { const it = listaAgenda[id]; if (!it) return; agendaForm = { id, tipo: it.tipo || 'lembrete', titulo: it.titulo || '', empresa: it.empresa || '', de: it.de || '', ate: it.ate || '', hora: it.hora || '', rep: it.rep || 'n', vespera: it.vespera !== false, dia: it.dia !== false, obs: it.obs || '' }; renderAgenda(); const f = document.querySelector('.ag-form'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function agendaTrocarTipo(t) { agendaForm = { ...agendaLerForm(), id: agendaForm && agendaForm.id, tipo: t }; renderAgenda(); }
function agendaFecharForm() { agendaForm = null; renderAgenda(); }
async function agendaSalvarForm() {
    const f = agendaLerForm(); const idAtual = agendaForm && agendaForm.id;
    if (!f.de) return toast('✕ Escolha a data.');
    if (f.tipo === 'reuniao' && !f.hora) return toast('✕ Informe a hora da reunião.');
    if (f.ate && f.ate < f.de) return toast('✕ A data final não pode ser antes da inicial.');
    if (!f.titulo) f.titulo = AGENDA_TIPOS[f.tipo];
    const id = idAtual || ('a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
    const antigo = listaAgenda[id] || {};
    const dados = { id, tipo: f.tipo, titulo: f.titulo, empresa: f.empresa, de: f.de, ate: f.tipo === 'reuniao' ? '' : f.ate, hora: f.hora, rep: f.rep, vespera: f.vespera, dia: f.dia, obs: f.obs, origem: antigo.origem || 'manual', atualizadoEm: new Date().toISOString() };
    if (await agendaGravar(id, dados)) { agendaForm = null; toast('✓ Lembrete salvo.'); }
}
function agendaMarcarFeita(id, campo) { agendaMarcando = { id, campo }; renderAgenda(); }
async function agendaConfirmarFeita() {
    const m = agendaMarcando; if (!m) return;
    const em = (document.getElementById('ag-feita-em') || {}).value || dataLocalISO();
    if (await agendaGravar(m.id, { feitas: { [m.campo]: { em } } })) { agendaMarcando = null; toast('✓ Registrado.'); }
}
async function agendaDesfazerFeita(id, campo) { if (await agendaApagarCampo(`itens.${id}.feitas.${campo}`)) toast('✓ Voltou para pendente.'); }
function agendaExcluir(id) {
    const it = listaAgenda[id]; if (!it) return;
    showConfirmModal({ title: 'Excluir lembrete?', message: `"${it.titulo || AGENDA_TIPOS[it.tipo]}"${it.rep && it.rep !== 'n' ? ' e todas as repetições dele' : ''} sairá da agenda.`, confirmText: 'Excluir', confirmClass: 'danger',
        onConfirm: async () => { if (await agendaApagarCampo('itens.' + id)) toast('✓ Lembrete excluído.'); } });
}

// ---------------- calendário de entregas 2026 (carregado com um toque; cada data vira um lembrete que dá para editar) ----------------
const AGENDA_CALENDARIO_2026 = (() => {
    const expansao = [['2026-06-26', '2026-07-03'], ['2026-07-24', '2026-07-31'], ['2026-08-21', '2026-08-28'], ['2026-09-18', '2026-09-25'], ['2026-10-16', '2026-10-23'], ['2026-11-13', '2026-11-20'], ['2026-12-11', '2026-12-18'], ['2027-01-08', '2027-01-15']];
    const centervida = ['2026-07-17', '2026-08-14', '2026-09-11', '2026-10-09', '2026-11-06', '2026-12-04'];
    return [
        ...expansao.map(([de, ate], i) => ({ id: 'cal26exp' + (i + 1), tipo: 'entrega', titulo: 'Entrega de reagentes', empresa: 'Expansão', de, ate, hora: '', rep: 'n', vespera: true, dia: true, obs: 'Janela de entrega do calendário 2026.', origem: 'calendario-2026' })),
        ...centervida.map((de, i) => ({ id: 'cal26cen' + (i + 1), tipo: 'entrega', titulo: 'Entrega de controle', empresa: 'Centervida', de, ate: '', hora: '', rep: 'n', vespera: true, dia: true, obs: 'Data do calendário 2026.', origem: 'calendario-2026' }))
    ];
})();
async function agendaCarregarCalendario() {
    const hoje = dataLocalISO(), novos = AGENDA_CALENDARIO_2026.filter(x => !listaAgenda[x.id] && (x.ate || x.de) >= hoje); // o que já passou não entra (senão apareceria como atrasado)
    if (!novos.length) return toast('O calendário já está carregado.');
    const itens = {}; novos.forEach(x => { itens[x.id] = { ...x, atualizadoEm: new Date().toISOString() }; });
    try { await agendaDocRef().set({ itens }, { merge: true }); toast(`✓ ${novos.length} entregas carregadas.`); }
    catch (e) { erroFirebase('Erro ao carregar o calendário:', e); toast('✕ Não consegui carregar o calendário.'); }
}

// ---------------- escolha de avisos ----------------
function agendaAvisosAtuais() { const p = prefsAvisos || {}; const r = {}; AGENDA_AVISOS.forEach(([k]) => { r[k] = p[k] !== false; }); return r; }
async function agendaSalvarAvisos() {
    const novo = { definido: true }; AGENDA_AVISOS.forEach(([k]) => { novo[k] = !!(document.getElementById('ag-av-' + k) || {}).checked; });
    try { await prefsUsuarioDocRef().set({ avisos: novo }, { merge: true }); prefsAvisos = novo; agendaPrefsAberto = false; if (typeof pushSincronizarAvisos === 'function') pushSincronizarAvisos(); renderAgenda(); toast('✓ Escolha salva.'); }
    catch (e) { erroFirebase('Erro ao salvar a escolha de avisos:', e); toast('✕ Não consegui salvar a escolha.'); }
}
function agendaPrefsHTML() {
    const at = agendaAvisosAtuais(), definido = !!(prefsAvisos && prefsAvisos.definido);
    const resumo = AGENDA_AVISOS.filter(([k]) => at[k]).map(([, t]) => t).join(', ') || 'nenhum';
    if (!agendaPrefsAberto) return `<div class="card" id="ag-prefs"><div class="xml-item-meta"><b>Avisos que você quer receber</b><br>${definido ? escRel(resumo) : 'Você ainda não escolheu.'}</div><div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="agendaAlternarPrefs()">${definido ? 'Mudar' : 'Escolher'}</button></div></div>`;
    return `<div class="card" id="ag-prefs"><div class="xml-item-meta"><b>Quais avisos você quer receber?</b><br>Isso vale para as notificações no iPhone. A Central de notificações do app continua mostrando tudo.</div>
        <div class="ag-checks ag-avisos">${AGENDA_AVISOS.map(([k, t, d]) => `<label><input type="checkbox" id="ag-av-${k}"${at[k] ? ' checked' : ''}><span><b>${t}</b><small>${d}</small></span></label>`).join('')}</div>
        <div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="agendaSalvarAvisos()">Salvar escolha</button>${definido ? '<button type="button" class="central-status-toggle" onclick="agendaAlternarPrefs()">Cancelar</button>' : ''}</div></div>`;
}

// ---------------- render ----------------
function renderAgenda() {
    const el = document.getElementById('agenda-conteudo'); if (!el) return;
    const hoje = dataLocalISO();
    const chips = `<div class="retro-chips">${[['proximos', 'Próximos'], ['historico', 'Histórico']].map(([k, t]) => `<button type="button" class="retro-chip${agendaAba === k ? ' on' : ''}" onclick="agendaMudarAba('${k}')">${t}</button>`).join('')}</div>`;
    const novos = `<div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="agendaNovo('entrega')">+ Entrega</button><button type="button" class="central-status-toggle" onclick="agendaNovo('reuniao')">+ Reunião</button><button type="button" class="central-status-toggle" onclick="agendaNovo('lembrete')">+ Lembrete</button></div>`;
    const calendario = (!Object.values(listaAgenda).some(x => x && x.origem === 'calendario-2026')) ? `<div class="card"><div class="xml-item-meta"><b>Calendário de entregas 2026</b><br>Carrega de uma vez as janelas da Expansão (reagentes) e as datas da Centervida (controle). Cada uma vira um lembrete que você pode editar.</div><div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="agendaCarregarCalendario()">Carregar calendário</button></div></div>` : '';
    let corpo = '';
    if (agendaAba === 'historico') {
        const l = agLista(120, 0).filter(o => o.estado === 'feita' || o.estado === 'passou').reverse();
        corpo = l.length ? l.map(agendaCartao).join('') : '<div class="card"><div class="xml-item-meta">Nada concluído nos últimos 4 meses.</div></div>';
    } else {
        const l = agLista(60, 400).filter(o => o.estado !== 'feita' && o.estado !== 'passou');
        const sec = (titulo, arr) => arr.length ? `<div class="central-secao-titulo">${titulo}</div>` + arr.map(agendaCartao).join('') : '';
        const limite30 = agAdd(hoje, 30);
        corpo = sec('Passaram da janela sem marcar', l.filter(o => o.estado === 'atrasada'))
            + sec('Hoje e em andamento', l.filter(o => o.estado === 'agora'))
            + sec('Amanhã', l.filter(o => o.estado === 'vespera'))
            + sec('Próximos 30 dias', l.filter(o => o.estado === 'futura' && o.de <= limite30))
            + sec('Mais adiante', l.filter(o => o.estado === 'futura' && o.de > limite30).slice(0, 20));
        if (!corpo) corpo = '<div class="card"><div class="xml-item-meta">Nenhum lembrete pela frente. Use os botões acima para cadastrar.</div></div>';
    }
    el.innerHTML = agendaPrefsHTML() + (typeof pushCartaoHTML === 'function' ? pushCartaoHTML() : '') + (agendaForm ? agendaFormHTML() : novos) + calendario + chips + corpo;
}

// ---------------- Central de notificações (só leitura) ----------------
function agendaGruposAtencao() {
    const l = agLista(60, 2).filter(o => o.estado === 'atrasada' || o.estado === 'agora' || o.estado === 'vespera');
    const fn = "switchToScreen('screen-agenda','Agenda de trabalho'); prepararAgenda()";
    const linha = o => ({ pedido: '', forn: o.item.empresa || '', t: `${o.item.titulo || AGENDA_TIPOS[o.item.tipo]}${o.item.empresa ? ' · ' + o.item.empresa : ''}`, s: agQuando(o), fn });
    const g = [];
    const atras = l.filter(o => o.estado === 'atrasada'), agora = l.filter(o => o.estado === 'agora'), vesp = l.filter(o => o.estado === 'vespera');
    if (atras.length) g.push({ nivel: 'alta', id: 'agenda-atrasada', titulo: 'Entregas que passaram da janela sem marcar', dica: 'Marque como entregue na Agenda, com o dia em que chegou, ou ajuste a data.', linhas: atras.map(linha) });
    if (agora.length) g.push({ nivel: 'alta', id: 'agenda-hoje', titulo: 'Na agenda hoje', dica: 'Entregas na janela, reuniões e lembretes de hoje.', linhas: agora.map(linha) });
    if (vesp.length) g.push({ nivel: 'media', id: 'agenda-amanha', titulo: 'Amanhã na agenda', dica: 'Começa amanhã.', linhas: vesp.map(linha) });
    return g;
}

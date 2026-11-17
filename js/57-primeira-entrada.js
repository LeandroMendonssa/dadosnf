// 57-primeira-entrada.js — Primeira entrada (apresentação + cadastro da assinatura), dados padrão da instituição e perfis/permissões (2.53.0)
// Parte do script do app. Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// 1) Primeira entrada: tela cheia com nome, função, assinatura dos relatórios e um tour curto. Aparece uma vez por conta
//    (quem já tem assinatura preenchida é marcado como "feito" sem ver nada). Pode ser revista em Ajuda.
// 2) Dados padrão da instituição (telefone, site, endereço, ramal e e-mail por função): documento config/instituicao,
//    editável só pela conta mestre. Se o documento não existir (ou não puder ser lido), valem os padrões abaixo.
// 3) Perfis e permissões: a conta mestre define, em Aprovações de Acesso, o que cada pessoa pode alterar
//    (acessosAutorizados/{uid}.permissoes). Sem o campo = tudo liberado (contas antigas continuam como estão).
//    O app bloqueia as ações pelo lado de cá; para valer também no servidor, veja regras-firestore-sugeridas.txt.
// ===================================================================

const INST_PADRAO = {
    telefone: '(37) 3359-7230',
    site: 'www.santacasaarcos.org.br',
    endereco: 'Rua Getulio Vargas, 118, Centro – Arcos/MG',
    funcoes: {
        almox: { nome: 'Almoxarifado', ramal: '249', email: 'almoxarifado@santacasaarcos.org.br' },
        compras: { nome: 'Compras', ramal: '212', email: 'convenio@santacasaarcos.org.br' }
    }
};
let instAtual = JSON.parse(JSON.stringify(INST_PADRAO));
function onbEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function instCarregar() {
    try {
        const d = await firestore.collection('config').doc('instituicao').get();
        if (d.exists) {
            const v = d.data() || {};
            instAtual = {
                telefone: v.telefone || INST_PADRAO.telefone, site: v.site || INST_PADRAO.site, endereco: v.endereco || INST_PADRAO.endereco,
                funcoes: {
                    almox: { ...INST_PADRAO.funcoes.almox, ...((v.funcoes || {}).almox || {}) },
                    compras: { ...INST_PADRAO.funcoes.compras, ...((v.funcoes || {}).compras || {}) }
                }
            };
        }
    } catch (e) { /* sem leitura: ficam os padrões */ }
    return instAtual;
}
function instTelefoneComRamal(ramal) { return instAtual.telefone + (ramal ? ' (Ramal ' + ramal + ')' : ''); }
function instDadosFuncao(chave, extra) {
    const f = instAtual.funcoes[chave];
    if (f) return { cargo: f.nome, email: f.email || '', telefone: instTelefoneComRamal(f.ramal), site: instAtual.site, endereco: instAtual.endereco };
    const e = extra || {};
    return { cargo: e.nome || '', email: e.email || '', telefone: instTelefoneComRamal(e.ramal || ''), site: instAtual.site, endereco: instAtual.endereco };
}
function instChavePorCargo(cargo) {
    const c = String(cargo || '').trim().toLowerCase();
    return Object.keys(instAtual.funcoes).find(k => instAtual.funcoes[k].nome.toLowerCase() === c) || null;
}

// ---------- permissões ----------
const PERM_ACOES = [
    ['entrada', 'Dar entrada em NF', 'Carregar XML e salvar a nota'],
    ['cotacoes', 'Editar cotações', 'Marcar chegada, cancelar entrega, anotar itens'],
    ['arquivar', 'Arquivar e enviar ao financeiro', 'Repasse de NF e Controle de NFs'],
    ['apagar', 'Apagar registros', 'NFs, anotações, observações, apelidos'],
    ['ajustes', 'Mudar ajustes compartilhados', 'Logo, observações e dados da instituição']
];
const PERM_PERFIS = {
    almox: { nome: 'Almoxarifado', p: { entrada: true, cotacoes: true, arquivar: true, apagar: false, ajustes: false } },
    compras: { nome: 'Compras', p: { entrada: false, cotacoes: true, arquivar: true, apagar: false, ajustes: false } },
    leitura: { nome: 'Somente leitura', p: { entrada: false, cotacoes: false, arquivar: false, apagar: false, ajustes: false } },
    total: { nome: 'Acesso total', p: { entrada: true, cotacoes: true, arquivar: true, apagar: true, ajustes: true } }
};
let permissoesUsuario = null; // null = tudo liberado
function podeFazer(chave) {
    try { if (isContaAdmin(auth.currentUser)) return true; } catch (e) { /* sem usuário */ }
    if (!permissoesUsuario) return true;
    return permissoesUsuario[chave] !== false;
}
const PERM_FUNCOES_GUARDADAS = {
    entrada: ['salvarEntradaNF', 'salvarNfProcessada', 'salvarNota'],
    cotacoes: ['alterarChegadaFornecedorCotacao', 'marcarTodosChegaramCotacao', 'cancelarEntregaPedidoCotacao', 'gravarMarcaItemCotacao', 'salvarCabecalhoCotacaoCentral'],
    arquivar: ['arquivarNotaIndividual', 'arquivarItemControle', 'enviarNfAoFinanceiro', 'enviarNfParaRelacao'],
    apagar: ['deletarNota', 'excluirAnotacaoRapida', 'excluirAnotacaoAtual', 'deletarObservacao', 'deletarApelidoFornecedor', 'removerPedidoDaNf'],
    ajustes: ['removerLogo', 'handleLogoUpload', 'adicionarObservacaoManage', 'instSalvarAdmin']
};
const PERM_ROTULO = { entrada: 'dar entrada em NF', cotacoes: 'editar cotações', arquivar: 'arquivar ou enviar ao financeiro', apagar: 'apagar registros', ajustes: 'mudar ajustes compartilhados' };
(function guardarFuncoes() {
    Object.keys(PERM_FUNCOES_GUARDADAS).forEach(chave => PERM_FUNCOES_GUARDADAS[chave].forEach(nome => {
        const orig = window[nome]; if (typeof orig !== 'function' || orig.__guardada) return;
        const g = function (...args) {
            if (!podeFazer(chave)) { toast('Sua conta não tem permissão para ' + PERM_ROTULO[chave] + '. Fale com o administrador.'); return; }
            return orig.apply(this, args);
        };
        g.__guardada = true; window[nome] = g;
    }));
})();
let unsubPermissoes = null;
function permissoesIniciar(user) {
    if (unsubPermissoes) { unsubPermissoes(); unsubPermissoes = null; }
    permissoesUsuario = null;
    if (!user || isContaAdmin(user)) return;
    try {
        unsubPermissoes = firestore.collection('acessosAutorizados').doc(user.uid).onSnapshot(d => {
            const v = d.exists ? d.data() : null;
            permissoesUsuario = v && v.permissoes && typeof v.permissoes === 'object' ? v.permissoes : null;
        }, () => { permissoesUsuario = null; });
    } catch (e) { permissoesUsuario = null; }
}

// ---------- Aprovações de Acesso (conta mestre): perfil e permissões por pessoa ----------
const apvCache = {}; const apvAbertos = new Set(); let apvVistos = null;
function renderListaAprovacoes(lista) {
    const container = document.getElementById('lista-aprovacoes'); if (!container) return;
    lista.forEach(i => { apvCache[i.id] = i; });
    const pend = lista.filter(i => i.aprovado !== true);
    if (apvVistos) { const novos = pend.filter(i => !apvVistos.has(i.id)); if (novos.length) toast('Novo pedido de acesso: ' + (novos[0].nome || novos[0].email || novos[0].telefone || 'pessoa nova')); }
    apvVistos = new Set(pend.map(i => i.id));
    const a = document.querySelector('#menu-aprovacoes a');
    if (a) { let b = a.querySelector('.apv-badge'); if (pend.length) { if (!b) { b = document.createElement('span'); b.className = 'apv-badge'; const ch = a.querySelector('.fa-chevron-right'); a.insertBefore(b, ch); } b.textContent = pend.length; } else if (b) b.remove(); }
    if (!lista.length) { container.innerHTML = '<li class="empty-state">Nenhum pedido de acesso ainda.</li>'; return; }
    container.innerHTML = lista.map(item => {
        const ident = onbEsc(item.email || item.telefone || item.id), aprovado = item.aprovado === true;
        const mestre = !!item.email && ADMIN_EMAILS.includes(String(item.email).toLowerCase());
        const perms = item.permissoes || null;
        const perfilNome = mestre ? 'Conta mestre' : (item.perfil && PERM_PERFIS[item.perfil] ? PERM_PERFIS[item.perfil].nome : (perms ? 'Personalizado' : 'Acesso total'));
        const aberto = apvAbertos.has(item.id) && !mestre;
        const painel = aberto ? `<div class="apv-painel">
            <div class="apv-chips">${Object.keys(PERM_PERFIS).map(k => `<button type="button" class="apv-chip${item.perfil === k ? ' on' : ''}" onclick="apvPerfil('${item.id}','${k}')">${PERM_PERFIS[k].nome}</button>`).join('')}</div>
            ${PERM_ACOES.map(([k, t, s]) => `<div class="apv-perm"><div><b>${t}</b><small>${s}</small></div><button type="button" class="apv-sw${!perms || perms[k] !== false ? ' on' : ''}" aria-label="${t}" onclick="apvPerm('${item.id}','${k}')"></button></div>`).join('')}
            <p class="apv-nota">Vale para o app a partir da próxima abertura da pessoa. Conta sem perfil definido tem acesso total.</p></div>` : '';
        return `<li class="approval-item apv-li"><div class="apv-row">
            <div class="approval-item-info"><div class="approval-item-email">${ident}</div>
            <div class="approval-item-status${aprovado ? ' aprovado' : ''}">${aprovado ? '✓ Aprovado' : 'Pendente'}${item.nome ? ' · ' + onbEsc(item.nome) : ''}${item.funcao ? ' · ' + onbEsc(item.funcao) : ''}${String(item.funcao || '').toLowerCase() === perfilNome.toLowerCase() ? '' : ' · ' + onbEsc(perfilNome)}</div></div>
            <div class="apv-btns">${mestre ? '' : `<button class="action-chip" onclick="apvAlternarPainel('${item.id}')">${aberto ? 'Fechar' : 'Permissões'}</button>`}<button class="action-chip ${aprovado ? 'delete-chip' : 'edit-chip'}" onclick="alternarAprovacaoAcesso('${item.id}', ${!aprovado})">${aprovado ? 'Revogar' : 'Aprovar'}</button></div></div>${painel}</li>`;
    }).join('');
}
function apvAlternarPainel(id) { if (apvAbertos.has(id)) apvAbertos.delete(id); else apvAbertos.add(id); renderListaAprovacoes(Object.values(apvCache).sort((a, b) => ((b.criadoEm && b.criadoEm.seconds) || 0) - ((a.criadoEm && a.criadoEm.seconds) || 0))); }
function apvGravar(id, perfil, permissoes) {
    apvCache[id] = { ...(apvCache[id] || {}), perfil, permissoes };
    firestore.collection('acessosAutorizados').doc(id).update({ perfil, permissoes }).then(() => toast('✓ Permissões salvas.')).catch(() => toast('✕ Não foi possível salvar as permissões.'));
}
function apvPerfil(id, k) { apvGravar(id, k, { ...PERM_PERFIS[k].p }); }
function apvPerm(id, k) {
    const atual = (apvCache[id] && apvCache[id].permissoes) || {}, novo = {};
    PERM_ACOES.forEach(([c]) => { novo[c] = atual[c] !== false; });
    novo[k] = !novo[k];
    const igual = Object.keys(PERM_PERFIS).find(p => PERM_ACOES.every(([c]) => PERM_PERFIS[p].p[c] === novo[c]));
    apvGravar(id, igual || 'personalizado', novo);
}

// ---------- tela Assinatura dos relatórios: dados padrão da instituição ----------
function onbMontarCartoesAssinatura() {
    const tela = document.getElementById('screen-pz-assinatura'); if (!tela) return;
    let c = document.getElementById('assin-extra'); if (!c) { c = document.createElement('div'); c.id = 'assin-extra'; tela.appendChild(c); }
    const admin = (() => { try { return isContaAdmin(auth.currentUser); } catch (e) { return false; } })();
    const f = instAtual.funcoes;
    c.innerHTML = `<div class="card"><h3 class="card-titulo card-titulo-sm">Dados padrão da instituição</h3>
        <p class="onb-peq">Telefone, site e endereço são os mesmos para todos; o ramal e o e-mail vêm da função. Os campos acima continuam editáveis.</p>
        <div class="actions-row" style="gap:8px;flex-wrap:wrap;">
          <button class="actions-button" type="button" onclick="onbAplicarPadraoNaTela()"><span class="icon-wrapper"><i class="fa-solid fa-building"></i></span> Usar dados padrão</button>
          <button class="actions-button" type="button" onclick="onbAbrir('tudo')"><span class="icon-wrapper"><i class="fa-solid fa-wand-magic-sparkles"></i></span> Refazer a primeira entrada</button>
        </div></div>`
        + (admin ? `<div class="card"><h3 class="card-titulo card-titulo-sm">Dados da instituição (conta mestre)</h3>
        <p class="onb-peq">Vale para todas as pessoas que fizerem a primeira entrada daqui para frente. Quem já tem assinatura não muda sozinho.</p>
        <div class="campo"><label>Telefone (sem ramal)</label><input type="text" id="inst-tel" class="form-field" value="${onbEsc(instAtual.telefone)}"></div>
        <div class="campo"><label>Site</label><input type="text" id="inst-site" class="form-field" value="${onbEsc(instAtual.site)}"></div>
        <div class="campo"><label>Endereço</label><input type="text" id="inst-end" class="form-field" value="${onbEsc(instAtual.endereco)}"></div>
        <div class="campo"><label>Almoxarifado: ramal e e-mail</label><div class="onb-dupla"><input type="text" id="inst-almox-ramal" class="form-field" inputmode="numeric" value="${onbEsc(f.almox.ramal)}"><input type="text" id="inst-almox-email" class="form-field" inputmode="email" value="${onbEsc(f.almox.email)}"></div></div>
        <div class="campo"><label>Compras: ramal e e-mail</label><div class="onb-dupla"><input type="text" id="inst-compras-ramal" class="form-field" inputmode="numeric" value="${onbEsc(f.compras.ramal)}"><input type="text" id="inst-compras-email" class="form-field" inputmode="email" value="${onbEsc(f.compras.email)}"></div></div>
        <button class="actions-button is-primary" type="button" onclick="instSalvarAdmin()"><span class="icon-wrapper"><i class="fa-solid fa-floppy-disk"></i></span> Salvar dados da instituição</button></div>` : '');
}
async function instSalvarAdmin() {
    const v = id => (document.getElementById(id) || {}).value || '';
    const d = { telefone: v('inst-tel').trim(), site: v('inst-site').trim(), endereco: v('inst-end').trim(),
        funcoes: { almox: { nome: 'Almoxarifado', ramal: v('inst-almox-ramal').trim(), email: v('inst-almox-email').trim() }, compras: { nome: 'Compras', ramal: v('inst-compras-ramal').trim(), email: v('inst-compras-email').trim() } } };
    try { await firestore.collection('config').doc('instituicao').set(d); instAtual = d; toast('✓ Dados da instituição salvos.'); }
    catch (e) { console.error('Dados da instituição:', e); toast('✕ Não foi possível salvar (permissão do Firebase?).'); }
}
function onbAplicarPadraoNaTela() {
    const cargoEl = document.getElementById('assin-cargo'), k = instChavePorCargo(cargoEl && cargoEl.value);
    const ramalAtual = (((document.getElementById('assin-telefone') || {}).value || '').match(/ramal\s*(\d+)/i) || [])[1] || '';
    const d = instDadosFuncao(k, { nome: cargoEl ? cargoEl.value : '', ramal: ramalAtual });
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set('assin-telefone', d.telefone); set('assin-site', d.site); set('assin-endereco', d.endereco);
    if (k && !((document.getElementById('assin-email') || {}).value || '').trim()) set('assin-email', d.email);
    if (typeof assinaturaSalvarCampos === 'function') assinaturaSalvarCampos();
    toast('✓ Dados padrão aplicados.');
}
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-screen="screen-pz-assinatura"]'); if (a) setTimeout(onbMontarCartoesAssinatura, 80); });

// ---------- primeira entrada ----------
const ONB_TOUR = [
    { t: 'Entrada de NF', d: 'Carregue o XML e o app confere a nota com a cotação: quantidades, valores e recurso, sem digitar nada.', svg: '<path d="M6 2.5h8l5 5V21.5H6z"/><path d="M14 2.5V8h5M9 14h6M12.5 11.5 15 14l-2.5 2.5"/>' },
    { t: 'Cotações', d: 'Acompanhe cada pedido por fornecedor: o que chegou, o que falta e quem não entregou.', svg: '<path d="M6 2.5h8l5 5V21.5H6z"/><path d="M14 2.5V8h5M8.5 17c1.5-3 2.5 1 3.5-1s1.5 0 3-1"/>' },
    { t: 'Controle de NFs', d: 'Todas as notas num lugar só, com vencimentos e a situação de cada uma.', svg: '<path d="M3 7V5h6l2 2h8v3M3 7v12h15l3-9H6l-3 9"/>' },
    { t: 'Repasse de NF', d: 'Monte a relação de notas para o financeiro e exporte o texto pronto para enviar.', svg: '<path d="M4 8h15l-3-3M20 16H5l3 3"/>' },
    { t: 'Assistente de consultas', d: 'Tire dúvidas rápidas sobre o app a qualquer hora, pelo ícone de conversa no topo. Ainda está em desenvolvimento: às vezes a resposta pode falhar.', svg: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>', tag: 'Em desenvolvimento' },
    { t: 'Auditoria', d: 'Divergências encontradas, relatadas e resolvidas, com relatórios prontos em PDF e Word.', svg: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M8 12.5v-2M10.5 12.5v-4M13 12.5v-3"/>' }
];
const ONB_SEQ = [0, 1, 2, 3, 4, 5];
let onb = null;
function onbPartes(nomeCompleto) { const p = String(nomeCompleto || '').trim().split(/\s+/); return { nome: p[0] || '', sobre: p.slice(1).join(' ') }; }
function onbRascunhoChave() { try { return 'onb_rasc_' + auth.currentUser.uid; } catch (e) { return 'onb_rasc'; } }
function onbSalvarRascunho() { try { if (onb && onb.modo === 'tudo') localStorage.setItem(onbRascunhoChave(), JSON.stringify({ ...onb, k: onb.k })); } catch (e) { /* sem armazenamento */ } }
async function onbAbrir(modo) {
    await instCarregar();
    const u = auth.currentUser || {}, a = ((appConfig.personalizacao || {}).assinatura) || {};
    let r = null; try { r = modo === 'tudo' ? JSON.parse(localStorage.getItem(onbRascunhoChave()) || 'null') : null; } catch (e) { r = null; }
    const base = onbPartes(a.nome || u.displayName || '');
    onb = r && r.modo === 'tudo' ? { ...r } : {
        modo: modo || 'tudo', k: modo === 'tour' ? 4 : 0, nome: base.nome, sobre: base.sobre, func: instChavePorCargo(a.cargo) || (a.cargo ? 'outra' : null),
        outraNome: instChavePorCargo(a.cargo) ? '' : (a.cargo || ''), outraRamal: '', outraEmail: '', cargo: a.cargo || '', email: a.email || '', fone: a.telefone || '', site: a.site || '', end: a.endereco || '', aberto: false, erro: ''
    };
    onb.modo = modo || 'tudo'; if (onb.modo === 'tour') onb.k = 4;
    let ov = document.getElementById('onb-root');
    if (!ov) { ov = document.createElement('div'); ov.id = 'onb-root'; document.body.appendChild(ov); }
    ov.style.display = 'flex'; document.body.classList.add('onb-aberto');
    onbRender();
}
function onbFechar() { const ov = document.getElementById('onb-root'); if (ov) { ov.style.display = 'none'; ov.innerHTML = ''; } document.body.classList.remove('onb-aberto'); onb = null; }
function onbNomeCompleto() { return ((onb.nome || '') + ' ' + (onb.sobre || '')).replace(/\s+/g, ' ').trim(); }
function onbLinhasAssinatura() {
    const m = [['fa-envelope', onb.email], ['fa-phone', onb.fone], ['fa-globe', onb.site], ['fa-location-dot', onb.end]].filter(x => (x[1] || '').trim());
    return m.length ? m.map(([i, t]) => `<div><i class="fa-solid ${i}"></i>${onbEsc(t)}</div>`).join('') : '<span class="onb-ph">—</span>';
}
function onbHtmlAssinatura() {
    const logo = (appConfig.personalizacao || {}).logoBase64;
    return `<div class="onb-sig"><div class="onb-sig-row"><div class="onb-logo">${logo ? `<img src="${onbEsc(logo)}" alt="Logo da instituição">` : 'Logo'}</div><div class="onb-sep"></div><div class="onb-sig-txt"><div class="onb-sn">${onbEsc(onbNomeCompleto()) || '<span class="onb-ph">Seu nome</span>'}</div><div class="onb-sc">${onbEsc(onb.cargo)}</div><div class="onb-sl">${onbLinhasAssinatura()}</div></div></div></div>`;
}
function onbRotuloBotao() { return ['Começar', 'Continuar', 'Continuar', 'Parece certo', onb.modo === 'tour' ? 'Entendi' : 'Continuar', 'Concluir e abrir o app'][onb.k]; }
function onbBotaoOk() {
    if (onb.k === 1) return !!(onb.nome.trim() && onb.sobre.trim());
    if (onb.k === 2) return !!onb.func && (onb.func !== 'outra' || !!onb.outraNome.trim());
    return true;
}
function onbRender() {
    const ov = document.getElementById('onb-root'); if (!ov || !onb) return;
    const k = onb.k, tour = onb.modo === 'tour';
    const dots = tour ? '' : ONB_SEQ.map(i => `<i class="${i < k ? 'f' : ''}"></i>`).join('');
    let corpo = '';
    if (k === 0) corpo = `<div class="onb-hero"><i class="fa-solid fa-clipboard-check"></i></div><h1>Bem-vindo(a) ao painel de auditoria</h1><p class="onb-l">Em menos de um minuto deixamos tudo com a sua cara: seu nome, a assinatura nos relatórios e um tour rápido pelo que o app faz.</p>`;
    if (k === 1) corpo = `<h2>Como podemos te chamar?</h2><p class="onb-l">Nome e sobrenome. Eles aparecem na saudação e na assinatura dos relatórios.</p>
        <div class="onb-f"><label>Nome</label><input id="onb-nome" autocomplete="given-name" autocapitalize="words" placeholder="Ex.: Maria" value="${onbEsc(onb.nome)}" oninput="onbCampo('nome',this.value)"></div>
        <div class="onb-f"><label>Sobrenome</label><input id="onb-sobre" autocomplete="family-name" autocapitalize="words" placeholder="Ex.: Souza" value="${onbEsc(onb.sobre)}" oninput="onbCampo('sobre',this.value)"></div>`;
    if (k === 2) {
        const fx = instAtual.funcoes;
        corpo = `<h2>${onb.nome.trim() ? onbEsc(onb.nome.trim()) + ', qual' : 'Qual'} é a sua função?</h2><p class="onb-l">Isso já preenche o ramal e o e-mail da assinatura. Você ajusta depois, se quiser.</p>
        <div class="onb-cards">
          <button type="button" class="onb-opt${onb.func === 'almox' ? ' on' : ''}" onclick="onbFuncao('almox')"><i class="fa-solid fa-boxes-stacked"></i><b>${onbEsc(fx.almox.nome)}</b><small>Ramal ${onbEsc(fx.almox.ramal)}</small></button>
          <button type="button" class="onb-opt${onb.func === 'compras' ? ' on' : ''}" onclick="onbFuncao('compras')"><i class="fa-solid fa-cart-shopping"></i><b>${onbEsc(fx.compras.nome)}</b><small>Ramal ${onbEsc(fx.compras.ramal)}<br>e-mail do convênio</small></button>
          <button type="button" class="onb-opt onb-opt-larga${onb.func === 'outra' ? ' on' : ''}" onclick="onbFuncao('outra')"><i class="fa-solid fa-user-tie"></i><b>Outra função</b><small>Informe o nome da função, o ramal e o e-mail</small></button>
        </div>
        ${onb.func === 'outra' ? `<div class="onb-f"><label>Nome da função ou setor</label><input id="onb-on" placeholder="Ex.: Farmácia" autocapitalize="words" value="${onbEsc(onb.outraNome)}" oninput="onbCampoOutra('outraNome',this.value)"></div>
        <div class="onb-dupla"><div class="onb-f"><label>Ramal</label><input inputmode="numeric" placeholder="Opcional" value="${onbEsc(onb.outraRamal)}" oninput="onbCampoOutra('outraRamal',this.value)"></div>
        <div class="onb-f"><label>E-mail</label><input inputmode="email" autocapitalize="off" placeholder="Opcional" value="${onbEsc(onb.outraEmail)}" oninput="onbCampoOutra('outraEmail',this.value)"></div></div>` : ''}`;
    }
    if (k === 3) corpo = `<h2>Sua assinatura nos relatórios</h2><p class="onb-l">Assim ela vai sair no fim dos PDFs e Word.</p><div id="onb-sig-box">${onbHtmlAssinatura()}</div><p class="onb-erro" id="onb-erro">${onbEsc(onb.erro)}</p>
        <details class="onb-det"${onb.aberto || onb.erro ? ' open' : ''} ontoggle="onb.aberto=this.open"><summary>Editar dados <i class="fa-solid fa-chevron-down"></i></summary>
        <div class="onb-f"><label>Função / setor</label><input value="${onbEsc(onb.cargo)}" oninput="onbCampo('cargo',this.value)"></div>
        <div class="onb-f"><label>E-mail</label><input inputmode="email" autocapitalize="off" value="${onbEsc(onb.email)}" oninput="onbCampo('email',this.value)"></div>
        <div class="onb-f"><label>Telefone (com ramal)</label><input inputmode="tel" value="${onbEsc(onb.fone)}" oninput="onbCampo('fone',this.value)"></div>
        <div class="onb-f"><label>Site</label><input autocapitalize="off" value="${onbEsc(onb.site)}" oninput="onbCampo('site',this.value)"></div>
        <div class="onb-f"><label>Endereço</label><input value="${onbEsc(onb.end)}" oninput="onbCampo('end',this.value)"></div></details>
        <p class="onb-peq">Telefone, site e endereço são padrão da instituição; o ramal e o e-mail vêm da sua função. Tudo pode ser editado.</p>`;
    if (k === 4) corpo = `<h2>O que o app faz por você</h2><p class="onb-l">Deslize para ver as principais áreas.</p>
        <div class="onb-tour" id="onb-tour" onscroll="onbTourPontos()">${ONB_TOUR.map(c => `<div class="onb-tc"><div class="onb-ic"><svg viewBox="0 0 24 24">${c.svg}</svg></div><b>${c.t}</b>${c.tag ? '<span class="onb-tag">' + c.tag + '</span>' : ''}<p>${c.d}</p></div>`).join('')}</div>
        <div class="onb-tdots" id="onb-tdots">${ONB_TOUR.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>`;
    if (k === 5) corpo = `<h2>Pronto, ${onbEsc(onb.nome.trim() || 'você')}!</h2><p class="onb-l">Confira o resumo e abra o app.</p>${onbHtmlAssinatura()}
        <div class="onb-nota">Seu Início já vem com os atalhos da sua função. Dúvidas? Toque no <b>?</b> no topo de qualquer tela. Esta apresentação fica na Ajuda.</div>`;
    ov.innerHTML = `<div class="onb-app"><div class="onb-top"><button type="button" class="onb-back${k > 0 && !tour ? ' on' : ''}" onclick="onbVoltar()" aria-label="Voltar"><i class="fa-solid fa-chevron-left"></i></button><div class="onb-dots">${dots}</div><button type="button" class="onb-skip" style="visibility:${tour ? 'visible' : (k === 4 ? 'visible' : 'hidden')}" onclick="${tour ? 'onbFechar()' : 'onbIr(5)'}">${tour ? 'Fechar' : 'Pular'}</button></div>
        <div class="onb-stage"><section class="onb-step">${corpo}</section></div>
        <div class="onb-foot"><button type="button" class="onb-btn" id="onb-go" onclick="onbAvancar()"${onbBotaoOk() ? '' : ' disabled'}>${onbRotuloBotao()}</button></div></div>`;
    if (k === 1) setTimeout(() => { const el = document.getElementById(onb.nome.trim() ? 'onb-sobre' : 'onb-nome'); if (el && !/iPhone|iPad/.test(navigator.userAgent)) el.focus(); }, 350);
}
function onbPonto() { const b = document.getElementById('onb-go'); if (b) b.disabled = !onbBotaoOk(); }
function onbCampo(c, v) {
    onb[c] = v; onb.erro = '';
    if (c === 'nome' || c === 'sobre') onbPonto();
    if (onb.k === 3) { const box = document.getElementById('onb-sig-box'); if (box) box.innerHTML = onbHtmlAssinatura(); const er = document.getElementById('onb-erro'); if (er) er.textContent = ''; }
    onbSalvarRascunho();
}
function onbCampoOutra(c, v) {
    onb[c] = v; onbPonto();
    const d = instDadosFuncao('outra', { nome: onb.outraNome, ramal: onb.outraRamal, email: onb.outraEmail });
    Object.assign(onb, { cargo: d.cargo, email: d.email, fone: d.telefone, site: d.site, end: d.endereco }); onbSalvarRascunho();
}
function onbFuncao(f) {
    onb.func = f;
    const d = instDadosFuncao(f, { nome: onb.outraNome, ramal: onb.outraRamal, email: onb.outraEmail });
    Object.assign(onb, { cargo: d.cargo, email: d.email, fone: d.telefone, site: d.site, end: d.endereco }); onbSalvarRascunho(); onbRender();
}
function onbIr(k) { onb.k = k; onb.erro = ''; onbSalvarRascunho(); onbRender(); }
function onbVoltar() { if (onb.k > 0) onbIr(onb.k - 1); }
function onbTourPontos() { const t = document.getElementById('onb-tour'), d = document.getElementById('onb-tdots'); if (!t || !d || !t.firstElementChild) return; const k = Math.round(t.scrollLeft / (t.firstElementChild.offsetWidth + 14)); [...d.children].forEach((x, j) => x.classList.toggle('on', j === k)); }
function onbValidar() {
    const em = (onb.email || '').trim(), dig = (onb.fone || '').replace(/\D/g, '');
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return 'Esse e-mail parece incompleto. Confira ou deixe o campo vazio.';
    if ((onb.fone || '').trim() && dig.length < 8) return 'O telefone parece curto demais. Confira ou deixe o campo vazio.';
    return '';
}
function onbAvancar() {
    if (!onb) return;
    if (onb.modo === 'tour') { onbFechar(); return; }
    if (!onbBotaoOk()) return;
    if (onb.k === 3) { const er = onbValidar(); if (er) { onb.erro = er; onb.aberto = true; onbRender(); return; } }
    if (onb.k === 5) { onbConcluir(); return; }
    onbIr(onb.k + 1);
}
function onbAtalhosDaFuncao(f) {
    if (f !== 'compras') return null; // Almoxarifado usa o padrão do app; "Outra" fica como a pessoa preferir
    const ids = ['screen-cotacoes', 'screen-controle-nfs', 'screen-manage', 'screen-anotacoes', 'resumo', 'screen-agenda'];
    try { const cat = iniCatalogo(); return ids.filter(i => cat[i]); } catch (e) { return ids; }
}
async function onbConcluir() {
    const nome = onbNomeCompleto(), ass = { nome, cargo: (onb.cargo || '').trim(), email: (onb.email || '').trim(), telefone: (onb.fone || '').trim(), site: (onb.site || '').trim(), endereco: (onb.end || '').trim() };
    const pers = appConfig.personalizacao = appConfig.personalizacao || {};
    pers.assinatura = ass; pers.onboardingFeito = { v: 1, em: new Date().toISOString(), funcao: ass.cargo };
    const at = onbAtalhosDaFuncao(onb.func); if (at && !Array.isArray(pers.atalhosInicio)) pers.atalhosInicio = at;
    try { salvarPersonalizacao(); } catch (e) { console.error('Primeira entrada:', e); }
    const u = auth.currentUser;
    try { localStorage.setItem('onb_feito_' + u.uid, '1'); localStorage.removeItem(onbRascunhoChave()); } catch (e) { /* sem armazenamento */ }
    if (u && !u.displayName && nome) { try { await u.updateProfile({ displayName: nome }); } catch (e) { /* enfeite */ } }
    try { await firestore.collection('acessosAutorizados').doc(u.uid).update({ nome, funcao: ass.cargo, cadastroEm: firebase.firestore.FieldValue.serverTimestamp() }); } catch (e) { /* conta antiga sem registro na lista */ }
    onbFechar();
    try { if (typeof renderInicio === 'function') renderInicio(); } catch (e) { /* início ainda não montado */ }
    toast('✓ Tudo certo!'); // o toast já acrescenta o primeiro nome (personalizarMensagem)
}

// quando mostrar: uma vez por conta, depois que o app abriu
async function onbDecidir(user) {
    try { if (localStorage.getItem('onb_feito_' + user.uid)) return; } catch (e) { /* segue */ }
    let p = null;
    try { const d = await firestore.collection('config').doc('prefs_' + user.uid).get(); p = (d.exists && d.data() && d.data().personalizacao) || {}; } catch (e) { p = null; }
    const temAss = o => !!(o && o.assinatura && (o.assinatura.nome || o.assinatura.cargo || o.assinatura.email));
    const marcarFeito = () => { try { localStorage.setItem('onb_feito_' + user.uid, '1'); } catch (e) { /* segue */ } };
    if (p && p.onboardingFeito) { marcarFeito(); return; }
    await new Promise(r => setTimeout(r, 1200)); // deixa a personalização compartilhada chegar
    if (temAss(p) || temAss(appConfig.personalizacao)) { marcarFeito(); return; } // já tinha preenchido a assinatura: não incomoda
    if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;
    onbAbrir('tudo');
}
function onbAgendar(user) {
    let n = 0;
    const t = setInterval(() => {
        n++; const ac = document.getElementById('app-container');
        if (!auth.currentUser || auth.currentUser.uid !== user.uid || n > 60) { clearInterval(t); return; }
        if (ac && ac.style.display === 'flex') { clearInterval(t); instCarregar().then(() => onbDecidir(user)); }
    }, 500);
}
// ---------- espera de aprovação (Google/telefone): fica na tela, entra sozinho quando a conta mestre aprovar ----------
let unsubEspera = null, esperaUid = null;
function esperaHtml(estado, user) {
    const ident = onbEsc(user.email || user.phoneNumber || user.displayName || '');
    if (estado === 'ok') return `<div class="esp-box"><div class="esp-ring ok"><i class="fa-solid fa-check"></i></div><h2>Acesso aprovado!</h2><p>Abrindo o app…</p></div>`;
    const podePush = typeof pushEstado !== 'undefined' && pushEstado.suporte && !pushEstado.ativo && pushEstado.permissao !== 'denied';
    return `<div class="esp-box"><div class="esp-ring"></div><h2>Aguardando aprovação</h2><p>Seu pedido foi enviado para a conta mestre. Esta tela abre o app sozinha assim que o acesso for liberado.</p>
        ${ident ? `<span class="esp-pill">${ident}</span>` : ''}
        ${podePush ? `<button type="button" class="actions-button" onclick="esperaAtivarPush()"><span class="icon-wrapper"><i class="fa-solid fa-bell"></i></span> Avisar no celular quando liberar</button>` : ''}
        <button type="button" class="actions-button is-ghost" onclick="esperaSair()">Sair</button></div>`;
}
function mostrarEsperaAprovacao(user) {
    try { mostrarLoaderApp(false); } catch (e) { /* loader opcional */ }
    let ov = document.getElementById('aprov-espera'); if (!ov) { ov = document.createElement('div'); ov.id = 'aprov-espera'; document.body.appendChild(ov); }
    ov.style.display = 'flex'; ov.innerHTML = esperaHtml('espera', user);
    if (unsubEspera && esperaUid === user.uid) { pushAvisarNovoPedido(user); return; }
    if (unsubEspera) unsubEspera();
    esperaUid = user.uid;
    unsubEspera = firestore.collection('acessosAutorizados').doc(user.uid).onSnapshot(d => {
        const v = d.exists ? d.data() : null;
        if (v && v.aprovado === true) {
            if (unsubEspera) { unsubEspera(); unsubEspera = null; }
            ov.innerHTML = esperaHtml('ok', user);
            setTimeout(() => location.reload(), 1300);
        }
    }, e => console.warn('Espera de aprovação:', e));
    pushAvisarNovoPedido(user);
}
function esperaFechar() { if (unsubEspera) { unsubEspera(); unsubEspera = null; } esperaUid = null; const ov = document.getElementById('aprov-espera'); if (ov) { ov.style.display = 'none'; ov.innerHTML = ''; } }
function esperaSair() { esperaFechar(); auth.signOut().catch(() => { }); }
async function esperaAtivarPush() {
    if (typeof pushAtivar !== 'function') return;
    await pushAtivar();
    const ov = document.getElementById('aprov-espera'), u = auth.currentUser;
    if (ov && u && unsubEspera) ov.innerHTML = esperaHtml('espera', u);
}

// ---------- avisos por push (o envio é feito pelo Worker de avisos, versão 2.53.0 ou mais nova) ----------
async function pushChamarWorker(caminho, corpo) {
    const t = await auth.currentUser.getIdToken();
    const r = await fetch(PUSH_URL + caminho, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) });
    return r.json().catch(() => ({}));
}
function pushAvisarNovoPedido(user) {   // a pessoa que pediu acesso avisa o Worker, que manda push às contas mestres
    // 2.55.1: cada vez que a pessoa entra e fica aguardando, vai um aviso novo (o Worker só evita repetição de 1 minuto)
    const k = 'ped_aviso_' + user.uid;
    try { const ult = Number(sessionStorage.getItem(k) || 0); if (Date.now() - ult < 60e3) return; sessionStorage.setItem(k, String(Date.now())); } catch (e) { /* sem armazenamento: o Worker também evita repetir */ }
    pushChamarWorker('/novo-pedido').catch(e => console.warn('Aviso de novo pedido:', e));
}
function pushAvisarAprovado(uid) {      // a conta mestre avisa o Worker, que manda push à pessoa aprovada (se ela ativou os avisos)
    pushChamarWorker('/aprovado', { uid }).catch(e => console.warn('Aviso de aprovação:', e));
}
function pushRegistrarEmailMestre(user) {   // o Worker precisa saber quais aparelhos são de contas mestres
    if (!user || !isContaAdmin(user)) return;
    setTimeout(() => { try { firestore.collection('config').doc('push_' + user.uid).set({ email: String(user.email).toLowerCase() }, { merge: true }).catch(() => { }); } catch (e) { /* sem push */ } }, 4000);
}

auth.onAuthStateChanged(user => { onbFechar(); permissoesIniciar(user); try { document.body.classList.toggle('conta-mestre', !!user && isContaAdmin(user)); } catch (e) { document.body.classList.remove('conta-mestre'); } if (!user) esperaFechar(); if (user) { onbAgendar(user); pushRegistrarEmailMestre(user); } });
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/57-primeira-entrada.js'] = '2.55.4';

// 41-notificacoes-push.js — Avisos no iPhone (2.20.1): ativar/desativar notificações neste aparelho e mandar um teste.
// O envio mesmo é feito pelo Worker "avisos-auditoria" (Cloudflare), que lê a agenda e manda o push. Aqui só ficam o cadastro do aparelho
// (config/push_<uid>.subs.<id>) e a cópia da escolha de avisos (config/push_<uid>.avisos), que o Worker lê.
const PUSH_URL = 'https://avisos-auditoria.leandromendoncadesign.workers.dev';
const PUSH_VAPID_PUBLICA = 'BMt0bb-qJP1tMXYEsGJ3jVcBMOfy3fQlLlXMxbkfwUvrdL8rolHF9CfHj9pv7_FTHnDhTmyqQEkFl4x9ymf1IF4';
let pushEstado = { suporte: false, motivo: '', permissao: 'default', ativo: false, ocupado: false };
const pushDocRef = () => firestore.collection('config').doc('push_' + auth.currentUser.uid);
const pushB64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const pushDeB64 = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
async function pushIdAparelho(endpoint) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)); return 's' + pushB64(h).slice(0, 20).replace(/[^A-Za-z0-9]/g, 'x'); }

async function pushRegistrarSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return null;
    try { return await navigator.serviceWorker.register('sw.js'); } catch (e) { console.error('Service worker:', e); return null; }
}
async function pushAtualizarEstado() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') pushEstado = { ...pushEstado, suporte: false, motivo: 'Este navegador não permite notificações.' };
    else if (!('PushManager' in window) || !('Notification' in window)) pushEstado = { ...pushEstado, suporte: false, motivo: ios && !standalone ? 'No iPhone, abra o app pelo ícone da tela de início (Compartilhar → Adicionar à Tela de Início) e ative por lá.' : 'Este aparelho não permite notificações.' };
    else {
        pushEstado.suporte = true; pushEstado.motivo = ''; pushEstado.permissao = Notification.permission;
        try { const reg = await navigator.serviceWorker.getRegistration().catch(() => null); const sub = reg && await reg.pushManager.getSubscription().catch(() => null); pushEstado.ativo = !!sub && Notification.permission === 'granted'; } catch (_) { pushEstado.ativo = false; }
    }
    if (typeof renderAgendaSeAtiva === 'function') renderAgendaSeAtiva();
}
async function pushAtivar() {
    if (pushEstado.ocupado) return; pushEstado.ocupado = true; renderAgendaSeAtiva();
    try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { toast('✕ Permissão negada. Libere em Ajustes do iPhone → Notificações.'); return; }
        const reg = (await pushRegistrarSW()) && await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushDeB64(PUSH_VAPID_PUBLICA) });
        const j = sub.toJSON(), id = await pushIdAparelho(j.endpoint);
        await pushDocRef().set({ subs: { [id]: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, criadoEm: new Date().toISOString() } }, avisos: pushAvisosParaWorker() }, { merge: true });
        toast('✓ Notificações ativadas neste aparelho.');
    } catch (e) { console.error('Ativar push:', e); erroFirebase('Erro ao ativar notificações:', e); toast('✕ Não consegui ativar as notificações.'); }
    finally { pushEstado.ocupado = false; await pushAtualizarEstado(); }
}
async function pushDesativar() {
    if (pushEstado.ocupado) return; pushEstado.ocupado = true; renderAgendaSeAtiva();
    try {
        const reg = await navigator.serviceWorker.getRegistration(), sub = reg && await reg.pushManager.getSubscription();
        if (sub) { const id = await pushIdAparelho(sub.endpoint); await sub.unsubscribe(); await pushDocRef().update({ ['subs.' + id]: firebase.firestore.FieldValue.delete() }).catch(() => {}); }
        toast('✓ Notificações desligadas neste aparelho.');
    } catch (e) { console.error('Desativar push:', e); toast('✕ Não consegui desligar.'); }
    finally { pushEstado.ocupado = false; await pushAtualizarEstado(); }
}
async function pushTeste() {
    try {
        const t = await auth.currentUser.getIdToken(), r = await fetch(PUSH_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: '{}' });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.enviados) toast('✓ Teste enviado. A notificação deve chegar em instantes.');
        else toast('✕ ' + (j.erro || 'O teste não chegou ao aparelho.') + (r.status === 404 ? ' Ative neste aparelho primeiro.' : ''));
    } catch (e) { toast('✕ Não consegui falar com o serviço de avisos (o Worker já foi instalado?).'); }
}
function pushAvisosParaWorker() { const a = {}; AGENDA_AVISOS.forEach(([k]) => { a[k] = agendaAvisosAtuais()[k]; }); return a; }
function pushSincronizarAvisos() { if (!pushEstado.ativo) return; pushDocRef().set({ avisos: pushAvisosParaWorker() }, { merge: true }).catch(e => console.error('Sincronizar avisos:', e)); }

// ---- resumo para os avisos de ocorrências e pedidos parados: o app anota no Firebase (config/avisosResumo) e o Worker avisa uma vez por dia
let _resumoTentativa = 0;
async function publicarResumoAvisos() {
    try {
        if (!auth.currentUser || !dadosAppInscritos || typeof itensDeAtencao !== 'function') return;
        if (typeof DADOS_SEGUNDO_PLANO !== 'undefined' && DADOS_SEGUNDO_PLANO.some(n => !assinaturasFeitas[n])) return;   // dados ainda chegando: não publica números incompletos
        const g = itensDeAtencao(), n = id => { const x = g.find(y => y.id === id); return x ? x.linhas.length : 0; };
        const r = { ocorrencias: n('ocorrencias-sem-relato'), pedidosParados: n('pedidos-sem-entrega') };
        let a = null; try { a = JSON.parse(localStorage.getItem('resumoAvisosV1') || 'null'); } catch (_) { }
        if (a && a.o === r.ocorrencias && a.p === r.pedidosParados && Date.now() - a.t < 6 * 3600e3) return;   // igual ao último gravado: não gasta escrita
        await firestore.collection('config').doc('avisosResumo').set({ ...r, atualizadoEm: new Date().toISOString() }, { merge: true });
        try { localStorage.setItem('resumoAvisosV1', JSON.stringify({ o: r.ocorrencias, p: r.pedidosParados, t: Date.now() })); } catch (_) { }
    } catch (e) { console.warn('Resumo de avisos:', e && e.code); }
}
function agendarResumoAvisos() { clearTimeout(_resumoTentativa); _resumoTentativa = setTimeout(publicarResumoAvisos, 45000); }
window.addEventListener('load', agendarResumoAvisos);
document.addEventListener('visibilitychange', () => { if (!document.hidden) agendarResumoAvisos(); });

// ---- diagnóstico das notificações: mostra em qual passo está o problema
let pushDiag = null;
async function pushDiagnostico() {
    pushDiag = { rodando: true, itens: [] }; renderAgendaSeAtiva();
    const it = (ok, txt, dica) => pushDiag.itens.push({ ok, txt, dica: dica || '' });
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    try {
        it(!ios || standalone ? 'ok' : 'erro', ios ? (standalone ? 'App aberto pelo ícone da Tela de Início' : 'App aberto pelo Safari') : 'Não é iPhone', ios && !standalone ? 'No iPhone as notificações só funcionam abrindo pelo ícone da Tela de Início.' : '');
        const suporte = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
        it(suporte ? 'ok' : 'erro', suporte ? 'Este aparelho aceita notificações' : 'Este aparelho/navegador não aceita notificações', suporte ? '' : 'Precisa de iOS 16.4 ou mais novo, com o app na Tela de Início.');
        if (suporte) {
            const perm = Notification.permission;
            it(perm === 'granted' ? 'ok' : perm === 'denied' ? 'erro' : 'aviso', 'Permissão: ' + (perm === 'granted' ? 'concedida' : perm === 'denied' ? 'negada' : 'ainda não pedida'), perm === 'denied' ? 'Libere em Ajustes do iPhone → Notificações → este app.' : perm === 'default' ? 'Toque em Ativar notificações.' : '');
            const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
            it(reg ? 'ok' : 'erro', reg ? 'Serviço de notificações (sw.js) registrado' : 'sw.js não registrado', reg ? '' : 'Confira se o arquivo sw.js está na mesma pasta do index.html.');
            const sub = reg && await reg.pushManager.getSubscription().catch(() => null);
            it(sub ? 'ok' : 'aviso', sub ? 'Aparelho inscrito no serviço de push da Apple' : 'Aparelho ainda não inscrito', sub ? '' : 'Toque em Ativar notificações.');
            if (sub) {
                try { const id = await pushIdAparelho(sub.endpoint), d = await pushDocRef().get(), ok = d.exists && d.data().subs && d.data().subs[id]; it(ok ? 'ok' : 'erro', ok ? 'Aparelho cadastrado no Firebase' : 'Aparelho NÃO está cadastrado no Firebase', ok ? '' : 'Toque em Desativar e depois em Ativar notificações.'); }
                catch (e) { it('erro', 'Não consegui ler o cadastro no Firebase (' + ((e && e.code) || 'erro') + ')', (e && e.code) === 'resource-exhausted' ? 'A cota diária do Firebase acabou; volta por volta das 05:00.' : ''); }
            }
        }
        try { const r = await fetch(PUSH_URL), j = await r.json(); it(j && j.ok ? 'ok' : 'erro', j && j.ok ? 'Worker de avisos respondendo' + (j.versao ? ' (versão ' + j.versao + ')' : '') : 'Worker respondeu estranho'); }
        catch (e) { it('erro', 'Worker de avisos não responde', 'Confira se o Worker foi implantado e o endereço em js/41 (PUSH_URL).'); }
        try {
            const d = await firestore.collection('config').doc('pushStatus').get(), s = d.exists ? d.data() : null;
            if (!s) it('aviso', 'O Worker ainda não registrou nenhuma rodada', 'Falta o agendamento (Configurações → Gatilhos → Cron Triggers) ou ele ainda não rodou.');
            else {
                const min = Math.round((Date.now() - Date.parse(s.ultimaRodada)) / 60000);
                if (s.erro) it('erro', 'Última rodada do Worker (há ' + min + ' min) deu erro: ' + String(s.erro).slice(0, 140), /429|Quota/i.test(s.erro) ? 'Cota do Firebase acabou; volta por volta das 05:00.' : '');
                else it(min <= 40 ? 'ok' : 'aviso', 'Última rodada do Worker há ' + min + ' min', min <= 40 ? '' : 'Faz tempo: confira o agendamento (cron) do Worker.');
            }
        } catch (e) { it('aviso', 'Não consegui ler o status do Worker (' + ((e && e.code) || 'erro') + ')'); }
    } catch (e) { it('erro', 'Diagnóstico parou: ' + ((e && e.message) || e)); }
    pushDiag.rodando = false; renderAgendaSeAtiva();
}
function pushDiagHTML() {
    if (!pushDiag) return '';
    const ic = { ok: '✓', aviso: '!', erro: '✕' };
    return `<div class="push-diag">${pushDiag.itens.map(i => `<div class="uso-lin"><span>${escRel(i.txt)}${i.dica ? `<small class="push-dica">${escRel(i.dica)}</small>` : ''}</span><b class="push-ic ${i.ok}">${ic[i.ok]}</b></div>`).join('')}${pushDiag.rodando ? '<div class="xml-item-meta">Verificando…</div>' : ''}</div>`;
}

function pushCartaoHTML() {
    const e = pushEstado;
    if (!e.suporte) return `<div class="ctl-card ag-bloco"><div class="xml-item-meta"><b>Notificações neste aparelho</b><br>${escRel(e.motivo || 'Verificando…')}</div><div class="xml-item-acao"><button type="button" class="central-status-toggle" onclick="pushDiagnostico()">Diagnóstico</button></div>${pushDiagHTML()}</div>`;
    const blocked = e.permissao === 'denied';
    return `<div class="ctl-card ag-bloco"><div class="xml-item-meta"><b>Notificações neste aparelho</b><br>${e.ativo ? 'Ativadas. Você recebe os avisos escolhidos abaixo, mesmo com o app fechado.' : blocked ? 'Bloqueadas. Libere em Ajustes do iPhone → Notificações → este app.' : 'Desativadas. Toque em Ativar e permita quando o iPhone perguntar.'}</div>
        <div class="xml-item-acao">${e.ativo ? '<button type="button" class="central-status-toggle" onclick="pushTeste()">Enviar teste</button><button type="button" class="central-status-toggle" onclick="pushDesativar()">Desativar</button>' : `<button type="button" class="central-status-toggle" onclick="pushAtivar()"${e.ocupado || blocked ? ' disabled' : ''}>${e.ocupado ? 'Ativando…' : 'Ativar notificações'}</button>`}<button type="button" class="central-status-toggle" onclick="pushDiagnostico()">Diagnóstico</button></div>${pushDiagHTML()}</div>`;
}
// abrir pelo toque na notificação
function pushAbrirDestino(d) { if (d === 'agenda') { switchToScreen('screen-agenda', 'Agenda de trabalho'); prepararAgenda(); } }
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.addEventListener('message', ev => { if (ev.data && ev.data.abrir) pushAbrirDestino(ev.data.abrir); });
    window.addEventListener('load', () => { pushRegistrarSW().then(pushAtualizarEstado); const q = new URLSearchParams(location.search).get('abrir'); if (q) setTimeout(() => pushAbrirDestino(q), 2500); });
} else window.addEventListener('load', pushAtualizarEstado);
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/41-notificacoes-push.js'] = '2.20.9';

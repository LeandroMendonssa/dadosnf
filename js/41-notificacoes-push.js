// 41-notificacoes-push.js — Avisos no iPhone (2.20.1): ativar/desativar notificações neste aparelho e mandar um teste.
// O envio mesmo é feito pelo Worker "avisos-auditoria" (Cloudflare), que lê a agenda e manda o push. Aqui só ficam o cadastro do aparelho
// (config/push_<uid>.subs.<id>) e a cópia da escolha de avisos (config/push_<uid>.avisos), que o Worker lê.
const PUSH_URL = 'https://avisos-auditoria.aseleandro.workers.dev';
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
        try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); pushEstado.ativo = !!sub && Notification.permission === 'granted'; } catch (_) { pushEstado.ativo = false; }
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

function pushCartaoHTML() {
    const e = pushEstado;
    if (!e.suporte) return `<div class="ctl-card ag-bloco"><div class="xml-item-meta"><b>Notificações neste aparelho</b><br>${escRel(e.motivo || 'Verificando…')}</div></div>`;
    const blocked = e.permissao === 'denied';
    return `<div class="ctl-card ag-bloco"><div class="xml-item-meta"><b>Notificações neste aparelho</b><br>${e.ativo ? 'Ativadas. Você recebe os avisos escolhidos abaixo, mesmo com o app fechado.' : blocked ? 'Bloqueadas. Libere em Ajustes do iPhone → Notificações → este app.' : 'Desativadas. Toque em Ativar e permita quando o iPhone perguntar.'}</div>
        <div class="xml-item-acao">${e.ativo ? '<button type="button" class="central-status-toggle" onclick="pushTeste()">Enviar teste</button><button type="button" class="central-status-toggle" onclick="pushDesativar()">Desativar</button>' : `<button type="button" class="central-status-toggle" onclick="pushAtivar()"${e.ocupado || blocked ? ' disabled' : ''}>${e.ocupado ? 'Ativando…' : 'Ativar notificações'}</button>`}</div></div>`;
}
// abrir pelo toque na notificação
function pushAbrirDestino(d) { if (d === 'agenda') { switchToScreen('screen-agenda', 'Agenda de trabalho'); prepararAgenda(); } }
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.addEventListener('message', ev => { if (ev.data && ev.data.abrir) pushAbrirDestino(ev.data.abrir); });
    window.addEventListener('load', () => { pushRegistrarSW().then(pushAtualizarEstado); const q = new URLSearchParams(location.search).get('abrir'); if (q) setTimeout(() => pushAbrirDestino(q), 2500); });
} else window.addEventListener('load', pushAtualizarEstado);

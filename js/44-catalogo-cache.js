// 2.22.0 — Cache versionado dos catálogos grandes (produtos, fornecedores, associações e exceções de XML).
// Ideia: o app guarda a lista no aparelho (IndexedDB) e, ao abrir, lê UM documento de versão (config/catalogosVersao).
// Versão igual = usa a cópia local (quase zero leituras). Versão diferente = baixa a coleção uma vez e guarda de novo.
// Toda gravação nessas coleções (feita por este app) avisa a versão e atualiza só o documento alterado.
// Se algo falhar aqui, o app volta para a escuta normal do Firestore (nada deixa de funcionar).
const CATALOGOS = ['produtosSpData', 'fornecedoresSpData', 'associacoesSpData', 'associacoesFornecedor', 'xmlExcecoes'];
const CATALOGO_TTL_MS = 24 * 3600e3;            // segurança: depois de 24 h baixa tudo de novo
const CATALOGO_LIMITE_DOCS = 300;                // gravação em lote maior que isso: baixa a coleção inteira
const catalogoEstado = {};                       // nome → { mapa, cb, col, versao, em, uid }
let catalogoVersoesPromessa = null;

function catalogoNovoToken() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function catalogoVersaoRef() { return firestore.collection('config').doc('catalogosVersao'); }

// ---- armazenamento local (IndexedDB)
function catalogoDB() {
    return new Promise((ok, falha) => {
        const r = indexedDB.open('catalogoCacheV1', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('c', { keyPath: 'nome' });
        r.onsuccess = () => ok(r.result);
        r.onerror = () => falha(r.error);
    });
}
async function catalogoLer(nome) {
    const db = await catalogoDB();
    return new Promise((ok, falha) => { const q = db.transaction('c').objectStore('c').get(nome); q.onsuccess = () => ok(q.result || null); q.onerror = () => falha(q.error); });
}
async function catalogoGravar(reg) {
    const db = await catalogoDB();
    return new Promise((ok, falha) => { const t = db.transaction('c', 'readwrite'); t.objectStore('c').put(reg); t.oncomplete = () => ok(); t.onerror = () => falha(t.error); });
}

// ---- versões no servidor (uma leitura por abertura, compartilhada pelos cinco catálogos)
function catalogoVersoes() {
    if (!catalogoVersoesPromessa) catalogoVersoesPromessa = catalogoVersaoRef().get().then(d => (d.exists ? d.data() : {})).catch(() => null);
    return catalogoVersoesPromessa;
}
function catalogoSnapshot(mapa) {
    const docs = [...mapa.entries()].map(([id, dados]) => ({ id, exists: true, data: () => ({ ...dados }) }));
    return { docs, size: docs.length, empty: !docs.length, metadata: { fromCache: true, hasPendingWrites: false }, forEach: f => docs.forEach(f), docChanges: () => [] };
}

// Substitui "colecao.onSnapshot(cb, errCb)" para os catálogos. Devolve a função de desligar, como o Firestore.
function catalogoOnSnapshot(nome, col, cb, errCb) {
    let ativo = true, escutaNormal = null;
    (async () => {
        let entrega = null;
        try {
            const uid = uidAtualCache();
            let reg = null; try { reg = await catalogoLer(nome); } catch (e) { reg = null; }
            if (reg && reg.uid !== uid) reg = null;
            const versoes = await catalogoVersoes();
            const versaoSrv = versoes ? versoes[nome] : undefined;
            const valido = !!reg && (!versoes || (versaoSrv !== undefined && reg.versao === versaoSrv)) && (Date.now() - reg.em < CATALOGO_TTL_MS);
            let mapa, versao, em;
            if (valido) { mapa = new Map(reg.docs); versao = reg.versao; em = reg.em; }
            else {
                try {
                    const snap = await col.get();
                    mapa = new Map(snap.docs.map(d => [d.id, d.data()]));
                    versao = versaoSrv; em = Date.now();
                    if (versao === undefined) {                       // primeira vez neste projeto: cria a versão
                        versao = catalogoNovoToken();
                        try { await catalogoVersaoRef().set({ [nome]: versao }, { merge: true }); } catch (e) { }
                    }
                    try { await catalogoGravar({ nome, uid, versao, em, docs: [...mapa.entries()] }); } catch (e) { console.warn('Catálogo: não consegui guardar a cópia local de', nome, e && e.message); }
                } catch (e) {
                    if (!reg) throw e;                                 // sem servidor e sem cópia: cai para a escuta normal
                    mapa = new Map(reg.docs); versao = reg.versao; em = reg.em;   // sem servidor: usa a cópia que existe
                }
            }
            catalogoEstado[nome] = { mapa, cb, col, versao, em, uid };
            entrega = catalogoSnapshot(mapa);
        } catch (e) {
            console.warn('Catálogo', nome, '— usando escuta normal:', e && (e.code || e.message));
            if (ativo) escutaNormal = col.onSnapshot(cb, errCb);
            return;
        }
        if (ativo) { try { cb(entrega); } catch (e) { console.error('Catálogo', nome, '— erro ao exibir:', e); } }
    })();
    return () => { ativo = false; delete catalogoEstado[nome]; if (escutaNormal) { const u = escutaNormal; escutaNormal = null; u(); } };
}

// ---- gravações: avisam a versão e atualizam só o documento alterado
const catalogoFila = {};   // nome → { ids: Map(id→apagou), timer }
function catalogoAlterado(nome, itens) {
    const f = catalogoFila[nome] = catalogoFila[nome] || { ids: new Map(), timer: null };
    itens.forEach(i => f.ids.set(i.id, !!i.del));
    clearTimeout(f.timer);
    f.timer = setTimeout(() => { const ids = f.ids; f.ids = new Map(); catalogoProcessar(nome, ids).catch(e => console.warn('Catálogo', nome, '— atualização:', e && e.message)); }, 800);
}
async function catalogoProcessar(nome, ids) {
    const uid = uidAtualCache(), est = catalogoEstado[nome], col = firestore.collection(nome);
    let mapa = est ? est.mapa : null, em = est ? est.em : Date.now();
    if (!mapa) {                                        // catálogo não foi carregado nesta sessão: ajusta a cópia guardada, se houver
        let reg = null; try { reg = await catalogoLer(nome); } catch (e) { reg = null; }
        if (!reg || reg.uid !== uid) { try { await catalogoVersaoRef().set({ [nome]: catalogoNovoToken() }, { merge: true }); } catch (e) { } return; }
        mapa = new Map(reg.docs); em = reg.em;
    }
    if (ids.size > CATALOGO_LIMITE_DOCS) {
        const snap = await col.get(); mapa = new Map(snap.docs.map(d => [d.id, d.data()])); em = Date.now();
    } else {
        const lista = [...ids.entries()];
        for (let i = 0; i < lista.length; i += 20) {
            await Promise.all(lista.slice(i, i + 20).map(async ([id, apagou]) => {
                if (apagou) { mapa.delete(id); return; }
                const d = await col.doc(id).get();
                if (d.exists) mapa.set(id, d.data()); else mapa.delete(id);
            }));
        }
    }
    const versao = catalogoNovoToken();
    try { await catalogoVersaoRef().set({ [nome]: versao }, { merge: true }); } catch (e) { }
    if (catalogoVersoesPromessa) catalogoVersoesPromessa = catalogoVersoesPromessa.then(v => ({ ...(v || {}), [nome]: versao }));
    try { await catalogoGravar({ nome, uid, versao, em, docs: [...mapa.entries()] }); } catch (e) { console.warn('Catálogo: cópia local de', nome, e && e.message); }
    if (est) { est.mapa = mapa; est.versao = versao; try { est.cb(catalogoSnapshot(mapa)); } catch (e) { console.error('Catálogo', nome, '— erro ao exibir:', e); } }
}
function catalogoDoCaminho(ref) {
    try { const p = String(ref.path || '').split('/'); return CATALOGOS.includes(p[0]) && p.length === 2 ? { nome: p[0], id: p[1] } : null; } catch (e) { return null; }
}
function catalogoInstalarEscritas(F) {
    const DR = F.DocumentReference && F.DocumentReference.prototype, CR = F.CollectionReference && F.CollectionReference.prototype, WB = F.WriteBatch && F.WriteBatch.prototype;
    if (DR) ['set', 'update', 'delete'].forEach(m => {
        const orig = DR[m]; if (!orig || orig.__cat) return;
        DR[m] = function (...a) {
            const info = catalogoDoCaminho(this), p = orig.apply(this, a);
            if (info && p && p.then) p.then(() => catalogoAlterado(info.nome, [{ id: info.id, del: m === 'delete' }])).catch(() => { });
            return p;
        };
        DR[m].__cat = true;
    });
    if (CR && CR.add && !CR.add.__cat) {
        const add = CR.add;
        CR.add = function (...a) {
            const nome = String(this.path || ''), p = add.apply(this, a);
            if (CATALOGOS.includes(nome) && p && p.then) p.then(ref => catalogoAlterado(nome, [{ id: ref.id, del: false }])).catch(() => { });
            return p;
        };
        CR.add.__cat = true;
    }
    if (WB) {
        ['set', 'update', 'delete'].forEach(m => {
            const orig = WB[m]; if (!orig || orig.__cat) return;
            WB[m] = function (ref, ...r) {
                const info = catalogoDoCaminho(ref);
                if (info) (this.__catOps = this.__catOps || []).push({ nome: info.nome, id: info.id, del: m === 'delete' });
                return orig.call(this, ref, ...r);
            };
            WB[m].__cat = true;
        });
        const commit = WB.commit;
        if (commit && !commit.__cat) {
            WB.commit = function (...a) {
                const ops = this.__catOps; this.__catOps = null;
                const p = commit.apply(this, a);
                if (ops && ops.length && p && p.then) p.then(() => { CATALOGOS.forEach(n => { const m = ops.filter(o => o.nome === n); if (m.length) catalogoAlterado(n, m); }); }).catch(() => { });
                return p;
            };
            WB.commit.__cat = true;
        }
    }
}
try { if (window.firebase && firebase.firestore) catalogoInstalarEscritas(firebase.firestore); } catch (e) { console.warn('Cache de catálogos: gravações não monitoradas:', e); }
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/44-catalogo-cache.js'] = '2.22.0';

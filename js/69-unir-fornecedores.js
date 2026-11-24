// 69-unir-fornecedores.js — Unir matriz e filial (2.73.23)
// Fase 5.1 da unificação de fornecedores. Mostra cadastros diferentes que têm a MESMA raiz de CNPJ (8 primeiros dígitos) e deixa você decidir,
// caso a caso: Unir ou "Não é a mesma empresa". Só por CNPJ, nunca por nome. Unir grava apenas a ligação entre os dois cadastros
// (entidadesRelacionadas, o mesmo mecanismo que já existe); nenhum cadastro, CNPJ, apelido ou logo é apagado ou alterado. Desfazer remove só essa ligação.
// leandromendonssa
let ufRecusadas = null, ufFeitos = [], ufCarregando = false;
const ufDoc = () => settingsDocRef.parent.doc('uniaoFornecedores');
async function ufCarregarRecusadas() {
    if (ufRecusadas || ufCarregando) return; ufCarregando = true;
    try { const s = await ufDoc().get(); ufRecusadas = new Set((s.exists && s.data().recusadas) || []); } catch (e) { console.error('Uniões recusadas', e); ufRecusadas = new Set(); }
    ufCarregando = false;
}
const ufRaizFmt = r => r.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2.$3');
function ufSugestoes() {
    const porRaiz = new Map();
    listaFornecedoresUnificada().filter(f => f.origem === 'spdata').forEach(f => {
        const raizes = new Map();
        (f.cnpjs || []).forEach(c => { const d = String(c.cnpj || '').replace(/\D/g, ''); if (d.length >= 8) { const r = d.slice(0, 8); if (!raizes.has(r)) raizes.set(r, []); raizes.get(r).push(c); } });
        raizes.forEach((cs, r) => { if (!porRaiz.has(r)) porRaiz.set(r, []); porRaiz.get(r).push({ f, cs, docId: cs[0].docId }); });
    });
    const out = [];
    porRaiz.forEach((lado, r) => {
        if (lado.length < 2) return;
        lado.sort((a, b) => String(a.docId).localeCompare(String(b.docId)));
        for (let i = 1; i < lado.length; i++) {
            const a = lado[0], b = lado[i], chave = r + ':' + a.docId + '|' + b.docId;
            if (ufRecusadas && ufRecusadas.has(chave)) continue;
            out.push({ chave, raiz: r, a, b });
        }
    });
    return out.sort((x, y) => (x.a.f.nomeReal || '').localeCompare(y.a.f.nomeReal || ''));
}
function ufLadoHTML(l) {
    const f = l.f, ap = f.nomeExibido && f.nomeExibido !== f.nomeReal ? f.nomeExibido : '', nome = ap || f.nomeReal || '';
    let av = ''; try { av = avatarFornConteudo(nome); } catch (e) { }
    const cnpjs = l.cs.map(c => formatarCnpjExibicao(c.cnpj)).join(', '), cod = [...new Set(f.docs.map(d => d.codigo).filter(Boolean))].join(', ');
    return `<div class="uf-lado"><span class="uf-av">${av}</span><div class="uf-txt"><b>${escRel(f.nomeReal || '(sem nome)')}</b>${ap ? `<small>Apelido: ${escRel(ap)}</small>` : ''}<small>CNPJ ${escRel(cnpjs)}${cod ? ' · cód. ' + escRel(cod) : ''}</small></div></div>`;
}
function ufRender() {
    const el = document.getElementById('unir-forn-conteudo'); if (!el) return;
    if (!ufRecusadas) { el.innerHTML = '<div class="card"><p class="desc-tela">Carregando…</p></div>'; ufCarregarRecusadas().then(ufRender); return; }
    const sug = ufSugestoes();
    const feitos = ufFeitos.map((x, i) => `<div class="card mt-4"><div class="xml-item-meta"><b>✓ Unidos</b> (raiz ${escRel(ufRaizFmt(x.raiz))})</div>${ufLadoHTML(x.a)}${ufLadoHTML(x.b)}<button type="button" class="actions-button is-neutral" style="width:100%;margin-top:8px" onclick="ufDesfazer(${i})">Desfazer</button></div>`).join('');
    el.innerHTML = `<div class="card"><p class="desc-tela">Cadastros diferentes com a mesma raiz de CNPJ (matriz e filial). <b>Unir</b> mostra e busca os dois como um fornecedor só; nada é apagado e dá para desfazer. Só você decide: o app nunca une sozinho. Gere uma foto de segurança antes (Saúde dos cadastros).</p>
        <div class="xml-item-meta">${sug.length} sugestão(ões) pendente(s)${ufRecusadas.size ? ` · ${ufRecusadas.size} marcada(s) como "não é a mesma"` : ''}</div></div>` + feitos +
        sug.map(s => `<div class="card mt-4" data-uf="${escRel(s.chave)}"><div class="xml-item-meta"><b>Raiz de CNPJ ${escRel(ufRaizFmt(s.raiz))}</b></div>${ufLadoHTML(s.a)}${ufLadoHTML(s.b)}
            <div class="uf-acoes"><button type="button" class="actions-button is-primary" onclick="ufUnir(this)">Unir</button><button type="button" class="actions-button is-neutral" onclick="ufRecusar(this)">Não é a mesma</button></div></div>`).join('') +
        (sug.length ? '' : '<div class="card mt-4"><p class="desc-tela">Nenhuma sugestão pendente. ✓</p></div>');
}
const ufPar = bt => { const k = bt.closest('[data-uf]').dataset.uf; return ufSugestoes().find(s => s.chave === k); };
async function ufUnir(bt) {
    const s = ufPar(bt); if (!s) return; bt.disabled = true;
    try {
        const b = firestore.batch();
        b.update(fornecedoresSpDataCollection.doc(s.a.docId), { entidadesRelacionadas: firebase.firestore.FieldValue.arrayUnion(s.b.docId) });
        b.update(fornecedoresSpDataCollection.doc(s.b.docId), { entidadesRelacionadas: firebase.firestore.FieldValue.arrayUnion(s.a.docId) });
        await b.commit(); ufFeitos.unshift(s); toast('✓ Unidos. Nenhum cadastro foi apagado.');
    } catch (e) { console.error('Unir fornecedores', e); toast('✕ Não consegui unir. Tente de novo.'); bt.disabled = false; return; }
    setTimeout(ufRender, 400);
}
async function ufDesfazer(i) {
    const s = ufFeitos[i]; if (!s) return;
    try {
        const b = firestore.batch();
        b.update(fornecedoresSpDataCollection.doc(s.a.docId), { entidadesRelacionadas: firebase.firestore.FieldValue.arrayRemove(s.b.docId) });
        b.update(fornecedoresSpDataCollection.doc(s.b.docId), { entidadesRelacionadas: firebase.firestore.FieldValue.arrayRemove(s.a.docId) });
        await b.commit(); ufFeitos.splice(i, 1); toast('✓ União desfeita.');
    } catch (e) { console.error('Desfazer união', e); toast('✕ Não consegui desfazer. Tente de novo.'); return; }
    setTimeout(ufRender, 400);
}
async function ufRecusar(bt) {
    const s = ufPar(bt); if (!s) return; bt.disabled = true;
    try { await ufDoc().set({ recusadas: firebase.firestore.FieldValue.arrayUnion(s.chave) }, { merge: true }); ufRecusadas.add(s.chave); toast('Anotado: não é a mesma empresa. Não volta a ser sugerido.'); }
    catch (e) { console.error('Recusar união', e); toast('✕ Não consegui anotar. Tente de novo.'); bt.disabled = false; return; }
    ufRender();
}
window.ufRender = ufRender; window.ufUnir = ufUnir; window.ufDesfazer = ufDesfazer; window.ufRecusar = ufRecusar; window.ufSugestoes = ufSugestoes;
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/69-unir-fornecedores.js'] = '2.73.23';

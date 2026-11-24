// 69-unir-fornecedores.js — Unir matriz e filial (2.73.23)
// Fase 5.1 da unificação de fornecedores. Mostra cadastros diferentes que têm a MESMA raiz de CNPJ (8 primeiros dígitos) e deixa você decidir,
// caso a caso: Unir ou "Não é a mesma empresa". Só por CNPJ, nunca por nome. Unir grava apenas a ligação entre os dois cadastros
// (entidadesRelacionadas, o mesmo mecanismo que já existe); nenhum cadastro, CNPJ, apelido ou logo é apagado ou alterado. Desfazer remove só essa ligação.
// leandromendonssa
let ufRecusadas = null, ufFeitos = [], ufCarregando = false, ufLegFeitos = [];
const ufChavesFeitas = () => new Set(ufFeitos.map(x => x.chave));
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
            if ((ufRecusadas && ufRecusadas.has(chave)) || ufChavesFeitas().has(chave)) continue;
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
        (sug.length ? '' : '<div class="card mt-4"><p class="desc-tela">Nenhuma sugestão pendente. ✓</p></div>') + ufLegadoHTML() + ufLogosHTML();
}
// ---- 5.2: nomes que só existem na lista simples (legado) que podem ser abreviação de um cadastro ----
function ufDist(a, b) { const m = a.length, n = b.length; if (Math.abs(m - n) > 3) return 9; let prev = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; }
const ufNorm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function ufCandidatos(nome) {
    const n = ufNorm(nome), nuc = nomeNucleoFornecedor(nome), out = [];
    if (n.length < 2) return out;
    listaFornecedoresSpData.forEach(d => {
        const bases = [d.nomeReal, d.nomeExibido].filter(Boolean); let sc = 0;
        bases.forEach(b => {
            const nb = ufNorm(b);
            if (nb === n) sc = Math.max(sc, 3);
            else if (n.length >= 3 && (nb.startsWith(n) || n.startsWith(nb.slice(0, Math.max(4, nb.length > 8 ? 8 : nb.length))) && nb.length >= 4)) sc = Math.max(sc, 2);
            else if (n.length >= 4 && nb.includes(n)) sc = Math.max(sc, 1.5);
            if (n.length >= 6 && nb.length >= 6 && ufDist(n, nb) <= 2) sc = Math.max(sc, 1.8);
            const p = nuc ? pontuarParecidoNome(nuc, nomeNucleoFornecedor(b)) : 0; if (p >= 0.6) sc = Math.max(sc, p);
        });
        if (sc) out.push({ d, sc });
    });
    return out.sort((a, b) => b.sc - a.sc).slice(0, 3);
}
function ufLegadoLista() {
    const feitos = new Set(ufLegFeitos.map(x => x.nome));
    return listaFornecedoresUnificada().filter(f => f.origem === 'legado' && !feitos.has(f.nomeReal) && !(ufRecusadas && ufRecusadas.has('lg:' + f.nomeReal)))
        .map(f => ({ nome: f.nomeReal, cands: ufCandidatos(f.nomeReal) })).filter(x => x.cands.length);
}
function ufCandHTML(d) {
    const nome = d.nomeExibido && d.nomeExibido !== d.nomeReal ? d.nomeExibido : d.nomeReal; let av = ''; try { av = avatarFornConteudo(nome); } catch (e) { }
    const cnpj = (d.cnpjs || [])[0] ? formatarCnpjExibicao(d.cnpjs[0].cnpj) : 'sem CNPJ';
    return `<div class="uf-lado"><span class="uf-av">${av}</span><div class="uf-txt"><b>${escRel(d.nomeReal || '')}</b><small>${escRel(cnpj)}${d.codigo ? ' · cód. ' + escRel(d.codigo) : ''}</small></div></div>`;
}
function ufLegadoHTML() {
    const feitos = ufLegFeitos.map((x, i) => `<div class="card mt-4"><div class="xml-item-meta"><b>✓ "${escRel(x.nome)}"</b> agora é nome alternativo de <b>${escRel(x.d.nomeReal)}</b></div><button type="button" class="actions-button is-neutral" style="width:100%;margin-top:8px" onclick="ufDesfazerLegado(${i})">Desfazer</button></div>`).join('');
    const lista = ufLegadoLista();
    return `<div class="card mt-4"><p class="desc-tela"><b>Nomes só da lista simples.</b> Quando um nome parece abreviar um fornecedor cadastrado, toque no cadastro certo para ele virar nome alternativo dele. O nome antigo continua existindo; nada é apagado.</p><div class="xml-item-meta">${lista.length} nome(s) com sugestão</div></div>` + feitos +
        lista.map(x => `<div class="card mt-4" data-lg="${escRel(x.nome)}"><div class="xml-item-meta"><b>${escRel(x.nome)}</b> deve ser:</div>` +
            x.cands.map(c => `<div>${ufCandHTML(c.d)}<button type="button" class="actions-button is-primary" style="width:100%" data-id="${escRel(c.d.id)}" onclick="ufVincLegado(this)">É este</button></div>`).join('') +
            `<button type="button" class="actions-button is-neutral" style="width:100%;margin-top:10px" onclick="ufPularLegado(this)">Nenhum destes</button></div>`).join('');
}
async function ufVincLegado(bt) {
    const card = bt.closest('[data-lg]'), nome = card.dataset.lg, id = bt.dataset.id, d = listaFornecedoresSpData.find(f => f.id === id); if (!d) return;
    card.querySelectorAll('button').forEach(b => b.disabled = true);
    try { await fornecedoresSpDataCollection.doc(id).update({ aliasesLegado: firebase.firestore.FieldValue.arrayUnion(nome) }); ufLegFeitos.unshift({ nome, id, d }); toast('✓ Vinculado. O nome antigo não foi apagado.'); }
    catch (e) { console.error('Vincular nome', e); toast('✕ Não consegui vincular. Tente de novo.'); card.querySelectorAll('button').forEach(b => b.disabled = false); return; }
    ufRender();
}
async function ufDesfazerLegado(i) {
    const x = ufLegFeitos[i]; if (!x) return;
    try { await fornecedoresSpDataCollection.doc(x.id).update({ aliasesLegado: firebase.firestore.FieldValue.arrayRemove(x.nome) }); ufLegFeitos.splice(i, 1); toast('✓ Vínculo desfeito.'); }
    catch (e) { console.error('Desfazer vínculo', e); toast('✕ Não consegui desfazer. Tente de novo.'); return; }
    ufRender();
}
async function ufPularLegado(bt) {
    const card = bt.closest('[data-lg]'), nome = card.dataset.lg; card.querySelectorAll('button').forEach(b => b.disabled = true);
    try { await ufDoc().set({ recusadas: firebase.firestore.FieldValue.arrayUnion('lg:' + nome) }, { merge: true }); ufRecusadas.add('lg:' + nome); toast('Anotado. Esse nome não volta a ser sugerido.'); }
    catch (e) { console.error('Pular nome', e); toast('✕ Não consegui anotar. Tente de novo.'); card.querySelectorAll('button').forEach(b => b.disabled = false); return; }
    ufRender();
}
const ufPar = bt => { const k = bt.closest('[data-uf]').dataset.uf; return ufSugestoes().find(s => s.chave === k); };
async function ufUnir(bt) {
    const s = ufPar(bt); if (!s) return; bt.disabled = true;
    try {
        const b = firestore.batch();
        b.update(fornecedoresSpDataCollection.doc(s.a.docId), { entidadesRelacionadas: firebase.firestore.FieldValue.arrayUnion(s.b.docId) });
        b.update(fornecedoresSpDataCollection.doc(s.b.docId), { entidadesRelacionadas: firebase.firestore.FieldValue.arrayUnion(s.a.docId) });
        await b.commit(); if (!ufChavesFeitas().has(s.chave)) ufFeitos.unshift(s); toast('✓ Unidos. Nenhum cadastro foi apagado.');
    } catch (e) { console.error('Unir fornecedores', e); toast('✕ Não consegui unir. Tente de novo.'); bt.disabled = false; return; }
    ufRender();
}
async function ufDesfazer(i) {
    const s = ufFeitos[i]; if (!s) return;
    try {
        const b = firestore.batch();
        b.update(fornecedoresSpDataCollection.doc(s.a.docId), { entidadesRelacionadas: firebase.firestore.FieldValue.arrayRemove(s.b.docId) });
        b.update(fornecedoresSpDataCollection.doc(s.b.docId), { entidadesRelacionadas: firebase.firestore.FieldValue.arrayRemove(s.a.docId) });
        await b.commit(); ufFeitos.splice(i, 1); toast('✓ União desfeita.');
    } catch (e) { console.error('Desfazer união', e); toast('✕ Não consegui desfazer. Tente de novo.'); return; }
    ufRender();
}
async function ufRecusar(bt) {
    const s = ufPar(bt); if (!s) return; bt.disabled = true;
    try { await ufDoc().set({ recusadas: firebase.firestore.FieldValue.arrayUnion(s.chave) }, { merge: true }); ufRecusadas.add(s.chave); toast('Anotado: não é a mesma empresa. Não volta a ser sugerido.'); }
    catch (e) { console.error('Recusar união', e); toast('✕ Não consegui anotar. Tente de novo.'); bt.disabled = false; return; }
    ufRender();
}

// ---- 5.3: logos sem cadastro e fornecedores com duas logos próprias ----
// Logo sem cadastro: o nome da chave vira nome alternativo do cadastro escolhido (aliasesLegado, mecanismo já existente). Nenhuma imagem é apagada nem movida;
// se o cadastro já tem logo, continua valendo a que vale hoje e a outra fica guardada. Duas logos próprias: só mostra qual vale hoje, sem alterar.
let ufLogoFeitos = [];
const ufImg = en => { try { const u = en.u ? logoUrlLeve(en.u) : (en.d ? logoDevUrl(en.d, false) : ''); return u ? `<img src="${escRel(u)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''; } catch (e) { return ''; } };
function ufLogosSemCadastro() {
    const L = logosFornecedores || {}, ix = indiceFornLogo(), raizes = new Set();
    listaFornecedoresSpData.forEach(d => (d.cnpjs || []).forEach(c => { const g = String(c.cnpj || '').replace(/\D/g, ''); if (g.length >= 8) raizes.add(g.slice(0, 8)); }));
    const feitos = new Set(ufLogoFeitos.map(x => x.chave));
    return Object.keys(L).filter(k => L[k] && !L[k].r && (L[k].u || L[k].d) && !feitos.has(k) && !(ufRecusadas && ufRecusadas.has('lgo:' + k)) && !(k.startsWith('CNPJ:') ? raizes.has(k.slice(5)) : ix.nomes.has(k)))
        .map(k => ({ k, cands: k.startsWith('CNPJ:') ? [] : ufCandidatos(k) }));
}
function ufLogosDuplas() {
    const L = logosFornecedores || {}, out = [];
    listaFornecedoresUnificada().forEach(f => { try {
        const cnpj = ((f.cnpjs || [])[0] || {}).cnpj, e = entidadeForn(f.nomeReal, cnpj), proprias = (e.keys || []).filter(k => L[k] && !L[k].r && (L[k].u || L[k].d));
        if (proprias.length > 1) { const r = logoRes(f.nomeReal, cnpj); out.push({ nome: f.nomeReal, vale: r ? r.k : proprias[0], proprias }); }
    } catch (x) { } });
    return out;
}
function ufLogosHTML() {
    const L = logosFornecedores || {}, sem = ufLogosSemCadastro(), com = sem.filter(x => x.cands.length), semSug = sem.length - com.length, dup = ufLogosDuplas();
    const feitos = ufLogoFeitos.map((x, i) => `<div class="card mt-4"><div class="xml-item-meta"><b>✓ Logo "${escRel(x.chave)}"</b> ligada a <b>${escRel(x.d.nomeReal)}</b></div><button type="button" class="actions-button is-neutral" style="width:100%;margin-top:8px" onclick="ufDesfazerLogo(${i})">Desfazer</button></div>`).join('');
    return `<div class="card mt-4"><p class="desc-tela"><b>Logos sem cadastro.</b> Toque no cadastro a que a logo pertence. Nenhuma imagem é apagada: se o cadastro já tem logo, a que vale hoje continua valendo e esta fica guardada.</p><div class="xml-item-meta">${com.length} com sugestão${semSug ? ` · ${semSug} sem sugestão (ex.: só o CNPJ)` : ''}</div></div>` + feitos +
        com.map(x => `<div class="card mt-4" data-lgo="${escRel(x.k)}"><div class="uf-lado"><span class="uf-av">${ufImg(L[x.k])}</span><div class="uf-txt"><b>${escRel(x.k)}</b><small>logo sem cadastro; deve ser de:</small></div></div>` +
            x.cands.map(c => `<div>${ufCandHTML(c.d)}<button type="button" class="actions-button is-primary" style="width:100%" data-id="${escRel(c.d.id)}" onclick="ufVincLogo(this)">É este</button></div>`).join('') +
            `<button type="button" class="actions-button is-neutral" style="width:100%;margin-top:10px" onclick="ufPularLogo(this)">Nenhum destes</button></div>`).join('') +
        `<div class="card mt-4"><p class="desc-tela"><b>Fornecedores com duas logos próprias.</b> Só informativo: a marcada com ✓ é a que vale hoje; a outra fica guardada. Nada é alterado.</p><div class="xml-item-meta">${dup.length} fornecedor(es)</div></div>` +
        dup.map(x => `<div class="card mt-4"><div class="xml-item-meta"><b>${escRel(x.nome)}</b></div>` + x.proprias.map(k => `<div class="uf-lado"><span class="uf-av">${ufImg(L[k])}</span><div class="uf-txt"><b>${escRel(k)}</b><small>${k === x.vale ? '✓ vale hoje' : 'guardada'}</small></div></div>`).join('') + `</div>`).join('');
}
async function ufVincLogo(bt) {
    const card = bt.closest('[data-lgo]'), chave = card.dataset.lgo, id = bt.dataset.id, d = listaFornecedoresSpData.find(f => f.id === id); if (!d) return;
    card.querySelectorAll('button').forEach(b => b.disabled = true);
    try { await fornecedoresSpDataCollection.doc(id).update({ aliasesLegado: firebase.firestore.FieldValue.arrayUnion(chave) }); ufLogoFeitos.unshift({ chave, id, d }); toast('✓ Logo ligada ao cadastro. Nenhuma imagem foi apagada.'); }
    catch (e) { console.error('Ligar logo', e); toast('✕ Não consegui ligar. Tente de novo.'); card.querySelectorAll('button').forEach(b => b.disabled = false); return; }
    ufRender();
}
async function ufDesfazerLogo(i) {
    const x = ufLogoFeitos[i]; if (!x) return;
    try { await fornecedoresSpDataCollection.doc(x.id).update({ aliasesLegado: firebase.firestore.FieldValue.arrayRemove(x.chave) }); ufLogoFeitos.splice(i, 1); toast('✓ Ligação desfeita.'); }
    catch (e) { console.error('Desfazer logo', e); toast('✕ Não consegui desfazer. Tente de novo.'); return; }
    ufRender();
}
async function ufPularLogo(bt) {
    const card = bt.closest('[data-lgo]'), k = card.dataset.lgo; card.querySelectorAll('button').forEach(b => b.disabled = true);
    try { await ufDoc().set({ recusadas: firebase.firestore.FieldValue.arrayUnion('lgo:' + k) }, { merge: true }); ufRecusadas.add('lgo:' + k); toast('Anotado. Essa logo não volta a ser sugerida.'); }
    catch (e) { console.error('Pular logo', e); toast('✕ Não consegui anotar. Tente de novo.'); card.querySelectorAll('button').forEach(b => b.disabled = false); return; }
    ufRender();
}
window.ufRender = ufRender; window.ufUnir = ufUnir; window.ufDesfazer = ufDesfazer; window.ufRecusar = ufRecusar; window.ufSugestoes = ufSugestoes; window.ufVincLegado = ufVincLegado; window.ufDesfazerLegado = ufDesfazerLegado; window.ufPularLegado = ufPularLegado; window.ufLegadoLista = ufLegadoLista; window.ufVincLogo = ufVincLogo; window.ufDesfazerLogo = ufDesfazerLogo; window.ufPularLogo = ufPularLogo; window.ufLogosSemCadastro = ufLogosSemCadastro; window.ufLogosDuplas = ufLogosDuplas;
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/69-unir-fornecedores.js'] = '2.73.25';

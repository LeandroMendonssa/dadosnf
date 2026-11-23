// 66-logos-fornecedores.js — Logo do fornecedor nas bolinhas (2.73.3)
// Você escolhe uma vez por fornecedor: enviando uma imagem (reduzida para 96 px) ou informando o site (usa o ícone do site). Sem logo, continuam as iniciais.
// Guardado em config/logosFornecedores { logos: { CHAVE: { u: 'data:… ou https://…' } } } — um documento só, separado das configurações.
let logosFornecedores = {};
function chaveLogoForn(nome) {
    return String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/<[^>]*>/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function nomeBaseLogoForn(nome) { let n = nome; try { n = nomeExibicaoFornecedor(nome, '') || nome; } catch (e) { } return chaveLogoForn(n); }

// ===== 2.73.11 — IDENTIDADE DO FORNECEDOR =====
// Antes a logo era guardada só pelo apelido: mudou o apelido, o nome de exibição ou a associação e ela se perdia.
// Agora cada fornecedor (entidade) é reconhecido por TODAS as suas identificações: raiz do CNPJ (matriz/filiais), razão social,
// nome de exibição, apelido e nomes vinculados. A logo é guardada uma vez (chave principal) e as demais identificações apontam para ela
// ({ r: chavePrincipal }). Qualquer uma delas encontra a logo, e o que for criado depois (nova associação, novo apelido) herda
// pelo cadastro, sem perder nada. Nomes só "parecidos" nunca herdam: só o que o cadastro liga de forma explícita.
let _ixLista = null, _ixSug = null, _ixApel = null, _ixN = '', _ix = null, _logoCache = new Map();
const raizCnpjLogo = c => { const d = String(c || '').replace(/\D/g, ''); return d.length >= 8 ? 'CNPJ:' + d.slice(0, 8) : ''; };
function indiceFornLogo() {
    const n = (fornecedoresSugeridos || []).length + ':' + Object.keys(apelidosFornecedores || {}).length;   // a lista simples é alterada no lugar
    if (_ix && _ixLista === listaFornecedoresSpData && _ixSug === fornecedoresSugeridos && _ixApel === apelidosFornecedores && _ixN === n) return _ix;
    _ixLista = listaFornecedoresSpData; _ixSug = fornecedoresSugeridos; _ixApel = apelidosFornecedores; _ixN = n; _logoCache = new Map();
    const ix = { nomes: new Map(), porDoc: new Map() };
    try {
        listaFornecedoresUnificada().forEach(f => {
            const keys = [], add = k => { if (k && !keys.includes(k)) keys.push(k); };
            (f.cnpjs || []).forEach(c => add(raizCnpjLogo(c.cnpj)));
            add(chaveLogoForn(f.nomeReal)); add(chaveLogoForn(f.nomeExibido));
            (f.aliasesLegado || []).forEach(a => add(chaveLogoForn(a)));
            (f.docs || []).forEach(d => { try { add(chaveLogoForn(apelidoFornecedorDoc(d).nome)); } catch (e) { } });
            const e = { chave: f.chave, nomeReal: f.nomeReal, nomeExibido: f.nomeExibido || '', cnpjs: f.cnpjs || [], keys, cadastro: true, simples: f.origem === 'legado' };
            keys.forEach(k => { if (!k.startsWith('CNPJ:') && !ix.nomes.has(k)) ix.nomes.set(k, e); });
            (f.docs || []).forEach(d => ix.porDoc.set(d.id, e));
        });
    } catch (e) { console.error('índice de fornecedores', e); }
    return (_ix = ix);
}
function entidadeForn(nome, cnpj) {
    const ix = indiceFornLogo(), nk = chaveLogoForn(nome), dg = String(cnpj || '').replace(/\D/g, '');
    let e = null;
    if (dg.length >= 8) { try { const d = docFornecedorSpDataPorCnpj(dg); if (d) e = ix.porDoc.get(d.id) || null; } catch (x) { } }
    if (!e) e = ix.nomes.get(nk) || null;
    const base = nomeBaseLogoForn(nome);
    if (!e) e = ix.nomes.get(base) || null;
    if (e) return e;
    return { chave: '', nomeReal: String(nome || ''), nomeExibido: '', cnpjs: [], keys: [nk, base].filter((k, i, a) => k && a.indexOf(k) === i), cadastro: false, simples: false };
}
// logo que vale para este fornecedor: { k: chave principal, ent: {u,d}, e: entidade } ou null
function logoRes(nome, cnpj) {
    indiceFornLogo();
    const ck = String(nome || '') + '|' + (cnpj || ''); if (_logoCache.has(ck)) return _logoCache.get(ck);
    const e = entidadeForn(nome, cnpj); let r = null;
    for (const k of e.keys.concat([chaveLogoForn(nome)])) {
        let kk = k, en = logosFornecedores[k]; if (en && en.r) { kk = en.r; en = logosFornecedores[kk]; }
        if (en && (en.u || en.d)) { r = { k: kk, ent: en, e }; break; }
    }
    _logoCache.set(ck, r); return r;
}
const logoCacheLimpa = () => { _logoCache = new Map(); };
// 2.73.13: quando as logos chegam ou mudam, as bolinhas JÁ DESENHADAS (em qualquer tela ou janela) são trocadas no lugar, sem redesenhar a tela.
// Antes só Início, Controle de NFs e Fornecedores eram redesenhadas; telas como Repasse de NF, desenhadas antes de as logos chegarem,
// ficavam só com as iniciais. Agora toda bolinha criada por avatarFornConteudo se atualiza sozinha, inclusive telas futuras.
function logosAtualizarBolinhas() {
    document.querySelectorAll('.av-fn[data-forn]').forEach(sp => {
        if (sp.closest('#logo-forn-modal')) return;   // a prévia da janela de logo mostra a imagem ainda não salva
        const nome = sp.getAttribute('data-forn'), u = logoFornDe(nome) || '', im = sp.querySelector('img.av-logo');
        if (u === (im ? im.getAttribute('src') : '')) return;
        const t = document.createElement('div'); t.innerHTML = avatarFornConteudo(nome); const novo = t.firstElementChild; if (novo) sp.replaceWith(novo);
    });
}
let _logoRenderT = null;
function logosRenderizar() {
    clearTimeout(_logoRenderT);
    _logoRenderT = setTimeout(() => {
        logosAtualizarBolinhas();
        const at = document.querySelector('.app-screen.active');   // só a lista de Fornecedores precisa redesenhar (rótulo Definir/Trocar logo)
        if (at && at.id === 'screen-fornecedores' && typeof renderListaFornecedoresUnificada === 'function') { try { renderListaFornecedoresUnificada(); } catch (e) { console.error(e); } }
    }, 250);
}
function chaveLogoExistente(nome) { const r = logoRes(nome); return r ? r.k : ''; }
// 2.73.12: a imagem guardada (data:) vira um endereço curto (blob:) uma única vez. Antes o texto inteiro da imagem era copiado dentro de
// cada cartão (dezenas de KB por tela), o que pesava a tela e fazia o iPhone engasgar ao redesenhar.
const _blobLogo = new Map();
function logoUrlLeve(u) {
    if (!/^data:image\/[a-z+.-]+;base64,/i.test(u)) return u;
    let b = _blobLogo.get(u); if (b) return b;
    try {
        const i = u.indexOf(','), bin = atob(u.slice(i + 1)), a = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k);
        b = URL.createObjectURL(new Blob([a], { type: /^data:([^;,]+)/.exec(u)[1] })); _blobLogo.set(u, b); return b;
    } catch (e) { return u; }
}
function logoFornDe(nome, cnpj) {
    const r = logoRes(nome, cnpj); if (!r) return '';
    return r.ent.u ? logoUrlLeve(r.ent.u) : (r.ent.d ? logoDevUrl(r.ent.d, false) : '');   // só com o site guardado, a logo vem da Logo.dev na hora de mostrar
}
// conteúdo da bolinha: imagem (se houver logo) ou iniciais — troca direta de ${iniciaisControle(nome)}
function avatarFornConteudo(nome) {
    const u = logoFornDe(nome);
    const ini = escRel(iniciaisControle(nome));
    const miolo = u ? `<img class="av-logo" src="${escRel(u)}" alt="" loading="lazy" decoding="async" data-ini="${ini}" onerror="this.outerHTML=this.dataset.ini">` : ini;
    // a bolinha guarda o nome do fornecedor; tocar nela leva ao cadastro dele
    return String(nome || '').trim() ? `<span class="av-fn" data-forn="${escRel(String(nome).replace(/<[^>]*>/g, ''))}">${miolo}</span>` : miolo;
}
window.avatarFornConteudo = avatarFornConteudo;

// ---- tocar na bolinha → vai EXATAMENTE ao cadastro reconhecido (sem pesquisa), ou explica que não há cadastro ----
function irParaCartaoFornecedor(chave) {
    // já deixa só este fornecedor selecionado ANTES de trocar de tela: a tela desenha uma única vez (e só um cartão)
    fornecedoresCardAbertos.add(chave); filtroCadastroFornecedoresSpDataTexto = ''; limiteExibicaoFornecedores = LOTE_FORNECEDORES; fornecedorFocoChave = chave;
    const inp = document.querySelector('#screen-fornecedores input.form-field'); if (inp) inp.value = '';
    switchToScreen('screen-fornecedores', 'Fornecedores');
    setTimeout(() => { fornecedorFocoChave = chave; renderListaFornecedoresUnificada(); try { window.scrollTo({ top: 0 }); } catch (e) { } }, 90);
}
try { envolverComRetorno('irParaCartaoFornecedor'); } catch (e) { }   // o Voltar devolve você para a tela de onde saiu
function abrirFornecedorDaBolinha(nome) {
    nome = String(nome || '').trim(); if (!nome) return;
    const e = entidadeForn(nome, '');
    if (e.chave) { try { closeAllModals(); } catch (x) { } irParaCartaoFornecedor(e.chave); } else abrirSemCadastroForn(nome);
}
window.abrirFornecedorDaBolinha = abrirFornecedorDaBolinha; window.irParaFornecedorPorNome = abrirFornecedorDaBolinha;
(function () {   // sair da tela Fornecedores desfaz o "mostrando só este fornecedor"
    if (typeof switchToScreen !== 'function') return;
    const o = switchToScreen;
    switchToScreen = function (id) {
        if (id !== 'screen-fornecedores' && typeof fornecedorFocoChave !== 'undefined') fornecedorFocoChave = '';
        const r = o.apply(this, arguments);
        setTimeout(logosAtualizarBolinhas, 80);   // tela desenhada antes de as logos chegarem
        return r;
    };
})();
function abrirSemCadastroForn(nome) {
    const enc = encodeURIComponent(nome).replace(/'/g, '%27');
    let m = document.getElementById('forn-sem-cad-modal');
    if (!m) { m = document.createElement('div'); m.id = 'forn-sem-cad-modal'; m.className = 'modal-screen'; document.body.appendChild(m); }
    m.innerHTML = `<div class="modal-content"><h2>Fornecedor sem cadastro</h2>
        <p><b>${escRel(nome)}</b></p>
        <p class="txt-aux">Esse nome veio da própria nota (compra direta ou sem XML) e não está em Fornecedores. A logo que você escolher fica guardada para ele e continua valendo se você cadastrar ou vincular depois.</p>
        <button type="button" class="actions-button is-primary" style="width:100%;min-height:48px" onclick="abrirLogoFornecedor('${enc}','')">${logoFornDe(nome) ? 'Trocar logo' : 'Definir logo'}</button>
        <button type="button" class="actions-button" style="width:100%;min-height:48px;margin-top:10px" onclick="semCadastroCriar('${enc}')">Criar cadastro simples</button>
        <div class="central-spdata-busca" style="margin-top:14px"><label class="txt-aux">Ou vincule a um fornecedor já cadastrado (não apaga nada):</label>
        ${seletorVinculoFornecedorHTML('semcad', [], nome, new Set(), (id, op) => confirmarVinculoLegado(nome, id, op.titulo))}</div>
        <button type="button" class="actions-button" style="width:100%;min-height:48px;margin-top:14px" onclick="closeAllModals()">Fechar</button></div>`;
    m.classList.add('active');
}
async function semCadastroCriar(enc) {
    const n = (typeof nomeTextoSeguro === 'function' ? nomeTextoSeguro(decodeURIComponent(enc)) : decodeURIComponent(enc)).toUpperCase();
    await adicionarFornecedor(n, true); closeAllModals(); toast('Cadastro simples criado.');
    irParaCartaoFornecedor('lg:' + n);
}
window.semCadastroCriar = semCadastroCriar;
document.addEventListener('click', ev => {
    const av = ev.target && ev.target.closest && ev.target.closest('.ctl-av,.ini-ai,.nv-sym'); if (!av) return;
    if (av.closest('#screen-fornecedores,#logo-forn-modal,#logos-lote-modal,#forn-sem-cad-modal')) return;   // lá o toque no cartão já abre/fecha
    const m = av.querySelector('[data-forn]'); if (!m) return;
    ev.preventDefault(); ev.stopPropagation(); abrirFornecedorDaBolinha(m.getAttribute('data-forn'));
}, true);

// ---- leitura (com nova tentativa até o login terminar) ----
(function () {
    let ligado = false, tent = 0;
    const ligar = () => {
        if (ligado || tent++ > 40) return;
        try {
            settingsDocRef.parent.doc('logosFornecedores').onSnapshot(d => {
                ligado = true; logosFornecedores = (d.exists && d.data().logos) || {}; logoCacheLimpa(); logosAgendarProtecao(); logosRenderizar();
            }, () => { ligado = false; setTimeout(ligar, 4000); });
        } catch (e) { setTimeout(ligar, 2000); }
    };
    setTimeout(ligar, 2500);
})();

// Proteção: toda logo que já existe passa a ser alcançável por TODAS as identificações do fornecedor (CNPJ, razão social, apelido, nomes
// vinculados). Assim, mudar o apelido ou vincular depois não faz a logo sumir. Só acrescenta apontamentos; nunca apaga nem troca logo.
let _protTimer = null;
function logosAgendarProtecao() { clearTimeout(_protTimer); _protTimer = setTimeout(logosProtegerRefs, 5000); }
async function logosProtegerRefs() {
    try {
        if (!Object.keys(logosFornecedores).length || !(listaFornecedoresSpData || []).length) return;
        const novos = {};
        Object.keys(logosFornecedores).forEach(k => {
            const en = logosFornecedores[k]; if (!en || en.r || !(en.u || en.d)) return;
            const e = entidadeForn(k, ''); if (!e.cadastro) return;
            e.keys.forEach(x => { if (x !== k && !logosFornecedores[x] && !novos[x]) novos[x] = { r: k }; });
        });
        if (!Object.keys(novos).length) return;
        await settingsDocRef.parent.doc('logosFornecedores').set({ logos: novos }, { merge: true });
        Object.assign(logosFornecedores, novos); logoCacheLimpa();
    } catch (e) { console.error('proteção das logos', e); }
}
setTimeout(logosAgendarProtecao, 9000);

// ---- janela para definir a logo ----
let _logoPend = null, _logoChave = '', _logoNome = '', _logoCnpj = '', _logoDom = '';
function abrirLogoFornecedor(nomeEnc, cnpj) {
    try { closeAllModals(); } catch (e) { }   // evita a janela anterior ficar por baixo desta
    _siteCands = []; _siteI = -1; _siteAuto = '';
    _logoCnpj = String(cnpj || '').replace(/\D/g, ''); _logoNome = decodeURIComponent(nomeEnc); _logoChave = nomeBaseLogoForn(_logoNome); _logoPend = undefined; _logoDom = '';
    const _ent = entidadeForn(_logoNome, _logoCnpj), _res = logoRes(_logoNome, _logoCnpj);
    if (_logoCnpj.length !== 14 && _ent.cnpjs[0]) { const d14 = String(_ent.cnpjs[0].cnpj || '').replace(/\D/g, ''); if (d14.length === 14) _logoCnpj = d14; }
    let m = document.getElementById('logo-forn-modal');
    if (!m) { m = document.createElement('div'); m.id = 'logo-forn-modal'; m.className = 'modal-screen'; document.body.appendChild(m); }
    const tem = !!_res;   // qualquer logo que esteja valendo para este fornecedor pode ser removida
    m.innerHTML = `<div class="modal-content"><h2>Logo do fornecedor</h2>
        <p>${escRel(_logoNome)}</p>
        <p class="txt-aux" style="margin-top:-6px">${_ent.cadastro ? 'Reconhecido como: <b>' + escRel(_ent.nomeExibido || _ent.nomeReal) + '</b>' + (_ent.cnpjs[0] ? ' · CNPJ ' + escRel(typeof formatarCnpjExibicao === 'function' ? formatarCnpjExibicao(_ent.cnpjs[0].cnpj) : _ent.cnpjs[0].cnpj) : '') : 'Sem cadastro em Fornecedores: a logo fica guardada para este nome.'}</p>
        <div class="logo-forn-prev"><div class="ctl-av" id="logo-forn-prev">${avatarFornConteudo(_logoNome)}</div></div>
        <button type="button" class="actions-button is-primary" id="logo-forn-auto" style="width:100%;min-height:48px" onclick="logoFornBuscarAuto()">Buscar logo automaticamente</button>
        <button type="button" class="actions-button" style="width:100%;min-height:48px;margin-top:10px" onclick="logoFornPesquisarGoogle()">Pesquisar logotipo no Google</button>
        <div class="confirm-actions" style="margin-top:10px"><button type="button" class="actions-button" onclick="logoFornColar()">Colar imagem</button>
        <button type="button" class="actions-button" onclick="document.getElementById('logo-forn-arq').click()">Enviar imagem</button></div>
        <div id="logo-forn-colar" class="logo-forn-colar" contenteditable="true" hidden data-ph="Toque e segure aqui, depois escolha Colar" onpaste="logoFornColou(event)" autocapitalize="off" spellcheck="false"></div>
        <div class="txt-aux" style="margin-top:8px">No Google, abra a imagem certa, segure nela e escolha Copiar. Volte aqui, toque em "Colar imagem" e cole no quadro.</div>
        <input type="file" id="logo-forn-arq" accept="image/*" style="display:none" onchange="logoFornArquivo(this)">
        <label class="dev-lbl" style="margin-top:14px">Ou pelo site do fornecedor<input type="text" id="logo-forn-site" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="ex.: futura.com.br" value="${escRel((_res && _res.ent.d) || '')}"></label>
        <button type="button" class="actions-button" style="width:100%;min-height:48px;margin-top:10px" onclick="logoFornBuscarSite()">Ícone do site</button>
        <div class="txt-aux" id="logo-forn-msg" style="margin-top:8px"></div>
        <div class="confirm-actions pend-acoes"><button type="button" class="actions-button" onclick="closeAllModals()">Cancelar</button>
        ${tem ? `<button type="button" class="actions-button is-danger" onclick="logoFornSalvar(true)">Remover</button>` : ''}
        <button type="button" class="actions-button is-primary" onclick="logoFornSalvar(false)">Salvar</button></div></div>`;
    m.classList.add('active');
}
function logoFornPrever(url) {
    _logoPend = url; const el = document.getElementById('logo-forn-prev'); if (!el) return;
    el.innerHTML = `<img class="av-logo" src="${escRel(url)}" alt="">`;
    const img = el.querySelector('img'); img.onerror = () => { _logoPend = undefined; el.innerHTML = escRel(iniciaisControle(_logoNome)); const g = document.getElementById('logo-forn-msg'); if (g) g.textContent = 'Não consegui carregar essa imagem. Confira o site ou envie uma imagem.'; };
}
// "Ícone do site": se o campo estiver vazio, o app monta combinações com o nome do fornecedor (apelido.com.br, apelido.com, 1ª palavra...) e
// mostra uma por vez, pulando as que não têm logo. Toque de novo para ver a próxima. Se você digitar o site, usa exatamente o que digitou.
let _siteCands = [], _siteI = -1, _siteAuto = '';
const PALAVRAS_SITE_FRACAS = new Set(['ltda', 'me', 'epp', 'eireli', 'sa', 'de', 'da', 'do', 'das', 'dos', 'e', 'comercio', 'comercial', 'industria', 'ind', 'distribuidora', 'distribuicao', 'servicos', 'produtos', 'materiais', 'hospitalares', 'hospitalar', 'medicos', 'medico', 'cia', 'grupo', 'filial', 'matriz']);
function candidatosSiteForn(nome) {
    const bases = []; try { bases.push(nomeExibicaoFornecedor(nome, '') || nome); } catch (e) { }
    bases.push(nome); try { bases.push(entidadeForn(nome, _logoCnpj).nomeReal); } catch (e) { }
    const out = [], add = d => { if (/^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/.test(d) && !out.includes(d)) out.push(d); };
    bases.filter(Boolean).forEach(b => {
        const w = chaveLogoForn(b).toLowerCase().split(' ').filter(x => x && !PALAVRAS_SITE_FRACAS.has(x) && !/^\d+$/.test(x));
        if (!w.length) return;
        [w.join(''), w.slice(0, 2).join(''), w[0], w.slice(0, 2).join('-')].forEach(sl => { if (sl && sl.length >= 3) { add(sl + '.com.br'); add(sl + '.com'); } });
    });
    return out.slice(0, 12);
}
function logoFornBuscarSite() {
    const inp = document.getElementById('logo-forn-site'), g = document.getElementById('logo-forn-msg'); if (!inp) return;
    const digitado = dominioLimpo(inp.value); if (g) g.textContent = '';
    if (digitado && digitado !== _siteAuto) {   // você digitou: usa exatamente isso
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(digitado)) { if (g) g.textContent = 'Digite o endereço do site, por exemplo futura.com.br.'; return; }
        _logoDom = digitado; _siteCands = []; _siteI = -1; _siteAuto = ''; logoFornPrever(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(digitado)}&sz=128`); return;
    }
    if (!_siteCands.length) { _siteCands = candidatosSiteForn(_logoNome); _siteI = -1; }
    if (!_siteCands.length) { if (g) g.textContent = 'Não consegui montar combinações com esse nome. Digite o site, por exemplo futura.com.br.'; return; }
    siteMostrar(_siteCands.length);
}
function siteMostrar(restantes) {
    const inp = document.getElementById('logo-forn-site'), g = document.getElementById('logo-forn-msg'), n = _siteCands.length;
    _siteI = (_siteI + 1) % n; const d = _siteCands[_siteI], url = logoDevUrl(d, false), i0 = _siteI;
    if (g) g.textContent = 'Testando ' + d + '…';
    const im = new Image();
    const falha = () => { if (restantes > 1) siteMostrar(restantes - 1); else if (g) g.textContent = 'Nenhuma combinação tem logo. Digite o site correto e toque de novo.'; };
    im.onload = () => {
        if (im.naturalWidth < 8) return falha();
        if (inp) inp.value = d; _siteAuto = d; _logoDom = d; logoFornPrever(url);
        if (g) g.textContent = 'Opção ' + (i0 + 1) + ' de ' + n + ': ' + d + '. Não é essa? Toque de novo em "Ícone do site" para a próxima.';
    };
    im.onerror = falha; im.src = url;
}
// ---- Busca automática (Logo.dev) ----
// Só a chave PUBLICÁVEL (pk_) fica no app; ela foi feita para ser pública. A chave secreta (sk_) nunca entra no código do navegador.
const LOGODEV_PK = 'pk_Wl_NxluvTU6cw-PlD-I2uQ';
const logoDevUrl = (alvo, porNome) => `https://img.logo.dev/${porNome ? 'name/' : ''}${encodeURIComponent(alvo)}?token=${LOGODEV_PK}&size=128&format=png&fallback=404`;
const dominioLimpo = v => String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[\/?#\s]/)[0];
function nomeParaLogo(n) { return String(n || '').replace(/<[^>]*>/g, '').replace(/\b(EIRELI|LTDA|ME|EPP|S\/?A|SA|LTDA\.)\b/gi, '').replace(/\s+/g, ' ').trim(); }
async function logoFornBuscarAuto() {
    const g = document.getElementById('logo-forn-msg'), bt = document.getElementById('logo-forn-auto');
    if (g) g.textContent = 'Buscando logo…'; if (bt) { bt.disabled = true; bt.textContent = 'Buscando…'; }
    const dom = dominioLimpo((document.getElementById('logo-forn-site') || {}).value);
    let apelido = _logoNome; try { apelido = nomeExibicaoFornecedor(_logoNome, '') || _logoNome; } catch (e) { }
    const tentativas = [];
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dom)) tentativas.push(logoDevUrl(dom, false));   // 1) pelo site, se informado
    [apelido, _logoNome].map(nomeParaLogo).filter((n, i, a) => n && a.indexOf(n) === i).forEach(n => tentativas.push(logoDevUrl(n, true)));   // 2) pelo nome
    let achou = false;
    for (const u of tentativas) {
        try {
            const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
            const r = await fetch(u, { signal: ctl.signal }); clearTimeout(t);
            if (!r.ok) continue; const blob = await r.blob(); if (!/^image\//.test(blob.type) || blob.size < 200) continue;
            await new Promise(ok => { const rd = new FileReader(); rd.onload = () => { logoFornProcessar(rd.result); ok(); }; rd.readAsDataURL(blob); });
            if (u === tentativas[0] && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(dom)) _logoDom = dom;
            achou = true; break;
        } catch (e) {
            // sem leitura direta (rede/CORS): testa se a imagem carrega e, se sim, mostra pelo endereço
            const ok = await new Promise(res => { const im = new Image(); im.onload = () => res(im.naturalWidth > 8); im.onerror = () => res(false); im.src = u; });
            if (ok) { logoFornProcessar(u); achou = true; break; }
        }
    }
    if (bt) { bt.disabled = false; bt.textContent = 'Buscar logo automaticamente'; }
    if (g) g.textContent = achou ? 'Logo encontrada (Logo.dev). Confira a prévia e toque em Salvar.' : 'Não foi possível buscar automaticamente. Use "Pesquisar logotipo no Google", cole ou envie a imagem, ou informe o site e tente de novo.';
}
window.logoFornBuscarAuto = logoFornBuscarAuto;
// leandromendonssa
function logoFornPesquisarGoogle() {
    const base = (() => { try { return nomeExibicaoFornecedor(_logoNome, '') || _logoNome; } catch (e) { return _logoNome; } })();
    window.open('https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(String(base).replace(/<[^>]*>/g, '') + ' logotipo'), '_blank');
}
// reduz qualquer imagem para um quadrado de 96 px (JPEG) e mostra a prévia
function logoFornProcessar(src) {
    const im = new Image(); if (/^https?:/i.test(src)) im.crossOrigin = 'anonymous'; im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, 96, 96);
        const e = Math.max(im.width, im.height), w = 96 * im.width / e, h = 96 * im.height / e;   // inteira, sem cortar a logo
        x.drawImage(im, (96 - w) / 2, (96 - h) / 2, w, h);
        logoFornPrever(c.toDataURL('image/jpeg', 0.88));
      } catch (e) { logoFornPrever(src); } };   // imagem sem permissão de leitura (CORS): guarda o endereço em vez de reduzir
    im.onerror = () => { const g = document.getElementById('logo-forn-msg'); if (g) g.textContent = 'Não consegui ler essa imagem.'; };
    im.src = src;
}
// 2.73.9: colar pelo campo de colagem do próprio iPhone (evento "paste"). A leitura direta da área de transferência
// (navigator.clipboard.read) pisca e é bloqueada pelo iOS, e só entregava o "objeto recortado". No campo, o iPhone entrega a imagem inteira
// do jeito que foi copiada (arquivo, ou o endereço da imagem quando o site não permite copiar o arquivo).
function logoFornColar() {
    const g = document.getElementById('logo-forn-msg'), c = document.getElementById('logo-forn-colar'); if (!c) return;
    if (g) g.textContent = 'Toque e segure no quadro abaixo e escolha Colar.';
    c.hidden = false; c.innerHTML = ''; try { c.focus(); } catch (e) { }
    try { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { }
}
function logoFornColou(ev) {
    ev.preventDefault();
    const g = document.getElementById('logo-forn-msg'), c = document.getElementById('logo-forn-colar'), cd = ev.clipboardData; if (!cd) return;
    const limpar = () => { if (c) { c.innerHTML = ''; c.hidden = true; c.blur(); } };
    const arq = Array.from(cd.files || []).find(f => /^image\//.test(f.type)) || (Array.from(cd.items || []).find(i => i.kind === 'file' && /^image\//.test(i.type)) || { getAsFile: () => null }).getAsFile();
    if (arq) { const rd = new FileReader(); rd.onload = () => logoFornProcessar(rd.result); rd.readAsDataURL(arq); if (g) g.textContent = 'Imagem colada. Confira a prévia e toque em Salvar.'; limpar(); return; }
    // sem arquivo: tenta o endereço da imagem (no HTML copiado ou no texto)
    let src = ''; const html = cd.getData('text/html') || '';
    const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html); if (m) src = m[1].replace(/&amp;/g, '&');
    if (!src) { const t = (cd.getData('text/uri-list') || cd.getData('text/plain') || '').trim().split(/\s+/)[0]; if (/^(https?:\/\/|data:image\/)/i.test(t)) src = t; }
    if (src) { logoFornProcessar(src); if (g) g.textContent = 'Imagem colada. Confira a prévia e toque em Salvar.'; limpar(); return; }
    if (g) g.textContent = 'Não veio imagem. No Google, toque na imagem para abrir, segure e escolha Copiar (não "Copiar assunto"). Ou use "Enviar imagem".';
    limpar();
}
window.logoFornColou = logoFornColou;
window.logoFornPesquisarGoogle = logoFornPesquisarGoogle; window.logoFornColar = logoFornColar;
function logoFornArquivo(inp) {
    const f = inp.files && inp.files[0]; if (!f) return;
    const rd = new FileReader(); rd.onload = () => logoFornProcessar(rd.result);
    rd.readAsDataURL(f); inp.value = '';
}
async function logoFornSalvar(remover) {
    if (!remover && !_logoPend) { toast('Escolha uma imagem ou um site primeiro.'); return; }
    try {
        const F = firebase.firestore.FieldValue, e = entidadeForn(_logoNome, _logoCnpj), r = logoRes(_logoNome, _logoCnpj), doc = {};
        const todas = [...new Set(e.keys.concat([_logoChave, chaveLogoForn(_logoNome)]).filter(Boolean))];   // todas as identificações deste fornecedor
        if (remover) {
            const alvos = new Set(todas); if (r) alvos.add(r.k);
            Object.keys(logosFornecedores).forEach(k => { const en = logosFornecedores[k]; if (en && en.r && alvos.has(en.r)) alvos.add(k); });
            alvos.forEach(k => { if (logosFornecedores[k]) doc[k] = F.delete(); });
        } else {
            const principal = (r && logosFornecedores[r.k] && !logosFornecedores[r.k].r) ? r.k : (e.keys.find(k => k.startsWith('CNPJ:')) || chaveLogoForn(e.nomeReal) || _logoChave);
            doc[principal] = { u: _logoPend, ...(_logoDom ? { d: _logoDom } : {}) };
            todas.forEach(k => { if (k !== principal) doc[k] = { r: principal }; });
        }
        if (!Object.keys(doc).length) { closeAllModals(); return; }
        await settingsDocRef.parent.doc('logosFornecedores').set({ logos: doc }, { merge: true });
        Object.keys(doc).forEach(k => { if (remover) delete logosFornecedores[k]; else logosFornecedores[k] = doc[k]; });
        logoCacheLimpa(); closeAllModals(); toast(remover ? 'Logo removida.' : 'Logo salva.'); logosRenderizar();
    } catch (e) { console.error('Erro ao salvar logo:', e); toast('✕ Não consegui salvar a logo. Tente de novo.'); }
}
window.abrirLogoFornecedor = abrirLogoFornecedor; window.logoFornBuscarSite = logoFornBuscarSite; window.logoFornArquivo = logoFornArquivo; window.logoFornSalvar = logoFornSalvar;

// ---- Lote: copiar lista (CNPJ;nome) e aplicar sites (CNPJ;site) ----
const cnpjDigitos = v => String(v || '').replace(/\D/g, '');
function fornecedoresComCnpj() {
    const r = [];
    try { listaFornecedoresUnificada().forEach(f => (f.cnpjs || []).forEach(c => { const d = cnpjDigitos(c.cnpj); if (d.length === 14) r.push({ cnpj: d, nome: f.nomeExibido || f.nomeReal, real: f.nomeReal }); })); } catch (e) { }
    return r.filter((x, i, a) => a.findIndex(y => y.cnpj === x.cnpj) === i);
}
function abrirLogosEmLote() {
    let m = document.getElementById('logos-lote-modal');
    if (!m) { m = document.createElement('div'); m.id = 'logos-lote-modal'; m.className = 'modal-screen'; document.body.appendChild(m); }
    const n = fornecedoresComCnpj().length, com = Object.values(logosFornecedores).filter(e => e && (e.u || e.d) && !e.r).length;
    m.innerHTML = `<div class="modal-content"><h2>Logos dos fornecedores</h2>
        <p style="font-size:12px;color:var(--text-light)">${n} fornecedor(es) com CNPJ · ${com} com logo. Copie a lista e me envie; eu devolvo o site de cada um (linhas "CNPJ;site") e você cola abaixo. Com o site certo, a logo vem sozinha.</p>
        <button type="button" class="actions-button" style="width:100%;min-height:48px" onclick="logosLoteCopiar()">Copiar lista de fornecedores</button>
        <label class="dev-lbl" style="margin-top:14px">Sites recebidos (um por linha: CNPJ;site)<textarea id="logos-lote-txt" rows="6" placeholder="08231734000517;futura.com.br" style="width:100%"></textarea></label>
        <div class="txt-aux" id="logos-lote-msg" style="margin-top:6px"></div>
        <div class="confirm-actions pend-acoes"><button type="button" class="actions-button" onclick="closeAllModals()">Fechar</button>
        <button type="button" class="actions-button is-primary" onclick="logosLoteAplicar()">Aplicar sites</button></div></div>`;
    m.classList.add('active');
}
async function logosLoteCopiar() {
    const txt = fornecedoresComCnpj().map(x => `${x.cnpj};${x.nome}`).join('\n'), g = document.getElementById('logos-lote-msg');
    try { await navigator.clipboard.writeText(txt); if (g) g.textContent = 'Lista copiada. Cole na conversa comigo.'; }
    catch (e) { const t = document.getElementById('logos-lote-txt'); if (t) { t.value = txt; t.select(); } if (g) g.textContent = 'Não consegui copiar sozinho. A lista está na caixa abaixo: selecione tudo e copie.'; }
}
async function logosLoteAplicar() {
    const g = document.getElementById('logos-lote-msg'), forn = fornecedoresComCnpj(), novos = {}; let ok = 0, sem = 0;
    ((document.getElementById('logos-lote-txt') || {}).value || '').split(/\n+/).forEach(l => {
        const [c, site] = l.split(/[;\t]/).map(x => (x || '').trim()); const d = cnpjDigitos(c), dom = dominioLimpo(site);
        if (!d || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dom)) return;
        const f = forn.find(x => x.cnpj === d); if (!f) { sem++; return; }
        const e = entidadeForn(f.real || f.nome, d), r = logoRes(f.real || f.nome, d);
        ok++; if (r && r.ent.u) return;   // não sobrescreve logo escolhida à mão
        const principal = (r && !logosFornecedores[r.k].r) ? r.k : (e.keys.find(k => k.startsWith('CNPJ:')) || chaveLogoForn(e.nomeReal));
        if (!principal || novos[principal]) return;
        novos[principal] = { d: dom };
        e.keys.forEach(k => { if (k !== principal && !novos[k] && !(logosFornecedores[k] && !logosFornecedores[k].r && (logosFornecedores[k].u || logosFornecedores[k].d))) novos[k] = { r: principal }; });
    });
    if (!ok) { if (g) g.textContent = 'Nenhuma linha válida. Use CNPJ;site, uma por linha.' + (sem ? ' (' + sem + ' CNPJ(s) não estão na sua lista.)' : ''); return; }
    try {
        await settingsDocRef.parent.doc('logosFornecedores').set({ logos: novos }, { merge: true });
        Object.assign(logosFornecedores, novos); logoCacheLimpa();
        closeAllModals(); toast(`Sites aplicados: ${ok} fornecedor(es).`); logosRenderizar();
    } catch (e) { console.error(e); if (g) g.textContent = 'Não consegui salvar agora. Tente de novo.'; }
}
window.abrirLogosEmLote = abrirLogosEmLote; window.logosLoteCopiar = logosLoteCopiar; window.logosLoteAplicar = logosLoteAplicar;
// botão de entrada na tela Fornecedores
(function () {
    if (typeof renderListaFornecedoresUnificada !== 'function') return;
    const o = renderListaFornecedoresUnificada;
    renderListaFornecedoresUnificada = function () {
        const r = o.apply(this, arguments);
        try { const c = document.getElementById('contador-fornecedores-spdata'); if (c && !document.getElementById('btn-logos-lote')) c.insertAdjacentHTML('afterend', '<div class="nfe-acoes"><button type="button" class="central-status-toggle" id="btn-logos-lote" onclick="abrirLogosEmLote()">Logos dos fornecedores</button></div>'); } catch (e) { }
        return r;
    };
})();

// Botão no cartão do fornecedor (tela Fornecedores do ERP)
(function () {
    if (typeof cartaoFornecedorHTML !== 'function') return;
    const o = cartaoFornecedorHTML;
    cartaoFornecedorHTML = function (chave, nome, subHTML, chipHTML, corpoHTML, aberto) {
        const cnpjCartao = ((String(subHTML || '').match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/) || [''])[0]);
        const extra = `<div class="nfe-acoes"><button type="button" class="central-status-toggle" onclick="abrirLogoFornecedor('${encodeURIComponent(String(nome).replace(/<[^>]*>/g, '')).replace(/'/g, '%27')}', '${cnpjCartao}')">${logoFornDe(nome, cnpjCartao) ? 'Trocar logo' : 'Definir logo'}</button></div>`;
        return o.call(this, chave, nome, subHTML, chipHTML, (corpoHTML || '') + extra, aberto);
    };
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/66-logos-fornecedores.js'] = '2.73.13';
// leandromendonssa

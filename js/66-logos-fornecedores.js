// 66-logos-fornecedores.js — Logo do fornecedor nas bolinhas (2.73.3)
// Você escolhe uma vez por fornecedor: enviando uma imagem (reduzida para 96 px) ou informando o site (usa o ícone do site). Sem logo, continuam as iniciais.
// Guardado em config/logosFornecedores { logos: { CHAVE: { u: 'data:… ou https://…' } } } — um documento só, separado das configurações.
let logosFornecedores = {};
function chaveLogoForn(nome) {
    return String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/<[^>]*>/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function nomeBaseLogoForn(nome) { let n = nome; try { n = nomeExibicaoFornecedor(nome, '') || nome; } catch (e) { } return chaveLogoForn(n); }
function logoFornDe(nome) {
    const k = nomeBaseLogoForn(nome); if (!k) return '';
    if (logosFornecedores[k]) return logosFornecedores[k].u || '';
    for (const c in logosFornecedores) if (c.length >= 4 && k.length >= 4 && (k.startsWith(c + ' ') || c.startsWith(k + ' '))) return logosFornecedores[c].u || '';
    return '';
}
// conteúdo da bolinha: imagem (se houver logo) ou iniciais — troca direta de ${iniciaisControle(nome)}
function avatarFornConteudo(nome) {
    const u = logoFornDe(nome);
    const ini = escRel(iniciaisControle(nome));
    return u ? `<img class="av-logo" src="${escRel(u)}" alt="" loading="lazy" data-ini="${ini}" onerror="this.outerHTML=this.dataset.ini">` : ini;
}
window.avatarFornConteudo = avatarFornConteudo;

// ---- leitura (com nova tentativa até o login terminar) ----
(function () {
    let ligado = false, tent = 0;
    const ligar = () => {
        if (ligado || tent++ > 40) return;
        try {
            settingsDocRef.parent.doc('logosFornecedores').onSnapshot(d => {
                ligado = true; logosFornecedores = (d.exists && d.data().logos) || {};
                ['renderInicio', 'renderControleNfs', 'renderListaFornecedoresUnificada'].forEach(f => { try { if (typeof window[f] === 'function') window[f](); } catch (e) { } });
            }, () => { ligado = false; setTimeout(ligar, 4000); });
        } catch (e) { setTimeout(ligar, 2000); }
    };
    setTimeout(ligar, 2500);
})();

// ---- janela para definir a logo ----
let _logoPend = null, _logoChave = '', _logoNome = '', _logoCnpj = '';
function abrirLogoFornecedor(nomeEnc, cnpj) {
    _logoCnpj = String(cnpj || '').replace(/\D/g, ''); _logoNome = decodeURIComponent(nomeEnc); _logoChave = nomeBaseLogoForn(_logoNome); _logoPend = undefined;
    let m = document.getElementById('logo-forn-modal');
    if (!m) { m = document.createElement('div'); m.id = 'logo-forn-modal'; m.className = 'modal-screen'; document.body.appendChild(m); }
    const tem = !!logosFornecedores[_logoChave];
    m.innerHTML = `<div class="modal-content"><h2>Logo do fornecedor</h2>
        <p>${escRel(_logoNome)}</p>
        <div class="logo-forn-prev"><div class="ctl-av" id="logo-forn-prev">${avatarFornConteudo(_logoNome)}</div></div>
        <button type="button" class="actions-button" style="width:100%;min-height:48px" onclick="logoFornPesquisarGoogle()">Pesquisar logotipo no Google</button>
        <div class="confirm-actions" style="margin-top:10px"><button type="button" class="actions-button" onclick="logoFornColar()">Colar imagem</button>
        <button type="button" class="actions-button" onclick="document.getElementById('logo-forn-arq').click()">Enviar imagem</button></div>
        <div class="txt-aux" style="margin-top:8px">No Google, toque e segure a imagem certa, escolha Copiar, volte aqui e toque em "Colar imagem".</div>
        <input type="file" id="logo-forn-arq" accept="image/*" style="display:none" onchange="logoFornArquivo(this)">
        <label class="dev-lbl" style="margin-top:14px">Ou pelo site do fornecedor<input type="text" id="logo-forn-site" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="ex.: futura.com.br"></label>
        <div class="confirm-actions" style="margin-top:10px"><button type="button" class="actions-button" onclick="logoFornBuscarSite()">Ícone do site</button>
        ${_logoCnpj.length === 14 ? `<button type="button" class="actions-button" onclick="logoFornBuscarCnpj()">Site pelo CNPJ</button>` : ''}</div>
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
function logoFornBuscarSite() {
    const v = ((document.getElementById('logo-forn-site') || {}).value || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[\/?#]/)[0];
    const g = document.getElementById('logo-forn-msg'); if (g) g.textContent = '';
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)) { if (g) g.textContent = 'Digite o endereço do site, por exemplo futura.com.br.'; return; }
    logoFornPrever(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(v)}&sz=128`);
}
// Busca automática: consulta pública do CNPJ (BrasilAPI, dados da Receita) → e-mail da empresa → domínio → ícone do site.
// O cadastro público não traz o site em si; só funciona quando o e-mail é corporativo (não Gmail, Hotmail etc.).
const DOMINIOS_EMAIL_LIVRES = /^(gmail|hotmail|outlook|live|yahoo|uol|bol|terra|ig|globo|globomail|icloud|msn|r7|zipmail|oi|veloxmail|mail|protonmail)\./i;
async function logoFornBuscarCnpj() {
    const g = document.getElementById('logo-forn-msg'); if (g) g.textContent = 'Consultando o CNPJ…';
    try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
        const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + _logoCnpj, { signal: ctl.signal }); clearTimeout(t);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json(); const em = String(d.email || '').toLowerCase().trim();
        const dom = em.includes('@') ? em.split('@')[1] : '';
        if (!dom || DOMINIOS_EMAIL_LIVRES.test(dom)) { if (g) g.textContent = dom ? 'O e-mail cadastrado é pessoal (' + dom + '), então não dá para achar o site. Informe o site ou envie a imagem.' : 'O cadastro público desse CNPJ não traz e-mail. Informe o site ou envie a imagem.'; return; }
        const inp = document.getElementById('logo-forn-site'); if (inp) inp.value = dom;
        if (g) g.textContent = 'Site encontrado pelo e-mail do cadastro: ' + dom + '. Confira se a logo é a certa.';
        logoFornPrever(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=128`);
    } catch (e) { if (g) g.textContent = 'Não consegui consultar o CNPJ agora. Tente de novo ou informe o site.'; }
}
window.logoFornBuscarCnpj = logoFornBuscarCnpj;
function logoFornPesquisarGoogle() {
    const base = (() => { try { return nomeExibicaoFornecedor(_logoNome, '') || _logoNome; } catch (e) { return _logoNome; } })();
    window.open('https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(String(base).replace(/<[^>]*>/g, '') + ' logotipo'), '_blank');
}
// reduz qualquer imagem para um quadrado de 96 px (JPEG) e mostra a prévia
function logoFornProcessar(src) {
    const im = new Image(); im.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, 96, 96);
        const e = Math.max(im.width, im.height), w = 96 * im.width / e, h = 96 * im.height / e;   // inteira, sem cortar a logo
        x.drawImage(im, (96 - w) / 2, (96 - h) / 2, w, h);
        logoFornPrever(c.toDataURL('image/jpeg', 0.88)); };
    im.onerror = () => { const g = document.getElementById('logo-forn-msg'); if (g) g.textContent = 'Não consegui ler essa imagem.'; };
    im.src = src;
}
async function logoFornColar() {
    const g = document.getElementById('logo-forn-msg'); if (g) g.textContent = '';
    try {
        const itens = await navigator.clipboard.read();
        for (const it of itens) { const t = it.types.find(x => x.startsWith('image/')); if (t) { const blob = await it.getType(t); const rd = new FileReader(); rd.onload = () => logoFornProcessar(rd.result); rd.readAsDataURL(blob); return; } }
        if (g) g.textContent = 'Não há imagem copiada. No Google, toque e segure a imagem e escolha Copiar.';
    } catch (e) { if (g) g.textContent = 'Não consegui ler a área de transferência. Permita colar quando o iPhone perguntar, ou salve a imagem em Fotos e use "Enviar imagem".'; }
}
window.logoFornPesquisarGoogle = logoFornPesquisarGoogle; window.logoFornColar = logoFornColar;
function logoFornArquivo(inp) {
    const f = inp.files && inp.files[0]; if (!f) return;
    const rd = new FileReader(); rd.onload = () => logoFornProcessar(rd.result);
    rd.readAsDataURL(f); inp.value = '';
}
async function logoFornSalvar(remover) {
    if (!remover && !_logoPend) { toast('Escolha uma imagem ou um site primeiro.'); return; }
    try {
        await settingsDocRef.parent.doc('logosFornecedores').set({ logos: { [_logoChave]: remover ? firebase.firestore.FieldValue.delete() : { u: _logoPend } } }, { merge: true });
        if (remover) delete logosFornecedores[_logoChave]; else logosFornecedores[_logoChave] = { u: _logoPend };
        closeAllModals(); toast(remover ? 'Logo removida.' : 'Logo salva.');
        ['renderInicio', 'renderControleNfs', 'renderListaFornecedoresUnificada'].forEach(f => { try { if (typeof window[f] === 'function') window[f](); } catch (e) { } });
    } catch (e) { console.error('Erro ao salvar logo:', e); toast('✕ Não consegui salvar a logo. Tente de novo.'); }
}
window.abrirLogoFornecedor = abrirLogoFornecedor; window.logoFornBuscarSite = logoFornBuscarSite; window.logoFornArquivo = logoFornArquivo; window.logoFornSalvar = logoFornSalvar;

// Botão no cartão do fornecedor (tela Fornecedores do ERP)
(function () {
    if (typeof cartaoFornecedorHTML !== 'function') return;
    const o = cartaoFornecedorHTML;
    cartaoFornecedorHTML = function (chave, nome, subHTML, chipHTML, corpoHTML, aberto) {
        const extra = `<div class="nfe-acoes"><button type="button" class="central-status-toggle" onclick="abrirLogoFornecedor('${encodeURIComponent(String(nome).replace(/<[^>]*>/g, '')).replace(/'/g, '%27')}', '${((String(subHTML || '').match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/) || [''])[0])}')">${logoFornDe(nome) ? 'Trocar logo' : 'Definir logo'}</button></div>`;
        return o.call(this, chave, nome, subHTML, chipHTML, (corpoHTML || '') + extra, aberto);
    };
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/66-logos-fornecedores.js'] = '2.73.5';
// leandromendonssa

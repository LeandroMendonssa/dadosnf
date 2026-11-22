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
let _logoPend = null, _logoChave = '', _logoNome = '';
function abrirLogoFornecedor(nomeEnc) {
    _logoNome = decodeURIComponent(nomeEnc); _logoChave = nomeBaseLogoForn(_logoNome); _logoPend = undefined;
    let m = document.getElementById('logo-forn-modal');
    if (!m) { m = document.createElement('div'); m.id = 'logo-forn-modal'; m.className = 'modal-screen'; document.body.appendChild(m); }
    const tem = !!logosFornecedores[_logoChave];
    m.innerHTML = `<div class="modal-content"><h2>Logo do fornecedor</h2>
        <p>${escRel(_logoNome)}</p>
        <div class="logo-forn-prev"><div class="ctl-av" id="logo-forn-prev">${avatarFornConteudo(_logoNome)}</div></div>
        <label class="dev-lbl">Site do fornecedor<input type="text" id="logo-forn-site" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="ex.: futura.com.br"></label>
        <div class="confirm-actions" style="margin-top:12px"><button type="button" class="actions-button" onclick="logoFornBuscarSite()">Usar ícone do site</button>
        <button type="button" class="actions-button" onclick="document.getElementById('logo-forn-arq').click()">Enviar imagem</button></div>
        <input type="file" id="logo-forn-arq" accept="image/*" style="display:none" onchange="logoFornArquivo(this)">
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
function logoFornArquivo(inp) {
    const f = inp.files && inp.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { const im = new Image(); im.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, 96, 96);
        const e = Math.min(im.width, im.height), sx = (im.width - e) / 2, sy = (im.height - e) / 2; x.drawImage(im, sx, sy, e, e, 0, 0, 96, 96);
        logoFornPrever(c.toDataURL('image/jpeg', 0.85)); };
        im.onerror = () => { const g = document.getElementById('logo-forn-msg'); if (g) g.textContent = 'Não consegui ler essa imagem.'; };
        im.src = rd.result; };
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
        const extra = `<div class="nfe-acoes"><button type="button" class="central-status-toggle" onclick="abrirLogoFornecedor('${encodeURIComponent(String(nome).replace(/<[^>]*>/g, '')).replace(/'/g, '%27')}')">${logoFornDe(nome) ? 'Trocar logo' : 'Definir logo'}</button></div>`;
        return o.call(this, chave, nome, subHTML, chipHTML, (corpoHTML || '') + extra, aberto);
    };
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/66-logos-fornecedores.js'] = '2.73.3';
// leandromendonssa

// 66-logos-fornecedores.js — Logo do fornecedor nas bolinhas (2.73.3)
// Você escolhe uma vez por fornecedor: enviando uma imagem (reduzida para 96 px) ou informando o site (usa o ícone do site). Sem logo, continuam as iniciais.
// Guardado em config/logosFornecedores { logos: { CHAVE: { u: 'data:… ou https://…' } } } — um documento só, separado das configurações.
let logosFornecedores = {};
function chaveLogoForn(nome) {
    return String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/<[^>]*>/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function nomeBaseLogoForn(nome) { let n = nome; try { n = nomeExibicaoFornecedor(nome, '') || nome; } catch (e) { } return chaveLogoForn(n); }
// 2.73.9: a logo vale só para o MESMO nome de exibição (apelido). Nomes parecidos (um começando igual ao outro) não herdam mais.
// Fornecedores associados (matriz/filial/mesmo CNPJ base) já dividem o mesmo apelido, então dividem a logo sem precisar de regra de semelhança.
function chaveLogoExistente(nome) {
    const k = nomeBaseLogoForn(nome); if (!k) return '';
    return logosFornecedores[k] ? k : '';
}
function logoFornDe(nome) {
    const c = chaveLogoExistente(nome); if (!c) return ''; const e = logosFornecedores[c];
    return e.u || (e.d ? logoDevUrl(e.d, false) : '');   // só com o site guardado, a logo vem da Logo.dev na hora de mostrar
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
let _logoPend = null, _logoChave = '', _logoNome = '', _logoCnpj = '', _logoDom = '';
function abrirLogoFornecedor(nomeEnc, cnpj) {
    _logoCnpj = String(cnpj || '').replace(/\D/g, ''); _logoNome = decodeURIComponent(nomeEnc); _logoChave = nomeBaseLogoForn(_logoNome); _logoPend = undefined; _logoDom = '';
    let m = document.getElementById('logo-forn-modal');
    if (!m) { m = document.createElement('div'); m.id = 'logo-forn-modal'; m.className = 'modal-screen'; document.body.appendChild(m); }
    const tem = !!chaveLogoExistente(_logoNome);   // também conta logo herdada de nome parecido: assim sempre dá para remover
    m.innerHTML = `<div class="modal-content"><h2>Logo do fornecedor</h2>
        <p>${escRel(_logoNome)}</p>
        <div class="logo-forn-prev"><div class="ctl-av" id="logo-forn-prev">${avatarFornConteudo(_logoNome)}</div></div>
        <button type="button" class="actions-button is-primary" id="logo-forn-auto" style="width:100%;min-height:48px" onclick="logoFornBuscarAuto()">Buscar logo automaticamente</button>
        <button type="button" class="actions-button" style="width:100%;min-height:48px;margin-top:10px" onclick="logoFornPesquisarGoogle()">Pesquisar logotipo no Google</button>
        <div class="confirm-actions" style="margin-top:10px"><button type="button" class="actions-button" onclick="logoFornColar()">Colar imagem</button>
        <button type="button" class="actions-button" onclick="document.getElementById('logo-forn-arq').click()">Enviar imagem</button></div>
        <div id="logo-forn-colar" class="logo-forn-colar" contenteditable="true" hidden data-ph="Toque e segure aqui, depois escolha Colar" onpaste="logoFornColou(event)" autocapitalize="off" spellcheck="false"></div>
        <div class="txt-aux" style="margin-top:8px">No Google, abra a imagem certa, segure nela e escolha Copiar. Volte aqui, toque em "Colar imagem" e cole no quadro.</div>
        <input type="file" id="logo-forn-arq" accept="image/*" style="display:none" onchange="logoFornArquivo(this)">
        <label class="dev-lbl" style="margin-top:14px">Ou pelo site do fornecedor<input type="text" id="logo-forn-site" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="ex.: futura.com.br" value="${escRel((logosFornecedores[chaveLogoExistente(_logoNome)] || {}).d || '')}"></label>
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
    _logoDom = v; logoFornPrever(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(v)}&sz=128`);
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
        const alvo = remover ? (chaveLogoExistente(_logoNome) || _logoChave) : _logoChave;   // salvar vale para este nome; remover tira a que estiver valendo
        await settingsDocRef.parent.doc('logosFornecedores').set({ logos: { [alvo]: remover ? firebase.firestore.FieldValue.delete() : { u: _logoPend, ...(_logoDom ? { d: _logoDom } : {}) } } }, { merge: true });
        if (remover) delete logosFornecedores[alvo]; else logosFornecedores[alvo] = { u: _logoPend, ...(_logoDom ? { d: _logoDom } : {}) };
        closeAllModals(); toast(remover ? 'Logo removida.' : 'Logo salva.');
        ['renderInicio', 'renderControleNfs', 'renderListaFornecedoresUnificada'].forEach(f => { try { if (typeof window[f] === 'function') window[f](); } catch (e) { } });
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
    const n = fornecedoresComCnpj().length, com = Object.values(logosFornecedores).filter(e => e && (e.u || e.d)).length;
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
        [f.nome, f.real].forEach(nm => { const k = nomeBaseLogoForn(nm); if (k && !(logosFornecedores[k] && logosFornecedores[k].u)) novos[k] = { d: dom }; });   // não sobrescreve logo escolhida à mão
        ok++;
    });
    if (!ok) { if (g) g.textContent = 'Nenhuma linha válida. Use CNPJ;site, uma por linha.' + (sem ? ' (' + sem + ' CNPJ(s) não estão na sua lista.)' : ''); return; }
    try {
        await settingsDocRef.parent.doc('logosFornecedores').set({ logos: novos }, { merge: true });
        Object.assign(logosFornecedores, novos);
        closeAllModals(); toast(`Sites aplicados: ${ok} fornecedor(es).`);
        ['renderInicio', 'renderControleNfs', 'renderListaFornecedoresUnificada'].forEach(f => { try { if (typeof window[f] === 'function') window[f](); } catch (e) { } });
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
        const extra = `<div class="nfe-acoes"><button type="button" class="central-status-toggle" onclick="abrirLogoFornecedor('${encodeURIComponent(String(nome).replace(/<[^>]*>/g, '')).replace(/'/g, '%27')}', '${((String(subHTML || '').match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/) || [''])[0])}')">${logoFornDe(nome) ? 'Trocar logo' : 'Definir logo'}</button></div>`;
        return o.call(this, chave, nome, subHTML, chipHTML, (corpoHTML || '') + extra, aberto);
    };
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/66-logos-fornecedores.js'] = '2.73.9';
// leandromendonssa

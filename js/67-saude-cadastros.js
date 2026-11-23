// 67-saude-cadastros.js — Saúde dos cadastros (2.73.17)
// SOMENTE LEITURA: lê fornecedores, apelidos, logos e NFs já carregados no app e aponta o que está solto, duplicado ou sem ligação.
// Não grava nada em lugar nenhum. É o passo 1 da unificação dos fornecedores: mede os dados atuais antes de qualquer mudança.
// leandromendonssa
const SAUDE_LIMITE = 60;
function saudeDig(v) { return String(v || '').replace(/\D/g, ''); }
function saudeNomeNF(nome) { try { return nomeExibicaoFornecedor(nome, '') || nome || ''; } catch (e) { return nome || ''; } }
function saudeCadastrosCalcular() {
    const uni = listaFornecedoresUnificada(), sp = uni.filter(f => f.origem === 'spdata'), lg = uni.filter(f => f.origem === 'legado');
    const rotulo = f => (f.nomeExibido && f.nomeExibido !== f.nomeReal ? f.nomeExibido + ' — ' : '') + (f.nomeReal || '(sem nome)');
    const secoes = [], mapa = new Map();
    const juntar = (m, k, v) => { if (!k) return; if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };

    // 1) CNPJ igual em mais de um cadastro / mesma raiz em cadastros separados
    const porCnpj = new Map(), porRaiz = new Map(), porNome = new Map(), porChave = new Map();
    uni.forEach(f => { porChave.set(f.chave, f);
        (f.cnpjs || []).forEach(c => { const d = saudeDig(c.cnpj); if (d.length === 14) juntar(porCnpj, d, f.chave); if (d.length >= 8) juntar(porRaiz, d.slice(0, 8), f.chave); });
        [f.nomeReal, f.nomeExibido].forEach(n => juntar(porNome, chaveLogoForn(n), f.chave));
    });
    const lista = (m, fmt) => [...m.entries()].filter(([, s]) => s.size > 1).map(([k, s]) => fmt(k, [...s].map(c => rotulo(porChave.get(c))).join('  |  ')));
    secoes.push({ id: 'cnpj-dup', tom: 'r', titulo: 'Mesmo CNPJ em mais de um cadastro', desc: 'O mesmo CNPJ completo aparece em cadastros diferentes. É o caso mais claro para unir.', itens: lista(porCnpj, (k, n) => `${k}: ${n}`) });
    const raizSo = lista(porRaiz, (k, n) => `raiz ${k}: ${n}`).filter((_, i) => true);
    const raizDup = new Set([...porRaiz.entries()].filter(([, s]) => s.size > 1).map(([k]) => k));
    secoes.push({ id: 'raiz', tom: 'y', titulo: 'Matriz e filial em cadastros separados', desc: 'Mesma raiz de CNPJ (8 primeiros dígitos) em cadastros diferentes. Pode ser a mesma empresa.', itens: raizSo });
    secoes.push({ id: 'nome-dup', tom: 'y', titulo: 'Mesmo nome em cadastros diferentes', desc: 'Nome real ou nome de exibição igual (sem acento e sem pontuação) em mais de um cadastro.', itens: lista(porNome, (k, n) => `${k}: ${n}`) });

    // 2) cadastros incompletos
    secoes.push({ id: 'sem-cnpj', tom: 'y', titulo: 'Cadastros do SP Data sem CNPJ', desc: 'Sem CNPJ, a ligação depende só do nome.', itens: sp.filter(f => !(f.cnpjs || []).some(c => saudeDig(c.cnpj).length >= 8)).map(rotulo) });
    secoes.push({ id: 'legado', tom: 'n', titulo: 'Fornecedores só da lista simples (sem cadastro)', desc: 'Existem apenas como nome na lista antiga de sugestões.', itens: lg.map(f => f.nomeReal) });

    // 3) apelidos órfãos
    const apel = Object.keys(apelidosFornecedores || {});
    secoes.push({ id: 'apelido-orfao', tom: 'y', titulo: 'Apelidos que não ligam a nenhum cadastro', desc: 'O nome original do apelido não bate com nenhum fornecedor cadastrado.', itens: apel.filter(k => { try { return !entidadeForn(k, '').cadastro; } catch (e) { return false; } }).map(k => `${k} → ${apelidosFornecedores[k]}`) });

    // 4) logos
    const L = logosFornecedores || {}, chaves = Object.keys(L), ix = indiceFornLogo();
    const existeChave = k => k.startsWith('CNPJ:') ? porRaiz.has(k.slice(5)) : ix.nomes.has(k);
    secoes.push({ id: 'logo-ref', tom: 'r', titulo: 'Logos "apontando" para uma logo que não existe', desc: 'Referência quebrada: a logo principal foi removida.', itens: chaves.filter(k => L[k] && L[k].r && !(L[L[k].r] && (L[L[k].r].u || L[L[k].r].d))).map(k => `${k} → ${L[k].r}`) });
    secoes.push({ id: 'logo-sem-forn', tom: 'n', titulo: 'Logos sem fornecedor cadastrado', desc: 'A chave da logo não bate com nenhum cadastro (pode ser de fornecedor que só aparece em NFs).', itens: chaves.filter(k => L[k] && (L[k].u || L[k].d) && !existeChave(k)) });
    const logoDupla = [];
    uni.forEach(f => { try { const e = entidadeForn(f.nomeReal, ((f.cnpjs || [])[0] || {}).cnpj); const proprias = (e.keys || []).filter(k => L[k] && (L[k].u || L[k].d)); if (proprias.length > 1) logoDupla.push(`${rotulo(f)}: ${proprias.join(', ')}`); } catch (x) { } });
    secoes.push({ id: 'logo-dupla', tom: 'y', titulo: 'Mais de uma logo própria para o mesmo fornecedor', desc: 'Há mais de uma chave com imagem para o mesmo fornecedor; só uma vale.', itens: logoDupla });

    // 5) NFs
    const pares = new Map(); const add = (nome, cnpj) => { const n = String(nome || '').trim(); if (!n && !saudeDig(cnpj)) return; const k = (saudeDig(cnpj).slice(0, 8) || '') + '|' + chaveLogoForn(n); const p = pares.get(k) || { nome: n, cnpj: saudeDig(cnpj), qtd: 0 }; p.qtd++; pares.set(k, p); };
    (listaNfsProcessadas || []).forEach(n => add(n.fornecedorNomeEditado || n.fornecedor || (n.xmlDados && n.xmlDados.emit && n.xmlDados.emit.xNome), n.cnpjFornecedor));
    (listaEntradasErp || []).forEach(e => add(e.fornecedorNomeEditado || e.fornecedorNomeRelatorio, e.cnpjFornecedor));
    const semCad = [...pares.values()].filter(p => { try { return !entidadeForn(p.nome, p.cnpj).cadastro; } catch (e) { return false; } }).sort((a, b) => b.qtd - a.qtd);
    secoes.push({ id: 'nf-sem-cad', tom: 'y', titulo: 'Fornecedores de NFs sem cadastro', desc: 'Aparecem em NFs mas não resolvem a nenhum cadastro (comum em compras diretas e Mercado Livre).', itens: semCad.map(p => `${p.nome || '(sem nome)'}${p.cnpj ? ' · ' + p.cnpj : ''} · ${p.qtd} NF(s)`) });
    const nomesPorRaiz = new Map(); pares.forEach(p => { if (p.cnpj.length >= 8) { const r = p.cnpj.slice(0, 8); if (!nomesPorRaiz.has(r)) nomesPorRaiz.set(r, new Set()); nomesPorRaiz.get(r).add(p.nome); } });
    secoes.push({ id: 'nf-nomes', tom: 'n', titulo: 'Mesmo CNPJ com nomes diferentes nas NFs', desc: 'Variações de nome do mesmo fornecedor nas NFs carregadas.', itens: [...nomesPorRaiz.entries()].filter(([, s]) => s.size > 1).map(([r, s]) => `raiz ${r}: ${[...s].join('  |  ')}`) });

    return { total: uni.length, sp: sp.length, lg: lg.length, apel: apel.length, logos: chaves.length, nfs: (listaNfsProcessadas || []).length + (listaEntradasErp || []).length, secoes };
}
function saudeCadastrosRender() {
    const el = document.getElementById('saude-cad-conteudo'); if (!el) return;
    let r; try { r = saudeCadastrosCalcular(); } catch (e) { console.error('Saúde dos cadastros', e); el.innerHTML = '<div class="card"><p class="desc-tela">Não consegui analisar agora. Os dados ainda podem estar carregando; tente de novo em instantes.</p></div>'; return; }
    window._saudeUltimo = r;
    const chip = (s) => `<span class="ini-chip ${s.itens.length ? s.tom : 'g'}">${s.itens.length}</span>`;
    el.innerHTML = `<div class="card"><p class="desc-tela">Somente leitura: nada aqui altera seus dados. Serve para ver o estado dos cadastros antes de unificar os fornecedores.</p>
        <div class="xml-item-meta">${r.total} fornecedores (${r.sp} cadastrados, ${r.lg} só na lista simples) · ${r.apel} apelidos · ${r.logos} chaves de logo · ${r.nfs} NFs carregadas</div>
        <button type="button" class="actions-button is-primary" style="margin-top:10px;width:100%" onclick="saudeCadastrosCopiar()"><span class="icon-wrapper"><i class="fa-solid fa-copy"></i></span> Copiar relatório</button></div>` +
        r.secoes.map(s => `<div class="card mt-4"><details class="retro-det"${s.itens.length && s.tom === 'r' ? ' open' : ''}><summary><b>${escRel(s.titulo)}</b> ${chip(s)}</summary><p class="xml-item-meta">${escRel(s.desc)}</p>${s.itens.length ? s.itens.slice(0, SAUDE_LIMITE).map(t => `<div class="xml-item-meta" style="padding:4px 0;border-top:1px solid var(--border-color);word-break:break-word">${escRel(t)}</div>`).join('') + (s.itens.length > SAUDE_LIMITE ? `<div class="xml-item-meta">… e mais ${s.itens.length - SAUDE_LIMITE}. O relatório copiado traz todos.</div>` : '') : '<div class="xml-item-meta">Nada encontrado. ✓</div>'}</details></div>`).join('');
}
async function saudeCadastrosCopiar() {
    const r = window._saudeUltimo || saudeCadastrosCalcular();
    const t = ['SAÚDE DOS CADASTROS — ' + new Date().toLocaleString('pt-BR'), `${r.total} fornecedores (${r.sp} cadastrados, ${r.lg} só na lista simples) · ${r.apel} apelidos · ${r.logos} chaves de logo · ${r.nfs} NFs`, ''].concat(...r.secoes.map(s => [`## ${s.titulo} (${s.itens.length})`, s.desc].concat(s.itens.map(i => '- ' + i), ['']))).join('\n');
    try { await navigator.clipboard.writeText(t); toast('✓ Relatório copiado.'); } catch (e) { toast('✕ Não consegui copiar agora.'); }
}
window.saudeCadastrosRender = saudeCadastrosRender; window.saudeCadastrosCopiar = saudeCadastrosCopiar; window.saudeCadastrosCalcular = saudeCadastrosCalcular;
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/67-saude-cadastros.js'] = '2.73.17';

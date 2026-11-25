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
    const exibDif = [];
    uni.forEach(f => { try { if ((f.docs || []).length > 1) { const nomes = [...new Set(f.docs.map(d => apelidoFornecedorDoc(d).nome).filter(Boolean))]; if (nomes.length > 1) exibDif.push(`${rotulo(f)}: ${nomes.join(' | ')}`); } } catch (x) { } });
    secoes.push({ id: 'exib-dif', tom: 'y', titulo: 'Fornecedores unidos com nome de exibição diferente', desc: 'Cadastros ligados como o mesmo fornecedor, mas cada um mostra um nome diferente na tela. Só informativo.', itens: exibDif });
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
    let antes = null; try { antes = (JSON.parse(localStorage.getItem(FOTO_SEG_CHAVE) || 'null') || {}).sc || null; } catch (e) { }
    // 2.73.27: compara com os números da última foto de segurança ("antes 12"), para ver a unificação reduzindo os problemas
    const chip = (s) => `<span class="ini-chip ${s.itens.length ? s.tom : 'g'}">${s.itens.length}</span>` + (antes && antes[s.id] !== undefined && antes[s.id] !== s.itens.length ? ` <small class="xml-item-meta">antes ${antes[s.id]}</small>` : '');
    el.innerHTML = `<div class="card"><h3 class="card-titulo card-titulo-sm">Foto de segurança</h3><p class="desc-tela">Antes de qualquer mudança nos fornecedores, gere uma cópia em arquivo de cadastros, apelidos, logos e associações. Nada é gravado no Firebase: o arquivo vai para o seu aparelho. Guarde-o em Arquivos ou iCloud.</p>
        <div class="xml-item-meta" id="foto-seg-ultima"></div><div class="xml-item-meta" id="foto-seg-msg"></div>
        <button type="button" id="foto-seg-btn" class="actions-button is-primary" style="margin-top:10px;width:100%" onclick="fotoSegGerar()"><span class="icon-wrapper"><i class="fa-solid fa-camera"></i></span> Gerar foto de segurança</button></div>
        <div class="card mt-4"><h3 class="card-titulo card-titulo-sm">Conferência das NFs × saída de texto</h3><p class="desc-tela">Compara o que sai no texto do Repasse de NF com o que o XML e o ERP dizem hoje, campo a campo. Somente leitura.</p>
        <button type="button" class="actions-button is-primary" style="width:100%" onclick="conferenciaNfsRender()"><span class="icon-wrapper"><i class="fa-solid fa-scale-balanced"></i></span> Conferir agora</button><div id="conf-nf-conteudo"></div></div>
        <div class="card mt-4"><p class="desc-tela">Diagnóstico somente leitura: nada aqui altera seus dados. Serve para ver o estado dos cadastros antes de unificar os fornecedores.</p>
        <div class="xml-item-meta">${r.total} fornecedores (${r.sp} cadastrados, ${r.lg} só na lista simples) · ${r.apel} apelidos · ${r.logos} chaves de logo · ${r.nfs} NFs carregadas</div>
        <button type="button" class="actions-button is-primary" style="margin-top:10px;width:100%" onclick="saudeCadastrosCopiar()"><span class="icon-wrapper"><i class="fa-solid fa-copy"></i></span> Copiar relatório</button></div>` +
        r.secoes.map(s => `<div class="card mt-4"><details class="retro-det"${s.itens.length && s.tom === 'r' ? ' open' : ''}><summary><b>${escRel(s.titulo)}</b> ${chip(s)}</summary><p class="xml-item-meta">${escRel(s.desc)}</p>${s.itens.length ? s.itens.slice(0, SAUDE_LIMITE).map(t => `<div class="xml-item-meta" style="padding:4px 0;border-top:1px solid var(--border-color);word-break:break-word">${escRel(t)}</div>`).join('') + (s.itens.length > SAUDE_LIMITE ? `<div class="xml-item-meta">… e mais ${s.itens.length - SAUDE_LIMITE}. O relatório copiado traz todos.</div>` : '') : '<div class="xml-item-meta">Nada encontrado. ✓</div>'}</details></div>`).join('');
}
async function saudeCadastrosCopiar() {
    const r = window._saudeUltimo || saudeCadastrosCalcular();
    const t = ['SAÚDE DOS CADASTROS — ' + new Date().toLocaleString('pt-BR'), `${r.total} fornecedores (${r.sp} cadastrados, ${r.lg} só na lista simples) · ${r.apel} apelidos · ${r.logos} chaves de logo · ${r.nfs} NFs`, ''].concat(...r.secoes.map(s => [`## ${s.titulo} (${s.itens.length})`, s.desc].concat(s.itens.map(i => '- ' + i), ['']))).join('\n');
    try { await navigator.clipboard.writeText(t); toast('✓ Relatório copiado.'); } catch (e) { toast('✕ Não consegui copiar agora.'); }
}

// ---------- Foto de segurança (2.73.18): cópia, em arquivo, de tudo que a unificação de fornecedores pode tocar ----------
// Não grava nada no Firebase: o arquivo vai para o seu aparelho (Arquivos / compartilhar). Servirá para desfazer qualquer migração.
const FOTO_SEG_CHAVE = 'fotoSegurancaFornecedores';
function fotoSegLimpar(o) { try { return JSON.parse(JSON.stringify(o, (k, v) => (v && typeof v === 'object' && typeof v.toDate === 'function') ? { _ts: v.toDate().toISOString() } : v)); } catch (e) { return null; } }
function fotoSegMontar() {
    const nfs = (listaNfsProcessadas || []).map(n => ({ id: n.id, nf: n.nf || n.numeroNf || '', fornecedor: n.fornecedor || '', fornecedorNomeEditado: n.fornecedorNomeEditado || '', cnpjFornecedor: n.cnpjFornecedor || '', pedido: n.pedido || '' }));
    const erp = (listaEntradasErp || []).map(e => ({ id: e.id, nf: e.nf || '', fornecedorNomeRelatorio: e.fornecedorNomeRelatorio || '', fornecedorNomeEditado: e.fornecedorNomeEditado || '', cnpjFornecedor: e.cnpjFornecedor || '', pedido: e.pedido || '' }));
    const foto = {
        tipo: 'foto-seguranca-fornecedores', formato: 1, geradoEm: new Date().toISOString(), versaoApp: (document.querySelector('meta[name="app-versao"]') || {}).content || '',
        fornecedoresSpData: fotoSegLimpar(listaFornecedoresSpData || []), fornecedoresSugeridos: [...(fornecedoresSugeridos || [])], apelidosFornecedores: { ...(apelidosFornecedores || {}) },
        logosFornecedores: fotoSegLimpar(logosFornecedores || {}), associacoesFornecedor: fotoSegLimpar(typeof bancoAssociacoesFornecedor === 'object' ? bancoAssociacoesFornecedor : {}),
        nfsProcessadas: nfs, entradasErp: erp
    };
    foto.contagens = { fornecedoresSpData: foto.fornecedoresSpData.length, fornecedoresSugeridos: foto.fornecedoresSugeridos.length, apelidos: Object.keys(foto.apelidosFornecedores).length, logos: Object.keys(foto.logosFornecedores || {}).length, associacoesFornecedor: Object.keys(foto.associacoesFornecedor || {}).length, nfsProcessadas: nfs.length, entradasErp: erp.length };
    return foto;
}
function fotoSegResumo(c) { return `${c.fornecedoresSpData} cadastros · ${c.fornecedoresSugeridos} na lista simples · ${c.apelidos} apelidos · ${c.logos} logos · ${c.associacoesFornecedor} associações · ${c.nfsProcessadas} NFs de XML · ${c.entradasErp} NFs do ERP`; }
async function fotoSegGerar() {
    const bt = document.getElementById('foto-seg-btn'), msg = document.getElementById('foto-seg-msg');
    if (bt) bt.disabled = true; if (msg) msg.textContent = 'Carregando os dados e montando a foto…';
    try {
        ['fornecedoresSpData', 'nfsProcessadas', 'entradasErp', 'associacoesFornecedor'].forEach(n => { try { assinarDados(n); } catch (e) { } });
        await new Promise(r => setTimeout(r, 2500));
        const foto = fotoSegMontar(), c = foto.contagens;
        if (!c.fornecedoresSpData && !c.apelidos && !c.logos) { if (msg) msg.textContent = 'Os dados ainda não carregaram. Aguarde alguns segundos e toque de novo.'; return; }
        const d = new Date(), ymd = d.toLocaleDateString('en-CA'), hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
        const ok = await entregarArquivoRelCot(`Foto-seguranca-fornecedores-${ymd}-${hm}.json`, new Blob([JSON.stringify(foto)], { type: 'application/json' }));
        if (ok) {
            try { let sc = {}; try { saudeCadastrosCalcular().secoes.forEach(x => { sc[x.id] = x.itens.length; }); } catch (e2) { }
            localStorage.setItem(FOTO_SEG_CHAVE, JSON.stringify({ em: foto.geradoEm, c, sc })); } catch (e) { }
            fotoSegAtualizar(); toast('✓ Foto de segurança gerada. Guarde o arquivo.');
        } else if (msg) msg.textContent = 'Cancelado. Nada foi gerado.';
    } catch (err) { console.error('Foto de segurança:', err); if (msg) msg.textContent = 'Não consegui gerar agora. Tente de novo.'; }
    finally { if (bt) bt.disabled = false; }
}
function fotoSegAtualizar() {
    const el = document.getElementById('foto-seg-ultima'); if (!el) return;
    let u = null; try { u = JSON.parse(localStorage.getItem(FOTO_SEG_CHAVE) || 'null'); } catch (e) { }
    el.textContent = u ? `Última foto neste aparelho: ${new Date(u.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} — ${fotoSegResumo(u.c)}.` : 'Nenhuma foto gerada neste aparelho ainda.';
    const msg = document.getElementById('foto-seg-msg'); if (msg && u) msg.textContent = '';
}
window.fotoSegGerar = fotoSegGerar; window.fotoSegMontar = fotoSegMontar;

// ---------- Conferência XML/ERP × saída de texto (2.73.19) — passo 3 da unificação, SOMENTE LEITURA ----------
// A linha que sai no texto (data, NF, vencimento, valor, fornecedor, recurso) é uma CÓPIA gravada na nota quando ela entra na relação.
// Aqui comparamos essa cópia com o que o XML/ERP dizem hoje, campo a campo, para ver onde as fontes divergem. Não altera nada.
function conferenciaNfsCalcular() {
    const itens = montarControleNfs(), L = { numero: [], fornecedor: [], valor: [], venc: [], recurso: [], erpxml: [], semFonte: [] };
    let comFonte = 0, naRelacao = 0;
    const fm = v => (v == null || v === '') ? '—' : String(v);
    itens.forEach(it => {
        const nota = it.nota; if (!nota) return;
        if (it.tipo === 'nota') { naRelacao++; L.semFonte.push(`NF ${nota.nf} · ${nota.fornecedor}`); return; }
        if (it.tipo === 'nf') {
            naRelacao++;
            if (!it.nf && !it.erp) { L.semFonte.push(`NF ${nota.nf} · ${nota.fornecedor}`); return; }
            comFonte++;
            const rot = `NF ${nota.nf} · ${nota.fornecedor}`;
            if (normNfNumero(nota.nf) !== normNfNumero(it.numeroNf)) L.numero.push(`${rot}: saída "${nota.nf}" | fonte "${it.numeroNf}"`);
            let d = null; try { d = dadosEnvioNfParaRelacao(it); } catch (e) { }
            if (d) {
                if (chaveLogoForn(d.fornecedor) !== chaveLogoForn(nota.fornecedor)) {
                    const raw = String((it.nf && it.nf.fornecedor) || (it.erp && it.erp.fornecedorNomeRelatorio) || '');
                    L.fornecedor.push(`NF ${nota.nf}: saída "${nota.fornecedor}" | hoje geraria "${d.fornecedor}" | nome no XML/ERP "${raw}"`);
                }
                if ((d.obs || '') && String(nota.obs || '') !== d.obs) L.recurso.push(`${rot}: saída "${fm(nota.obs)}" | sugerido pelas cotações "${d.obs}"`);
            }
            const f = fonteDaNota(nota);
            if (f) {
                if (f.valorNum !== null && !valoresNfIguais(nota.valor, f.valorNum)) L.valor.push(`${rot}: saída R$ ${fm(nota.valor)} | ${f.origem} ${formatarValorMonetarioBR(f.valorNum)}`);
                if (f.venc && normDataCurta(nota.vencimento) !== normDataCurta(f.venc)) L.venc.push(`${rot}: saída ${fm(nota.vencimento)} | ${f.origem} ${f.venc}`);
            }
        }
    });
    itens.forEach(it => {   // XML e ERP da mesma NF dizendo coisas diferentes
        if (it.tipo !== 'nf' || !it.nf || !it.erp) return;
        const parcela = Array.isArray(it.erp.parcelas) && it.erp.parcelas[0] ? it.erp.parcelas[0] : null;
        const vx = Array.isArray(it.nf.vencimentos) && it.nf.vencimentos[0] ? String(it.nf.vencimentos[0]).slice(0, 10).split('-').reverse().join('/') : '';
        const ve = it.erp.vencimento || (parcela && parcela.data) || '';
        const vlE = valorNfNumerico(it.erp.valor) || valorNfNumerico(parcela && parcela.valor), vlX = valorNfNumerico(it.nf.valorTotal);
        const dif = [];
        // o ERP lista a PARCELA e o XML traz o TOTAL: se o total é um múltiplo exato da parcela (2 a 12x), é parcelamento e não divergência
        const ehParcelamento = vlE && vlX && [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].some(k => Math.abs(vlE * k - vlX) <= 0.05 * k);
        if (vlE && vlX && !valoresNfIguais(vlE, vlX) && !ehParcelamento) dif.push(`valor ERP ${formatarValorMonetarioBR(vlE)} × XML ${formatarValorMonetarioBR(vlX)}`);
        if (ve && vx && normDataCurta(ve) !== normDataCurta(vx)) dif.push(`vencimento ERP ${ve} × XML ${vx}`);
        const ce = saudeDig(it.erp.cnpjFornecedor), cx = saudeDig(it.nf.cnpjFornecedor);
        if (ce && cx && ce !== cx) dif.push(`CNPJ ERP ${ce} × XML ${cx}`);
        if (dif.length) L.erpxml.push(`NF ${it.numeroNf} · ${it.nomeFornecedor}: ${dif.join('; ')}`);
    });
    const S = (id, tom, titulo, desc, itens) => ({ id, tom, titulo, desc, itens });
    return { total: itens.length, naRelacao, comFonte, secoes: [
        S('c-valor', 'r', 'Valor: saída × XML/ERP', 'O valor que sai no texto é diferente do valor da fonte.', L.valor),
        S('c-venc', 'r', 'Vencimento: saída × XML/ERP', 'O vencimento que sai no texto é diferente do da fonte.', L.venc),
        S('c-forn', 'y', 'Fornecedor: saída × cadastro atual', 'O nome que sai no texto não é o que o app geraria hoje (apelido mudou, nome do XML etc.).', L.fornecedor),
        S('c-rec', 'y', 'Recurso: saída × cotações', 'O recurso gravado na nota difere do que as cotações sugerem.', L.recurso),
        S('c-num', 'y', 'Número da NF', 'O número da NF na saída difere do da fonte (zeros à esquerda não contam).', L.numero),
        S('c-erpxml', 'y', 'ERP × XML da mesma NF', 'As duas fontes da mesma NF discordam entre si.', L.erpxml),
        S('c-semfonte', 'n', 'Notas na relação sem XML/ERP ligado', 'Digitadas à mão ou de outro caminho: não há com o que comparar.', L.semFonte)
    ] };
}
function conferenciaNfsRender() {
    const el = document.getElementById('conf-nf-conteudo'); if (!el) return;
    let r; try { r = conferenciaNfsCalcular(); } catch (e) { console.error('Conferência de NFs', e); el.innerHTML = '<div class="xml-item-meta">Não consegui analisar agora. Os dados podem estar carregando; tente de novo.</div>'; return; }
    window._confNfUltimo = r;
    el.innerHTML = `<div class="xml-item-meta" style="margin:8px 0">${r.naRelacao} NFs na relação, ${r.comFonte} com XML/ERP ligado para comparar.</div>` + r.secoes.map(s => `<details class="retro-det" style="margin-top:8px"${s.itens.length && s.tom === 'r' ? ' open' : ''}><summary><b>${escRel(s.titulo)}</b> <span class="ini-chip ${s.itens.length ? s.tom : 'g'}">${s.itens.length}</span></summary><p class="xml-item-meta">${escRel(s.desc)}</p>${s.itens.length ? s.itens.slice(0, SAUDE_LIMITE).map(t => `<div class="xml-item-meta" style="padding:4px 0;border-top:1px solid var(--border-color);word-break:break-word">${escRel(t)}</div>`).join('') + (s.itens.length > SAUDE_LIMITE ? `<div class="xml-item-meta">… e mais ${s.itens.length - SAUDE_LIMITE}. O relatório copiado traz todos.</div>` : '') : '<div class="xml-item-meta">Nada encontrado. ✓</div>'}</details>`).join('') +
        `<button type="button" class="actions-button is-neutral" style="margin-top:10px;width:100%" onclick="conferenciaNfsCopiar()"><span class="icon-wrapper"><i class="fa-solid fa-copy"></i></span> Copiar conferência</button>`;
}
async function conferenciaNfsCopiar() {
    const r = window._confNfUltimo; if (!r) return;
    const t = ['CONFERÊNCIA XML/ERP × SAÍDA DE TEXTO — ' + new Date().toLocaleString('pt-BR'), `${r.naRelacao} NFs na relação, ${r.comFonte} com fonte`, ''].concat(...r.secoes.map(s => [`## ${s.titulo} (${s.itens.length})`, s.desc].concat(s.itens.map(i => '- ' + i), ['']))).join('\n');
    try { await navigator.clipboard.writeText(t); toast('✓ Conferência copiada.'); } catch (e) { toast('✕ Não consegui copiar agora.'); }
}
window.conferenciaNfsRender = conferenciaNfsRender; window.conferenciaNfsCopiar = conferenciaNfsCopiar; window.conferenciaNfsCalcular = conferenciaNfsCalcular;
window.saudeCadastrosRender = saudeCadastrosRender; window.saudeCadastrosCopiar = saudeCadastrosCopiar; window.saudeCadastrosCalcular = saudeCadastrosCalcular;
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/67-saude-cadastros.js'] = '2.73.30';

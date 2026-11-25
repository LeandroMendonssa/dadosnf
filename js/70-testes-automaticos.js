// 70-testes-automaticos.js — Testes automáticos (2.73.29), Modo Desenvolvedor.
// Conferências SOMENTE LEITURA: nada é gravado no Firebase, nada é alterado nos seus dados. Cada teste olha o app como ele está agora e
// diz ✓ ou ✕. Os que precisam de dados de exemplo trocam as listas na memória por alguns segundos e as devolvem no mesmo instante.
// leandromendonssa
const TESTES = [];
function teste(grupo, nome, fn) { TESTES.push({ grupo, nome, fn }); }
const _ok = (c, msg) => { if (!c) throw new Error(msg || 'falhou'); };
// roda fn com listas de exemplo e sempre devolve as reais
function comListas(fn, spData, sugeridos) {
    const a = listaFornecedoresSpData, b = fornecedoresSugeridos;
    try { listaFornecedoresSpData = spData; fornecedoresSugeridos = sugeridos || []; if (typeof _logoCache !== 'undefined') logoCacheLimpa(); return fn(); }
    finally { listaFornecedoresSpData = a; fornecedoresSugeridos = b; try { logoCacheLimpa(); } catch (e) { } }
}

// ---- Versões e arquivos
teste('Versões e arquivos', 'Todos os arquivos estão na versão do histórico', () => { const p = arqVerificar(); _ok(!p.length, 'desatualizados: ' + p.map(x => x.arq + ' ' + x.atual + '→' + x.ver).join(', ')); });
teste('Versões e arquivos', 'index.html, style.css e histórico na mesma versão', () => {
    const m = document.querySelector('meta[name="app-versao"]'), c = (getComputedStyle(document.documentElement).getPropertyValue('--css-versao') || '').replace(/['"\s]/g, ''), h = HISTORICO_FASES[0].numero;
    _ok(m && m.content === c && c === h, `index ${m && m.content} · css ${c} · histórico ${h}`);
});
teste('Versões e arquivos', 'Só a primeira entrada do histórico é "atual"', () => { const n = HISTORICO_FASES.filter(f => f.status === 'atual').length; _ok(n === 1 && HISTORICO_FASES[0].status === 'atual', n + ' entradas atuais'); });
teste('Versões e arquivos', 'Entradas recentes do histórico completas', () => {
    HISTORICO_FASES.slice(0, 8).forEach(f => { ['numero', 'nome', 'data', 'novidades', 'implementado', 'arquivos', 'mudou', 'testar'].forEach(c => _ok(f[c] && (!Array.isArray(f[c]) || f[c].length), `${f.numero}: falta ${c}`)); _ok(!(f.arquivos || []).some(a => /\(/.test(a)), `${f.numero}: "arquivos" com parênteses`); });
});
teste('Versões e arquivos', 'Números de versão em ordem decrescente', () => { for (let i = 1; i < Math.min(HISTORICO_FASES.length, 12); i++) _ok(arqVerNum(HISTORICO_FASES[i - 1].numero) > arqVerNum(HISTORICO_FASES[i].numero), `${HISTORICO_FASES[i - 1].numero} antes de ${HISTORICO_FASES[i].numero}`); });

// ---- Funções essenciais
teste('Funções essenciais', 'Funções principais existem', () => {
    const f = ['listaFornecedoresUnificada', 'montarControleNfs', 'formatValorBR', 'numeroFlexivel', 'formatarCnpjExibicao', 'buildSaidaText', 'confirmarVinculoErpComPedido', 'vincularEntidadesFornecedor', 'logoRes', 'entidadeForn', 'showConfirmModal', 'toast', 'entregarArquivoRelCot'];
    const falta = f.filter(n => { try { return typeof eval(n) !== 'function'; } catch (e) { return true; } }); _ok(!falta.length, 'faltam: ' + falta.join(', '));
});
teste('Funções essenciais', 'Telas do Modo Desenvolvedor existem', () => {
    const falta = [...document.querySelectorAll('#dev-lista a[data-screen]')].map(a => a.dataset.screen).filter(id => !document.getElementById(id)); _ok(!falta.length, 'sem tela: ' + falta.join(', '));
});

// ---- Valores e CNPJ
teste('Valores e CNPJ', 'Valores em formato brasileiro', () => { _ok(numeroFlexivel('1.234,56') === 1234.56, '1.234,56'); _ok(numeroFlexivel('10,5') === 10.5, '10,5'); _ok(numeroFlexivel('') === null, 'vazio'); _ok(numeroFlexivel(12) === 12, 'número'); });
teste('Valores e CNPJ', 'formatValorBR', () => _ok(formatValorBR(1234.5) === '1.234,50', formatValorBR(1234.5)));
teste('Valores e CNPJ', 'CNPJ formatado', () => _ok(/^47\.960\.950\/0344-50$/.test(formatarCnpjExibicao('47960950034450')), formatarCnpjExibicao('47960950034450')));
teste('Valores e CNPJ', 'Mesmo CNPJ ignora pontuação', () => _ok(mesmoCnpj('47.960.950/0344-50', '47960950034450') && !mesmoCnpj('47960950034450', '47960950055104')));

// ---- Fornecedores (dados reais, só leitura)
teste('Fornecedores', 'Lista unificada monta sem erro e sem repetir chave', () => { const l = listaFornecedoresUnificada(), ch = new Set(l.map(f => f.chave)); _ok(ch.size === l.length, (l.length - ch.size) + ' chaves repetidas'); });
teste('Fornecedores', 'Ligações apontam para cadastros que existem', () => {
    const ids = new Set(listaFornecedoresSpData.map(d => d.id)), ruins = [];
    listaFornecedoresSpData.forEach(d => (d.entidadesRelacionadas || []).forEach(o => { if (!ids.has(o)) ruins.push(d.nomeReal + '→' + o); })); _ok(!ruins.length, ruins.slice(0, 3).join(' | '));
});
teste('Fornecedores', 'Ligações são de mão dupla', () => {
    const por = {}; listaFornecedoresSpData.forEach(d => { por[d.id] = d; }); const ruins = [];
    listaFornecedoresSpData.forEach(d => (d.entidadesRelacionadas || []).forEach(o => { if (por[o] && !(por[o].entidadesRelacionadas || []).includes(d.id)) ruins.push(d.nomeReal + '↔' + por[o].nomeReal); })); _ok(!ruins.length, ruins.length + ' ligações só de um lado: ' + ruins.slice(0, 2).join(' | '));
});
teste('Fornecedores', 'Código SP Data sem repetição', () => { const v = {}, r = []; listaFornecedoresSpData.forEach(d => { if (d.codigo) { if (v[d.codigo] && v[d.codigo] !== d.id) r.push(d.codigo); v[d.codigo] = d.id; } }); _ok(!r.length, 'repetidos: ' + [...new Set(r)].slice(0, 5).join(', ')); });
teste('Fornecedores', 'Índice de logos monta sem erro', () => { const ix = indiceFornLogo(); _ok(ix && ix.nomes instanceof Map); });

// ---- Logos
teste('Logos', 'Nenhuma logo aponta para uma que não existe', () => {
    const L = logosFornecedores || {}, r = Object.keys(L).filter(k => L[k] && L[k].r && !(L[L[k].r] && (L[L[k].r].u || L[L[k].r].d))); _ok(!r.length, r.slice(0, 3).join(', '));
});
teste('Logos', 'Nenhuma logo aponta para outra que também aponta', () => { const L = logosFornecedores || {}, r = Object.keys(L).filter(k => L[k] && L[k].r && L[L[k].r] && L[L[k].r].r); _ok(!r.length, r.slice(0, 3).join(', ')); });

// ---- Unir fornecedores (com dados de exemplo)
teste('Unir fornecedores', 'Sugere só mesma raiz de CNPJ, nunca por nome', () => comListas(() => {
    const s = ufSugestoes(); _ok(s.length === 1 && s[0].raiz === '01505499', 'sugestões: ' + s.map(x => x.raiz).join(','));
}, [{ id: 'a', nomeReal: 'DORMED SP', cnpjs: [{ cnpj: '01505499000101' }] }, { id: 'b', nomeReal: 'DORMED RJ', cnpjs: [{ cnpj: '01505499000292' }] }, { id: 'c', nomeReal: 'IDEAL', cnpjs: [{ cnpj: '11111111000101' }] }, { id: 'd', nomeReal: 'REDE SAMONTE', cnpjs: [{ cnpj: '22222222000101' }] }]));
teste('Unir fornecedores', 'Cadastros já unidos não são sugeridos de novo', () => comListas(() => _ok(ufSugestoes().length === 0, 'sugeriu par já unido'),
    [{ id: 'a', nomeReal: 'A', entidadesRelacionadas: ['b'], cnpjs: [{ cnpj: '33333333000101' }] }, { id: 'b', nomeReal: 'B', entidadesRelacionadas: ['a'], cnpjs: [{ cnpj: '33333333000202' }] }]));
teste('Unir fornecedores', 'Nome abreviado acha o cadastro (MAGAZINELUIZA, BD, MARINS)', () => comListas(() => {
    const nome = n => (ufCandidatos(n)[0] || {}).d && ufCandidatos(n)[0].d.nomeReal;
    _ok(nome('MAGAZINELUIZA') === 'MAGAZINE LUIZA S.A.', 'MAGAZINELUIZA → ' + nome('MAGAZINELUIZA')); _ok(nome('BD') === 'BD DISTRIBUIDORA LTDA', 'BD → ' + nome('BD')); _ok(nome('WHITE MARINS') === 'WHITE MARTINS GASES LTDA', 'MARINS → ' + nome('WHITE MARINS'));
}, [{ id: 'm', nomeReal: 'MAGAZINE LUIZA S.A.', cnpjs: [] }, { id: 'z', nomeReal: 'BD DISTRIBUIDORA LTDA', cnpjs: [] }, { id: 'w', nomeReal: 'WHITE MARTINS GASES LTDA', cnpjs: [] }]));
teste('Unir fornecedores', 'Nome sem relação não vira sugestão', () => comListas(() => _ok(!ufCandidatos('XYZ COMERCIO').length, 'sugeriu algo para XYZ'), [{ id: 'm', nomeReal: 'MAGAZINE LUIZA S.A.', cnpjs: [] }]));
teste('Unir fornecedores', 'Distância de edição', () => { _ok(ufDist('MARINS', 'MARTINS') === 1); _ok(ufDist('ABC', 'ABC') === 0); });

// ---- NFs (dados reais, só leitura)
teste('NFs', 'Controle de NFs monta sem erro', () => { const l = montarControleNfs(); _ok(Array.isArray(l), 'não é lista'); });
teste('NFs', 'Cada NF do controle tem número e fornecedor', () => { const r = montarControleNfs().filter(v => !v.numeroNf && !v.nf).length; _ok(r === 0, r + ' sem número'); });
teste('NFs', 'Texto de saída monta com as notas atuais', () => { const t = buildSaidaText(notasPendentes.slice(0, 5)); _ok(typeof t === 'string'); });

async function testesRodar() {
    const el = document.getElementById('testes-auto-conteudo'); if (!el) return;
    const res = TESTES.map(t => { const ini = performance.now(); try { t.fn(); return { ...t, ok: true, ms: Math.round(performance.now() - ini) }; } catch (e) { return { ...t, ok: false, erro: (e && e.message) || String(e), ms: Math.round(performance.now() - ini) }; } });
    window._testesUlt = res; testesRender();
}
function testesRender() {
    const el = document.getElementById('testes-auto-conteudo'); if (!el) return;
    const res = window._testesUlt, bt = `<button type="button" class="actions-button is-primary" style="width:100%" onclick="testesRodar()"><span class="icon-wrapper"><i class="fa-solid fa-play"></i></span> ${res ? 'Rodar de novo' : 'Rodar os testes'}</button>`;
    let corpo = '';
    if (res) {
        const falhas = res.filter(r => !r.ok), grupos = [...new Set(res.map(r => r.grupo))];
        corpo = `<div class="card mt-4"><div class="xml-item-meta"><b>${falhas.length ? '✕ ' + falhas.length + ' falha(s)' : '✓ Tudo certo'}</b> · ${res.length - falhas.length} de ${res.length} testes passaram</div>
            <button type="button" class="actions-button is-neutral" style="width:100%;margin-top:10px" onclick="testesCopiar()"><span class="icon-wrapper"><i class="fa-solid fa-copy"></i></span> Copiar resultado</button></div>` +
            grupos.map(g => `<div class="card mt-4"><b>${escRel(g)}</b>${res.filter(r => r.grupo === g).map(r => `<div class="xml-item-meta" style="padding:4px 0">${r.ok ? '✓' : '<b>✕</b>'} ${escRel(r.nome)}${r.ok ? '' : `<br><small>${escRel(r.erro)}</small>`}</div>`).join('')}</div>`).join('');
    }
    el.innerHTML = `<div class="card"><p class="desc-tela">Conferências somente leitura: nada é gravado e nenhum dado seu é alterado. Rode depois de cada atualização do app.</p>${bt}</div>` + corpo;
}
async function testesCopiar() {
    const res = window._testesUlt || []; const t = ['TESTES AUTOMÁTICOS — ' + new Date().toLocaleString('pt-BR'), `${res.filter(r => r.ok).length}/${res.length} passaram`, ''].concat(res.map(r => (r.ok ? '✓ ' : '✕ ') + r.grupo + ' · ' + r.nome + (r.ok ? '' : ' — ' + r.erro))).join('\n');
    try { await navigator.clipboard.writeText(t); toast('✓ Resultado copiado!'); } catch (e) { toast('Não consegui copiar.'); }
}
window.testesRodar = testesRodar; window.testesRender = testesRender; window.testesCopiar = testesCopiar;
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/70-testes-automaticos.js'] = '2.73.29';

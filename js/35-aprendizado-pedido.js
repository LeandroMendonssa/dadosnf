// 35-aprendizado-pedido.js — Aprender as associações quando a NF bate com o pedido (2.11.5)
// Parte do script do app. Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// Quando o pedido da NF é CERTEZA (confirmado) e os itens da NF casam com a cotação por QUANTIDADE e VALOR UNITÁRIO,
// o app aprende sozinho, sem você associar item por item:
//   • código do fornecedor (cProd do XML)  → produto da cotação (SmartCompras)
//   • produto da cotação (SmartCompras)    → código SP Data (vem no item do ERP)
// Regras de segurança (nunca decide na dúvida):
//   1) o casamento do item tem que ser ÚNICO nos dois sentidos (um item da NF só serve a um da cotação e vice-versa);
//   2) os itens casados têm que cobrir pelo menos 90% do valor da NF (senão a NF não "bate" com o pedido);
//   3) só PREENCHE o que falta: nunca troca uma associação que você já confirmou (se diverge, conta como conflito e deixa como está).
// ===================================================================
const APRENDER_COBERTURA_MIN = 0.9;
function precoParecido(a, b) { return Math.abs(a - b) <= Math.max(0.011, Math.abs(b) * 0.005); }

// itensNf: [{ quantidade, valorUnitario, total, chave }]  ×  itens da cotação do fornecedor → pares únicos
function casarItensComCotacao(itensNf, itensCot) {
    const cand = itensNf.map(() => []);
    const candCot = itensCot.map(() => []);
    itensNf.forEach((n, i) => itensCot.forEach((c, j) => {
        if (Math.abs(n.quantidade - c.qtd) < 0.001 && precoParecido(n.valorUnitario, c.preco)) { cand[i].push(j); candCot[j].push(i); }
    }));
    const pares = [];
    cand.forEach((js, i) => { if (js.length === 1 && candCot[js[0]].length === 1) pares.push({ i, j: js[0] }); });
    const totalNf = itensNf.reduce((s, n) => s + (n.total || n.quantidade * n.valorUnitario), 0);
    const totalCasado = pares.reduce((s, p) => s + (itensNf[p.i].total || itensNf[p.i].quantidade * itensNf[p.i].valorUnitario), 0);
    const cobertura = totalNf > 0 ? totalCasado / totalNf : 0;
    return { pares, cobertura, ok: pares.length > 0 && cobertura >= APRENDER_COBERTURA_MIN };
}


// ---- 2ª camada (2.12.0): mesmo sem preço idêntico (preço negociado, imposto) e sem o texto do SmartCompras colado ----
// Pontua cada par item da NF × item da cotação por NOME (palavras em comum, com abreviações como CLIP/CLIPE e ADUL/ADULTO), QUANTIDADE e
// PREÇO próximo. Só aceita o par quando ele é o melhor dos dois lados (reciprocidade), com folga sobre o segundo colocado, preço até 15%
// de diferença e nome com boa parte das palavras em comum. Na dúvida, não associa (fica para você).
const PALAVRAS_FRACAS_NOME = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'COM', 'PARA', 'TIPO', 'SEM', 'PCT', 'CX', 'UNID', 'UNIDADE', 'FRS', 'AMP', 'MG', 'ML']);
function palavrasDoNome(s) { return tokensNomeProduto(s).filter(t => t.length >= 3 && !PALAVRAS_FRACAS_NOME.has(t) && !/^\d+$/.test(t)); }
function palavraIgual(a, b) {
    if (a === b) return true;
    const m = Math.min(a.length, b.length);
    if (m >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;       // CLIP/CLIPE, ADUL/ADULTO
    let k = 0; while (k < m && a[k] === b[k]) k++;
    return k >= 5 && k >= m * 0.7;                                          // EXTENSOR/EXTENSAO
}
function similaridadeNomes(a, b) {
    const ta = palavrasDoNome(a), tb = palavrasDoNome(b); if (!ta.length || !tb.length) return 0;
    const comuns = ta.filter(x => tb.some(y => palavraIgual(x, y))).length;
    let sim = comuns / Math.min(ta.length, tb.length);
    // a "cabeça" do nome (o que o produto é: CABO, SENSOR, EXTENSAO...) tem que aparecer no início do outro: evita casar SENSOR com CABO só por palavras soltas em comum
    const cabeca = ta.slice(0, 2).some(x => tb.slice(0, 4).some(y => palavraIgual(x, y)));
    if (!cabeca) sim *= 0.3;
    return sim;
}
function casarItensPorNomeEPreco(itensNf, itensCot) {
    const pontuar = (n, c) => {
        if (n.quantidade > c.qtd + 0.001) return null;                               // chegou mais do que o cotado: não é pareável com segurança
        const dif = Math.abs(n.valorUnitario - c.preco) / (c.preco || 1);
        if (dif > 0.15) return null;
        const sim = similaridadeNomes(n.nome, c.nome || c.descricao);
        if (sim < 0.5) return null;
        return sim * 6 + (Math.abs(n.quantidade - c.qtd) < 0.001 ? 2 : 0) + (dif <= 0.005 ? 3 : (dif <= 0.03 ? 2 : (dif <= 0.08 ? 1 : 0)));
    };
    const mat = itensNf.map(n => itensCot.map(c => pontuar(n, c)));
    const melhor = (arr) => { let b = -1, bs = -1, s2 = -1; arr.forEach((v, k) => { if (v == null) return; if (v > bs) { s2 = bs; bs = v; b = k; } else if (v > s2) s2 = v; }); return { k: b, s: bs, s2 }; };
    const pares = [];
    itensNf.forEach((n, i) => {
        const m = melhor(mat[i]); if (m.k < 0 || m.s < 6 || m.s - Math.max(m.s2, 0) < 1.5) return;
        const col = mat.map(l => l[m.k]); const mc = melhor(col);
        if (mc.k !== i || mc.s - Math.max(mc.s2, 0) < 1.5) return;                    // o item da cotação tem que preferir este item da NF também
        pares.push({ i, j: m.k, nivel: 'nome' });
    });
    return { pares, ok: pares.length > 0 };
}

function itensCotacaoDoFornecedor(cot, cnpj) {
    const entidade = cnpjsDaMesmaEntidadeFornecedor(cnpj);
    return (cot.itens || []).filter(i => i.codProduto && (mesmoCnpj(i.cnpjFornecedor, cnpj) || cnpjEmLista(entidade, i.cnpjFornecedor)))
        .map(i => ({ codProduto: String(i.codProduto), nome: i.nomeOficial || '', descricao: i.descricao || '', qtd: numeroFlexivel(i.quantidade), preco: numeroFlexivel(i.precoUnitario) }))
        .filter(i => i.qtd !== null && i.preco !== null);
}

// Proposta para UMA NF do ERP com pedido confirmado (e o XML dela, se já estiver no app)
function propostaAprendizado(e, pedido) {
    const out = { sp: [], fornecedor: [], conflitos: 0 };
    const cot = listaCotacoes.find(c => String(c.pedido) === String(pedido)); if (!cot) return out;
    const cnpj = (e.vinculo && e.vinculo.cnpjFornecedor) || e.cnpjFornecedor || ''; if (!cnpj) return out;
    const itensCot = itensCotacaoDoFornecedor(cot, cnpj); if (!itensCot.length) return out;

    // 1) ERP: produto da cotação → SP Data
    const itensErp = (e.itens || []).filter(i => i.codigoSpData && Number.isFinite(Number(i.quantidade)) && Number.isFinite(Number(i.valorUnitario)))
        .map(i => ({ quantidade: Number(i.quantidade), valorUnitario: Number(i.valorUnitario), total: Number(i.valorTotal) || null, sp: String(i.codigoSpData), nome: i.nome }));
    let cE = casarItensComCotacao(itensErp, itensCot);
    if (!cE.ok) cE = casarItensPorNomeEPreco(itensErp, itensCot);
    if (cE.ok) cE.pares.forEach(({ i, j }) => {
        const cod = itensCot[j].codProduto, sp = itensErp[i].sp;
        const ex = listaAssociacoesSpData.find(a => String(a.codigoSmartCompras) === cod);
        if (ex) { if (String(ex.spDataCodigo) !== sp) out.conflitos++; return; }
        if (listaAssociacoesSpData.some(a => String(a.spDataCodigo) === sp && !ehChaveDiretaSpData(a.codigoSmartCompras))) { out.conflitos++; return; } // esse SP Data já está ligado a outro produto
        out.sp.push({ codigoSmartCompras: cod, spDataCodigo: sp, nome: itensCot[j].nome || itensErp[i].nome });
    });

    // 2) XML da mesma NF (se já foi processado): código do fornecedor → produto da cotação
    const nf = listaNfsProcessadas.find(n => normNfNumero(n.nf) === normNfNumero(e.nf) && normSerieNf(n.serie) === normSerieNf(e.serie) && (mesmoCnpj(n.cnpjFornecedor, cnpj) || mesmaRaizCnpj(n.cnpjFornecedor, cnpj)));
    if (nf && (nf.itens || []).length) {
        const itensXml = nf.itens.filter(i => i.cProd && Number.isFinite(Number(i.quantidade)) && Number.isFinite(Number(i.valorUnitario)))
            .map(i => ({ quantidade: Number(i.quantidade), valorUnitario: Number(i.valorUnitario), total: null, cProd: String(i.cProd), nome: i.xProd, cnpj: nf.cnpjFornecedor }));
        let cX = casarItensComCotacao(itensXml, itensCot);
        if (!cX.ok) cX = casarItensPorNomeEPreco(itensXml, itensCot);
        if (cX.ok) cX.pares.forEach(({ i, j }) => {
            const chave = chaveAssociacaoFornecedor(itensXml[i].cnpj, itensXml[i].cProd);
            const ex = bancoAssociacoesFornecedor[chave];
            if (ex && ex.codigoSmartCompras) { if (String(ex.codigoSmartCompras) !== itensCot[j].codProduto) out.conflitos++; return; }
            out.fornecedor.push({ chave, cnpj: itensXml[i].cnpj, cProd: itensXml[i].cProd, codigoSmartCompras: itensCot[j].codProduto, nome: itensXml[i].nome, pedido: String(pedido), nf: e.nf });
        });
    }
    return out;
}

async function gravarPropostaAprendizado(p) {
    const agora = new Date().toISOString();
    for (const a of p.sp) await confirmarAssociacaoSpData(a.codigoSmartCompras, a.spDataCodigo, { silencioso: true, origemAutomatica: true });
    for (const a of p.fornecedor) {
        await associacoesFornecedorCollection.doc(a.chave).set({
            cnpjFornecedor: a.cnpj, codigoFornecedor: a.cProd, codigoSmartCompras: a.codigoSmartCompras, pedido: a.pedido, nfNumero: a.nf || '',
            confirmadoEm: agora, historico: [{ codigoSmartCompras: a.codigoSmartCompras, confirmadoEm: agora, tipo: 'confirmacao_automatica_pedido' }]
        });
    }
    return p.sp.length + p.fornecedor.length;
}
async function aprenderAssociacoesDoPedido(e, pedido) {
    try { return await gravarPropostaAprendizado(propostaAprendizado(e, pedido)); }
    catch (err) { console.error('Erro ao aprender associações do pedido:', err); return 0; }
}

// Visão geral: todas as NFs do ERP com pedido confirmado
function propostasAprendizadoRetro() {
    const tot = { sp: [], fornecedor: [], conflitos: 0, nfs: 0 };
    const vistoSp = new Set(), vistoForn = new Set();
    listaEntradasErp.forEach(e => {
        const v = e.vinculo || {}; if (v.status !== 'confirmado' || !v.pedido) return;
        const p = propostaAprendizado(e, v.pedido);
        const novosSp = p.sp.filter(a => !vistoSp.has(a.codigoSmartCompras) && vistoSp.add(a.codigoSmartCompras));
        const novosF = p.fornecedor.filter(a => !vistoForn.has(a.chave) && vistoForn.add(a.chave));
        tot.conflitos += p.conflitos;
        if (novosSp.length || novosF.length) { tot.nfs++; tot.sp.push(...novosSp); tot.fornecedor.push(...novosF); }
    });
    return tot;
}
function aprenderRetroativoConfirmar() {
    const t = propostasAprendizadoRetro();
    if (!t.sp.length && !t.fornecedor.length) return toast('Nada novo para aprender: o que bate já está associado' + (t.conflitos ? ` (${t.conflitos} divergência(s) com associações suas foram deixadas como estão).` : '.'));
    showConfirmModal({
        title: 'Aprender associações dos pedidos confirmados',
        message: `Das NFs com pedido confirmado cujos itens batem com a cotação (mesma quantidade e valor unitário, casamento único e pelo menos 90% do valor), o app vai preencher ${t.fornecedor.length} código(s) de fornecedor → produto e ${t.sp.length} produto(s) → SP Data, vindas de ${t.nfs} NF(s). Só preenche o que está faltando${t.conflitos ? `; ${t.conflitos} caso(s) divergem de associações que você já fez e ficam como estão` : ''}.`,
        confirmText: 'Aprender', confirmClass: 'warning',
        onConfirm: async () => { const n = await gravarPropostaAprendizado(t); toast(`✓ ${n} associação(ões) aprendida(s).`); if (typeof reavaliarItensErp === 'function') reavaliarItensErp(); renderAuditoriaRetroSeAtiva(); }
    });
}

// ---- Nome provisório do item da cotação (2.12.4) ----
// Enquanto o relatório do SmartCompras não foi colado (sem "nome oficial"), o item pode mostrar o nome que o ERP lançou para ele:
// 1) pelo produto SP Data já associado; 2) pelo item do ERP que casa com ele (nome + quantidade + preço), nas NFs do pedido que você
// já ligou. Só leitura: nada é gravado, e a tela marca o nome como "do ERP" para não passar por oficial.
let _nomesProvisoriosMemo = null;
function nomesProvisoriosDoPedido(pedido) {
    if (!_nomesProvisoriosMemo) { _nomesProvisoriosMemo = new Map(); Promise.resolve().then(() => { _nomesProvisoriosMemo = null; }); }
    if (_nomesProvisoriosMemo.has(String(pedido))) return _nomesProvisoriosMemo.get(String(pedido));
    const mapa = new Map(); // codProduto → nome
    const cot = listaCotacoes.find(c => String(c.pedido) === String(pedido));
    if (cot) {
        listaEntradasErp.filter(e => pedidoDoErpConfirmado(e) === String(pedido)).forEach(e => {
            const cnpj = (e.vinculo && e.vinculo.cnpjFornecedor) || e.cnpjFornecedor; if (!cnpj) return;
            const itensCot = itensCotacaoDoFornecedor(cot, cnpj); if (!itensCot.length) return;
            const itensErp = (e.itens || []).filter(i => i.nome && Number.isFinite(Number(i.quantidade)) && Number.isFinite(Number(i.valorUnitario)))
                .map(i => ({ quantidade: Number(i.quantidade), valorUnitario: Number(i.valorUnitario), total: Number(i.valorTotal) || null, nome: i.nome }));
            let r = casarItensComCotacao(itensErp, itensCot); if (!r.ok) r = casarItensPorNomeEPreco(itensErp, itensCot);
            if (r.ok) r.pares.forEach(({ i, j }) => { if (!mapa.has(itensCot[j].codProduto)) mapa.set(itensCot[j].codProduto, itensErp[i].nome); });
        });
    }
    _nomesProvisoriosMemo.set(String(pedido), mapa);
    return mapa;
}
function nomeProvisorioItemCotacao(pedido, item) {
    if (!item || !item.codProduto) return null;
    const a = listaAssociacoesSpData.find(x => String(x.codigoSmartCompras) === String(item.codProduto));
    const p = a ? listaProdutosSpData.find(pr => String(pr.codigo) === String(a.spDataCodigo)) : null;
    if (p && p.nome) return p.nome;
    return nomesProvisoriosDoPedido(pedido).get(String(item.codProduto)) || null;
}

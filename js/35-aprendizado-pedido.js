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

function itensCotacaoDoFornecedor(cot, cnpj) {
    const entidade = cnpjsDaMesmaEntidadeFornecedor(cnpj);
    return (cot.itens || []).filter(i => i.codProduto && (mesmoCnpj(i.cnpjFornecedor, cnpj) || cnpjEmLista(entidade, i.cnpjFornecedor)))
        .map(i => ({ codProduto: String(i.codProduto), nome: i.nomeOficial || i.descricao || '', qtd: numeroFlexivel(i.quantidade), preco: numeroFlexivel(i.precoUnitario) }))
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
    const cE = casarItensComCotacao(itensErp, itensCot);
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
        const cX = casarItensComCotacao(itensXml, itensCot);
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

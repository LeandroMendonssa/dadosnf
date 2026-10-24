// 37-assistente.js — Assistente de consultas (2.13.0)
// Parte do script do app. Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// Uma IA que RESPONDE PERGUNTAS sobre os dados do app. Ela nunca calcula nem decide sozinha e nunca grava nada: para responder, ela chama
// as consultas abaixo (só leitura, as mesmas regras do resto do app: visão única da NF, divergências, comparação do pedido) e fala em
// cima do que elas devolveram. A chave da IA fica num intermediário (Worker) — o app só manda a pergunta e os resultados das consultas.
// Instalação do intermediário: assistente/COMO-INSTALAR-O-ASSISTENTE.md
// ===================================================================
const IA_URL_PADRAO = 'https://assistente-auditoria.aseleandro.workers.dev';   // endereço fixo do Worker (não é mais digitado pelo usuário)
let assistenteUrl = IA_URL_PADRAO;
let assistenteModoBasico = false;   // escolhido no chat (IA ou Básico); lembrado neste aparelho
try { assistenteModoBasico = localStorage.getItem('iaModoBasico') === '1'; } catch (e) { }
let iaCtlUsuario = null, iaInterrompido = false, iaTimer = null;
let assistenteMsgs = [];      // histórico no formato da API (só nesta tela; some ao recarregar)
let assistenteOcupado = false;
const IA_MAX_RODADAS = 6, IA_LINHAS = 25;

// ---------------- consultas (só leitura) ----------------
function iaPalavras(s) { return tokensNomeProduto(s); }
function iaDist1(a, b) {   // true se as palavras diferem em no máximo 1 letra (trocada, faltando ou sobrando): "CREPON" ~ "CREPOM"
    if (a === b) return true; if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return a.length === b.length ? a.slice(i + 1) === b.slice(i + 1) : (a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i));
}
function iaLev(a, b) {
    const d = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) { let ant = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, ant + (a[i - 1] === b[j - 1] ? 0 : 1)); ant = t; } }
    return d[b.length];
}
function iaQuisDizer(texto) {   // palavras da pergunta que não existem no cadastro → as mais parecidas que existem (sem IA: não inventa nome)
    const vocab = new Map();
    const add = n => iaPalavras(n).forEach(w => { if (w.length >= 5 && !/\d/.test(w)) vocab.set(w, (vocab.get(w) || 0) + 1); });
    listaCotacoes.forEach(c => (c.itens || []).forEach(i => add(i.nomeOficial || i.descricao || '')));
    listaEntradasErp.forEach(e => (e.itens || []).forEach(i => add(i.nome)));
    listaNfsProcessadas.forEach(n => (n.itens || []).forEach(i => add(i.xProd)));
    const out = [];
    iaPalavras(texto).filter(w => w.length >= 5 && !/\d/.test(w) && !vocab.has(w) && ![...vocab.keys()].some(v => iaDist1(v, w))).forEach(w => {
        const lim = w.length >= 9 ? 2 : 1;
        const c = [...vocab.keys()].map(v => [v, iaLev(w, v)]).filter(([, dd]) => dd <= lim).sort((x, y) => x[1] - y[1] || vocab.get(y[0]) - vocab.get(x[0])).slice(0, 3).map(x => x[0]);
        if (c.length) out.push({ digitado: w, parecidas: c });
    });
    return out;
}
function iaCasa(texto, busca) {
    if (!busca) return true; const toks = iaPalavras(texto), t = toks.join(' ');
    return iaPalavras(busca).every(w => /^\d{1,3}$/.test(w) ? toks.some(k => k === w || new RegExp('^' + w + '[A-Z]').test(k)) : (t.includes(w) || (w.length >= 5 && toks.some(k => iaDist1(k, w)))));   // "21" não casa com 20G nem 210; erro de 1 letra é tolerado
}
function iaISO(v) { const t = String(v || ''); const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : t.slice(0, 10); }
function iaBR(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; }
function iaNum(v) { const n = numeroFlexivel(v); return n === null || n === undefined ? null : n; }
function iaFornDoCnpj(cnpj) { const c = (listaCotacoes.flatMap(x => x.fornecedores || [])).find(f => mesmoCnpj(f.cnpj, cnpj)); return c ? (c.razaoSocial || c.cnpj) : cnpj; }
function iaFiltrosLimpos() { const f = relatoriosFiltros; relatoriosFiltros = { de: '', ate: '', fornecedor: '', fornecedorExato: false, destino: '', recurso: '', tipo: '', produto: '' }; return f; }

const IA_FERRAMENTAS = [
    { name: 'buscar_nfs', description: 'Lista notas fiscais (do XML e/ou do ERP) com filtros. Devolve número, fornecedor, data, valor, pedido, situação e pendências. Use para "quais NFs...", "NFs sem pedido", "NFs do fornecedor X".',
      input_schema: { type: 'object', properties: { fornecedor: { type: 'string', description: 'parte do nome ou CNPJ' }, numero: { type: 'string', description: 'número da NF' }, pedido: { type: 'string' }, so_com_pendencia: { type: 'boolean', description: 'só NFs que têm alguma pendência' }, pendencia: { type: 'string', description: 'id: sem-pedido, pedido-sugerido, decisao-parada, sem-produto, sem-recurso, divergencias' } } } },
    { name: 'detalhe_nf', description: 'Detalhe de uma NF: itens (nome, quantidade, valor unitário, produto da cotação, SP Data, recurso), totais com frete, pedido, destino e divergências pendentes.',
      input_schema: { type: 'object', properties: { numero: { type: 'string' }, fornecedor: { type: 'string' } }, required: ['numero'] } },
    { name: 'consultar_pedido', description: 'Situação de um pedido (cotação): origem, datas, fornecedores e, por item, quantidade cotada × faturada (NF do app) × lançada (ERP) × entregue, valor, e divergências detectadas.',
      input_schema: { type: 'object', properties: { pedido: { type: 'string' }, fornecedor: { type: 'string', description: 'opcional: filtrar por fornecedor' } }, required: ['pedido'] } },
    { name: 'buscar_produto', description: 'Procura um material pelo nome ou código em cotações, NFs (XML) e lançamentos do ERP: quantidades, preços, fornecedores e pedidos. Devolve também resumo_precos (compras, última data, último preço, média, mínimo e máximo por produto, já calculados) e, nas cotações, a descricao do SmartCompras, onde costuma aparecer a marca. Use o campo marca para filtrar cotações pela marca.',
      input_schema: { type: 'object', properties: { texto: { type: 'string' }, fornecedor: { type: 'string' }, marca: { type: 'string' } }, required: ['texto'] } },
    { name: 'divergencias', description: 'Divergências de auditoria (pendentes por padrão) com pedido, fornecedor, tipo e produtos. É a mesma lista de Relatórios → Divergências.',
      input_schema: { type: 'object', properties: { pedido: { type: 'string' }, fornecedor: { type: 'string' }, incluir_resolvidas: { type: 'boolean' } } } },
    { name: 'pendencias', description: 'Resumo da Central de notificações: o que está parado ou envelhecendo, por grupo e urgência.', input_schema: { type: 'object', properties: {} } },
    { name: 'fornecedor', description: 'Resumo de um fornecedor: CNPJs, pedidos em que participa, NFs (quantidade e total), divergências pendentes.',
      input_schema: { type: 'object', properties: { nome: { type: 'string' } }, required: ['nome'] } }
];

function iaResumoNf(v) {
    return { nf: v.numeroNf, serie: v.serie || undefined, fornecedor: v.fornecedor, data: v.dataISO || undefined, valor_total: v.totais.nota, pedido: v.pedido || v.pedidoSugerido || undefined, pedido_situacao: v.pedidoSt,
        fontes: [v.fontes.xml ? 'XML' : null, v.fontes.erp ? 'ERP' : null].filter(Boolean).join('+'), destino: v.destino || undefined, recursos: v.recursos.length ? v.recursos : undefined, pendencias: v.pendencias.map(p => p.texto) };
}
function iaPorFornecedor(v, f) { const d = normalizarCnpj(f); return iaCasa(v.fornecedor, f) || (d.length >= 8 && !!v.cnpj && normalizarCnpj(v.cnpj).includes(d)); } // CNPJ só entra quando a busca tem dígitos suficientes
function iaCorta(lista) { return { total: lista.length, mostrando: Math.min(lista.length, IA_LINHAS), itens: lista.slice(0, IA_LINHAS) }; }

const IA_EXEC = {
    buscar_nfs(a) {
        let l = visoesNf();
        if (a.numero) l = l.filter(v => normNfNumero(v.numeroNf) === normNfNumero(a.numero));
        if (a.fornecedor) l = l.filter(v => iaPorFornecedor(v, a.fornecedor));
        if (a.pedido) l = l.filter(v => String(v.pedido) === String(a.pedido) || String(v.pedidoSugerido) === String(a.pedido));
        if (a.pendencia === 'sem-pedido') l = l.filter(v => v.pedidoSt === 'sem_pedido'); // inclui NFs só do ERP
        else if (a.pendencia) l = l.filter(v => v.pendencias.some(p => p.id === a.pendencia));
        else if (a.so_com_pendencia) l = l.filter(v => v.pendencias.length);
        return iaCorta(l.map(iaResumoNf));
    },
    detalhe_nf(a) {
        let l = visoesNf().filter(v => normNfNumero(v.numeroNf) === normNfNumero(a.numero));
        if (a.fornecedor) l = l.filter(v => iaPorFornecedor(v, a.fornecedor));
        if (!l.length) return { erro: 'NF não encontrada.' };
        return { encontradas: l.length, nfs: l.slice(0, 3).map(v => ({ ...iaResumoNf(v), totais: { produtos: v.totais.produtos, frete: v.totais.frete, total_da_nota: v.totais.nota }, recurso_origem: v.recursoOrigem || undefined,
            itens: v.itens.slice(0, 40).map(i => ({ nome: i.nome, quantidade: i.qtd, valor_unitario: i.valorUnit, produto_cotacao: i.codigoSmartCompras || 'sem produto', sp_data: i.codigoSpData || undefined, recurso: i.recurso || undefined })),
            divergencias_pendentes: v.divergencias.map(d => ({ tipo: (TIPOS_DIVERGENCIA_AUDITORIA[d.tipo] || {}).label || d.tipo, produtos: d.produtos })) })) };
    },
    consultar_pedido(a) {
        const cot = listaCotacoes.find(c => String(c.pedido) === String(a.pedido));
        if (!cot) return { erro: 'Pedido não encontrado.' };
        let itens = [];
        try { itens = compararFontesPedido(String(a.pedido)); } catch (e) { return { erro: 'Não consegui comparar este pedido.' }; }
        if (a.fornecedor) itens = itens.filter(i => iaCasa(iaFornDoCnpj(i.cnpjFornecedor), a.fornecedor));
        return { pedido: cot.pedido, origem: cot.origem, data_pedido: cot.dataPedido, data_limite: cot.dataLimite, fornecedores: (cot.fornecedores || []).map(f => f.razaoSocial || f.cnpj),
            itens: iaCorta(itens.map(i => ({ produto: i.nome, fornecedor: iaFornDoCnpj(i.cnpjFornecedor), qtd_cotada: iaNum(i.quantidadeCotada), qtd_nf_xml: i.quantidadeFaturada, qtd_lancada_erp: i.quantidadeLancada, qtd_entregue: i.quantidadeEntregue,
                nfs: i.nfs, situacao: i.cobertura || (i.temNf || i.temErp ? 'com NF' : 'sem NF'), divergencias: (i.divergencias || []).map(d => d.tipo) }))) };
    },
    buscar_produto(a) {
        const out = { cotacoes: [], nfs_xml: [], erp: [] };
        listaCotacoes.forEach(c => (c.itens || []).forEach(i => {
            if (!(iaCasa(i.nomeOficial || '', a.texto) || iaCasa(i.descricao || '', a.texto) || String(i.codProduto) === String(a.texto))) return;
            const forn = iaFornDoCnpj(i.cnpjFornecedor); if (a.fornecedor && !iaCasa(forn, a.fornecedor)) return;
            if (a.marca && !iaCasa(`${i.descricao || ''} ${i.nomeOficial || ''}`, a.marca)) return;
            out.cotacoes.push({ pedido: c.pedido, produto: i.nomeOficial || String(i.descricao || '').slice(0, 90), descricao: String(i.descricao || '').slice(0, 100), fornecedor: forn, quantidade: iaNum(i.quantidade), preco_unitario: iaNum(i.precoUnitario), cod: i.codProduto });
        }));
        listaNfsProcessadas.forEach(n => (n.itens || []).forEach(i => {
            if (!iaCasa(i.xProd, a.texto)) return; if (a.fornecedor && !iaCasa(n.fornecedor, a.fornecedor)) return;
            out.nfs_xml.push({ data: iaISO(n.emissao || (n.xmlDados && n.xmlDados.dhEmi) || ''), nf: n.nf, fornecedor: n.fornecedor, produto: i.xProd, quantidade: i.quantidade, valor_unitario: i.valorUnitario, pedido: n.pedido || undefined });
        }));
        listaEntradasErp.forEach(e => (e.itens || []).forEach(i => {
            if (!iaCasa(i.nome, a.texto)) return; const nome = e.fornecedorNomeEditado || e.fornecedorNomeRelatorio; if (a.fornecedor && !iaCasa(nome, a.fornecedor)) return;
            out.erp.push({ nf: e.nf, fornecedor: nome, produto: i.nome, quantidade: i.quantidade, valor_unitario: i.valorUnitario, data: iaISO(e.data) });
        }));
        const maisNovo = (x, y) => String(y.data || '').localeCompare(String(x.data || ''));   // mais recente primeiro: serve para "última vez que chegou"
        out.nfs_xml.sort(maisNovo); out.erp.sort(maisNovo);
        const res = { cotacoes: iaCorta(out.cotacoes), nfs_xml: iaCorta(out.nfs_xml), erp: iaCorta(out.erp) };
        const grupos = new Map();   // contas prontas (a IA não precisa calcular média): NFs do XML e ERP, por produto
        [...out.nfs_xml.map(x => ({ ...x, fonte: 'NF' })), ...out.erp.map(x => ({ ...x, fonte: 'ERP' }))].forEach(x => {
            const v = iaNum(x.valor_unitario); if (v === null || !(v > 0)) return;
            const k = iaPalavras(x.produto).join(' '); const g = grupos.get(k) || { produto: x.produto, precos: [] }; g.precos.push({ v, data: x.data || '', nf: x.nf }); grupos.set(k, g);
        });
        if (grupos.size) res.resumo_precos = [...grupos.values()].slice(0, 8).map(g => { g.precos.sort((x, y) => String(y.data).localeCompare(String(x.data))); const vs = g.precos.map(p => p.v); return { produto: g.produto, compras: vs.length, ultima_data: iaBR(g.precos[0].data) || undefined, ultima_nf: g.precos[0].nf, ultimo_preco: g.precos[0].v, media: Math.round(vs.reduce((a, b) => a + b, 0) / vs.length * 100) / 100, minimo: Math.min(...vs), maximo: Math.max(...vs) }; });
        const qd = (!res.cotacoes.total && !res.nfs_xml.total && !res.erp.total) ? iaQuisDizer(a.texto) : [];
        if (qd.length) res.quis_dizer = qd;
        else if (!res.cotacoes.total && !res.nfs_xml.total && !res.erp.total) {   // não existe exatamente isso: mostra o que existe de parecido (sem o número/medida)
            const semNum = iaPalavras(a.texto).filter(w => !/^\d/.test(w)).join(' ');
            if (semNum && semNum !== iaPalavras(a.texto).join(' ')) {
                const nomes = new Set();
                listaCotacoes.forEach(c => (c.itens || []).forEach(i => { if (iaCasa(i.nomeOficial || '', semNum)) nomes.add(i.nomeOficial); }));
                listaEntradasErp.forEach(e => (e.itens || []).forEach(i => { if (iaCasa(i.nome, semNum)) nomes.add(i.nome); }));
                res.nao_existe_exato = a.texto; res.parecidos = [...nomes].slice(0, 10);
            }
        }
        return res;
    },
    divergencias(a) {
        const f = iaFiltrosLimpos(); let l;
        try { l = divergenciasRel(); } finally { relatoriosFiltros = f; }
        if (!a.incluir_resolvidas) l = l.filter(x => x.status === 'pendente');
        if (a.pedido) l = l.filter(x => String(x.pedido) === String(a.pedido));
        if (a.fornecedor) l = l.filter(x => iaCasa(x.fornecedor, a.fornecedor));
        return iaCorta(l.map(x => ({ pedido: x.pedido, fornecedor: x.fornecedor, nf: x.notaFiscal || undefined, tipo: (TIPOS_DIVERGENCIA_AUDITORIA[x.tipo] || {}).label || x.tipo, produtos: x.produtos, status: x.status, data: x.data })));
    },
    pendencias() {
        return itensDeAtencao().map(g => ({ grupo: g.titulo, urgencia: g.nivel, quantidade: g.linhas.length, exemplos: g.linhas.slice(0, 5).map(l => `${l.t} — ${l.s}`) }));
    },
    fornecedor(a) {
        const nfs = visoesNf().filter(v => iaPorFornecedor(v, a.nome));
        const pedidos = listaCotacoes.filter(c => (c.fornecedores || []).some(f => iaCasa(f.razaoSocial || '', a.nome) || (normalizarCnpj(a.nome).length >= 8 && f.cnpj && normalizarCnpj(f.cnpj) === normalizarCnpj(a.nome))));
        const cnpjs = [...new Set([...pedidos.flatMap(c => (c.fornecedores || []).filter(f => iaCasa(f.razaoSocial || '', a.nome)).map(f => f.cnpj)), ...nfs.map(v => v.cnpj)].filter(Boolean))];
        const f = iaFiltrosLimpos(); let dv = []; try { dv = divergenciasRel().filter(x => x.status === 'pendente' && iaCasa(x.fornecedor, a.nome)); } finally { relatoriosFiltros = f; }
        if (!nfs.length && !pedidos.length) return { erro: 'Fornecedor não encontrado.' };
        return { cnpjs, pedidos: pedidos.map(c => ({ pedido: c.pedido, origem: c.origem, data_limite: c.dataLimite })).slice(0, 30), nfs: { quantidade: nfs.length, valor_total: Math.round(nfs.reduce((s, v) => s + (v.totais.nota || 0), 0) * 100) / 100, com_pendencia: nfs.filter(v => v.pendencias.length).length }, divergencias_pendentes: dv.length };
    }
};
function iaExecutar(nome, entrada) {
    try { const f = IA_EXEC[nome]; if (!f) return { erro: 'Consulta desconhecida.' }; return f(entrada || {}); }
    catch (e) { console.error('Assistente: erro na consulta', nome, e); return { erro: 'Falhou ao consultar: ' + (e && e.message) }; }
}

// ---------------- conversa com a IA (Cloudflare Workers AI, texto puro) ----------------
// Funciona com qualquer modelo de texto: a IA pede consultas respondendo um JSON {"consultas":[{"nome","args"}]}, o app executa (só leitura)
// e devolve os resultados; quando tem o que precisa, ela responde em texto. Antes de chamar a IA, o app já faz as consultas que o modo
// básico reconhece e entrega os resultados junto com a pergunta: na maioria das vezes basta UMA chamada, e a IA só redige a resposta.
function iaDescricaoConsultas() {
    return IA_FERRAMENTAS.map(f => `- ${f.name}(${Object.entries(f.input_schema.properties || {}).map(([k, v]) => k + ': ' + v.type).join(', ')}): ${f.description}`).join('\n');
}
function iaSistema() {
    return `Você é um assistente de IA útil, de uso geral, que responde em português do Brasil, de forma direta. Dentro de um app de auditoria de notas fiscais e cotações de um hospital você também tem acesso a consultas de leitura aos dados do app. Pode responder qualquer assunto; use as consultas quando a pergunta envolver NFs, pedidos, materiais, fornecedores ou divergências.
HOJE É ${dataLocalISO().split('-').reverse().join('/')}.
CONSULTAS DISPONÍVEIS (só leitura):
${iaDescricaoConsultas()}

COMO USAR AS CONSULTAS:
- Se a mensagem já traz "RESULTADOS DAS CONSULTAS", use-os.
- Para pedir dados, responda SOMENTE com um JSON, sem outro texto: {"consultas":[{"nome":"buscar_produto","args":{"texto":"atadura crepom 15cm"}}]}. Depois que os resultados chegarem, responda em texto.
- Se uma busca não achar nada, NÃO desista nem diga que vai tentar: faça você mesma outra consulta com menos palavras (só o nome principal, sem medida ou sem fornecedor, ou corrigindo erro de digitação) e só então responda. Busque pelo nome como aparece nos dados (ex.: "crepom", não "crepon").
- As listas vêm da mais recente para a mais antiga (campo data): "última vez que chegou" é a primeira de NFs ou ERP; informe a data e a NF.
- Confira a premissa: se o item exato pedido não existe (ex.: "jelco 21" quando só há 20G, 22G, 24G), diga isso e mostre os parecidos que existem.
- "fornecedor" é a empresa que vende (distribuidora), nunca confunda com marca. A marca, quando existe, aparece no texto da descricao das cotações do SmartCompras (ex.: "NOREPINEFRINA 2MG/ML AMPOLA 4ML EPIKABI FRESENIUS KABI" → marca Fresenius Kabi); extraia dali, e use o argumento marca de buscar_produto para filtrar. NF (XML) e ERP não têm campo de marca.
- Médias, mínimos e máximos de preço: use o resumo_precos já calculado; não refaça contas.
- Formato: datas em dd/mm/aaaa; use **negrito** para o que importa (produto, valor, data), listas com "- " ou numeradas "1." quando houver mais de um item, e escreva sempre "pedido 1731" e "NF 36435" por extenso, porque o app transforma isso em link clicável.
- Se o resultado traz "quis_dizer", pergunte ao usuário se era uma dessas palavras; nunca invente nome de medicamento ou material.
- Números, notas e pedidos do app só podem vir das consultas: não os invente; se não achou, diga. Cite a NF e o pedido. Valores em R$ com vírgula. Se o resultado veio cortado (total maior que mostrando), avise.
- Não altere nada no app e não tome decisões fiscais: apresente os dados e aponte o que parece diferente.
- Para conhecimento geral, responda com o que você sabe; se não tiver certeza ou for um fato recente que você não tem como verificar, diga isso em uma frase.`;
}
const IA_PREFIXO_RES = 'RESULTADOS DAS CONSULTAS';
function iaPodar(msgs) {   // mantém só as últimas perguntas (sempre começando numa pergunta)
    const idx = []; msgs.forEach((m, i) => { if (m.role === 'user' && !m.content.startsWith(IA_PREFIXO_RES)) idx.push(i); });
    return idx.length > 3 ? msgs.slice(idx[idx.length - 3]) : msgs;
}
async function iaChamar(msgs) {
    const user = firebase.auth().currentUser; if (!user) throw new Error('Você precisa estar logado.');
    const token = await user.getIdToken();
    const t0 = Date.now(), ctl = new AbortController(), tempo = setTimeout(() => ctl.abort(), 60000);
    if (iaCtlUsuario) iaCtlUsuario.signal.addEventListener('abort', () => ctl.abort());
    const corpo = JSON.stringify({ system: iaSistema(), messages: iaPodar(msgs) });
    const enviar = () => fetch(assistenteUrl, { method: 'POST', signal: ctl.signal, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: corpo });
    let r;
    try { try { r = await enviar(); } catch (e) { if (e && e.name === 'AbortError') throw e; r = await enviar(); } }   // falha de rede: tenta mais uma vez
    catch (e) { if (iaInterrompido) throw new Error('INTERROMPIDO'); throw new Error(e && e.name === 'AbortError' ? 'a IA demorou mais de 60 segundos' : 'não consegui falar com o Worker (' + (e && e.message || 'sem detalhe') + ', após ' + Math.round((Date.now() - t0) / 1000) + 's)'); }
    finally { clearTimeout(tempo); }
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((dados.error && (dados.error.message || dados.error)) || ('Erro ' + r.status));
    return String(dados.text || '').trim();
}
function iaExtrairConsultas(txt) {
    const limpo = String(txt).replace(/```json|```/gi, '');
    const a = limpo.indexOf('{'), b = limpo.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { const o = JSON.parse(limpo.slice(a, b + 1)); return Array.isArray(o.consultas) ? o.consultas.filter(c => c && IA_EXEC[c.nome]).slice(0, 3) : null; } catch (e) { return null; }
}
function iaRodar(consultas, aoUsar) {
    return consultas.map(c => { if (aoUsar) aoUsar(c.nome, c.args); return { consulta: c.nome, args: c.args || {}, resultado: iaExecutar(c.nome, c.args) }; });
}
function iaTextoResultados(lista) { return JSON.stringify(lista).slice(0, 9000); }
async function iaPerguntar(texto, aoUsarConsulta) {
    const n0 = assistenteMsgs.length;
    try {
        const plano = iaEntender(texto).map(([nome, args]) => ({ nome, args }));
        // consultas por palavra-chave que não acharam nada (ex.: "material" que não existe) não entram: a IA decide o que consultar
        const previos = iaRodar(plano, aoUsarConsulta).filter(x => !(x.consulta === 'buscar_produto' && !(x.resultado.cotacoes.total + x.resultado.nfs_xml.total + x.resultado.erp.total)));
        assistenteMsgs.push({ role: 'user', content: texto + (previos.length ? `\n\n${IA_PREFIXO_RES} (já feitas):\n${iaTextoResultados(previos)}` : '') });
        for (let i = 0; i < 6; i++) {
            if (iaInterrompido) throw new Error('INTERROMPIDO');
            const txt = await iaChamar(assistenteMsgs);
            assistenteMsgs.push({ role: 'assistant', content: txt || '(vazio)' });
            const consultas = iaExtrairConsultas(txt);
            if (!consultas || !consultas.length) { if (!txt) throw new Error('A IA não respondeu.'); return txt; }
            const res = iaRodar(consultas, aoUsarConsulta);
            assistenteMsgs.push({ role: 'user', content: `${IA_PREFIXO_RES}:\n${iaTextoResultados(res)}\n\nAgora responda ao usuário em texto (ou faça outra consulta se faltar algo).` });
        }
        // muitas rodadas de consulta: pede à IA que responda com o que já tem, em vez de desistir
        assistenteMsgs.push({ role: 'user', content: 'Chega de consultas. Responda agora ao usuário, em texto, com o que já foi encontrado (e diga o que faltou).' });
        const fim = await iaChamar(assistenteMsgs); assistenteMsgs.push({ role: 'assistant', content: fim || '(vazio)' });
        return fim || 'A pergunta pediu consultas demais. Tente perguntar de forma mais específica (um fornecedor, um pedido ou um material por vez).';
    } catch (e) { assistenteMsgs.length = n0; throw e; }
}

// ---------------- modo básico: grátis, sem IA e sem instalação (2.13.1) ----------------
// Entende a pergunta por palavras-chave (número de pedido, número de NF, fornecedor, material, "divergência", "pendente", "sem pedido"...)
// e responde com as MESMAS consultas que a IA usaria. Não conversa livremente, mas responde as perguntas do dia a dia na hora e de graça.
const IA_PARADAS = new Set(['QUAL', 'QUAIS', 'QUANTO', 'QUANTOS', 'QUANTA', 'QUANTAS', 'TEM', 'TEMOS', 'HA', 'EXISTE', 'SITUACAO', 'STATUS', 'DO', 'DA', 'DE', 'DOS', 'DAS', 'NO', 'NA', 'NOS', 'NAS', 'UM', 'UMA', 'O', 'A', 'OS', 'AS', 'E', 'EM', 'COM', 'PARA', 'POR', 'SOBRE', 'ME', 'MOSTRE', 'MOSTRA', 'MOSTRAR', 'LISTE', 'LISTA', 'VER', 'QUERO', 'PROCURE', 'BUSQUE', 'BUSCAR', 'MATERIAL', 'MATERIAIS', 'PRODUTO', 'PRODUTOS', 'COTADO', 'COTADA', 'RECEBIDO', 'RECEBIDA', 'ESTA', 'ESTAO', 'FORAM', 'FOI', 'SAO', 'QUE', 'DE', 'ULTIMAS', 'ULTIMA', 'TODAS', 'TODOS', 'ESTOQUE', 'CHEGOU', 'CHEGARAM', 'FORNECEDOR', 'FORNECEDORES', 'BOM', 'DIA', 'TARDE', 'NOITE', 'OI', 'OLA', 'OBRIGADO', 'POR', 'FAVOR', 'COMO', 'ESTAMOS', 'VEZ', 'VEZES', 'COMPRA', 'COMPRAS', 'COMPRADO', 'COMPRADA', 'MARCA', 'POSSIVEL', 'SE', 'SEI', 'QUIS', 'DIZER', 'EU', 'ENTRADA', 'ENTRADAS', 'ULTIMAMENTE', 'ULTIMO', 'ULTIMOS', 'QUANDO', 'CHEGADA', 'ESTA', 'DIGA', 'FALE', 'EXPLIQUE', 'PORQUE', 'POR', 'QUE', 'ESTAO']);
const IA_GENERICAS_FORN = new Set(['COMERCIO', 'COMERCIAL', 'DISTRIBUIDORA', 'PRODUTOS', 'HOSPITALARES', 'HOSPITALAR', 'MEDICAMENTOS', 'MEDICOS', 'MEDICO', 'LTDA', 'EIRELI', 'IMPORTACAO', 'EXPORTACAO', 'INDUSTRIA', 'SERVICOS', 'MATERIAIS', 'EQUIPAMENTOS', 'FARMACEUTICA', 'FARMACEUTICOS', 'SAUDE', 'ARTEFATOS', 'DROGARIA']);
function iaFornecedoresConhecidos() {
    const nomes = new Set();
    listaCotacoes.forEach(c => (c.fornecedores || []).forEach(f => f.razaoSocial && nomes.add(f.razaoSocial)));
    visoesNf().forEach(v => v.fornecedor && nomes.add(v.fornecedor));
    return [...nomes];
}
function iaAcharFornecedor(tokensPergunta) {
    let melhor = null;
    iaFornecedoresConhecidos().forEach(n => {
        const pal = iaPalavras(n).filter(w => w.length >= 4 && !IA_GENERICAS_FORN.has(w));
        if (!pal.length) return;
        const w1 = pal[0];
        if (!tokensPergunta.includes(w1)) return;
        const extra = pal.slice(1, 2).filter(w => tokensPergunta.includes(w)).length;   // 2ª palavra batendo desempata
        const forca = w1.length + extra * 5;
        if (!melhor || forca > melhor.forca) melhor = { w1, forca, nome: n };
    });
    return melhor ? melhor.w1.toLowerCase() : null;
}
function iaEntender(texto) {
    const t = iaPalavras(texto), plano = [];
    const tem = (...rx) => rx.some(r => r.test(t.join(' ')));
    const pedido = (String(texto).match(/pedido\s*(?:n[ºo.]*\s*)?(\d{3,6})/i) || [])[1];
    const nf = (String(texto).match(/\b(?:nf|nfs|nota(?:\s+fiscal)?)\s*(?:n[ºo.]*\s*)?(\d{2,9})\b/i) || [])[1];
    const forn = iaAcharFornecedor(t);
    const so = tem(/\bSEM PEDIDO\b/) ? 'sem-pedido' : tem(/\bSEM RECURSO\b/) ? 'sem-recurso' : tem(/\bSEM PRODUTO\b/) ? 'sem-produto' : tem(/\bSUGERID/) ? 'pedido-sugerido' : tem(/\bESPERANDO\b|\bDECISAO\b/) ? 'decisao-parada' : null;
    if (pedido) { plano.push(['consultar_pedido', { pedido, ...(forn ? { fornecedor: forn } : {}) }]); if (tem(/DIVERGENC/)) { plano.length = 0; plano.push(['divergencias', { pedido, incluir_resolvidas: tem(/RESOLVID|TODAS/) }]); } return plano; }
    if (nf) { plano.push(['detalhe_nf', { numero: nf, ...(forn ? { fornecedor: forn } : {}) }]); return plano; }
    if (tem(/DIVERGENC/)) { plano.push(['divergencias', { ...(forn ? { fornecedor: forn } : {}), incluir_resolvidas: tem(/RESOLVID|TODAS|HISTORICO/) }]); return plano; }
    if (so) { plano.push(['buscar_nfs', { pendencia: so, ...(forn ? { fornecedor: forn } : {}) }]); return plano; }
    if (tem(/PENDENCIA|PENDENTE|ATENCAO|URGENTE|PARADO|O QUE FALTA|HOJE|NOTIFICACO/) && !forn) { plano.push(['pendencias', {}]); return plano; }
    if (forn && tem(/\bNFS?\b|NOTAS?\b/)) { plano.push(['buscar_nfs', { fornecedor: forn, so_com_pendencia: tem(/PENDENCIA|PENDENTE|PROBLEMA/) }]); return plano; }
    if (forn && !tem(/QUANT|MATERIAL|PRODUTO/)) { plano.push(['fornecedor', { nome: forn }]); return plano; }
    const resto = t.filter(w => !IA_PARADAS.has(w) && w !== (forn || '').toUpperCase());
    if (resto.length) { plano.push(['buscar_produto', { texto: resto.join(' '), ...(forn ? { fornecedor: forn } : {}) }]); return plano; }
    return plano;
}
const IA_BRL = n => (n === null || n === undefined || n === '') ? '—' : 'R$ ' + formatValorBR(Number(n));
const IA_RENDER = {
    buscar_nfs(r) {
        if (!r.total) return 'Nenhuma NF encontrada com esse filtro.';
        return `<b>${r.total} NF(s)</b>${r.total > r.mostrando ? ` (mostrando ${r.mostrando})` : ''}<br>` + r.itens.map(n => `• NF ${n.nf} · ${n.fornecedor} · ${IA_BRL(n.valor_total)}${n.pedido ? ' · pedido ' + n.pedido : ' · sem pedido'}${n.pendencias.length ? '<br>&nbsp;&nbsp;↳ ' + n.pendencias.join('; ') : ''}`).join('<br>');
    },
    detalhe_nf(r) {
        if (r.erro) return r.erro;
        return r.nfs.map(n => `<b>NF ${n.nf}</b> · ${n.fornecedor} · ${n.fontes}<br>Total ${IA_BRL(n.totais.total_da_nota)} (produtos ${IA_BRL(n.totais.produtos)}${n.totais.frete ? ' + frete ' + IA_BRL(n.totais.frete) : ''}) · ${n.pedido ? 'pedido ' + n.pedido : 'sem pedido'}${n.destino ? ' · ' + n.destino : ''}${n.recursos ? ' · ' + n.recursos.join(', ') : ''}<br>`
            + n.itens.map(i => `• ${i.nome} · ${i.quantidade} × ${IA_BRL(i.valor_unitario)}${i.produto_cotacao === 'sem produto' ? ' · <i>sem produto da cotação</i>' : ''}`).join('<br>')
            + (n.pendencias.length ? `<br><b>Pendências:</b> ${n.pendencias.join('; ')}` : '')).join('<hr>');
    },
    consultar_pedido(r) {
        if (r.erro) return r.erro;
        return `<b>Pedido ${r.pedido}</b>${r.origem ? ' · ' + r.origem : ''}${r.data_limite ? ' · limite ' + r.data_limite : ''}<br>Fornecedores: ${r.fornecedores.join(', ') || '—'}<br>` + (r.itens.total ? `<b>${r.itens.total} item(ns)</b>${r.itens.total > r.itens.mostrando ? ` (mostrando ${r.itens.mostrando})` : ''}<br>` : '')
            + r.itens.itens.map(i => `• ${i.produto} · ${i.fornecedor}<br>&nbsp;&nbsp;cotado ${i.qtd_cotada ?? '—'}${i.qtd_nf_xml != null ? ' · NF ' + i.qtd_nf_xml : ''}${i.qtd_lancada_erp != null ? ' · ERP ' + i.qtd_lancada_erp : ''}${i.nfs && i.nfs.length ? ' · NFs ' + i.nfs.join(', ') : ''} · ${i.situacao}${i.divergencias.length ? ' · ⚠ ' + i.divergencias.join(', ') : ''}`).join('<br>');
    },
    buscar_produto(r) {
        const sec = (tit, d, f) => d.total ? `<b>${tit} (${d.total})</b><br>` + d.itens.map(f).join('<br>') : '';
        const partes = [sec('Cotações', r.cotacoes, c => `• pedido ${c.pedido} · ${c.produto}${c.descricao && iaPalavras(c.descricao).join(' ') !== iaPalavras(c.produto).join(' ') ? ' (' + escRel(c.descricao) + ')' : ''} · ${c.fornecedor} · ${c.quantidade ?? '—'} × ${IA_BRL(c.preco_unitario)}`),
            sec('NFs (XML)', r.nfs_xml, n => `• NF ${n.nf}${n.data ? ' (' + iaBR(n.data) + ')' : ''} · ${n.fornecedor} · ${n.produto} · ${n.quantidade} × ${IA_BRL(n.valor_unitario)}${n.pedido ? ' · pedido ' + n.pedido : ''}`),
            sec('Lançado no ERP', r.erp, e => `• NF ${e.nf} · ${e.fornecedor} · ${e.produto} · ${e.quantidade} × ${IA_BRL(e.valor_unitario)}${e.data ? ' · ' + iaBR(e.data) : ''}`)].filter(Boolean);
        if (r.quis_dizer) return `Não achei "${escRel(r.quis_dizer.map(x => x.digitado).join(' ')).toLowerCase()}" no cadastro. Você quis dizer:<br>` + r.quis_dizer.map(x => '• ' + x.parecidas.map(escRel).join(' / ')).join('<br>');
        if (r.nao_existe_exato) return `Não existe "${escRel(r.nao_existe_exato)}" em cotações, NFs ou ERP.` + (r.parecidos.length ? '<br>Existem produtos parecidos:<br>' + r.parecidos.map(n => '• ' + escRel(n)).join('<br>') : '');
        return partes.length ? partes.join('<br><br>') : 'Não achei esse material em cotações, NFs ou lançamentos do ERP.';
    },
    divergencias(r) {
        if (!r.total) return '✓ Nenhuma divergência encontrada.';
        return `<b>${r.total} divergência(s)</b>${r.total > r.mostrando ? ` (mostrando ${r.mostrando})` : ''}<br>` + r.itens.map(d => `• pedido ${d.pedido} · ${d.fornecedor || '—'} · ${d.tipo}${d.produtos && d.produtos.length ? ' · ' + d.produtos.slice(0, 2).join(', ') : ''}${d.status !== 'pendente' ? ' · ' + d.status : ''}`).join('<br>');
    },
    pendencias(r) {
        if (!r.length) return '✓ Nada parado por aqui.';
        return r.map(g => `<b>${g.grupo}</b> (${g.quantidade}) · ${({ alta: 'urgente', media: 'importante', baixa: 'quando der' })[g.urgencia] || ''}<br>` + g.exemplos.map(e => '• ' + e).join('<br>')).join('<br><br>');
    },
    fornecedor(r) {
        if (r.erro) return r.erro;
        return `<b>Fornecedor</b> · CNPJs: ${r.cnpjs.join(', ') || '—'}<br>Pedidos: ${r.pedidos.map(p => p.pedido).join(', ') || '—'}<br>NFs: ${r.nfs.quantidade} · total ${IA_BRL(r.nfs.valor_total)} · ${r.nfs.com_pendencia} com pendência<br>Divergências pendentes: ${r.divergencias_pendentes}`;
    }
};
function iaResponderBasico(texto) {
    const plano = iaEntender(texto);
    if (!plano.length) return { html: 'Não entendi a pergunta. No modo básico, tente assim:<br>• <i>situação do pedido 1726</i><br>• <i>NF 1067970</i><br>• <i>divergências do pedido 1726</i><br>• <i>NFs sem pedido</i> / <i>o que está pendente?</i><br>• <i>fornecedor SUPERMED</i><br>• <i>lanceta</i> (material)', usadas: [] };
    const usadas = [], html = plano.map(([nome, args]) => { usadas.push(nome); return IA_RENDER[nome](iaExecutar(nome, args), args); }).join('<hr>');
    return { html, usadas };
}

// ---------------- tela ----------------
const IA_SUGESTOES = ['O que está pendente hoje?', 'Quais divergências estão pendentes?', 'NFs sem pedido', 'Situação do pedido 1726'];
// pedido 1731 / NF 36435 viram links (só no texto, nunca dentro de tags): abre a Central do pedido ou o editor da NF
function iaLinkar(html) {
    return String(html).replace(/(<[^>]*>)|\b(pedido)\s+(\d{3,6})\b|\b(NF)\s*(?:n[ºo.]*\s*)?(\d{2,9})\b/gi, (m, tag, p1, ped, n1, nf) =>
        tag ? tag : ped ? `<a class="ia-link" onclick="abrirCentralPedido('${ped}')">${m}</a>` : `<a class="ia-link" onclick="iaAbrirNf('${nf}')">${m}</a>`);
}
function iaAbrirNf(numero) {
    const l = visoesNf().filter(v => normNfNumero(v.numeroNf) === normNfNumero(numero));
    if (!l.length) return toast('NF ' + numero + ' não encontrada no app.');
    l.sort((a, b) => String(b.dataISO || '').localeCompare(String(a.dataISO || '')));
    if (l.length > 1) toast(l.length + ' NFs com esse número: abrindo a mais recente (' + l[0].fornecedor + ').');
    abrirEditorNf(l[0].id);
}
function iaHtmlResposta(t) {
    const h = escRel(String(t).replace(/&/g, '&amp;')).replace(/&amp;amp;/g, '&amp;')
        .replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/^\s*[-•*]\s+/gm, '• ').replace(/^\s*(\d{1,2})[.)]\s+/gm, '<span class="ia-num">$1.</span> ')
        .replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
    return iaLinkar(h);
}
function iaFmtSeg(ms) { return (ms / 1000).toFixed(1).replace('.', ',') + 's'; }
function iaRodape(ms, rotulo, usadas) {
    return `<div class="ia-rod"><span>⏱ ${iaFmtSeg(ms)} · ${rotulo}${usadas && usadas.length ? ' · consultas: ' + escRel([...new Set(usadas)].join(', ')) : ''}</span><button type="button" class="ia-mini" onclick="iaCopiar(this)">Copiar</button></div>`;
}
function iaCopiar(btn) {
    const b = btn.closest('.ia-bolha'); const c = b && b.querySelector('.ia-corpo'); if (!c) return;
    const txt = c.innerText;
    (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('✓ Resposta copiada.')).catch(() => {
        try { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('✓ Resposta copiada.'); } catch (e) { toast('Não consegui copiar.'); }
    });
}
function iaParar() { if (!assistenteOcupado) return; iaInterrompido = true; if (iaCtlUsuario) iaCtlUsuario.abort(); }
function iaNovaConversa() {
    if (assistenteOcupado) iaParar();
    assistenteMsgs = []; const log = document.getElementById('ia-log'); if (log) log.innerHTML = '';
    const sug = document.getElementById('ia-sugestoes'); if (sug) sug.style.display = '';
}
function iaAdicionarBolha(tipo, html) {
    const log = document.getElementById('ia-log'); if (!log) return null;
    const d = document.createElement('div'); d.className = 'ia-bolha ia-' + tipo; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; d.scrollIntoView({ block: 'nearest' }); return d;
}
function prepararAssistente() {
    const el = document.getElementById('assistente-conteudo'); if (!el) return;
    el.innerHTML = `<div class="ia-barra"><button type="button" class="ia-mini" onclick="iaNovaConversa()">+ Nova conversa</button></div>
        <div class="ia-log" id="ia-log"></div>
        <div class="retro-chips" id="ia-sugestoes">${IA_SUGESTOES.map(s => `<button type="button" class="retro-chip" onclick="iaUsarSugestao(this)">${escRel(s)}</button>`).join('')}</div>
        <div class="ia-entrada"><input type="text" id="ia-texto" class="input-box" placeholder="Pergunte sobre NFs, pedidos, materiais, fornecedores..." onkeydown="if(event.key==='Enter'&&!assistenteOcupado)enviarAssistente()"><button type="button" class="central-status-toggle" id="ia-enviar" onclick="enviarAssistente()">Enviar</button></div>
        <div class="ia-rodape-chat"><div class="ia-modo-wrap"><button type="button" class="ia-modo" id="ia-modo" onclick="iaToggleMenuModo(event)"></button>
            <div class="ia-modo-menu" id="ia-modo-menu" style="display:none"></div></div><span class="ia-aviso">Só lê os dados do app e pode errar: confira os números.</span></div>`;
    iaRenderConfig();
}
function iaUsaIA() { return !!assistenteUrl && !assistenteModoBasico; }
function iaToggleMenuModo(ev) { if (ev) ev.stopPropagation(); const m = document.getElementById('ia-modo-menu'); if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none'; }
function iaEscolherModo(basico) {
    assistenteModoBasico = !!basico; try { localStorage.setItem('iaModoBasico', basico ? '1' : '0'); } catch (e) { }
    iaRenderConfig(); const m = document.getElementById('ia-modo-menu'); if (m) m.style.display = 'none';
}
document.addEventListener('click', () => { const m = document.getElementById('ia-modo-menu'); if (m) m.style.display = 'none'; });
function iaRenderConfig() {
    const b = document.getElementById('ia-modo'), m = document.getElementById('ia-modo-menu'); if (!b || !m) return;
    const ia = iaUsaIA();
    b.innerHTML = `<i class="fa-solid ${ia ? 'fa-wand-magic-sparkles' : 'fa-bolt'}"></i> ${ia ? 'IA' : 'Modo básico'} <i class="fa-solid fa-chevron-up ia-seta"></i>`;
    m.innerHTML = `<button type="button" onclick="iaEscolherModo(false)"><span><b>IA</b><small>Entende perguntas livres (usa o limite grátis do dia)</small></span>${ia ? '<i class="fa-solid fa-check"></i>' : ''}</button>
        <button type="button" onclick="iaEscolherModo(true)"><span><b>Modo básico</b><small>Sem IA, resposta na hora, só palavras-chave</small></span>${!ia ? '<i class="fa-solid fa-check"></i>' : ''}</button>`;
}
function iaUsarSugestao(btn) { const i = document.getElementById('ia-texto'); if (i) { i.value = btn.textContent; enviarAssistente(); } }
function iaBotaoEstado(ocupado) { const bt = document.getElementById('ia-enviar'); if (bt) { bt.textContent = ocupado ? '■ Parar' : 'Enviar'; bt.classList.toggle('ia-parar', !!ocupado); } }
async function enviarAssistente() {
    if (assistenteOcupado) return iaParar();   // enquanto responde, o botão vira "Parar"
    const inp = document.getElementById('ia-texto'); if (!inp) return;
    const texto = inp.value.trim(); if (!texto) return;
    inp.value = ''; assistenteOcupado = true; iaInterrompido = false; iaCtlUsuario = new AbortController(); iaBotaoEstado(true);
    const sug = document.getElementById('ia-sugestoes'); if (sug) sug.style.display = 'none';
    iaAdicionarBolha('eu', escRel(texto));
    const t0 = Date.now(), usadas = [];
    const fim = () => { clearInterval(iaTimer); assistenteOcupado = false; iaCtlUsuario = null; iaBotaoEstado(false); const log = document.getElementById('ia-log'); if (log) log.scrollTop = log.scrollHeight; };
    if (!iaUsaIA()) { // modo básico: grátis, sem IA e sem rede
        const r = iaResponderBasico(texto);
        iaAdicionarBolha('ia', `<div class="ia-corpo">${iaLinkar(r.html)}</div>` + iaRodape(Date.now() - t0, 'modo básico', r.usadas));
        return fim();
    }
    const pens = iaAdicionarBolha('ia', '<span class="ia-pensando">Pensando… 0s</span>');
    const atual = () => { const q = [...new Set(usadas)]; if (pens) pens.innerHTML = `<span class="ia-pensando">${q.length ? 'Consultando: ' + escRel(q.join(', ')) : 'Pensando'}… ${Math.round((Date.now() - t0) / 1000)}s</span>`; };
    clearInterval(iaTimer); iaTimer = setInterval(atual, 1000);
    try {
        const r = await iaPerguntar(texto, (nome) => { usadas.push(nome); atual(); });
        if (pens) pens.innerHTML = `<div class="ia-corpo">${iaHtmlResposta(r)}</div>` + iaRodape(Date.now() - t0, 'IA', usadas);
    } catch (e) {
        if (iaInterrompido || (e && e.message === 'INTERROMPIDO')) { if (pens) pens.innerHTML = `<div class="ia-corpo"><i>⏹ Interrompido por você.</i></div><div class="ia-rod"><span>⏱ ${iaFmtSeg(Date.now() - t0)}</span></div>`; }
        else {
            // a IA falhou (limite do dia, rede...): responde pelo modo básico, que não depende dela
            console.error(e); const b = iaResponderBasico(texto);
            if (pens) pens.innerHTML = `<div class="ia-fonte" style="margin:0 0 8px">⚠ IA indisponível (${escRel(e.message || 'erro')}). Resposta do modo básico:</div><div class="ia-corpo">${iaLinkar(b.html)}</div>` + iaRodape(Date.now() - t0, 'modo básico', b.usadas);
        }
    }
    fim();
}

// 15-ganhadores-cotacoes.js — Relatório de fornecedores ganhadores e lógica central de cotações
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// --- RELATÓRIO "FORNECEDORES GANHADORES" (SmartCompras) — complementa a
// cotação já existente com a quantidade de participantes por item.
// ===================================================================
// Formato real (validado contra relatório de pedido #1708): o texto se
// repete uma vez por fornecedor vencedor dentro do mesmo pedido; dentro de
// cada bloco, cada produto vem como
//   "Cód: <código>\t<nome>\tQtd: <qtd> <unidade>"
// seguido do cabeçalho "Empresa\t..." e uma linha por empresa participante
// (identificada por ter pelo menos 2 valores "R$" na linha). A tabela
// termina na primeira linha sem "R$" (próximo "Cód:", "Total:" ou fim).
function parseRelatorioFornecedoresGanhadores(texto) {
    const t = String(texto || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const linhas = t.split('\n');

    const pedidoMatch = t.match(/pedido #(\d+)/i);
    const pedido = pedidoMatch ? pedidoMatch[1] : null;
    const descricaoMatch = t.match(/Descri[cç][aã]o:\s*(.+)/i);
    const descricao = descricaoMatch ? descricaoMatch[1].trim() : '';

    const itens = [];
    const excecoes = [];
    // O relatório não marca o vencedor dentro da tabela de participantes —
    // só existe formatação visual (✓) no PDF, que não é dado estruturado. O
    // dado confiável é: o texto se repete uma vez por bloco de fornecedor
    // vencedor, e cada bloco começa com o nome do fornecedor seguido da
    // linha "CNPJ: ...". Todo item "Cód:" encontrado DENTRO de um bloco
    // pertence ao fornecedor daquele bloco. Nunca usa nome parecido — só a
    // posição estrutural (nome imediatamente antes da linha CNPJ:).
    let fornecedorAtual = null;
    let i = 0;
    while (i < linhas.length) {
        const cnpjMatch = linhas[i].match(/^CNPJ:\s*([\d.\/-]+)/);
        if (cnpjMatch && i > 0 && linhas[i - 1].trim()) {
            fornecedorAtual = { nome: linhas[i - 1].trim(), cnpj: cnpjMatch[1].replace(/\D/g, '') };
            i++;
            continue;
        }

        const codMatch = linhas[i].match(/^C[oó]d:\s*([^\t]*)\t(.+?)\tQtd:\s*([\d.,]+)\s*(\S*)/i);
        if (codMatch) {
            const codigo = codMatch[1].trim();
            const nomeProduto = codMatch[2].trim();
            const quantidade = parseValorBR(codMatch[3]);
            const unidade = codMatch[4].trim();

            let j = i + 1;
            if (linhas[j] && /^Empresa\t/i.test(linhas[j])) j++;

            const empresas = [];
            while (j < linhas.length) {
                const l = linhas[j];
                // O relatório real separa cada linha de participante por uma
                // linha em branco — isso NÃO é fim da tabela, só espaçamento
                // visual. Pular sem contar, sem parar.
                if (!l.trim()) { j++; continue; }
                // Linha de participante tem pelo menos 2 valores "R$" (val.
                // da proposta e valor total) — assim que isso não bater mais
                // (próximo "Cód:", "Total:" ou próximo fornecedor), a
                // tabela deste produto realmente terminou.
                if ((l.match(/R\$\s*[\d.,]+/g) || []).length < 2) break;
                const partes = l.split('\t');
                empresas.push({
                    nome: (partes[0] || '').trim(),
                    dataValidade: (partes[1] || '').trim(),
                    marca: (partes[2] || '').trim(),
                    valorProposta: (partes[3] || '').trim(),
                    valorTotal: (partes[4] || '').trim()
                });
                j++;
            }

            if (!codigo) {
                excecoes.push({ motivo: 'Sem código SmartCompras identificável', nomeProduto });
            } else if (!fornecedorAtual) {
                excecoes.push({ motivo: 'Item fora de um bloco de fornecedor reconhecido — vencedor não identificado', nomeProduto, codigo });
            } else {
                itens.push({ codigo, nomeProduto, quantidade, unidade, participantes: empresas.length, empresas, fornecedorVencedor: fornecedorAtual });
            }
            i = j;
            continue;
        }
        i++;
    }

    return { pedido, descricao, itens, excecoes };
}

let relatorioGanhadoresPendente = null;

function processarRelatorioGanhadoresColado() {
    const texto = document.getElementById('ganhadores-textarea').value;
    if (!texto || !texto.trim()) return toast('Cole ou envie o relatório antes de processar.');
    const resultado = parseRelatorioFornecedoresGanhadores(texto);
    const preview = document.getElementById('ganhadores-preview');
    if (!resultado.pedido) {
        preview.style.display = 'block';
        document.getElementById('ganhadores-resumo').innerHTML = '<div class="central-item-vazio">Não foi possível identificar o número do pedido neste texto — confira se é o relatório certo.</div>';
        document.getElementById('ganhadores-actions').style.display = 'none';
        return;
    }
    relatorioGanhadoresPendente = resultado;
    const cotacaoExiste = listaCotacoes.some(c => c.pedido === resultado.pedido);
    preview.style.display = 'block';
    document.getElementById('ganhadores-resumo').innerHTML = `
        <div><strong>Pedido:</strong> ${resultado.pedido}${resultado.descricao ? ` — ${resultado.descricao}` : ''}</div>
        <div style="font-size:12px;color:var(--text-light);margin-top:4px;">${cotacaoExiste ? '✓ Cotação já cadastrada — os dados ficarão visíveis nos itens dela.' : '⚠ Ainda não existe cotação cadastrada pra este pedido — os dados ficam guardados e serão exibidos automaticamente assim que ela for importada.'}</div>
        <div style="margin-top:8px;">${resultado.itens.length} item(ns) reconhecido(s):</div>
        ${resultado.itens.map(it => `<div class="xml-item-meta">${it.codigo} — ${it.nomeProduto} — ${it.participantes} fornecedor(es) cotaram — vencedor: ${it.fornecedorVencedor.nome}</div>`).join('')}
        ${resultado.excecoes.length ? `<div style="margin-top:8px;color:var(--button-warning);">${resultado.excecoes.length} exceção(ões): ${resultado.excecoes.map(e => e.motivo + ' (' + e.nomeProduto + ')').join('; ')}</div>` : ''}
    `;
    document.getElementById('ganhadores-actions').style.display = 'flex';
}

function handleRelatorioGanhadoresFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('ganhadores-textarea').value = decodificarArquivoTexto(e.target.result);
        toast('Arquivo carregado! Clique em "Processar".');
    };
    reader.onerror = () => toast('Erro ao ler o arquivo.');
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function cancelarImportacaoGanhadores() {
    relatorioGanhadoresPendente = null;
    document.getElementById('ganhadores-preview').style.display = 'none';
    document.getElementById('ganhadores-textarea').value = '';
}

// Reimportar o mesmo pedido substitui o doc inteiro (não duplica): o
// relatório reflete o estado final da cotação, não precisa de histórico
// incremental por item.
async function confirmarImportacaoGanhadores() {
    if (!relatorioGanhadoresPendente) return;
    const dados = relatorioGanhadoresPendente;
    try {
        const r = await salvarRelatorioGanhadoresEComplementarCotacao(dados);
        toast(r.cotacaoExiste
            ? `✓ Relatório do pedido ${dados.pedido} importado — ${dados.itens.length} item(ns), ${r.nomesComplementados} nome(s) complementado(s) na cotação.`
            : `✓ Relatório do pedido ${dados.pedido} importado — ${dados.itens.length} item(ns).`);
        cancelarImportacaoGanhadores();
        if (centralPedidoAtual === dados.pedido) renderCentralPedidoCompleto(centralPedidoAtual);
    } catch (e) {
        console.error('Erro ao importar relatório de fornecedores ganhadores:', e);
        toast('✕ Erro ao importar o relatório.');
    }
}

function cancelarImportacaoXml() {
    importacaoXmlPendente = null;
    document.getElementById('card-preview-importacao-xml').style.display = 'none';
}

// Reimportar o XML de um pedido já cadastrado sobrescreve itens com os dados
// crus da nova versão — mas o nomeOficial de cada item NUNCA vem do XML, só
// do relatório do SmartCompras colado depois (cruzarRelatorioComCotacao). Sem
// isso, reimportar apagava silenciosamente o nome oficial já complementado.
// Casa pelo mesmo par usado no cruzamento: codProduto + cnpjFornecedor.
// (O recurso por item, Fase 7, fica num campo próprio no nível da cotação —
// recursosPorItem — e não é tocado aqui, então sobrevive ao reimport
// automaticamente graças ao merge:true da escrita abaixo.)
function preservarNomeOficialAoReimportar(itensAntigos, itensNovosXml) {
    if (!itensAntigos || !itensAntigos.length) return itensNovosXml;
    return itensNovosXml.map(novo => {
        const antigo = itensAntigos.find(it => it.codProduto === novo.codProduto && normalizarCnpj(it.cnpjFornecedor) === normalizarCnpj(novo.cnpjFornecedor));
        return (antigo && antigo.nomeOficial) ? { ...novo, nomeOficial: antigo.nomeOficial } : novo;
    });
}

async function confirmarImportacaoXmlSmartCompras() {
    if (!importacaoXmlPendente) return;
    const { parsed, existente, diff } = importacaoXmlPendente;
    const agora = new Date().toISOString();
    const proximaVersao = existente ? (existente.versaoAtual || 1) + 1 : 1;
    const dataLimiteSugerida = sugerirDataLimiteXml(parsed.itens);

    try {
        // Snapshot imutável desta importação — nunca sobrescrito, mesmo que
        // o pedido seja reimportado depois.
        await cotacoesCollection.doc(parsed.pedido).collection('versoes').doc(String(proximaVersao)).set({
            importadoEm: agora,
            fornecedores: parsed.fornecedores,
            itens: parsed.itens,
            dataVencimento: parsed.dataVencimento,
            horaVencimento: parsed.horaVencimento,
            diffDaAnterior: diff
        });

        const dadosPrincipal = {
            fornecedores: parsed.fornecedores,
            itens: parsed.itens,
            dataVencimento: parsed.dataVencimento,
            horaVencimento: parsed.horaVencimento,
            versaoAtual: proximaVersao,
            origemDado: 'xml',
            atualizadoEm: agora
        };

        if (existente) {
            // Nunca mexe em origem/dataLimite/observação já preenchidas pelo
            // usuário — só os campos que vêm do XML são atualizados. E o
            // nomeOficial (relatório do SmartCompras) é preservado item a
            // item, já que o XML reimportado nunca traz esse campo.
            dadosPrincipal.itens = preservarNomeOficialAoReimportar(existente.itens, parsed.itens);
            await cotacoesCollection.doc(parsed.pedido).set(dadosPrincipal, { merge: true });
            toast(`✓ Pedido ${parsed.pedido} atualizado para a versão ${proximaVersao}!`);
        } else {
            // Data do Pedido = data de finalização do pedido no XML (Data_Vencimento
            // do Cabeçalho) — antes ficava com a data do dia da importação, que não
            // tem relação com quando o pedido de fato fechou. Data Limite sugerida =
            // Data do Pedido + 5 dias (prazo padrão), sempre editável manualmente.
            const dataPedidoDoXml = converterDataBRparaISO(parsed.dataVencimento);
            dadosPrincipal.origem = '';
            dadosPrincipal.dataPedido = dataPedidoDoXml || new Date().toISOString().slice(0, 10);
            dadosPrincipal.dataLimite = dataPedidoDoXml ? somarDiasISO(dataPedidoDoXml, 5) : '';
            dadosPrincipal.observacao = '';
            dadosPrincipal.criadoEm = agora;
            await cotacoesCollection.doc(parsed.pedido).set(dadosPrincipal);
            toast(`✓ Pedido ${parsed.pedido} importado! Defina a Origem (Santa Casa/CTI) — datas já sugeridas a partir do XML.`);
            // Anotação "resumo vivo" do pedido, criada automaticamente na primeira
            // importação — só nesse branch (cotação nova), nunca no de reimportação/
            // atualização, que não deve ser alterado.
            await criarOuAtualizarAnotacaoDaCotacao(parsed.pedido, '', dadosPrincipal.dataPedido, dadosPrincipal.dataLimite, dadosPrincipal.fornecedores);
        }

        if (dataLimiteSugerida && existente) {
            toast(`Sugestão de data limite de entrega: ${dataLimiteSugerida.split('-').reverse().join('/')} (baseada no XML — confirme manualmente).`);
        }

        // Se um relatório de fornecedores ganhadores já tinha sido colado
        // ANTES desta cotação existir (Parte 3 da correção — pode acontecer
        // nos dois sentidos), complementa o nome oficial agora, sem esperar
        // o usuário colar de novo. Usa dadosPrincipal.itens (o que acabou
        // de ser gravado) direto, não a lista em cache — o snapshot local
        // ainda não teve tempo de refletir esta escrita.
        const relatorioPendente = listaRelatorioGanhadores.find(r => r.pedido === parsed.pedido);
        if (relatorioPendente) {
            const cruzamento = cruzarRelatorioComCotacao({ pedido: parsed.pedido, itens: dadosPrincipal.itens }, agruparGanhadoresPorFornecedor(relatorioPendente.itens));
            if (cruzamento.atualizacoes.length > 0) {
                const itensComplementados = dadosPrincipal.itens.map(it => {
                    const match = cruzamento.atualizacoes.find(a => a.codProduto === it.codProduto && mesmoCnpj(a.cnpjFornecedor, it.cnpjFornecedor));
                    return match ? { ...it, nomeOficial: match.nomeOficial } : it;
                });
                await cotacoesCollection.doc(parsed.pedido).update({ itens: itensComplementados, atualizadoEm: new Date().toISOString() });
                toast(`✓ ${cruzamento.atualizacoes.length} nome(s) de produto complementado(s) a partir do relatório de ganhadores já importado.`);
            }
        }

        cancelarImportacaoXml();
        await abrirCentralPedido(parsed.pedido);
    } catch (e) {
        console.error('Erro ao importar cotação:', e);
        toast('✕ Erro ao importar. Tente novamente.');
    }
}

// ============================================================
// RELATÓRIO TEXTUAL DO SMARTCOMPRAS — complementa o XML com o nome oficial
// do produto (informação que o XML simplesmente não exporta). Entrada
// textual determinística, colada direto do navegador — sem OCR, sem
// reconhecimento visual, sem adivinhação.
//
// REGRA DEFINITIVA (várias rodadas de revisão até chegar aqui):
// - O cruzamento confirmado (código SmartCompras + CNPJ do fornecedor,
//   dentro do MESMO pedido) só prova que XML e relatório descrevem o mesmo
//   ITEM DAQUELA COTAÇÃO. Isso NUNCA cria uma identidade de produto entre
//   pedidos diferentes — essa identidade definitiva será o código do SP
//   Data, numa fase futura ainda não implementada.
// - Nome oficial do relatório enriquece o item (campo novo: nomeOficial),
//   nunca substitui nem se mistura com a observação do fornecedor
//   (campo já existente: descricao — mantido como está no banco pra não
//   tocar no caminho de escrita do XML já testado).
// - Nenhum número dentro de uma observação (ex: "(301982)" na observação da
//   agulha) é extraído ou interpretado como código de fornecedor — isso é
//   texto livre, nunca fonte de identidade.
// - Sem correspondência exata (código+CNPJ) → item fica de fora, mostrado
//   como pendente, nunca "no chute".
// ============================================================

// Converte o resultado plano de parseRelatorioFornecedoresGanhadores (uma
// linha por item, com o fornecedor vencedor embutido) pro formato agrupado
// por fornecedor que cruzarRelatorioComCotacao espera. É só uma
// reorganização dos MESMOS dados já parseados — nenhuma nova leitura de
// texto, nenhuma identificação adicional.
function agruparGanhadoresPorFornecedor(itensGanhadores) {
    const porCnpj = {};
    itensGanhadores.forEach(it => {
        const cnpj = it.fornecedorVencedor.cnpj;
        if (!porCnpj[cnpj]) porCnpj[cnpj] = { cnpj, razaoSocial: it.fornecedorVencedor.nome, itens: [] };
        porCnpj[cnpj].itens.push({ codigo: it.codigo, produto: it.nomeProduto, quantidade: String(it.quantidade) });
    });
    return { fornecedores: Object.values(porCnpj) };
}

// Cruza o relatório já parseado com a cotação já cadastrada — determinístico
// por código SmartCompras + CNPJ, nada mais. Quantidade/valor unitário só
// servem de checagem cruzada (avisa se não bater, nunca decide sozinho).
function cruzarRelatorioComCotacao(cotacao, relatorio) {
    const atualizacoes = []; // { codProduto, cnpjFornecedor, nomeOficial }
    const semCorrespondencia = [];
    const divergenciasDetectadas = [];

    relatorio.fornecedores.forEach(fRel => {
        fRel.itens.forEach(itRel => {
            const itemCotacao = (cotacao.itens || []).find(it => it.codProduto === itRel.codigo && mesmoCnpj(it.cnpjFornecedor, fRel.cnpj));
            if (!itemCotacao) {
                semCorrespondencia.push({ codigo: itRel.codigo, produto: itRel.produto, fornecedor: fRel.razaoSocial });
                return;
            }
            atualizacoes.push({ codProduto: itRel.codigo, cnpjFornecedor: itemCotacao.cnpjFornecedor, nomeOficial: itRel.produto });

            const qtdXml = parseFloat((itemCotacao.quantidade || '').replace(/\./g, '').replace(',', '.'));
            const qtdRel = parseFloat((itRel.quantidade || '').replace(/\./g, '').replace(',', '.'));
            if (!isNaN(qtdXml) && !isNaN(qtdRel) && qtdXml !== qtdRel) {
                divergenciasDetectadas.push(`${itRel.produto}: quantidade no XML (${itemCotacao.quantidade}) difere do relatório (${itRel.quantidade})`);
            }
        });
    });

    return { atualizacoes, semCorrespondencia, divergenciasDetectadas };
}

// ===== Lógica central única — usada pelos DOIS pontos de entrada =====
// (tela geral de Cotações e Central do Pedido). Resolve o bug relatado: os
// dois pontos de entrada tinham parsers DIFERENTES — só parseRelatorioFor-
// necedoresGanhadores realmente casa com o formato real do relatório (a
// identificação do fornecedor vencedor é sempre estrutural: nome
// imediatamente antes da linha "CNPJ:", nunca por nome aproximado). O outro
// parser (parseRelatorioSmartCompras, removido) esperava um cabeçalho de
// tabela que o relatório real não tem, então nunca reconhecia os
// fornecedores corretamente nesse ponto de entrada — essa era a causa real,
// não um problema de exibição.
//
// Grava em DOIS lugares já existentes, nunca numa coleção nova:
// 1) relatorioGanhadores/{pedido} — registro completo (todos os
//    participantes por item, contagem de cotações) usado pela Central do
//    Pedido e pela Fase 7 (Analisar por item).
// 2) cotacoes/{pedido}.itens[].nomeOficial — só quando já existe cotação
//    cadastrada pra esse pedido, complementando o nome oficial do produto
//    (o XML não traz isso). Nunca cria nem redefine outros campos do item.
async function salvarRelatorioGanhadoresEComplementarCotacao(resultado) {
    await relatorioGanhadoresCollection.doc(resultado.pedido).set({
        pedido: resultado.pedido,
        descricao: resultado.descricao,
        itens: resultado.itens,
        excecoes: resultado.excecoes,
        importadoEm: new Date().toISOString()
    });

    const cotacao = listaCotacoes.find(c => c.pedido === resultado.pedido);
    if (!cotacao) return { cotacaoExiste: false, nomesComplementados: 0 };

    const relatorioAgrupado = agruparGanhadoresPorFornecedor(resultado.itens);
    const cruzamento = cruzarRelatorioComCotacao(cotacao, relatorioAgrupado);
    if (cruzamento.atualizacoes.length > 0) {
        const novosItens = (cotacao.itens || []).map(it => {
            const match = cruzamento.atualizacoes.find(a => a.codProduto === it.codProduto && mesmoCnpj(a.cnpjFornecedor, it.cnpjFornecedor));
            return match ? { ...it, nomeOficial: match.nomeOficial } : it;
        });
        await cotacoesCollection.doc(resultado.pedido).update({ itens: novosItens, atualizadoEm: new Date().toISOString() });
    }
    return { cotacaoExiste: true, nomesComplementados: cruzamento.atualizacoes.length, semCorrespondencia: cruzamento.semCorrespondencia, divergenciasDetectadas: cruzamento.divergenciasDetectadas };
}

// ----- Ponto de entrada: Central do Pedido -----
let relatorioSmartComprasPendente = null;

function processarRelatorioSmartComprasColado() {
    const texto = document.getElementById('relatorio-smartcompras-texto').value.trim();
    if (!texto) return toast('Cole o texto do relatório antes de processar.');
    if (!centralPedidoAtual) return;

    const resultado = parseRelatorioFornecedoresGanhadores(texto);
    if (!resultado.pedido) return toast('✕ Não consegui interpretar esse texto. Confira se é o relatório de fornecedores ganhadores.');
    if (resultado.pedido !== centralPedidoAtual) {
        return toast(`✕ Esse relatório é do pedido ${resultado.pedido}, mas você está na Central do pedido ${centralPedidoAtual}.`);
    }
    if (resultado.itens.length === 0) return toast('✕ Nenhum fornecedor/item reconhecido nesse texto.');

    const cotacao = listaCotacoes.find(c => c.pedido === centralPedidoAtual);
    const cruzamento = cotacao ? cruzarRelatorioComCotacao(cotacao, agruparGanhadoresPorFornecedor(resultado.itens)) : null;
    relatorioSmartComprasPendente = resultado;

    const resumoEl = document.getElementById('relatorio-smartcompras-resumo');
    let html = `<div class="xml-resumo-linha"><strong>Fornecedores no relatório:</strong> ${new Set(resultado.itens.map(it => it.fornecedorVencedor.cnpj)).size}</div>`;
    html += `<div class="xml-resumo-linha"><strong>Itens no relatório:</strong> ${resultado.itens.length}</div>`;
    if (!cotacao) {
        html += `<div class="xml-resumo-linha">⚠ Ainda não existe cotação cadastrada pra este pedido — o relatório fica guardado e o complemento de nome acontece automaticamente assim que a cotação for importada.</div>`;
    } else {
        html += `<div class="xml-resumo-linha"><strong>Nomes que serão complementados:</strong> ${cruzamento.atualizacoes.length}</div>`;
        if (cruzamento.semCorrespondencia.length > 0) {
            html += `<div class="xml-diff-titulo">Itens do relatório sem correspondência na cotação (não afetados):</div><ul class="xml-diff-lista">${cruzamento.semCorrespondencia.map(x => `<li>${x.codigo} — ${x.produto} (${x.fornecedor})</li>`).join('')}</ul>`;
        }
        if (cruzamento.divergenciasDetectadas.length > 0) {
            html += `<div class="xml-diff-titulo">Possíveis divergências detectadas (revisar, não corrigidas automaticamente):</div><ul class="xml-diff-lista">${cruzamento.divergenciasDetectadas.map(l => `<li>${l}</li>`).join('')}</ul>`;
        }
    }
    if (resultado.excecoes.length) {
        html += `<div class="xml-diff-titulo">${resultado.excecoes.length} exceção(ões) no relatório:</div><ul class="xml-diff-lista">${resultado.excecoes.map(e => `<li>${e.motivo} (${e.nomeProduto})</li>`).join('')}</ul>`;
    }
    resumoEl.innerHTML = html;
    document.getElementById('relatorio-smartcompras-preview').style.display = 'block';
}

function cancelarRelatorioSmartCompras() {
    relatorioSmartComprasPendente = null;
    document.getElementById('relatorio-smartcompras-preview').style.display = 'none';
    document.getElementById('relatorio-smartcompras-texto').value = '';
}

async function confirmarRelatorioSmartCompras() {
    if (!relatorioSmartComprasPendente) return;
    try {
        const r = await salvarRelatorioGanhadoresEComplementarCotacao(relatorioSmartComprasPendente);
        toast(r.cotacaoExiste ? `✓ Relatório salvo — ${r.nomesComplementados} nome(s) de produto complementado(s).` : '✓ Relatório salvo — será aplicado à cotação assim que ela for importada.');
        cancelarRelatorioSmartCompras();
        if (centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
    } catch (e) {
        console.error('Erro ao salvar relatório de fornecedores ganhadores:', e);
        toast('✕ Erro ao salvar. Tente novamente.');
    }
}

// ============================================================
// PRODUTOS SP DATA — camada de identidade padronizada, independente da
// cotação. produtosSpData/{codigoSpData} é a fonte da verdade do cadastro;
// associacoesSpData/{codigoSmartCompras} é a camada que liga um código
// externo (SmartCompras) a essa identidade. Nada disso toca em
// cotacoes/{pedido}.itens[] — a associação é resolvida ao vivo na Central,
// nunca gravada dentro do item, pra uma correção futura refletir em todos
// os pedidos que usam aquele código automaticamente.
//
// Parser já validado com o arquivo real (2.665 produtos, zero duplicidade,
// largura de coluna confirmada pela borda do relatório, ISO-8859-1) — só
// portado pra JS aqui, sem repetir a validação.
// ============================================================

// As colunas variam de largura conforme o relatório do SGH que a pessoa colar
// (Listagem de itens, Listagem simples, por grupo, por subgrupo...) — todos
// têm o mesmo layout de tabela com borda "+----+----+", só a largura de cada
// coluna muda. Em vez de fixar a largura de UM relatório específico (o que
// cortava o nome sempre que alguém colava um relatório com coluna mais
// larga), as colunas são lidas da própria borda/cabeçalho colado. Sem
// cabeçalho reconhecível, cai nas posições do relatório mais estreito (
// "Listagem de itens I") como antes, pra continuar aceitando um trecho colado
// só com as linhas de dado.
function colunasInventarioSpData(linhas) {
    const bordaRe = /^\+[-+]+\+\s*$/;
    const idxBorda = linhas.findIndex((l, i) => bordaRe.test(l) && linhas[i + 1] && /\|/.test(linhas[i + 1]) && bordaRe.test(linhas[i + 2] || ''));
    if (idxBorda === -1) return { codigo: [0, 7], nome: [7, 45], unidade: [45, 54], quantidade: [54, 67], preco: [81, 95] };
    const borda = linhas[idxBorda];
    const cabecalho = linhas[idxBorda + 1];
    const marcas = [...borda].reduce((a, c, i) => { if (c === '+') a.push(i); return a; }, []);
    const cols = [];
    for (let i = 0; i < marcas.length - 1; i++) cols.push({ ini: marcas[i] + 1, fim: marcas[i + 1], titulo: cabecalho.slice(marcas[i] + 1, marcas[i + 1]).trim().toUpperCase() });
    const acha = (regex) => { const c = cols.find(c => regex.test(c.titulo)); return c ? [c.ini, c.fim] : null; };
    return {
        codigo: acha(/C[OÓ]D/) || [0, 7],
        nome: acha(/NOME/) || [7, 45],
        unidade: acha(/^UN\.?\s*CON/) || acha(/UNI?D/) || acha(/^UN/) || null,
        quantidade: acha(/QUANT/) || null,
        preco: acha(/PRE[CÇ]O/) || null
    };
}
function handleInventarioSpDataFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('spdata-inventario-texto').value = decodificarArquivoTexto(e.target.result);
        toast('Arquivo carregado! Toque em "Processar".');
    };
    reader.onerror = () => toast('Erro ao ler o arquivo.');
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}
function parseInventarioSpData(texto) {
    const linhas = texto.split('\n').map(l => l.replace(/\r$/, ''));
    const produtos = [];
    const P = colunasInventarioSpData(linhas);
    linhas.forEach(l => {
        if (!/^\|?\s*\d+[\s|]/.test(l) || l.includes('Pag:') || l.includes('Pag.:')) return; // pula cabeçalho/rodapé/linhas de total (Grupo:/Subgrupo:/Local de armazenagem: também não começam com dígito)
        const codigo = l.slice(P.codigo[0], P.codigo[1]).trim();
        const nome = l.slice(P.nome[0], P.nome[1]).trim();
        const unidade = P.unidade ? l.slice(P.unidade[0], P.unidade[1]).trim() : '';
        const quantidade = P.quantidade ? l.slice(P.quantidade[0], P.quantidade[1]).trim() : '';
        const preco = P.preco ? l.slice(P.preco[0], P.preco[1]).trim() : '';
        if (!codigo || !nome) return;
        produtos.push({ codigo, nome: upAud(nome), unidade, quantidade, preco });
    });
    return produtos;
}

let inventarioSpDataPendente = null;

function processarInventarioSpDataColado() {
    const texto = document.getElementById('spdata-inventario-texto').value;
    if (!texto.trim()) return toast('Cole o texto do relatório antes de processar.');
    const produtos = parseInventarioSpData(texto);
    if (produtos.length === 0) return toast('✕ Nenhum produto reconhecido nesse texto.');

    const codigosExistentes = new Set(listaProdutosSpData.map(p => p.codigo));
    const novos = produtos.filter(p => !codigosExistentes.has(p.codigo)).length;
    const atualizados = produtos.length - novos;

    inventarioSpDataPendente = produtos;
    document.getElementById('spdata-resumo').innerHTML = `
        <div class="xml-resumo-linha"><strong>Produtos no relatório:</strong> ${produtos.length}</div>
        <div class="xml-resumo-linha"><strong>Novos:</strong> ${novos}</div>
        <div class="xml-resumo-linha"><strong>Já cadastrados (serão atualizados):</strong> ${atualizados}</div>
    `;
    document.getElementById('spdata-preview').style.display = 'block';
}

function cancelarImportacaoSpData() {
    inventarioSpDataPendente = null;
    document.getElementById('spdata-preview').style.display = 'none';
    document.getElementById('spdata-inventario-texto').value = '';
}
function atualizarContagemSpData() {
    renderListaProdutosSpData();
}


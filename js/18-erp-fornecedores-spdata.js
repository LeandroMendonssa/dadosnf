// 18-erp-fornecedores-spdata.js — Importação do ERP, entradas do ERP e cadastro de fornecedores SP Data
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// --- IMPORTAÇÃO DE RELATÓRIO DO ERP (Relação de Notas Fiscais) ---
// ===================================================================
// Formato de origem: relatório TXT tipo "Sistema de Gestao Hospitalar -
// Controle de Estoque - Relacao de notas fiscais". Cada nota fiscal vem
// em um bloco com cabeçalho "Nota fiscal: NNNN Documento: NN", seguido
// dos itens, do resumo financeiro (Frete/Total da nota) e de uma tabela
// "Seq. Vencimento Valor" com uma ou mais parcelas.
//
// Regras de reconhecimento:
// 1) Vencimento usado = data da 1ª parcela (Seq 1) da tabela de vencimentos.
// 2) Data da nota = "Data de emissão" quando existir no relatório; quando
//    não houver (caso deste formato, que só traz "lançada em"), usa-se a
//    data de lançamento como substituta.
// 3) Valor total = soma de todas as parcelas do quadro de vencimentos, já
//    que esse valor reflete frete e ajustes (ex.: um caso real do relatório
//    tem "Total da nota" sem o frete, mas o quadro de vencimentos já soma
//    o frete). Se a soma das parcelas ficar MENOR que o "Total da nota"
//    declarado, é sinal de que a tabela de vencimentos foi cortada por uma
//    quebra de página (também observado no relatório real) — nesse caso
//    usa-se o "Total da nota" e a nota é marcada com aviso para revisão.

let notasImportadasPreview = [];
let mostrarApenasNovasImportacao = true;

function parseValorBR(str) {
    if (!str) return 0;
    const limpo = String(str).trim().replace(/\./g, '').replace(',', '.');
    const n = parseFloat(limpo);
    return isNaN(n) ? 0 : n;
}

function formatValorBR(num) {
    return (num || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Colunas de largura fixa da tabela de itens (mesmo estilo já usado no
// importador de inventário do SP Data — ver P em confirmarImportacaoSpData).
// Posições calculadas a partir da linha separadora "+------+----...+" do
// próprio relatório real (0409.TXT): cada '+' marca o limite de uma coluna.
const COLUNAS_ITEM_ERP = { codigo: [0, 7], nome: [7, 48], unidade: [48, 55], lc: [55, 58], quantidade: [58, 71], icms: [71, 82], ipi: [82, 94], desconto: [94, 105], valorUnitario: [105, 119], valorTotal: [119, 132] };

// Extrai os itens de um bloco de NF já isolado por parseRelatorioERP. O
// "Código" de cada linha É o código do produto no SP Data (produtosSpData) —
// não precisa de nenhuma associação intermediária pra chegar lá. Usa posição
// fixa de coluna (não regex) pra não se confundir com nomes de produto que
// têm números/parênteses/barras. Uma linha só é aceita como item quando o
// código é só dígitos E a unidade não é vazia nem só dígitos — isso separa
// itens de linhas de rodapé, da tabela de vencimentos e de cabeçalhos de
// página repetidos (quando a nota quebra em mais de uma página).
function extrairItensBlocoErp(blocoTexto) {
    return blocoTexto.split('\n').reduce((itens, linhaOriginal) => {
        const linha = linhaOriginal.padEnd(132, ' ');
        const seg = (chave) => linha.slice(COLUNAS_ITEM_ERP[chave][0], COLUNAS_ITEM_ERP[chave][1]).trim();
        const codigo = seg('codigo');
        const unidade = seg('unidade');
        if (!/^\d+$/.test(codigo) || !unidade || /^\d+$/.test(unidade)) return itens;
        itens.push({
            codigoSpData: codigo,
            nome: seg('nome'),
            unidade,
            quantidade: parseValorBR(seg('quantidade')),
            icmsPercentual: parseValorBR(seg('icms').replace('%', '')),
            ipiPercentual: parseValorBR(seg('ipi').replace('%', '')),
            descontoPercentual: parseValorBR(seg('desconto').replace('%', '')),
            valorUnitario: parseValorBR(seg('valorUnitario')),
            valorTotal: parseValorBR(seg('valorTotal'))
        });
        return itens;
    }, []);
}

function parseRelatorioERP(textoOriginal) {
    const t = String(textoOriginal || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Localiza todos os cabeçalhos de bloco "Nota fiscal: NNN Documento: NN"
    const blockStartRe = /\|\s*Nota fiscal:\s*(\d+)\s+Documento:\s*(\d+)/g;
    const starts = [];
    let m;
    while ((m = blockStartRe.exec(t)) !== null) {
        starts.push({ pos: m.index, nf: m[1], doc: m[2] });
    }
    if (starts.length === 0) return [];
    starts.push({ pos: t.length, nf: null, doc: null });

    // Agrupa blocos repetidos (o mesmo NF+Documento aparece de novo quando
    // o relatório quebra de página no meio de uma nota)
    const blocks = [];
    let i = 0;
    while (i < starts.length - 1) {
        const atual = starts[i];
        let j = i + 1;
        let end = starts[j].pos;
        while (j < starts.length - 1 && starts[j].nf === atual.nf && starts[j].doc === atual.doc) {
            j++;
            end = starts[j].pos;
        }
        blocks.push({ nf: atual.nf, doc: atual.doc, texto: t.slice(atual.pos, end) });
        i = j;
    }

    return blocks.map(({ nf, doc, texto: bloco }) => {
        const avisos = [];

        // Fornecedor: código de cadastro no SP Data (útil por si só, e é a
        // chave que futuramente vai resolver o CNPJ via cadastro oficial de
        // fornecedores) + nome, na mesma linha do relatório.
        const fornMatch = bloco.match(/Fornecedor:\s*(\d+)\s+(.+?)\s+Qtde\.\s*lan[cç]amentos/i);
        const codigoFornecedorSpData = fornMatch ? fornMatch[1] : '';
        const fornecedor = fornMatch ? fornMatch[2].trim().toUpperCase().replace(/\s+/g, ' ') : '';
        if (!fornecedor) avisos.push('Não foi possível identificar o fornecedor — confira manualmente.');

        const serieMatch = bloco.match(/S[eé]rie:\s*(\S+)/i);
        const serie = serieMatch ? serieMatch[1] : '';

        // Data da nota: usa "Data de emissão" se existir; senão, "lançada em"
        let data = '';
        const emissaoMatch = bloco.match(/Data\s*de\s*Emiss[aã]o\s*[:.]*\s*(\d{2}\/\d{2}\/\d{4})/i) || bloco.match(/Emiss[aã]o\s*[:.]*\s*(\d{2}\/\d{2}\/\d{4})/i);
        const lancadaMatch = bloco.match(/lan[cç]ada em\s+(\d{2}\/\d{2}\/\d{4})/i);
        if (emissaoMatch) {
            data = emissaoMatch[1];
        } else if (lancadaMatch) {
            data = lancadaMatch[1];
        } else {
            avisos.push('Data de emissão/lançamento não encontrada — preencha manualmente.');
        }

        // Quadro "Seq. Vencimento Valor"
        const vencRe = /^\s*(\d{1,3})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.]+,\d{2})/gm;
        const parcelas = [];
        let vm;
        while ((vm = vencRe.exec(bloco)) !== null) {
            parcelas.push({ seq: parseInt(vm[1], 10), data: vm[2], valor: parseValorBR(vm[3]) });
        }
        parcelas.sort((a, b) => a.seq - b.seq);

        const totalNotaMatch = bloco.match(/Total da nota\.*:\s*([\d.]+,\d{2})/i);
        const freteMatch = bloco.match(/Frete\.*:\s*([\d.]+,\d{2})/i);
        const totalNota = totalNotaMatch ? parseValorBR(totalNotaMatch[1]) : null;
        const frete = freteMatch ? parseValorBR(freteMatch[1]) : 0;

        // Demais campos financeiros do rodapé — só leitura/armazenamento,
        // nenhum entra no cálculo de `valor` (mantido como já era, pra não
        // mudar o que o fluxo de Adicionar Nota já usa).
        const seguroMatch = bloco.match(/Seguro\.*:\s*([\d.]+,\d{2})/i);
        const icmsValorMatch = bloco.match(/ICMS\s+de\s+[\d.,]+\s*%\.*:\s*([\d.]+,\d{2})/i);
        const outrasDespesasMatch = bloco.match(/Outras despesas\.*:\s*([\d.]+,\d{2})/i);
        const descontosObtidosMatch = bloco.match(/Descontos obtidos\.*:\s*([\d.]+,\d{2})/i);
        const fatorAjustagemMatch = bloco.match(/Fator de ajustagem\.*:\s*([\d.,]+)/i);
        const totalLancamentosMatch = bloco.match(/Total dos lan[cç]amentos\.*:\s*([\d.]+,\d{2})/i);
        const financeiro = {
            totalLancamentos: totalLancamentosMatch ? parseValorBR(totalLancamentosMatch[1]) : null,
            frete,
            seguro: seguroMatch ? parseValorBR(seguroMatch[1]) : 0,
            icmsValor: icmsValorMatch ? parseValorBR(icmsValorMatch[1]) : 0,
            outrasDespesas: outrasDespesasMatch ? parseValorBR(outrasDespesasMatch[1]) : 0,
            descontosObtidos: descontosObtidosMatch ? parseValorBR(descontosObtidosMatch[1]) : 0,
            fatorAjustagem: fatorAjustagemMatch ? fatorAjustagemMatch[1] : '',
            totalNota
        };

        const itens = extrairItensBlocoErp(bloco);

        let vencimento = '';
        let valorTotalNum = 0;

        if (parcelas.length > 0) {
            vencimento = parcelas[0].data;
            const somaParcelas = parcelas.reduce((s, p) => s + p.valor, 0);

            if (totalNota !== null && somaParcelas < totalNota - 0.01) {
                // Soma das parcelas não cobre o total da nota: provável quebra
                // de página cortando o quadro de vencimentos no meio.
                valorTotalNum = totalNota;
                avisos.push(`Quadro de vencimentos parece incompleto (soma das parcelas R$ ${formatValorBR(somaParcelas)} é menor que o total da nota R$ ${formatValorBR(totalNota)}). Foi usado o total da nota — confira as datas de vencimento.`);
            } else {
                valorTotalNum = somaParcelas;
            }
            if (parcelas.length > 1) {
                avisos.push(`Nota parcelada em ${parcelas.length}x. Foi usado o vencimento da 1ª parcela (${vencimento}) e o valor total soma todas as parcelas.`);
            }
        } else {
            avisos.push('Quadro de vencimentos não encontrado — usada a data de lançamento e o total da nota. Confira o vencimento manualmente.');
            vencimento = data;
            valorTotalNum = (totalNota !== null ? totalNota : 0) + frete;
        }

        return {
            nf: (nf || '').trim(),
            documento: doc,
            serie,
            codigoFornecedorSpData,
            fornecedor,
            data,
            vencimento,
            valor: formatValorBR(valorTotalNum),
            parcelas: parcelas.length,
            parcelasDetalhe: parcelas,
            itens,
            financeiro,
            avisos
        };
    });
}

// ===================================================================
// --- HISTÓRICO DE ENTRADAS DO ERP (entradasErp) ---
// ===================================================================
// Fonte independente: cada bloco de NF do relatório vira um doc, tal como
// veio do relatório (nf, série, código do fornecedor no SP Data, itens[]
// com o código SP Data direto, financeiro{}, parcelas). Nunca escreve em
// cotacoes/notas/associações — é só uma terceira fonte de leitura.
//
// Agora que o cadastro oficial de fornecedores (fornecedoresSpData) existe,
// o CNPJ é resolvido a partir do codigoFornecedorSpData na hora de salvar
// (ver vincularEntradaErpComNf) e gravado em `cnpjFornecedor` quando
// encontrado — nunca por semelhança de nome, e nunca escolhendo um CNPJ
// arbitrário quando o código tem mais de um cadastrado (nesse caso o vínculo
// fica pendente, ver a função de vínculo abaixo).
let listaEntradasErp = [];

function chaveEntradaErp(bloco) {
    return bloco.serie ? `${bloco.nf}_${bloco.serie}` : bloco.nf;
}

// ===================================================================
// --- CADASTRO OFICIAL DE FORNECEDORES DO SP DATA (fornecedoresSpData) ---
// ===================================================================
// Fonte: relatório de cadastro de fornecedores (pipe-delimited, largura
// fixa por campo). Campo 0 = código (com zeros à esquerda), campo 1 = CNPJ,
// campo 3 = nome real (razão social), campo 4 = nome exibido (fantasia).
// Resolve o codigoFornecedorSpData que vem no relatório de entrada em
// CNPJ(s) reais — nunca por nome.

// CNPJs "placeholder"/genéricos vistos no cadastro real (todos zeros, ou um
// valor repetido em dezenas de fornecedores sem relação nenhuma entre si —
// claramente um preenchimento padrão do sistema, não um CNPJ de verdade).
// Nunca tratar esses como vínculo válido.
const CNPJS_PLACEHOLDER_SPDATA = new Set(['00000000000000', '00000000000191']);
function cnpjValidoSpData(cnpj) {
    const limpo = String(cnpj || '').replace(/\D/g, '');
    if (limpo.length !== 14) return false;
    if (CNPJS_PLACEHOLDER_SPDATA.has(limpo)) return false;
    if (/^(\d)\1{13}$/.test(limpo)) return false; // todos os dígitos iguais
    return true;
}

function parseCadastroFornecedoresSpData(textoOriginal) {
    const t = String(textoOriginal || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const linhas = t.split('\n').filter(l => l.trim());
    const registros = [];
    linhas.forEach(linha => {
        const campos = linha.split('|');
        if (campos.length < 5) return; // linha fora do formato esperado — ignora, não inventa
        const codigo = String(parseInt(campos[0], 10));
        if (!codigo || codigo === 'NaN') return;
        const cnpjBruto = (campos[1] || '').trim();
        const nomeReal = (campos[3] || '').trim();
        const nomeExibido = (campos[4] || '').trim();
        registros.push({
            codigo,
            cnpj: cnpjValidoSpData(cnpjBruto) ? cnpjBruto.replace(/\D/g, '') : null,
            nomeReal,
            nomeExibido
        });
    });
    return registros;
}

// Mescla os registros novos no cadastro já carregado (listaFornecedoresSpData).
// Nunca sobrescreve nem remove um CNPJ já associado a um código — só
// acrescenta. Um código pode acumular mais de um CNPJ ao longo de
// reimportações (matriz/filial, recadastro etc.) — a estrutura nunca assume
// 1:1. Se o mesmo CNPJ for reimportado pro mesmo código, só atualiza o nome.
async function salvarCadastroFornecedoresSpData(registrosNovos) {
    if (!registrosNovos || !registrosNovos.length) return { novos: 0, atualizados: 0, cnpjsNovos: 0, ignorados: 0 };
    const agora = new Date().toISOString();
    const porCodigo = {};
    let ignorados = 0;
    registrosNovos.forEach(r => {
        if (!r.codigo) { ignorados++; return; }
        (porCodigo[r.codigo] = porCodigo[r.codigo] || []).push(r);
    });

    const existenteMap = {};
    listaFornecedoresSpData.forEach(doc => { existenteMap[doc.codigo] = doc; });

    let cnpjsNovos = 0, novos = 0, atualizados = 0;
    const codigos = Object.keys(porCodigo);
    for (let i = 0; i < codigos.length; i += 400) {
        const lote = codigos.slice(i, i + 400);
        const batch = firestore.batch();
        lote.forEach(codigo => {
            const registros = porCodigo[codigo];
            const existente = existenteMap[codigo];
            const cnpjsAtuais = existente ? [...existente.cnpjs] : [];
            registros.forEach(r => {
                if (!r.cnpj) { ignorados++; return; }
                const idx = cnpjsAtuais.findIndex(c => c.cnpj === r.cnpj);
                if (idx === -1) {
                    cnpjsAtuais.push({ cnpj: r.cnpj, nomeReal: r.nomeReal, nomeExibido: r.nomeExibido, importadoEm: agora });
                    cnpjsNovos++;
                } else {
                    cnpjsAtuais[idx] = { ...cnpjsAtuais[idx], nomeReal: r.nomeReal };
                }
            });
            const ultimoRegistro = registros[registros.length - 1];
            // Apelido definido manualmente pelo usuário nunca é sobrescrito por
            // uma reimportação — só usa o nomeExibido do relatório enquanto
            // ninguém tiver editado manualmente ainda.
            const apelidoManual = existente && existente.apelidoEditadoManualmente;
            batch.set(fornecedoresSpDataCollection.doc(codigo), {
                codigo,
                nomeReal: ultimoRegistro.nomeReal || (existente ? existente.nomeReal : ''),
                nomeExibido: apelidoManual ? existente.nomeExibido : (ultimoRegistro.nomeExibido || (existente ? existente.nomeExibido : '')),
                apelidoEditadoManualmente: apelidoManual || false,
                cnpjs: cnpjsAtuais,
                atualizadoEm: agora
            }, { merge: true });
            if (existente) atualizados++; else novos++;
        });
        await batch.commit();
    }
    return { novos, atualizados, cnpjsNovos, ignorados };
}

// Retorna os CNPJs válidos cadastrados pra um código de fornecedor do SP
// Data. Pode vir vazio (código sem CNPJ confiável cadastrado) — nesse caso o
// vínculo com a NF fica pendente, nunca é assumido.
function resolverCnpjsFornecedorSpData(codigo) {
    const doc = listaFornecedoresSpData.find(d => d.codigo === String(codigo));
    return doc ? doc.cnpjs.map(c => c.cnpj) : [];
}

function formatarCnpjExibicao(cnpj) {
    const d = normalizarCnpj(cnpj);
    if (d.length !== 14) return cnpj || '';
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

// --- UI: importação do cadastro (tela Fornecedores) ---
let cadastroFornecedoresSpDataPreview = [];

function handleFornecedoresSpDataFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('import-fornspdata-textarea').value = decodificarArquivoTexto(e.target.result);
        toast('Arquivo carregado! Clique em "Processar Cadastro".');
    };
    reader.onerror = () => toast('Erro ao ler o arquivo.');
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

async function colarCadastroFornecedoresSpData() {
    const textarea = document.getElementById('import-fornspdata-textarea');
    try {
        textarea.value = await navigator.clipboard.readText();
        toast('Texto colado!');
    } catch (err) {
        toast('Permissão negada ou não suportada. Cole manualmente (Ctrl+V).');
    }
}

function processarCadastroFornecedoresSpData() {
    const textarea = document.getElementById('import-fornspdata-textarea');
    const texto = textarea ? textarea.value : '';
    if (!texto || !texto.trim()) return toast('Cole ou envie o arquivo do cadastro antes de processar.');
    const registros = parseCadastroFornecedoresSpData(texto);
    const preview = document.getElementById('import-fornspdata-preview');
    if (registros.length === 0) {
        preview.innerHTML = '<div class="empty-state">Nenhum fornecedor reconhecido neste texto. Confira o formato do arquivo.</div>';
        return;
    }
    cadastroFornecedoresSpDataPreview = registros;
    const semCnpj = registros.filter(r => !r.cnpj).length;
    preview.innerHTML = `
        <div class="central-item-vazio" style="margin-top:12px;">
            ${registros.length} fornecedor(es) reconhecido(s)${semCnpj ? `, ${semCnpj} sem CNPJ válido identificado` : ''}.
        </div>
        <div class="actions" style="margin-top:10px;">
            <button class="actions-button" onclick="confirmarImportacaoCadastroFornecedoresSpData()"><span class="icon-wrapper"><i class="fa-solid fa-check"></i></span> Confirmar Importação</button>
        </div>`;
    toast(`${registros.length} fornecedor(es) encontrado(s)!`);
}

async function confirmarImportacaoCadastroFornecedoresSpData() {
    if (!cadastroFornecedoresSpDataPreview.length) return;
    try {
        const r = await salvarCadastroFornecedoresSpData(cadastroFornecedoresSpDataPreview);
        toast(`✓ ${r.novos} novo(s), ${r.atualizados} atualizado(s), ${r.cnpjsNovos} CNPJ(s) novo(s)${r.ignorados ? `, ${r.ignorados} ignorado(s)` : ''}.`);
        cadastroFornecedoresSpDataPreview = [];
        document.getElementById('import-fornspdata-preview').innerHTML = '';
        document.getElementById('import-fornspdata-textarea').value = '';
    } catch (e) {
        console.error('Erro ao importar cadastro de fornecedores SP Data:', e);
        toast('✕ Erro ao importar o cadastro.');
    }
}

let filtroCadastroFornecedoresSpDataTexto = '';
// Desempenho: a lista de fornecedores tende a crescer bastante, e renderizar
// centenas de cards de uma vez (cada um com inputs de edição em potencial)
// trava a tela ao abrir. Em vez de paginação por página numerada, mostra um
// lote inicial e um botão "Carregar mais" — mais simples, sem trocar a
// arquitetura, e a busca continua rodando sobre a lista inteira (só a
// exibição é que é incremental).
const LOTE_FORNECEDORES = 40;
let limiteExibicaoFornecedores = LOTE_FORNECEDORES;
function filtrarCadastroFornecedoresSpData(texto) {
    filtroCadastroFornecedoresSpDataTexto = texto;
    limiteExibicaoFornecedores = LOTE_FORNECEDORES; // toda nova busca recomeça do lote 1
    renderListaFornecedoresUnificada();
}
function carregarMaisFornecedores() {
    limiteExibicaoFornecedores += LOTE_FORNECEDORES;
    renderListaFornecedoresUnificada();
}

// Edição do fornecedor: razão social, apelido/nome de exibição, e adicionar
// CNPJ manualmente. Nunca remove um CNPJ já cadastrado (histórico
// preservado) — só permite acrescentar. Uma vez editado manualmente, a
// reimportação do relatório nunca mais sobrescreve o apelido (ver
// salvarCadastroFornecedoresSpData).
let fornecedorEditando = new Set();
function toggleEditarApelidoFornecedor(chave) {
    if (fornecedorEditando.has(chave)) fornecedorEditando.delete(chave);
    else fornecedorEditando.add(chave);
    renderListaFornecedoresUnificada();
}

// Une os cadastros só pra exibição/busca — nenhum dado é migrado nem
// duplicado, cada fornecedor continua persistido na coleção de origem
// (fornecedoresSpData ou a lista simples/apelidos antiga). Fornecedores que
// já existem no cadastro oficial (por nome real, apelido/nome de exibição ou
// alias legado já vinculado manualmente) não aparecem duplicados vindos da
// lista simples — nunca por semelhança, só por correspondência exata com
// algo que já está gravado no cadastro oficial.
//
// Também agrupa, só pra exibição/busca, fornecedores com CNPJ que já foram
// vinculados manualmente como sendo a mesma entidade (matriz/filial/CD) via
// `entidadesRelacionadas` (ver vincularEntidadesFornecedor). Cada documento
// continua exatamente como está — nenhum CNPJ é movido ou apagado, o grupo é
// só uma lente pra mostrar "isso tudo é a mesma empresa".
function listaFornecedoresUnificada() {
    const porId = {};
    listaFornecedoresSpData.forEach(f => { porId[f.id] = f; });
    const visitado = new Set();
    const grupos = [];
    listaFornecedoresSpData.forEach(f => {
        if (visitado.has(f.id)) return;
        const grupo = [];
        const pilha = [f.id];
        while (pilha.length) {
            const atualId = pilha.pop();
            if (visitado.has(atualId) || !porId[atualId]) continue;
            visitado.add(atualId);
            grupo.push(porId[atualId]);
            (porId[atualId].entidadesRelacionadas || []).forEach(outroId => { if (!visitado.has(outroId)) pilha.push(outroId); });
        }
        grupos.push(grupo);
    });

    const nomesJaNoSpData = new Set();
    listaFornecedoresSpData.forEach(f => {
        if (f.nomeReal) nomesJaNoSpData.add(f.nomeReal.toUpperCase());
        if (f.nomeExibido) nomesJaNoSpData.add(f.nomeExibido.toUpperCase());
        (f.aliasesLegado || []).forEach(a => nomesJaNoSpData.add(String(a).toUpperCase()));
    });

    const doSpData = grupos.map(grupo => {
        // Fornecedor com código do SP Data já cadastrado tem prioridade como
        // registro "principal" de exibição — mas nenhum campo dos outros
        // documentos do grupo é descartado, só não vira o cabeçalho do card.
        const principal = grupo.find(d => d.codigo) || grupo[0];
        const todosCnpjs = [];
        grupo.forEach(d => (d.cnpjs || []).forEach(c => todosCnpjs.push({ ...c, docId: d.id, docCodigo: d.codigo })));
        const todosAliases = [...new Set(grupo.flatMap(d => d.aliasesLegado || []))];
        return {
            origem: 'spdata', chave: 'sp:' + principal.id,
            nomeReal: principal.nomeReal, nomeExibido: principal.nomeExibido,
            apelidoEditadoManualmente: principal.apelidoEditadoManualmente,
            cnpjs: todosCnpjs, aliasesLegado: todosAliases,
            docs: grupo
        };
    });

    const doLegado = fornecedoresSugeridos
        .filter(nome => !nomesJaNoSpData.has(String(nome).toUpperCase()))
        .map(nome => ({
            origem: 'legado', chave: 'lg:' + nome,
            nomeReal: nome, nomeExibido: apelidosFornecedores[String(nome).toUpperCase()] || '',
            apelidoEditadoManualmente: !!apelidosFornecedores[String(nome).toUpperCase()], cnpjs: [], docs: []
        }));
    return [...doSpData, ...doLegado].sort((a, b) => (a.nomeReal || '').localeCompare(b.nomeReal || ''));
}

// Vincula manualmente um fornecedor da lista simples/legada a um fornecedor
// já cadastrado (com código/CNPJ), como confirmação explícita do usuário de
// que é a mesma empresa. NUNCA é automático e NUNCA apaga o nome legado da
// lista simples (fornecedoresSugeridos) — ele continua existindo, por
// exemplo no autocomplete de "Adicionar Nota" e em notas antigas que já o
// referenciam. Só passa a valer como um alias de busca do fornecedor
// principal e some da lista de "possíveis duplicados".
async function vincularFornecedorLegadoAoCadastro(nomeLegado, idFornecedor) {
    const doc = listaFornecedoresSpData.find(f => f.id === idFornecedor);
    if (!doc) return toast('✕ Fornecedor cadastrado não encontrado.');
    try {
        await fornecedoresSpDataCollection.doc(idFornecedor).update({
            aliasesLegado: firebase.firestore.FieldValue.arrayUnion(nomeLegado)
        });
        toast(`✓ "${nomeLegado}" vinculado a ${doc.nomeReal}. O cadastro antigo não foi apagado, mas a busca agora encontra este fornecedor também por esse nome.`);
    } catch (e) {
        console.error('Erro ao vincular fornecedor legado:', e);
        toast('✕ Erro ao vincular fornecedor.');
    }
}

// Vincula dois fornecedores com CNPJ já cadastrados como sendo a MESMA
// entidade/empresa (ex.: matriz e filial, cada uma com seu próprio CNPJ).
// Nunca é automático — só acontece quando o usuário escolhe explicitamente.
// Nenhum CNPJ é movido, apagado ou sobrescrito: os dois documentos continuam
// existindo exatamente como estão, só passam a ser exibidos/buscados juntos.
async function vincularEntidadesFornecedor(idA, idB) {
    if (!idA || !idB) return toast('Selecione um fornecedor pra vincular.');
    if (idA === idB) return toast('Selecione um fornecedor diferente.');
    try {
        const batch = firestore.batch();
        batch.update(fornecedoresSpDataCollection.doc(idA), { entidadesRelacionadas: firebase.firestore.FieldValue.arrayUnion(idB) });
        batch.update(fornecedoresSpDataCollection.doc(idB), { entidadesRelacionadas: firebase.firestore.FieldValue.arrayUnion(idA) });
        await batch.commit();
        toast('✓ Vinculados como o mesmo fornecedor. Nenhum CNPJ foi apagado ou movido.');
    } catch (e) {
        console.error('Erro ao vincular entidades de fornecedor:', e);
        toast('✕ Erro ao vincular fornecedores.');
    }
}

async function salvarApelidoFornecedor(chave) {
    const nomeRealInput = document.getElementById(`nomereal-input-${chave}`);
    const apelidoInput = document.getElementById(`apelido-input-${chave}`);
    if (!nomeRealInput || !apelidoInput) return;
    const [origem, id] = [chave.slice(0, 2), chave.slice(3)];
    try {
        if (origem === 'sp') {
            await fornecedoresSpDataCollection.doc(id).update({
                nomeReal: nomeRealInput.value.trim(),
                nomeExibido: apelidoInput.value.trim(),
                apelidoEditadoManualmente: true
            });
        } else {
            // Fornecedor da lista simples (sem código/CNPJ ainda) — apelido
            // fica no mesmo dicionário já usado por encontrarApelidoFornecedor,
            // sem criar estrutura nova.
            const nomeAtual = id.toUpperCase();
            const updateData = {};
            updateData[`apelidosFornecedores.${nomeAtual}`] = apelidoInput.value.trim();
            await settingsDocRef.set(updateData, { merge: true });
        }
        fornecedorEditando.delete(chave);
        toast('✓ Fornecedor atualizado.');
    } catch (e) {
        console.error('Erro ao salvar fornecedor:', e);
        toast('✕ Erro ao salvar.');
    }
}
async function adicionarCnpjFornecedorManual(id) {
    const input = document.getElementById(`novo-cnpj-input-sp:${id}`);
    if (!input) return;
    const cnpj = input.value.replace(/\D/g, '');
    if (!cnpjValidoSpData(cnpj)) return toast('✕ CNPJ inválido ou é um valor placeholder — confira os dígitos.');
    const doc = listaFornecedoresSpData.find(f => f.id === id);
    if (doc && doc.cnpjs.some(c => c.cnpj === cnpj)) return toast('Esse CNPJ já está cadastrado pra este fornecedor.');
    try {
        const cnpjsAtuais = doc ? [...doc.cnpjs] : [];
        cnpjsAtuais.push({ cnpj, nomeReal: doc ? doc.nomeReal : '', nomeExibido: doc ? doc.nomeExibido : '', importadoEm: new Date().toISOString() });
        await fornecedoresSpDataCollection.doc(id).update({ cnpjs: cnpjsAtuais });
        input.value = '';
        toast('✓ CNPJ adicionado.');
    } catch (e) {
        console.error('Erro ao adicionar CNPJ:', e);
        toast('✕ Erro ao adicionar CNPJ.');
    }
}

// Cria automaticamente um fornecedor identificado por CNPJ quando uma NF via
// XML é salva e o CNPJ do emitente ainda não pertence a nenhum fornecedor
// cadastrado. Usa o mesmo cadastro (fornecedoresSpData), sem código do SP
// Data ainda (fica null — pode ser associado manualmente depois, quando o
// código correspondente for identificado). ID determinístico (xml-<cnpj>)
// evita criar duplicado se o mesmo CNPJ novo aparecer em duas NFs seguidas.
// Se o CNPJ já existir em qualquer fornecedor (com ou sem código), reaproveita
// e não cria nada.
async function garantirFornecedorPorCnpjXml(cnpj, razaoSocialXml) {
    if (!cnpj) return;
    const jaExiste = listaFornecedoresSpData.some(f => (f.cnpjs || []).some(c => c.cnpj === cnpj));
    if (jaExiste) return;
    try {
        const agora = new Date().toISOString();
        await fornecedoresSpDataCollection.doc('xml-' + cnpj).set({
            codigo: null,
            nomeReal: razaoSocialXml || '',
            nomeExibido: '',
            apelidoEditadoManualmente: false,
            cnpjs: [{ cnpj, nomeReal: razaoSocialXml || '', nomeExibido: '', importadoEm: agora }],
            origemCadastro: 'xml',
            atualizadoEm: agora
        }, { merge: true });
    } catch (e) {
        // Não interrompe o salvamento da NF por causa disso — só loga.
        console.error('Erro ao cadastrar fornecedor automaticamente a partir do XML:', e);
    }
}

function renderListaFornecedoresUnificada() {
    const container = document.getElementById('lista-cadastro-fornecedores-spdata');
    if (!container) return;
    // Bug antigo: quando o termo buscado não tinha nenhum dígito (ex.: busca
    // por nome), `termo.replace(/\D/g,'')` virava string vazia, e
    // `"qualquerCoisa".includes('')` é sempre true em JS — isso fazia TODO
    // fornecedor com CNPJ cadastrado aparecer em QUALQUER busca por nome,
    // misturado com os resultados corretos. Por isso só compara CNPJ quando
    // o termo realmente contém dígitos.
    const termoOriginal = filtroCadastroFornecedoresSpDataTexto.trim();
    const termo = normalizarBuscaRel(termoOriginal);
    const termoNumerico = termoOriginal.replace(/\D/g, '');
    const todos = listaFornecedoresUnificada();
    const lista = todos.filter(f => {
        if (!termoOriginal) return true;
        if ((f.docs || []).some(d => normalizarBuscaRel(d.codigo).includes(termo))) return true;
        if (normalizarBuscaRel(f.nomeReal).includes(termo)) return true;
        if (normalizarBuscaRel(f.nomeExibido).includes(termo)) return true;
        if ((f.aliasesLegado || []).some(a => normalizarBuscaRel(a).includes(termo))) return true;
        if (termoNumerico && f.cnpjs.some(c => c.cnpj.includes(termoNumerico))) return true;
        return false;
    });

    const contadorEl = document.getElementById('contador-fornecedores-spdata');
    if (contadorEl) contadorEl.textContent = `${todos.length} fornecedor(es) cadastrado(s)`;

    if (lista.length === 0) {
        container.innerHTML = `<div class="empty-state">${todos.length === 0 ? 'Nenhum fornecedor cadastrado ainda.' : 'Nenhum fornecedor encontrado.'}</div>`;
        return;
    }

    // Só renderiza o lote atual — a lista completa pode ter centenas de
    // fornecedores, e montar todos os cards de uma vez (cada um com inputs
    // de edição em potencial) trava a tela ao abrir.
    const visiveis = lista.slice(0, limiteExibicaoFornecedores);

    const opcoesLegadoHTML = listaFornecedoresSpData
        .slice()
        .sort((a, b) => (a.nomeReal || '').localeCompare(b.nomeReal || ''))
        .map(f => `<option value="${f.id}">${escRel(f.nomeReal)}${f.cnpjs.length ? ' — ' + formatarCnpjExibicao(f.cnpjs[0].cnpj) : ''}</option>`)
        .join('');

    container.innerHTML = visiveis.map(f => {
        if (f.origem === 'legado') {
            const vincularHTML = `<div class="central-spdata-busca" style="margin-top:6px;" onclick="event.stopPropagation()">
                <label class="txt-aux">É o mesmo fornecedor que um já cadastrado com CNPJ? Vincule aqui (não apaga este registro):</label>
                <select class="form-field" id="vincular-select-${f.chave}"><option value="">Selecione o fornecedor cadastrado...</option>${opcoesLegadoHTML}</select>
                <button type="button" class="central-status-toggle" onclick="vincularFornecedorLegadoSelecionado('${f.chave}', '${escRel(f.nomeReal)}')">Vincular</button>
            </div>`;
            return `<div class="nota-item" style="cursor:default;flex-direction:column;align-items:stretch;gap:4px;">
                <div class="nota-info">${f.nomeReal} <span class="txt-aux">(cadastro simples)</span></div>
                <div class="nota-detalhes"><em>Cadastro simples, sem código/CNPJ — importe o relatório oficial de fornecedores pra identificação automática por CNPJ.</em></div>
                ${vincularHTML}
            </div>`;
        }

        // Fornecedor com CNPJ (origem spdata/xml) — pode ter mais de um
        // documento no grupo (matriz/filial vinculados manualmente).
        const idsDoGrupo = new Set(f.docs.map(d => d.id));
        const opcoesVincularEntidadeHTML = listaFornecedoresSpData
            .filter(d => !idsDoGrupo.has(d.id))
            .sort((a, b) => (a.nomeReal || '').localeCompare(b.nomeReal || ''))
            .map(d => `<option value="${d.id}">${d.codigo ? d.codigo + ' — ' : ''}${escRel(d.nomeReal)}</option>`)
            .join('');
        const principalId = f.docs.find(d => d.codigo)?.id || f.docs[0].id;

        // Fase 5: bloqueio por CNPJ — NFs deste fornecedor (vindas do
        // relatório ERP) vão direto pro Histórico, sem passar por
        // pré-seleção/financeiro. Opera sobre todos os CNPJs do grupo.
        const bloqueado = f.cnpjs.length > 0 && f.cnpjs.some(c => fornecedoresIgnoradosCnpj.has(c.cnpj));
        const bloqueioHTML = f.cnpjs.length > 0
            ? `<div class="nota-detalhes">${bloqueado ? '🔒 Bloqueado — NFs do ERP vão direto pro Histórico' : 'NFs do ERP são tratadas normalmente'} <button type="button" class="central-status-toggle" onclick="alternarBloqueioFornecedorCnpj('${f.chave}')">${bloqueado ? 'Desbloquear' : 'Bloquear do financeiro'}</button></div>`
            : '';

        const subDocsHTML = f.docs.map(doc => {
            const chaveDoc = 'sp:' + doc.id;
            const cnpjsDoc = doc.cnpjs || [];
            const cnpjsHTML = cnpjsDoc.length
                ? cnpjsDoc.map(c => formatarCnpjExibicao(c.cnpj)).join('<br>')
                : '<em>Sem CNPJ cadastrado — associações por este código ficam pendentes.</em>';
            const editando = fornecedorEditando.has(chaveDoc);
            const edicaoHTML = editando
                ? `<div class="central-spdata-busca" onclick="event.stopPropagation()">
                    <label class="txt-aux">Razão social</label>
                    <input type="text" class="form-field" id="nomereal-input-${chaveDoc}" value="${doc.nomeReal || ''}">
                    <label class="txt-aux">Nome de exibição no app</label>
                    <input type="text" class="form-field" id="apelido-input-${chaveDoc}" value="${doc.nomeExibido || ''}" placeholder="Nome de exibição no app">
                    <button type="button" class="central-status-toggle" onclick="salvarApelidoFornecedor('${chaveDoc}')">Salvar</button>
                    <label style="font-size:12px;color:var(--text-light);margin-top:8px;display:block;">Adicionar CNPJ (nunca remove os existentes)</label>
                    <input type="text" class="form-field" id="novo-cnpj-input-${chaveDoc}" placeholder="Só números">
                    <button type="button" class="central-status-toggle" onclick="adicionarCnpjFornecedorManual('${doc.id}')">+ Adicionar CNPJ</button>
                </div>`
                : `<div class="nota-detalhes">Nome no app: ${doc.nomeExibido || '<em>(usa a razão social)</em>'}${doc.apelidoEditadoManualmente ? ' <span class="badge-excecao">editado</span>' : ''} <button type="button" class="central-status-toggle" onclick="toggleEditarApelidoFornecedor('${chaveDoc}')">Editar</button></div>`;
            return `<div style="padding:8px 0;${f.docs.length > 1 ? 'border-top:1px solid var(--border-color);' : ''}">
                <div class="nota-detalhes"><strong>${doc.codigo ? doc.codigo + ' — ' : (doc.origemCadastro === 'xml' ? 'Identificado por XML — ' : '')}CNPJ(s): ${cnpjsDoc.length}</strong><br>${cnpjsHTML}</div>
                ${edicaoHTML}
            </div>`;
        }).join('');

        const aliasesHTML = f.aliasesLegado.length ? `<div class="nota-detalhes">Também conhecido como: ${f.aliasesLegado.map(escRel).join(', ')}</div>` : '';
        const vincularEntidadeHTML = `<div class="central-spdata-busca" style="margin-top:6px;" onclick="event.stopPropagation()">
            <label class="txt-aux">É a mesma empresa que outro CNPJ já cadastrado (matriz/filial/CD)? Vincule aqui (nenhum CNPJ é apagado ou movido):</label>
            <select class="form-field" id="vincular-entidade-select-${f.chave}"><option value="">Selecione outro fornecedor cadastrado...</option>${opcoesVincularEntidadeHTML}</select>
            <button type="button" class="central-status-toggle" onclick="vincularEntidadeSelecionada('${f.chave}', '${principalId}')">Vincular</button>
        </div>`;

        return `<div class="nota-item" style="cursor:default;flex-direction:column;align-items:stretch;gap:4px;">
            <div class="nota-info">${f.nomeReal}${f.docs.length > 1 ? ` <span class="txt-aux">(${f.docs.length} CNPJs vinculados)</span>` : ''}</div>
            ${bloqueioHTML}
            ${subDocsHTML}
            ${aliasesHTML}
            ${vincularEntidadeHTML}
        </div>`;
    }).join('');

    if (lista.length > visiveis.length) {
        container.innerHTML += `<div class="actions" style="margin-top:12px;">
            <button type="button" class="actions-button is-neutral" onclick="carregarMaisFornecedores()">Carregar mais (${lista.length - visiveis.length} restante(s))</button>
        </div>`;
    }
}

function vincularFornecedorLegadoSelecionado(chave, nomeLegado) {
    const select = document.getElementById(`vincular-select-${chave}`);
    if (!select || !select.value) return toast('Selecione o fornecedor cadastrado ao qual deseja vincular.');
    vincularFornecedorLegadoAoCadastro(nomeLegado, select.value);
}

function vincularEntidadeSelecionada(chave, principalId) {
    const select = document.getElementById(`vincular-entidade-select-${chave}`);
    if (!select || !select.value) return toast('Selecione o fornecedor a vincular.');
    vincularEntidadesFornecedor(principalId, select.value);
}

// ===================================================================

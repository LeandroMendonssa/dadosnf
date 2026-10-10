// 10-entrada-nf-xml.js — Entrada de NF/XML (associação, tratamento, abas)
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ============================================================
// MÓDULO DE EDITOR DE XML (NF-e) — converte quantidades de caixa/pacote
// pra unidade de dispensação, ajustando qCom/vUnCom/qTrib/vUnTrib e os
// lotes (<rastro>) automaticamente, preservando os valores fiscais
// (impostos, totais, chave de autorização) intocados. O fator de conversão
// vem do texto do produto (regex) ou do banco de exceções salvo por
// fornecedor+produto (Firestore, coleção xmlExcecoes), pra não precisar
// adivinhar de novo na próxima nota do mesmo item.
// Validado item a item contra uma NF-e real antes de entrar no app.
// ============================================================

let xmlDocAtual = null;
let nomeArquivoXmlOriginal = 'nfe-corrigida.xml';
let itensXmlDetectados = [];
let bancoExcecoesXml = {};

// --- Associação NF-e → código do fornecedor → item da cotação (fase 2) ---
let nfeInfoAtual = null; // { cnpjEmit, nNF } da NF-e atualmente carregada no editor
let bancoAssociacoesFornecedor = {}; // chave (cnpjEmit::cProd) -> doc de associacoesFornecedor
let pedidoSelecionadoXml = null; // pedido/cotação escolhido pra associar os itens desta NF-e
let associacaoFornecedorBuscaAberta = new Set();
let historicoAssociacaoAbertoXml = new Set(); // painel de histórico da Entrada de NF — recolhido por padrão (Fase 22.2)
let conflitoPedidoXmlInfo = null; // {pedidos:[{pedido, itens:[xProd,...]}]} quando itens já associados apontam pra pedidos diferentes — nunca escolhe sozinho nesse caso
let pedidoSugestaoXmlInfo = null; // {candidatos:[{pedido, valorCotado, diffPercentual}], valorNf} — Fase 9: CNPJ bate com mais de uma cotação; sugere por valor compatível, nunca decide sozinho
let pedidoOrigemXml = null; // 'automatico' | 'manual' | null — só pra indicar na tela como o pedido foi definido, não influencia a lógica
let filtroItensXml = 'todos'; // 'todos' | 'pendencias' — filtro visual da lista de itens, não altera nenhum dado
// --- Fase 21: tratamento da NF antes de salvar (recurso, sem cotação, conferência) ---
let semCotacaoNfXml = false;            // caixinha: a NF inteira não tem cotação do SmartCompras
let pedidoAntesSemCotacaoXml = null;    // {pedido, origem} guardado ao marcar a caixinha (pra poder desmarcar)
let destinoSemCotacaoXml = '';          // 'Santa Casa' | 'CTI' — só quando não há cotação pra dar o destino
let recursosRascunhoXml = {};           // recurso editado nesta NF: 'c:<codSmartCompras>' | 'd:<cProd>' -> recurso oficial
let pedidosAdicionaisXml = [];          // pedidos além do principal (pedidoSelecionadoXml) — NF com itens de mais de uma cotação
function cotacoesSelecionadasXml() { return [pedidoSelecionadoXml, ...pedidosAdicionaisXml].filter(Boolean); }
let nfSalvaXml = false;                 // depois de salvar, trocar o recurso grava na hora
const SEM_COTACAO_VALOR = '__SEM_COTACAO__';
let mostrarOutrosFornecedoresXml = false; // por padrão a seleção de item prioriza o fornecedor identificado pelo CNPJ; só amplia quando pedido explicitamente

function detectarFatorXml(xProd) {
    const texto = xProd.toUpperCase();
    const matchFD = texto.match(/\bFD\s?(\d+)\b/);
    const matchC = texto.match(/C\/\s?(\d+)/); // exige dígito logo após "C/" — não confunde com "C/VASO" etc.
    const matchCX = !matchC ? texto.match(/\bCX\s?(\d+)\b/) : null;

    let fator = 1, suspeito = false;
    if (matchFD && matchC) fator = parseInt(matchFD[1], 10) * parseInt(matchC[1], 10);
    else if (matchC) fator = parseInt(matchC[1], 10);
    else if (matchCX) fator = parseInt(matchCX[1], 10);
    else suspeito = true;
    return { fator: fator || 1, suspeito };
}

// Fase 29.1: a NF-e usa o texto literal "SEM GTIN" (ou "SEM EAN", ou zeros) no
// cEAN quando o produto não tem código de barras. Isso não identifica produto
// nenhum — antes virava a chave "cnpj::SEM GTIN" e TODOS os itens sem GTIN do
// mesmo fornecedor compartilhavam (e herdavam) o mesmo fator. GTIN real segue
// valendo como antes (devolvido sem alteração, pra manter as chaves gravadas).
function cEanReal(cEAN) {
    const norm = String(cEAN || '').toUpperCase().replace(/\s+/g, '');
    if (!norm || /^SEM(GTIN|EAN)$/.test(norm) || /^0+$/.test(norm)) return '';
    return cEAN;
}
// Sem GTIN real a chave é CNPJ + cProd — o mesmo formato que já era gravado
// quando o cEAN vinha vazio, então essas memórias antigas continuam valendo.
function chaveExcecaoXml(cnpjEmit, item) {
    return `${cnpjEmit}::${cEanReal(item.cEAN) || item.cProd || item.xProd}`.replace(/\//g, '_');
}

function handleArquivoXml(file) {
    if (!file) return;
    nomeArquivoXmlOriginal = file.name;
    document.getElementById('xml-nome-arquivo').textContent = file.name;
    const reader = new FileReader();
    reader.onload = (e) => processarXmlTexto(e.target.result);
    reader.readAsText(file, 'UTF-8');
}

function processarXmlTexto(texto) {
    const parser = new DOMParser();
    xmlDocAtual = parser.parseFromString(texto, 'application/xml');
    if (xmlDocAtual.querySelector('parsererror')) {
        toast('✕ Esse arquivo não é um XML válido.');
        xmlDocAtual = null;
        return;
    }

    // Uma NF nova não herda o que ficou na tela da anterior: o resultado da
    // conferência e o recurso só existem depois de salvar, e eram os únicos
    // blocos que sobreviviam ao carregar outro XML.
    ['xml-resultado-salvar', 'xml-sugestao-recurso'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.innerHTML = ''; el.style.display = 'none'; }
    });

    const cnpjEmit = xmlDocAtual.querySelector('emit CNPJ')?.textContent || '';
    const nNF = xmlDocAtual.querySelector('ide nNF')?.textContent || '';
    const dets = Array.from(xmlDocAtual.getElementsByTagName('det'));

    // Identificação da NF (Parte 6): só dados estruturados que já existem no
    // XML, nada inferido/adivinhado — pra confirmar visualmente, antes de
    // qualquer processamento, que é o arquivo certo. infCpl (informações
    // complementares) é só pra CONSULTA humana — nunca usado pra decidir
    // pedido/produto automaticamente (fornecedor às vezes escreve o número
    // do pedido ali, mas não é dado estruturado confiável).
    const nfeIdentificacao = {
        fornecedor: xmlDocAtual.querySelector('emit xNome')?.textContent || '',
        cnpjEmit,
        nNF,
        serie: xmlDocAtual.querySelector('ide serie')?.textContent || '',
        emissao: xmlDocAtual.querySelector('ide dhEmi')?.textContent || xmlDocAtual.querySelector('ide dEmi')?.textContent || '',
        vencimentos: Array.from(xmlDocAtual.querySelectorAll('cobr dup dVenc')).map(el => el.textContent).filter(Boolean),
        valorTotal: xmlDocAtual.querySelector('total ICMSTot vNF')?.textContent || '',
        qtdItens: dets.length,
        infCpl: xmlDocAtual.querySelector('infAdic infCpl')?.textContent || ''
    };

    itensXmlDetectados = dets.map(detEl => {
        const prod = detEl.getElementsByTagName('prod')[0];
        const get = (tag) => prod.getElementsByTagName(tag)[0]?.textContent || '';
        const xProd = get('xProd');
        const item = {
            prod,
            xProd,
            cProd: get('cProd'),
            cEAN: get('cEAN'),
            ncm: get('NCM'),
            qComEl: prod.getElementsByTagName('qCom')[0],
            vUnComEl: prod.getElementsByTagName('vUnCom')[0],
            qTribEl: prod.getElementsByTagName('qTrib')[0],
            vUnTribEl: prod.getElementsByTagName('vUnTrib')[0],
            uComEl: prod.getElementsByTagName('uCom')[0],
            uTribEl: prod.getElementsByTagName('uTrib')[0],
            qComOriginal: parseFloat(prod.getElementsByTagName('qCom')[0]?.textContent || '0'),
            vUnComOriginal: parseFloat(prod.getElementsByTagName('vUnCom')[0]?.textContent || '0'),
            qTribOriginal: parseFloat(prod.getElementsByTagName('qTrib')[0]?.textContent || '0'),
            vUnTribOriginal: parseFloat(prod.getElementsByTagName('vUnTrib')[0]?.textContent || '0'),
            rastros: Array.from(prod.getElementsByTagName('rastro')).map(r => ({
                qLoteEl: r.getElementsByTagName('qLote')[0],
                qLoteOriginal: parseFloat(r.getElementsByTagName('qLote')[0]?.textContent || '0'),
                nLote: r.getElementsByTagName('nLote')[0]?.textContent || '',
                dVal: r.getElementsByTagName('dVal')[0]?.textContent || ''
            })),
            // Fase 43 / 2.0.3: lote/validade escritos em texto livre (xProd ou infAdProd) viram <rastro> automaticamente quando válidos.
            loteCandidato: null,
            rastroDecidido: null,   // { lote, validadeISO, origem: 'texto' | 'manual' }
            rastroEl: null,         // <rastro> criado por nós no XML de saída (idempotente)
            // Substituição controlada de código (Editor XML, base de
            // histórico): cProd nunca é sobrescrito — cProdNovo é o único
            // campo usado na hora de gerar a saída (ver
            // aplicarConversaoNoXmlDom), e só é preenchido depois de uma
            // decisão explícita do usuário (nunca automaticamente).
            cProdNovo: null,
            decisaoTomada: 'nao_decidido', // 'nao_decidido' | 'aplicado_codigo_fornecedor' | 'aplicado_manual' | 'mantido_original'
            possibilidadeEscolhida: null,
            // Fase 30: produto SP Data usado só como REFERÊNCIA pra achar códigos
            // de fornecedor já associados a ele (null = o SP Data atual do item).
            // Nunca vai pro cProd de saída.
            spDataReferenciaXml: null
        };
        if (!item.rastros.length) {
            const infAdProd = detEl.getElementsByTagName('infAdProd')[0]?.textContent || '';
            item.loteCandidato = extrairLoteValidadeTexto(xProd, 'xProd', nfeIdentificacao.emissao) || extrairLoteValidadeTexto(infAdProd, 'infAdProd', nfeIdentificacao.emissao);
            // 2.0.3: lote e validade válidos lidos do texto entram no XML sozinhos (sem confirmação).
            if (item.loteCandidato && item.loteCandidato.valida) item.rastroDecidido = { lote: item.loteCandidato.lote, validadeISO: item.loteCandidato.validadeISO, origem: 'texto' };
        }
        const chave = chaveExcecaoXml(cnpjEmit, item);
        item.chaveExcecao = chave;
        if (bancoExcecoesXml[chave] !== undefined) {
            item.fator = bancoExcecoesXml[chave];
            item.deExcecao = true;
            item.suspeitoOriginal = false;
            item.conferido = true;
        } else {
            const det = detectarFatorXml(xProd);
            item.fator = det.fator;
            item.suspeito = det.suspeito;
            // "suspeitoOriginal" nunca muda depois de definido — é o que
            // decide, no download, se vale salvar a confirmação como exceção
            // (mesmo quando o fator confirmado continua sendo 1). "suspeito"
            // (mutável) é só o que ainda falta confirmar agora.
            item.suspeitoOriginal = det.suspeito;
            item.conferido = !det.suspeito;
        }
        // Consulta o histórico já existente (fornecedor->SmartCompras->SP
        // Data), considerando outros CNPJs da mesma entidade — só leitura,
        // nenhuma decisão automática. Alimenta o painel "Associações
        // conhecidas" no render dos itens.
        item.associacoesConhecidas = consultarAssociacoesConhecidasParaXml(cnpjEmit, item.cProd);
        return item;
    });

    document.getElementById('xml-card-associacao').style.display = 'block';
    document.getElementById('xml-acoes-finais').style.display = 'flex';
    document.getElementById('screen-xml-editor').classList.add('xml-carregada'); // Fase 33: importador compacto
    alternarAbaXml('itens'); // Fase 39: cada XML novo abre na aba Itens
    renderIdentificacaoXml(nfeIdentificacao);

    // Base da associação com a cotação (fase 2 do roadmap): já identifica o
    // fornecedor/NF e tenta achar o pedido sozinho antes de pedir seleção
    // manual — sem inventar nada, só reaproveitando associações já
    // confirmadas em NFs anteriores.
    nfeInfoAtual = { cnpjEmit, nNF, fornecedor: nfeIdentificacao.fornecedor, serie: nfeIdentificacao.serie, emissao: nfeIdentificacao.emissao, valorTotal: nfeIdentificacao.valorTotal, vencimentos: nfeIdentificacao.vencimentos || [] };
    associacaoFornecedorBuscaAberta = new Set();
    historicoAssociacaoAbertoXml = new Set();

    // 1ª prioridade: pelas associações de fornecedor já confirmadas dos
    // itens desta NF (mais forte que CNPJ, porque já foi confirmado à mão
    // antes). Se os itens já associados apontarem pra pedidos diferentes,
    // não escolhe nenhum — fica como conflito pra resolução manual.
    const pedidosPorItem = itensXmlDetectados.map(item => {
        const chave = chaveAssociacaoFornecedor(cnpjEmit, item.cProd);
        const associacao = bancoAssociacoesFornecedor[chave];
        if (!associacao) return null;
        const cotacaoDoItem = listaCotacoes.find(c => (c.itens || []).some(it => it.codProduto === associacao.codigoSmartCompras));
        return cotacaoDoItem ? { pedido: cotacaoDoItem.pedido, item } : null;
    }).filter(Boolean);
    const pedidosDistintos = [...new Set(pedidosPorItem.map(p => p.pedido))];

    conflitoPedidoXmlInfo = null;
    pedidoSugestaoXmlInfo = null;
    pedidoOrigemXml = null;
    semCotacaoNfXml = false; pedidoAntesSemCotacaoXml = null; destinoSemCotacaoXml = '';
    recursosRascunhoXml = {}; nfSalvaXml = false; pedidosAdicionaisXml = [];
    if (pedidosDistintos.length === 1) {
        pedidoSelecionadoXml = pedidosDistintos[0];
        pedidoOrigemXml = 'automatico';
    } else if (pedidosDistintos.length > 1) {
        // Cada item já tem uma associação CONFIRMADA (não é achismo) apontando
        // pra pedidos diferentes — mais forte que a checagem por CNPJ/valor
        // (Fase 9) por isso os dois/todos já entram, sem exigir escolher um só.
        // Continua nunca inventando nada: só reaproveita o que já foi confirmado.
        pedidoSelecionadoXml = pedidosDistintos[0];
        pedidosAdicionaisXml = pedidosDistintos.slice(1);
        pedidoOrigemXml = 'automatico';
        conflitoPedidoXmlInfo = {
            pedidos: pedidosDistintos.map(pedido => ({
                pedido,
                itens: pedidosPorItem.filter(p => p.pedido === pedido).map(p => p.item.xProd)
            }))
        };
    } else {
        // 2ª prioridade (regra já existente): CNPJ do emitente bate com
        // exatamente uma cotação.
        const cotacoesDoFornecedor = listaCotacoes.filter(c => (c.fornecedores || []).some(f => mesmoCnpj(f.cnpj, cnpjEmit)));
        if (cotacoesDoFornecedor.length === 1) {
            pedidoSelecionadoXml = cotacoesDoFornecedor[0].pedido;
            pedidoOrigemXml = 'automatico';
        } else if (cotacoesDoFornecedor.length > 1) {
            // Fase 9: CNPJ bate com MAIS de uma cotação — nunca escolhe
            // sozinho, mas sugere por evidência de valor (mesma lógica
            // determinística já usada na reconciliação do ERP, Fase 8:
            // valor total da NF compatível com o valor total cotado pra
            // esse fornecedor, dentro da mesma tolerância). Nunca usa data
            // isolada. Sempre exige confirmação explícita do usuário.
            pedidoSelecionadoXml = null;
            const valorNf = numeroFlexivel(nfeIdentificacao.valorTotal);
            const candidatos = cotacoesDoFornecedor.map(cotacao => {
                const fornecedorMatch = (cotacao.fornecedores || []).find(f => mesmoCnpj(f.cnpj, cnpjEmit));
                const valorCotado = valorTotalCotacaoPorFornecedor(cotacao, fornecedorMatch.cnpj);
                const diffPercentual = (valorNf !== null && valorCotado > 0) ? Math.abs(valorCotado - valorNf) / valorCotado : null;
                return { pedido: cotacao.pedido, valorCotado, diffPercentual };
            }).filter(c => c.diffPercentual !== null && c.diffPercentual <= TOLERANCIA_VALOR_RECONCILIACAO_ERP)
              .sort((a, b) => a.diffPercentual - b.diffPercentual);
            if (candidatos.length) pedidoSugestaoXmlInfo = { candidatos, valorNf };
        } else {
            pedidoSelecionadoXml = null;
        }
    }

    // Filtro padrão da lista de itens: prioriza pendências quando existirem
    // (sem esconder a opção de ver todos, que fica sempre disponível no
    // controle), senão mostra todos — não faz sentido abrir já filtrado
    // numa NF sem nenhuma pendência.
    filtroItensXml = itensXmlDetectados.some(item => !statusItemXml(item).pronto) ? 'pendencias' : 'todos';
    mostrarOutrosFornecedoresXml = false;

    renderAssociacaoCotacaoXml();
}

// Formata datas do XML (dhEmi vem com hora/timezone, dEmi já vem só a data) e
// valores monetários pra exibição BR — só formatação visual, não altera o
// dado nem participa de nenhum cálculo.
function formatarDataCompletaBR(valor) {
    if (!valor) return '';
    const dataParte = valor.split('T')[0];
    const partes = dataParte.split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : valor;
}
function formatarValorMonetarioBR(valor) {
    const n = parseFloat(valor);
    if (isNaN(n)) return '';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderIdentificacaoXml(info) {
    const card = document.getElementById('xml-card-identificacao');
    const container = document.getElementById('xml-identificacao-container');
    if (!card || !container) return;

    // Reprocessar o mesmo XML (mesma NF, série e fornecedor) é comum —
    // reenvio, conferência, ajuste. O fator e as associações já ficam
    // lembrados por fornecedor/produto (não por esta NF específica), então
    // não pedem confirmação de novo sozinhos; isso aqui é só pra avisar
    // que já existe uma versão salva, com a data, sem impedir nada.
    const nfExistente = info.nNF ? listaNfsProcessadas.find(nf =>
        nf.nf === info.nNF && (nf.serie || '') === (info.serie || '') && mesmoCnpj(nf.cnpjFornecedor, info.cnpjEmit)
    ) : null;
    const avisoJaProcessadaHTML = nfExistente
        ? `<div class="xml-estado-card pronto mb-3"><div class="xml-estado-linha"><span class="xml-item-badge pronto">✓ NF já processada</span><span class="txt-aux">salva em ${nfExistente.processadoEm ? formatarDataCompletaBR(nfExistente.processadoEm) : '—'}${nfExistente.pedido ? `, pedido ${nfExistente.pedido}` : ''} — salvar de novo atualiza a mesma NF, não duplica.</span></div></div>`
        : '';

    // Fase 33: resumo compacto — quem entregou em destaque; NF, valor e itens numa leitura só.
    const vencTxt = info.vencimentos.length ? ` · Venc. ${info.vencimentos.map(formatarDataCompletaBR).join(', ')}` : '';
    const linhas = [
        info.fornecedor ? `<div class="xml-nf-fornecedor">${info.fornecedor}</div>` : '',
        (info.nNF || info.serie || info.emissao) ? `<div class="xml-nf-linha">${info.nNF ? 'NF ' + info.nNF : ''}${info.serie ? ' · Série ' + info.serie : ''}${info.emissao ? ' · ' + formatarDataCompletaBR(info.emissao) : ''}</div>` : '',
        `<div class="xml-nf-linha">${info.valorTotal ? 'R$ ' + formatarValorMonetarioBR(info.valorTotal) + ' · ' : ''}${info.qtdItens} ${info.qtdItens === 1 ? 'item' : 'itens'}${vencTxt}</div>`,
        info.cnpjEmit ? `<div class="xml-nf-linha txt-aux">CNPJ ${info.cnpjEmit}</div>` : ''
    ].filter(Boolean).join('');

    container.innerHTML = linhas || '<div class="central-item-vazio">Não foi possível identificar os dados da NF neste XML.</div>';
    // Fase 39: resumo sempre visível no topo (qualquer aba) + aviso de "NF já processada" + Trocar XML.
    const resumoTopo = document.getElementById('xml-resumo-nf');
    if (resumoTopo) {
        resumoTopo.style.display = 'block';
        resumoTopo.innerHTML = `${avisoJaProcessadaHTML}<div class="xml-nf-fornecedor">${info.fornecedor || ''}</div>
            <div class="xml-nf-linha">${info.nNF ? 'NF ' + info.nNF : ''}${info.serie ? ' · Série ' + info.serie : ''}${info.emissao ? ' · ' + formatarDataCompletaBR(info.emissao) : ''}</div>
            <div class="xml-nf-linha">${info.valorTotal ? 'R$ ' + formatarValorMonetarioBR(info.valorTotal) + ' · ' : ''}${info.qtdItens} ${info.qtdItens === 1 ? 'item' : 'itens'}</div>
            <button type="button" class="link-discreto xml-trocar" onclick="document.getElementById('xml-file-input').click()">Trocar XML</button>`;
    }

    // Informações adicionais/observações (infCpl) — só pra consulta humana.
    // Fornecedor às vezes escreve número de pedido ali, mas nunca é usado
    // pelo sistema pra decidir pedido/produto — só os dados estruturados e
    // as associações já confirmadas fazem isso (ver processarXmlTexto).
    const infoAdicEl = document.getElementById('xml-identificacao-infadic');
    if (infoAdicEl) {
        infoAdicEl.style.display = info.infCpl ? 'block' : 'none';
        infoAdicEl.querySelector('.xml-infadic-texto').textContent = info.infCpl;
    }

    card.style.display = 'block';
}

// Formata uma quantidade pra exibição: remove zeros desnecessários à direita
// e usa vírgula decimal (padrão BR). Não afeta o valor usado internamente
// (qCom/qTrib continuam com toFixed(4) na hora de gravar no XML) — isso é
// só a apresentação na tela. Ex.: 2 → "2", 20 → "20", 20.5 → "20,5".
function formatarQuantidadeXml(numero) {
    return numero.toFixed(4).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

function formatarPreviewXml(item) {
    const qtdFinal = item.fator === 1 ? item.qComOriginal : (item.qComOriginal * item.fator);
    const qtdFinalFmt = formatarQuantidadeXml(qtdFinal);
    if (item.fator === 1) {
        return `Sem conversão · Quantidade final: <b>${qtdFinalFmt} ${item.uComEl.textContent}</b>`;
    }
    const unidadeDestino = document.getElementById('xml-unidade-destino').value;
    const novoValor = (item.vUnComOriginal / item.fator).toFixed(7);
    return `${formatarQuantidadeXml(item.qComOriginal)} ${item.uComEl.textContent} → Quantidade final: <b>${qtdFinalFmt} ${unidadeDestino}</b> a R$ ${novoValor}`;
}

// Cruza o CNPJ da NF com o cadastro de fornecedores do SP Data (que já
// suporta vários CNPJs por código — nunca assume 1:1). Só informativo: não
// bloqueia nada quando não encontra, só sinaliza pra conferência.
function validarFornecedorSpData(cnpjEmit) {
    cnpjEmit = normalizarCnpj(cnpjEmit);
    const docs = listaFornecedoresSpData.filter(f => f.cnpjs.some(c => c.cnpj === cnpjEmit));
    if (docs.length === 0) return { encontrado: false, ambiguo: false };
    if (docs.length > 1) {
        // Mesmo CNPJ cadastrado sob mais de um código de fornecedor — situação
        // real de ambiguidade (ver análise do FORNECEDORES.txt). Nunca escolhe
        // sozinho; vira pendência de conferência.
        return { encontrado: false, ambiguo: true, candidatos: docs.map(d => ({ codigo: d.codigo, nome: d.nomeReal })) };
    }
    const doc = docs[0];
    return {
        encontrado: true, ambiguo: false,
        codigo: doc.codigo, nomeReal: doc.nomeReal, nomeExibido: doc.nomeExibido,
        cnpjsRelacionados: doc.cnpjs.map(c => c.cnpj)
    };
}

// Estado de UM item — usado tanto pelo resumo quanto pela renderização da
// lista (pra badge/destaque) e pelo filtro "somente pendências". "pronto"
// exige as DUAS coisas: associação+SP Data resolvidos E nenhuma conversão
// pendente — um item pode estar associado e ainda não estar totalmente
// pronto (correção desta rodada: antes "resolvido" só olhava associação).
function chaveDiretaSpData(item) { return 'DIRETO::' + chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, item.cProd); }
function ehChaveDiretaSpData(codigo) { return typeof codigo === 'string' && codigo.startsWith('DIRETO::'); }

// Fase 26: produto SP Data com "fatorFixo" (campo opcional, só nos poucos
// produtos que precisam — ex.: clonazepam 500 gotas/frasco). Preenche o fator
// do item UMA vez, só quando não há memória do fornecedor (deExcecao) e o
// usuário ainda não mexeu no fator; continua editável e fica sinalizado.
function aplicarFatorFixoSpData(item, produto) {
    if (!item || !produto || !(produto.fatorFixo > 0)) return;
    if (item.deExcecao || item.fatorFixoTratado) return;
    item.fatorFixoTratado = true;
    item.fator = produto.fatorFixo;
    item.deFatorFixo = true;
    item.suspeito = false;
    item.conferido = true;
}

function statusItemXml(item) {
    const chave = chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, item.cProd);
    const associacao = bancoAssociacoesFornecedor[chave];
    const associacaoSpData = associacao ? listaAssociacoesSpData.find(a => a.codigoSmartCompras === associacao.codigoSmartCompras) : null;
    const produtoSpData = associacaoSpData ? listaProdutosSpData.find(p => p.codigo === associacaoSpData.spDataCodigo) : null;
    aplicarFatorFixoSpData(item, produtoSpData);
    let conversaoPendente = !!item.suspeito; // "suspeito" só continua true até confirmação explícita (edição OU botão Confirmar) — nunca mais "não mudou = não conferi"

    // Compra direta (sem cotação do SmartCompras): não passa pela associação
    // com a cotação — só o SP Data (guardado com uma chave própria "DIRETO::…",
    // na mesma coleção de associações SP Data, por fornecedor + código).
    if (item.semCotacao) {
        const chaveDireta = chaveDiretaSpData(item);
        const assocDireta = listaAssociacoesSpData.find(a => a.codigoSmartCompras === chaveDireta);
        const produtoDireto = assocDireta ? listaProdutosSpData.find(p => p.codigo === assocDireta.spDataCodigo) : null;
        aplicarFatorFixoSpData(item, produtoDireto);
        conversaoPendente = !!item.suspeito;
        const motivosDiretos = [];
        if (!produtoDireto) motivosDiretos.push('Sem SP Data');
        if (conversaoPendente) motivosDiretos.push('Conferir conversão');
        return { chave, associacao: null, semCotacao: true, chaveDireta, produtoSpData: produtoDireto, conversaoPendente, motivos: motivosDiretos, pronto: motivosDiretos.length === 0 };
    }

    const motivos = [];
    if (!associacao) motivos.push('Sem associação');
    else if (!produtoSpData) motivos.push('Sem SP Data');
    if (conversaoPendente) motivos.push('Conferir conversão');

    return { chave, associacao, produtoSpData, conversaoPendente, motivos, pronto: motivos.length === 0 };
}

// Estado derivado da NF — nada é armazenado, tudo recalculado a partir do
// que já está em memória (itensXmlDetectados, associações, pedido). É a
// mesma cadeia NF → associacoesFornecedor → item da cotação →
// associacoesSpData, só que resumida pra dizer "o que falta resolver".
// Fase 9: distingue BLOQUEIO (impede salvar — situação em que gravar sem
// decisão explícita seria inseguro: pedido ambíguo entre candidatos
// conflitantes, ou conversão de unidade suspeita ainda não confirmada, já
// que o fator vira número gravado na NF) de ALERTA (não impede salvar —
// recuperável depois pela própria tela de associação/SP Data: sem
// associação, sem SP Data, pedido simplesmente ainda não identificado, ou
// item esperado da cotação que não apareceu nesta NF — pode vir numa NF
// seguinte do mesmo pedido, já implementado em compararFontesPedido).
function calcularResumoPendenciasXml() {
    if (!nfeInfoAtual || !itensXmlDetectados.length) return null;

    let totalmentePronto = 0, semAssociacao = 0, semSpData = 0, semSpDataDireto = 0, conversaoPendente = 0, recursoSemDefinir = 0, recursoAtingiuMinimo = 0, recursoAbaixoMinimo = 0;
    itensXmlDetectados.forEach(item => {
        const s = statusItemXml(item);
        if (s.pronto) totalmentePronto++;
        if (s.semCotacao) { if (!s.produtoSpData) semSpDataDireto++; }
        else if (!s.associacao) semAssociacao++;
        else if (!s.produtoSpData) semSpData++;
        if (s.conversaoPendente) conversaoPendente++;
        const rec = recursoPrevistoItemXml(item, s);
        if (rec && !rec.valor && !rec.semDestino && !rec.semOrigem) recursoSemDefinir++;
        if (rec && rec.detTipo === 'cc') recursoAtingiuMinimo++;
        else if (rec && rec.detTipo === 'proprio') recursoAbaixoMinimo++;
    });
    const algumSemCotacao = itensXmlDetectados.some(i => i.semCotacao);
    const algumComCotacao = itensXmlDetectados.some(i => !i.semCotacao);

    const bloqueios = [];
    const alertas = [];
    const informativos = []; // nunca impedem o "tudo pronto" (verde) — só contexto, não pendência
    const naoFaturados = []; // Fase 36: [{ pedido, nomes[] }] — itens da cotação deste fornecedor que ainda não vieram em NF nenhuma

    if (conflitoPedidoXmlInfo) {
        // Já foi resolvido sozinho (pedido principal + adicional(is), ver
        // processarXmlTexto) — só informativo, nunca impede o "tudo pronto".
        informativos.push(`Itens desta NF pertencem a pedidos diferentes (${conflitoPedidoXmlInfo.pedidos.map(p => p.pedido).join(' e ')}) — todos já adicionados (cotação principal + adicional(is) acima).`);
    } else if (!pedidoSelecionadoXml && algumComCotacao) {
        alertas.push('Pedido/cotação ainda não identificado — selecione manualmente (ou confirme a sugestão, se houver uma). Se a NF não tem cotação do SmartCompras, marque a caixinha acima.');
    }
    // Cabeçalho informativo: quantos itens já atingiram o mínimo de
    // fornecedores (C/C) e quantos não (Recurso Próprio) — só aparece quando
    // há pelo menos um item com essa determinação.
    if (recursoAtingiuMinimo + recursoAbaixoMinimo > 0) {
        informativos.push(recursoAbaixoMinimo === 0
            ? `Recurso pelas cotações: todos os ${recursoAtingiuMinimo} item(ns) atingiram ${minimoFornecedoresCC()}+ fornecedores (C/C).`
            : `Recurso pelas cotações: ${recursoAtingiuMinimo} item(ns) com ${minimoFornecedoresCC()}+ fornecedores (C/C) · ${recursoAbaixoMinimo} item(ns) com menos (Recurso Próprio).`);
    }
    if (algumSemCotacao) {
        const cotDestino = pedidoSelecionadoXml ? listaCotacoes.find(c => c.pedido === pedidoSelecionadoXml) : null;
        if (!(cotDestino && cotDestino.origem) && !destinoSemCotacaoXml) {
            bloqueios.push('Defina o destino (Santa Casa/CTI) dos itens sem cotação do SmartCompras — é ele que define o recurso.');
        }
    }
    if (semAssociacao > 0) alertas.push(`${semAssociacao} item(ns) sem associação com a cotação — pode salvar e associar depois.`);
    if (semSpData > 0) alertas.push(`${semSpData} item(ns) associados à cotação mas ainda sem SP Data — pode salvar e associar depois.`);
    if (semSpDataDireto > 0) alertas.push(`${semSpDataDireto} item(ns) sem cotação do SmartCompras ainda sem SP Data — pode salvar e associar depois.`);
    if (recursoSemDefinir > 0) alertas.push(`${recursoSemDefinir} item(ns) sem recurso definido — escolha C/C ou Recurso Próprio na linha do item.`);
    if (conversaoPendente > 0) bloqueios.push(`${conversaoPendente} item(ns) com possível conversão de unidade sem confirmação — a quantidade gravada depende desse fator, confirme antes de salvar.`);

    // Itens que a cotação deste pedido/fornecedor espera, mas que não
    // aparecem NESTA NF nem em nenhuma NF já salva desse pedido — nunca
    // "não entregue": o mesmo pedido pode ter outra NF depois. Reaproveita
    // listaCotacoes/listaNfsProcessadas direto (mesma fonte de
    // compararFontesPedido), sem o filtro "pedidoTemNf" de lá — aqui
    // queremos o alerta já na primeira NF do pedido, não só a partir da
    // segunda. Só um alerta informativo, nunca bloqueia.
    // Roda pra cada cotação selecionada (normalmente só uma; numa NF com
    // itens de mais de um pedido, uma vez por pedido).
    // Fase 36: além do pedido escolhido no seletor, vale também o pedido das associações dos itens desta NF
    // (a associação por item é o caminho mais comum e o aviso só aparecia com o pedido escolhido no seletor).
    const pedidosParaAlerta = new Set(cotacoesSelecionadasXml());
    itensXmlDetectados.forEach(it => {
        if (it.semCotacao) return;
        const a = bancoAssociacoesFornecedor[chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, it.cProd)];
        if (a && a.pedido) pedidosParaAlerta.add(a.pedido);
    });
    [...pedidosParaAlerta].forEach(pedidoAlerta => {
        const cotacaoSelecionada = listaCotacoes.find(c => c.pedido === pedidoAlerta);
        if (!cotacaoSelecionada) return;
        const validacaoFornecedorAlerta = validarFornecedorSpData(nfeInfoAtual.cnpjEmit);
        const cnpjsFornecedorNf = validacaoFornecedorAlerta.encontrado
            ? [nfeInfoAtual.cnpjEmit, ...validacaoFornecedorAlerta.cnpjsRelacionados]
            : [nfeInfoAtual.cnpjEmit];
        const codigosDestaNf = codigosSmartComprasDestaNf();
        const codigosJaEmOutraNfDoPedido = new Set(
            listaNfsProcessadas.filter(nf => nf.pedido === pedidoAlerta || (nf.pedidos && nf.pedidos.includes(pedidoAlerta)))
                .flatMap(nf => (nf.itens || []).filter(it => !it.pedidoItem || it.pedidoItem === pedidoAlerta).map(it => it.codigoSmartCompras))
        );
        const itensCotacaoDesteFornecedor = (cotacaoSelecionada.itens || []).filter(it => cnpjEmLista(cnpjsFornecedorNf, it.cnpjFornecedor));
        const codigosUnicos = [...new Set(itensCotacaoDesteFornecedor.map(it => it.codProduto).filter(Boolean))];
        const codigosAusentes = codigosUnicos.filter(cod => !codigosDestaNf.includes(cod) && !codigosJaEmOutraNfDoPedido.has(cod));
        const nomesAusentes = codigosAusentes.map(cod => {
            const it = itensCotacaoDesteFornecedor.find(x => x.codProduto === cod);
            return it ? (it.nomeOficial || it.descricao || cod) : cod;
        });
        if (codigosAusentes.length > 0) {
            naoFaturados.push({ pedido: pedidoAlerta, nomes: nomesAusentes });
        }

        // Valor total cotado × faturado pra este fornecedor dentro do pedido —
        // o indicador mais direto de que algo não fechou (item não faturado,
        // preço diferente, item a mais/a menos), mesmo sem abrir Cotações.
        // Soma item a item (não o valor total da NF inteira): o preço × a
        // quantidade ORIGINAL da nota é sempre o valor real pago, imune a
        // qualquer fator de conversão (gotas/frasco, doses/frasco...) — e
        // funciona certo mesmo numa NF com itens de mais de um pedido.
        // Mesma tolerância já usada na reconciliação do ERP (Fase 8/9).
        const valorCotadoFornecedor = itensCotacaoDesteFornecedor.reduce((soma, it) => {
            const total = numeroFlexivel(it.precoTotal);
            if (total !== null) return soma + total;
            const qtd = numeroFlexivel(it.quantidade), unit = numeroFlexivel(it.precoUnitario);
            return soma + (qtd !== null && unit !== null ? qtd * unit : 0);
        }, 0);
        if (valorCotadoFornecedor > 0) {
            const codigosDaCotacaoDesteFornecedor = new Set(itensCotacaoDesteFornecedor.map(it => it.codProduto));
            const valorDestaNfFornecedor = itensXmlDetectados.reduce((s, it) => {
                if (it.semCotacao) return s;
                const assoc = bancoAssociacoesFornecedor[chaveAssociacaoFornecedor(nfeInfoAtual.cnpjEmit, it.cProd)];
                if (!assoc || !codigosDaCotacaoDesteFornecedor.has(assoc.codigoSmartCompras)) return s;
                if ((assoc.pedido || pedidoSelecionadoXml) !== pedidoAlerta) return s;
                return s + (it.qComOriginal || 0) * (it.vUnComOriginal || 0);
            }, 0);
            const ehEstaNf = nf => nf.nf === nfeInfoAtual.nNF && (nf.serie || '') === (nfeInfoAtual.serie || '') && mesmoCnpj(nf.cnpjFornecedor, nfeInfoAtual.cnpjEmit);
            const outrasNfsFornecedor = listaNfsProcessadas.filter(nf =>
                (nf.pedido === pedidoAlerta || (nf.pedidos && nf.pedidos.includes(pedidoAlerta))) &&
                cnpjEmLista(cnpjsFornecedorNf, nf.cnpjFornecedor) && !ehEstaNf(nf)
            );
            const valorOutrasNfsFornecedor = outrasNfsFornecedor.reduce((s, nf) => s + (nf.itens || [])
                .filter(it => codigosDaCotacaoDesteFornecedor.has(it.codigoSmartCompras) && (!it.pedidoItem || it.pedidoItem === pedidoAlerta))
                .reduce((s2, it) => s2 + (it.quantidade || 0) * (it.valorUnitario || 0), 0), 0);
            const valorFaturadoFornecedor = valorOutrasNfsFornecedor + valorDestaNfFornecedor;
            const diffPercentual = Math.abs(valorFaturadoFornecedor - valorCotadoFornecedor) / valorCotadoFornecedor;
            if (diffPercentual > TOLERANCIA_VALOR_RECONCILIACAO_ERP) {
                const rotuloPedido2 = pedidosParaAlerta.size > 1 ? ` do pedido ${pedidoAlerta}` : '';
                const diferenca = Math.abs(valorFaturadoFornecedor - valorCotadoFornecedor);
                // Se a diferença bate (mais ou menos) com o valor cotado dos
                // itens que ainda não apareceram em nenhuma NF, é o esperado
                // duma entrega parcial — só um informativo, junto do aviso de
                // quais itens faltam. Só vira alerta (bloqueia o "pronta")
                // quando a diferença NÃO se explica só por isso — sinal de
                // algo genuinamente errado (preço, quantidade, item a mais).
                const valorAusentes = codigosAusentes.reduce((s, cod) => {
                    const it = itensCotacaoDesteFornecedor.find(x => x.codProduto === cod);
                    if (!it) return s;
                    const total = numeroFlexivel(it.precoTotal);
                    if (total !== null) return s + total;
                    const qtd = numeroFlexivel(it.quantidade), unit = numeroFlexivel(it.precoUnitario);
                    return s + (qtd !== null && unit !== null ? qtd * unit : 0);
                }, 0);
                const toleranciaAbs = Math.max(0.5, valorCotadoFornecedor * TOLERANCIA_VALOR_RECONCILIACAO_ERP);
                const explicadoPelosAusentes = codigosAusentes.length > 0 && Math.abs(diferenca - valorAusentes) <= toleranciaAbs;
                const explicacao = codigosAusentes.length
                    ? ` — possivelmente porque ${codigosAusentes.length === 1 ? 'o item' : 'os itens'} ${nomesAusentes.join(', ')} ainda não ${codigosAusentes.length === 1 ? 'foi faturado' : 'foram faturados'}`
                    : '';
                const mensagem = `Valor total${rotuloPedido2} não bate: cotado R$ ${formatarValorMonetarioBR(valorCotadoFornecedor)}, faturado até agora R$ ${formatarValorMonetarioBR(valorFaturadoFornecedor)} (diferença de R$ ${formatarValorMonetarioBR(diferenca)})${explicacao}.`;
                (explicadoPelosAusentes ? informativos : alertas).push(mensagem);
            }
        }
    });

    return {
        totalItens: itensXmlDetectados.length,
        totalmentePronto, semAssociacao, semSpData, conversaoPendente,
        validacaoFornecedor: validarFornecedorSpData(nfeInfoAtual.cnpjEmit),
        bloqueios, alertas, informativos, naoFaturados,
        pronta: bloqueios.length === 0 && alertas.length === 0,
        podeSalvar: bloqueios.length === 0
    };
}

// ===== Fase 39: Entrada de NF em abas (Itens · Pedido · NF) =====
let abaXmlAtiva = 'itens';
const ROTULO_ABA_XML = { itens: 'Itens', pedido: 'Pedido', nf: 'NF' };
// Em qual aba se resolve cada pendência (só navegação; o texto e a regra da pendência não mudam).
function abaDaPendenciaXml(texto) {
    if (/^(Pedido\/cotação|Defina o destino|Valor total)/.test(texto)) return 'pedido';
    if (/^CNPJ/.test(texto)) return 'nf';
    return 'itens';
}
function linhaPendenciaXml(texto, alerta) {
    const aba = abaDaPendenciaXml(texto);
    return `<div class="xml-pend-linha xml-pend-clicavel ${alerta ? 'alerta' : ''}" onclick="alternarAbaXml('${aba}', true)"><span class="xml-pend-marca"></span><span class="xml-pend-texto">${texto}</span><span class="xml-pend-aba">${ROTULO_ABA_XML[aba]} ›</span></div>`;
}
function alternarAbaXml(aba, rolar) {
    abaXmlAtiva = aba;
    document.querySelectorAll('#screen-xml-editor .xml-aba-pane').forEach(p => p.classList.toggle('ativa', p.dataset.aba === aba));
    document.querySelectorAll('#xml-abas .xml-filtro-btn').forEach(b => b.classList.toggle('active', b.dataset.aba === aba));
    renderResumoPendenciasXml();
    if (rolar) { const tela = document.getElementById('screen-xml-editor'); if (tela) tela.scrollTop = 0; }
}

function renderResumoPendenciasXml() {
    const el = document.getElementById('xml-estado-nf');
    if (!el) return;
    const resumo = calcularResumoPendenciasXml();
    if (!resumo) {
        el.style.display = 'none';
        const elInfo0 = document.getElementById('xml-informativos-nf');
        if (elInfo0) elInfo0.style.display = 'none';
        return;
    }
    el.style.display = 'block';
    const estadoClasse = resumo.pronta ? 'pronto' : (resumo.podeSalvar ? 'atencao' : 'pendente');
    el.className = `xml-estado-card ${estadoClasse}`;

    const validacaoHTML = resumo.validacaoFornecedor.encontrado
        ? `<div class="xml-estado-validacao">Fornecedor no cadastro SP Data: ${resumo.validacaoFornecedor.codigo} — ${resumo.validacaoFornecedor.nomeExibido || resumo.validacaoFornecedor.nomeReal} (CNPJ confere)</div>`
        : resumo.validacaoFornecedor.ambiguo
            ? `<div class="xml-estado-validacao">⚠ Este CNPJ está cadastrado em mais de um fornecedor SP Data (${resumo.validacaoFornecedor.candidatos.map(c => c.codigo + ' — ' + c.nome).join(' / ')}) — ambíguo, confira manualmente.</div>`
            : `<div class="xml-estado-validacao">CNPJ não encontrado no cadastro de fornecedores SP Data (não impede a entrada, só não foi possível confirmar).</div>`;

    // Fase 39: na aba Itens aparece o checklist completo; nas outras, só o que se resolve ali (+ atalho p/ o resto).
    const todasPend = [...resumo.bloqueios.map(t => [t, false]), ...resumo.alertas.map(t => [t, true])];
    const doAba = todasPend.filter(([t]) => abaXmlAtiva === 'itens' || abaDaPendenciaXml(t) === abaXmlAtiva);
    const ocultas = todasPend.length - doAba.length;
    const naoFatTotal = (resumo.naoFaturados || []).reduce((n, g) => n + g.nomes.length, 0);
    // Fase 43: lote/validade achados no texto (informativo — nunca bloqueia nem impede o "pronto")
    const nLoteAuto = itensXmlDetectados.filter(it => !it.rastros.length && it.rastroDecidido && it.rastroDecidido.origem === 'texto').length;
    const nLoteRuim = itensXmlDetectados.filter(it => !it.rastros.length && !it.rastroDecidido && it.loteCandidato && !it.loteCandidato.valida).length;
    const nLoteCand = nLoteAuto; // (nome mantido: usado abaixo no resumo de "pronta")
    const linhaLoteHTML = (nLoteAuto || nLoteRuim)
        ? `<div class="xml-pend-linha info"><span class="xml-pend-marca"></span><span class="xml-pend-texto">${nLoteAuto ? `${nLoteAuto} item(ns) com lote e validade lidos do texto — já entram no XML` : ''}${nLoteAuto && nLoteRuim ? '; ' : ''}${nLoteRuim ? `${nLoteRuim} com validade impossível no texto — não entram no XML` : ''}</span></div>`
        : '';
    const listaPendHTML = doAba.map(([t, al]) => linhaPendenciaXml(t, al)).join('')
        + (ocultas ? `<div class="xml-pend-linha xml-pend-clicavel" onclick="alternarAbaXml('itens', true)"><span class="xml-pend-marca"></span><span class="xml-pend-texto">${ocultas} pendência(s) em outras abas</span><span class="xml-pend-aba">Itens ›</span></div>` : '')
        + linhaLoteHTML
        + (naoFatTotal ? `<div class="xml-pend-linha xml-pend-clicavel info" onclick="alternarAbaXml('pedido', true)"><span class="xml-pend-marca"></span><span class="xml-pend-texto">${naoFatTotal} item(ns) da cotação ainda não faturado(s) — podem vir numa NF seguinte</span><span class="xml-pend-aba">Pedido ›</span></div>` : '');
    // contagem e pontinhos nas abas
    const pendPorAba = { itens: 0, pedido: 0, nf: 0 };
    todasPend.forEach(([t]) => { pendPorAba[abaDaPendenciaXml(t)]++; });
    document.querySelectorAll('#xml-abas .xml-filtro-btn').forEach(b => {
        const ponto = b.querySelector('.xml-aba-ponto');
        const n = pendPorAba[b.dataset.aba] || 0;
        if (ponto) { ponto.textContent = n ? '●' : (b.dataset.aba === 'pedido' && naoFatTotal ? '○' : ''); ponto.className = 'xml-aba-ponto' + (n ? ' alerta' : ''); }
        const c = b.querySelector('.xml-aba-cont'); if (c) c.textContent = resumo.totalItens;
    });
    let corpoHTML;
    if (resumo.pronta) {
        corpoHTML = `<div class="xml-estado-linha"><span class="xml-item-badge pronto">✓ Pronta</span><strong>${resumo.totalItens} item(ns) — todos totalmente prontos. Pode salvar.</strong></div>${(naoFatTotal || nLoteCand || nLoteRuim) ? `<div class="xml-pend-lista">${listaPendHTML}</div>` : ''}`;
    } else if (!resumo.podeSalvar) {
        corpoHTML = `<div class="xml-estado-linha"><span class="xml-item-badge pendente">⛔ Bloqueado</span><strong>Resolva antes de salvar</strong></div>
           <div class="xml-pend-lista">${listaPendHTML}</div>`;
    } else {
        corpoHTML = `<div class="xml-estado-linha"><span class="xml-item-badge pendente">⚠ Pode salvar, com alerta(s)</span><strong>${resumo.totalmentePronto} de ${resumo.totalItens} totalmente pronto(s)</strong></div>
           <div class="xml-pend-lista">${listaPendHTML}</div>`;
    }

    el.innerHTML = corpoHTML + validacaoHTML;
    // Fase 33: a barra de salvar (fixa embaixo) diz em uma linha o que falta.
    const statusBarra = document.getElementById('xml-acoes-status');
    if (statusBarra) {
        statusBarra.textContent = resumo.pronta ? 'Tudo pronto para salvar'
            : !resumo.podeSalvar ? `${resumo.bloqueios.length} pendência${resumo.bloqueios.length === 1 ? '' : 's'} para resolver antes de salvar`
            : `Pode salvar · ${resumo.alertas.length} alerta${resumo.alertas.length === 1 ? '' : 's'}`;
        statusBarra.className = 'xml-acoes-status ' + estadoClasse;
    }

    // Informativos (recurso pelas cotações, itens de outro pedido já
    // resolvidos, itens que ainda podem vir numa próxima NF): nunca são uma
    // pendência a resolver, então ficam num card neutro separado — mesmo
    // numa NF 100% pronta, sem tirar o "✓ Pronta" de verde.
    const elInfo = document.getElementById('xml-informativos-nf');
    if (elInfo) {
        // Fase 36: itens da cotação deste fornecedor que ainda não vieram em NF nenhuma — em lista, com os nomes.
        const naoFatHTML = (resumo.naoFaturados || []).map(g => `
            <div class="xml-nao-faturado">
                <div class="xml-nao-faturado-titulo">${g.nomes.length} item(ns) da cotação${(resumo.naoFaturados.length > 1) ? ' ' + escRel(g.pedido) : ''} ainda não faturado(s)</div>
                ${g.nomes.map(n => `<div class="xml-nao-faturado-item">${escRel(n)}</div>`).join('')}
                <div class="xml-nao-faturado-nota">Podem vir numa NF seguinte — não é um problema desta NF.</div>
            </div>`).join('');
        const infoHTML = resumo.informativos.length ? `<div class="xml-estado-lista txt-aux">${resumo.informativos.map(p => '• ' + p).join('<br>')}</div>` : '';
        if (naoFatHTML || infoHTML) {
            elInfo.style.display = 'block';
            elInfo.innerHTML = naoFatHTML + infoHTML;
        } else {
            elInfo.style.display = 'none';
        }
    }

    // O botão principal agora é "Salvar NF" — reflete o estado (verde
    // quando pronta, alerta quando há pendência não-bloqueante, e continua
    // clicável mesmo bloqueada — o gate no clique é quem decide se passa,
    // pra sempre explicar o motivo em vez de simplesmente desabilitar.
    const btnSalvar = document.getElementById('xml-btn-salvar');
    if (btnSalvar) {
        btnSalvar.className = 'actions-button ' + (resumo.pronta ? 'is-success' : 'is-warning');
        const icone = btnSalvar.querySelector('i');
        if (icone) icone.className = resumo.pronta ? 'fa-solid fa-check' : 'fa-solid fa-triangle-exclamation';
    }
}


function renderTabelaItensXml() {
    renderAssociacaoCotacaoXml();
}

// Fase 33: um item aberto por vez. Só troca classes (sem redesenhar a lista), pra animação rodar
// e inputs/painéis dos outros itens não serem perdidos.
let itensXmlAbertos = new Set();
let itemXmlNfInicializada = null;
function alternarItemXmlAberto(idx) {
    if (itensXmlAbertos.has(idx)) itensXmlAbertos.delete(idx); else itensXmlAbertos.add(idx);
    document.querySelectorAll('#xml-associacao-container .xml-item-colapsavel').forEach(el => {
        if (Number(el.dataset.xmlIdx) !== idx) return;
        const abre = itensXmlAbertos.has(idx);
        el.classList.toggle('aberto', abre);
        const b = el.querySelector('.xml-item-resumo');
        if (b) b.setAttribute('aria-expanded', abre ? 'true' : 'false');
    });
}

function atualizarFatorXml(idx, valor) {
    const fator = parseInt(valor, 10) || 1;
    itensXmlDetectados[idx].fator = fator;
    itensXmlDetectados[idx].suspeito = false;
    itensXmlDetectados[idx].conferido = true;
    itensXmlDetectados[idx].deExcecao = false;
    itensXmlDetectados[idx].deFatorFixo = false;
    itensXmlDetectados[idx].fatorFixoTratado = true;
    renderTabelaItensXml();
}
// "Alterado" e "conferido" são conceitos diferentes: antes, um item suspeito
// só saía da pendência se o valor do fator mudasse (onchange). Se o usuário
// olhava e concordava que o fator sugerido (ou o padrão 1) já estava certo,
// não tinha como confirmar sem mexer no número. Este botão resolve isso —
// confirma sem exigir alteração.
function confirmarFatorXml(idx) {
    itensXmlDetectados[idx].fatorFixoTratado = true;
    itensXmlDetectados[idx].suspeito = false;
    itensXmlDetectados[idx].conferido = true;
    renderTabelaItensXml();
}
function atualizarCProdXml(idx, valor) {
    const item = itensXmlDetectados[idx];
    if (!item) return;
    const v = valor.trim();
    item.cProdNovo = v || null;
    item.possibilidadeEscolhida = null; // edição manual substitui qualquer sugestão do histórico
    item.decisaoTomada = (item.cProdNovo && item.cProdNovo !== item.cProd) ? 'aplicado_manual' : 'nao_decidido';
}
function limparBancoExcecoesXml() {
    showConfirmModal({
        title: 'Limpar Banco de Exceções',
        message: 'Isso apaga todas as correções de fator lembradas por fornecedor/produto. Você vai precisar corrigir de novo na próxima vez que aparecerem.',
        confirmText: 'Limpar',
        confirmClass: 'danger',
        onConfirm: async () => {
            const snapshot = await xmlExcecoesCollection.get();
            const batch = firestore.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            toast('✓ Banco de exceções limpo.');
            if (xmlDocAtual) renderTabelaItensXml();
        }
    });
}

// ============================================================
// ASSOCIAÇÃO NF-e → CÓDIGO DO FORNECEDOR → ITEM DA COTAÇÃO — Fase 2
// Primeira etapa da cadeia do roadmap (NF-e → fornecedor → cotação → SP
// Data). O código do fornecedor vem exclusivamente do campo estruturado
// cProd do XML (nunca de observação/descrição). A ligação até o SP Data
// continua sendo feita depois, pela tela de associação SP Data já
// existente (Central do Pedido) — aqui só se resolve o primeiro elo.
// Histórico append-only, mesmo padrão de confirmarAssociacaoSpData: uma
// correção nunca apaga a associação anterior, só acrescenta e atualiza
// qual é a atual.
// ============================================================

// CNPJ sempre é COMPARADO só pelos dígitos. O XML do SmartCompras (principalmente
// os antigos) traz "44.672.062/0001-15", enquanto NF-e, cadastro SP Data, ERP e o
// relatório de fornecedores ganhadores usam os 14 dígitos. Nada é reescrito no
// banco: só a comparação ignora a pontuação (igualdade exata dos dígitos — nunca
// aproximada). Toda comparação nova envolvendo CNPJ deve usar estes helpers.
function normalizarCnpj(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
// Identidade: só é "o mesmo" se os dois tiverem CNPJ e os dígitos forem idênticos.
function mesmoCnpj(a, b) { const x = normalizarCnpj(a); return x !== '' && x === normalizarCnpj(b); }
function cnpjEmLista(lista, c) { return (lista || []).some(x => mesmoCnpj(x, c)); }

function chaveAssociacaoFornecedor(cnpjEmit, codigoFornecedor) {
    return `${normalizarCnpj(cnpjEmit)}::${codigoFornecedor}`.replace(/\//g, '_');
}

// ===================================================================
// --- HISTÓRICO DE ASSOCIAÇÕES (base para o futuro Editor XML) ---
// ===================================================================
// Só consulta o que já existe — nenhuma coleção nova, nenhum campo novo,
// nenhuma escrita. A cadeia Fornecedor/CNPJ → código do fornecedor → código
// SmartCompras → código SP Data → produto já é histórica (append-only) em
// duas coleções diferentes:
//   associacoesFornecedor (chave cnpjEmit::códigoFornecedor) -> codigoSmartCompras, com historico[]
//   associacoesSpData     (chave codigoSmartCompras)         -> spDataCodigo,       com historico[]
// e o nome do produto vem de produtosSpData. NF/data de origem já ficam em
// nfsProcessadas e no campo confirmadoEm/nfNumero de cada entrada.
//
// Como um mesmo fornecedor pode ter mais de um CNPJ (matriz/filial/CD já
// vinculados manualmente em fornecedoresSpData via entidadesRelacionadas —
// ver módulo de Fornecedores), a consulta olha o histórico em TODOS os CNPJs
// da mesma entidade, não só no CNPJ exato do XML atual — sem decidir nada
// sozinha, só reunindo o que já foi confirmado no passado.
//
// Não implementa nenhuma identidade de produto nem decide equivalência: só
// devolve os fatos já confirmados, do mais recente pro mais antigo, pra um
// dia o Editor XML apresentar como sugestão ao usuário confirmar.

// Reaproveita a mesma ideia de agrupamento por entidadesRelacionadas usada em
// listaFornecedoresUnificada(), mas partindo de um CNPJ (não de um id de
// documento). Só leitura.
function cnpjsDaMesmaEntidadeFornecedor(cnpj) {
    cnpj = normalizarCnpj(cnpj);
    const docInicial = listaFornecedoresSpData.find(f => (f.cnpjs || []).some(c => c.cnpj === cnpj));
    if (!docInicial) return [cnpj];
    const porId = {};
    listaFornecedoresSpData.forEach(f => { porId[f.id] = f; });
    const visitado = new Set();
    const pilha = [docInicial.id];
    const cnpjsDoGrupo = new Set([cnpj]);
    while (pilha.length) {
        const atualId = pilha.pop();
        if (visitado.has(atualId) || !porId[atualId]) continue;
        visitado.add(atualId);
        (porId[atualId].cnpjs || []).forEach(c => cnpjsDoGrupo.add(c.cnpj));
        (porId[atualId].entidadesRelacionadas || []).forEach(outroId => { if (!visitado.has(outroId)) pilha.push(outroId); });
    }
    return [...cnpjsDoGrupo];
}

// Consulta (não decide, não grava nada) o histórico de associações já
// confirmadas pra um código de produto do fornecedor (cProd, como vem do
// XML), considerando todos os CNPJs da mesma entidade de fornecedor.
// Retorna uma lista do mais recente pro mais antigo — cada item é um fato já
// confirmado no passado, nunca uma sugestão calculada por semelhança.
function consultarHistoricoAssociacaoFornecedor(cnpjEmit, codigoFornecedor) {
    if (!cnpjEmit || !codigoFornecedor) return [];
    const cnpjsRelacionados = cnpjsDaMesmaEntidadeFornecedor(cnpjEmit);
    const resultados = [];

    cnpjsRelacionados.forEach(cnpj => {
        const chave = chaveAssociacaoFornecedor(cnpj, codigoFornecedor);
        const associacao = bancoAssociacoesFornecedor[chave];
        if (!associacao) return;

        const entradasHistorico = (associacao.historico && associacao.historico.length)
            ? associacao.historico
            : [{ codigoSmartCompras: associacao.codigoSmartCompras, confirmadoEm: associacao.confirmadoEm, tipo: 'confirmacao' }];

        entradasHistorico.forEach(h => {
            const assocSpData = listaAssociacoesSpData.find(a => a.codigoSmartCompras === h.codigoSmartCompras);
            // Também considera o histórico da 2ª ponta (SmartCompras -> SP
            // Data), não só o valor vigente hoje — uma correção antiga nessa
            // ponta não pode ficar invisível pro futuro Editor.
            const entradasSpData = (assocSpData && assocSpData.historico && assocSpData.historico.length)
                ? assocSpData.historico
                : (assocSpData ? [{ spDataCodigo: assocSpData.spDataCodigo, confirmadoEm: assocSpData.confirmadoEm, tipo: 'confirmacao' }] : [{ spDataCodigo: null, confirmadoEm: null, tipo: null }]);

            entradasSpData.forEach(hs => {
                const produto = hs.spDataCodigo ? listaProdutosSpData.find(p => p.codigo === hs.spDataCodigo) : null;
                resultados.push({
                    cnpjFornecedor: cnpj,
                    codigoFornecedor,
                    codigoSmartCompras: h.codigoSmartCompras,
                    spDataCodigo: hs.spDataCodigo,
                    produtoNome: produto ? produto.nome : null,
                    // Campos originais desta função — preservados como
                    // estavam, refletindo a ponta fornecedor->SmartCompras.
                    confirmadoEm: h.confirmadoEm || null,
                    tipo: h.tipo || 'confirmacao',
                    nfNumero: associacao.nfNumero || null,
                    // Novos, aditivos: detalham cada ponta separadamente e
                    // sinalizam (sem decidir nada) qual é a vigente hoje.
                    confirmadoEmSmartCompras: h.confirmadoEm || null,
                    atualParaFornecedor: associacao.codigoSmartCompras === h.codigoSmartCompras,
                    confirmadoEmSpData: hs.confirmadoEm || null,
                    tipoSpData: hs.tipo || null,
                    atualParaSpData: assocSpData ? assocSpData.spDataCodigo === hs.spDataCodigo : false
                });
            });
        });
    });

    return resultados.sort((a, b) => {
        const dataA = [a.confirmadoEmSmartCompras, a.confirmadoEmSpData].filter(Boolean).sort().pop() || '';
        const dataB = [b.confirmadoEmSmartCompras, b.confirmadoEmSpData].filter(Boolean).sort().pop() || '';
        return dataB.localeCompare(dataA);
    });
}

// Camada de consulta/decisão assistida pro futuro Editor XML: dado o CNPJ do
// emitente + o código do produto no XML (cProd), responde "o que já sabemos
// sobre isso?" reunindo TODAS as associações históricas conhecidas em
// possibilidades distintas, sem escolher nenhuma automaticamente. Reaproveita
// consultarHistoricoAssociacaoFornecedor (nenhuma lógica de junção
// duplicada) e só organiza/enriquece o que ela já retorna:
//   - agrupa ocorrências repetidas do mesmo par (codigoSmartCompras + spDataCodigo)
//     numa única "possibilidade", sem descartar nenhuma ocorrência (cada uma
//     continua disponível em `ocorrencias`);
//   - cruza com nfsProcessadas pra trazer as NFs que realmente bateram com
//     esse fornecedor/código, além da NF gravada na hora da confirmação;
//   - inclui o nome de exibição do fornecedor, pra dar contexto.
// Não decide nada: quem escolhe é sempre o usuário, no futuro Editor.
function consultarAssociacoesConhecidasParaXml(cnpjEmit, codigoFornecedor) {
    cnpjEmit = normalizarCnpj(cnpjEmit);
    const historico = consultarHistoricoAssociacaoFornecedor(cnpjEmit, codigoFornecedor);
    const docFornecedor = listaFornecedoresSpData.find(f => (f.cnpjs || []).some(c => c.cnpj === cnpjEmit));
    const cnpjsConsiderados = cnpjsDaMesmaEntidadeFornecedor(cnpjEmit);

    const nfsRelacionadas = listaNfsProcessadas
        .filter(nf => cnpjsConsiderados.includes(nf.cnpjFornecedor) && (nf.itens || []).some(it => it.cProd === codigoFornecedor))
        .map(nf => ({ nf: nf.nf, serie: nf.serie || null, processadoEm: nf.processadoEm || null, cnpjFornecedor: nf.cnpjFornecedor }))
        .sort((a, b) => (b.processadoEm || '').localeCompare(a.processadoEm || ''));

    const porPossibilidade = {};
    historico.forEach(h => {
        const chavePossibilidade = `${h.codigoSmartCompras || '·'}::${h.spDataCodigo || '·'}`;
        if (!porPossibilidade[chavePossibilidade]) {
            porPossibilidade[chavePossibilidade] = {
                codigoSmartCompras: h.codigoSmartCompras,
                spDataCodigo: h.spDataCodigo,
                produtoNome: h.produtoNome,
                cnpjsQueConfirmaram: new Set(),
                ocorrencias: []
            };
        }
        const p = porPossibilidade[chavePossibilidade];
        p.cnpjsQueConfirmaram.add(h.cnpjFornecedor);
        p.ocorrencias.push({
            cnpjFornecedor: h.cnpjFornecedor,
            confirmadoEmSmartCompras: h.confirmadoEmSmartCompras,
            atualParaFornecedor: h.atualParaFornecedor,
            confirmadoEmSpData: h.confirmadoEmSpData,
            atualParaSpData: h.atualParaSpData,
            nfNumero: h.nfNumero
        });
    });

    const possibilidades = Object.values(porPossibilidade).map(p => {
        const ocorrenciasOrdenadas = p.ocorrencias.slice().sort((a, b) => {
            const dataA = [a.confirmadoEmSmartCompras, a.confirmadoEmSpData].filter(Boolean).sort().pop() || '';
            const dataB = [b.confirmadoEmSmartCompras, b.confirmadoEmSpData].filter(Boolean).sort().pop() || '';
            return dataB.localeCompare(dataA);
        });
        return {
            codigoSmartCompras: p.codigoSmartCompras,
            spDataCodigo: p.spDataCodigo,
            produtoNome: p.produtoNome,
            // "Vigente hoje" pra pelo menos um dos CNPJs considerados, nas
            // duas pontas — só informativo, o futuro Editor decide o que
            // fazer com isso, nunca é aplicado sozinho.
            atual: ocorrenciasOrdenadas.some(o => o.atualParaFornecedor && o.atualParaSpData),
            vezesConfirmada: ocorrenciasOrdenadas.length,
            primeiraConfirmacaoEm: ocorrenciasOrdenadas[ocorrenciasOrdenadas.length - 1]?.confirmadoEmSmartCompras || null,
            ultimaConfirmacaoEm: ocorrenciasOrdenadas[0]?.confirmadoEmSmartCompras || null,
            cnpjsQueConfirmaram: [...p.cnpjsQueConfirmaram],
            ocorrencias: ocorrenciasOrdenadas
        };
    }).sort((a, b) => (b.ultimaConfirmacaoEm || '').localeCompare(a.ultimaConfirmacaoEm || ''));

    return {
        cnpjConsultado: cnpjEmit,
        codigoFornecedor,
        fornecedorNome: docFornecedor ? (docFornecedor.nomeExibido || docFornecedor.nomeReal) : null,
        cnpjsConsiderados,
        temAssociacaoConhecida: possibilidades.length > 0,
        possibilidades,
        nfsRelacionadas
    };
}

// Fase 9: aplica a sugestão de pedido (por evidência de valor) só quando o
// usuário confirma explicitamente — nunca automático, mesmo com um único
// candidato dentro da tolerância.
function confirmarPedidoSugeridoXml(pedido) {
    pedidoSelecionadoXml = pedido;
    pedidoOrigemXml = 'manual';
    pedidoSugestaoXmlInfo = null;
    renderAssociacaoCotacaoXml();
}

function selecionarPedidoAssociacaoXml(pedido) {
    pedidoSelecionadoXml = pedido || null;
    pedidoOrigemXml = pedido ? 'manual' : null;
    pedidoSugestaoXmlInfo = null;
    pedidosAdicionaisXml = pedidosAdicionaisXml.filter(p => p !== pedido);
    renderAssociacaoCotacaoXml();
}

// "Cotação adicional": pra quando a mesma NF traz itens de mais de um pedido
// (ex.: compra que juntou dois pedidos do SmartCompras). Fica só como
// EXTRA — a cotação principal (seletor de cima) continua sendo a única
// obrigatória.
function adicionarCotacaoXml(pedido) {
    if (!pedido || pedido === pedidoSelecionadoXml || pedidosAdicionaisXml.includes(pedido)) return;
    pedidosAdicionaisXml.push(pedido);
    renderAssociacaoCotacaoXml();
}
function removerCotacaoAdicionalXml(pedido) {
    pedidosAdicionaisXml = pedidosAdicionaisXml.filter(p => p !== pedido);
    renderAssociacaoCotacaoXml();
}

function alternarFiltroItensXml(modo) {
    filtroItensXml = modo;
    renderAssociacaoCotacaoXml();
}

function alternarOutrosFornecedoresXml() {
    mostrarOutrosFornecedoresXml = !mostrarOutrosFornecedoresXml;
    renderAssociacaoCotacaoXml();
}

// Busca textual dentro do seletor de item da cotação (código SmartCompras ou
// nome/parte do nome) — determinística, sem fuzzy match: só esconde/mostra
// as opções via correspondência de substring no texto já renderizado
// (código, nome, fabricante, embalagem, quantidade já estão nesse texto).
function filtrarOpcoesItemXml(chave, termo) {
    const select = document.getElementById(`assoc-forn-select-${chave}`);
    if (!select) return;
    const t = termo.trim().toUpperCase();
    Array.from(select.options).forEach(opt => {
        if (!opt.value || opt.value === SEM_COTACAO_VALOR) { opt.style.display = ''; return; }
        opt.style.display = (!t || opt.textContent.toUpperCase().includes(t)) ? '' : 'none';
    });
}

function toggleCorrecaoAssociacaoFornecedor(chave) {
    if (associacaoFornecedorBuscaAberta.has(chave)) associacaoFornecedorBuscaAberta.delete(chave);
    else associacaoFornecedorBuscaAberta.add(chave);
    renderAssociacaoCotacaoXml();
}

function renderAssociacaoCotacaoXml() {
    const container = document.getElementById('xml-associacao-container');
    const seletorPedido = document.getElementById('xml-associacao-pedido');
    const captionEl = document.getElementById('xml-pedido-caption');
    if (!container || !seletorPedido || !nfeInfoAtual) return;

    // O CNPJ da NF pode ser diferente do CNPJ cadastrado na cotação (CDs/
    // filiais do mesmo fornecedor) — por isso o seletor sempre lista TODAS
    // as cotações, nunca só as que têm esse CNPJ. O CNPJ ainda serve como
    // sinal pra pré-selecionar automaticamente (só quando é o único jeito
    // determinístico de decidir, ver processarXmlTexto), mas nunca como
    // filtro que esconde opções — a seleção manual precisa continuar
    // sempre disponível.
    const pedidosOrdenados = ordenarCotacoes(listaCotacoes);
    seletorPedido.innerHTML = '<option value="">Selecione o pedido/cotação...</option>' +
        pedidosOrdenados.map(c => `<option value="${c.pedido}" ${pedidoSelecionadoXml === c.pedido ? 'selected' : ''}>${c.pedido}${c.origem ? ' — ' + c.origem : ''}</option>`).join('');

    const avisoSemCotacoesHTML = pedidosOrdenados.length === 0
        ? '<div class="central-item-vazio">Nenhuma cotação cadastrada ainda. Cadastre a cotação correspondente pra associar os itens, ou marque "Esta NF não possui cotação do SmartCompras".</div>' : '';

    const chkSemCotacao = document.getElementById('xml-sem-cotacao-nf');
    if (chkSemCotacao) chkSemCotacao.checked = semCotacaoNfXml;
    seletorPedido.disabled = semCotacaoNfXml;

    const cotacaoAtual = listaCotacoes.find(c => c.pedido === pedidoSelecionadoXml);
    const cotacoesAdicionaisObjs = pedidosAdicionaisXml.map(p => listaCotacoes.find(c => c.pedido === p)).filter(Boolean);
    const multiPedido = cotacoesAdicionaisObjs.length > 0;

    // Destino (Santa Casa/CTI): só é pedido quando há item sem cotação e não
    // existe cotação com Origem pra dar o destino.
    const destinoBox = document.getElementById('xml-destino-sem-cotacao');
    if (destinoBox) {
        const precisaDestino = itensXmlDetectados.some(i => i.semCotacao) && !(cotacaoAtual && cotacaoAtual.origem);
        destinoBox.style.display = precisaDestino ? 'block' : 'none';
        const selDestino = document.getElementById('xml-destino-sem-cotacao-select');
        if (selDestino) selDestino.value = destinoSemCotacaoXml;
    }

    // "+ Adicionar cotação": pra NF com itens de mais de um pedido. Fica
    // escondido quando não há cotação sem ser a principal pra adicionar.
    const addBox = document.getElementById('xml-cotacao-adicional-box');
    if (addBox) {
        addBox.style.display = semCotacaoNfXml ? 'none' : 'block';
        const chipsHTML = cotacoesAdicionaisObjs.map(c => `<span class="action-chip">${escRel(c.pedido)}${c.origem ? ' — ' + escRel(c.origem) : ''}<button type="button" class="divergencia-del" onclick="removerCotacaoAdicionalXml('${escRel(c.pedido)}')" aria-label="Remover cotação ${escRel(c.pedido)}"><i class="fa-solid fa-xmark"></i></button></span>`).join(' ');
        const disponiveis = pedidosOrdenados.filter(c => c.pedido !== pedidoSelecionadoXml && !pedidosAdicionaisXml.includes(c.pedido));
        const selHTML = `<select class="form-field" id="xml-cotacao-adicional-select" ${disponiveis.length ? '' : 'disabled'}>
            <option value="">${disponiveis.length ? 'Selecione a cotação adicional...' : 'Nenhuma outra cotação cadastrada'}</option>
            ${disponiveis.map(c => `<option value="${escRel(c.pedido)}">${escRel(c.pedido)}${c.origem ? ' — ' + escRel(c.origem) : ''}</option>`).join('')}
        </select> <button type="button" class="central-status-toggle" ${disponiveis.length ? '' : 'disabled'} onclick="adicionarCotacaoXml(document.getElementById('xml-cotacao-adicional-select').value)">+ Adicionar cotação</button>`;
        addBox.innerHTML = (chipsHTML ? `<div class="mt-2">${chipsHTML}</div>` : '') + `<div class="mt-3 cotacao-adicional-linha">${selHTML}</div>`;
    }

    // Não filtra por CNPJ aqui: depois que o usuário escolheu a cotação, ele
    // já resolveu a ambiguidade — mostrar só os itens do fornecedor "certo"
    // por CNPJ esconderia justamente os casos de CD/filial que motivaram
    // essa correção. Cada opção mostra o fornecedor pra escolha ficar clara.
    // Com mais de uma cotação (NF de dois pedidos), os itens de cada uma
    // carregam o próprio pedido (_pedido/_cotacao) pra achar o fornecedor
    // certo e pra montar um valor de opção sem ambiguidade quando o mesmo
    // código do SmartCompras existir em pedidos diferentes.
    const itensDaCotacao = [
        ...(cotacaoAtual ? (cotacaoAtual.itens || []).map(it => ({ ...it, _pedido: cotacaoAtual.pedido, _cotacao: cotacaoAtual })) : []),
        ...cotacoesAdicionaisObjs.flatMap(c => (c.itens || []).map(it => ({ ...it, _pedido: c.pedido, _cotacao: c })))
    ];

    // Uma única exibição do pedido escolhido: o valor já está no <select>
    // acima, então aqui só a legenda com como foi definido (item 6/7 desta
    // rodada — antes o pedido aparecia duas vezes na tela).
    if (captionEl) {
        if (!cotacaoAtual) {
            captionEl.textContent = '';
        } else {
            const origemTexto = pedidoOrigemXml === 'automatico' ? '✓ identificado automaticamente' : pedidoOrigemXml === 'manual' ? 'selecionado manualmente' : '';
            captionEl.textContent = [origemTexto, cotacaoAtual.origem ? `Destino: ${cotacaoAtual.origem}` : '', `${(cotacaoAtual.fornecedores || []).length} fornecedor(es)`].filter(Boolean).join(' · ');
        }
    }

    // Aviso de conflito de pedido: itens já associados apontam pra pedidos
    // diferentes — nunca escolhe sozinho, só avisa.
    // Já usado como cotação principal + adicional(is) automaticamente (ver
    // processarXmlTexto) — aqui é só o aviso do porquê, nunca uma pendência.
    const conflitoHTML = conflitoPedidoXmlInfo ? `<div class="xml-item-linha">
        <span>✓ <strong>Itens desta NF pertencem a ${conflitoPedidoXmlInfo.pedidos.length} pedidos</strong> (pelas associações já confirmadas) — todos adicionados abaixo:<br>${conflitoPedidoXmlInfo.pedidos.map(p => `Pedido ${escRel(p.pedido)}: ${p.itens.map(escRel).join(', ')}`).join('<br>')}<br>Pra usar só um, remova o(s) outro(s) na lista de cotações adicionais acima.</span>
    </div>` : '';

    // Fase 9: sugestão de pedido quando o CNPJ bate com mais de uma cotação
    // e o valor total da NF é compatível com uma (ou mais) delas — nunca
    // decide sozinho, sempre pede confirmação explícita.
    const sugestaoPedidoHTML = pedidoSugestaoXmlInfo ? `<div class="xml-item-linha pendente">
        <span>💡 <strong>Pedido ainda não identificado — CNPJ do fornecedor bate com mais de uma cotação.</strong> Sugestão por valor compatível (NF: R$ ${formatValorBR(pedidoSugestaoXmlInfo.valorNf)}):</span>
        ${pedidoSugestaoXmlInfo.candidatos.map(c => `<div class="xml-item-acao" style="margin-top:4px;">
            <button type="button" class="central-status-toggle" onclick="confirmarPedidoSugeridoXml('${escRel(c.pedido)}')">Confirmar Pedido ${escRel(c.pedido)}</button>
            <span class="xml-item-meta">cotado R$ ${formatValorBR(c.valorCotado)} (diferença ${(c.diffPercentual * 100).toFixed(1)}%)</span>
        </div>`).join('')}
    </div>` : '';

    // Cada item carrega seu índice original (pra atualizarFatorXml/
    // atualizarCProdXml, que dependem da posição real em itensXmlDetectados)
    // e seu status já calculado uma vez — reaproveitado tanto pro filtro
    // quanto pro resumo.
    const itensComStatus = itensXmlDetectados.map((item, idx) => ({ item, idx, status: statusItemXml(item) }));
    const totalPendentes = itensComStatus.filter(x => !x.status.pronto).length;

    // Filtro "somente pendências" (item 5 desta rodada): só aparece quando
    // existe pendência — não faz sentido oferecer o filtro numa NF 100%
    // pronta. Nunca altera itensXmlDetectados, só o que é renderizado.
    const filtroHTML = totalPendentes > 0 ? `<div class="xml-filtro-toggle">
        <button type="button" class="xml-filtro-btn ${filtroItensXml === 'pendencias' ? 'active' : ''}" onclick="alternarFiltroItensXml('pendencias')">Somente pendências (${totalPendentes})</button>
        <button type="button" class="xml-filtro-btn ${filtroItensXml === 'todos' ? 'active' : ''}" onclick="alternarFiltroItensXml('todos')">Todos os itens (${itensComStatus.length})</button>
    </div>` : '';

    const itensParaExibir = (totalPendentes > 0 && filtroItensXml === 'pendencias')
        ? itensComStatus.filter(x => !x.status.pronto)
        : itensComStatus;
    // Fase 33: a cada NF nova, abre sozinho o primeiro item com pendência (se houver); depois vale o que o usuário abrir/fechar.
    if (itemXmlNfInicializada !== nfeInfoAtual) {
        itemXmlNfInicializada = nfeInfoAtual;
        itensXmlAbertos = new Set(itensComStatus.filter(x => !x.status.pronto).map(x => x.idx)); // Fase 36: todo item com pendência já abre, pra preencher direto
    }

    // Prioriza os itens do fornecedor identificado por CNPJ (item 2/3 desta
    // rodada) — só como ORDEM/FILTRO PADRÃO da lista de seleção, nunca
    // escondendo definitivamente: o botão "mostrar outros fornecedores"
    // sempre revela o restante. Se a cotação não tiver nenhum item desse
    // fornecedor, mostra todos direto (não faz sentido restringir a zero).
    const validacaoFornecedorXml = validarFornecedorSpData(nfeInfoAtual.cnpjEmit);
    const cnpjsFornecedorIdentificado = validacaoFornecedorXml.encontrado
        ? [nfeInfoAtual.cnpjEmit, ...validacaoFornecedorXml.cnpjsRelacionados]
        : [nfeInfoAtual.cnpjEmit];
    const itensDoFornecedorIdentificado = itensDaCotacao.filter(it => cnpjEmLista(cnpjsFornecedorIdentificado, it.cnpjFornecedor));
    const restringeFornecedor = itensDoFornecedorIdentificado.length > 0 && itensDoFornecedorIdentificado.length < itensDaCotacao.length;
    const itensParaOpcoes = (restringeFornecedor && !mostrarOutrosFornecedoresXml) ? itensDoFornecedorIdentificado : itensDaCotacao;

    const linhasItens = itensParaExibir.map(({ item, idx, status }) => {
        const buscaAberta = associacaoFornecedorBuscaAberta.has(status.chave);
        let cotacaoSpDataHTML, acaoHTML = '';

        if (item.semCotacao) {
            const spDataDiretoHTML = renderAssociacaoSpDataWidget({ codProduto: status.chaveDireta, nomeOficial: item.xProd }, 'nf-' + status.chave);
            cotacaoSpDataHTML = `Sem cotação do SmartCompras (compra direta).${spDataDiretoHTML}`;
            acaoHTML = semCotacaoNfXml ? '' : `<button type="button" class="central-status-toggle" onclick="marcarItemSemCotacaoXml('${status.chave}', false)">Voltar a associar à cotação</button>`;
        } else if (!cotacaoAtual && !status.associacao) {
            cotacaoSpDataHTML = 'Selecione o pedido acima pra associar este item à cotação (ou marque "Esta NF não possui cotação do SmartCompras").';
        } else {
            const opcoesHTML = itensParaOpcoes.map(it => {
                const cotItem = it._cotacao || cotacaoAtual;
                const fornecedorIt = (cotItem.fornecedores || []).find(f => mesmoCnpj(f.cnpj, it.cnpjFornecedor));
                const nomeForn = fornecedorIt ? nomeExibicaoFornecedor(fornecedorIt.razaoSocial, fornecedorIt.cnpj) : (it.cnpjFornecedor || 'fornecedor não identificado');
                const detalhes = [it.fabricante && it.fabricante !== '---' ? it.fabricante : '', it.embalagem || '', it.quantidade ? `Qtd ${it.quantidade}` : ''].filter(Boolean).join(' · ');
                // Valor da opção: só carrega o pedido quando há mais de uma cotação
                // selecionada (evita ambiguidade se o mesmo código existir nas duas);
                // com uma cotação só, é idêntico a antes.
                const valorOpcao = multiPedido ? `${it._pedido}::${it.codProduto}` : it.codProduto;
                const rotuloPedido = multiPedido ? `[Pedido ${it._pedido}] ` : '';
                return `<option value="${escRel(valorOpcao)}">${rotuloPedido}${it.codProduto} — ${it.nomeOficial || it.descricao || 'sem nome'} (${nomeForn})${detalhes ? ' — ' + detalhes : ''}</option>`;
            }).join('');
            const buscaHTML = `<div class="central-spdata-busca" onclick="event.stopPropagation()">
                <input type="text" class="form-field" placeholder="Buscar por código ou nome..." oninput="filtrarOpcoesItemXml('${status.chave}', this.value)">
                <select class="form-field" id="assoc-forn-select-${status.chave}" size="6" onchange="confirmarSelecaoAssociacaoFornecedor('${status.chave}')">
                    <option value="">Selecione o item da cotação...</option>
                    <option value="${SEM_COTACAO_VALOR}">— Sem cotação do SmartCompras (compra direta) —</option>
                    ${opcoesHTML}
                </select>
                ${restringeFornecedor ? `<button type="button" class="central-status-toggle" onclick="alternarOutrosFornecedoresXml()">${mostrarOutrosFornecedoresXml ? 'Mostrar só do fornecedor identificado' : 'Mostrar itens de outros fornecedores'}</button>` : ''}
            </div>`;

            if (status.associacao) {
                // Fornecedor da cotação correspondente: SEMPRE derivado do item já
                // associado (cnpjFornecedor do próprio item na cotação) — nenhuma
                // associação/coleção nova, só leitura do que já existe. Busca em
                // TODAS as cotações (não só a selecionada): uma NF pode legitimamente
                // ter itens de pedidos diferentes (ver conflitoPedidoXmlInfo acima) —
                // achar o item numa cotação diferente da selecionada não é erro, só
                // precisa dizer isso claramente em vez de "não encontrado".
                // A própria associação pode carregar o pedido (gravado quando havia
                // mais de uma cotação selecionada) — usa ele pra achar a cotação certa
                // sem ambiguidade quando o mesmo código existe em pedidos diferentes.
                let cotacaoDoItem = status.associacao.pedido ? listaCotacoes.find(c => c.pedido === status.associacao.pedido) : cotacaoAtual;
                let itemCotacao = cotacaoDoItem ? (cotacaoDoItem.itens || []).find(it => it.codProduto === status.associacao.codigoSmartCompras) : null;
                if (!itemCotacao) {
                    for (const c of listaCotacoes) {
                        const achado = (c.itens || []).find(it => it.codProduto === status.associacao.codigoSmartCompras);
                        if (achado) { itemCotacao = achado; cotacaoDoItem = c; break; }
                    }
                }
                const pedidoDiferente = itemCotacao && cotacaoDoItem && !cotacoesSelecionadasXml().includes(cotacaoDoItem.pedido);
                const nomeItem = itemCotacao
                    ? (itemCotacao.nomeOficial || itemCotacao.descricao || status.associacao.codigoSmartCompras)
                    : `${status.associacao.codigoSmartCompras} (item não encontrado em nenhuma cotação cadastrada)`;
                const fornecedorCotacao = itemCotacao && cotacaoDoItem ? (cotacaoDoItem.fornecedores || []).find(f => mesmoCnpj(f.cnpj, itemCotacao.cnpjFornecedor)) : null;
                const nomeFornecedorCotacao = fornecedorCotacao ? nomeExibicaoFornecedor(fornecedorCotacao.razaoSocial, fornecedorCotacao.cnpj) : '';

                // SP Data direto na Entrada de NF (sem sair pra Cotações): reaproveita
                // o mesmo widget/associação já usados na Central do Pedido —
                // codigoSmartCompras → associacoesSpData, nenhuma estrutura nova.
                const spDataWidgetHTML = renderAssociacaoSpDataWidget(
                    { codProduto: status.associacao.codigoSmartCompras, nomeOficial: itemCotacao ? itemCotacao.nomeOficial : null },
                    'nf-' + status.chave
                );

                cotacaoSpDataHTML = `Cotação: ${nomeItem}${nomeFornecedorCotacao ? ` (${nomeFornecedorCotacao})` : ''}${pedidoDiferente ? ` <em style="color:var(--text-light);">(pedido ${cotacaoDoItem.pedido}, diferente do selecionado)</em>` : ''}${spDataWidgetHTML}`;
            } else {
                // Sugestão automática pelo nome do produto (o mesmo princípio já
                // usado pra sugerir o SP Data, ver buscarSugestoesSpData): o
                // texto do XML (xProd) quase sempre já traz o princípio ativo,
                // então dá pra sugerir direto, sem abrir a lista — só quando o
                // nome bate com folga (todas as palavras), nunca por
                // aproximação/edição de texto. Continua sendo uma SUGESTÃO: o
                // usuário confirma com um toque, ou ignora e busca manualmente.
                const sugestoesCotacao = item.xProd ? buscarSugestoesCotacao(item.xProd, itensParaOpcoes) : [];
                if (sugestoesCotacao.length > 0 && sugestoesCotacao.length <= 4) {
                    const sugestoesHTML = sugestoesCotacao.map(it => {
                        const cotItem = it._cotacao || cotacaoAtual;
                        const fornecedorIt = (cotItem.fornecedores || []).find(f => mesmoCnpj(f.cnpj, it.cnpjFornecedor));
                        const nomeForn = fornecedorIt ? nomeExibicaoFornecedor(fornecedorIt.razaoSocial, fornecedorIt.cnpj) : '';
                        const valorOpcao = multiPedido ? `${it._pedido}::${it.codProduto}` : it.codProduto;
                        return `<button type="button" class="central-status-toggle" onclick="event.stopPropagation(); confirmarSelecaoDireta('${status.chave}', '${escRel(valorOpcao)}')">Usar: ${it.codProduto} — ${escRel(it.nomeOficial || it.descricao)}${nomeForn ? ` (${escRel(nomeForn)})` : ''}</button>`;
                    }).join('');
                    cotacaoSpDataHTML = `Não associado à cotação. Sugestão pelo nome:<div class="xml-item-acao" style="margin-top:4px;">${sugestoesHTML}</div>`;
                } else {
                    cotacaoSpDataHTML = 'Não associado à cotação.';
                }
            }

            acaoHTML = `<button type="button" class="central-status-toggle" onclick="toggleCorrecaoAssociacaoFornecedor('${status.chave}')">${buscaAberta ? 'Cancelar' : (status.associacao ? 'Corrigir cotação' : 'Associar à cotação')}</button>${buscaAberta ? buscaHTML : ''}`;
        }

        // Item unificado: produto + código do fornecedor + conversão (fator/
        // quantidade) + cotação/SP Data + estado, tudo num único bloco — não
        // precisa mais comparar duas listas separadas pra entender um item.
        const codigoSaidaDiferente = item.cProdNovo && item.cProdNovo !== item.cProd;
        const recursoHTML = htmlRecursoItemXml(item, idx, status);
        // Fase 33: cabeçalho sempre visível (nome · cód · quantidade · estado) e o resto recolhível;
        // itens com pendência já nascem abertos (Fase 36). Todo o conteúdo antigo continua igual, só que dentro do corpo.
        const abertoXml = itensXmlAbertos.has(idx);
        const qtdResumo = `${item.qComOriginal}${item.uComEl && item.uComEl.textContent ? ' ' + escRel(item.uComEl.textContent) : ''}`;
        return `<div class="xml-item-linha xml-item-colapsavel ${status.pronto ? '' : 'pendente'} ${abertoXml ? 'aberto' : ''}" data-xml-idx="${idx}">
            <button type="button" class="xml-item-resumo" onclick="alternarItemXmlAberto(${idx})" aria-expanded="${abertoXml}">
                <span class="xml-item-resumo-texto"><span class="xml-item-resumo-nome">${escRel(item.xProd)}</span><span class="xml-item-resumo-sub">Cód. ${escRel(item.cProdNovo || item.cProd)} · ${qtdResumo}${codigoSaidaDiferente ? ' · saída ' + escRel(item.cProdNovo) : ''}</span></span>
                <span class="xml-item-badge ${status.pronto ? 'pronto' : 'pendente'}">${status.pronto ? '✓ Pronto' : escRel(status.motivos[0] || 'Pendente')}${(!status.pronto && status.motivos.length > 1) ? ' +' + (status.motivos.length - 1) : ''}</span>
                <i class="fa-solid fa-chevron-down xml-item-seta"></i>
            </button>
            <div class="xml-item-corpo"><div class="xml-item-corpo-int">
            <div class="xml-item-topo">
                <div>
                    <div class="xml-produto-nome">${item.xProd}${item.deExcecao ? ' <span class="badge-excecao">lembrado</span>' : ''}${item.deFatorFixo ? ' <span class="badge-excecao">fator fixo do produto</span>' : ''}</div>
                    <div class="xml-item-meta">Cód. fornecedor: <input type="text" class="cprod-input" value="${item.cProdNovo || item.cProd}" onchange="atualizarCProdXml(${idx}, this.value)">${item.ncm ? ` · NCM ${escRel(item.ncm)}` : ''}</div>
                    ${codigoSaidaDiferente ? `<div class="xml-item-meta">Original: <strong>${escRel(item.cProd)}</strong> → Saída: <strong>${escRel(item.cProdNovo)}</strong>${item.possibilidadeEscolhida && item.possibilidadeEscolhida.produtoNome ? ' (' + escRel(item.possibilidadeEscolhida.produtoNome) + ')' : ''}</div>` : ''}
                </div>
                <span class="xml-item-badge ${status.pronto ? 'pronto' : 'pendente'}">${status.pronto ? '✓ Pronto' : status.motivos.join(' · ')}</span>
            </div>
            <div class="xml-item-conversao">
                Fator: <input type="number" min="1" class="fator-input ${item.suspeito ? 'suspeito' : ''}" value="${item.fator}" onchange="atualizarFatorXml(${idx}, this.value)">
                ${item.suspeito ? `<button type="button" class="central-status-toggle" onclick="confirmarFatorXml(${idx})">✓ Confirmar fator</button>` : ''}
                <span class="xml-preview-linha">${formatarPreviewXml(item)}</span>
            </div>
            <div class="xml-item-cotacao">${cotacaoSpDataHTML}</div>
            ${acaoHTML ? `<div class="xml-item-acao">${acaoHTML}</div>` : ''}
            ${recursoHTML ? `<div class="xml-item-cotacao">${recursoHTML}</div>` : ''}
            ${htmlLoteXml(item, idx)}
            ${item.semCotacao ? renderReaproveitamentoCodigoXml(item, idx) : renderPainelAssociacoesConhecidasXml(item, idx)}
            </div></div>
        </div>`;
    }).join('');

    container.innerHTML = avisoSemCotacoesHTML + conflitoHTML + sugestaoPedidoHTML + filtroHTML + linhasItens;
    renderResumoPendenciasXml();
    renderResumoCodigosXml();
    renderResultadoSalvarNF(); // conferência ao vivo, antes de salvar
}

// ============================================================
// SUBSTITUIÇÃO CONTROLADA DE CÓDIGO (Editor XML — base de histórico)
// ============================================================
// Painel "Associações conhecidas": mostra, por item, o que o histórico já
// existente (consultarAssociacoesConhecidasParaXml) sabe sobre esse
// fornecedor/código — nunca decide sozinho, só apresenta pro usuário
// escolher. "atual: true" numa possibilidade só indica que ela é a vigente
// hoje na estrutura histórica correspondente, não que é "o produto certo".
function renderPainelAssociacoesConhecidasXml(item, idx) {
    const info = item.associacoesConhecidas;
    if (!info) return '';
    const reusoHTML = renderReaproveitamentoCodigoXml(item, idx);
    const cnpjAtualNf = nfeInfoAtual ? nfeInfoAtual.cnpjEmit : null;

    if (!info.temAssociacaoConhecida) {
        return `<div class="xml-item-cotacao" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border-color);">
            <span class="xml-item-badge neutro">Nenhuma associação encontrada</span>
            <div class="nota-detalhes" style="margin-top:4px;">Nenhum histórico ainda pra este fornecedor/código. O código original é mantido — edite o campo "Cód. fornecedor" acima se quiser informar outro manualmente.</div>
        </div>${reusoHTML}`;
    }

    const situacaoTexto = info.possibilidades.length === 1 ? 'Associação conhecida' : `Mais de uma associação encontrada (${info.possibilidades.length})`;
    const situacaoClasse = info.possibilidades.length === 1 ? 'pronto' : 'pendente';
    // Recolhido por padrão — a lista tende a crescer, e a maior parte do
    // tempo o resumo (badge) já basta; só expande quem quiser conferir.
    const chaveHistorico = `${nfeInfoAtual ? nfeInfoAtual.cnpjEmit : ''}::${item.cProd}`;
    const aberto = historicoAssociacaoAbertoXml.has(chaveHistorico);

    const alvoReferencia = spDataAlvoReaproveitamentoXml(item);
    const possibilidadesHTML = info.possibilidades.map((p, pIdx) => {
        const foraDoCnpjAtual = cnpjAtualNf && !p.cnpjsQueConfirmaram.includes(cnpjAtualNf);
        const selecionada = !!p.spDataCodigo && p.spDataCodigo === alvoReferencia;
        const nfsTexto = p.ocorrencias.filter(o => o.nfNumero).map(o => o.nfNumero);
        const nfsUnicas = [...new Set(nfsTexto)].slice(0, 5);
        const detalhes = [
            `Confirmada ${p.vezesConfirmada}x`,
            p.primeiraConfirmacaoEm ? `desde ${formatarDataCompletaBR(p.primeiraConfirmacaoEm)}` : '',
            (p.ultimaConfirmacaoEm && p.ultimaConfirmacaoEm !== p.primeiraConfirmacaoEm) ? `última em ${formatarDataCompletaBR(p.ultimaConfirmacaoEm)}` : '',
            p.atual ? 'vigente hoje' : 'substituída depois por outra associação',
            foraDoCnpjAtual ? `encontrada no CNPJ ${p.cnpjsQueConfirmaram.join(', ')} da mesma entidade` : '',
            nfsUnicas.length ? `NF(s): ${nfsUnicas.join(', ')}` : ''
        ].filter(Boolean).join(' · ');

        return `<div class="xml-item-linha" style="margin-top:6px;">
            <div class="xml-item-topo">
                <div>
                    <div class="xml-produto-nome">${p.spDataCodigo ? `SP Data ${escRel(p.spDataCodigo)}` : `SmartCompras ${escRel(p.codigoSmartCompras)} (sem código SP Data ainda)`}${p.produtoNome ? ' — ' + escRel(p.produtoNome) : ''}</div>
                    <div class="xml-item-meta">${detalhes}</div>
                </div>
                ${selecionada ? '<span class="xml-item-badge pronto">✓ Produto de referência</span>' : ''}
            </div>
            <div class="xml-item-acao">
                ${p.spDataCodigo
                    ? `<button type="button" class="central-status-toggle" onclick="aplicarPossibilidadeConhecidaXml(${idx}, ${pIdx})">${selecionada ? 'Produto de referência ✓' : 'Ver códigos deste produto'}</button>`
                    : `<span class="nota-detalhes"><em>Sem código SP Data confirmado ainda — não há como buscar códigos de fornecedor para este produto.</em></span>`}
                ${!p.atual ? `<button type="button" class="link-discreto" onclick="excluirPossibilidadeConhecidaXml(${idx}, ${pIdx})">Excluir do histórico</button>` : ''}
            </div>
        </div>`;
    }).join('');

    return `<div class="xml-item-cotacao" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border-color);">
        <div class="xml-item-acao" onclick="toggleHistoricoAssociacaoXml('${escRel(chaveHistorico)}')" style="cursor:pointer;">
            <span class="xml-item-badge ${situacaoClasse}">${situacaoTexto}</span>
            <button type="button" class="central-status-toggle">${aberto ? 'Recolher' : 'Ver histórico'}</button>
        </div>
        ${aberto ? `${possibilidadesHTML}
        <div class="xml-item-acao" style="margin-top:6px;">
            <button type="button" class="central-status-toggle" onclick="manterCodigoOriginalXml(${idx})">${item.decisaoTomada === 'mantido_original' ? '✓ Mantendo código original' : 'Manter código original'}</button>
        </div>` : ''}
    </div>${reusoHTML}`;
}
function toggleHistoricoAssociacaoXml(chave) {
    if (historicoAssociacaoAbertoXml.has(chave)) historicoAssociacaoAbertoXml.delete(chave);
    else historicoAssociacaoAbertoXml.add(chave);
    renderAssociacaoCotacaoXml();
}
// Remove uma possibilidade do histórico (nunca a vigente hoje — pra corrigir
// a vigente, use "Corrigir cotação"/"Corrigir SP Data" normalmente, que já
// registra uma nova entrada sem apagar nada). Útil quando o histórico
// acumula tentativas erradas/duplicadas que só atrapalham a leitura depois.
// Fase 30.1: cada possibilidade é um par (produto SmartCompras × SP Data) e fica "antiga" por um de dois motivos — e o que se apaga
// depende disso, pra nunca levar junto a entrada que dá a data de vigência da associação ATUAL:
//  • o SmartCompras já não é o vigente deste código de fornecedor  -> apaga só as entradas desse SmartCompras no histórico DESTE código;
//  • o SmartCompras é o vigente, mas o SP Data daquele par foi corrigido depois -> apaga só essa entrada antiga do SP Data no histórico
//    do produto SmartCompras (vale pra todos os fornecedores que usam esse produto — o aviso do modal diz isso).
async function excluirPossibilidadeConhecidaXml(idx, possibilidadeIdx) {
    const item = itensXmlDetectados[idx];
    if (!item || !item.associacoesConhecidas || !nfeInfoAtual) return;
    const p = item.associacoesConhecidas.possibilidades[possibilidadeIdx];
    if (!p || p.atual) return;
    const cnpjsFornecedorAntigo = [...new Set(p.ocorrencias.filter(o => !o.atualParaFornecedor).map(o => o.cnpjFornecedor))];
    const apagaSpData = !!p.spDataCodigo && p.ocorrencias.some(o => o.atualParaFornecedor && !o.atualParaSpData);
    if (!cnpjsFornecedorAntigo.length && !apagaSpData) return;
    const partes = [];
    if (cnpjsFornecedorAntigo.length) partes.push(`Remove "SmartCompras ${p.codigoSmartCompras}" do histórico deste código de fornecedor (já não é a associação vigente).`);
    if (apagaSpData) partes.push(`Remove "SP Data ${p.spDataCodigo}"${p.produtoNome ? ' — ' + p.produtoNome : ''} do histórico do produto SmartCompras ${p.codigoSmartCompras}. Isso vale para todos os fornecedores que usam esse produto.`);
    showConfirmModal({
        title: 'Excluir do histórico?',
        message: `${partes.join(' ')} A associação vigente hoje não muda e a data em que ela passou a valer é preservada.`,
        confirmText: 'Excluir',
        confirmClass: 'danger',
        onConfirm: async () => {
            try {
                for (const cnpj of cnpjsFornecedorAntigo) {
                    const chave = chaveAssociacaoFornecedor(cnpj, item.cProd);
                    const doc = bancoAssociacoesFornecedor[chave];
                    if (!doc || !doc.historico || doc.codigoSmartCompras === p.codigoSmartCompras) continue; // nunca o vigente
                    const novoHistorico = doc.historico.filter(h => h.codigoSmartCompras !== p.codigoSmartCompras);
                    if (novoHistorico.length === doc.historico.length) continue;
                    await associacoesFornecedorCollection.doc(chave).update({ historico: novoHistorico });
                    bancoAssociacoesFornecedor[chave] = { ...doc, historico: novoHistorico };
                }
                if (apagaSpData) {
                    const assoc = listaAssociacoesSpData.find(a => a.codigoSmartCompras === p.codigoSmartCompras);
                    if (assoc && assoc.spDataCodigo !== p.spDataCodigo && assoc.historico) {
                        const novoHistoricoSp = assoc.historico.filter(h => h.spDataCodigo !== p.spDataCodigo);
                        if (novoHistoricoSp.length !== assoc.historico.length) {
                            await associacoesSpDataCollection.doc(assoc.codigoSmartCompras).update({ historico: novoHistoricoSp });
                            assoc.historico = novoHistoricoSp;
                        }
                    }
                }
                item.associacoesConhecidas = consultarAssociacoesConhecidasParaXml(nfeInfoAtual.cnpjEmit, item.cProd);
                toast('✓ Removido do histórico.');
                renderAssociacaoCotacaoXml();
            } catch (e) {
                console.error('Erro ao excluir do histórico:', e);
                toast('✕ Erro ao excluir. Tente novamente.');
            }
        }
    });
}

// Fase 30: escolher uma possibilidade do histórico define só o PRODUTO DE
// REFERÊNCIA (o SP Data) usado pra buscar os códigos de fornecedor já
// associados a ele (renderReaproveitamentoCodigoXml). O código SP Data NUNCA
// vai pro cProd de saída — quem preenche cProdNovo é
// usarCodigoFornecedorReaproveitadoXml, com o código do FORNECEDOR escolhido.
// Nada é gravado em associacoesFornecedor/associacoesSpData.
function aplicarPossibilidadeConhecidaXml(idx, possibilidadeIdx) {
    const item = itensXmlDetectados[idx];
    if (!item || !item.associacoesConhecidas) return;
    const possibilidade = item.associacoesConhecidas.possibilidades[possibilidadeIdx];
    if (!possibilidade) return;
    if (!possibilidade.spDataCodigo) return toast('Essa possibilidade ainda não tem código SP Data — não há como buscar códigos de fornecedor para ela.');
    item.spDataReferenciaXml = possibilidade.spDataCodigo;
    renderAssociacaoCotacaoXml();
    toast(`Produto de referência: SP Data ${possibilidade.spDataCodigo}. O código do item (${item.cProd}) não foi alterado.`);
}


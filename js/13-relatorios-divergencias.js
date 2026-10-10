// 13-relatorios-divergencias.js — Divergências e análise das cotações
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// --- Divergências (cards em acordeão) ---
let contadorMaterialId = 0;
function adicionarDivergencia() {
    divergenciasAuditoria.forEach(d => d.aberto = false);
    divergenciasAuditoria.push({ id: ++contadorDivergenciaId, tipo: '', aberto: true, materiais: [], observacao: '', campos: {} });
    renderDivergenciasAuditoria();
}
function removerDivergencia(id) {
    divergenciasAuditoria = divergenciasAuditoria.filter(d => d.id !== id);
    renderDivergenciasAuditoria();
}
function toggleDivergencia(id) {
    const d = divergenciasAuditoria.find(d => d.id === id);
    d.aberto = !d.aberto;
    renderDivergenciasAuditoria();
}
function mudarTipoDivergencia(id, tipo) {
    const d = divergenciasAuditoria.find(d => d.id === id);
    d.tipo = tipo;
    d.campos = {};
    d.observacao = '';
    const def = TIPOS_DIVERGENCIA_AUDITORIA[tipo];
    d.materiais = (def && def.multiMaterial) ? [{ id: ++contadorMaterialId, campos: {} }] : [];
    renderDivergenciasAuditoria();
}
// Campos de ocorrência única (só usado por tipos com multiMaterial:false,
// ex: "Fornecedor não entregou o pedido" — não faz sentido por material).
function atualizarCampoDivergencia(id, key, valor, maiusculo) {
    const d = divergenciasAuditoria.find(d => d.id === id);
    d.campos[key] = maiusculo ? upAud(valor) : valor;
}
function atualizarObservacaoOcorrencia(id, valor) {
    const d = divergenciasAuditoria.find(d => d.id === id);
    d.observacao = valor;
}

// --- Materiais dentro de uma mesma ocorrência de divergência ---
function adicionarMaterialDivergencia(divergenciaId) {
    const d = divergenciasAuditoria.find(d => d.id === divergenciaId);
    if (!d) return;
    d.materiais.push({ id: ++contadorMaterialId, campos: {} });
    renderDivergenciasAuditoria();
}
function removerMaterialDivergencia(divergenciaId, materialId) {
    const d = divergenciasAuditoria.find(d => d.id === divergenciaId);
    if (!d) return;
    d.materiais = d.materiais.filter(m => m.id !== materialId);
    renderDivergenciasAuditoria();
}
function atualizarCampoMaterial(divergenciaId, materialId, key, valor, maiusculo) {
    const d = divergenciasAuditoria.find(d => d.id === divergenciaId);
    if (!d) return;
    const m = d.materiais.find(m => m.id === materialId);
    if (!m) return;
    m.campos[key] = maiusculo ? upAud(valor) : valor;

    // Item 12: se o produto digitado bate com um item da cotação encontrada
    // pro pedido, preenche a quantidade automaticamente — só se o campo
    // ainda estiver vazio, pra nunca sobrescrever uma correção manual.
    if (key === 'produto' || key === 'produtoPedido') {
        preencherQuantidadeDaCotacao(m, valor);
        renderDivergenciasAuditoria();
    }
}
function preencherQuantidadeDaCotacao(material, nomeProduto) {
    if (!cotacaoEncontradaAuditoria || material.campos.quantidade) return;
    const alvo = upAud(nomeProduto).trim();
    if (!alvo) return;
    const item = (cotacaoEncontradaAuditoria.itens || []).find(it => upAud(nomeConhecidoItemCotacao(it)) === alvo);
    if (item && item.quantidade) material.campos.quantidade = item.quantidade;
}
function renderDivergenciasAuditoria() {
    const container = document.getElementById('lista-divergencias');
    if (divergenciasAuditoria.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhuma divergência adicionada ainda.</div>';
        return;
    }
    container.innerHTML = divergenciasAuditoria.map((d, idx) => {
        const def = TIPOS_DIVERGENCIA_AUDITORIA[d.tipo];
        const primeiroProduto = def && d.materiais && d.materiais[0] ? (d.materiais[0].campos.produto || d.materiais[0].campos.produtoFaturado) : (d.campos && (d.campos.produto || d.campos.fornecedorNome));
        const sufixoQtd = def && d.materiais && d.materiais.length > 1 ? ` (+${d.materiais.length - 1})` : '';
        const tituloTexto = def
            ? `${def.label}${primeiroProduto ? ' — ' + upAud(primeiroProduto) + sufixoQtd : ''}`
            : '<span style="color:var(--text-light);font-weight:400;">Selecione o tipo...</span>';
        const opcoesTipo = Object.entries(TIPOS_DIVERGENCIA_AUDITORIA).map(([key, val]) =>
            `<option value="${key}" ${d.tipo === key ? 'selected' : ''}>${val.label}</option>`).join('');

        const renderCampo = (c, valor, onBlurAttr) => {
            const listaAttr = (c.key === 'produto' || c.key === 'produtoPedido' || c.key === 'produtoFaturado') ? ' list="datalist-produtos-cotacao"' : '';
            const labelTexto = c.obrigatorio ? `${c.label} *` : c.label;
            if (c.textarea) {
                return `<div class="campo"><label>${labelTexto}</label><textarea class="form-field" ${onBlurAttr}>${valor}</textarea></div>`;
            }
            return `<div class="campo"><label>${labelTexto}</label><input type="text" class="form-field ${c.maiusculo ? 'uppercase-field' : ''}" placeholder="${c.placeholder || ''}" value="${valor}"${listaAttr} ${onBlurAttr}></div>`;
        };

        let corpoCampos = '';
        if (def && def.multiMaterial) {
            const materiaisHTML = (d.materiais || []).map((m, midx) => {
                const camposMaterial = def.campos.map(c => {
                    const valor = m.campos[c.key] || '';
                    const onBlurAttr = `onblur="atualizarCampoMaterial(${d.id}, ${m.id}, '${c.key}', this.value, ${!!c.maiusculo})"`;
                    return renderCampo(c, valor, onBlurAttr);
                }).join('');
                return `<div class="material-divergencia">
                    <div class="material-divergencia-header">
                        <span>Material ${midx + 1}</span>
                        ${d.materiais.length > 1 ? `<button type="button" class="divergencia-del" onclick="removerMaterialDivergencia(${d.id}, ${m.id})"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </div>
                    ${camposMaterial}
                </div>`;
            }).join('');
            corpoCampos = `${materiaisHTML}
                <div class="actions-row"><button type="button" class="actions-button is-neutral" onclick="adicionarMaterialDivergencia(${d.id})"><span class="icon-wrapper"><i class="fa-solid fa-plus"></i></span> Adicionar Material</button></div>
                <div class="campo"><label>Observação da Ocorrência (opcional)</label><textarea class="form-field" onblur="atualizarObservacaoOcorrencia(${d.id}, this.value)">${d.observacao || ''}</textarea></div>`;
        } else if (def) {
            corpoCampos = def.campos.map(c => {
                const valor = d.campos[c.key] || '';
                const onBlurAttr = `onblur="atualizarCampoDivergencia(${d.id}, '${c.key}', this.value, ${!!c.maiusculo})"`;
                return renderCampo(c, valor, onBlurAttr);
            }).join('');
        }

        return `
        <div class="divergencia ${d.aberto ? 'open' : ''}">
            <div class="divergencia-header" onclick="toggleDivergencia(${d.id})">
                <div class="divergencia-num">${idx + 1}</div>
                <div class="divergencia-titulo">${tituloTexto}</div>
                <i class="fa-solid fa-chevron-down divergencia-chevron"></i>
                <button type="button" class="divergencia-del" onclick="event.stopPropagation(); removerDivergencia(${d.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="divergencia-body">
                <div class="divergencia-body-inner">
                    <div class="campo">
                        <label>Tipo de Divergência</label>
                        <select class="form-field" onchange="mudarTipoDivergencia(${d.id}, this.value)" onclick="event.stopPropagation()">
                            <option value="">Selecione...</option>${opcoesTipo}
                        </select>
                    </div>
                    ${corpoCampos}
                </div>
            </div>
        </div>`;
    }).join('');

    // Correção do bug em que uma divergência com muitos materiais ficava
    // cortada: a animação de abrir/fechar usa max-height no CSS, mas um
    // valor fixo nunca acompanha corretamente uma lista de materiais que
    // cresce (Adicionar Material) ou encolhe (Remover Material). Aqui,
    // depois de desenhar, cada divergência aberta recebe o max-height do seu
    // próprio tamanho real (scrollHeight) — funciona com qualquer
    // quantidade de materiais, sem depender de adivinhar um teto.
    requestAnimationFrame(() => {
        container.querySelectorAll('.divergencia.open .divergencia-body').forEach(el => {
            el.style.maxHeight = el.scrollHeight + 'px';
        });
    });
}

// ============================================================
// COTAÇÕES — Fase 3: cadastro manual (Pedido, Origem, datas e
// fornecedores). Doc id no Firestore = o próprio número do pedido, pra
// permitir buscar por pedido sem query (útil na Fase 5, quando a Auditoria
// vai consultar isso automaticamente). O array `itens` fica reservado —
// ainda vazio nesta fase — pra ser populado pela importação do XML do
// SmartCompras na Fase 4, sem precisar migrar o formato do documento.
// ============================================================


let filtroCotacoesTexto = '';
let ordenacaoCotacoes = 'entrada'; // 'entrada' (padrão, mais recente primeiro) ou 'pedido' (numérico)

function filtrarCotacoes(texto) {
    filtroCotacoesTexto = texto;
    renderListaCotacoes();
}
function alternarOrdenacaoCotacoes(valor) {
    ordenacaoCotacoes = valor;
    renderListaCotacoes();
}

// Cotação "bate" na pesquisa se o termo aparecer em qualquer um dos campos
// estruturados de identificação do produto já existentes em cotacao.itens.
// Retorna os itens correspondentes (não só um booleano) porque o resultado
// da pesquisa passou a mostrar o item encontrado diretamente, não só a
// cotação. Busca 100% local em listaCotacoes — sem consulta ao Firestore a
// cada tecla, sem fuzzy matching, só correspondência textual parcial.
function itensCorrespondentesCotacao(cotacao, termo) {
    return (cotacao.itens || []).filter(it =>
        (it.nomeOficial || '').toUpperCase().includes(termo) ||
        (it.descricao || '').toUpperCase().includes(termo) ||
        (it.fabricante || '').toUpperCase().includes(termo) ||
        (it.embalagem || '').toUpperCase().includes(termo) ||
        (it.codProduto || '').toUpperCase().includes(termo)
    );
}

// Fase 34: resumo de entrega do pedido (quantos fornecedores completos/parciais/aguardando).
// Só leitura: usa as mesmas funções do card do fornecedor na Central (Fase 31). Nunca quebra a lista.
function resumoEntregaCotacao(c) {
    const r = { completa: 0, parcial: 0, erp: 0, aguardando: 0, divergencias: 0, total: 0 };
    try {
        const fornecedores = c.fornecedores || [];
        if (!fornecedores.length || !(c.itens || []).length) return r;
        const comp = compararFontesPedido(c.pedido);
        r.divergencias = comp.filter(x => x.divergencias.some(d => d.tipo !== 'nao_faturado') && !x.resolvido).length; // Fase 36: "não faturado" já aparece como entrega parcial
        fornecedores.forEach(f => {
            const compForn = comp.filter(x => normalizarCnpj(x.cnpjFornecedor) === normalizarCnpj(f.cnpj));
            const e = calcularEntregaFornecedorPedido(c.pedido, f, compForn);
            if (!e || !e.total) return;
            r.total++;
            if (e.estado === 'completa') r.completa++;
            else if (e.estado === 'parcial') r.parcial++;
            else if (e.estado === 'erp_sem_itens') r.erp++;
            else r.aguardando++;
        });
    } catch (err) { console.warn('resumoEntregaCotacao', err); }
    return r;
}
function chipsResumoEntrega(r) {
    const chip = (classe, txt) => `<span class="xml-item-badge ${classe}">${txt}</span>`;
    return [
        r.completa ? chip('pronto', `✓ ${r.completa} completa${r.completa === 1 ? '' : 's'}`) : '',
        r.parcial ? chip('pendente', `◐ ${r.parcial} parcial${r.parcial === 1 ? '' : 'is'}`) : '',
        r.erp ? chip('neutro', `◐ ${r.erp} NF no ERP`) : '',
        r.aguardando ? chip('neutro', `○ ${r.aguardando} aguardando`) : '',
        r.divergencias ? chip('pendente', `${r.divergencias} divergência${r.divergencias === 1 ? '' : 's'}`) : ''
    ].filter(Boolean).join('');
}
function renderCardCotacao(c) {
    const qtdFornecedores = (c.fornecedores || []).length;
    const dataLimite = c.dataLimite ? formatarDataBRSimples(c.dataLimite) : '';
    const chips = chipsResumoEntrega(resumoEntregaCotacao(c));
    return `<div class="nota-item" onclick="abrirCentralPedido('${c.pedido}')">
        <div class="nota-info">${c.pedido}${c.origem ? ' · ' + c.origem : ''}</div>
        <div class="nota-sub">${qtdFornecedores} fornecedor${qtdFornecedores === 1 ? '' : 'es'}${dataLimite ? ' · limite ' + dataLimite : ''}</div>
        ${chips ? `<div class="nota-chips">${chips}</div>` : ''}
    </div>`;
}

// Resultado de pesquisa por produto: mostra o ITEM encontrado com o contexto
// necessário (pedido + fornecedor), não só "esta cotação contém algo" — é o
// que permite responder direto "em quais pedidos esse produto aparece e com
// qual fornecedor", sem abrir fornecedor por fornecedor manualmente. Se o
// mesmo produto aparecer com mais de um fornecedor na cotação, cada um vira
// uma linha separada (um por item correspondente).
function renderCardResultadoItem(cotacao, item) {
    const fornecedor = (cotacao.fornecedores || []).find(f => mesmoCnpj(f.cnpj, item.cnpjFornecedor));
    const nomeProduto = item.nomeOficial ? upAud(item.nomeOficial) : (item.descricao ? upAud(item.descricao) : 'Produto sem nome identificado');
    const nomeFornecedor = fornecedor ? nomeExibicaoFornecedor(fornecedor.razaoSocial, fornecedor.cnpj) : (item.cnpjFornecedor || 'Fornecedor não identificado');
    const associacao = item.codProduto ? listaAssociacoesSpData.find(a => a.codigoSmartCompras === item.codProduto) : null;
    const produtoSpData = associacao ? listaProdutosSpData.find(p => p.codigo === associacao.spDataCodigo) : null;
    const detalhes = [
        item.codProduto ? `Cód. SmartCompras ${item.codProduto}` : '',
        item.fabricante && item.fabricante !== '---' ? item.fabricante : '',
        item.embalagem ? item.embalagem : '',
        item.quantidade ? `Qtd ${item.quantidade}` : '',
        item.precoUnitario ? `R$ ${item.precoUnitario}` : '',
        produtoSpData ? `SP Data ${produtoSpData.codigo}` : ''
    ].filter(Boolean).join(' · ');
    return `<div class="nota-item" onclick="abrirCentralPedido('${cotacao.pedido}')">
        <div class="nota-info">${nomeProduto}</div>
        <div class="nota-detalhes">Pedido ${cotacao.pedido}${cotacao.origem ? ' - ' + cotacao.origem : ''} · ${nomeFornecedor}${detalhes ? ' · ' + detalhes : ''}</div>
    </div>`;
}

function ordenarCotacoes(lista) {
    // 'entrada' já vem nessa ordem da query (orderBy atualizadoEm desc, ver
    // listener); só precisa reordenar explicitamente pro modo 'pedido'.
    if (ordenacaoCotacoes !== 'pedido') return lista;
    return [...lista].sort((a, b) => {
        const na = parseInt(a.pedido, 10), nb = parseInt(b.pedido, 10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
        return a.pedido.localeCompare(b.pedido);
    });
}

function renderListaCotacoes() {
    const container = document.getElementById('lista-cotacoes-container');
    if (!container) return;

    const termo = filtroCotacoesTexto.trim().toUpperCase();
    const lista = ordenarCotacoes(listaCotacoes);

    if (!termo) {
        if (lista.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhuma cotação cadastrada ainda.</div>';
            return;
        }
        container.innerHTML = lista.map(renderCardCotacao).join('');
        return;
    }

    // Com termo preenchido: pedido/origem/fornecedor continuam mostrando a
    // cotação inteira (como sempre foi); um match por produto mostra os
    // itens encontrados diretamente, com pedido e fornecedor no contexto.
    const blocos = [];
    lista.forEach(c => {
        const nomesFornecedores = (c.fornecedores || []).map(f => (f.razaoSocial || '').toUpperCase()).join(' ');
        const matchDireto = c.pedido.toUpperCase().includes(termo) || (c.origem || '').toUpperCase().includes(termo) || nomesFornecedores.includes(termo);
        const itensMatch = itensCorrespondentesCotacao(c, termo);
        if (itensMatch.length > 0) {
            itensMatch.forEach(it => blocos.push(renderCardResultadoItem(c, it)));
        } else if (matchDireto) {
            blocos.push(renderCardCotacao(c));
        }
    });

    container.innerHTML = blocos.length ? blocos.join('') : '<div class="empty-state">Nenhuma cotação encontrada.</div>';
}


function formatarDataBRSimples(iso) {
    if (!iso) return '';
    const partes = iso.split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}` : iso;
}

let origemTelaCotacaoEditor = 'screen-cotacoes'; // pra onde "Voltar"/fechar deve levar ao sair de screen-cotacao-editor

function abrirNovaCotacao() {
    // "Nova Cotação" é acionada tanto da lista de Cotações quanto de dentro
    // da Central (quando o pedido ainda não tem cotação cadastrada) — o
    // botão de voltar precisa saber pra qual das duas telas retornar.
    const telaAtiva = document.querySelector('.app-screen.active');
    origemTelaCotacaoEditor = (telaAtiva && telaAtiva.id === 'screen-central-pedido') ? 'screen-central-pedido' : 'screen-cotacoes';
    cotacaoEmEdicaoPedido = null;
    fornecedoresCotacaoAtual = [];
    contadorFornecedorCotacaoId = 0;
    document.getElementById('cot-pedido').value = '';
    document.getElementById('cot-pedido').disabled = false;
    document.getElementById('cot-origem').value = '';
    document.getElementById('cot-data-pedido').value = new Date().toISOString().slice(0, 10);
    document.getElementById('cot-data-limite').value = '';
    document.getElementById('cot-observacao').value = '';
    document.getElementById('btn-excluir-cotacao').style.display = 'none';
    renderFornecedoresCotacao();
    switchToScreen('screen-cotacao-editor', 'Nova Cotação');
}

async function abrirCotacaoParaEdicao(pedido) {
    origemTelaCotacaoEditor = 'screen-central-pedido';
    let c = listaCotacoes.find(c => c.pedido === pedido);
    if (!c) {
        // Fallback pra quando o listener em tempo real ainda não refletiu uma
        // escrita que acabou de acontecer (ex: logo após importar um XML) —
        // busca direto no Firestore em vez de falhar silenciosamente.
        try {
            const doc = await cotacoesCollection.doc(pedido).get();
            if (doc.exists) c = { pedido, ...doc.data() };
        } catch (e) {
            console.error('Erro ao buscar cotação:', e);
        }
    }
    if (!c) return;
    cotacaoEmEdicaoPedido = pedido;
    contadorFornecedorCotacaoId = 0;
    // Mantém TODOS os campos originais do fornecedor (não só razaoSocial/cnpj)
    // — um fornecedor importado do XML carrega prazoEntrega, validadeProposta
    // etc, e não pode perder isso só porque o usuário abriu a tela manual e
    // salvou de novo sem mexer nesses campos.
    fornecedoresCotacaoAtual = (c.fornecedores || []).map(f => ({ id: ++contadorFornecedorCotacaoId, ...f }));
    document.getElementById('cot-pedido').value = c.pedido;
    document.getElementById('cot-pedido').disabled = true; // pedido é o id do documento — não dá pra editar depois de criado
    document.getElementById('cot-origem').value = c.origem || '';
    document.getElementById('cot-data-pedido').value = c.dataPedido || '';
    document.getElementById('cot-data-limite').value = c.dataLimite || '';
    document.getElementById('cot-observacao').value = c.observacao || '';
    document.getElementById('btn-excluir-cotacao').style.display = '';
    renderFornecedoresCotacao();
    switchToScreen('screen-cotacao-editor', `Cotação ${pedido}`);
}

function adicionarFornecedorCotacao() {
    fornecedoresCotacaoAtual.push({ id: ++contadorFornecedorCotacaoId, razaoSocial: '', cnpj: '' });
    renderFornecedoresCotacao();
}
function removerFornecedorCotacao(id) {
    fornecedoresCotacaoAtual = fornecedoresCotacaoAtual.filter(f => f.id !== id);
    renderFornecedoresCotacao();
}
function atualizarFornecedorCotacaoCampo(id, key, valor) {
    const f = fornecedoresCotacaoAtual.find(f => f.id === id);
    if (f) f[key] = key === 'razaoSocial' ? upAud(valor) : valor;
}
function renderFornecedoresCotacao() {
    const container = document.getElementById('lista-fornecedores-cotacao');
    if (!container) return;
    if (fornecedoresCotacaoAtual.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhum fornecedor adicionado ainda.</div>';
        return;
    }
    container.innerHTML = fornecedoresCotacaoAtual.map(f => {
        const apelido = encontrarApelidoFornecedor(f.razaoSocial);
        return `
        <div class="fornecedor-cotacao-row">
            <div class="campo"><label>Razão Social${apelido ? ` (apelido: ${apelido})` : ''}</label><input type="text" class="form-field uppercase-field" value="${f.razaoSocial}" placeholder="COMERCIAL CIRÚRGICA RIOCLARENSE" onblur="atualizarFornecedorCotacaoCampo(${f.id}, 'razaoSocial', this.value)"></div>
            <div class="campo"><label>CNPJ</label><input type="text" class="form-field" value="${f.cnpj}" placeholder="67.729.178/0002-20" onblur="atualizarFornecedorCotacaoCampo(${f.id}, 'cnpj', this.value)"></div>
            <button type="button" class="divergencia-del" onclick="removerFornecedorCotacao(${f.id})"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }).join('');
}

async function salvarCotacao() {
    const pedido = document.getElementById('cot-pedido').value.trim();
    if (!pedido) return toast('Informe o número do pedido.');

    // Doc id = pedido, então um pedido já cadastrado nunca deve ser
    // sobrescrito silenciosamente ao tentar "criar" de novo — só editando.
    if (!cotacaoEmEdicaoPedido && listaCotacoes.some(c => c.pedido === pedido)) {
        return toast(`Já existe uma cotação para o pedido ${pedido}. Abra ela pra editar.`);
    }

    const agora = new Date().toISOString();
    const dados = {
        origem: document.getElementById('cot-origem').value,
        dataPedido: document.getElementById('cot-data-pedido').value,
        dataLimite: document.getElementById('cot-data-limite').value,
        observacao: document.getElementById('cot-observacao').value.trim(),
        fornecedores: fornecedoresCotacaoAtual.filter(f => f.razaoSocial.trim() || f.cnpj.trim()).map(f => {
            const { id, ...resto } = f;
            return { ...resto, razaoSocial: f.razaoSocial.trim(), cnpj: f.cnpj.trim() };
        }),
        atualizadoEm: agora
    };

    try {
        if (cotacaoEmEdicaoPedido) {
            await cotacoesCollection.doc(pedido).set(dados, { merge: true });
            toast('✓ Cotação atualizada!');
        } else {
            dados.itens = []; // reservado para a importação do XML (Fase 4)
            dados.versaoAtual = 1;
            dados.origemDado = 'manual';
            dados.criadoEm = agora;
            await cotacoesCollection.doc(pedido).set(dados);
            toast('✓ Cotação cadastrada!');
        }
        await criarOuAtualizarAnotacaoDaCotacao(pedido, dados.origem, dados.dataPedido, dados.dataLimite, dados.fornecedores);
        // Editar/criar cotação de dentro da Central deve voltar pra Central
        // (não pra lista crua) — só volta pra lista quando "Nova Cotação" foi
        // aberta de lá mesmo, sem nenhum pedido de contexto ainda.
        if (origemTelaCotacaoEditor === 'screen-central-pedido') await abrirCentralPedido(pedido);
        else switchToScreen('screen-cotacoes', 'Cotações');
    } catch (e) {
        console.error('Erro ao salvar cotação:', e);
        toast('✕ Erro ao salvar. Tente novamente.');
    }
}

// ===================================================================
// --- FASE 7: ANÁLISE DAS COTAÇÕES POR ITEM ---
// ===================================================================
// Só leitura/junção sobre o que já existe (cotacao.itens, vindos do XML do
// SmartCompras — Fase 4; listaRelatorioGanhadores, relatório complementar já
// existente) + UMA gravação nova e pequena: cotacao.recursosPorItem, um mapa
// { codigoSmartCompras: <string oficial> } no próprio documento da cotação
// (não é coleção nova, não duplica cotação). Como não é tocado por
// confirmarImportacaoXmlSmartCompras (que só sobrescreve fornecedores/itens/
// datas via merge:true), sobrevive automaticamente a reimportações — sem
// precisar de nenhuma lógica extra de mesclagem.
//
// IMPORTANTE — modelo de negócio confirmado:
//   ENTIDADE (Santa Casa/CTI) já é uma característica do PEDIDO inteiro
//   (campo cotacao.origem, já existente — nada a fazer aqui).
//   RECURSO (C/C vs Recurso Próprio) pode variar POR ITEM dentro do mesmo
//   pedido — por isso fica em recursosPorItem, indexado pelo código do item,
//   nunca num campo único "recurso do pedido".
//
// As 4 strings abaixo são valores oficiais de integração com a planilha do
// processo — nunca alterar capitalização, acentuação, ordem das palavras ou
// criar abreviações/alternativas. Esta é a ÚNICA fonte dessas strings no
// código; todo o resto do app deve montá-las através de calcularRecursoOficial.
const RECURSOS_OFICIAIS = {
    'Santa Casa': { cc: 'C/C SANTA CASA', proprio: 'Recurso Proprio Santa Casa' },
    'CTI': { cc: 'C/C CTI', proprio: 'Recurso Proprio CTI' }
};
function calcularRecursoOficial(origemPedido, tipo) {
    const mapa = RECURSOS_OFICIAIS[origemPedido];
    if (!mapa) return null;
    return tipo === 'cc' ? mapa.cc : tipo === 'proprio' ? mapa.proprio : null;
}

// Configuração dos mínimos de cotações esperados por tipo de recurso — só
// existe pra dar um "condição atendida/verificar" com base real, nunca um
// número inventado pelo sistema. Fica vazio até o usuário definir.
// ===================================================================

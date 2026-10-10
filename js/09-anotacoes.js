// 09-anotacoes.js — Sistema de anotações (texto rico, tabelas)
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// --- SISTEMA DE ANOTAÇÕES (múltiplas notas, texto rico, tabelas) ---

function stripHtmlAnotacao(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    // textContent concatena blocos (<p>, <div>, <li>...) sem nenhum espaço
    // entre eles — "RIOCLARENSE Ped. 1698" + "Pedido: SERINGA..." virava
    // "RIOCLARENSE Ped. 1698Pedido: SERINGA..." colado. Insere um espaço no
    // fim de cada bloco antes de extrair o texto, sem criar quebra de linha.
    tmp.querySelectorAll('p, div, li, h1, h2, h3, h4, br').forEach(el => {
        el.insertAdjacentText('afterend', ' ');
    });
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

function renderListaAnotacoes() {
    const container = document.getElementById('lista-anotacoes-container');
    if (!container) return;

    const termo = filtroAnotacoesTexto.trim().toUpperCase();
    const lista = listaAnotacoes.filter(a => {
        if (!termo) return true;
        const titulo = (a.titulo || '').toUpperCase();
        const texto = stripHtmlAnotacao(a.conteudo).toUpperCase();
        return titulo.includes(termo) || texto.includes(termo);
    });

    if (lista.length === 0) {
        container.innerHTML = `<div class="empty-state">${listaAnotacoes.length === 0 ? 'Nenhuma anotação ainda. Toque em "Nova Anotação" para começar.' : 'Nenhuma anotação encontrada.'}</div>`;
        return;
    }

    container.innerHTML = lista.map(a => {
        const snippet = stripHtmlAnotacao(a.conteudo).slice(0, 90) || 'Sem conteúdo ainda...';
        const data = a.atualizadoEm ? new Date(a.atualizadoEm).toLocaleString('pt-BR') : '';
        const concluida = a.status === 'concluido';
        const sinalizada = !!a.sinalizada;
        const selecionada = selecaoAnotacoesAtiva && anotacoesSelecionadas.has(a.id);
        return `<div class="nota-item anotacao-item ${concluida ? 'anotacao-concluida' : ''} ${selecionada ? 'nota-selected' : ''}" onclick="${selecaoAnotacoesAtiva ? `toggleSelecaoAnotacao('${a.id}')` : (a.pedido ? `abrirCentralPedido('${a.pedido}')` : `abrirAnotacao('${a.id}')`)}">            <div class="nota-info">${a.titulo || 'Sem título'}${concluida ? ' <span class="badge-concluida">Concluída</span>' : ''}</div>
            <div class="nota-detalhes">${snippet}${snippet.length >= 90 ? '…' : ''}</div>
            <div class="nota-data">Atualizado em: ${data}</div>
            ${!selecaoAnotacoesAtiva ? `<div class="anotacao-card-actions">
                <button type="button" class="anotacao-icon-btn ${sinalizada ? 'is-flagged' : ''}" title="Sinalizar" onclick="event.stopPropagation(); toggleFlagAnotacao('${a.id}')"><i class="fa-solid fa-flag"></i></button>
                <button type="button" class="anotacao-icon-btn ${concluida ? 'is-done' : ''}" title="${concluida ? 'Reabrir' : 'Concluir'}" onclick="event.stopPropagation(); toggleConcluidaAnotacao('${a.id}')"><i class="fa-solid fa-check"></i></button>
                <button type="button" class="anotacao-icon-btn is-delete" title="Excluir" onclick="event.stopPropagation(); excluirAnotacaoRapida('${a.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>` : ''}
        </div>`;
    }).join('');
}

function toggleFlagAnotacao(id) {
    const nota = listaAnotacoes.find(a => a.id === id);
    if (!nota) return;
    const novoValor = !nota.sinalizada;
    anotacoesTextoCollection.doc(id).update({ sinalizada: novoValor })
        .catch(e => { console.error('Erro ao sinalizar anotação:', e); toast('✕ Erro ao sinalizar.'); });
}

function toggleConcluidaAnotacao(id) {
    const nota = listaAnotacoes.find(a => a.id === id);
    if (!nota) return;
    const novoStatus = nota.status === 'concluido' ? null : 'concluido';
    anotacoesTextoCollection.doc(id).update({ status: novoStatus })
        .then(() => toast(novoStatus ? '✓ Marcada como concluída.' : 'Reaberta.'))
        .catch(e => { console.error('Erro ao concluir anotação:', e); toast('✕ Erro ao atualizar.'); });
}

function excluirAnotacaoRapida(id) {
    const nota = listaAnotacoes.find(a => a.id === id);
    showConfirmModal({
        title: 'Excluir Anotação',
        message: `Deseja excluir "${nota ? (nota.titulo || 'Sem título') : 'esta anotação'}" permanentemente?`,
        confirmText: 'Excluir',
        confirmClass: 'danger',
        onConfirm: async () => {
            try {
                await anotacoesTextoCollection.doc(id).delete();
                toast('🗑️ Anotação excluída.');
            } catch (e) {
                console.error('Erro ao excluir anotação:', e);
                toast('✕ Erro ao excluir.');
            }
        }
    });
}

function filtrarAnotacoes(texto) {
    filtroAnotacoesTexto = texto;
    renderListaAnotacoes();
}

// --- Seleção múltipla para exportar relatório consolidado pro WhatsApp
// (vários pedidos diferentes numa mensagem só, sem redigitar). ---
function toggleModoSelecaoAnotacoes() {
    selecaoAnotacoesAtiva = !selecaoAnotacoesAtiva;
    anotacoesSelecionadas.clear();
    const btn = document.getElementById('btn-selecionar-anotacoes');
    const barra = document.getElementById('anotacoes-bulk-bar');
    if (btn) btn.classList.toggle('active', selecaoAnotacoesAtiva);
    if (barra) barra.style.display = selecaoAnotacoesAtiva ? 'flex' : 'none';
    atualizarContadorSelecaoAnotacoes();
    renderListaAnotacoes();
}
function toggleSelecaoAnotacao(id) {
    if (anotacoesSelecionadas.has(id)) anotacoesSelecionadas.delete(id);
    else anotacoesSelecionadas.add(id);
    atualizarContadorSelecaoAnotacoes();
    renderListaAnotacoes();
}
function atualizarContadorSelecaoAnotacoes() {
    const el = document.getElementById('anotacoes-selecao-contador');
    if (el) el.textContent = anotacoesSelecionadas.size > 0 ? `${anotacoesSelecionadas.size} selecionada(s)` : 'Toque nas anotações para selecionar';
}
async function exportarAnotacoesWhatsapp() {
    if (anotacoesSelecionadas.size === 0) return toast('Selecione ao menos uma anotação.');
    const selecionadas = listaAnotacoes.filter(a => anotacoesSelecionadas.has(a.id));
    // Mantém a ordem em que aparecem na lista (mais recentes primeiro), não a
    // ordem de clique.
    const blocos = selecionadas.map(a => {
        const texto = stripHtmlAnotacao(a.conteudo).trim();
        return `*${a.titulo || 'Sem título'}*${texto ? '\n' + texto : ''}`;
    });
    const relatorio = blocos.join('\n\n———\n\n');
    if (navigator.share) {
        try {
            await navigator.share({ title: 'Relatório de Anotações', text: relatorio });
        } catch (e) {
            // usuário cancelou o share sheet — não é erro
        }
    } else {
        await navigator.clipboard.writeText(relatorio);
        toast('✓ Relatório copiado! Cole no WhatsApp.');
    }
}

function abrirNovaAnotacao() {
    voltarAnotacaoEditorParaCentral = null; // reseta — só a Central religa essa flag explicitamente
    anotacaoAtualId = null;
    document.getElementById('anotacao-titulo').value = '';
    document.getElementById('anotacao-corpo').innerHTML = '';
    aplicarEstadoEspacamentoEditor('', false);
    switchToScreen('screen-anotacoes-editor', 'Nova Anotação');
    setTimeout(() => { document.getElementById('anotacao-titulo').focus(); atualizarEstadoToolbarAnotacao(); }, 300);
}

function abrirAnotacao(id, viaCentral) {
    const nota = listaAnotacoes.find(a => a.id === id);
    if (!nota) return;
    if (!viaCentral) voltarAnotacaoEditorParaCentral = null; // reseta se aberta direto da lista, não da Central
    anotacaoAtualId = id;
    document.getElementById('anotacao-titulo').value = nota.titulo || '';
    document.getElementById('anotacao-corpo').innerHTML = nota.conteudo || '';
    aplicarEstadoEspacamentoEditor(nota.espacamentoLinha || '', !!nota.paragrafoCompacto);
    switchToScreen('screen-anotacoes-editor', nota.titulo || 'Anotação');
    setTimeout(atualizarEstadoToolbarAnotacao, 300);
}

// ============================================================
// CENTRAL DO PEDIDO — tela própria (não mais um painel dentro do editor de
// anotação). cotacoes/{pedido} continua sendo a única fonte da cotação;
// anotacoesTexto continua sendo a única fonte de ocorrências/divergências/
// status/histórico. Esta tela só JUNTA as duas na apresentação — nenhum
// dado é copiado de um lado pro outro.
//
// STATUS de uma divergência: 'pendente' (padrão, inclusive pra ocorrências
// antigas sem esse campo — nunca migramos histórico antigo só pra
// adicionar o campo), 'resolvida' (problema corrigido de fato) ou
// 'encerrada' (caso finalizado sem necessariamente ter sido corrigido).
// HISTÓRICO é append-only: uma mudança de status NUNCA apaga ou reescreve
// uma entrada anterior, só acrescenta uma nova. O texto que foi gerado e
// salvo no momento da identificação nunca muda retroativamente.
// ============================================================
let centralPedidoAtual = null;
let centralFornecedoresAbertos = new Set();
let centralStatusFormAberto = new Set();
let voltarAnotacaoEditorParaCentral = null; // guarda o pedido, se o editor de texto foi aberto a partir da Central

const ROTULOS_HISTORICO = { identificacao: 'Identificado', resolucao: 'Resolvido', encerramento: 'Encerrado', reabertura: 'Reaberto' };

// Fase 37: a cotação individual tem abas (Produtos · Anotações · Relatório · Dados), no mesmo padrão das abas de Relatórios.
function alternarAbaCentral(aba) {
    document.querySelectorAll('#screen-central-pedido .central-aba-pane').forEach(p => p.classList.toggle('ativa', p.dataset.aba === aba));
    document.querySelectorAll('#screen-central-pedido .central-abas .xml-filtro-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.aba === aba));
}
function abrirCentralPedido(pedido) {
    if (!pedido) return;
    centralPedidoAtual = pedido;
    centralFornecedoresAbertos = new Set();
    centralStatusFormAberto = new Set();
    alternarAbaCentral('produtos'); // Fase 37: sempre abre na aba Produtos
    switchToScreen('screen-central-pedido', pedido);
    renderCentralPedidoCompleto(pedido);
}

// Linhas de texto (uma por material) de UMA divergência — reaproveita
// linhaMaterial()/paragrafoAvaria(), já usados na geração de texto da
// Auditoria (mesma lógica, não duplicada).
// Texto natural de uma ocorrência que NÃO é por material (multiMaterial:
// false) — hoje "fornecedor não entregou" e "frete em desacordo". Extraído
// como função própria pra não duplicar a mesma string em dois lugares
// (Central do Pedido via linhasDeMateriais, e a saída da Auditoria via
// gerarCorpoAuditoria) — um ajusta, o outro acompanha automaticamente.
function textoOcorrenciaUnica(tipo, c) {
    if (tipo === 'fornecedor_nao_entregou') {
        return `${c.fornecedorNome ? upAud(c.fornecedorNome) + ': ' : ''}ainda não entregou o pedido${c.diasEmAberto ? ', já são ' + c.diasEmAberto + ' dias em aberto' : ''}.${c.observacao ? ' ' + c.observacao : ''}`;
    }
    if (tipo === 'frete_indevido') {
        return `A cotação foi aprovada com frete ${c.condicaoCotada ? upAud(c.condicaoCotada) : '?'}, porém o fornecedor cobrou frete${c.valorFrete ? ' no valor de ' + c.valorFrete : ''}${c.condicaoCobrada ? ' (' + upAud(c.condicaoCobrada) + ')' : ''}, em desacordo com a condição aprovada.${c.observacao ? ' ' + c.observacao : ''}`;
    }
    return '';
}

function linhasDeMateriais(d) {
    const def = TIPOS_DIVERGENCIA_AUDITORIA[d.tipo];
    if (!def) return [];
    if (def.multiMaterial) return (d.materiais || []).map(m => d.tipo === 'avariado' ? `${upAud(m.produto)} — material avariado` : linhaMaterial(d.tipo, m)).filter(Boolean);
    const texto = textoOcorrenciaUnica(d.tipo, d.campos || {});
    return texto ? [texto] : [];
}

// Bloco de UMA divergência: linhas de material + status + histórico +
// controle pra mudar o status. ocIdx/divIdx são os índices reais dentro de
// nota.ocorrencias[ocIdx].divergencias[divIdx] — é como alterarStatusDivergenciaCentral
// sabe exatamente o que atualizar no Firestore.
function renderBlocoDivergencia(d, oc, ocIdx, divIdx) {
    const status = d.status || 'pendente'; // ocorrências antigas sem status viram "pendente" só na exibição
    const linhas = linhasDeMateriais(d);
    if (linhas.length === 0) return '';
    const linhasHTML = linhas.map(l => `<div class="central-item-linha">${l.replace(/</g, '&lt;')}</div>`).join('');

    const historico = d.historico || [];
    const historicoHTML = historico.length ? `<div class="central-historico">
        ${historico.map(h => `<div class="central-historico-item">${formatarDataBRSimples(h.data)} — ${ROTULOS_HISTORICO[h.tipo] || h.tipo}${h.observacao ? ': ' + h.observacao.replace(/</g, '&lt;') : ''}</div>`).join('')}
    </div>` : '';

    const key = `${ocIdx}-${divIdx}`;
    const formAberto = centralStatusFormAberto.has(key);
    const statusFormHTML = formAberto ? `
        <div class="central-status-form">
            <select id="central-status-select-${key}" class="form-field">
                <option value="pendente" ${status === 'pendente' ? 'selected' : ''}>Pendente</option>
                <option value="resolvida" ${status === 'resolvida' ? 'selected' : ''}>Resolvida</option>
                <option value="encerrada" ${status === 'encerrada' ? 'selected' : ''}>Encerrada</option>
            </select>
            <input type="text" id="central-status-obs-${key}" class="form-field" placeholder="Observação (opcional)">
            <button type="button" class="actions-button is-success" onclick="confirmarAlteracaoStatusCentral('${oc._anotacaoId}', ${ocIdx}, ${divIdx})">Atualizar Status</button>
        </div>` : '';

    return `<div class="central-divergencia-bloco">
        ${linhasHTML}
        <div class="central-divergencia-meta">
            <span class="central-status-badge status-${status}">${status === 'pendente' ? 'Pendente' : status === 'resolvida' ? 'Resolvida' : 'Encerrada'}</span>
            ${oc.notaFiscal ? `<span class="central-nf-tag">NF ${oc.notaFiscal}</span>` : ''}
            <button type="button" class="central-status-toggle" onclick="toggleCentralStatusForm('${key}')">${formAberto ? 'Cancelar' : 'Alterar status'}</button>
        </div>
        ${historicoHTML}
        ${statusFormHTML}
    </div>`;
}

function renderCentralPedidoCompleto(pedido) {
    const cotacao = listaCotacoes.find(c => c.pedido === pedido);
    const nota = listaAnotacoes.find(a => a.pedido === pedido);

    document.getElementById('central-titulo-pedido').textContent = cotacao && cotacao.origem ? `${pedido} — ${cotacao.origem}` : pedido;
    // Fase 34: subtítulo com o essencial do pedido + resumo de entrega.
    // Fase 37: pedido sem cotação não tem o que separar em abas — mostra tudo junto, como antes.
    document.getElementById('screen-central-pedido').classList.toggle('central-sem-abas', !cotacao);
    const subEl = document.getElementById('central-subtitulo-pedido');
    if (subEl) {
        if (cotacao) {
            const nForn = (cotacao.fornecedores || []).length;
            subEl.innerHTML = `<div class="central-sub-linha">${nForn} fornecedor${nForn === 1 ? '' : 'es'}${cotacao.dataLimite ? ' · limite ' + formatarDataBRSimples(cotacao.dataLimite) : ''}</div><div class="nota-chips">${chipsResumoEntrega(resumoEntregaCotacao(cotacao))}</div>`;
            subEl.style.display = 'block';
        } else { subEl.innerHTML = ''; subEl.style.display = 'none'; }
    }

    const headerCard = document.getElementById('central-header-card');
    const semCotacao = document.getElementById('central-sem-cotacao');
    if (cotacao) {
        headerCard.style.display = 'block';
        semCotacao.style.display = 'none';
        document.getElementById('central-origem').value = cotacao.origem || '';
        document.getElementById('central-data-pedido').value = cotacao.dataPedido || '';
        document.getElementById('central-data-limite').value = cotacao.dataLimite || '';
        document.getElementById('central-observacao-cotacao').value = cotacao.observacao || '';
    } else {
        headerCard.style.display = 'none';
        semCotacao.style.display = 'block';
    }

    // Todas as divergências de todas as ocorrências, achatadas, guardando os
    // índices reais (ocIdx/divIdx) pra alteração de status saber onde mexer,
    // e o id da anotação (pra Firestore) embutido em cada ocorrência.
    const todasDivergencias = [];
    (nota && nota.ocorrencias ? nota.ocorrencias : []).forEach((oc, ocIdx) => {
        const ocComId = { ...oc, _anotacaoId: nota.id };
        (oc.divergencias || []).forEach((d, divIdx) => todasDivergencias.push({ d, oc: ocComId, ocIdx, divIdx }));
    });

    const container = document.getElementById('central-fornecedores-container');

    if (cotacao) {
        const compItens = compararFontesPedido(pedido);
        const normNome = x => String(x || '').trim().toUpperCase();
        const fornecedoresHTML = (cotacao.fornecedores || []).map(f => {
            const nomeExibicao = nomeExibicaoFornecedor(f.razaoSocial, f.cnpj);
            const produtos = (cotacao.itens || []).filter(it => normalizarCnpj(it.cnpjFornecedor) === normalizarCnpj(f.cnpj));
            const divergenciasForn = todasDivergencias.filter(x => normalizarCnpj(x.oc.fornecedorCnpj) === normalizarCnpj(f.cnpj));
            const aberto = centralFornecedoresAbertos.has(f.cnpj);
            const compForn = compItens.filter(item => normalizarCnpj(item.cnpjFornecedor) === normalizarCnpj(f.cnpj));
            const chegada = (cotacao.chegadasPorFornecedor || {})[normalizarCnpj(f.cnpj)] || null;
            // Fase 31: status de entrega CALCULADO (XML do app + ERP + itens); a marca manual é exceção.
            const entrega = calcularEntregaFornecedorPedido(pedido, f, compForn);
            const chegadaHTML = renderEntregaFornecedorHTML(pedido, f, entrega);

            // Fase 27: cada divergência da auditoria vai pra linha do PRIMEIRO
            // produto cujo nome bate EXATAMENTE (sem aproximação) com um dos
            // materiais dela. Sem correspondência exata (ou tipo sem material,
            // ex.: "fornecedor não entregou"), fica em "Outras divergências" —
            // nenhuma divergência some nem aparece duplicada.
            const divPorProduto = {};
            const divSoltas = [];
            divergenciasForn.forEach(x => {
                const nomes = (x.d.materiais || []).map(m => normNome(m.produto)).filter(Boolean);
                const alvo = nomes.length ? produtos.find(it => nomes.includes(normNome(it.nomeOficial || it.descricao || it.codProduto))) : null;
                if (alvo) (divPorProduto[alvo.codProduto] = divPorProduto[alvo.codProduto] || []).push(x);
                else divSoltas.push(x);
            });

            const produtosHTML = produtos.length
                ? produtos.map(it => {
                    const comp = compForn.find(c => c.codProduto === it.codProduto && (c.temNf || c.temErp || c.divergencias.length));
                    const divs = divPorProduto[it.codProduto] || [];
                    return renderLinhaProduto(it, `${f.cnpj}-${it.codProduto}`, {
                        comp, chegou: !!chegada,
                        compHTML: comp ? renderComparacaoItemHTML(pedido, comp, true) : `<div class="central-item-vazio">${chegada ? 'Fornecedor marcado como já chegou (sem NF no app).' : 'Ainda sem NF/ERP para este item.'}</div>`,
                        divsHTML: divs.map(x => renderBlocoDivergencia(x.d, x.oc, x.ocIdx, x.divIdx)).join(''),
                        divsPendentes: divs.filter(x => (x.d.status || 'pendente') === 'pendente').length
                    });
                }).join('')
                : '<div class="central-item-vazio">Nenhum produto cotado registrado.</div>';

            const soltasHTML = divSoltas.length
                ? `<div class="central-secao-titulo">Outras divergências deste fornecedor</div>${divSoltas.map(x => renderBlocoDivergencia(x.d, x.oc, x.ocIdx, x.divIdx)).join('')}`
                : '';

            const nComDiv = compForn.filter(c => c.divergencias.length).length;
            const nPend = divergenciasForn.filter(x => (x.d.status || 'pendente') === 'pendente').length;
            const resumo = [`${produtos.length} item(ns)`, entrega ? rotuloEntregaFornecedor(entrega).curto : '', nComDiv ? `${nComDiv} com divergência` : '', nPend ? `${nPend} auditoria(s) pendente(s)` : ''].filter(Boolean).join(' · ');

            return `<div class="central-fornecedor${aberto ? ' aberto' : ''}">
                <div class="central-fornecedor-header" onclick="toggleCentralFornecedor('${f.cnpj}', this)">
                    <i class="fa-solid fa-chevron-right"></i>
                    <span>${nomeExibicao}${f.cnpj ? ` <span style="font-weight:400;color:var(--text-light);font-size:12px;">— CNPJ ${formatarCnpjExibicao(f.cnpj)}</span>` : ''}<span class="central-fornecedor-resumo">${resumo}</span></span>
                </div>
                <div class="central-colapso"><div class="central-colapso-inner"><div class="central-fornecedor-body">
                    ${chegadaHTML}
                    ${renderAssociarNfFornecedorHTML(pedido, f.cnpj)}
                    ${produtosHTML}
                    ${soltasHTML}
                </div></div></div>
            </div>`;
        }).join('');

        const semFornecedor = todasDivergencias.filter(x => !x.oc.fornecedorCnpj);
        const abertoSem = centralFornecedoresAbertos.has('_sem_cnpj');
        const semFornecedorHTML = semFornecedor.length ? `<div class="central-fornecedor${abertoSem ? ' aberto' : ''}">
            <div class="central-fornecedor-header" onclick="toggleCentralFornecedor('_sem_cnpj', this)">
                <i class="fa-solid fa-chevron-right"></i>
                <span>Outras ocorrências (sem fornecedor identificado na cotação)</span>
            </div>
            <div class="central-colapso"><div class="central-colapso-inner"><div class="central-fornecedor-body">
                ${semFornecedor.map(x => `<div style="margin-bottom:6px;font-size:12px;color:var(--text-light);">${x.oc.fornecedor ? upAud(x.oc.fornecedor) : 'Fornecedor não identificado'}</div>${renderBlocoDivergencia(x.d, x.oc, x.ocIdx, x.divIdx)}`).join('')}
            </div></div></div>
        </div>` : '';

        container.innerHTML = fornecedoresHTML + semFornecedorHTML;
    } else if (nota) {
        // Sem cotação cadastrada, mas já existem ocorrências registradas (ex:
        // auditorias antigas de antes da cotação existir) — mostra tudo junto,
        // sem agrupamento por fornecedor (não há CNPJ pra agrupar por).
        container.innerHTML = todasDivergencias.length
            ? todasDivergencias.map(x => `<div style="margin-bottom:6px;font-size:12px;color:var(--text-light);">${x.oc.fornecedor ? upAud(x.oc.fornecedor) : 'Fornecedor não identificado'}</div>${renderBlocoDivergencia(x.d, x.oc, x.ocIdx, x.divIdx)}`).join('')
            : '<div class="central-item-vazio">Nenhuma ocorrência registrada ainda.</div>';
    } else {
        container.innerHTML = '';
    }

    document.getElementById('central-btn-texto-livre').style.display = nota ? '' : 'none';

    // Anotação embutida no próprio contexto do pedido (correção desta rodada):
    // mesma anotação/estrutura de sempre (anotacoesTextoCollection, casada
    // por `pedido`), só que exibida e editável aqui, sem precisar navegar pra
    // Anotações. Guarda contra sobrescrever o que a pessoa está digitando: só
    // substitui o conteúdo do campo se ele não estiver com foco no momento.
    centralAnotacaoId = nota ? nota.id : null;
    const anotCard = document.getElementById('central-anotacao-card');
    const anotVazia = document.getElementById('central-anotacao-vazia');
    if (anotCard && anotVazia) {
        if (nota) {
            anotCard.style.display = 'block';
            anotVazia.style.display = 'none';
            const campo = document.getElementById('central-anotacao-conteudo');
            if (campo && document.activeElement !== campo) campo.innerHTML = nota.conteudo || '';
        } else {
            anotCard.style.display = 'none';
            anotVazia.style.display = 'block';
        }
    }

}

let centralAnotacaoId = null;
let autoSaveAnotacaoInlineCentralTimeout = null;

function agendarSalvarAnotacaoInlineCentral() {
    clearTimeout(autoSaveAnotacaoInlineCentralTimeout);
    autoSaveAnotacaoInlineCentralTimeout = setTimeout(salvarAnotacaoInlineCentral, 1200);
}

async function salvarAnotacaoInlineCentral() {
    if (!centralAnotacaoId) return;
    const campo = document.getElementById('central-anotacao-conteudo');
    if (!campo) return;
    try {
        await anotacoesTextoCollection.doc(centralAnotacaoId).update({ conteudo: campo.innerHTML, atualizadoEm: new Date().toISOString() });
    } catch (e) {
        console.error('Erro ao salvar anotação inline da Central:', e);
    }
}

// Reaproveita a mesma criação usada na cotação (criarOuAtualizarAnotacaoDaCotacao)
// — sem estrutura de dados nova. Preenche o campo na hora, sem esperar o
// listener em tempo real, pra já aparecer editável assim que criada.
async function criarAnotacaoInlineCentral() {
    if (!centralPedidoAtual) return;
    const cotacao = listaCotacoes.find(c => c.pedido === centralPedidoAtual);
    const origem = cotacao ? cotacao.origem : '';
    const dataPedido = cotacao ? cotacao.dataPedido : '';
    const dataLimite = cotacao ? cotacao.dataLimite : '';
    const fornecedores = cotacao ? cotacao.fornecedores : [];
    try {
        const id = await criarOuAtualizarAnotacaoDaCotacao(centralPedidoAtual, origem, dataPedido, dataLimite, fornecedores);
        if (!id) return toast('✕ Erro ao criar anotação.');
        centralAnotacaoId = id;
        document.getElementById('central-anotacao-card').style.display = 'block';
        document.getElementById('central-anotacao-vazia').style.display = 'none';
        document.getElementById('central-anotacao-conteudo').innerHTML = montarCabecalhoAnotacaoCotacao(centralPedidoAtual, origem, dataPedido, dataLimite, fornecedores);
    } catch (e) {
        console.error('Erro ao criar anotação do pedido:', e);
        toast('✕ Erro ao criar anotação.');
    }
}

// Produto sempre mostra o que realmente veio do XML — nunca inventa uma
// descrição. Quando o fornecedor não preencheu o campo de descrição (existe
// no XML real: alguns itens vêm com <Comentario></Comentario> vazio),
// mostra isso como ausência de dado, nunca como se fosse o nome do produto,
// e o código do fornecedor fica sempre visível (base pra associação futura
// de código externo → interno).
// Reconstrói a cotação com fidelidade total (regra definitiva combinada) —
// nunca usa observação/fabricante/código como substituto do nome oficial.
// Nome oficial só existe depois que o relatório do SmartCompras for colado
// e cruzado (código + CNPJ); até lá, fica marcado como pendente de
// complementação, nunca escondido nem inventado.
let centralProdutosExpandidos = new Set();
let centralAssociacaoBuscaAberta = new Set();

function renderAssociacaoSpDataWidget(it, chaveUnica) {
    if (!it.codProduto) return '';
    const chaveWidget = `assoc-${chaveUnica}`;
    const associacao = listaAssociacoesSpData.find(a => a.codigoSmartCompras === it.codProduto);
    const buscaAberta = centralAssociacaoBuscaAberta.has(chaveWidget);

    if (associacao) {
        const produto = listaProdutosSpData.find(p => p.codigo === associacao.spDataCodigo);
        const linha = produto ? `${produto.codigo} — ${produto.nome} — ${produto.unidade}` : `${associacao.spDataCodigo} (produto não encontrado no cadastro atual)`;
        return `<div class="central-spdata-linha">
            <span><strong>SP Data:</strong> ${linha}</span>
            <button type="button" class="central-status-toggle" onclick="event.stopPropagation(); toggleBuscaAssociacaoSpData('${chaveWidget}')">${buscaAberta ? 'Cancelar' : 'Corrigir SP Data'}</button>
        </div>${buscaAberta ? renderBuscaAssociacaoSpData(it, chaveWidget) : ''}`;
    }

    return `<div class="central-spdata-linha central-item-sem-desc">
        <span>SP Data: não associado</span>
        <button type="button" class="central-status-toggle" onclick="event.stopPropagation(); toggleBuscaAssociacaoSpData('${chaveWidget}')">${buscaAberta ? 'Cancelar' : 'Associar SP Data'}</button>
    </div>${buscaAberta ? renderBuscaAssociacaoSpData(it, chaveWidget) : ''}`;
}
function toggleBuscaAssociacaoSpData(chaveWidget) {
    if (centralAssociacaoBuscaAberta.has(chaveWidget)) centralAssociacaoBuscaAberta.delete(chaveWidget);
    else centralAssociacaoBuscaAberta.add(chaveWidget);
    // Este widget é reaproveitado tanto na Central do Pedido quanto na
    // Entrada de NF (associação SP Data direto na tela, sem sair pra
    // Cotações) — re-renderiza só o(s) contexto(s) realmente ativo(s).
    if (centralPedidoAtual) renderCentralPedidoCompleto(centralPedidoAtual);
    if (nfeInfoAtual) renderAssociacaoCotacaoXml();
}
// Sugestões iniciais aparecem ao abrir (baseadas no nome oficial do item, se
// houver); busca manual atualiza só a lista de resultados via DOM direto
// (não re-renderiza a Central inteira), senão o campo de texto perderia o
// foco a cada letra digitada.
function renderBuscaAssociacaoSpData(it, chaveWidget) {
    const sugestoesIniciais = it.nomeOficial ? buscarSugestoesSpData(it.nomeOficial) : [];
    const listaInicialHTML = sugestoesIniciais.length
        ? sugestoesIniciais.slice(0, 8).map(p => `<div class="central-spdata-opcao" onclick="event.stopPropagation(); confirmarAssociacaoSpData('${it.codProduto}', '${p.codigo}')"><strong>${p.codigo}</strong> — ${p.nome} — ${p.unidade}</div>`).join('')
        : '<div class="central-item-vazio">Nenhuma sugestão automática — busque manualmente pelo nome ou código.</div>';
    return `<div class="central-spdata-busca" onclick="event.stopPropagation()">
        <input type="text" class="form-field" placeholder="Buscar por nome ou código..." oninput="atualizarBuscaAssociacaoSpData('${chaveWidget}', '${it.codProduto}', this.value)">
        <div class="central-spdata-opcoes" id="spdata-resultados-${chaveWidget}">${listaInicialHTML}</div>
    </div>`;
}
function atualizarBuscaAssociacaoSpData(chaveWidget, codigoItem, texto) {
    const container = document.getElementById(`spdata-resultados-${chaveWidget}`);
    if (!container) return;
    const candidatos = texto.trim() ? buscarSugestoesSpData(texto) : [];
    container.innerHTML = candidatos.length
        ? candidatos.slice(0, 8).map(p => `<div class="central-spdata-opcao" onclick="event.stopPropagation(); confirmarAssociacaoSpData('${codigoItem}', '${p.codigo}')"><strong>${p.codigo}</strong> — ${p.nome} — ${p.unidade}</div>`).join('')
        : '<div class="central-item-vazio">Nenhum produto encontrado.</div>';
}

function renderLinhaProduto(it, chaveUnica, ctx) {
    const nomeOficialSmartCompras = it.nomeOficial ? upAud(it.nomeOficial) : null;
    const observacao = it.descricao && it.descricao !== '---' ? upAud(it.descricao) : '';
    const marca = it.fabricante && it.fabricante !== '---' ? it.fabricante : '';
    const expandido = centralProdutosExpandidos.has(chaveUnica);

    // Depois que existe associação confirmada com o SP Data, a identidade
    // interna (SP Data) passa a ser a identificação PRINCIPAL exibida na
    // lista — nada do SmartCompras é apagado, só deixa de ser o título e
    // passa pros detalhes expandidos (ver detalhesHTML abaixo).
    const associacaoSpData = it.codProduto ? listaAssociacoesSpData.find(a => a.codigoSmartCompras === it.codProduto) : null;
    const produtoSpData = associacaoSpData ? listaProdutosSpData.find(p => p.codigo === associacaoSpData.spDataCodigo) : null;

    // Relatório de fornecedores ganhadores (fonte complementar à cotação):
    // mostra quantos fornecedores realmente cotaram este item específico —
    // é um fato objetivo, nunca decide recurso/pagamento sozinho.
    const relatorioGanhadoresPedido = centralPedidoAtual ? listaRelatorioGanhadores.find(r => r.pedido === centralPedidoAtual) : null;
    const itemGanhadores = relatorioGanhadoresPedido && it.codProduto ? relatorioGanhadoresPedido.itens.find(g => g.codigo === it.codProduto) : null;
    const participantesResumo = itemGanhadores ? ` · ${itemGanhadores.participantes} fornecedor(es) cotaram` : '';
    const participantesDetalheHTML = itemGanhadores
        ? `<div>Fornecedores que cotaram este item: <strong>${itemGanhadores.participantes}</strong>${itemGanhadores.participantes >= minimoFornecedoresCC() ? ' ✓' : ` (menos de ${minimoFornecedoresCC()} participantes)`}</div><div>Vencedor: ${itemGanhadores.fornecedorVencedor ? itemGanhadores.fornecedorVencedor.nome : '<em>não identificado</em>'}</div>${itemGanhadores.empresas.length ? `<div class="txt-aux">Participantes: ${itemGanhadores.empresas.map(e => e.nome).join(', ')}</div>` : ''}`
        : '';

    const tituloHTML = nomeOficialSmartCompras
        ? `<div class="central-item-desc-linha">${nomeOficialSmartCompras}</div>`
        : `<div class="central-item-desc-linha central-item-sem-desc">Nome oficial: pendente de complementação (importe o relatório do SmartCompras)</div>`;
    // SP Data sempre visível, mas como linha SECUNDÁRIA — nunca substitui o
    // nome real da cotação (já foi assim antes e causou associação errada:
    // nomes do SP Data podem vir cortados/parecidos e escondiam o nome real).
    const spDataSubtituloHTML = produtoSpData ? `<div class="central-item-meta">SP Data ${produtoSpData.codigo} — ${produtoSpData.nome}</div>` : '';

    // Recurso confirmado na entrada da NF/XML (Parte 2/4 da correção) — só
    // exibição, nunca uma ação de escolher aqui.
    const recursoItem = (centralPedidoAtual && it.codProduto) ? (() => {
        const c = listaCotacoes.find(x => x.pedido === centralPedidoAtual);
        return c && c.recursosPorItem ? c.recursosPorItem[it.codProduto] : null;
    })() : null;
    const recursoHTML = recursoItem
        ? `<div>Recurso: <strong>${recursoItem}</strong></div>`
        : (it.codProduto ? '<div style="color:var(--text-light);"><em>Recurso: ainda não confirmado (definido na entrada da NF)</em></div>' : '');

    const detalhesHTML = `<div class="central-item-detalhes">
        ${it.codProduto ? `<div>Código SmartCompras: ${it.codProduto}</div>` : ''}
        ${nomeOficialSmartCompras ? `<div>Nome oficial SmartCompras: ${nomeOficialSmartCompras}</div>` : ''}
        ${observacao ? `<div>Descrição/observação original SmartCompras: ${observacao}</div>` : ''}
        ${marca ? `<div>Marca: ${marca}</div>` : ''}
        ${it.embalagem ? `<div>Embalagem: ${it.embalagem}</div>` : ''}
        ${it.quantidade ? `<div>Quantidade: ${it.quantidade}</div>` : ''}
        ${it.precoUnitario ? `<div>Valor Unitário: R$ ${it.precoUnitario}</div>` : ''}
        ${it.precoTotal ? `<div>Valor Total: R$ ${it.precoTotal}</div>` : ''}
        ${recursoHTML}
        ${participantesDetalheHTML}
        ${renderAssociacaoSpDataWidget(it, chaveUnica)}
    </div>`;

    const resumoMeta = [it.codProduto ? `Cód. ${it.codProduto}` : '', it.quantidade ? `Qtd ${it.quantidade}` : ''].filter(Boolean).join(' · ');

    // Fase 27: linha única recolhível — cabeçalho (nome, SP Data, status) e,
    // ao abrir, cotação + comparação Cotação × NF × ERP + divergências da
    // auditoria do MESMO item. Abre/fecha por classe (sem redesenhar a tela).
    const c = ctx || {};
    const badges = (c.comp ? (c.comp.divergencias.length && c.comp.resolvido
            ? `<span class="xml-item-badge pronto">✓ Resolvido</span>`
            : c.comp.divergencias.length
            ? `<span class="xml-item-badge pendente">⚠ ${c.comp.divergencias.length} diverg.</span>`
            : (!c.comp.temNf && c.comp.temErp) ? `<span class="xml-item-badge pronto">Lançado no ERP</span>`
            : `<span class="xml-item-badge pronto">✓ Confere</span>`) : (c.chegou ? `<span class="xml-item-badge pronto">Chegou</span>` : ''))
        + (c.divsPendentes ? ` <span class="xml-item-badge pendente">Auditoria pendente</span>` : '');
    return `<div class="central-item-linha central-prod${expandido ? ' aberto' : ''}">
        <div class="central-prod-cab" onclick="toggleCentralProduto('${chaveUnica}', this)">
            ${tituloHTML}
            ${spDataSubtituloHTML}
            <div class="central-item-meta"><span>${resumoMeta}${participantesResumo}</span><span class="central-prod-badges">${badges}<i class="fa-solid fa-chevron-down central-item-chevron"></i></span></div>
        </div>
        <div class="central-colapso"><div class="central-colapso-inner">
            ${detalhesHTML}
            ${c.compHTML ? `<div class="central-secao-titulo">Comparação Cotação × NF × ERP</div>${c.compHTML}` : ''}
            ${c.divsHTML ? `<div class="central-secao-titulo">Divergências (auditoria)</div>${c.divsHTML}` : ''}
        </div></div>
    </div>`;
}
function toggleCentralProduto(chave, el) {
    const abrir = !centralProdutosExpandidos.has(chave);
    if (abrir) centralProdutosExpandidos.add(chave); else centralProdutosExpandidos.delete(chave);
    const linha = el && el.closest ? el.closest('.central-item-linha') : null;
    if (linha) linha.classList.toggle('aberto', abrir); // só troca a classe: animação suave, sem redesenhar
    else renderCentralPedidoCompleto(centralPedidoAtual);
}

function toggleCentralFornecedor(cnpj, el) {
    const abrir = !centralFornecedoresAbertos.has(cnpj);
    if (abrir) centralFornecedoresAbertos.add(cnpj); else centralFornecedoresAbertos.delete(cnpj);
    const card = el && el.closest ? el.closest('.central-fornecedor') : null;
    if (card) card.classList.toggle('aberto', abrir);
    else renderCentralPedidoCompleto(centralPedidoAtual);
}
function toggleCentralStatusForm(key) {
    if (centralStatusFormAberto.has(key)) centralStatusFormAberto.delete(key);
    else centralStatusFormAberto.add(key);
    renderCentralPedidoCompleto(centralPedidoAtual);
}

async function confirmarAlteracaoStatusCentral(anotacaoId, ocIdx, divIdx) {
    const key = `${ocIdx}-${divIdx}`;
    const select = document.getElementById(`central-status-select-${key}`);
    const obsInput = document.getElementById(`central-status-obs-${key}`);
    const novoStatus = select.value;
    const observacao = obsInput.value.trim();

    const nota = listaAnotacoes.find(a => a.id === anotacaoId);
    if (!nota) return;
    // Clona profundamente antes de mexer — nunca muta o array em memória
    // direto, só depois que o Firestore confirmar a escrita.
    const ocorrencias = JSON.parse(JSON.stringify(nota.ocorrencias || []));
    const oc = ocorrencias[ocIdx];
    if (!oc || !oc.divergencias || !oc.divergencias[divIdx]) return;
    const d = oc.divergencias[divIdx];
    d.status = novoStatus;
    if (!d.historico) d.historico = [];
    // HISTÓRICO NUNCA É APAGADO — só acrescenta uma entrada nova. O texto
    // gerado/salvo na anotação continua exatamente como estava.
    const tipoEntrada = novoStatus === 'resolvida' ? 'resolucao' : novoStatus === 'encerrada' ? 'encerramento' : 'reabertura';
    d.historico.push({ tipo: tipoEntrada, data: new Date().toISOString().slice(0, 10), observacao });

    try {
        await anotacoesTextoCollection.doc(anotacaoId).update({ ocorrencias, atualizadoEm: new Date().toISOString() });
        toast('✓ Status atualizado.');
        centralStatusFormAberto.delete(key);
        renderCentralPedidoCompleto(centralPedidoAtual);
    } catch (e) {
        console.error('Erro ao atualizar status da divergência:', e);
        toast('✕ Erro ao atualizar status.');
    }
}

// Origem/Data do Pedido/Data Limite/Observação editáveis direto na Central
// (igual ao Gerenciador de NF: abrir, editar, salvar, sem trocar de tela) —
// grava só esses campos em cotacoes/{pedido}, nunca mexe em fornecedores/
// itens (esses continuam vindo só da importação do XML ou cadastro manual).
async function salvarCabecalhoCotacaoCentral() {
    if (!centralPedidoAtual) return;
    const dados = {
        origem: document.getElementById('central-origem').value,
        dataPedido: document.getElementById('central-data-pedido').value,
        dataLimite: document.getElementById('central-data-limite').value,
        observacao: document.getElementById('central-observacao-cotacao').value.trim(),
        atualizadoEm: new Date().toISOString()
    };
    try {
        await cotacoesCollection.doc(centralPedidoAtual).set(dados, { merge: true });
        const nota = listaAnotacoes.find(a => a.pedido === centralPedidoAtual);
        if (nota) {
            const novoTitulo = dados.origem ? `${centralPedidoAtual} - ${dados.origem}` : centralPedidoAtual;
            if (novoTitulo !== nota.titulo) await anotacoesTextoCollection.doc(nota.id).update({ titulo: novoTitulo });
        }
        toast('✓ Salvo.');
        // Sem isso, o título/dados na tela ficavam desatualizados até a
        // próxima ação que disparasse um re-render — o listener do Firestore
        // não está amarrado a essa tela.
        renderCentralPedidoCompleto(centralPedidoAtual);
    } catch (e) {
        console.error('Erro ao salvar dados do pedido:', e);
        toast('✕ Erro ao salvar.');
    }
}

function iniciarAuditoriaDoPedidoCentral() {
    const pedido = centralPedidoAtual;
    abrirNovaAuditoria();
    document.getElementById('aud-pedido').value = pedido;
    buscarCotacaoParaAuditoria();
}

function abrirTextoLivreDoPedidoCentral() {
    const nota = listaAnotacoes.find(a => a.pedido === centralPedidoAtual);
    if (!nota) return toast('Nenhuma anotação encontrada para este pedido ainda.');
    voltarAnotacaoEditorParaCentral = centralPedidoAtual;
    abrirAnotacao(nota.id, true);
}

function voltarParaListaAnotacoes() {
    if (voltarAnotacaoEditorParaCentral) {
        const pedido = voltarAnotacaoEditorParaCentral;
        voltarAnotacaoEditorParaCentral = null;
        abrirCentralPedido(pedido);
        return;
    }
    switchToScreen('screen-anotacoes', 'Anotações');
}

let autoSaveAnotacaoTimeout = null;
function agendarAutoSaveAnotacao() {
    atualizarEstadoToolbarAnotacao();
    clearTimeout(autoSaveAnotacaoTimeout);
    autoSaveAnotacaoTimeout = setTimeout(() => salvarAnotacaoAtual(false), 1200);
}

async function salvarAnotacaoAtual(mostrarToast) {
    const tituloEl = document.getElementById('anotacao-titulo');
    const corpoEl = document.getElementById('anotacao-corpo');
    if (!tituloEl || !corpoEl) return;

    const titulo = tituloEl.value.trim();
    const conteudo = corpoEl.innerHTML;

    // Nada digitado ainda numa anotação nova: não cria lixo no banco.
    if (!anotacaoAtualId && !titulo && !stripHtmlAnotacao(conteudo)) {
        if (mostrarToast) toast('Nada para salvar.');
        return;
    }

    const dados = {
        titulo: titulo || 'Sem título',
        conteudo,
        espacamentoLinha: editorEspacamentoLinhaAtual,
        paragrafoCompacto: editorParagrafoCompactoAtual,
        atualizadoEm: new Date().toISOString()
    };

    try {
        if (anotacaoAtualId) {
            await anotacoesTextoCollection.doc(anotacaoAtualId).update(dados);
        } else {
            dados.criadoEm = dados.atualizadoEm;
            const ref = await anotacoesTextoCollection.add(dados);
            anotacaoAtualId = ref.id;
        }
        if (mostrarToast) toast('✓ Anotação salva!');
    } catch (e) {
        console.error('Erro ao salvar anotação:', e);
        if (mostrarToast) toast('✕ Erro ao salvar anotação.');
    }
}

async function copiarTextoAnotacao() {
    const corpoEl = document.getElementById('anotacao-corpo');
    const texto = corpoEl ? corpoEl.innerText.trim() : '';
    if (!texto) return toast('Nada para copiar.');
    await navigator.clipboard.writeText(texto);
    toast('✓ Texto copiado!');
}

async function colarTextoAnotacao() {
    const corpoEl = document.getElementById('anotacao-corpo');
    if (!corpoEl) return;
    try {
        const texto = await navigator.clipboard.readText();
        if (!texto) return toast('Área de transferência vazia.');
        corpoEl.focus();
        document.execCommand('insertText', false, texto);
        agendarAutoSaveAnotacao();
        toast('✓ Texto colado!');
    } catch (e) {
        console.error('Erro ao colar:', e);
        toast('✕ Não foi possível colar. Verifique a permissão de área de transferência.');
    }
}

function limparTextoAnotacao() {
    const corpoEl = document.getElementById('anotacao-corpo');
    if (!corpoEl || !stripHtmlAnotacao(corpoEl.innerHTML)) return toast('Já está vazio.');
    showConfirmModal({
        title: 'Limpar Texto',
        message: 'Isso vai apagar todo o texto desta anotação. O título é mantido.',
        confirmText: 'Limpar',
        confirmClass: 'danger',
        onConfirm: () => {
            corpoEl.innerHTML = '';
            agendarAutoSaveAnotacao();
            toast('✓ Texto limpo.');
        }
    });
}

function excluirAnotacaoAtual() {
    if (!anotacaoAtualId) {
        // anotação nova, ainda não salva - só descarta e volta pra lista sem criar nada
        clearTimeout(autoSaveAnotacaoTimeout);
        document.getElementById('anotacao-titulo').value = '';
        document.getElementById('anotacao-corpo').innerHTML = '';
        switchToScreen('screen-anotacoes', 'Anotações');
        return;
    }
    showConfirmModal({
        title: 'Excluir Anotação',
        message: 'Deseja excluir esta anotação permanentemente?',
        confirmText: 'Excluir',
        confirmClass: 'danger',
        onConfirm: async () => {
            try {
                clearTimeout(autoSaveAnotacaoTimeout);
                await anotacoesTextoCollection.doc(anotacaoAtualId).delete();
                anotacaoAtualId = null;
                document.getElementById('anotacao-titulo').value = '';
                document.getElementById('anotacao-corpo').innerHTML = '';
                toast('🗑️ Anotação excluída.');
                switchToScreen('screen-anotacoes', 'Anotações');
            } catch (e) {
                console.error('Erro ao excluir anotação:', e);
                toast('✕ Erro ao excluir.');
            }
        }
    });
}

// Formatação de texto rico (negrito, itálico, títulos, listas). execCommand
// ainda funciona bem pra esses comandos básicos em todos os navegadores atuais,
// apesar de "deprecated" — é a forma mais simples de dar edição tipo
// Word/Notion sem precisar de uma biblioteca externa pesada.
function formatarTextoAnotacao(comando, valor) {
    document.getElementById('anotacao-corpo').focus();
    document.execCommand(comando, false, valor || null);
    agendarAutoSaveAnotacao();
    atualizarEstadoToolbarAnotacao();
}

// --- Estado visual da toolbar (negrito/itálico/sublinhado/bloco ativos, e
// undo/redo habilitados) — precisa refletir o estado REAL do cursor/seleção
// a cada momento, não um valor fixo marcado uma vez. Atualiza via
// selectionchange (filtrado pro editor de anotações), a cada digitação, e
// logo depois de qualquer comando de formatação disparado pelos botões.
function atualizarEstadoToolbarAnotacao() {
    const editor = document.getElementById('anotacao-corpo');
    if (!editor) return;
    ['bold', 'italic', 'underline'].forEach(cmd => {
        const btn = document.querySelector(`.rte-toolbar button[data-cmd="${cmd}"]`);
        if (!btn) return;
        try { btn.classList.toggle('active', document.queryCommandState(cmd)); } catch (e) {}
    });
    let blocoAtual = '';
    try { blocoAtual = (document.queryCommandValue('formatBlock') || '').toUpperCase(); } catch (e) {}
    document.querySelectorAll('.rte-toolbar button[data-block]').forEach(btn => {
        const alvo = btn.dataset.block;
        const ehParagrafoPadrao = alvo === 'P' && (blocoAtual === '' || blocoAtual === 'DIV' || blocoAtual === 'P');
        btn.classList.toggle('active', blocoAtual === alvo || ehParagrafoPadrao);
    });
    ['undo', 'redo'].forEach(cmd => {
        const btn = document.querySelector(`.rte-toolbar button[data-cmd="${cmd}"]`);
        if (!btn) return;
        try { btn.disabled = !document.queryCommandEnabled(cmd); } catch (e) { /* navegador sem suporte — deixa habilitado */ }
    });
}
document.addEventListener('selectionchange', () => {
    const editor = document.getElementById('anotacao-corpo');
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !editor.contains(sel.anchorNode)) return;
    atualizarEstadoToolbarAnotacao();
});

// --- Popovers da barra de ferramentas (cor, tamanho, grade de tabela) ---
// Guarda a seleção de texto feita no editor antes de abrir um popover — clicar
// num botão da toolbar tiraria o foco do editor e perderia a seleção, então
// salvamos o Range aqui (o onmousedown com preventDefault nos botões evita que
// o navegador desfaça a seleção antes mesmo do clique acontecer).
let rteSelecaoSalva = null;
function salvarSelecaoRte() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && document.getElementById('anotacao-corpo').contains(sel.anchorNode)) {
        rteSelecaoSalva = sel.getRangeAt(0).cloneRange();
    }
}
function restaurarSelecaoRte() {
    const editor = document.getElementById('anotacao-corpo');
    editor.focus();
    if (rteSelecaoSalva) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(rteSelecaoSalva);
    }
}
function fecharPopoversRte() {
    document.querySelectorAll('.rte-popover').forEach(p => { p.style.display = 'none'; p.style.left = '0'; p.style.right = 'auto'; });
}
function toggleRtePopover(id) {
    salvarSelecaoRte();
    const pop = document.getElementById(id);
    const estavaAberto = pop.style.display === 'block';
    fecharPopoversRte();
    pop.style.display = estavaAberto ? 'none' : 'block';
    if (id === 'rte-table-popover') montarGradeTabela();
    if (id === 'rte-size-popover') atualizarSizePopoverAtivo();
    if (id === 'rte-spacing-popover') atualizarPopoverEspacamentoAtivo();
    if (!estavaAberto) posicionarPopoverDentroDaTela(pop);
}
// Os botões de tamanho/espaçamento/tabela ficam perto da borda direita da
// toolbar (ela tem 2 fileiras de ícones, muitos botões). O popover sempre
// abria alinhado à esquerda do próprio botão (left:0) sem checar se cabia na
// tela — perto da borda direita ele estourava pra fora e ficava flutuando
// sobre o conteúdo, cortado. Agora mede a posição real antes de mostrar e
// alinha pela direita quando não há espaço suficiente à esquerda.
function posicionarPopoverDentroDaTela(pop) {
    // BUG: limpar left/right pra '' não remove o "left:0" que já vem do CSS
    // base (.rte-popover{left:0}) — ao setar só "right:0" depois, os dois
    // ficavam ativos ao mesmo tempo, e um elemento position:absolute com
    // left E right definidos estica pra preencher o espaço inteiro entre os
    // dois, virando a largura absurda do print. Agora sempre define os DOIS
    // lados explicitamente (um em 'auto', nunca deixando o CSS base valer).
    pop.style.left = '0';
    pop.style.right = 'auto';
    const rect = pop.getBoundingClientRect();
    const margem = 8;
    if (rect.right > window.innerWidth - margem) {
        pop.style.left = 'auto';
        pop.style.right = '0';
    }
    // Reavalia depois de trocar de lado — se ainda estourar pela esquerda
    // (popover mais largo que o espaço disponível), prende na borda da tela.
    const rect2 = pop.getBoundingClientRect();
    if (rect2.left < margem) {
        const wrap = pop.closest('.rte-popover-wrap');
        const wrapRect = wrap.getBoundingClientRect();
        pop.style.right = 'auto';
        pop.style.left = (margem - wrapRect.left) + 'px';
    }
}
document.addEventListener('click', (event) => {
    if (!event.target.closest('.rte-popover-wrap')) fecharPopoversRte();
});

// --- Cor do texto ---
function aplicarCorTextoAnotacao(cor) {
    restaurarSelecaoRte();
    document.execCommand('foreColor', false, cor || 'inherit');
    fecharPopoversRte();
    agendarAutoSaveAnotacao();
}

// --- Tamanho do texto (em px) ---
// execCommand('fontSize') só aceita valores de 1 a 7 (sem controle em px), então
// envolvemos a seleção manualmente num <span style="font-size:Npx">.
function aplicarTamanhoTextoAnotacao(px) {
    restaurarSelecaoRte();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { fecharPopoversRte(); return; }
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = px + 'px';
    try {
        range.surroundContents(span);
    } catch (e) {
        // Seleção atravessa múltiplos elementos (ex: parte de duas linhas) —
        // nesse caso, extrai o conteúdo e envolve manualmente.
        span.appendChild(range.extractContents());
        range.insertNode(span);
    }
    sel.removeAllRanges();
    fecharPopoversRte();
    agendarAutoSaveAnotacao();
}

// Detecta o tamanho de fonte no ponto do cursor/seleção, subindo pela árvore
// do DOM até achar um <span style="font-size:...">. Usado só pra marcar a
// opção certa com um check quando o popover abre — não é fixo, reflete o
// estado real.
function obterTamanhoFonteAtual() {
    const editor = document.getElementById('anotacao-corpo');
    const sel = window.getSelection();
    if (!editor || !sel || !sel.rangeCount) return 16;
    let node = sel.anchorNode;
    if (node && node.nodeType !== 1) node = node.parentNode;
    while (node && node !== editor && editor.contains(node)) {
        if (node.style && node.style.fontSize) {
            const px = parseInt(node.style.fontSize, 10);
            if (!isNaN(px)) return px;
        }
        node = node.parentNode;
    }
    return 16;
}
function atualizarSizePopoverAtivo() {
    const atual = obterTamanhoFonteAtual();
    document.querySelectorAll('.rte-size-option[data-size]').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.size, 10) === atual);
    });
}

// --- Espaçamento entre linhas / parágrafos ---
// Aplicado ao documento inteiro (não por parágrafo — mantém a implementação
// simples, como pedido), e persistido como campo próprio da anotação, então
// volta a aparecer do jeito que foi deixado da próxima vez que a nota abrir.
const ESPACAMENTOS_LINHA_ANOTACAO = { simples: '1.35', '115': '1.55', '15': '1.9', duplo: '2.3' };
let editorEspacamentoLinhaAtual = '';
let editorParagrafoCompactoAtual = false;
function aplicarEstadoEspacamentoEditor(valorLineHeight, compacto) {
    const editor = document.getElementById('anotacao-corpo');
    if (!editor) return;
    editor.style.lineHeight = valorLineHeight || '';
    editor.classList.toggle('rte-compacto', !!compacto);
    editorEspacamentoLinhaAtual = valorLineHeight || '';
    editorParagrafoCompactoAtual = !!compacto;
}
function aplicarEspacamentoLinhaAnotacao(chave) {
    const valor = ESPACAMENTOS_LINHA_ANOTACAO[chave] || '';
    const editor = document.getElementById('anotacao-corpo');
    if (editor) editor.style.lineHeight = valor;
    editorEspacamentoLinhaAtual = valor;
    atualizarPopoverEspacamentoAtivo();
    fecharPopoversRte();
    agendarAutoSaveAnotacao();
}
function alternarParagrafoCompactoAnotacao() {
    const editor = document.getElementById('anotacao-corpo');
    if (!editor) return;
    editorParagrafoCompactoAtual = !editorParagrafoCompactoAtual;
    editor.classList.toggle('rte-compacto', editorParagrafoCompactoAtual);
    atualizarPopoverEspacamentoAtivo();
    agendarAutoSaveAnotacao();
}
function atualizarPopoverEspacamentoAtivo() {
    document.querySelectorAll('.rte-size-option[data-spacing]').forEach(btn => {
        btn.classList.toggle('active', (ESPACAMENTOS_LINHA_ANOTACAO[btn.dataset.spacing] || '') === editorEspacamentoLinhaAtual);
    });
    const btnCompacto = document.getElementById('rte-btn-compacto');
    if (btnCompacto) btnCompacto.classList.toggle('active', editorParagrafoCompactoAtual);
}

// --- Tabela: grade visual estilo Word/Google Docs, em vez de prompt() ---
function montarGradeTabela() {
    const grid = document.getElementById('rte-table-grid');
    const label = document.getElementById('rte-table-grid-label');
    if (grid.childElementCount > 0) return; // já montada, só reaproveita
    for (let l = 1; l <= 6; l++) {
        for (let c = 1; c <= 6; c++) {
            const cell = document.createElement('div');
            cell.dataset.linhas = l;
            cell.dataset.colunas = c;
            cell.onmouseenter = () => destacarGradeTabela(l, c);
            cell.onclick = () => { inserirTabelaAnotacao(l, c); };
            grid.appendChild(cell);
        }
    }
    grid.onmouseleave = () => { label.textContent = 'Selecione o tamanho'; destacarGradeTabela(0, 0); };
}
function destacarGradeTabela(linhas, colunas) {
    document.getElementById('rte-table-grid-label').textContent = linhas && colunas ? `${linhas} x ${colunas}` : 'Selecione o tamanho';
    document.querySelectorAll('#rte-table-grid div').forEach(cell => {
        const l = parseInt(cell.dataset.linhas), c = parseInt(cell.dataset.colunas);
        cell.classList.toggle('rte-cell-hover', l <= linhas && c <= colunas);
    });
}

// Insere uma tabela editável no ponto do cursor — permite montar ou colar um
// pedaço de planilha (ao copiar células do Excel/Google Sheets e colar aqui
// dentro, o navegador já preserva a tabela automaticamente também).
function inserirTabelaAnotacao(linhas, colunas) {
    if (!linhas || !colunas) return;
    restaurarSelecaoRte();

    let html = '<table class="anotacao-tabela"><tbody>';
    for (let i = 0; i < linhas; i++) {
        html += '<tr>';
        for (let j = 0; j < colunas; j++) {
            html += '<td>&nbsp;</td>';
        }
        html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';

    document.execCommand('insertHTML', false, html);
    fecharPopoversRte();
    agendarAutoSaveAnotacao();
}


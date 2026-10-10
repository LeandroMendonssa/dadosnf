// 03-dados-notas.js — Lógica de dados e Firebase das notas
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// --- LÓGICA DE DADOS E FIREBASE ---

// Função Auxiliar: Verificar Duplicidade
// Fase 41: cruzamento de NFs. O relatório do ERP corta o nome do fornecedor em ~30 caracteres e o nome digitado pode ser outro
// (apelido), então comparar só o nome deixava passar a mesma NF como se fosse outra. Regras (todas determinísticas):
//  1) mesma NF + nome igual (como sempre);
//  2) mesma NF + um nome é o COMEÇO do outro (mín. 10 letras) — o caso do nome cortado;
//  3) quando o valor é informado: mesmo nº de NF (sem zeros à esquerda) + MESMO VALOR (2 campos independentes).
function normNfNumero(v) {
    const t = String(v == null ? '' : v).trim();
    const d = t.replace(/\D/g, '').replace(/^0+/, '');
    return d || t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
function normSerieNf(v) { return String(v == null ? '' : v).replace(/\D/g, '').replace(/^0+/, ''); }
function valorNfNumerico(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isNaN(v) ? null : v;
    let t = String(v).replace(/R\$/gi, '').replace(/\s/g, '');
    if (!t) return null;
    const n = t.includes(',') ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : parseFloat(t);
    return isNaN(n) ? null : n;
}
function valoresNfIguais(a, b) {
    const x = valorNfNumerico(a), y = valorNfNumerico(b);
    return x !== null && y !== null && x > 0 && Math.abs(x - y) < 0.01;
}
function verificarDuplicidade(novoForn, novaNF, novoValor) {
    if (!novaNF) return null; // Se não tem NF, não verifica

    // Normaliza strings para evitar erros por espaços ou minúsculas (ex: "ABC " == "abc")
    const normalize = (str) => str ? str.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
    const nfNormalizada = normalize(novaNF);
    const fornNormalizado = normalize(novoForn);
    const nomesBatem = (a, b) => a === b || (a && b && Math.min(a.length, b.length) >= 10 && (a.startsWith(b) || b.startsWith(a)));

    const bate = (nota) => {
        const notaNF = normalize(nota.nf);
        const notaForn = normalize(nota.fornecedor);
        // Regra: Mesmo fornecedor (ou nome cortado) E mesma NF. A comparação da NF é estrita na normalização,
        // o que pega "123.456" igual a "123456".
        return notaNF === nfNormalizada && nomesBatem(notaForn, fornNormalizado);
    };
    const batePorValor = (nota) => novoValor !== undefined && normNfNumero(nota.nf) === normNfNumero(novaNF) && valoresNfIguais(nota.valor, novoValor);

    const pendente = notasPendentes.find(bate);
    if (pendente) return { nota: pendente, origem: 'pendente' };

    // Também verifica notas já arquivadas no Histórico — evita reimportar uma
    // NF de um relatório do ERP que já foi processada e arquivada antes (o
    // problema de "esquecer qual foi a última NF importada").
    const arquivada = historicoNotas.find(bate);
    if (arquivada) return { nota: arquivada, origem: 'historico' };

    const pendenteValor = notasPendentes.find(batePorValor);
    if (pendenteValor) return { nota: pendenteValor, origem: 'pendente', porValor: true };
    const arquivadaValor = historicoNotas.find(batePorValor);
    if (arquivadaValor) return { nota: arquivadaValor, origem: 'historico', porValor: true };

    return null;
}

async function salvarNota(){
    const fornecedor = DOM.forn.value.trim().toUpperCase();
    const nf = DOM.nf.value.trim();
    
    if(!fornecedor) {
        DOM.forn.classList.add('input-error');
        setTimeout(() => DOM.forn.classList.remove('input-error'), 500);
        return toast("O campo 'Fornecedor' é obrigatório.");
    }

    // VERIFICAÇÃO DE DUPLICIDADE
    const duplicata = verificarDuplicidade(fornecedor, nf);
    
    if (duplicata) {
        DOM.nf.classList.add('input-error');
        DOM.forn.classList.add('input-error');
        setTimeout(() => {
            DOM.nf.classList.remove('input-error');
            DOM.forn.classList.remove('input-error');
        }, 1000);

        const mensagemOrigem = duplicata.origem === 'historico'
            ? `Já existe uma nota ARQUIVADA (histórico) para o fornecedor "${fornecedor}" com a NF "${nf}".`
            : `Já existe uma nota PENDENTE para o fornecedor "${fornecedor}" com a NF "${nf}".`;

        showConfirmModal({
            title: "Nota Duplicada",
            message: `${mensagemOrigem} Deseja salvar mesmo assim?`,
            confirmText: "Sim, Salvar",
            confirmClass: "warning",
            onConfirm: () => executaSalvamento(fornecedor, nf)
        });
        return;
    }

    await executaSalvamento(fornecedor, nf);
}

async function executaSalvamento(fornecedor, nf) {
    const salvarBtn = document.getElementById('salvarBtn');
    salvarBtn.disabled = true;
    salvarBtn.innerHTML = '<span class="icon-wrapper"><i class="fa-solid fa-spinner fa-spin"></i></span> Salvando...';

    try{
        const checklistInicial = Object.keys(checklistDefinition).reduce((acc,key)=>({...acc,[key]:!1}),{});
        checklistInicial.tirarFoto = false; 

        const novaNotaRef = await notasCollection.add({
            data: DOM.data.value.trim(),
            nf: nf,
            vencimento: DOM.venc.value.trim(),
            valor: DOM.valor.value.trim(),
            fornecedor,
            obs: DOM.obs.value.trim(),
            enviada: false,
            dataCriacao: (new Date).toISOString(),
            checklist: checklistInicial
        });

        await adicionarFornecedor(fornecedor, true);
        await vincularNotaCriadaAoControle(novaNotaRef.id, nf); // Fase 38

        toast("✓ Nota salva com sucesso!")
        
        // Limpa tudo e foca na NF para a próxima nota
        limparFormularioPrincipal(true); 

    } catch(e) {
        console.error("Erro ao salvar nota:", e);
        toast("✕ Erro ao salvar a nota.");
    } finally {
        salvarBtn.disabled = false;
        // Reseta o visual do botão (chamando a função de limpar sem foco apenas para resetar o texto do botão)
        const botaoOriginal = document.getElementById('salvarBtn');
        botaoOriginal.innerHTML = `<span class="icon-wrapper"><i class="fa-solid fa-save"></i><span class="material-icons">save</span></span> Salvar`;
    }
}

// Fase 26: ao digitar a NF na tela Adicionar, sugere dados de notas do
// HISTÓRICO com exatamente esse número (comparação exata, sem aproximação).
// Só sugere: nada é preenchido até o usuário tocar numa sugestão.
let sugestoesNfAtuais = [];
function atualizarSugestoesNf() {
    const box = document.getElementById('nf-sugestoes');
    if (!box) return;
    const norm = x => x ? x.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
    const alvo = norm(DOM.nf.value);
    sugestoesNfAtuais = [];
    if (alvo) {
        const vistos = new Set();
        historicoNotas.filter(n => norm(n.nf) === alvo)
            .sort((a, b) => String(b.dataCriacao || '').localeCompare(String(a.dataCriacao || '')))
            .forEach(n => {
                const k = [norm(n.fornecedor), n.valor, n.vencimento].join('|');
                if (vistos.has(k) || sugestoesNfAtuais.length >= 4) return;
                vistos.add(k);
                sugestoesNfAtuais.push(n);
            });
    }
    box.innerHTML = sugestoesNfAtuais.length
        ? `<div class="nota-detalhes" style="margin:4px 0;">Já no histórico com esta NF — toque para preencher:</div>` + sugestoesNfAtuais.map((n, i) =>
            `<button type="button" class="central-status-toggle" style="display:block;width:100%;text-align:left;margin-bottom:6px;white-space:normal;" onclick="aplicarSugestaoNf(${i})">${escRel(n.fornecedor || '—')}${n.valor ? ' · R$ ' + escRel(n.valor) : ''}${n.vencimento ? ' · venc. ' + escRel(n.vencimento) : ''}${n.obs ? ' · ' + escRel(n.obs) : ''}</button>`).join('')
        : '';
}
function aplicarSugestaoNf(i) {
    const n = sugestoesNfAtuais[i];
    if (!n) return;
    if (n.fornecedor) DOM.forn.value = n.fornecedor;
    if (n.valor) DOM.valor.value = n.valor;
    if (n.vencimento) DOM.venc.value = n.vencimento;
    if (n.obs && [...DOM.obs.options].some(o => o.value === n.obs)) DOM.obs.value = n.obs;
    sugestoesNfAtuais = [];
    const box = document.getElementById('nf-sugestoes');
    if (box) box.innerHTML = '';
    toast('✓ Campos preenchidos com a nota do histórico. Confira antes de salvar.');
}
if (DOM.nf) DOM.nf.addEventListener('input', atualizarSugestoesNf);

// Função de limpeza atualizada (SEMPRE limpa tudo)
function limparFormularioPrincipal(comFoco=true){
    const today = new Date();
    DOM.data.value = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
    
    // Limpa todos os campos incondicionalmente
    DOM.forn.value = "";
    DOM.obs.value = "";
    DOM.nf.value = "";
    DOM.venc.value = "";
    DOM.valor.value = "";
    atualizarSugestoesNf();
    
    // Reset do Botão (Visual)
    const salvarBtn = document.getElementById('salvarBtn');
    salvarBtn.innerHTML = `<span class="icon-wrapper"><i class="fa-solid fa-save"></i><span class="material-icons">save</span></span> Salvar`;
    
    if(comFoco) setTimeout(()=>DOM.nf.focus(), 350);
}


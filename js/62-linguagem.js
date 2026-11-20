// 62-linguagem.js — Linguagem do aplicativo (2.62.0)
// Camada única de linguagem da INTERFACE: toasts, saudação, textos de tela vazia e orientações.
// REGRA: este arquivo só é chamado por js/07 (toast), js/05 e js/48 (telas). Relatórios, PDFs, Word, textos de saída,
// auditorias e qualquer conteúdo oficial NÃO usam LING e nunca recebem a linguagem "Sem paciência".
// Em caso de dúvida sobre um texto, ele fica na linguagem Normal.
const LING = (function () {
    const CHAVE = 'linguagemApp';
    const OPCOES = {
        n: { nome: 'Normal', exemplo: 'Exemplo: "Não foi possível salvar. Tente novamente."' },
        s: { nome: 'Sem paciência', exemplo: 'Exemplo: "Não salvou. O sistema resolveu fazer greve sozinho. Tenta de novo."' }
    };
    // Mensagens de toast por situação. "re" casa com o texto neutro (sem o ícone). Só situações genéricas: textos com
    // detalhes próprios (nomes, números) continuam neutros para não perder informação.
    const REGRAS = [
        { id: 'erro-salvar', re: /^(Erro ao salvar|Não consegui salvar|Não foi possível salvar)\.?( Tente (novamente|de novo)\.)?$/, s: [
            'Não salvou. O sistema resolveu fazer greve sozinho. Tenta de novo.',
            'Deu erro ao salvar. Na hora H ele sempre arruma uma desculpa. Tenta outra vez.',
            'Salvar era o único trabalho dele e ele deu um jeito de falhar. Tenta de novo.',
            'Não rolou salvar. Respira e tenta de novo, a culpa não é sua.',
            'Não salvou. E o pior é que ninguém ficou surpreso.'] },
        { id: 'erro-excluir', re: /^(Erro ao excluir|Não foi possível excluir|Não foi possível remover)\.?$/, s: [
            'Não apagou. Até sumir com as coisas aqui dá trabalho.',
            'Excluir deu erro. Nem pra apagar o sistema ajuda.',
            'Não consegui apagar. Aqui nada sai sem resistência.'] },
        { id: 'erro-ler', re: /^(Erro ao ler o arquivo|Não foi possível ler o arquivo)\.?$/, s: [
            'Esse arquivo não abriu. Pode ser o formato, pode ser praga. Tenta outro.',
            'Não consegui ler o arquivo. Dependendo de onde veio, nem estranho.',
            'Arquivo ilegível. Confere se é o certo e tenta de novo.'] },
        { id: 'erro-importar', re: /^Erro ao importar\.?( Tente (novamente|de novo)\.)?$/, s: [
            'A importação deu erro. Claro que ia ser logo agora.',
            'Não importou. Tenta de novo, que desistir não é opção.',
            'Importação falhou. Mais uma pro caderninho.'] },
        { id: 'erro-gerar', re: /^Erro ao gerar o arquivo\.?$/, s: [
            'O arquivo não saiu. Tenta de novo que uma hora vai.',
            'Não consegui gerar o arquivo. O dia não tá fácil pra ninguém.'] },
        { id: 'pdf-lib', re: /biblioteca de PDF ainda não carregou/, s: [
            'A parte de PDF ainda tá acordando. Dá um minutinho e tenta de novo.',
            'O PDF ainda não levantou da cama. Espera um instante e tenta de novo.'] },
        { id: 'excluida', re: /^(🗑️\s*)?(Anotação|Nota|Cotação) excluída!?\.?$/, pre: '🗑️ ', s: [
            'Já era.', 'Apagada. Menos uma pra se preocupar.', 'Sumiu. Ninguém sentirá falta.', 'Excluída, sem choro nem vela.'] },
        { id: 'copiado', re: /^(Copiado|Resposta copiada)\b/, s: [
            'Copiou. Agora é só colar e torcer.', 'Copiado. Pode colar onde quiser.', 'Tá na área de transferência. Missão cumprida.'] },
        { id: 'colado', re: /^Texto colado!?$/, s: [
            'Colou. Vamos ver o que vem por aí.', 'Texto colado. Agora vem a parte divertida.', 'Colado. Vamos ver no que isso dá.'] },
        { id: 'gerado', re: /^(Arquivo gerado|PDF gerado)\.?$/, s: [
            'Arquivo pronto. Nem demorou tanto.', 'Gerou. Hoje o sistema tá colaborando.', 'Pronto, saiu. Pode conferir.'] },
        { id: 'nada-para', re: /^Nada para (salvar|copiar|compartilhar)\.?$/, s: [
            'Não tem nada pra $1. Dá pra fazer muita coisa, mas milagre não.',
            'Nada pra $1. O vazio é total.'] },
        { id: 'nf-nao-encontrada', re: /^NF não encontrada\.?$/, s: [
            'Essa NF não apareceu. Ou não existe, ou tá se escondendo.',
            'NF não encontrada. Já olhei até debaixo do tapete.'] },
        { id: 'tudo-certo', re: /^Tudo certo[.!]?$/, semNome: true, s: [
            'Pronto, resolvido. Foi quase indolor.', 'Tudo certo. Pode comemorar baixinho.', 'Feito. Antes que inventem outra coisa.'] },
        { id: 'sel-cotacao', re: /^Selecione ao menos uma cotação\.?$/, s: [
            'Sem cotação marcada não tem o que fazer. Marca uma aí.', 'Falta marcar uma cotação. Eu não adivinho.'] },
        { id: 'cole-texto', re: /^Cole o texto do relatório antes de processar\.?$/, s: [
            'Tá vazio aqui. Cola o texto do relatório que aí a gente conversa.', 'Sem texto, sem relatório. Cola o conteúdo primeiro.'] },
        { id: 'digite-forn', re: /^Digite o nome do fornecedor\.?$/, s: [
            'Faltou o nome do fornecedor. Sem ele eu não adivinho.', 'Preciso do nome do fornecedor. Sem isso fica difícil.'] },
        { id: 'sem-pendencias', re: /^Não há pendências para exportar\.?$/, s: [
            'Nenhuma pendência pra exportar. Será verdade? Aproveita.', 'Zero pendências. Anota a data que é raro.'] },
        { id: 'nf-no-pedido', re: /^A NF já está nesse pedido\.?$/, s: [
            'Essa NF já tá nesse pedido. Duas vezes não adianta.', 'Já tá aqui dentro. Não precisa insistir.'] }
    ];
    // Textos fixos (não rotacionam): orientações, telas vazias, saudação. Só valem na linguagem "Sem paciência";
    // na Normal vale o texto original que o chamador já tem.
    const FIXAS = {
        'forn-dica': 'Toca no fornecedor pra abrir o pedido. Na seta do lado ficam os produtos que ainda faltam chegar. O resumo pra enviar fica em Início > Resumo de pendências (o documento sai sério, a bronca fica só aqui).',
        'vazio-saida': { t: 'Nada pra saída por enquanto', p: 'Silêncio total. Aproveita antes que apareça alguma coisa.' },
        'ini-sem-forn': 'Nenhum fornecedor pendente nos pedidos. Alguém entregou no prazo? Anota a data.',
        'ini-sem-nf': { t: 'Nenhuma NF aberta', p: 'Relação vazia. Nem parece o almoxarifado.' },
        'ini-calc': 'Calculando… paciência, que a pressa é inimiga do perfeito.'
    };
    const SAUDACAO = [
        'Vamos ver o que a rotina aprontou hoje.', 'Mais um dia, mais uma pilha de pendência.', 'O café já foi? Então bora.',
        'Se tiver fornecedor atrasado, já aviso que não é novidade.', 'Respira fundo, que o dia ainda nem começou direito.', 'Bora sobreviver a mais um dia de operação.'
    ];
    /* leandromendonssa */
    const ultimo = {};
    let modo = 'n';
    try { const v = localStorage.getItem(CHAVE); if (v === 's') modo = 's'; } catch (e) { }

    function sorteia(id, lista) {
        if (lista.length === 1) return lista[0];
        let i; do { i = Math.floor(Math.random() * lista.length); } while (i === ultimo[id]);
        ultimo[id] = i; return lista[i];
    }
    // Para o toast: devolve o texto na linguagem escolhida, ou null para manter o original.
    function toast(texto, ehSucesso, ehErro) {
        if (modo !== 's' || !texto) return null;
        for (const r of REGRAS) {
            const m = texto.match(r.re); if (!m) continue;
            let t = sorteia(r.id, r.s).replace('$1', m[1] || '');
            return (r.pre || '') + t;
        }
        return null;
    }
    function fixa(id, neutro) { if (modo !== 's') return neutro; const v = FIXAS[id]; return v === undefined ? neutro : v; }
    // Frase curta da saudação: estável durante a mesma hora (não muda a cada redesenho do Início).
    function saudacaoExtra() {
        if (modo !== 's') return '';
        const d = new Date(), semente = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + d.getHours();
        return SAUDACAO[semente % SAUDACAO.length];
    }
    function aplicarFixas() {
        const el = document.getElementById('forn-dica');
        if (el) { if (!el.dataset.neutro) el.dataset.neutro = el.textContent; el.textContent = fixa('forn-dica', el.dataset.neutro); }
        const ex = document.getElementById('ling-ex'); if (ex) ex.textContent = OPCOES[modo].exemplo;
        ['n', 's'].forEach(k => { const b = document.getElementById('ling-' + k); if (b) b.setAttribute('aria-pressed', String(modo === k)); });
    }
    function definir(m) {
        modo = m === 's' ? 's' : 'n';
        try { localStorage.setItem(CHAVE, modo); } catch (e) { }
        aplicarFixas();
        try { if (typeof renderInicioSeAtivo === 'function') renderInicioSeAtivo(); } catch (e) { }
        try { if (typeof rebuildNotasPendentesList === 'function') rebuildNotasPendentesList(); } catch (e) { }
    }
    document.querySelectorAll('[data-ling]').forEach(b => b.addEventListener('click', () => definir(b.dataset.ling)));
    aplicarFixas();
    return { toast, fixa, saudacaoExtra, definir, modo: () => modo };
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/62-linguagem.js'] = '2.62.0';

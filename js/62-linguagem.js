// 62-linguagem.js — Linguagem do aplicativo (2.62.0)
// Camada única de linguagem da INTERFACE: toasts, saudação, textos de tela vazia e orientações.
// REGRA: este arquivo só é chamado por js/07 (toast), js/05 e js/48 (telas). Relatórios, PDFs, Word, textos de saída,
// auditorias e qualquer conteúdo oficial NÃO usam LING e nunca recebem a linguagem "Sem paciência".
// Em caso de dúvida sobre um texto, ele fica na linguagem Normal.
const LING = (function () {
    const CHAVE = 'linguagemApp';
    const OPCOES = {
        n: { nome: 'Modo Normal', exemplo: 'Exemplo: "Não foi possível salvar. Tente novamente."' },
        s: { nome: 'Modo Leandro', exemplo: 'Exemplo: "Não salvou. O sistema resolveu fazer greve sozinho. Tenta de novo."' }
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

    // Textos de orientação e telas vazias (2.62.1). Chave = começo do texto original; valor = versão "Sem paciência".
    // A troca é feita por varredura da tela (só <p>, <small>, .empty-state, .ini-vazio) e só quando o texto bate; o original fica guardado para voltar ao Normal.
    const FRASES = [
        ['Procura o lote nos dados atuais', 'Procura o lote nas NFs processadas no app e nas NFs antigas (lotes lidos dos PDFs). Cada resultado diz de onde veio, pra ninguém ter que adivinhar.'],
        ['Um lote por linha. Procura só no modelo novo', 'Um lote por linha. Procura só nas NFs antigas, aquelas que a gente jurava que nunca ia precisar rever.'],
        ['O PDF da NF usa uma fonte parecida com a Times', 'O PDF da NF usa uma fonte parecida com a Times. Quer a fonte exata (a Times New Roman do seu Windows)? Carrega os arquivos aqui. Ficam só neste aparelho (nunca vão pro Firebase nem pro GitHub) e o tamanho e a posição do texto não mudam.'],
        ['Escolha de uma vez os três arquivos', 'Escolhe os três arquivos de uma vez: Normal, Negrito e Itálico (times.ttf, timesbd.ttf e timesi.ttf, na pasta de fontes do Windows). Sem o Itálico, ele usa a fonte padrão. Cada aparelho guarda a sua cópia, então repete no iPhone e no computador. No iPhone, deixa os arquivos no app Arquivos (iCloud Drive). O uso segue a licença que você já tem.'],
        ['Histórico de alterações do SmartCompras', 'Aqui ficam as alterações de quantidade do SmartCompras, guardadas por pedido, pra busca e conferência não dependerem da memória de ninguém.'],
        ['Arraste o botão abaixo para a barra de favoritos', 'Arrasta o botão aí embaixo pra barra de favoritos do Chrome ou do Edge. Sem copiar código, que a gente já sofre o bastante.'],
        ['Depois, abra o Histórico de Pedidos', 'Depois abre o Histórico de Pedidos no SmartCompras e toca no favorito. Abre uma janelinha pra conferir e salvar.'],
        ['No celular não dá para arrastar', 'No celular não dá pra arrastar. Copia o código aí embaixo, cria um favorito qualquer, edita o endereço e cola o código. É um jeitinho, mas funciona.'],
        ['No iPhone, este favorito abre o app inteiro', 'No iPhone, esse favorito abre o app inteiro, como antes. Depois de confirmar aqui, o histórico salva normalmente.'],
        ['Cole ou envie o relatório de cadastro de fornecedores', 'Cola ou envia o relatório de cadastro de fornecedores do SP Data (código, CNPJ, nome real e nome exibido). Serve pra confirmar a qual NF/cotação cada lançamento do ERP corresponde, e nunca por semelhança de nome, porque achismo já tem demais. Atualização incremental: nunca apaga fornecedor, CNPJ ou apelido já cadastrado.'],
        ['Baixa um arquivo com todas as suas notas pendentes', 'Baixa um arquivo com todas as suas notas pendentes, histórico, anotações, fornecedores e configurações. É a sua cópia de segurança, guardada no aparelho, independente do Firebase. Melhor ter e não precisar.'],
        ['Exporta TODOS os dados do app', 'Exporta TODOS os dados do app (NFs processadas, entradas do ERP, cotações, associações, fornecedores, exceções de conversão e o resto) num arquivo só, pra analisar casos reais fora do app. Só lê, não mexe em nada.'],
        ['Guarde o arquivo em um lugar seguro', 'Guarda o arquivo num lugar seguro (iCloud Drive, Google Drive, e-mail pra você mesmo). Ele não vai pra lugar nenhum: o download acontece direto no seu navegador.'],
        ['Cadastro manual: use quando a NF não tem XML', 'Cadastro manual é pra quando a NF não tem XML. Com XML, volta pra "Por XML" e poupa o trabalho.'],
        ['Importe o XML da NF-e do fornecedor', 'Importa o XML da NF-e do fornecedor. O sistema identifica os produtos, ajusta a conversão pra unidade de dispensação e ajuda a ligar cada item à cotação antes de seguir pro ERP. Menos digitação, menos sofrimento.'],
        ['Cole o texto do relatório do SGH', 'Cola o texto do relatório do SGH com Código, Nome e Unidade. Qualquer um serve (Listagem de itens, por grupo, por subgrupo...), mas prefira um com a coluna de nome mais larga, como "Itens por subgrupo II", pra vir menos cortado.'],
        ['Complementa a cotação com a quantidade de fornecedores', 'Complementa a cotação com a quantidade de fornecedores que participaram de cada item (nunca decide recurso ou pagamento sozinho). Cola o texto ou envia o arquivo do relatório.'],
        ['Nenhuma cotação cadastrada para este pedido ainda.', 'Nenhuma cotação nesse pedido ainda. Quando alguém lembrar de cadastrar, aparece aqui.'],
        ['Salva automaticamente. Pra formatação completa', 'Salva sozinho. Pra formatação completa (cores, tabelas, negrito), usa a edição completa.'],
        ['Nenhuma anotação para este pedido ainda.', 'Nenhuma anotação nesse pedido. Raro, mas acontece.'],
        ['Cole aqui o texto copiado do relatório de fornecedores ganhadores', 'Cola aqui o texto copiado do relatório de fornecedores ganhadores. Ele traz o nome oficial dos produtos, que o XML se recusa a trazer.'],
        ['Usado só pra personalizar as mensagens do app', 'Serve só pra personalizar as mensagens do app. Deixa em branco se preferir.'],
        ['Sua conta usa login por e-mail e senha', 'Sua conta usa e-mail e senha. Dá pra trocar a senha quando quiser, inclusive antes de esquecer.'],
        ['Sua conta usa login pelo Google ou telefone', 'Sua conta entra pelo Google ou pelo telefone, então a senha é problema deles. Aqui não tem senha pra trocar.'],
        ['Criar conta (e-mail e senha)', 'Cria uma conta (e-mail e senha). A pessoa já entra aprovada e você continua conectado.'],
        ['Pessoas que entraram pelo Google ou telefone', 'Quem entrou pelo Google ou pelo telefone aparece aqui. Aprova pra liberar o acesso ao app.'],
        ['Tema, fonte, menus, dock', 'Tema, fonte, menus, dock e o resto dessas telas valem só pra sua conta e te acompanham em qualquer aparelho. A logo da instituição é a mesma pra todo mundo, sem exceção.'],
        ['Sai no fim de cada página do Resumo de pendências', 'Sai no fim de cada página do Resumo de pendências (PDF e Word), junto da logo da instituição. É só sua: cada usuário tem a própria assinatura. Campo vazio não aparece.'],
        ['O quadro tracejado é o espaço da logo', 'O quadro tracejado é o espaço da logo no PDF e no Word. Escolhe como a imagem entra nele.'],
        ['Os pedidos entram sozinhos', 'Os pedidos entram sozinhos: todo pedido recente com fornecedor que não entregou, ou que entregou e deixou pendência. Só entram ocorrências de auditoria que ainda não foram relatadas.'],
        ['Toque no fornecedor para abrir o pedido', 'Toca no fornecedor pra abrir o pedido. Na seta do lado ficam os produtos que ainda faltam chegar. O resumo pra enviar fica em Início > Resumo de pendências (o documento sai sério, a bronca fica só aqui).'],
        // telas vazias (dinâmicas)
        ['Nenhuma nota próxima do vencimento', 'Nenhuma nota perto de vencer. Aproveita enquanto dura.'],
        ['Nenhuma nota em espera', 'Nenhuma nota em espera. As que você segurar aparecem aqui, até alguém lembrar delas.'],
        ['Nenhum registro encontrado', 'Nada por aqui. Ou não existe registro, ou a informação resolveu tirar férias.'],
        ['Nenhum registro neste ano', 'Nenhum registro neste ano. O ano anda quieto.'],
        ['Nenhum registro neste mês', 'Nenhum registro neste mês. Silêncio suspeito.'],
        ['Nenhum registro no histórico ainda', 'Histórico vazio por enquanto. Processa uma NF pelo Editor XML ou importa o relatório do ERP e começa a encher.'],
        ['O histórico está vazio', 'O histórico está vazio. Ainda.'],
        ['Nenhuma NF do histórico encontrada', 'Nenhuma NF do histórico com esses dados. Confere o número ou tenta outro fornecedor.'],
        ['Nenhuma NF neste filtro', 'Nenhuma NF nesse filtro. Ou ninguém lançou, ou o filtro tá caprichado demais.'],
        ['Nenhuma NF processada ainda pra este fornecedor', 'Nenhuma NF processada desse fornecedor nesse pedido. Pelo visto, nem pra isso ele colaborou ainda.'],
        ['Nenhuma cotação cadastrada ainda. Cadastre', 'Nenhuma cotação cadastrada. Cadastra a cotação correspondente pra associar os itens, ou marca "Esta NF não possui cotação do SmartCompras".'],
        ['Nenhuma cotação cadastrada ainda. Importe', 'Nenhuma cotação cadastrada. Importa o arquivo da primeira cotação pra começar.'],
        ['Nenhuma cotação encontrada', 'Nenhuma cotação encontrada. Confere a busca, que o sistema não esconde de propósito.'],
        ['Nenhuma divergência adicionada ainda', 'Nenhuma divergência por enquanto. Feliz coincidência.'],
        ['Nenhuma ocorrência registrada ainda', 'Nenhuma ocorrência registrada. Se fosse sempre assim...'],
        ['Nenhum fornecedor adicionado ainda', 'Nenhum fornecedor adicionado ainda. Alguém precisa começar.'],
        ['Nenhum pedido de acesso ainda', 'Nenhum pedido de acesso. Ninguém batendo na porta, por enquanto.'],
        ['Nenhum produto cotado registrado', 'Nenhum produto cotado registrado. Cadê o produto?'],
        ['Nenhum produto encontrado nas cotações', 'Nenhum produto encontrado nas cotações. Ou não tem, ou tem com outro nome, que é a especialidade do mercado.'],
        ['Nenhum produto encontrado.', 'Nenhum produto encontrado. Tenta outro nome ou código.'],
        ['Nenhuma sugestão automática', 'Nenhuma sugestão automática. Busca manual pelo nome ou código, no jeito tradicional.'],
        ['Nenhum fornecedor reconhecido neste texto', 'Não reconheci nenhum fornecedor nesse texto. Confere o formato do arquivo.'],
        ['Nenhuma nota fiscal foi reconhecida neste texto', 'Nenhuma nota fiscal reconhecida nesse texto. Vê se o que você colou é o relatório certo.'],
        ['Sem produtos pendentes', 'Sem produtos pendentes. Não é todo dia que isso acontece.'],
        ['Nada encontrado com esses dados', 'Nada encontrado com esses dados. Tenta de novo com outro lote, produto ou validade.'],
        ['Preencha pelo menos um campo', 'Preenche pelo menos um campo. Eu busco bastante coisa, mas adivinhar eu não faço.'],
        ['Digite o lote, o produto ou a validade', 'Digita o lote, o produto ou a validade e toca em Buscar.'],
        ['Cole os lotes, um por linha', 'Cola os lotes, um por linha (mínimo de 4 caracteres).'],
        ['Confira se faturaram no pedido certo', 'Confere se faturaram no pedido certo. Se a NF for de outro pedido, move no Editor da NF, que o sistema não adivinha.'],
        ['Se a NF for de outro pedido, mova-a em', 'Se a NF for de outro pedido, move em "Mover esta NF para outro pedido".'],
        ['Este fornecedor não ganhou nenhum item neste pedido', 'Esse fornecedor não ganhou nenhum item nesse pedido. Nem pra isso.'],
        ['Sem cotação cadastrada para o pedido desta NF', 'Esse pedido ainda não tem cotação cadastrada. Alguém precisa fazer isso.'],
        ['Só lê os dados do app e pode errar', 'Só lê os dados do app e pode errar, que ninguém é perfeito. Confere os números.'],
        ['Toque no botão destacado para ver o efeito', 'Toca no botão destacado pra ver o efeito. É só demonstração, ninguém vai ser cobrado.'],
        ['Se for a mesma nota, envie pelo Controle de NFs', 'Se for a mesma nota, envia pelo Controle de NFs ("Enviar para a relação"): os dados já estão lá. Se salvar aqui, a nota fica ligada a essa NF automaticamente.'],
        ['Entende perguntas livres', 'Entende pergunta livre (usa o limite grátis do dia, então não abusa).'],
        ['Mostrando as 8 primeiras', 'Mostrando só as 8 primeiras. Digita mais do número da NF pra refinar.']
    ];
    const FRASES_ATIVAS = new Map();   // preenchido abaixo
    const SUF_OK = ['Menos uma pra conta.', 'Antes que alguém invente outra.', 'Sem drama, pra variar.', 'Anota aí: funcionou.', 'Pode comemorar baixinho.', 'Sobrevivemos a mais uma.', 'Milagre, mas aconteceu.'];
    const SUF_FALHA = ['Clássico.', 'Respira e tenta de novo.', 'Dia difícil pra todo mundo.', 'Ninguém está surpreso.', 'O sistema não ajuda, mas a gente insiste.', 'Mais uma pro caderninho.'];
    const SUF_FALTA = ['Sem isso eu não adivinho.', 'Falta pouco, juro.', 'Detalhe que a gente não pode pular.', 'Eu bem que queria ajudar, mas não leio mente.'];
    const SUF_NADA = ['Vazio absoluto.', 'Nem sinal de vida.', 'Silêncio total por aqui.', 'Deserto completo.'];
    const SUF_JA = ['Já tá feito, não precisa insistir.', 'Isso já foi resolvido, juro.', 'Duas vezes não adianta.'];
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
        // Sem regra própria: mantém o texto original (com nomes e números) e acrescenta um comentário no fim.
        if (ehSucesso) return texto.replace(/[.!\s]+$/, '') + '. ' + sorteia('suf-ok', SUF_OK);
        if (ehErro) {
            const base = texto.replace(/[.!\s]+$/, '');
            if (/^(Erro|Não (consegui|foi possível)|Falha)/.test(texto)) return base + '. ' + sorteia('suf-falha', SUF_FALHA);
            if (/^(Preencha|Selecione|Digite|Informe|Escolha|Cole)/.test(texto)) return base + '. ' + sorteia('suf-falta', SUF_FALTA);
        }
        if (!ehSucesso && !ehErro) {
            const t = texto.trim(), base = t.replace(/\s*✓\s*/g, ' ').replace(/[.!\s]+$/, '');
            if (/✓/.test(t)) return base + '. ' + sorteia('suf-ok', SUF_OK);
            if (/^(Não consegui|Não foi possível|Falha|Erro)/.test(t)) return base + '. ' + sorteia('suf-falha', SUF_FALHA);
            if (/^(Selecione|Escolha|Informe|Digite|Cole|Preencha|Marque|Carregue|Associe|Adicione|Gere|Cadastre)/.test(t)) return base + '. ' + sorteia('suf-falta', SUF_FALTA);
            if (/^(Nada|Nenhum|Nenhuma|Não há)\b/.test(t)) return base + '. ' + sorteia('suf-nada', SUF_NADA);
            if (/^(Esse|Essa|Esta|Este|A NF)\b.*\bjá\b/.test(t)) return base + '. ' + sorteia('suf-ja', SUF_JA);
        }
        return null;
    }
    function fixa(id, neutro) { if (modo !== 's') return neutro; const v = FIXAS[id]; return v === undefined ? neutro : v; }
    // Comentário do Início conforme o horário (expediente: seg a qui 7h-11h30 e 13h30-17h; sexta até 16h). Estável por meia hora.
    function comentarioHora() {
        if (modo !== 's') return '';
        const d = new Date(), dia = d.getDay(), min = d.getHours() * 60 + d.getMinutes(), sexta = dia === 5, fim = sexta ? 16 * 60 : 17 * 60;
        const sem = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + Math.floor(min / 30) * 7;
        const esc = l => l[sem % l.length];
        const hm = n => n >= 60 ? Math.floor(n / 60) + 'h' + (n % 60 ? String(n % 60).padStart(2, '0') : '') : n + ' min';
        if (dia === 0 || dia === 6) return esc(['Fim de semana e você aqui? Respeito a dedicação. 🧐', 'Dia de descanso e o app aberto. Vai ver a pendência não deixa. 😶‍🌫️', 'Sábado ou domingo, pouco importa: a pendência não tira folga. 🫠']);
        if (min < 5 * 60) return esc(['Madrugada. Ou você acordou cedo demais, ou nem dormiu. 🫠', 'Esse horário só existe pra quem tem pendência ou insônia. 🫥', 'A essa hora até o fornecedor atrasado tá dormindo. 😶‍🌫️']);
        if (min < 7 * 60) return esc(['Ainda nem é expediente. O café já saiu? 🧐', 'Cedo demais pra problema. Mas ele não pergunta o horário. 😒']);
        if (min < 9 * 60) return sexta ? esc(['Sextou! Só falta aguentar até as 16h. 😤', 'Sexta-feira: a pendência não sabe, mas a gente sabe. 🤨']) : dia === 1 ? esc(['Segunda-feira. Não tem como disfarçar. 😒', 'Começo de semana, começo de pendência. 😤']) : esc(['Expediente começou. Respira fundo. 😤', 'Mais um dia, a mesma pilha de pendência. 🙄', 'Bom dia pra quem tem fornecedor no prazo. Se existir. 🤔']);
        if (min < 11 * 60) return esc(['Meio da manhã: a pilha de pendência continua do mesmo tamanho. 🧐', 'Ainda dá tempo de resolver algo antes do almoço. Ainda. 🤨', 'Manhã passando e o fornecedor atrasado continua firme. 😒']);
        if (min < 11 * 60 + 30) return esc(['Quase hora do almoço. O estômago já avisou. 🤨', 'Falta pouco pro almoço. Ninguém mais resolve nada. 😶‍🌫️']);
        if (min < 13 * 60 + 30) return esc(['Hora do almoço. Pendência não sai correndo, vai comer. 🫠', 'Almoço! Ninguém resolve nada de estômago vazio. 🤔', 'Horário sagrado. O app aguenta, você precisa comer. 😤']);
        if (min < 15 * 60) return esc(['Pós-almoço: o sono bate, o fornecedor continua atrasado. 🙄', 'Voltou do almoço. A fila de pendência também. 🤔', 'A digestão ganha do raciocínio agora. 🫠']);
        if (min < 15 * 60 + 45) return esc(['Hora do café das 15h. Sem ele o resto do dia não sai. 🫠', 'Café das 15h. Pausa de respeito. 🧐']);
        if (min < fim - 30) return sexta ? `Sextou. Faltam ${hm(fim - min)} pra ir embora. 😤` : esc([`Faltam ${hm(fim - min)} pra ir embora. 😒`, `Reta final: ${hm(fim - min)} pra liberdade. 🤨`]);
        if (min < fim) return `Falta só ${hm(fim - min)}. Melhor não abrir mais nada novo. 🤨`;
        if (min < 19 * 60) return sexta ? esc(['Passou das 16h numa sexta e você ainda aqui? Vai curtir o fim de semana! 🤨', 'Sextou faz tempo. Fecha esse app. 😤']) : esc(['Já deu o horário. Vai embora, a pendência amanhã continua aqui. 😒', 'Fora do expediente. A pendência agradece, mas ela não paga hora extra. 🙄']);
        if (min < 22 * 60) return esc(['Ainda aqui? O expediente acabou faz tempo. 🙄', 'Noite no app. Respeito, mas isso não é saudável. 🫥']);
        return esc(['Tarde da noite. A NF não vai fugir, vai dormir. 🫠', 'Nesse horário o único que responde é o app. 🤡', 'Quem trabalha uma hora dessas merece pelo menos um café. 🫥']);
    }
    const saudacaoExtra = comentarioHora;
    function aplicarFixas() {
        const el = document.getElementById('forn-dica');
        if (el) { if (!el.dataset.neutro) el.dataset.neutro = el.textContent; el.textContent = fixa('forn-dica', el.dataset.neutro); }
        const ex = document.getElementById('ling-ex'); if (ex) ex.textContent = OPCOES[modo].exemplo;
        ['n', 's'].forEach(k => { const b = document.getElementById('ling-' + k); if (b) b.setAttribute('aria-pressed', String(modo === k)); });
    }
    // Varredura da tela: troca os textos de orientação/vazio que batem com FRASES. Só <p>, <small>, .empty-state, .ini-vazio.
    const norm = t => (t || '').replace(/\s+/g, ' ').trim();
    let varrendo = false, obs = null;
    function varrer() {
        if (varrendo) return; varrendo = true;
        try {
            if (obs) obs.disconnect();
            document.querySelectorAll('p, small, .empty-state, .ini-vazio').forEach(el => {
                if (el.children.length) return;
                if (el.dataset.lgNeutro !== undefined) { if (modo !== 's') { el.textContent = el.dataset.lgNeutro; delete el.dataset.lgNeutro; } return; }
                if (modo !== 's') return;
                const t = norm(el.textContent); if (t.length < 12) return;
                for (const [k, v] of FRASES) if (t.startsWith(k)) { el.dataset.lgNeutro = el.textContent; el.textContent = v; break; }
            });
        } catch (e) { }
        varrendo = false;
        try { if (obs) obs.observe(document.body, { childList: true, subtree: true }); } catch (e) { }
    }
    // leandromendonssa
    let agenda = 0;
    function agendar() { if (agenda) return; agenda = setTimeout(() => { agenda = 0; varrer(); }, 120); }
    try { obs = new MutationObserver(() => { if (modo === 's') agendar(); }); obs.observe(document.body, { childList: true, subtree: true }); } catch (e) { }
    function definir(m) {
        modo = m === 's' ? 's' : 'n';
        try { localStorage.setItem(CHAVE, modo); } catch (e) { }
        aplicarFixas(); varrer();
        try { if (typeof renderInicioSeAtivo === 'function') renderInicioSeAtivo(); } catch (e) { }
        try { if (typeof rebuildNotasPendentesList === 'function') rebuildNotasPendentesList(); } catch (e) { }
    }
    document.querySelectorAll('[data-ling]').forEach(b => b.addEventListener('click', () => definir(b.dataset.ling)));
    aplicarFixas(); if (modo === 's') varrer();
    return { toast, fixa, saudacaoExtra, comentarioHora, definir, modo: () => modo };
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/62-linguagem.js'] = '2.64.0';

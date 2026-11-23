// 62-linguagem.js — Linguagem do aplicativo (2.68.0)
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
            'Não salvou. O sistema decidiu que hoje não era dia. Tenta de novo.',
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
            'Copiou. Agora é só colar e torcer.', 'Copiado. Pode colar onde quiser.', 'Tá na área de transferência. Pelo menos isso.'] },
        { id: 'colado', re: /^Texto colado!?$/, s: [
            'Colou. Vamos ver o que vem por aí.', 'Texto colado. Agora vem a parte divertida.', 'Colado. Vamos ver no que isso dá.'] },
        { id: 'gerado', re: /^(Arquivo gerado|PDF gerado)\.?$/, s: [
            'Arquivo pronto. Nem demorou tanto.', 'Gerou. Hoje o sistema tá colaborando.', 'Pronto, saiu. Pode conferir.'] },
        { id: 'nada-para', re: /^Nada para (salvar|copiar|compartilhar)\.?$/, s: [
            'Não tem nada pra $1. Dá pra fazer muita coisa, mas milagre não.',
            'Nada pra $1. Quer que eu invente?'] },
        { id: 'nf-nao-encontrada', re: /^NF não encontrada\.?$/, s: [
            'Essa NF não apareceu. Ou não existe, ou tá se escondendo.',
            'NF não encontrada. Já olhei até debaixo do tapete.'] },
        { id: 'tudo-certo', re: /^Tudo certo[.!]?$/, semNome: true, s: [
            'Pronto, resolvido. Foi quase indolor.', 'Tudo certo. Anota a data, que isso não é todo dia.', 'Feito. Até o sistema colaborou, vai entender.'] },
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
        'forn-dica': 'Toca no fornecedor pra abrir o pedido. Na seta do lado estão os produtos que ainda não chegaram. O resumo pra mandar pro fornecedor fica em Início > Resumo de pendências — o documento sai limpo, a bronca fica só aqui.',
        'vazio-saida': { t: 'Nada pra saída por enquanto', p: 'Silêncio total. Aproveita antes que apareça alguma coisa.' },
        'ini-sem-forn': 'Nenhum fornecedor pendente nos pedidos. Alguém entregou no prazo? Anota a data.',
        'ini-sem-nf': { t: 'Nenhuma NF aberta', p: 'Relação vazia. Nem parece o almoxarifado.' },
        'ini-calc': 'Calculando… paciência, a pressa aqui só atrapalha.'
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
        ['Cole ou envie o relatório de cadastro de fornecedores', 'Cola ou envia o relatório de cadastro de fornecedores do SP Data (código, CNPJ, nome real e nome exibido). Serve pra confirmar a qual NF/cotação cada lançamento do ERP corresponde — e nunca por semelhança de nome, porque achismo já tem demais. Atualização incremental: nunca apaga o que já está cadastrado.'],
        ['Baixa um arquivo com todas as suas notas pendentes', 'Baixa um arquivo com todas as notas pendentes, histórico, anotações, fornecedores e configurações. É a cópia de segurança no aparelho, independente do Firebase. Melhor ter e não precisar.'],
        ['Exporta TODOS os dados do app', 'Exporta TODOS os dados do app (NFs processadas, entradas do ERP, cotações, associações, fornecedores, exceções de conversão e o resto) num arquivo só, pra analisar casos reais fora do app. Só lê, não mexe em nada.'],
        ['Guarde o arquivo em um lugar seguro', 'Guarda o arquivo num lugar seguro (iCloud Drive, Google Drive, e-mail pra você mesmo). Ele não vai pra lugar nenhum: o download acontece direto no seu navegador.'],
        ['Cadastro manual: use quando a NF não tem XML', 'Cadastro manual é pra quando a NF não tem XML. Com XML, volta pra "Por XML" e poupa o trabalho.'],
        ['Importe o XML da NF-e do fornecedor', 'Importa o XML da NF-e. O sistema identifica os produtos, ajusta a conversão pra unidade de dispensação e tenta ligar cada item à cotação antes de ir pro ERP. Menos digitação, menos dor de cabeça.'],
        ['Cole o texto do relatório do SGH', 'Cola o texto do relatório do SGH com Código, Nome e Unidade. Qualquer um serve (Listagem de itens, por grupo, por subgrupo...), mas prefira um com a coluna de nome mais larga, como "Itens por subgrupo II", pra vir menos cortado.'],
        ['Complementa a cotação com a quantidade de fornecedores', 'Complementa a cotação com a quantidade de fornecedores que participaram de cada item (nunca decide recurso ou pagamento sozinho). Cola o texto ou envia o arquivo do relatório.'],
        ['Nenhuma cotação cadastrada para este pedido ainda.', 'Nenhuma cotação nesse pedido ainda. Quando alguém lembrar de cadastrar, aparece aqui.'],
        ['Salva automaticamente. Pra formatação completa', 'Salva sozinho. Pra formatação completa (cores, tabelas, negrito), usa a edição completa.'],
        ['Nenhuma anotação para este pedido ainda.', 'Nenhuma anotação nesse pedido. Raro, mas acontece.'],
        ['Cole aqui o texto copiado do relatório de fornecedores ganhadores', 'Cola aqui o texto do relatório de fornecedores ganhadores. Ele traz o nome oficial dos produtos — o XML se recusa a trazer.'],
        ['Usado só pra personalizar as mensagens do app', 'Serve só pra personalizar as mensagens do app. Pode deixar em branco.'],
        ['Sua conta usa login por e-mail e senha', 'Sua conta usa e-mail e senha. Dá pra trocar a senha quando quiser — inclusive antes de esquecer.'],
        ['Sua conta usa login pelo Google ou telefone', 'Sua conta entra pelo Google ou pelo telefone. A senha é problema deles; aqui não tem o que trocar.'],
        ['Criar conta (e-mail e senha)', 'Cria uma conta (e-mail e senha). A pessoa já entra aprovada e você continua conectado.'],
        ['Pessoas que entraram pelo Google ou telefone', 'Quem entrou pelo Google ou pelo telefone aparece aqui. Aprova pra liberar o acesso ao app.'],
        ['Tema, fonte, menus, dock', 'Tema, fonte, menus, dock e o resto dessas telas valem só pra sua conta e te acompanham em qualquer aparelho. A logo da instituição é a mesma pra todo mundo, sem exceção.'],
        ['Sai no fim de cada página do Resumo de pendências', 'Sai no fim de cada página do Resumo de pendências (PDF e Word), junto da logo da instituição. É só sua: cada usuário tem a própria assinatura. Campo vazio não aparece.'],
        ['O quadro tracejado é o espaço da logo', 'O quadro tracejado é o espaço da logo no PDF e no Word. Escolhe como a imagem entra nele.'],
        ['Os pedidos entram sozinhos', 'Os pedidos entram sozinhos: todo pedido recente com fornecedor que não entregou, ou que entregou e deixou pendência. Só entram ocorrências de auditoria que ainda não foram relatadas.'],
        ['Toque no fornecedor para abrir o pedido', 'Toca no fornecedor pra abrir o pedido. Na seta do lado estão os produtos que ainda não chegaram. O resumo pra mandar pro fornecedor fica em Início > Resumo de pendências — o documento sai limpo, a bronca fica só aqui.'],
        // telas vazias (dinâmicas)
        ['Nenhuma nota próxima do vencimento', 'Nenhuma nota perto de vencer. Aproveita enquanto dura.'],
        ['Nenhuma nota em espera', 'Nenhuma nota em espera. As que forem seguradas aparecem aqui, até alguém lembrar delas.'],
        ['Nenhum registro encontrado', 'Nada por aqui. Ou não existe, ou a informação resolveu tirar férias.'],
        ['Nenhum registro neste ano', 'Nenhum registro neste ano. O ano anda quieto.'],
        ['Nenhum registro neste mês', 'Nenhum registro neste mês. Silêncio suspeito.'],
        ['Nenhum registro no histórico ainda', 'Histórico vazio por enquanto. Processa uma NF pelo Editor XML ou importa o relatório do ERP e começa a encher.'],
        ['O histórico está vazio', 'O histórico está vazio. Ainda.'],
        ['Nenhuma NF do histórico encontrada', 'Nenhuma NF do histórico com esses dados. Confere o número ou tenta outro fornecedor.'],
        ['Nenhuma NF neste filtro', 'Nenhuma NF nesse filtro. Ou ninguém lançou, ou o filtro tá caprichado demais.'],
        ['Nenhuma NF processada ainda pra este fornecedor', 'Nenhuma NF processada desse fornecedor nesse pedido. Pelo visto nem pra isso ele colaborou.'],
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
        ['Sem cotação cadastrada para o pedido desta NF', 'Esse pedido ainda não tem cotação cadastrada. Alguém precisa resolver isso.'],
        ['Só lê os dados do app e pode errar', 'Só lê os dados do app e pode errar — ninguém é perfeito. Confere os números.'],
        ['Toque no botão destacado para ver o efeito', 'Toca no botão destacado pra ver o efeito. É só demonstração, ninguém vai ser cobrado.'],
        ['Se for a mesma nota, envie pelo Controle de NFs', 'Se for a mesma nota, envia pelo Controle de NFs ("Enviar para a relação"): os dados já estão lá. Se salvar aqui, a nota fica ligada a essa NF automaticamente.'],
        ['Entende perguntas livres', 'Entende pergunta livre (usa o limite grátis do dia — então não abusa).'],
        ['Mostrando as 8 primeiras', 'Mostrando só as 8 primeiras. Digita mais do número da NF pra refinar.']
    ];
    // 2.67.0 — Textos de painéis montados direto no código (Atenção, Relatórios). Chave = começo do texto neutro.
    // Só valem no Modo Leandro; no Modo Normal o chamador usa o texto original (LING.t devolve o neutro).
    const DICAS = [
        ['Ainda não foram enviadas ao financeiro', 'Ainda não foram pro financeiro. Alguém precisa decidir isso.'],
        ['Estão recebidas (ERP ou XML), sem decisão', 'Já chegaram (ERP ou XML) e ninguém decidiu o que fazer. Abre a NF e manda pra relação, pro financeiro ou marca que não vai.'],
        ['Sem NF no app, sem NF do ERP ligada', 'Sem NF no app, sem NF do ERP e sem marca de "já chegou". O fornecedor sumiu ou ninguém lançou.'],
        ['O app achou diferença entre cotação e NF', 'O app achou diferença entre cotação e NF e ninguém relatou. Toca pra abrir o fornecedor e o produto e registrar a auditoria.'],
        ['Todos os itens já tinham chegado em outra NF', 'Tudo isso já tinha chegado em outra NF do pedido. Decide: aceita, devolve tudo ou devolve parte.'],
        ['Material que não ficou conosco', 'Material que não ficou com a gente. Recolheu? Marca no card da NF, no Controle de NFs.'],
        ['Itens da cotação que ainda não vieram em NF', 'Itens da cotação que ainda não vieram em NF. Não é divergência, pode vir em outra nota. Dá pra relatar na Auditoria se o fornecedor continuar enrolando.'],
        ['Já relatadas ao responsável', 'Já foram pro responsável. Mesma lista de Relatórios → Divergências. Toca pra abrir o pedido.'],
        ['A Auditoria Retroativa mostra a conferência', 'A Auditoria Retroativa mostra a conferência de valor, datas e itens. Confere e confirma.'],
        ['Atualizam sozinhos; o botão na Auditoria', 'Atualizam sozinhos. O botão na Auditoria Retroativa faz na hora, pra quem não tem paciência.'],
        ['Decidir no Controle de NFs', 'Decide no Controle de NFs: relação, financeiro ou "não vai pro financeiro". Já passou da hora.'],
        ['Vincule a um pedido ou marque como compra direta', 'Vincula a um pedido ou marca como compra direta. Solta desse jeito ninguém acha.'],
        ['Defina no Editor da NF', 'Define no Editor da NF (Dados desta NF → recurso da NF inteira). Sem recurso a nota fica incompleta.'],
        ['Associe o produto no Editor da NF', 'Associa o produto no Editor da NF ou na Entrada de NF. Sem isso não fecha.'],
        ['Sem CNPJ, o app não acha o pedido', 'Sem CNPJ o app não acha o pedido das NFs do ERP sozinho. Toca pra abrir o cadastro do fornecedor e completar.'],
        ['O que está parado ou envelhecendo', 'O que está parado ou envelhecendo, do mais urgente pro menos. Toca no grupo pra abrir e no item pra ir direto na tela que resolve.'],
        ['Escolha o relatório que quer emitir', 'Escolhe o relatório. Todos dão pra copiar ou baixar em PDF, Word ou texto.'],
        ['Pedidos com entregas pendentes, para enviar', 'Pedidos com entrega ainda pendente, pra cobrar o fornecedor.'],
        ['Cada divergência com produto, quantidades e valores', 'Cada divergência com produto, quantidades e valores, já agrupada por fornecedor.'],
        ['Situação de cada fornecedor em cada pedido', 'Situação de cada fornecedor em cada pedido, com o que ainda falta chegar (se chegar).'],
        ['Notas arquivadas (enviadas) no período', 'Notas que já foram pro financeiro no período, por fornecedor, com total.'],
        ['Bloqueadas. Libere em Ajustes do iPhone', 'Bloqueadas. Libera em Ajustes do iPhone → Notificações → este app. Sem isso o app fala sozinho.'],
        ['Desativadas. Toque em Ativar e permita', 'Desativadas. Toca em Ativar e permite quando o iPhone perguntar.'],
        ['✓ Nada parado por aqui. Tudo em dia.', '✓ Nada parado por aqui. Tudo em dia. Anota a data.']
    ];
    // 2.67.0 — Ajuda: resumos e dicas no tom do Modo Leandro (texto exato neutro -> versão Leandro).
    const AJ = new Map([
        ["Para que serve cada aba da barra inferior.", "Pra que serve cada aba da barra de baixo."],
        ["No computador a barra não encolhe; no iPhone ela fica só com ícones e abre ao tocar.", "No computador a barra não encolhe; no iPhone fica só com ícones e abre ao tocar."],
        ["Se sair no meio, o app guarda o que você já preencheu e retoma do mesmo passo.", "Se sair no meio, o app guarda o que já foi preenchido e retoma do mesmo passo."],
        ["O que acontece com o que você salva depois do limite.", "O que acontece com o que você salva depois que o limite diário estoura."],
        ["Trazer para o app as alterações de quantidade e prazo que o setor de compras faz no SmartCompras.", "Trazer pro app as alterações de quantidade e prazo que o setor de compras faz no SmartCompras."],
        ["O marcador só enxerga o que está visível no Histórico de Pedidos. Abra o histórico antes de tocar nele.", "O marcador só enxerga o que está visível no Histórico de Pedidos. Abre o histórico antes de tocar nele."],
        ["Definir o que cada conta pode alterar no app.", "Definir o que cada conta pode (e não pode) alterar no app."],
        ["Onde tirar dúvidas: o botão ? e o Assistente.", "Onde tirar dúvida: o botão ? e o Assistente."],
        ["O Assistente ainda não substitui a Ajuda: ele é um atalho para perguntas rápidas.", "O Assistente ainda não substitui a Ajuda: é um atalho pra pergunta rápida."],
        ["Cadastrar uma NF sem XML, na aba \"Manual (sem XML)\" da Entrada de NF.", "Cadastrar uma NF sem XML, pela aba Manual da Entrada de NF."],
        ["Se um item mostra pendência, toque nela: o app leva ao ponto de resolver.", "Se um item mostra pendência, toca nela: o app leva ao ponto de resolver."],
        ["Trabalhar com a relação de notas pendentes.", "Trabalhar a relação de notas que ainda estão pendentes."],
        ["O app só aplica o recurso quando a NF tem um único recurso; com mais de um, você escolhe em Editar.", "O app só aplica o recurso quando a NF tem um único recurso; com mais de um, escolhe em Editar."],
        ["Por que só algumas notas arquivadas aparecem e como carregar as demais.", "Por que só algumas notas arquivadas aparecem e como carregar o resto."],
        ["Como o app guarda produtos, fornecedores e associações no aparelho para gastar menos leituras do Firebase.", "Como o app guarda produtos, fornecedores e associações no aparelho pra gastar menos leitura do Firebase."],
        ["Ver o que foi ligado sozinho nas NFs do ERP e resolver só o que depende de você.", "Ver o que o app ligou sozinho nas NFs do ERP e resolver só o que ainda depende de você."],
        ["Você não precisa associar NF por NF: os itens se ligam ao produto pelo código SP Data, e o pedido é encontrado pelo CNPJ, pelos itens e pelo valor.", "Você não precisa associar NF por NF. Os itens se ligam ao produto pelo código SP Data, e o pedido é encontrado pelo CNPJ, pelos itens e pelo valor. O que ainda depende de você aparece como sugestão ou pendência."],
        ["O app nunca apaga uma ligação sozinho: só preenche ou corrige para um produto que existe.", "O app nunca apaga uma ligação sozinho: só preenche ou corrige pra um produto que existe."],
        ["Mostra, neste aparelho, quantas leituras do Firebase foram gastas hoje, por coleção, por tela e por abertura do app.", "Mostra, neste aparelho, quantas leituras do Firebase foram gastas hoje — por coleção, por tela e por abertura do app."],
        ["Cadastre entregas de reagentes, reuniões e lembretes, com aviso na véspera e no dia.", "Cadastra entregas de reagentes, reuniões e lembretes, com aviso na véspera e no dia."],
        ["Uma IA que responde perguntas sobre os dados do app, só lendo, sem alterar nada.", "Uma IA que responde pergunta sobre os dados do app — só lê, não altera nada."],
        ["Um painel com o que está parado ou envelhecendo, do mais urgente ao menos.", "Um painel com o que está parado ou envelhecendo, do mais urgente pro menos."],
        ["C/C ou Recurso Próprio: onde definir e como chega à Saída de Texto.", "C/C ou Recurso Próprio: onde definir e como chega na Saída de Texto."],
        ["Apelido único para filiais e vínculo automático por CNPJ.", "Apelido único pras filiais e vínculo automático por CNPJ."],
        ["Duas cópias dos dados: o backup simples e a exportação completa para análise.", "Duas cópias dos dados: o backup simples e a exportação completa pra análise."],
        ["Ver e corrigir tudo sobre uma NF em um só lugar.", "Ver e corrigir tudo de uma NF num lugar só."],
        ["Acompanhar um pedido fornecedor a fornecedor.", "Acompanhar um pedido fornecedor por fornecedor."],
        ["Escolha uma modalidade, o período, o fornecedor ou produto e o que incluir; copie ou baixe.", "Escolhe a modalidade, o período, o fornecedor ou produto e o que incluir; copia ou baixa."],
        ["Controle de aparelhos ligado às NFs, com movimentações e estoque.", "Controle de aparelhos ligado às NFs, com movimentação e estoque."],
        ["Seu nome, senha e (para o administrador) criar contas e liberar acessos.", "Seu nome, senha e (pro administrador) criar contas e liberar acessos."],
        ["Como o app leva você ao lugar de resolver e traz de volta.", "Como o app te leva ao lugar de resolver e te traz de volta."]
    ]);
    function t(neutro) {
        if (modo !== 's' || !neutro) return neutro;
        const x = String(neutro).replace(/\s+/g, ' ').trim();
        if (AJ.has(x)) return AJ.get(x);
        for (const [k, v] of DICAS) if (x.startsWith(k)) return v;
        return neutro;
    }
    const FRASES_ATIVAS = new Map();   // preenchido abaixo
    const SUF_OK = ['Menos uma pra conta.', 'Anota aí: funcionou.', 'Sobrevivemos a mais uma.', 'Milagre, mas aconteceu.', 'Finalmente.', 'Sem drama, pra variar.', 'Hoje o sistema acordou bonzinho.', 'Fornecedor nenhum atrasou isso, pelo menos.'];
    const SUF_FALHA = ['Clássico.', 'Ninguém está surpreso.', 'O sistema só colabora quando quer.', 'Mais uma pro caderninho.', 'Como esperado.', 'Se fosse fácil não era aqui.', 'Isso aqui adora escolher o pior momento.'];
    const SUF_FALTA = ['Sem isso eu não adivinho.', 'Detalhe que não dá pra pular.', 'Eu bem que queria ajudar, mas não leio mente.', 'Falta o básico.', 'Dado faltando é assim que a bagunça começa.'];
    const SUF_NADA = ['Nem sinal de vida.', 'Silêncio total por aqui.', 'Deserto.', 'Parece até que alguém arrumou a casa.'];
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
    // leandromendonssa
    // Comentário do Início conforme o horário (expediente: seg a qui 7h-11h30 e 13h30-17h; sexta até 16h). Estável por meia hora.
    const ROT_MSG = {};
    // 2.73.14: frases de almoço e café dependem do horário de quem trabalha; só a conta mestre as vê. As demais contas recebem as frases do resto do dia.
    function ehMestreLing() { try { return typeof isContaAdmin === 'function' && isContaAdmin(auth.currentUser); } catch (e) { return false; } }
    const REF_REFEICAO = /almo[çc]o|caf[ée]|estômago|digest|sagrado/i;
    const NEUTRAS_DIA = ['Meio do expediente: a pendência segue no mesmo lugar. 🧐', 'O dia anda e a lista também. 😒', 'Calma, uma NF de cada vez. 🤨'];
    function comentarioBase() {
        if (modo !== 's') return '';
        const d = new Date(), dia = d.getDay(), min = d.getHours() * 60 + d.getMinutes(), sexta = dia === 5, fim = sexta ? 16 * 60 : 17 * 60;
        const sem = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + Math.floor(min / 30) * 7;
        // 2.73.10: rodízio de verdade. Sorteia uma frase diferente da anterior e a mantém por 10 min (para não piscar a cada abertura do Início).
        const esc = l => {
            if (!ehMestreLing()) { const f = l.filter(x => !REF_REFEICAO.test(x)); l = f.length ? f : NEUTRAS_DIA; }
            const k = l[0], c = ROT_MSG[k], agora = Date.now();
            if (c && agora - c.t < 600000) return l[c.i];
            let i; do { i = Math.floor(Math.random() * l.length); } while (l.length > 1 && c && i === c.i);
            ROT_MSG[k] = { i, t: agora }; return l[i];
        };
        const hm = n => n >= 60 ? Math.floor(n / 60) + 'h' + (n % 60 ? String(n % 60).padStart(2, '0') : '') : n + ' min';
        if (dia === 6) return esc(['Sábado e você aqui? Respeito a dedicação. 🧐', 'Sábado de sol lá fora e a pendência aqui dentro. 😶‍🌫️', 'Sábado: o único dia em que a NF atrasada não cobra ninguém. Ou cobra? 🤔', 'Fim de semana não tem expediente, mas você tem pendência. 🫠', 'Sábado é dia de descansar. O app discorda de você. 😒', 'Vai passear! A NF aguenta até segunda. 🤨', 'Sábado trabalhando? A pendência agradece, o seu descanso não. 🙄', 'Até o fornecedor atrasado folga no sábado. Você também podia. 😤', 'Sábado produtivo ou só não aguenta ver o app fechado? 🧐', 'Respeito quem abre app de trabalho no sábado. E me preocupo. 🫥', 'Nada vence no sábado... ou vence e ninguém avisa. 🫠', 'Café, sofá e pendência: combinação perigosa de sábado. ☕🤡']);
        if (dia === 0) return esc(['Domingo e o app aberto? Respeito a dedicação. 🧐', 'Domingo é dia de descanso. A pendência não leu o calendário. 🫠', 'Domingo à tarde já dá aquele friozinho de segunda, né? 😶‍🌫️', 'Quem abre app de trabalho no domingo merece um dia de folga extra. 🙄', 'Domingo: a segunda-feira já está na fila, esperando. 😒', 'Almoço de domingo primeiro, NF depois. 🤨', 'Domingo não tem pendência. Só as que você inventa. 😤', 'Vai descansar, a segunda chega rápido sem a sua ajuda. 🫥', 'Domingo de plantão voluntário? Anotado. 🧐', 'Sem expediente hoje. Só você e a sua consciência. 🫠', 'Domingo preparando a segunda: o tipo de pessoa que eu respeito. 🤔', 'Fecha o app e vai tomar um suco gelado. 🤡']);
        if (min < 5 * 60) return esc(['Madrugada. Ou você acordou cedo demais, ou nem dormiu. 🫠', 'Esse horário só existe pra quem tem pendência ou insônia. 🫥', 'A essa hora até o fornecedor atrasado tá dormindo. 😶‍🌫️']);
        if (min < 7 * 60) return esc(['Ainda nem é expediente. O café já saiu? 🧐', 'Cedo demais pra problema. Mas ele não pergunta o horário. 😒']);
        if (min < 9 * 60) return sexta ? esc(['Sextou! Só falta aguentar até as 16h. 😤', 'Sexta-feira: a pendência não sabe, mas a gente sabe. 🤨']) : dia === 1 ? esc(['Segunda-feira. Não tem como disfarçar. 😒', 'Começo de semana, começo de pendência. 😤']) : esc(['Expediente começou. Respira fundo. 😤', 'Mais um dia, a mesma pilha de pendência. 🙄', 'Bom dia pra quem tem fornecedor no prazo. Se existir. 🤔']);
        if (min < 11 * 60) return esc(['Meio da manhã: a pilha de pendência continua do mesmo tamanho. 🧐', 'Ainda dá tempo de resolver algo antes do almoço. Ainda. 🤨', 'Manhã passando e o fornecedor atrasado continua firme. 😒']);
        if (min < 11 * 60 + 30) return esc(['Quase hora do almoço. O estômago já avisou. 🤨', 'Falta pouco pro almoço. Ninguém mais resolve nada. 😶‍🌫️']);
        if (min < 13 * 60 + 30) return esc(['Hora do almoço. Pendência não sai correndo, vai comer. 🫠', 'Almoço! Ninguém resolve nada de estômago vazio. 🤔', 'Horário sagrado. O app aguenta, você precisa comer. 😤']);
        if (min < 15 * 60) return esc(['Pós-almoço: o sono bate, o fornecedor continua atrasado. 🙄', 'Voltou do almoço. A fila de pendência também. 🤔', 'A digestão ganha do raciocínio agora. 🫠']);
        if (min < 15 * 60 + 45) return esc(['Hora do café das 15h. Sem ele o resto do dia não sai. 🫠', 'Café das 15h. Pausa de respeito. 🧐']);
        if (min < fim - 30) return sexta ? esc(['Sextou. A tarde não acaba, mas a semana sim. 😤', 'Sexta à tarde: corpo aqui, cabeça no fim de semana. 🫠']) : esc(['Reta final do expediente. Aguenta. 😒', 'A tarde se arrasta, mas o relógio é implacável. 🤨']);
        if (min < fim) return esc(['Quase na hora de ir. Melhor não abrir mais nada novo. 🤨', 'Falta pouco. Nenhuma pendência nova, por favor. 😤']);
        if (min < 19 * 60) return sexta ? esc(['Passou das 16h numa sexta e você ainda aqui? Vai curtir o fim de semana! 🤨', 'Sextou faz tempo. Fecha esse app. 😤']) : esc(['Já deu o horário. Vai embora, a pendência amanhã continua aqui. 😒', 'Fora do expediente. A pendência agradece, mas ela não paga hora extra. 🙄']);
        if (min < 22 * 60) return esc(['Ainda aqui? O expediente acabou faz tempo. 🙄', 'Noite no app. Respeito, mas isso não é saudável. 🫥']);
        return esc(['Tarde da noite. A NF não vai fugir, vai dormir. 🫠', 'Nesse horário o único que responde é o app. 🤡', 'Quem trabalha uma hora dessas merece pelo menos um café. 🫥']);
    }
    // 2.68.0 — contagem regressiva (almoço, café das 15h, ir embora): aparece só às vezes (sorteio estável por meia hora, para não piscar) e só em dia útil de expediente.
    function comentarioHora() {
        if (modo !== 's') return '';
        const d = new Date(), dia = d.getDay(), min = d.getHours() * 60 + d.getMinutes(), sexta = dia === 5, fim = sexta ? 16 * 60 : 17 * 60;
        if (dia > 0 && dia < 6) {
            const mestreLing = ehMestreLing();
            const sem = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + Math.floor(min / 30) * 7;
            const alea = (salt, p) => (((sem % 9973) * 7919 + salt * 31) % 100) < p;
            const hm = n => n >= 60 ? Math.floor(n / 60) + 'h' + (n % 60 ? String(n % 60).padStart(2, '0') : '') : n + ' min';
            const esc = (salt, l) => l[(sem + salt) % l.length];
            let c = null;
            if (mestreLing && min >= 9 * 60 && min < 11 * 60 + 30) c = esc(1, [`Faltam ${hm(11 * 60 + 30 - min)} pro almoço. 🤨`, `Almoço em ${hm(11 * 60 + 30 - min)}. Aguenta firme. 😤`]);
            else if (mestreLing && min >= 12 * 60 && min < 13 * 60 + 30) c = esc(2, [`O almoço acaba em ${hm(13 * 60 + 30 - min)}. A pendência esperou. 🫠`, `Faltam ${hm(13 * 60 + 30 - min)} pra voltar. Aproveita. 🧐`]);
            else if (mestreLing && min >= 13 * 60 + 30 && min < 15 * 60) c = esc(3, [`Faltam ${hm(15 * 60 - min)} pro café das 15h. 🫠`, `Café das 15h em ${hm(15 * 60 - min)}. O corpo já sabe. 🤔`]);
            else if (min >= fim - 150 && min < fim) c = sexta ? `Sextou. Faltam ${hm(fim - min)} pra ir embora. 😤` : esc(4, [`Faltam ${hm(fim - min)} pra ir embora. 😒`, `Contagem regressiva: ${hm(fim - min)} pra liberdade. 🤨`]);
            if (c && alea(5, min >= fim - 30 && min < fim ? 80 : 45)) return c;
        }
        return comentarioBase();
    }
    const saudacaoExtra = comentarioHora;
    function aplicarFixas() {
        const el = document.getElementById('forn-dica');
        if (el) { if (!el.dataset.neutro) el.dataset.neutro = el.textContent; el.textContent = fixa('forn-dica', el.dataset.neutro); }
        const sw = document.getElementById('ling-sw'); if (sw) { sw.classList.toggle('on', modo === 's'); sw.setAttribute('aria-checked', String(modo === 's')); }
    }
    // Varredura da tela: troca os textos de orientação/vazio que batem com FRASES. Só <p>, <small>, .empty-state, .ini-vazio.
    const norm = t => (t || '').replace(/\s+/g, ' ').trim();
    let varrendo = false, obs = null;
    // leandromendonssa
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
    // leandromendonssa
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
    return { toast, fixa, t, saudacaoExtra, comentarioHora, definir, modo: () => modo };
})();
/* ARQ_V */ (window.ARQ_V = window.ARQ_V || {})['js/62-linguagem.js'] = '2.73.14';

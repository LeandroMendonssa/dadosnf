// 14-historico-mudancas.js — Histórico de mudanças do aplicativo
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// --- CONFIGURAÇÕES → HISTÓRICO DE MUDANÇAS DO APLICATIVO ---
// ===================================================================
// Registro funcional/documental do desenvolvimento — não é versionamento
// técnico nem log automático de código. É estático dentro do app (sem
// coleção nova no Firestore, como pedido): cada atualização futura só
// precisa acrescentar uma entrada neste array, com "o que mudou" + "o que
// testar". A entrada mais recente é sempre a fase atual, destacada na tela.
const HISTORICO_FASES = [
    {
        numero: '2.0.2', nome: 'Banco de dados sob demanda: o app abre só com o essencial', status: 'atual',
        implementado: [
            'Na abertura o app agora assina só 4 leituras do banco: configurações, notas pendentes, histórico e cadastro de fornecedores (as que a primeira tela e o Adicionar usam). Antes eram 13.',
            'As outras 9 (cotações, NFs processadas, entradas do ERP, associações de SP Data e de fornecedor, produtos SP Data, fornecedores ganhadores, anotações e exceções de XML) sobem quando você abre a tela que as usa (Controle de NFs, Histórico, Entrada de NF, Cotações, Central do pedido, SP Data, Anotações, Importação, Backup, Relatórios).',
            'O que nenhuma tela pediu ainda sobe sozinho em segundo plano, uma leitura a cada 0,35 s, começando 1,5 s depois da abertura. Assim nada fica sem carregar e a abertura não trava de uma vez.',
            'Cada coleção é assinada uma única vez (sem duplicar), e ao sair da conta tudo é encerrado e recomeça no próximo login. A tela de carregamento já era imediata (está no próprio HTML), então esse ponto do plano não precisou de mudança.'
        ],
        mudou: [
            'Ao abrir uma tela pela primeira vez logo depois de abrir o app, os dados dela podem levar um instante (menos de 1 s) para aparecer; a tela se atualiza sozinha quando chegam. Nenhuma regra de negócio mudou.',
            'Arquivos alterados: js/05-listeners-dados.js (assinaturas), js/08-fornecedores-logo.js (aviso da tela aberta, na função switchToScreen) e js/14-historico-mudancas.js (este registro).'
        ],
        testar: ['Abrir o app (a abertura deve ficar mais leve) e logo em seguida ir direto a Controle de NFs, Histórico, Cotações, SP Data, Anotações e Entrada de NF, vendo se a lista aparece completa. Fazer sair da conta e entrar de novo e repetir uma tela. Se alguma tela ficar vazia ou incompleta, me diga qual.']
    },
    {
        numero: '2.0.1', nome: 'Versão 2.0: script dividido em arquivos + histórico com a versão 1.0 recolhida', status: 'concluida',
        implementado: [
            'O script.js (12 mil linhas) foi dividido em 19 arquivos na pasta js/, por assunto: núcleo e configuração, layout, dados, relatórios, listeners, PDF, login/conta/backup, fornecedores, anotações, entrada de NF/XML, central do pedido, lote/rastro, divergências, histórico de mudanças, ganhadores/cotações, SP Data, histórico e controle de NFs, ERP e reconciliação.',
            'O código foi apenas movido, sem reescrever nenhuma regra: os arquivos são carregados pelo index.html na mesma ordem em que o código já rodava, e juntos dão exatamente o script antigo. Funções e variáveis continuam globais, então os botões e telas funcionam como antes.',
            'Histórico de mudanças: as fases da versão 1.0 (até a 44.1) ficam recolhidas num card; a versão 2.0 e as seguintes (2.0.1, 2.0.2 … 2.1.0) aparecem em destaque no topo.'
        ],
        mudou: [
            'O index.html passou a carregar os 19 arquivos de js/ no lugar do script.js, e o style.css ganhou o estilo do card recolhível. O script.js antigo não é mais usado e pode ser apagado depois de testar (mantenha uma cópia de backup).',
            'Mensagens de erro no console agora indicam o arquivo de js/ em vez de script.js.'
        ],
        testar: ['Abrir o app e passar pelas telas principais (Adicionar, Gerenciar, Controle de NFs, Entrada de NF, Cotações, Relatórios, SP Data, Anotações, Configurações > Histórico de mudanças) vendo se tudo abre e funciona como antes. Em Configurações > Histórico de mudanças, tocar no card "Versão 1.0" para abrir e recolher. Se alguma tela ficar vazia ou der erro, me mande o erro do console.']
    },
    {
        numero: '44.1', nome: 'Menos travadas: abertura do app e envio de NF para a relação', status: 'concluida',
        implementado: [
            'Na abertura, cada uma das ~13 leituras do banco redesenhava Relatórios, Histórico de NFs e Controle de NFs mesmo fora da tela. Agora vários redesenhos seguidos viram um só, o que deve encurtar a trava de ~3 segundos na abertura.',
            'O mesmo vale ao enviar uma NF para a relação: as 3 ou 4 atualizações do banco seguidas redesenham o Controle uma vez só.'
        ],
        mudou: ['Telas de Relatórios, Histórico de NFs e Controle passam a atualizar até ~0,15 s depois do dado chegar (imperceptível). Nenhuma regra ou dado mudou.'],
        testar: ['Abrir o app e ver se a trava de abertura diminuiu; enviar uma NF para a relação e ver se a trava sumiu ou ficou menor.']
    },
    {
        numero: 44, nome: 'Controle de NFs: "Enviar para a relação" cria a nota direto + correção do fornecedor [object Object]', status: 'concluida',
        implementado: [
            '"Enviar para a relação" agora cria a nota direto na lista pendente, já com fornecedor, NF, valor, vencimento e recurso sugerido pela cotação, e liga a NF/ERP à nota. Não abre mais o formulário Adicionar para você preencher de novo.',
            'Se a nota já existir (mesmo fornecedor + NF, pendente ou arquivada), pede confirmação antes de criar. Só abre o formulário quando falta fornecedor, valor ou vencimento que o app não tem, e avisa qual falta.',
            'O vencimento das duplicatas do XML (cobr/dup/dVenc) passa a ser gravado na NF salva; o Controle usa o 1º vencimento. Valor e vencimento ganharam mais origens de reserva: nota ligada, ERP, parcelas do ERP e XML.',
            'Nome de fornecedor sempre vira texto; o valor inválido "[object Object]" é recusado ao gravar fornecedor/apelido e ao ler o cadastro, e o que já estava gravado no banco é removido uma vez ao carregar o app.'
        ],
        mudou: [
            'NFs processadas antes desta versão não têm o vencimento do XML guardado: para elas (se não vieram do ERP) o formulário ainda abre pedindo o vencimento. Abrir e salvar a NF de novo na Entrada de NF resolve.',
            'Notas que já foram criadas com o nome "[OBJECT OBJECT]" continuam com ele: edite o fornecedor delas em Gerenciar NF (a nota guarda uma cópia do nome).'
        ],
        testar: ['Controle de NFs > Em aberto: tocar em "Enviar para a relação" numa NF com XML e conferir fornecedor, valor, vencimento e recurso na nota criada em Gerenciar NF. Repetir numa NF só com ERP e numa NF antiga sem vencimento (deve abrir o formulário avisando o que falta).']
    },
    {
        numero: '21.1', nome: 'Correção: teclado do celular não move mais a barra de navegação', status: 'concluida',
        implementado: [
            'Ao tocar num campo de texto no celular, a barra de navegação some na hora e a altura do app fica congelada enquanto o teclado está aberto. Antes, em alguns navegadores o app encolhia junto com o teclado: a barra subia pro topo e sobrava uma tela vazia.',
            'Ao sair do campo, a barra volta e a altura é recalculada; o app também volta ao topo da página caso o navegador tenha rolado a tela.'
        ],
        mudou: ['Só o comportamento com teclado aberto no celular (telas de toque). No computador nada muda.'],
        testar: ['No iPhone: tocar num campo de texto (Adicionar, busca do Gerenciar, Entrada de NF) — a barra não deve subir nem aparecer sobre o teclado; ao fechar o teclado ela volta ao lugar. Testar também num campo perto do rodapé da tela.']
    },
    {
        numero: 43, nome: 'Lote e validade escritos no texto do produto viram <rastro> (com confirmação)', status: 'concluida',
        implementado: [
            'Entrada de NF: o app procura "LOTE: … DT VAL: dd/mm/aaaa" (também "VAL", "VALIDADE", "VENCIMENTO") no nome do produto e no infAdProd do item, quando o item ainda não tem <rastro> no XML. Cada item mostra "Lote e validade no texto" com Confirmar / Editar / Ignorar; no checklist há "Confirmar todos". Nada entra no XML sem a sua confirmação.',
            'Ao salvar ou baixar o XML corrigido, os itens confirmados ganham o <rastro> (nLote, qLote e dVal em AAAA-MM-DD) na posição certa do leiaute da NF-e. O qLote usa a quantidade de saída (já convertida pelo fator). Itens que já têm <rastro> no XML aparecem como "Lote no XML" e não são alterados. O lote e a validade confirmados também ficam gravados nos itens da NF salva.',
            'Validade impossível nunca é aceita sozinha: ano fora de 2000–2099 (ex.: 30/01/3000), data que não existe ou anterior à emissão da NF mostram "Conferir lote e validade" com campos para informar a data certa, ou Ignorar. Também dá para informar lote e validade à mão em qualquer item.'
        ],
        mudou: [
            'Nenhuma regra de fator, associação, cProd, GTIN ou saída de texto mudou. O infCpl (texto geral da NF) não é usado, porque não dá para saber a qual item o lote pertence.'
        ],
        testar: [
            'Carregar uma NF do fornecedor que escreve lote e validade no nome do produto (como a CBS), tocar em "Confirmar todos", baixar o XML corrigido e importar no SPData. Itens com validade estranha pedem a data certa antes.'
        ]
    },
    {
        numero: 42, nome: 'Divergência de valor entre a NF (XML) e o lançamento no ERP', status: 'concluida',
        implementado: [
            'Novo tipo de divergência "valor NF × ERP": quando um item tem NF processada e também está lançado no ERP, o app compara o valor unitário e o valor total da linha. NF e ERP estão na mesma unidade (a de dispensação), então a comparação é direta, sem falso alarme por conversão. Qualquer diferença vira divergência, com a frase pronta para a auditoria ("… valor unitário R$ X na NF × R$ Y no ERP; valor total …").',
            'Desconto e IPI não são compensados: seguindo a regra do hospital (no SPData eles são somados num item da NF), qualquer diferença de valor é divergência. O valor total só é comparado quando as quantidades da NF e do ERP batem — se a quantidade já difere, esse aviso ("quantidade NF × ERP") já explica a diferença de total e não se avisa duas vezes.'
        ],
        mudou: [
            'Tolerância: meio centavo no valor unitário e o maior entre R$ 0,02 e 0,05% no total, só para arredondamento. A divergência segue as mesmas regras das outras: aparece no item da Central, conta na aptidão da nota, pode ser marcada como Resolvido e gerar auditoria. Itens só no ERP (sem NF) não são comparados, porque a cotação não guarda a unidade.'
        ],
        testar: [
            'Numa NF processada e lançada no ERP com valor diferente, abrir a cotação (aba Produtos): o item deve mostrar a divergência de valor NF × ERP.'
        ]
    },
    {
        numero: '30.1', nome: 'Excluir do histórico não apaga mais a data da associação vigente', status: 'concluida',
        implementado: [
            'Correção do "Excluir do histórico" (painel "Associações conhecidas" da Entrada de NF): agora o app apaga só o que torna a possibilidade antiga. Se o SmartCompras daquela linha já não é o vigente deste código de fornecedor, remove só as entradas desse SmartCompras do histórico do código. Se o SmartCompras é o vigente e só o SP Data daquele par foi corrigido depois, remove só essa entrada antiga do SP Data no histórico do produto SmartCompras (o aviso do modal diz que isso vale para todos os fornecedores que usam o produto).',
            'Antes, excluir uma linha antiga apagava junto a entrada que registra desde quando a associação atual vale, e a busca "Código de fornecedor já associado a este produto" passava a mostrar "data aproximada" e deixava de apontar a sugestão principal. Além disso, a linha excluída continuava aparecendo. Agora a linha some e a data de vigência é preservada.'
        ],
        mudou: [
            'A associação vigente nunca é apagada nem alterada. A gravação usa atualização só do campo de histórico (não regrava o documento inteiro).'
        ],
        testar: [
            'Num item com "Associações conhecidas" que tenha uma linha antiga: Ver histórico › Excluir do histórico. A linha deve sumir e o código de fornecedor vigente continuar aparecendo com "vigente desde …" (sem "data aproximada").'
        ]
    },
    {
        numero: 41, nome: 'Cruzamento de NFs: menos duplicatas entre ERP, XML e notas', status: 'concluida',
        implementado: [
            'Checagem de duplicidade mais firme (importação do ERP e Adicionar): além de "mesma NF + mesmo nome", agora vale "mesma NF + um nome é o começo do outro" (o relatório do ERP corta o nome do fornecedor em cerca de 30 caracteres, ex.: "GREYCE SILVA DE BARROS E CIA L" × "...LTDA") e, na importação, "mesmo número de NF (sem zeros à esquerda) + mesmo valor". A prévia e o status gravado da entrada do ERP passam a usar a mesma regra.',
            'Controle de NFs: a mesma NF vinda do XML e do relatório ERP agora é unida num só registro mesmo quando o número vem com zeros à esquerda, a série está em branco de um lado ou o CNPJ do cadastro não foi resolvido — desde que haja um único candidato e uma evidência a mais (mesmo valor ou mesmo CNPJ).',
            'Controle de NFs: uma NF "Recebida" que parece já existir como nota (mesmo número e mesmo valor, na relação ou arquivada) ganha o aviso "Parece já existir como nota…" e o botão "É a mesma nota — vincular" no lugar de "Enviar para a relação". Há também "Vincular todas" no topo, com confirmação. Nada é vinculado sem a sua ação e nada é apagado.'
        ],
        mudou: [
            'O vínculo ERP × XML (vincularEntradaErpComNf), as associações de SP Data e a Saída de Texto não mudaram. A união por número + valor vale só para exibir e vincular no Controle.'
        ],
        testar: [
            'Importar o relatório ERP: NFs que já estão como nota (inclusive com o nome do fornecedor cortado) devem vir marcadas como duplicadas. No Controle de NFs, conferir as que mostram "Parece já existir como nota" e usar "Vincular todas".'
        ]
    },
    {
        numero: 40, nome: 'Correções: importar relatório ERP, recurso das notas, menu lateral e arquivar em massa', status: 'concluida',
        implementado: [
            'Importar Relatório (ERP): corrigido o erro "Cannot access \'duplicata\' before initialization" que impedia a prévia de abrir (uma variável era usada antes de ser declarada). A importação volta a funcionar, inclusive o aviso de NF duplicada na relação ou no histórico.',
            'Recurso: o "Recurso:" mostrado no cartão do Gerenciar NF vem da Entrada de NF, mas a Saída de Texto e o campo de edição usam o recurso da própria nota — que ficava vazio em notas importadas por versões antigas. Agora o cartão mostra o botão "Aplicar recurso: X" quando a nota não tem recurso e a NF tem um recurso só; no alto do Gerenciar há "Aplicar em todas". O campo de edição passa a mostrar o recurso da nota mesmo que não esteja na lista padrão (antes ficava em branco e podia ser apagado ao salvar) e já sugere o recurso conhecido.',
            'Menu lateral (tela larga): o "Importar Relatório (ERP)", que agora fica em Mais, também aparece no menu lateral.',
            'Gerenciar NF: a seleção em massa ganhou o botão Arquivar (confirma antes, move para o Histórico e sincroniza o ERP, como o arquivar individual). "Todas" passa a selecionar só as notas da aba aberta, e trocar de aba limpa a seleção, para nunca arquivar/excluir notas escondidas.',
            'Login: a mensagem de erro "auth/operation-not-supported-in-this-environment" agora explica que o app foi aberto como arquivo local (file://) e que é preciso abrir pelo endereço https:// ou por um servidor local.'
        ],
        mudou: [
            'Nenhuma regra da Saída de Texto mudou (getLinha continua igual). O recurso só é aplicado na nota quando você toca em "Aplicar", nunca em silêncio, e só quando a NF tem um recurso único.'
        ],
        testar: [
            'Colar um relatório ERP em Mais › Importar Relatório (ERP) e tocar em Processar. No Gerenciar NF, conferir "Aplicar recurso" nas notas sem recurso e o botão de arquivar ao tocar em Selecionar.'
        ]
    },
    {
        numero: 39, nome: 'Entrada de NF em abas: Itens · Pedido · NF, com checklist no topo', status: 'concluida',
        implementado: [
            'Depois de carregar o XML, a Entrada de NF mostra no topo um resumo fixo (fornecedor, NF · série · data, valor · itens e "Trocar XML", além do aviso de "NF já processada" quando houver) e três abas: Itens (a lista de itens que você preenche, com Pendências/Todos), Pedido (seletor de pedido/cotação, cotação adicional, compra direta, destino, situação dos códigos e os itens da cotação ainda não faturados) e NF (dados do fornecedor, informações adicionais, unidade de dispensação e o importador).',
            'O checklist "Antes de salvar" fica sempre logo abaixo das abas. Cada pendência vira uma linha que leva à aba certa (ex.: "Pedido/cotação ainda não identificado" → Pedido); na aba Itens aparece o checklist completo e nas outras só o que se resolve ali, com um atalho para o resto. Itens da cotação ainda não faturados aparecem como uma linha informativa que leva à aba Pedido.',
            'As abas mostram a quantidade de itens e um ponto (●) quando há pendência naquela aba. Cada XML novo abre na aba Itens, com os itens pendentes já abertos. Salvar NF e Baixar XML Corrigido continuam no fim da tela.'
        ],
        mudou: [
            'Nenhuma regra de pendência, fator, associação, cotação ou saída mudou — os mesmos campos e botões, só organizados em abas. O texto das pendências é o mesmo.'
        ],
        testar: [
            'Carregar um XML: conferir o resumo no topo, tocar em cada aba e, no checklist, tocar numa pendência de pedido/cotação (deve abrir a aba Pedido). Selecionar o pedido e conferir que o ponto da aba some.'
        ]
    },
    {
        numero: 38, nome: 'Gerenciar NF só com a relação de saída e novo Controle de NFs', status: 'concluida',
        implementado: [
            'Gerenciar NF volta a ser só as NFs escolhidas para a Saída de Texto, com duas abas: "Para saída" e "Em espera" (as marcadas como Pendente). Um atalho no fim da lista leva ao Controle de NFs. A Saída de Texto, a edição, o arquivar e a seleção em lote não mudaram.',
            'Controle de NFs (novo, em Mais › Atalhos; dá para trazer para a barra em Ajustes › Personalização): mostra o ciclo de cada NF com três abas. Em aberto = Recebida (já entrou por XML ou relatório ERP e ainda não está na relação) + Na relação + Em espera. Arquivadas = já foram para o financeiro, com a marca "Enviada ao financeiro". Diretas = NFs que não passam pelo financeiro. Cada NF mostra de onde veio (XML ✓ / ERP ✓ / só ERP).',
            'NF Recebida tem duas ações: "Enviar para a relação" (abre o Adicionar já preenchido; ao salvar, a NF fica ligada à nota criada) e "Não vai ao financeiro" (vai para Diretas, sem apagar nada; "Voltar para Em aberto" desfaz). Também dá para marcar várias de uma vez em "Selecionar".',
            '"Ignorar fornecedor ERP" agora vale também para as NFs desse fornecedor que já estavam esperando decisão: elas vão para Diretas automaticamente, e ao liberar o fornecedor voltam para Em aberto. Marcar uma NF só de XML como direta também vale quando o relatório ERP dela chegar.',
            'Ao arquivar uma nota que veio de uma NF, o histórico guarda de qual NF ela veio, para a NF não aparecer duplicada em Arquivadas.'
        ],
        mudou: [
            'Notas digitadas à mão não são cruzadas com XML/ERP por nome (não há chave confiável, como já registrado no Histórico): ficam como "Nota manual" e só se ligam a uma NF por vínculo explícito. Registros arquivados antes desta fase podem aparecer repetidos em Arquivadas.',
            'Nenhuma regra de saída de texto, fator, associação, cProd, GTIN ou SP Data mudou. A entrada do ERP ganhou os campos valor, marcadaDireta e bloqueioFornecedor.'
        ],
        testar: [
            'Em Gerenciar NF: trocar entre "Para saída" e "Em espera" e tocar em "Ver todas as NFs". No Controle: marcar uma NF Recebida como "Não vai ao financeiro", ver em Diretas e voltar; usar "Enviar para a relação" e salvar.'
        ]
    },
    {
        numero: 37, nome: 'Cotação individual em abas (Produtos · Anotações · Relatório · Dados)', status: 'concluida',
        implementado: [
            'A cotação individual (Central do Pedido) agora tem abas, no mesmo estilo das abas de Relatórios, logo abaixo do resumo: Produtos (os fornecedores e seus itens, com o status de entrega), Anotações (Nova Auditoria, Texto/Anotação e a anotação do pedido), Relatório (Complementar com Relatório do SmartCompras) e Dados (origem, datas, observação, Atualizar via XML e Editar Fornecedores). Abre sempre na aba Produtos.',
            'Os blocos recolhíveis da Fase 34 saíram: o que era "Dados do pedido" e "Complementar com Relatório" virou aba. Pedido sem cotação continua mostrando tudo junto (sem abas), como antes.',
            'Tela Mais: a seção dos destinos tirados da barra passou a se chamar "Atalhos" (antes "Fora da barra").'
        ],
        mudou: [
            'Nenhum campo, botão, regra ou dado mudou — só a organização da tela. Os mesmos ids e as mesmas funções continuam valendo.'
        ],
        testar: [
            'Abrir um pedido: tocar em cada aba (Produtos, Anotações, Relatório, Dados) e conferir que os campos e botões de sempre estão na aba esperada.'
        ]
    },
    {
        numero: 36, nome: 'Ajustes e Mais reorganizados, "não faturado" sem excesso de avisos, itens abertos na Entrada de NF', status: 'concluida',
        implementado: [
            'Central do Pedido: corrigido o bug em que "Dados do pedido" e "Complementar com Relatório do SmartCompras" apareciam vazios/achatados quando o pedido tinha muitos fornecedores (a tela é uma coluna e o navegador comprimia os blocos). Agora mantêm o tamanho e abrem normalmente.',
            '"Não faturado": deixa de ser gerado para fornecedor que ainda não deu entrada de nenhuma NF no pedido (ele fica só como "○ Aguardando entrega"). O aviso existe quando o fornecedor JÁ deu entrada de NF e um item da cotação dele ficou de fora. Os chips de divergência em Cotações e na Central não somam mais o "não faturado" (ele já aparece como entrega parcial).',
            'Entrada de NF: um bloco destacado lista, por nome, os itens da cotação deste fornecedor que ainda não vieram em nenhuma NF ("podem vir numa NF seguinte"). Agora considera também o pedido das associações dos itens da NF, não só o pedido escolhido no seletor (antes o aviso só aparecia com o pedido escolhido).',
            'Entrada de NF: todo item com pendência já abre sozinho (vários ao mesmo tempo), para preencher direto; itens prontos ficam recolhidos.',
            'Gerenciar NF: ao editar uma nota, a lista local e a Saída de Texto são atualizadas na hora (como já era na edição em lote), sem depender do retorno do banco.',
            'Navegação: o botão "Mais" agora é sempre ativo e guarda as ferramentas — "Importar Relatório (ERP)" saiu de Ajustes e vive em Mais, em "Ferramentas"; os destinos tirados da barra aparecem em "Atalhos". Ajustes ficou só com configurações. Telas abertas por "Mais" (inclusive Ajustes) ganham o Voltar para o próprio Mais. O Voltar agora é só o símbolo (como no iOS).'
        ],
        mudou: [
            'Nenhuma regra de saída de texto, fator, associação, cProd, GTIN ou SP Data foi alterada. A regra de REMESSA da Saída de Texto (vencimento vira "REMESSA") continua como sempre.'
        ],
        testar: [
            'Abrir um pedido com muitos fornecedores: "Dados do pedido" e "Complementar com Relatório" devem aparecer com título e abrir.',
            'Dar entrada num XML de um fornecedor que tem mais itens na cotação: o bloco "ainda não faturado(s)" deve listar os que faltam. Em Cotações, fornecedor sem NF não deve mais gerar divergência.',
            'Editar uma nota no Gerenciar NF e conferir a Saída de Texto logo em seguida.'
        ]
    },
    {
        numero: 35, nome: 'Cabeçalhos e títulos padronizados; barra de salvar da Entrada de NF deixa de ser fixa', status: 'concluida',
        implementado: [
            'Cabeçalho: o "Voltar" passou para a esquerda do título em todas as telas internas (padrão iOS), e o título ocupa o resto da linha sem quebrar. Ações do lado direito (sincronizar, selecionar em lote, contador) ficam sempre no mesmo lugar.',
            'Títulos dentro das telas seguem uma escala única: título da tela na Central (18), título de cartão (16) e rótulo de seção (13). Os títulos que só repetiam o cabeçalho (Entrada de NF, Produtos SP Data, Fornecedores) saíram; os que tinham tamanhos soltos (15 e 16 px avulsos) passaram para o estilo de título de cartão.',
            'Entrada de NF: os botões Salvar NF e Baixar XML Corrigido voltaram para o fim da lista (não ficam mais fixos cobrindo os itens); a frase do que falta continua acima deles. O nome do item recolhido mostra no máximo 2 linhas (nomes com lote e validade eram enormes) e aparece inteiro quando o item está aberto.'
        ],
        mudou: [
            'Só apresentação: nenhuma função, regra ou dado mudou. O botão Voltar é o mesmo (mesmo id e mesma ação), apenas movido no cabeçalho.'
        ],
        testar: [
            'Abrir Ajustes › qualquer tela interna: o Voltar fica à esquerda do título e funciona. Na Entrada de NF: rolar a lista e conferir que os botões de salvar só aparecem no fim.'
        ]
    },
    {
        numero: 34, nome: 'Cotações com resumo de entrega e Central do Pedido com blocos recolhíveis', status: 'concluida',
        implementado: [
            'Lista de Cotações: cada pedido agora mostra, em chips, a situação das entregas dos fornecedores (✓ completas, ◐ parciais, ◐ NF no ERP, ○ aguardando) e quantas divergências estão abertas — o mesmo cálculo do card do fornecedor na Central (XML do app + ERP), sem gravar nada. Título, fornecedores e limite ficaram em linhas separadas.',
            'Central do Pedido: o topo ganhou um resumo (fornecedores, limite e os mesmos chips). Os Fornecedores subiram para logo abaixo do resumo, e "Dados do pedido" (origem, datas, observação, Atualizar via XML, Editar Fornecedores) e "Complementar com Relatório do SmartCompras" viraram blocos recolhíveis, fechados ao abrir o pedido, com a mesma animação suave dos outros cartões.'
        ],
        mudou: [
            'Nenhum campo, botão, regra ou dado foi removido ou alterado: os mesmos campos continuam no mesmo documento e os mesmos botões continuam funcionando; só mudaram a ordem na tela e o recolher/abrir. Nova Auditoria, Texto/Anotação e a Anotação do pedido continuam no fim.'
        ],
        testar: [
            'Abrir Cotações e conferir os chips de cada pedido; abrir um pedido e ver o resumo no topo, os fornecedores logo abaixo e, tocando em "Dados do pedido", os campos de sempre (editar origem/data deve continuar salvando).'
        ]
    },
    {
        numero: 33, nome: 'Entrada de NF mais enxuta: resumo, pendências em linhas, itens recolhíveis e barra de salvar', status: 'concluida',
        implementado: [
            'Depois que o XML é carregado, o bloco de importação vira uma linha curta (trocar o arquivo + unidade de dispensação) e o resumo da NF fica compacto: fornecedor em destaque, depois NF · série · data, valor · itens e CNPJ.',
            'Cada item agora é uma linha recolhida com nome, código, quantidade e estado (✓ Pronto ou o 1º motivo da pendência). Um item abre por vez, com a mesma animação suave dos outros cartões; ao carregar uma NF, o primeiro item com pendência já abre sozinho. Dentro do item continua tudo: código do fornecedor, fator e Confirmar fator, cotação/SP Data, associações conhecidas, código já associado, recurso.',
            'Os avisos de "Resolva antes de salvar" viraram uma lista de linhas (uma pendência por linha). O texto e as regras são os mesmos.',
            'Os botões Salvar NF e Baixar XML Corrigido ficam fixos embaixo da tela, com uma linha que diz o que falta ("2 pendências para resolver antes de salvar", "Tudo pronto para salvar"). Salvar continua clicável e explicando o motivo quando bloqueado, como antes.',
            'Gerenciar NF: o contador do cabeçalho ficou curto ("4 · 2 pend.", o texto completo aparece ao segurar) e o título "Gerenciar NF" não quebra mais em duas linhas.'
        ],
        mudou: [
            'Nenhuma regra de pendência, bloqueio, fator, associação, cotação ou saída mudou — só a apresentação e o recolher/abrir dos itens. cProd, GTIN, SP Data e associações históricas não foram tocados.'
        ],
        testar: [
            'Carregar um XML: o resumo deve ficar curto, o primeiro item com pendência abrir sozinho e, ao tocar em outro item, o anterior fechar. Confirmar um fator e conferir que a linha do item vira ✓ Pronto.',
            'Conferir a barra fixa embaixo com Salvar NF / Baixar XML Corrigido e a frase de pendências.'
        ]
    },
    {
        numero: 32, nome: 'Barra de navegação configurável (com "Mais") e card compacto no Gerenciar NF', status: 'concluida',
        implementado: [
            'Barra inferior configurável: em Ajustes › Personalização › "Ordem dos Menus e barra inferior", cada destino ganhou a opção "Na barra". A quantidade é você quem escolhe: com todos marcados a barra mostra todos e o botão "Mais" não aparece; ao desmarcar algum, o botão "Mais" surge sozinho na barra e abre uma lista com os destinos que saíram. Os ícones de todos os destinos já existem (nos 4 estilos), então qualquer um pode voltar à barra quando quiser. A ordem continua com as setas de antes e vale para a barra e para o "Mais". O menu lateral (telas largas) continua mostrando tudo.',
            'O botão "Mais" fica destacado quando a tela atual é um destino que está dentro dele.',
            'Gerenciar NF: card mais limpo. Em cima ficam fornecedor · NF, valor · vencimento · recurso e uma etiqueta de prazo ("Venceu há 2 dias", "Vence hoje", "Vence em 3 dias"); abaixo, a aptidão para saída e os dados do pedido. Editar, Pendente/Retomar, Arquivar, Excluir, o painel de edição com a animação de abrir/fechar, a seleção em lote e a busca continuam exatamente como eram.'
        ],
        mudou: [
            'Nenhum dado, regra ou saída de texto mudou. A escolha da barra é guardada no mesmo lugar da ordem dos menus (personalização). Instalações antigas começam com todos os destinos na barra, como já era.'
        ],
        testar: [
            'Em Ajustes › Personalização, desmarcar "Na barra" de 2 destinos: o botão "Mais" aparece e lista os 2. Marcar de volta: o "Mais" some.',
            'Gerenciar NF: abrir "Editar" numa nota (a animação e os campos devem ser os de sempre) e conferir a etiqueta de prazo.'
        ]
    },
    {
        numero: '31.1', nome: 'Entrega via ERP: só conta quando a quantidade é comparável com segurança', status: 'concluida',
        implementado: [
            'Correção da Fase 31: uma NF associada no ERP não faz mais o item contar como entregue automaticamente. O ERP traz a quantidade na unidade de dispensação (SP Data) e a cotação não guarda unidade nem fator, então a quantidade do ERP não pode ser comparada com a cotada "no escuro".',
            'A quantidade do ERP só é comparada quando TODAS as linhas do ERP daquele produto têm o mesmo valor unitário da cotação (mesmo critério já usado na Fase 8): preço por unidade igual significa mesma unidade. Nesse caso: quantidade do ERP >= cotada = item entregue; menor = item parcial (aparece "x/y" no card). Se o valor unitário não bate, o produto é do tipo "NF no ERP, sem como conferir a quantidade" e NÃO conta como entregue.',
            'Fornecedor com NF no ERP mas sem item conferido aparece como "◐ NF no ERP — itens/quantidades não conferidos" (o botão manual continua disponível). O card passa a listar "Faltam: Produto (13/20)" com a quantidade já recebida, somando todas as NFs do pedido por produto.'
        ],
        mudou: [
            'NFs/XML do app seguem como antes (soma de todas as NFs por produto, com conversão de unidade). Nada de cProd, GTIN, SP Data, associações históricas ou da regra de "não faturado" foi alterado.'
        ],
        testar: [
            'Pedido com NF só no ERP (sem XML): se o valor unitário do ERP bate com a cotação, o card mostra completo ou parcial conforme a quantidade; se não bate, mostra "NF no ERP — itens/quantidades não conferidos".'
        ]
    },
    {
        numero: 31, nome: 'Entrega do fornecedor calculada automaticamente (XML + ERP) e busca de NF por entidade', status: 'concluida',
        implementado: [
            'No card de cada fornecedor da Central do Pedido, "Já chegou" agora é um status CALCULADO: ✓ Entrega completa, ◐ Entrega parcial (x/y itens) ou ○ Aguardando entrega. Cada produto da cotação conta como entregue quando há evidência: NF/XML processada no app com a quantidade cotada (a conta é a mesma da comparação, inclusive conversão de unidade), entrada do ERP associada ao pedido, ou divergência marcada como "Resolvido". Todas as NFs do pedido são somadas — uma segunda NF completa o que a primeira deixou faltando e o status vira completo sozinho.',
            'Quando há 2 ou mais NFs do app para o fornecedor, o card mostra o histórico NF a NF (ex.: NF 1 → 1/2 itens · NF 2 → 2/2 itens). É calculado das NFs já salvas; nada novo é gravado.',
            'ERP e XML são diferenciados: a NF associada agora aparece como "registrada no ERP e associada a este pedido · XML processado no app" ou "· sem XML processado no app". NF no ERP cujos itens o app não consegue identificar aparece como "◐ NF no ERP — itens não conferidos" (não afirma entrega completa).',
            '"Marcar como já chegou" continua como EXCEÇÃO (material chegou sem NF/ERP no app) e fica sempre identificado como "confirmado manualmente"; só pesa quando o cálculo automático não chega em "completa". Com entrega parcial aparece "Marcar parcial como resolvida" (parcial aceita). Ambas têm "Desfazer marca manual".',
            'Associar NF do histórico: a busca agora considera todos os CNPJs da mesma entidade do fornecedor (cadastro SP Data), não só o CNPJ exato da cotação; o mesmo vale para casar a entrada do ERP com os itens do fornecedor. O filtro por número já filtrava enquanto se digita — o texto do campo agora diz isso. Várias NFs no mesmo pedido/fornecedor já eram possíveis; o botão passa a dizer "Associar outra NF do histórico".'
        ],
        mudou: [
            'A marca manual continua no mesmo lugar (chegadasPorFornecedor, no documento da cotação); só ganhou o campo opcional "tipo" para a parcial resolvida. Marcas antigas continuam valendo.',
            'Nenhuma associação (cProd, GTIN, SP Data, fornecedor → cotação) foi alterada. As divergências "não faturado" continuam sendo geradas pela mesma regra de antes.'
        ],
        testar: [
            'Abrir um pedido com fornecedor que já tem NF processada cobrindo todos os itens: o card deve mostrar ✓ Entrega completa sem precisar clicar. Com só parte dos itens: ◐ Entrega parcial; processar a NF que falta e ver virar completa.',
            'Num fornecedor com NF do ERP associada: a linha da NF deve dizer se há ou não XML no app, e não aparecer mais "sem NF no app" junto com "NF associada ao pedido".'
        ]
    },
    {
        numero: 30, nome: 'Reaproveitar o código de fornecedor já associado ao produto', status: 'concluida',
        implementado: [
            'No Editor XML, cada item com produto SP Data conhecido passa a mostrar "Código de fornecedor já associado a este produto": os códigos de fornecedor (mesma entidade) que no histórico do app já foram ligados ao mesmo SP Data. Ex.: item com código novo 645, produto SP Data 98 → aparece o 123, com "Usar 123 na saída". Ao tocar, o código de saída passa a ser 123; o original continua guardado e a confirmação "original → novo" antes de gerar o XML segue obrigatória.',
            'Só códigos VIGENTES são sugeridos (as duas pontas do vínculo: fornecedor → cotação → SP Data). Mais antigo primeiro, com "vigente desde". A "sugestão principal" só aparece quando a ordem é confiável; havendo data aproximada (registro antigo sem histórico) ou datas iguais, o app avisa e você escolhe. Todos os vigentes ficam disponíveis. Os substituídos aparecem só em "Ver substituídos — só histórico".',
            'Compra direta: o código só é sugerido quando dá para recuperá-lo com segurança (sem "/" no código, ou confirmado pelas NFs processadas); caso contrário não é sugerido.',
            'O botão "Usar esta associação" foi corrigido: não grava mais o código SP Data no código de saída. Agora é "Ver códigos deste produto" e só define o produto de referência da busca.',
            'Rastreabilidade: nas NFs novas, quando o código de saída difere do original, o histórico de NFs processadas guarda também o código usado na saída (campo cProdSaida). NFs antigas não são reconstruídas.'
        ],
        mudou: [
            'Nada é gravado nas associações (fornecedor → cotação → SP Data) nem na memória de fator. GTIN/SEM GTIN não participa. O código SP Data nunca vai para o cProd.',
            'O "Excluir do histórico" não foi alterado (correção separada, Fase 30.1): hoje ele pode apagar a data de vigência de um código; quando isso acontece o app mostra "data aproximada".'
        ],
        testar: [
            'Processar uma NF com um código novo do fornecedor, já associado ao SP Data de um produto que outro código do mesmo fornecedor já usou: o bloco deve listar o código antigo; tocar em "Usar ... na saída" e conferir "original → novo" na confirmação ao baixar o XML.',
            'Conferir que o cProd do XML baixado é o código antigo (nunca o código SP Data).'
        ]
    },
    {
        numero: '29.1', nome: 'Memória de fator: itens \"SEM GTIN\" deixam de compartilhar o mesmo fator', status: 'concluida',
        implementado: [
            'A memória do fator de conversão (por fornecedor + produto) usava o código de barras da NF como chave. Quando o XML traz \"SEM GTIN\", todos os itens sem código de barras do mesmo fornecedor caíam na mesma chave e herdavam o fator um do outro. Agora, sem código de barras real, a chave é CNPJ do fornecedor + código do produto (cProd).'
        ],
        mudou: [
            'Código de barras real: nada muda (mesma chave de antes). Itens que já vinham sem o campo cEAN: nada muda (essa já era a chave usada).',
            'As memórias antigas gravadas sob \"SEM GTIN\" (ou zeros) NÃO são apagadas nem alteradas, mas deixam de ser aplicadas automaticamente, porque eram compartilhadas entre produtos diferentes e não dá para saber de qual produto cada uma veio. Na próxima NF desses itens o app pede a conferência da conversão uma vez, e a partir daí cada produto guarda o próprio fator.',
            'Associações NF-e → cotação → SP Data não foram tocadas.'
        ],
        testar: [
            'Processar uma NF com dois produtos sem código de barras do mesmo fornecedor, confirmar fatores diferentes e baixar o XML; processar de novo e conferir que cada produto volta com o próprio fator.',
            'Um produto com código de barras real continua lembrando o fator como antes.'
        ]
    },
    {
        numero: 29, nome: 'Auditoria retroativa: associar NF do histórico (ERP) a partir da Central', status: 'concluida',
        implementado: [
            'Em cada fornecedor da Central do Pedido: \"Associar NF do histórico\". Lista as NFs do ERP já importadas daquele fornecedor (pelo CNPJ), com filtro pelo número da NF. Ao associar, a NF é vinculada ao pedido — o mesmo vínculo que o app já usa — e os itens que baterem exatamente em quantidade e valor com itens da cotação ainda sem SP Data são associados automaticamente (regra da Fase 8, sem aproximação).',
            'Item da cotação que tem SP Data associado passa a mostrar, na comparação, a quantidade lançada no ERP da NF associada, mesmo sem XML. O selo fica \"Lançado no ERP (sem NF)\" (não \"Confere\"), e o item deixa de aparecer como \"não faturado\".',
            'Cada NF associada por aqui tem \"Desfazer\", que restaura o vínculo anterior.'
        ],
        mudou: [
            'Não compara automaticamente cotado × lançado no ERP quando não há NF/XML: a quantidade aparece lado a lado pra você conferir. Nenhuma divergência nova é criada.',
            'NFs digitadas manualmente (sem itens) não entram aqui; pra elas use \"Marcar como já chegou\".',
            'Reimportar o relatório do ERP da mesma NF recalcula o vínculo dela (comportamento já existente da importação).'
        ],
        testar: [
            'Cotação com fornecedor cuja NF já está no histórico por importação do ERP: abrir o fornecedor, Associar NF do histórico, filtrar pelo número, Associar e conferir o toast e os itens com \"Lançado no ERP (sem NF)\".',
            'Conferir que itens com NF/XML já processada continuam iguais, e que Desfazer remove o vínculo (os itens voltam ao estado anterior).'
        ]
    },
    {
        numero: 28, nome: 'Cotações: \"Já chegou\" por fornecedor e \"Resolvido\" por item', status: 'concluida',
        implementado: [
            'Dentro de cada fornecedor da Central do Pedido: botão \"Marcar como já chegou\" (com \"Desfazer\"). Com a marca, os itens daquele fornecedor deixam de aparecer como \"não faturado\" e a linha mostra \"Chegou\" — serve para quando o material chegou mas a NF não foi lançada no app.',
            'Na comparação Cotação × NF × ERP de cada produto com divergência: \"Marcar como resolvido\" (com \"Reabrir\" e a data). O item resolvido passa a \"✓ Resolvido\" e deixa de contar como divergência pendente na aptidão da nota.'
        ],
        mudou: [
            'Os dois dados ficam no próprio documento da cotação (chegadasPorFornecedor e resolvidosPorItem), sem coleção nova, e sobrevivem à reimportação da cotação.',
            'A divergência em si continua calculada e visível; \"Resolvido\" só a sinaliza como tratada. As auditorias já geradas e o \"Alterar status\" não mudaram.'
        ],
        testar: [
            'Central do Pedido de uma cotação com NF processada de só um fornecedor: marcar o outro como \"já chegou\" e conferir que os itens dele saem do \"não faturado\"; desfazer e ver voltar.',
            'Item com divergência: Marcar como resolvido, ver o selo verde e a data; Reabrir; conferir no Gerenciador que a nota deixa de aparecer com divergência pendente enquanto resolvido.',
            'Reimportar a cotação (XML) e conferir que as marcas continuam.'
        ]
    },
    {
        numero: 27, nome: 'Central do Pedido: linha de produto unificada e abertura suave', status: 'concluida',
        implementado: [
            'Dentro de cada fornecedor, cada produto agora é UMA linha recolhível. Fechada: nome, SP Data e status (\"Confere\", \"diverg.\" ou \"Auditoria pendente\"). Aberta: dados da cotação, comparação Cotação × NF × ERP (com \"Gerar auditoria\") e as divergências da auditoria daquele item (com \"Alterar status\").',
            'As três listas separadas por fornecedor (Produtos Cotados, Comparação, Divergências) deixaram de existir como blocos; o cabeçalho do fornecedor mostra o resumo (itens, com divergência, auditorias pendentes).',
            'Fornecedor e produto abrem e fecham com animação suave (mesma ideia do Gerenciador NF): os itens de baixo são empurrados na ida e na volta, sem redesenhar a tela.'
        ],
        mudou: [
            'Uma divergência da auditoria aparece no produto cujo nome bate EXATAMENTE com um dos materiais dela; as que não batem (ou que não são por material, como \"não entregou\") ficam em \"Outras divergências deste fornecedor\" no fim do fornecedor. Nenhuma some nem se repete.',
            'Nenhum dado ou regra mudou: só a apresentação. \"Resolvido\" na comparação e \"Já chegou\" ainda NÃO existem (próximas fases). A animação de altura exige iOS 16 ou mais novo; em versões antigas abre sem animar.'
        ],
        testar: [
            'Cotação com NF processada: abrir um fornecedor, tocar num produto e conferir cotação, comparação e divergências dentro da mesma linha; fechar e ver os itens de baixo subirem suavemente.',
            'Produto com divergência: \"Gerar auditoria\" continua abrindo a Nova Auditoria pré-preenchida; depois, a divergência registrada aparece na linha do produto e \"Alterar status\" funciona.',
            'Conferir que nenhuma divergência antiga sumiu: as que não pertencem a um produto ficam em \"Outras divergências deste fornecedor\".'
        ]
    },
    {
        numero: 26, nome: 'Fator fixo por produto SP Data; sugestão por NF na tela Adicionar', status: 'concluida',
        implementado: [
            'Produtos SP Data: o botão \"Editar\" (antes \"Renomear\") ganhou o campo opcional \"Fator fixo (unidades por embalagem)\", pensado só para os poucos produtos de fator constante (ex.: clonazepam 500 gotas/frasco, prednisolona 60 doses/frasco). Sem o campo, o produto se comporta como antes.',
            'Entrada de NF: quando o item é associado a um produto SP Data com fator fixo e não existe memória de fator do fornecedor, o campo Fator já vem preenchido e marcado \"fator fixo do produto\". Continua editável; se você mexer ou confirmar o fator, o app não sobrescreve.',
            'Tela Adicionar: ao digitar o número da NF, aparecem sugestões das notas do histórico com exatamente esse número (fornecedor, valor, vencimento e recurso). Tocar na sugestão preenche os campos; nada é preenchido sozinho.'
        ],
        mudou: [
            'A memória por fornecedor + produto continua com prioridade sobre o fator fixo.',
            'Reimportar o relatório de Produtos SP Data preserva o fator fixo cadastrado.',
            'Salvar só o fator fixo não marca mais o nome como editado manualmente (isso só ocorre se o nome mudar).',
            'Ao salvar a edição de um produto SP Data, a lista é redesenhada na hora (antes podia continuar mostrando o formulário até outra atualização).'
        ],
        testar: [
            'Produtos SP Data: pesquisar o clonazepam, Editar, informar 500, Salvar; reimportar o relatório e conferir que o 500 continua.',
            'Entrada de NF com esse produto de um fornecedor sem memória: o Fator deve vir 500 com o selo \"fator fixo do produto\"; alterar o número e conferir que não volta sozinho.',
            'Adicionar: digitar a NF de uma nota arquivada e tocar na sugestão; digitar uma NF inexistente e conferir que nada aparece.'
        ]
    },
    {
        numero: '25.4', nome: 'NF duplicada travada na importação do ERP; arquivar nota individualmente', status: 'concluida',
        implementado: [
            'NF + fornecedor é um dado absoluto: se já existe uma nota PENDENTE com o mesmo fornecedor e NF, a importação do relatório do ERP agora vem com o checkbox dessa linha travado (não dá mais pra marcar e importar de novo por engano). Duplicata contra uma nota já arquivada (histórico) continua só um aviso, já que reimportar algo resolvido antes pode ser proposital.',
            'Corrigido também um nome de fornecedor que podia aparecer errado ("[object Object]") na prévia da importação.',
            'Gerenciar NF: cada nota ganhou o botão "Arquivar", pra mandar pro Histórico sem precisar excluir.'
        ],
        mudou: ['Nenhuma nota existente foi alterada; só passou a impedir criar uma segunda pendente igual.'],
        testar: ['Importar o relatório do ERP duas vezes seguidas com a mesma NF/fornecedor: na segunda vez, a linha já deve vir travada. No Gerenciar, usar "Arquivar" numa nota e conferir que ela vai pro Histórico.']
    },
    {
        numero: '25.3', nome: 'Recurso sugerido ao importar o relatório do ERP', status: 'concluida',
        implementado: [
            'Na tela Importar Relatório (ERP), o campo Recurso de cada nota já vem preenchido quando essa NF passou antes pela Entrada de NF e todos os itens dela concordam no mesmo recurso — reaproveita o que já foi determinado lá, não recalcula nada.',
            'Sem essa informação, ou com mais de um recurso na mesma nota, o campo continua em branco pra escolha manual, como antes.'
        ],
        mudou: ['Só o preenchimento inicial do campo; continua editável antes de importar.'],
        testar: ['Importar o relatório do ERP de uma NF já processada pela Entrada de NF: o Recurso já vem selecionado, com "Sugerido pela Entrada de NF desta nota" embaixo.']
    },
    {
        numero: '25.2', nome: 'Falso positivo de unidade sinalizado por produto', status: 'concluida',
        implementado: [
            'Botão "Falso positivo (unidade)" ao lado de "Gerar auditoria" nas divergências de quantidade/valor da Entrada de NF: sinaliza o produto SP Data pra que esse tipo de divergência deixe de aparecer nele (ex.: insulinas cotadas em uma unidade e recebidas em outra).',
            'Em Produtos SP Data, cada produto ganhou o botão "Ignorar divergência de unidade" / "Voltar a conferir unidade", pra sinalizar antes ou desfazer. A reimportação do inventário preserva a sinalização.'
        ],
        mudou: ['Só as divergências de quantidade cotada e valor unitário são ignoradas nos produtos sinalizados; item não faturado e valor total continuam sendo conferidos.'],
        testar: ['Numa NF com divergência de quantidade num item com SP Data associado: tocar "Falso positivo (unidade)" e ver a divergência sumir; desfazer em Produtos SP Data.']
    },
    {
        numero: '25.1', nome: 'Correção: sugestão de cotação agora funciona com nomes reais', status: 'concluida',
        implementado: [
            'A sugestão automática de associação com a cotação (botão "Usar: código — nome") exigia que TODAS as palavras do nome do XML aparecessem na descrição da cotação — o que quase nunca acontece, porque o XML do fornecedor traz o sal químico, a forma farmacêutica e a embalagem ("MIDAZOLAM CLORIDRATO 5MG/ML SOL INJ 10ML") e a descrição da cotação é mais curta ("MIDAZOLAM 5MG/ML CX C/100AP X 10ML GEN"). Por isso não sugeria quase nada.',
            'Agora, se as palavras todas não baterem, tenta um segundo critério: a primeira palavra do nome (o princípio ativo) e a dosagem (ex. "5MG/ML") precisam estar nos dois lados. Ainda é só uma sugestão — nunca associa sozinho — e sem correspondência boa continua no fluxo manual de sempre.'
        ],
        mudou: ['Só a sugestão de cotação; a associação, o fator e o resto do fluxo continuam iguais.'],
        testar: ['Item do XML com sal/forma farmacêutica no nome, cuja cotação tem o nome mais curto: deve aparecer a sugestão "Usar: ..." com o item certo. Mesmo princípio ativo com dosagem diferente: não deve sugerir.']
    },
    {
        numero: 25, nome: 'Falso positivo de unidade, alerta de valor total e sugestão automática de cotação', status: 'concluida',
        implementado: [
            'Corrigida a conferência Cotação × NF × ERP pra não acusar divergência quando o SmartCompras cota numa unidade e o SP Data dispensa em outra (ex.: cotação em frasco, dispensação em gotas — 500 gotas/frasco; ou em doses — 60 doses/frasco). A quantidade e o valor unitário faturados agora são conferidos tanto do jeito direto quanto convertidos pelo Fator confirmado na Entrada de NF; só vira divergência quando NENHuma das duas contas fecha — uma quantidade genuinamente errada continua sendo pega normalmente.',
            'Novo alerta de valor total por fornecedor dentro do pedido, na própria Entrada de NF: compara o valor cotado com o valor já faturado (todas as NFs desse fornecedor nesse pedido, incluindo a que está sendo editada). Quando a diferença é só o quanto falta dos itens que ainda não apareceram em nenhuma NF, fica um informativo (entrega parcial é normal); quando a diferença não se explica só por isso, vira um alerta de verdade, porque algo pode estar errado (preço, quantidade, item a mais).',
            'Associação com a cotação: quando o item ainda não está associado, o sistema já sugere direto pelo nome (o mesmo princípio já usado pra sugerir o SP Data) — aparece um botão "Usar: código — nome" pra confirmar com um toque, sem precisar abrir a lista. Cada palavra do nome do XML precisa achar uma equivalente no nome da cotação (inclusive abreviações como "COMP" de "COMPRIMIDO"); sem essa correspondência, continua caindo no fluxo manual de sempre — nunca decide sozinho.'
        ],
        mudou: [
            'A conferência de valor usa o preço × quantidade ORIGINAIS da nota (antes da conversão), que é sempre o valor real pago, independente de qualquer fator — funciona certo mesmo numa NF com itens de mais de um pedido.',
            'NFs salvas antes desta fase (sem o fator de cada linha) continuam comparadas como antes, sem regressão.'
        ],
        testar: [
            'Um item cotado numa unidade e dispensado em outra (fator confirmado ≠ 1): não deve mais gerar divergência de quantidade/valor quando a conta bate pela conversão.',
            'Uma NF que só fatura parte dos itens do fornecedor: aparece o aviso de valor total como informativo, citando os itens que faltam — sem bloquear o "pronta".',
            'Um item com preço realmente errado (sem nenhum item pendente que explique): o aviso de valor total vira alerta de verdade.',
            'Um item do XML com nome parecido ao de um item da cotação (mesmo com abreviação): aparece a sugestão "Usar: ..." pra confirmar com um toque.'
        ]
    },
    {
        numero: 24, nome: 'Recurso separado das pendências; NF já processada; upload de arquivo no SP Data', status: 'concluida',
        implementado: [
            'O resumo de recurso pelas cotações (e outros avisos puramente informativos: itens de outro pedido já resolvidos, itens que ainda podem vir numa NF seguinte) saiu da área de pendências (amarela) e ganhou um cartão neutro próprio, sem cor de alerta. Uma NF com tudo certo agora fica "✓ Pronta" (verde) mesmo tendo recurso pra mostrar.',
            'Entrada de NF: ao carregar um XML de uma NF que já foi salva antes (mesmo número, série e fornecedor), aparece um aviso "✓ NF já processada", com a data e o pedido. Testei separadamente que o fator e as associações já confirmadas continuam sendo lembradas por fornecedor/produto — não pedem confirmação de novo.',
            'Produtos SP Data: botão "Subir Arquivo" pra completar/atualizar o cadastro a partir de um .txt, além de colar o texto — igual já existe no cadastro de Fornecedores SP Data.'
        ],
        mudou: ['Nenhuma regra de recurso, fator ou associação mudou; só apresentação e o aviso de reprocessamento.'],
        testar: [
            'Uma NF com todos os itens certos (associação, SP Data e recurso definido): confirmar que fica "✓ Pronta" em verde, com o recurso aparecendo separado, sem amarelo.',
            'Reabrir/reprocessar uma NF já salva: aparece o aviso "NF já processada"; os itens não voltam a pedir confirmação de fator.',
            'Produtos SP Data: usar "Subir Arquivo" com um .txt do relatório do SGH.'
        ]
    },
    {
        numero: 23, nome: 'Importação do inventário SP Data: coluna de nome não é mais fixa em 38 caracteres', status: 'concluida',
        implementado: [
            'Complementar cadastro → Produtos SP Data: o leitor do relatório colado passou a ler a largura das colunas direto da borda do próprio relatório (o "+----+----+"), em vez de uma largura fixa de 38 caracteres. Agora aceita qualquer um dos relatórios do SGH (Listagem de itens, por grupo, por subgrupo, por local...), cada um com sua própria largura, sem cortar o nome quando a coluna colada é mais larga.',
            'Testado com 6 formatos reais do SGH; o recomendado é "Itens por subgrupo II" (58 caracteres de nome, cobre os 2.682 produtos sem repetição). "Relatório de Itens por Local" também tem coluna larga (72), mas só lista os itens que têm local de armazenagem vinculado — não serve pra completar o cadastro todo.'
        ],
        mudou: [
            'Continua funcionando com o formato antigo (38 caracteres) se alguém colar assim, e continua protegendo nomes editados manualmente (nomeEditadoManualmente) — reimportar nunca reverte uma renomeação feita à mão.',
            'Sem a borda "+----+----+" reconhecível no texto colado, cai nas posições do formato antigo, como sempre foi.'
        ],
        testar: ['Complementar cadastro → Produtos SP Data → colar o relatório "Itens por subgrupo II" → Processar: confirmar que os nomes vêm completos (ex.: "CABO DE MADEIRA 1,3 MT", não cortado) e que um produto renomeado manualmente antes continua com o nome que você deu.']
    },
    {
        numero: '22.2', nome: 'Nome real da cotação como central; reorganização da Entrada de NF; histórico recolhível e excluível', status: 'concluida',
        implementado: [
            'Revertido: o nome exibido como título do produto na tela Cotações volta a ser o nome oficial do SmartCompras (não mais o nome do SP Data). O SP Data aparece sempre como linha secundária, visível sem precisar expandir — evita o problema de nomes do SP Data parecidos/cortados esconderem o nome real e levarem a uma associação errada.',
            'Entrada de NF: o botão de corrigir a associação com a COTAÇÃO agora aparece logo depois da linha "Cotação:", antes do recurso — não mais por último, escondido depois de dois outros botões. Os três botões "Corrigir" da tela ganharam nomes específicos: "Corrigir cotação", "Corrigir SP Data", "Corrigir recurso".',
            'Histórico de associações do código do fornecedor: painel recolhido por padrão (mostra só o resumo, com "Ver histórico"/"Recolher"); cada entrada do histórico que não é a vigente hoje ganhou "Excluir do histórico", pra tirar tentativas erradas ou duplicadas que só atrapalhavam a leitura.'
        ],
        mudou: [
            'A entrada vigente de uma associação nunca pode ser excluída por aqui — pra corrigi-la, continua sendo "Corrigir cotação"/"Corrigir SP Data" (que registra uma nova entrada, sem apagar as antigas).',
            'Excluir do histórico pede confirmação e não pode ser desfeito; só remove a entrada do histórico, não muda a associação vigente nem nenhum dado de NF já salva.'
        ],
        testar: [
            'Tela Cotações: o nome do produto continua sendo o nome do SmartCompras mesmo depois de associar ao SP Data; o SP Data aparece como linha abaixo, sempre visível.',
            'Entrada de NF: o botão "Corrigir cotação" aparece logo após a linha da cotação, antes do recurso.',
            'Um item com histórico de mais de uma associação: o painel abre recolhido; "Ver histórico" mostra a lista; a vigente não tem botão de excluir, as outras têm "Excluir do histórico".'
        ]
    },
    {
        numero: '22.1', nome: 'Ajustes: recurso por item, espaçamento e checkbox da Entrada de NF', status: 'concluida',
        implementado: [
            'Recurso por item: o botão "Trocar pra…" só aparece quando faz sentido — quando o item NÃO atinge o mínimo de fornecedores (Recurso Próprio) ou quando já é uma exceção definida manualmente. Quando o item já atingiu o mínimo (C/C, o caso comum) não tem mais um botão sugerindo baixar pra Recurso Próprio — só um link discreto "Corrigir" pro caso raro de precisar mesmo assim.',
            'Cabeçalho informativo acima da lista de itens: "Recurso pelas cotações: X item(ns) com 3+ fornecedores (C/C) · Y item(ns) com menos (Recurso Próprio)" (ou "todos atingiram", quando não há nenhum abaixo do mínimo).',
            'Entrada de NF: mais espaço entre o seletor de pedido, a cotação adicional e a caixinha "sem cotação do SmartCompras"; a caixinha ficou maior (22px), mais fácil de tocar no celular.'
        ],
        mudou: ['Só apresentação da Entrada de NF. Nenhuma regra de recurso, associação ou dado gravado foi alterada.'],
        testar: ['Item com 3+ fornecedores: mostra o recurso e só o link discreto "Corrigir", sem botão de destaque. Item com menos de 3: mostra o botão "Trocar pra C/C" normalmente. Cabeçalho mostra a contagem certa.']
    },
    {
        numero: 22, nome: 'NF com itens de mais de um pedido (cotação adicional)', status: 'concluida',
        implementado: [
            'Quando os itens da NF já têm associação confirmada apontando pra pedidos diferentes, o app não força mais escolher um só: usa o pedido principal (seletor de cima) e adiciona os demais automaticamente como "cotação adicional", mostrados em chips removíveis logo abaixo.',
            'Também dá pra adicionar manualmente: "+ Adicionar cotação" ao lado do seletor de pedido, listando as cotações cadastradas que ainda não foram usadas nesta NF.',
            'A lista de itens da cotação (associação de cada produto) passa a mostrar as opções de todas as cotações selecionadas; se o mesmo código do SmartCompras existir em mais de um pedido, a opção mostra "[Pedido …]" pra diferenciar.'
        ],
        mudou: [
            'Recurso por item continua raro de mexer: ele já procura a cotação certa sozinho (pelo código), então não precisa de nenhuma tela nova — funciona igual com uma ou várias cotações.',
            'NF salva: o campo "pedido" continua sendo só o principal (nenhuma NF antiga muda de formato); um campo "pedidos" (lista) só aparece quando há mais de um. Cada item ganha "pedidoItem" só nesse caso, pra a conferência não confundir o mesmo código em pedidos diferentes.',
            'A conferência Cotação × NF × ERP, o alerta de itens esperados e "Gerar auditoria" agora consideram todas as cotações da NF, não só a principal.'
        ],
        testar: [
            'NF com itens de dois pedidos já associados antes: confirmar que os dois entram automaticamente (chips) e a conferência considera os dois, sem pedir escolha manual.',
            'Adicionar uma cotação manualmente por "+ Adicionar cotação" e depois remover pelo × do chip.',
            'Associar um item a um código que existe em duas cotações selecionadas: o seletor mostra "[Pedido …]" em cada opção.',
            'NF de um pedido só (o caso comum): tudo igual a antes, sem chips nem "[Pedido …]" nas opções.'
        ]
    },
    {
        numero: 21, nome: 'Tratamento da NF antes de salvar (recurso, compra direta e conferência)', status: 'concluida',
        implementado: [
            'Recurso na própria linha do item, antes de salvar: mostra o recurso previsto e o motivo (quantos fornecedores cotaram), com "Trocar pra…". A escolha fica na tela e só grava ao "Salvar NF" — acabou o ciclo salvar, revisar e salvar de novo. O bloco de recurso pós-salvamento saiu.',
            'Conferência Cotação × NF × ERP ao vivo: recalcula a cada mudança (fator, associação, pedido) com a NF em edição contada como se já estivesse salva, sem gravar nada. Itens com conversão ainda não confirmada aguardam, sem falso alarme. "Gerar auditoria" também funciona antes de salvar.',
            'Compra direta (sem cotação do SmartCompras): opção "— Sem cotação do SmartCompras (compra direta) —" no seletor de associação de cada item, e uma caixinha "Esta NF não possui cotação do SmartCompras" como atalho pra NF inteira. O item passa a associar só com o SP Data (lembrado por fornecedor + código), o recurso começa como Recurso Próprio do destino, e o destino (Santa Casa/CTI) é pedido quando não há cotação pra informá-lo.'
        ],
        mudou: [
            'NFs com cotação seguem como antes. Na NF salva ficam os campos semCotacaoSmartCompras, destino e, nos itens diretos, semCotacao e recurso; a aptidão, o Gerenciar e o filtro de destino dos Relatórios leem esses dados.',
            'A associação SP Data de itens diretos usa a mesma coleção de associações SP Data, com chave "DIRETO::" + CNPJ + código do fornecedor (nenhuma coleção nova). O ERP ignora essas chaves ao ligar itens a códigos da cotação.'
        ],
        testar: [
            'NF com cotação: o recurso aparece em cada item antes de salvar, dá pra trocar, e a conferência muda ao confirmar/alterar um fator. Salvar NF grava tudo de uma vez.',
            'NF sem cotação (caixinha): escolher o destino, associar os itens ao SP Data, conferir o recurso Recurso Próprio e trocar um item pra C/C; salvar e ver destino/recurso no Gerenciar.',
            'NF mista: com o pedido selecionado, escolher "Sem cotação do SmartCompras" na lista de um item (ex.: álcool) e conferir que os outros itens seguem normais.',
            'Carregar outro XML depois de salvar: nada da NF anterior deve aparecer.'
        ]
    },
    {
        numero: '20.1', nome: 'Correção: resquício da NF anterior ao carregar outro XML', status: 'concluida',
        implementado: [
            'Ao carregar um XML novo na Entrada de NF, o resultado da conferência ("Confere com a cotação/ERP") e o bloco de recurso da NF anterior são limpos. Antes eles continuavam na tela mostrando itens e recursos da NF que já tinha sido salva.'
        ],
        mudou: ['Só a limpeza da tela ao carregar outro XML; nada é gravado ou alterado no banco.'],
        testar: ['Salve uma NF, carregue outro XML (com ou sem cotação): os blocos "Recurso definido/pendente" e "Confere com a cotação/ERP" da NF anterior não devem aparecer.']
    },
    {
        numero: 20, nome: 'Recurso definido pelas cotações na Entrada de NF', status: 'concluida',
        implementado: [
            'Regra de negócio: item com 3 ou mais fornecedores cotando é pago com recurso público/externo (C/C); com menos (1 ou 2), é Recurso Próprio. O número de fornecedores vem do relatório de fornecedores ganhadores do próprio pedido.',
            'Ao salvar a NF, o recurso dos itens que ainda não tinham é definido automaticamente por essa regra (C/C ou Recurso Próprio da origem do pedido) e a tela mostra, item a item, o motivo (quantos fornecedores cotaram) com o botão "Trocar pra…". Só cai na escolha manual o item sem o dado (pedido sem relatório de ganhadores).'
        ],
        mudou: [
            'Removida a sugestão por histórico de outros pedidos: o mesmo produto pode ser comprado com C/C ou com Recurso Próprio, então o histórico não define recurso.',
            'Os mínimos de Configurações → Análise de cotações agora valem: vazios, usa 3 (C/C) e 1 (Recurso Próprio). O ✓ da Central do Pedido usa o mesmo mínimo.',
            'A gravação do recurso agora salva o mapa aninhado (recursosPorItem → código), garantindo que set + merge não crie um campo literal com ponto no nome.'
        ],
        testar: [
            'Pedido 1653 (com o relatório de ganhadores importado): Entrada de NF de um fornecedor do pedido → Salvar NF: os itens com 3+ fornecedores ficam C/C e os com 1 ou 2 ficam Recurso Próprio, com o motivo na tela.',
            'Trocar o recurso de um item pelo botão "Trocar pra…" e conferir que o item passa a aparecer como "definido manualmente".',
            'Pedido sem relatório de ganhadores: os itens aparecem como pendentes com a mensagem explicando por quê, e a escolha manual continua funcionando.',
            'Conferir a Central do Pedido: "Recurso" do item e o ✓ de fornecedores que cotaram.'
        ]
    },
    {
        numero: 19, nome: 'Correção: CNPJ com pontuação (XML antigo do SmartCompras)', status: 'concluida',
        implementado: [
            'O "Complementar com Relatório do SmartCompras" agora casa os itens por código + CNPJ comparando só os dígitos. Antes, o XML antigo (CNPJ como 44.672.062/0001-15) nunca casava com o relatório (só dígitos) e nenhum nome era complementado (0 de 112 no pedido 1653).',
            'A mesma regra foi aplicada a todos os pontos que comparam o CNPJ vindo do XML com o da NF-e, do cadastro SP Data, do ERP ou do relatório: identificar o pedido pela NF, itens do fornecedor na Entrada de NF, alerta de itens esperados, reconciliação do ERP com a NF, associações SP Data via ERP, valor cotado por fornecedor e nome de exibição do fornecedor. Também vale ao reimportar um pedido (diferenças entre versões e nome oficial preservado), mesmo que o formato do CNPJ mude de uma versão para outra.'
        ],
        mudou: [
            'Só a comparação: igualdade exata dos 14 dígitos (nunca aproximada, nunca por nome) e CNPJ vazio nunca casa. Nada foi reescrito no banco — pedidos já importados continuam como estão.',
            'Regra pra frente: qualquer comparação nova com CNPJ deve usar normalizarCnpj / mesmoCnpj / cnpjEmLista (comentário no código).'
        ],
        testar: [
            'Pedido 1653: Central do Pedido → colar o relatório de fornecedores ganhadores → Processar: deve mostrar "Nomes que serão complementados: 112" e nenhum item sem correspondência; confirmar e conferir que os itens ganham o nome oficial.',
            'Entrada de NF com um fornecedor desse pedido: o pedido deve ser identificado automaticamente e os itens do fornecedor aparecerem na associação com a cotação.',
            'Ao reimportar o XML de um pedido que já tinha nomes complementados, os nomes continuam lá.'
        ]
    },
    {
        numero: 18, nome: 'Paginação do Histórico', status: 'concluida',
        implementado: [
            'Histórico: a lista de dentro do mês (e o resultado da busca) agora aparece em lotes de 40, com o botão "Carregar mais (N restante(s))" no fim — o mesmo padrão já usado em Produtos SP Data e Fornecedores.',
            'O limite recomeça no primeiro lote a cada nova busca ou troca de ano/mês; expandir ou recolher um registro não reinicia a lista.'
        ],
        mudou: [
            'Só a exibição do Histórico: nenhum registro foi alterado ou apagado, a ordem continua por data (mais recentes primeiro) e a busca continua varrendo todos os meses.',
            'O botão "Limpar registros simples arquivados (legado)" ficou separado no fim da tela, em vermelho, longe do "Carregar mais".'
        ],
        testar: [
            'Histórico → ano → mês com mais de 40 registros: aparecem 40 e o botão informa quantos faltam; tocar em "Carregar mais" mostra os próximos até acabar.',
            'Expandir um registro depois de carregar mais: a lista não volta ao início. Trocar de mês ou buscar: volta a mostrar o primeiro lote.',
            'Busca por NF, fornecedor, CNPJ ou pedido continua achando registros de qualquer mês.'
        ]
    },
    {
        numero: '17.3', nome: 'Redesign — Etapa 4 (áreas de uso frequente)', status: 'concluida',
        implementado: [
            'Entrada de NF (XML): itens e alertas usam a mesma gramática de estados do cartão de NF (barra lateral, borda de 1px e tinta sutil) no lugar da borda tracejada amarela; selos de pendência mais leves; ações dentro de cada item (Associar, Confirmar fator) no formato de chip.',
            'Produtos SP Data e Fornecedores: o cartão que envolvia a lista saiu (os itens já são cartões); ações Renomear/Inativar/Reativar agrupadas no formato de chip; "Cadastrar produto" é o botão principal.',
            'Botão principal preenchido em Importar ERP (Processar Relatório e Importar Selecionadas) e Observações (Adicionar Observação).',
            'Editor de cotação no iPhone: Razão Social em linha própria e CNPJ ao lado da lixeira, sem cortar o texto.'
        ],
        mudou: [
            'Só apresentação. Nenhuma regra de negócio, cálculo, filtro, fluxo ou dado foi alterado.',
            'Central do Pedido, editores de Anotação e Aprovações herdam o sistema sem mudança própria: já estavam coerentes.'
        ],
        testar: [
            'Entrada de NF: carregar um XML e conferir itens pendentes, alerta "Resolva antes de salvar" e os botões Associar e Confirmar fator.',
            'Produtos SP Data e Fornecedores: lista, busca, Renomear e Inativar/Reativar.',
            'Importar ERP: Processar Relatório e Importar Selecionadas. Observações: Adicionar Observação.',
            'Nova Cotação no iPhone: adicionar fornecedores e conferir os campos.'
        ]
    },
    {
        numero: '17.2', nome: 'Redesign — Etapa 3 (telas de consulta) e limpeza de código', status: 'concluida',
        implementado: [
            'Limpeza de código: removidas 13 funções e 4 variáveis sem nenhum uso (importação de fornecedores por texto, cadastro de apelidos pelo formulário antigo, checklist antigo, entre outras) e o modo "Selecionar pra saída" da Fase 12, que estava sem botão de acesso desde a Fase 14.',
            'Limpeza de CSS: removidas as regras de classes que não existem mais e as declarações antigas que já eram sobrescritas por regras posteriores; 65 estilos inline repetidos viraram classes utilitárias (espaçamentos e textos auxiliares).',
            'Botão principal preenchido nas telas de formulário: Cotações, Anotações, Nova Auditoria (Gerar Auditoria), Cotação, Entrada de NF (Salvar NF), Backup, Configuração da análise e edição em lote.',
            'Relatórios: cartão "Próximos Vencimentos" neutro (sem a moldura de destaque) e painel de Filtros com indicador de aberto/fechado. Ações localizadas nos itens do Histórico, da Central do Pedido e do XML seguem a mesma linguagem dos chips. Estados vazios mais discretos. Histórico de Mudanças com destaque de 1px na versão atual.'
        ],
        mudou: [
            'Texto que usa a cor de destaque passou a usar uma versão legível em cada tema (mais clara nos temas escuros, mais escura nos temas claros de destaque claro); texto sobre fundo de destaque usa a cor de contraste do tema.',
            'Só apresentação e limpeza: nenhuma regra de negócio, cálculo, filtro, fluxo ou dado foi alterado. Notas que já tinham a marcação de "seleção pra saída" continuam no banco, sem uso.',
            'Restam pra depois (sem urgência): refinamento visual das telas menos usadas (Produtos SP Data, Central do Pedido, editores) e o CSS antigo de seletores agrupados que ainda é sobrescrito pela camada nova.'
        ],
        testar: [
            'Gerenciar NF: seleção em lote, Pendente/Retomar, Editar e Excluir; ícone de seleção no cabeçalho continua igual.',
            'Relatórios: indicadores, painel de Filtros, as quatro abas e o toque nos indicadores.',
            'Cotações, Anotações, Backup e Nova Auditoria: o botão principal aparece preenchido e faz o mesmo de antes.',
            'Histórico e Central do Pedido: ações em forma de chip funcionando (ex.: Desarquivar temporariamente).',
            'Temas Escuro, Ocean e Wine: textos e botões legíveis. Desktop: sidebar e troca de telas.'
        ]
    },
    {
        numero: '17.1', nome: 'Ajustes visuais da Fase 17 (após teste no iPhone)', status: 'concluida',
        implementado: [
            'Botões voltaram ao tamanho anterior (altura e fonte de antes, sem esticar na largura), mantendo a hierarquia: primário preenchido, secundário, discreto e destrutivo.',
            'Chips de Gerenciar NF (Editar, Pendente, Excluir) agora seguem a mesma linguagem dos botões das outras telas: pílula com borda de 1,5px, só que menores.'
        ],
        mudou: [
            'Selo "Ainda não passou pela Entrada Segura" e demais selos longos passam a quebrar linha em vez de sair do cartão; textos de selo, contador, tabela XML e rótulo da barra inferior voltaram ao tamanho de antes (o rótulo "Entrada de NF" deixa de quebrar em duas linhas).',
            'Botão "Limpar Banco de Exceções" ganhou espaço em relação ao cartão acima.'
        ],
        testar: [
            'Gerenciar NF: selo da Entrada Segura dentro do cartão, chips com o mesmo formato dos botões.',
            'Exportar e Entrada de NF: tamanho dos botões como antes e barra inferior com o rótulo "Entrada de NF" em uma linha.',
            'Conferir se algum outro texto ainda estoura em telas pequenas e me avisar qual.'
        ]
    },
    {
        numero: 17, nome: 'Redesign Visual e Sistema de Design — Etapa 2 (fundação)', status: 'concluida',
        implementado: [
            'Base do sistema visual: escala de tipografia (22/13/15/16/12/28), espaçamento (4-8-12-16-24-32), raios (8/12/20/pílula), cores semânticas (sucesso, perigo, atenção, info) e --accent-contrast, tudo compatível com os 7 temas, fontes, ícones, transições e densidade.',
            'Botões com hierarquia: primário preenchido (Salvar na Entrada, Copiar em Exportar, confirmar nos modais), secundário, discreto e destrutivo (Arquivar Tudo separado das demais ações). Campos de 44px/16px, rótulos sem caixa alta.',
            'Controle segmentado unificado (abas e filtros do Relatórios, etc.), chips, cartão de NF com uma só gramática de estados (barra lateral, etiqueta Pendente discreta, seleção com tinta), indicadores dos Relatórios em novo padrão visual e modais como folha inferior no iPhone / diálogo no desktop.',
            'Desktop (≥900px): a barra lateral que já existia foi ativada (item atual destacado, Ajustes no rodapé) e o conteúdo usa a largura disponível; no iPhone a barra inferior continua.'
        ],
        mudou: [
            'Só apresentação (style.css) e classes visuais no HTML/templates. Nenhuma regra de negócio, cálculo, filtro, fluxo ou função foi alterada.',
            'Ordem padrão do menu agora começa pelo fluxo diário (Adicionar, Gerenciar, Exportar); quem já personalizou a ordem em Ajustes não é afetado.',
            'Textos que estavam entre 9 e 11,5px agora têm no mínimo 12px (só o rótulo da barra inferior mantém 11px). Pesos de fonte reduzidos a 400/600/700 e raios a 8/12/20/pílula.',
            'Restam pra próximas etapas: redesenho de cada tela, redução dos estilos inline restantes e a limpeza final do CSS antigo que a nova camada substitui.'
        ],
        testar: [
            'iPhone: Adicionar (campos e botão Salvar preenchido), Gerenciar (cartões de NF, estados pendente/selecionado/vencimento), Exportar (Copiar preenchido; Arquivar Tudo separado em vermelho), Relatórios (indicadores e abas), barra inferior e um modal (abre como folha inferior).',
            'Desktop: barra lateral com todos os itens, troca de telas, item ativo destacado, Ajustes no rodapé, conteúdo centralizado e modal centralizado.',
            'Ajustes → Personalização: trocar tema (incluindo Ocean, Sunset, Forest e Wine — texto do botão preenchido deve ficar legível), fonte, densidade e ordem dos menus.',
            'Confirmar que Copiar, Compartilhar, Gerar PDF, Arquivar Tudo e Salvar continuam fazendo o mesmo de antes.'
        ]
    },
    {
        numero: 16, nome: 'Revisão Geral e Estabilização Final', status: 'concluida',
        implementado: [
            'Limpeza: removido o código das bolinhas de novidade (funções que desenhavam/controlavam a bolinha no menu, chamadas em Ajustes/navegação e o estilo da bolinha). Nada foi criado no lugar.',
            'Revisão integrada dos fluxos (NF → saída de texto → PDF → Relatórios, navegação entre telas, botões/IDs do HTML, textos de interface): verificação técnica sem encontrar outras falhas concretas — nenhuma outra funcionalidade foi alterada.'
        ],
        mudou: [
            'Só a remoção das bolinhas. Saída de Texto, PDF, Relatórios, Importar, Gerenciar NF, Histórico e demais módulos ficaram como estavam.',
            'O campo antigo de "novidades vistas" que ficou gravado nas configurações do Firebase não é mais usado (inofensivo; nada foi apagado).',
            'Possíveis melhorias futuras (NÃO implementadas): remover funções antigas sem nenhum uso (ex.: importação de lista de fornecedores por texto, apelidos por formulário antigo) e o modo dormante "Selecionar pra saída" da Fase 12, que ficou sem botão de acesso desde a Fase 14.'
        ],
        testar: [
            'Abrir o app e navegar pelas abas e por Ajustes: não deve aparecer nenhuma bolinha nem erro, e o menu deve continuar igual.',
            'Fluxo completo com uma NF: Importar/cadastrar → Gerenciar NF → Exportar (texto e PDF com as mesmas NFs) → Arquivar Tudo → conferir no Histórico.',
            'Relatórios: conferir indicadores, filtros e as abas Pedidos, Notas, Divergências e Auditorias.',
            'Ajustes → Histórico de Mudanças: a Fase 16 aparece como fase atual.'
        ]
    },
    {
        numero: 15, nome: 'Relatórios e Indicadores', status: 'concluida',
        implementado: [
            'Relatórios evoluído (mesma tela, sem tela nova nem coleção nova): indicadores em destaque — NFs (quantidade e valor total), Pedidos, Auditorias e Divergências (com pendentes) — calculados na hora a partir dos registros existentes, sem estimativas.',
            'Nova aba "Auditorias" ao lado de Pedidos, Notas e Divergências (uma auditoria = uma ocorrência registrada em Nova Auditoria).',
            'Na aba Divergências: rankings por tipo, por fornecedor e por produto (produtos com mais divergências); tocar numa linha filtra a lista pelos registros que compõem aquele número.',
            'Filtros (painel "Filtros"): período (De/Até), fornecedor, destino (Santa Casa/CTI), recurso e tipo de divergência; pedido e NF continuam na busca por texto (que agora também acha NF pelo pedido). Indicadores e listas usam os mesmos filtros; tocar num indicador abre a lista correspondente.'
        ],
        mudou: [
            'A aba Divergências agora também mostra divergências de auditorias sem pedido ("Sem pedido").',
            'Regras: período usa a data da NF (Notas), a data do pedido (Pedidos) e a data da auditoria (Auditorias/Divergências); registro sem data válida fica fora quando há período. Destino e pedido de uma NF só aparecem se a NF foi conferida na Entrada Segura (mesma regra da aptidão) — senão ficam fora do filtro de Destino. Recurso da NF é o texto do campo de recurso/observação. Filtros que não existem pra um tipo de registro (ex.: Tipo de divergência em Notas; Recurso em Divergências) avisam em vez de mostrar número errado.',
            'Nada mudou em Entrada Segura, Auditoria, Histórico, Gerenciar NF, Cotações, ERP, Saída de Texto, PDF ou Arquivamento.'
        ],
        testar: [
            'Relatórios sem nenhum filtro: os 4 indicadores aparecem e batem com as contagens das abas (tocar em NFs abre Notas com "Todas"; em Divergências abre a aba com "Todas").',
            'Filtros: período, fornecedor (digitando e escolhendo da lista), destino, recurso e tipo — conferir se indicadores e lista mudam juntos; "Limpar" nos filtros ativos volta tudo.',
            'Divergências: tocar numa linha dos rankings (tipo, fornecedor, produto) e conferir que a lista mostra exatamente as divergências que compõem o número.',
            'Aba Auditorias: conferir a lista e que tocar abre a Central do Pedido.',
            'Conferir com uma NF cadastrada manualmente (sem pedido/cotação): ela aparece nos totais e nos filtros de período/fornecedor/recurso, e fica fora do filtro de Destino.'
        ]
    },
    {
        numero: 14, nome: 'PDF na Saída de Texto + Importar simplificado + Logo (revisão das Fases 13-14)', status: 'concluida',
        implementado: [
            'Aba Exportar: novo botão "Gerar PDF" ao lado de Copiar, Compartilhar e Arquivar Tudo. O PDF usa exatamente a mesma lista (e a mesma ordem, inclusive depois de "Ordenar por Recurso") da saída de texto, no modelo em papel já usado (DATA, NF, VENCIMENTO, VALOR TOTAL, FORNECEDOR, RECEBIDO COMPRAS, RECEBIDO CONTÁBIL, OBSERVAÇÕES + assinaturas).',
            'Indicador de novidade (bolinha) reutilizável e persistente: cada novidade tem um id e a bolinha fica na aba até o usuário abrir a tela da novidade — depois nunca mais reaparece (fica registrado nas configurações, sem coleção nova). (Recurso de bolinhas removido na Fase 16.)'
        ],
        mudou: [
            'Repasse/Protocolo saiu da interface: telas de revisão, lista e detalhe, botões "Revisar e Confirmar Saída"/"Ver Repasses", selo "Repasse" no card e o botão de caminhão (seleção pra saída) em Gerenciar NF. Os repasses já gravados continuam no banco, nada foi apagado, e o protocolo não é necessário pra gerar PDF.',
            'Importar Relatório: removidos a Pré-seleção e o botão "Enviar pro Financeiro" (só criavam a mesma NF que "Importar Selecionadas" já cria). Fluxo antigo preservado: colar/subir relatório, buscar por NF ou fornecedor, ver novas × já processadas, marcar e levar pro Gerenciar NF. As NFs importadas agora ficam ligadas à entrada do ERP, e arquivar sincroniza com o ERP.',
            'Logo: a configuração continua em Configurações → Personalização, agora no topo da tela e com nome que indica o uso nos PDFs da aba Exportar.',
            'Saída de texto, Copiar, Compartilhar e Arquivar Tudo não mudaram.',
            'Ajustes visuais do PDF: título "PROTOCOLO DE REPASSE NF" em uma linha, em negrito e com fonte maior; cabeçalhos das colunas em negrito; assinaturas fixas no rodapé da última página (qualquer quantidade de NFs), cada nome centralizado sob a sua linha; fonte Helvetica (equivalente ao Arial nos PDFs) em todo o documento.',
            'Bolinha de novidade em Exportar reforçada: nova novidade registrada pra este ajuste e a bolinha também aparece quando os ícones das abas estão desligados. (Recurso de bolinhas removido na Fase 16.)'
        ],
        testar: [
            'Exportar: com notas na lista, tocar em Gerar PDF e conferir que as NFs e a ordem são as mesmas da caixa de texto; usar "Ordenar por Recurso" e gerar de novo; marcar uma NF como pendente e conferir que ela fica fora do texto e do PDF.',
            'Enviar uma logo em Configurações → Personalização (agora no topo) e conferir no PDF; sem logo, o PDF deve sair normalmente.',
            'Confirmar que Copiar, Compartilhar e Arquivar Tudo continuam iguais.',
            'Importar: colar o relatório, buscar por NF e por fornecedor, conferir novas × já processadas, marcar e importar — a lista "Pré-seleção" não deve mais existir.',
            'Depois de importar, arquivar a NF e conferir no Histórico que a NF de origem ERP aparece como arquivada.',
            'Cadastrar uma NF manualmente (sem cotação/ERP), informar o recurso à mão e gerar texto e PDF — nada deve bloquear.',
            'PDF: conferir título em negrito numa linha só, cabeçalhos em negrito e as três assinaturas no rodapé, com o nome centralizado sob cada linha — com poucas NFs e com muitas (várias páginas).',
            'Bolinhas: devem aparecer em Exportar e em Configurações; abrir Exportar, Importar Relatório e Personalização apaga a bolinha correspondente, e recarregar a página não traz de volta as já vistas. (Recurso de bolinhas removido na Fase 16.)'
        ]
    },
    {
        numero: 13, nome: 'Saída/Repasse e Protocolo', status: 'concluida',
        implementado: [
            'NFs marcadas no modo "Selecionar pra Saída" (Fase 12) agora podem ser reunidas num repasse formal: botão "Revisar e Confirmar Saída" mostra um resumo (destino, valor total, fornecedores, pedidos, recursos) antes de confirmar.',
            'Cada repasse recebe um protocolo único e localizável (formato SAI-AAAAMMDD-NNN).',
            'Nova tela "Ver Repasses" (dentro de Gerenciar NF) lista os repasses já confirmados e permite abrir cada um pra ver quais NFs fizeram parte.',
            'Possível remover uma NF da revisão antes de confirmar — nunca exclui ou altera a NF original.',
            'Repasse pode ser marcado como "Concluído/Arquivado" depois de confirmado.'
        ],
        mudou: [
            'Novos botões dentro do modo "Selecionar pra Saída": "Revisar e Confirmar Saída" e "Ver Repasses".',
            'Se as NFs selecionadas tiverem destinos diferentes (Santa Casa e CTI misturados), a confirmação é bloqueada até resolver.',
            'Uma NF que já fez parte de um repasse confirmado passa a mostrar um selo "Repasse [protocolo]" no card de Gerenciar NF.',
            'Revisão (Fase 14): as telas de Repasse/Protocolo foram retiradas da interface; os repasses já criados permanecem no banco.'
        ],
        testar: []

    },
    {
        numero: '12 (refino)', nome: 'Unificação Gerenciar NF × Seleção Saída + Histórico de Mudanças', status: 'concluida',
        implementado: [
            '"Seleção Saída" deixou de ser uma tela própria — agora é um modo dentro de Gerenciar NF (botão no cabeçalho), com filtro por situação e checkbox de seleção pra saída.',
            'Card de Gerenciar NF passou a mostrar sempre pedido, CNPJ, destino e recurso confirmado, além do selo de aptidão (Fase 11).',
            'Edição (fornecedor, NF, vencimento, valor) já é a mesma de sempre — nunca existiu uma segunda implementação.',
            'Indicador de novidade corrigido: agora dispara só uma vez por carregamento do app (antes podia reaparecer sempre que uma configuração fosse salva) e aponta pra aba Gerenciar NF. (Recurso de bolinhas removido na Fase 16.)',
            'Esta tela de Histórico de Mudanças, dentro de Configurações.'
        ],
        mudou: [
            'A aba "Seleção Saída" não existe mais separadamente — use o botão de caminhão no cabeçalho de Gerenciar NF.',
            'Busca de Gerenciar NF agora também encontra por número do pedido.'
        ], testar: []
    },
    {
        numero: 12, nome: 'Seleção de NFs para Saída/Repasse', status: 'concluida',
        implementado: [
            'Conceito de "aptidão para saída" (apta, com divergência, com auditoria pendente, não conferida, ambígua, sem pedido) calculado a partir de dados já existentes — Entrada Segura, Auditoria, ERP.',
            'Seleção de NFs candidatas a uma futura saída/repasse, sem duplicar ou recriar a NF.'
        ],
        mudou: ['(depois unificado com Gerenciar NF no refino acima).'],
        testar: []
    },
    {
        numero: 11, nome: 'Financeiro / Aptidão para Saída', status: 'concluida',
        implementado: [
            'Função que cruza a nota financeira com a NF processada (Entrada Segura) e a Auditoria pra determinar a situação de conferência — sem criar nenhum campo/coleção nova, só leitura.'
        ], mudou: [], testar: []
    },
    {
        numero: 10, nome: 'Auditoria Integrada', status: 'concluida',
        implementado: [
            'Auditoria passou a nascer como consequência da conferência da NF/Cotação/ERP — "Gerar auditoria" pré-preenche pedido, fornecedor, NF, produto, quantidade cotada/faturada.',
            'Divergência nasce com o TIPO ESTRUTURADO correto (NÃO FATURADO, QUANTIDADE DIFERENTE, VALOR DIFERENTE) sempre que a comparação já dá evidência — "Outro" deixou de ser usado como padrão.',
            'Seleção de material pela divergência passou a mostrar o nome do produto (associação SP Data), não a Observação bruta do SmartCompras.'
        ], mudou: [], testar: []
    },
    {
        numero: 9, nome: 'Entrada Segura da NF', status: 'concluida',
        implementado: [
            'Distinção entre BLOQUEIO (impede salvar — conflito de pedido, conversão de unidade suspeita) e ALERTA (avisa mas deixa salvar — sem associação SP Data, item ainda não faturado nesta NF).',
            'Sugestão de qual cotação/pedido provavelmente corresponde à NF, quando o CNPJ bate com mais de uma cotação, por evidência de valor compatível — nunca por data isolada.'
        ], mudou: [], testar: []
    },
    {
        numero: 8, nome: 'Reconciliação ERP', status: 'concluida',
        implementado: [
            'Vínculo NF↔pedido com 3 estados (confirmado/sugerido/sem associação), sempre com evidências explícitas — nunca por coincidência de data isolada.',
            'Preenchimento automático de associação SP Data a partir do ERP quando quantidade e valor batem exatamente com um único item.',
            '"Alimentar Histórico do ERP" separado de "Enviar pro Financeiro" — reimportar o mesmo relatório nunca duplica NF.'
        ], mudou: [], testar: []
    },
    {
        numero: '2–7', nome: 'Consolidação Pedido → Cotação → Fornecedor → NF → ERP', status: 'concluida',
        implementado: [
            'Central do Pedido como ponto único de consulta (fornecedor, CNPJ, itens, SP Data, NFs relacionadas).',
            'Suporte nativo a um pedido com várias NFs e a NF parcial (nunca "1 pedido = 1 NF").'
        ], mudou: [], testar: []
    },
    {
        numero: 1, nome: 'Correção da associação SP Data + remoção de tela redundante', status: 'concluida',
        implementado: [
            'Busca de associação SP Data corrigida pra considerar também o código, não só o nome.',
            'Tela geral "Ver cotações por item" removida — associação continua só no contexto do produto dentro da cotação/fornecedor.'
        ], mudou: [], testar: []
    }
];

function renderHistoricoMudancas() {
    const container = document.getElementById('historico-mudancas-lista');
    if (!container) return;
    const ehV2 = fase => String(fase.numero).startsWith('2.');
    const cardFase = fase => {
        const atual = fase.status === 'atual';
        const listaHTML = (titulo, itens) => itens && itens.length
            ? `<div class="nota-detalhes"><strong>${titulo}:</strong><br>${itens.map(i => '• ' + escRel(i)).join('<br>')}</div>` : '';
        return `<div class="card hmud-item${atual ? ' hmud-atual' : ''}">
            <div class="nota-info">${atual ? '<span class="xml-item-badge pronto">VERSÃO ATUAL</span> ' : ''}${ehV2(fase) ? 'Versão' : 'Fase'} ${escRel(fase.numero)} — ${escRel(fase.nome)}</div>
            ${listaHTML('O que foi implementado', fase.implementado)}
            ${listaHTML('O que mudou nesta versão', fase.mudou)}
            ${listaHTML('O que testar', fase.testar)}
        </div>`;
    };
    const v2 = HISTORICO_FASES.filter(ehV2);
    const v1 = HISTORICO_FASES.filter(f => !ehV2(f));
    // Versão 1.0 fica recolhida num card; a 2.x aparece aberta no topo. <details> nativo: sem JS e sem estado a guardar.
    container.innerHTML = v2.map(cardFase).join('') + (v1.length
        ? `<details class="card hmud-grupo-v1"><summary><strong>Versão 1.0</strong> — ${v1.length} fases (Fase ${escRel(v1[v1.length - 1].numero)} até a ${escRel(v1[0].numero)}) · toque para abrir</summary>${v1.map(cardFase).join('')}</details>` : '');
}

function abrirConfigAnaliseCotacoes() {
    document.getElementById('config-minimo-cc').value = appConfig.minimoCotacoesCC || '';
    document.getElementById('config-minimo-proprio').value = appConfig.minimoCotacoesRecursoProprio || '';
}
async function salvarMinimosCotacoes() {
    const cc = document.getElementById('config-minimo-cc').value;
    const proprio = document.getElementById('config-minimo-proprio').value;
    try {
        await settingsDocRef.set({
            minimoCotacoesCC: cc ? parseInt(cc, 10) : null,
            minimoCotacoesRecursoProprio: proprio ? parseInt(proprio, 10) : null
        }, { merge: true });
        toast('✓ Configuração salva.');
    } catch (e) {
        console.error('Erro ao salvar mínimos de cotações:', e);
        toast('✕ Erro ao salvar.');
    }
}

// Nome de exibição de um fornecedor: reaproveita o MESMO cadastro de apelidos
// já usado na importação do relatório de NFs do ERP (apelidosFornecedores /
// encontrarApelidoFornecedor) — não é um cadastro paralelo. Preferência por
// CNPJ fica registrada como limitação: o cadastro de apelidos hoje é indexado
// por nome (não por CNPJ), então o match continua sendo por nome/prefixo.
// Nome de exibição do fornecedor — fonte ÚNICA usada em todo o app (Central
// do Pedido, cotação, auditoria, Entrada de NF). Unifica o que antes eram
// dois caminhos separados: agora, quando há CNPJ disponível, consulta
// primeiro o cadastro oficial fornecedoresSpData (determinístico — CNPJ é
// dado concreto, não precisa de heurística de texto). Sem CNPJ ou CNPJ ainda
// não cadastrado, cai pro nome exato no mesmo cadastro e, por último, pro
// alias antigo por texto (encontrarApelidoFornecedor) — mantido só como
// último recurso, sem apagar nada do que já existia.
function nomeExibicaoFornecedor(razaoSocial, cnpj) {
    if (cnpj) {
        const doc = listaFornecedoresSpData.find(f => f.cnpjs.some(c => mesmoCnpj(c.cnpj, cnpj)));
        if (doc) return doc.nomeExibido || doc.nomeReal || razaoSocial || '';
    }
    if (!razaoSocial) return '';
    const porNome = listaFornecedoresSpData.find(f => (f.nomeReal || '').toUpperCase() === razaoSocial.toUpperCase());
    if (porNome) return porNome.nomeExibido || porNome.nomeReal;
    return encontrarApelidoFornecedor(razaoSocial) || razaoSocial;
}

// Anotação "resumo vivo" do pedido — criada automaticamente na primeira
// importação da cotação (título "PEDIDO - ORIGEM", cabeçalho com datas e
// fornecedores). A MESMA anotação (casada por número de pedido, sem filtrar
// por tipo) é reaproveitada depois pela Auditoria (salvarAuditoriaComoAnotacao
// já faz upsert por pedido, ver Fase 2) — evita criar uma anotação separada
// pra cada acontecimento do pedido.
function montarCabecalhoAnotacaoCotacao(pedido, origem, dataPedido, dataLimite, fornecedores) {
    const linhas = [];
    if (dataPedido) linhas.push(`DATA DO PEDIDO: ${formatarDataBRSimples(dataPedido)}`);
    if (dataLimite) linhas.push(`LIMITE: ${formatarDataBRSimples(dataLimite)}`);
    linhas.push('FORNECEDORES:');
    (fornecedores || []).forEach(f => linhas.push(nomeExibicaoFornecedor(f.razaoSocial, f.cnpj)));
    return '<p>' + linhas.map(l => l.replace(/</g, '&lt;')).join('<br>') + '</p>';
}

async function criarOuAtualizarAnotacaoDaCotacao(pedido, origem, dataPedido, dataLimite, fornecedores) {
    if (!pedido) return null;
    const titulo = origem ? `${pedido} - ${origem}` : pedido;
    const existente = listaAnotacoes.find(a => a.pedido === pedido);
    try {
        if (!existente) {
            const ref = await anotacoesTextoCollection.add({
                titulo,
                conteudo: montarCabecalhoAnotacaoCotacao(pedido, origem, dataPedido, dataLimite, fornecedores),
                tipo: 'cotacao',
                pedido,
                atualizadoEm: new Date().toISOString(),
                criadoEm: new Date().toISOString()
            });
            return ref.id;
        } else {
            // Só re-escreve o cabeçalho se ainda não houver nenhuma ocorrência de
            // auditoria registrada nessa anotação — depois que a Auditoria começa
            // a anexar conteúdo, mexer no bloco de cabeçalho fica arriscado demais
            // (o conteúdo já não é mais só o header, é um documento vivo com
            // histórico). O título (pedido - origem) sempre pode ser atualizado,
            // já que é só metadado, não mexe no corpo salvo.
            const dadosUpdate = { titulo };
            if (!existente.ocorrencias || existente.ocorrencias.length === 0) {
                dadosUpdate.conteudo = montarCabecalhoAnotacaoCotacao(pedido, origem, dataPedido, dataLimite, fornecedores);
            }
            await anotacoesTextoCollection.doc(existente.id).update(dadosUpdate);
            return existente.id;
        }
    } catch (e) {
        console.error('Erro ao criar/atualizar anotação da cotação:', e);
        return null;
    }
}

function excluirCotacao() {
    if (!cotacaoEmEdicaoPedido) return;
    const pedido = cotacaoEmEdicaoPedido;
    showConfirmModal({
        title: 'Excluir Cotação',
        message: `Deseja excluir a cotação do pedido ${pedido} permanentemente?`,
        confirmText: 'Excluir',
        confirmClass: 'danger',
        onConfirm: async () => {
            try {
                await cotacoesCollection.doc(pedido).delete();
                toast('🗑️ Cotação excluída.');
                switchToScreen('screen-cotacoes', 'Cotações');
            } catch (e) {
                console.error('Erro ao excluir cotação:', e);
                toast('✕ Erro ao excluir.');
            }
        }
    });
}

// ============================================================
// IMPORTAÇÃO DO XML DO SMARTCOMPRAS — Fase 4
// O XML é tratado como uma fotografia da cotação no momento da importação
// (nunca sobrescreve silenciosamente): pedido novo cria a cotação; pedido já
// cadastrado gera uma NOVA VERSÃO com o snapshot anterior preservado numa
// subcoleção, e mostra um diff antes de confirmar.
// ============================================================

let importacaoXmlPendente = null; // { parsed, cotacaoExistente, diff }

function textoTag(el, tag) {
    const node = el.querySelector(tag);
    return node && node.textContent ? node.textContent.trim() : '';
}

function parseXmlSmartCompras(xmlTexto) {
    const doc = new DOMParser().parseFromString(xmlTexto, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('XML inválido ou corrompido.');

    const cabecalho = doc.querySelector('Cabecalho');
    const pedido = cabecalho ? textoTag(cabecalho, 'PDC') : '';
    if (!pedido) throw new Error('Não foi possível identificar o número do pedido (PDC) no XML.');

    const fornecedores = Array.from(doc.querySelectorAll('Fornecedores > Fornecedor')).map(f => ({
        cnpj: textoTag(f, 'CNPJ'),
        razaoSocial: upAud(textoTag(f, 'Razao_Social')),
        faturamentoMinimo: textoTag(f, 'Faturamento_Minimo'),
        prazoEntrega: textoTag(f, 'Prazo_Entrega'),
        validadeProposta: textoTag(f, 'Validade_Proposta'),
        formaPagamento: textoTag(f, 'Id_Forma_Pagamento'),
        frete: textoTag(f, 'Frete'),
        dataConfirmacao: textoTag(f, 'Data_Confirmacao')
    })).filter(f => f.cnpj);

    const itens = Array.from(doc.querySelectorAll('Itens > Item')).map(item => {
        const resposta = item.querySelector('Resposta');
        const progEntrega = item.querySelector('Programacao_Entrega');
        return {
            codProduto: textoTag(item, 'Cod_Produto'),
            quantidade: textoTag(item, 'Quantidade'),
            dataProgramada: progEntrega ? textoTag(progEntrega, 'Data') : '',
            qtdProgramada: progEntrega ? textoTag(progEntrega, 'Quantidade') : '',
            cnpjFornecedor: resposta ? textoTag(resposta, 'CNPJ') : '',
            fabricante: resposta ? textoTag(resposta, 'Fabricante') : '',
            embalagem: resposta ? textoTag(resposta, 'Embalagem') : '',
            precoUnitario: resposta ? textoTag(resposta, 'Preco_Unitario') : '',
            precoTotal: resposta ? textoTag(resposta, 'Preco_Total') : '',
            descricao: upAud(resposta ? textoTag(resposta, 'Comentario') : '')
        };
    }).filter(it => it.codProduto);

    return {
        pedido,
        dataVencimento: cabecalho ? textoTag(cabecalho, 'Data_Vencimento') : '',
        horaVencimento: cabecalho ? textoTag(cabecalho, 'Hora_Vencimento') : '',
        fornecedores,
        itens
    };
}

// Data limite sugerida = a mais tardia entre as datas programadas de entrega
// dos itens (é quando TODO o pedido deveria estar entregue). Só uma sugestão
// — nunca substitui uma data limite que o usuário já tenha definido na mão.
function sugerirDataLimiteXml(itens) {
    const datas = itens.map(it => it.dataProgramada).filter(Boolean).map(d => {
        const [dia, mes, ano] = d.split('/');
        return ano && mes && dia ? `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}` : null;
    }).filter(Boolean);
    if (datas.length === 0) return '';
    return datas.sort().pop();
}

// dd/mm/aaaa (formato do XML SmartCompras) -> aaaa-mm-dd (formato do <input type=date>)
function converterDataBRparaISO(dataBR) {
    if (!dataBR) return '';
    const [dia, mes, ano] = dataBR.split('/');
    return (dia && mes && ano) ? `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}` : '';
}
function somarDiasISO(dataISO, dias) {
    if (!dataISO) return '';
    const d = new Date(dataISO + 'T00:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
}

function calcularDiffCotacao(antiga, nova) {
    const diffs = [];
    const fornAntigos = new Map((antiga.fornecedores || []).map(f => [normalizarCnpj(f.cnpj), f]));
    const fornNovos = new Map((nova.fornecedores || []).map(f => [normalizarCnpj(f.cnpj), f]));
    fornNovos.forEach((f, cnpj) => { if (!fornAntigos.has(cnpj)) diffs.push(`+ Fornecedor adicionado: ${f.razaoSocial}`); });
    fornAntigos.forEach((f, cnpj) => { if (!fornNovos.has(cnpj)) diffs.push(`− Fornecedor removido: ${f.razaoSocial}`); });

    const itensAntigos = new Map((antiga.itens || []).map(it => [it.codProduto, it]));
    const itensNovos = new Map((nova.itens || []).map(it => [it.codProduto, it]));
    itensNovos.forEach((novo, cod) => {
        const velho = itensAntigos.get(cod);
        if (!velho) { diffs.push(`+ Item novo: ${novo.descricao || cod}`); return; }
        if (velho.quantidade !== novo.quantidade) diffs.push(`↕ ${novo.descricao || cod}: quantidade alterada de ${velho.quantidade} para ${novo.quantidade}`);
        if (normalizarCnpj(velho.cnpjFornecedor) !== normalizarCnpj(novo.cnpjFornecedor)) {
            const nomeAntigo = (antiga.fornecedores || []).find(f => mesmoCnpj(f.cnpj, velho.cnpjFornecedor))?.razaoSocial || velho.cnpjFornecedor || '?';
            const nomeNovo = (nova.fornecedores || []).find(f => mesmoCnpj(f.cnpj, novo.cnpjFornecedor))?.razaoSocial || novo.cnpjFornecedor || '?';
            diffs.push(`↕ ${novo.descricao || cod}: fornecedor alterado de ${nomeAntigo} para ${nomeNovo}`);
        }
        if (velho.precoUnitario !== novo.precoUnitario) diffs.push(`↕ ${novo.descricao || cod}: preço alterado de ${velho.precoUnitario} para ${novo.precoUnitario}`);
        if (velho.descricao !== novo.descricao) diffs.push(`↕ Produto alterado: "${velho.descricao}" → "${novo.descricao}"`);
        if (velho.dataProgramada !== novo.dataProgramada) diffs.push(`↕ ${novo.descricao || cod}: data de entrega alterada de ${velho.dataProgramada} para ${novo.dataProgramada}`);
    });
    itensAntigos.forEach((velho, cod) => { if (!itensNovos.has(cod)) diffs.push(`− Item removido: ${velho.descricao || cod}`); });

    return diffs;
}

function handleArquivoXmlSmartCompras(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = parseXmlSmartCompras(e.target.result);
            const existente = listaCotacoes.find(c => c.pedido === parsed.pedido) || null;
            const diff = existente ? calcularDiffCotacao(existente, parsed) : [];
            importacaoXmlPendente = { parsed, existente, diff };
            renderPreviewImportacaoXml();
        } catch (err) {
            console.error('Erro ao importar XML SmartCompras:', err);
            toast('✕ ' + (err.message || 'Erro ao ler o XML.'));
        }
    };
    reader.readAsText(file, 'UTF-8');
    document.getElementById('cotacao-xml-file-input').value = '';
}

function renderPreviewImportacaoXml() {
    const { parsed, existente, diff } = importacaoXmlPendente;
    // O card de prévia mora em screen-cotacoes — se o import foi disparado a
    // partir do editor de uma cotação específica ("Atualizar via XML"),
    // muda pra lá antes de mostrar, senão o usuário não veria a prévia.
    switchToScreen('screen-cotacoes', 'Cotações');
    const card = document.getElementById('card-preview-importacao-xml');
    const resumoEl = document.getElementById('resumo-importacao-xml');
    const diffEl = document.getElementById('diff-importacao-xml');

    const proximaVersao = existente ? (existente.versaoAtual || 1) + 1 : 1;
    resumoEl.innerHTML = `
        <div class="xml-resumo-linha"><strong>Pedido:</strong> ${parsed.pedido}</div>
        <div class="xml-resumo-linha"><strong>Vencimento da cotação:</strong> ${parsed.dataVencimento || '—'} ${parsed.horaVencimento || ''}</div>
        <div class="xml-resumo-linha"><strong>Fornecedores:</strong> ${parsed.fornecedores.length}</div>
        <div class="xml-resumo-linha"><strong>Itens:</strong> ${parsed.itens.length}</div>
        <div class="xml-resumo-linha"><strong>${existente ? `Versão ${proximaVersao} (atual: v${existente.versaoAtual || 1})` : 'Nova cotação (versão 1)'}</strong></div>
    `;

    if (existente && diff.length > 0) {
        diffEl.innerHTML = `<div class="xml-diff-titulo">O que mudou desde a última importação:</div><ul class="xml-diff-lista">${diff.map(l => `<li>${l.replace(/</g, '&lt;')}</li>`).join('')}</ul>`;
    } else if (existente) {
        diffEl.innerHTML = `<div class="xml-diff-titulo">Nenhuma mudança detectada em relação à versão atual.</div>`;
    } else {
        diffEl.innerHTML = '';
    }

    card.style.display = 'block';
}

// ===================================================================

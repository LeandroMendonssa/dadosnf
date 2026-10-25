// 31-ajuda.js — Ajuda do app (2.10.0): artigos "como fazer" + tutorial guiado com dados ilustrativos
// Parte do script do app. Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// ===================================================================
// REGRA DE MANUTENÇÃO (combinada com o dono do app): TODA entrega que muda um procedimento do app precisa atualizar o artigo
// correspondente aqui (texto + campo "versao" = versão em que o artigo foi revisado pela última vez) e registrar isso no
// histórico de mudanças (js/14). Artigo novo = função nova. O tutorial guiado (TUTORIAIS) também acompanha o fluxo real.
// ===================================================================
// Campos do artigo: id, cat (categoria), titulo, resumo, palavras (busca), versao, tela [{id,titulo,rotulo}] (botão "Abrir"),
// passos [texto], dicas [texto], tutorial (id de TUTORIAIS, opcional)
const AJUDA_CATEGORIAS = ['Primeiros passos', 'Notas fiscais', 'Cotações e recurso', 'Fornecedores e produtos', 'Auditoria', 'Equipamentos', 'Ajustes e dados'];
const AJUDA_ARTIGOS = [
    { id: 'visao-geral', cat: 'Primeiros passos', titulo: 'Conhecendo as abas do app', versao: '2.10.0',
      resumo: 'Para que serve cada aba da barra inferior.',
      palavras: 'abas menu dock barra navegar inicio',
      passos: [
        'Adicionar: cadastro rápido de uma nota (data, NF, vencimento, valor, fornecedor e recurso).',
        'Gerenciar: a relação de notas pendentes, com seleção em lote, espera, edição e arquivamento.',
        'Exportar: monta a Saída de Texto (copiar, compartilhar, gerar PDF) e arquiva as notas enviadas.',
        'Relatórios e Cotações: acompanhamento dos pedidos, fornecedores e divergências.',
        'Entrada de NF: leitura do XML, fator de conversão, cotação, SP Data e recurso por item.',
        'Anotações: auditorias e ocorrências. Ajustes: fornecedores, produtos, personalização, backup, conta e esta Ajuda.',
        'As abas que não cabem na barra ficam em "Mais". Você escolhe a ordem em Ajustes → Personalização → Menus.'
      ],
      dicas: ['No computador a barra não encolhe; no iPhone ela fica só com ícones e abre ao tocar.'], tutorial: null },
    { id: 'adicionar-nf', cat: 'Notas fiscais', titulo: 'Adicionar uma nota manualmente', versao: '2.10.0',
      resumo: 'Cadastrar uma NF pela aba Adicionar.',
      palavras: 'adicionar nota nf cadastrar manual vencimento valor fornecedor recurso salvar',
      tela: [{ id: 'screen-add', titulo: 'Adicionar', rotulo: 'Abrir Adicionar' }],
      passos: [
        'Abra a aba Adicionar.',
        'Preencha Data, NF, Vencimento e Valor Total.',
        'Informe o Nome do Fornecedor (se ele tem apelido cadastrado, o app usa o apelido).',
        'Em Observações, escolha o Recurso a ser pago.',
        'Toque em Salvar. A nota entra na relação de Gerenciar.'
      ],
      dicas: ['Notas que vêm do ERP ou do XML não precisam ser digitadas: use a Importação do ERP ou a Entrada de NF.'], tutorial: null },
    { id: 'entrada-xml', cat: 'Notas fiscais', titulo: 'Entrada de NF pelo XML (do XML à nota conferida)', versao: '2.11.4',
      resumo: 'Ler o XML, conferir os itens, definir o recurso e salvar.',
      palavras: 'xml entrada nf itens fator conversao cotacao sp data lote validade salvar associar pedido',
      tela: [{ id: 'screen-xml-editor', titulo: 'Entrada de NF', rotulo: 'Abrir Entrada de NF' }],
      passos: [
        'Abra Entrada de NF e carregue o arquivo XML da nota.',
        'Em "Pedido/Cotação correspondente", confirme o pedido. Se a NF não tem cotação do SmartCompras (compra direta), informe o Destino dos itens (Santa Casa ou CTI).',
        'Item por item, confira o fator de conversão (vem da descrição, como "C/10" = 10; a sua correção fica lembrada para a próxima NF), a associação com a cotação e o SP Data.',
        'Se o quadro "Verificações da entrada" aparecer, leia antes de seguir: ele avisa itens ligados ao mesmo produto, valor unitário ou quantidade diferentes da cotação, quantidade diferente da lançada no ERP, valor total diferente do ERP (com a diferença, a explicação pelo frete, seguro ou desconto do próprio XML quando houver, e o botão "Abrir lançamento do ERP"), fornecedor fora do pedido e datas estranhas. Entrega parcial aparece só como informação. Só avisa; nada é bloqueado.',
        'Itens com pendência já abrem sozinhos; o selo mostra o que falta.',
        'Defina o recurso: um botão por item, ou "Recurso da NF inteira" no quadro acima dos itens (veja o artigo de Recurso).',
        'Lote e validade escritos no texto do produto entram no XML sozinhos; só os casos impossíveis ficam com aviso.',
        'Salve a NF. Ao salvar, o recurso dos itens é gravado na cotação.'
      ],
      dicas: ['Se um item mostra pendência, toque nela: o app leva ao ponto de resolver.'], tutorial: 'xml-ao-texto' },
    { id: 'gerenciar', cat: 'Notas fiscais', titulo: 'Gerenciar notas: espera, edição em lote e arquivamento', versao: '2.10.0',
      resumo: 'Trabalhar com a relação de notas pendentes.',
      palavras: 'gerenciar notas pendentes espera lote editar arquivar excluir selecionar conferida divergencia',
      tela: [{ id: 'screen-manage', titulo: 'Gerenciar', rotulo: 'Abrir Gerenciar' }],
      passos: [
        'Cada nota mostra um selo de situação: Conferida, Compra direta, Sem pedido vinculado, Auditoria pendente, Divergência resolvida ou Divergência. Toque no selo para ir direto ao pedido onde isso se resolve.',
        'Para agir em várias notas, ative a seleção e marque as notas. A barra inferior permite marcar como pendente (em espera), remover a pendência, editar em lote, arquivar e excluir.',
        'Notas em espera não entram na Saída de Texto.',
        'Se aparecer o aviso de notas sem recurso mas com recurso já conhecido pela Entrada de NF, toque em "Aplicar em todas" (ou aplique nota a nota).'
      ],
      dicas: ['O app só aplica o recurso quando a NF tem um único recurso; com mais de um, você escolhe em Editar.'], tutorial: null },
    { id: 'saida-texto', cat: 'Notas fiscais', titulo: 'Saída de Texto: copiar, compartilhar e arquivar', versao: '2.10.0',
      resumo: 'Gerar o texto das notas e arquivar depois de enviar.',
      palavras: 'exportar saida texto copiar compartilhar pdf arquivar ordenar recurso contabilizacao',
      tela: [{ id: 'screen-export', titulo: 'Exportar', rotulo: 'Abrir Exportar' }],
      passos: [
        'Abra Exportar. O texto mostra as notas "Para saída" (as em espera ficam de fora).',
        'Use "Ordenar por Recurso" para agrupar as notas pelo recurso a ser pago.',
        'Copie, Compartilhe ou gere o PDF.',
        'Depois de enviado, use "Arquivar Tudo": as notas vão para o Histórico.'
      ],
      dicas: ['O recurso de cada nota no texto é o campo Recurso dela. Se uma nota sai sem recurso, aplique o recurso em Gerenciar ou edite a nota.',
              'Próximos Vencimentos lista as notas que vencem nos próximos 7 dias.'], tutorial: 'xml-ao-texto' },
    { id: 'controle-nfs', cat: 'Notas fiscais', titulo: 'Controle de NFs e suas pendências', versao: '2.10.6',
      resumo: 'Ver todas as NFs e resolver o que falta tocando na pendência.',
      palavras: 'controle nfs pendencia erp xml vinculo cartao divergencia editor',
      tela: [{ id: 'screen-controle-nfs', titulo: 'Controle de NFs', rotulo: 'Abrir Controle de NFs' }],
      passos: [
        'Cada NF é um cartão com iniciais do fornecedor, situação, valor, vencimento e uma faixa de pendências.',
        'Toque numa pendência (texto vermelho ou o selo "N pendências"): o app abre o lugar certo e destaca o ponto em amarelo.',
        'Pelos ícones do cartão você abre o Editor da NF ou vê a nota no Gerenciar.',
        'O botão Selecionar (igual ao de Anotações) permite marcar várias NFs em aberto e marcá-las como enviadas ao financeiro.',
        'Para voltar ao ponto exato de onde veio, use o Voltar (botão ou gesto).'
      ],
      dicas: ['Itens com seta (›) ou sublinhado pontilhado são tocáveis.'], tutorial: null },
    { id: 'auditoria-retroativa', cat: 'Notas fiscais', titulo: 'Auditoria Retroativa: o que o app entendeu das NFs do ERP', versao: '2.11.5',
      resumo: 'Ver o que foi ligado sozinho nas NFs do ERP e resolver só o que depende de você.',
      palavras: 'auditoria retroativa erp nf itens produto pedido sugerido sugestao defasado associacao reprocessar conferencia',
      tela: [{ id: 'screen-auditoria-retro', titulo: 'Auditoria Retroativa', rotulo: 'Abrir Auditoria Retroativa' }],
      passos: [
        'Abra Mais → Auditoria Retroativa. O topo resume as NFs do ERP: quantas têm pedido confirmado, sugerido ou nenhum, e quantos itens já estão ligados a um produto da cotação.',
        'Você não precisa associar NF por NF: os itens se ligam ao produto pelo código SP Data, e o pedido é encontrado pelo CNPJ, pelos itens e pelo valor.',
        'Itens defasados são itens antigos que hoje já teriam produto (porque você associou o SP Data depois). O app os atualiza sozinho; o botão \"Atualizar itens defasados\" faz isso na hora.',
        'Pedido sugerido: o app achou um pedido provável, mas pede sua confirmação. Toque em "Conferir a sugestão" no cartão: ele mostra o valor total da NF × cotado, as datas do pedido, do limite e da NF e quais itens da NF estão na cotação, com um resumo (bate em tudo, conferir ou não parece). "Abrir o pedido" leva à cotação e "Confirmar" aceita aquele pedido.',
        'O botão "Confirmar as N que batem em tudo" confirma de uma vez só as sugestões com valor até 5% de diferença, data coerente e pelo menos 60% dos itens na cotação; as demais você confere uma a uma.',
        'Depois de confirmar, o cartão fica no mesmo lugar marcado com \"✓ Confirmado: pedido N\" e o botão some, para você não ficar na dúvida se já confirmou.',
        'Quando o pedido é confirmado e os itens da NF batem com a cotação (mesma quantidade e valor unitário, casamento único e pelo menos 90% do valor), o app aprende sozinho o código do fornecedor → produto da cotação e o produto → SP Data. Só preenche o que falta e nunca troca uma associação sua. O botão "Aprender N associações dos pedidos confirmados" faz isso para os pedidos já confirmados.',
        'Sem pedido: o cartão mostra o motivo (por exemplo, o fornecedor ainda não tem cotação). Isso nem sempre é um problema.',
        'Use os filtros (Pedido sugerido, Sem pedido, Itens sem produto, Itens defasados) e toque em \"Ver itens\" para ver cada item e se ele tem produto. \"Abrir NF\" leva ao Editor da NF.'
      ],
      dicas: ['O app nunca apaga uma ligação sozinho: só preenche ou corrige para um produto que existe.', 'Na entrada (XML e relatório do ERP) o app já mostra "Verificações da entrada" com os avisos que valem conferir na hora.'], tutorial: null },
    { id: 'assistente', cat: 'Ajustes e dados', titulo: 'Assistente: perguntar sobre NFs, pedidos, materiais e fornecedores', versao: '2.14.0',
      resumo: 'Uma IA que responde perguntas sobre os dados do app, só lendo, sem alterar nada.',
      palavras: 'assistente ia inteligencia artificial pergunta consulta chat divergencia material quantidade fornecedor pedido nf',
      tela: [{ id: 'screen-assistente', titulo: 'Assistente', rotulo: 'Abrir o Assistente' }],
      passos: [
        'Funciona de graça e sem instalar nada, no "modo básico": ele entende pedido, NF, fornecedor, material, divergências e pendências por palavras-chave (ex.: "situação do pedido 1726", "NF 1067970", "NFs da MINAS SUL", "lanceta").',
        'A IA (Cloudflare, grátis) já vem ligada e com o endereço fixo, sem nada para digitar. Embaixo do campo de digitar há um seletor: "IA" (perguntas em linguagem livre) ou "Modo básico" (sem IA, resposta na hora); a escolha fica lembrada neste aparelho. Se o limite grátis do dia acabar, o modo básico responde no lugar.',
        'Abra Mais → Assistente e escreva a pergunta, por exemplo: "quais divergências estão pendentes?", "situação do pedido 1726", "quanto temos de lanceta cotado e recebido?", "NFs da MINAS SUL sem pedido".',
        'As respostas vêm com negrito e listas. "pedido 1731" e "NF 36435" aparecem como links: toque para abrir a Central do pedido ou a NF. Enquanto a IA responde, o botão vira "■ Parar" e mostra os segundos; no fim aparece o tempo da resposta e o botão Copiar. "+ Nova conversa" limpa a conversa.',
        'A IA também sabe média, mínimo e máximo dos preços das compras e a marca dos produtos (ela sai da descrição da cotação do SmartCompras): pergunte, por exemplo, "média de preço das últimas compras de atadura crepom 15cm" ou "cotações de norepinefrina da marca Fresenius".',
        'Sob cada resposta aparece "Consultas feitas": são as consultas que o Assistente fez nos dados do app. Ele não inventa números: quando não acha, diz que não achou.',
        'O Assistente só lê. Para resolver algo (confirmar pedido, marcar chegada), use as telas do app.'
      ],
      dicas: ['Seja específico: um fornecedor, um pedido ou um material por vez dá respostas melhores e mais baratas.', 'A IA usa o limite grátis diário da Cloudflare (10.000 neurons); passando dele, ela recusa até o dia seguinte e o modo básico continua respondendo.'], tutorial: null },
    { id: 'atencao', cat: 'Ajustes e dados', titulo: 'Central de notificações: o que está parado', versao: '2.12.3',
      resumo: 'Um painel com o que está parado ou envelhecendo, do mais urgente ao menos.',
      palavras: 'central notificacoes notificação atencao pendencia urgente vencida vencido parado alerta painel o que precisa notas pedidos divergencias recurso',
      tela: [{ id: 'screen-atencao', titulo: 'Central de notificações', rotulo: 'Abrir a central' }],
      passos: [
        'Abra Mais → Central de notificações (o número ao lado mostra quantos itens precisam de atenção). No Controle de NFs, a faixa vermelha no topo mostra o total e leva ao mesmo painel.',
        'Os grupos vêm por urgência. Urgente: notas na relação com vencimento vencido e pedidos com prazo vencido sem nenhum sinal de entrega.',
        'Importante: divergências pendentes, NFs do ERP com pedido sugerido ou itens defasados, NFs do ERP esperando decisão há mais de 7 dias e NFs com XML sem pedido.',
        'Quando der: NFs com itens sem recurso ou sem produto da cotação e fornecedores sem CNPJ no SP Data.',
        'As pendências de cada NF vêm da mesma "visão única da NF" usada pelo Controle, pelo Editor e pela Auditoria Retroativa; as divergências vêm da mesma lista de Relatórios → Divergências. Por isso os números são sempre os mesmos nas telas.',
        'Os botões no topo trocam a forma de ver: Por urgência (padrão), Por pedido ou Por fornecedor, que reúne num só cartão tudo o que está pendente do mesmo pedido ou do mesmo fornecedor.',
        'Toque num grupo para abrir a lista e num item para ir direto à tela que resolve (pedido, Editor da NF, Relatórios, Auditoria Retroativa...).'
      ],
      dicas: ['O painel só lê o que já está salvo: nada é alterado ao abri-lo.'], tutorial: null },
    { id: 'recurso', cat: 'Cotações e recurso', titulo: 'Definir o recurso da NF (item a item ou a NF inteira)', versao: '2.10.0',
      resumo: 'C/C ou Recurso Próprio: onde definir e como chega à Saída de Texto.',
      palavras: 'recurso cc c/c proprio santa casa cti nf inteira item cotacao fornecedores ganhadores saida texto',
      tela: [{ id: 'screen-xml-editor', titulo: 'Entrada de NF', rotulo: 'Abrir Entrada de NF' }],
      passos: [
        'Regra: recurso C/C exige o mínimo de fornecedores que cotaram o item (padrão 3, ajustável em Ajustes → Análise de Cotações); abaixo disso, vale Recurso Próprio.',
        'O número de fornecedores vem do Relatório de Fornecedores Ganhadores do próprio pedido (importado em Cotações). Sem ele, o app não chuta: a escolha é manual.',
        'Na Entrada de NF, cada item mostra o recurso e o motivo; use "Trocar pra…" ou "Corrigir recurso" no item.',
        'Para a NF inteira, use o quadro "Recurso da NF inteira" acima dos itens: um toque aplica C/C ou Recurso Próprio a todos os itens que têm base.',
        'Ao importar o relatório do ERP, o campo Recurso da nota vem preenchido com o recurso da NF (quando ele é único).'
      ],
      dicas: ['Itens sem Origem na cotação ou sem destino não são alterados pelo botão da NF inteira.'], tutorial: 'xml-ao-texto' },
    { id: 'cotacoes', cat: 'Cotações e recurso', titulo: 'Cotações: importar e acompanhar pedidos', versao: '2.10.6',
      resumo: 'Importar o XML do SmartCompras e o relatório de ganhadores.',
      palavras: 'cotacoes smartcompras importar xml ganhadores pedido fornecedores divergencia previa',
      tela: [{ id: 'screen-cotacoes', titulo: 'Cotações', rotulo: 'Abrir Cotações' }],
      passos: [
        'Em Cotações, toque em "Adicionar cotação (XML)", escolha o XML do SmartCompras, confira a Prévia da Importação e confirme. A cotação só nasce do XML.',
        'Para complementar com o Relatório de Fornecedores Ganhadores, toque em "Complementar com relatório": o campo abre, você cola o texto ou envia o arquivo, toca em Processar e confirma. Ele informa quantos fornecedores participaram de cada item e fecha sozinho ao terminar.',
        'A lista mostra um cartão por pedido (status, fornecedores, limite e itens). Toque num cartão para abrir o pedido.',
        'No pedido, cada fornecedor tem seu cartão: abra para ver itens, valor cotado e divergências; os botões do cartão abrem a NF ou associam uma NF.'
      ],
      dicas: ['Tocar no selo de divergências do cartão leva direto ao item divergente.'], tutorial: null },
    { id: 'fornecedores', cat: 'Fornecedores e produtos', titulo: 'Fornecedores: apelido e CNPJs vinculados', versao: '2.10.0',
      resumo: 'Apelido único para filiais e vínculo automático por CNPJ.',
      palavras: 'fornecedor apelido nome exibicao cnpj vincular desvincular filial grupo',
      tela: [{ id: 'screen-fornecedores', titulo: 'Fornecedores', rotulo: 'Abrir Fornecedores' }],
      passos: [
        'Em Ajustes → Fornecedores, abra o cartão do fornecedor.',
        'Defina o apelido (nome de exibição). Ele vale para todos os CNPJs vinculados ao mesmo fornecedor.',
        'Para juntar filiais, use "Vincular": digite parte do nome e escolha (o app sugere nomes parecidos).',
        'CNPJs com os mesmos 8 primeiros dígitos (mesma empresa) são vinculados automaticamente ao subir um XML ou importar o relatório.',
        'Para separar um CNPJ do grupo, use "Desvincular este CNPJ".'
      ],
      dicas: [], tutorial: null },
    { id: 'backup', cat: 'Ajustes e dados', titulo: 'Backup dos dados e exportação para diagnóstico', versao: '2.10.4',
      resumo: 'Duas cópias dos dados: o backup simples e a exportação completa para análise.',
      palavras: 'backup copia seguranca exportar dados json diagnostico completo cotacoes divergencias',
      tela: [{ id: 'screen-backup', titulo: 'Backup dos Dados', rotulo: 'Abrir Backup' }],
      passos: [
        'Abra Ajustes → Backup dos Dados. A tela tem dois botões.',
        'Baixar Backup (JSON), o de cima: baixa um arquivo com as notas pendentes, o histórico, as anotações, os fornecedores, as configurações e os equipamentos. É uma cópia de segurança que fica no seu aparelho, independente do Firebase.',
        'Exportar dados para diagnóstico (JSON), o de baixo: exporta TODOS os dados do app (NFs processadas, entradas do ERP, cotações, associações, fornecedores, exceções de conversão e o resto) num único arquivo. Só lê os dados; não altera nada.',
        'Aguarde a mensagem de status abaixo dos botões: ela mostra o andamento e avisa se algo deu errado.'
      ],
      dicas: ['A exportação para diagnóstico nasceu de uma investigação das divergências apontadas pela auditoria: serve para analisar casos reais fora do app. No dia a dia você não precisa dela.',
              'O app só gera os arquivos; não há botão para restaurar a partir deles.'], tutorial: null },
    { id: 'aparencia-web', cat: 'Ajustes e dados', titulo: 'Personalização e modo web', versao: '2.10.3',
      resumo: 'Tema, menus, animações e o comportamento no computador.',
      palavras: 'personalizacao tema animacao dock menu web computador mac',
      tela: [{ id: 'screen-personalizacao', titulo: 'Personalização', rotulo: 'Abrir Personalização' }],
      passos: [
        'Em Ajustes → Personalização você escolhe aparência, animações, dock, menus e logo.',
        'No computador (mouse e tela larga) o app entra em modo web: sem dock que encolhe nem telas deslizando; só dissolve curto, estilo macOS. Todas as abas ficam juntas no menu, na ordem escolhida (não existe "Na barra / Em Mais" no computador).',
        'Para ver o modo web no celular, abra o app com ?plataforma=web no endereço (?plataforma=aparelho volta ao normal).'
      ],
      dicas: [], tutorial: null },
    { id: 'importar-erp', cat: 'Notas fiscais', titulo: 'Importar o relatório do ERP (Relação de Notas Fiscais)', versao: '2.11.1',
      resumo: 'Trazer várias notas de uma vez, já com recurso e apelido do fornecedor.',
      palavras: 'importar relatorio erp relacao notas fiscais txt colar processar recurso duplicata marcadas',
      tela: [{ id: 'screen-import', titulo: 'Importar Relatório (ERP)', rotulo: 'Abrir a importação' }],
      passos: [
        'Abra Mais → Importar Relatório (ERP).',
        'Cole o texto do relatório ("Colar") ou envie o arquivo ("Subir Arquivo TXT") e toque em "Processar Relatório".',
        'Revise cada nota: fornecedor, NF, data, vencimento, valor e recurso. Notas com aviso merecem atenção; o app marca as que já existem pendentes (bloqueadas) ou já foram arquivadas.',
        'Além dos avisos do relatório, o app acrescenta verificações na hora: valor ou itens zerados, NF já processada pelo XML com valor diferente, fornecedor sem CNPJ no SP Data e item com código SP Data fora da lista. Eles só avisam; não bloqueiam.',
        'Se você corrigir o nome de um fornecedor, o app aprende o apelido e aplica nas outras linhas.',
        'O campo Recurso já vem preenchido quando a NF passou pela Entrada de NF e tem um único recurso ("Sugerido pela Entrada de NF desta nota"). Para várias notas de uma vez, marque-as, escolha o recurso e use "Aplicar Recurso às Marcadas".',
        'Use Marcar Todas / Desmarcar Todas, a busca e "Mostrar Apenas Novas" para filtrar, e confirme a importação.'
      ],
      dicas: ['Duas notas com o mesmo fornecedor e NF ativas ao mesmo tempo são sempre tratadas como erro: o app trava a importação da repetida.'], tutorial: 'importar-erp' },
    { id: 'editor-nf', cat: 'Notas fiscais', titulo: 'Editor da NF: abas e situação', versao: '2.12.0',
      resumo: 'Ver e corrigir tudo sobre uma NF em um só lugar.',
      palavras: 'editor nf abas itens financeiro fiscal emitente destinatario transporte xml erp chips',
      passos: [
        'Abra o editor tocando numa NF no Controle de NFs (ou pelos botões dos cartões).',
        'No topo, os selos mostram a situação: XML processado, vínculo com o ERP e se o XML completo está guardado.',
        'As abas organizam os dados: Itens, Financeiro (pagamento e ERP), Fiscal, Emitente/Dest., Transporte e XML.',
        'NFs que só existem no relatório do ERP mostram um aviso de "sem XML" e o cartão "Dados desta NF": ali você edita o nome do fornecedor (o app lembra para as próximas importações), escolhe o recurso e marca "não tem pedido" (compra direta).',
        'Quando a NF do ERP já está ligada a um pedido cujo recurso o app conhece pela cotação, o cartão mostra "Vem da cotação do pedido" em vez de perguntar; "Mudar só nesta NF" continua disponível.',
        'Nas NFs com XML há também o cartão "Dados desta NF": nome do fornecedor, recurso da NF inteira (C/C ou próprio, conforme a origem do pedido) e "Esta NF não tem cotação" (compra direta, que tira a NF do pedido).',
        'Ao marcar "Esta NF não tem cotação (compra direta)", aparece "Destino da compra direta": escolha Santa Casa ou CTI. Com o destino, os botões de recurso (C/C ou próprio) funcionam mesmo sem cotação do SmartCompras, e a NF deixa de aparecer como "sem produto da cotação".',
        'Se aparecer o aviso "Itens diferentes com o mesmo produto da cotação", dois itens da NF estão associados ao mesmo produto: corrija a associação na aba Itens.',
        'Pendências do Controle de NFs levam direto à aba e ao cartão certos, destacados em amarelo.'
      ],
      dicas: ['O Voltar devolve você ao ponto de onde chegou (por exemplo, o pedido ou o Controle).'], tutorial: null },
    { id: 'central-pedido', cat: 'Cotações e recurso', titulo: 'Pedido (Central do Pedido): fornecedores, NF e divergências', versao: '2.12.4',
      resumo: 'Acompanhar um pedido fornecedor a fornecedor.',
      palavras: 'pedido central fornecedor cartao divergencia associar nf abrir nf chegou parcial entrega itens',
      tela: [{ id: 'screen-cotacoes', titulo: 'Cotações', rotulo: 'Abrir Cotações' }],
      passos: [
        'Em Cotações, toque no cartão do pedido.',
        'Cada fornecedor tem um cartão recolhível: o cabeçalho traz o nome (apelido), CNPJ, situação da entrega e os botões. Abra para ver itens, valor cotado, divergências e produtos.',
        'Botões do cartão: Abrir NF (as notas já ligadas), Associar NF (ou "Associar outra NF"), e, conforme o caso, Marcar parcial resolvida, Marcar como já chegou ou Desfazer a marca manual.',
        'Em Associar NF, a lista mostra as NFs da mesma entidade do fornecedor. Se ele entregou por outro CNPJ, digite o número da NF: a busca passa a valer para todos os fornecedores e indica o nome e "outro CNPJ".',
        'Ao associar uma NF do histórico, o app liga sozinho os itens à cotação (por SP Data, e também por nome, quantidade e preço próximo, mesmo sem o texto do SmartCompras colado). Só liga quando é inequívoco e nunca troca uma associação sua. Abaixo da NF associada, "Itens lançados" mostra o que foi lançado e a qual produto da cotação cada item ficou ligado. A NF aparece aí mesmo que ainda esteja esperando decisão no Controle. Itens sem nome oficial (relatório do SmartCompras não colado) mostram o nome lançado no ERP, marcado como tal.',
        'No topo do pedido, "Marcar toda a cotação como entregue" marca todos os fornecedores de uma vez como "já chegou" (manual); o mesmo botão passa a "Desfazer marcas de entrega de todos".',
        'O quadro Divergências, quando maior que zero, é tocável e leva ao item divergente.',
        'Itens do pedido sem fornecedor definido aparecem como "soltas".'
      ],
      dicas: ['O cálculo da entrega usa as NFs processadas no app; a marca manual existe para quando o recebimento não passou por ele.'], tutorial: null },
    { id: 'relatorios', cat: 'Cotações e recurso', titulo: 'Relatórios: pedidos, notas, divergências e auditorias', versao: '2.10.7',
      resumo: 'Consultar com filtros e achar o item que você procura.',
      palavras: 'relatorios filtros periodo fornecedor destino recurso tipo divergencia pedidos notas auditorias',
      tela: [{ id: 'screen-reports', titulo: 'Relatórios', rotulo: 'Abrir Relatórios' }],
      passos: [
        'Escolha a visão: Pedidos, Notas, Divergências ou Auditorias.',
        'Abra "Filtros" para limitar por período (De/Até), fornecedor, destino (Santa Casa ou CTI), recurso e tipo de divergência.',
        'Nas listas de auditorias use os filtros de situação (Pendentes, Resolvidas, Encerradas, Todas).',
        'Em Divergências, cada cartão mostra pedido, fornecedor, situação, tipo, NF e os produtos envolvidos. Toque no cartão: o app abre o pedido já no fornecedor e no produto da divergência, e o ponto pisca suavemente em amarelo dentro do cartão.',
        'Registros antigos (de antes dos produtos ligados à cotação) agora mostram o produto. Se não têm situação gravada, valem: anotação concluída = Resolvida; item marcado como resolvido na cotação = Resolvida; senão, Pendente.',
        'A mesma divergência registrada várias vezes (mesmo pedido, tipo e produto, por exemplo uma por etapa) aparece como uma só, com "N registros", valendo o registro mais recente.',
        'Divergência "não faturado" deixa de ficar pendente sozinha quando o item chegou: fornecedor marcado como "já chegou", NF do app ou NF do ERP associada ao pedido.',
        'Para apagar uma divergência (por exemplo, uma antiga sem produto da cotação), toque em Excluir no cartão e confirme. Os registros repetidos dela saem juntos; o texto já gerado na anotação não muda.',
        'Os cartões de pedido seguem o padrão do app; tocar abre o pedido.'
      ],
      dicas: [], tutorial: null },
    { id: 'anotacoes', cat: 'Auditoria', titulo: 'Anotações: acompanhar e enviar ao financeiro', versao: '2.14.2',
      resumo: 'Lista de anotações em aberto e arquivadas.',
      palavras: 'anotacoes em aberto arquivadas selecionar enviada financeiro exportar relatorio nova anotacao',
      tela: [{ id: 'screen-anotacoes', titulo: 'Anotações', rotulo: 'Abrir Anotações' }],
      passos: [
        'A tela tem duas listas: Em aberto e Arquivadas.',
        '"Nova Anotação" cria uma anotação livre; "Nova Auditoria" abre o formulário de auditoria (veja o artigo seguinte).',
        'Com "Selecionar", marque anotações e use as ações: Enviada ao financeiro ou Não vai ao financeiro.',
        '"Exportar Relatório" gera o relatório das anotações.',
        'Ao abrir uma anotação, o editor segue o estilo das Notas da Apple: no topo, "✓" conclui (salva e volta) e "⋯" abre as ações (copiar tudo, colar, limpar texto, excluir). Enquanto a anotação está aberta, a barra de formatação (negrito, listas, cor, tamanho, tabela...) ocupa o lugar da dock principal: é uma cápsula fina que sobe junto com o teclado e rola para o lado. Ao voltar para a lista, a dock principal reaparece. No computador, a barra fica no topo da anotação. O título do topo acompanha o título da anotação.'
      ],
      dicas: [], tutorial: null },
    { id: 'nova-auditoria', cat: 'Auditoria', titulo: 'Registrar uma auditoria e gerar mensagem e e-mail', versao: '2.10.3',
      resumo: 'Um formulário gera a mensagem e o e-mail sem digitar duas vezes.',
      palavras: 'auditoria nova divergencia pedido nf fornecedor destinatario email mensagem gerar textos padrao copiar compartilhar salvar anotacao',
      tela: [{ id: 'screen-auditoria-nova', titulo: 'Nova Auditoria', rotulo: 'Abrir Nova Auditoria' }],
      passos: [
        'Em Anotações, toque em Nova Auditoria.',
        'Preencha Pedido SmartCompras (ao digitar, o app procura a cotação e sugere fornecedor e produtos), Nota Fiscal, Fornecedor, Data da Auditoria e Destinatário do E-mail.',
        'Toque em "Adicionar Divergência", escolha o tipo (não faturado, não entregue, avariado, valor diferente etc.) e preencha os campos; vários materiais cabem na mesma ocorrência.',
        'No campo de produto, escolha da lista da cotação: o produto fica ligado ao item (aparece "Ligado ao item…" com o nome real). Pode renomear o texto à vontade que a ligação continua; "usar este nome" volta ao nome real e "desligar" remove a ligação. Se o produto não está ligado, use "Sem ligação com a cotação — ligar a um item…".',
        'O Destinatário do E-mail é opcional: em branco, a saudação sai sem nome.',
        'Use Observação Geral se precisar. Em "Configurar Textos Padrão" ajuste o destinatário padrão, a abertura, a frase de fotos, o fechamento e o modelo de frase de cada tipo de divergência: {campo} entra com o valor digitado e [[ trecho ]] só aparece se os campos dentro dele estiverem preenchidos. {DESTINATARIO}, {FORNECEDOR}, {NF} e {PEDIDO} são substituídos sozinhos na abertura.',
        'Toque em "Gerar Auditoria": o resultado traz as abas Mensagem e E-mail, com Copiar e Compartilhar.',
        '"Salvar como Anotação" guarda a ocorrência para acompanhar depois.'
      ],
      dicas: ['O resultado continua visível e editável depois de salvar.'], tutorial: 'auditoria' },
    { id: 'equipamentos', cat: 'Equipamentos', titulo: 'Equipamentos: cadastrar e movimentar', versao: '2.10.1',
      resumo: 'Controle de aparelhos ligado às NFs, com movimentações e estoque.',
      palavras: 'equipamentos aparelho movimentar troca extravio perda entrega nova outras estoque almoxarifado patrimonio serie leitor codigo barras exportar setor',
      tela: [{ id: 'screen-equipamentos', titulo: 'Equipamentos', rotulo: 'Abrir Equipamentos' }],
      passos: [
        'Cadastre o aparelho (tipo, marca/modelo, nº de série, patrimônio, nota fiscal e fornecedor). Pela NF você abre o Controle de NFs.',
        'Para registrar o que aconteceu, toque em Movimentar e escolha: Troca, Extravio / perda, Entrega nova ou Outras.',
        'Troca: escolha o setor, o aparelho que sai e o novo; diga para onde vai o devolvido (estoque utilizável, manutenção ou baixa).',
        'Extravio / perda e Entrega nova: setor, aparelho entregue e quem assinou (RT / solicitante). O termo é assinado no papel; o app só registra.',
        'Outras: transferir para outro setor, devolver ao estoque, enviar ou voltar da manutenção, ou baixar definitivamente.',
        'Procure o aparelho digitando ou bipando o patrimônio/nº de série (há leitura de código de barras pela câmera).',
        '"Estoque por modelo" resume o que está disponível; "Exportar lista" gera a planilha (.xlsx), com opção de só o que é novo desde a última exportação.'
      ],
      dicas: ['O estoque se chama Almoxarifado. Se o aparelho consta em outro setor, o app avisa e registra o local real.'], tutorial: null },
    { id: 'sp-data', cat: 'Fornecedores e produtos', titulo: 'Produtos SP Data e associação com a cotação', versao: '2.10.1',
      resumo: 'Importar o cadastro de produtos e ligar cada item ao SP Data.',
      palavras: 'sp data sgh produtos importar relatorio codigo nome unidade cadastrar associacao ativo ignorar divergencia',
      tela: [{ id: 'screen-spdata', titulo: 'Produtos SP Data', rotulo: 'Abrir Produtos SP Data' }],
      passos: [
        'Em Ajustes → Produtos SP Data, cole o relatório do SGH com Código, Nome e Unidade (prefira um com a coluna de nome larga, como "Itens por subgrupo II") e toque em Processar.',
        'Confira a prévia e use Confirmar Importação.',
        'Para um produto que não está no relatório, use "Cadastrar produto" (Código SP Data, Nome, Unidade).',
        'A associação do item da cotação com o produto SP Data pode ser feita na própria Entrada de NF, sem sair dela.',
        'Por produto, você pode ativar/desativar ou ignorar a divergência de quantidade/valor unitário.'
      ],
      dicas: ['"Limpar Banco de Exceções" apaga os fatores de conversão lembrados; use só se quiser recomeçar.'], tutorial: null },
    { id: 'fornecedores-cadastro', cat: 'Fornecedores e produtos', titulo: 'Importar o cadastro de fornecedores (SP Data)', versao: '2.10.1',
      resumo: 'Trazer código, CNPJ, nome real e nome exibido.',
      palavras: 'fornecedores cadastro importar atualizar sp data cnpj nome real exibido selecionar multiplos xml',
      tela: [{ id: 'screen-fornecedores', titulo: 'Fornecedores', rotulo: 'Abrir Fornecedores' }],
      passos: [
        'Em Ajustes → Fornecedores, abra "Importar/Atualizar Cadastro".',
        'Cole o relatório de cadastro ou envie o arquivo e toque em "Processar Cadastro".',
        'O cadastro serve para confirmar automaticamente a qual NF/cotação um lançamento do ERP corresponde.',
        '"Selecionar Múltiplos" e "Todos Visíveis" ajudam nas ações em vários fornecedores.',
        'CNPJs da mesma empresa (mesmos 8 primeiros dígitos) são vinculados sozinhos; o aviso aparece no final da importação.'
      ],
      dicas: [], tutorial: null },
    { id: 'analise-cotacoes', cat: 'Cotações e recurso', titulo: 'Configurar a análise de cotações (mínimos de fornecedores)', versao: '2.10.1',
      resumo: 'Define quando um item é C/C ou Recurso Próprio.',
      palavras: 'analise cotacoes minimo fornecedores cc proprio configurar regra',
      tela: [{ id: 'screen-config-analise-cotacoes', titulo: 'Análise de Cotações', rotulo: 'Abrir Análise de Cotações' }],
      passos: [
        'Em Ajustes → Análise de Cotações, preencha "Mínimo de fornecedores cotando — itens em C/C" e o mesmo para Recurso Próprio.',
        'Em branco, valem 3 (C/C) e 1 (Recurso Próprio).',
        'Toque em Salvar. A regra passa a valer na Entrada de NF.'
      ],
      dicas: [], tutorial: null },
    { id: 'observacoes', cat: 'Ajustes e dados', titulo: 'Observações (lista de recursos do campo Recurso)', versao: '2.10.1',
      resumo: 'As opções que aparecem em "Recurso a ser pago".',
      palavras: 'observacoes recurso lista opcoes texto padrao',
      tela: [{ id: 'screen-observacoes', titulo: 'Observações', rotulo: 'Abrir Observações' }],
      passos: ['Em Ajustes → Observações, mantenha a lista de recursos que aparece ao cadastrar ou editar uma nota e na importação do ERP.'],
      dicas: ['O recurso que você escolhe aqui é o que sai na Saída de Texto.'], tutorial: null },
    { id: 'conta-acesso', cat: 'Ajustes e dados', titulo: 'Conta, senha e aprovação de pessoas', versao: '2.10.1',
      resumo: 'Seu nome, senha e (para o administrador) criar contas e liberar acessos.',
      palavras: 'conta senha nome alterar criar conta aprovacao acesso google telefone admin gerar senha',
      tela: [{ id: 'screen-conta', titulo: 'Conta', rotulo: 'Abrir Conta' }],
      passos: [
        'Em Ajustes → Conta, defina seu Nome (só personaliza mensagens) e, se entra por e-mail e senha, use "Alterar Senha".',
        'O administrador cria contas ali mesmo: e-mail, nome (opcional) e senha temporária (mín. 6 caracteres; "Gerar senha" sugere uma). A pessoa já entra aprovada.',
        'Pessoas que entram pelo Google ou telefone aparecem em Aprovações de Acesso; aprove para liberar.'
      ],
      dicas: [], tutorial: null },
    { id: 'historico-mudancas', cat: 'Ajustes e dados', titulo: 'Histórico de mudanças e novidades', versao: '2.10.1',
      resumo: 'O que mudou em cada versão e o que testar.',
      palavras: 'historico mudancas versao novidades atualizacao testar',
      tela: [{ id: 'screen-historico-mudancas', titulo: 'Histórico de Mudanças', rotulo: 'Abrir o histórico' }],
      passos: [
        'Em Ajustes → Histórico de Mudanças, a versão mais recente fica no topo e destacada.',
        'Cada versão traz o que há de novo, o que mudou e o que testar, com atalhos quando houver.',
        'Ao abrir uma versão nova, o app mostra as novidades numa janela.'
      ],
      dicas: ['A Ajuda é revisada junto: o selo "Revisado na versão" de cada artigo mostra quando foi conferido.'], tutorial: null },
    { id: 'links-voltar', cat: 'Primeiros passos', titulo: 'Toques que levam direto ao ponto e Voltar ao ponto exato', versao: '2.10.1',
      resumo: 'Como o app leva você ao lugar de resolver e traz de volta.',
      palavras: 'link tocar destaque amarelo voltar ponto exato gesto pendencia divergencia',
      passos: [
        'Selos, pendências e quadros com seta (›) ou sublinhado pontilhado são tocáveis.',
        'Ao tocar, o app abre a tela certa, rola até o ponto e o destaca: um tom de amarelo dentro do cartão que dissolve de volta ao normal.',
        'O Voltar (botão ou gesto da borda) devolve você exatamente ao ponto de onde saiu: a mesma NF, o mesmo pedido e a mesma rolagem.',
        'Trocar de aba pela barra zera esse caminho de volta.'
      ],
      dicas: [], tutorial: null }
];

// ---------------- Tutoriais guiados (dados de exemplo; NADA é gravado) ----------------
// Cada passo: t (título), d (explicação), alvo (o que fica destacado), acao (true = tem botão para tocar), mock(e, A) -> HTML do exemplo.
// e = estado da demonstração (e.recurso, e.salva, e.tipo, e.gerado, e.lote, e.aplicado, e.salvaAnot); A(k) = classe de destaque se o alvo é k.
const DEMO_ITENS = [['Dipirona 500 mg/ml amp. C/10', '10 cx', 'Fator 10'], ['Soro fisiológico 0,9% 500 ml', '24 un', 'Fator 1'], ['Luva nitrílica M C/100', '5 cx', 'Fator 100']];
function demoItensHTML(e) {
    return DEMO_ITENS.map(it => `<div class="aj-item"><div><strong>${it[0]}</strong><small>${it[1]} · ${it[2]}</small></div><span class="xml-item-badge pronto">✓ Pronto</span>${e.recurso ? `<small class="aj-rec">Recurso: ${e.recurso}</small>` : ''}</div>`).join('');
}
const TIPOS_DEMO = { nao_entregue: 'Não entregue', valor_diferente: 'Valor diferente do pedido', avariado: 'Material avariado' };
const TUTORIAIS = {
    'xml-ao-texto': { titulo: 'Da NF em XML até a Saída de Texto', resumo: 'Entrada de NF, recurso da NF inteira, salvar, Gerenciar e Saída de Texto.', passos: [
        { t: 'Entrada de NF: carregue o XML', d: 'Em Entrada de NF você carrega o arquivo XML da nota. Aqui usamos uma nota de exemplo; nada disso é gravado.', alvo: 'carregar',
          mock: (e, A) => `<div class="ctl-card"><div class="ctl-top"><div class="ctl-av">DE</div><div class="ctl-nm"><b>DISTRIBUIDORA EXEMPLO LTDA</b><small>NF 004512 · R$ 2.450,00</small></div></div><button type="button" class="manage-toolbar-btn${A('carregar')}">Escolher XML</button></div>` },
        { t: 'Confira os itens', d: 'Cada item mostra o fator de conversão (vem da descrição, como "C/10") e se está pronto. Itens com pendência abrem sozinhos e mostram o que falta.', alvo: 'itens',
          mock: (e, A) => `<div class="card${A('itens')}">${demoItensHTML(e)}</div>` },
        { t: 'Defina o recurso da NF inteira', d: 'Toque em um dos botões abaixo: o recurso é aplicado a todos os itens de uma vez. Também dá para trocar item por item.', alvo: 'recurso', acao: v => !!v.recurso,
          mock: (e, A) => `<div class="xml-recurso-todos${A('recurso')}"><div class="xml-recurso-todos-txt"><strong>Recurso da NF inteira</strong><span>${e.recurso ? 'Os 3 itens estão em <strong>' + e.recurso + '</strong>.' : '3 itens ainda sem recurso.'}</span></div><div class="xml-recurso-todos-bt"><button type="button" class="central-status-toggle" onclick="tutorialSet('recurso','C/C SANTA CASA')">C/C SANTA CASA</button><button type="button" class="central-status-toggle" onclick="tutorialSet('recurso','Recurso Proprio Santa Casa')">Recurso Proprio Santa Casa</button></div></div><div class="card">${demoItensHTML(e)}</div>` },
        { t: 'Salve a NF', d: 'Salvar é a sua confirmação: o recurso dos itens é gravado na cotação e a nota passa a existir no Gerenciar.', alvo: 'salvar', acao: v => !!v.salva,
          mock: (e, A) => `<div class="card">${demoItensHTML(e)}</div><button type="button" class="manage-toolbar-btn${A('salvar')}" onclick="tutorialSet('salva',true)">${e.salva ? '✓ NF salva (demonstração)' : 'Salvar NF'}</button>` },
        { t: 'Gerenciar: a nota conferida', d: 'A nota entra na relação com o selo de situação. Tocar no selo leva ao pedido onde uma divergência se resolve.', alvo: 'nota',
          mock: (e, A) => `<div class="ctl-card${A('nota')}"><div class="ctl-top"><div class="ctl-av">DE</div><div class="ctl-nm"><b>DISTRIBUIDORA EXEMPLO LTDA</b><small>NF 004512 · venc. 30/10</small></div><span class="ctl-st ok">✓ Conferida</span></div><div class="ctl-dd"><div><small>Valor</small><div class="ctl-vl">R$ 2.450,00</div></div><div><small>Recurso</small><div class="ctl-vl">${e.recurso || '—'}</div></div><div><small>Pedido</small><div class="ctl-vl">12345</div></div></div></div>` },
        { t: 'Exportar: Saída de Texto', d: 'Em Exportar o texto das notas "Para saída" é montado, com o recurso de cada nota. Copie, compartilhe ou gere o PDF e, depois de enviar, arquive. (O texto abaixo é só ilustração; o formato real é o da tela Exportar.)', alvo: 'texto',
          mock: (e, A) => `<div class="card${A('texto')}"><pre class="aj-pre">DISTRIBUIDORA EXEMPLO LTDA\nNF 4512 · R$ 2.450,00 · venc. 30/10\nRecurso: ${e.recurso || '—'}</pre></div>` }
    ] },
    'auditoria': { titulo: 'Registrar uma auditoria', resumo: 'Dados, divergência, gerar a mensagem e salvar como anotação.', passos: [
        { t: 'Dados da auditoria', d: 'Em Anotações → Nova Auditoria, comece pelo Pedido SmartCompras: ao digitar, o app procura a cotação e sugere fornecedor e produtos. Depois NF, Fornecedor, Data e Destinatário do E-mail.', alvo: 'dados',
          mock: (e, A) => `<div class="card${A('dados')}"><div class="aj-campo"><small>Pedido SmartCompras (Cotação)</small><div class="aj-input">12345</div><div class="aj-ok">✓ Cotação encontrada — Santa Casa · 3 fornecedores · 8 itens</div></div><div class="aj-campo"><small>Nota Fiscal</small><div class="aj-input">4512</div></div><div class="aj-campo"><small>Fornecedor</small><div class="aj-input">DISTRIBUIDORA EXEMPLO</div></div></div>` },
        { t: 'Escolha o tipo da divergência', d: 'Toque em "Adicionar Divergência" e escolha o tipo. Cada tipo mostra os campos que fazem sentido. Toque em um dos tipos abaixo.', alvo: 'tipo', acao: v => !!v.tipo,
          mock: (e, A) => `<div class="card${A('tipo')}"><div class="aj-chips">${Object.entries(TIPOS_DEMO).map(([k, l]) => `<button type="button" class="central-status-toggle${e.tipo === k ? ' aj-sel' : ''}" onclick="tutorialSet('tipo','${k}')">${l}</button>`).join('')}</div></div>` },
        { t: 'Preencha o material', d: 'Os campos mudam conforme o tipo escolhido. Vários materiais cabem na mesma ocorrência, sem criar outra auditoria.', alvo: 'campos',
          mock: (e, A) => { const t = e.tipo || 'nao_entregue';
              const campos = t === 'valor_diferente' ? [['Produto', 'DIPIRONA 500 MG/ML'], ['Quantidade', '10'], ['Valor Cotado', 'R$ 4,00'], ['Valor Faturado', 'R$ 4,80']]
                  : t === 'avariado' ? [['Produto', 'SORO FISIOLÓGICO 0,9%'], ['Quantidade', '3'], ['Tipo de Avaria', 'quebradas'], ['Lote', 'L2231'], ['Validade', '30/06/2028']]
                  : [['Produto', 'LUVA NITRÍLICA M'], ['Quantidade', '5']];
              return `<div class="card${A('campos')}"><strong>${TIPOS_DEMO[t]}</strong>${campos.map(c => `<div class="aj-campo"><small>${c[0]}</small><div class="aj-input">${c[1]}</div></div>`).join('')}</div>`; } },
        { t: 'Gere a auditoria', d: 'Toque em "Gerar Auditoria": o app monta a Mensagem e o E-mail sozinho, com as frases padrão (que você ajusta em "Configurar Textos Padrão").', alvo: 'gerar', acao: v => !!v.gerado,
          mock: (e, A) => `<button type="button" class="manage-toolbar-btn${A('gerar')}" onclick="tutorialSet('gerado',true)">Gerar Auditoria</button>${e.gerado ? `<div class="card"><div class="aj-abas"><b>Mensagem</b> · E-mail</div><pre class="aj-pre">Boa tarde! Na NF 4512 da DISTRIBUIDORA EXEMPLO (pedido 12345) encontramos: ${TIPOS_DEMO[e.tipo || 'nao_entregue']}. Segue em anexo o registro.</pre></div>` : ''}` },
        { t: 'Copie, compartilhe e salve', d: 'Com o resultado pronto você pode Copiar, Compartilhar e "Salvar como Anotação" para acompanhar a ocorrência depois, em Anotações. (Texto ilustrativo.)', alvo: 'salvar', acao: v => !!v.salvaAnot,
          mock: (e, A) => `<div class="aj-btns"><button type="button" class="manage-toolbar-btn">Copiar</button><button type="button" class="manage-toolbar-btn">Compartilhar</button><button type="button" class="manage-toolbar-btn${A('salvar')}" onclick="tutorialSet('salvaAnot',true)">${e.salvaAnot ? '✓ Salva (demonstração)' : 'Salvar como Anotação'}</button></div>` }
    ] },
    'importar-erp': { titulo: 'Importar o relatório do ERP', resumo: 'Colar, revisar, aplicar o recurso às notas marcadas e confirmar.', passos: [
        { t: 'Cole o relatório', d: 'Em Mais → Importar Relatório (ERP), cole o texto da Relação de Notas Fiscais (ou envie o TXT) e toque em "Processar Relatório".', alvo: 'colar',
          mock: (e, A) => `<div class="card${A('colar')}"><div class="aj-input aj-area">DISTRIBUIDORA EXEMPLO LTDA  4512  30/10  2.450,00\nCOMERCIAL MODELO S/A  8801  02/11  980,50\nLABORATÓRIO TESTE  311  05/11  1.120,00</div><button type="button" class="manage-toolbar-btn">Processar Relatório</button></div>` },
        { t: 'Revise as notas', d: 'Cada nota vira um bloco editável. Notas que já estão pendentes ficam bloqueadas (duplicata). Se o recurso já é conhecido pela Entrada de NF, ele vem preenchido com a indicação "Sugerido pela Entrada de NF".', alvo: 'notas',
          mock: (e, A) => `<div class="card${A('notas')}">${[['DISTRIBUIDORA EXEMPLO LTDA', '4512', 'R$ 2.450,00', 'C/C SANTA CASA', 'Sugerido pela Entrada de NF desta nota.'], ['COMERCIAL MODELO S/A', '8801', 'R$ 980,50', e.aplicado || '—', ''], ['LABORATÓRIO TESTE', '311', 'R$ 1.120,00', e.aplicado || '—', '']].map(n => `<div class="aj-item"><div><strong>${n[0]}</strong><small>NF ${n[1]} · ${n[2]}</small></div><span class="xml-item-badge neutro">Recurso: ${n[3]}</span>${n[4] ? `<small class="aj-rec">${n[4]}</small>` : ''}</div>`).join('')}</div>` },
        { t: 'Aplique o recurso às marcadas', d: 'Marque as notas, escolha o recurso e use "Aplicar Recurso às Marcadas": todas recebem o mesmo recurso de uma vez. Toque em um recurso abaixo.', alvo: 'lote', acao: v => !!v.aplicado,
          mock: (e, A) => `<div class="xml-recurso-todos${A('lote')}"><div class="xml-recurso-todos-txt"><strong>Aplicar Recurso às Marcadas</strong><span>${e.aplicado ? 'Aplicado a 2 notas marcadas: <strong>' + e.aplicado + '</strong>.' : '2 notas marcadas sem recurso.'}</span></div><div class="xml-recurso-todos-bt"><button type="button" class="central-status-toggle" onclick="tutorialSet('aplicado','C/C SANTA CASA')">C/C SANTA CASA</button><button type="button" class="central-status-toggle" onclick="tutorialSet('aplicado','Recurso Proprio Santa Casa')">Recurso Proprio Santa Casa</button></div></div>` },
        { t: 'Confirme a importação', d: 'Use a busca e "Mostrar Apenas Novas" se precisar, desmarque o que não quer e confirme. As notas entram em Gerenciar, prontas para a Saída de Texto.', alvo: 'confirmar',
          mock: (e, A) => `<button type="button" class="manage-toolbar-btn${A('confirmar')}">Confirmar importação (3 notas)</button>` }
    ] }
};
let ajudaEstado = { aberto: null, busca: '' };
let tutorialEstado = null;

function ajEsc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function ajNorm(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

function prepararAjuda() { ajudaEstado = { aberto: null, busca: '' }; renderAjuda(); }
function abrirAjuda(artigoId) {
    ajudaEstado = { aberto: artigoId || null, busca: '' };
    renderAjuda();
    switchToScreen('screen-ajuda', 'Ajuda');
}
function renderAjuda() {
    const el = document.getElementById('ajuda-conteudo'); if (!el) return;
    const art = ajudaEstado.aberto ? AJUDA_ARTIGOS.find(a => a.id === ajudaEstado.aberto) : null;
    const anim = ajudaEstado.anim || ''; ajudaEstado.anim = '';
    el.className = ''; if (anim) { void el.offsetWidth; el.className = 'aj-anim-' + anim; } // transição ao entrar no artigo / voltar à lista
    if (art) { el.innerHTML = htmlArtigoAjuda(art); return; }
    const q = ajNorm(ajudaEstado.busca).trim();
    const lista = q ? AJUDA_ARTIGOS.filter(a => ajNorm(a.titulo + ' ' + a.resumo + ' ' + a.palavras + ' ' + a.cat + ' ' + a.passos.join(' ')).includes(q)) : AJUDA_ARTIGOS;
    const tutHTML = q ? '' : `<div class="aj-cat">Tutoriais guiados (com dados de exemplo)</div><ul class="settings-list-group">${Object.entries(TUTORIAIS).map(([id, t]) =>
        `<li><a onclick="iniciarTutorial('${id}')"><span class="aj-li"><strong><i class="fa-solid fa-graduation-cap"></i> ${ajEsc(t.titulo)}</strong><small>${ajEsc(t.resumo)} Nada é gravado.</small></span><i class="fa-solid fa-chevron-right"></i></a></li>`).join('')}</ul>`;
    const porCat = AJUDA_CATEGORIAS.map(c => {
        const itens = lista.filter(a => a.cat === c); if (!itens.length) return '';
        return `<div class="aj-cat">${ajEsc(c)}</div><ul class="settings-list-group">${itens.map(a =>
            `<li><a onclick="abrirArtigoAjuda('${a.id}')"><span class="aj-li"><strong>${ajEsc(a.titulo)}</strong><small>${ajEsc(a.resumo)}</small></span><i class="fa-solid fa-chevron-right"></i></a></li>`).join('')}</ul>`;
    }).join('');
    el.innerHTML = `<div class="campo ajustes-busca"><input type="search" id="ajuda-busca" class="form-field" placeholder="Buscar na Ajuda..." value="${ajEsc(ajudaEstado.busca)}" oninput="buscarAjuda(this.value)" autocomplete="off" autocapitalize="off" spellcheck="false"></div>`
        + tutHTML + (porCat || '<div class="card aj-resumo">Nada encontrado. Tente outra palavra.</div>');
    const inp = document.getElementById('ajuda-busca');
    if (inp && q) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}
function buscarAjuda(v) { ajudaEstado.busca = v; renderAjuda(); }
function abrirArtigoAjuda(id) { ajudaEstado.aberto = id; ajudaEstado.anim = 'frente'; renderAjuda(); const s = document.getElementById('screen-ajuda'); if (s) s.scrollTop = 0; }
function voltarListaAjuda() { ajudaEstado.aberto = null; ajudaEstado.anim = 'volta'; renderAjuda(); }
function htmlArtigoAjuda(a) {
    const botoes = (a.tela || []).map(t => `<button type="button" class="manage-toolbar-btn" onclick="switchToScreen('${t.id}','${ajEsc(t.titulo)}')">${ajEsc(t.rotulo)}</button>`).join('')
        + (a.tutorial ? `<button type="button" class="manage-toolbar-btn" onclick="iniciarTutorial('${a.tutorial}')">Ver o tutorial guiado</button>` : '');
    return `<div class="card aj-artigo"><div class="aj-cat">${ajEsc(a.cat)}</div><h2 class="aj-h">${ajEsc(a.titulo)}</h2>
        <div class="aj-resumo">${ajEsc(a.resumo)}</div>
        <ol class="aj-passos">${a.passos.map(p => `<li>${ajEsc(p)}</li>`).join('')}</ol>
        ${a.dicas && a.dicas.length ? `<div class="aj-dicas">${a.dicas.map(d => `<div><strong>Dica:</strong> ${ajEsc(d)}</div>`).join('')}</div>` : ''}
        ${botoes ? `<div class="aj-acoes">${botoes}</div>` : ''}
        <div class="aj-versao">Revisado na versão ${ajEsc(a.versao)}</div></div>`;
}

// ---- Tutorial: janela com cartões de exemplo (nunca toca no Firebase) ----
function iniciarTutorial(id) {
    if (!TUTORIAIS[id]) return;
    tutorialEstado = { id, i: 0 };
    let ov = document.getElementById('aj-tut-ov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'aj-tut-ov'; ov.className = 'aj-tut-ov'; document.body.appendChild(ov); }
    ov.style.display = 'flex'; renderTutorial();
}
function sairTutorial() { const ov = document.getElementById('aj-tut-ov'); if (ov) ov.style.display = 'none'; tutorialEstado = null; }
function tutorialPasso(d) {
    if (!tutorialEstado) return;
    const n = TUTORIAIS[tutorialEstado.id].passos.length, ni = tutorialEstado.i + d;
    if (ni < 0) return; if (ni >= n) return sairTutorial();
    tutorialEstado.i = ni; renderTutorial();
}
function tutorialSet(k, v) { if (!tutorialEstado) return; tutorialEstado[k] = v; renderTutorial(); }
function renderTutorial() {
    const ov = document.getElementById('aj-tut-ov'); if (!ov || !tutorialEstado) return;
    const e = tutorialEstado, T = TUTORIAIS[e.id], p = T.passos[e.i], n = T.passos.length;
    const A = k => p.alvo === k ? ' aj-alvo' : '';
    const pendente = p.acao && !p.acao(e);
    const dica = pendente ? '<div class="aj-dica-acao">Toque no botão destacado para ver o efeito (é só demonstração).</div>' : '';
    ov.innerHTML = `<div class="aj-tut-box"><div class="aj-tut-topo"><span>${ajEsc(T.titulo)} · passo ${e.i + 1} de ${n}</span><button type="button" class="aj-sair" onclick="sairTutorial()">Sair</button></div>
        <h3 class="aj-h">${ajEsc(p.t)}</h3><div class="aj-resumo">${ajEsc(p.d)}</div>
        <div class="aj-demo">${p.mock(e, A)}</div>${dica}
        <div class="aj-tut-nav"><button type="button" class="manage-toolbar-btn" onclick="tutorialPasso(-1)" ${e.i === 0 ? 'disabled' : ''}>Voltar</button><button type="button" class="manage-toolbar-btn" onclick="tutorialPasso(1)">${e.i === n - 1 ? 'Concluir' : 'Próximo'}</button></div></div>`;
}

// O botão Voltar do topo (js/06) pergunta aqui antes: com um artigo aberto, sobe só para a lista; na lista, volta para Ajustes como sempre.
function voltarInternoDisponivel() { const at = document.querySelector('.app-screen.active'); return !!(at && at.id === 'screen-ajuda' && ajudaEstado.aberto); }
function voltarInternoTela() { if (!voltarInternoDisponivel()) return false; voltarListaAjuda(); return true; }

// Gesto de voltar (arrastar da borda esquerda) também dentro do artigo da Ajuda: sobe para a lista.
(function () {
    let g = null;
    document.addEventListener('pointerdown', e => { g = (e.clientX <= 28 && voltarInternoDisponivel()) ? { x: e.clientX, y: e.clientY } : null; }, true);
    document.addEventListener('pointerup', e => {
        if (g && e.clientX - g.x > 70 && Math.abs(e.clientY - g.y) < 90 && voltarInternoDisponivel()) voltarListaAjuda();
        g = null;
    }, true);
    document.addEventListener('pointercancel', () => { g = null; }, true);
})();

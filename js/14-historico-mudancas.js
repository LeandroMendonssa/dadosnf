// 14-historico-mudancas.js — Histórico de mudanças do aplicativo
// Parte do script do app (v2.0.1). Arquivo comum, carregado em ordem pelo index.html; compartilha funções e variáveis globais com os demais.
// --- CONFIGURAÇÕES → HISTÓRICO DE MUDANÇAS DO APLICATIVO ---
// (2.3.1: campos opcionais por versão para o popup de novidades — novidades: [frases curtas] e testarLinks: [{ rotulo, acao, arg }])
// ===================================================================
// Registro funcional/documental do desenvolvimento — não é versionamento
// técnico nem log automático de código. É estático dentro do app (sem
// coleção nova no Firestore, como pedido): cada atualização futura só
// precisa acrescentar uma entrada neste array, com "o que mudou" + "o que
// testar". A entrada mais recente é sempre a fase atual, destacada na tela.
const HISTORICO_FASES = [
    {
        numero: '2.18.1', nome: 'Varredura de erros de lógica', status: 'atual',
        novidades: [
            'Data errada à noite: várias telas pegavam a data do relógio em UTC, que no Brasil vira o dia seguinte depois das 21h. Afetava a data padrão da Nova Auditoria, o histórico de mudança de status da divergência, a data do pedido ao cadastrar cotação, a data do histórico da auditoria ao salvar, o limite "vencida" de Cotações e os nomes dos arquivos de backup e diagnóstico. Tudo passou a usar a data local.',
            'CNPJ com e sem máscara: as cotações e parte do ERP guardam o CNPJ com pontos e traço, enquanto o SP Data e as NFs guardam só os 14 números. Em 5 lugares do Controle de NFs e do Editor a busca do fornecedor comparava os dois sem normalizar e não achava o cadastro (aparecia o nome cru do ERP no lugar do apelido, e "Enviar para a relação" pedia dados que o app já tinha). Agora a busca ignora a máscara.',
            'Editor da NF: a lista "Divergências desta NF" mostrava tudo em amarelo e dizia "nenhuma divergência" mesmo com pendência relatada. Agora cada item mostra o seu estado (em aberto, relatada ou resolvida), igual às outras telas.',
            'Ajustes (modelos de texto da auditoria): o campo registrava um novo "salvar ao sair" a cada vez que a tela abria; agora registra uma vez só.',
            'Nada mais encontrado na varredura: nenhuma função chamada que não exista, nenhum botão apontando para função inexistente, nenhum elemento duplicado, nenhum "NaN" ou "undefined" nos textos das telas e nenhuma contagem de entrega que não feche, em todos os pedidos e NFs dos dados de teste.'
        ],
        implementado: ['docFornecedorSpDataPorCnpj (js/10), mapa por CNPJ normalizado e refeito só quando o SP Data muda; dataLocalISO no lugar de toISOString().slice(0,10).'],
        mudou: ['Arquivos alterados: js/07, js/09, js/10, js/11, js/12, js/13, js/14, js/15, js/16, js/17 e js/20.'],
        testar: ['Depois das 21h: abrir Nova Auditoria e ver se a data padrão é a de hoje (não a de amanhã).', 'Controle de NFs: NF que só existe no ERP deve mostrar o apelido do fornecedor, não o nome cru do relatório.', 'Editor de uma NF com pendência relatada: a lista de divergências deve mostrar o selo "Pendência relatada" e não o texto de "nenhuma divergência".'],
        testarLinks: []
    },
    {
        numero: '2.18.0', nome: 'Produto trocado, divergência legível e busca da web', status: 'concluida',
        novidades: [
            'Web: o campo de pesquisa de Cotações (e o espaço de cima das demais telas) tinha ficado sob o cabeçalho depois da 2.16.2; corrigido.',
            'Divergências (Outras divergências do fornecedor e Outras ocorrências): cada uma é um cartão só, com o tipo, fornecedor, NF e pedido, o texto, a linha do tempo (data e o que foi registrado) e "Alterar status" dentro da mesma moldura. "Pendente" passou a se chamar "Pendência relatada" e o histórico diz "Relatada na auditoria".',
            'Nova Auditoria: "Produto Pedido" lista os itens da cotação do pedido (os do fornecedor primeiro; os de outros fornecedores com o nome dele), mesmo que o item já esteja associado a uma NF. O campo abre mostrando a lista inteira, sem ficar filtrado pelo texto já preenchido.',
            'Nova Auditoria: "Produto Faturado" abre o cadastro inteiro do SP Data, sem filtro e sem sugestão, para o produto que veio no lugar (que pode nunca ter sido cotado).',
            'Entrada de NF: cada item ganhou "Remover associação" (tira a associação errada do fornecedor), "Veio produto trocado" e "Aceito como outro produto".',
            '"Veio produto trocado": o item da NF não é associado a código nenhum; a conferência registra a ocorrência "Solicitamos X, porém foi faturado Y" (já pronta para gerar auditoria) e o item pedido não vira "não faturado". O SP Data é o do produto que de fato veio.',
            '"Aceito como outro produto" (ex.: dipirona 10 mL aceita no lugar da de 20 mL): vale como o item pedido só para esta NF e cotação, sem divergência de produto e sem gravar a associação, para não conflitar se a de 20 mL vier depois.'
        ],
        implementado: ['associacaoEfetivaXml, tratamentoXml (js/10); tratamento/substituiCodigo no item da NF salva e ocorrência "produto_trocado" em compararFontesPedido (js/11); renderBlocoDivergencia em cartão (js/09); listas livres da auditoria (js/12, js/13).'],
        mudou: ['Arquivos alterados: style.css, js/09, js/10, js/11, js/12, js/13, js/14, js/31, js/33 e js/36.'],
        testar: ['Web: abrir Cotações e ver o campo de pesquisa.', 'Pedido com divergências: ver os cartões (tipo, NF, pedido, linha do tempo) em "Outras divergências deste fornecedor" e em "Outras ocorrências".', 'Nova Auditoria, tipo "Produto diferente do pedido": Produto Pedido mostra os itens da cotação; Produto Faturado mostra o SP Data inteiro.', 'Pedido 1744, NF 123470 (protetor ocular): na Entrada de NF, "Remover associação" e depois "Veio produto trocado" apontando para o PROTETOR OCULAR P; salvar e conferir a ocorrência "Solicitamos … porém foi faturado …".', 'NF 78771 (dipirona 10 mL): "Aceito como outro produto" apontando para a de 20 mL; conferir que não aparece divergência e que a associação do fornecedor não mudou.'],
        testarLinks: []
    },
    {
        numero: '2.17.1', nome: 'Card do item mais claro (cotação e recurso)', status: 'concluida',
        novidades: [
            'O card do item na Central do pedido foi reorganizado em blocos: Produto (nome, código, marca, embalagem), Quantidade e valores (em três campos) e Cotação e recurso.',
            'O recurso agora vem da cotação: com fornecedores suficientes aparece "Recurso: C/C … · Pela cotação" (fica gravado quando a NF for salva) e, depois da NF, "✓ Confirmado na NF". Acabou a mensagem "ainda não confirmado" ao lado de "7 fornecedores cotaram".',
            'Quando poucos fornecedores cotaram, o card diz quantos foram e que o recurso deve ser escolhido na entrada da NF.',
            'Nenhuma informação saiu: vencedor, participantes (agora recolhidos em "Ver os N participantes"), descrição original e SP Data continuam no card.'
        ],
        implementado: ['renderLinhaProduto (js/09) com blocos "cdet" e estilos no fim do style.css; usa recursoEsperadoPelaCotacao (js/12), só leitura.'],
        mudou: ['Arquivos alterados: js/09, js/14, js/31 e style.css.'],
        testar: ['Abrir o pedido 1744, expandir "PROTETOR OCULAR M" e ver o recurso previsto pela cotação em vez de "ainda não confirmado".', 'Abrir um item de pedido já com NF salva e ver "✓ Confirmado na NF".', 'Item cotado por menos de 3 fornecedores: ver o aviso para escolher o recurso na NF.'],
        testarLinks: []
    },
    {
        numero: '2.17.0', nome: 'Ocorrências sem relato, auditoria em bloco único e cotações da NF', status: 'concluida',
        novidades: [
            'Central de notificações: toda ocorrência detectada e ainda sem relato aparece no grupo "Importante" ("Ocorrências detectadas sem relato"), por pedido, levando direto ao pedido.',
            'Central do pedido: quando um fornecedor tem mais de uma ocorrência sem relato, o botão "Gerar uma auditoria com as N ocorrências" junta todas num rascunho só (cada tipo vira um cartão, com os produtos dentro).',
            'Anotação da auditoria: se o mesmo fornecedor e a mesma NF já estão na anotação do pedido, as novas ocorrências entram sem repetir o cabeçalho (fornecedor — NF — pedido) e sem a linha separadora. Outro fornecedor ou outra NF continua com cabeçalho próprio.',
            'Editor da NF: mesmo depois de enviada ao Controle, a NF aceita mais de uma cotação. O cartão "Cotações desta NF" mostra o principal e os complementares, com "Adicionar outra cotação a esta NF" e "Remover".',
            'Entrada de NF: na lista de itens da cotação, saem os itens que outro item da NF já associou e ficam só os do fornecedor; "Ver outros itens desse fornecedor" mostra todos de novo (mesmo produto em dois códigos, marcas ou validades).',
            'Sugestão "Parecidos pelo nome" mais tolerante: não depende da ordem das palavras e vale também quando o nome da cotação é mais curto que o do XML.'
        ],
        implementado: ['Grupo "ocorrencias-sem-relato" em itensDeAtencao (js/34); registrarTodasDivergenciasDoFornecedor (js/11); pedidosDaNf/adicionarPedidoNaNf/removerPedidoDaNf (js/20); alternarJaAssociadosXml (js/10); parecencaNomes (js/21).'],
        mudou: ['Arquivos alterados: js/10, js/11, js/14, js/16, js/20, js/21, js/31 e js/34.'],
        testar: ['Central de notificações: conferir o grupo "Ocorrências detectadas sem relato" em Importante e se ele abre o pedido certo.', 'Pedido com duas ou mais faltas do mesmo fornecedor sem relato: usar "Gerar uma auditoria com as N ocorrências" e salvar; depois gerar outra para o mesmo fornecedor/NF e ver na anotação que o cabeçalho não se repete.', 'Editor da NF de uma NF já no Controle: adicionar uma segunda cotação, ver os itens dela na associação e remover.', 'Entrada de NF: associar um item e ver que ele some da lista dos demais; "Ver outros itens desse fornecedor" traz de volta.', 'Itens cujo nome vem em outra ordem no XML: ver se agora aparecem em "Parecidos pelo nome".'],
        testarLinks: []
    },
    {
        numero: '2.16.2', nome: 'Acertos de abertura, associação, recurso e visual da web', status: 'concluida',
        novidades: [
            'A tela deixa de ficar travada depois do carregamento: a lista de fornecedores era montada item por item e agora é montada de uma vez.',
            'Pedido com quantidade convertida (ex.: cotado em unidades, NF em caixas) mostra a quantidade já convertida, sem "(3/300)" enganoso.',
            'No computador, só o item do menu lateral que você abriu fica destacado (antes os itens de "Mais" acendiam juntos).',
            'Auditoria Retroativa: depois de associar a NF ao pedido correto, a sugestão antiga não volta mais; a lista se atualiza ao voltar para a tela.',
            'Recurso da NF: quando nada foi gravado, o seletor mostra o recurso que as cotações indicam ("Vem da cotação"), em vez de "não definido".',
            'Visual da web: área de conteúdo mais larga, cartões de Cotações e Anotações em duas colunas em telas grandes, menu lateral com marcador no item ativo e grupo separado para as ferramentas de "Mais".'
        ],
        implementado: ['popularDatalist (js/07) com uma única atribuição de innerHTML; recursoEsperadoPelaCotacao (js/12), só leitura; data-destino no menu lateral (js/02); bloco de estilo para computador no fim do style.css.'],
        mudou: ['Arquivos alterados: style.css, js/02, js/07, js/11, js/12, js/14, js/20, js/32 e js/36.'],
        testar: ['Abrir o app e ver se, ao sair da tela de carregamento, os botões respondem na hora.', 'Pedido 1744: deve aparecer "(150/300)" em vez de "(3/300)".', 'Na web, abrir Importar, Central de notificações, Auditoria Retroativa e Assistente: só o aberto fica azul.', 'Auditoria Retroativa: NF 1793358 associada ao pedido 1731 não volta a sugerir o 1726.', 'NF INTENSIVEMED 427148: confirmar o pedido e ver o recurso "Vem da cotação" no segundo bloco.', 'Na web, ver Cotações e Anotações em duas colunas e o novo menu lateral.'],
        testarLinks: []
    },
    {
        numero: '2.16.1', nome: 'Entrega parcial que já chegou', status: 'concluida',
        novidades: [
            'Quando o fornecedor faturou menos do que foi cotado e essa falta já foi relatada em auditoria, o item deixa de ficar "aguardando": não se espera nova entrega, porque o que não foi faturado não vem depois.',
            'O fornecedor passa a mostrar "◐ Entrega parcial — já chegou (falta relatada)", em cinza (mesmo peso de resolvido), e o cartão do pedido mostra "◐ N parcial (já chegou)". O cartão do fornecedor fica verde com "Chegou (parcial)".',
            'Quando todos os fornecedores do pedido chegaram, completos ou parciais com a falta relatada, o pedido aparece como "Concluído".',
            'Na linha do fornecedor, em vez de "Faltam: ...", aparece "Chegou parcial e a falta já foi relatada em auditoria (não se espera nova entrega): ...". O botão "Marcar parcial como resolvida" some, porque não há mais o que marcar.',
            'Antes de relatar, nada muda: a falta ainda sem auditoria continua como entrega parcial em amarelo.'
        ],
        implementado: ['Novo estado de entrega "parcial_relatada" em calcularEntregaFornecedorPedido (js/11), lido pelo cartão do fornecedor (js/09) e pelo resumo do pedido (js/13).'],
        mudou: ['Arquivos alterados: js/09, js/11, js/13, js/14 e js/31.'],
        testar: ['Pedido 1744: o fornecedor da hidrocortisona deve mostrar "Entrega parcial — já chegou (falta relatada)" em vez de aguardando/parcial em amarelo, sem o botão "Marcar parcial como resolvida".', 'Em Cotações, o cartão do 1744 deve mostrar "◐ 1 parcial (já chegou)".', 'Num pedido com falta ainda NÃO relatada, o fornecedor continua "Entrega parcial" em amarelo, com o botão de marcar.'],
        testarLinks: []
    },
    {
        numero: '2.16.0', nome: 'Divergência única: detectada, pendência relatada e resolvida', status: 'concluida',
        novidades: [
            'Uma divergência é uma ocorrência só, por item, com três estados: Divergência (o app viu a diferença e ninguém relatou ainda), Pendência relatada (existe auditoria aberta) e Resolvido. Antes, a comparação e a auditoria do mesmo problema eram contadas como duas coisas, e por isso o cartão do fornecedor mostrava 2 quando por fora aparecia 1.',
            'Pendência relatada tem o peso de resolvido: não acende o cartão do fornecedor em vermelho, não conta como "em aberto", não aparece no total de "itens que precisam de atenção" e o selo da NF fica neutro. Só a divergência ainda sem relato pede ação sua.',
            'Cartão do fornecedor: o quadro agora é "Em aberto" (só as divergências sem relato) e a faixa mostra "N divergência(s) em aberto · N pendência(s) relatada(s)". Cada item tem uma etiqueta só.',
            'Selo de aptidão da NF: passa a olhar só os itens da própria NF (antes, qualquer auditoria pendente do pedido marcava todas as NFs). Novo selo "Pendência relatada".',
            'A auditoria gerada a partir da comparação agora grava o código do item da cotação, para a ligação não depender do nome do produto. As auditorias antigas continuam como estavam e seguem ligadas pelo nome.',
            'Central de notificações: as auditorias abertas passaram para "Pendências relatadas" (prioridade baixa, fora da contagem de atenção). Na NF em edição, "Gerar auditoria" só aparece para divergência ainda sem relato.'
        ],
        implementado: ['Função estadoOcorrenciaItem em js/11 (estado derivado da evidência calculada + auditoria ligada) lida por cartão, linha do item, selo da NF, resumo do pedido, Central de notificações, visão da NF e Assistente.'],
        mudou: ['Arquivos alterados: js/05, js/09, js/11, js/13, js/14, js/30, js/31, js/34, js/36 e js/37. Nenhum dado salvo foi reescrito.'],
        testar: ['Abrir o pedido 1744: o cartão do fornecedor deve mostrar "Em aberto 0" e a faixa "1 pendência relatada", e o item uma etiqueta só ("Pendência relatada").', 'Abrir um pedido com divergência ainda sem auditoria: o cartão fica vermelho, "Em aberto 1", etiqueta "Divergência" e botão Gerar auditoria. Gerar e salvar a auditoria: o item passa a "Pendência relatada" e o cartão deixa de ficar vermelho.', 'Alterar o status da auditoria para Resolvida: o item mostra "Resolvido" em verde.'],
        testarLinks: []
    },
    {
        numero: '2.15.1', nome: 'Correção do cartão de importação e verificado reto', status: 'concluida',
        novidades: [
            'Produtos SP Data (e Fornecedores): o cartão recolhido de importação não é mais espremido quando a lista de produtos é grande; a linha aparece inteira e abre normalmente.',
            'O sinal de verificado (✓) agora é reto, de traço uniforme e pontas retas, em todo o app (selos, avisos, seleção de NFs, Ajuda): ele vem de uma fonte própria que só troca esse símbolo e acompanha o tamanho e a cor do texto.'
        ],
        implementado: ['Fonte "Check Reto" embutida no style.css (menos de 1 KB), usada antes das fontes escolhidas em Aparência.'],
        mudou: ['Arquivos alterados: style.css e js/14.'],
        testar: ['Abrir Produtos SP Data e conferir a linha "Importar relatório do SGH" inteira; tocar e ver abrir.', 'Ver o ✓ nos selos (ex.: "✓ 1 completa" em Cotações), na seleção de NFs do Controle e nos avisos: todos com o traço reto.'],
        testarLinks: []
    },
    {
        numero: '2.15.0', nome: 'Dock de seleção em lote e refinos de tela', status: 'concluida',
        novidades: [
            'Seleção em lote com Dock própria: ao tocar em Selecionar em Gerenciar, Anotações ou Controle de NFs, a dock principal dá lugar a uma cápsula com o ✕ (cancelar), o contador, "Todas" e as ações da seleção. Ela sobe com mola e some quando a seleção termina. As barras antigas saíram.',
            'Produtos SP Data e Fornecedores: a área de colar o relatório ficou recolhida em uma linha ("Importar relatório do SGH" / "Importar/Atualizar Cadastro") e só abre ao tocar, sem o campo de texto aberto na tela.',
            'Gerenciar: "Ver todas as NFs" virou um botão de ação centralizado (o mesmo tamanho e estilo dos demais), no lugar do cartão azul solto; "Adicionar nota" (lista vazia) também usa o botão padrão.',
            'Botões padronizados: os botões de ação de todas as telas têm a mesma altura (44 px) e a mesma largura mínima, centralizados, e as pílulas pequenas usam sempre a cor de destaque.',
            'Central do pedido: a linha "Outras ocorrências" ganhou respiro embaixo e o texto e a seta ficam centralizados na altura.'
        ],
        implementado: ['Novo arquivo js/38-dock-selecao.js: cada tela só avisa seu estado de seleção; as ações chamam as mesmas funções de antes (nada mudou nas regras de pendente, arquivar, excluir, exportar e financeiro).', 'A dock de seleção só aparece na tela que está em seleção; trocar de tela a esconde.'],
        mudou: ['Arquivos alterados: index.html, style.css, js/05, js/06, js/09, js/17, js/14 e js/31. Novo arquivo: js/38-dock-selecao.js (vai na pasta js).'],
        testar: ['Gerenciar: tocar no ícone de seleção, marcar notas e ver a dock com Todas e as ações (pendente, remover pendência, editar, arquivar, excluir); tocar no ✕ e ver a dock principal voltar.', 'Anotações e Controle de NFs: tocar em Selecionar e conferir a dock (Exportar; Financeiro e Direta).', 'Com a seleção ativa, trocar de tela pela barra: a dock de seleção só deve aparecer na tela que está selecionando.', 'Produtos SP Data e Fornecedores: ver a linha de importação recolhida, abrir, colar e processar.', 'Gerenciar (vazio ou com notas): ver o botão "Ver todas as NFs (Controle)" centralizado. Central do pedido: ver a linha "Outras ocorrências".'],
        testarLinks: []
    },
    {
        numero: '2.14.3', nome: 'Anotações: altura da barra regulável e menus completos', status: 'concluida',
        novidades: [
            'Anotações: no menu "⋯" há agora "Altura da barra" com os botões − e +. Eles sobem ou descem a barra de ferramentas de 4 em 4 px, funcionam com o teclado aberto e o valor fica lembrado neste aparelho.',
            'Os menus da barra (cor, tamanho, espaçamento e tabela) agora aparecem inteiros acima dela; antes o Safari os cortava fora da área da barra.'
        ],
        implementado: ['Valor padrão no iPhone: 16 px acima da barrinha de setas e ✓ do sistema.', 'Os botões do cabeçalho e o menu "⋯" não tiram mais o foco do texto, então o teclado continua aberto ao regular.'],
        mudou: ['Arquivos alterados: index.html, style.css, js/02, js/09, js/14 e js/31.'],
        testar: ['No iPhone: abrir uma anotação, tocar no texto, abrir "⋯" e usar − ou + em "Altura da barra" vendo a barra se mexer; anotar o valor que ficou bom.', 'Abrir os menus de cor, tamanho e tabela e conferir que aparecem inteiros acima da barra.'],
        testarLinks: []
    },
    {
        numero: '2.14.2', nome: 'Anotações: nova barra de ferramentas, fina e animada', status: 'concluida',
        novidades: [
            'Anotações: enquanto a anotação está aberta, a barra de ferramentas ocupa o lugar da dock principal (que volta ao fechar a anotação). É uma cápsula fina de vidro, com os mesmos ícones do app.',
            'Com o teclado, a barra sobe com uma animação de mola e para logo acima dele (acima também da barrinha de setas e ✓ do iPhone, que o sistema desenha por cima da página e não pode ser removida).',
            'No cabeçalho, "⋯" e "✓" agora ficam numa cápsula de vidro, como nas Notas da Apple.',
            'No computador: o menu lateral continua, e a barra de ferramentas fica no topo da anotação, abaixo do cabeçalho (os menus de cor, tamanho etc. abrem para baixo).'
        ],
        implementado: ['Posição da barra calculada pelo tamanho real da área visível (corrige a barra que ficava no meio da tela), com folga de 16px sobre a barrinha do iPhone.', 'Entrada animada ao abrir a anotação (nasce de baixo e sobe).'],
        mudou: ['Arquivos alterados: index.html, style.css, js/02, js/09, js/14 e js/31.'],
        testar: ['No iPhone: abrir uma anotação, tocar no texto e ver a barra subir e parar logo acima do teclado, sem ficar atrás da barrinha de setas.', 'Fechar o teclado e ver a barra descer para o lugar da dock; voltar à lista e ver a dock principal de volta.', 'Abrir os menus de cor, tamanho e tabela e conferir que abrem logo acima da barra.', 'No computador: ver a barra no topo da anotação com o menu lateral.'],
        testarLinks: []
    },
    {
        numero: '2.14.1', nome: 'Correções visuais: botão do chat e Central de notificações', status: 'concluida',
        novidades: [
            'Assistente: o botão de enviar virou um botão redondo com seta (e quadrado para parar), centralizado, sem texto deslocado.',
            'Central de notificações: o primeiro bloco (explicação) não fica mais colado no bloco de baixo; todos os blocos têm espaço entre si.'
        ],
        implementado: ['Protótipo de Anotações (proto-notas.html) para escolher o novo desenho antes de mexer na tela real: dock trocada, ferramentas compactas ou completas, botões do topo em cápsula ou ícones simples.'],
        mudou: ['Arquivos alterados: js/14, js/37 e style.css. Novo arquivo de teste (fora do app): proto-notas.html.'],
        testar: ['No Assistente: ver o botão de enviar redondo, e o botão virar quadrado enquanto a IA responde.', 'Na Central de notificações: ver o espaço entre o primeiro bloco e os demais.', 'Abrir /proto-notas.html no mesmo endereço do app e testar as variantes com o teclado do iPhone.'],
        testarLinks: []
    },
    {
        numero: '2.14.0', nome: 'Anotações no estilo Apple Notas e Assistente com endereço fixo', status: 'concluida',
        novidades: [
            'Anotações redesenhadas como as Notas da Apple: no topo, "✓" conclui (salva e volta) e "⋯" abre as ações (copiar tudo, colar, limpar texto, excluir); os botões grandes do rodapé saíram.',
            'A barra de formatação virou uma cápsula de vidro embaixo, logo acima do teclado (no celular só aparece com o teclado aberto; no computador fica sempre visível). Ela rola para o lado e os menus de cor, tamanho, espaçamento e tabela abrem logo acima dela. Antes ela ficava fixa no meio da tela ao rolar.',
            'O título do topo (parte branca) agora acompanha o título da anotação enquanto você digita e ao salvar.',
            'Assistente: o endereço da IA agora é fixo no app (não dá mais para trocar manualmente) e a escolha IA / Modo básico fica num seletor embaixo do campo de digitar, lembrada neste aparelho.'
        ],
        implementado: ['A altura do teclado passou a ser guardada para posicionar a barra de formatação (estimativa maior quando o navegador não informa).'],
        mudou: ['Arquivos alterados: index.html, style.css, js/02, js/09, js/14, js/31 e js/37. Fora do app: assistente/COMO-INSTALAR-O-ASSISTENTE.md.'],
        testar: ['No celular: abrir uma anotação, tocar no texto e ver a cápsula de formatação logo acima do teclado; testar negrito, lista, cor, tamanho e tabela (os menus abrem acima da cápsula).', 'Tocar em ⋯ e testar Copiar tudo, Colar e Limpar texto; tocar em ✓ para concluir e voltar à lista.', 'Digitar um título e ver o título branco do topo mudar; salvar e conferir.', 'Rolar a anotação e ver que nada fica fixo no meio da tela.', 'No Assistente, trocar entre IA e Modo básico no seletor embaixo.'],
        testarLinks: []
    },
    {
        numero: '2.13.4', nome: 'Assistente: chat mais completo, marca e médias', status: 'concluida',
        novidades: [
            'Respostas com negrito, listas numeradas e links: "pedido 1731" abre a Central do pedido e "NF 36435" abre a NF (se houver mais de uma NF com o número, abre a mais recente e avisa).',
            'Controles do chat: botão "■ Parar" enquanto a IA responde, contador de segundos, tempo total da resposta, botão Copiar em cada resposta e "+ Nova conversa".',
            'Marca dos produtos: as cotações passam a levar a descrição do SmartCompras (onde fica a marca) e dá para filtrar por marca; a IA extrai a marca dali.',
            'Médias, mínimo, máximo e último preço das compras já vêm calculados pelo app (a IA não faz mais as contas, o que evita erro).',
            'Perguntas que precisam de várias consultas não terminam mais em "consultas demais": a IA é chamada a responder com o que já achou. Sugestões de "você quis dizer" ficaram mais rigorosas (ex.: "ritalina" não sugere mais "vitamina").'
        ],
        implementado: ['Datas na resposta da IA em dd/mm/aaaa.', 'Até 6 rodadas de consulta por pergunta.', 'Tela do Assistente refeita no padrão de chat: barra no topo, conversa rolando no meio e campo de digitar fixo no rodapé, logo acima do teclado (antes o teclado empurrava tudo e o campo sumia). Botões Copiar e Nova conversa no estilo dos botões do app, sem quebra de texto.'],
        mudou: ['Arquivos alterados: js/14, js/31, js/37 e style.css.'],
        testar: ['Perguntar "média de preço das últimas compras de atadura crepom 15cm" e conferir com as NFs.', 'Perguntar uma marca (ex.: cotações de norepinefrina da marca Fresenius).', 'Tocar nos links de pedido e NF da resposta; usar Parar, Copiar e Nova conversa.', 'No celular: tocar no campo de digitar e ver se ele fica logo acima do teclado, com a conversa visível; fechar o teclado e ver se tudo volta ao lugar, sem sobrepor a barra de abas.'],
        testarLinks: []
    },
    {
        numero: '2.13.3', nome: 'Assistente: IA mais rápida, datas e erros claros', status: 'concluida',
        novidades: [
            'Se a IA demorar demais (mais de 40 segundos) ou a conexão com o Worker falhar, o Assistente avisa o motivo e responde pelo modo básico, em vez de ficar travado ou mostrar só "Load failed".',
            'Perguntas como "qual a última vez que chegou (material)?" agora funcionam: o app entende a pergunta, busca o material nas NFs e no ERP, ordena da mais recente para a mais antiga e mostra a data de cada NF. A IA também passa a saber a data de hoje.',
            'Medidas e números agora contam na busca: "jelco 21" só acha 21 (não confunde com 20G ou 210). Se o item exato não existe, o Assistente diz que não existe e lista os parecidos (ex.: 14G, 18G, 20G, 22G, 24G).',
            'A IA deixou de ser limitada aos dados do app: responde qualquer assunto e usa as consultas do app quando a pergunta envolve NFs, pedidos, materiais ou fornecedores. Só os números do app vêm obrigatoriamente das consultas (para não inventar). Se uma busca não acha, ela mesma tenta de novo com outras palavras.',
            'A busca tolera erro de 1 letra ("crepon" acha "crepom") e, se o item exato não existe (ex.: atadura 17cm), diz isso e lista os parecidos. Falha de rede ao falar com a IA agora é repetida uma vez automaticamente.',
            'Quando a pergunta tem uma palavra que não existe no cadastro (ex.: "gentilina"), o app sugere as parecidas que existem ("Você quis dizer: fentanila?") em vez de a IA inventar um nome. A IA foi orientada a não confundir fornecedor com marca (o app não tem campo de marca).',
            'O Worker voltou a usar por padrão o modelo maior (70B), que entende e segue instruções bem melhor; o app espera até 60 segundos. Se ficar lento ou gastar muito do limite grátis, basta criar a variável MODEL com o modelo menor.'
        ],
        implementado: ['O Worker não exige mais lista de e-mails: qualquer usuário que entra no app pode usar, e quem é barrado no app não consegue.', 'O Worker também trata respostas da IA em formatos diferentes e mostra o que recebeu quando vem vazia.'],
        mudou: ['Arquivos alterados: js/14, js/31 e js/37. Fora do app: assistente/worker-assistente.js.'],
        testar: ['Perguntar algo no Assistente com a IA ligada e ver se responde em poucos segundos.', 'Se aparecer aviso de IA indisponível, mandar o texto do aviso.'],
        testarLinks: []
    },
    {
        numero: '2.13.2', nome: 'Assistente com IA 100% Cloudflare (grátis)', status: 'concluida',
        novidades: [
            'A IA opcional do Assistente passou a rodar inteiramente na Cloudflare (Workers AI, plano gratuito): não precisa mais de chave da Anthropic nem de cartão. O guia COMO-INSTALAR-O-ASSISTENTE.md foi reescrito para isso.',
            'Funciona com qualquer modelo de texto: o app já faz as consultas que reconhece pela pergunta e entrega os resultados à IA, que só redige a resposta (na maioria das vezes uma chamada só); quando precisa de mais dados, ela pede consultas em formato JSON e o app executa.',
            'Se a IA falhar (limite grátis do dia acabou, rede, etc.), o Assistente responde sozinho pelo modo básico, avisando o motivo.'
        ],
        implementado: ['O Worker confere o login do app (só quem está logado e, se configurado, só os e-mails permitidos) e decide modelo e tamanho da resposta.', 'O limite grátis da Cloudflare (10.000 neurons por dia) nunca gera cobrança: passando dele, a IA apenas recusa até o dia seguinte.'],
        mudou: ['Arquivos alterados: js/14, js/31 e js/37. Fora do app: assistente/worker-assistente.js e assistente/COMO-INSTALAR-O-ASSISTENTE.md (reescritos).'],
        testar: ['Seguir o guia, salvar o endereço em Mais → Assistente → Ligar a IA e perguntar algo em linguagem livre (ex.: "o que está pendente hoje e por quê?").', 'Conferir a resposta com as telas.', 'Se a IA recusar por limite, ver que o modo básico responde.'],
        testarLinks: []
    },
    {
        numero: '2.13.1', nome: 'Assistente em modo básico: grátis, sem IA e sem instalação', status: 'concluida',
        novidades: [
            'O Assistente agora funciona logo de cara, de graça, sem chave nem instalação: o "modo básico" entende a pergunta por palavras-chave (número do pedido, número da NF, fornecedor, material, "divergências", "pendente", "sem pedido", "esperando decisão") e responde na hora com as mesmas consultas da versão com IA.',
            'Exemplos: "situação do pedido 1726", "NF 1067970", "divergências do pedido 1726", "NFs da MINAS SUL", "fornecedor SUPERMED", "quanto de lanceta temos?", "o que está pendente hoje?".',
            'A IA ficou opcional: em Mais → Assistente → "Ligar a IA (opcional)" você cola o endereço do intermediário quando e se quiser perguntas em linguagem livre.',
            'Correção: "NFs sem pedido" passa a incluir as NFs só do ERP (antes só as com XML).'
        ],
        implementado: ['O modo básico não usa internet nem conta: tudo é calculado no próprio app com os dados que ele já carregou.', 'Quando não entende a pergunta, mostra exemplos do que sabe responder.'],
        mudou: ['Arquivos alterados: js/14, js/31 e js/37.'],
        testar: ['Mais → Assistente: tocar nas sugestões e fazer perguntas como as dos exemplos.', 'Conferir 2 ou 3 respostas com as telas (Central do pedido, Relatórios → Divergências, Controle de NFs).', 'Perguntar algo fora do que ele entende e ver as dicas.'],
        testarLinks: []
    },
    {
        numero: '2.13.0', nome: 'Assistente: IA para consultar os dados do app', status: 'concluida',
        novidades: [
            'Nova tela Mais → Assistente: você pergunta em linguagem natural (divergências pendentes, situação de um pedido, quantidade cotada e recebida de um material, NFs de um fornecedor...) e a IA responde em cima dos dados do app.',
            'A IA só lê: ela usa consultas prontas (as mesmas regras da visão única da NF, das divergências e da comparação do pedido), mostra "Consultas feitas" sob cada resposta, nunca calcula nem decide sozinha e não grava nada.',
            'A chave da IA fica num intermediário gratuito (Cloudflare Worker), nunca dentro do app; o intermediário só atende quem está logado e pode ser limitado aos seus e-mails. Passo a passo no arquivo COMO-INSTALAR-O-ASSISTENTE.md.'
        ],
        implementado: ['Só vão para a IA os resultados das consultas que a pergunta pede (no máximo 25 linhas por consulta), nunca o banco inteiro.', 'O app funciona normalmente sem o Assistente: a tela só pede o endereço do intermediário na primeira vez.'],
        mudou: ['Arquivos alterados: index.html, style.css, js/01, js/02, js/14, js/31; novo js/37-assistente.js. Arquivos fora do app: assistente/worker-assistente.js e assistente/COMO-INSTALAR-O-ASSISTENTE.md.'],
        testar: ['Seguir o passo a passo, abrir Mais → Assistente e salvar o endereço.', 'Perguntar: "Quais divergências estão pendentes?" e conferir com Relatórios → Divergências.', 'Perguntar sobre um material (ex.: lanceta) e conferir quantidades e fornecedores.', 'Perguntar a situação de um pedido e conferir com a Central do pedido.'],
        testarLinks: []
    },
    {
        numero: '2.12.4', nome: 'Nomes dos itens pelo ERP e NF associada sempre visível na Central do pedido', status: 'concluida',
        novidades: [
            'Central do pedido: item da cotação sem "nome oficial" (relatório do SmartCompras não colado) agora mostra o nome que o ERP lançou para ele, marcado como "nome lançado no ERP; o oficial vem do relatório do SmartCompras". O nome vem do produto SP Data associado ou do item do ERP que casa com ele por nome, quantidade e preço, nas NFs que você já ligou ao pedido. Só leitura: nada é gravado e nunca passa por oficial.',
            'Correção: NF do ERP associada ao pedido mas ainda "esperando decisão" não aparecia na Central do pedido (o botão seguia como "Associar NF" e não mostrava os itens lançados). Agora toda NF ligada ao pedido aparece, em qualquer situação.'
        ],
        implementado: ['Itens ambíguos (por exemplo, dois sensores iguais com o mesmo preço) continuam sem nome: o app não chuta.', 'Na NF 4694 / pedido 1697, 2 dos 6 itens ganham nome; os outros dependem do relatório do SmartCompras ou de a NF trazer o item.'],
        mudou: ['Arquivos alterados: js/09, js/11, js/14 e js/35.'],
        testar: ['Pedido 1697 → BIO INFINITY: ver os nomes do ERP nos itens ligados e a NF 4694 listada com "Itens lançados".'],
        testarLinks: []
    },
    {
        numero: '2.12.3', nome: 'Central de notificações por pedido ou por fornecedor', status: 'concluida',
        novidades: ['A Central de notificações ganhou três formas de ver: Por urgência (como era), Por pedido e Por fornecedor. Nas duas novas, tudo o que está pendente do mesmo pedido ou do mesmo fornecedor (divergência, NF sem pedido, sugestão, sem recurso...) fica junto num cartão só, do que tem mais pendências para o que tem menos.'],
        implementado: ['Só muda a apresentação: as pendências são as mesmas da visão única da NF.'],
        mudou: ['Arquivos alterados: js/14, js/31 e js/34.'],
        testar: ['Mais → Central de notificações: tocar em "Por pedido" e "Por fornecedor", abrir alguns cartões e tocar num item.'],
        testarLinks: []
    },
    {
        numero: '2.12.2', nome: 'Compra direta com destino e Central de notificações em "Mais"', status: 'concluida',
        novidades: [
            'Fornecedor sem cotação do SmartCompras (como a MINAS SUL): ao marcar "Esta NF não tem cotação (compra direta)" no Editor da NF, aparece "Destino da compra direta" (Santa Casa ou CTI). Com o destino, os botões de recurso C/C e próprio funcionam, e a NF deixa de aparecer como "sem produto da cotação".',
            '"O que precisa de atenção" virou "Central de notificações" e saiu de Ajustes: agora fica na tela Mais (em Ferramentas, com o número de itens ao lado) e, no computador, no menu lateral antes de Ajustes.',
            'A Auditoria Retroativa também saiu de Ajustes e foi para Mais → Ferramentas (e menu lateral no computador).'
        ],
        implementado: ['Compra direta marcada no Editor passa a valer para o recurso dos itens (antes só valia a marca feita na Entrada de NF).'],
        mudou: ['Arquivos alterados: index.html, js/01, js/02, js/14, js/20, js/31, js/34 e js/36.'],
        testar: ['Editor da NF da MINAS SUL 33669: marcar compra direta, escolher o destino e tocar em C/C; conferir que a NF sai de "sem produto da cotação".', 'Tela Mais: ver Central de notificações (com o número) e Auditoria Retroativa em Ferramentas; abrir cada uma e voltar.', 'Ajustes: confirmar que as duas entradas não estão mais lá.'],
        testarLinks: []
    },
    {
        numero: '2.12.0', nome: 'Visão única da NF e aprendizado das associações sem o texto do SmartCompras', status: 'concluida',
        novidades: [
            'Nova "visão única da NF": uma só rotina junta o XML, o lançamento do ERP e a cotação e responde, para qualquer tela, qual é o pedido, o recurso, o destino, os totais (com frete), os itens, se chegou e quais pendências a NF tem. Os dados continuam onde estavam; as telas é que deixam de refazer a conta cada uma do seu jeito.',
            'O painel "O que precisa de atenção" passou a ler as pendências das NFs dessa visão. Consequência: uma NF cujo XML já tem pedido não aparece mais como "pedido sugerido" só porque o lançamento do ERP ficou com a sugestão antiga (de 8 para 5 no último diagnóstico).',
            'Aprendizado mais esperto: ao confirmar ou associar um pedido a uma NF do ERP, o app liga os itens à cotação também por nome + quantidade + preço próximo (até 15%), sem depender do texto do SmartCompras colado nem de preço idêntico. Só liga quando o par é inequívoco dos dois lados; na dúvida deixa para você.',
            'Central do pedido: abaixo de cada NF associada, "Itens lançados" mostra o nome, a quantidade e o valor lançados e a que produto da cotação cada item ficou ligado.',
            'Editor da NF do ERP: quando o recurso já é conhecido pela cotação do pedido, ele aparece como "Vem da cotação do pedido" em vez de ser perguntado; "Mudar só nesta NF" continua disponível.'
        ],
        implementado: ['Conferido contra as suas associações já existentes: dos pares que o app formaria por nome + quantidade + preço, 329 de 330 conferidos coincidem com o que você já tinha associado (o outro é um soro 100 mL, e o app nunca troca associação sua); 17 seriam novos.', 'Exemplo real: na NF 4694 (BIO INFINITY) o app liga o cabo de ECG e a extensão de PNI ao pedido 1697 e deixa os dois sensores de oximetria, que são ambíguos, para você.'],
        mudou: ['Arquivos alterados: index.html, js/11, js/14, js/20, js/31, js/34 e js/35; novo js/36-visao-nf.js.'],
        testar: ['Central do pedido 1697 (BIO INFINITY) → Associar NF 4694: ver a mensagem de associações preenchidas e abrir "Itens lançados".', 'Editor de uma NF do ERP com pedido ligado: o recurso deve aparecer como "Vem da cotação do pedido".', 'Ajustes → O que precisa de atenção: conferir se os números e os itens fazem sentido com o Controle de NFs.'],
        testarLinks: []
    },
    {
        numero: '2.11.6', nome: 'Divergências do painel de atenção iguais às do relatório', status: 'concluida',
        novidades: [
            'Correção: "O que precisa de atenção" contava divergências com uma regra própria e mostrava como pendente o "não faturado" que já chegou (e que você já tinha resolvido). Agora usa a mesma lista e a mesma regra de Relatórios → Divergências, então os números e os itens são sempre os mesmos.',
            'Tocar numa divergência do painel abre o pedido na Central do pedido (antes abria o relatório sem mostrar o item).'
        ],
        implementado: ['No último diagnóstico, painel e relatório passaram a mostrar a mesma quantidade (2).'],
        mudou: ['Arquivos alterados: js/14 e js/34.'],
        testar: ['Ajustes → O que precisa de atenção: conferir se "Divergências pendentes" bate com Relatórios → Divergências (pedido 1726 não deve mais aparecer se já chegou).'],
        testarLinks: []
    },
    {
        numero: '2.11.5', nome: 'Frete certo na comparação, botão que confirma de verdade e aprendizado pelo pedido', status: 'concluida',
        novidades: [
            'Correção: o aviso "valor do XML diferente do ERP" comparava com o "Total da nota" do ERP, que não inclui o frete (como o XML inclui), e dava divergência falsa. Agora compara com o total real do ERP (soma das parcelas, já com o frete). Se sobrar diferença, o aviso ainda tenta explicá-la pelo frete, seguro, outras despesas, IPI ou desconto do XML (e lembra que o SP Data não aceita IPI).',
            'Auditoria Retroativa: ao confirmar um pedido, o cartão fica no lugar com "✓ Confirmado: pedido N" e o botão some (antes o botão continuava lá e dava dúvida).',
            'Novo aprendizado: quando o pedido está confirmado e os itens da NF batem com a cotação (mesma quantidade e valor unitário, casamento único nos dois sentidos e pelo menos 90% do valor), o app associa sozinho o código do fornecedor → produto da cotação e o produto → SP Data. Roda ao confirmar um pedido e, em lote, pelo botão "Aprender N associações dos pedidos confirmados".'
        ],
        implementado: ['Só preenche o que está faltando: nunca troca associação que você já confirmou (divergências são contadas e deixadas como estão).', 'No último diagnóstico o aprendizado acharia 6 associações SP Data novas em 4 NFs e deixaria 8 casos divergentes como estão.'],
        mudou: ['Arquivos alterados: index.html, js/14, js/19, js/31, js/32, js/33 e o novo js/35-aprendizado-pedido.js.'],
        testar: ['Entrada de NF com o XML da DCB (109756): o aviso de valor não deve mais aparecer.', 'Auditoria Retroativa → Pedido sugerido: confirmar uma NF e ver o cartão marcado e o botão sumir.', 'Auditoria Retroativa: tocar em "Aprender N associações" (se aparecer), ler o resumo e confirmar; depois conferir uma associação SP Data nova.'],
        testarLinks: []
    },
    {
        numero: '2.11.4', nome: 'Aviso de valor do XML × ERP com detalhe, atalho e explicação pelo frete', status: 'concluida',
        novidades: [
            'Entrada de NF: o aviso "valor da NF no XML é diferente do lançado no ERP" agora diz de quanto é a diferença (e se o XML está acima ou abaixo), identifica o lançamento do ERP (NF, série, data de lançamento, vencimento e situação) e usa o detalhe do próprio XML (frete, seguro, outras despesas, IPI, ICMS ST e desconto) para explicar a diferença: quando o frete é a causa, o aviso diz isso e passa a ser só informativo, sem alarme.',
            'O aviso ganhou o botão "Abrir lançamento do ERP", que leva direto ao lançamento daquela NF.'
        ],
        implementado: ['Os avisos da entrada agora aceitam um botão de atalho; por enquanto só este aviso usa.'],
        mudou: ['Arquivos alterados: js/10, js/14, js/31 e js/33.'],
        testar: ['Carregar em Entrada de NF um XML cuja NF já esteja lançada no ERP com valor diferente (por exemplo, o da DCB 109756: o frete de R$ 276,39 explica a diferença), ler o aviso e tocar em "Abrir lançamento do ERP".', 'Voltar e conferir se o XML carregado continua na tela.'],
        testarLinks: []
    },
    {
        numero: '2.11.3', nome: 'Conferência das sugestões de pedido e painel "O que precisa de atenção"', status: 'concluida',
        novidades: [
            'Auditoria Retroativa: cada NF com pedido sugerido ganhou "Conferir a sugestão", que mostra na hora o valor total da NF × cotado (com a %), as datas (pedido, limite e NF, em dias) e quantos itens da NF estão na cotação do fornecedor, item por item. O resultado vem resumido: bate em tudo, conferir ou não parece.',
            'Há botões para abrir o pedido sugerido e para confirmar cada candidato; quando há mais de um pedido possível, cada um aparece com a própria conferência.',
            'O botão em lote agora confirma só as sugestões que batem em tudo (valor até 5%, data coerente e pelo menos 60% dos itens). As outras ficam para você conferir.',
            'Novo painel em Ajustes → O que precisa de atenção, com o que está parado, do mais urgente ao menos: notas vencidas na relação, pedidos com prazo vencido sem entrega, divergências pendentes, sugestões de pedido, NFs do ERP esperando decisão, NFs sem pedido, itens sem recurso ou sem produto e fornecedores sem CNPJ. Cada item leva direto à tela que resolve.',
            'No Controle de NFs aparece uma faixa no topo com o total de itens que precisam de atenção.'
        ],
        implementado: ['A conferência só lê dados já salvos: nada é confirmado ou alterado sem o seu toque.', 'No último diagnóstico, das 17 sugestões, 9 batem em tudo, 2 pedem conferência, 3 não parecem certas e 3 têm mais de um candidato.'],
        mudou: ['Arquivos alterados: index.html, style.css, js/01, js/14, js/17, js/29, js/31, js/32 e o novo js/34-atencao.js.'],
        testar: [
            'Ajustes → Auditoria Retroativa → filtro "Pedido sugerido": abrir "Conferir a sugestão" em alguns cartões e comparar com o que você veria na cotação.',
            'Tocar em "Abrir o pedido" e voltar; confirmar uma sugestão que bate.',
            'Tocar em "Confirmar as N que batem em tudo".',
            'Ajustes → O que precisa de atenção: abrir os grupos e tocar em itens.',
            'Controle de NFs: ver a faixa no topo e tocar nela.'
        ],
        testarLinks: []
    },
    {
        numero: '2.11.2', nome: 'Verificações da entrada item a item: valor, quantidade e ERP', status: 'concluida',
        novidades: [
            'Entrada de NF (XML): o quadro "Verificações da entrada" agora confere cada item contra a cotação — valor unitário diferente do cotado (com a diferença em %), quantidade acima da cotada e entrega parcial (somando as NFs do mesmo pedido já processadas).',
            'Quando a NF já está lançada no ERP, o quadro compara a quantidade de cada produto no XML com a lançada no ERP (o caso da lanceta: 1100 no XML × 1000 no ERP aparece na hora).',
            'Produto da NF ligado a um item que não está no pedido escolhido também é avisado.'
        ],
        implementado: ['As contas são as mesmas da conferência do pedido (valor direto ou convertido pelo fator; quantidade direta ou convertida), só que antes de salvar: o aviso de agora é a divergência que apareceria depois.', 'Produtos marcados para ignorar divergência de unidade ficam de fora. Entrega parcial aparece só como informação.', 'Nos dados do último diagnóstico, os avisos de valor coincidem com as divergências de valor que o app já gera (5 e 5).'],
        mudou: ['Arquivos alterados: js/14, js/31, js/33.'],
        testar: [
            'Entrada de NF: carregar o XML da NF 1067970 e ver o aviso da lanceta (XML × ERP).',
            'Carregar uma NF com valor diferente da cotação (por exemplo a 1779878) e ver o aviso de valor com a %.',
            'Carregar uma NF com quantidade acima da cotada (por exemplo a 1787824) e conferir o aviso.'
        ],
        testarLinks: []
    },
    {
        numero: '2.11.1', nome: 'Verificações na entrada: o app avisa na hora o que não fecha', status: 'concluida',
        novidades: [
            'Entrada de NF (XML): um quadro "Verificações da entrada" avisa quando itens diferentes estão ligados ao mesmo produto da cotação, quando o valor do XML difere do lançado no ERP para a mesma NF, quando o fornecedor não participa do pedido escolhido, quando o vencimento é anterior à emissão e quando falta o número ou o valor da NF.',
            'Importação do relatório do ERP: cada nota da prévia ganha avisos quando o valor ou os itens estão zerados, quando a mesma NF já foi processada pelo XML com valor diferente, quando o fornecedor não tem CNPJ no SP Data (o pedido não será achado sozinho) e quando há item com código SP Data fora da lista de produtos.',
            'Os avisos nunca bloqueiam nem alteram nada: só mostram o que pede conferência.'
        ],
        implementado: ['Vencimento anterior ao lançamento no ERP não gera aviso: nota lançada com atraso é normal.', 'No último diagnóstico, os avisos de XML apontam 6 casos reais (2 de produto repetido, incluindo a NF 813145, e 4 de valor diferente do ERP).'],
        mudou: ['Arquivos alterados: index.html, style.css, js/10, js/14, js/19, js/31 e o novo js/33-verificacoes-entrada.js.'],
        testar: [
            'Entrada de NF: carregar o XML de uma NF e ver o quadro "Verificações da entrada" (quando houver algo a avisar).',
            'Importar Relatório (ERP): colar um relatório e ver os avisos nas notas da prévia.',
            'Conferir que nada fica bloqueado: os avisos só informam.'
        ],
        testarLinks: []
    },
    {
        numero: '2.11.0', nome: 'Auditoria Retroativa das NFs do ERP e itens do ERP sempre atualizados', status: 'concluida',
        novidades: [
            'Nova tela em Ajustes → Auditoria Retroativa: mostra, por NF do ERP, o pedido (confirmado, sugerido ou sem pedido, com o motivo) e quais itens estão ligados a um produto da cotação.',
            'Itens do ERP defasados (que ganharam produto depois de uma associação SP Data nova) passam a ser atualizados sozinhos, sem precisar reimportar.',
            'Botões para atualizar os itens defasados e para confirmar de uma vez as sugestões de pedido.',
            'Filtros: pedido sugerido, sem pedido, itens sem produto e itens defasados.'
        ],
        implementado: ['A atualização automática só preenche ou corrige para um produto existente; nunca apaga um código, e não roda enquanto os dados ainda estão carregando.', 'Nenhuma regra de associação, vínculo ou divergência mudou. A tela só lê os dados já salvos.'],
        mudou: ['Arquivos alterados: index.html, style.css, js/01, js/05, js/14, js/17, js/29, js/31 e o novo js/32-auditoria-retroativa.js.'],
        testar: [
            'Ajustes → Auditoria Retroativa: ver o resumo e os cartões; testar os filtros e "Ver itens".',
            'Tocar em "Atualizar itens defasados" (deve haver 13 no último diagnóstico).',
            'Confirmar uma sugestão de pedido pelo cartão e, se quiser, as demais em lote.',
            'Pelo Ajustes, buscar "retroativa" e conferir que a tela aparece.'
        ],
        testarLinks: []
    },
    {
        numero: '2.10.8', nome: 'Dados da NF também com XML, toda a cotação como entregue e aviso de produto repetido', status: 'concluida',
        novidades: [
            'Editor da NF (com XML): novo cartão "Dados desta NF" com nome do fornecedor, recurso da NF inteira e a opção "Esta NF não tem cotação (compra direta)".',
            'Pedido: botão "Marcar toda a cotação como entregue" marca todos os fornecedores de uma vez; depois vira "Desfazer marcas de entrega de todos".',
            'Editor da NF: aviso quando itens diferentes da mesma NF estão associados ao mesmo produto da cotação (a quantidade é somada e gera divergência falsa, como a LANCETA 28G da NF 1067970).',
            'Corrigido o espaçamento da caixa de seleção "não tem pedido" no Editor da NF.'
        ],
        implementado: ['Marcar compra direta tira o pedido da NF (com confirmação). Desmarcar só remove a marca.', 'O recurso da NF inteira grava na cotação (itens com cotação) e na própria NF (itens diretos), usando a origem do pedido.'],
        mudou: ['Arquivos alterados: style.css, js/09, js/11, js/14, js/17, js/20, js/31.'],
        testar: [
            'Editor da NF com XML: editar nome, escolher o recurso e marcar/desmarcar compra direta.',
            'Editor da NF da NF 1067970: ver o aviso do código repetido (lanceta + nifedipino).',
            'Pedido: tocar em "Marcar toda a cotação como entregue" e depois em desfazer.',
            'Editor da NF só do ERP: conferir o espaçamento da caixa "não tem pedido".'
        ],
        testarLinks: []
    },
    {
        numero: '2.10.7', nome: 'Fornecedor ERP reconhecido certo, Editor da NF só-ERP, divergência que sai da pendência e exclusão', status: 'concluida',
        novidades: [
            'Fornecedor do ERP: uma palavra genérica (como "artefatos") no meio do nome não identifica mais um fornecedor conhecido. "ACRILZANO ARTEFATOS DE ACRILIC" deixa de virar "artefatos".',
            'Editor da NF (NF só do ERP): novo cartão "Dados desta NF" para editar o nome do fornecedor (fica lembrado nas próximas importações), definir o recurso e marcar "não tem pedido".',
            'Relatórios: divergência "não faturado" sai da pendência quando o item chegou (marcado como já chegou, NF do app ou NF do ERP associada ao pedido).',
            'Associar NF no pedido: ao digitar o número, a busca vale para todos os fornecedores (entrega por outro CNPJ).',
            'Relatórios: botão Excluir em cada divergência, inclusive as antigas sem produto da cotação.'
        ],
        implementado: ['Campos novos na entrada do ERP: nome editado, recurso e "sem pedido". O Controle de NFs usa esses dados e o envio à relação aproveita o recurso.', 'Excluir remove também os registros repetidos da mesma divergência; o texto já gerado na anotação não muda.'],
        mudou: ['Arquivos alterados: js/04, js/08, js/11, js/14, js/17, js/20, js/31.'],
        testar: [
            'Reimportar (ou conferir) a NF da ACRILZANO: o nome não deve virar "artefatos".',
            'Controle de NFs → Editar NF de uma NF só do ERP: editar o nome, escolher o recurso, marcar "não tem pedido".',
            'Relatórios → Divergências: a "sonda gastrostomia 20FR" não deve mais aparecer pendente.',
            'Pedido → Associar NF: digitar o número de uma NF de outro CNPJ e associar.',
            'Relatórios → Divergências: excluir a pendência do Tidimar (?).'
        ],
        testarLinks: []
    },
    {
        numero: '2.10.6', nome: 'Ajuda com transição e gesto, Cotações enxuta e botão Selecionar padronizado', status: 'concluida',
        novidades: [
            'Ajuda: abrir um artigo e voltar para a lista agora têm transição (no computador, a dissolução curta do modo web), e o gesto de arrastar da borda esquerda volta do artigo para a lista.',
            'Tutorial guiado: o botão Sair virou um botão compacto no canto, dentro do layout.',
            'Cotações: sobraram dois botões, "Adicionar cotação (XML)" e "Complementar com relatório". O campo do relatório de fornecedores ganhadores fica escondido e abre pelo botão. Saiu "Nova Cotação", que não fazia sentido sem o XML.',
            'Pedido sem cotação: o botão agora é "Adicionar cotação (XML)".',
            'Controle de NFs: o botão Selecionar passou para o mesmo padrão do de Anotações (botão com ícone).'
        ],
        implementado: ['O cadastro manual de cotação continua no código, mas sem botão na tela.', 'O botão Selecionar não troca mais o texto para "Concluir": como em Anotações, só muda o estado.'],
        mudou: ['Arquivos alterados: index.html, style.css, js/14, js/15, js/17, js/31.'],
        testar: [
            'Ajuda: abrir um artigo, ver a transição, voltar pelo botão e pelo gesto da borda esquerda.',
            'Iniciar um tutorial e conferir o botão Sair.',
            'Cotações: conferir os dois botões; abrir e fechar "Complementar com relatório"; adicionar uma cotação pelo XML.',
            'Controle de NFs: conferir o botão Selecionar e o modo de seleção.'
        ],
        testarLinks: []
    },
    {
        numero: '2.10.5', nome: 'Relatórios: divergência leva ao produto, registros antigos e destaque suave', status: 'concluida',
        novidades: [
            'Relatórios → Divergências: tocar no cartão abre o pedido já no fornecedor e no produto da divergência (antes abria a cotação inteira).',
            'Destaque mais suave: em vez do brilho amarelo em volta, um tom de amarelo dentro do cartão que dissolve de volta ao normal.',
            'Registros antigos de auditoria agora mostram o produto. Antes eles eram lidos num formato que o relatório não entendia: três divergências diferentes do pedido 1698 (Fentanest, Agulha e Seringa) apareciam idênticas, sem produto.',
            'Divergência antiga sem situação gravada deixou de ficar "Pendente" para sempre: anotação concluída = Resolvida; item marcado como resolvido na cotação = Resolvida.',
            'A mesma divergência registrada mais de uma vez (mesmo pedido, tipo e produto, como antes, uma por etapa) aparece como uma só, com "N registros", valendo a mais recente.'
        ],
        implementado: [
            'Divergências de tipos que não existem mais (ex.: quantidade física divergente) passam a mostrar produto e quantidades gravadas.',
            'Os dados guardados não foram alterados: a correção é só na leitura.'
        ],
        mudou: ['Arquivos alterados: style.css, js/04, js/09, js/11, js/14, js/30, js/31.'],
        testar: [
            'Relatórios → Divergências: conferir o pedido 1698 (três cartões distintos, agora Resolvida) e tocar num cartão para ir ao fornecedor/produto.',
            'Ver o destaque suave dentro do cartão.',
            'Procurar se sobrou alguma pendência antiga que não deveria estar pendente e me avisar.'
        ],
        testarLinks: []
    },
    {
        numero: '2.10.4', nome: 'Ajuda: artigo de Backup completo', status: 'concluida',
        novidades: ['O artigo de Backup da Ajuda agora explica os dois botões: o backup simples (cópia de segurança) e a exportação completa para diagnóstico, e o motivo de ela existir.'],
        implementado: ['Corrigido o texto anterior, que falava em restaurar: o app só gera os arquivos, não restaura.'],
        mudou: ['Só texto de ajuda. Arquivos alterados: js/14 e js/31.'],
        testar: ['Ajustes → Ajuda → Backup dos dados: ler o artigo e conferir se bate com a tela.'],
        testarLinks: []
    },
    {
        numero: '2.10.3', nome: 'Voltar da Ajuda, menu do computador e Auditoria personalizável', status: 'concluida',
        novidades: [
            'Ajuda: removido o segundo botão "Todos os artigos". O botão Voltar do topo sobe um nível por vez: do artigo para a lista da Ajuda e, na lista, para Ajustes.',
            'Computador: não existe mais a divisão "Na barra / Em Mais". Todas as abas ficam juntas no menu, na ordem escolhida (a tela de organizar abas esconde essa opção no computador), e Importar Relatório (ERP) fica antes do Ajustes.',
            'Auditoria sem nomes próprios: o Destinatário do E-mail começa em branco (a saudação sai sem nome) e há um "Destinatário padrão" opcional em Configurar Textos Padrão.',
            'Auditoria: cada tipo de divergência tem agora um modelo de frase editável em Configurar Textos Padrão. {campo} entra com o valor digitado e [[ trecho ]] só aparece se os campos dentro dele estiverem preenchidos. "Restaurar este modelo" volta ao padrão de um tipo.',
            'Auditoria: o produto fica ligado ao item da cotação por um vínculo próprio. Renomear o texto não perde o vínculo; aparece "Ligado ao item… com o nome real", "usar este nome" e "desligar". Produto sem ligação ganha um seletor para ligar a um item da cotação.',
            'Nome real do produto: agora vem do SP Data, depois do nome oficial do SmartCompras, depois do nome na NF processada (xProd) e só então da observação do SmartCompras.'
        ],
        implementado: [
            'O vínculo é salvo junto da auditoria e passa a ser usado para ligar a divergência ao item certo no pedido (antes só pelo nome).',
            'Os textos gerados continuam iguais aos de antes enquanto você não editar os modelos.'
        ],
        mudou: [
            'Arquivos alterados: index.html, style.css, js/01, js/02, js/06, js/09, js/11, js/12, js/13, js/14, js/16, js/28, js/30, js/31.'
        ],
        testar: [
            'Ajuda: abrir um artigo e tocar no Voltar do topo (vai para a lista) e de novo (vai para Ajustes).',
            'Computador: conferir o menu lateral com todas as abas juntas e Ajustes–Personalização–Ordem dos menus sem "Na barra/Em Mais".',
            'Nova Auditoria: conferir o Destinatário em branco; gerar o e-mail com e sem nome.',
            'Configurar Textos Padrão: editar o modelo de um tipo, gerar a auditoria e ver a frase nova; testar "restaurar este modelo".',
            'Escolher um produto da cotação, renomear o texto e conferir que continua "Ligado ao item"; testar um produto sem ligação.'
        ],
        testarLinks: []
    },
    {
        numero: '2.10.2', nome: 'Ajuda: mais dois tutoriais guiados', status: 'concluida',
        novidades: [
            'Dois tutoriais novos com dados de exemplo: "Registrar uma auditoria" (dados, tipo de divergência, material, gerar e salvar como anotação) e "Importar o relatório do ERP" (colar, revisar, aplicar recurso às marcadas e confirmar).',
            'A lista da Ajuda agora mostra todos os tutoriais no topo; os artigos de Nova Auditoria e Importar relatório do ERP têm botão para o tutorial.'
        ],
        implementado: ['Como antes, nada do tutorial é gravado: é uma janela de demonstração.'],
        mudou: ['Só conteúdo de ajuda; o funcionamento do app não mudou.', 'Arquivos alterados: style.css, js/14 e js/31.'],
        testar: ['Ajustes → Ajuda: rodar os três tutoriais até o fim, tocando nos botões destacados.', 'Conferir se os passos batem com o app real e me dizer o que ajustar.'],
        testarLinks: []
    },
    {
        numero: '2.10.1', nome: 'Ajuda do app (etapa 2): todas as funções', status: 'concluida',
        novidades: [
            'A Ajuda agora cobre o app inteiro, com 25 artigos: além dos anteriores, Importar relatório do ERP, Editor da NF, Pedido (Central do Pedido), Relatórios, Anotações, Nova Auditoria, Equipamentos, Produtos SP Data, cadastro de Fornecedores, Análise de Cotações, Observações, Conta e acesso, Histórico de mudanças e Toques/Voltar ao ponto exato.',
            'Nova categoria Equipamentos.'
        ],
        implementado: [
            'Cada artigo novo traz passos, dicas, botão para abrir a tela e o selo "Revisado na versão 2.10.1".',
            'Continua valendo a regra: mudou um procedimento, a Ajuda é atualizada na mesma entrega.'
        ],
        mudou: [
            'Só conteúdo de ajuda; o funcionamento do app não mudou.',
            'Arquivos alterados: js/14 e js/31.'
        ],
        testar: [
            'Ajustes → Ajuda: ler os artigos novos (Equipamentos, Importar relatório do ERP, Nova Auditoria) e dizer o que não bate com o seu uso.',
            'Testar a busca com palavras como "recurso", "extravio" e "senha".'
        ],
        testarLinks: []
    },
    {
        numero: '2.10.0', nome: 'Ajuda do app (etapa 1): artigos e tutorial guiado', status: 'concluida',
        novidades: [
            'Novo item Ajuda em Ajustes, com busca e artigos "como fazer" por categoria. Primeira etapa: abas do app, Adicionar, Entrada de NF (XML), Gerenciar, Saída de Texto, Controle de NFs, Recurso, Cotações, Fornecedores, Backup e Personalização/modo web.',
            'Tutorial guiado "Da NF em XML até a Saída de Texto": percorre o caminho completo com dados de exemplo; você toca nos botões para ver o efeito. Nada é gravado.',
            'Cada artigo mostra "Revisado na versão X" e tem botão para abrir a tela correspondente.'
        ],
        implementado: [
            'Regra de manutenção: toda entrega que mudar um procedimento atualiza o artigo da Ajuda (e a versão de revisão) e registra aqui.',
            'As próximas etapas completam os artigos das demais funções (Equipamentos, Anotações/Auditoria, Importação do ERP, Relatórios etc.).'
        ],
        mudou: [
            'Só acréscimo; nada do que existia mudou.',
            'Arquivos alterados: index.html, style.css, js/01, js/14, js/29 e js/31 (novo).'
        ],
        testar: [
            'Ajustes → Ajuda: conferir a lista, a busca e abrir alguns artigos (botão "Abrir" e Voltar).',
            'Iniciar o tutorial guiado, tocar nos botões de recurso e de salvar e ir até o fim.',
            'Conferir se os textos batem com o jeito que você usa o app e me dizer o que ajustar.'
        ],
        testarLinks: []
    },
    {
        numero: '2.9.10', nome: 'Modo web com movimento no estilo macOS', status: 'concluida',
        novidades: [
            'No computador (mouse + tela larga) o app entra em "modo web" sozinho: a dock deixa de encolher, as telas não deslizam mais como no iPhone e a cascata dos itens some.',
            'Movimento estilo macOS: a tela nova só dissolve (com um recuo mínimo de 6 px), em cerca de 180 ms, sem mola; a tela antiga sai na hora por baixo. Janelas (modais) dissolvem com um leve zoom de 0,97 para 1 em ~160 ms.',
            'Reação ao mouse: cartões, itens, botões e abas mudam de cor/sombra em ~120 ms ao passar o ponteiro.'
        ],
        implementado: [
            'No iPhone/iPad nada muda: continua o movimento atual.',
            'Para testar no celular como se fosse computador, abra o endereço com ?plataforma=web (e ?plataforma=aparelho para voltar).',
            'Respeita "Reduzir movimento" do sistema e a opção "sem animação" de Personalização.'
        ],
        mudou: [
            'Só movimento e visual; dados e regras não mudaram.',
            'Arquivos alterados: style.css, js/14, js/22, js/28, js/30.'
        ],
        testar: [
            'No computador: trocar de aba e abrir/voltar telas internas e ver a dissolução curta; abrir uma janela (modal); passar o mouse nos cartões.',
            'No iPhone: conferir que continua igual (dock encolhe, telas deslizam).',
            'Opcional: no iPhone, abrir com ?plataforma=web para ver o modo web.'
        ],
        testarLinks: []
    },
    {
        numero: '2.9.9', nome: 'Recurso da NF inteira e ligação com a Saída de Texto', status: 'concluida',
        novidades: [
            'Entrada de NF: novo quadro "Recurso da NF inteira" acima dos itens, com um botão para C/C e outro para Recurso Próprio. Um toque aplica o recurso a todos os itens que têm base (cotação com Origem ou destino definido); o quadro também diz como estão os itens (todos iguais, diferentes ou sem recurso).',
            'Saída de Texto: corrigida a ligação que às vezes não reconhecia o recurso. A importação do ERP e o Controle de NFs comparavam o número da NF como texto literal (000123 ≠ 123) e ignoravam o CNPJ; agora comparam normalizado e priorizam o fornecedor certo.'
        ],
        implementado: [
            'Se o item da NF já salva está em outro recurso, o botão da NF inteira também grava na hora (cotação ou NF direta), igual ao botão individual.',
            'Itens sem base (sem Origem na cotação ou sem destino) não são tocados e o aviso informa quantos ficaram de fora.',
            'Continua sem adivinhar: se a NF tem mais de um recurso, ou duas NFs com o mesmo número discordam, o campo Recurso fica em branco para decisão manual.'
        ],
        mudou: [
            'Antes só dava para definir o recurso item por item.',
            'Arquivos alterados: style.css, js/10, js/12, js/14, js/16, js/17.'
        ],
        testar: [
            'Entrada de NF: carregar um XML com vários itens associados, usar "Recurso da NF inteira" e conferir que todos os itens mudam; salvar a NF.',
            'Importar o relatório ERP de uma NF com zeros à esquerda e conferir se o Recurso já vem preenchido.',
            'Gerenciar NF / Saída de Texto: conferir que a nota sai com o recurso.'
        ],
        testarLinks: []
    },
    {
        numero: '2.9.8', nome: 'Cartões da lista de Cotações no padrão novo', status: 'concluida',
        novidades: [
            'Lista de Cotações: cada pedido agora é um cartão no padrão do app — iniciais da origem, número do pedido, origem, status (Aguardando, Em andamento, Completo ou N divergências), três quadros (Fornecedores, Limite, Itens) e uma faixa com o resumo da entrega. O limite vencido aparece em vermelho.',
            'Resultado da busca por produto: o item encontrado também usa o cartão (produto, pedido, origem, quantidade, valor unitário, código e fornecedor).'
        ],
        implementado: [
            'Sem botões, como combinado: tocar no cartão abre o pedido.'
        ],
        mudou: [
            'Só visual; dados e regras não mudaram.',
            'Arquivos alterados: style.css, js/13, js/14.'
        ],
        testar: [
            'Cotações: conferir os cartões da lista (status, quadros, faixa) e tocar em um para abrir o pedido.',
            'Buscar por um produto e conferir o cartão do resultado.'
        ],
        testarLinks: []
    },
    {
        numero: '2.9.7', nome: 'Voltar ao ponto exato e toques que levam direto ao alvo', status: 'concluida',
        novidades: [
            'Voltar ao ponto exato: quando você sai de uma tela por um link dentro do app (Editor da NF → Pedido, Pedido → NF, Controle → Editor etc.), o Voltar (botão e gesto) leva de volta para exatamente onde você estava: a mesma NF aberta, o mesmo pedido, as mesmas seções abertas e a mesma posição da tela. Pode encadear vários saltos e voltar um por um. Trocar de aba pela barra zera esse caminho.',
            'Destaque do alvo, como o "achar na página" da Apple: ao chegar por um toque, a tela rola até o ponto certo e ele pisca em amarelo por alguns segundos.',
            'Toques que levam direto ao lugar de resolver: no Controle de NFs, o selo "N pendências" e cada pendência do texto abaixo (sem vínculo com o ERP → Editor da NF na aba Financeiro; sem XML processado → Editor da NF; em espera / já existe na relação → Gerenciar NF); no Gerenciar NF, o selo de aptidão (Conferida, Divergência...) e o número do pedido abrem o pedido no fornecedor e no item com divergência; no pedido, o selo "Com pendência" e o quadro Divergências do fornecedor abrem o item com divergência.'
        ],
        implementado: [
            'Itens tocáveis ganham uma seta (›) ou sublinhado pontilhado para você saber que levam a algum lugar.',
            '"Ver no Gerenciar NF" também destaca a nota encontrada.'
        ],
        mudou: [
            'Antes o Voltar ia sempre para a tela-pai fixa (por exemplo, do Pedido para a lista de Cotações), mesmo vindo do Editor de uma NF.',
            'Arquivos alterados: index.html, style.css, js/01, 05, 06, 08, 09, 14, 17, 20, 28 e o novo js/30-navegacao.js.'
        ],
        testar: [
            'Abra uma NF no Editor, toque em "Abrir pedido", depois em Voltar: deve voltar para a mesma NF (e Voltar de novo leva ao Controle).',
            'No Controle de NFs, toque no selo vermelho de pendências e no texto da pendência: deve abrir o Editor da NF no ponto certo, com destaque amarelo.',
            'No Gerenciar NF, toque no selo de aptidão e no número do pedido; no pedido, toque em "Com pendência" ou em Divergências.',
            'Troque de aba pela barra e confira que o Voltar volta a ser o de sempre.'
        ],
        testarLinks: []
    },
    {
        numero: '2.9.6', nome: 'Desvincular fornecedor, vínculo automático na importação e ajustes de layout', status: 'concluida',
        novidades: [
            'Fornecedores: botão "Desvincular este CNPJ" nos fornecedores com mais de um CNPJ vinculado. Tira só aquele cadastro do grupo, com confirmação; nenhum CNPJ é apagado.',
            'Importação do relatório oficial de fornecedores: cadastro NOVO com a mesma raiz de CNPJ (8 primeiros dígitos) de outro já cadastrado é vinculado automaticamente, e o aviso da importação informa quantos vínculos foram feitos. Cadastros já existentes não são mexidos.',
            'Gerenciar NF: o selo de aptidão ficou curto (por exemplo "✓ Conferida") em vez de um texto de até 3 linhas em letras minúsculas; o texto completo continua ao manter o toque no selo.'
        ],
        implementado: [
            'Revisão de layout das telas alteradas (Controle de NFs, Gerenciar NF, pedido em Cotações, Fornecedores e Histórico de mudanças) em tela larga e estreita (390 e 320 px), em tema claro e escuro: sem rolagem lateral nem texto cortado.',
            'Removida a tela antiga "Histórico" (já sem uso desde o 2.9.0); as funções que o Controle de NFs ainda usa foram mantidas.'
        ],
        mudou: [
            'Só visual e de vínculo de fornecedores; NFs e notas não mudaram.',
            'Arquivos alterados: index.html, style.css, js/05, js/14, js/18.'
        ],
        testar: [
            'Fornecedores: abrir um fornecedor com mais de um CNPJ vinculado, tocar em "Desvincular este CNPJ" e confirmar; conferir que ele passa a aparecer separado.',
            'Gerenciar NF: conferir o selo curto no cartão.',
            'Importação de fornecedores: se houver cadastro novo com a mesma raiz de CNPJ de um existente, conferir o aviso de vínculo automático.'
        ],
        testarLinks: []
    },
    {
        numero: '2.9.5', nome: 'Vincular fornecedores com busca e sugestões, e vínculo automático por XML', status: 'concluida',
        novidades: [
            'Fornecedores > Vincular: no lugar da lista com todos os fornecedores, agora há um campo de busca por nome (qualquer parte) ou CNPJ. Ao tocar no campo aparecem só sugestões: fornecedores com o mesmo CNPJ base (matriz/filial) e com nome parecido.',
            'Ao escolher um fornecedor, o app pede confirmação antes de vincular. O mesmo vale para vincular um cadastro simples (sem CNPJ) a um fornecedor cadastrado.',
            'Entrada de NF por XML: quando o CNPJ do emitente é novo e já existe um fornecedor cadastrado com a mesma raiz de CNPJ (8 primeiros dígitos, ou seja, a mesma empresa), o novo CNPJ é vinculado automaticamente a ele e passa a usar o mesmo apelido.'
        ],
        implementado: [
            'A parecença de nome ignora palavras comuns (LTDA, ME, COMERCIAL, DISTRIBUIDORA etc.) para sugerir pelo nome de verdade.',
            'O vínculo automático só acontece pela raiz do CNPJ, que é um dado certo; nome parecido só gera sugestão, nunca vínculo automático.'
        ],
        mudou: [
            'Antes: lista única com todos os fornecedores e nenhum vínculo automático.',
            'Arquivos alterados: js/14, js/18.'
        ],
        testar: [
            'Fornecedores: abrir um fornecedor, tocar em Vincular e conferir as sugestões; digitar parte do nome ou do CNPJ e escolher um resultado (confirmar).',
            'Subir um XML de uma filial nova (mesma raiz de CNPJ de um fornecedor já cadastrado) e conferir o aviso de vínculo automático e o apelido herdado.'
        ],
        testarLinks: []
    },
    {
        numero: '2.9.4', nome: 'O apelido do fornecedor vale para todos os CNPJs associados', status: 'concluida',
        novidades: [
            'Quando você cria um apelido (nome de exibição) para um CNPJ, ele passa a valer em todo o app para todos os CNPJs associados a ele como o mesmo fornecedor (matriz, filial, CD), inclusive os associados depois.',
            'Em Fornecedores, o campo "Nome no app" dos CNPJs que herdam o apelido mostra "(do grupo)".'
        ],
        implementado: [
            'Regra de prioridade: apelido editado à mão neste CNPJ, depois apelido editado à mão em outro CNPJ do grupo, depois o nome de exibição do relatório deste CNPJ, depois o de outro CNPJ do grupo. Sem apelido em nenhum, usa a razão social.',
            'Nada foi gravado nem alterado nos cadastros: a regra só muda como o nome é exibido, então vale também para o que já estava associado.'
        ],
        mudou: [
            'Antes o apelido só valia para o CNPJ em que foi criado; os associados apareciam com a razão social.',
            'Arquivos alterados: js/14, js/18.'
        ],
        testar: [
            'Em Fornecedores, escolha um fornecedor com mais de um CNPJ associado e crie ou edite o apelido em um deles; confira que o outro mostra o mesmo nome (do grupo) e que o título das NFs e das cotações também usa o apelido.',
            'Associe um CNPJ novo, sem apelido, a um fornecedor que já tem apelido e confira que ele passa a usar o mesmo apelido.'
        ],
        testarLinks: []
    },
    {
        numero: '2.9.3', nome: 'Cartão do fornecedor em Cotações: fechado só com cabeçalho e ações', status: 'concluida',
        novidades: [
            'Cotações por fornecedor: fechado, o cartão mostra só o cabeçalho (iniciais, nome, CNPJ, status) e a barra de ações com ícone (Abrir NF, Associar NF, Marcar como já chegou / parcial resolvida / Desfazer marca manual), todas lado a lado quando cabem.',
            'A faixa de entrega e os três quadros Itens / Valor cotado / Divergências passaram para o topo da parte que expande, acima da lista de itens.',
            'A informação de entrega deixou de aparecer duas vezes: ficou só o status do cabeçalho e a faixa (como foi calculado).'
        ],
        implementado: [
            '"Associar outra NF do histórico" virou "Associar outra NF" (ou "Associar NF" quando ainda não há nenhuma).',
            'O painel de busca de NF para associar continua abrindo logo abaixo da barra de ações.'
        ],
        mudou: [
            'Só visual; dados e regras não mudaram.',
            'Arquivos alterados: style.css, js/09, js/11, js/14.'
        ],
        testar: [
            'Cotações > abrir um pedido: conferir o cartão fechado (cabeçalho + ações) e tocar nele para ver faixa, quadros e itens.',
            'Testar Abrir NF, Associar NF (abre a busca), Marcar como já chegou / parcial resolvida e Desfazer marca manual.'
        ],
        testarLinks: []
    },
    {
        numero: '2.9.2', nome: 'Linha duplicada nas cotações e cartões de Fornecedores mais enxutos', status: 'concluida',
        novidades: [
            'Cotações por fornecedor: removida a linha duplicada que aparecia entre Itens/Valor cotado/Divergências e a área de ações.',
            'Fornecedores: cada fornecedor agora é um cartão compacto (iniciais, nome, CNPJ principal e, se houver, "+N" CNPJs e a marca "Bloqueado"). Ao tocar, abre com a animação de sempre e mostra Bloquear do financeiro, Nome no app (Editar), CNPJs e Vincular.'
        ],
        implementado: [
            'Todos os cartões de Fornecedores começam recolhidos; o cartão em edição permanece aberto.',
            'Cadastros simples (sem CNPJ) usam o mesmo cartão, com a marca "Sem CNPJ".'
        ],
        mudou: [
            'Só visual; dados e regras não mudaram.',
            'Arquivos alterados: style.css, js/14, js/18.'
        ],
        testar: [
            'Cotações > abrir um pedido: conferir que existe uma única linha entre os dados do fornecedor e as ações.',
            'Fornecedores: conferir a lista, abrir um cartão, testar Editar nome, Bloquear/Desbloquear e Vincular; testar a busca.'
        ],
        testarLinks: []
    },
    {
        numero: '2.9.1', nome: 'Gerenciar NF e Cotações por fornecedor no novo padrão de cartão', status: 'concluida',
        novidades: [
            'Gerenciar NF: cada nota agora usa o mesmo cartão do Controle de NFs — iniciais do fornecedor, título "APELIDO 1234", status (Na relação / Em espera), vencimento, prazo, pedido, valor e aptidão para a saída — com as ações Editar, Em espera (ou Retomar), Arquivar e Excluir com nome completo.',
            'Cotações por fornecedor (Central do Pedido): o mesmo cartão, com iniciais, nome, CNPJ, status, itens, valor cotado e divergências; o aviso de pendência aparece em uma faixa e as ações continuam logo abaixo.'
        ],
        implementado: [
            'O recolher e expandir dos itens do fornecedor continua com a animação que já existia.',
            'O painel de edição do Gerenciar NF, a seleção em lote, a busca e o "Aplicar recurso sugerido" continuam funcionando como antes.'
        ],
        mudou: [
            'Só visual; dados e regras não mudaram.',
            'Arquivos alterados: style.css, js/05, js/09, js/14, js/17.'
        ],
        testar: [
            'Gerenciar NF: conferir o cartão novo e testar Editar (abre o painel), Em espera/Retomar, Arquivar e Excluir; testar também a seleção em lote.',
            'Cotações > abrir um pedido: conferir o cartão de cada fornecedor e tocar nele para recolher/expandir os itens.'
        ],
        testarLinks: []
    },
    {
        numero: '2.9.0', nome: 'Controle de NFs unido ao Histórico, com cartão novo e "Enviada ao financeiro" por NF', status: 'concluida',
        novidades: [
            'O Histórico de NFs foi unido ao Controle de NFs: uma tela só, com Em aberto e Arquivadas, separadas por mês. Só o mês atual abre sozinho; os outros ficam recolhidos e abrem com a animação de sempre.',
            'A aba "Diretas" saiu. As NFs diretas ficam em Arquivadas com a etiqueta "Direta".',
            'Novo botão em cada NF: "Enviada ao financeiro". Arquiva só aquela NF, sem passar pela relação; se ela estiver na relação, só ela sai, e as demais continuam sendo editadas.',
            'Cartão novo da NF (iniciais do fornecedor, status, datas, valor, pendências e ações com nome completo): Enviada ao financeiro, Não vai ao financeiro, Enviar à relação e Editar NF.',
            'Na seleção em massa os botões agora têm nome completo: "Enviada ao financeiro" e "Não vai ao financeiro".'
        ],
        implementado: [
            'Arquivadas mostra o botão "Voltar para Em aberto" quando a NF pode voltar (marcada pelo Controle, marcada como direta, ou arquivada pelo ERP, com confirmação).',
            'A busca do Controle acha pelo "APELIDO 1234", nome, número, pedido ou CNPJ e abre todos os meses.',
            'O item "Histórico" saiu do menu e da Personalização; qualquer link antigo para ele abre o Controle de NFs já buscando a NF. O botão do Editor virou "Ver no Controle de NFs".',
            'O botão "Limpar registros simples arquivados (legado)" fica no fim de Arquivadas.'
        ],
        mudou: [
            'Dados: duas marcas novas e opcionais — "arquivadoPeloControle" na entrada do ERP e "enviadoFinanceiro" na NF só-XML. Nada existente é alterado.',
            'Arquivos alterados: index.html, style.css, js/01, js/05, js/14, js/17, js/20.'
        ],
        testar: [
            'Controle de NFs: só o mês atual aberto; tocar nos outros meses abre e fecha com animação.',
            'Em uma NF Recebida, tocar em "Enviada ao financeiro" e confirmar: ela vai para Arquivadas. Depois "Voltar para Em aberto".',
            'Em uma NF que está na relação: "Enviada ao financeiro" tira só ela da relação (confira no Gerenciar NF que as outras continuam).',
            'Selecionar: marcar várias NFs e conferir os botões "Enviada ao financeiro" e "Não vai ao financeiro".',
            'Conferir que "Histórico" sumiu do menu e que "Ver no Controle de NFs" no Editor abre a NF certa.'
        ],
        testarLinks: []
    },
    {
        numero: '2.8.0', nome: 'Título "APELIDO 1234" e Editor da NF mais organizado', status: 'concluida',
        novidades: [
            'Padrão novo em todo o app: NFs aparecem como "APELIDO + NÚMERO DA NF" (ex.: BMG 30922); sem apelido, usa o nome completo do fornecedor.',
            'Editor da NF: o título da tela e o cabeçalho trazem o fornecedor, com a hierarquia fornecedor+NF em destaque, série e CNPJ logo abaixo e o nome completo só quando difere do apelido.'
        ],
        implementado: [
            'Nova função tituloFornNf (js/14) usada no Editor da NF, no Controle de NFs, no Histórico e na Conferência automática.',
            'Quadro cinza (Emissão, 1º vencimento, Pedido) com rótulo e valor centralizados.',
            'Espaçamento de 12 px entre os blocos do Editor; botões do cabeçalho em grade com largura igual.',
            'Abas (Itens, Financeiro, Fiscal…) em uma única linha, rolando na horizontal quando não cabem.'
        ],
        mudou: [
            'Textos e visual; dados e regras não mudaram.',
            'Arquivos alterados: style.css, js/14, js/17, js/20, js/23.'
        ],
        testar: [
            'Abrir uma NF no Editor: título da tela "FORNECEDOR 1234", cabeçalho com hierarquia, quadro cinza centralizado, blocos espaçados e abas em uma linha.',
            'Conferir o Controle de NFs e o Histórico: cada NF aparece como "APELIDO 1234".'
        ],
        testarLinks: []
    },
    {
        numero: '2.7.4', nome: 'Dock: abas de largura fixa (corrige toque e animação ao recolher)', status: 'concluida',
        novidades: [
            'Corrigido: ao recolher a Dock, as abas não se recentralizam mais, o toque no canto abre a aba certa e o seletor não "pula" para outra aba.'
        ],
        implementado: [
            'Todas as abas têm a mesma largura (60 px) com a Dock aberta ou recolhida, então nada é remedido durante a animação; só o ícone encolhe e o nome some.',
            'Nomes de uma palavra só (como "Equipamentos") usam letra um pouco menor para caber inteiros; nomes com mais palavras quebram a linha entre as palavras.',
            'Substitui a mudança de largura da 2.7.3, que causava o salto.'
        ],
        mudou: [
            'Somente visual da Dock; dados e regras não mudaram.',
            'Arquivos alterados: style.css e js/14-historico-mudancas.js.'
        ],
        testar: [
            'Abrir "Equipamentos" (última aba), rolar a tela para a Dock recolher e conferir: sem salto, seletor no lugar e ícones sem recentralizar.',
            'Tocar nas abas do canto com a Dock recolhida e expandida: deve abrir a aba tocada.',
            'Conferir se "Equipamentos" aparece inteiro com a Dock aberta.'
        ],
        testarLinks: []
    },
    {
        numero: '2.7.3', nome: 'Dock recolhida com espaçamento uniforme', status: 'concluida',
        novidades: [
            'Com a Dock recolhida, todas as abas (inclusive "Equipamentos") ficam com a mesma largura e mais juntas entre si.'
        ],
        implementado: [
            'A largura maior dos nomes de uma palavra só vale apenas com a Dock aberta (nomes visíveis); recolhida, cada aba usa 50 px e o vão entre elas some.'
        ],
        mudou: [
            'Somente visual da Dock; dados e regras não mudaram.',
            'Arquivos alterados: style.css e js/14-historico-mudancas.js.'
        ],
        testar: [
            'Rolar uma tela para a Dock recolher: conferir que todas as abas ficam alinhadas, com o mesmo vão, e "Equipamentos" não sobra mais largo.',
            'Voltar a Dock ao normal (subir a tela) e conferir que o nome inteiro de "Equipamentos" continua aparecendo.'
        ],
        testarLinks: []
    },
    {
        numero: '2.7.2', nome: 'Opção para desligar a cascata, "Entrar e voltar" nas abas e nomes inteiros na Dock', status: 'concluida',
        novidades: [
            'Nova opção "Cascata dos itens" em Personalização > Animações e Transições. Continua ligada por padrão; é só desligar se achar cansativo.',
            'Novo efeito de troca de aba "Entrar e voltar": o mesmo deslizar do iPhone dos submenus, com a duração que você escolhe. Para uma aba mais à direita empurra para a esquerda; para uma aba mais à esquerda, faz o movimento de voltar.',
            'Dock: nomes de uma palavra só (como "Equipamentos") aumentam a pílula para caber inteiros; nomes com mais de uma palavra (como "Controle de NFs") quebram a linha entre as palavras, nunca no meio de uma palavra.'
        ],
        implementado: [
            'A cascata respeita a opção nova e continua desligada quando o aparelho está com "Reduzir Movimento".',
            'A busca de Ajustes também encontra "Cascata dos itens".',
            'Dock: cada aba de uma palavra ganha largura automática (mínimo de 64 px) e o texto não quebra; as demais mantêm 64 px com quebra só entre palavras.'
        ],
        mudou: [
            'Transições, Personalização e Dock; dados e regras não mudaram.',
            'Arquivos alterados: index.html, style.css, js/01-nucleo-config-estado.js, js/02-layout-setup.js, js/14-historico-mudancas.js, js/28-transicoes-ios.js e js/29-busca-ajustes.js.'
        ],
        testar: [
            'Personalização > Animações e Transições: desligar e ligar a "Cascata dos itens" e abrir algumas telas.',
            'Escolher o efeito "Entrar e voltar" e trocar de aba indo para a direita e para a esquerda.',
            'Dock: conferir "Equipamentos" inteiro e nomes com duas palavras quebrando entre as palavras. Se a barra ficar larga demais, ela rola na horizontal como antes.'
        ],
        testarLinks: [
            { rotulo: 'Personalização', acao: 'personalizacao' }
        ]
    },
    {
        numero: '2.7.1', nome: 'Fim da tela fantasma nas transições, efeitos de aba de volta e busca em Ajustes', status: 'concluida',
        novidades: [
            'Corrigido o "fantasma" durante as transições: a caixa azul "Tela A" da pré-visualização aparecia por cima de outras telas. Ela agora só existe dentro da própria tela.',
            'Entrar e voltar de submenus é só o deslizar do iPhone, sem nenhum esmaecer. Os efeitos Esmaecer, Deslizar, Subir e Zoom voltaram, mas valem apenas para a troca de aba (junto com Padrão e Instantâneo), e a duração continua escolhida por você.',
            'Na troca de aba, a tela antiga fica inteira por baixo, sem esmaecer junto, para não misturar duas telas.',
            'A cascata dos itens agora pega também os itens de dentro das listas e cartões, só os que aparecem na primeira tela.',
            'Nova busca no topo de Ajustes: procura nas telas de Ajustes e em todas as opções da Personalização (tema, fonte, dock, animações, carregamento, logo etc.), ignora acentos e abre a opção já destacada.'
        ],
        implementado: [
            'Pré-visualização: agora há dois botões, "Trocar de aba" (usa o efeito escolhido) e "Entrar e voltar" (deslizar do iPhone).',
            'A velocidade das animações em "Off" desliga todas as animações de tela.',
            'Busca: aceita várias palavras (todas precisam aparecer), mostra o caminho de cada resultado e abre o primeiro com Enter.'
        ],
        mudou: [
            'Transição entre telas e Ajustes; dados e regras não mudaram.',
            'Arquivo novo: js/29-busca-ajustes.js (precisa ficar na pasta js; o index.html já o carrega).',
            'Arquivos alterados: index.html, style.css, js/02-layout-setup.js, js/14-historico-mudancas.js, js/28-transicoes-ios.js.'
        ],
        testar: [
            'Trocar de aba pela Dock com cada efeito (Personalização > Animações e Transições): não deve aparecer outra tela misturada.',
            'Entrar e voltar de submenus: só o deslizar do iPhone, sem esmaecer.',
            'Ajustes > buscar "tema", "dock", "senha", "carregamento": tocar num resultado deve abrir a tela e destacar a opção.',
            'Abrir telas como Ajustes e Controle de NFs e ver se a cascata aparece nos primeiros itens.'
        ],
        testarLinks: [
            { rotulo: 'Personalização', acao: 'personalizacao' }
        ]
    },
    {
        numero: '2.7.0', nome: 'Transições do protótipo, carregamento em blocos, Dock sem engasgo e Arial', status: 'concluida',
        novidades: [
            'Entrar numa tela interna agora empurra a tela de baixo com recuo de 28% e escurecimento, com duração fixa, como no iPhone. Voltar faz o inverso, e dá para voltar arrastando da borda esquerda da tela.',
            'A troca de aba desliza com leve zoom, e você escolhe a duração (120 a 700 ms) em Personalização > Animações e Transições.',
            'Os primeiros itens de cada tela entram em cascata sutil.',
            'Carregamento na primeira vez que abre uma tela: blocos cinza com onda de brilho no formato da tela, ou só o texto "Carregando…". A escolha e o botão de teste ficam em Animações e Transições.',
            'Fonte padrão passou a ser Arial (as demais continuam disponíveis).',
            'Dock: sem o engasgo ao arrastar até a ponta e soltar, ou ao tocar no primeiro e no último ícone.'
        ],
        implementado: [
            'Transições: movimento do iOS (curva de mola) para entrar/voltar; escurecimento da tela de baixo; sombra na tela que desliza. Os estilos Deslizar, Subir, Zoom e Esmaecer foram retirados; ficam "iPhone (padrão)" e "Instantâneo". Com "Reduzir Movimento" no aparelho, vira uma dissolução curta.',
            'Voltar pela borda: arrastar a partir de 22 px da borda esquerda acompanha o dedo e conclui ao passar de um terço da tela ou com um arrasto rápido; soltar antes cancela. Não vale nas telas de edição de anotação e de cotação.',
            'Carregamento: só aparece quando a tela ainda está esperando a primeira resposta do Firebase e some assim que ela chega (no mínimo 0,35 s e no máximo 6 s). Quando os dados já estão na memória, a tela abre direto.',
            'Dock: a pílula é posicionada separadamente da rolagem; a rolagem até a aba ativa só acontece uma vez por troca de aba e nunca durante o dedo, a inércia ou o elástico da ponta; ao encostar na dock rolável, a animação espera 110 ms para saber se é toque ou arrasto; barra e pílula passam a usar a GPU no encolher/expandir.',
            'Fonte: nova opção "Arial (padrão)" para quem não tinha escolhido outra. Quem já escolheu uma fonte mantém a sua.'
        ],
        mudou: [
            'Transição entre telas, carregamento, Dock e fonte padrão; dados e regras não mudaram.',
            'Arquivo novo: js/28-transicoes-ios.js (precisa ficar na pasta js; o index.html já o carrega).',
            'Arquivos alterados: index.html, style.css, js/01-nucleo-config-estado.js, js/02-layout-setup.js, js/08-fornecedores-logo.js, js/14-historico-mudancas.js e js/22-vidro-liquido.js.'
        ],
        testar: [
            'Entrar e sair de submenus (Ajustes > Personalização > qualquer item): empurra com recuo e escurece. Teste também arrastar da borda esquerda, soltando antes da metade e depois da metade.',
            'Trocar de aba pela Dock e mudar a duração em Animações e Transições para sentir a diferença.',
            'Testar Carregamento (blocos e texto) e abrir uma tela pela primeira vez, como Controle de NFs, para ver o carregamento real.',
            'Dock: arrastar até a ponta e soltar; tocar no primeiro e no último ícone; rolar a tela para recolher e voltar a expandir.',
            'Se a borda esquerda atrapalhar o gesto de voltar do próprio navegador do iPhone, me avise.'
        ],
        testarLinks: [
            { rotulo: 'Personalização', acao: 'personalizacao' }
        ]
    },
    {
        numero: '2.6.0', nome: 'Personalização em submenus, transições estilo iPhone e padronização visual', status: 'concluida',
        novidades: [
            'A Personalização virou um menu com 5 submenus: Aparência, Animações e Transições, Dock e Navegação, Menus e Barra Inferior e Logo da Instituição.',
            'Novo efeito padrão de troca de tela, igual ao do iPhone: a tela nova empurra a antiga com paralaxe e a curva de mola do iOS, sem fade em cima do movimento. Voltar faz o movimento inverso.',
            'O seletor de velocidade das animações agora tem o mesmo estilo do seletor de espessura do vidro.',
            'O organizador de menus foi refeito: uma linha por destino, com interruptor "Na barra / Em Mais" e setas alinhados.',
            'Equipamentos: sumiram as linhas coladas nas listas (Equipamentos e Setores).'
        ],
        implementado: [
            'Transições: trocar de aba só esmaece a tela nova, rápido, por cima da antiga; entrar e voltar de telas internas usa o empurrar do iOS. Os estilos Deslizar, Subir (folha) e Zoom também ficaram sem o fade lento. Com "Reduzir Movimento" ligado no aparelho, vira uma dissolução curta, como no iOS.',
            'Quem tinha a escolha antiga passa a usar o estilo iPhone; é só escolher outro em Animações e Transições para trocar.',
            'Espaçamento padrão entre blocos (cartões e listas) em qualquer tela, para telas novas não nascerem coladas. A varredura nas 32 telas não achou mais nenhum separador colado.',
            'A pré-visualização da transição não interfere mais no resto do app (ela mantinha uma tela "ativa" falsa).',
            'Textos longos dos seletores da dock foram encurtados, com a explicação em uma dica logo abaixo.',
            'Botões do módulo de Equipamentos não quebram mais o texto em duas linhas.'
        ],
        mudou: [
            'Visual e navegação da Personalização, transição entre telas e espaçamento geral; dados e regras não mudaram.',
            'Arquivos alterados: index.html, style.css, js/01-nucleo-config-estado.js, js/02-layout-setup.js, js/06-exportar-pdf.js, js/08-fornecedores-logo.js, js/14-historico-mudancas.js e js/26-equipamentos.js.'
        ],
        testar: [
            'Ajustes > Personalização: abrir cada submenu e voltar pela seta; o título e a volta devem fazer sentido.',
            'Navegar entre telas (entrar em Ajustes, voltar, trocar de aba): o movimento deve ser o do iPhone, sem fade lento. Teste também Animações e Transições > Testar Agora com cada estilo.',
            'Menus e Barra Inferior: ligar/desligar "Na barra" e mexer nas setas; as linhas devem ficar alinhadas.',
            'Equipamentos: conferir as abas Equipamentos e Setores sem linhas coladas.',
            'Se ainda sentir lentidão ao trocar tema/fonte, me diga em qual opção exatamente.'
        ],
        testarLinks: [
            { rotulo: 'Personalização', acao: 'personalizacao' },
            { rotulo: 'Equipamentos', acao: 'equipamentos' }
        ]
    },
    {
        numero: '2.5.3', nome: 'Equipamentos: estoque principal passa a se chamar Almoxarifado', status: 'concluida',
        novidades: [
            'O estoque principal do módulo de Equipamentos agora se chama "Almoxarifado" (antes "Estoque TI").',
            'Todo equipamento cadastrado, inclusive o que vem de uma NF, entra direto no Almoxarifado; só vai para outro setor se você escolher em "Local atual".'
        ],
        implementado: [
            'Nome do estoque principal trocado no módulo (cadastro, movimentações, devoluções, relatórios e lista de setores).',
            'Migração automática ao carregar: itens, histórico e lista de setores que tinham "Estoque TI" passam a mostrar "Almoxarifado". Os dados no Firebase são atualizados na próxima gravação.',
            'O Almoxarifado continua fixo: não pode ser renomeado nem excluído, porque o módulo depende dele como estoque principal. O código/CDC dele pode ser editado.'
        ],
        mudou: [
            'Só o módulo de Equipamentos mudou.',
            'Arquivos alterados: js/14-historico-mudancas.js e js/26-equipamentos.js.'
        ],
        testar: [
            'Abrir Equipamentos > Setores: o primeiro deve ser "Almoxarifado", e os aparelhos que estavam no estoque devem aparecer nele.',
            'Cadastrar um equipamento (ou usar "Cadastrar equipamento desta NF"): o "Local atual" deve vir como Almoxarifado.',
            'Abrir o histórico de um aparelho antigo: onde constava "Estoque TI" deve constar "Almoxarifado".'
        ],
        testarLinks: [
            { rotulo: 'Equipamentos', acao: 'equipamentos' }
        ]
    },
    {
        numero: '2.5.2', nome: 'Equipamentos: leitor de código de barras reforçado', status: 'concluida',
        novidades: [
            'O leitor de código de barras foi refeito para ler melhor em etiquetas: câmera em alta resolução, mais formatos de código, leitura de código invertido e quadro de mira na tela.',
            'Novo botão "Tirar foto do código": se a câmera ao vivo não ler, a foto tirada pela câmera do aparelho (com foco automático) é lida em seguida.',
            'Lanterna (quando o aparelho permite), dicas na tela se demorar a ler e vibração ao ler.'
        ],
        implementado: [
            'Leitura ao vivo: pede vídeo em até 1920×1080 (antes ficava na resolução padrão, baixa para código de barras de etiqueta), lê a imagem inteira e um recorte central (mais pixels por barra) em quadros alternados e também tenta o código invertido. Formatos: Code 128, Code 39, Code 93, EAN-13, EAN-8, UPC-A, UPC-E, ITF, Codabar, QR, Data Matrix, PDF417 e Aztec, com modo "tentar mais".',
            'iPhone/iPad usam sempre a biblioteca ZXing (o leitor nativo do navegador não existe no Safari); Android/Chrome usa o leitor nativo quando disponível e cai para o ZXing se falhar.',
            'Foto do código: lê a foto inteira, o recorte central e a imagem girada 90°, normal e invertida.',
            'Se a biblioteca não baixar de um endereço, tenta outro; se a câmera for bloqueada ou não existir, a janela explica o que fazer e o campo de digitar continua funcionando. A câmera é liberada ao fechar a janela.'
        ],
        mudou: [
            'Só o leitor de código de barras mudou; o resto do módulo de Equipamentos segue igual.',
            'Arquivos alterados: js/14-historico-mudancas.js e js/26-equipamentos.js.'
        ],
        testar: [
            'No cadastro ou na movimentação, tocar no ícone do código de barras e apontar a câmera para a etiqueta (boa luz, afastar ou aproximar até ficar nítido). Deve ler e preencher o campo.',
            'Se não ler, usar "Tirar foto do código" com a etiqueta bem enquadrada.',
            'Se mesmo assim não ler, me diga o aparelho (iPhone ou Android) e o tipo de código da etiqueta (barras ou QR) e, se possível, mande uma foto da etiqueta.'
        ],
        testarLinks: [
            { rotulo: 'Equipamentos', acao: 'equipamentos' }
        ]
    },
    {
        numero: '2.5.1', nome: 'Equipamentos: avisos na própria tela e abertura mais segura', status: 'concluida',
        novidades: [
            'A tela Equipamentos agora mostra, no topo, uma faixa explicando qualquer problema (módulo não carregado, Firebase sem permissão ou erro de conexão), em vez de ficar em branco.'
        ],
        implementado: [
            'Faixa de status dentro da tela Equipamentos: se os arquivos do módulo não carregaram, ela avisa quais conferir; se o Firebase negar a leitura ou a gravação, avisa que é preciso liberar as coleções "equipamentos" e "equipamentosConfig" nas regras; qualquer outro erro mostra o código.',
            'A tela passa a montar sozinha quando fica ativa (não depende mais só do gancho no switchToScreen) e um erro ao montar vira aviso na tela.'
        ],
        mudou: [
            'Nada muda no uso normal; só aparecem avisos mais claros quando algo está errado.',
            'Arquivos alterados: index.html, js/14-historico-mudancas.js e js/27-equipamentos-ponte.js.'
        ],
        testar: [
            'Abrir Mais, Equipamentos: a faixa de aviso do topo deve sumir sozinha quando tudo carrega bem.',
            'Se a faixa continuar aparecendo, me diga o texto exato que ela mostra.'
        ],
        testarLinks: [
            { rotulo: 'Equipamentos', acao: 'equipamentos' }
        ]
    },
    {
        numero: '2.5.0', nome: 'Gestão de Equipamentos', status: 'concluida',
        novidades: [
            'Nova tela Equipamentos: cadastro de aparelhos (patrimônio, série, marca, modelo e NF), movimentação (troca, entrega nova, extravio, transferência, manutenção e baixa), setores/CDC e rastro de cada aparelho.',
            'Leitura de código de barras pela câmera e exportação em planilha, PDF e TXT, com filtros por tipo, período e "só novidades".',
            'Ligação com o Controle de NFs: o número da NF no equipamento abre a nota, e no Editor da NF há o botão "Cadastrar equipamento desta NF".',
            'A tela aparece em Mais; se quiser na barra inferior, use Personalização, "Na barra".'
        ],
        implementado: [
            'Módulo Equipamentos (js/26) isolado do restante do app: a interface tem o próprio visual e usa as cores do tema atual (claro, escuro e os demais).',
            'Persistência no Firebase: coleção "equipamentos" (um documento por aparelho) e "equipamentosConfig/setores". Só grava o que mudou e nunca grava antes de carregar com sucesso, para uma falha de leitura não apagar os setores.',
            'NFs: a lista de notas sugerida no cadastro junta as NFs com XML e as que vieram só do ERP (sem duplicar). Abrir uma NF leva ao Editor da NF; o Editor ganhou o botão "Cadastrar equipamento desta NF", que abre o cadastro já com número, data, fornecedor e valor.',
            'Backup: o backup completo passa a incluir os equipamentos e os setores (se o Firebase ainda não liberar a leitura, o backup sai como antes, sem eles).',
            'O termo de responsabilidade e o de extravio/perda são assinados no papel: o app deixou de gerar o popup de termo ao registrar a movimentação. A movimentação continua registrada e identificada como entrega, troca ou extravio.'
        ],
        mudou: [
            'Nova entrada "Equipamentos" no menu (começa em "Mais"). Quem já personalizou a barra continua com a barra como está.',
            'É preciso liberar nas regras do Firestore as coleções "equipamentos" e "equipamentosConfig" para quem usa o app; sem isso aparece o aviso "O Firebase não liberou as coleções de equipamentos".',
            'Arquivos alterados: index.html, js/01-nucleo-config-estado.js, js/05-listeners-dados.js, js/07-login-conta-backup.js, js/08-fornecedores-logo.js, js/14-historico-mudancas.js, js/20-editor-nf.js, js/24-novidades-versao.js e os arquivos novos js/26-equipamentos.js e js/27-equipamentos-ponte.js.'
        ],
        testar: [
            'Abrir Mais, Equipamentos (ou puxar para a barra em Personalização). A tela deve abrir nos temas claro e escuro, e as janelas aparecem por cima da dock.',
            'Cadastrar um equipamento (pode deixar campos em branco; patrimônio ou série repetidos devem ser barrados). Recarregar o app e conferir que continua lá.',
            'Digitar o número de uma NF no cadastro: devem aparecer notas reais (com XML e só ERP). Tocar no número da NF no equipamento e usar "Abrir no Controle de NFs".',
            'Abrir uma NF no Editor da NF e usar "Cadastrar equipamento desta NF".',
            'Fazer uma troca, uma entrega nova e um extravio: não deve abrir popup de termo; o rastro do aparelho deve registrar o evento.',
            'Exportar a relação de um setor (planilha, PDF e TXT) e as entregas e trocas.',
            'Testar a câmera do código de barras no iPhone (precisa de HTTPS; se negar a permissão, o campo de digitar continua funcionando).',
            'Se aparecer o aviso do Firebase, me diga: é preciso liberar as coleções nas regras de segurança.'
        ],
        testarLinks: [
            { rotulo: 'Equipamentos', acao: 'equipamentos' }
        ]
    },
    {
        numero: '2.4.1', nome: 'Dock que só expande quando você vai trocar de aba e cartões com respiro', status: 'concluida',
        novidades: [
            'A dock agora fica recolhida (só os ícones) na maior parte do tempo e expande, com os nomes, quando você vai trocar de aba: ao tocar nela, ao trocar de tela ou ao rolar a página para cima com vontade. Sem interação, ela recolhe sozinha depois de alguns segundos; ao digitar num campo ela recolhe na hora.',
            'Os cartões de Personalização e de Aprovações de Acesso não ficam mais colados uns nos outros.'
        ],
        implementado: [
            'Dock: abre completa ao entrar no app e recolhe sozinha depois de cerca de 3 segundos sem mexer. Expande ao tocar na dock, ao trocar de tela e ao rolar para cima mais de uns 60 px seguidos; rolar para baixo ou digitar num campo de texto recolhe. Rolar um pouquinho para cima não expande. Campos de marcar, seletores e a barra de espessura da própria dock não contam como digitação.',
            'A opção da Personalização foi renomeada para "Recolher a dock quando não estou trocando de aba" (padrão: sim). Com "Não", a dock fica sempre expandida, como antes. Continua respeitando "Reduzir Movimento" do aparelho.',
            'Espaçamento de 14 px entre os cartões das telas Personalização e Aprovações de Acesso.'
        ],
        mudou: [
            'Antes a dock só recolhia ao rolar para baixo e voltava ao rolar para cima; agora o padrão é recolhida, e ela expande por intenção (toque, troca de tela, rolagem para cima com vontade) e recolhe sozinha.',
            'Arquivos alterados: index.html, style.css, js/14-historico-mudancas.js e js/22-vidro-liquido.js.'
        ],
        testar: [
            'Abrir o app e não mexer: a dock deve começar completa e recolher sozinha em cerca de 3 segundos.',
            'Tocar na dock ou trocar de aba: ela expande com os nomes e recolhe de novo sem interação.',
            'Numa lista longa: rolar para baixo recolhe; rolar para cima com vontade expande; um pequeno vaivém não deve expandir.',
            'Tocar num campo de texto para digitar: a dock recolhe na hora.',
            'Em Personalização: "Recolher a dock quando não estou trocando de aba" = Não deixa a dock sempre expandida. Conferir o espaço entre os cartões e em Aprovações de Acesso.'
        ],
        testarLinks: [
            { rotulo: 'Personalização', acao: 'personalizacao' },
            { rotulo: 'Aprovações de Acesso', acao: 'aprovacoes' }
        ]
    },
    {
        numero: '2.4.0', nome: 'Personalização por usuário e criação de contas dentro do app', status: 'concluida',
        novidades: [
            'A personalização agora é individual: tema, fonte, ícones, menus, dock e as demais opções valem só para a sua conta e acompanham você em qualquer aparelho. A logo da instituição continua sendo a mesma para todos.',
            'Quem tem acesso especial cria contas de e-mail e senha direto em Aprovações de Acesso, sem abrir o Firebase. A pessoa já entra aprovada e você continua conectado.'
        ],
        implementado: [
            'Personalização por usuário: as opções de aparência são gravadas em config/prefs_{id da conta}. O que já estava salvo antes vira o padrão de quem ainda não personalizou, então ninguém perde o visual atual. A logo (usada nos PDFs e nos futuros relatórios de equipamentos) continua no documento compartilhado.',
            'Se as regras do Firebase não liberarem o documento pessoal, o app avisa uma vez e volta a gravar para todos, como era antes, sem perder nenhuma opção.',
            'Ao sair da conta, a aparência da conta anterior não é herdada pela próxima que entrar.',
            'Criar conta: em Aprovações de Acesso há um bloco com e-mail, nome opcional e senha temporária (com botão "Gerar senha"). A conta é criada numa instância separada do Firebase para você não ser desconectado, e fica registrada na lista de acessos como aprovada.',
            'Revogar acesso agora vale também para contas de e-mail e senha criadas no app (antes só valia para Google e telefone). Contas antigas, que não estão na lista, continuam entrando normalmente, e as contas com acesso especial nunca são bloqueadas.'
        ],
        mudou: [
            'Quem já personalizou o visual continua vendo o mesmo; a partir de agora cada mudança fica só na própria conta.',
            'A conta nova entra com a senha temporária e pode trocá-la em Conta, Alterar Senha.',
            'Arquivos alterados: index.html, js/05-listeners-dados.js, js/07-login-conta-backup.js, js/08-fornecedores-logo.js, js/14-historico-mudancas.js, js/24-novidades-versao.js e o arquivo novo js/25-contas-admin.js.'
        ],
        testar: [
            'Em Personalização: mudar o tema e a fonte e recarregar o app; as escolhas devem continuar. Se aparecer o aviso "o Firebase não liberou a personalização individual", me avise (é preciso liberar a coleção config nas regras).',
            'Entrar com a conta de teste: ela deve começar com o visual padrão e, ao mudar o tema lá, a sua conta principal não pode mudar (e vice-versa).',
            'Em Aprovações de Acesso: criar uma conta de verdade (use "Gerar senha"), entrar com ela em outra janela ou aparelho e conferir que você continua conectado na conta principal.',
            'Revogar essa conta nova em Aprovações de Acesso e tentar entrar de novo: deve avisar que o acesso foi revogado. Depois, aprovar de novo.',
            'Conferir que a logo da instituição é a mesma nas duas contas.'
        ],
        testarLinks: [
            { rotulo: 'Personalização', acao: 'personalizacao' },
            { rotulo: 'Aprovações de Acesso', acao: 'aprovacoes' }
        ]
    },
    {
        numero: '2.3.4', nome: 'Troca de tema, fonte e opções sem engasgo (de verdade)', status: 'concluida',
        novidades: [
            'Trocar tema, fonte, estilo de ícones, densidade e as opções da dock agora é bem mais leve: o app não trava mais no momento da troca.'
        ],
        implementado: [
            'Causa real do engasgo: cerca de 360 elementos do app têm animação de cor. Ao trocar o tema (ou outra opção de aparência), todos começavam a animar ao mesmo tempo e o navegador refazia o cálculo de estilo a cada quadro durante a animação. Em teste isso custava cerca de 4 vezes mais do que o necessário.',
            'Agora, no instante da troca, as animações de transição são suspensas por uma fração de segundo e voltam logo depois. A troca fica direta (sem o esmaecer lento de cores) e as animações normais do app, da dock e das telas continuam como antes.',
            'A correção vale para qualquer mudança de aparência: tema, ícones, fonte, densidade, ícones das abas, transição de telas e todas as opções da dock. Não afeta o carregamento inicial.'
        ],
        mudou: [
            'Ao trocar de tema, as cores passam para o novo tema na hora, sem o esmaecimento suave de antes. As outras animações do app não mudaram.',
            'Arquivos alterados: style.css, js/02-layout-setup.js e js/14-historico-mudancas.js.'
        ],
        testar: [
            'Em Personalização: trocar o tema várias vezes (claro, escuro, Oceano…). A troca deve ser imediata. Esse é o teste principal.',
            'Trocar a fonte, o estilo de ícones, a densidade e o movimento da dock: nenhuma deve travar. Se alguma ainda travar, me diga qual.',
            'Navegar entre as abas e abrir menus: as animações normais devem continuar iguais.'
        ],
        testarLinks: [
            { rotulo: 'Personalização', acao: 'personalizacao' }
        ]
    },
    {
        numero: '2.3.3', nome: 'Nomes da dock sem sobreposição e Personalização sem engasgos', status: 'concluida',
        novidades: [
            'Os nomes das abas da dock (Entrada de NF, Controle de NFs) agora quebram em duas linhas dentro da própria aba e não invadem mais a vizinha.',
            'Personalização mais leve: trocar fonte, tema, movimento ou qualquer opção da dock não deve mais engasgar.'
        ],
        implementado: [
            'Dock: rótulos longos passam a ocupar até 2 linhas dentro da largura da aba (cortam com reticências só se passarem disso). A fonte dos rótulos da dock ficou em 10 px.',
            'Personalização, causa do engasgo: cada toque numa opção gravava a personalização inteira (inclusive a logo, em texto grande) e, quando a gravação voltava do servidor, o app refazia tudo: listas de fornecedores, apelidos e observações, o menu lateral, a barra inferior e a tela "Mais". Isso acontecia duas vezes por toque (eco local e confirmação do servidor).',
            'Agora só vai para o banco o campo que mudou; quando a única novidade é a própria personalização, o app só reaplica a aparência e não refaz listas nem menus (menus e logo só são refeitos se de fato mudarem); atributos e variáveis do documento só são trocados se o valor mudou; e a espessura e a velocidade da dock ficam guardadas na própria barra, não no documento inteiro, o que também deixa o controle de espessura mais fluido.'
        ],
        mudou: [
            'Se outro aparelho mudar a ordem dos menus, ela continua sendo aplicada aqui na hora.',
            'Arquivos alterados: style.css, js/02-layout-setup.js, js/05-listeners-dados.js, js/08-fornecedores-logo.js, js/14-historico-mudancas.js e js/22-vidro-liquido.js.'
        ],
        testar: [
            'Na dock, conferir se "Entrada de NF" e "Controle de NFs" aparecem em duas linhas, sem encostar nas abas vizinhas, no tema claro e no escuro.',
            'Em Personalização: trocar fonte, tema, movimento da dock, velocidade e arrastar a espessura. A troca deve ser imediata, sem travar. Se ainda travar, me diga qual opção.',
            'Conferir que a logo da instituição, a ordem dos menus e "Na barra" continuam funcionando (mudar, recarregar e ver se ficou salvo).'
        ],
        testarLinks: [
            { rotulo: 'Personalização', acao: 'personalizacao' }
        ]
    },
    {
        numero: '2.3.2', nome: 'Dock de vidro líquido: troca de aba suave, mais contraste e opções na Personalização', status: 'concluida',
        novidades: [
            'A dock (barra inferior) ganhou o vidro líquido: desfoque, brilho fino nas bordas e rótulos com bem mais contraste, no tema claro e no escuro.',
            'A troca de aba agora desliza de forma suave (sem mola e sem esticar) e já começa quando o dedo encosta. Dá para arrastar o dedo pela dock.',
            'A dock encolhe ao rolar para baixo e volta ao tamanho normal ao subir ou ao tocar nela.',
            'Em Configurações > Personalização, na seção "Dock", dá para ajustar estilo, espessura do vidro, velocidade, encolher ao rolar e o comportamento com "Reduzir Movimento".'
        ],
        implementado: [
            'Vidro "regular" da Apple na dock: fundo desfocado, luminosidade ajustada (clareia no tema claro, escurece no escuro) e um véu da cor do tema para segurar o contraste. Rótulos em cor forte do tema; a aba ativa mistura a cor de destaque com a cor do texto. Pílula de seleção lisa, neutra e fina.',
            'Troca de aba: a pílula desliza com curva suave (início e fim macios, sem ultrapassar o destino), em 0,5 s por padrão. Ela começa a mover quando o dedo encosta e acompanha se você arrastar pela dock; ao soltar, a aba sob o dedo fica ativa.',
            'Dock compacta ao rolar para baixo: a dock encolhe e os rótulos somem; volta ao subir, ao trocar de tela ou ao tocar. Não encolhe com ícones desligados nem com a opção desativada.',
            '"Reduzir Movimento" do aparelho: antes, a pílula trocava de lugar sem nenhuma animação quando o ajuste estava ligado. Agora ela troca com fusão suave (some e reaparece), e a dock não encolhe. A opção "Sempre animar" ignora o ajuste.',
            'Personalização > Dock: estilo (vidro líquido ou clássico da 2.2.0), espessura do vidro (0 a 100%), velocidade (rápida, normal, lenta), encolher ao rolar e movimento reduzido. Tudo vem ligado por padrão e é guardado junto das demais opções de personalização.'
        ],
        mudou: [
            'Se o seu iPhone está com "Reduzir Movimento" ligado (Ajustes > Acessibilidade > Movimento), a troca de aba é uma fusão e a dock não encolhe. Para ver o deslize, escolha "Sempre animar" na Personalização ou desligue o ajuste no iPhone.',
            'O estilo Clássico mantém a dock da 2.2.0 como estava (a única mudança que vale para ele é a troca com fusão quando o movimento reduzido está ligado).',
            'Arquivos alterados: index.html, style.css, js/02-layout-setup.js, js/14-historico-mudancas.js, js/22-vidro-liquido.js e js/24-novidades-versao.js.'
        ],
        testar: [
            'Tocar nas abas da dock e ver se a pílula desliza de forma suave. Arrastar o dedo pela dock.',
            'Rolar uma tela longa para baixo (dock encolhe) e para cima (volta). Conferir no tema claro e no escuro se os rótulos ficam fáceis de ler sobre conteúdo colorido.',
            'Em Personalização > Dock: mudar a espessura, a velocidade, desligar o encolher e trocar para Clássico, vendo o efeito na hora.',
            'Ler a frase de diagnóstico em "Se o aparelho estiver com Reduzir Movimento": ela diz se o ajuste está ligado no seu iPhone.'
        ],
        testarLinks: [
            { rotulo: 'Personalização (Dock)', acao: 'personalizacao' },
            { rotulo: 'Pedido 1726 (tela longa para rolar)', acao: 'pedido', arg: '1726' }
        ]
    },
    {
        numero: '2.3.1', nome: 'Editor da NF para NF que veio só do ERP e popup de novidades a cada versão', status: 'concluida',
        novidades: [
            'NFs que vieram só do relatório do ERP (sem XML) agora abrem no Editor da NF: pelo botão "Abrir editor da NF" no Controle de NFs e pelo "Abrir NF" do bloco amarelo de itens fora do pedido.',
            'Dá para trocar o pedido dessas NFs. O app sugere o pedido pelos itens que o fornecedor ganhou ("Mover para o pedido X", sempre com confirmação) e há uma busca para escolher outro pedido.',
            'Este aviso: a cada versão nova o app mostra as melhorias e atalhos para as telas a testar. Aparece uma vez por versão em cada aparelho.'
        ],
        implementado: [
            'Editor da NF para NF só do ERP: mostra fornecedor, valor, emissão, 1º vencimento, pedido e os itens lançados, cada um conferido com a cotação do pedido (não está na cotação, ganho por outra empresa ou ganho por este fornecedor, reconhecendo empresas do mesmo grupo).',
            'Troca de pedido para NF só do ERP: o aviso "Pedido possivelmente errado" (quando menos da metade dos itens está na cotação do pedido gravado e outro pedido tem pelo menos 75%) e a sugestão para NF sem pedido (pelo menos metade dos itens ganhos pelo fornecedor) usam os códigos dos itens do ERP. A confirmação grava o vínculo do ERP com o pedido escolhido e preenche as associações de SP Data que ficarem certas, como já acontecia.',
            'Controle de NFs: o botão "Abrir editor da NF" passa a aparecer também nas NFs só do ERP. No bloco "itens fora do pedido" da Central do pedido, o "Abrir NF" passa a aparecer também para itens que vêm só do ERP.',
            'Popup de novidades: ao abrir o app numa versão que você ainda não viu naquele aparelho, aparece uma janela com as melhorias e botões que levam direto às telas a testar. Botões "Entendi" e "Ver histórico completo". O conteúdo vem da entrada mais recente deste histórico (campos novidades e testarLinks).'
        ],
        mudou: [
            'Caso real: a NF 387951 da SOMA MG estava vinculada ao pedido 1726 (22/09) apesar de ser de 10/09 e de seus três itens terem sido ganhos pela SOMA MG no pedido 1713. O vínculo antigo foi gravado pela regra de antes da 2.0.8 (primeiro pedido com qualquer item em comum) e nunca foi reavaliado por não haver XML. Agora o Editor da NF dessa entrada oferece "Mover para o pedido 1713".',
            'Valores, vencimento e associação item a item continuam disponíveis só para NF com XML processado: para essas NFs só do ERP, processe o XML na Entrada de NF.',
            'Nada é alterado sozinho: o vínculo com o pedido só muda quando você confirma.',
            'Arquivos novos: js/24-novidades-versao.js. Arquivos alterados: index.html, style.css, js/14-historico-mudancas.js, js/17-historico-controle-nfs.js, js/20-editor-nf.js e js/23-conferencia-automatica.js.'
        ],
        testar: [
            'Ao recarregar o app com os arquivos novos, deve aparecer o popup "Versão 2.3.1". Toque em "Entendi" e recarregue: ele não deve voltar.',
            'Controle de NFs: procurar a NF 387951 (SOMA MG), tocar em "Abrir editor da NF" e conferir o aviso de pedido possivelmente errado com o botão "Mover para o pedido 1713". Conferir os itens e, se concordar, confirmar a mudança; depois abrir o pedido 1726 e ver que o aviso dessa NF saiu.',
            'Repetir a conferência com as outras NFs apontadas na 2.3.0 (BMG 30484 no 1653, SUTURMEDIC 20646 no 1698, DUO MED 1536 no 1700) e me dizer o que era real.'
        ],
        testarLinks: [
            { rotulo: 'Abrir a NF 387951 (SOMA MG)', acao: 'nf-erp', arg: '387951_1' },
            { rotulo: 'Controle de NFs', acao: 'controle-nfs' },
            { rotulo: 'Pedido 1726', acao: 'pedido', arg: '1726' },
            { rotulo: 'Pedido 1713', acao: 'pedido', arg: '1713' }
        ]
    },
    {
        numero: '2.3.0', nome: 'Conferência automática: NF repetida no Adicionar, NF sem pedido e itens fora do pedido', status: 'concluida',
        implementado: [
            'Adicionar: ao digitar o número da NF, o app avisa na hora se ela já existe (XML processado ou só no relatório do ERP), mostrando o fornecedor e o pedido, com botão para abrir a NF. Zeros à esquerda não escondem a NF. Se você já digitou o fornecedor e ele for outro, o aviso some (o número pode se repetir entre fornecedores). O aviso aparece junto das sugestões do histórico que já existiam.',
            'NF sem pedido: o Editor da NF e o card do Histórico passam a apontar "NF sem pedido". O app sugere o pedido pelos nomes dos itens do XML, só entre os itens que o fornecedor ganhou em cada cotação (medido nas 56 NFs que já têm pedido: nenhuma sugestão errada) e oferece "Vincular ao pedido X". Há também "Marcar como compra direta" para o que não tem cotação. NFs já marcadas como compra direta não são apontadas.',
            'Itens fora do pedido: na Central do pedido aparece um bloco no topo, e o Editor da NF mostra um cartão, quando um item faturado ou lançado não está na cotação do pedido, ou foi ganho por outra empresa. Vale para NFs com XML e para entradas do ERP sem XML.',
            'Reconhece empresas do mesmo grupo: mesma raiz de CNPJ, CNPJs do mesmo fornecedor no SP Data, ou a mesma primeira palavra do nome (SOMA SP e SOMA MG). Nos seus dados isso eliminou 13 alarmes falsos de itens da SOMA SP que a SOMA MG ganhou.'
        ],
        mudou: [
            'Nos seus dados de 10/10 o bloco "itens fora do pedido" aponta 10 itens: NF 30484 da BMG no pedido 1653 (4 itens), NF 20646 da SUTURMEDIC no 1698 (2), NF 1536 da DUO MED no 1700 (1) e NF 387951 da SOMA MG no 1726 (3). Em geral indicam NF ligada ao pedido errado; abra a NF (ou, para as só do ERP, o Controle de NFs) e confira. A NF 33669 (MINAS SUL) está sem pedido e sem compra direta; nenhuma cotação combina com ela, então provavelmente é compra direta.',
            'Os avisos só informam: nada é alterado sozinho. Mover pedido, vincular e marcar compra direta pedem confirmação.',
            'Fica de fora: gerar auditoria direto a partir de um item fora do pedido (hoje o caminho é abrir a NF e conferir o pedido).',
            'Arquivos novos: js/23-conferencia-automatica.js. Arquivos alterados: index.html, style.css, js/03-dados-notas.js, js/09-anotacoes.js, js/14-historico-mudancas.js, js/17-historico-controle-nfs.js e js/20-editor-nf.js.'
        ],
        testar: ['Em Adicionar, digitar 30921 no campo NF: deve aparecer o aviso "Esta NF já existe no app" com o botão Abrir NF. Abrir o pedido 1726 em Cotações e ver o bloco amarelo no topo. Abrir a NF 33669 no Editor da NF e conferir o alerta "NF sem pedido".']
    },
    {
        numero: '2.2.1', nome: 'Ícone do app, instalação na tela de início e textos mais claros', status: 'concluida',
        implementado: [
            'Ícone novo do app, desenhado nas orientações da Apple: um conceito só (a nota fiscal com o selo de conferido), figura centralizada, fundo em gradiente azul sem transparência, camadas sobrepostas e nenhum texto. Fica legível até no tamanho pequeno. Está na pasta icones/, nos tamanhos 180 (iPhone), 192 e 512 px.',
            'Instalação na tela de início: o app ganhou o manifesto (manifest.webmanifest) e os metadados de cor e barra de status. Ao adicionar à tela de início no Safari, abre em tela cheia, sem a barra do navegador, com o ícone e o nome "Minhas Notas".',
            'Textos: as mensagens "Arquivo carregado! Clique em ..." viraram "Arquivo carregado. Use o botão ...", que serve para toque e para mouse. Estados vazios passaram a dizer o próximo passo: Gerenciar (nenhuma nota na relação), Controle de NFs (nada em aberto, nenhuma NF arquivada) e Cotações, com botão de atalho onde cabe.'
        ],
        mudou: [
            'O ícone da tela de início do iPhone é guardado em cache: para ver o novo, remova o app da tela de início e adicione de novo pelo Safari.',
            'Os ícones da interface continuam em um estilo só (Font Awesome sólido); o estilo dos ícones do dock segue sendo uma opção em Personalização.',
            'Não mexi no tamanho de texto que acompanha o ajuste do iPhone (Dynamic Type): o app usa tamanhos fixos em px em quase todas as telas, e a troca é grande e arriscada para o ganho. Fica como possibilidade futura.',
            'Arquivos novos: manifest.webmanifest e a pasta icones/. Arquivos alterados: index.html, js/05-listeners-dados.js, js/13-relatorios-divergencias.js, js/14-historico-mudancas.js, js/15-ganhadores-cotacoes.js, js/17-historico-controle-nfs.js, js/18-erp-fornecedores-spdata.js e js/19-erp-reconciliacao.js.'
        ],
        testar: ['Colocar a pasta icones/ e o manifest.webmanifest junto do index.html. No Safari do iPhone: Compartilhar > Adicionar à Tela de Início e abrir pelo ícone novo. Conferir os estados vazios em Gerenciar (aba Relação) e em Controle de NFs (aba Em aberto, com as listas vazias).']
    },
    {
        numero: '2.2.0', nome: 'Linguagem Apple: Liquid Glass no dock e no cabeçalho, movimento com mola e tipografia do sistema', status: 'concluida',
        implementado: [
            'Dock em vidro líquido (telas estreitas): vira uma cápsula flutuante, com desfoque, borda de luz e sombra, e o conteúdo das telas rola por baixo dela. Uma pílula translúcida desliza até a aba ativa com movimento de mola, e o dock rola sozinho para manter a aba ativa à vista. No computador continua o menu lateral.',
            'Cabeçalho em vidro: o conteúdo rola por baixo do título e, quando isso acontece, aparece uma linha fina de separação. As telas passam a começar logo abaixo do cabeçalho e terminam acima do dock, sem nada escondido.',
            'Seguindo as diretrizes da Apple, o vidro fica só na camada de navegação (dock, cabeçalho e confirmações). Os cards e listas continuam opacos, para a leitura não depender do que passa por trás.',
            'Alertas e confirmações usam vidro mais opaco, para manter a leitura; o toque nos botões ganhou resposta curta de mola.',
            'Fonte do sistema primeiro: no iPhone e no Mac o app passa a usar a SF Pro, a fonte da Apple (Inter continua como reserva em outros aparelhos). Rótulos que estavam em 10 px subiram para 11 px, o mínimo recomendado.',
            'Acessibilidade: com "Reduzir transparência" ou "Aumentar contraste" ligados no aparelho, o vidro vira cor sólida e as bordas ficam mais fortes; com "Reduzir movimento", as animações de mola são desligadas. Sem suporte a desfoque o app também usa cor sólida.'
        ],
        mudou: [
            'O dock e o cabeçalho deixam de ocupar espaço próprio: o conteúdo passa por baixo deles. Se alguma tela tiver algo escondido atrás do cabeçalho ou do dock, me diga qual.',
            'Fica para as próximas versões: ícone do app e instalação na tela de início, ícones em um único estilo, padronização dos textos (por exemplo "Toque" em vez de "Clique") e tamanho de texto que acompanha o ajuste do iPhone.',
            'Arquivos alterados: index.html, style.css, js/14-historico-mudancas.js e o novo js/22-vidro-liquido.js.'
        ],
        testar: ['No iPhone, abrir o app e rolar uma lista: o conteúdo deve passar por baixo do título e do dock. Trocar de aba e ver a pílula deslizar. Conferir o tema escuro e, em Ajustes > Acessibilidade, "Reduzir transparência" e "Reduzir movimento".']
    },
    {
        numero: '2.1.4', nome: 'Card do fornecedor no padrão do Gerenciar NF', status: 'concluida',
        implementado: [
            'Card do fornecedor na Central do pedido refeito no estilo do card do Gerenciar NF: fundo branco para se destacar do fundo da tela, cantos arredondados e sombra leve, e seções separadas por divisórias (identificação, entrega e ações, detalhes).',
            'Barra colorida da lateral agora cobre a altura inteira do card, inclusive quando ele está expandido: verde (entregue e sem divergência em aberto), vermelha (divergência ou auditoria em aberto) ou amarela (em andamento). Antes ela cobria só o cabeçalho.',
            'Cabeçalho organizado em linhas: nome do fornecedor, CNPJ e resumo (itens e divergências em aberto), com a seta de expandir à direita. A palavra "entrega completa" saiu do resumo do topo porque o selo de entrega já aparece logo abaixo.',
            'Botões ("Desfazer marca manual"/"Marcar como já chegou", "Abrir NF" e "Associar NF do histórico") passaram a usar os mesmos chips do Gerenciar NF, alinhados à esquerda com espaçamento igual. O espaçamento aleatório vinha de uma regra antiga do botão que o empurrava para a borda.',
            'Correção de tamanho de fonte no iPhone: nomes de fornecedor que quebravam em duas linhas apareciam maiores que os outros, porque o Safari aumentava o texto sozinho. Foi desligado esse ajuste automático.'
        ],
        mudou: [
            'Só aparência: nenhuma regra de entrega, divergência ou associação mudou.',
            'Arquivos alterados: style.css, js/09-anotacoes.js, js/11-central-pedido.js e js/14-historico-mudancas.js.'
        ],
        testar: ['Cotações > pedido 1726: conferir os cards dos fornecedores (fundo branco, barra colorida inteira, botões alinhados) e expandir a SUPERMED para ver detalhes e itens. Conferir também no tema escuro, se usar.']
    },
    {
        numero: '2.1.3', nome: 'Seletor só com os itens do fornecedor, sugestão pelo nome do XML e card do fornecedor com ações à vista', status: 'concluida',
        implementado: [
            'Editor da NF: o seletor do item da cotação agora lista só os itens que aquele fornecedor ganhou (antes, quando o CNPJ da NF não batia, caía na cotação inteira). Para achar o fornecedor vale o CNPJ cadastrado, os CNPJs do mesmo fornecedor no SP Data e a raiz do CNPJ (matriz e filiais). O botão "Mostrar itens de outros fornecedores" amplia a lista quando precisar. O mesmo critério de raiz do CNPJ passou a valer na Entrada de NF.',
            'Sugestão pelo nome do item do XML, como já existe para o SP Data: ao abrir a lista (Editor da NF e Entrada de NF) as sugestões vêm no topo. Primeiro a regra estrita que o app já usava; se ela não achar nada, uma regra por parecença (números pesam mais, aceita abreviações como CIL = CILIND), só dentro dos itens do fornecedor, no máximo 3 e identificados como "Parecidos pelo nome — confira". No Editor, quando só há sugestão estrita e o item ainda não tem associação, aparecem botões "Usar: ...".',
            'Medido no seu histórico real (398 itens já associados): a regra estrita sugeriu em 167 itens e acertou 99%; com a parecença o app sugere em 287 itens e o item certo estava entre as sugestões em 99% deles (71% de todos os itens, contra 49% antes). Marca contra princípio ativo (ex.: CINETOL, FENTANEST) continua sem sugestão, porque o nome do XML não traz o princípio.',
            'Card do fornecedor na Central do pedido: o selo de entrega e os botões ("Marcar como já chegou" / "Desfazer marca manual", "Abrir NF" e "Associar NF do histórico") ficaram fora da parte que expande, sempre visíveis, no mesmo modelo do Gerenciar NF. Dentro do card, ao expandir, ficam os detalhes da entrega, os itens (cada um recolhido) e as divergências. O painel de busca da NF abre logo abaixo dos botões.',
            'O seletor ganhou grupos na lista ("Sugestões pelo nome do item", "Todos os itens", "Outras opções"), com a compra direta sempre no fim.'
        ],
        mudou: [
            'Para NFs cuja empresa não ganhou nenhum item no pedido (ex.: SOMA SP quando quem ganhou foi a SOMA MG) a lista fica sem itens e mostra o aviso com o botão para ver os de outros fornecedores.',
            'As sugestões nunca são escolhidas sozinhas: sempre dependem do seu toque.',
            'Arquivos alterados: style.css, js/09-anotacoes.js, js/10-entrada-nf-xml.js, js/11-central-pedido.js, js/14-historico-mudancas.js, js/20-editor-nf.js e js/21-seletor-busca.js.'
        ],
        testar: ['Controle de NFs > NF da BIOLINE (pedido 1733) > Abrir editor da NF > tocar em um item > seletor do item da cotação: deve listar só os 10 itens da BIOLINE, com sugestões no topo. Cotações > pedido 1733: conferir o card do fornecedor com os botões visíveis e os itens/divergências ao expandir. Entrada de NF: abrir a lista de associação e ver as sugestões no topo.']
    },
    {
        numero: '2.1.2', nome: 'Seletor único com busca e Editor da NF reorganizado', status: 'concluida',
        implementado: [
            'Novo seletor único para o app todo: um campo só. Ao tocar nele abre a lista completa logo abaixo e, a cada letra digitada, a lista filtra na hora (sem precisar apertar Enter e sem o segundo campo/caixa nativa do celular). Ignora acentos, aceita várias palavras e mostra o item atual destacado. O Enter escolhe o melhor resultado digitado, nunca a opção especial.',
            'Entrada de NF: a associação do item com a cotação passou a usar o seletor único (a lista nativa foi retirada). A opção "Sem cotação do SmartCompras (compra direta)" continua lá, destacada e no fim da lista quando você digita.',
            'Editor da NF: associação com a cotação, produto SP Data e "mover para outro pedido" usam o mesmo seletor, sem os botões soltos "Buscar", "Associar" e "Mover". Escolher já abre a confirmação.',
            'Editor da NF, cabeçalho: número e série, fornecedor e CNPJ, valor total em destaque, quadro com emissão, 1º vencimento e pedido, selos de situação e botões de ação, cada coisa em seu bloco.',
            'Editor da NF, área que expande: três seções com título (Item da cotação, Produto SP Data, Fator de conversão), cada uma mostrando o valor atual numa caixa e o campo logo abaixo, com campos e botões no padrão visual do app. O item aberto continua aberto depois de uma edição, e a tela não é redesenhada enquanto você digita.',
            'As listas de SP Data da Central do pedido ganharam a mesma aparência do seletor.'
        ],
        mudou: [
            'Correção de um erro da 2.0.7: a busca de SP Data do Editor da NF chamava uma função que não devolve lista (ela só filtra a tela de SP Data), então a busca não funcionava. Agora usa a mesma busca da Central.',
            'Ficou de fora desta versão: os seletores de fornecedor da tela de importação do ERP (vincular fornecedor) e o seletor de cotação adicional, que continuam como estavam.',
            'Arquivos alterados: index.html, style.css, js/10-entrada-nf-xml.js, js/11-central-pedido.js, js/14-historico-mudancas.js, js/20-editor-nf.js e o novo js/21-seletor-busca.js.'
        ],
        testar: ['Entrada de NF: abrir um item, tocar em "Corrigir" a associação e digitar parte do nome ou código: a lista deve filtrar na hora. Editor da NF (pelo Controle de NFs): conferir o cabeçalho e, ao tocar em um item, as 3 seções; trocar o SP Data digitando o nome, e o pedido pelo campo "Mover esta NF para outro pedido".']
    },
    {
        numero: '2.1.1', nome: 'Aba Itens do Editor da NF no formato de DANFE', status: 'concluida',
        implementado: [
            'A aba Itens virou uma tabela como a da nota fiscal: código, descrição (com lote, validade e fabricação), NCM, CFOP, unidade, quantidade, valor unitário e valor total, com os valores do XML. Abaixo da tabela aparece o total dos produtos do XML.',
            'Cada item abre ao tocar na linha: associação com a cotação, SP Data, fator de conversão e a conferência com o ERP ficam ali, sem poluir a tabela.',
            'Quando o fator é diferente de 1, a linha mostra a quantidade que entra no estoque.'
        ],
        mudou: [
            'Os controles não mudaram de função: associar, buscar SP Data e aplicar fator continuam gravando do mesmo jeito.',
            'Em NFs antigas, sem XML completo, a tabela usa os valores salvos (já convertidos pelo fator) e não mostra NCM, CFOP nem o total do XML.',
            'Arquivos alterados: js/20-editor-nf.js, style.css e js/14-historico-mudancas.js.'
        ],
        testar: ['Abrir uma NF do Controle de NFs e conferir a aba Itens: colunas, valores, lote e validade. Tocar em um item para abrir a associação e o fator, e tocar de novo para recolher.']
    },
    {
        numero: '2.1.0', nome: 'Editor da NF completo: todos os dados do XML, em abas, e acesso a partir do Controle de NFs', status: 'concluida',
        implementado: [
            'Ao salvar uma NF, o app passa a guardar o XML completo junto dela: cabeçalho (chave, natureza, modelo, tipo, datas), emitente e destinatário com endereço, totais e tributos, transportadora, duplicatas e pagamentos, impostos de cada item (ICMS, IPI, PIS, COFINS), NCM, CFOP, CEST, EAN, unidade e quantidades do XML, lote e validade, e o texto original do XML.',
            'O Editor da NF ganhou o mesmo padrão de abas da Entrada de NF: Itens (divergências da NF, associação com a cotação, SP Data, fator, lote e validade, dados fiscais de cada item), Financeiro (duplicatas, pagamento, totais e a situação na relação/ERP), Fiscal (tributos da nota e por item), Emitente/Dest. (endereços), Transporte e XML (chave, informações complementares e o XML original para ler).',
            'O card de cada NF no Controle de NFs ganhou o botão "Abrir editor da NF", então o editor fica acessível a partir do Controle sem passar pela cotação ou pelo Histórico.'
        ],
        mudou: [
            'NFs processadas antes desta versão não têm o XML completo guardado: o editor mostra um aviso nas abas que dependem dele, e para completar basta reprocessar o XML na Entrada de NF. Itens, pedido, fator, associações e divergências já funcionam nessas NFs.',
            'O XML original é guardado dentro da NF (até cerca de 500 KB; acima disso fica sem o texto e os demais dados são guardados).',
            'Arquivos alterados: js/10-entrada-nf-xml.js, js/11-central-pedido.js, js/14-historico-mudancas.js, js/17-historico-controle-nfs.js e js/20-editor-nf.js.'
        ],
        testar: ['Processar um XML novo na Entrada de NF e salvar. No Controle de NFs, abrir o card dessa NF e tocar em "Abrir editor da NF": conferir as abas Financeiro (vencimento e parcelas), Fiscal (impostos), Emitente/Dest., Transporte e XML. Em NF antiga, conferir o aviso e que Itens continua funcionando. Confirmar que lote e validade aparecem em cada item.']
    },
    {
        numero: '2.0.9', nome: 'Resolvido em um lugar só: a auditoria manda e o cabeçalho do fornecedor mostra o estado por cor', status: 'concluida',
        implementado: [
            'Antes havia dois núcleos: o "Marcar como resolvido" do item (comparação) e o status da auditoria (Anotações). Agora, quando uma auditoria do pedido cobre o item, o status dela decide: resolvida ou encerrada = item resolvido; pendente = item aberto. Não é preciso marcar de novo.',
            'A auditoria é ligada ao item pelo nome do produto (mesmos três primeiros termos, ex.: "NIMESULIDA 100MG" ↔ "NIMESULIDA 100MG COMP") e pelo fornecedor, quando a auditoria tem CNPJ. As de "não foi faturado" (sem CNPJ) são ligadas só pelo nome, dentro do mesmo pedido.',
            'Nos itens com auditoria ligada, some o botão "Marcar como resolvido" e aparece "✓ Tratado na auditoria" ou "Em aberto na auditoria", com o status de cada uma. Itens sem auditoria continuam com o botão manual, como antes.',
            'Cabeçalho do fornecedor na Central do pedido: borda verde (entregue e sem divergência em aberto), vermelha (divergência em aberto ou auditoria pendente) ou amarela (entrega em andamento). A legenda está em negrito e colorida: "✓ entrega completa", "N com divergência em aberto", "N auditoria(s) pendente(s)".',
            'O contador "com divergência" conta só o que ainda está em aberto; os resolvidos saem da contagem.'
        ],
        mudou: [
            'Um item que tinha "Marcar como resolvido" manual e que também tem auditoria ligada passa a seguir a auditoria. Se a auditoria estiver pendente, o item aparece aberto mesmo que tenha sido marcado à mão antes: resolva a auditoria (Alterar status) e o item fecha sozinho.',
            'Arquivos alterados: js/09-anotacoes.js, js/11-central-pedido.js, js/14-historico-mudancas.js e style.css.'
        ],
        testar: ['Pedido 1713: a NIMESULIDA deve aparecer resolvida sem clicar em nada, e o fornecedor NIMESULIDA/CMP sem a legenda "com divergência em aberto". Pedido 1726: a SONDA NASOG (auditoria pendente) segue aberta até você alterar o status na auditoria; conferir as cores dos cards de fornecedor.']
    },
    {
        numero: '2.0.8', nome: 'Causa das divergências fantasma: NF do ERP vinculada ao pedido errado', status: 'concluida',
        implementado: [
            'Causa encontrada: ao importar o relatório do ERP, para uma NF que já tinha XML no app o pedido era escolhido como "a primeira cotação (a mais recente) que tivesse qualquer item em comum" — e não o pedido gravado na própria NF. Era comum cair no pedido errado (nos dados reais, 9 NFs: ex. a NF 390653 da SOMA SP estava no pedido 1726 e a entrada do ERP foi vinculada ao 1731), e daí vinham as divergências "fantasma" de quantidade e valor. Agora o pedido vem da NF; sem NF, vale a cotação que cobre MAIS itens associados.',
            'Comparações, entregas por fornecedor e "Associar NF do histórico" passam a usar o pedido da NF para as entradas do ERP que têm XML no app (pedido efetivo), mesmo que o vínculo gravado esteja antigo.',
            'Correção automática dos dados: uma vez por sessão, os vínculos do ERP cujo pedido difere do pedido da NF/XML são regravados com o pedido da NF (o pedido anterior fica guardado em pedidoAnterior). Aparece um aviso com a quantidade corrigida.',
            'Pedido possivelmente errado: se uma NF foi gravada num pedido onde menos da metade dos itens está na cotação e outro pedido tem pelo menos 75% dos itens, o app avisa no Editor da NF, no card do Histórico e no bloco do fornecedor da Central do pedido, com o botão "Mover para o pedido X" (um toque). Se mais de um pedido encaixar igualmente, mostra as opções.',
            'No Editor da NF há também "Trocar pedido" (lista de pedidos) para mover a NF para qualquer pedido. Mover grava a NF e o vínculo da entrada do ERP, e as comparações passam a usar o pedido novo.'
        ],
        mudou: [
            'Mover uma NF de pedido não altera auditorias que já foram geradas para o pedido antigo, nem associações de SP Data que o preenchimento automático (Fase 8) possa ter criado a partir do pedido errado: se alguma associação parecer estranha, corrija no Editor da NF.',
            'Divergências NF×ERP que continuam aparecendo nos seus dados (ex.: papel SMS NF 947054, 400 na NF contra 300 no ERP; metaraminol NF 35925, 50 contra 48) são diferenças reais entre NF e lançamento, e merecem conferência.',
            'Arquivos alterados: js/11-central-pedido.js, js/17-historico-controle-nfs.js, js/19-erp-reconciliacao.js, js/20-editor-nf.js e js/14-historico-mudancas.js.'
        ],
        testar: ['Abrir o app e esperar uns segundos: deve aparecer o aviso "9 vínculo(s) do ERP alinhado(s) ao pedido da NF" (só na primeira vez). Conferir o pedido 1731 (a NF 390653 não deve mais aparecer lá) e o pedido 1726 (NF 390653 no lugar certo). No Editor de qualquer NF, ver o seletor "Trocar pedido".']
    },
    {
        numero: '2.0.7', nome: 'Editor da NF, link único da NF na cotação e fim das NFs repetidas no Histórico', status: 'concluida',
        implementado: [
            'Editor da NF (tela nova): cabeçalho com fornecedor, CNPJ, número/série, emissão, valor, vencimento, pedido e situação (XML, ERP e nota), mais os dados de pagamento/ERP e as divergências SÓ daquela NF (antes aparecia a auditoria do pedido inteiro). Cada item mostra o fator, a quantidade convertida, o valor unitário e a conferência com o ERP.',
            'No Editor, cada item permite trocar a associação com a cotação (só itens do fornecedor da NF), trocar o produto SP Data (busca por nome ou código) e aplicar qualquer fator de conversão. Tudo é gravado na própria NF salva e na memória de associações (fornecedor e SP Data), então Histórico, Controle, Cotações e Central do pedido mostram o mesmo dado, com a NF recebida, na relação ou arquivada.',
            'Cotação / Central do pedido: o botão "Abrir NF" agora aparece uma vez só, no topo do bloco de cada fornecedor (sempre visível, sem abrir item), e abre o Editor da NF. Saiu a repetição do botão em cada item. O "voltar" do Editor leva de volta à tela de onde você veio.',
            'Histórico de NFs: o registro simples arquivado da mesma NF deixou de aparecer como segunda linha; entra dentro do card da NF ("Nota de pagamento arquivada em..."). Casa pela ligação gravada (nfChave/erpChave) ou, sem ela, pelo número da NF com o fornecedor confirmando; a mesma nota arquivada duas vezes também entra na mesma NF. O card tem o botão "Abrir editor da NF".',
            'Controle de NFs: o mesmo agrupamento vale para NFs arquivadas, não só para as recebidas.'
        ],
        mudou: [
            'Com os seus dados reais (exportação de 10/10): 110 registros repetidos do Histórico viraram parte da NF correspondente, a divergência "lançado 70" da ENOXAPARINA 80MG (NF 156906) não existe mais (eram 30 da NF + 40 de outra NF, da SOMA SP, no mesmo pedido) e o pedido 1731 ficou sem divergências indevidas.',
            'O campo "Fator" e os botões de correção que estavam no card do Histórico (2.0.6) foram para o Editor da NF.',
            'Linhas que continuam separadas de propósito: notas arquivadas com valor diferente do da NF (ex.: uma nota que juntou duas NFs) e notas arquivadas de fornecedores diferentes com o mesmo número.',
            'Arquivos alterados: index.html, js/01-nucleo-config-estado.js, js/05-listeners-dados.js, js/11-central-pedido.js, js/17-historico-controle-nfs.js, js/14-historico-mudancas.js e o novo js/20-editor-nf.js.'
        ],
        testar: ['Em Cotações > pedido 1735 > BMG: tocar em "Abrir NF 30921" e conferir o cabeçalho, as divergências só dessa NF e os itens. No Editor, testar "Aplicar fator", "Associar" e a busca de SP Data (cada uma pede confirmação). Depois, no Histórico, buscar 31335: deve aparecer uma linha só.']
    },
    {
        numero: '2.0.6', nome: 'Exportar dados para diagnóstico, link da NF em toda cotação e fator de conversão livre', status: 'concluida',
        implementado: [
            'Backup dos Dados: novo botão "Exportar dados para diagnóstico (JSON)". Gera um único arquivo com TODAS as coleções do app (notas, histórico, anotações, exceções de conversão, cotações, produtos e associações do SP Data, associações de fornecedor, entradas do ERP, fornecedores, NFs processadas e fornecedores ganhadores) mais as configurações, com contagem por coleção. Só lê os dados; não altera nada.',
            'Central do pedido: todo item que tem NF por XML agora mostra "Abrir NF nnnnn", não só os itens com divergência. Cada fornecedor também ganha, no topo do bloco, a lista das NFs por XML do pedido.',
            'Histórico de NFs (card da NF): em cada item há o campo "Fator" com o botão "Aplicar fator", para colocar qualquer fator de conversão (ex.: 1, 10, 0,5) sem precisar subir o XML de novo. O app mostra o antes e depois da quantidade e do valor unitário e pede confirmação; o total da NF não muda.',
            'O fator aplicado fica lembrado para as próximas NFs do mesmo produto e fornecedor (mesma memória usada pela Entrada de NF).'
        ],
        mudou: [
            'A memória do fator usa o código do produto do fornecedor; se o XML tinha código de barras real, a Entrada de NF pode usar outra chave e não aproveitar a memória (a NF salva é corrigida normalmente).',
            'Arquivos alterados: index.html, js/07-login-conta-backup.js, js/11-central-pedido.js, js/17-historico-controle-nfs.js e js/14-historico-mudancas.js.'
        ],
        testar: ['Em Backup dos Dados, tocar em "Exportar dados para diagnóstico" e conferir que o arquivo é baixado e que o resumo mostra as contagens. Abrir uma cotação com NF por XML (sem divergência) e ver o "Abrir NF". No Histórico, em um item de NF, aplicar um fator e conferir quantidade e valor.']
    },
    {
        numero: '2.0.5', nome: 'Fim das divergências fantasmas do ERP e da NF duplicada: o número da NF manda', status: 'concluida',
        implementado: [
            'Divergência fantasma "faturado × lançado no ERP": a comparação somava as entradas do ERP de TODAS as NFs do pedido e comparava com a NF do app (ex.: NF de 30 un. contra 70 lançadas, sendo 40 de outra NF do mesmo pedido). Agora, quando o item tem NF no app, só conta o ERP da mesma NF (mesmo número), e a mesma NF importada duas vezes no ERP vale uma vez só. Se o ERP da própria NF tiver mesmo uma quantidade diferente, a divergência continua aparecendo.',
            'Uma regra única para juntar NF de XML, NF do relatório do ERP e nota digitada em "Adicionar": mesmo número (sem zeros à esquerda, série ignorada) é a mesma NF. O fornecedor só confirma: nota e NF de fornecedores diferentes com o mesmo número só ficam separadas se o CNPJ, o nome e o valor divergirem (nome cortado pelo ERP, apelido e razão social contam como o mesmo fornecedor).',
            'Controle de NFs: a nota digitada em "Adicionar" (pendente ou já arquivada) passa a se juntar sozinha à NF "Recebida" de mesmo número, em vez de aparecer em duas linhas. ERP importado duas vezes com séries diferentes vira uma linha só.',
            'Histórico de NFs: passa a usar o mesmo pareamento do Controle, então XML e ERP da mesma NF não aparecem mais separados na busca pelo número.'
        ],
        mudou: [
            'Nada é apagado ou alterado no banco: as linhas repetidas são só agrupadas na tela (os registros extras continuam guardados). A ligação nota ↔ NF feita pela tela vale enquanto a nota estiver pendente ou arquivada com o mesmo número.',
            'Arquivos alterados: js/11-central-pedido.js, js/17-historico-controle-nfs.js e js/14-historico-mudancas.js.'
        ],
        testar: ['Abrir a cotação da MEDICAMENTAL (NF 156906): o alerta de "lançado no ERP: 70" deve sumir. No Controle de NFs e no Histórico, buscar uma NF que antes aparecia repetida (XML, ERP e nota digitada) e ver se agora é uma linha só.']
    },
    {
        numero: '2.0.4', nome: 'Da divergência da cotação direto até a NF, com correção da conversão em um toque', status: 'concluida',
        implementado: [
            'Nas divergências da cotação (Central do pedido, comparação por item) aparece um botão "Abrir NF nnnnn" para cada NF citada. Ele abre o Histórico de NFs direto naquela NF, já com os itens à mostra.',
            'No card da NF, cada item mostra de onde veio a quantidade ("XML: 34 × fator 100") e, quando o app enxerga um erro de conversão, oferece a correção pronta: "Voltar à quantidade do XML" e/ou "Igualar à cotação". Basta tocar e confirmar; não precisa digitar nada.',
            'A correção ajusta quantidade, valor unitário (o total da NF não muda) e fator do item na NF salva. Se o mesmo fator errado estiver memorizado para aquele produto e fornecedor (e vale para as próximas NFs), ele é corrigido junto.',
            'Corrigida a quantidade, a divergência some sozinha da cotação, sem precisar marcar "Marcar como resolvido" para algo que na verdade não foi lançado errado.'
        ],
        mudou: [
            'A correção altera só o registro da NF salva no app; o XML original não é modificado. Itens sem fator aplicado (fator 1) só ganham a opção "Igualar à cotação" se existir um fator redondo que faça as quantidades baterem; senão a diferença é real e fica como divergência.',
            'Arquivos alterados: js/11-central-pedido.js, js/17-historico-controle-nfs.js e js/14-historico-mudancas.js.'
        ],
        testar: ['Abrir uma cotação com divergência de quantidade (como a da água para injeção), tocar em "Abrir NF" e conferir se o Histórico abre na NF certa. No item, tocar na correção, confirmar e voltar à cotação para ver a divergência sumir.']
    },
    {
        numero: '2.0.3', nome: 'Lote e validade do texto entram no XML sozinhos (sem confirmar nem digitar)', status: 'concluida',
        implementado: [
            'O app lê lote e validade escritos no nome do produto (ou no infAdProd) e já coloca o <rastro> (nLote, qLote, dVal) no XML corrigido, sem pedir confirmação. O qLote acompanha a quantidade de saída, já convertida pelo fator.',
            'Novos formatos entendidos, incluindo o da BMG ("Lote * Data Venc..: N1154 * 30/06/2031"): rótulo de lote e de validade juntos antes dos valores; "LOTE: x DT VAL: dd/mm/aaaa"; "LT:"; "VENCIMENTO"; "Lote Nº"; validade só com mês e ano (vale o último dia do mês) e ano com 2 dígitos.',
            'Validade impossível (ano fora de 2000–2099, data que não existe ou anterior à emissão) não entra no XML; o item mostra só um aviso, sem campo para preencher.',
            'Cada item mostra "✓ Lote entra no XML" com lote e validade, e um "Remover" (e "Aplicar" para voltar atrás) para o raro caso de não querer aquele lote. O checklist traz uma linha informativa com a contagem.'
        ],
        mudou: [
            'Saíram os botões e campos "Confirmar", "Confirmar todos", "Editar", "Ignorar" e "Informar lote e validade". Lote e validade que não estão no texto continuam sendo lançados por você direto no SPData.',
            'Itens que já têm <rastro> no XML do fornecedor continuam como estavam ("Lote no XML").',
            'Arquivos alterados: js/10-entrada-nf-xml.js, js/12-recurso-lote-rastro.js e js/14-historico-mudancas.js.'
        ],
        testar: ['Abrir o XML da BMG (NF 30921) na Entrada de NF: os 2 itens devem aparecer com "✓ Lote entra no XML" (N1154 · 30/06/2031 e 15C24 · 01/02/2029). Salvar/baixar o XML corrigido e importar no SPData para ver o lote e a validade. Repetir com o XML da CBS (a cânula com ano 3000 deve ficar só com aviso).']
    },
    {
        numero: '2.0.2', nome: 'Banco de dados sob demanda: o app abre só com o essencial', status: 'concluida',
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
// 2.9.4: todos os cadastros ligados a um (matriz/filial/CD associados) — só leitura, inclui o próprio.
function docsDaMesmaEntidadeSpData(doc) {
    if (!doc) return [];
    const porId = {};
    listaFornecedoresSpData.forEach(f => { porId[f.id] = f; });
    const visitado = new Set(), pilha = [doc.id], docs = [];
    while (pilha.length) {
        const id = pilha.pop();
        if (visitado.has(id) || !porId[id]) continue;
        visitado.add(id);
        docs.push(porId[id]);
        (porId[id].entidadesRelacionadas || []).forEach(o => { if (!visitado.has(o)) pilha.push(o); });
    }
    return docs;
}
// 2.9.4: o apelido vale para todos os CNPJs associados. Prioridade: apelido editado à mão neste cadastro > apelido editado
// à mão em outro cadastro do grupo > nome de exibição do relatório deste > de outro do grupo. Nada é gravado.
function apelidoFornecedorDoc(doc) {
    if (!doc) return { nome: '', herdado: false };
    const grupo = docsDaMesmaEntidadeSpData(doc).filter(d => d.id !== doc.id);
    if (doc.nomeExibido && doc.apelidoEditadoManualmente) return { nome: doc.nomeExibido, herdado: false };
    const manual = grupo.find(d => d.nomeExibido && d.apelidoEditadoManualmente);
    if (manual) return { nome: manual.nomeExibido, herdado: true };
    if (doc.nomeExibido) return { nome: doc.nomeExibido, herdado: false };
    const outro = grupo.find(d => d.nomeExibido);
    return outro ? { nome: outro.nomeExibido, herdado: true } : { nome: '', herdado: false };
}
function nomeExibicaoFornecedor(razaoSocial, cnpj) {
    if (cnpj) {
        const doc = listaFornecedoresSpData.find(f => f.cnpjs.some(c => mesmoCnpj(c.cnpj, cnpj)));
        if (doc) return apelidoFornecedorDoc(doc).nome || doc.nomeReal || razaoSocial || '';
    }
    if (!razaoSocial) return '';
    const porNome = listaFornecedoresSpData.find(f => (f.nomeReal || '').toUpperCase() === razaoSocial.toUpperCase());
    if (porNome) return apelidoFornecedorDoc(porNome).nome || porNome.nomeReal;
    return encontrarApelidoFornecedor(razaoSocial) || razaoSocial;
}

// 2.8.0: padrão único de título de NF em todo o app — "APELIDO 1234" (apelido do fornecedor, ou o nome completo
// quando não há apelido, seguido do número da NF).
function tituloFornNf(fornecedor, cnpj, numeroNf) {
    const nome = (nomeExibicaoFornecedor(fornecedor || '', cnpj) || fornecedor || '').trim();
    return [nome, numeroNf ? String(numeroNf).trim() : ''].filter(Boolean).join(' ');
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
    return d.toLocaleDateString('en-CA'); // 2.18.1: data local (toISOString dá a data em UTC)
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

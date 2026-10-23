# language: pt
Funcionalidade: Feedback do primeiro uso real
  Como pessoa física com vários extratos
  Quero importar tudo de uma vez, marcar o que não é gasto e criar minhas categorias
  Para que o Dashboard reflita só o que realmente gastei, sem trabalho repetido

  Cenário: Importar vários arquivos de uma vez
    Quando seleciono nubank_cartao.csv, mercadopago_extrato.pdf e santander_extrato.pdf juntos
    Então vejo o progresso "3 de 3" durante a importação
    E o resultado mostra uma linha por arquivo, cada uma com a quantidade importada e as duplicatas
    E o total geral soma os três arquivos
    E o histórico tem uma importação por arquivo

  Cenário: Arrastar vários arquivos na página
    Quando arrasto nubank_cartao.csv, mercadopago_extrato.pdf e santander_extrato.pdf para a página
    Então cada um é importado com a fonte certa, reconhecida pelo conteúdo

  Cenário: Um arquivo com erro não para o lote
    Quando importo mercadopago_totais_errados.pdf e nubank_cartao.csv juntos
    Então o CSV é importado
    E o PDF mostra "Extrato não conferiu"
    E o total conta 1 arquivo importado e 1 que falhou

  Cenário: Pagamento de fatura pareado automaticamente
    Dado a fatura do cartão Nubank com "Pagamento recebido" de R$ 1.234,56
    Quando importo o extrato da conta com "PAGAMENTO TITULO" de R$ 1.234,56 três dias antes
    Então os dois ficam como "Pagamento de fatura" (Transferência)
    E nenhum dos dois entra nas Saídas do Dashboard

  Cenário: Marcar como pagamento de fatura manualmente
    Dado um extrato com "PAGAMENTO TITULO" de R$ 1.234,56 sem a fatura importada
    Quando escolho "Pagamento de fatura" na seção "Não é gasto" da categoria
    Então o lançamento sai das Saídas
    E posso criar uma regra para os próximos com a mesma descrição

  Cenário: Criar categoria própria
    Dado uma entrada "Crédito Receita Federal restituição" sem categoria
    Quando crio a categoria "Restituição de IR" no seletor
    Então a entrada fica com essa categoria
    E ela aparece em Configurações › Minhas categorias
    E renomear atualiza o lançamento, e remover é bloqueado enquanto algo a usa

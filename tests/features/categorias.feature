# language: pt
Funcionalidade: Categorias e regras
  Como pessoa física
  Quero que meus gastos sejam categorizados sozinhos e poder ensinar o app corrigindo uma vez
  Para que o ranking por categoria mostre para onde meu dinheiro vai

  Cenário: Categorização automática ao importar
    Quando importo nubank_cartao.csv
    Então os lançamentos de comércios conhecidos já têm categoria

  Cenário: Corrigir uma vez vira regra
    Dado um lançamento "Loja Desconhecida" sem categoria, repetido 3 vezes
    Quando mudo a categoria de um deles para "Lazer" e escolho "Criar regra"
    Então os 3 ficam com "Lazer"
    E um novo arquivo com "Loja Desconhecida" entra já como "Lazer"

  Cenário: Só este
    Dado um lançamento "Loja Desconhecida" sem categoria, repetido 3 vezes
    Quando mudo a categoria e escolho "Só este"
    Então só aquele lançamento muda

  Cenário: Regra não sobrescreve categoria do banco nem manual
    Dado um lançamento "Loja Desconhecida" sem categoria, repetido 3 vezes
    Então "IOF de ..." continua "IOF" após criar uma regra que casaria
    E o lançamento que escolhi manualmente continua como escolhi

  Cenário: Regras persistem
    Quando recarrego a página
    Então a regra continua valendo

  Cenário: Prévia ao vivo e texto editável
    Quando escolho a categoria
    Então vejo "N lançamentos existentes serão atualizados" e posso editar o texto da regra

  Cenário: Catálogo filtrado pelo tipo
    Quando abro a categoria de uma saída
    Então só vejo categorias de saída
    E de uma entrada, só categorias de entrada

  Cenário: Transferência não tem categoria editável
    Quando abro o detalhe de "Pagamento recebido"
    Então vejo o motivo e não posso editar a categoria

  Cenário: Ranking do Dashboard por categoria
    Dado que importei nubank_cartao.csv
    Então "Sem categoria" deixa de ser a maior categoria com os extratos de exemplo

  Cenário: Descrição encurtada na lista e completa no detalhe
    Dado um Pix com CPF mascarado e dados da conta
    Então a lista mostra só o 1º trecho e o nome
    E o detalhe mostra a descrição completa

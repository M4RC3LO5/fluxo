# language: pt
Funcionalidade: Importação Nubank
  Como usuário do Fluxo
  Quero importar o extrato da conta e a fatura do cartão do Nubank
  Para ver tudo no mesmo livro-caixa

  Cenário: Importar extrato da conta
    Quando importo nubank_conta.csv pelo card Nubank
    Então vejo "7 lançamentos importados"
    E vejo o aviso da linha ignorada
    E o Pix recebido aparece como Entrada e o Pix enviado como Saída

  Cenário: Importar fatura do cartão
    Quando importo nubank_cartao.csv
    Então compras aparecem como Saída, o estorno como Entrada e o pagamento como Transferência
    E a descrição mantém "Parcela 2/10"

  Cenário: Cartão com categoria do Nubank
    Quando importo nubank_cartao_categoria.csv
    Então os lançamentos mostram a categoria do arquivo

  Cenário: Reimportar extrato da conta
    Dado que importei nubank_conta.csv
    Quando importo nubank_conta.csv de novo
    Então vejo "0 lançamentos importados · 7 duplicatas ignoradas"

  Cenário: CSV desconhecido arrastado na página
    Quando arrasto um CSV com cabeçalho desconhecido
    Então vejo "CSV não reconhecido"

  Cenário: Pagamento de fatura é transferência
    Quando importo nubank_cartao_especiais.csv
    Então "Pagamento recebido" aparece como Transferência com categoria "Pagamento de fatura"
    E "Saldo em atraso" aparece como Transferência

  Cenário: Encargos, IOF e estorno categorizados
    Quando importo nubank_cartao_especiais.csv
    Então multa, juros e IOF de atraso têm categoria "Encargos"
    E o IOF de compra tem categoria "IOF"
    E o estorno aparece como Entrada com categoria "Estorno"

  Cenário: Parcela identificada
    Quando abro o detalhe de "Loja Z - Parcela 2/10"
    Então vejo "Parcela 2 de 10"

  Cenário: Resgate de investimento na conta é transferência
    Quando importo nubank_conta.csv
    Então "Resgate RDB" aparece como Transferência com categoria "Investimentos"

  Cenário: Repetições no mesmo dia somadas por contagem
    Dado que importei nubank_cartao_especiais.csv
    Quando importo nubank_cartao_sobreposto.csv
    Então vejo "1 lançamento importado · 2 duplicatas ignoradas"
    E existem 3 lançamentos "Pedagio Tag" no dia

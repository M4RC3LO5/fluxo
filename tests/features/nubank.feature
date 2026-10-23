# language: pt
Funcionalidade: Importação Nubank
  Como usuário do Fluxo
  Quero importar o extrato da conta e a fatura do cartão do Nubank
  Para ver tudo no mesmo livro-caixa

  Cenário: Importar extrato da conta
    Quando importo nubank_conta.csv pelo card Nubank
    Então vejo "5 lançamentos importados"
    E vejo o aviso da linha ignorada
    E o Pix recebido aparece como Entrada e o Pix enviado como Saída

  Cenário: Importar fatura do cartão
    Quando importo nubank_cartao.csv
    Então compras aparecem como Saída e o pagamento como Entrada
    E a descrição mantém "Parcela 2/10"

  Cenário: Cartão com categoria do Nubank
    Quando importo nubank_cartao_categoria.csv
    Então os lançamentos mostram a categoria do arquivo

  Cenário: Reimportar extrato da conta
    Dado que importei nubank_conta.csv
    Quando importo nubank_conta.csv de novo
    Então vejo "0 lançamentos importados · 5 duplicatas ignoradas"

  Cenário: CSV desconhecido arrastado na página
    Quando arrasto um CSV com cabeçalho desconhecido
    Então vejo "CSV não reconhecido"

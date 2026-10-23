# language: pt
Funcionalidade: Importação Santander (PDF)
  Como usuário do Fluxo
  Quero importar o Extrato Consolidado Inteligente do Santander em PDF
  Para ver os movimentos da conta corrente no livro-caixa, conferidos com os totais impressos

  Cenário: Importar extrato consolidado
    Quando importo santander_extrato.pdf pelo card Santander
    Então vejo "12 lançamentos importados" e o mês do extrato

  Cenário: Data herdada no mesmo dia
    Quando importo santander_extrato.pdf pelo card Santander
    Então os movimentos sem data impressa têm a data do movimento anterior

  Cenário: Débito automático não duplica
    Quando importo santander_extrato.pdf pelo card Santander
    Então o débito automático aparece uma vez só

  Cenário: Transferência entre contas próprias
    Quando importo santander_extrato.pdf pelo card Santander
    Então "PIX RECEBIDO - <titular truncado>" aparece como Transferência
    E o Pix de terceiro aparece como Entrada

  Cenário: Categorias das linhas especiais
    Quando importo santander_extrato.pdf pelo card Santander
    Então tarifa, IOF e juros têm as categorias "Tarifas bancárias" e "Encargos"
    E a remuneração tem a categoria "Rendimentos"
    E o crédito imobiliário tem a categoria "Financiamento imobiliário"

  Cenário: Extrato que não confere
    Quando importo santander_totais_errados.pdf
    Então vejo "Extrato não conferiu" e nada é importado

  Cenário: Reimportar
    Dado que importei santander_extrato.pdf
    Quando importo de novo
    Então vejo "0 lançamentos importados · 12 duplicatas ignoradas"

  Cenário: PDF do Santander arrastado na página
    Quando arrasto santander_extrato.pdf sobre a página
    Então vejo "12 lançamentos importados"

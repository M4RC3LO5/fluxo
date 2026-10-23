# language: pt
Funcionalidade: Transferências entre contas próprias
  Como pessoa física
  Quero que Pix entre as minhas próprias contas não conte como gasto nem como receita
  Para que as Saídas do Dashboard mostrem só o que realmente gastei

  Cenário: Titular aprendido do PDF
    Quando importo mercadopago_extrato.pdf
    Então o nome do titular aparece em Configurações

  Cenário: Pix para conta própria detectado pelo nome
    Dado que importei mercadopago_extrato.pdf
    Quando importo nubank_conta_transf.csv
    Então o Pix enviado ao titular aparece como Transferência
    E não entra nas Saídas do Dashboard

  Cenário: Pareamento entre contas
    Dado que importei mercadopago_extrato.pdf e nubank_conta_transf.csv
    Então o Pix enviado no Nubank e o Pix recebido no Mercado Pago no mesmo dia e valor ficam pareados
    E o detalhe mostra "pareada com"

  Cenário: Desfazer
    Dado que importei mercadopago_extrato.pdf e nubank_conta_transf.csv
    Quando toco em "Não é transferência"
    Então o lançamento volta a ser Saída
    E continua assim após recarregar e após nova importação

  Cenário: Desfazer um par desfaz os dois lados
    Quando toco em "Não é transferência" no Pix pareado
    Então o Pix recebido no Mercado Pago volta a ser Entrada

  Cenário: Marcar manualmente
    Quando marco um Pix de terceiro como transferência entre contas
    Então ele sai das Saídas

  Cenário: Transferência do banco não tem botões
    Quando abro o detalhe de "Pagamento de fatura"
    Então não vejo "Não é transferência" nem "Marcar como transferência"

  Cenário: Configurar o nome do titular
    Dado que importei nubank_conta_transf.csv
    Quando adiciono o nome do titular em Configurações
    Então o Pix para o titular vira transferência
    E ao remover o nome volta a ser Saída

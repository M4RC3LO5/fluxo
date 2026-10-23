# language: pt
Funcionalidade: Importação Mercado Pago (PDF)
  Como usuário do Fluxo
  Quero importar o extrato da conta do Mercado Pago em PDF
  Para ver os movimentos no livro-caixa, conferidos com os totais impressos

  Cenário: Importar extrato
    Quando importo mercadopago_extrato.pdf pelo card Mercado Pago
    Então vejo "12 lançamentos importados" e o período do extrato

  Cenário: Descrição quebrada entre páginas
    Quando importo mercadopago_extrato.pdf pelo card Mercado Pago
    Então o lançamento que cruza a página tem a descrição completa

  Cenário: Transferências e rendimentos
    Quando importo mercadopago_extrato.pdf pelo card Mercado Pago
    Então "Pix recebido <titular>" aparece como Transferência
    E "Pagamento de fatura" aparece como Transferência
    E "Rendimentos" aparece como Entrada com categoria "Rendimentos"
    E "Pix recebido <terceiro>" aparece como Entrada

  Cenário: Extrato que não confere
    Quando importo mercadopago_totais_errados.pdf
    Então vejo "Extrato não conferiu"
    E nenhum lançamento é importado

  Cenário: Reimportar
    Dado que importei mercadopago_extrato.pdf
    Quando importo de novo
    Então vejo "0 lançamentos importados · 12 duplicatas ignoradas"

  Cenário: PDF de outro banco arrastado na página
    Quando arrasto um PDF sem as marcas do Mercado Pago
    Então vejo "PDF não reconhecido"

  Cenário: PDF escaneado, sem texto
    Quando importo um PDF sem texto pelo card Mercado Pago
    Então vejo "PDF sem texto (imagem escaneada) não é suportado"

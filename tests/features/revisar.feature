# language: pt
Funcionalidade: Revisar sem categoria
  Como pessoa física
  Quero categorizar de uma vez os comércios que o app não reconheceu
  Para que o ranking por categoria mostre para onde meu dinheiro vai

  Contexto:
    Dado que importei nubank_cartao_revisar.csv

  Cenário: Grupos ordenados por valor
    Quando abro Revisar
    Então vejo os comércios sem categoria agrupados, do maior total para o menor
    E o cabeçalho mostra "7 lançamentos sem categoria · R$ 620,00"
    E as parcelas aparecem juntas, sem o sufixo "Parcela N/M"

  Cenário: Categorizar um grupo cria regra
    Quando escolho "Lazer" para "Loja Desconhecida A"
    Então todos os lançamentos dela ficam "Lazer" e o grupo sai da lista
    E a regra aparece em Configurações › Minhas regras

  Cenário: Pattern editável
    Quando edito o pattern para um trecho menor
    Então a contagem ao vivo muda antes de confirmar

  Cenário: Ignorar vale só nesta sessão
    Quando ignoro o grupo "Loja Desconhecida B"
    Então ele some da lista
    E volta depois de recarregar a página

  Cenário: Entradas têm o próprio filtro e catálogo
    Quando troco para Entradas e categorizo o estorno como "Reembolso"
    Então só vejo categorias de entrada e o grupo sai da lista

  Cenário: Banner no Dashboard
    Quando abro o Dashboard
    Então vejo "3 sem categoria no mês · Revisar" e ele abre Revisar

  Cenário: Aviso no resultado da importação
    Quando importo o arquivo
    Então o resultado mostra "8 sem categoria · Revisar" e o link abre Revisar

  Cenário: Remover regra
    Dado que criei uma regra para "Loja Desconhecida A"
    Quando removo a regra em Minhas regras
    Então os lançamentos voltam para Sem categoria
    E o que escolhi à mão não muda

  Cenário: Regras padrão ficam recolhidas e só leitura
    Quando abro Configurações
    Então vejo "Regras padrão (N)" recolhida e, ao abrir, sem botão de remover

  Cenário: Tudo categorizado
    Quando não há lançamentos sem categoria
    Então vejo "Tudo categorizado"

# language: pt
Funcionalidade: Dashboard Pessoal
  Como pessoa física
  Quero ver o que entrou, o que saiu e o que sobrou em cada mês
  Para entender meu dinheiro sem somar transferências entre minhas contas

  Contexto:
    Dado que importei os extratos de setembro e outubro de 2026

  Cenário: Entradas, saídas e saldo do mês mais recente
    Quando abro o Dashboard
    Então vejo "outubro/2026"
    E vejo Entradas "R$ 5.000,00", Saídas "R$ 2.290,40" e Saldo "R$ 2.709,60"

  Cenário: Transferências não entram nas contas
    Quando abro o Dashboard
    Então vejo "Transferências: R$ 3.000,00 (2)" e "não entram nas contas"

  Cenário: Navegar pelos meses
    Quando abro o Dashboard e clico em ‹
    Então vejo "setembro/2026" com Entradas "R$ 4.000,00" e Saídas "R$ 900,00"
    E o botão › volta para "outubro/2026"

  Cenário: Selecionar o mês pelo gráfico
    Quando clico na barra de setembro do gráfico de 12 meses
    Então vejo "setembro/2026"

  Cenário: Maiores gastos
    Então "Sem categoria" lidera os gastos por categoria com "80,1%"
    E "Aluguel Imobiliária Centro" lidera os gastos por descrição
    E as parcelas aparecem sem o sufixo "Parcela N/M"

  Cenário: Saídas levam à lista filtrada
    Quando clico em Saídas
    Então vejo os chips "out/2026" e "Saídas" e 9 lançamentos
    E remover um chip amplia a lista e "Limpar" remove todos

  Cenário: Categoria e descrição levam à lista filtrada
    Quando clico na categoria "mercado"
    Então vejo o chip "Categoria: mercado" e 2 lançamentos

  Cenário: Lançamentos sem tipo ficam fora das contas
    Dado uma planilha com lançamentos pagos sem tipo
    Então vejo "2 lançamentos sem tipo"

  Cenário: Controle Pessoal | Contas a pagar só com planilha
    Dado que importei fluxo_exemplo.xlsx
    Então o Dashboard abre em "Pessoal" e posso alternar para "Contas a pagar"
    E sem planilha o controle não aparece

  Cenário: Sem lançamentos
    Quando abro o Dashboard sem dados
    Então vejo "Nenhum dado importado ainda"

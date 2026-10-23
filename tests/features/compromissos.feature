# language: pt
Funcionalidade: Compromissos
  Como pessoa física
  Quero ver o que já está comprometido todo mês
  Para saber quanto do meu dinheiro está preso antes de gastar

  Contexto:
    Dado que importei nubank_cartao_compromissos.csv

  Cenário: Assinatura detectada com IOF
    Quando abro Compromissos
    Então a assinatura internacional aparece com custo mensal = valor + IOF
    E o custo anual é o mensal vezes 12 e mostra os meses vistos

  Cenário: Pedágio não é assinatura
    Quando abro Compromissos
    Então o pedágio não aparece em recorrentes

  Cenário: Assinatura parada fica recolhida
    Quando abro Compromissos
    Então a assinatura que parou aparece em "Parados" com o mês em que parou

  Cenário: Parcelas em aberto
    Quando abro Compromissos
    Então vejo "4/6 · faltam 2" com o valor restante e o mês final

  Cenário: Comprometido por mês
    Quando abro Compromissos
    Então o total do topo = recorrentes ativos + parcelas do próximo mês
    E o gráfico mostra os próximos 12 meses

  Cenário: Custos bancários levam à lista
    Quando abro Compromissos
    Então vejo IOF, Encargos, Tarifas e o total dos últimos 12 meses
    E tocar em IOF abre os lançamentos da categoria IOF

  Cenário: Marcar como não recorrente
    Quando toco em "Não é recorrente"
    Então o item some e continua sumido após recarregar
    E posso desfazer em Configurações

  Cenário: Card no Dashboard
    Quando abro o Dashboard
    Então vejo "Compromissos: R$ X/mês" e ele abre a tela

  Cenário: Sem dados
    Quando abro Compromissos sem lançamentos
    Então vejo "Nenhum dado importado ainda"

# language: pt
Funcionalidade: Dashboard financeiro
  Como usuário do Fluxo
  Quero visualizar KPIs e gráficos após importar lançamentos
  Para entender minha situação financeira

  Contexto:
    Dado que estou na tela de Importações
    E seleciono a fonte "Planilha Excel"
    E anexo o arquivo "tests/fixtures/fluxo_exemplo.xlsx"
    E clico em "Importar"
    E vejo a mensagem "15 registros importados com sucesso"
    Quando acesso o menu "Dashboard"

  Cenário: KPIs principais exibem valores da importação
    Então o card "Total Previsto" exibe "R$ 46.030,00"
    E o card "Total Pago" exibe "R$ 17.590,00"
    E o card "Total de Lançamentos" exibe "15"

  Cenário: Gráfico Previsto vs Pago renderiza todos os responsáveis
    Então o gráfico "Comparativo Previsto vs Pago" exibe barras para "Marcelo", "Carlos" e "Ana"
    E a barra "Previsto" de "Marcelo" corresponde a "R$ 25.350,00"

  Cenário: Gráfico de rosca por responsável renderiza completo
    Então o gráfico "Distribuição por Responsável" exibe 3 fatias

  Cenário: Gráfico por pagador renderiza todos os pagadores
    Então o gráfico "Distribuição por Pagador" exibe barras horizontais para "Equipe", "Empresa Alpha", "Imobiliária Centro" e "TechSoft Ltda"

  Cenário: Evolução dos vencimentos exibe valores mensais
    Então o gráfico "Evolução dos Vencimentos" exibe valores maiores que zero em "10/26" e "11/26"

  Cenário: Próximos vencimentos exibem valor
    Então cada item de "Próximos Vencimentos" exibe um valor em reais diferente de "R$ –"

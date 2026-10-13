# language: pt
Funcionalidade: Dashboard no celular e drill-down
  Como usuário do Fluxo
  Quero ver o resumo financeiro sem rolar demais e ir direto aos lançamentos
  Para entender e agir sobre minhas finanças rapidamente

  Contexto:
    Dado que a data atual é "10/10/2026"
    E importei o arquivo "tests/fixtures/fluxo_exemplo.xlsx"
    Quando acesso o menu "Dashboard"

  Cenário: KPIs em duas colunas no celular
    Dado que estou em um celular
    Então os cards "Total Previsto" e "Total Pago" estão na mesma linha
    E os cards "Total Pendente" e "Vencido Não Pago" estão na mesma linha
    E a página não tem rolagem horizontal

  Cenário: Próximos vencimentos antes dos gráficos no celular
    Dado que estou em um celular
    Então a seção "Próximos Vencimentos" aparece antes da seção de gráficos

  Cenário: Seletor de gráficos no celular
    Dado que estou em um celular
    Então vejo os 4 segmentos "Comparativo", "Pessoas", "Pagadores" e "Evolução" sem rolagem
    E apenas o gráfico "Comparativo" está visível
    Quando toco no segmento "Pessoas"
    Então o gráfico de rosca está visível com 3 fatias
    E o gráfico "Comparativo" não está visível

  Cenário: Ranking mostra os 3 primeiros e expande
    Dado que estou em um celular
    Então "Centros Financeiros" exibe 3 itens
    Quando toco em "Ver todos (6)" em "Centros Financeiros"
    Então "Centros Financeiros" exibe 6 itens

  Esquema do Cenário: Drill-down do dashboard para lançamentos
    Quando toco em "<origem>"
    Então estou na página "Lançamentos"
    E vejo <qtd> lançamentos

    Exemplos:
      | origem                             | qtd |
      | responsável Marcelo                | 7   |
      | centro Comercial                   | 4   |
      | alerta Vencidos não pagos          | 1   |
      | KPI Total Pago                     | 4   |
      | KPI Total Pendente                 | 10  |
      | KPI Total Previsto                 | 15  |

  Cenário: Drill-down reflete o filtro no celular
    Dado que estou em um celular
    Quando toco em "responsável Marcelo"
    Então o botão de filtros exibe "Filtros (1)"
    Quando toco em "Filtros"
    Então o responsável selecionado no painel é "Marcelo"

  Cenário: Computador mantém os 4 gráficos em grade
    Dado que estou em um computador
    Então os 4 gráficos estão visíveis ao mesmo tempo
    E não vejo abas de gráfico

  Cenário: Arrastar o gráfico troca de visão
    Dado que estou em um celular
    Quando arrasto o gráfico para a esquerda
    Então o segmento "Pessoas" está ativo
    Quando arrasto o gráfico para a direita
    Então o segmento "Comparativo" está ativo

  Cenário: Botão de olho mostra os valores no gráfico
    Dado que estou em um celular
    Quando toco no botão "Mostrar valores"
    Então o botão "Ocultar valores" está pressionado

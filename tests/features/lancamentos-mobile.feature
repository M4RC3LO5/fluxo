# language: pt
Funcionalidade: Lançamentos no celular
  Como usuário do Fluxo no celular
  Quero ver meus lançamentos em cards
  Para consultar tudo sem rolar a tela para os lados

  Contexto:
    Dado que acesso o app em um celular
    E a data atual é "10/10/2026"
    E importei o arquivo "tests/fixtures/fluxo_exemplo.xlsx"
    Quando acesso o menu "Lançamentos"

  Cenário: Lançamentos aparecem em cards, sem tabela
    Então vejo 15 cards de lançamento
    E a tabela de lançamentos não está visível
    E a página não tem rolagem horizontal

  Cenário: Card exibe as informações principais
    Então o card "Recebimento cliente A" exibe "R$ 5.000,00", "28/10/2026", "Ana" e "Pago"

  Cenário: Cards agrupados por mês de vencimento
    Então vejo o grupo "Outubro 2026" com 6 cards
    E vejo o grupo "Novembro 2026" com 9 cards

  Cenário: Resumo exibe quantidade e total previsto
    Então o resumo exibe "15 lançamentos" e "R$ 46.030,00"

  Esquema do Cenário: Chips de status filtram com um toque
    Quando toco no chip "<status>"
    Então vejo <cards> cards de lançamento
    E o resumo exibe "<previsto>"

    Exemplos:
      | status   | cards | previsto     |
      | Pago     | 4     | R$ 17.590,00 |
      | Pendente | 10    | R$ 25.640,00 |
      | Vencido  | 1     | R$ 2.800,00  |
      | Todos    | 15    | R$ 46.030,00 |

  Cenário: Painel de filtros aplica responsável e mostra contagem
    Quando toco em "Filtros"
    E seleciono o responsável "Marcelo"
    E toco em "Aplicar"
    Então vejo 7 cards de lançamento
    E o botão de filtros exibe "Filtros (1)"

  Cenário: Ordenar por menor valor remove agrupamento
    Quando toco em "Filtros"
    E seleciono a ordenação "Menor valor"
    E toco em "Aplicar"
    Então o primeiro card é "Material escritório"
    E não vejo cabeçalhos de grupo

  Cenário: Detalhe abre como painel inferior
    Quando toco no card "Recebimento cliente A"
    Então o painel de detalhe exibe Pagador "Empresa Alpha"
    E o painel de detalhe exibe Observações "NF 1042"
    Quando toco fora do painel
    Então o painel de detalhe não está visível

  Cenário: Computador mantém a tabela
    Dado que acesso o app em um computador
    Quando acesso o menu "Lançamentos"
    Então vejo a tabela com 15 linhas
    E não vejo cards de lançamento

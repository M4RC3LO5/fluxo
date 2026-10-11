# language: pt
Funcionalidade: Lista de lançamentos
  Como usuário do Fluxo
  Quero filtrar, ordenar e detalhar meus lançamentos
  Para encontrar rapidamente o que preciso pagar ou receber

  Contexto:
    Dado que a data atual é "10/10/2026"
    E importei o arquivo "tests/fixtures/fluxo_exemplo.xlsx"
    Quando acesso o menu "Lançamentos"

  Cenário: Lista exibe todos os lançamentos importados
    Então vejo "15 de 15 registros"
    E a tabela exibe 15 linhas
    E o rodapé exibe Previsto "R$ 46.030,00"

  Cenário: Ordenação padrão por vencimento crescente
    Então a primeira linha é "Recebimento cliente D - Atraso" com vencimento "05/10/2026"

  Esquema do Cenário: Filtro por status
    Quando seleciono o status "<status>"
    Então a tabela exibe <linhas> linhas
    E o rodapé exibe Previsto "<previsto>"

    Exemplos:
      | status   | linhas | previsto      |
      | Pago     | 4      | R$ 17.590,00  |
      | Pendente | 10     | R$ 25.640,00  |
      | Vencido  | 1      | R$ 2.800,00   |

  Cenário: Filtro por responsável
    Quando seleciono o responsável "Marcelo"
    Então a tabela exibe 7 linhas
    E o rodapé exibe Previsto "R$ 25.350,00"

  Cenário: Filtro por centro de custo
    Quando seleciono o centro "Comercial"
    Então a tabela exibe 4 linhas
    E o rodapé exibe Previsto "R$ 18.500,00"

  Cenário: Busca por descrição
    Quando busco por "aluguel"
    Então a tabela exibe 2 linhas

  Cenário: Busca por pagador
    Quando busco por "Empresa"
    Então a tabela exibe 4 linhas

  Cenário: Filtros combinados
    Quando seleciono o status "Pendente"
    E seleciono o responsável "Carlos"
    Então a tabela exibe 3 linhas

  Cenário: Limpar filtros restaura a lista
    Dado que selecionei o status "Pago"
    Quando clico em "Limpar filtros"
    Então a tabela exibe 15 linhas

  Cenário: Ordenar por valor previsto crescente
    Quando clico no cabeçalho "Previsto"
    Então a primeira linha é "Material escritório"

  Cenário: Modal de detalhe exibe todos os campos
    Quando clico na linha "Recebimento cliente A"
    Então o modal exibe Pagador "Empresa Alpha"
    E o modal exibe Tipo "Receita"
    E o modal exibe Observações "NF 1042"
    Quando clico no botão fechar
    Então o modal não está visível

  Cenário: Estado vazio sem importação
    Dado que não importei nenhum arquivo
    Quando acesso o menu "Lançamentos"
    Então vejo "Nenhum dado importado"
    E vejo o botão "Ir para Importações"

  Esquema do Cenário: Busca encontra qualquer informação do lançamento
    Quando busco por "<termo>"
    Então a tabela exibe <linhas> linhas

    Exemplos:
      | termo       | linhas | campo          |
      | Carlos      | 4      | responsável    |
      | Tecnologia  | 2      | centro         |
      | NF 1042     | 1      | observação     |
      | manutencao  | 1      | sem acento     |
      | 8.200       | 2      | valor          |
      | 15/11/2026  | 1      | vencimento     |
      | vencido     | 1      | status         |
      | receita     | 4      | tipo           |

  Cenário: Fechar modal clicando fora
    Quando clico na linha "Recebimento cliente A"
    E clico fora do modal
    Então o modal não está visível

  Cenário: Fechar modal com Esc
    Quando clico na linha "Recebimento cliente A"
    E pressiono a tecla "Escape"
    Então o modal não está visível

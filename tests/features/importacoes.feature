# language: pt
Funcionalidade: Importação em um passo
  Como usuário do Fluxo
  Quero importar meu arquivo com o mínimo de ações
  Para ver minhas finanças rapidamente

  Contexto:
    Dado que a data atual é "10/10/2026"
    E estou na página "Importações"

  Cenário: Clicar no card abre o seletor de arquivo
    Quando clico no card "Planilha Excel"
    Então o seletor de arquivo abre aceitando ".xlsx"

  Cenário: Escolher o arquivo importa sem passos extras
    Quando escolho o arquivo "tests/fixtures/fluxo_exemplo.xlsx" no card "Planilha Excel"
    Então vejo "15 lançamentos importados"
    E vejo a versão "fluxo_exemplo"
    E vejo os botões "Ver Dashboard" e "Ver Lançamentos"

  Cenário: Ir para lançamentos após importar
    Quando escolho o arquivo "tests/fixtures/fluxo_exemplo.xlsx" no card "Planilha Excel"
    E clico em "Ver Lançamentos"
    Então estou na página "Lançamentos" com 15 lançamentos

  Cenário: Arquivo com extensão errada é recusado
    Quando escolho o arquivo "extrato.csv" no card "Planilha Excel"
    Então vejo o erro "Arquivo .csv não é aceito pela fonte Planilha Excel. Envie um .xlsx."
    E nenhum lançamento é importado

  Esquema do Cenário: Fontes ainda não disponíveis
    Então o card "<fonte>" exibe "Em breve"
    E clicar no card "<fonte>" não abre o seletor de arquivo

    Exemplos:
      | fonte        |
      | Nubank       |
      | Mercado Pago |
      | Santander    |

  Cenário: Arrastar o arquivo sobre o card importa
    Dado que estou em um computador
    Quando arrasto o arquivo "tests/fixtures/fluxo_exemplo.xlsx" sobre o card "Planilha Excel"
    Então vejo "15 lançamentos importados"

  Cenário: Arrastar o arquivo em qualquer lugar detecta a fonte
    Dado que estou em um computador
    Quando arrasto o arquivo "tests/fixtures/fluxo_exemplo.xlsx" sobre a página
    Então vejo "15 lançamentos importados"

  Cenário: Celular orienta o toque e não rola para os lados
    Dado que estou em um celular
    Então o card "Planilha Excel" exibe "Toque para escolher o arquivo"
    E a página não tem rolagem horizontal

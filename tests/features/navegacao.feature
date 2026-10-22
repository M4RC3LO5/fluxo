# language: pt
Funcionalidade: Navegação mobile first
  Como usuário do Fluxo no celular ou no computador
  Quero navegar entre as áreas do app de forma adequada ao meu dispositivo
  Para usar o app com conforto em qualquer tela

  Cenário: Celular exibe barra inferior com 3 itens
    Dado que acesso o app em um celular
    Quando abro a página "Dashboard"
    Então vejo a barra de navegação inferior
    E a barra exibe os itens "Dashboard", "Lançamentos" e "Importar"
    E a barra lateral não está visível

  Esquema do Cenário: Celular navega pela barra inferior
    Dado que acesso o app em um celular
    E estou na página "Dashboard"
    Quando toco no item "<item>" da barra inferior
    Então a URL termina com "<rota>"
    E o item "<item>" aparece como ativo

    Exemplos:
      | item        | rota         |
      | Lançamentos | /lancamentos |
      | Importar    | /importacoes |
      | Dashboard   | /dashboard   |

  Cenário: Itens da barra inferior têm área de toque adequada
    Dado que acesso o app em um celular
    Então cada item da barra inferior tem pelo menos 44 por 44 pixels

  Esquema do Cenário: Celular não tem rolagem horizontal
    Dado que acesso o app em um celular
    Quando abro a página "<pagina>"
    Então a página não tem rolagem horizontal

    Exemplos:
      | pagina      |
      | Dashboard   |
      | Lançamentos |
      | Importações |

  Cenário: Conteúdo não fica escondido atrás da barra inferior
    Dado que acesso o app em um celular
    E estou na página "Importações"
    Quando rolo até o fim da página
    Então o último elemento do conteúdo fica acima da barra inferior

  Cenário: Computador exibe barra lateral e oculta barra inferior
    Dado que acesso o app em um computador
    Quando abro a página "Dashboard"
    Então vejo a barra lateral
    E a barra de navegação inferior não está visível

  Cenário: Item ativo da barra inferior é enfatizado
    Dado que acesso o app em um celular
    Quando abro a página "Lançamentos"
    Então o item "Lançamentos" da barra inferior tem aria-current "page"
    E apenas um item da barra inferior está ativo
    E o topo exibe o título "Lançamentos"

  Cenário: Navegar para outra página abre no topo
    Dado que acesso o app em um celular
    E importei o arquivo "tests/fixtures/fluxo_exemplo.xlsx"
    E estou na página "Dashboard" rolada até o fim
    Quando toco no item "Lançamentos" da barra inferior
    E toco no item "Dashboard" da barra inferior
    Então a página está no topo

  Cenário: Voltar restaura a posição anterior
    Dado que acesso o app em um celular
    E importei o arquivo "tests/fixtures/fluxo_exemplo.xlsx"
    E estou na página "Dashboard" rolada até o fim
    Quando toco no item "Lançamentos" da barra inferior
    E uso o botão voltar do navegador
    Então a página "Dashboard" volta para a posição em que eu estava

  Cenário: Tocar no item ativo volta ao topo
    Dado que acesso o app em um celular
    E importei o arquivo "tests/fixtures/fluxo_exemplo.xlsx"
    E estou na página "Dashboard" rolada até o fim
    Quando toco no item "Dashboard" da barra inferior
    Então a página está no topo

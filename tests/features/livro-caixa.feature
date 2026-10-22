# language: pt
Funcionalidade: Livro-caixa acumulado
  Como usuário do Fluxo
  Quero que cada importação some lançamentos aos que já tenho
  Para manter um único livro-caixa sem duplicar o que já importei

  Cenário: Importações se somam
    Dado que importei fluxo_exemplo.xlsx
    Quando importo fluxo_categorias.xlsx
    Então o total de lançamentos é a soma dos dois arquivos

  Cenário: Reimportar o mesmo arquivo
    Dado que importei fluxo_exemplo.xlsx
    Quando importo fluxo_exemplo.xlsx de novo
    Então vejo "0 lançamentos importados · 15 duplicatas ignoradas"
    E o total de lançamentos não muda

  Cenário: Repetição dentro do mesmo arquivo é mantida
    Quando importo fluxo_duplicada.xlsx
    Então 3 lançamentos são importados

  Cenário: Remover importação remove só os lançamentos dela
    Dado que importei fluxo_exemplo.xlsx e fluxo_categorias.xlsx
    Quando removo a importação de fluxo_categorias.xlsx e confirmo
    Então restam só os lançamentos de fluxo_exemplo.xlsx
    E isso se mantém após recarregar a página

  Cenário: Migração do schema 2
    Dado dados salvos no schema 2 com 2 versões no histórico e uma versão ativa
    Quando abro o app
    Então os lançamentos continuam visíveis
    E o histórico mostra 1 importação
    E o schema salvo é 3

  Cenário: Aba Versões removida
    Quando acesso /versoes
    Então sou levado para /importacoes
    E a barra inferior tem 3 itens

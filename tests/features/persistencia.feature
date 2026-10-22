# language: pt
Funcionalidade: Persistência local
  Como usuário do Fluxo
  Quero que meus dados continuem salvos no navegador
  Para não perder as importações ao recarregar a página

  Cenário: Dados sobrevivem ao recarregar
    Dado que importei fluxo_exemplo.xlsx
    Quando recarrego a página
    Então o dashboard mostra os mesmos KPIs
    E o Histórico de Importações em /importacoes lista a importação

  Cenário: Remover versão persiste
    Dado que importei fluxo_exemplo.xlsx
    Quando removo a versão no Histórico de Importações e recarrego a página
    Então não há lançamentos

  Cenário: Primeira abertura sem dados
    Dado um navegador sem dados salvos
    Quando abro o app
    Então vejo o estado vazio sem erros no console

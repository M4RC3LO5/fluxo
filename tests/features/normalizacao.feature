# language: pt
Funcionalidade: Normalização de lançamentos
  Como usuário do Fluxo
  Quero que todo lançamento siga o mesmo modelo, venha de onde vier
  Para ver categoria e tipo separados do centro de custo

  Cenário: Categoria e centro de custo separados
    Dado que importei fluxo_categorias.xlsx
    Quando abro o detalhe de um lançamento
    Então vejo a Categoria e o Centro de custo com valores distintos

  Cenário: Tipo derivado da coluna
    Dado que importei fluxo_categorias.xlsx
    Então lançamentos "Receita" aparecem como Entrada e "Despesa" como Saída

  Cenário: Migração de dados do schema 1
    Dado dados salvos no schema 1
    Quando abro o app
    Então os lançamentos continuam visíveis
    E aparecem como "Sem categoria"

  Cenário: Planilha antiga sem coluna Categoria
    Dado que importei fluxo_exemplo.xlsx
    Então os lançamentos aparecem como "Sem categoria"

# TibiaWiki Filtro

Extensao Chrome que adiciona filtros dinamicos nas tabelas do TibiaWiki BR (https://www.tibiawiki.com.br) e bloqueia anuncios/popups da pagina.

## Bloqueio de ads

Via `declarativeNetRequest` a extensao bloqueia requisicoes aos dominios usados pelo wiki pra servir anuncios:

- `banners.tibiabr.com` (Revive ad server)
- `premiumads.com.br` (PremiumAds / DFP)
- `googletagmanager.com`, `google-analytics.com`, `googlesyndication.com`, `doubleclick.net`, `adservice.google.com`
- `connect.facebook.net`, `facebook.com/tr` (Meta Pixel)

Alem do bloqueio de rede:
- CSS esconde `<ins data-revive-zoneid>` e outros containers de ad
- MutationObserver remove elementos de ad injetados dinamicamente
- Override de `window.open` (main world) mata popunders que tentam abrir URL de rede de anuncios

## Como funciona

Em qualquer pagina com tabela (Armaduras, Capacetes, Espadas, Clavas, Machados, Escudos, Calcas, Botas, Aneis, Ferramentas, Livros, Runas, etc.), a extensao:

1. Detecta as tabelas
2. Inspeciona as colunas e **infere o tipo de cada uma**
3. Monta um painel de filtros com a UI apropriada pra cada coluna

### Tipos de coluna detectados

| Tipo | Quando | UI |
|------|--------|-----|
| **Nome** | cabecalho "Nome" / "Name" | busca texto |
| **Numero** | celulas sao so numeros com muitos valores distintos | min / max |
| **Numero-enum** | celulas sao numeros com ≤ 8 valores distintos (Slots, Tier, Mãos, etc.) | checkboxes dos valores, ordenados |
| **Vocacao** | cabecalho contem "Voc" ou valores com `Knights/Paladins/Sorcerers/Druids/Monks/Todas` | checkboxes; `Todas` sempre passa; `Sorcerers and Druids` casa com Sorcerer **ou** Druid |
| **Elemento** | cabecalho contem "Proteção" / "Dano Elemental" ou valores com padrao `Fire +8%` / `46 Energy` | checkboxes dos elementos + min/max em `%` (aceita negativo). Ex: Fire com min=-10 max=5 acha items com Fire entre -10% e 5% |
| **Enum** | poucos valores distintos (Mãos = Uma/Duas, Agrupavel = Sim/Nao...) | checkboxes dos valores |
| **Texto** | qualquer outro (Bonus, Atributos, Dropa de) | busca texto |

### Regras importantes

- `Todas` e `Todos` na coluna Voc sempre passam qualquer filtro de vocacao
- `Sorcerers and Druids` casa com Sorcerer **ou** Druid (OR entre vocacoes da mesma celula)
- Proteção aceita range com numero negativo — util pra achar items sem penalidade: `Fire min=0` exclui `Fire -6%`
- Se uma coluna so tem valores vazios (`Nenhum`, `-`, `Ninguém`), ela e ignorada
- Funciona em **qualquer** tabela da wiki que tenha `<th>` no cabecalho e 3+ linhas de dados

## Como instalar

1. Abra `chrome://extensions/` no Chrome
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactacao** (Load unpacked)
4. Selecione a pasta `chrome-ext-tibiawiki-filter`
5. Vai em qualquer pagina de categoria no TibiaWiki, ex: https://www.tibiawiki.com.br/wiki/Armaduras

Depois de editar o codigo, volte em `chrome://extensions/` e clique no botao **Atualizar** do card da extensao.

## Arquivos

- `manifest.json` — Manifest V3, content script nas paginas `*.tibiawiki.com.br/*`
- `content.js` — detecta tabelas, infere tipos de coluna, monta painel
- `styles.css` — estilo dourado do painel
- `test/index.html` — harness local com Armaduras, Espadas e Ferramentas pra validar sem instalar

## Exemplo de uso

Pagina: https://www.tibiawiki.com.br/wiki/Capacetes

- Quero ver so capacetes **de Sorcerer ou usaveis por Todos** → check `Sorcerer` na coluna Voc
- Com **Fire ≥ 5%** → check `Fire` na coluna Proteção, `≥ %` = 5
- Nivel ate 200 → `max` = 200 na coluna Lvl
- Sem penalidade em Ice → check `Ice`, `≥ %` = 0 (exclui negativos)

Os filtros combinam em AND: todas as condicoes precisam passar.

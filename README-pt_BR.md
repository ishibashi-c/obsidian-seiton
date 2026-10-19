# Seiton

[English](README.md) · [日本語](README-ja.md) · [Deutsch](README-de.md) · [Español](README-es.md) · [Français](README-fr.md) · [한국어](README-ko.md) · [Português](README-pt_BR.md) · [简体中文](README-zh_cn.md)

Registre primeiro; encontre e reutilize quando precisar.

Seiton é um plugin do Obsidian para guardar notas, referências, tarefas e registros de leitura em um Vault baseado em Markdown. Você não precisa escolher uma pasta ou tags ao salvar: deixe o item na caixa de entrada e organize depois.

> As capturas e o GIF usam notas fictícias. Seiton ainda não está listado no diretório de plugins do Obsidian.

![Fluxo do Seiton: registrar, navegar e organizar](docs/images/readme/workflow.gif)

## Instalar a versão de desenvolvimento

Requer Obsidian 1.13.7 ou posterior. Para compilar o código-fonte, você também precisa de Git, Node.js e npm. A instalação pelo diretório de Plugins da Comunidade ainda não está disponível.

1. Obtenha o código-fonte e compile:

   ```sh
   git clone https://github.com/ishibashi-c/obsidian-seiton.git
   cd obsidian-seiton
   npm ci
   npm run build
   ```

2. Crie `<Vault>/.obsidian/plugins/seiton/` e copie `main.js`, `manifest.json` e `styles.css` do repositório para essa pasta.
3. Recarregue o Obsidian e ative Seiton em **Configurações → Plugins da Comunidade**. Na configuração inicial, escolha o idioma, os tipos ativos e os módulos opcionais.

## Registrar, encontrar e organizar

1. Registre uma ideia rápida na página inicial ou crie uma nota estruturada.
2. Deixe na caixa de entrada o que ainda não consegue classificar. Tipo, pasta e tags podem ficar para depois.
3. Pesquise nas notas do Seiton e nas pastas adicionais configuradas ou explore a biblioteca por pasta, tipo, tag e lista.
4. Quando fizer sentido, altere a pasta ou os metadados da nota, ou mova-a para o arquivo.

### Escolher os módulos opcionais

Início, Pesquisa, Biblioteca, organização da caixa de entrada e Arquivo apoiam o fluxo principal. Módulos opcionais — como Estante, revisão de memos, cartões ricos e barra de ferramentas do editor — podem ser ativados ou desativados nas Configurações.

<details>
<summary>Ver capturas de Início, Biblioteca e organização</summary>

![Página inicial com registro rápido e áreas principais](docs/images/readme/home.png)

![Biblioteca com filtros por pasta, tipo e lista](docs/images/readme/library.png)

![Caixa de entrada com metadados editáveis](docs/images/readme/organize.png)

</details>

## Suas notas e o acesso à rede

As notas continuam sendo arquivos Markdown comuns no Vault. O Seiton preserva campos de frontmatter desconhecidos e as notas locais continuam disponíveis sem rede. Registrar, pesquisar e organizar não exige IA.

### Ferramentas externas de IA são opcionais

O Seiton não inclui nem chama um modelo de IA e não envia o conteúdo do Vault para serviços de IA. Se você usar uma ferramenta externa, ela pode preparar uma proposta de organização em Markdown. Confira no Seiton os destinos e metadados sugeridos e escolha quais alterações aplicar.

### Recursos que usam a rede

O Seiton não tem conta hospedada, análise, telemetria, publicidade ou LLM integrado. As solicitações de rede se limitam a recursos usados ou ativados explicitamente, como metadados de clipes, busca de livros e consulta opcional a bibliotecas japonesas. Consulte [privacidade e rede](docs/privacy-and-network.md) para ver destinos e dados. Não salve como clipe URLs com tokens privados.

Os clipes Web obtêm metadados e imagens da página salva e dos servidores de imagens indicados por ela. O serviço de favicons do Google fornece ícones alternativos de domínio. openBD e Open Library fornecem metadados por ISBN e capas; Open Library também permite buscar por título e autor.

A consulta a bibliotecas pelo Calil e a busca de municípios e endereços pela autoridade geoespacial do Japão (GSI) estão disponíveis apenas na interface japonesa e são destinadas a bibliotecas no Japão. Calil exige sua própria chave de API. Essas funções de biblioteca ficam ocultas em outros idiomas; a Estante e a busca de livros continuam disponíveis.

## Desenvolvimento

| Comando | Função |
|---|---|
| `npm test` | Executar testes |
| `npm run build` | Verificar tipos e compilar o plugin |
| `npm run harness` | Abrir UI Lab |
| `npm run lint` | Executar lint |
| `npm run release:check` | Executar testes, ambas as compilações e verificações de publicação |

[Especificação do produto](spec.md) · [Roteiro de implementação](docs/implementation-roadmap.md) · [Rotas e dados de teste do UI Lab](docs/ui-mock-map.md) · [Checklist de publicação](docs/release-checklist.md) · [Regras de desenvolvimento](AGENTS.md)

## Licença e fontes de dados

MIT © 2026 IshibashiCustomize. Consulte [LICENSE](LICENSE) e [avisos de terceiros](THIRD_PARTY_NOTICES.md). Fontes de dados e capas: [openBD](https://openbd.jp/) e [Open Library](https://openlibrary.org/developers/api).

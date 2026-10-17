---
description: Gera ou atualiza o CHANGELOG.md e o arquivo de release em docs/releases/ sem realizar commits automáticos.
---

# Workflow: Gerar Changelog

## Política do Resumo Executivo (obrigatória)

O **Resumo Executivo** é o texto **para usuários finais** (quem usa o aplicativo no dia a dia). Ele deve ser **sempre gerado** neste foco e aparecer **nos dois lugares com o mesmo propósito e a mesma mensagem**:

1. **`CHANGELOG.md`** — subseção `### Resumo Executivo` logo abaixo do cabeçalho `## [X.Y.Z] - data`.
2. **`docs/releases/<MM.mm>/<MM.mm.rr>.md`** — seção `## 📝 Resumo Executivo`.

**Regras de conteúdo (usuário final):**

- Descreva **o que muda na experiência**: telas mais rápidas, menos erros, novos recursos compreensíveis, correções que o usuário percebe.
- Use linguagem **simples e direta** (ex.: “listas mais rápidas”, “evita envio duplicado”, “cadastro mais consistente”).
- **Não inclua** neste resumo: refatorações internas, nomes de frameworks/bibliotecas, migrations ou scripts de banco, comandos shell só para CI, reorganização de pastas ou docs internas, detalhes de API, logs técnicos etc.
- Itens **somente operacionais ou para automação** (ex.: ajuste de workflow de release, bump de versão) **não entram** no Resumo Executivo; podem ir nas seções técnicas do arquivo de release (`🔧 Modificações`, `🏗️ Alterações Estruturais`) e nas categorias detalhadas do `CHANGELOG.md` (`### ✨ Adicionado`, `### 🔄 Modificado`…).

**Consistência entre arquivos:**

- O texto do Resumo Executivo em `CHANGELOG.md` e em `docs/releases/...` deve ser **o mesmo** (um ou dois parágrafos curtos).

**Regeneração:**

- Ao gerar ou atualizar o changelog da versão, **reescreva** o Resumo Executivo com base nos commits atuais e nesta política.
- **Não preserve** o Resumo Executivo antigo por padrão; só mantenha texto anterior se o solicitante pedir explicitamente.

---

## Passos

1. **Organizar especificações executadas**:
   - Verifique quais arquivos de especificação (arquivos `.md` localizados na raiz do diretório [docs/](file:///Users/guilherme/testes/app_farm_aura/docs)) possuem a marcação `# SPEC EXECUTADA` ou o status `Status | Concluído` em seu conteúdo.
   - Mova esses arquivos para dentro da pasta `docs/executed/`. Crie a pasta `docs/executed/` caso ela não exista.

2. **Pergunte** o nome da branch de destino (a branch para comparar, ex.: `main` ou `develop`).

3. **Obtenha a versão atual** lendo obrigatoriamente o campo `"version"` nos dois arquivos da aplicação:
   - [client/package.json](file:///Users/guilherme/testes/app_farm_aura/client/package.json)
   - [server/package.json](file:///Users/guilherme/testes/app_farm_aura/server/package.json)
   - **Regra Obrigatória**: As versões do `client` e do `server` devem **sempre andar juntas e ser atualizadas juntas**. Caso haja qualquer divergência entre elas, utilize a versão maior como base para o incremento.

4. **Pergunte ao usuário o novo número de versão** para a release (sugira as opções de incremento `patch`, `minor` ou `major` com base na versão atual sincronizada).
   - Após a confirmação do usuário, **atualize o campo `"version"` simultaneamente** nos dois arquivos:
     - [client/package.json](file:///Users/guilherme/testes/app_farm_aura/client/package.json)
     - [server/package.json](file:///Users/guilherme/testes/app_farm_aura/server/package.json)

5. **Decomponha e formate** a versão confirmada em `major`, `minor` e `patch`:
   - Formate com **2 dígitos** em cada parte numérica (equivalente a `sprintf("%02d.%02d.%02d", major, minor, patch)`):
   - Exemplo: `1.0.1` → arquivo `01.00.01.md`, pasta `01.00/`.
   - Caminho completo do release: `docs/releases/<MM.mm>/<MM.mm.rr>.md` (ex.: `docs/releases/01.00/01.00.01.md`).

6. Execute `git log <branch_destino>..HEAD --no-merges --pretty=format:"%h|%s|%an|%ad" --date=short` para obter commits com hash, mensagem, autor e data.

7. Execute `git diff --stat <branch_destino>..HEAD` para obter estatísticas de alteração (arquivos alterados, inserções, remoções).

8. **Filtre** commits relacionados a incrementos de versão, changelogs ou releases automáticos.

9. Identifique **alterações estruturais** relevantes (novos pacotes, mudanças em build/infra, pipelines, reorganização de módulos etc.) para as **seções técnicas** do release e do changelog.

10. **Crie ou atualize** o arquivo de release em `docs/releases/<major_minor_formatado>/<versao_formatada>.md` com a estrutura:

    ```markdown
    # Release Notes - Versão X.Y.Z

    **Data de Lançamento:** [data de hoje em pt-BR]

    ## 📝 Resumo Executivo

    [Obrigatório: texto único alinhado à “Política do Resumo Executivo” — usuário final, sem jargão técnico. Mesmo núcleo textual que irá em CHANGELOG.md.]

    ---

    ## 🆕 Recursos Adicionados

    [Lista de novos recursos]

    ## 🔧 Modificações

    [Lista de modificações e melhorias]

    ## 🐛 Correções

    [Lista de bugs corrigidos]

    ## 🏗️ Alterações Estruturais

    [Lista de mudanças estruturais relevantes: dependências, build, arquitetura de pastas, CI/CD, etc.]

    ---

    ## 📋 Features documentadas (docs/features)

    Quando couber, relacione specs implementadas nesta versão:
    - Arquivos em `docs/` ou `docs/features/` alterados nos commits da faixa.
    - Formato sugerido: `- [Nome da feature](../SPEC_NOME.md)`

    ---

    ## 📊 Estatísticas de Alteração

    - **Arquivos alterados:** [número]
    - **Inserções:** +[número] linhas
    - **Remoções:** -[número] linhas
    - **Commits considerados:** [número]

    ---

    ## 🔗 Commits Relacionados

    [Lista de commits com hash e descrição]

    ---

    ## ✅ Sugestões de Testes

    [Checklist prático para validar recursos, modificações e correções.]
    ```

11. Em **`CHANGELOG.md`**, para a nova versão, inclua **logo após** o título da versão:

    ```markdown
    ## [X.Y.Z] - DD-MM-YYYY

    ### Resumo Executivo

    [Mesmo texto do `## 📝 Resumo Executivo` do arquivo em docs/releases/.]
    ```

    Depois mantenha as subseções do projeto (**`### ✨ Adicionado`**, **`### 🔄 Modificado`**, **`### 🐛 Corrigido`**, **`### 🔧 Melhorias`**, link para o release etc.) com detalhe técnico **abaixo** do Resumo Executivo.

    Inclua link para as notas detalhadas usando o caminho real do arquivo criado, ex.: `📄 [Notas detalhadas da versão](./docs/releases/01.00/01.00.00.md)`.

12. Garanta que o **primeiro passo** da redação seja o **Resumo Executivo (usuário final)** único; só então preencha listas técnicas e categorias a partir dos commits.

13. Se o arquivo de release já existir na pasta da versão, **atualize-o** mantendo a estrutura.

14. A seção **✅ Sugestões de Testes** no release deve ser preenchida de forma utilizável.

15. No **`CHANGELOG.md`**, ao final da seção da versão, inclua um **resumo curto** das sugestões de testes.

16. **Mostre** ao solicitante um resumo das alterações feitas no arquivo de release e no `CHANGELOG.md`.

---

## Idioma

Todo o conteúdo voltado a leitores do repositório (changelog, release, resumos) deve estar em **português (pt-BR)**.

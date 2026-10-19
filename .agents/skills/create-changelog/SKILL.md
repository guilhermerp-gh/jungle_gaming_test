---
name: create-changelog
description: >-
  Gera ou atualiza o CHANGELOG.md e o arquivo de release em docs/releases/ com Resumo Executivo obrigatório voltado para o usuário final e estatísticas detalhadas de git sem realizar commits automáticos. Use quando o usuário solicitar a criação ou atualização de changelog, release notes, preparação de nova versão ou histórico de lançamentos.
---

# Skill: Gerar Changelog e Release Notes

Esta skill orienta a geração ou atualização estruturada do arquivo `CHANGELOG.md` e dos arquivos detalhados de notas de versão em `docs/releases/<MM.mm>/<MM.mm.rr>.md`.

---

## 📌 Política do Resumo Executivo (Obrigatória)

O **Resumo Executivo** é um texto redigido com foco exclusivo no **usuário final** (quem opera ou consome o aplicativo no dia a dia). Ele deve ser **sempre gerado** com esse direcionamento e constar **nos dois locais com exatamente o mesmo propósito e conteúdo**:

1. **`CHANGELOG.md`** — subseção `### Resumo Executivo` logo abaixo do cabeçalho `## [X.Y.Z] - DD-MM-YYYY`.
2. **`docs/releases/<MM.mm>/<MM.mm.rr>.md`** — seção `## 📝 Resumo Executivo`.

### Regras de Conteúdo (Foco no Usuário Final)
- Descreva **o que muda na experiência prática**: maior velocidade, prevenção de erros, novos recursos compreensíveis, garantias de segurança e consistência que o usuário percebe.
- Use linguagem **simples e direta** (ex.: "processamento mais rápido", "evita cobrança em duplicidade", "saldo sempre consistente", "identificação unificada de transações").
- **NÃO inclua** no Resumo Executivo: refatorações internas de código, nomes de bibliotecas ou frameworks técnicos, migrations ou queries SQL, comandos de CI/CD, reorganização de diretórios internos, endpoints brutos ou detalhes de baixo nível.
- Itens **estritamente operacionais ou de automação** (ex.: bump de versão, scripts de lint, ajustes em workflows) **não entram** no Resumo Executivo; devem figurar apenas nas seções técnicas do arquivo de release (`🔧 Modificações`, `🏗️ Alterações Estruturais`) e nas categorias detalhadas do `CHANGELOG.md` (`### ✨ Adicionado`, `### 🔄 Modificado`, etc.).

### Consistência e Regeneração
- O texto do Resumo Executivo no `CHANGELOG.md` e em `docs/releases/...` deve ser **idêntico** (1 ou 2 parágrafos objetivos).
- Ao gerar ou atualizar o changelog da versão, **reescreva** o Resumo Executivo com base nos commits atuais e nesta política.
- **Não preserve** resumos anteriores por padrão; reescreva para refletir com precisão a entrega, a menos que o solicitante peça explicitamente o contrário.

---

## 🚀 Passo a Passo de Execução

1. **Organizar especificações executadas**:
   - Verifique quais arquivos de especificação (arquivos `.md` localizados em `docs/specs/` ou na raiz de `docs/`) possuem a marcação `# SPEC EXECUTADA` ou o status `Status | Concluído` em seu conteúdo.
   - Mova esses arquivos para dentro da pasta `docs/executed/`. Crie a pasta caso não exista.

2. **Identificar a branch de destino**:
   - Pergunte ao usuário o nome da branch base para comparação (ex.: `main` ou `develop`).

3. **Obter a versão atual do projeto**:
   - Leia o campo `"version"` no arquivo [package.json](file:///Users/guilherme/testes/jungle_gaming_test/package.json).
   - Caso o projeto utilize arquitetura monorepo ou múltiplos subprojetos com pacotes distintos, leia e sincronize as versões de todos os `package.json` envolvidos, adotando a maior versão como base.

4. **Definir o novo número de versão**:
   - Pergunte ao usuário o novo número de versão da release, sugerindo as opções SemVer (`patch`, `minor` ou `major`) a partir da versão atual.
   - Após a confirmação, atualize o campo `"version"` no [package.json](file:///Users/guilherme/testes/jungle_gaming_test/package.json).

5. **Decompor e formatar o caminho do arquivo de release**:
   - Decomponha a versão confirmada em `major`, `minor` e `patch`.
   - Formate cada parte numérica com **2 dígitos** (`sprintf("%02d.%02d.%02d", major, minor, patch)`):
     - Exemplo: `0.9.0` → pasta `00.09/`, arquivo `00.09.00.md`.
     - Exemplo: `1.0.1` → pasta `01.00/`, arquivo `01.00.01.md`.
   - Caminho completo: `docs/releases/<MM.mm>/<MM.mm.rr>.md`.

6. **Extrair commits da faixa**:
   - Execute o comando git:
     ```bash
     git log <branch_destino>..HEAD --no-merges --pretty=format:"%h|%s|%an|%ad" --date=short
     ```

7. **Extrair estatísticas do diff**:
   - Execute o comando:
     ```bash
     git diff --stat <branch_destino>..HEAD
     ```

8. **Filtrar e categorizar commits**:
   - Filtre commits ruidosos ou puramente relacionados a bumps automáticos de versão.
   - Agrupe os commits relevantes nas categorias:
     - Adicionado / Novos recursos (`feat`)
     - Modificado / Melhorias (`refactor`, `perf`, `chore`)
     - Corrigido (`fix`)
     - Alterações Estruturais (dependências, banco, infraestrutura, CI/CD)

9. **Criar ou atualizar o arquivo de release em `docs/releases/<MM.mm>/<MM.mm.rr>.md`**:
   - Utilize a estrutura:

   ```markdown
   # Release Notes - Versão X.Y.Z

   **Data de Lançamento:** [DD de Mês de AAAA]

   ## 📝 Resumo Executivo

   [Obrigatório: texto voltado para o usuário final, sem jargões técnicos. Idêntico ao do CHANGELOG.md.]

   ---

   ## 🆕 Recursos Adicionados

   - [Lista de recursos implementados]

   ## 🔧 Modificações

   - [Lista de modificações e melhorias de comportamento]

   ## 🐛 Correções

   - [Lista de correções de bugs]

   ## 🏗️ Alterações Estruturais

   - [Mudanças arquiteturais, migrações de banco, dependências adicionadas, etc.]

   ---

   ## 📋 Features documentadas (docs/specs ou docs/executed)

   - Relacione as especificações cobertas nesta versão, ex: `[Nome da Feature](../executed/YYYY-MM-DD-feature.md)`

   ---

   ## 📊 Estatísticas de Alteração

   - **Arquivos alterados:** [número]
   - **Inserções:** +[número] linhas
   - **Remoções:** -[número] linhas
   - **Commits considerados:** [número]

   ---

   ## 🔗 Commits Relacionados

   - [hash] - Mensagem do commit (@autor)

   ---

   ## ✅ Sugestões de Testes

   - [ ] Checklist objetivo para validação funcional e técnica dos itens entregues
   ```

10. **Atualizar o arquivo `CHANGELOG.md`**:
    - Adicione a nova versão imediatamente após o cabeçalho introdutório:

    ```markdown
    ## [X.Y.Z] - DD-MM-YYYY

    ### Resumo Executivo

    [Mesmo texto do Resumo Executivo de docs/releases/.]

    ### ✨ Adicionado
    - Itens adicionados com detalhe técnico e referências a arquivos

    ### 🔄 Modificado
    - Itens modificados

    ### 🐛 Corrigido
    - Itens corrigidos

    ### 🧪 Sugestões de Testes
    - Checklist resumido dos testes recomendados

    📄 [Notas detalhadas da versão](./docs/releases/<MM.mm>/<MM.mm.rr>.md)

    ---
    ```

11. **Apresentar resumo**:
    - Exiba ao solicitante o resumo das alterações efetuadas em `CHANGELOG.md` e em `docs/releases/...`.

---

## 🌐 Idioma

Todo o conteúdo produzido para changelog, release notes e resumos deve estar em **português (pt-BR)**.

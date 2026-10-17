---
description: Cria uma mensagem de commit git seguindo o padrão Conventional Commit e aplicando as regras do projeto.
---

## Modos de execução

| Modo | Quando usar | Stage vazio | Push |
|------|-------------|-------------|------|
| **Interativo** | Usuário pede commit diretamente (ex.: "cria commit", "faz o commit") | Pergunta antes de `git add -A` | Executa `git push` automaticamente após o commit |
| **Automático** | Outro workflow chama este (bump, release, changelog, etc.) | Executa `git add -A` sem perguntar | Executa `git push` sem perguntar |

**Padrão**: se não estiver claro, use **interativo**. Workflows pai devem declarar explicitamente: *"Execute `create-commit` em **modo automático**"*.

---

### Passo a Passo

1. **Verificar alterações**
   - Confira se há alterações no stage (`git diff --cached`).
   - **Modo automático**: garanta que **todas** as alterações estejam no stage com `git add -A`. Se não houver nada, pare.
   - **Modo interativo**:
     - Se o stage estiver vazio, verifique alterações fora do stage (`git status`).
     - Se houver alterações: pergunte ao usuário antes de executar `git add -A`.
     - Se não houver nada: informe o usuário e pare.

2. **Perguntar o tipo do commit e executar o commit**
   - **OBRIGATÓRIO (Modo interativo)**: **Pergunte primeiro ao usuário** para confirmar se a alteração se trata de um **`feat`** (nova funcionalidade), **`fix`** (correção de bug) ou outro tipo (`docs`, `refactor`, `style`, `chore`).
   - Elabore uma mensagem clara e sucinta em português (pt-BR) seguindo o padrão Conventional Commits (`tipo: descrição da alteração`).
   - Execute o commit (`git commit -m "tipo: descrição"`).

3. **Enviar ao repositório remoto (Push)**
   - **OBRIGATÓRIO**: **Somente após o commit ser concluído**, execute automaticamente `git push`.
   - Se não houver upstream configurado, execute `git push -u origin <branch>`.
   - Se falhar, informe o erro.
   - Esta regra de push automático se aplica apenas quando este workflow (`create-comit.md`) for executado.

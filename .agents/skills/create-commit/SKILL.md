---
name: create-commit
description: >-
  Cria mensagens de commit padronizadas seguindo Conventional Commits em português (pt-BR), organizando o stage e realizando push condicional em modos interativo ou automático. Use quando o usuário pedir para criar um commit, commitar alterações ("cria commit", "faz commit", "create-comit") ou quando outro fluxo de trabalho solicitar commit automatizado.
---

# Skill: Criação de Commits (Conventional Commits)

Esta skill define o processo padronizado para criação de commits git no repositório, garantindo conformidade com o padrão Conventional Commits, histórico limpo e sincronização com o repositório remoto.

---

## 🚦 Modos de Execução

| Modo | Quando usar | Stage vazio | Push |
|------|-------------|-------------|------|
| **Interativo** | Usuário pede commit diretamente (ex.: "cria commit", "faz o commit", "commit") | Pergunta antes de `git add -A` | Executa `git push` automaticamente após confirmação do commit |
| **Automático** | Outro workflow/skill chama este processo (bump de versão, release, etc.) | Executa `git add -A` sem perguntar | Executa `git push` sem perguntar |

> **Padrão**: Se não estiver explícito na solicitação, adote sempre o modo **Interativo**. Skills ou workflows externos que dependem deste fluxo devem declarar expressamente: *"Execute `create-commit` em modo automático"*.

---

## 📋 Procedimento Passo a Passo

### 1. Verificar Alterações no Repositório
- Inspecione se há alterações em stage:
  ```bash
  git diff --cached
  ```
- **No Modo Automático**:
  - Adicione todas as alterações pendentes ao stage: `git add -A`. Se não houver nada alterado, interrompa a execução.
- **No Modo Interativo**:
  - Se o stage estiver vazio, verifique alterações no working directory:
    ```bash
    git status -s
    ```
  - Se houver arquivos modificados ou não rastreados, **pergunte ao usuário** antes de executar `git add -A` ou adicione apenas os arquivos desejados.
  - Se não houver nenhuma alteração pendente, avise o usuário e finalize o fluxo.

### 2. Definir o Tipo de Commit e a Mensagem
- **Obrigatório (Modo Interativo)**: Pergunte ou confirme com o usuário o tipo semântico da alteração:
  - `feat`: Nova funcionalidade para o usuário ou sistema.
  - `fix`: Correção de bug ou falha de comportamento.
  - `refactor`: Alteração de código interno sem alteração de funcionalidade externa.
  - `perf`: Melhoria de performance ou consumo de recursos.
  - `test`: Criação ou ajuste de testes automatizados.
  - `docs`: Documentação ou arquivos markdown.
  - `chore`: Tarefas de build, scripts, configuração ou dependências.
  - `style`: Formatação, linting, pontuação ou espaçamento.

- **Formato da Mensagem**:
  - A mensagem deve estar em português (pt-BR), concisa e no padrão:
    ```text
    <tipo>(<escopo-opcional>): <descrição no imperativo/presente>
    ```
    *Exemplos:*
    - `feat(wallet): adiciona endpoint para depósito idempotente com lock pessimista`
    - `fix(concurrency): previne race condition durante replay de transações`
    - `test(observability): adiciona testes unitários para métricas Prometheus`

- **Executar o Commit**:
  ```bash
  git commit -m "<tipo>: <descrição>"
  ```

### 3. Enviar ao Repositório Remoto (Push)
- **Obrigatório**: Somente após o commit ser executado com sucesso:
  - Execute o push:
    ```bash
    git push
    ```
  - Se a branch atual não possuir upstream configurado, execute:
    ```bash
    git push -u origin <branch_atual>
    ```
  - Caso ocorra falha de rede ou rejeição pelo servidor remoto, informe o erro detalhadamente ao usuário.

---

## ⚠️ Regras e Restrições do Repositório
- Nunca commite código em contextos gerais sem a ciência e solicitação do usuário.
- Mantenha sempre a clareza sobre quais arquivos estão sendo adicionados ao stage.

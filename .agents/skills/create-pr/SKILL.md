---
name: create-pr
description: >-
  Executa code review cirúrgico e focado em Pull Requests via GitHub CLI (gh), analisando apenas os métodos e funções diretamente alterados e seus chamadores diretos sob 7 ângulos rigorosos de qualidade. Use quando o usuário solicitar revisão de PR, análise de PR (#numero), code review focado ou execução de /create-pr.
---

# Skill: Code Review Focado de Pull Request

Esta skill estabelece o processo de análise e code review profundo, cirúrgico e focado em Pull Requests utilizando o GitHub CLI (`gh`). O foco é exclusivo nos métodos/funções alterados e seus chamadores diretos, sem ruído desnecessário.

---

## 1. Coletar Informações do PR

Execute via terminal utilizando o GitHub CLI (`gh`):
```bash
gh pr view <PR_NUMBER> --json title,body,headRefName,baseRefName,files
gh pr diff <PR_NUMBER>
```

> O número ou identificador do PR é fornecido pelo usuário na invocação (ex.: "revise o PR #12", "analise o PR 42" ou informando a URL/branch).

---

## 2. Executar o Review Focado

### 🎯 Escopo Restrito
Analise **apenas** os métodos e funções diretamente alterados pelo diff e os chamadores diretos desses métodos. **Não** revise outras partes dos arquivos tocados que não foram modificadas pelo PR.

### 🔍 Os 7 Ângulos de Análise
Aplique os 7 ângulos abaixo sobre o escopo restrito. Para cada ângulo, levante até 6 candidatos mais relevantes:

#### Ângulo A — Scan Linha a Linha do Diff
Leia cada hunk do diff linha a linha e analise a função completa que envolve o hunk:
- Condição invertida ou incorreta
- Erros off-by-one em loops ou fatiamento
- Null/undefined sem guard ou verificação defensiva
- `await` ausente em chamadas assíncronas
- Falsy-zero (`0`) tratado equivocadamente como nulo/ausente
- Variáveis incorretas por copy-paste
- Erros engolidos em blocos `catch` sem rethrow ou log estruturado
- Metacaracteres de regex sem escape adequado

#### Ângulo B — Comportamento Removido
Para cada linha que o diff **deleta ou substitui**:
- Nomeie a invariante ou regra que ela garantia.
- Busque no novo código onde essa garantia foi restabelecida.
- Se não encontrar: marque como candidato (guard removido, caminho de erro excluído, validação flexibilizada indevidamente, teste deletado que cobria caso real).

#### Ângulo C — Chamadores Afetados (Cross-File)
Para cada função/método que o diff modifica:
- Busque todos os chamadores via busca de símbolos (`grep_search`).
- Verifique se a mudança quebra algum ponto de chamada: nova pré-condição, novo tipo de retorno, exceções adicionais lançadas, dependência de ordem ou timing.
- Verifique também os callees: alguma mudança paralela no mesmo PR torna uma chamada interna insegura?

#### Ângulo D — Reuso e Não Duplicação
- Verifique se o código novo reimplementa lógica que o projeto já possui (helpers utilitários, wrappers de transação, validadores).
- Indique o utilitário existente que deve ser aproveitado.

#### Ângulo E — Simplificação
- Identifique complexidade desnecessária introduzida: estado redundante ou derivável, duplicação com variação mínima, aninhamentos profundos desnecessários, código morto deixado para trás.
- Sugira a alternativa mais simples e direta.

#### Ângulo F — Eficiência e Desempenho
- Identifique trabalho computacional redundante, operações repetitivas de I/O (N+1 queries), operações independentes sequenciais que poderiam ser executadas em paralelo (`Promise.all`), ou sobrecarga em rotas de alta frequência (*hot paths*).
- Sugira a alternativa mais performática.

#### Ângulo G — Altitude (Nível de Abstração)
- Verifique se cada alteração está situada na camada correta (Domínio, Aplicação, Infraestrutura, Interface) em vez de ser um atalho pontual (*band-aid* frágil).
- Prefira generalizar o mecanismo subjacente a acumular casos especiais na camada de apresentação/API.

---

## 3. Consolidar e Apresentar os Findings

1. **Deduplicação**: Agrupe candidatos próximos (mesmo defeito ou mesma causa raiz → consolidar em um).
2. **Ordenação por Severidade**: Alta → Média → Baixa (limite máximo de 10 findings principais).
3. **Estrutura de Apresentação** (em português pt-BR):

```markdown
### Finding N — <Título Curto e Descritivo>

- **Arquivo:** `caminho/do/arquivo.ext` — método/função `nomeDoMetodo()`
- **Severidade:** Alta | Média | Baixa
- **Problema:** Descrição clara, técnica e objetiva do que está incorreto ou arriscado.
- **Cenário de Falha:** Dados de entrada/estado concretos → comportamento anômalo, dados corrompidos ou crash.
- **Sugestão:** Proposta de correção ou código sugerido.
```

> Se nenhum problema for detectado no escopo do review, declare explicitamente que o código foi aprovado e nenhum finding relevante foi identificado no escopo analisado.

---

## 4. O que Fazer com os Findings

Após exibir o relatório no chat, pergunte ao usuário:
> *"O que deseja fazer com esses findings?"*
> 1. **Apenas manter exibido no chat**
> 2. **Salvar em arquivo no projeto (`docs/scratch/`)**

### Opção 2 — Salvar em `docs/scratch/`
Caso o usuário escolha salvar:
- Crie o arquivo `docs/scratch/<YYYY-MM-DD>-review-pr-<PR_NUMBER>.md` contendo:
  - Cabeçalho: Número do PR, título, data e branch revisada.
  - Lista completa consolidada de findings.

---
description: Faz code review focado ou análise de alterações de um PR via GitHub CLI — analisa apenas os métodos/funções alterados e seus chamadores diretos, sem dependências de Jira ou Skills.
---

# Workflow: Code Review / Análise de PR

## 1. Coletar informações do PR

Execute via terminal ou GitHub CLI (`gh`):
- `gh pr view <PR_NUMBER> --json title,body,headRefName,baseRefName,files`
- `gh pr diff <PR_NUMBER>`

O número do PR é informado pelo usuário na invocação (ex.: `/create-pr #1227` ou informando o número diretamente).

---

## 2. Executar o review focado

**Escopo restrito:** analisar **apenas** os métodos/funções diretamente alterados pelo diff e os chamadores diretos desses métodos. Não revisar outras partes dos arquivos tocados que não foram modificadas pelo PR.

Executar os 7 ângulos abaixo sobre o escopo restrito. Para cada ângulo, levantar até 6 candidatos (arquivo, linha, resumo de 1 linha, cenário de falha concreto).

### Ângulo A — Scan linha a linha do diff

Ler cada hunk do diff linha a linha. Ler também a função completa que envolve cada hunk — bugs em linhas não alteradas de uma função tocada estão no escopo.

Buscar: condição invertida/errada, off-by-one, null/undefined sem guard, `await` faltando, falsy-zero tratado como ausente, variável errada por copy-paste, erro engolido no catch, metacaracteres de regex sem escape.

### Ângulo B — Comportamento removido

Para cada linha que o diff **deleta ou substitui**, nomear a invariante ou comportamento que ela enforçava. Buscar no novo código onde essa invariante foi re-estabelecida. Se não encontrar: candidato — guard removido, caminho de erro excluído, validação estreitada, teste deletado que cobria caso real.

### Ângulo C — Chamadores afetados (cross-file)

Para cada função que o diff altera, buscar os chamadores (Grep pelo símbolo) e verificar se a mudança quebra algum call site: nova pré-condição, shape de retorno diferente, nova exceção, dependência de ordem/timing. Verificar também callees: alguma mudança paralela no mesmo PR torna uma chamada insegura?

### Ângulo D — Reuso

Buscar código novo que reimplementa algo que o projeto já tem — Grep em módulos utilitários e arquivos adjacentes à mudança. Nomear o helper existente que deveria ser chamado no lugar.

### Ângulo E — Simplificação

Identificar complexidade desnecessária adicionada pelo diff: estado redundante ou derivável, copy-paste com variação leve, aninhamento profundo, código morto deixado para trás. Nomear a forma mais simples que faz o mesmo trabalho.

### Ângulo F — Eficiência

Identificar trabalho desperdiçado introduzido pelo diff: computação redundante, I/O repetido (N+1 queries), operações independentes rodando em sequência quando poderiam ser paralelas, trabalho pesado adicionado a startup ou hot path. Nomear a alternativa mais barata.

### Ângulo G — Altitude (nível de abstração)

Verificar se cada mudança está implementada na camada correta — não como bandaid frágil. Casos especiais empilhados sobre infraestrutura compartilhada são sinal de que o fix não é profundo o suficiente. Preferir generalizar o mecanismo subjacente a adicionar casos especiais.

---

## 3. Consolidar e apresentar os findings

Deduplicar candidatos próximos (mesmo defeito, mesma localização, mesmo motivo → manter um). Ordenar por severidade: Alta → Média → Baixa.

Apresentar no formato abaixo, em português, com no máximo 10 findings:

```
### Finding N — <título curto>

**Arquivo:** `caminho/arquivo.ext` — método `nomeDoMetodo()`
**Severidade:** Alta | Média | Baixa
**Problema:** descrição clara do que está errado.
**Cenário de falha:** inputs/estado concretos → output errado ou crash.
**Sugestão:** correção objetiva (quando aplicável).
```

Se não houver findings relevantes, informar explicitamente que o review não encontrou problemas no escopo analisado.

---

## 4. O que fazer com os findings

Após apresentar os findings, pergunte ao usuário:

> "O que deseja fazer com esses findings?"
> 1. Nada — apenas exibir o review na tela
> 2. Salvar em `docs/scratch`

### Opção 2 — Salvar em `docs/scratch`

Criar o arquivo `docs/scratch/<YYYY-MM-DD>-review-pr-<PR_NUMBER>.md` com:
- Cabeçalho: número do PR, título, data
- Os findings no mesmo formato da seção 3

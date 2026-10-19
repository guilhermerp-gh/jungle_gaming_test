# 📄 [Título da Spec]

> **Template simples e objetivo** para especificações curtas, correções, novos recursos e ajustes localizados.

---

## 📌 Metadados

| Campo | Valor |
|---|---|
| **Versão** | v1.0 |
| **Data** | DD/MM/YYYY |
| **Autor** | Desenvolvedor |
| **Status** | Rascunho / Em Revisão / Aprovado / Em Desenvolvimento / Concluído |
| **Prioridade** | Alta / Média / Baixa |
| **Tipo** | Feature / Ajuste / Correção / Refatoração |

---

## 📝 Resumo

> Descreva em 2-5 frases:
> o que será feito, por que isso é necessário e qual o resultado esperado.

<!-- Exemplo:
Adicionar validação de saldo no momento do registro da aposta para evitar operações com fundos insuficientes. A mudança garante a integridade contábil da carteira antes de despachar eventos para a fila de processamento assíncrono.
-->

---

## 📦 Escopo

### ✅ Incluído
- Item 1
- Item 2
- Item 3

### ❌ Fora do Escopo
- Item 1
- Item 2
- Item 3

---

## 🔄 Fluxo Principal

<!-- Se houver mais de um fluxo, duplique este bloco e nomeie cada um: "## 🔄 Fluxo 1: [Nome]", "## 🔄 Fluxo 2: [Nome]" -->

### Comportamento Atual `[preencher em correções e ajustes]`
> O que acontece hoje que precisa mudar.

1. Passo 1
2. Passo 2
3. Resultado atual que precisa de alteração

### Fluxo Proposto
1. Passo 1
2. Passo 2
3. Resultado esperado

### Fluxos Alternativos `[opcional]`
- Se o serviço dependente estiver indisponível, o sistema deve...
- Se o identificador de idempotência já existir, o sistema deve...

---

## 📐 Regras e Restrições

### Regras de Negócio
- Regra 1
- Regra 2
- Regra 3

### Restrições Técnicas / Funcionais
- Respeitar invariantes contábeis e uso obrigatório de tipos `Money` (sem `float` ou `number` em campos financeiros)
- Garantir isolamento transacional com lock pessimista (`SELECT ... FOR UPDATE`) onde aplicável
- Preservar idempotência de ponta a ponta e persistência de histórico
- Manter cobertura de testes unitários e de integração

---

## ✅ Critérios de Aceite

<!-- Prefira o formato: "Quando [condição], o sistema deve [comportamento]" -->
- [ ] Critério 1
- [ ] Critério 2
- [ ] Critério 3

---

## 🧩 Impacto Técnico

### Módulos / Camadas Impactadas
- Domínio (`src/domain/`)
- Casos de Uso / Aplicação (`src/application/`)
- Persistência / Banco de Dados (`src/infrastructure/persistence/`)
- Mensageria / Workers (`src/infrastructure/messaging/`)
- Interfaces HTTP / Controladores (`src/interfaces/http/`)

### Arquivos ou Áreas Prováveis `[opcional]`
- `src/domain/entities/...`
- `src/application/use-cases/...`
- `src/interfaces/http/controllers/...`

### Dependências `[opcional]`
- [Novas bibliotecas ou dependências externas, se houver]

---

## 🧭 Plano de Implementação `[opcional]`

> Liste os passos na sequência de execução sugerida.

1. Passo 1
2. Passo 2
3. Passo 3

### Decisões Técnicas / Pontos em Aberto `[opcional]`
- Decisão ou dúvida 1
- Decisão ou dúvida 2

---

## 🧪 Testes Esperados

- [ ] Cenário principal com sucesso
- [ ] Cenário de erro ou exceção de negócio
- [ ] Caso de borda ou concorrência simultânea

---

## 🤖 Instruções para IA

### Objetivo Operacional
> Implemente somente o que está dentro do escopo desta spec. Em caso de dúvida, pergunte antes de assumir.

### O que a IA deve entregar
- Código implementado e funcional
- Validação e testes automatizados executados com sucesso
- Resumo claro das alterações efetuadas

### Observações específicas desta spec `[opcional]`
> Use este campo para restrições ou contexto técnico que não couberem nas seções anteriores.

---

## ✍️ Rascunho Mínimo Aceito

> Se estiver com pressa, preencha pelo menos:

- `Resumo`
- `Escopo`
- `Fluxo Principal`
- `Regras e Restrições`
- `Critérios de Aceite`

---

## 📁 Pós-execução da Spec

Quando a implementação da spec for concluída e todos os testes estiverem aprovados:
1. Marque `# SPEC EXECUTADA` ou altere o status dos metadados para `Status | Concluído`.
2. Mova o arquivo da spec para a pasta `docs/executed/`.

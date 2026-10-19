---
name: spec-simples
description: >-
  Guia e template para criação, estruturação e padronização de especificações técnicas (specs) simples e objetivas para novos recursos, correções ou refatorações. Use quando o usuário solicitar a criação de uma nova spec, elaboração de especificação técnica, documentação de requisitos usando o modelo simples ou preenchimento de template de especificação.
---

# Skill: Criação de Especificação Técnica Simples (Spec Simples)

Esta skill orienta a criação, redação e organização de especificações técnicas simples, concisas e orientadas a resultados para novos recursos, correções ou refatorações no projeto.

---

## 🎯 Quando Utilizar Esta Skill

Utilize este fluxo sempre que:
- O usuário solicitar a criação de uma nova especificação técnica ("cria uma spec", "elabora a especificação").
- Uma funcionalidade, correção de bug ou refatoração precisar ser planejada antes da implementação.
- For necessário alinhar escopo, regras de negócio, critérios de aceite e plano de testes antes de escrever código.

---

## 📁 Localização e Nomenclatura dos Arquivos de Spec

1. **Pasta de Destino**:
   - Novas especificações em elaboração ou prontas para execução devem ser salvas em `docs/specs/` (ou na raiz de `docs/` se aplicável):
     ```text
     docs/specs/YYYY-MM-DD-<slug-da-feature>.md
     ```
   - *Exemplo*: `docs/specs/2026-10-19-deposito-idempotente-pix.md`

2. **Pós-execução**:
   - Assim que a especificação for integralmente desenvolvida e testada, mova-a para:
     ```text
     docs/executed/YYYY-MM-DD-<slug-da-feature>.md
     ```
   - Adicione no topo do arquivo a tag `# SPEC EXECUTADA` ou atualize a tabela de metadados para `Status | Concluído`.

---

## 📝 Estrutura da Especificação

O template completo está disponível em [`template.md`](./resources/template.md).

Ao redigir a especificação, preencha as seções essenciais com foco em objetividade:

### 1. Metadados
- **Versão**: v1.0
- **Data**: Data atual (DD/MM/YYYY)
- **Autor**: Identificação do autor ou desenvolvedor
- **Status**: Rascunho / Em Revisão / Aprovado / Em Desenvolvimento / Concluído
- **Prioridade**: Alta / Média / Baixa
- **Tipo**: Feature / Ajuste / Correção / Refatoração

### 2. Resumo Executivo da Spec
- Redija de 2 a 5 frases explicando: **o que** será feito, **por que** é necessário e **qual o resultado** esperado.

### 3. Escopo
- **Incluído (✅)**: Limites claros do que será entregue.
- **Fora do Escopo (❌)**: O que explicitamente não faz parte desta entrega para evitar acúmulo de escopo.

### 4. Fluxo Principal e Casos de Borda
- **Comportamento Atual**: Descreva o que acontece hoje (obrigatório em correções e ajustes).
- **Fluxo Proposto**: Passo a passo da interação ou processamento esperado.
- **Fluxos Alternativos / Exceções**: Como o sistema se comporta sob falhas de conexão, dados inválidos ou reenvios.

### 5. Regras e Restrições
- **Regras de Negócio**: Invariantes contábeis, limites de valores, autorizações.
- **Restrições Técnicas**: Imutabilidade financeira, uso de `Money` (sem floats), concorrência pessimista, idempotência, semântica at-least-once.

### 6. Critérios de Aceite
- Use checkboxes com a fórmula:
  `- [ ] Quando [gatilho/condição], o sistema deve [comportamento esperado]`

### 7. Impacto Técnico e Arquivos Prováveis
- Módulos afetados (Domínio, Aplicação, Persistência, Mensageria, HTTP).
- Lista de arquivos existentes a alterar ou novos a criar.

### 8. Plano de Testes
- Cenário principal de sucesso.
- Cenários de erro e exceções tratadas.
- Testes de concorrência simultânea ou idempotência repetida.

---

## ⚡ Rascunho Mínimo Aceito

Se houver necessidade de agilidade máxima, preencha obrigatoriamente:
1. `Resumo`
2. `Escopo` (Incluído / Fora de Escopo)
3. `Fluxo Principal`
4. `Regras e Restrições`
5. `Critérios de Aceite`

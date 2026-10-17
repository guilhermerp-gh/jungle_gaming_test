# 📄 [Título da Spec]

> **Template simples e objetivo** para especificações curtas, correções, novos recursos e ajustes localizados para o projeto **Farmar Aura**.

---

## 📌 Metadados

| Campo | Valor |
|-------|-------|
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
Exibir o nível e o título do jogador no Ranking Global de Aura (Leaderboard). A mudança melhora o engajamento visual do jogador ao comparar sua evolução e ranking com outros participantes do jogo.
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
- Se o servidor estiver indisponível, o app deve...
- Se os dados de bônus expirarem, o app deve...

---

## 📐 Regras e Restrições

### Regras de Negócio
- Regra 1
- Regra 2
- Regra 3

### Restrições Técnicas / Funcionais
- Manter compatibilidade com a sincronização automática via API Express (`/api/score/sync`)
- Garantir responsividade da interface no React (mobile e desktop)
- Manter o cálculo de nível sincronizado com os intervalos de Aura definidos
- Não quebrar a persistência local em `localStorage`

---

## ✅ Critérios de Aceite

<!-- Prefira o formato: "Quando [condição], o app deve [comportamento]" -->
- [ ] Critério 1
- [ ] Critério 2
- [ ] Critério 3

---

## 🧩 Impacto Técnico

### Módulos / Camadas Impactadas
- Frontend (React / Vite / TailwindCSS / Lucide-React)
- Backend (Node.js / Express API)
- Banco de Dados (MySQL / Tabela `users`)
- Estado Local (`localStorage` / Hooks React)

### Arquivos ou Áreas Prováveis `[opcional]`
- `client/src/App.jsx`
- `client/src/components/AuraButton.jsx`
- `client/src/components/LeaderboardModal.jsx`
- `client/src/components/UpgradesShop.jsx`
- `client/src/components/NicknameModal.jsx`
- `client/src/utils/levels.js`
- `client/src/utils/audio.js`
- `server/index.js`
- `server/config/db.js`

### Dependências `[opcional]`
- `canvas-confetti`
- `lucide-react`
- `mysql2`

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
- [ ] Cenário de erro de conexão com a API backend
- [ ] Caso de borda (ex: transição de nível no limiar de pontos)

---

## 🤖 Instruções para IA

### Objetivo Operacional
> Implemente somente o que está dentro do escopo desta spec. Em caso de dúvida, pergunte antes de assumir.

### O que a IA deve entregar
- Código implementado e funcional
- Validação e testes executados
- Resumo claro das alterações efetuadas

### Observações específicas desta spec `[opcional]`
> Use este campo para restrições ou contexto técnico que não couberem nas seções anteriores.

---

## ✍️ Rascunho mínimo aceito

> Se estiver com pressa, preencha pelo menos:

- `Resumo`
- `Escopo`
- `Fluxo Principal`
- `Regras e Restrições`
- `Critérios de Aceite`

---

## 📁 Pós-execução da Spec

Quando o usuário pedir para executar uma spec, assim que todas as instruções da spec em questão forem concluídas, mova o arquivo da spec para a pasta `docs/executed/`.

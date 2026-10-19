# SPEC EXECUTADA
# 📄 Especificação Técnica: Simulador Visual de Jogador & Carteira (Wallet Playground)

> **Template Simples e Objetivo** baseado na skill `spec-simples`.  
> Especificação para desenvolvimento de uma interface visual amigável (Playground) para simulação de operações de carteira e apostas sem burocracia de parâmetros técnicos.

---

## 📌 Metadados

| Campo | Valor |
|---|---|
| **Versão** | v1.0 |
| **Data** | 19/10/2026 |
| **Autor** | Guilherme |
| **Status** | Concluído |
| **Prioridade** | Alta |
| **Tipo** | Feature |

---

## 📝 Resumo

Implementar uma página web interativa (`/simulator`) que permita a desenvolvedores, avaliadores e testadores executar todo o ciclo de vida de uma carteira de jogador (criação, depósitos, apostas, vitórias, derrotas, estornos e auditoria) manipulando apenas **Saldo**, **Player ID** e **Wallet ID**.

A interface abstrai completamente por baixo dos panos a complexidade de parâmetros técnicos (geração de UUIDs para `Idempotency-Key`, `roundId`, `externalTransactionId`, encadeamento de `referenceExternalTransactionId` para estornos e cabeçalhos de autenticação), proporcionando uma experiência visual rica, imediata e intuitiva alinhada à estética Glassmorphic já utilizada no portal do projeto.

---

## 📦 Escopo

### ✅ Incluído
1. **Nova rota HTTP `GET /simulator`**:
   - Servida pelo NestJS via `wallet-simulator.view.ts` (HTML5, Vanilla CSS Glassmorphic e Vanilla JS moderno).
   - Sem dependência de novos pacotes npm externos (zero overhead, carregamento ultrarrápido).
2. **Integração no Portal de Entrada (`/`)**:
   - Adição de card de acesso direto ao "Simulador de Carteira & Apostas" na landing page principal.
3. **Gestão de Jogador & Carteira com 1 Clique**:
   - Botão "Criar Novo Jogador & Carteira" (gera UUIDs válidos e permite definir saldo inicial opcional).
   - Campo para colar ou selecionar uma `walletId` já existente no banco de dados.
   - Histórico em memória/LocalStorage das carteiras recém-utilizadas para troca rápida.
4. **Display de Saldo em Tempo Real**:
   - Mostrador destacado com tipografia moderna, moeda formatada (padrão BRL) e animação suave de transição (verde para crédito, vermelho para débito).
   - Botão de sincronização/refresh para consultar saldo atualizado via `GET /wallets/:id`.
5. **Operações Rápidas de Caixa (Depósito)**:
   - Botões com valores pré-configurados (+R$ 20, +R$ 50, +R$ 100, +R$ 500) e campo de valor livre.
   - Disparo para `POST /wallets/:id/deposit` com geração automática de `Idempotency-Key`.
6. **Simulador de Rodada de Apostas (Cassino)**:
   - Seletor de valor da aposta (ex: R$ 5, R$ 10, R$ 25, R$ 50 ou customizado).
   - Ações diretas com 1 clique:
     - 🎰 **Apostar (BET)**: debita o saldo via `POST /wagering/transactions` (`kind: BET`).
     - 🏆 **Ganhar (WIN)**: credita prêmio na carteira com referência à rodada atual.
     - 💀 **Perder (LOSS)**: registra o encerramento da rodada sem crédito.
     - ↩️ **Estornar (REFUND / ROLLBACK)**: reverte a última aposta feita, injetando automaticamente o `referenceExternalTransactionId` da aposta original.
7. **Mini Extrato / Ledger Visual Reativo**:
   - Tabela inferior listando as operações da sessão em ordem cronológica reversa.
   - Colunas: Horário, Tipo (`DEPOSIT`, `BET`, `WIN`, `REFUND`, etc.), Valor, Saldo Resultante, Status e UUIDs técnicos colapsados/copiáveis.
8. **Auditoria e Reconciliação Instantânea**:
   - Botão "Auditar Carteira" que dispara `POST /wallets/:id/reconciliation` e exibe modal ou badge visual confirmando consistência contábil (saldo calculado vs armazenado).
9. **Tratamento Visual de Erros**:
   - Toasts e alertas elegantes para erros de negócio (ex: `INSUFFICIENT_FUNDS`, `ALREADY_REVERSED`) sem travar a interface.

### ❌ Fora do Escopo
1. Alterações no schema do banco de dados PostgreSQL ou migrations MikroORM.
2. Modificações na lógica de negócios ou nos contratos de API existentes (a UI consome 100% das rotas vigentes).
3. Mecanismos complexos de autenticação de usuário final (a aplicação continuará usando a abstração do `AuthGuard` via header `x-provider-id`).
4. Frameworks frontend externos (React, Vue, Tailwind); a implementação utilizará o mesmo padrão Vanilla CSS/JS de alta performance adotado em `api-docs.view.ts`.

---

## 🔄 Fluxo Principal

### Comportamento Atual (Swagger `/docs`)
1. O usuário acessa `http://localhost:3000/docs`.
2. Para testar um depósito ou aposta, precisa navegar até a rota, clicar em "Try it out".
3. Precisa gerar manualmente UUIDs no terminal ou browser console para `playerId`, `walletId`, `externalTransactionId` e `Idempotency-Key`.
4. Precisa digitar manualmente o JSON com 9 campos técnicos.
5. Se quiser testar um estorno, precisa copiar a chave da transação anterior e colar em `referenceExternalTransactionId`.
6. O saldo final não é visualizado na mesma tela; é necessário rolar até o endpoint de consulta de carteira para verificar o novo saldo.

### Fluxo Proposto (Simulador `/simulator`)
1. O usuário acessa `http://localhost:3000/simulator` (ou clica no card do simulador no portal `/`).
2. **Setup em 1 clique**:
   - Clica em "Novo Jogador" -> O frontend gera um `playerId` aleatório, cria a carteira no backend com saldo inicial de R$ 100,00 e já seleciona a carteira.
   - O saldo `R$ 100,00` surge em destaque na tela.
3. **Depósito Simulado**:
   - Clica no chip `+R$ 50` -> O frontend dispara `POST /wallets/:id/deposit` com `Idempotency-Key: crypto.randomUUID()`.
   - O saldo atualiza para `R$ 150,00` com animação verde e a linha de depósito surge no extrato da tela.
4. **Ciclo de Aposta**:
   - Clica em `Apostar R$ 20` -> O frontend envia `POST /wagering/transactions` com `kind: BET`, `amount: 20.00`, gerando `roundId` e `externalTransactionId` automaticamente.
   - O saldo reduz para `R$ 130,00` com animação suave e a aposta aparece no extrato.
   - Clica em `Ganhar R$ 50` -> O frontend envia `POST /wagering/transactions` com `kind: WIN`, `amount: 50.00`. O saldo sobe para `R$ 180,00`.
   - Ou clica em `Desfazer Aposta (Refund)` -> O frontend identifica a última aposta no histórico local e despacha `POST /wagering/transactions` com `kind: REFUND` e `referenceExternalTransactionId` preenchido. O saldo volta para `R$ 150,00`.
5. **Auditoria Contábil**:
   - Clica em "Verificar Integridade" -> Dispara a reconciliação e exibe badge verde "100% Íntegro: 0 divergências contábeis".

### Fluxos Alternativos & Exceções
- **Tentativa de Aposta com Saldo Insuficiente**:
  - Se o usuário tentar apostar um valor superior ao saldo disponível, o backend responde 422 (`INSUFFICIENT_FUNDS`).
  - A interface exibe toast contextual: *"Saldo insuficiente para esta aposta"* e mantém a integridade da tela.
- **Conexão Offline ou Erro de Rede**:
  - A interface captura erros de rede e exibe alerta visual sem resetar o estado da sessão.

---

## 📐 Regras e Restrições

### Regras de Negócio
1. Todas as chamadas continuam respeitando os contratos das APIs de carteira e processamento de apostas.
2. Cada aposta (`BET`), ganho (`WIN`), perda (`LOSS`) ou estorno (`REFUND`/`ROLLBACK`) deve utilizar uma `Idempotency-Key` única gerada dinamicamente pelo cliente para evitar falso-positivos de replay.
3. Operações de `REFUND` e `ROLLBACK` devem obrigatoriamente referenciar o `externalTransactionId` da aposta a ser anulada.

### Restrições Técnicas
1. **Zero bibliotecas extras**: Construído em TypeScript puro gerando HTML/CSS/JS nativo na camada de visualização do NestJS.
2. **Estética Glassmorphic**: Utilização das variáveis de design do projeto (`--bg: #090d16`, `--accent-green: #10b981`, `--card-bg: rgba(18, 24, 38, 0.75)`, sombras com glow).
3. **Persistência de Sessão**: Armazenar no `localStorage` a lista de carteiras recentes criadas na máquina local para facilitar testes repetidos sem perda de dados ao recarregar a página.

---

## ✅ Critérios de Aceite

- [x] Quando o usuário acessar `http://localhost:3000/simulator`, o sistema deve renderizar a página do simulador sem erros de script.
- [x] Quando o usuário clicar em "Criar Jogador & Carteira", o sistema deve invocar `POST /wallets` com um novo UUID de jogador e exibir imediatamente o saldo na interface.
- [x] Quando o usuário acionar um depósito (ex: R$ 50,00), o sistema deve creditar o saldo na carteira e atualizar o mostrador visual sem recarregar a página.
- [x] Quando o usuário acionar uma aposta (`BET`), o sistema deve enviar a transação com UUIDs gerados internamente e abater o valor do saldo em tempo real.
- [x] Quando o usuário acionar uma vitória (`WIN`), o sistema deve creditar o prêmio e atualizar o saldo.
- [x] Quando o usuário acionar um estorno (`REFUND` ou `ROLLBACK`), o sistema deve vincular automaticamente o ID da aposta original e restaurar o saldo.
- [x] Quando o usuário tentar apostar valor superior ao saldo, a interface deve exibir mensagem amigável de saldo insuficiente (`INSUFFICIENT_FUNDS`).
- [x] Quando o usuário acionar a auditoria de consistência, o sistema deve chamar `POST /wallets/:id/reconciliation` e confirmar a exatidão dos créditos e débitos.
- [x] Quando o usuário acessar o portal principal `http://localhost:3000/`, deve haver um card de destaque direcionando para o `/simulator`.

---

## 🧩 Impacto Técnico

### Módulos / Camadas Impactadas
- Interfaces HTTP / Controladores (`src/interfaces/http/`)
- Camada de Views (`src/interfaces/http/views/`)
- Módulo Principal (`src/main.ts`)

### Arquivos Prováveis
- `src/interfaces/http/views/wallet-simulator.view.ts` *(novo arquivo com a view do simulador)*
- `src/interfaces/http/views/portal-landing.view.ts` *(atualização do grid para 3 cards: Simulador, Docs e Métricas)*
- `src/main.ts` *(inclusão da rota `GET /simulator` no controlador correspondente)*

---

## 🧭 Plano de Implementação

1. **Criação da View `wallet-simulator.view.ts`**:
   - Estrutura HTML semântica com layout responsivo e moderno.
   - Estilização Glassmorphic consistente com o portal existente.
   - Script JS cliente com gerenciamento de estado da carteira, gerador de chaves UUID e chamadas `fetch` assíncronas.
2. **Atualização da Landing Page `portal-landing.view.ts`**:
   - Ajustar o grid de 2 para 3 opções (ou layout harmônico) destacando o novo "Simulador Interativo".
3. **Registro da Rota em `src/main.ts`**:
   - Mapear `GET simulator` retornando o HTML renderizado.
4. **Verificação de Qualidade**:
   - Executar `bun run lint` e `bun run typecheck`.
   - Executar suíte de testes `bun test test/unit` para assegurar que nada foi quebrado.

---

## 🧪 Testes Esperados

- [x] `typecheck` e `lint` aprovados sem advertências de tipagem.
- [x] Criação de carteira e exibição imediata na interface.
- [x] Fluxo sequencial de depósito -> aposta -> vitória -> estorno refletido no saldo.
- [x] Reconciliação contábil executada e validada com sucesso.
- [x] Suíte de testes existente mantida com 100% de aprovação.

---

## 🤖 Instruções para IA

### Objetivo Operacional
Implementar a página do simulador seguindo fielmente a identidade visual do projeto, mantendo os parâmetros técnicos abstraídos nos bastidores para que a usabilidade seja focada em **Saldo**, **Player ID** e **Wallet ID**.

### O que a IA deve entregar
- Arquivo `wallet-simulator.view.ts` completo e funcional.
- Integração da rota no `main.ts` e link no `portal-landing.view.ts`.
- Validação técnica via lint e typecheck.

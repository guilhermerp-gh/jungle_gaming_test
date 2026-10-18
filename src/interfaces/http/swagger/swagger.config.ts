import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { APP_VERSION } from "../../../infrastructure/config/config";

export const swaggerDescription = `
### 🎰 API Financeira de Processamento de Apostas

Serviço distribuído com **Ledger Imutável**, **Idempotência Persistente**, **Locks Pessimistas por Carteira**, **Auditoria Contábil em Tempo Real**, **Transactional Outbox Publisher** e **SQS Inbox Consumer**.

---

<details class="quick-guide-expansible" style="margin-top: 16px; margin-bottom: 16px; border: 1px solid #334155; border-radius: 8px; background: rgba(30, 41, 59, 0.4); padding: 12px 16px;">
  <summary style="cursor: pointer; font-size: 1.05rem; font-weight: 700; color: #38bdf8; outline: none; user-select: none;">
    🚀 Guia Rápido de Teste (Ordem Recomendada de Execução) — <span style="font-size: 0.9rem; font-weight: normal; color: #94a3b8;">Clique para expandir / recolher o passo a passo</span>
  </summary>
  <div style="margin-top: 14px; line-height: 1.6;">
    <p>Siga o passo a passo abaixo para testar o fluxo financeiro completo de ponta a ponta:</p>
    <ol>
      <li><strong>1️⃣ Criar uma Carteira (<code>POST /wallets</code>):</strong>
        <ul>
          <li>Informe um <code>playerId</code> (UUID) e um saldo inicial (ex: <code>"100.00"</code>).</li>
          <li>Copie o <strong><code>id</code> da carteira</strong> gerado no retorno.</li>
        </ul>
      </li>
      <li><strong>2️⃣ Consultar Saldo da Carteira (<code>GET /wallets/{id}</code>):</strong>
        <ul>
          <li>Cole o <code>id</code> da carteira para visualizar o saldo atualizado e a versão.</li>
        </ul>
      </li>
      <li><strong>3️⃣ Realizar uma Aposta (<code>POST /transactions</code>):</strong>
        <ul>
          <li>No cabeçalho <code>Idempotency-Key</code>, informe uma chave única (ex: <code>req-001</code>).</li>
          <li>No corpo, use <code>kind: "BET"</code>, <code>amount: "10.00"</code> e cole o seu <code>walletId</code>.</li>
          <li><strong>Retorno esperado:</strong> <code>201 Created</code> com saldo restante de <code>"90.00"</code> (considerando saldo inicial de 100.00). <em>(O Transactional Outbox gera automaticamente os eventos de integração e os despacha para a fila AWS SQS FIFO <code>wallet-events.fifo</code>)</em>.</li>
        </ul>
      </li>
      <li><strong>4️⃣ Testar a Idempotência (<code>POST /transactions</code>):</strong>
        <ul>
          <li>Clique em <strong>Execute</strong> novamente sem alterar nada (mesma chave e mesmo corpo).</li>
          <li><strong>Retorno esperado:</strong> <code>200 OK</code> com <code>"idempotentReplay": true</code> — seu saldo NÃO será debitado novamente!</li>
        </ul>
      </li>
      <li><strong>5️⃣ Creditar um Prêmio (<code>POST /transactions</code>):</strong>
        <ul>
          <li>Altere a <code>Idempotency-Key</code> para <code>req-002</code>, <code>externalTransactionId</code> para outro id e mude <code>kind</code> para <code>"WIN"</code> com valor <code>"50.00"</code>.</li>
          <li><strong>Retorno esperado:</strong> <code>201 Created</code> com saldo elevado para <code>"120.00"</code>.</li>
        </ul>
      </li>
      <li><strong>6️⃣ Consultar Extrato do Ledger (<code>GET /wallets/{id}/ledger</code>):</strong>
        <ul>
          <li>Visualize o histórico imutável de lançamentos contábeis (OPENING, DEBIT e CREDIT).</li>
        </ul>
      </li>
      <li><strong>7️⃣ Auditoria e Reconciliação Contábil (<code>POST /wallets/{id}/reconciliation</code>):</strong>
        <ul>
          <li>Dispare a reconciliação matemática da carteira para comprovar que <code>consistent: true</code> e <code>difference: "0.00"</code>.</li>
        </ul>
      </li>
      <li><strong>8️⃣ Monitoramento da Outbox &amp; Mensageria (<code>GET /metrics</code> ou <code>GET /dashboard</code>):</strong>
        <ul>
          <li>Acesse o endpoint de métricas Prometheus ou o <a href="/dashboard" target="_blank" style="color: #60a5fa; text-decoration: underline;">Dashboard Visual</a> para acompanhar os eventos publicados no SQS FIFO (<code>events_published_total</code>), lag da outbox e métricas do SQS Consumer.</li>
        </ul>
      </li>
    </ol>
  </div>
</details>
`;

export const swaggerCustomCss = `
  .swagger-ui .auth-wrapper {
    display: inline-flex !important;
    align-items: center !important;
    gap: 10px !important;
    position: relative !important;
  }
  .auth-info-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.45);
    color: #38bdf8;
    font-size: 14px;
    cursor: pointer;
    position: relative;
    transition: all 0.2s ease;
    user-select: none;
  }
  .auth-info-btn:hover {
    background: rgba(56, 189, 248, 0.25);
    border-color: #38bdf8;
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.35);
  }
  .auth-info-tooltip {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    width: 320px;
    background: #1e293b;
    color: #f1f5f9;
    border: 1px solid #475569;
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 12px;
    line-height: 1.5;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    z-index: 99999;
    pointer-events: none;
    transition: opacity 0.2s ease, visibility 0.2s ease;
    text-align: left;
    white-space: normal;
    font-weight: normal;
  }
  .auth-info-btn:hover .auth-info-tooltip,
  .auth-info-btn:focus .auth-info-tooltip {
    visibility: visible;
    opacity: 1;
    pointer-events: auto;
  }
  details.quick-guide-expansible summary::-webkit-details-marker {
    color: #38bdf8;
  }
`;

export const swaggerCustomJsStr = `
  (function() {
    function injectAuthInfo() {
      var authWrapper = document.querySelector('.swagger-ui .auth-wrapper');
      if (!authWrapper) return false;
      if (document.getElementById('swagger-auth-info-helper')) return true;

      var btn = authWrapper.querySelector('.btn.authorize');
      if (btn && !btn.getAttribute('title')) {
        btn.setAttribute('title', 'Configurar globalmente o cabeçalho Idempotency-Key');
      }

      var infoBtn = document.createElement('div');
      infoBtn.id = 'swagger-auth-info-helper';
      infoBtn.className = 'auth-info-btn';
      infoBtn.setAttribute('tabindex', '0');
      infoBtn.setAttribute('role', 'button');
      infoBtn.setAttribute('aria-label', 'Informações sobre o Authorize');
      infoBtn.innerHTML = 'ℹ️<div class="auth-info-tooltip"><strong>O que faz o botão Authorize?</strong><br>Permite configurar globalmente o cabeçalho <code>Idempotency-Key</code> (chave de idempotência) para que o Swagger UI o envie automaticamente em todas as requisições de teste.<br><br>💡 <em>Observação:</em> O serviço não exige autenticação via JWT/OAuth para os testes. Em cenários reais de apostas e concorrência, você também pode preencher a <code>Idempotency-Key</code> individualmente no formulário de cada endpoint.</div>';

      authWrapper.appendChild(infoBtn);
      return true;
    }

    var observer = new MutationObserver(function() {
      injectAuthInfo();
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        observer.observe(document.body, { childList: true, subtree: true });
        injectAuthInfo();
      });
    } else {
      observer.observe(document.body, { childList: true, subtree: true });
      injectAuthInfo();
    }
  })();
`;

export function setupSwagger(app: INestApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Distributed Wagering Processor")
    .setDescription(swaggerDescription)
    .setVersion(APP_VERSION)
    .addApiKey(
      {
        type: "apiKey",
        name: "Idempotency-Key",
        in: "header",
        description: "Chave única de idempotência para garantir execução única",
      },
      "Idempotency-Key",
    )
    .addTag("wallets", "Gerenciamento de carteiras, saldos, extrato ledger e reconciliação")
    .addTag("transactions", "Processamento de apostas (BET, WIN, LOSS, REFUND, ROLLBACK)")
    .addTag("observability", "Métricas Prometheus e monitoramento da Outbox")
    .addTag("health", "Saúde e monitoramento do serviço")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document, {
    customSiteTitle: "Jungle Gaming - Wagering Processor API Docs",
    customCss: swaggerCustomCss,
    customJsStr: swaggerCustomJsStr,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
}

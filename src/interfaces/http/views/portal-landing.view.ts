import { APP_VERSION } from "../../../infrastructure/config/config";

export function renderPortalLandingView(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jungle Gaming - Distributed Wagering Processor</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(18, 24, 38, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent-green: #10b981;
      --accent-green-glow: rgba(16, 185, 129, 0.25);
      --accent-cyan: #06b6d4;
      --accent-cyan-glow: rgba(6, 182, 212, 0.25);
      --accent-blue: #3b82f6;
      --accent-purple: #8b5cf6;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 0%, rgba(99, 102, 241, 0.18) 0px, transparent 50%),
        radial-gradient(at 50% 100%, rgba(6, 182, 212, 0.12) 0px, transparent 50%);
      background-attachment: fixed;
      color: var(--text-main);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
    }

    .container {
      width: 100%;
      max-width: 1120px;
      display: flex;
      flex-direction: column;
      gap: 36px;
    }

    /* Top Hero */
    .hero {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--accent-green);
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background-color: var(--accent-green);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--accent-green);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .title {
      font-size: 2.5rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.15;
      background: linear-gradient(135deg, #ffffff 30%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      max-width: 720px;
      font-size: 1.05rem;
      color: var(--text-muted);
      line-height: 1.6;
    }

    /* Grid of 2 Options */
    .options-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px;
    }

    .card {
      position: relative;
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 32px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
      text-decoration: none;
      color: inherit;
    }

    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      opacity: 0.7;
      transition: height 0.3s ease, opacity 0.3s ease;
    }

    .card-docs::before {
      background: linear-gradient(90deg, var(--accent-green), #34d399);
    }

    .card-simulator::before {
      background: linear-gradient(90deg, var(--accent-purple), var(--accent-cyan));
    }

    .card-metrics::before {
      background: linear-gradient(90deg, var(--accent-cyan), var(--accent-blue));
    }

    .card:hover {
      transform: translateY(-6px);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .card-docs:hover {
      box-shadow: 0 20px 35px -10px var(--accent-green-glow);
    }

    .card-simulator:hover {
      box-shadow: 0 20px 35px -10px var(--accent-purple-glow);
    }

    .card-metrics:hover {
      box-shadow: 0 20px 35px -10px var(--accent-cyan-glow);
    }

    .card:hover::before {
      height: 5px;
      opacity: 1;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }

    .card-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      flex-shrink: 0;
    }

    .card-docs .card-icon {
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--accent-green);
    }

    .card-simulator .card-icon {
      background: rgba(139, 92, 246, 0.12);
      border: 1px solid rgba(139, 92, 246, 0.3);
      color: var(--accent-purple);
    }

    .card-metrics .card-icon {
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.3);
      color: var(--accent-cyan);
    }

    .card-title-group h2 {
      font-size: 1.4rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }

    .card-badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
    }

    .card-docs .card-badge {
      background: rgba(16, 185, 129, 0.15);
      color: #6ee7b7;
    }

    .card-simulator .card-badge {
      background: rgba(139, 92, 246, 0.15);
      color: #c4b5fd;
    }

    .card-metrics .card-badge {
      background: rgba(6, 182, 212, 0.15);
      color: #67e8f9;
    }

    .card-desc {
      font-size: 0.95rem;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 22px;
    }

    .features-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 28px;
      font-size: 0.88rem;
    }

    .features-list li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      color: #cbd5e1;
      line-height: 1.45;
    }

    .features-list li svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .card-docs .features-list li svg { color: var(--accent-green); }
    .card-simulator .features-list li svg { color: var(--accent-purple); }
    .card-metrics .features-list li svg { color: var(--accent-cyan); }

    .card-footer-action {
      margin-top: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      padding: 10px 20px;
      border-radius: 10px;
      transition: all 0.2s ease;
    }

    .card-docs .action-btn {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.35);
    }

    .card-docs:hover .action-btn {
      background: var(--accent-green);
      color: #022c22;
      box-shadow: 0 4px 14px var(--accent-green-glow);
    }

    .card-simulator .action-btn {
      background: rgba(139, 92, 246, 0.15);
      color: #c4b5fd;
      border: 1px solid rgba(139, 92, 246, 0.35);
    }

    .card-simulator:hover .action-btn {
      background: var(--accent-purple);
      color: #ffffff;
      box-shadow: 0 4px 14px var(--accent-purple-glow);
    }

    .card-metrics .action-btn {
      background: rgba(6, 182, 212, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(6, 182, 212, 0.35);
    }

    .card-metrics:hover .action-btn {
      background: var(--accent-cyan);
      color: #083344;
      box-shadow: 0 4px 14px var(--accent-cyan-glow);
    }

    .endpoint-hint {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      color: #64748b;
    }

    /* Bottom Quick Info */
    .footer-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 16px 24px;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .quick-links {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .quick-links a {
      color: #94a3b8;
      text-decoration: none;
      transition: color 0.2s ease;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
    }

    .quick-links a:hover {
      color: #f1f5f9;
      text-decoration: underline;
    }

    .stack-tags {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .tag {
      background: rgba(255, 255, 255, 0.05);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      color: #cbd5e1;
      font-family: 'JetBrains Mono', monospace;
    }

    @media (max-width: 768px) {
      .title { font-size: 1.85rem; }
      .card { padding: 24px; }
      .footer-bar { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Hero Header -->
    <header class="hero">
      <div class="status-badge">
        <span class="status-dot"></span>
        <span>Sistema Operacional &bull; v${APP_VERSION}</span>
      </div>
      <h1 class="title">Distributed Wagering Processor</h1>
      <p class="subtitle">
        Motor financeiro distribuído de alta concorrência com <strong>Ledger Imutável</strong>, <strong>Idempotência Persistente</strong>, <strong>Transactional Outbox</strong>, <strong>SQS Consumer</strong> e <strong>Pending Reference Resolver</strong> (Resolução Fora de Ordem). Escolha um dos portais abaixo para iniciar:
      </p>
    </header>

    <!-- Main Portals Grid -->
    <main class="options-grid">
      <!-- Option 1: Visual Wallet Simulator (Playground) -->
      <a href="/simulator" class="card card-simulator">
        <div>
          <div class="card-header">
            <div class="card-icon">🎰</div>
            <div class="card-title-group">
              <h2>Simulador de Jogador &amp; Carteira</h2>
              <span class="card-badge">Wallet Playground &bull; Zero Burocracia</span>
            </div>
          </div>
          <p class="card-desc">
            Simulador visual e amigável para testar depósitos, apostas (BET), vitórias (WIN), derrotas e estornos com saldo em tempo real.
          </p>
          <ul class="features-list">
            <li>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
              <span><strong>Foco em Saldo &amp; Jogador:</strong> Manipule apenas saldo e IDs; chaves de idempotência e UUIDs são gerados nos bastidores.</span>
            </li>
            <li>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
              <span><strong>Caixa com Chips Rápidos:</strong> Depósitos imediatos de R$ 20, R$ 50, R$ 100 com lock pessimista no PostgreSQL.</span>
            </li>
            <li>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
              <span><strong>Mesa de Apostas:</strong> Simule o ciclo completo de aposta, prêmio e estorno (REFUND) automático com 1 clique.</span>
            </li>
            <li>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
              <span><strong>Auditoria Instantânea:</strong> Verificação contábil ao vivo entre o saldo armazenado e o livro-razão (Ledger).</span>
            </li>
          </ul>
        </div>
        <div class="card-footer-action">
          <span class="endpoint-hint">GET /simulator | /playground</span>
          <span class="action-btn">
            Abrir Simulador
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </span>
        </div>
      </a>

      <!-- Option 2: Glassmorphic Docs -->
      <a href="/docs" class="card card-docs">
        <div>
          <div class="card-header">
            <div class="card-icon">📚</div>
            <div class="card-title-group">
              <h2>API Docs &amp; Testes</h2>
              <span class="card-badge">Glassmorphic Explorer &bull; OAS 3.0</span>
            </div>
          </div>
          <p class="card-desc">
            Documentação interativa e console de testes com visual Glassmorphic para testar o fluxo financeiro de ponta a ponta.
          </p>
          <ul class="features-list">
            <li>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
              <span><strong>Console de Execução Ativo:</strong> Dispare requisições reais para <code>/wallets</code>, <code>/transactions</code> e <code>/ledger</code> com latência e status ao vivo.</span>
            </li>
            <li>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
              <span><strong>Guia Rápido de Teste:</strong> Passo a passo detalhado do fluxo contábil de 1 a 8 com pré-preenchimento automático.</span>
            </li>
            <li>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
              <span><strong>Gerador de Idempotency-Key:</strong> Configuração global com botão rápido <code>⚡ Novo ID</code> para testes de concorrência.</span>
            </li>
            <li>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
              <span><strong>Predefinições Instantâneas:</strong> Botões de um clique para simular BET (R$ 10,00), WIN (R$ 50,00) e REFUND (R$ 10,00).</span>
            </li>
          </ul>
        </div>
        <div class="card-footer-action">
          <span class="endpoint-hint">GET /docs | /api/docs</span>
          <span class="action-btn">
            Abrir Console de Docs
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </span>
        </div>
      </a>

      <!-- Option 3: Metrics & Observability -->
      <a href="/dashboard" class="card card-metrics">
        <div>
          <div class="card-header">
            <div class="card-icon">📊</div>
            <div class="card-title-group">
              <h2>Métricas &amp; Observabilidade</h2>
              <span class="card-badge">Glassmorphic Dashboard &bull; Prometheus</span>
            </div>
          </div>
          <p class="card-desc">
            Painel visual em tempo real para times de SRE, DevOps e arquitetura acompanharem os pipelines assíncronos e a saúde dos nós.
          </p>
          <ul class="features-list">
            <li>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
              <span><strong>Transactional Outbox:</strong> Taxa de publicação no AWS SQS FIFO e monitoramento de lag (<code>outbox_lag_seconds</code>).</span>
            </li>
            <li>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
              <span><strong>SQS Consumer &amp; Inbox:</strong> Volume de apostas processadas, deduplicação por hash e latência de ACK.</span>
            </li>
            <li>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
              <span><strong>DLQ &amp; Poison Pills:</strong> Detecção automática de mensagens malformadas isoladas na fila de quarentena.</span>
            </li>
            <li>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
              <span><strong>Exportação Prometheus:</strong> Coleta compatível com Grafana e coletores via <code>/metrics?raw=true</code>.</span>
            </li>
          </ul>
        </div>
        <div class="card-footer-action">
          <span class="endpoint-hint">GET /dashboard | /metrics</span>
          <span class="action-btn">
            Abrir Dashboard
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </span>
        </div>
      </a>
    </main>

    <!-- Footer Bar -->
    <footer class="footer-bar">
      <div class="quick-links">
        <span style="font-weight: 600; color: #cbd5e1;">Atalhos de Sistema:</span>
        <a href="/simulator">/simulator</a>
        <a href="/docs">/docs</a>
        <a href="/dashboard">/dashboard</a>
        <a href="/health/live" target="_blank">/health/live</a>
        <a href="/health/ready" target="_blank">/health/ready</a>
        <a href="/metrics?raw=true" target="_blank">/metrics?raw=true</a>
        <a href="/api/metrics" target="_blank">/api/metrics</a>
      </div>
      <div class="stack-tags">
        <span class="tag">NestJS</span>
        <span class="tag">Bun</span>
        <span class="tag">PostgreSQL 16</span>
        <span class="tag">AWS SQS FIFO</span>
        <span class="tag">Prometheus</span>
      </div>
    </footer>
  </div>
</body>
</html>
`;
}

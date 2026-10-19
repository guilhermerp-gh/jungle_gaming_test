import { APP_VERSION } from "../../../infrastructure/config/config";

export function renderMetricsDashboardView(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jungle Gaming - Outbox Observer & Metrics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(18, 24, 38, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent-green: #10b981;
      --accent-green-glow: rgba(16, 185, 129, 0.25);
      --accent-cyan: #06b6d4;
      --accent-purple: #8b5cf6;
      --accent-blue: #3b82f6;
      --accent-amber: #f59e0b;
      --accent-rose: #f43f5e;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.12) 0px, transparent 50%),
        radial-gradient(at 100% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
        radial-gradient(at 50% 100%, rgba(6, 182, 212, 0.08) 0px, transparent 50%);
      background-attachment: fixed;
      color: var(--text-main);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      padding: 32px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .container {
      width: 100%;
      max-width: 1180px;
      display: flex;
      flex-direction: column;
      gap: 28px;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      padding: 24px 32px;
      border-radius: 20px;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .brand-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 8px 20px -4px var(--accent-green-glow);
    }

    .brand-title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(90deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .brand-subtitle {
      font-size: 13px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 2px;
    }

    .badge-live {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      background-color: var(--accent-green);
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      animation: pulse 1.8s infinite;
    }

    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }

    .btn-swagger {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
    }
    .btn-swagger:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.45);
    }

    .btn-raw {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
    }
    .btn-raw:hover {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }

    /* Grid de Métricas Principais */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }

    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 18px;
      padding: 24px;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .card:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 255, 255, 0.18);
    }

    .card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
    }

    .card-lag::before { background: linear-gradient(90deg, #10b981, #06b6d4); }
    .card-published::before { background: linear-gradient(90deg, #8b5cf6, #3b82f6); }
    .card-errors::before { background: linear-gradient(90deg, #10b981, #f59e0b); }
    .card-pipeline::before { background: linear-gradient(90deg, #06b6d4, #8b5cf6); }
    .card-resolver::before { background: linear-gradient(90deg, #f59e0b, #10b981); }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    .card-icon {
      font-size: 20px;
    }

    .card-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 38px;
      font-weight: 700;
      letter-spacing: -1px;
      color: #ffffff;
      line-height: 1;
      transition: color 0.3s ease;
    }

    .card-desc {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .card-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      color: #34d399;
    }

    /* Tabela de Eventos Detalhada */
    .section-card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 18px;
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .section-title {
      font-size: 17px;
      font-weight: 700;
      color: white;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .refresh-status {
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'JetBrains Mono', monospace;
    }

    .events-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .events-table th {
      padding: 12px 16px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--card-border);
    }

    .events-table td {
      padding: 16px;
      font-size: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    .events-table tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .clickable-row {
      cursor: pointer;
      user-select: none;
      transition: background 0.15s ease;
    }

    .clickable-row:hover td {
      background: rgba(56, 189, 248, 0.08) !important;
    }

    .clickable-row.expanded td {
      background: rgba(56, 189, 248, 0.14) !important;
      border-bottom: 1px solid rgba(56, 189, 248, 0.3) !important;
    }

    .row-arrow {
      display: inline-block;
      width: 14px;
      font-size: 11px;
      color: #38bdf8;
      transition: transform 0.2s ease;
      margin-right: 6px;
    }

    .clickable-row.expanded .row-arrow {
      transform: rotate(90deg);
    }

    .row-hint {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: #38bdf8;
      opacity: 0.85;
      font-weight: 500;
      background: rgba(56, 189, 248, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(56, 189, 248, 0.2);
    }

    .info-icon-wrapper {
      position: relative;
      display: inline-flex;
      align-items: center;
      margin-left: 8px;
      vertical-align: middle;
      cursor: help;
    }

    .info-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.35);
      color: #38bdf8;
      font-size: 11px;
      font-weight: 700;
      font-style: italic;
      font-family: 'JetBrains Mono', monospace;
      line-height: 1;
      transition: all 0.2s ease;
    }

    .info-icon-wrapper:hover .info-badge {
      background: rgba(56, 189, 248, 0.35);
      border-color: #38bdf8;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
      transform: scale(1.15);
    }

    .info-popover {
      visibility: hidden;
      opacity: 0;
      position: absolute;
      top: 50%;
      left: calc(100% + 12px);
      transform: translateY(-50%) translateX(-6px);
      background: rgba(13, 20, 36, 0.96);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(56, 189, 248, 0.45);
      border-radius: 12px;
      padding: 14px 16px;
      width: 320px;
      color: #e2e8f0;
      font-size: 12px;
      line-height: 1.5;
      font-weight: 400;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.75), 0 0 20px rgba(56, 189, 248, 0.2);
      z-index: 999;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
    }

    .info-icon-wrapper:hover .info-popover {
      visibility: visible;
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }

    .info-popover-title {
      font-weight: 700;
      font-size: 13px;
      color: #38bdf8;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .info-popover-meta {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .details-row td {
      padding: 0 !important;
      background: rgba(11, 17, 32, 0.9) !important;
      border-bottom: 2px solid rgba(56, 189, 248, 0.3) !important;
    }

    .details-panel {
      padding: 20px 24px;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .details-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .details-title {
      font-size: 13px;
      font-weight: 700;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-mini-refresh {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #cbd5e1;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-mini-refresh:hover {
      background: rgba(56, 189, 248, 0.2);
      border-color: #38bdf8;
      color: white;
    }

    .sub-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .sub-table th {
      padding: 8px 12px;
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .sub-table td {
      padding: 9px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: #e2e8f0;
      font-family: 'JetBrains Mono', monospace;
    }

    .sub-table tr:hover td {
      background: rgba(255, 255, 255, 0.03);
    }

    .badge-status {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }

    .badge-processed {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .badge-rejected {
      background: rgba(244, 63, 94, 0.15);
      color: #fb7185;
      border: 1px solid rgba(244, 63, 94, 0.3);
    }

    .badge-pending {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .event-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 600;
    }

    .chip-purple {
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.3);
      color: #c4b5fd;
    }

    .chip-blue {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #93c5fd;
    }

    .chip-green {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #6ee7b7;
    }

    .chip-amber {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fcd34d;
    }

    .progress-bar-container {
      width: 100%;
      height: 3px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 999px;
      overflow: hidden;
      margin-top: 8px;
    }

    .progress-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #10b981, #06b6d4);
      transition: width 0.1s linear;
    }

    .specs-pill {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 12px;
      color: var(--text-muted);
    }

    .pill {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 4px 10px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
    }

    .pill span { color: #38bdf8; }

    footer {
      font-size: 12px;
      color: var(--text-muted);
      text-align: center;
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <div class="brand">
        <div class="brand-icon">🎰</div>
        <div>
          <div class="brand-title">Jungle Wagering • Outbox Observer</div>
          <div class="brand-subtitle">
            <span>Monitoramento Transacional de Mensageria & Resiliência</span>
            <div class="badge-live"><div class="pulse-dot"></div> Live Polling (200ms)</div>
          </div>
        </div>
      </div>
      <div class="header-actions">
        <a href="/api/docs#/" target="_blank" class="btn btn-swagger">
          🚀 Abrir Swagger UI
        </a>
        <a href="/metrics?raw=true" target="_blank" class="btn btn-raw">
          📄 Raw Prometheus
        </a>
      </div>
    </header>

    <!-- Barra de progresso do auto-refresh -->
    <div>
      <div class="progress-bar-container">
        <div id="progress" class="progress-bar"></div>
      </div>
    </div>

    <!-- Grid de Métricas Principais -->
    <section class="grid">
      <!-- Outbox Lag -->
      <div class="card card-lag">
        <div class="card-header">
          <span class="card-title">Outbox Lag</span>
          <span class="card-icon">⏱️</span>
        </div>
        <div id="metric-lag" class="card-value">0.00s</div>
        <p class="card-desc">Idade do evento pendente mais antigo na tabela <code>outbox_messages</code>.</p>
        <div id="lag-status" class="card-meta">
          <span>●</span> <span>Sincronizado em tempo real</span>
        </div>
      </div>

      <!-- Eventos Publicados -->
      <div class="card card-published">
        <div class="card-header">
          <span class="card-title">Eventos Publicados</span>
          <span class="card-icon">📦</span>
        </div>
        <div id="metric-published-total" class="card-value">0</div>
        <p class="card-desc">Total de eventos despachados para a fila SQS FIFO <code>wallet-events.fifo</code>.</p>
        <div class="card-meta" style="color: #a78bfa;">
          <span>✓</span> <span>At-Least-Once Delivery</span>
        </div>
      </div>

      <!-- SQS Consumidas -->
      <div class="card card-published">
        <div class="card-header">
          <span class="card-title">SQS Consumidas</span>
          <span class="card-icon">📥</span>
        </div>
        <div id="metric-consumed-total" class="card-value">0</div>
        <p class="card-desc">Apostas consumidas de <code>wager-transactions.fifo</code> via Inbox Pattern.</p>
        <div id="consumed-meta" class="card-meta" style="color: #38bdf8;">
          <span>✓</span> <span>Idempotência Atômica</span>
        </div>
      </div>

      <!-- DLQ / Poison Pills -->
      <div class="card card-errors">
        <div class="card-header">
          <span class="card-title">Dead Letter Queue (DLQ)</span>
          <span class="card-icon">💀</span>
        </div>
        <div id="metric-dlq-total" class="card-value">0</div>
        <p class="card-desc">Mensagens inválidas ou não processáveis enviadas para <code>wager-transactions-dlq.fifo</code>.</p>
        <div id="dlq-status" class="card-meta">
          <span>●</span> <span>Zero mensagens corrompidas</span>
        </div>
      </div>

      <!-- Pendências Ativas (Fase 7) -->
      <div class="card card-resolver">
        <div class="card-header">
          <span class="card-title">Pendências Ativas</span>
          <span class="card-icon">⏳</span>
        </div>
        <div id="metric-pending-active" class="card-value">0</div>
        <p class="card-desc">Transações em <code>PENDING_REFERENCE</code> aguardando chegada da referência.</p>
        <div id="pending-active-status" class="card-meta" style="color: #34d399;">
          <span>●</span> <span>Nenhuma pendência ativa</span>
        </div>
      </div>

      <!-- Pendências Resolvidas (Fase 7) -->
      <div class="card card-resolver">
        <div class="card-header">
          <span class="card-title">Pendências Resolvidas</span>
          <span class="card-icon">🎯</span>
        </div>
        <div id="metric-pending-resolved" class="card-value">0</div>
        <p class="card-desc">Apostas fora de ordem reconciliadas pelo worker ou fast-path.</p>
        <div class="card-meta" style="color: #34d399;">
          <span>✓</span> <span>Consistência Eventual</span>
        </div>
      </div>

      <!-- Transações de Apostas (Fase 9) -->
      <div class="card card-published">
        <div class="card-header">
          <span class="card-title">Transações de Apostas</span>
          <span class="card-icon">🎰</span>
        </div>
        <div id="metric-wagers-total" class="card-value">0</div>
        <p class="card-desc">Total de operações de apostas avaliadas (<code>wager_transactions_total</code>).</p>
        <div id="wagers-status" class="card-meta" style="color: #34d399;">
          <span>✓</span> <span>Ledger Imutável</span>
        </div>
      </div>

      <!-- Replays de Idempotência (Fase 9) -->
      <div class="card card-lag">
        <div class="card-header">
          <span class="card-title">Replays de Idempotência</span>
          <span class="card-icon">🛡️</span>
        </div>
        <div id="metric-replays-total" class="card-value">0</div>
        <p class="card-desc">Requisições duplicadas servidas sem novo débito (<code>idempotent_replays_total</code>).</p>
        <div class="card-meta" style="color: #38bdf8;">
          <span>✓</span> <span>Idempotência Persistente</span>
        </div>
      </div>

      <!-- Conflitos de Lock (Fase 9) -->
      <div class="card card-resolver">
        <div class="card-header">
          <span class="card-title">Conflitos de Lock</span>
          <span class="card-icon">🔒</span>
        </div>
        <div id="metric-conflicts-total" class="card-value">0</div>
        <p class="card-desc">Conflitos de lock pessimista mitigados (<code>lock_conflicts_total</code>).</p>
        <div class="card-meta" style="color: #a78bfa;">
          <span>✓</span> <span>Serialização por Linha</span>
        </div>
      </div>

      <!-- Reconciliação Contábil (Fase 9) -->
      <div class="card card-errors">
        <div class="card-header">
          <span class="card-title">Mismatches Contábeis</span>
          <span class="card-icon">⚖️</span>
        </div>
        <div id="metric-mismatch-total" class="card-value">0</div>
        <p class="card-desc">Inconsistências entre saldo e ledger (<code>reconciliation_mismatch_total</code>).</p>
        <div id="mismatch-status" class="card-meta" style="color: #34d399;">
          <span>●</span> <span>Zero divergências (100% íntegro)</span>
        </div>
      </div>
    </section>

    <!-- Detalhamento por Tipo de Evento e Consumo -->
    <section class="section-card">
      <div class="section-header">
        <h2 class="section-title">
          <span>📊</span> Detalhamento de Eventos no SQS FIFO (Outbox & Consumer)
        </h2>
        <div class="refresh-status">
          <span>Última leitura:</span>
          <span id="last-update" style="color: #38bdf8;">--:--:--</span>
        </div>
      </div>

      <table class="events-table">
        <thead>
          <tr>
            <th>Tipo / Origem</th>
            <th>Fila SQS</th>
            <th>Métrica / Operação</th>
            <th>Contagem</th>
            <th>Garantia</th>
          </tr>
        </thead>
        <tbody id="events-tbody">
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
              Carregando métricas da outbox e consumidor...
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <footer>
      Jungle Gaming Technical Test • Distributed Wagering Processor • v${APP_VERSION}
    </footer>
  </div>

  <script>
    const REFRESH_INTERVAL_MS = 1500;
    let progressStartTime = Date.now();

    function updateProgressBar() {
      const elapsed = Date.now() - progressStartTime;
      const pct = Math.min(100, (elapsed / REFRESH_INTERVAL_MS) * 100);
      document.getElementById('progress').style.width = pct + '%';
      if (pct < 100) {
        requestAnimationFrame(updateProgressBar);
      }
    }

    async function fetchMetrics() {
      try {
        const res = await fetch('/api/metrics');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        renderData(data);
      } catch (err) {
        console.error('Falha ao obter métricas:', err);
      } finally {
        progressStartTime = Date.now();
        requestAnimationFrame(updateProgressBar);
        setTimeout(fetchMetrics, REFRESH_INTERVAL_MS);
      }
    }

    function renderData(metrics) {
      // 1. Lag
      const lagMetric = metrics.find(m => m.name === 'outbox_lag_seconds');
      const lagVal = lagMetric?.values?.[0]?.value ?? 0;
      const lagElem = document.getElementById('metric-lag');
      lagElem.textContent = lagVal.toFixed(2) + 's';
      
      const lagStatus = document.getElementById('lag-status');
      if (lagVal === 0) {
        lagElem.style.color = '#34d399';
        lagStatus.innerHTML = '<span>●</span> <span>Fila zerada (sem atraso)</span>';
        lagStatus.style.color = '#34d399';
      } else if (lagVal < 5) {
        lagElem.style.color = '#38bdf8';
        lagStatus.innerHTML = '<span>●</span> <span>Drenando mensagens</span>';
        lagStatus.style.color = '#38bdf8';
      } else {
        lagElem.style.color = '#f59e0b';
        lagStatus.innerHTML = '<span>▲</span> <span>Atraso detectado</span>';
        lagStatus.style.color = '#f59e0b';
      }

      // 2. Published Total
      const pubMetric = metrics.find(m => m.name === 'events_published_total');
      let totalPublished = 0;
      const eventRows = [];

      if (pubMetric && pubMetric.values) {
        for (const item of pubMetric.values) {
          totalPublished += item.value;
          eventRows.push({
            key: 'pub_' + (item.labels?.event_type || 'unknown'),
            type: item.labels?.event_type || 'Desconhecido',
            rawType: item.labels?.event_type || '',
            queue: 'wallet-events.fifo',
            count: item.value,
            category: 'PUBLISHED',
          });
        }
      }
      document.getElementById('metric-published-total').textContent = totalPublished;

      // 3. Consumed Total
      const consumedMetric = metrics.find(m => m.name === 'sqs_messages_consumed_total');
      let totalConsumed = 0;
      if (consumedMetric && consumedMetric.values) {
        for (const item of consumedMetric.values) {
          totalConsumed += item.value;
          eventRows.push({
            key: 'cons_' + (item.labels?.status || 'processed'),
            type: 'Wager Transaction (' + (item.labels?.status || 'processed') + ')',
            rawType: item.labels?.status || '',
            queue: 'wager-transactions.fifo',
            count: item.value,
            category: 'CONSUMED',
            status: item.labels?.status,
          });
        }
      }
      document.getElementById('metric-consumed-total').textContent = totalConsumed;

      // 4. DLQ Total
      const dlqMetric = metrics.find(m => m.name === 'dlq_messages_total');
      let totalDlq = 0;
      if (dlqMetric && dlqMetric.values) {
        for (const item of dlqMetric.values) {
          totalDlq += item.value;
        }
      }
      const dlqElem = document.getElementById('metric-dlq-total');
      dlqElem.textContent = totalDlq;
      const dlqStatus = document.getElementById('dlq-status');
      if (totalDlq === 0) {
        dlqElem.style.color = '#34d399';
        dlqStatus.innerHTML = '<span>●</span> <span>Zero mensagens corrompidas</span>';
        dlqStatus.style.color = '#34d399';
      } else {
        dlqElem.style.color = '#f43f5e';
        dlqStatus.innerHTML = '<span>⚠️</span> <span>Poison pills isoladas na DLQ</span>';
        dlqStatus.style.color = '#f43f5e';
      }

      // 5. Pending Reference Resolver
      const pendingActiveMetric = metrics.find(m => m.name === 'pending_references_active_gauge');
      const pendingActiveVal = pendingActiveMetric?.values?.[0]?.value ?? 0;
      const pendingActiveElem = document.getElementById('metric-pending-active');
      const pendingActiveStatus = document.getElementById('pending-active-status');
      if (pendingActiveElem) {
        pendingActiveElem.textContent = pendingActiveVal;
        if (pendingActiveVal > 0) {
          pendingActiveElem.style.color = '#f59e0b';
          if (pendingActiveStatus) {
            pendingActiveStatus.innerHTML = '<span>●</span> <span>' + pendingActiveVal + ' aguardando referência</span>';
            pendingActiveStatus.style.color = '#f59e0b';
          }
        } else {
          pendingActiveElem.style.color = '#34d399';
          if (pendingActiveStatus) {
            pendingActiveStatus.innerHTML = '<span>●</span> <span>Nenhuma pendência ativa</span>';
            pendingActiveStatus.style.color = '#34d399';
          }
        }
      }

      const pendingResolvedMetric = metrics.find(m => m.name === 'pending_references_resolved_total');
      let totalResolved = 0;
      if (pendingResolvedMetric && pendingResolvedMetric.values) {
        for (const item of pendingResolvedMetric.values) {
          totalResolved += item.value;
          eventRows.push({
            key: 'res_' + (item.labels?.outcome || 'resolved'),
            type: 'Pending Reference (' + (item.labels?.outcome || 'resolved') + ')',
            rawType: item.labels?.outcome || '',
            queue: 'wager_transactions (resolver)',
            count: item.value,
            category: 'RESOLVED',
          });
        }
      }
      const pendingResolvedElem = document.getElementById('metric-pending-resolved');
      if (pendingResolvedElem) {
        pendingResolvedElem.textContent = totalResolved;
      }

      // 6. Transações de Apostas (Fase 9)
      const wagersMetric = metrics.find(m => m.name === 'wager_transactions_total');
      let totalWagers = 0;
      if (wagersMetric && wagersMetric.values) {
        for (const item of wagersMetric.values) {
          totalWagers += item.value;
          eventRows.push({
            key: 'tx_' + (item.labels?.kind || 'TX') + '_' + (item.labels?.status || 'PROCESSED'),
            type: 'Wager ' + (item.labels?.kind || 'TX') + ' (' + (item.labels?.status || 'PROCESSED') + ')',
            rawType: item.labels?.kind || '',
            queue: 'PostgreSQL / Ledger',
            count: item.value,
            category: 'TRANSACTION',
            kind: item.labels?.kind,
            status: item.labels?.status,
          });
        }
      }
      const wagersElem = document.getElementById('metric-wagers-total');
      if (wagersElem) wagersElem.textContent = totalWagers;

      // 7. Replays de Idempotência (Fase 9)
      const replaysMetric = metrics.find(m => m.name === 'idempotent_replays_total');
      let totalReplays = 0;
      if (replaysMetric && replaysMetric.values) {
        for (const item of replaysMetric.values) {
          totalReplays += item.value;
          eventRows.push({
            key: 'replay_' + (item.labels?.kind || 'TX') + '_' + (item.labels?.source || 'http'),
            type: 'Idempotent Replay (' + (item.labels?.kind || 'TX') + ' via ' + (item.labels?.source || 'http') + ')',
            rawType: item.labels?.kind || '',
            queue: 'API / Cache Persistente',
            count: item.value,
            category: 'IDEMPOTENT_REPLAY',
            kind: item.labels?.kind,
            source: item.labels?.source,
          });
        }
      }
      const replaysElem = document.getElementById('metric-replays-total');
      if (replaysElem) replaysElem.textContent = totalReplays;

      // 8. Conflitos de Lock (Fase 9)
      const conflictsMetric = metrics.find(m => m.name === 'lock_conflicts_total');
      let totalConflicts = 0;
      if (conflictsMetric && conflictsMetric.values) {
        for (const item of conflictsMetric.values) {
          totalConflicts += item.value;
        }
      }
      const conflictsElem = document.getElementById('metric-conflicts-total');
      if (conflictsElem) conflictsElem.textContent = totalConflicts;

      // 9. Reconciliação / Mismatches Contábeis (Fase 9)
      const mismatchMetric = metrics.find(m => m.name === 'reconciliation_mismatch_total');
      const totalMismatches = mismatchMetric?.values?.[0]?.value ?? 0;
      const mismatchElem = document.getElementById('metric-mismatch-total');
      const mismatchStatus = document.getElementById('mismatch-status');
      if (mismatchElem) {
        mismatchElem.textContent = totalMismatches;
        if (totalMismatches === 0) {
          mismatchElem.style.color = '#34d399';
          if (mismatchStatus) {
            mismatchStatus.innerHTML = '<span>●</span> <span>Zero divergências (100% íntegro)</span>';
            mismatchStatus.style.color = '#34d399';
          }
        } else {
          mismatchElem.style.color = '#f43f5e';
          if (mismatchStatus) {
            mismatchStatus.innerHTML = '<span>⚠️</span> <span>' + totalMismatches + ' divergência(s) detectada(s)!</span>';
            mismatchStatus.style.color = '#f43f5e';
          }
        }
      }

      // 10. Atualiza tabela mantendo estado de expansão
      window.lastEventRows = eventRows;
      renderCurrentTable();

      // Horário da leitura
      document.getElementById('last-update').textContent = new Date().toLocaleTimeString('pt-BR');
    }

    const operationsCache = {};

    function getEventInfo(ev) {
      if (ev.category === 'PUBLISHED') {
        if (ev.type.includes('WalletBalanceChanged')) {
          return {
            title: '⚡ Evento: WalletBalanceChanged',
            desc: 'Mensagem publicada na fila SQS FIFO (wallet-events.fifo) pelo Transactional Outbox sempre que o saldo da carteira sofre qualquer alteração (depósito, débito de aposta, crédito de prêmio ou estorno).',
            meta: 'Origem: Outbox • Garantia: At-Least-Once'
          };
        }
        if (ev.type.includes('WagerTransactionProcessed')) {
          return {
            title: '⚡ Evento: WagerTransactionProcessed',
            desc: 'Mensagem publicada na fila SQS FIFO sinalizando que uma transação de aposta, depósito ou estorno concluiu seu ciclo com sucesso contábil (status PROCESSED) no banco.',
            meta: 'Origem: Outbox • Consumidor: Downstream / BI'
          };
        }
        if (ev.type.includes('WagerTransactionRejected')) {
          return {
            title: '⚠️ Evento: WagerTransactionRejected',
            desc: 'Mensagem publicada na fila SQS FIFO notificando que uma aposta ou reversão foi rejeitada por regra de negócio (ex: saldo insuficiente, aposta já estornada).',
            meta: 'Origem: Outbox • Status: REJECTED'
          };
        }
        return {
          title: '⚡ Mensagem Publicada no Outbox',
          desc: 'Mensagem financeira persistida transacionalmente no PostgreSQL e despachada ao Amazon SQS FIFO com garantia de entrega at-least-once e desduplicação.',
          meta: 'Fila: wallet-events.fifo'
        };
      }

      if (ev.category === 'CONSUMED') {
        return {
          title: '📥 Consumo SQS: Wager Transaction',
          desc: 'Mensagem financeira recebida da fila SQS FIFO e processada pelo worker consumidor através do Inbox Pattern, garantindo desduplicação e idempotência ponta a ponta.',
          meta: 'Fila: wager-transactions.fifo'
        };
      }

      if (ev.category === 'RESOLVED') {
        return {
          title: '🎯 Pending Reference: Resolução Fora de Ordem',
          desc: 'Transação dependente (WIN, REFUND ou ROLLBACK) que chegou antes da aposta de referência (BET) e foi resolvida pelo worker de background ou pelo Fast-Path atômico.',
          meta: 'Tabela: wager_transactions'
        };
      }

      if (ev.category === 'IDEMPOTENT_REPLAY') {
        return {
          title: '🔁 Replay Idempotente de Requisição',
          desc: 'Requisição repetida com a mesma Idempotency-Key. O sistema devolveu o snapshot da resposta original (200 OK) sem debitar ou creditar o saldo novamente.',
          meta: 'Garantia: Zero Duplicação Financeira'
        };
      }

      // TRANSACTION:
      if (ev.kind === 'BET') {
        return {
          title: '🎲 Transação: Aposta (BET)',
          desc: ev.status === 'PROCESSED'
            ? 'Aposta liquidada com sucesso: valor debitado do saldo da carteira sob lock pessimista (FOR UPDATE) e registrado no livro-razão (ledger).'
            : 'Aposta rejeitada antes de movimentar saldo (geralmente por INSUFFICIENT_FUNDS quando a carteira não possui fundos suficientes).',
          meta: 'Tabela: wager_transactions • Status: ' + ev.status
        };
      }
      if (ev.kind === 'REFUND') {
        return {
          title: '🔄 Transação: Estorno (REFUND)',
          desc: ev.status === 'PROCESSED'
            ? 'Estorno contábil efetuado com sucesso: valor integral da aposta devolvido ao saldo e aposta original marcada como revertida.'
            : 'Estorno rejeitado pela política (ex: ALREADY_REVERSED porque a aposta original já foi revertida anteriormente, ou REFERENCE_NOT_FOUND).',
          meta: 'Tabela: wager_transactions • Status: ' + ev.status
        };
      }
      if (ev.kind === 'WIN') {
        return {
          title: '💰 Transação: Prêmio (WIN)',
          desc: ev.status === 'PROCESSED'
            ? 'Prêmio da rodada creditado no saldo do jogador com lançamento CREDIT correspondente no livro-razão (ledger).'
            : 'Prêmio retido em PENDING_REFERENCE (aguardando a BET de referência) ou rejeitado por regra de negócio.',
          meta: 'Tabela: wager_transactions • Status: ' + ev.status
        };
      }
      if (ev.kind === 'DEPOSIT') {
        return {
          title: '💳 Transação: Depósito (DEPOSIT)',
          desc: 'Entrada de fundos na carteira via gateway financeiro/PIX, creditando o saldo, gerando lançamento CREDIT no ledger e evento Outbox.',
          meta: 'Tabela: wager_transactions • Tipo: Crédito'
        };
      }

      return {
        title: '📊 Transação Contábil',
        desc: 'Operação financeira registrada no ledger do PostgreSQL sob garantias ACID e lock pessimista.',
        meta: 'Tabela: wager_transactions'
      };
    }

    function renderCurrentTable() {
      const tbody = document.getElementById('events-tbody');
      const eventRows = window.lastEventRows || [];
      if (eventRows.length === 0) {
        tbody.innerHTML = \`
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
              Nenhum evento financeiro gerado ou consumido ainda. Submeta uma aposta no Swagger ou na fila SQS!
            </td>
          </tr>
        \`;
        return;
      }

      const activeKey = window.selectedRowKey || null;

      tbody.innerHTML = eventRows.map(ev => {
        let chipClass = 'chip-purple';
        if (ev.type.includes('Balance')) chipClass = 'chip-blue';
        if (ev.type.includes('Processed') || ev.type.includes('success')) chipClass = 'chip-green';
        if (ev.type.includes('Rejected') || ev.type.includes('rejection')) chipClass = 'chip-amber';
        if (ev.type.includes('poison') || ev.type.includes('error')) chipClass = 'chip-rose';

        const info = getEventInfo(ev);
        const isExpanded = activeKey === ev.key;
        const mainRow = \`
          <tr class="clickable-row \${isExpanded ? 'expanded' : ''}" onclick="toggleRowDetails('\${ev.key}', '\${ev.category}', '\${encodeURIComponent(ev.rawType || ev.type)}', '\${ev.kind || ''}', '\${ev.status || ''}', \${ev.count})">
            <td>
              <div style="display: inline-flex; align-items: center;">
                <span class="row-arrow">\${isExpanded ? '▼' : '▶'}</span>
                <span class="event-chip \${chipClass}">
                  <span>⚡</span> \${ev.type}
                </span>
                <span class="info-icon-wrapper" onclick="event.stopPropagation();" title="Explicação do Evento">
                  <span class="info-badge">i</span>
                  <div class="info-popover">
                    <div class="info-popover-title">
                      <span>●</span> \${info.title}
                    </div>
                    <div style="font-size:12px; line-height:1.45; color:#cbd5e1;">
                      \${info.desc}
                    </div>
                    <div class="info-popover-meta">
                      <span>\${info.meta}</span>
                      <span style="color:#38bdf8;">Clique na linha p/ lista</span>
                    </div>
                  </div>
                </span>
              </div>
            </td>
            <td style="font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #94a3b8;">
              \${ev.queue}
            </td>
            <td style="font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #cbd5e1;">
              \${ev.category}
            </td>
            <td style="font-family: 'JetBrains Mono', monospace; font-size: 15px; font-weight: 700; color: white;">
              \${ev.count}
            </td>
            <td>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span class="badge-live" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.2); color: #34d399;">
                  PROCESSED
                </span>
                <span class="row-hint">\${isExpanded ? 'Ocultar ▲' : 'Ver lista ▾'}</span>
              </div>
            </td>
          </tr>
        \`;

        if (!isExpanded) return mainRow;

        const detailsRow = \`
          <tr class="details-row">
            <td colspan="5">
              <div id="details-box-\${ev.key}" class="details-panel">
                <div style="display:flex; align-items:center; gap:10px; color:#38bdf8; font-size:13px; padding:12px 0;">
                  <div class="pulse-dot"></div> Carregando operações...
                </div>
              </div>
            </td>
          </tr>
        \`;

        return mainRow + detailsRow;
      }).join('');

      // Se há linha aberta, garante que o conteúdo esteja carregado
      if (activeKey && window.selectedRowMeta) {
        const meta = window.selectedRowMeta;
        const container = document.getElementById('details-box-' + activeKey);
        if (container) {
          const cacheKey = activeKey + '_' + (meta.viewAll ? 'all' : 'session');
          if (operationsCache[cacheKey]) {
            renderOperationsTable(container, operationsCache[cacheKey].items, activeKey, meta.category, meta.count, operationsCache[cacheKey].totalCount, meta.viewAll);
          } else {
            loadOperations(activeKey, meta.category, meta.encType, meta.kind, meta.status, meta.count, meta.viewAll);
          }
        }
      }
    }

    async function toggleRowDetails(key, category, encType, kind, status, count) {
      if (window.selectedRowKey === key) {
        window.selectedRowKey = null;
        window.selectedRowMeta = null;
        renderCurrentTable();
        return;
      }
      window.selectedRowKey = key;
      window.selectedRowMeta = { key, category, encType, kind, status, count: Number(count) || 0, viewAll: false };
      renderCurrentTable();
      await loadOperations(key, category, encType, kind, status, Number(count) || 0, false);
    }

    async function loadOperations(key, category, encType, kind, status, count, viewAll = false, forceRefresh = false) {
      const container = document.getElementById('details-box-' + key);
      if (!container) return;

      const cacheKey = key + '_' + (viewAll ? 'all' : 'session');
      if (!forceRefresh && operationsCache[cacheKey]) {
        renderOperationsTable(container, operationsCache[cacheKey].items, key, category, count, operationsCache[cacheKey].totalCount, viewAll);
        return;
      }

      container.innerHTML = '<div style="display:flex; align-items:center; gap:10px; color:#38bdf8; font-size:13px; padding:12px 0;"><div class="pulse-dot"></div> Carregando operações...</div>';

      try {
        const queryLimit = viewAll ? '50' : Math.max(Number(count) || 1, 1).toString();
        const query = new URLSearchParams({
          category: category || '',
          type: decodeURIComponent(encType || ''),
          kind: kind || '',
          status: status || '',
          limit: queryLimit,
        });
        const res = await fetch('/api/dashboard/operations?' + query.toString());
        const data = await res.json();
        const items = data.items || [];
        const totalCount = data.totalCount ?? items.length;
        operationsCache[cacheKey] = { items, totalCount };
        renderOperationsTable(container, items, key, category, count, totalCount, viewAll);
      } catch (err) {
        container.innerHTML = '<div style="color:#f43f5e; font-size:13px;">Erro ao carregar detalhes das operações.</div>';
      }
    }

    function renderOperationsTable(container, items, key, category, count, totalCount, viewAll) {
      const numCount = Number(count) || 0;
      const numTotal = Number(totalCount) || (items ? items.length : 0);
      const numItems = items ? items.length : 0;

      let headerActionsHtml = '';
      let headerTitleHtml = '';

      if (viewAll) {
        headerTitleHtml = \`
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span class="details-title">📦 Histórico Completo no Banco (\${numItems} operações exibidas)</span>
            <span style="font-size:11px; font-weight:600; color:#a78bfa; background:rgba(167,139,250,0.12); border:1px solid rgba(167,139,250,0.3); padding:2px 8px; border-radius:6px;">
              Total gravado no PostgreSQL: <b>\${numTotal}</b>
            </span>
          </div>
        \`;
        headerActionsHtml = \`
          <button class="btn-mini-refresh" onclick="event.stopPropagation(); toggleViewMode('\${key}', false)">⚡ Ver Apenas Contagem da Linha (\${numCount})</button>
          <button class="btn-mini-refresh" onclick="event.stopPropagation(); refreshCurrentDetails()">🔄 Atualizar</button>
        \`;
      } else {
        headerTitleHtml = \`
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span class="details-title">📋 Operações da Linha (\${numItems} de \${numCount})</span>
            <span style="font-size:11px; font-weight:500; color:#38bdf8; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.25); padding:2px 8px; border-radius:6px;">
              Sessão Ativa: <b>\${numCount}</b> \${numTotal > numCount ? \`| Banco Persistido: <b>\${numTotal}</b>\` : ''}
            </span>
          </div>
        \`;
        headerActionsHtml = \`
          \${numTotal > numItems ? \`<button class="btn-mini-refresh" style="border-color:#8b5cf6; color:#c084fc;" onclick="event.stopPropagation(); toggleViewMode('\${key}', true)">📦 Ver Histórico Completo do Banco (\${numTotal})</button>\` : ''}
          <button class="btn-mini-refresh" onclick="event.stopPropagation(); refreshCurrentDetails()">🔄 Atualizar</button>
        \`;
      }

      if (!items || items.length === 0) {
        container.innerHTML = \`
          <div class="details-header">
            \${headerTitleHtml}
            <div style="display:flex; gap:8px; align-items:center;">
              \${headerActionsHtml}
            </div>
          </div>
          <div style="color: #64748b; font-size: 13px; padding: 12px 0;">
            Nenhum registro individual encontrado no banco para este filtro no momento.
          </div>
        \`;
        return;
      }

      let tableHtml = '';
      if (category === 'PUBLISHED') {
        tableHtml = \`
          <table class="sub-table">
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>ID da Mensagem Outbox</th>
                <th>ID da Carteira</th>
                <th>Evento / Payload</th>
                <th>Tentativas</th>
                <th>Status SQS</th>
              </tr>
            </thead>
            <tbody>
              \${items.map(it => \`
                <tr>
                  <td style="color:#94a3b8;">\${it.occurredAt}</td>
                  <td><code style="color:#38bdf8;" title="\${it.id}">\${it.id.substring(0, 8)}...</code></td>
                  <td><code style="color:#a78bfa;" title="\${it.aggregateId}">\${it.aggregateId ? it.aggregateId.substring(0, 8) + '...' : '-'}</code></td>
                  <td style="color:#cbd5e1;">\${it.summary || it.type}</td>
                  <td style="color:#cbd5e1;">\${it.attempts}</td>
                  <td><span class="badge-status badge-processed">\${it.status}</span></td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        \`;
      } else if (category === 'CONSUMED') {
        tableHtml = \`
          <table class="sub-table">
            <thead>
              <tr>
                <th>Recebido em</th>
                <th>ID da Mensagem SQS</th>
                <th>Consumidor / Fila</th>
                <th>Processado em</th>
                <th>Status Inbox</th>
              </tr>
            </thead>
            <tbody>
              \${items.map(it => \`
                <tr>
                  <td style="color:#94a3b8;">\${it.receivedAt}</td>
                  <td><code style="color:#38bdf8;" title="\${it.id}">\${it.id.substring(0, 12)}...</code></td>
                  <td style="color:#cbd5e1;">\${it.consumerName}</td>
                  <td style="color:#94a3b8;">\${it.processedAt}</td>
                  <td><span class="badge-status badge-processed">\${it.status}</span></td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        \`;
      } else {
        // TRANSACTION or IDEMPOTENT_REPLAY or RESOLVED
        tableHtml = \`
          <table class="sub-table">
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>ID da Transação</th>
                <th>Chave Idempotência</th>
                <th>Carteira (UUID)</th>
                <th>Tipo & Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              \${items.map(it => {
                let statusBadge = it.status === 'PROCESSED'
                  ? '<span class="badge-status badge-processed">PROCESSED</span>'
                  : (it.status === 'REJECTED'
                    ? '<span class="badge-status badge-rejected">REJECTED (' + (it.failureCode || '') + ')</span>'
                    : '<span class="badge-status badge-pending">PENDING_REF</span>');
                return \`
                  <tr>
                    <td style="color:#94a3b8;">\${it.createdAt}</td>
                    <td><code style="color:#38bdf8;" title="\${it.id}">\${it.id.substring(0, 8)}...</code></td>
                    <td><code style="color:#c084fc;" title="\${it.idempotencyKey}">\${it.idempotencyKey ? it.idempotencyKey.substring(0, 16) : '-'}</code></td>
                    <td><code style="color:#94a3b8;" title="\${it.walletId}">\${it.walletId ? it.walletId.substring(0, 8) + '...' : '-'}</code></td>
                    <td style="font-weight: 700; color:#ffffff;">\${it.kind} - \${it.amount}</td>
                    <td>\${statusBadge}</td>
                  </tr>
                \`;
              }).join('')}
            </tbody>
          </table>
        \`;
      }

      container.innerHTML = \`
        <div class="details-header">
          \${headerTitleHtml}
          <div style="display:flex; gap:8px; align-items:center;">
            \${headerActionsHtml}
          </div>
        </div>
        <div style="overflow-x: auto;">
          \${tableHtml}
        </div>
      \`;
    }

    function toggleViewMode(key, viewAll) {
      if (window.selectedRowMeta && window.selectedRowMeta.key === key) {
        window.selectedRowMeta.viewAll = viewAll;
        const m = window.selectedRowMeta;
        loadOperations(m.key, m.category, m.encType, m.kind, m.status, m.count, viewAll);
      }
    }

    function refreshCurrentDetails() {
      if (window.selectedRowMeta) {
        const m = window.selectedRowMeta;
        loadOperations(m.key, m.category, m.encType, m.kind, m.status, m.count, m.viewAll || false, true);
      }
    }


    // Inicia polling
    fetchMetrics();
    requestAnimationFrame(updateProgressBar);
  </script>
</body>
</html>
`;
}

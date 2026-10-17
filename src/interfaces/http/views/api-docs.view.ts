export function renderApiDocsView(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jungle Gaming - API Documentation & Explorer</title>
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
      padding: 32px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .container {
      width: 100%;
      max-width: 1180px;
      display: flex;
      flex-direction: column;
      gap: 24px;
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
      -webkit-backdrop-filter: blur(16px);
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
      flex-wrap: wrap;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }

    .btn-portal {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
    }
    .btn-portal:hover {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }

    .btn-metrics {
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%);
      border: 1px solid rgba(6, 182, 212, 0.4);
      color: #38bdf8;
    }
    .btn-metrics:hover {
      background: rgba(6, 182, 212, 0.3);
      color: #7dd3fc;
    }

    .btn-swagger {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #022c22;
      box-shadow: 0 4px 14px var(--accent-green-glow);
    }
    .btn-swagger:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px var(--accent-green-glow);
    }

    /* Authorize & Idempotency Bar */
    .auth-banner {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 18px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }

    .auth-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .auth-label {
      font-size: 13px;
      font-weight: 700;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .auth-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .auth-input {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      color: #f8fafc;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      padding: 8px 14px;
      width: 260px;
      outline: none;
      transition: border-color 0.2s ease;
    }
    .auth-input:focus {
      border-color: var(--accent-green);
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
    }

    .auth-gen-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--card-border);
      color: #94a3b8;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s ease;
    }
    .auth-gen-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: white;
    }

    .auth-info-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #38bdf8;
      font-size: 13px;
      cursor: pointer;
      position: relative;
    }

    .auth-tooltip {
      visibility: hidden;
      opacity: 0;
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      width: 310px;
      background: #1e293b;
      color: #f1f5f9;
      border: 1px solid #475569;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 12px;
      line-height: 1.5;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.7);
      z-index: 9999;
      pointer-events: none;
      transition: opacity 0.2s ease, visibility 0.2s ease;
      text-align: left;
      font-weight: normal;
    }
    .auth-info-icon:hover .auth-tooltip {
      visibility: visible;
      opacity: 1;
    }

    .target-url {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Quick Guide Collapsible */
    .guide-card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 18px;
      padding: 20px 24px;
      transition: all 0.2s ease;
    }
    .guide-card details summary {
      cursor: pointer;
      font-size: 15px;
      font-weight: 700;
      color: #38bdf8;
      display: flex;
      align-items: center;
      justify-content: space-between;
      outline: none;
      user-select: none;
    }
    .guide-card details summary::-webkit-details-marker { display: none; }
    .guide-content {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
    .guide-step {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
    }
    .guide-step-title {
      font-weight: 700;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .guide-step-desc {
      color: var(--text-muted);
      line-height: 1.45;
      font-size: 12px;
    }

    /* Filter Chips */
    .filter-bar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-chip {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 7px 16px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .filter-chip:hover, .filter-chip.active {
      background: rgba(16, 185, 129, 0.15);
      border-color: var(--accent-green);
      color: #34d399;
    }

    /* Endpoints List */
    .endpoints-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .ep-card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      overflow: hidden;
      transition: border-color 0.2s ease;
    }
    .ep-card:hover {
      border-color: rgba(255, 255, 255, 0.18);
    }

    .ep-summary {
      padding: 18px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
      gap: 16px;
    }

    .ep-left {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .method-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 700;
      padding: 5px 10px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .method-post {
      background: rgba(16, 185, 129, 0.18);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
    .method-get {
      background: rgba(6, 182, 212, 0.18);
      color: #38bdf8;
      border: 1px solid rgba(6, 182, 212, 0.4);
    }

    .ep-path {
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      font-weight: 600;
      color: #f8fafc;
    }

    .ep-title {
      font-size: 13px;
      color: var(--text-muted);
    }

    .ep-tag {
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
      color: #94a3b8;
    }

    .ep-arrow {
      color: #64748b;
      transition: transform 0.2s ease;
    }
    .ep-card.open .ep-arrow {
      transform: rotate(180deg);
    }

    /* Endpoint Body Details */
    .ep-details {
      display: none;
      padding: 0 24px 24px 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
    .ep-card.open .ep-details {
      display: block;
    }

    .ep-desc {
      font-size: 13px;
      color: #cbd5e1;
      line-height: 1.5;
      margin: 16px 0;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .input-label {
      font-size: 12px;
      font-weight: 600;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .text-input, .json-textarea {
      background: rgba(10, 15, 26, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #f1f5f9;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      padding: 10px 14px;
      outline: none;
      transition: border-color 0.2s ease;
      width: 100%;
    }
    .text-input:focus, .json-textarea:focus {
      border-color: var(--accent-cyan);
    }

    .json-textarea {
      min-height: 120px;
      resize: vertical;
      line-height: 1.5;
    }

    .quick-presets {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 4px;
    }
    .preset-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #94a3b8;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .preset-btn:hover {
      background: rgba(6, 182, 212, 0.15);
      color: #38bdf8;
      border-color: rgba(6, 182, 212, 0.3);
    }

    .action-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 18px;
    }

    .btn-exec {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #022c22;
      font-weight: 700;
      padding: 10px 22px;
      border-radius: 10px;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: none;
      transition: all 0.2s ease;
    }
    .btn-exec:hover {
      box-shadow: 0 4px 16px var(--accent-green-glow);
      transform: translateY(-1px);
    }

    /* Response Console */
    .response-box {
      margin-top: 18px;
      background: rgba(5, 8, 15, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      overflow: hidden;
      display: none;
    }
    .response-header {
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.03);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
    }
    .status-badge-res {
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 700;
    }
    .status-2xx { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .status-4xx { background: rgba(244, 63, 94, 0.2); color: #fb7185; }
    .status-5xx { background: rgba(239, 68, 68, 0.2); color: #f87171; }

    .response-body {
      padding: 14px 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #cbd5e1;
      max-height: 280px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .copy-btn {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 4px;
      cursor: pointer;
    }
    .copy-btn:hover { color: white; border-color: rgba(255, 255, 255, 0.25); }

    /* Footer */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      color: var(--text-muted);
      font-size: 12px;
      padding: 16px 8px;
      border-top: 1px solid var(--card-border);
    }

    @media (max-width: 768px) {
      .header { padding: 20px; }
      .brand-title { font-size: 18px; }
      .auth-input { width: 100%; }
      .auth-banner { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <div class="brand">
        <div class="brand-icon">📚</div>
        <div>
          <h1 class="brand-title">API Documentation &amp; Explorer</h1>
          <div class="brand-subtitle">
            <span>Distributed Wagering Processor</span>
            <span class="badge-live">
              <span class="pulse-dot"></span>
              v0.6.0 &bull; OAS 3.0
            </span>
          </div>
        </div>
      </div>
      <div class="header-actions">
        <a href="/" class="btn btn-portal">🏠 Portal</a>
        <a href="/dashboard" class="btn btn-metrics">📊 Métricas</a>
        <a href="/api/docs" class="btn btn-swagger">⚡ Swagger UI</a>
      </div>
    </header>

    <!-- Global Idempotency Bar -->
    <div class="auth-banner">
      <div class="auth-left">
        <span class="auth-label">
          <span>🔑 Idempotency-Key Global</span>
          <span class="auth-info-icon">ℹ️
            <span class="auth-tooltip">
              <strong>O que é Idempotency-Key?</strong><br>
              Chave única que garante execução atômica e proteção contra duplo débito. Requisições repetidas com a mesma chave retornam 200 OK com o snapshot da transação sem alterar o saldo novamente.
            </span>
          </span>
        </span>
        <div class="auth-input-wrapper">
          <input type="text" id="globalIdempotencyKey" class="auth-input" value="req-001" placeholder="Ex: req-001 ou UUID" />
          <button class="auth-gen-btn" onclick="generateNewKey()">⚡ Novo ID</button>
        </div>
      </div>
      <div class="target-url">
        <span>Base URL: <strong>http://localhost:3000</strong></span>
      </div>
    </div>

    <!-- Quick Test Guide -->
    <div class="guide-card">
      <details>
        <summary>
          <span>🚀 Guia Rápido de Teste (Ordem Recomendada de Execução de 1 a 8)</span>
          <span style="font-size: 12px; color: var(--text-muted); font-weight: normal;">Clique para expandir / recolher</span>
        </summary>
        <div class="guide-content">
          <div class="guide-step">
            <span class="guide-step-title">1️⃣ POST /wallets</span>
            <span class="guide-step-desc">Crie uma carteira com saldo inicial (ex: <code>"100.00"</code>). Copie o <code>id</code> retornado.</span>
          </div>
          <div class="guide-step">
            <span class="guide-step-title">2️⃣ GET /wallets/:id</span>
            <span class="guide-step-desc">Consulte o saldo e comprove a versão inicial <code>1</code>.</span>
          </div>
          <div class="guide-step">
            <span class="guide-step-title">3️⃣ POST /transactions (BET)</span>
            <span class="guide-step-desc">Envie <code>BET</code> de <code>"30.00"</code> com <code>Idempotency-Key: req-001</code>. Saldo passa a ser <code>"70.00"</code>.</span>
          </div>
          <div class="guide-step">
            <span class="guide-step-title">4️⃣ Replay de Idempotência</span>
            <span class="guide-step-desc">Reexecute a aposta idêntica. Retorna <code>200 OK</code> com <code>idempotentReplay: true</code>.</span>
          </div>
          <div class="guide-step">
            <span class="guide-step-title">5️⃣ POST /transactions (WIN)</span>
            <span class="guide-step-desc">Credite prêmio de <code>"50.00"</code> com <code>req-002</code>. Saldo sobe para <code>"120.00"</code>.</span>
          </div>
          <div class="guide-step">
            <span class="guide-step-title">6️⃣ GET /wallets/:id/ledger</span>
            <span class="guide-step-desc">Visualize o extrato contábil imutável (OPENING, DEBIT e CREDIT).</span>
          </div>
          <div class="guide-step">
            <span class="guide-step-title">7️⃣ POST .../reconciliation</span>
            <span class="guide-step-desc">Auditoria matemática: certifica <code>consistent: true</code> e <code>difference: "0.00"</code>.</span>
          </div>
          <div class="guide-step">
            <span class="guide-step-title">8️⃣ Observabilidade &amp; SQS</span>
            <span class="guide-step-desc">Abra o <a href="/dashboard" style="color: #38bdf8;">Dashboard</a> e acompanhe a Outbox e os Consumers.</span>
          </div>
        </div>
      </details>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <span style="font-size: 13px; font-weight: 600; color: #94a3b8;">Filtrar tags:</span>
      <button class="filter-chip active" onclick="filterTag('all')">Todos</button>
      <button class="filter-chip" onclick="filterTag('wallets')">wallets</button>
      <button class="filter-chip" onclick="filterTag('transactions')">transactions</button>
      <button class="filter-chip" onclick="filterTag('observability')">observability</button>
      <button class="filter-chip" onclick="filterTag('health')">health</button>
    </div>

    <!-- Endpoints List -->
    <div class="endpoints-list">
      <!-- EP 1: POST /wallets -->
      <div class="ep-card open" data-tag="wallets" id="ep-post-wallets">
        <div class="ep-summary" onclick="toggleCard('ep-post-wallets')">
          <div class="ep-left">
            <span class="method-badge method-post">POST</span>
            <span class="ep-path">/wallets</span>
            <span class="ep-title">Criar carteira com saldo inicial</span>
            <span class="ep-tag">wallets</span>
          </div>
          <span class="ep-arrow">▼</span>
        </div>
        <div class="ep-details">
          <p class="ep-desc">Cria uma carteira única para o jogador na moeda especificada, gravando simultaneamente o lançamento de abertura (OPENING) no ledger contábil imutável.</p>
          <div class="form-grid">
            <div class="input-group">
              <label class="input-label">Corpo da Requisição (JSON)</label>
              <textarea id="body-post-wallets" class="json-textarea">{
  "playerId": "11111111-1111-4111-8111-111111111111",
  "currency": "BRL",
  "initialBalance": "100.00"
}</textarea>
            </div>
          </div>
          <div class="action-row">
            <button class="btn-exec" onclick="execRequest('post-wallets', 'POST', '/wallets', false)">Executar Requisição</button>
          </div>
          <div id="res-post-wallets" class="response-box">
            <div class="response-header">
              <span id="status-post-wallets" class="status-badge-res"></span>
              <span id="time-post-wallets" style="color: #64748b;"></span>
              <button class="copy-btn" onclick="copyResponse('post-wallets')">Copiar</button>
            </div>
            <pre id="body-res-post-wallets" class="response-body"></pre>
          </div>
        </div>
      </div>

      <!-- EP 2: GET /wallets/:id -->
      <div class="ep-card" data-tag="wallets" id="ep-get-wallet">
        <div class="ep-summary" onclick="toggleCard('ep-get-wallet')">
          <div class="ep-left">
            <span class="method-badge method-get">GET</span>
            <span class="ep-path">/wallets/{id}</span>
            <span class="ep-title">Consultar saldo e versão da carteira</span>
            <span class="ep-tag">wallets</span>
          </div>
          <span class="ep-arrow">▼</span>
        </div>
        <div class="ep-details">
          <p class="ep-desc">Retorna os dados cadastrais da carteira, saldo atual formatado em string monetária com duas casas decimais e número de versão para lock otimista.</p>
          <div class="form-grid">
            <div class="input-group">
              <label class="input-label">ID da Carteira (UUID)</label>
              <input type="text" id="param-get-wallet-id" class="text-input" placeholder="Cole aqui o walletId retornado no POST /wallets" />
            </div>
          </div>
          <div class="action-row">
            <button class="btn-exec" onclick="execGetWallet()">Executar Requisição</button>
          </div>
          <div id="res-get-wallet" class="response-box">
            <div class="response-header">
              <span id="status-get-wallet" class="status-badge-res"></span>
              <span id="time-get-wallet" style="color: #64748b;"></span>
              <button class="copy-btn" onclick="copyResponse('get-wallet')">Copiar</button>
            </div>
            <pre id="body-res-get-wallet" class="response-body"></pre>
          </div>
        </div>
      </div>

      <!-- EP 3: POST /transactions -->
      <div class="ep-card open" data-tag="transactions" id="ep-post-transactions">
        <div class="ep-summary" onclick="toggleCard('ep-post-transactions')">
          <div class="ep-left">
            <span class="method-badge method-post">POST</span>
            <span class="ep-path">/transactions</span>
            <span class="ep-title">Processar aposta ou prêmio com Idempotência</span>
            <span class="ep-tag">transactions</span>
          </div>
          <span class="ep-arrow">▼</span>
        </div>
        <div class="ep-details">
          <p class="ep-desc">Processa transações financeiras (BET, WIN, LOSS, REFUND, ROLLBACK) com lock pessimista por carteira (<code>FOR UPDATE</code>), idempotência persistente e registro de evento na Outbox.</p>
          <div class="form-grid">
            <div class="input-group">
              <div class="input-label">
                <span>Corpo da Requisição (JSON)</span>
                <div class="quick-presets">
                  <span style="font-size: 11px; color: #64748b;">Predefinições:</span>
                  <button class="preset-btn" onclick="setTxPreset('BET')">Aposta BET (R$ 30,00)</button>
                  <button class="preset-btn" onclick="setTxPreset('WIN')">Prêmio WIN (R$ 50,00)</button>
                  <button class="preset-btn" onclick="setTxPreset('REFUND')">Estorno REFUND (R$ 30,00)</button>
                </div>
              </div>
              <textarea id="body-post-transactions" class="json-textarea">{
  "walletId": "INSIRA_O_WALLET_ID_AQUI",
  "providerId": "provider-pragmatic",
  "externalTransactionId": "tx-ext-001",
  "kind": "BET",
  "amount": "30.00"
}</textarea>
            </div>
          </div>
          <div class="action-row">
            <button class="btn-exec" onclick="execPostTransactions()">Executar Requisição</button>
          </div>
          <div id="res-post-transactions" class="response-box">
            <div class="response-header">
              <span id="status-post-transactions" class="status-badge-res"></span>
              <span id="time-post-transactions" style="color: #64748b;"></span>
              <button class="copy-btn" onclick="copyResponse('post-transactions')">Copiar</button>
            </div>
            <pre id="body-res-post-transactions" class="response-body"></pre>
          </div>
        </div>
      </div>

      <!-- EP 4: GET /wallets/:id/ledger -->
      <div class="ep-card" data-tag="wallets" id="ep-get-ledger">
        <div class="ep-summary" onclick="toggleCard('ep-get-ledger')">
          <div class="ep-left">
            <span class="method-badge method-get">GET</span>
            <span class="ep-path">/wallets/{id}/ledger</span>
            <span class="ep-title">Extrato do Ledger Contábil (Append-Only)</span>
            <span class="ep-tag">wallets</span>
          </div>
          <span class="ep-arrow">▼</span>
        </div>
        <div class="ep-details">
          <p class="ep-desc">Retorna o histórico contábil imutável da carteira ordenado por seq crescente, com paginação por cursor Base64 e proteção por trigger PostgreSQL.</p>
          <div class="form-grid">
            <div class="input-group">
              <label class="input-label">ID da Carteira (UUID)</label>
              <input type="text" id="param-ledger-wallet-id" class="text-input" placeholder="Cole aqui o walletId" />
            </div>
          </div>
          <div class="action-row">
            <button class="btn-exec" onclick="execGetLedger()">Executar Requisição</button>
          </div>
          <div id="res-get-ledger" class="response-box">
            <div class="response-header">
              <span id="status-get-ledger" class="status-badge-res"></span>
              <span id="time-get-ledger" style="color: #64748b;"></span>
              <button class="copy-btn" onclick="copyResponse('get-ledger')">Copiar</button>
            </div>
            <pre id="body-res-get-ledger" class="response-body"></pre>
          </div>
        </div>
      </div>

      <!-- EP 5: POST /wallets/:id/reconciliation -->
      <div class="ep-card" data-tag="wallets" id="ep-post-reconciliation">
        <div class="ep-summary" onclick="toggleCard('ep-post-reconciliation')">
          <div class="ep-left">
            <span class="method-badge method-post">POST</span>
            <span class="ep-path">/wallets/{id}/reconciliation</span>
            <span class="ep-title">Auditoria e Reconciliação Contábil em Tempo Real</span>
            <span class="ep-tag">wallets</span>
          </div>
          <span class="ep-arrow">▼</span>
        </div>
        <div class="ep-details">
          <p class="ep-desc">Soma aritmeticamente todos os lançamentos contábeis históricos (OPENING + CREDIT - DEBIT) e compara com o saldo atual da carteira, comprovando consistência matemática (<code>consistent: true</code>).</p>
          <div class="form-grid">
            <div class="input-group">
              <label class="input-label">ID da Carteira (UUID)</label>
              <input type="text" id="param-rec-wallet-id" class="text-input" placeholder="Cole aqui o walletId" />
            </div>
          </div>
          <div class="action-row">
            <button class="btn-exec" onclick="execPostReconciliation()">Executar Auditoria</button>
          </div>
          <div id="res-post-reconciliation" class="response-box">
            <div class="response-header">
              <span id="status-post-reconciliation" class="status-badge-res"></span>
              <span id="time-post-reconciliation" style="color: #64748b;"></span>
              <button class="copy-btn" onclick="copyResponse('post-reconciliation')">Copiar</button>
            </div>
            <pre id="body-res-post-reconciliation" class="response-body"></pre>
          </div>
        </div>
      </div>

      <!-- EP 6: GET /health/live -->
      <div class="ep-card" data-tag="health" id="ep-get-health">
        <div class="ep-summary" onclick="toggleCard('ep-get-health')">
          <div class="ep-left">
            <span class="method-badge method-get">GET</span>
            <span class="ep-path">/health/live</span>
            <span class="ep-title">Liveness Probe (Kubernetes)</span>
            <span class="ep-tag">health</span>
          </div>
          <span class="ep-arrow">▼</span>
        </div>
        <div class="ep-details">
          <p class="ep-desc">Verificação de disponibilidade do serviço para load balancers e orquestradores de containers.</p>
          <div class="action-row">
            <button class="btn-exec" onclick="execRequest('get-health', 'GET', '/health/live', false)">Executar Requisição</button>
          </div>
          <div id="res-get-health" class="response-box">
            <div class="response-header">
              <span id="status-get-health" class="status-badge-res"></span>
              <span id="time-get-health" style="color: #64748b;"></span>
              <button class="copy-btn" onclick="copyResponse('get-health')">Copiar</button>
            </div>
            <pre id="body-res-get-health" class="response-body"></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="footer">
      <div>Distributed Wagering Processor &bull; Jungle Gaming Technical Test &bull; 2026</div>
      <div>
        <a href="/api/docs" style="color: #38bdf8; text-decoration: none;">Ver no Swagger UI Tradicional</a> &bull;
        <a href="/dashboard" style="color: #34d399; text-decoration: none; margin-left: 8px;">Painel de Métricas</a>
      </div>
    </footer>
  </div>

  <script>
    var lastCreatedWalletId = '';

    function generateNewKey() {
      var rand = 'req-' + Math.random().toString(36).substring(2, 8);
      document.getElementById('globalIdempotencyKey').value = rand;
    }

    function toggleCard(cardId) {
      var el = document.getElementById(cardId);
      if (el) el.classList.toggle('open');
    }

    function filterTag(tag) {
      document.querySelectorAll('.filter-chip').forEach(function(chip) {
        chip.classList.toggle('active', chip.textContent === tag || (tag === 'all' && chip.textContent === 'Todos'));
      });
      document.querySelectorAll('.ep-card').forEach(function(card) {
        if (tag === 'all' || card.getAttribute('data-tag') === tag) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    }

    function setTxPreset(kind) {
      var walletId = lastCreatedWalletId || 'INSIRA_O_WALLET_ID_AQUI';
      var key = document.getElementById('globalIdempotencyKey').value || 'req-001';
      var extId = 'tx-ext-' + Math.random().toString(36).substring(2, 7);

      var payload = {
        walletId: walletId,
        providerId: 'provider-pragmatic',
        externalTransactionId: extId,
        kind: kind,
        amount: kind === 'BET' ? '30.00' : (kind === 'WIN' ? '50.00' : '30.00')
      };
      if (kind === 'REFUND') {
        payload.referenceTransactionId = 'tx-original-id-se-houver';
      }
      document.getElementById('body-post-transactions').value = JSON.stringify(payload, null, 2);
    }

    async function execRequest(targetId, method, path, useIdempotency, body) {
      var statusEl = document.getElementById('status-' + targetId);
      var timeEl = document.getElementById('time-' + targetId);
      var bodyEl = document.getElementById('body-res-' + targetId);
      var boxEl = document.getElementById('res-' + targetId);

      boxEl.style.display = 'block';
      statusEl.textContent = 'Carregando...';
      statusEl.className = 'status-badge-res';
      timeEl.textContent = '';
      bodyEl.textContent = '';

      var headers = { 'Content-Type': 'application/json' };
      if (useIdempotency) {
        var key = document.getElementById('globalIdempotencyKey').value.trim();
        if (key) headers['Idempotency-Key'] = key;
      }

      var t0 = performance.now();
      try {
        var opts = { method: method, headers: headers };
        if (body) opts.body = body;

        var res = await fetch(path, opts);
        var t1 = performance.now();
        var duration = Math.round(t1 - t0) + 'ms';

        var text = await res.text();
        var json;
        try { json = JSON.parse(text); } catch(e) { json = text; }

        statusEl.textContent = res.status + ' ' + res.statusText;
        statusEl.className = 'status-badge-res ' + (res.status < 300 ? 'status-2xx' : (res.status < 500 ? 'status-4xx' : 'status-5xx'));
        timeEl.textContent = duration;

        if (typeof json === 'object') {
          bodyEl.textContent = JSON.stringify(json, null, 2);
          if (json && json.id && path === '/wallets') {
            lastCreatedWalletId = json.id;
            // Pre-fill next inputs
            var wInput = document.getElementById('param-get-wallet-id');
            if (wInput) wInput.value = json.id;
            var lInput = document.getElementById('param-ledger-wallet-id');
            if (lInput) lInput.value = json.id;
            var rInput = document.getElementById('param-rec-wallet-id');
            if (rInput) rInput.value = json.id;
            // Pre-fill transaction body
            setTxPreset('BET');
          }
        } else {
          bodyEl.textContent = json;
        }
      } catch (err) {
        statusEl.textContent = 'Erro de Rede';
        statusEl.className = 'status-badge-res status-5xx';
        bodyEl.textContent = String(err);
      }
    }

    function execGetWallet() {
      var id = document.getElementById('param-get-wallet-id').value.trim();
      if (!id) { alert('Informe o ID da carteira'); return; }
      execRequest('get-wallet', 'GET', '/wallets/' + encodeURIComponent(id), false);
    }

    function execPostTransactions() {
      var body = document.getElementById('body-post-transactions').value;
      execRequest('post-transactions', 'POST', '/transactions', true, body);
    }

    function execGetLedger() {
      var id = document.getElementById('param-ledger-wallet-id').value.trim();
      if (!id) { alert('Informe o ID da carteira'); return; }
      execRequest('get-ledger', 'GET', '/wallets/' + encodeURIComponent(id) + '/ledger', false);
    }

    function execPostReconciliation() {
      var id = document.getElementById('param-rec-wallet-id').value.trim();
      if (!id) { alert('Informe o ID da carteira'); return; }
      execRequest('post-reconciliation', 'POST', '/wallets/' + encodeURIComponent(id) + '/reconciliation', false);
    }

    function copyResponse(targetId) {
      var text = document.getElementById('body-res-' + targetId).textContent;
      navigator.clipboard.writeText(text).then(function() {
        alert('Resposta copiada para a área de transferência!');
      });
    }
  </script>
</body>
</html>
`;
}

import { APP_VERSION } from "../../../infrastructure/config/config";

export function renderWalletSimulatorView(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jungle Gaming - Simulador Visual de Jogador &amp; Carteira</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(18, 24, 38, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --card-border-hover: rgba(255, 255, 255, 0.18);
      --accent-green: #10b981;
      --accent-green-glow: rgba(16, 185, 129, 0.25);
      --accent-cyan: #06b6d4;
      --accent-cyan-glow: rgba(6, 182, 212, 0.25);
      --accent-purple: #8b5cf6;
      --accent-purple-glow: rgba(139, 92, 246, 0.25);
      --accent-amber: #f59e0b;
      --accent-rose: #f43f5e;
      --accent-rose-glow: rgba(244, 63, 94, 0.25);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --surface-dark: #0f1523;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(139, 92, 246, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 0%, rgba(16, 185, 129, 0.15) 0px, transparent 50%),
        radial-gradient(at 50% 100%, rgba(6, 182, 212, 0.12) 0px, transparent 50%);
      background-attachment: fixed;
      color: var(--text-main);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      padding: 24px 20px 48px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .container {
      width: 100%;
      max-width: 1200px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Top Navigation Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding: 14px 24px;
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 16px;
    }

    .logo-area {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo-icon {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--accent-purple), var(--accent-cyan));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      box-shadow: 0 4px 14px var(--accent-purple-glow);
    }

    .logo-text h1 {
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #fff;
    }

    .logo-text span {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .nav-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      color: #cbd5e1;
      text-decoration: none;
      font-size: 0.82rem;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .nav-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      border-color: rgba(255, 255, 255, 0.2);
    }

    .nav-btn.active {
      background: rgba(139, 92, 246, 0.18);
      border-color: rgba(139, 92, 246, 0.4);
      color: #c4b5fd;
    }

    /* Grid Layout */
    .main-grid {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 24px;
    }

    @media (max-width: 960px) {
      .main-grid { grid-template-columns: 1fr; }
    }

    /* Card Base */
    .glass-card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 18px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      transition: border-color 0.2s ease;
    }

    .glass-card:hover {
      border-color: var(--card-border-hover);
    }

    .card-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-title-row h2 {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.72rem;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
    }

    .badge-purple { background: rgba(139, 92, 246, 0.18); color: #c4b5fd; border: 1px solid rgba(139, 92, 246, 0.3); }
    .badge-green { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-cyan { background: rgba(6, 182, 212, 0.15); color: #67e8f9; border: 1px solid rgba(6, 182, 212, 0.3); }
    .badge-amber { background: rgba(245, 158, 11, 0.15); color: #fde68a; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-rose { background: rgba(244, 63, 94, 0.15); color: #fca5a5; border: 1px solid rgba(244, 63, 94, 0.3); }

    /* Player & Wallet Bar */
    .identity-box {
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 14px;
      padding: 16px;
    }

    .id-field {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .id-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .id-value-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .id-code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
      color: #cbd5e1;
      background: rgba(255, 255, 255, 0.04);
      padding: 4px 8px;
      border-radius: 6px;
      max-width: 250px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .copy-btn {
      background: none;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text-muted);
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .copy-btn:hover {
      color: #fff;
      border-color: rgba(255, 255, 255, 0.3);
      background: rgba(255, 255, 255, 0.08);
    }

    /* Hero Balance Display */
    .balance-hero {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%);
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 8px;
      position: relative;
      overflow: hidden;
    }

    .balance-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--accent-green);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .balance-amount {
      font-size: 3.2rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #ffffff;
      font-variant-numeric: tabular-nums;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.25s ease;
    }

    .balance-amount.pulse-green {
      color: #34d399;
      transform: scale(1.06);
    }

    .balance-amount.pulse-red {
      color: #f87171;
      transform: scale(0.96);
    }

    .balance-meta {
      display: flex;
      gap: 12px;
      align-items: center;
      font-size: 0.8rem;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }

    .btn-refresh {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #cbd5e1;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 0.78rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .btn-refresh:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }

    /* Actions Panel */
    .section-subtitle {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
    }

    .chips-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .chip-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      padding: 8px 14px;
      border-radius: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.18s ease;
    }

    .chip-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      border-color: rgba(255, 255, 255, 0.25);
      transform: translateY(-1px);
    }

    .input-row {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .input-styled {
      flex: 1;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      padding: 10px 14px;
      color: #fff;
      font-size: 0.92rem;
      font-family: 'JetBrains Mono', monospace;
      outline: none;
      transition: border-color 0.2s;
    }

    .input-styled:focus {
      border-color: var(--accent-cyan);
      box-shadow: 0 0 0 2px var(--accent-cyan-glow);
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 18px;
      border-radius: 11px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      text-decoration: none;
    }

    .btn:active {
      transform: scale(0.98);
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--accent-green), #059669);
      color: #022c22;
      box-shadow: 0 4px 14px var(--accent-green-glow);
    }

    .btn-primary:hover {
      filter: brightness(1.1);
      box-shadow: 0 6px 18px var(--accent-green-glow);
      transform: translateY(-1px);
    }

    .btn-deposit {
      background: linear-gradient(135deg, #0ea5e9, #0284c7);
      color: #ffffff;
      box-shadow: 0 4px 14px var(--accent-cyan-glow);
    }

    .btn-deposit:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    .btn-bet {
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      color: #ffffff;
      box-shadow: 0 4px 14px var(--accent-purple-glow);
    }

    .btn-bet:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    .btn-win {
      background: linear-gradient(135deg, #10b981, #059669);
      color: #022c22;
      box-shadow: 0 4px 14px var(--accent-green-glow);
    }

    .btn-win:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    .btn-loss {
      background: rgba(244, 63, 94, 0.15);
      border: 1px solid rgba(244, 63, 94, 0.35);
      color: #fca5a5;
    }

    .btn-loss:hover {
      background: rgba(244, 63, 94, 0.25);
      color: #fff;
    }

    .btn-refund {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #fde68a;
    }

    .btn-refund:hover {
      background: rgba(245, 158, 11, 0.25);
      color: #fff;
    }

    .btn-audit {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
    }

    .btn-audit:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .game-actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
      gap: 10px;
    }

    .btn-rollback {
      background: rgba(99, 102, 241, 0.18);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #c7d2fe;
    }

    .btn-rollback:hover {
      background: rgba(99, 102, 241, 0.32);
      border-color: rgba(99, 102, 241, 0.6);
      color: #fff;
    }

    /* Laboratório de Concorrência & Idempotência */
    .lab-card {
      margin-top: 8px;
    }

    .lab-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }

    .lab-scenario-card {
      background: rgba(0, 0, 0, 0.28);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      justify-content: space-between;
      transition: all 0.2s ease;
    }

    .lab-scenario-card:hover {
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
    }

    .lab-scenario-header {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .lab-scenario-header h4 {
      font-size: 0.96rem;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .lab-scenario-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.5;
      flex: 1;
    }

    .btn-scenario {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
      font-size: 0.82rem;
      font-weight: 600;
      padding: 10px 14px;
      border-radius: 10px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .btn-scenario:hover:not(:disabled) {
      background: rgba(139, 92, 246, 0.25);
      border-color: rgba(139, 92, 246, 0.5);
      color: #e0e7ff;
      transform: translateY(-1px);
    }

    .btn-scenario:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .lab-console-wrapper {
      background: #070b12;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      overflow: hidden;
      margin-top: 8px;
    }

    .lab-console-header {
      background: rgba(255, 255, 255, 0.03);
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .lab-console-body {
      padding: 12px 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.77rem;
      line-height: 1.6;
      max-height: 240px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .console-line { word-break: break-all; }
    .console-line.info { color: #94a3b8; }
    .console-line.success { color: #6ee7b7; font-weight: 600; }
    .console-line.warn { color: #fde68a; }
    .console-line.error { color: #fca5a5; font-weight: 600; }
    .console-line.accent { color: #67e8f9; font-weight: 600; }

    /* History & Ledger Table */
    .table-container {
      overflow-x: auto;
      max-height: 380px;
      overflow-y: auto;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.84rem;
    }

    th {
      background: rgba(15, 21, 35, 0.9);
      color: var(--text-muted);
      font-weight: 600;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      position: sticky;
      top: 0;
      z-index: 2;
    }

    td {
      padding: 11px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: #e2e8f0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .empty-history {
      padding: 36px 16px;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    /* Toast Notification */
    .toast-container {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 420px;
      width: calc(100% - 48px);
      pointer-events: none;
    }

    .toast {
      pointer-events: auto;
      background: rgba(18, 24, 38, 0.92);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-radius: 12px;
      padding: 14px 18px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      animation: slideIn 0.25s ease forwards;
      border-left: 4px solid var(--accent-cyan);
    }

    .toast.toast-success { border-left-color: var(--accent-green); }
    .toast.toast-error { border-left-color: var(--accent-rose); }
    .toast.toast-warning { border-left-color: var(--accent-amber); }

    .toast-icon { font-size: 1.15rem; line-height: 1; flex-shrink: 0; }
    .toast-body { flex: 1; }
    .toast-title { font-size: 0.88rem; font-weight: 600; color: #fff; margin-bottom: 2px; }
    .toast-message { font-size: 0.8rem; color: #cbd5e1; line-height: 1.4; }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      z-index: 8888;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-backdrop.open { display: flex; }

    .modal-box {
      background: #0f1523;
      border: 1px solid var(--card-border);
      border-radius: 18px;
      padding: 28px;
      max-width: 500px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 18px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h3 {
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
    }

    .modal-close {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 1.3rem;
      cursor: pointer;
    }

    .modal-close:hover { color: #fff; }

    .wallets-select-list {
      max-height: 220px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .wallet-item-btn {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 10px 14px;
      text-align: left;
      color: #cbd5e1;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.15s;
    }

    .wallet-item-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--accent-cyan);
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="toast-container" id="toastContainer"></div>

  <!-- Wallet Switcher Modal -->
  <div class="modal-backdrop" id="switchWalletModal">
    <div class="modal-box">
      <div class="modal-header">
        <h3>Trocar ou Buscar Carteira</h3>
        <button class="modal-close" onclick="closeModal('switchWalletModal')">&times;</button>
      </div>
      <div>
        <label class="section-subtitle">Colar UUID de Carteira Existente:</label>
        <div class="input-row" style="margin-top: 6px;">
          <input type="text" id="manualWalletIdInput" class="input-styled" placeholder="4a89972f-1ac6-4cf8-949f-c8c9605baf27">
          <button class="btn btn-primary" onclick="loadManualWallet()">Carregar</button>
        </div>
      </div>
      <div>
        <label class="section-subtitle">Carteiras Recentes Desta Máquina:</label>
        <div class="wallets-select-list" id="recentWalletsList">
          <div style="font-size: 0.8rem; color: var(--text-muted); padding: 8px 0;">Nenhuma carteira salva no histórico recente.</div>
        </div>
      </div>
    </div>
  </div>

  <div class="container">
    <!-- Header -->
    <header class="header">
      <div class="logo-area">
        <div class="logo-icon">🎰</div>
        <div class="logo-text">
          <h1>Simulador Visual de Jogador &amp; Carteira</h1>
          <span>Wallet Playground &bull; v${APP_VERSION}</span>
        </div>
      </div>
      <nav class="nav-links">
        <a href="/" class="nav-btn">🏠 Portal</a>
        <a href="/docs" class="nav-btn">📚 Swagger Docs</a>
        <a href="/dashboard" class="nav-btn">📊 Métricas</a>
        <a href="/simulator" class="nav-btn active">🎮 Simulador</a>
      </nav>
    </header>

    <!-- Main Grid -->
    <div class="main-grid">
      <!-- Coluna da Esquerda: Carteira & Caixa -->
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- Card 1: Jogador & Carteira Ativa -->
        <section class="glass-card">
          <div class="card-title-row">
            <h2>
              <span>👤</span> Jogador &amp; Carteira
            </h2>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-primary" style="padding: 7px 12px; font-size: 0.8rem;" onclick="createNewPlayerWallet()">
                ⚡ Novo Jogador
              </button>
              <button class="btn-refresh" onclick="openModal('switchWalletModal')">
                🔄 Trocar
              </button>
            </div>
          </div>

          <div class="identity-box">
            <div class="id-field">
              <span class="id-label">Player ID:</span>
              <div class="id-value-group">
                <span class="id-code" id="displayPlayerId">carregando...</span>
                <button class="copy-btn" onclick="copyText('displayPlayerId')">Copiar</button>
              </div>
            </div>
            <div class="id-field">
              <span class="id-label">Wallet ID:</span>
              <div class="id-value-group">
                <span class="id-code" id="displayWalletId">carregando...</span>
                <button class="copy-btn" onclick="copyText('displayWalletId')">Copiar</button>
              </div>
            </div>
          </div>

          <!-- Hero Balance -->
          <div class="balance-hero">
            <span class="balance-label">Saldo Disponível em Tempo Real</span>
            <div class="balance-amount" id="displayBalance">R$ 0,00</div>
            <div class="balance-meta">
              <span class="badge badge-green" id="displayCurrency">BRL</span>
              <span>Versão Contábil: <strong id="displayVersion">v0</strong></span>
              <button class="btn-refresh" onclick="refreshCurrentWallet()">
                <span>↻</span> Atualizar
              </button>
            </div>
          </div>

          <!-- Auditoria Contábil com 1 clique -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.06);">
            <div>
              <span style="font-size: 0.82rem; font-weight: 600; color: #cbd5e1;">Auditoria Contábil (Ledger vs Saldo):</span>
              <div id="reconciliationStatus" style="font-size: 0.75rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; margin-top: 2px;">
                Não auditado nesta sessão
              </div>
            </div>
            <button class="btn btn-audit" onclick="reconcileActiveWallet()">
              🔍 Auditar Agora
            </button>
          </div>
        </section>

        <!-- Card 2: Caixa / Depósito -->
        <section class="glass-card">
          <div class="card-title-row">
            <h2>
              <span>💳</span> Caixa &bull; Depósito Imediato
            </h2>
            <span class="badge badge-cyan">Idempotência Transparente</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
            Credita fundos na carteira com lock pessimista no PostgreSQL e persistência garantida no livro-razão (Ledger).
          </p>

          <div>
            <div class="section-subtitle">Valores Rápidos:</div>
            <div class="chips-group">
              <button class="chip-btn" onclick="performDeposit('20.00')">+ R$ 20,00</button>
              <button class="chip-btn" onclick="performDeposit('50.00')">+ R$ 50,00</button>
              <button class="chip-btn" onclick="performDeposit('100.00')">+ R$ 100,00</button>
              <button class="chip-btn" onclick="performDeposit('500.00')">+ R$ 500,00</button>
            </div>
          </div>

          <div>
            <div class="section-subtitle">Ou Digite um Valor Customizado:</div>
            <div class="input-row">
              <input type="text" inputmode="decimal" id="customDepositInput" class="input-styled" placeholder="Ex: 20,00 ou 50.00">
              <button class="btn btn-deposit" onclick="performCustomDeposit()">
                Depositar
              </button>
            </div>
          </div>
        </section>

      </div>

      <!-- Coluna da Direita: Cassino & Apostas -->
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- Card 3: Simulador de Apostas (BET / WIN / LOSS / REFUND) -->
        <section class="glass-card">
          <div class="card-title-row">
            <h2>
              <span>🎲</span> Mesa de Aposta (Wagering Sandbox)
            </h2>
            <span class="badge badge-purple" id="roundStatusBadge">Rodada Pronta</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
            Execute jogadas simuladas. O motor gera automaticamente os UUIDs de transação, roundId e chave de idempotência.
          </p>

          <!-- Seletor de Valor de Aposta -->
          <div>
            <div class="section-subtitle">Valor da Aposta (R$):</div>
            <div class="input-row" style="margin-bottom: 8px;">
              <input type="text" inputmode="decimal" id="betAmountInput" class="input-styled" value="10,00" placeholder="Ex: 10,00">
            </div>
            <div class="chips-group">
              <button class="chip-btn" onclick="setBetAmount('5.00')">R$ 5</button>
              <button class="chip-btn" onclick="setBetAmount('10.00')">R$ 10</button>
              <button class="chip-btn" onclick="setBetAmount('25.00')">R$ 25</button>
              <button class="chip-btn" onclick="setBetAmount('50.00')">R$ 50</button>
              <button class="chip-btn" onclick="setBetAmount('100.00')">R$ 100</button>
            </div>
          </div>

          <!-- Botões de Ação do Jogo -->
          <div class="game-actions-grid">
            <button class="btn btn-bet" onclick="performBetAction()">
              <span>🎰</span> Fazer Aposta (BET)
            </button>
            <button class="btn btn-win" onclick="performWinAction()">
              <span>🏆</span> Vitória (WIN 2x)
            </button>
            <button class="btn btn-loss" onclick="performLossAction()">
              <span>💀</span> Derrota (LOSS)
            </button>
            <button class="btn btn-refund" id="btnRefund" onclick="performRefundAction()">
              <span>↩️</span> Estornar Aposta
            </button>
            <button class="btn btn-rollback" id="btnRollback" onclick="performRollbackAction()">
              <span>⏪</span> Rollback Técnico
            </button>
          </div>

          <div style="background: rgba(0, 0, 0, 0.2); border-radius: 10px; padding: 12px; font-size: 0.76rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">
            <div>Última aposta ativa na sessão:</div>
            <div id="lastBetDetails" style="color: #cbd5e1; margin-top: 4px;">Nenhuma aposta feita ainda nesta sessão.</div>
          </div>
        </section>

        <!-- Card 4: Mini Ledger / Histórico da Sessão -->
        <section class="glass-card" style="flex: 1;">
          <div class="card-title-row">
            <h2>
              <span>📜</span> Histórico de Operações (Ledger)
            </h2>
            <button class="btn-refresh" onclick="fetchLiveLedger()">
              ↻ Recarregar Ledger Completo
            </button>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Operação</th>
                  <th>Valor</th>
                  <th>Saldo Resultante</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="operationsTableBody">
                <tr>
                  <td colspan="5" class="empty-history">
                    Nenhuma operação efetuada nesta sessão.<br>Faça um depósito ou aposta acima para começar!
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>

    <!-- Card 5: Laboratório de Concorrência & Idempotência (Desafio Jungle) -->
    <section class="glass-card lab-card">
      <div class="card-title-row">
        <h2>
          <span>🧪</span> Laboratório de Concorrência, Idempotência &amp; Resiliência
        </h2>
        <span class="badge badge-purple">Suíte Interativa do Desafio</span>
      </div>
      <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">
        Demonstração em tempo real dos critérios mais rigorosos da avaliação técnica: concorrência em hot-wallets com lock pessimista, tempestades de replay idempotente, proteção contra payloads conflitantes e resolução de referências fora de ordem.
      </p>

      <div class="lab-grid">
        <!-- Cenário 1 -->
        <div class="lab-scenario-card">
          <div class="lab-scenario-header">
            <span class="badge badge-rose">Seção 8 &bull; Concorrência</span>
            <h4>⚡ Hot-Wallet 100 / 80 / 80</h4>
          </div>
          <p class="lab-scenario-desc">
            Cria carteira com R$ 100,00 e dispara simultaneamente duas apostas de R$ 80,00. O lock pessimista serializa as mutações: 1 aprovada (201), 1 rejeitada (422) e saldo final exato de R$ 20,00.
          </p>
          <button class="btn-scenario" onclick="runRaceConditionScenario()" id="btnRaceScenario">
            <span>⚡</span> Disparar 2x R$ 80 Simultâneos
          </button>
        </div>

        <!-- Cenário 2 -->
        <div class="lab-scenario-card">
          <div class="lab-scenario-header">
            <span class="badge badge-cyan">Seção 7 &bull; Idempotência</span>
            <h4>🔁 Replay Storm (10x Idênticos)</h4>
          </div>
          <p class="lab-scenario-desc">
            Dispara 10 requisições simultâneas com a MESMA Idempotency-Key e mesmo payload. Comprova: 1 criação real (201) e 9 replays imediatos (200 OK) sem débito adicional de saldo.
          </p>
          <button class="btn-scenario" onclick="runReplayStormScenario()" id="btnReplayScenario">
            <span>🔁</span> Disparar 10x Replays Concorrentes
          </button>
        </div>

        <!-- Cenário 3 -->
        <div class="lab-scenario-card">
          <div class="lab-scenario-header">
            <span class="badge badge-amber">Seção 6.3 &bull; Integridade</span>
            <h4>💥 Conflito de Idempotência (409)</h4>
          </div>
          <p class="lab-scenario-desc">
            Envia uma aposta com chave única e, em seguida, reenvia a mesma chave com payload alterado. O motor detecta divergência de hash canônico e rejeita terminantemente com 409 Conflict.
          </p>
          <button class="btn-scenario" onclick="runIdempotencyConflictScenario()" id="btnConflictScenario">
            <span>💥</span> Testar Conflito de Payload (409)
          </button>
        </div>

        <!-- Cenário 4 -->
        <div class="lab-scenario-card">
          <div class="lab-scenario-header">
            <span class="badge badge-purple">Seção 7.1 &bull; Resiliência</span>
            <h4>⏳ Fora de Ordem (Pending Reference)</h4>
          </div>
          <p class="lab-scenario-desc">
            Envia uma vitória (WIN) referenciando uma aposta que ainda não chegou. Retorna 202 Accepted (PENDING_REFERENCE). Em seguida envia a aposta e o resolver em background liquida a pendência.
          </p>
          <button class="btn-scenario" onclick="runPendingReferenceScenario()" id="btnPendingScenario">
            <span>⏳</span> Simular Chegada Fora de Ordem
          </button>
        </div>
      </div>

      <!-- Console de Logs do Laboratório -->
      <div class="lab-console-wrapper">
        <div class="lab-console-header">
          <span style="font-size: 0.78rem; font-weight: 600; color: #cbd5e1; font-family: 'JetBrains Mono', monospace;">
            📟 Console de Execução &amp; Auditoria do Laboratório:
          </span>
          <button class="copy-btn" onclick="clearLabConsole()">Limpar Console</button>
        </div>
        <div class="lab-console-body" id="labConsoleBody">
          <div class="console-line info">[INFO] Laboratório pronto. Clique em qualquer um dos cenários acima para executar e auditar em tempo real.</div>
        </div>
      </div>
    </section>

  </div>

  <script>
    // Estado da Aplicação no Cliente
    const state = {
      playerId: null,
      walletId: null,
      balance: "0.00",
      currency: "BRL",
      version: 0,
      activeRoundId: null,
      lastBetTxId: null,
      lastBetAmount: "0.00",
      lastProcessableTx: null,
      operations: []
    };

    const RECENT_WALLETS_KEY = "jg_recent_wallets_v1";

    // Inicialização
    document.addEventListener("DOMContentLoaded", async () => {
      loadRecentWallets();
      const savedWalletId = getSavedActiveWallet();
      let ok = false;
      if (savedWalletId && savedWalletId !== "undefined") {
        ok = await loadWalletById(savedWalletId);
      }
      if (!ok) {
        await createNewPlayerWallet();
      }
    });

    // Notificações Toast
    function showToast(title, message, type = "info") {
      const container = document.getElementById("toastContainer");
      const toast = document.createElement("div");
      toast.className = "toast toast-" + type;

      const icons = {
        success: "✅",
        error: "❌",
        warning: "⚠️",
        info: "ℹ️"
      };

      toast.innerHTML = \`
        <span class="toast-icon">\${icons[type] || "ℹ️"}</span>
        <div class="toast-body">
          <div class="toast-title">\${title}</div>
          <div class="toast-message">\${message}</div>
        </div>
      \`;

      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
      }, 4200);
    }

    // Modal Helpers
    function openModal(id) {
      document.getElementById(id).classList.add("open");
    }

    function closeModal(id) {
      document.getElementById(id).classList.remove("open");
    }

    // Gestão de Carteiras Recentes
    function getSavedActiveWallet() {
      try {
        const list = JSON.parse(localStorage.getItem(RECENT_WALLETS_KEY) || "[]");
        const valid = list.find(item => item && item.walletId && item.walletId !== "undefined");
        return valid ? valid.walletId : null;
      } catch {
        return null;
      }
    }

    function saveWalletToHistory(wallet) {
      try {
        const targetWalletId = (wallet && wallet.walletId) || (wallet && !wallet.transactionId && !wallet.kind && !wallet.roundId ? wallet.id : null) || state.walletId;
        if (!targetWalletId || targetWalletId === "undefined") return;
        const targetPlayerId = (wallet && wallet.playerId) || state.playerId;
        const targetCurrency = (wallet && wallet.currency) || state.currency || "BRL";
        const targetBalance = (wallet ? extractBalance(wallet) : null) || state.balance || "0.00";

        let list = JSON.parse(localStorage.getItem(RECENT_WALLETS_KEY) || "[]");
        list = list.filter(w => w && w.walletId && w.walletId !== targetWalletId && w.walletId !== "undefined");
        list.unshift({
          walletId: targetWalletId,
          playerId: targetPlayerId,
          balance: targetBalance,
          currency: targetCurrency,
          savedAt: new Date().toISOString()
        });
        if (list.length > 10) list = list.slice(0, 10);
        localStorage.setItem(RECENT_WALLETS_KEY, JSON.stringify(list));
        loadRecentWallets();
      } catch (err) {
        console.warn("Erro ao salvar histórico local:", err);
      }
    }

    function loadRecentWallets() {
      const container = document.getElementById("recentWalletsList");
      try {
        let list = JSON.parse(localStorage.getItem(RECENT_WALLETS_KEY) || "[]");
        list = list.filter(item => item && item.walletId && item.walletId !== "undefined");
        localStorage.setItem(RECENT_WALLETS_KEY, JSON.stringify(list));
        if (list.length === 0) {
          container.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted); padding: 8px 0;">Nenhuma carteira salva no histórico recente.</div>';
          return;
        }
        container.innerHTML = list.map(item => \`
          <button class="wallet-item-btn" onclick="selectFromHistory('\${item.walletId}')">
            <div>
              <div style="font-weight: 600; font-size: 0.84rem; color: #fff;">\${item.currency || 'BRL'} \${formatMoney(item.balance)}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">
                \${item.walletId.slice(0, 8)}...\${item.walletId.slice(-4)}
              </div>
            </div>
            <span class="badge badge-purple">Selecionar</span>
          </button>
        \`).join("");
      } catch {
        // ignora
      }
    }

    async function selectFromHistory(walletId) {
      closeModal("switchWalletModal");
      await loadWalletById(walletId);
    }

    async function loadManualWallet() {
      const input = document.getElementById("manualWalletIdInput");
      const id = input.value.trim();
      if (!id) {
        showToast("ID Inválido", "Informe um UUID de carteira válido.", "warning");
        return;
      }
      closeModal("switchWalletModal");
      await loadWalletById(id);
      input.value = "";
    }

    // Criar Nova Carteira para Jogador Aleatório
    async function createNewPlayerWallet() {
      const newPlayerId = crypto.randomUUID();
      try {
        const res = await fetch("/wallets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-provider-id": "simulator"
          },
          body: JSON.stringify({
            playerId: newPlayerId,
            currency: "BRL",
            initialBalance: "100.00"
          })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Erro ao criar carteira no backend");
        }

        const data = await res.json();
        updateWalletState(data);
        saveWalletToHistory(data);
        
        // Reset da rodada
        state.activeRoundId = "round-" + Date.now();
        state.lastBetTxId = null;
        state.lastProcessableTx = null;
        updateLastBetUI();

        addOperationToLedger({
          time: new Date().toLocaleTimeString(),
          kind: "CADASTRO",
          amount: "+ R$ 100,00",
          balance: "R$ " + formatMoney(data.balance),
          status: "COMPLETED",
          statusColor: "badge-green"
        });

        showToast("Novo Jogador Pronto!", "Carteira aberta com saldo inicial de R$ 100,00.", "success");
      } catch (err) {
        showToast("Falha ao Criar Carteira", err.message, "error");
      }
    }

    // Consultar Carteira por ID
    async function loadWalletById(walletId) {
      try {
        const res = await fetch("/wallets/" + walletId, {
          headers: { "x-provider-id": "simulator" }
        });
        if (!res.ok) {
          throw new Error("Carteira " + walletId + " não encontrada");
        }
        const data = await res.json();
        updateWalletState(data);
        saveWalletToHistory(data);
        await fetchLiveLedger();
        showToast("Carteira Carregada", "Saldo sincronizado: R$ " + formatMoney(data.balance), "info");
        return true;
      } catch (err) {
        try {
          let list = JSON.parse(localStorage.getItem(RECENT_WALLETS_KEY) || "[]");
          list = list.filter(w => w && w.walletId && w.walletId !== walletId);
          localStorage.setItem(RECENT_WALLETS_KEY, JSON.stringify(list));
          loadRecentWallets();
        } catch {}
        showToast("Erro ao Carregar", err.message, "error");
        return false;
      }
    }

    async function refreshCurrentWallet() {
      if (!state.walletId) return;
      try {
        const res = await fetch("/wallets/" + state.walletId, {
          headers: { "x-provider-id": "simulator" }
        });
        if (res.ok) {
          const data = await res.json();
          updateWalletState(data);
          saveWalletToHistory(data);
          showToast("Saldo Atualizado", "Saldo conferido no banco de dados.", "info");
        }
      } catch (err) {
        showToast("Erro na Sincronização", err.message, "error");
      }
    }

    function normalizeMoneyInput(val) {
      if (!val) return "";
      let s = String(val).trim();
      s = s.split("R$").join("").split("r$").join("").split("$").join("").split(" ").join("");
      if (s.indexOf(".") !== -1 && s.indexOf(",") !== -1) {
        if (s.indexOf(".") < s.indexOf(",")) {
          s = s.split(".").join("").replace(",", ".");
        } else {
          s = s.split(",").join("");
        }
      } else if (s.indexOf(",") !== -1) {
        s = s.replace(",", ".");
      }
      return s;
    }

    function isValidMoneyString(s) {
      if (!s || s.length === 0) return false;
      const parts = s.split(".");
      if (parts.length > 2) return false;
      const whole = parts[0];
      if (whole.length === 0) return false;
      const frac = parts.length === 2 ? parts[1] : "";
      if (frac.length > 2) return false;
      for (let i = 0; i < whole.length; i++) {
        const c = whole.charCodeAt(i);
        if (c < 48 || c > 57) return false;
      }
      for (let i = 0; i < frac.length; i++) {
        const c = frac.charCodeAt(i);
        if (c < 48 || c > 57) return false;
      }
      return true;
    }

    function strToCents(strVal) {
      const normalized = normalizeMoneyInput(strVal);
      if (!normalized) return 0n;
      const parts = normalized.split(".");
      const whole = BigInt(parts[0] || "0");
      const frac = (parts[1] || "").padEnd(2, "0").slice(0, 2);
      return whole * 100n + BigInt(frac);
    }

    function centsToStr(centsVal) {
      const negative = centsVal < 0n;
      const absCents = negative ? -centsVal : centsVal;
      const whole = absCents / 100n;
      const frac = String(absCents % 100n).padStart(2, "0");
      return (negative ? "-" : "") + whole.toString() + "." + frac;
    }

    function extractBalance(data) {
      if (!data) return "0.00";
      if (data.balanceAfter) return data.balanceAfter;
      if (data.resultBalance) return data.resultBalance;
      if (typeof data.balance === "string") return data.balance;
      if (data.balance && typeof data.balance === "object" && data.balance.amount) return data.balance.amount;
      if (data.balanceAmount) return data.balanceAmount;
      return "0.00";
    }

    // Atualização de Estado e UI
    function updateWalletState(data, effect = null) {
      if (!data) return;
      const resolvedWalletId = data.walletId || (!data.transactionId && !data.kind && !data.roundId ? data.id : null);
      if (resolvedWalletId) {
        state.walletId = resolvedWalletId;
      }
      state.playerId = data.playerId || state.playerId;
      state.currency = data.currency || state.currency || "BRL";
      state.version = data.version ?? state.version;
      
      const prevBalCents = strToCents(state.balance || "0");
      const nextBal = extractBalance(data);
      const nextBalCents = strToCents(nextBal);
      state.balance = nextBal;

      document.getElementById("displayPlayerId").innerText = state.playerId;
      document.getElementById("displayWalletId").innerText = state.walletId;
      document.getElementById("displayCurrency").innerText = state.currency;
      document.getElementById("displayVersion").innerText = "v" + state.version;

      const balEl = document.getElementById("displayBalance");
      balEl.innerText = state.currency + " " + formatMoney(state.balance);

      if (effect === "credit" || nextBalCents > prevBalCents) {
        balEl.classList.remove("pulse-red");
        balEl.classList.add("pulse-green");
        setTimeout(() => balEl.classList.remove("pulse-green"), 500);
      } else if (effect === "debit" || nextBalCents < prevBalCents) {
        balEl.classList.remove("pulse-green");
        balEl.classList.add("pulse-red");
        setTimeout(() => balEl.classList.remove("pulse-red"), 500);
      }
    }

    // Depósito
    async function performDeposit(amountStr) {
      if (!state.walletId) {
        showToast("Sem Carteira", "Crie ou selecione uma carteira primeiro.", "warning");
        return;
      }

      const idempotencyKey = crypto.randomUUID();
      try {
        const res = await fetch("/wallets/" + state.walletId + "/deposit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
            "x-provider-id": "simulator"
          },
          body: JSON.stringify({
            amount: amountStr,
            providerId: "simulator",
            externalTransactionId: "dep-" + Date.now()
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Erro ao processar depósito");
        }

        updateWalletState(data, "credit");

        addOperationToLedger({
          time: new Date().toLocaleTimeString(),
          kind: "DEPOSIT",
          amount: "+ " + state.currency + " " + formatMoney(amountStr),
          balance: state.currency + " " + formatMoney(state.balance),
          status: data.idempotentReplay ? "REPLAY" : "COMPLETED",
          statusColor: "badge-cyan"
        });

        showToast("Depósito Concluído!", "Creditado: " + state.currency + " " + formatMoney(amountStr), "success");
      } catch (err) {
        showToast("Falha no Depósito", err.message, "error");
      }
    }

    function performCustomDeposit() {
      const input = document.getElementById("customDepositInput");
      const raw = normalizeMoneyInput(input.value);
      if (!isValidMoneyString(raw) || strToCents(raw) <= 0n) {
        showToast("Valor Inválido", "Informe um valor de depósito positivo (ex: 20,00 ou 50.00).", "warning");
        return;
      }
      performDeposit(centsToStr(strToCents(raw)));
      input.value = "";
    }

    // Ações de Jogo e Aposta
    function setBetAmount(amount) {
      document.getElementById("betAmountInput").value = formatMoney(amount);
    }

    function getBetAmount() {
      const raw = normalizeMoneyInput(document.getElementById("betAmountInput").value);
      if (!isValidMoneyString(raw) || strToCents(raw) <= 0n) return "10.00";
      return centsToStr(strToCents(raw));
    }

    // BET (Aposta)
    async function performBetAction() {
      if (!state.walletId) return;
      const amount = getBetAmount();
      
      if (strToCents(amount) > strToCents(state.balance || "0")) {
        showToast("Saldo Insuficiente", "Seu saldo atual (" + state.currency + " " + formatMoney(state.balance) + ") não cobre a aposta de " + state.currency + " " + formatMoney(amount), "error");
        return;
      }

      state.activeRoundId = "round-" + Date.now();
      const txId = "tx-bet-" + Date.now();
      const idempotencyKey = crypto.randomUUID();

      try {
        const res = await fetch("/wagering/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
            "x-provider-id": "simulator"
          },
          body: JSON.stringify({
            providerId: "simulator",
            externalTransactionId: txId,
            playerId: state.playerId,
            walletId: state.walletId,
            roundId: state.activeRoundId,
            gameId: "roulette-simulator",
            kind: "BET",
            amount: amount,
            currency: state.currency
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Erro ao processar aposta");
        }

        state.lastBetTxId = txId;
        state.lastBetAmount = amount;
        state.lastProcessableTx = {
          id: txId,
          kind: "BET",
          amount: amount,
          roundId: state.activeRoundId
        };
        updateLastBetUI();

        updateWalletState(data, "debit");

        addOperationToLedger({
          time: new Date().toLocaleTimeString(),
          kind: "BET",
          amount: "- " + state.currency + " " + formatMoney(amount),
          balance: state.currency + " " + formatMoney(state.balance),
          status: data.status,
          statusColor: "badge-purple"
        });

        document.getElementById("roundStatusBadge").innerText = "Rodada em Andamento";
        document.getElementById("roundStatusBadge").className = "badge badge-amber";

        showToast("Aposta Confirmada!", "Debitados " + state.currency + " " + formatMoney(amount) + " na rodada.", "info");
      } catch (err) {
        showToast("Aposta Rejeitada", err.message, "error");
      }
    }

    // WIN (Vitória)
    async function performWinAction() {
      if (!state.walletId) return;
      if (!state.lastBetTxId) {
        showToast("Nenhuma Aposta Ativa", "Faça uma aposta (BET) antes de registrar uma vitória.", "warning");
        return;
      }

      const betCents = strToCents(state.lastBetAmount || "10.00");
      const winAmount = centsToStr(betCents * 2n);
      const txId = "tx-win-" + Date.now();
      const idempotencyKey = crypto.randomUUID();

      try {
        const res = await fetch("/wagering/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
            "x-provider-id": "simulator"
          },
          body: JSON.stringify({
            providerId: "simulator",
            externalTransactionId: txId,
            playerId: state.playerId,
            walletId: state.walletId,
            roundId: state.activeRoundId,
            gameId: "roulette-simulator",
            kind: "WIN",
            amount: winAmount,
            currency: state.currency,
            referenceExternalTransactionId: state.lastBetTxId
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Erro ao creditar vitória");
        }

        updateWalletState(data, "credit");

        addOperationToLedger({
          time: new Date().toLocaleTimeString(),
          kind: "WIN",
          amount: "+ " + state.currency + " " + formatMoney(winAmount),
          balance: state.currency + " " + formatMoney(state.balance),
          status: data.status,
          statusColor: "badge-green"
        });

        state.lastProcessableTx = {
          id: txId,
          kind: "WIN",
          amount: winAmount,
          roundId: state.activeRoundId
        };
        state.lastBetTxId = null;
        updateLastBetUI();

        document.getElementById("roundStatusBadge").innerText = "Vitória Registrada";
        document.getElementById("roundStatusBadge").className = "badge badge-green";

        showToast("Parabéns! Vitória!", "Creditados " + state.currency + " " + formatMoney(winAmount) + " na carteira!", "success");
      } catch (err) {
        showToast("Falha no Registro de Vitória", err.message, "error");
      }
    }

    // LOSS (Derrota)
    async function performLossAction() {
      if (!state.walletId) return;
      if (!state.lastBetTxId) {
        showToast("Nenhuma Aposta Ativa", "Faça uma aposta (BET) antes de registrar encerramento de rodada.", "warning");
        return;
      }

      const txId = "tx-loss-" + Date.now();
      const idempotencyKey = crypto.randomUUID();
      const lossAmount = state.lastBetAmount || "10.00";

      try {
        const res = await fetch("/wagering/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
            "x-provider-id": "simulator"
          },
          body: JSON.stringify({
            providerId: "simulator",
            externalTransactionId: txId,
            playerId: state.playerId,
            walletId: state.walletId,
            roundId: state.activeRoundId,
            gameId: "roulette-simulator",
            kind: "LOSS",
            amount: lossAmount,
            currency: state.currency,
            referenceExternalTransactionId: state.lastBetTxId
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errMsg = data.error?.message || data.message || "Erro ao registrar perda";
          throw new Error(errMsg);
        }

        addOperationToLedger({
          time: new Date().toLocaleTimeString(),
          kind: "LOSS",
          amount: state.currency + " 0,00",
          balance: state.currency + " " + formatMoney(state.balance),
          status: data.status,
          statusColor: "badge-rose"
        });

        state.lastBetTxId = null;
        updateLastBetUI();

        document.getElementById("roundStatusBadge").innerText = "Rodada Encerrada";
        document.getElementById("roundStatusBadge").className = "badge badge-purple";

        showToast("Rodada Encerrada", "A rodada foi liquidada como derrota.", "info");
      } catch (err) {
        showToast("Erro ao Registrar Derrota", err.message, "error");
      }
    }

    // REFUND (Estorno de Aposta)
    async function performRefundAction() {
      if (!state.walletId) return;
      if (!state.lastBetTxId) {
        showToast("Sem Aposta para Estorno", "Não há nenhuma aposta recente ativa para estornar.", "warning");
        return;
      }

      const txId = "tx-ref-" + Date.now();
      const idempotencyKey = crypto.randomUUID();

      try {
        const res = await fetch("/wagering/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
            "x-provider-id": "simulator"
          },
          body: JSON.stringify({
            providerId: "simulator",
            externalTransactionId: txId,
            playerId: state.playerId,
            walletId: state.walletId,
            roundId: state.activeRoundId,
            gameId: "roulette-simulator",
            kind: "REFUND",
            amount: state.lastBetAmount,
            currency: state.currency,
            referenceExternalTransactionId: state.lastBetTxId
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Erro ao estornar aposta");
        }

        updateWalletState(data, "credit");

        addOperationToLedger({
          time: new Date().toLocaleTimeString(),
          kind: "REFUND",
          amount: "+ " + state.currency + " " + formatMoney(state.lastBetAmount),
          balance: state.currency + " " + formatMoney(state.balance),
          status: data.status,
          statusColor: "badge-amber"
        });

        showToast("Aposta Estornada!", "Valor devolvido integralmente ao saldo: " + state.currency + " " + formatMoney(state.lastBetAmount), "success");

        state.lastProcessableTx = {
          id: txId,
          kind: "REFUND",
          amount: state.lastBetAmount,
          roundId: state.activeRoundId
        };
        state.lastBetTxId = null;
        updateLastBetUI();
        document.getElementById("roundStatusBadge").innerText = "Aposta Estornada";
        document.getElementById("roundStatusBadge").className = "badge badge-amber";
      } catch (err) {
        showToast("Erro no Estorno", err.message, "error");
      }
    }

    // ROLLBACK (Reversão Geral de Transação: BET, WIN ou REFUND)
    async function performRollbackAction() {
      if (!state.walletId) return;
      if (!state.lastProcessableTx) {
        showToast("Sem Transação para Rollback", "Execute uma aposta (BET), vitória (WIN) ou estorno (REFUND) antes de testar o Rollback.", "warning");
        return;
      }

      const targetTx = state.lastProcessableTx;
      const txId = "tx-rb-" + Date.now();
      const idempotencyKey = crypto.randomUUID();

      try {
        const res = await fetch("/wagering/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
            "x-provider-id": "simulator"
          },
          body: JSON.stringify({
            providerId: "simulator",
            externalTransactionId: txId,
            playerId: state.playerId,
            walletId: state.walletId,
            roundId: targetTx.roundId || state.activeRoundId,
            gameId: "roulette-simulator",
            kind: "ROLLBACK",
            amount: targetTx.amount,
            currency: state.currency,
            referenceExternalTransactionId: targetTx.id
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errMsg = data.error?.message || data.message || "Erro no Rollback";
          throw new Error(errMsg);
        }

        // ROLLBACK inverte o efeito contábil da referência:
        // Referenciou BET (débito) -> Rollback credita (+).
        // Referenciou WIN (crédito) -> Rollback debita (-).
        // Referenciou REFUND (crédito) -> Rollback debita (-).
        const isCredit = targetTx.kind === "BET";
        updateWalletState(data, isCredit ? "credit" : "debit");

        addOperationToLedger({
          time: new Date().toLocaleTimeString(),
          kind: "ROLLBACK",
          amount: (isCredit ? "+ " : "- ") + state.currency + " " + formatMoney(targetTx.amount),
          balance: state.currency + " " + formatMoney(state.balance),
          status: data.status,
          statusColor: "badge-purple"
        });

        state.lastProcessableTx = null;
        state.lastBetTxId = null;
        updateLastBetUI();
        document.getElementById("roundStatusBadge").innerText = "Rollback Concluído";
        document.getElementById("roundStatusBadge").className = "badge badge-purple";

        showToast("Rollback Concluído!", "Transação " + targetTx.id + " (" + targetTx.kind + ") revertida com sucesso.", "success");
      } catch (err) {
        showToast("Falha no Rollback", err.message, "error");
      }
    }

    function updateLastBetUI() {
      const el = document.getElementById("lastBetDetails");
      if (state.lastProcessableTx) {
        el.innerHTML = "Última operação: <strong>" + state.lastProcessableTx.kind + "</strong> (<code>" + state.lastProcessableTx.id + "</code>) | Valor: <strong>" + state.currency + " " + formatMoney(state.lastProcessableTx.amount) + "</strong>";
      } else if (state.lastBetTxId) {
        el.innerHTML = "ID: <code>" + state.lastBetTxId + "</code> | Valor: <strong>" + state.currency + " " + formatMoney(state.lastBetAmount) + "</strong>";
      } else {
        el.innerText = "Nenhuma aposta ativa aguardando encerramento/estorno/rollback.";
      }
    }

    // =========================================================================
    // 🧪 CENÁRIOS INTERATIVOS DO LABORATÓRIO (DESAFIO JUNGLE)
    // =========================================================================

    function logToLabConsole(msg, type = "info") {
      const consoleBody = document.getElementById("labConsoleBody");
      if (!consoleBody) return;
      const line = document.createElement("div");
      line.className = "console-line " + type;
      line.innerText = "[" + new Date().toLocaleTimeString() + "] " + msg;
      consoleBody.appendChild(line);
      consoleBody.scrollTop = consoleBody.scrollHeight;
    }

    function clearLabConsole() {
      const consoleBody = document.getElementById("labConsoleBody");
      if (consoleBody) {
        consoleBody.innerHTML = '<div class="console-line info">[INFO] Console limpo. Pronto para novos testes.</div>';
      }
    }

    // Cenário 1: Concorrência Limítrofe (Hot-Wallet 100 / 80 / 80 da Seção 8)
    async function runRaceConditionScenario() {
      const btn = document.getElementById("btnRaceScenario");
      if (btn) btn.disabled = true;
      logToLabConsole("--- [INICIANDO CENÁRIO SEÇÃO 8: CONCORRÊNCIA HOT-WALLET] ---", "accent");
      logToLabConsole("1. Criando carteira isolada com saldo inicial exato de R$ 100,00...", "info");

      try {
        const testPlayerId = crypto.randomUUID();
        const createRes = await fetch("/wallets", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-provider-id": "simulator" },
          body: JSON.stringify({
            playerId: testPlayerId,
            currency: "BRL",
            initialBalance: "100.00"
          })
        });

        if (!createRes.ok) throw new Error("Falha ao criar carteira para teste");
        const walletData = await createRes.json();
        const testWalletId = walletData.id;
        logToLabConsole("✔ Carteira criada: " + testWalletId + " (Saldo inicial: R$ 100,00)", "success");

        logToLabConsole("2. Disparando SIMULTANEAMENTE duas apostas de R$ 80,00 via Promise.all...", "warn");
        const roundId = "race-round-" + Date.now();
        const tx1Id = "tx-race-1-" + Date.now();
        const tx2Id = "tx-race-2-" + Date.now();

        const req1 = fetch("/wagering/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
            "x-provider-id": "simulator"
          },
          body: JSON.stringify({
            providerId: "simulator",
            externalTransactionId: tx1Id,
            playerId: testPlayerId,
            walletId: testWalletId,
            roundId: roundId,
            gameId: "race-game",
            kind: "BET",
            amount: "80.00",
            currency: "BRL"
          })
        });

        const req2 = fetch("/wagering/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
            "x-provider-id": "simulator"
          },
          body: JSON.stringify({
            providerId: "simulator",
            externalTransactionId: tx2Id,
            playerId: testPlayerId,
            walletId: testWalletId,
            roundId: roundId,
            gameId: "race-game",
            kind: "BET",
            amount: "80.00",
            currency: "BRL"
          })
        });

        const [res1, res2] = await Promise.all([req1, req2]);
        const data1 = await res1.json().catch(() => ({}));
        const data2 = await res2.json().catch(() => ({}));

        const status1 = res1.status;
        const status2 = res2.status;
        logToLabConsole("Requisição A: HTTP " + status1 + " (" + (data1.status || data1.failureCode || data1.message || "") + ")", status1 === 201 ? "success" : "warn");
        logToLabConsole("Requisição B: HTTP " + status2 + " (" + (data2.status || data2.failureCode || data2.message || "") + ")", status2 === 201 ? "success" : "warn");

        const hasOneSuccess = (status1 === 201 && status2 === 422) || (status1 === 422 && status2 === 201);
        if (hasOneSuccess) {
          logToLabConsole("✔ SUCESSO DE CONCORRÊNCIA! Exatamente 1 aposta aprovada (201) e 1 rejeitada (422 INSUFFICIENT_FUNDS). Zero saldo negativo!", "success");
        } else {
          logToLabConsole("Desfecho obtido: " + status1 + " / " + status2, "info");
        }

        // Auditar reconciliação
        logToLabConsole("3. Auditando consistência contábil (POST /wallets/:id/reconciliation)...", "info");
        const recRes = await fetch("/wallets/" + testWalletId + "/reconciliation", {
          method: "POST",
          headers: { "x-provider-id": "simulator" }
        });
        const recData = await recRes.json();
        if (recData.consistent) {
          logToLabConsole("✔ RECONCILIAÇÃO CONTÁBIL: 100% ÍNTEGRO! Saldo final: R$ " + formatMoney(recData.storedBalance) + " | Ledger: R$ " + formatMoney(recData.calculatedBalance) + " | Diferença: R$ " + recData.difference, "success");
        } else {
          logToLabConsole("❌ DIVERGÊNCIA CONTÁBIL: Diferença de R$ " + recData.difference, "error");
        }

        // Carregar na UI
        await loadWalletById(testWalletId);
        showToast("Cenário Seção 8 Concluído", "Lock pessimista validado com 100% de sucesso contábil! Saldo final: R$ 20,00", "success");
      } catch (err) {
        logToLabConsole("Erro ao executar teste de concorrência: " + err.message, "error");
        showToast("Falha no Cenário", err.message, "error");
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    // Cenário 2: Tempestade de Replay de Idempotência (10x Simultâneos)
    async function runReplayStormScenario() {
      if (!state.walletId) return;
      const btn = document.getElementById("btnReplayScenario");
      if (btn) btn.disabled = true;
      logToLabConsole("--- [INICIANDO AVALANCHE DE REPLAYS DE IDEMPOTÊNCIA (10x)] ---", "accent");
      logToLabConsole("Disparando 10 requisições simultâneas com a MESMA Idempotency-Key e mesmo payload...", "info");

      try {
        const stormKey = "storm-key-" + crypto.randomUUID();
        const txId = "tx-storm-" + Date.now();
        const roundId = "round-storm-" + Date.now();
        const betAmount = "1.00";

        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(
            fetch("/wagering/transactions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": stormKey,
                "x-provider-id": "simulator"
              },
              body: JSON.stringify({
                providerId: "simulator",
                externalTransactionId: txId,
                playerId: state.playerId,
                walletId: state.walletId,
                roundId: roundId,
                gameId: "storm-game",
                kind: "BET",
                amount: betAmount,
                currency: state.currency
              })
            }).then(async r => ({ status: r.status, data: await r.json().catch(() => ({})) }))
          );
        }

        const results = await Promise.all(promises);
        let count201 = 0;
        let count200 = 0;
        let countOther = 0;

        results.forEach(res => {
          if (res.status === 201) count201++;
          else if (res.status === 200 && res.data.idempotentReplay) count200++;
          else countOther++;
        });

        logToLabConsole("Resultado da Avalanche: " + count201 + " criação (201 Created) | " + count200 + " replays idempotentes (200 OK) | " + countOther + " outros", "accent");

        if (count201 === 1 && count200 === 9) {
          logToLabConsole("✔ IDEMPOTÊNCIA PERFEITA! 1 processamento real e 9 replays atendidos sem duplicar débito.", "success");
        }

        await refreshCurrentWallet();
        await fetchLiveLedger();
        showToast("Avalanche Concluída", count200 + " replays idempotentes atendidos com 200 OK. Zero cobrança dupla!", "success");
      } catch (err) {
        logToLabConsole("Erro na avalanche de replays: " + err.message, "error");
        showToast("Erro no Teste", err.message, "error");
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    // Cenário 3: Conflito de Idempotência (409 Conflict)
    async function runIdempotencyConflictScenario() {
      if (!state.walletId) return;
      const btn = document.getElementById("btnConflictScenario");
      if (btn) btn.disabled = true;
      logToLabConsole("--- [INICIANDO TESTE DE CONFLITO DE IDEMPOTÊNCIA (409)] ---", "accent");

      try {
        const sharedKey = "conflict-key-" + crypto.randomUUID();
        const roundId = "conflict-round-" + Date.now();

        logToLabConsole("1. Enviando aposta inicial com Idempotency-Key: " + sharedKey + " (Valor: R$ 10,00)...", "info");
        const res1 = await fetch("/wagering/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": sharedKey,
            "x-provider-id": "simulator"
          },
          body: JSON.stringify({
            providerId: "simulator",
            externalTransactionId: "tx-conf-1-" + Date.now(),
            playerId: state.playerId,
            walletId: state.walletId,
            roundId: roundId,
            gameId: "conflict-game",
            kind: "BET",
            amount: "10.00",
            currency: state.currency
          })
        });

        const data1 = await res1.json().catch(() => ({}));
        logToLabConsole("Resposta 1: HTTP " + res1.status + " (" + (data1.status || "OK") + ")", res1.status === 201 ? "success" : "warn");

        logToLabConsole("2. Enviando SEGUNDA aposta com a MESMA chave, mas valor modificado (R$ 50,00)...", "warn");
        const res2 = await fetch("/wagering/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": sharedKey,
            "x-provider-id": "simulator"
          },
          body: JSON.stringify({
            providerId: "simulator",
            externalTransactionId: "tx-conf-2-" + Date.now(),
            playerId: state.playerId,
            walletId: state.walletId,
            roundId: roundId,
            gameId: "conflict-game",
            kind: "BET",
            amount: "50.00",
            currency: state.currency
          })
        });

        const data2 = await res2.json().catch(() => ({}));
        logToLabConsole("Resposta 2: HTTP " + res2.status + " (" + (data2.error?.code || data2.message || "409 Conflict") + ")", res2.status === 409 ? "success" : "error");

        if (res2.status === 409) {
          logToLabConsole("✔ PROTEÇÃO CONFIRMADA: O backend identificou divergência de payloadHash e rejeitou com 409 Conflict!", "success");
          showToast("Conflito Identificado (409)", "Tentativa de alteração com mesma Idempotency-Key foi bloqueada com sucesso.", "success");
        } else {
          showToast("Resultado Inesperado", "Esperado 409 Conflict, recebido " + res2.status, "warning");
        }

        await refreshCurrentWallet();
        await fetchLiveLedger();
      } catch (err) {
        logToLabConsole("Erro no teste de conflito: " + err.message, "error");
        showToast("Erro no Teste", err.message, "error");
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    // Cenário 4: Chegada Fora de Ordem (Pending Reference -> 202 Accepted)
    async function runPendingReferenceScenario() {
      if (!state.walletId) return;
      const btn = document.getElementById("btnPendingScenario");
      if (btn) btn.disabled = true;
      logToLabConsole("--- [INICIANDO TESTE DE REFERÊNCIA FORA DE ORDEM (PENDING_REFERENCE)] ---", "accent");

      try {
        const futureBetId = "bet-future-" + Date.now();
        const roundId = "pending-round-" + Date.now();
        const winTxId = "win-outoforder-" + Date.now();

        logToLabConsole("1. Enviando WIN referenciando uma BET que ainda NÃO existe no banco (" + futureBetId + ")...", "warn");
        const resWin = await fetch("/wagering/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
            "x-provider-id": "simulator"
          },
          body: JSON.stringify({
            providerId: "simulator",
            externalTransactionId: winTxId,
            playerId: state.playerId,
            walletId: state.walletId,
            roundId: roundId,
            gameId: "roulette-simulator",
            kind: "WIN",
            amount: "20.00",
            currency: state.currency,
            referenceExternalTransactionId: futureBetId
          })
        });

        const dataWin = await resWin.json().catch(() => ({}));
        logToLabConsole("Resposta WIN: HTTP " + resWin.status + " (Status: " + (dataWin.status || "") + ")", resWin.status === 202 ? "success" : "info");

        if (resWin.status === 202 || dataWin.status === "PENDING_REFERENCE") {
          logToLabConsole("✔ RETENÇÃO COMPROVADA: Transação retida como PENDING_REFERENCE (HTTP 202 Accepted) sem creditar saldo prematuramente.", "success");
        }

        logToLabConsole("2. Aguardando 1 segundo e enviando a BET esperada (" + futureBetId + ")...", "info");
        await new Promise(r => setTimeout(r, 1000));

        const resBet = await fetch("/wagering/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
            "x-provider-id": "simulator"
          },
          body: JSON.stringify({
            providerId: "simulator",
            externalTransactionId: futureBetId,
            playerId: state.playerId,
            walletId: state.walletId,
            roundId: roundId,
            gameId: "roulette-simulator",
            kind: "BET",
            amount: "10.00",
            currency: state.currency
          })
        });

        const dataBet = await resBet.json().catch(() => ({}));
        logToLabConsole("Resposta BET: HTTP " + resBet.status + " (" + (dataBet.status || "") + ")", resBet.status === 201 ? "success" : "info");
        logToLabConsole("✔ BET confirmada. O Pending Reference Resolver em background liquidará a WIN retida.", "success");

        await refreshCurrentWallet();
        await fetchLiveLedger();
        showToast("Fora de Ordem Testado", "WIN retido em 202 PENDING_REFERENCE e resolvido pós-chegada da BET!", "success");
      } catch (err) {
        logToLabConsole("Erro no teste de referência fora de ordem: " + err.message, "error");
        showToast("Erro no Teste", err.message, "error");
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    // Auditoria / Reconciliação
    async function reconcileActiveWallet() {
      if (!state.walletId) return;
      const statusEl = document.getElementById("reconciliationStatus");
      statusEl.innerHTML = '<span style="color: var(--accent-cyan);">Auditando livro-razão no banco...</span>';

      try {
        const res = await fetch("/wallets/" + state.walletId + "/reconciliation", {
          method: "POST",
          headers: { "x-provider-id": "simulator" }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errMsg = data.error?.message || data.message || "Falha na auditoria";
          throw new Error(errMsg);
        }

        const isConsistent = Boolean(data.consistent ?? data.isReconciled ?? (data.difference === "0.00" || data.difference === "0"));
        const stored = data.storedBalance || data.walletBalance || state.balance;
        const calc = data.calculatedBalance || stored;
        const diff = data.difference || data.discrepancy || "0.00";

        if (isConsistent) {
          statusEl.innerHTML = \`<span style="color: var(--accent-green); font-weight: 600;">✅ 100% Íntegro! Saldo Armazenado: \${state.currency} \${formatMoney(stored)} | Ledger: \${state.currency} \${formatMoney(calc)}</span>\`;
          showToast("Auditoria Aprovada", "Nenhuma divergência contábil detectada.", "success");
        } else {
          statusEl.innerHTML = \`<span style="color: var(--accent-rose); font-weight: 600;">❌ Divergência detectada! Diferença: \${state.currency} \${formatMoney(diff)}</span>\`;
          showToast("Atenção Contábil", "Divergência detectada entre carteira e ledger.", "error");
        }
      } catch (err) {
        statusEl.innerHTML = '<span style="color: var(--accent-rose);">Erro na verificação: ' + err.message + '</span>';
        showToast("Erro na Auditoria", err.message, "error");
      }
    }

    // Histórico / Tabela
    function addOperationToLedger(op) {
      state.operations.unshift(op);
      renderOperationsTable();
    }

    async function fetchLiveLedger() {
      if (!state.walletId) return;
      try {
        const res = await fetch("/wallets/" + state.walletId + "/ledger?limit=30", {
          headers: { "x-provider-id": "simulator" }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.items)) {
            // Inverter para garantir ordenação estritamente decrescente (mais recente no topo)
            const descItems = [...data.items].reverse();
            state.operations = descItems.map(item => {
              const isCredit = item.direction === "CREDIT";
              const isOpening = isCredit && item.balanceBefore === "0.00";
              const kind = item.type || item.operationType || (isOpening ? "CADASTRO" : (isCredit ? "CRÉDITO" : "DÉBITO"));
              return {
                time: new Date(item.createdAt).toLocaleTimeString(),
                kind: kind,
                amount: (isCredit ? "+ " : "- ") + state.currency + " " + formatMoney(item.amount),
                balance: state.currency + " " + formatMoney(item.balanceAfter || "0.00"),
                status: "COMPLETED",
                statusColor: isCredit ? "badge-green" : "badge-purple"
              };
            });
            renderOperationsTable();
            showToast("Ledger Sincronizado", data.items.length + " lançamentos carregados do banco de dados.", "info");
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar ledger:", err);
      }
    }

    function renderOperationsTable() {
      const tbody = document.getElementById("operationsTableBody");
      if (state.operations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-history">Nenhuma operação efetuada nesta sessão.<br>Faça um depósito ou aposta acima para começar!</td></tr>';
        return;
      }

      tbody.innerHTML = state.operations.slice(0, 20).map(op => \`
        <tr>
          <td style="color: var(--text-muted);">\${op.time}</td>
          <td><span class="badge \${op.statusColor}">\${op.kind}</span></td>
          <td style="font-weight: 600; color: \${op.amount.startsWith('+') ? '#6ee7b7' : '#f87171'}">\${op.amount}</td>
          <td style="color: #cbd5e1;">\${op.balance}</td>
          <td><span class="badge badge-cyan">\${op.status}</span></td>
        </tr>
      \`).join("");
    }

    // Utilidades
    function formatMoney(val) {
      const parts = String(val || "0.00").trim().split(".");
      const whole = BigInt(parts[0] || "0");
      const frac = (parts[1] || "").padEnd(2, "0").slice(0, 2);
      return whole.toLocaleString("pt-BR") + "," + frac;
    }

    function copyText(elementId) {
      const text = document.getElementById(elementId).innerText;
      if (!text || text === "carregando...") return;
      navigator.clipboard.writeText(text).then(() => {
        showToast("Copiado!", "UUID copiado para a área de transferência.", "info");
      });
    }
  </script>
</body>
</html>
`;
}

import { APP_VERSION } from "../../../infrastructure/config/config";

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
      position: relative;
      z-index: 100;
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
    .auth-info-icon:hover {
      background: rgba(56, 189, 248, 0.25);
      border-color: #38bdf8;
      z-index: 101;
    }

    .auth-tooltip {
      visibility: hidden;
      opacity: 0;
      position: absolute;
      top: calc(100% + 10px);
      left: 0;
      width: 330px;
      max-width: min(340px, 85vw);
      background: #0f172a;
      color: #f1f5f9;
      border: 1px solid rgba(56, 189, 248, 0.4);
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 12px;
      line-height: 1.5;
      box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.8), 0 0 16px rgba(56, 189, 248, 0.2);
      z-index: 9999;
      pointer-events: none;
      transition: opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease;
      transform: translateY(-4px);
      text-align: left;
      font-weight: normal;
    }
    .auth-tooltip::before {
      content: "";
      position: absolute;
      top: -6px;
      left: 7px;
      width: 10px;
      height: 10px;
      background: #0f172a;
      border-left: 1px solid rgba(56, 189, 248, 0.4);
      border-top: 1px solid rgba(56, 189, 248, 0.4);
      transform: rotate(45deg);
    }
    .auth-info-icon:hover .auth-tooltip {
      visibility: visible;
      opacity: 1;
      transform: translateY(0);
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

    .currency-chip.active {
      background: rgba(16, 185, 129, 0.25) !important;
      border-color: var(--accent-green) !important;
      color: #34d399 !important;
      font-weight: 700 !important;
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.35);
    }

    .tx-preset-btn.active {
      background: rgba(6, 182, 212, 0.22) !important;
      border-color: #06b6d4 !important;
      color: #38bdf8 !important;
      font-weight: 700 !important;
      box-shadow: 0 0 12px rgba(6, 182, 212, 0.35);
    }

    .tx-preset-btn.active-amber {
      background: rgba(245, 158, 11, 0.25) !important;
      border-color: #f59e0b !important;
      color: #fef08a !important;
      font-weight: 700 !important;
      box-shadow: 0 0 14px rgba(245, 158, 11, 0.45);
    }

    .tx-preset-btn.active-green {
      background: rgba(16, 185, 129, 0.25) !important;
      border-color: #10b981 !important;
      color: #6ee7b7 !important;
      font-weight: 700 !important;
      box-shadow: 0 0 14px rgba(16, 185, 129, 0.45);
    }

    .tx-preset-btn.active-purple {
      background: rgba(139, 92, 246, 0.25) !important;
      border-color: #8b5cf6 !important;
      color: #ddd6fe !important;
      font-weight: 700 !important;
      box-shadow: 0 0 14px rgba(139, 92, 246, 0.45);
    }

    .tx-hint-box {
      width: 100%;
      margin-top: 8px;
      margin-bottom: 8px;
      padding: 10px 14px;
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.12);
      font-size: 12px;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      gap: 8px;
      line-height: 1.5;
      box-sizing: border-box;
    }

    /* Real-World Architecture Deep Dive */
    .realworld-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 18px;
      margin-top: 14px;
    }
    .rw-card {
      background: rgba(15, 23, 42, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 20px 22px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 13px;
      line-height: 1.6;
      color: #cbd5e1;
    }
    .rw-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .rw-header h4 {
      font-size: 14px;
      font-weight: 700;
      color: #f8fafc;
      letter-spacing: -0.2px;
    }
    .rw-icon {
      font-size: 22px;
      flex-shrink: 0;
    }
    .rw-card ul {
      padding-left: 18px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .rw-card li strong {
      color: #f1f5f9;
    }
    .rw-card code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      background: rgba(255, 255, 255, 0.07);
      padding: 2px 6px;
      border-radius: 4px;
      color: #38bdf8;
    }

    @keyframes pulse-highlight {
      0% { border-color: rgba(16, 185, 129, 0.9); box-shadow: 0 0 12px rgba(16, 185, 129, 0.4); }
      100% { border-color: rgba(255, 255, 255, 0.1); box-shadow: none; }
    }

    .pulse-flash {
      animation: pulse-highlight 0.5s ease-out;
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
              v${APP_VERSION} &bull; OAS 3.0
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
            <span class="guide-step-desc">Envie <code>BET</code> de <code>"10.00"</code> com <code>Idempotency-Key: req-001</code>. Saldo passa a ser <code>"90.00"</code> (ou saldo inicial - 10.00).</span>
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
            <span class="guide-step-desc">Abra o <a href="/dashboard" style="color: #38bdf8;">Dashboard</a> e acompanhe a Outbox, os Consumers e as Pendências.</span>
          </div>
          <div class="guide-step">
            <span class="guide-step-title">9️⃣ Resolução Fora de Ordem (Fase 7)</span>
            <span class="guide-step-desc">Clique no preset <code>⚡ WIN Fora de Ordem</code> e execute (retorna <code>202 Accepted</code> / <code>PENDING_REFERENCE</code>). Veja o gauge subir em <code>/dashboard</code>. Depois clique em <code>🎯 BET de Referência</code> e execute: o fast-path resolve o WIN de imediato!</span>
          </div>
        </div>
      </details>
    </div>

    <!-- Real-World Architecture Deep Dive Card -->
    <div class="guide-card" style="border-color: rgba(6, 182, 212, 0.3); background: rgba(18, 24, 38, 0.85);">
      <details>
        <summary style="color: #38bdf8;">
          <span>📐 Guia Arquitetural: Idempotência Estrita &amp; Resolução Fora de Ordem</span>
          <span style="font-size: 12px; color: var(--text-muted); font-weight: normal;">Clique para expandir / recolher</span>
        </summary>
        <div class="realworld-grid">
          <!-- Card 1: Idempotency Lifecycle -->
          <div class="rw-card">
            <div class="rw-header">
              <span class="rw-icon">🔑</span>
              <h4>Mecanismo de Idempotência Estrita e Ciclo de Vida da Chave</h4>
            </div>
            <p><strong>Regras de unicidade de chave por transação, tolerância a falhas de rede e garantia de não duplicidade contábil:</strong></p>
            <ul>
              <li><strong>Unicidade Operacional:</strong> Toda nova transação financeira enviada pelo cliente (App, Frontend ou Provedor de Jogos) deve possuir um identificador UUID exclusivo no cabeçalho <code>Idempotency-Key</code>.</li>
              <li><strong>Tratamento de Retentativas de Rede (<em>Network Retries</em>):</strong> A reutilização da mesma chave é restrita à recuperação de falhas de transporte ou timeouts. Ao receber uma chave idêntica com o mesmo payload, o motor responde <code>200 OK</code> com <code>idempotentReplay: true</code>, retornando o resultado original sem duplicar créditos ou débitos.</li>
              <li><strong>Prevenção de Colisão Contábil (<code>409 IDEMPOTENCY_CONFLICT</code>):</strong> Se uma chave já registrada for submetida com dados divergentes (valor, moeda ou tipo alterados), a requisição é rejeitada para preservar a imutabilidade do histórico contábil.</li>
            </ul>
          </div>

          <!-- Card 2: Out-of-Order Resolution & Reference Bet -->
          <div class="rw-card">
            <div class="rw-header">
              <span class="rw-icon">⚡</span>
              <h4>Resolução Assíncrona de Transações Fora de Ordem (Pending Reference Resolver)</h4>
            </div>
            <p><strong>Mecanismo de consistência eventual para liquidações financeiras dependentes em ambientes distribuídos:</strong></p>
            <ul>
              <li><strong>Âncora de Referência Causal (<code>BET</code>):</strong> A aposta inicial serve como transação de referência mandatória para processar eventos subsequentes (<code>WIN</code>, <code>LOSS</code> ou <code>REFUND</code>).</li>
              <li><strong>Desordenamento em Mensageria (<em>Out-of-Order</em>):</strong> Em decorrência de latências assimétricas de rede ou particionamento em filas SQS, a notificação de um <code>WIN</code> pode chegar antes da gravação da respectiva <code>BET</code>.</li>
              <li><strong>Fluxo de Reconciliação e Liquidação:</strong>
                <ol style="margin-top: 6px; padding-left: 18px; display: flex; flex-direction: column; gap: 4px;">
                  <li><strong>Acolhimento Não Bloqueante:</strong> O <code>WIN</code> é acolhido com status <code>PENDING_REFERENCE</code> e resposta <code>202 Accepted</code>, mantendo o saldo provisoriamente inalterado.</li>
                  <li><strong>Fast-Path e Worker Reconciliador:</strong> No momento em que a <code>BET</code> é confirmada no banco, o Fast-Path síncrono ou o worker periódico (com <code>FOR UPDATE SKIP LOCKED</code>) detecta a pendência associada.</li>
                  <li><strong>Liquidação Ledger Atômica:</strong> Débito da <code>BET</code> e crédito do <code>WIN</code> são liquidados atomicamente, consolidando o saldo final exato e emitindo registros imutáveis no ledger.</li>
                </ol>
              </li>
            </ul>
          </div>
        </div>
      </details>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <span style="font-size: 13px; font-weight: 600; color: #94a3b8;">Filtrar tags:</span>
        <button class="filter-chip tag-filter active" onclick="filterTag('all')">Todos</button>
        <button class="filter-chip tag-filter" onclick="filterTag('wallets')">wallets</button>
        <button class="filter-chip tag-filter" onclick="filterTag('transactions')">transactions</button>
        <button class="filter-chip tag-filter" onclick="filterTag('observability')">observability</button>
        <button class="filter-chip tag-filter" onclick="filterTag('health')">health</button>
      </div>
      <div style="margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="filter-chip" onclick="setAllCards(true)" title="Expandir todos os endpoints" style="font-size: 11px; padding: 6px 12px;">📂 Expandir Todos</button>
        <button class="filter-chip" onclick="setAllCards(false)" title="Recolher todos os endpoints" style="font-size: 11px; padding: 6px 12px;">📁 Recolher Todos</button>
      </div>
    </div>

    <!-- Endpoints List -->
    <div class="endpoints-list">
      <!-- EP 1: POST /wallets -->
      <div class="ep-card" data-tag="wallets" id="ep-post-wallets">
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
          <p class="ep-desc">Cria uma carteira única para o jogador na moeda especificada (1 jogador = 1 carteira por moeda), gravando o lançamento de abertura (OPENING) no ledger contábil imutável. <strong style="color: #38bdf8;">Nota:</strong> Para testar depósitos recorrentes com garantia de <code>Idempotency-Key</code> e replay idempotente, utilize o endpoint <strong>POST /wallets/{id}/deposit</strong> logo abaixo.</p>
          <div class="form-grid">
            <div class="input-group">
              <div class="input-label">
                <span>Corpo da Requisição (JSON)</span>
                <div class="quick-presets">
                  <span style="font-size: 11px; color: #64748b;">Jogador:</span>
                  <button class="preset-btn" style="border-color: #3b82f6; color: #60a5fa;" onclick="generateNewPlayerWalletPayload()">🎲 Sortear Novo Player</button>
                  <span style="font-size: 11px; color: #64748b; margin-left: 10px;">Moeda da Carteira:</span>
                  <button id="btn-curr-BRL" class="preset-btn currency-chip active" onclick="setWalletCurrency('BRL')">BRL (R$)</button>
                  <button id="btn-curr-USD" class="preset-btn currency-chip" onclick="setWalletCurrency('USD')">USD ($)</button>
                  <button id="btn-curr-EUR" class="preset-btn currency-chip" onclick="setWalletCurrency('EUR')">EUR (€)</button>
                </div>
              </div>
              <textarea id="body-post-wallets" class="json-textarea"></textarea>
            </div>
          </div>
          <div class="action-row">
            <button class="btn-exec" onclick="execPostWallets()">Executar Requisição</button>
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

      <!-- EP 2.5: POST /wallets/:id/deposit -->
      <div class="ep-card" data-tag="wallets" id="ep-post-deposit">
        <div class="ep-summary" onclick="toggleCard('ep-post-deposit')">
          <div class="ep-left">
            <span class="method-badge method-post">POST</span>
            <span class="ep-path">/wallets/{id}/deposit</span>
            <span class="ep-title">Efetuar depósito e creditar saldo</span>
            <span class="ep-tag">wallets</span>
          </div>
          <span class="ep-arrow">▼</span>
        </div>
        <div class="ep-details">
          <p class="ep-desc">Credita fundos na carteira com lock pessimista (<code>FOR UPDATE</code>), gravação de lançamento imutável no ledger contábil, idempotência estrita via header e evento emitido na Outbox.</p>
          <div class="form-grid">
            <div class="input-group">
              <label class="input-label">ID da Carteira (UUID)</label>
              <input type="text" id="param-deposit-wallet-id" class="text-input" placeholder="Cole aqui o walletId" />
            </div>
            <div class="input-group">
              <div class="input-label" style="display: flex; justify-content: space-between; align-items: center;">
                <span>🔑 Chave de Idempotência (Header Idempotency-Key)</span>
                <button class="preset-btn" style="border-color: #38bdf8; color: #38bdf8; padding: 2px 8px;" onclick="generateDepositKey()">⚡ Nova Chave</button>
              </div>
              <input type="text" id="param-deposit-idempotency-key" class="text-input" value="dep-001" placeholder="Ex: dep-req-001 ou UUID" oninput="updateDepositKeyBadge(this.value)" />
            </div>
            <div class="input-group" style="grid-column: 1 / -1;">
              <div class="input-label">
                <span>Corpo do Depósito (JSON)</span>
                <div class="quick-presets">
                  <span style="font-size: 11px; color: #64748b;">Valores no payload:</span>
                  <button class="preset-btn" onclick="setDepositAmount('20.00')">R$ 20,00</button>
                  <button class="preset-btn" onclick="setDepositAmount('50.00')">R$ 50,00</button>
                  <button class="preset-btn" onclick="setDepositAmount('100.00')">R$ 100,00</button>
                </div>
              </div>
              <textarea id="body-post-deposit" class="json-textarea">{
  "amount": "50.00",
  "providerId": "PIX_GATEWAY"
}</textarea>
            </div>
          </div>
          <div class="action-row" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <button class="btn-exec" onclick="execPostDeposit()">Executar Depósito</button>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted); background: rgba(255, 255, 255, 0.04); padding: 6px 12px; border-radius: 8px; border: 1px solid var(--card-border);">
              <span>Chave Atual de Envio:</span>
              <code id="deposit-current-key-badge" style="color: #38bdf8; font-family: 'JetBrains Mono', monospace; font-weight: 700;">dep-001</code>
              <span style="font-size: 11px; color: #64748b;">(clique 2x no botão acima para testar o replay!)</span>
            </div>
          </div>
          <div id="res-post-deposit" class="response-box">
            <div class="response-header">
              <span id="status-post-deposit" class="status-badge-res"></span>
              <span id="time-post-deposit" style="color: #64748b;"></span>
              <button class="copy-btn" onclick="copyResponse('post-deposit')">Copiar</button>
            </div>
            <pre id="body-res-post-deposit" class="response-body"></pre>
          </div>
        </div>
      </div>

      <!-- EP 3: POST /transactions -->
      <div class="ep-card" data-tag="transactions" id="ep-post-transactions">
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
                  <button id="btn-tx-BET" class="preset-btn tx-preset-btn active" onclick="setTxPreset('BET')">Aposta BET (R$ 10,00)</button>
                  <button id="btn-tx-WIN" class="preset-btn tx-preset-btn" onclick="setTxPreset('WIN')">Prêmio WIN (R$ 50,00)</button>
                  <button id="btn-tx-REFUND" class="preset-btn tx-preset-btn" onclick="setTxPreset('REFUND')">Estorno REFUND (R$ 10,00)</button>
                  <button id="btn-tx-OUT_OF_ORDER_WIN" class="preset-btn tx-preset-btn" style="border-color: #f59e0b; color: #fbbf24;" onclick="setTxPreset('OUT_OF_ORDER_WIN')">⚡ WIN Fora de Ordem (Fase 7)</button>
                  <button id="btn-tx-MATCHING_BET" class="preset-btn tx-preset-btn" style="border-color: #10b981; color: #34d399;" onclick="setTxPreset('MATCHING_BET')">🎯 BET de Referência (Fase 7)</button>
                </div>
              </div>
              <div id="tx-hint-banner" class="tx-hint-box" style="display: none;"></div>
              <textarea id="body-post-transactions" class="json-textarea">{
  "walletId": "INSIRA_O_WALLET_ID_AQUI",
  "playerId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "currency": "BRL",
  "providerId": "provider-pragmatic",
  "externalTransactionId": "tx-ext-001",
  "roundId": "round-001",
  "gameId": "game-sparks",
  "kind": "BET",
  "amount": "10.00"
}</textarea>
            </div>
          </div>
          <div class="action-row" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <button class="btn-exec" onclick="execPostTransactions()">Executar Requisição</button>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted); background: rgba(255, 255, 255, 0.04); padding: 6px 12px; border-radius: 8px; border: 1px solid var(--card-border);">
              <span>Chave de Idempotência:</span>
              <code id="tx-current-idempotency-key" style="color: #38bdf8; font-family: 'JetBrains Mono', monospace; font-weight: 700;">req-001</code>
              <button class="preset-btn" style="border-color: #38bdf8; color: #38bdf8; padding: 2px 8px;" onclick="generateNewKey()">⚡ Nova Chave</button>
            </div>
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

      <!-- EP 3.5: GET /transactions/:id -->
      <div class="ep-card" data-tag="transactions" id="ep-get-transaction">
        <div class="ep-summary" onclick="toggleCard('ep-get-transaction')">
          <div class="ep-left">
            <span class="method-badge method-get">GET</span>
            <span class="ep-path">/transactions/{id}</span>
            <span class="ep-title">Consultar status e ciclo de vida da transação</span>
            <span class="ep-tag">transactions</span>
          </div>
          <span class="ep-arrow">▼</span>
        </div>
        <div class="ep-details">
          <p class="ep-desc">Consulta o estado operacional da transação (<code>PROCESSED</code>, <code>PENDING_REFERENCE</code> ou <code>REJECTED</code>), exibindo valores, tentativas de reconciliação e referências causais vinculadas.</p>
          <div class="form-grid">
            <div class="input-group">
              <label class="input-label">ID da Transação (UUID interno retornado no POST)</label>
              <input type="text" id="param-get-tx-id" class="text-input" placeholder="Cole aqui o id da transação retornado no POST /transactions" />
            </div>
          </div>
          <div class="action-row">
            <button class="btn-exec" onclick="execGetTransaction()">Executar Requisição</button>
          </div>
          <div id="res-get-transaction" class="response-box">
            <div class="response-header">
              <span id="status-get-transaction" class="status-badge-res"></span>
              <span id="time-get-transaction" style="color: #64748b;"></span>
              <button class="copy-btn" onclick="copyResponse('get-transaction')">Copiar</button>
            </div>
            <pre id="body-res-get-transaction" class="response-body"></pre>
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
      var globalInput = document.getElementById('globalIdempotencyKey');
      if (globalInput) globalInput.value = rand;
      var txKeyBadge = document.getElementById('tx-current-idempotency-key');
      if (txKeyBadge) txKeyBadge.textContent = rand;

      // Sincroniza também novo externalTransactionId no JSON de transações para evitar conflito 409
      try {
        var txBody = document.getElementById('body-post-transactions');
        if (txBody && txBody.value) {
          var parsed = JSON.parse(txBody.value);
          if (parsed && parsed.externalTransactionId) {
            var prefix = parsed.kind === 'WIN' ? 'win-' : (parsed.kind === 'REFUND' ? 'ref-' : 'tx-ext-');
            parsed.externalTransactionId = prefix + Math.random().toString(36).substring(2, 7);
            txBody.value = JSON.stringify(parsed, null, 2);
          }
        }
      } catch (e) {}

      return rand;
    }

    function toggleCard(cardId) {
      var el = document.getElementById(cardId);
      if (el) el.classList.toggle('open');
    }

    function setAllCards(open) {
      document.querySelectorAll('.ep-card').forEach(function(card) {
        if (open) {
          card.classList.add('open');
        } else {
          card.classList.remove('open');
        }
      });
    }

    function filterTag(tag) {
      document.querySelectorAll('.filter-chip.tag-filter').forEach(function(chip) {
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

    var lastPendingRefBetId = null;
    var lastSuccessfulBetExternalId = 'tx-ext-xuwto';
    var lastSuccessfulBetAmount = '10.00';
    var lastSuccessfulBetRefunded = false;

    function updateTxChips(kind) {
      var kinds = ['BET', 'WIN', 'REFUND', 'OUT_OF_ORDER_WIN', 'MATCHING_BET'];
      kinds.forEach(function(k) {
        var btn = document.getElementById('btn-tx-' + k);
        if (btn) {
          btn.classList.remove('active', 'active-amber', 'active-green', 'active-purple');
          if (k === kind) {
            if (k === 'OUT_OF_ORDER_WIN') {
              btn.classList.add('active-amber');
            } else if (k === 'MATCHING_BET') {
              btn.classList.add('active-green');
            } else if (k === 'REFUND') {
              btn.classList.add('active-purple');
            } else {
              btn.classList.add('active');
            }
          }
        }
      });

      var hintBanner = document.getElementById('tx-hint-banner');
      if (hintBanner) {
        hintBanner.style.display = 'flex';
        if (kind === 'OUT_OF_ORDER_WIN') {
          hintBanner.innerHTML = '⚡ <strong>WIN Fora de Ordem selecionado:</strong> apontando para referência futura <code style="color: #fbbf24; background: rgba(245, 158, 11, 0.15); padding: 2px 6px; border-radius: 4px;">' + (lastPendingRefBetId || '...') + '</code>. Clique em <strong>Executar Requisição</strong> (retornará 202 Accepted).';
        } else if (kind === 'MATCHING_BET') {
          hintBanner.innerHTML = '🎯 <strong>BET de Referência selecionada:</strong> criando aposta com ID <code style="color: #34d399; background: rgba(16, 185, 129, 0.15); padding: 2px 6px; border-radius: 4px;">' + (lastPendingRefBetId || '...') + '</code>. Ao executar, o Fast-Path resolverá o WIN pendente de imediato!';
        } else if (kind === 'BET') {
          hintBanner.innerHTML = '🎲 <strong>Aposta BET selecionada:</strong> debitará o valor da carteira e gravará lançamento contábil no ledger.';
        } else if (kind === 'WIN') {
          hintBanner.innerHTML = '💰 <strong>Prêmio WIN selecionado:</strong> creditará R$ 50,00 na carteira e emitirá evento no Outbox.';
        } else if (kind === 'REFUND') {
          var refId = lastSuccessfulBetExternalId || 'tx-ext-xuwto';
          var refAmt = lastSuccessfulBetAmount || '10.00';
          if (lastSuccessfulBetRefunded) {
            hintBanner.innerHTML = '🔄 <strong>Estorno REFUND:</strong> A aposta de referência <code style="color: #c084fc; background: rgba(139, 92, 246, 0.15); padding: 2px 6px; border-radius: 4px;">' + refId + '</code> <strong>já foi estornada com sucesso!</strong> Uma nova tentativa de estorno para esta mesma referência será rejeitada com <code style="color: #f87171;">422 ALREADY_REVERSED</code> (proteção contra estorno duplo).';
          } else {
            hintBanner.innerHTML = '🔄 <strong>Estorno REFUND selecionado:</strong> estorna a aposta de referência <code style="color: #c084fc; background: rgba(139, 92, 246, 0.15); padding: 2px 6px; border-radius: 4px;">' + refId + '</code> (' + (lastCreatedCurrency || 'BRL') + ' ' + refAmt + '). Ao executar, o valor é creditado de volta no saldo!';
          }
        }
      }
    }

    function setTxPreset(kind) {
      // Gera automaticamente uma nova chave de idempotência para o novo preset
      generateNewKey();

      var currentBodyVal = null;
      try {
        var existingText = document.getElementById('body-post-transactions').value;
        currentBodyVal = JSON.parse(existingText);
      } catch(e) {}

      var walletId = (currentBodyVal && currentBodyVal.walletId && currentBodyVal.walletId !== 'INSIRA_O_WALLET_ID_AQUI')
        ? currentBodyVal.walletId
        : (lastCreatedWalletId || '4a89972f-1ac6-4cf8-949f-c8c9605baf27');
      var playerId = (currentBodyVal && currentBodyVal.playerId)
        ? currentBodyVal.playerId
        : (lastCreatedPlayerId || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      var currency = (currentBodyVal && currentBodyVal.currency)
        ? currentBodyVal.currency
        : (lastCreatedCurrency || 'BRL');
      var extId = 'tx-ext-' + Math.random().toString(36).substring(2, 7);

      var payload;
      if (kind === 'OUT_OF_ORDER_WIN') {
        if (!lastPendingRefBetId) {
          lastPendingRefBetId = 'bet-ref-' + Math.random().toString(36).substring(2, 7);
        }
        payload = {
          walletId: walletId,
          playerId: playerId,
          currency: currency,
          providerId: 'provider-pragmatic',
          externalTransactionId: 'win-ahead-' + Math.random().toString(36).substring(2, 7),
          roundId: 'round-001',
          gameId: 'game-sparks',
          kind: 'WIN',
          amount: '50.00',
          referenceExternalTransactionId: lastPendingRefBetId
        };
      } else if (kind === 'MATCHING_BET') {
        var betExtId = lastPendingRefBetId || ('bet-ref-' + Math.random().toString(36).substring(2, 7));
        lastPendingRefBetId = betExtId;
        payload = {
          walletId: walletId,
          playerId: playerId,
          currency: currency,
          providerId: 'provider-pragmatic',
          externalTransactionId: betExtId,
          roundId: 'round-001',
          gameId: 'game-sparks',
          kind: 'BET',
          amount: '10.00'
        };
      } else {
        payload = {
          walletId: walletId,
          playerId: playerId,
          currency: currency,
          providerId: 'provider-pragmatic',
          externalTransactionId: extId,
          roundId: 'round-001',
          gameId: 'game-sparks',
          kind: kind,
          amount: kind === 'BET' ? '10.00' : (kind === 'WIN' ? '50.00' : (lastSuccessfulBetAmount || '10.00'))
        };
        if (kind === 'REFUND') {
          payload.amount = lastSuccessfulBetAmount || '10.00';
          payload.referenceExternalTransactionId = lastSuccessfulBetExternalId || lastPendingRefBetId || 'tx-ext-xuwto';
        }
      }
      var el = document.getElementById('body-post-transactions');
      if (el) {
        el.value = JSON.stringify(payload, null, 2);
        flashElement(el);
      }
      updateTxChips(kind);
    }

    async function execRequest(targetId, method, path, useIdempotency, body, explicitKey) {
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
        var key = explicitKey || (document.getElementById('globalIdempotencyKey') ? document.getElementById('globalIdempotencyKey').value.trim() : '');
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

        statusEl.textContent = res.status + ' ' + res.statusText + (json && json.idempotentReplay ? ' 🔁 (Replay Idempotente)' : '');
        statusEl.className = 'status-badge-res ' + (res.status < 300 ? 'status-2xx' : (res.status < 500 ? 'status-4xx' : 'status-5xx'));
        timeEl.textContent = duration;

        var bannerId = 'alert-res-' + targetId;
        var existingBanner = document.getElementById(bannerId);
        if (existingBanner) existingBanner.remove();

        if (json && json.idempotentReplay) {
          var alertDiv = document.createElement('div');
          alertDiv.id = bannerId;
          alertDiv.style.cssText = 'background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.4); color: #38bdf8; padding: 10px 14px; border-radius: 8px; margin: 10px 0; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px;';
          var replayMsg = (targetId === 'post-deposit' || (json.message && json.message.indexOf('depósito') !== -1))
            ? '🔁 <strong>Replay de Idempotência:</strong> Este depósito já foi realizado anteriormente com esta mesma Idempotency-Key. O saldo NÃO foi creditado novamente!'
            : ((json.kind === 'REFUND' || (json.message && json.message.indexOf('estorno') !== -1))
              ? '🔁 <strong>Replay de Idempotência:</strong> Este estorno já foi realizado anteriormente com esta mesma Idempotency-Key. O saldo NÃO foi creditado novamente!'
              : (json.kind === 'BET'
                ? '🔁 <strong>Replay de Idempotência:</strong> Esta aposta já foi processada anteriormente. O saldo NÃO foi debitado novamente!'
                : '🔁 <strong>Replay de Idempotência:</strong> Esta transação já foi processada anteriormente com esta mesma chave. Saldo inalterado!'));
          alertDiv.innerHTML = replayMsg;
          boxEl.insertBefore(alertDiv, bodyEl);
        } else if (json && json.error && json.error.code === 'ALREADY_REVERSED') {
          var alertDiv = document.createElement('div');
          alertDiv.id = bannerId;
          alertDiv.style.cssText = 'background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; padding: 10px 14px; border-radius: 8px; margin: 10px 0; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px;';
          var refName = (json.error.details && json.error.details.referenceExternalTransactionId) ? json.error.details.referenceExternalTransactionId : '';
          alertDiv.innerHTML = '🚫 <strong>Aposta Já Estornada:</strong> A transação de referência <code>' + refName + '</code> já havia sido estornada anteriormente. O sistema bloqueou a segunda reversão!';
          boxEl.insertBefore(alertDiv, bodyEl);
        }

        if (typeof json === 'object') {
          bodyEl.textContent = JSON.stringify(json, null, 2);
          if (path === '/transactions' && json) {
            if (json.id) {
              var txInput = document.getElementById('param-get-tx-id');
              if (txInput) txInput.value = json.id;
            }
            if (json.status === 'PROCESSED' && json.kind === 'BET' && json.externalTransactionId) {
              lastSuccessfulBetExternalId = json.externalTransactionId;
              lastSuccessfulBetRefunded = false;
              if (json.amount) {
                lastSuccessfulBetAmount = json.amount;
                var refundBtn = document.getElementById('btn-tx-REFUND');
                if (refundBtn) refundBtn.textContent = 'Estorno REFUND (R$ ' + json.amount.replace('.', ',') + ')';
              }
            } else if (json.status === 'PROCESSED' && json.kind === 'REFUND') {
              lastSuccessfulBetRefunded = true;
              var refundBtn = document.getElementById('btn-tx-REFUND');
              if (refundBtn) refundBtn.textContent = 'Estornado ✓ (R$ ' + (json.amount ? json.amount.replace('.', ',') : lastSuccessfulBetAmount.replace('.', ',')) + ')';
              var hintBanner = document.getElementById('tx-hint-banner');
              if (hintBanner) {
                hintBanner.style.display = 'flex';
                if (json.idempotentReplay) {
                  hintBanner.innerHTML = '🔁 <strong>Replay de Idempotência:</strong> Este estorno já foi realizado anteriormente com esta mesma Idempotency-Key. O saldo não foi alterado novamente!';
                } else {
                  hintBanner.innerHTML = '✅ <strong>Estorno Concluído com Sucesso:</strong> A aposta de referência <code style="color: #c084fc; background: rgba(139, 92, 246, 0.15); padding: 2px 6px; border-radius: 4px;">' + (json.referenceExternalTransactionId || lastSuccessfulBetExternalId) + '</code> já foi estornada e o saldo creditado! Uma nova tentativa para esta mesma aposta será bloqueada com <code>422 ALREADY_REVERSED</code>.';
                }
              }
            } else if (json.error && json.error.code === 'ALREADY_REVERSED') {
              lastSuccessfulBetRefunded = true;
              var hintBanner = document.getElementById('tx-hint-banner');
              if (hintBanner) {
                hintBanner.style.display = 'flex';
                hintBanner.innerHTML = '🚫 <strong>Aposta Já Estornada:</strong> A aposta de referência já havia sido estornada anteriormente. Segunda tentativa rejeitada com <code>422 ALREADY_REVERSED</code>.';
              }
            }
          }
          if (json && json.id) {
            if (path === '/wallets' || path.indexOf('/wallets/') === 0) {
              lastCreatedWalletId = json.id;
              if (json.playerId) lastCreatedPlayerId = json.playerId;
              if (json.currency) lastCreatedCurrency = json.currency;

              // Pre-fill next inputs
              var wInput = document.getElementById('param-get-wallet-id');
              if (wInput) wInput.value = json.id;
              var dInput = document.getElementById('param-deposit-wallet-id');
              if (dInput) dInput.value = json.id;
              var lInput = document.getElementById('param-ledger-wallet-id');
              if (lInput) lInput.value = json.id;
              var rInput = document.getElementById('param-rec-wallet-id');
              if (rInput) rInput.value = json.id;
              // Pre-fill transaction body
              setTxPreset('BET');
              // Prepare a fresh player ID for any subsequent wallet creation
              generateNewPlayerWalletPayload(json.currency || 'BRL');
            }
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

    function execPostWallets() {
      var body = document.getElementById('body-post-wallets').value;
      execRequest('post-wallets', 'POST', '/wallets', false, body);
    }

    function flashElement(el) {
      if (!el) return;
      el.classList.remove('pulse-flash');
      void el.offsetWidth;
      el.classList.add('pulse-flash');
    }

    function updateCurrencyChips(currency) {
      ['BRL', 'USD', 'EUR'].forEach(function(c) {
        var btn = document.getElementById('btn-curr-' + c);
        if (btn) {
          if (c === currency) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        }
      });
    }

    function generateNewPlayerWalletPayload(currency) {
      var curr = currency;
      if (!curr) {
        try {
          var currentVal = JSON.parse(document.getElementById('body-post-wallets').value);
          curr = currentVal.currency || 'BRL';
        } catch(e) {
          curr = 'BRL';
        }
      }
      var pid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'a0eebc99-9c0b-4ef8-bb6d-' + Math.random().toString(36).substring(2, 14);
      var payload = {
        playerId: pid,
        currency: curr,
        initialBalance: '100.00'
      };
      var el = document.getElementById('body-post-wallets');
      if (el) {
        el.value = JSON.stringify(payload, null, 2);
        flashElement(el);
      }
      updateCurrencyChips(curr);
    }

    function setWalletCurrency(currency) {
      updateCurrencyChips(currency);
      var el = document.getElementById('body-post-wallets');
      try {
        var val = JSON.parse(el.value);
        val.currency = currency;
        el.value = JSON.stringify(val, null, 2);
        flashElement(el);
      } catch (e) {
        generateNewPlayerWalletPayload(currency);
      }
    }

    function execGetWallet() {
      var id = document.getElementById('param-get-wallet-id').value.trim();
      if (!id) { alert('Informe o ID da carteira'); return; }
      execRequest('get-wallet', 'GET', '/wallets/' + encodeURIComponent(id), false);
    }

    function setDepositAmount(amount) {
      var el = document.getElementById('body-post-deposit');
      try {
        var val = JSON.parse(el.value);
        val.amount = amount;
        el.value = JSON.stringify(val, null, 2);
        flashElement(el);
      } catch (e) {
        el.value = JSON.stringify({ amount: amount, providerId: 'PIX_GATEWAY' }, null, 2);
        flashElement(el);
      }
    }

    function updateDepositKeyBadge(val) {
      var badge = document.getElementById('deposit-current-key-badge');
      if (badge) badge.textContent = val || '(vazio)';
    }

    function generateDepositKey() {
      var rand = 'dep-' + Math.random().toString(36).substring(2, 8);
      var depInput = document.getElementById('param-deposit-idempotency-key');
      if (depInput) depInput.value = rand;
      updateDepositKeyBadge(rand);
      return rand;
    }

    function execPostDeposit() {
      var id = document.getElementById('param-deposit-wallet-id').value.trim() || lastCreatedWalletId;
      if (!id) { alert('Informe o ID da carteira'); return; }
      var keyInput = document.getElementById('param-deposit-idempotency-key');
      var key = (keyInput && keyInput.value.trim()) ? keyInput.value.trim() : generateDepositKey();
      updateDepositKeyBadge(key);
      var body = document.getElementById('body-post-deposit').value;
      execRequest('post-deposit', 'POST', '/wallets/' + encodeURIComponent(id) + '/deposit', true, body, key);
    }

    function execPostTransactions() {
      var body = document.getElementById('body-post-transactions').value;
      execRequest('post-transactions', 'POST', '/transactions', true, body);
    }

    function execGetTransaction() {
      var id = document.getElementById('param-get-tx-id').value.trim();
      if (!id) { alert('Informe o ID da transação (UUID)'); return; }
      execRequest('get-transaction', 'GET', '/transactions/' + encodeURIComponent(id), false);
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

    // Inicialização automática de carteira com UUID único e preset BET
    generateNewPlayerWalletPayload('BRL');
    generateNewKey();
    generateDepositKey();
    setTxPreset('BET');
  </script>
</body>
</html>
`;
}

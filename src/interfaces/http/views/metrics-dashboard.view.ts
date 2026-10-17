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
      Jungle Gaming Technical Test • Distributed Wagering Processor • Fase 6: SQS Consumer & Inbox Pattern (v0.6.0)
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
            type: item.labels?.event_type || 'Desconhecido',
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
            type: 'Wager Transaction (' + (item.labels?.status || 'processed') + ')',
            queue: 'wager-transactions.fifo',
            count: item.value,
            category: 'CONSUMED',
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

      // 5. Detalhamento na Tabela
      const tbody = document.getElementById('events-tbody');
      if (eventRows.length === 0) {
        tbody.innerHTML = \`
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
              Nenhum evento financeiro gerado ou consumido ainda. Submeta uma aposta no Swagger ou na fila SQS!
            </td>
          </tr>
        \`;
      } else {
        tbody.innerHTML = eventRows.map(ev => {
          let chipClass = 'chip-purple';
          if (ev.type.includes('Balance')) chipClass = 'chip-blue';
          if (ev.type.includes('Processed') || ev.type.includes('success')) chipClass = 'chip-green';
          if (ev.type.includes('Rejected') || ev.type.includes('rejection')) chipClass = 'chip-amber';
          if (ev.type.includes('poison') || ev.type.includes('error')) chipClass = 'chip-rose';

          return \`
            <tr>
              <td>
                <span class="event-chip \${chipClass}">
                  <span>⚡</span> \${ev.type}
                </span>
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
                <span class="badge-live" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.2); color: #34d399;">
                  PROCESSED
                </span>
              </td>
            </tr>
          \`;
        }).join('');
      }

      // Horário da leitura
      document.getElementById('last-update').textContent = new Date().toLocaleTimeString('pt-BR');
    }

    // Inicia polling
    fetchMetrics();
    requestAnimationFrame(updateProgressBar);
  </script>
</body>
</html>
`;
}

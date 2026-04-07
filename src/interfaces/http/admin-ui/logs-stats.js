/**
 * 日志聚合统计视图
 * 依赖 logs.js 提供的全局变量：viewState, api, escapeHtml
 * 在 logs.js 之前加载；仅定义函数，不立即执行。
 * 函数体内的全局变量引用在调用时解析，此时 logs.js 已完成初始化。
 */

function switchLogView(targetView) {
  viewState.currentView = targetView;
  const listPanel = document.querySelector('.log-list-panel');
  const statsPanel = document.querySelector('.log-stats-panel');
  const btns = document.querySelectorAll('.log-view-btn');
  btns.forEach((btn) => {
    const v = btn.getAttribute('data-log-view');
    if (v === targetView) {
      btn.style.background = '#007AFF';
      btn.style.color = '#fff';
      btn.classList.add('active');
    } else {
      btn.style.background = '#fff';
      btn.style.color = '#333';
      btn.classList.remove('active');
    }
  });
  if (listPanel) listPanel.style.display = targetView === 'list' ? '' : 'none';
  if (statsPanel) statsPanel.style.display = targetView === 'stats' ? '' : 'none';
  if (targetView === 'stats') loadLogStats();
}

function bindViewToggle() {
  const btns = document.querySelectorAll('.log-view-btn');
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-log-view');
      if (target) switchLogView(target);
    });
  });
}

async function loadLogStats() {
  const container = document.getElementById('logStatsContent');
  if (!container) return;
  container.textContent = '加载中...';
  try {
    const data = await api(`/api/admin/analytics/log-stats?scope=${encodeURIComponent(viewState.scope)}`);
    renderLogStats(container, data);
  } catch (error) {
    container.textContent = `加载统计失败：${error.message}`;
  }
}

function renderLogStats(container, data) {
  const { typeCounts = [], hourlyTrend = [], actorCounts = [], anomalies = [] } = data;
  const anomalyTypes = new Set(anomalies.map((a) => a.type));

  // --- Type distribution table ---
  const totalCount = typeCounts.reduce((s, r) => s + r.count, 0) || 1;
  const typeRowsHtml = typeCounts.map((row) => {
    const pct = Math.round(row.count / totalCount * 100);
    const isAnomaly = anomalyTypes.has(row.type);
    const anomalyBadge = isAnomaly
      ? ' <span style="color:#ff3b30;font-weight:600;font-size:12px">\u26A0 异常</span>'
      : '';
    return `<tr>
      <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(row.type)}">${escapeHtml(row.type)}${anomalyBadge}</td>
      <td style="text-align:right">${row.count}</td>
      <td style="width:40%">
        <div style="background:#f0f0f5;border-radius:4px;height:16px;overflow:hidden">
          <div style="background:${isAnomaly ? '#ff3b30' : '#007AFF'};height:100%;width:${pct}%;min-width:2px;border-radius:4px"></div>
        </div>
      </td>
      <td style="text-align:right;color:#8e8e93">${pct}%</td>
    </tr>`;
  }).join('');

  // --- Actor table ---
  const actorRowsHtml = actorCounts.map((row) => {
    return `<tr><td>${escapeHtml(row.actor)}</td><td style="text-align:right">${row.count}</td></tr>`;
  }).join('');

  // --- Hourly trend (bar chart with divs) ---
  const maxHourly = Math.max(1, ...hourlyTrend.map((h) => h.count));
  const barsHtml = hourlyTrend.map((row) => {
    const heightPct = Math.max(2, Math.round(row.count / maxHourly * 100));
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0" title="${escapeHtml(row.hour)}: ${row.count} 条">
      <div style="font-size:10px;color:#8e8e93;margin-bottom:2px">${row.count || ''}</div>
      <div style="width:100%;max-width:20px;background:#007AFF;border-radius:3px 3px 0 0;height:${heightPct}px"></div>
      <div style="font-size:9px;color:#8e8e93;margin-top:2px;transform:rotate(-45deg);white-space:nowrap">${escapeHtml(row.hour)}</div>
    </div>`;
  }).join('');

  // --- Anomaly summary ---
  let anomalyHtml = '';
  if (anomalies.length > 0) {
    const anomalyRowsHtml = anomalies.map((a) => {
      return `<tr>
        <td style="color:#ff3b30;font-weight:500">${escapeHtml(a.type)}</td>
        <td style="text-align:right">${a.recentCount}</td>
        <td style="text-align:right">${a.avgPerHour}</td>
        <td style="text-align:right;color:#ff3b30;font-weight:600">${Math.round(a.avgPerHour > 0 ? a.recentCount / a.avgPerHour : 0)}x</td>
      </tr>`;
    }).join('');
    anomalyHtml = `
      <div style="margin-top:24px">
        <h3 style="font-size:15px;font-weight:600;margin:0 0 10px">\u26A0 异常检测</h3>
        <p style="font-size:12px;color:#8e8e93;margin:0 0 8px">以下事件类型最近 1 小时的数量超过此前小时均值的 2 倍：</p>
        <table style="width:100%">
          <thead><tr><th style="text-align:left">事件类型</th><th style="text-align:right">近 1h 数量</th><th style="text-align:right">此前均值/h</th><th style="text-align:right">倍数</th></tr></thead>
          <tbody>${anomalyRowsHtml}</tbody>
        </table>
      </div>`;
  } else {
    anomalyHtml = `
      <div style="margin-top:24px">
        <h3 style="font-size:15px;font-weight:600;margin:0 0 10px">\u26A0 异常检测</h3>
        <p style="font-size:13px;color:#34c759">当前无异常事件类型</p>
      </div>`;
  }

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div>
        <h3 style="font-size:15px;font-weight:600;margin:0 0 10px">Top 10 事件类型分布</h3>
        <table style="width:100%">
          <thead><tr><th style="text-align:left">类型</th><th style="text-align:right">数量</th><th>占比</th><th style="text-align:right">百分比</th></tr></thead>
          <tbody>${typeRowsHtml || '<tr><td colspan="4" class="empty">暂无数据</td></tr>'}</tbody>
        </table>
      </div>
      <div>
        <h3 style="font-size:15px;font-weight:600;margin:0 0 10px">Top 5 操作人活跃度</h3>
        <table style="width:100%">
          <thead><tr><th style="text-align:left">操作人</th><th style="text-align:right">事件数</th></tr></thead>
          <tbody>${actorRowsHtml || '<tr><td colspan="2" class="empty">暂无数据</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    <div style="margin-top:24px">
      <h3 style="font-size:15px;font-weight:600;margin:0 0 10px">24 小时趋势</h3>
      <div style="display:flex;align-items:flex-end;gap:2px;height:120px;padding-bottom:24px;border-bottom:1px solid #ededf2">
        ${barsHtml || '<div style="color:#8e8e93">暂无数据</div>'}
      </div>
    </div>
    ${anomalyHtml}
  `;
}

/* ═══════════════════════════════════════════════════════════
   openclaw-statistics.js — Data Statistics Dashboard
   ═══════════════════════════════════════════════════════════ */

// ── Mock Data ──

let DAU_MSG_TREND = [
  { day: '03-26', dau: 52, msg: 890 },
  { day: '03-27', dau: 61, msg: 1024 },
  { day: '03-28', dau: 58, msg: 956 },
  { day: '03-29', dau: 45, msg: 720 },
  { day: '03-30', dau: 38, msg: 612 },
  { day: '03-31', dau: 42, msg: 680 },
  { day: '04-01', dau: 55, msg: 920 },
];

const RETENTION_TREND = [
  { day: '03-26', day1: 78, day7: 52 },
  { day: '03-27', day1: 82, day7: 55 },
  { day: '03-28', day1: 80, day7: 58 },
  { day: '03-29', day1: 75, day7: 50 },
  { day: '03-30', day1: 70, day7: 48 },
  { day: '03-31', day1: 73, day7: 51 },
  { day: '04-01', day1: 80, day7: 54 },
];

let DEPT_TOKEN_RANK = [
  { name: '技术研发部', value: 2340, color: '#0071e3' },
  { name: '安全运维部', value: 1560, color: '#34c759' },
  { name: '产品运营部', value: 1120, color: '#af52de' },
  { name: '财务管理部', value: 780,  color: '#ff9500' },
  { name: '人力资源部', value: 650,  color: '#ff3b30' },
  { name: '市场营销部', value: 490,  color: '#5ac8fa' },
];

let USER_SPEND_TOP20 = [
  { name: '张伟', value: 456 }, { name: '李娜', value: 423 }, { name: '王强', value: 398 },
  { name: '刘洋', value: 367 }, { name: '陈静', value: 341 }, { name: '杨磊', value: 312 },
  { name: '赵敏', value: 289 }, { name: '黄海', value: 267 }, { name: '周涛', value: 245 },
  { name: '吴丽', value: 223 }, { name: '徐鹏', value: 201 }, { name: '孙菲', value: 189 },
  { name: '马超', value: 176 }, { name: '朱婷', value: 165 }, { name: '胡军', value: 153 },
  { name: '郭靖', value: 142 }, { name: '何坤', value: 131 }, { name: '林峰', value: 120 },
  { name: '罗琳', value: 109 }, { name: '梁博', value: 98 },
];

let ACTIVE_USER_TOP20 = [
  { name: '张伟', value: 186 }, { name: '李娜', value: 172 }, { name: '王强', value: 158 },
  { name: '陈静', value: 145 }, { name: '杨磊', value: 134 }, { name: '赵敏', value: 128 },
  { name: '黄海', value: 119 }, { name: '周涛', value: 112 }, { name: '刘洋', value: 105 },
  { name: '吴丽', value: 98 },  { name: '徐鹏', value: 92 },  { name: '孙菲', value: 87 },
  { name: '马超', value: 81 },  { name: '朱婷', value: 76 },  { name: '胡军', value: 71 },
  { name: '郭靖', value: 66 },  { name: '何坤', value: 61 },  { name: '林峰', value: 56 },
  { name: '罗琳', value: 51 },  { name: '梁博', value: 47 },
];

let LATENCY_TREND = [
  { day: '03-26', p50: 1.2, p95: 3.8, avg: 1.8 },
  { day: '03-27', p50: 1.1, p95: 3.5, avg: 1.7 },
  { day: '03-28', p50: 1.3, p95: 4.1, avg: 2.0 },
  { day: '03-29', p50: 1.0, p95: 3.2, avg: 1.5 },
  { day: '03-30', p50: 0.9, p95: 3.0, avg: 1.4 },
  { day: '03-31', p50: 1.1, p95: 3.4, avg: 1.6 },
  { day: '04-01', p50: 1.2, p95: 3.6, avg: 1.8 },
];

let ERROR_TREND = [
  { day: '03-26', err: 1.2, timeout: 0.5 },
  { day: '03-27', err: 0.8, timeout: 0.3 },
  { day: '03-28', err: 1.5, timeout: 0.7 },
  { day: '03-29', err: 0.6, timeout: 0.2 },
  { day: '03-30', err: 0.5, timeout: 0.2 },
  { day: '03-31', err: 0.9, timeout: 0.4 },
  { day: '04-01', err: 1.0, timeout: 0.3 },
];

let TOKEN_TREND = [
  { day: '03-26', value: 980 },
  { day: '03-27', value: 1120 },
  { day: '03-28', value: 1050 },
  { day: '03-29', value: 780 },
  { day: '03-30', value: 650 },
  { day: '03-31', value: 720 },
  { day: '04-01', value: 890 },
];

// ── SVG Drawing Constants ──

const W = 560;
const H = 196;
const PAD_T = 10;
const PAD_B = 4;
const PLOT_H = H - PAD_T - PAD_B;

// ── Scale Helpers ──

function niceScale(min, max, ticks) {
  const range = max - min || 1;
  const rough = range / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step;
  if (norm <= 1.5) step = mag;
  else if (norm <= 3) step = 2 * mag;
  else if (norm <= 7) step = 5 * mag;
  else step = 10 * mag;
  const nMin = Math.floor(min / step) * step;
  const nMax = Math.ceil(max / step) * step;
  return { min: nMin, max: nMax, range: nMax - nMin || 1, step };
}

function fmtNum(n) {
  if (n >= 10000) return (n / 1000).toFixed(0) + 'K';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

function yOf(val, scale) {
  return PAD_T + PLOT_H - ((val - scale.min) / scale.range) * PLOT_H;
}

function xOf(i, n) {
  return n <= 1 ? W / 2 : (i / (n - 1)) * W;
}

// ── SVG Building Blocks ──

function gridLines(scale) {
  let svg = '';
  for (let v = scale.min; v <= scale.max + scale.step * 0.01; v += scale.step) {
    svg += `<line x1="0" y1="${yOf(v, scale)}" x2="${W}" y2="${yOf(v, scale)}" class="chart-grid-line"/>`;
  }
  return svg;
}

function yLabels(scale) {
  let html = '';
  for (let v = scale.min; v <= scale.max + scale.step * 0.01; v += scale.step) {
    html += `<span>${fmtNum(v)}</span>`;
  }
  return html;
}

function xLabels(data, key) {
  return data.map(d => `<span>${d[key]}</span>`).join('');
}

function legend(items) {
  return `<div class="chart-legend">${items.map(it =>
    `<div class="chart-legend-item"><div class="legend-swatch${it.dot ? ' dot' : ''}" style="background:${it.color}"></div>${it.label}</div>`
  ).join('')}</div>`;
}

function areaPath(data, key, scale) {
  return `M0,${H} ` + data.map((d, i) => `L${xOf(i, data.length)},${yOf(d[key], scale)}`).join(' ') + ` L${xOf(data.length - 1, data.length)},${H} Z`;
}

function linePath(data, key, scale) {
  return data.map((d, i) => `${i ? 'L' : 'M'}${xOf(i, data.length)},${yOf(d[key], scale)}`).join(' ');
}

function dotsAndHits(data, key, scale, color, tipId) {
  let svg = '';
  data.forEach((d, i) => {
    const cx = xOf(i, data.length);
    const cy = yOf(d[key], scale);
    // invisible wide hit area for easy hovering
    svg += `<rect class="hit-area" x="${cx - 20}" y="${PAD_T}" width="40" height="${PLOT_H}" data-tip="${tipId}" data-idx="${i}"/>`;
    // visible dot (always shown)
    svg += `<circle class="dot-base" cx="${cx}" cy="${cy}" r="3" fill="#fff" stroke="${color}" stroke-width="1.8"/>`;
    // highlight ring on hover
    svg += `<circle class="dot-highlight" cx="${cx}" cy="${cy}" r="5" fill="${color}" opacity="0.15"/>`;
  });
  return svg;
}

// ── Tooltip System ──

let activeTip = null;

function setupTooltip(panelEl) {
  const tip = document.createElement('div');
  tip.className = 'tip';
  panelEl.appendChild(tip);

  panelEl.addEventListener('mouseover', e => {
    const hit = e.target.closest('.hit-area');
    if (!hit) { tip.classList.remove('show'); return; }
    tip.classList.add('show');
  });

  panelEl.addEventListener('mousemove', e => {
    const hit = e.target.closest('.hit-area');
    if (!hit) { tip.classList.remove('show'); return; }
    const tipData = hit.dataset.tip ? window['__tipData__']?.[hit.dataset.tip]?.[+hit.dataset.idx] : null;
    if (tipData) {
      tip.innerHTML = tipData;
    }
    // position: center above the hit point, clamped to panel bounds
    const rect = panelEl.getBoundingClientRect();
    const hitRect = hit.getBoundingClientRect();
    let left = hitRect.left + hitRect.width / 2 - rect.left;
    let top = hitRect.top - rect.top - 6;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.style.transform = 'translate(-50%, -100%)';
  });

  panelEl.addEventListener('mouseleave', () => {
    tip.classList.remove('show');
  });
}

function registerTipData(tipId, rows) {
  if (!window['__tipData__']) window['__tipData__'] = {};
  window['__tipData__'][tipId] = rows;
}

// ── Chart Renderers ──

function renderDualAxisAreaLine(containerId, areaData, areaKey, lineData, lineKey, areaColor, lineColor, areaUnit, lineUnit) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const areaScale = niceScale(Math.min(...areaData.map(d => d[areaKey])), Math.max(...areaData.map(d => d[areaKey])), 5);
  const lineScale = niceScale(Math.min(...lineData.map(d => d[lineKey])), Math.max(...lineData.map(d => d[lineKey])), 5);
  const tipId = containerId;
  const gradId = `g-${tipId}`;

  // precompute tooltip HTML for each data point
  const tipRows = areaData.map((d, i) => {
    const val1 = d[areaKey];
    const val2 = d[lineKey];
    return `<div class="tip-label">${d.day}</div><div class="tip-row"><div class="tip-dot" style="background:${areaColor}"></div>活跃用户: <span class="tip-val">${val1} ${areaUnit}</span></div><div class="tip-row"><div class="tip-dot" style="background:${lineColor}"></div>消息数: <span class="tip-val">${fmtNum(val2)} ${lineUnit}</span></div>`;
  });
  registerTipData(tipId, tipRows);

  const svgContent = [
    `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${areaColor}" stop-opacity="0.15"/><stop offset="100%" stop-color="${areaColor}" stop-opacity="0.01"/></linearGradient></defs>`,
    gridLines(areaScale),
    `<path d="${areaPath(areaData, areaKey, areaScale)}" fill="url(#${gradId})"/>`,
    `<path d="${linePath(areaData, areaKey, areaScale)}" fill="none" stroke="${areaColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="${linePath(lineData, lineKey, lineScale)}" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    dotsAndHits(areaData, areaKey, areaScale, areaColor, tipId),
  ].join('');

  container.innerHTML = `
    <div class="chart-box dual-axis">
      <div class="chart-y-left">${yLabels(areaScale)}</div>
      <div class="chart-y-right">${yLabels(lineScale)}</div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${svgContent}</svg>
    </div>
    <div class="chart-x-axis dual-axis">${xLabels(areaData, 'day')}</div>
    ${legend([
      { color: areaColor, dot: true, label: `活跃用户 (${areaUnit})` },
      { color: lineColor, label: `消息数 (${lineUnit})` },
    ])}
  `;

  setupTooltip(container);
}

function renderMultiLine(containerId, data, keys, colors, labels, yUnit) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const allVals = data.flatMap(d => keys.map(k => d[k]));
  const scale = niceScale(Math.min(...allVals), Math.max(...allVals), 5);
  const tipId = containerId;

  const tipRows = data.map((d) => {
    const rows = keys.map((k, i) =>
      `<div class="tip-row"><div class="tip-dot" style="background:${colors[i]}"></div>${labels[i]}: <span class="tip-val">${d[k]}${yUnit}</span></div>`
    ).join('');
    return `<div class="tip-label">${d.day}</div>${rows}`;
  });
  registerTipData(tipId, tipRows);

  const svgParts = [
    gridLines(scale),
  ];
  keys.forEach((key, i) => {
    svgParts.push(`<path d="${linePath(data, key, scale)}" fill="none" stroke="${colors[i]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);
    svgParts.push(dotsAndHits(data, key, scale, colors[i], tipId));
  });

  container.innerHTML = `
    <div class="chart-box">
      <div class="chart-y-left">${yLabels(scale)}</div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${svgParts.join('')}</svg>
    </div>
    <div class="chart-x-axis">${xLabels(data, 'day')}</div>
    ${legend(labels.map((l, i) => ({ color: colors[i], label: l })))}
  `;

  setupTooltip(container);
}

function renderArea(containerId, data, key, color) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const scale = niceScale(Math.min(...data.map(d => d[key])), Math.max(...data.map(d => d[key])), 5);
  const tipId = containerId;
  const gradId = `g-${tipId}`;

  const tipRows = data.map(d =>
    `<div class="tip-label">${d.day}</div><div class="tip-row"><div class="tip-dot" style="background:${color}"></div>Token: <span class="tip-val">${fmtNum(d[key])}</span></div>`
  );
  registerTipData(tipId, tipRows);

  const svgContent = [
    `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.18"/><stop offset="100%" stop-color="${color}" stop-opacity="0.01"/></linearGradient></defs>`,
    gridLines(scale),
    `<path d="${areaPath(data, key, scale)}" fill="url(#${gradId})"/>`,
    `<path d="${linePath(data, key, scale)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    dotsAndHits(data, key, scale, color, tipId),
  ].join('');

  container.innerHTML = `
    <div class="chart-box">
      <div class="chart-y-left">${yLabels(scale)}</div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${svgContent}</svg>
    </div>
    <div class="chart-x-axis">${xLabels(data, 'day')}</div>
  `;

  setupTooltip(container);
}

// ── Horizontal Bar ──

function renderHorizontalBars(containerId, data, defaultColor) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const maxVal = Math.max(...data.map(d => d.value));

  container.innerHTML = `<div class="hbar-list">${data.map((d, i) => {
    const pct = Math.max(3, (d.value / maxVal) * 100);
    const rankClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : 'normal';
    const c = d.color || defaultColor;
    return `
      <div class="hbar-item">
        <div class="hbar-rank ${rankClass}">${i + 1}</div>
        <div class="hbar-name" title="${d.name}">${d.name}</div>
        <div class="hbar-track">
          <div class="hbar-fill" style="width:${pct}%;background:${c}"></div>
        </div>
        <div class="hbar-val">${fmtNum(d.value)}</div>
      </div>
    `;
  }).join('')}</div>`;
}

// ── Period Selector ──

function initPeriodSelector() {
  const btns = document.querySelectorAll('.period-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ── Fetch AI Gateway cost data (shared data source with monitor) ──

const MODEL_COLORS = ['#0071e3', '#34c759', '#af52de', '#ff9500', '#ff3b30', '#5ac8fa', '#007aff', '#ff2d55'];

async function loadAICosts() {
  try {
    const res = await fetch('/api/admin/ai-gateway/costs');
    if (!res.ok) return;
    const data = await res.json();

    // Update hero cards with real aggregated data
    const totalTokensEl = document.getElementById('totalTokensValue');
    if (totalTokensEl && data.totalTokens) {
      const k = data.totalTokens >= 1000 ? (data.totalTokens / 1000).toFixed(1) + '<span class="stats-hero-unit">K</span>' : String(data.totalTokens);
      totalTokensEl.innerHTML = k;
    }

    if (data.dailyTrend && data.dailyTrend.length > 0) {
      TOKEN_TREND = data.dailyTrend.map(d => ({
        day: d.day.slice(5),
        value: d.totalTokens
      }));
    }

    if (data.userSummary && data.userSummary.length > 0) {
      USER_SPEND_TOP20 = data.userSummary.slice(0, 20).map(u => ({
        name: u.userId,
        value: u.totalTokens
      }));
    }

    if (data.modelSummary && data.modelSummary.length > 0) {
      DEPT_TOKEN_RANK = data.modelSummary.map((m, i) => ({
        name: m.model,
        value: m.totalTokens,
        color: MODEL_COLORS[i % MODEL_COLORS.length]
      }));
    }
  } catch (_) {
    // fallback to mock data
  }
}

async function loadDauTrend() {
  try {
    const res = await fetch('/api/admin/analytics/dau-trend');
    if (!res.ok) return;
    const data = await res.json();
    if (data.rows && data.rows.length > 0) {
      DAU_MSG_TREND = data.rows.map(r => ({
        day: r.day,
        dau: r.dau,
        msg: r.msg
      }));
      // Derive active user ranking from per-day actors
      ACTIVE_USER_TOP20 = data.rows
        .sort((a, b) => b.dau - a.dau)
        .slice(0, 20)
        .map(r => ({ name: r.day, value: r.dau }));
    }
  } catch (_) {}
}

async function loadLatencyTrend() {
  try {
    const res = await fetch('/api/admin/analytics/latency-trend');
    if (!res.ok) return;
    const data = await res.json();
    if (data.rows && data.rows.length > 0) {
      LATENCY_TREND = data.rows.map(r => ({
        day: r.day,
        p50: r.p50,
        p95: r.p95,
        avg: r.avg
      }));
      ERROR_TREND = data.rows.map(r => ({
        day: r.day,
        err: r.err,
        timeout: r.timeout || 0
      }));
    }
  } catch (_) {}
}

// ── Init ──

(async () => {
  try {
    if (window.__adminReady) await window.__adminReady;
  } catch (_) { /* auth optional */ }

  await Promise.all([loadAICosts(), loadDauTrend(), loadLatencyTrend()]);

  // 趋势 & 留存
  renderDualAxisAreaLine(
    'dauMsgChart',
    DAU_MSG_TREND, 'dau',
    DAU_MSG_TREND, 'msg',
    '#0071e3', '#34c759',
    '人', '条'
  );
  renderMultiLine(
    'retentionChart',
    RETENTION_TREND, ['day1', 'day7'],
    ['#0071e3', '#ff9500'],
    ['次日留存', '7日留存'],
    '%'
  );

  // 用户 & 部门分析
  renderHorizontalBars('deptTokenChart', DEPT_TOKEN_RANK);
  renderHorizontalBars('userSpendChart', USER_SPEND_TOP20, '#0071e3');
  renderHorizontalBars('activeUserChart', ACTIVE_USER_TOP20, '#34c759');

  // 性能 & 成本监控
  renderMultiLine(
    'latencyChart',
    LATENCY_TREND, ['p50', 'avg', 'p95'],
    ['#34c759', '#0071e3', '#ff3b30'],
    ['P50', '平均', 'P95'],
    's'
  );
  renderMultiLine(
    'errorChart',
    ERROR_TREND, ['err', 'timeout'],
    ['#ff3b30', '#0071e3'],
    ['错误率', '超时率'],
    '%'
  );
  renderArea('tokenChart', TOKEN_TREND, 'value', '#ff9500');

  initPeriodSelector();
})();

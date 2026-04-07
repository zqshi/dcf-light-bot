/* auth-audit.js — 权限变更审计追踪（auth-users.html 的审计日志面板逻辑）
 * 依赖全局：api(), getNode(), escapeHtml()（来自 auth-members.js）
 */

let auditLogsCache = [];

function formatAuditSummary(event) {
  const type = String(event.type || '');
  const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
  const username = String(payload.username || payload.userId || '-');
  const role = String(payload.role || '');
  const map = {
    'auth.login.succeeded': `${username} 登录成功`,
    'auth.login.failed': `${username} 登录失败`,
    'auth.logout': `${username} 退出登录`,
    'auth.user.created': `创建账号 ${username}${role ? `（角色：${role}）` : ''}`,
    'auth.user.updated': `更新账号 ${username}`,
    'auth.user.deleted': `删除账号 ${username}`,
    'auth.user.password.reset': `重置密码 ${username}`,
    'auth.user.status.changed': `账号 ${username} 状态变更为 ${String(payload.status || '-')}`,
    'auth.role.created': `创建角色 ${String(payload.role || '-')}`,
    'auth.role.updated': `更新角色 ${String(payload.role || '-')} 权限`,
    'auth.role.deleted': `删除角色 ${String(payload.role || '-')}`
  };
  return map[type] || type;
}

function formatAuditDetail(event) {
  const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
  const parts = [];
  if (Array.isArray(payload.changes) && payload.changes.length) {
    parts.push(`变更字段：${payload.changes.join(', ')}`);
  }
  if (Array.isArray(payload.permissions)) {
    parts.push(`权限数：${payload.permissions.length}`);
  }
  if (Array.isArray(payload.previousPermissions)) {
    const added = payload.permissions
      ? payload.permissions.filter((p) => !payload.previousPermissions.includes(p))
      : [];
    const removed = payload.previousPermissions.filter(
      (p) => !(payload.permissions || []).includes(p)
    );
    if (added.length) parts.push(`新增：${added.join(', ')}`);
    if (removed.length) parts.push(`移除：${removed.join(', ')}`);
  }
  return parts.length ? parts.join('；') : '-';
}

function renderAuditRows(filter) {
  const tbody = getNode('authAuditRows');
  const countNode = getNode('authAuditCount');
  if (!tbody) return;
  const prefix = String(filter || '').trim();
  const filtered = prefix
    ? auditLogsCache.filter((e) => String(e.type || '').startsWith(prefix))
    : auditLogsCache;
  if (countNode) countNode.textContent = String(filtered.length);
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">暂无权限变更记录</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map((event) => {
    const at = event.at ? new Date(event.at).toLocaleString() : '-';
    const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
    const actor = String(
      payload.actor_name || payload.updatedBy || payload.actor || payload.username || '-'
    );
    return `
      <tr>
        <td>${escapeHtml(at)}</td>
        <td>${escapeHtml(formatAuditSummary(event))}</td>
        <td>${escapeHtml(formatAuditDetail(event))}</td>
        <td>${escapeHtml(actor)}</td>
      </tr>
    `;
  }).join('');
}

async function loadAuthAuditLogs() {
  try {
    const all = await api('/api/admin/logs');
    const logs = Array.isArray(all) ? all : [];
    auditLogsCache = logs.filter((e) => String(e.type || '').startsWith('auth.'));
    const filterNode = getNode('authAuditFilter');
    const currentFilter = filterNode ? filterNode.value : '';
    renderAuditRows(currentFilter);
  } catch {
    const tbody = getNode('authAuditRows');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="empty">加载审计日志失败</td></tr>';
  }
}

function bindAuditFilter() {
  const filterNode = getNode('authAuditFilter');
  if (!filterNode) return;
  filterNode.addEventListener('change', () => {
    renderAuditRows(filterNode.value);
  });
}

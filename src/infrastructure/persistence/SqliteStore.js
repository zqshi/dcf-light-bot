/**
 * SqliteStore - SQLite 持久化存储实现
 * 用于开发环境，生产环境建议使用 PostgreSQL
 */

const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const { ALL_TABLES_SQL, DEFAULT_USERS, DEFAULT_ROLES, DEFAULT_RISK_RULES, DEFAULT_SYSTEM_CONFIGS } = require('./DatabaseSchema');

const mkdirp = require('mkdirp').mkdirp;
const path = require('path');

const dbRunAsync = promisify((...args) => {
  return new Promise((resolve, reject) => {
    args[0].run(...args.slice(1), (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
});

const dbGetAsync = promisify((...args) => {
  return new Promise((resolve, reject) => {
    args[0].get(...args.slice(1), (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
});

const dbAllAsync = promisify((...args) => {
  return new Promise((resolve, reject) => {
    args[0].all(...args.slice(1), (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

class SqliteStore {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * 初始化数据库连接并创建表结构
   */
  async init() {
    if (this.isInitialized) {
      return;
    }

    // 确保目录存在
    await mkdirp(path.dirname(this.dbPath));

    // 创建数据库连接
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        console.error('[SqliteStore] Failed to open database:', err);
        throw err;
      }
    });

    // 启用 WAL 模式提高并发性能
    await dbRunAsync(this.db, 'PRAGMA journal_mode = WAL');
    await dbRunAsync(this.db, 'PRAGMA synchronous = NORMAL');
    await dbRunAsync(this.db, 'PRAGMA foreign_keys = ON');

    // 创建所有表
    await dbRunAsync(this.db, ALL_TABLES_SQL);

    // 初始化默认数据
    await this.seedDefaultData();

    this.isInitialized = true;
    console.log('[SqliteStore] Database initialized:', this.dbPath);
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    if (this.db) {
      await new Promise((resolve) => {
        this.db.close((err) => {
          if (err) console.error('[SqliteStore] Error closing database:', err);
          resolve();
        });
      });
      this.db = null;
      this.isInitialized = false;
    }
  }

  /**
   * 初始化默认数据
   */
  async seedDefaultData() {
    // 检查是否已有用户
    const userCount = await dbGetAsync(
      this.db,
      'SELECT COUNT(*) as count FROM users'
    );

    if (userCount.count === 0) {
      // 插入默认用户
      for (const user of DEFAULT_USERS) {
        await dbRunAsync(
          this.db,
          'INSERT INTO users (username, email, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [user.username, user.email, user.password_hash, user.role, 1, new Date().toISOString(), new Date().toISOString()]
        );
      }
    }

    // 检查是否已有角色
    const roleCount = await dbGetAsync(
      this.db,
      'SELECT COUNT(*) as count FROM user_roles'
    );

    if (roleCount.count === 0) {
      for (const role of DEFAULT_ROLES) {
        await dbRunAsync(
          this.db,
          'INSERT INTO user_roles (name, display_name, permissions, created_at) VALUES (?, ?, ?, ?)',
          [role.name, role.display_name, role.permissions, new Date().toISOString()]
        );
      }
    }

    // 检查是否已有风控规则
    const ruleCount = await dbGetAsync(
      this.db,
      'SELECT COUNT(*) as count FROM risk_rules'
    );

    if (ruleCount.count === 0) {
      for (const rule of DEFAULT_RISK_RULES) {
        await dbRunAsync(
          this.db,
          'INSERT INTO risk_rules (rule_id, display_name, description, pattern, severity, action, category, is_enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [rule.rule_id, rule.display_name, rule.description, rule.pattern, rule.severity, rule.action, rule.category, 1, rule.sort_order, new Date().toISOString(), new Date().toISOString()]
        );
      }
    }

    // 检查是否已有系统配置
    for (const [key, value] of Object.entries(DEFAULT_SYSTEM_CONFIGS)) {
      const exists = await dbGetAsync(
        this.db,
        'SELECT value FROM system_configs WHERE key = ?',
        [key]
      );
      if (!exists) {
        await dbRunAsync(
          this.db,
          'INSERT INTO system_configs (key, value, updated_at) VALUES (?, ?, ?)',
          [key, value, new Date().toISOString()]
        );
      }
    }
  }

  // ============================================
  // 用户管理操作
  // ============================================

  async listUsers(options = {}) {
    const { limit = 100, offset = 0, role } = options;
    let sql = 'SELECT id, username, email, role, is_active, created_at, updated_at FROM users';
    const params = [];

    if (role) {
      sql += ' WHERE role = ?';
      params.push(role);
    }

    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await dbAllAsync(this.db, sql, params);
  }

  async getUserById(id) {
    return await dbGetAsync(
      this.db,
      'SELECT id, username, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
  }

  async getUserByUsername(username) {
    return await dbGetAsync(
      this.db,
      'SELECT id, username, email, role, is_active, created_at, updated_at FROM users WHERE username = ?',
      [username]
    );
  }

  async createUser(user) {
    const now = new Date().toISOString();
    await dbRunAsync(
      this.db,
      'INSERT INTO users (username, email, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user.username, user.email || null, user.password_hash, user.role || 'user', 1, now, now]
    );
    return await dbGetAsync(this.db, 'SELECT last_insert_rowid() as id FROM users LIMIT 1');
  }

  async updateUser(id, updates) {
    const sets = [];
    const params = [id];

    if (updates.email !== undefined) { sets.push('email = ?'); params.push(updates.email); }
    if (updates.password_hash !== undefined) { sets.push('password_hash = ?'); params.push(updates.password_hash); }
    if (updates.role !== undefined) { sets.push('role = ?'); params.push(updates.role); }
    if (updates.is_active !== undefined) { sets.push('is_active = ?'); params.push(updates.is_active); }

    if (sets.length === 0) return false;

    sets.push('updated_at = ?');
    params.push(new Date().toISOString());

    await dbRunAsync(
      this.db,
      `UPDATE users SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
    return true;
  }

  async deleteUser(id) {
    await dbRunAsync(this.db, 'DELETE FROM users WHERE id = ?', [id]);
    return true;
  }

  // ============================================
  // 配额管理操作
  // ============================================

  async getUserQuota(userId) {
    return await dbGetAsync(
      this.db,
      'SELECT * FROM user_quotas WHERE user_id = ?',
      [userId]
    );
  }

  async setUserQuota(quota) {
    const now = new Date().toISOString();
    const exists = await this.getUserQuota(quota.user_id);

    if (exists) {
      await dbRunAsync(
        this.db,
        'UPDATE user_quotas SET max_instances = ?, max_cpu_cores = ?, max_memory_gb = ?, max_storage_gb = ?, max_gpu_count = ?, updated_at = ? WHERE user_id = ?',
        [quota.max_instances, quota.max_cpu_cores, quota.max_memory_gb, quota.max_storage_gb, quota.max_gpu_count, now, quota.user_id]
      );
    } else {
      await dbRunAsync(
        this.db,
        'INSERT INTO user_quotas (user_id, max_instances, max_cpu_cores, max_memory_gb, max_storage_gb, max_gpu_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [quota.user_id, quota.max_instances, quota.max_cpu_cores, quota.max_memory_gb, quota.max_storage_gb, quota.max_gpu_count, now, now]
      );
    }
    return quota;
  }

  async checkQuotaAvailability(userId, required = {}) {
    const quota = await this.getUserQuota(userId);
    if (!quota) {
      return { available: true, reason: null };
    }

    const { max_instances, max_cpu_cores, max_memory_gb, max_storage_gb, max_gpu_count } = quota;

    // 计算当前使用量
    const usedInstances = await this.listUserInstances(userId, { status: 'running' });
    const usedInstancesCount = usedInstances.length;

    const usedCPUCores = usedInstances.reduce((sum, inst) => sum + (inst.cpu_cores || 0), 0);
    const usedMemoryGB = usedInstances.reduce((sum, inst) => sum + (inst.memory_gb || 0), 0);
    const usedStorageGB = usedInstances.reduce((sum, inst) => sum + (inst.disk_gb || 0), 0);
    const usedGPUCount = usedInstances.reduce((sum, inst) => sum + (inst.gpu_count || 0), 0);

    // 检查配额
    if (required.instances !== undefined && usedInstancesCount >= max_instances) {
      return { available: false, reason: '已达到实例数配额上限' };
    }
    if (required.cpu_cores !== undefined && usedCPUCores >= max_cpu_cores) {
      return { available: false, reason: '已达到 CPU 核心数配额上限' };
    }
    if (required.memory_gb !== undefined && usedMemoryGB >= max_memory_gb) {
      return { available: false, reason: '已达到内存配额上限' };
    }
    if (required.storage_gb !== undefined && usedStorageGB >= max_storage_gb) {
      return { available: false, reason: '已达到存储配额上限' };
    }
    if (required.gpu_count !== undefined && usedGPUCount >= max_gpu_count) {
      return { available: false, reason: '已达到 GPU 数配额上限' };
    }

    return { available: true, reason: null };
  }

  // ============================================
  // 实例管理操作
  // ============================================

  async listInstances(options = {}) {
    const { userId, status, type, limit = 100, offset = 0 } = options;
    let sql = 'SELECT * FROM instances';
    const params = [];
    const conditions = [];

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await dbAllAsync(this.db, sql, params);
  }

  async listUserInstances(userId, options = {}) {
    return this.listInstances({ ...options, userId });
  }

  async getInstanceById(id) {
    return await dbGetAsync(
      this.db,
      'SELECT * FROM instances WHERE id = ?',
      [id]
    );
  }

  async createInstance(instance) {
    const now = new Date().toISOString();
    await dbRunAsync(
      this.db,
      `INSERT INTO instances (
        user_id, name, description, type, status,
        cpu_cores, memory_gb, disk_gb, gpu_enabled, gpu_count,
        os_type, os_version, image_registry, image_tag, storage_class,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        instance.user_id, instance.name, instance.description || null, instance.type,
        'pending', instance.cpu_cores, instance.memory_gb, instance.disk_gb,
        instance.gpu_enabled ? 1 : 0, instance.gpu_count || 0,
        instance.os_type || 'linux', instance.os_version || 'ubuntu',
        instance.image_registry || null, instance.image_tag || null,
        instance.storage_class || 'standard', now
      ]
    );
    return await dbGetAsync(this.db, 'SELECT last_insert_rowid() as id FROM instances LIMIT 1');
  }

  async updateInstanceStatus(id, status) {
    const now = new Date().toISOString();
    const updates = ['status = ?', 'updated_at = ?'];
    const params = [status, now, id];

    if (status === 'running') {
      updates.push('started_at = ?');
      params.unshift(now);
    } else if (status === 'stopped' || status === 'error') {
      updates.push('stopped_at = ?');
      params.unshift(now);
    }

    await dbRunAsync(
      this.db,
      `UPDATE instances SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    return true;
  }

  async updateInstance(id, updates) {
    const sets = [];
    const params = [id];

    if (updates.name !== undefined) { sets.push('name = ?'); params.push(updates.name); }
    if (updates.description !== undefined) { sets.push('description = ?'); params.push(updates.description); }
    if (updates.status !== undefined) { sets.push('status = ?'); params.push(updates.status); }
    if (updates.pod_name !== undefined) { sets.push('pod_name = ?'); params.push(updates.pod_name); }
    if (updates.pod_namespace !== undefined) { sets.push('pod_namespace = ?'); params.push(updates.pod_namespace); }
    if (updates.pod_ip !== undefined) { sets.push('pod_ip = ?'); params.push(updates.pod_ip); }
    if (updates.last_sync_at !== undefined) { sets.push('last_sync_at = ?'); params.push(updates.last_sync_at); }
    sets.push('updated_at = ?');
    params.push(new Date().toISOString());

    if (sets.length > 1) {
      await dbRunAsync(
        this.db,
        `UPDATE instances SET ${sets.join(', ')} WHERE id = ?`,
        params
      );
    }
    return true;
  }

  async deleteInstance(id) {
    await dbRunAsync(this.db, 'DELETE FROM instances WHERE id = ?', [id]);
    return true;
  }

  // ============================================
  // AI Gateway - 模型管理
  // ============================================

  async listModels(options = {}) {
    const { isActive, isSecure, providerType, limit = 100, offset = 0 } = options;
    let sql = 'SELECT * FROM llm_models';
    const params = [];
    const conditions = [];

    if (isActive !== undefined) { conditions.push('is_active = ?'); params.push(isActive ? 1 : 0); }
    if (isSecure !== undefined) { conditions.push('is_secure = ?'); params.push(isSecure ? 1 : 0); }
    if (providerType) { conditions.push('provider_type = ?'); params.push(providerType); }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY sort_order, id LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await dbAllAsync(this.db, sql, params);
  }

  async listActiveModels() {
    return this.listModels({ isActive: true });
  }

  async getModelById(id) {
    return await dbGetAsync(
      this.db,
      'SELECT * FROM llm_models WHERE id = ?',
      [id]
    );
  }

  async getModelByDisplayName(displayName) {
    return await dbGetAsync(
      this.db,
      'SELECT * FROM llm_models WHERE display_name = ?',
      [displayName]
    );
  }

  async createModel(model) {
    const now = new Date().toISOString();
    await dbRunAsync(
      this.db,
      `INSERT INTO llm_models (
        display_name, description, provider_type, protocol_type,
        base_url, provider_model_name, api_key, api_key_secret_ref,
        is_secure, is_active, input_price, output_price, currency,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        model.display_name, model.description || null, model.provider_type, model.protocol_type || model.provider_type,
        model.base_url, model.provider_model_name, model.api_key || null, model.api_key_secret_ref || null,
        model.is_secure ? 1 : 0, model.is_active !== false ? 1 : 0,
        model.input_price, model.output_price, model.currency || 'CNY',
        now, now
      ]
    );
    return await dbGetAsync(this.db, 'SELECT last_insert_rowid() as id FROM llm_models LIMIT 1');
  }

  async updateModel(id, updates) {
    const sets = [];
    const params = [id];

    if (updates.description !== undefined) { sets.push('description = ?'); params.push(updates.description); }
    if (updates.base_url !== undefined) { sets.push('base_url = ?'); params.push(updates.base_url); }
    if (updates.provider_model_name !== undefined) { sets.push('provider_model_name = ?'); params.push(updates.provider_model_name); }
    if (updates.api_key !== undefined) { sets.push('api_key = ?'); params.push(updates.api_key); }
    if (updates.api_key_secret_ref !== undefined) { sets.push('api_key_secret_ref = ?'); params.push(updates.api_key_secret_ref); }
    if (updates.is_secure !== undefined) { sets.push('is_secure = ?'); params.push(updates.is_secure ? 1 : 0); }
    if (updates.is_active !== undefined) { sets.push('is_active = ?'); params.push(updates.is_active ? 1 : 0); }
    if (updates.input_price !== undefined) { sets.push('input_price = ?'); params.push(updates.input_price); }
    if (updates.output_price !== undefined) { sets.push('output_price = ?'); params.push(updates.output_price); }
    if (updates.currency !== undefined) { sets.push('currency = ?'); params.push(updates.currency); }

    sets.push('updated_at = ?');
    params.push(new Date().toISOString());

    if (sets.length > 1) {
      await dbRunAsync(
        this.db,
        `UPDATE llm_models SET ${sets.join(', ')} WHERE id = ?`,
        params
      );
    }
    return true;
  }

  async toggleModelActive(id) {
    await dbRunAsync(
      this.db,
      'UPDATE llm_models SET is_active = NOT is_active, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
    return true;
  }

  async deleteModel(id) {
    await dbRunAsync(this.db, 'DELETE FROM llm_models WHERE id = ?', [id]);
    return true;
  }

  // ============================================
  // AI Gateway - 风控规则
  // ============================================

  async listRiskRules(options = {}) {
    const { category, isEnabled, severity, limit = 100, offset = 0 } = options;
    let sql = 'SELECT * FROM risk_rules';
    const params = [];
    const conditions = [];

    if (category) { conditions.push('category = ?'); params.push(category); }
    if (isEnabled !== undefined) { conditions.push('is_enabled = ?'); params.push(isEnabled ? 1 : 0); }
    if (severity) { conditions.push('severity = ?'); params.push(severity); }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await dbAllAsync(this.db, sql, params);
  }

  async getRiskRuleById(ruleId) {
    return await dbGetAsync(
      this.db,
      'SELECT * FROM risk_rules WHERE rule_id = ?',
      [ruleId]
    );
  }

  async createRiskRule(rule) {
    const now = new Date().toISOString();
    await dbRunAsync(
      this.db,
      `INSERT INTO risk_rules (
        rule_id, display_name, description, pattern, severity,
        action, category, is_enabled, sort_order,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rule.rule_id, rule.display_name, rule.description || null, rule.pattern,
        rule.severity, rule.action, rule.category || 'custom',
        rule.is_enabled !== false ? 1 : 0, rule.sort_order || 100,
        now, now
      ]
    );
    return rule;
  }

  async updateRiskRule(ruleId, updates) {
    const sets = [];
    const params = [ruleId];

    if (updates.display_name !== undefined) { sets.push('display_name = ?'); params.push(updates.display_name); }
    if (updates.description !== undefined) { sets.push('description = ?'); params.push(updates.description); }
    if (updates.pattern !== undefined) { sets.push('pattern = ?'); params.push(updates.pattern); }
    if (updates.severity !== undefined) { sets.push('severity = ?'); params.push(updates.severity); }
    if (updates.action !== undefined) { sets.push('action = ?'); params.push(updates.action); }
    if (updates.category !== undefined) { sets.push('category = ?'); params.push(updates.category); }
    if (updates.is_enabled !== undefined) { sets.push('is_enabled = ?'); params.push(updates.is_enabled ? 1 : 0); }
    if (updates.sort_order !== undefined) { sets.push('sort_order = ?'); params.push(updates.sort_order); }

    sets.push('updated_at = ?');
    params.push(new Date().toISOString());

    if (sets.length > 1) {
      await dbRunAsync(
        this.db,
        `UPDATE risk_rules SET ${sets.join(', ')} WHERE rule_id = ?`,
        params
      );
    }
    return true;
  }

  async toggleRiskRuleEnabled(ruleId) {
    await dbRunAsync(
      this.db,
      'UPDATE risk_rules SET is_enabled = NOT is_enabled, updated_at = ? WHERE rule_id = ?',
      [new Date().toISOString(), ruleId]
    );
    return true;
  }

  async deleteRiskRule(ruleId) {
    await dbRunAsync(this.db, 'DELETE FROM risk_rules WHERE rule_id = ?', [ruleId]);
    return true;
  }

  /**
   * 测试风控规则
   */
  async testRiskRules(text) {
    const rules = await this.listRiskRules({ isEnabled: true });
    const hits = [];

    for (const rule of rules) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        const match = regex.exec(text);
        if (!match) continue;

        hits.push({
          rule_id: rule.rule_id,
          rule_name: rule.display_name,
          severity: rule.severity,
          action: rule.action,
          match_summary: `匹配: ${match[0].slice(0, 40)}${match[0].length > 40 ? '...' : ''}`
        });
      } catch (err) {
        // 跳过无效正则
        continue;
      }
    }

    // 计算最高动作和严重程度
    const ACTION_PRIORITY = { allow: 1, route_secure_model: 2, block: 3 };
    const SEVERITY_PRIORITY = { low: 1, medium: 2, high: 3 };

    let highestAction = 'allow';
    let highestSeverity = 'low';

    for (const hit of hits) {
      if ((ACTION_PRIORITY[hit.action] || 0) > (ACTION_PRIORITY[highestAction] || 0)) {
        highestAction = hit.action;
      }
      if ((SEVERITY_PRIORITY[hit.severity] || 0) > (SEVERITY_PRIORITY[highestSeverity] || 0)) {
        highestSeverity = hit.severity;
      }
    }

    return {
      is_sensitive: hits.length > 0 && highestAction !== 'allow',
      highest_action: highestAction,
      highest_severity: highestSeverity,
      hits
    };
  }

  // ============================================
  // AI Gateway - 审计追踪
  // ============================================

  async listTraces(options = {}) {
    const { userId, status, model, limit = 20, offset = 0, search, startDate, endDate } = options;
    let sql = `
      SELECT t.*, GROUP_CONCAT(
        CASE WHEN fn.kind = 'llm_call' THEN
          json_object('kind', fn.kind, 'title', fn.title, 'model', fn.model, 'status', fn.status)
        ELSE NULL
      END, '|') as models_used
      FROM ai_traces t
      LEFT JOIN ai_flow_nodes fn ON t.trace_id = fn.trace_id AND fn.kind = 'llm_call'
    `;
    const params = [];
    const conditions = [];

    if (userId) {
      conditions.push('t.user_id = ?');
      params.push(userId);
    }
    if (status && status !== 'all') {
      conditions.push('t.status = ?');
      params.push(status);
    }
    if (model) {
      conditions.push('(t.actual_model LIKE ? OR t.requested_model LIKE ?)');
      params.push(`%${model}%`, `%${model}%`);
    }
    if (startDate) {
      conditions.push('t.created_at >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('t.created_at <= ?');
      params.push(endDate);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    if (search) {
      conditions.push('(t.trace_id LIKE ? OR t.request_id LIKE ? OR t.user_id LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const traces = await dbAllAsync(this.db, sql, params);

    // 为每条记录附加 flow_nodes 和 risk_hits
    for (const trace of traces) {
      trace.flow_nodes = await this.listFlowNodes(trace.trace_id);
      trace.risk_hits = await this.listRiskHits(trace.trace_id);
    }

    return traces;
  }

  async getTraceById(traceId) {
    const trace = await dbGetAsync(
      this.db,
      'SELECT * FROM ai_traces WHERE trace_id = ?',
      [traceId]
    );

    if (!trace) return null;

    trace.flow_nodes = await this.listFlowNodes(traceId);
    trace.risk_hits = await this.listRiskHits(traceId);

    return trace;
  }

  async createTrace(trace) {
    const now = new Date().toISOString();
    await dbRunAsync(
      this.db,
      `INSERT INTO ai_traces (
        trace_id, session_id, request_id, user_id, instance_id,
        requested_model, actual_model, provider_type, status,
        prompt_tokens, completion_tokens, latency_ms,
        input_cost, output_cost, estimated_cost,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trace.trace_id, trace.session_id, trace.request_id, trace.user_id || null, trace.instance_id || null,
        trace.requested_model || 'auto', trace.actual_model || null, trace.provider_type || null, trace.status,
        trace.prompt_tokens, trace.completion_tokens, trace.latency_ms || 0,
        trace.input_cost || 0, trace.output_cost || 0, trace.estimated_cost || 0,
        now
      ]
    );
    return trace;
  }

  // ============================================
  // AI Gateway - Flow 节点
  // ============================================

  async listFlowNodes(traceId) {
    return await dbAllAsync(
      this.db,
      'SELECT * FROM ai_flow_nodes WHERE trace_id = ? ORDER BY created_at ASC',
      [traceId]
    );
  }

  async createFlowNode(node) {
    const now = new Date().toISOString();
    await dbRunAsync(
      this.db,
      `INSERT INTO ai_flow_nodes (
        trace_id, node_id, kind, title, model, status,
        summary, input_payload, output_payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        node.trace_id, node.node_id, node.kind, node.title || null,
        node.model || null, node.status || null, node.summary || null,
        node.input_payload ? JSON.stringify(node.input_payload) : null,
        node.output_payload ? JSON.stringify(node.output_payload) : null,
        now
      ]
    );
    return node;
  }

  async createFlowNodesBatch(nodes) {
    const now = new Date().toISOString();
    for (const node of nodes) {
      await this.createFlowNode({
        ...node,
        created_at: now
      });
    }
  }

  // ============================================
  // AI Gateway - Risk Hits
  // ============================================

  async listRiskHits(traceId) {
    return await dbAllAsync(
      this.db,
      'SELECT * FROM ai_risk_hits WHERE trace_id = ? ORDER BY created_at ASC',
      [traceId]
    );
  }

  async createRiskHits(traceId, hits) {
    const now = new Date().toISOString();
    for (const hit of hits) {
      await dbRunAsync(
        this.db,
        `INSERT INTO ai_risk_hits (trace_id, rule_id, rule_name, severity, action, match_summary, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [traceId, hit.rule_id, hit.rule_name, hit.severity, hit.action, hit.match_summary, now]
      );
    }
    return hits;
  }

  // ============================================
  // 统计汇总
  // ============================================

  async getTraceStats() {
    const stats = await dbGetAsync(
      this.db,
      `SELECT
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(total_tokens) as total_tokens,
        SUM(input_cost + output_cost) as total_cost
       FROM ai_traces`
    );

    return {
      completed: stats.completed || 0,
      blocked: stats.blocked || 0,
      failed: stats.failed || 0,
      total_tokens: stats.total_tokens || 0,
      total_cost: stats.total_cost || 0,
      total_traces: stats.total_traces || 0
    };
  }

  async getCostSummary(options = {}) {
    const { userId, model, startDate, endDate, limit = 100, offset = 0 } = options;

    let sql = `
      SELECT
        SUM(prompt_tokens) as total_prompt_tokens,
        SUM(completion_tokens) as total_completion_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(cost_cny) as total_cost,
        COUNT(*) as count,
        user_id,
        model
      FROM ai_traces
    `;
    const params = [];
    const conditions = [];

    if (userId) { conditions.push('user_id = ?'); params.push(userId); }
    if (model) { conditions.push('model = ?'); params.push(model); }
    if (startDate) { conditions.push('created_at >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('created_at <= ?'); params.push(endDate); }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY user_id, model ORDER BY total_tokens DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const userSummaries = await dbAllAsync(this.db, sql, params);

    return {
      user_summary: userSummaries,
      model_summary: userSummaries.map(s => ({ model: s.model, count: s.count, total_tokens: s.total_tokens, estimated_cost: s.total_cost })),
      total_prompt_tokens: userSummaries.reduce((sum, s) => sum + (s.total_prompt_tokens || 0), 0),
      total_completion_tokens: userSummaries.reduce((sum, s) => sum + (s.total_completion_tokens || 0), 0),
      total_tokens: userSummaries.reduce((sum, s) => sum + (s.total_tokens || 0), 0),
      total_estimated_cost: userSummaries.reduce((sum, s) => sum + (s.total_cost || 0), 0)
    };
  }

  // ============================================
  // 系统配置
  // ============================================

  async getSystemConfig(key) {
    const result = await dbGetAsync(
      this.db,
      'SELECT value FROM system_configs WHERE key = ?',
      [key]
    );
    return result ? result.value : null;
  }

  async setSystemConfig(key, value) {
    await dbRunAsync(
      this.db,
      `INSERT OR REPLACE INTO system_configs (key, value, updated_at) VALUES (?, ?, ?)`,
      [key, value, new Date().toISOString()]
    );
    return true;
  }

  async getAllSystemConfigs() {
    return await dbAllAsync(
      this.db,
      'SELECT * FROM system_configs'
    );
  }
}

module.exports = SqliteStore;

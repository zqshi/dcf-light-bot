class MatrixBot {
  constructor(config, logger, instanceService, deps = {}) {
    this.config = config;
    this.logger = logger;
    this.instanceService = instanceService;
    this.runtimeProxyService = deps.runtimeProxyService || null;
    this.resolveIdentityProfile = typeof deps.resolveIdentityProfile === 'function' ? deps.resolveIdentityProfile : null;
    this.auditService = deps.auditService || null;
    this.documentService = deps.documentService || null;
    this.weKnoraService = deps.weKnoraService || null;
    this._ragCooldowns = new Map(); // sender → lastTimestamp
    this.simulation = !String(config.matrixAccessToken || '').trim();
  }

  async audit(type, payload = {}) {
    if (!this.auditService || typeof this.auditService.log !== 'function') return;
    await this.auditService.log(type, payload);
  }

  renderStatusMessage(input = {}) {
    const action = String(input.action || 'unknown');
    const phase = String(input.phase || 'unknown');
    const traceId = String(input.traceId || '');
    const message = String(input.message || '');
    const lines = [
      '【任务状态】',
      `- action: ${action}`,
      `- phase: ${phase}`
    ];
    if (traceId) lines.push(`- traceId: ${traceId}`);
    if (input.requestId) lines.push(`- requestId: ${String(input.requestId)}`);
    if (message) lines.push(`- message: ${message}`);
    if (input.instanceId) lines.push(`- instanceId: ${String(input.instanceId)}`);
    if (input.roomId) lines.push(`- roomId: ${String(input.roomId)}`);
    if (input.chatUrl) lines.push(`- chatUrl: ${String(input.chatUrl)}`);
    return lines.join('\n');
  }

  renderCardMessage(card = {}, traceId = '') {
    const actions = Array.isArray(card.actions) ? card.actions : [];
    const openChat = actions.find((x) => String(x.type || '') === 'open_chat');
    return this.renderStatusMessage({
      action: 'create_agent',
      phase: 'succeeded',
      traceId,
      message: '数字员工实例创建完成，可直接进入会话。',
      instanceId: card.instanceId,
      roomId: card.matrixRoomId,
      chatUrl: (openChat && openChat.url) || card.chatUrl || ''
    });
  }

  async start() {
    this.logger.info('matrix bot started', {
      simulation: this.simulation,
      userId: this.config.matrixUserId
    });
    await this.audit('matrix.bot.started', {
      simulation: this.simulation,
      userId: this.config.matrixUserId
    });
  }

  async stop() {
    this.logger.info('matrix bot stopped');
    await this.audit('matrix.bot.stopped', {
      simulation: this.simulation,
      userId: this.config.matrixUserId
    });
  }

  async processTextMessage(sender, roomId, text, meta = {}) {
    const body = String(text || '').trim();
    if (!body) return { ignored: true };
    const isCommand = body.startsWith('!');
    const tokens = body.split(/\s+/);
    const cmd = isCommand ? String(tokens[0] || '').toLowerCase() : '';
    const traceId = `mx:cmd:${roomId}:${sender}:${Date.now()}`;

    if (!isCommand) {
      const passthrough = await this.processChannelMessage(sender, roomId, body, traceId);
      if (passthrough) return passthrough;
      // Natural language RAG query intent
      const ragResult = await this.tryHandleNaturalRagIntent(sender, roomId, body, traceId);
      if (ragResult) return ragResult;
      const created = await this.tryHandleNaturalCreateIntent(sender, roomId, body, traceId, meta);
      if (created) return created;
      return { ignored: true };
    }

    await this.audit('matrix.command.received', {
      traceId,
      sender,
      roomId,
      command: cmd,
      text: body
    });

    if (cmd === '!create_agent') {
      const name = tokens.slice(1).join(' ').trim();
      if (!name) {
        const reply = this.renderStatusMessage({
          action: 'create_agent',
          phase: 'failed',
          traceId,
          roomId,
          message: '用法: !create_agent <员工名称>'
        });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason: 'invalid_args' });
        return { ignored: false, reply, phase: 'failed', traceId };
      }
      const requestId = this.buildProvisionRequestId({ roomId, sender, name, eventId: meta.eventId });
      try {
        const creatorProfile = await this.buildCreatorProfile(sender, {});
        const instance = await this.instanceService.createFromMatrix({
          name,
          creator: sender,
          matrixRoomId: roomId,
          requestId,
          employeeProfile: creatorProfile
        });
        const card = this.instanceService.buildMatrixCard(instance);
        const reply = this.renderCardMessage(card, traceId);
        await this.audit('matrix.command.handled', {
          traceId,
          command: cmd,
          phase: 'succeeded',
          instanceId: instance.id,
          roomId
        });
        return {
          ignored: false,
          reply: `${reply}\n- requestId: ${requestId}`,
          card,
          phase: 'succeeded',
          traceId
        };
      } catch (error) {
        const reason = String(error && error.message ? error.message : 'create failed');
        const reply = this.renderStatusMessage({
          action: 'create_agent',
          phase: 'failed',
          traceId,
          roomId,
          message: reason
        });
        await this.audit('matrix.command.handled', {
          traceId,
          command: cmd,
          phase: 'failed',
          roomId,
          reason
        });
        return { ignored: false, reply, phase: 'failed', traceId };
      }
    }

    if (cmd === '!list_agents') {
      const rows = await this.instanceService.list();
      const lines = rows.map((x) => `- ${x.name} | ${x.id} | ${x.state}`);
      await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'succeeded', rows: rows.length, roomId });
      return {
        ignored: false,
        reply: this.renderStatusMessage({
          action: 'list_agents',
          phase: 'succeeded',
          traceId,
          roomId,
          message: lines.length ? `共 ${rows.length} 个数字员工` : '暂无数字员工'
        }) + (lines.length ? `\n${lines.join('\n')}` : ''),
        phase: 'succeeded',
        traceId
      };
    }

    if (cmd === '!agent_status') {
      const id = String(tokens[1] || '').trim();
      if (!id) {
        const reply = this.renderStatusMessage({
          action: 'agent_status',
          phase: 'failed',
          traceId,
          roomId,
          message: '用法: !agent_status <instanceId>'
        });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason: 'invalid_args' });
        return { ignored: false, reply, phase: 'failed', traceId };
      }
      const row = await this.instanceService.get(id);
      await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'succeeded', instanceId: row.id, roomId });
      return {
        ignored: false,
        reply: this.renderStatusMessage({
          action: 'agent_status',
          phase: 'succeeded',
          traceId,
          roomId,
          message: `${row.name} | ${row.id} | ${row.state} | ${row.runtime.endpoint || '-'}`
        }),
        phase: 'succeeded',
        traceId
      };
    }

    if (cmd === '!job_status') {
      const requestId = String(tokens[1] || '').trim();
      if (!requestId) {
        const reply = this.renderStatusMessage({
          action: 'job_status',
          phase: 'failed',
          traceId,
          roomId,
          message: '用法: !job_status <requestId>'
        });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason: 'invalid_args' });
        return { ignored: false, reply, phase: 'failed', traceId };
      }
      if (!this.instanceService || typeof this.instanceService.getProvisioningJob !== 'function') {
        const reply = this.renderStatusMessage({
          action: 'job_status',
          phase: 'failed',
          traceId,
          roomId,
          requestId,
          message: '当前服务未启用任务状态查询。'
        });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason: 'service_unavailable' });
        return { ignored: false, reply, phase: 'failed', traceId };
      }
      try {
        const job = await this.instanceService.getProvisioningJob(requestId);
        const reply = this.renderStatusMessage({
          action: 'job_status',
          phase: String(job.status || job.phase || 'unknown'),
          traceId,
          roomId,
          requestId,
          instanceId: String(job.instanceId || ''),
          message: `phase=${String(job.phase || 'unknown')} attempts=${Number(job.attempts || 0)}${job.error ? ` error=${String(job.error)}` : ''}`
        });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'succeeded', requestId, roomId });
        return { ignored: false, reply, phase: 'succeeded', traceId };
      } catch (error) {
        const reason = String(error && error.message ? error.message : 'job lookup failed');
        const reply = this.renderStatusMessage({
          action: 'job_status',
          phase: 'failed',
          traceId,
          roomId,
          requestId,
          message: reason
        });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason, requestId, roomId });
        return { ignored: false, reply, phase: 'failed', traceId };
      }
    }

    if (cmd === '!start_agent') {
      const id = String(tokens[1] || '').trim();
      if (!id) {
        const reply = this.renderStatusMessage({
          action: 'start_agent',
          phase: 'failed',
          traceId,
          roomId,
          message: '用法: !start_agent <instanceId>'
        });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason: 'invalid_args' });
        return { ignored: false, reply, phase: 'failed', traceId };
      }
      const row = await this.instanceService.start(id);
      await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'succeeded', instanceId: row.id, roomId });
      return {
        ignored: false,
        reply: this.renderStatusMessage({
          action: 'start_agent',
          phase: 'succeeded',
          traceId,
          roomId,
          instanceId: row.id,
          message: `已启动 (${row.state})`
        }),
        phase: 'succeeded',
        traceId
      };
    }

    if (cmd === '!stop_agent') {
      const id = String(tokens[1] || '').trim();
      if (!id) {
        const reply = this.renderStatusMessage({
          action: 'stop_agent',
          phase: 'failed',
          traceId,
          roomId,
          message: '用法: !stop_agent <instanceId>'
        });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason: 'invalid_args' });
        return { ignored: false, reply, phase: 'failed', traceId };
      }
      const row = await this.instanceService.stop(id);
      await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'succeeded', instanceId: row.id, roomId });
      return {
        ignored: false,
        reply: this.renderStatusMessage({
          action: 'stop_agent',
          phase: 'succeeded',
          traceId,
          roomId,
          instanceId: row.id,
          message: `已停止 (${row.state})`
        }),
        phase: 'succeeded',
        traceId
      };
    }

    if (cmd === '!create_doc') {
      const title = tokens.slice(1).join(' ').trim();
      if (!title) {
        const r = this.renderStatusMessage({ action: 'create_doc', phase: 'failed', traceId, roomId, message: '用法: !create_doc <标题>' });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason: 'invalid_args' });
        return { ignored: false, reply: r, phase: 'failed', traceId };
      }
      if (!this.documentService) {
        const r = this.renderStatusMessage({ action: 'create_doc', phase: 'failed', traceId, roomId, message: '文档服务未启用' });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason: 'service_unavailable' });
        return { ignored: false, reply: r, phase: 'failed', traceId };
      }
      try {
        const doc = await this.documentService.create({ title, roomId, type: 'doc', createdBy: sender, content: { html: '' } });
        const r = this.renderStatusMessage({ action: 'create_doc', phase: 'succeeded', traceId, roomId, message: `文档「${doc.title}」已创建 (id: ${doc.id})` });
        const drawerContent = { type: 'doc', title: doc.title, data: { docId: doc.id, html: '' } };
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'succeeded', documentId: doc.id, roomId });
        return { ignored: false, reply: r, phase: 'succeeded', traceId, drawerContent };
      } catch (error) {
        const reason = String(error && error.message || 'create_doc failed');
        const r = this.renderStatusMessage({ action: 'create_doc', phase: 'failed', traceId, roomId, message: reason });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason, roomId });
        return { ignored: false, reply: r, phase: 'failed', traceId };
      }
    }

    if (cmd === '!share_doc') {
      const docId = String(tokens[1] || '').trim();
      if (!docId) {
        const r = this.renderStatusMessage({ action: 'share_doc', phase: 'failed', traceId, roomId, message: '用法: !share_doc <docId>' });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason: 'invalid_args' });
        return { ignored: false, reply: r, phase: 'failed', traceId };
      }
      if (!this.documentService) {
        const r = this.renderStatusMessage({ action: 'share_doc', phase: 'failed', traceId, roomId, message: '文档服务未启用' });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason: 'service_unavailable' });
        return { ignored: false, reply: r, phase: 'failed', traceId };
      }
      try {
        const doc = await this.documentService.get(docId);
        const r = this.renderStatusMessage({ action: 'share_doc', phase: 'succeeded', traceId, roomId, message: `分享文档「${doc.title}」(id: ${doc.id})` });
        const drawerContent = { type: doc.type, title: doc.title, data: { docId: doc.id, ...doc.content } };
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'succeeded', documentId: doc.id, roomId });
        return { ignored: false, reply: r, phase: 'succeeded', traceId, drawerContent };
      } catch (error) {
        const reason = String(error && error.message || 'share_doc failed');
        const r = this.renderStatusMessage({ action: 'share_doc', phase: 'failed', traceId, roomId, message: reason });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason, roomId });
        return { ignored: false, reply: r, phase: 'failed', traceId };
      }
    }

    if (cmd === '!ask') {
      const question = tokens.slice(1).join(' ').trim();
      if (!question) {
        const r = this.renderStatusMessage({ action: 'ask', phase: 'failed', traceId, roomId, message: '用法: !ask <问题>' });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason: 'invalid_args' });
        return { ignored: false, reply: r, phase: 'failed', traceId };
      }
      if (!this.weKnoraService) {
        const r = this.renderStatusMessage({ action: 'ask', phase: 'failed', traceId, roomId, message: 'RAG 知识库服务未启用' });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason: 'service_unavailable' });
        return { ignored: false, reply: r, phase: 'failed', traceId };
      }
      // Rate limit: 5s cooldown per sender
      const now = Date.now();
      const lastAsk = this._ragCooldowns.get(sender) || 0;
      if (now - lastAsk < 5000) {
        const r = this.renderStatusMessage({ action: 'ask', phase: 'failed', traceId, roomId, message: '操作太频繁，请稍后再试' });
        return { ignored: false, reply: r, phase: 'failed', traceId };
      }
      this._ragCooldowns.set(sender, now);
      try {
        const result = await this.weKnoraService.query(question);
        const sourcesText = result.sources.length
          ? '\n\n📚 参考来源:\n' + result.sources.map((s) => `- ${s.title || s.id}`).join('\n')
          : '';
        const r = this.renderStatusMessage({
          action: 'ask', phase: 'succeeded', traceId, roomId,
          message: `${result.answer}${sourcesText}`
        });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'succeeded', roomId });
        return { ignored: false, reply: r, phase: 'succeeded', traceId };
      } catch (error) {
        const reason = String(error && error.message || 'RAG query failed');
        const r = this.renderStatusMessage({ action: 'ask', phase: 'failed', traceId, roomId, message: reason });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason, roomId });
        return { ignored: false, reply: r, phase: 'failed', traceId };
      }
    }

    if (cmd === '!search_kb') {
      const keyword = tokens.slice(1).join(' ').trim();
      if (!keyword) {
        const r = this.renderStatusMessage({ action: 'search_kb', phase: 'failed', traceId, roomId, message: '用法: !search_kb <关键词>' });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason: 'invalid_args' });
        return { ignored: false, reply: r, phase: 'failed', traceId };
      }
      if (!this.weKnoraService) {
        const r = this.renderStatusMessage({ action: 'search_kb', phase: 'failed', traceId, roomId, message: 'RAG 知识库服务未启用' });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason: 'service_unavailable' });
        return { ignored: false, reply: r, phase: 'failed', traceId };
      }
      try {
        const results = await this.weKnoraService.search(keyword);
        const lines = results.slice(0, 10).map((r) => `- ${r.title || '未命名'} (score: ${Number(r.score || 0).toFixed(2)})`);
        const msg = lines.length ? `找到 ${results.length} 条结果:\n${lines.join('\n')}` : '未找到匹配的知识条目';
        const r = this.renderStatusMessage({ action: 'search_kb', phase: 'succeeded', traceId, roomId, message: msg });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'succeeded', roomId, resultCount: results.length });
        return { ignored: false, reply: r, phase: 'succeeded', traceId };
      } catch (error) {
        const reason = String(error && error.message || 'search failed');
        const r = this.renderStatusMessage({ action: 'search_kb', phase: 'failed', traceId, roomId, message: reason });
        await this.audit('matrix.command.handled', { traceId, command: cmd, phase: 'failed', reason, roomId });
        return { ignored: false, reply: r, phase: 'failed', traceId };
      }
    }

    const reply = this.renderStatusMessage({
      action: cmd.replace(/^!/, ''),
      phase: 'failed',
      traceId,
      roomId,
      message: '未知命令。可用命令: !create_agent !list_agents !agent_status !job_status !start_agent !stop_agent !create_doc !share_doc !ask !search_kb'
    });
    await this.audit('matrix.command.handled', {
      traceId,
      command: cmd,
      phase: 'failed',
      roomId,
      reason: 'unknown_command'
    });
    return { ignored: false, reply, phase: 'failed', traceId };
  }

  async resolveInstanceByRoomId(roomId) {
    const key = String(roomId || '').trim();
    if (!key) return null;
    const rows = await this.instanceService.list();
    const matched = rows.filter((x) => String((x && x.matrixRoomId) || '').trim() === key);
    if (!matched.length) return null;
    const running = matched.find((x) => String(x.state || '').toLowerCase() === 'running');
    return running || matched[0];
  }

  async processChannelMessage(sender, roomId, body, traceId) {
    const instance = await this.resolveInstanceByRoomId(roomId);
    if (!instance) return null;
    const mode = this.resolveConversationMode();
    if (mode === 'openclaw_channel') {
      await this.audit('matrix.channel.delegated', {
        traceId,
        roomId,
        sender,
        instanceId: instance.id,
        mode
      });
      return { ignored: true, delegated: true, phase: 'delegated', traceId };
    }
    if (!this.runtimeProxyService || typeof this.runtimeProxyService.invoke !== 'function') {
      return {
        ignored: false,
        phase: 'failed',
        traceId,
        reply: 'runtime proxy 未启用，当前无法转发到数字员工实例。'
      };
    }
    try {
      const invokeOut = await this.runtimeProxyService.invoke(instance.id, {
        input: body,
        source: 'matrix',
        sender,
        roomId,
        channel: 'matrix'
      });
      const reply = this.extractAssistantText(invokeOut) || this.summarizeInvokeResult(invokeOut);
      await this.audit('matrix.channel.passthrough.succeeded', {
        traceId,
        roomId,
        sender,
        instanceId: instance.id,
        mode: String(invokeOut && invokeOut.mode || '')
      });
      const drawerContent = this.detectDrawerContent(reply);
      return { ignored: false, phase: 'succeeded', traceId, reply, data: invokeOut, drawerContent };
    } catch (error) {
      const reason = String(error && error.message ? error.message : 'runtime invoke failed');
      await this.audit('matrix.channel.passthrough.failed', {
        traceId,
        roomId,
        sender,
        instanceId: instance.id,
        reason
      });
      return {
        ignored: false,
        phase: 'failed',
        traceId,
        reply: `执行失败：${reason}。请稍后重试或联系管理员。`
      };
    }
  }

  resolveConversationMode() {
    const raw = String(this.config.matrixConversationMode || '').trim().toLowerCase();
    if (raw === 'runtime_proxy') return 'runtime_proxy';
    return 'openclaw_channel';
  }

  buildProvisionRequestId({ roomId, sender, name, eventId }) {
    const e = String(eventId || '').trim();
    if (e) return `mx:event:${e}`;
    const seed = `${String(roomId || '').trim()}|${String(sender || '').trim()}|${String(name || '').trim()}|${Date.now()}`;
    return `mx:create:${this.hashText(seed)}`;
  }

  hashText(text) {
    const raw = String(text || '');
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i += 1) {
      hash ^= raw.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  isNaturalCreateIntent(text) {
    const raw = String(text || '').trim().toLowerCase();
    if (!raw) return false;
    const zh = raw.includes('创建') || raw.includes('新建') || raw.includes('生成');
    const target = raw.includes('数字员工') || raw.includes('agent') || raw.includes('机器人') || raw.includes('bot');
    const en = /create\s+(a|an)?\s*(digital\s*)?(agent|employee|bot)/i.test(raw);
    return (zh && target) || en;
  }

  async tryHandleNaturalCreateIntent(sender, roomId, body, traceId, meta = {}) {
    if (!this.isNaturalCreateIntent(body)) return null;
    const parsedName = this.extractEmployeeName(body);
    const inferredJob = this.inferJobTitle(body);
    const name = parsedName || this.defaultEmployeeName(body);
    const requestId = this.buildProvisionRequestId({ roomId, sender, name, eventId: meta.eventId });
    try {
      const creatorProfile = await this.buildCreatorProfile(sender, { jobTitle: inferredJob });
      const instance = await this.instanceService.createFromMatrix({
        name,
        creator: sender,
        matrixRoomId: roomId,
        requestId,
        employeeProfile: creatorProfile
      });
      const card = this.instanceService.buildMatrixCard(instance);
      const reply = `${this.renderCardMessage(card, traceId)}\n- requestId: ${requestId}`;
      await this.audit('matrix.intent.create_agent.handled', {
        traceId,
        roomId,
        sender,
        requestId,
        phase: 'succeeded',
        instanceId: instance.id
      });
      return { ignored: false, reply, card, phase: 'succeeded', traceId };
    } catch (error) {
      const reason = String(error && error.message ? error.message : 'create failed');
      await this.audit('matrix.intent.create_agent.handled', {
        traceId,
        roomId,
        sender,
        requestId,
        phase: 'failed',
        reason
      });
      return {
        ignored: false,
        phase: 'failed',
        traceId,
        reply: this.renderStatusMessage({
          action: 'create_agent',
          phase: 'failed',
          traceId,
          requestId,
          roomId,
          message: reason
        })
      };
    }
  }

  isNaturalRagIntent(text) {
    const raw = String(text || '').trim().toLowerCase();
    if (!raw || raw.length < 6) return false;
    // Require BOTH an action verb AND a knowledge-related target noun
    const actionWords = ['帮我查', '查一下', '搜索一下', '找一下', '检索'];
    const targetWords = ['知识库', '文档', '资料', '规范', '流程', '规划', '方案', '报告'];
    const hasAction = actionWords.some((w) => raw.includes(w));
    const hasTarget = targetWords.some((w) => raw.includes(w));
    return hasAction && hasTarget;
  }

  async tryHandleNaturalRagIntent(sender, roomId, body, traceId) {
    if (!this.weKnoraService || !this.isNaturalRagIntent(body)) return null;
    try {
      const result = await this.weKnoraService.query(body);
      if (!result.answer) return null;
      const sourcesText = result.sources.length
        ? '\n\n📚 参考来源:\n' + result.sources.map((s) => `- ${s.title || s.id}`).join('\n')
        : '';
      const reply = `${result.answer}${sourcesText}`;
      await this.audit('matrix.intent.rag.handled', { traceId, roomId, sender, phase: 'succeeded' });
      return { ignored: false, reply, phase: 'succeeded', traceId };
    } catch {
      return null; // Fall through to other handlers
    }
  }

  detectDrawerContent(reply) {
    if (!reply) return undefined;
    const codeBlockMatch = String(reply).match(/```(\w*)\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      const language = codeBlockMatch[1] || 'plaintext';
      const code = codeBlockMatch[2].trim();
      return { type: 'code', title: `代码片段 (${language})`, data: { code, language } };
    }
    return undefined;
  }

  extractAssistantText(invokeOut) {
    const out = invokeOut && typeof invokeOut === 'object' ? invokeOut : {};
    const response = out.response && typeof out.response === 'object' ? out.response : {};
    const candidates = [
      response.output,
      response.text,
      response.message,
      response.result,
      response.summary
    ];
    for (const item of candidates) {
      const text = String(item || '').trim();
      if (text) return text;
    }
    return '';
  }

  summarizeInvokeResult(invokeOut) {
    const out = invokeOut && typeof invokeOut === 'object' ? invokeOut : {};
    if (String(out.mode || '').toLowerCase() === 'degraded') {
      return '当前处于降级模式，任务已受理但可能延迟执行。';
    }
    const payload = out.response && typeof out.response === 'object' ? out.response : {};
    const candidates = [payload.output, payload.message, payload.result, payload.summary];
    for (const item of candidates) {
      const text = String(item || '').trim();
      if (!text) continue;
      const short = text.length > 120 ? `${text.slice(0, 120)}...` : text;
      return `执行摘要: ${short}`;
    }
    return '任务已进入执行链路。';
  }

  extractEmployeeName(text) {
    const raw = String(text || '').trim();
    const patterns = [
      /(?:叫|名为|名字是)\s*["“]?([a-zA-Z0-9_\-\u4e00-\u9fa5]{2,40})["”]?/i,
      /(?:create|new)\s+(?:an?\s+)?(?:agent|bot|employee)\s+(?:named\s+)?["“]?([a-zA-Z0-9_\-\u4e00-\u9fa5]{2,40})["”]?/i
    ];
    for (const p of patterns) {
      const m = raw.match(p);
      if (m && m[1]) return String(m[1]).trim();
    }
    return '';
  }

  defaultEmployeeName(text) {
    const job = this.inferJobTitle(text);
    if (job && job !== '通用岗位') return `${job}数字员工`;
    return `数字员工-${Date.now().toString().slice(-6)}`;
  }

  inferJobTitle(text) {
    const raw = String(text || '').toLowerCase();
    const map = [
      ['采购', '采购专员'],
      ['财务', '财务专员'],
      ['法务', '法务专员'],
      ['人事', '人事专员'],
      ['hr', '人事专员'],
      ['运维', '运维工程师'],
      ['开发', '开发工程师'],
      ['engineer', '开发工程师'],
      ['测试', '测试工程师'],
      ['qa', '测试工程师'],
      ['产品', '产品经理'],
      ['运营', '运营专员'],
      ['销售', '销售专员']
    ];
    for (const [k, title] of map) {
      if (raw.includes(k)) return title;
    }
    return '通用岗位';
  }

  toJobCode(jobTitle) {
    const title = String(jobTitle || '');
    if (title.includes('采购')) return 'procurement';
    if (title.includes('财务')) return 'finance';
    if (title.includes('法务')) return 'legal';
    if (title.includes('人事')) return 'hr';
    if (title.includes('运维')) return 'ops';
    if (title.includes('开发')) return 'dev';
    if (title.includes('测试')) return 'qa';
    if (title.includes('产品')) return 'pm';
    if (title.includes('运营')) return 'ops';
    if (title.includes('销售')) return 'sales';
    return 'general';
  }

  normalizeLocalpart(userId) {
    const raw = String(userId || '').trim();
    const noAt = raw.startsWith('@') ? raw.slice(1) : raw;
    const idx = noAt.indexOf(':');
    return (idx >= 0 ? noAt.slice(0, idx) : noAt).replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 64);
  }

  async buildCreatorProfile(sender, intent = {}) {
    const localpart = this.normalizeLocalpart(sender) || 'employee';
    const jobTitle = String(intent.jobTitle || '').trim() || '通用岗位';
    const fallback = {
      email: `${localpart}@digital-employee.local`,
      jobTitle,
      jobCode: this.toJobCode(jobTitle),
      department: jobTitle.includes('财务')
        ? 'finance'
        : jobTitle.includes('采购')
          ? 'procurement'
          : jobTitle.includes('法务')
            ? 'legal'
            : 'general'
    };
    if (!this.resolveIdentityProfile) return fallback;
    try {
      const resolved = await this.resolveIdentityProfile(sender);
      if (!resolved || typeof resolved !== 'object') return fallback;
      return {
        ...fallback,
        ...resolved,
        email: String(resolved.email || fallback.email || '').trim(),
        jobTitle: String(resolved.jobTitle || fallback.jobTitle || '').trim(),
        jobCode: String(resolved.jobCode || fallback.jobCode || '').trim(),
        department: String(resolved.department || fallback.department || '').trim(),
        employeeNo: String(resolved.employeeNo || '').trim(),
        employeeId: String(resolved.employeeId || '').trim(),
        enterpriseUserId: String(resolved.enterpriseUserId || '').trim()
      };
    } catch {
      return fallback;
    }
  }
}

module.exports = { MatrixBot };

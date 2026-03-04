class MatrixBot {
  constructor(config, logger, instanceService, deps = {}) {
    this.config = config;
    this.logger = logger;
    this.instanceService = instanceService;
    this.auditService = deps.auditService || null;
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

  async processTextMessage(sender, roomId, text) {
    const body = String(text || '').trim();
    if (!body.startsWith('!')) return { ignored: true };

    const tokens = body.split(/\s+/);
    const cmd = String(tokens[0] || '').toLowerCase();
    const traceId = `mx:cmd:${roomId}:${sender}:${Date.now()}`;
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
      const requestId = `mx:create:${roomId}:${sender}:${name}`;
      try {
        const instance = await this.instanceService.createFromMatrix({
          name,
          creator: sender,
          matrixRoomId: roomId,
          requestId
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
          reply,
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

    const reply = this.renderStatusMessage({
      action: cmd.replace(/^!/, ''),
      phase: 'failed',
      traceId,
      roomId,
      message: '未知命令。可用命令: !create_agent !list_agents !agent_status !start_agent !stop_agent'
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
}

module.exports = { MatrixBot };

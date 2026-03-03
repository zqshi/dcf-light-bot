class MatrixBot {
  constructor(config, logger, instanceService) {
    this.config = config;
    this.logger = logger;
    this.instanceService = instanceService;
    this.simulation = !String(config.matrixAccessToken || '').trim();
  }

  async start() {
    this.logger.info('matrix bot started', {
      simulation: this.simulation,
      userId: this.config.matrixUserId
    });
  }

  async stop() {
    this.logger.info('matrix bot stopped');
  }

  async processTextMessage(sender, roomId, text) {
    const body = String(text || '').trim();
    if (!body.startsWith('!')) return { ignored: true };

    const tokens = body.split(/\s+/);
    const cmd = String(tokens[0] || '').toLowerCase();

    if (cmd === '!create_agent') {
      const name = tokens.slice(1).join(' ').trim();
      if (!name) return { ignored: false, reply: '用法: !create_agent <员工名称>' };
      const requestId = `mx:create:${roomId}:${sender}:${name}`;
      const instance = await this.instanceService.createFromMatrix({
        name,
        creator: sender,
        matrixRoomId: roomId,
        requestId
      });
      const card = this.instanceService.buildMatrixCard(instance);
      return { ignored: false, reply: JSON.stringify(card, null, 2), card };
    }

    if (cmd === '!list_agents') {
      const rows = await this.instanceService.list();
      const lines = rows.map((x) => `- ${x.name} | ${x.id} | ${x.state}`);
      return {
        ignored: false,
        reply: lines.length ? lines.join('\n') : '暂无数字员工'
      };
    }

    if (cmd === '!agent_status') {
      const id = String(tokens[1] || '').trim();
      if (!id) return { ignored: false, reply: '用法: !agent_status <instanceId>' };
      const row = await this.instanceService.get(id);
      return { ignored: false, reply: `${row.name} | ${row.id} | ${row.state} | ${row.runtime.endpoint}` };
    }

    if (cmd === '!start_agent') {
      const id = String(tokens[1] || '').trim();
      if (!id) return { ignored: false, reply: '用法: !start_agent <instanceId>' };
      const row = await this.instanceService.start(id);
      return { ignored: false, reply: `已启动: ${row.id} (${row.state})` };
    }

    if (cmd === '!stop_agent') {
      const id = String(tokens[1] || '').trim();
      if (!id) return { ignored: false, reply: '用法: !stop_agent <instanceId>' };
      const row = await this.instanceService.stop(id);
      return { ignored: false, reply: `已停止: ${row.id} (${row.state})` };
    }

    return { ignored: false, reply: '未知命令。可用命令: !create_agent !list_agents !agent_status !start_agent !stop_agent' };
  }
}

module.exports = { MatrixBot };

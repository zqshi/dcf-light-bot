const { MatrixBot } = require('../src/integrations/matrix/MatrixBot');

describe('MatrixBot commands', () => {
  test('supports list and status commands', async () => {
    const bot = new MatrixBot(
      { matrixAccessToken: '', matrixUserId: '@bot:matrix' },
      { info: () => {} },
      {
        list: async () => [{ name: 'a', id: 'inst_a', state: 'running', runtime: { endpoint: 'x' } }],
        get: async () => ({ name: 'a', id: 'inst_a', state: 'running', runtime: { endpoint: 'x' } }),
        start: async () => ({ id: 'inst_a', state: 'running' }),
        stop: async () => ({ id: 'inst_a', state: 'stopped' }),
        createFromMatrix: async () => ({ id: 'inst_a', tenantId: 'tenant_a', name: 'a', state: 'running', runtime: { endpoint: 'x' }, createdAt: 'now' }),
        buildMatrixCard: () => ({
          schema: 'dcf.employee-card/v1',
          cardType: 'digital_employee',
          instanceId: 'inst_a',
          matrixRoomId: '!r:matrix',
          chatUrl: 'http://localhost/chat/inst_a',
          actions: [{ type: 'open_chat', label: '进入会话', url: 'http://localhost/chat/inst_a' }]
        })
      }
    );

    const create = await bot.processTextMessage('@u:matrix', '!r:matrix', '!create_agent a');
    expect(create.phase).toBe('succeeded');
    expect(create.reply.includes('【任务状态】')).toBe(true);
    expect(create.reply.includes('action: create_agent')).toBe(true);
    expect(create.reply.includes('phase: succeeded')).toBe(true);

    const list = await bot.processTextMessage('@u:matrix', '!r:matrix', '!list_agents');
    expect(list.reply.includes('inst_a')).toBe(true);

    const status = await bot.processTextMessage('@u:matrix', '!r:matrix', '!agent_status inst_a');
    expect(status.reply.includes('inst_a')).toBe(true);

    const start = await bot.processTextMessage('@u:matrix', '!r:matrix', '!start_agent inst_a');
    expect(start.reply.includes('已启动')).toBe(true);

    const stop = await bot.processTextMessage('@u:matrix', '!r:matrix', '!stop_agent inst_a');
    expect(stop.reply.includes('已停止')).toBe(true);
  });
});

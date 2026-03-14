const { MatrixBot } = require('../src/integrations/matrix/MatrixBot');

describe('MatrixBot commands', () => {
  test('supports list and status commands', async () => {
    const createCalls = [];
    const invokeCalls = [];
    const bot = new MatrixBot(
      { matrixAccessToken: '', matrixUserId: '@bot:matrix', matrixConversationMode: 'runtime_proxy' },
      { info: () => {} },
      {
        list: async () => [{ name: 'a', id: 'inst_a', matrixRoomId: '!r:matrix', employeeNo: 'DE202603040001', state: 'running', runtime: { endpoint: 'x' } }],
        get: async () => ({ name: 'a', id: 'inst_a', state: 'running', runtime: { endpoint: 'x' } }),
        getProvisioningJob: async (requestId) => ({
          requestId,
          instanceId: 'inst_a',
          status: 'ready',
          phase: 'ready',
          attempts: 1,
          error: null
        }),
        start: async () => ({ id: 'inst_a', state: 'running' }),
        stop: async () => ({ id: 'inst_a', state: 'stopped' }),
        createFromMatrix: async (input) => {
          createCalls.push(input);
          return { id: 'inst_a', tenantId: 'tenant_a', name: input.name || 'a', state: 'running', runtime: { endpoint: 'x' }, createdAt: 'now' };
        },
        buildMatrixCard: () => ({
          schema: 'dcf.employee-card/v1',
          cardType: 'digital_employee',
          instanceId: 'inst_a',
          matrixRoomId: '!r:matrix',
          chatUrl: 'http://localhost/chat/inst_a',
          actions: [{ type: 'open_chat', label: '进入会话', url: 'http://localhost/chat/inst_a' }]
        })
      },
      {
        runtimeProxyService: {
          invoke: async (instanceId, payload) => {
            invokeCalls.push({ instanceId, payload });
            return { mode: 'simulation', instanceId, request: payload, response: { output: '任务执行完成，已生成日报。' } };
          }
        },
        resolveIdentityProfile: async (matrixUserId) => {
          if (matrixUserId !== '@u:matrix') return null;
          return {
            employeeNo: 'DE202603040088',
            email: 'u@corp.local',
            jobCode: 'finance',
            jobTitle: '财务专员',
            department: 'finance',
            enterpriseUserId: 'emp-88'
          };
        }
      }
    );

    const create = await bot.processTextMessage('@u:matrix', '!r:matrix', '!create_agent a');
    expect(create.phase).toBe('succeeded');
    expect(create.reply.includes('【任务状态】')).toBe(true);
    expect(create.reply.includes('action: create_agent')).toBe(true);
    expect(create.reply.includes('phase: succeeded')).toBe(true);
    expect(create.reply.includes('requestId:')).toBe(true);

    const list = await bot.processTextMessage('@u:matrix', '!r:matrix', '!list_agents');
    expect(list.reply.includes('inst_a')).toBe(true);

    const status = await bot.processTextMessage('@u:matrix', '!r:matrix', '!agent_status inst_a');
    expect(status.reply.includes('inst_a')).toBe(true);

    const start = await bot.processTextMessage('@u:matrix', '!r:matrix', '!start_agent inst_a');
    expect(start.reply.includes('已启动')).toBe(true);

    const stop = await bot.processTextMessage('@u:matrix', '!r:matrix', '!stop_agent inst_a');
    expect(stop.reply.includes('已停止')).toBe(true);

    const job = await bot.processTextMessage('@u:matrix', '!r:matrix', '!job_status mx:create:test');
    expect(job.phase).toBe('succeeded');
    expect(job.reply.includes('action: job_status')).toBe(true);
    expect(job.reply.includes('phase: ready')).toBe(true);

    const createNatural = await bot.processTextMessage(
      '@u:matrix',
      '!factory:matrix',
      '请创建一个数字员工，名字叫采购小助手，岗位是采购'
    );
    expect(createNatural.phase).toBe('succeeded');
    expect(createNatural.reply.includes('requestId:')).toBe(true);
    expect(createCalls.some((x) => x.name.includes('采购小助手'))).toBe(true);

    const passthrough = await bot.processTextMessage('@u:matrix', '!r:matrix', '请汇总今日销售数据并输出日报');
    expect(passthrough.phase).toBe('succeeded');
    expect(passthrough.reply.includes('任务执行完成')).toBe(true);
    expect(invokeCalls).toHaveLength(1);
    expect(invokeCalls[0].instanceId).toBe('inst_a');
    expect(invokeCalls[0].payload.input).toContain('汇总今日销售数据');
  });

  test('!create_doc creates a document and returns drawerContent', async () => {
    const docCreateCalls = [];
    const bot = new MatrixBot(
      { matrixAccessToken: '', matrixUserId: '@bot:matrix' },
      { info: () => {} },
      {
        list: async () => [],
        createFromMatrix: async () => ({ id: 'x', name: 'x', state: 'running', runtime: {} }),
        buildMatrixCard: () => ({ instanceId: 'x', actions: [] })
      },
      {
        documentService: {
          create: async (input) => {
            docCreateCalls.push(input);
            return { id: 'doc_1', title: input.title, type: 'doc', content: { html: '' }, version: 1 };
          },
          get: async (id) => ({ id, title: '测试文档', type: 'doc', content: { html: '<p>hello</p>' }, version: 1 })
        }
      }
    );

    const result = await bot.processTextMessage('@u:matrix', '!r:matrix', '!create_doc 项目文档');
    expect(result.phase).toBe('succeeded');
    expect(result.reply).toContain('项目文档');
    expect(result.drawerContent).toBeDefined();
    expect(result.drawerContent.type).toBe('doc');
    expect(result.drawerContent.data.docId).toBe('doc_1');
    expect(docCreateCalls).toHaveLength(1);
    expect(docCreateCalls[0].title).toBe('项目文档');
    expect(docCreateCalls[0].roomId).toBe('!r:matrix');
  });

  test('!share_doc shares an existing document with drawerContent', async () => {
    const bot = new MatrixBot(
      { matrixAccessToken: '', matrixUserId: '@bot:matrix' },
      { info: () => {} },
      {
        list: async () => [],
        createFromMatrix: async () => ({ id: 'x', name: 'x', state: 'running', runtime: {} }),
        buildMatrixCard: () => ({ instanceId: 'x', actions: [] })
      },
      {
        documentService: {
          get: async (id) => ({ id, title: '共享文档', type: 'doc', content: { html: '<p>shared</p>' }, version: 2 })
        }
      }
    );

    const result = await bot.processTextMessage('@u:matrix', '!r:matrix', '!share_doc doc_1');
    expect(result.phase).toBe('succeeded');
    expect(result.reply).toContain('共享文档');
    expect(result.drawerContent).toBeDefined();
    expect(result.drawerContent.type).toBe('doc');
    expect(result.drawerContent.data.docId).toBe('doc_1');
    expect(result.drawerContent.data.html).toBe('<p>shared</p>');
  });

  test('!create_doc without title returns failed', async () => {
    const bot = new MatrixBot(
      { matrixAccessToken: '', matrixUserId: '@bot:matrix' },
      { info: () => {} },
      { list: async () => [] },
      { documentService: { create: async () => ({}) } }
    );

    const result = await bot.processTextMessage('@u:matrix', '!r:matrix', '!create_doc');
    expect(result.phase).toBe('failed');
    expect(result.reply).toContain('用法');
  });

  test('delegates bound room conversation to openclaw channel by default', async () => {
    const invokeCalls = [];
    const bot = new MatrixBot(
      { matrixAccessToken: '', matrixUserId: '@bot:matrix' },
      { info: () => {} },
      {
        list: async () => [{ id: 'inst_a', name: 'a', matrixRoomId: '!r:matrix', state: 'running', runtime: { endpoint: 'x' } }],
        createFromMatrix: async (input) => ({ id: 'inst_x', name: input.name, state: 'running', runtime: { endpoint: 'x' } }),
        buildMatrixCard: () => ({ instanceId: 'inst_x', actions: [] })
      },
      {
        runtimeProxyService: {
          invoke: async (instanceId, payload) => {
            invokeCalls.push({ instanceId, payload });
            return { response: { output: 'should not be called' } };
          }
        }
      }
    );

    const out = await bot.processTextMessage('@u:matrix', '!r:matrix', '请帮我整理今天的任务');
    expect(out.ignored).toBe(true);
    expect(out.delegated).toBe(true);
    expect(invokeCalls).toHaveLength(0);
  });

  test('!ask returns RAG answer', async () => {
    const bot = new MatrixBot(
      { matrixAccessToken: '', matrixUserId: '@bot:matrix' },
      { info: () => {} },
      { list: async () => [] },
      {
        weKnoraService: {
          query: async (q) => ({
            answer: `回答: ${q}`,
            sources: [{ title: '产品规划', id: 'doc-1' }],
          }),
        },
      }
    );

    const result = await bot.processTextMessage('@u:matrix', '!r:matrix', '!ask Q4目标');
    expect(result.phase).toBe('succeeded');
    expect(result.reply).toContain('回答: Q4目标');
    expect(result.reply).toContain('产品规划');
  });

  test('!ask without question returns failed', async () => {
    const bot = new MatrixBot(
      { matrixAccessToken: '', matrixUserId: '@bot:matrix' },
      { info: () => {} },
      { list: async () => [] },
      { weKnoraService: { query: async () => ({ answer: '', sources: [] }) } }
    );

    const result = await bot.processTextMessage('@u:matrix', '!r:matrix', '!ask');
    expect(result.phase).toBe('failed');
    expect(result.reply).toContain('用法');
  });

  test('!ask without weKnoraService returns service_unavailable', async () => {
    const bot = new MatrixBot(
      { matrixAccessToken: '', matrixUserId: '@bot:matrix' },
      { info: () => {} },
      { list: async () => [] },
      {}
    );

    const result = await bot.processTextMessage('@u:matrix', '!r:matrix', '!ask 测试');
    expect(result.phase).toBe('failed');
    expect(result.reply).toContain('未启用');
  });

  test('!search_kb returns search results', async () => {
    const bot = new MatrixBot(
      { matrixAccessToken: '', matrixUserId: '@bot:matrix' },
      { info: () => {} },
      { list: async () => [] },
      {
        weKnoraService: {
          search: async () => [
            { title: '产品规划', score: 0.95 },
            { title: '安全规范', score: 0.82 },
          ],
        },
      }
    );

    const result = await bot.processTextMessage('@u:matrix', '!r:matrix', '!search_kb 产品');
    expect(result.phase).toBe('succeeded');
    expect(result.reply).toContain('2 条结果');
    expect(result.reply).toContain('产品规划');
  });

  test('!search_kb without keyword returns failed', async () => {
    const bot = new MatrixBot(
      { matrixAccessToken: '', matrixUserId: '@bot:matrix' },
      { info: () => {} },
      { list: async () => [] },
      { weKnoraService: { search: async () => [] } }
    );

    const result = await bot.processTextMessage('@u:matrix', '!r:matrix', '!search_kb');
    expect(result.phase).toBe('failed');
  });

  test('isNaturalRagIntent triggers only on action+target combo', () => {
    const bot = new MatrixBot(
      { matrixAccessToken: '', matrixUserId: '@bot:matrix' },
      { info: () => {} },
      { list: async () => [] },
      {}
    );

    // Should match: action word + target word
    expect(bot.isNaturalRagIntent('帮我查一下知识库')).toBe(true);
    expect(bot.isNaturalRagIntent('搜索一下产品规划文档')).toBe(true);
    expect(bot.isNaturalRagIntent('帮我查流程规范')).toBe(true);

    // Should NOT match: too short
    expect(bot.isNaturalRagIntent('hi')).toBe(false);
    // Should NOT match: only action word, no target
    expect(bot.isNaturalRagIntent('帮我查一下天气')).toBe(false);
    // Should NOT match: generic conversation
    expect(bot.isNaturalRagIntent('请问这个怎么用')).toBe(false);
    expect(bot.isNaturalRagIntent('什么是面向对象编程')).toBe(false);
    // Should NOT match: only target word, no action
    expect(bot.isNaturalRagIntent('知识库很好用')).toBe(false);
  });

  test('natural language RAG intent triggers weKnora query', async () => {
    const queryCalls = [];
    const bot = new MatrixBot(
      { matrixAccessToken: '', matrixUserId: '@bot:matrix' },
      { info: () => {} },
      { list: async () => [] }, // no matching room → no passthrough
      {
        weKnoraService: {
          query: async (q) => {
            queryCalls.push(q);
            return { answer: 'RAG回答', sources: [] };
          },
        },
      }
    );

    const result = await bot.processTextMessage('@u:matrix', '!other:matrix', '帮我查一下文档规范');
    expect(result.phase).toBe('succeeded');
    expect(result.reply).toContain('RAG回答');
    expect(queryCalls).toHaveLength(1);
  });

  test('unknown command lists all available commands including !ask and !search_kb', async () => {
    const bot = new MatrixBot(
      { matrixAccessToken: '', matrixUserId: '@bot:matrix' },
      { info: () => {} },
      { list: async () => [] },
      {}
    );

    const result = await bot.processTextMessage('@u:matrix', '!r:matrix', '!unknown_cmd');
    expect(result.reply).toContain('!ask');
    expect(result.reply).toContain('!search_kb');
  });
});

const { MatrixRelay } = require('../src/integrations/matrix/MatrixRelay');

function makeEvent(input) {
  return {
    getType: () => input.type,
    getSender: () => input.sender,
    getContent: () => ({ body: input.body }),
    getClearContent: () => ({ body: input.clearBody }),
    getId: () => input.id
  };
}

describe('MatrixRelay', () => {
  test('forwards command messages and sends reply once', async () => {
    const calls = [];
    const sends = [];
    const relay = new MatrixRelay(
      {
        matrixRelayEnabled: true,
        matrixHomeserver: 'http://hs',
        matrixUserId: '@bot:localhost',
        matrixAccessToken: 'token'
      },
      { info: () => {}, error: () => {} },
      {
        processTextMessage: async (sender, roomId, body) => {
          calls.push({ sender, roomId, body });
          return { ignored: false, reply: 'ok' };
        }
      },
      {}
    );
    relay.client = {
      sendText: async (roomId, text) => sends.push({ roomId, text })
    };

    await relay.onTimeline(
      makeEvent({ type: 'm.room.message', sender: '@u:localhost', body: '!create_agent a', id: '$e1' }),
      { roomId: '!room:localhost' },
      false
    );
    await relay.onTimeline(
      makeEvent({ type: 'm.room.message', sender: '@u:localhost', body: '!create_agent a', id: '$e1' }),
      { roomId: '!room:localhost' },
      false
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].body).toBe('!create_agent a');
    expect(sends).toEqual([{ roomId: '!room:localhost', text: 'ok' }]);
  });

  test('ignores non-message and self messages', async () => {
    const calls = [];
    const relay = new MatrixRelay(
      {
        matrixRelayEnabled: true,
        matrixHomeserver: 'http://hs',
        matrixUserId: '@bot:localhost',
        matrixAccessToken: 'token'
      },
      { info: () => {}, error: () => {} },
      {
        processTextMessage: async () => {
          calls.push(1);
          return { ignored: false, reply: 'ok' };
        }
      },
      {}
    );
    relay.client = { sendText: async () => {} };

    await relay.onTimeline(
      makeEvent({ type: 'm.room.member', sender: '@u:localhost', body: '!create_agent a', id: '$e2' }),
      { roomId: '!room:localhost' },
      false
    );
    await relay.onTimeline(
      makeEvent({ type: 'm.room.message', sender: '@bot:localhost', body: '!create_agent a', id: '$e3' }),
      { roomId: '!room:localhost' },
      false
    );

    expect(calls).toHaveLength(0);
  });

  test('uses sendEvent with dcf.drawer_content when drawerContent present', async () => {
    const events = [];
    const relay = new MatrixRelay(
      {
        matrixRelayEnabled: true,
        matrixHomeserver: 'http://hs',
        matrixUserId: '@bot:localhost',
        matrixAccessToken: 'token'
      },
      { info: () => {}, error: () => {} },
      {
        processTextMessage: async () => ({
          ignored: false,
          reply: '文档已创建',
          drawerContent: { type: 'doc', title: '测试', data: { docId: 'doc_1', html: '' } }
        })
      },
      {}
    );
    relay.client = {
      sendEvent: async (roomId, type, content) => events.push({ roomId, type, content }),
      sendText: async () => { throw new Error('sendText should not be called'); }
    };

    await relay.onTimeline(
      makeEvent({ type: 'm.room.message', sender: '@u:localhost', body: '!create_doc test', id: '$dc1' }),
      { roomId: '!room:localhost' },
      false
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('m.room.message');
    expect(events[0].content.body).toBe('文档已创建');
    expect(events[0].content['dcf.drawer_content']).toEqual({
      type: 'doc', title: '测试', data: { docId: 'doc_1', html: '' }
    });
  });

  test('falls back to sendText when no drawerContent', async () => {
    const sends = [];
    const relay = new MatrixRelay(
      {
        matrixRelayEnabled: true,
        matrixHomeserver: 'http://hs',
        matrixUserId: '@bot:localhost',
        matrixAccessToken: 'token'
      },
      { info: () => {}, error: () => {} },
      {
        processTextMessage: async () => ({ ignored: false, reply: 'plain reply' })
      },
      {}
    );
    relay.client = {
      sendEvent: async () => { throw new Error('sendEvent should not be called for plain text'); },
      sendText: async (roomId, text) => sends.push({ roomId, text })
    };

    await relay.onTimeline(
      makeEvent({ type: 'm.room.message', sender: '@u:localhost', body: '!list_agents', id: '$fb1' }),
      { roomId: '!room:localhost' },
      false
    );

    expect(sends).toHaveLength(1);
    expect(sends[0].text).toBe('plain reply');
  });

  test('accepts decrypted encrypted text events', async () => {
    const calls = [];
    const sends = [];
    const relay = new MatrixRelay(
      {
        matrixRelayEnabled: true,
        matrixHomeserver: 'http://hs',
        matrixUserId: '@bot:localhost',
        matrixAccessToken: 'token'
      },
      { info: () => {}, error: () => {} },
      {
        processTextMessage: async (sender, roomId, body) => {
          calls.push({ sender, roomId, body });
          return { ignored: false, reply: 'created' };
        }
      },
      {}
    );
    relay.client = { sendText: async (roomId, text) => sends.push({ roomId, text }) };

    await relay.onTimeline(
      makeEvent({
        type: 'm.room.encrypted',
        sender: '@u:localhost',
        body: '',
        clearBody: '帮我创建一个数字员工',
        id: '$enc1'
      }),
      { roomId: '!room:localhost' },
      false
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].body).toBe('帮我创建一个数字员工');
    expect(sends).toEqual([{ roomId: '!room:localhost', text: 'created' }]);
  });

  test('auto accepts invite and joins room for bot user', async () => {
    const joined = [];
    const sent = [];
    const relay = new MatrixRelay(
      {
        matrixRelayEnabled: true,
        matrixHomeserver: 'http://hs',
        matrixUserId: '@bot:localhost',
        matrixAccessToken: 'token'
      },
      { info: () => {}, warn: () => {}, error: () => {} },
      { processTextMessage: async () => ({ ignored: true }) },
      {}
    );
    relay.started = true;
    relay.client = {
      joinRoom: async (roomId) => joined.push(roomId),
      sendText: async (roomId, text) => sent.push({ roomId, text })
    };

    await relay.onRoomMember({}, {
      userId: '@bot:localhost',
      membership: 'invite',
      roomId: '!dm:localhost'
    });

    expect(joined).toEqual(['!dm:localhost']);
    expect(sent).toHaveLength(1);
    expect(sent[0].roomId).toBe('!dm:localhost');
    expect(sent[0].text.includes('数字工厂bot')).toBe(true);
  });

  test('start tries set display name for bot profile', async () => {
    const calls = [];
    const relay = new MatrixRelay(
      {
        matrixRelayEnabled: true,
        matrixHomeserver: 'http://hs',
        matrixUserId: '@bot:localhost',
        matrixAccessToken: 'token',
        matrixBotDisplayName: '数字工厂bot'
      },
      { info: () => {}, warn: () => {}, error: () => {} },
      { processTextMessage: async () => ({ ignored: true }) },
      {
        createClient: () => ({
          on: () => {},
          startClient: () => {},
          stopClient: () => {},
          removeListener: () => {},
          setDisplayName: async (name) => { calls.push(name); }
        })
      }
    );

    await relay.start();
    expect(calls).toEqual(['数字工厂bot']);
    await relay.stop();
  });
});

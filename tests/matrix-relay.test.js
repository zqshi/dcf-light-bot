const { MatrixRelay } = require('../src/integrations/matrix/MatrixRelay');

function makeEvent(input) {
  return {
    getType: () => input.type,
    getSender: () => input.sender,
    getContent: () => ({ body: input.body }),
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
});

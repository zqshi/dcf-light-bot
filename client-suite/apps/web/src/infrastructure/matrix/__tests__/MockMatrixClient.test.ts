import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockMatrixClient } from '../MockMatrixClient';

describe('MockMatrixClient', () => {
  let client: MockMatrixClient;

  beforeEach(() => {
    client = new MockMatrixClient();
  });

  it('starts not ready', () => {
    expect(client.isReady()).toBe(false);
    expect(client.getUserProfile()).toBeNull();
    expect(client.getRooms()).toEqual([]);
  });

  it('login sets user and fires sync callback', async () => {
    const syncCb = vi.fn();
    client.onSync(syncCb);

    const result = await client.login('', '', '');
    expect(result.userId).toBe('@zhangsan:dcf.local');
    expect(result.accessToken).toBe('demo-token');
    expect(client.isReady()).toBe(true);

    const profile = client.getUserProfile();
    expect(profile?.displayName).toBe('张三');

    // Sync callback fires async
    await vi.waitFor(() => expect(syncCb).toHaveBeenCalled());
  });

  it('getRooms returns 12 demo rooms', async () => {
    await client.login('', '', '');
    const rooms = client.getRooms();
    expect(rooms.length).toBe(12);
    expect(rooms.some((r) => r.name === '数字工厂')).toBe(true);
  });

  it('getMessages returns messages for a room', async () => {
    await client.login('', '', '');
    const msgs = client.getMessages('!factory:dcf.local');
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0].body).toContain('欢迎');
  });

  it('selectRoom clears unread', async () => {
    await client.login('', '', '');
    const before = client.getRooms().find((r) => r.id === '!factory:dcf.local');
    expect(before!.unreadCount).toBe(1);

    await client.selectRoom('!factory:dcf.local');
    const after = client.getRooms().find((r) => r.id === '!factory:dcf.local');
    expect(after!.unreadCount).toBe(0);
  });

  it('sendMessage adds to messages and fires timeline', async () => {
    const tlCb = vi.fn();
    client.onTimeline(tlCb);
    await client.login('', '', '');

    await client.sendMessage('!lisi:dcf.local', '你好');
    const msgs = client.getMessages('!lisi:dcf.local');
    const last = msgs[msgs.length - 1];
    expect(last.body).toBe('你好');
    expect(last.senderId).toBe('@zhangsan:dcf.local');
    expect(tlCb).toHaveBeenCalledWith('!lisi:dcf.local');
  });

  it('searchUsers filters by term', async () => {
    await client.login('', '', '');
    const results = await client.searchUsers('李');
    expect(results.length).toBe(1);
    expect(results[0].displayName).toBe('李四');
  });

  it('logout resets state', async () => {
    await client.login('', '', '');
    expect(client.isReady()).toBe(true);
    await client.logout();
    expect(client.isReady()).toBe(false);
    expect(client.getUserProfile()).toBeNull();
  });
});

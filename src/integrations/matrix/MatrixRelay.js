class MatrixRelay {
  constructor(config, logger, matrixBot, deps = {}) {
    this.config = config;
    this.logger = logger;
    this.matrixBot = matrixBot;
    this.createClient = deps.createClient || null;
    this.auditService = deps.auditService || null;
    this.client = null;
    this.started = false;
    this.seenEvents = new Set();
    this.maxSeenEvents = 5000;
    this.timelineHandler = this.onTimeline.bind(this);
    this.memberHandler = this.onRoomMember.bind(this);
  }

  async audit(type, payload = {}) {
    if (!this.auditService || typeof this.auditService.log !== 'function') return;
    await this.auditService.log(type, payload);
  }

  isEnabled() {
    if (this.config.matrixRelayEnabled === false) return false;
    return Boolean(
      String(this.config.matrixHomeserver || '').trim()
      && String(this.config.matrixUserId || '').trim()
      && String(this.config.matrixAccessToken || '').trim()
    );
  }

  async start() {
    if (!this.isEnabled()) {
      this.logger.info('matrix relay skipped', { reason: 'missing config or disabled' });
      return;
    }
    if (!this.createClient) {
      ({ createClient: this.createClient } = require('matrix-js-sdk'));
    }
    this.client = this.createClient({
      baseUrl: this.config.matrixHomeserver,
      accessToken: this.config.matrixAccessToken,
      userId: this.config.matrixUserId,
      deviceId: String(this.config.matrixDeviceId || '').trim() || undefined
    });
    await this.tryInitCrypto();
    this.client.on('Room.timeline', this.timelineHandler);
    this.client.on('RoomMember.membership', this.memberHandler);
    this.client.startClient({
      initialSyncLimit: Math.max(1, Number(this.config.matrixRelayInitialSyncLimit || 10))
    });
    await this.trySetBotDisplayName();
    this.started = true;
    this.logger.info('matrix relay started', {
      homeserver: this.config.matrixHomeserver,
      userId: this.config.matrixUserId
    });
    await this.audit('matrix.relay.started', {
      homeserver: this.config.matrixHomeserver,
      userId: this.config.matrixUserId
    });
  }

  async tryInitCrypto() {
    if (this.config.matrixE2eeEnabled !== true) {
      this.logger.info('matrix relay crypto disabled by config', {
        userId: this.config.matrixUserId
      });
      await this.audit('matrix.relay.crypto.disabled', {
        userId: this.config.matrixUserId,
        reason: 'matrix_e2ee_disabled'
      });
      return;
    }
    if (!this.client || typeof this.client.initCrypto !== 'function') return;
    try {
      if (!global.Olm) {
        // matrix-js-sdk (node) requires global.Olm before initCrypto().
        // Prefer @matrix-org/olm; fallback to legacy olm package.
        try {
          // eslint-disable-next-line global-require
          global.Olm = require('@matrix-org/olm');
        } catch (_error) {
          // eslint-disable-next-line global-require
          global.Olm = require('olm');
        }
      }
      if (global.Olm && typeof global.Olm.init === 'function') {
        await global.Olm.init();
      }
      await this.client.initCrypto();
      this.logger.info('matrix relay crypto initialized', {
        userId: this.config.matrixUserId
      });
      await this.audit('matrix.relay.crypto.ready', {
        userId: this.config.matrixUserId
      });
    } catch (error) {
      const reason = String(error && error.message || error);
      this.logger.warn('matrix relay crypto init failed, encrypted rooms may be unreadable', {
        reason
      });
      await this.audit('matrix.relay.crypto.failed', {
        userId: this.config.matrixUserId,
        reason
      });
    }
  }

  async stop() {
    if (!this.started || !this.client) return;
    try {
      this.client.removeListener('Room.timeline', this.timelineHandler);
      this.client.removeListener('RoomMember.membership', this.memberHandler);
      this.client.stopClient();
    } finally {
      this.started = false;
      this.client = null;
      this.seenEvents.clear();
      this.logger.info('matrix relay stopped');
      await this.audit('matrix.relay.stopped', {
        homeserver: this.config.matrixHomeserver,
        userId: this.config.matrixUserId
      });
    }
  }

  rememberEvent(eventId) {
    if (!eventId) return false;
    if (this.seenEvents.has(eventId)) return true;
    this.seenEvents.add(eventId);
    if (this.seenEvents.size > this.maxSeenEvents) {
      const first = this.seenEvents.values().next().value;
      if (first) this.seenEvents.delete(first);
    }
    return false;
  }

  extractTextEvent(event, room, toStartOfTimeline) {
    if (toStartOfTimeline) return null;
    const roomId = room && room.roomId ? room.roomId : '';
    if (!roomId) return null;
    const sender = typeof event.getSender === 'function' ? event.getSender() : '';
    if (!sender || sender === this.config.matrixUserId) return null;
    const type = typeof event.getType === 'function' ? event.getType() : '';
    if (type !== 'm.room.message' && type !== 'm.room.encrypted') return null;
    const content = typeof event.getContent === 'function' ? event.getContent() : {};
    const clearContent = typeof event.getClearContent === 'function' ? event.getClearContent() : {};
    const body = String(
      (content && content.body)
      || (clearContent && clearContent.body)
      || ''
    ).trim();
    if (!body) return null;
    const eventId = typeof event.getId === 'function' ? event.getId() : '';
    return { eventId, sender, roomId, body };
  }

  async onTimeline(event, room, toStartOfTimeline) {
    try {
      const parsed = this.extractTextEvent(event, room, toStartOfTimeline);
      if (!parsed) {
        const type = typeof event.getType === 'function' ? event.getType() : '';
        const sender = typeof event.getSender === 'function' ? event.getSender() : '';
        const eventId = typeof event.getId === 'function' ? event.getId() : '';
        const roomId = room && room.roomId ? room.roomId : '';
        if (type === 'm.room.encrypted' && sender && sender !== this.config.matrixUserId && roomId) {
          if (this.rememberEvent(eventId)) return;
          await this.audit('matrix.relay.inbound.encrypted_ignored', {
            eventId,
            sender,
            roomId,
            reason: 'encrypted_event_not_decrypted'
          });
        }
        return;
      }
      if (this.rememberEvent(parsed.eventId)) return;
      await this.audit('matrix.relay.inbound', {
        eventId: parsed.eventId,
        sender: parsed.sender,
        roomId: parsed.roomId,
        body: parsed.body
      });
      const out = await this.matrixBot.processTextMessage(parsed.sender, parsed.roomId, parsed.body, {
        eventId: parsed.eventId
      });
      if (!out || out.ignored) return;
      if (out.reply && this.client) {
        try {
          if (out.drawerContent && typeof this.client.sendEvent === 'function') {
            await this.client.sendEvent(parsed.roomId, 'm.room.message', {
              msgtype: 'm.text',
              body: String(out.reply),
              'dcf.drawer_content': out.drawerContent
            });
          } else if (typeof this.client.sendText === 'function') {
            await this.client.sendText(parsed.roomId, String(out.reply));
          }
          await this.audit('matrix.relay.delivery.succeeded', {
            eventId: parsed.eventId,
            roomId: parsed.roomId,
            traceId: out.traceId || '',
            phase: out.phase || '',
            action: (parsed.body.split(/\s+/)[0] || '').toLowerCase()
          });
        } catch (error) {
          await this.audit('matrix.relay.delivery.failed', {
            eventId: parsed.eventId,
            roomId: parsed.roomId,
            traceId: out.traceId || '',
            phase: out.phase || '',
            action: (parsed.body.split(/\s+/)[0] || '').toLowerCase(),
            reason: String(error && error.message || error)
          });
          throw error;
        }
      }
    } catch (error) {
      this.logger.error('matrix relay message handling failed', {
        error: String(error && error.message || error)
      });
    }
  }

  async trySetBotDisplayName() {
    const nextName = String(this.config.matrixBotDisplayName || '').trim();
    if (!nextName || !this.client || typeof this.client.setDisplayName !== 'function') return;
    try {
      await this.client.setDisplayName(nextName);
      await this.audit('matrix.bot.profile.updated', {
        userId: this.config.matrixUserId,
        displayName: nextName
      });
    } catch (error) {
      this.logger.warn('matrix relay set display name failed', {
        error: String(error && error.message || error),
        userId: this.config.matrixUserId
      });
      await this.audit('matrix.bot.profile.update_failed', {
        userId: this.config.matrixUserId,
        displayName: nextName,
        reason: String(error && error.message || error)
      });
    }
  }

  async onRoomMember(event, member) {
    try {
      if (!this.started || !this.client) return;
      const myUserId = String(this.config.matrixUserId || '');
      const targetUserId = String(member && member.userId || '');
      if (!myUserId || !targetUserId || targetUserId !== myUserId) return;
      const membership = String(member && member.membership || '').toLowerCase();
      if (membership !== 'invite') return;
      const roomId = String(
        (member && member.roomId)
        || (member && member.room && member.room.roomId)
        || ''
      );
      if (!roomId) return;
      if (typeof this.client.joinRoom !== 'function') return;
      await this.client.joinRoom(roomId);
      if (typeof this.client.sendText === 'function') {
        await this.client.sendText(
          roomId,
          '你好，我是数字工厂bot。你可以直接用自然语言创建数字员工，例如：请创建一个采购数字员工，名字叫采购小助手。'
        );
      }
      await this.audit('matrix.bot.joined', {
        userId: myUserId,
        roomId,
        reason: 'auto_accept_invite'
      });
    } catch (error) {
      this.logger.warn('matrix relay auto-join invite failed', {
        error: String(error && error.message || error)
      });
    }
  }
}

module.exports = { MatrixRelay };

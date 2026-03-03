class MatrixRelay {
  constructor(config, logger, matrixBot, deps = {}) {
    this.config = config;
    this.logger = logger;
    this.matrixBot = matrixBot;
    this.createClient = deps.createClient || null;
    this.client = null;
    this.started = false;
    this.seenEvents = new Set();
    this.maxSeenEvents = 5000;
    this.timelineHandler = this.onTimeline.bind(this);
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
      userId: this.config.matrixUserId
    });
    this.client.on('Room.timeline', this.timelineHandler);
    this.client.startClient({
      initialSyncLimit: Math.max(1, Number(this.config.matrixRelayInitialSyncLimit || 10))
    });
    this.started = true;
    this.logger.info('matrix relay started', {
      homeserver: this.config.matrixHomeserver,
      userId: this.config.matrixUserId
    });
  }

  async stop() {
    if (!this.started || !this.client) return;
    try {
      this.client.removeListener('Room.timeline', this.timelineHandler);
      this.client.stopClient();
    } finally {
      this.started = false;
      this.client = null;
      this.seenEvents.clear();
      this.logger.info('matrix relay stopped');
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
    if (type !== 'm.room.message') return null;
    const content = typeof event.getContent === 'function' ? event.getContent() : {};
    const body = String(content && content.body || '').trim();
    if (!body) return null;
    const eventId = typeof event.getId === 'function' ? event.getId() : '';
    return { eventId, sender, roomId, body };
  }

  async onTimeline(event, room, toStartOfTimeline) {
    try {
      const parsed = this.extractTextEvent(event, room, toStartOfTimeline);
      if (!parsed) return;
      if (this.rememberEvent(parsed.eventId)) return;
      const out = await this.matrixBot.processTextMessage(parsed.sender, parsed.roomId, parsed.body);
      if (!out || out.ignored) return;
      if (out.reply && this.client && typeof this.client.sendText === 'function') {
        await this.client.sendText(parsed.roomId, String(out.reply));
      }
    } catch (error) {
      this.logger.error('matrix relay message handling failed', {
        error: String(error && error.message || error)
      });
    }
  }
}

module.exports = { MatrixRelay };

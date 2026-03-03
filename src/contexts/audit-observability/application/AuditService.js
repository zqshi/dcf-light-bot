const { newId } = require('../../../shared/id');
const { nowIso } = require('../../../shared/time');

class AuditService {
  constructor(repo) {
    this.repo = repo;
  }

  async log(type, payload) {
    const event = {
      id: newId('audit'),
      type,
      payload: payload && typeof payload === 'object' ? payload : {},
      at: nowIso()
    };
    await this.repo.appendAudit(event);
    return event;
  }

  async list(limit = 100) {
    return this.repo.listAudits(limit);
  }
}

module.exports = { AuditService };

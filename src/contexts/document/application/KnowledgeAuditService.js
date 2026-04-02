/**
 * KnowledgeAuditService — 知识库审计日志查询
 */

class KnowledgeAuditService {
  constructor(repo) {
    this.repo = repo;
  }

  async list(filter = {}) {
    return this.repo.listKnowledgeAudits(filter);
  }
}

module.exports = { KnowledgeAuditService };

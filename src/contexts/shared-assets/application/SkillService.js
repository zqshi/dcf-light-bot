const { createSkillReport } = require('../domain/SkillReport');
const { normalizeAssetType } = require('../domain/SkillReport');
const { createSharedSkillFromReport, createSkillBinding, createAssetBinding } = require('../domain/SharedSkill');
const { AppError } = require('../../../shared/errors');
const { nowIso } = require('../../../shared/time');

class SkillService {
  constructor(repo, audit) {
    this.repo = repo;
    this.audit = audit;
  }

  async report(input) {
    return this.reportAsset({ ...input, assetType: input.assetType || 'skill' });
  }

  async reportAsset(input) {
    if (!String(input.sourceTenantId || '').trim()) {
      throw new AppError('sourceTenantId is required', 400, 'SKILL_SOURCE_TENANT_REQUIRED');
    }
    if (!String(input.sourceInstanceId || '').trim()) {
      throw new AppError('sourceInstanceId is required', 400, 'SKILL_SOURCE_INSTANCE_REQUIRED');
    }
    if (!String(input.name || '').trim()) {
      throw new AppError('name is required', 400, 'SKILL_NAME_REQUIRED');
    }

    const report = createSkillReport(input);
    await this.repo.addAssetReport(report);
    await this.audit.log('skill.reported', {
      reportId: report.id,
      assetType: report.assetType,
      sourceTenantId: report.sourceTenantId,
      sourceInstanceId: report.sourceInstanceId,
      name: report.name
    });
    return report;
  }

  async listReports() {
    return this.listReportsByType();
  }

  async listReportsByType(assetType) {
    const rows = await this.repo.listAssetReports();
    if (!assetType) return rows;
    const type = normalizeAssetType(assetType);
    return rows.filter((x) => String(x.assetType || 'skill') === type);
  }

  async listReportsByStatus(status) {
    const rows = await this.repo.listAssetReports();
    const target = String(status || '').trim();
    if (!target) return rows;
    return rows.filter((x) => String(x.status || '') === target);
  }

  buildApprovalStage(report) {
    const approvals = Array.isArray(report.approvals) ? report.approvals : [];
    const requiredApprovals = Math.max(1, Number(report.requiredApprovals || 1));
    return {
      approvedCount: approvals.length,
      requiredApprovals,
      remainingApprovals: Math.max(0, requiredApprovals - approvals.length)
    };
  }

  appendReview(report, reviewer, decision, opinion) {
    const history = Array.isArray(report.reviewHistory) ? report.reviewHistory : [];
    history.push({
      reviewer,
      decision,
      opinion: String(opinion || '').trim().slice(0, 2000) || null,
      at: nowIso()
    });
    report.reviewHistory = history;
    report.updatedAt = nowIso();
    return report;
  }

  async reviewReport(reportId, reviewer = 'platform_admin', decision = 'approve', opinion = '') {
    const normalizedDecision = String(decision || '').trim().toLowerCase();
    if (!['approve', 'reject'].includes(normalizedDecision)) {
      throw new AppError('decision must be approve or reject', 400, 'SKILL_REVIEW_DECISION_INVALID');
    }
    const report = await this.repo.getAssetReport(reportId);
    if (!report) throw new AppError('skill report not found', 404, 'SKILL_REPORT_NOT_FOUND');
    if (String(report.status) === 'approved') {
      const shared = (await this.repo.listSharedAssets()).find((x) => x.sourceReportId === report.id);
      return { report, sharedSkill: shared || null, stage: this.buildApprovalStage(report) };
    }
    if (String(report.status) === 'rejected') {
      throw new AppError('rejected report cannot be reviewed', 409, 'SKILL_REPORT_REJECTED');
    }

    this.appendReview(report, reviewer, normalizedDecision, opinion);
    await this.audit.log('skill.review.submitted', {
      reportId,
      reviewer,
      decision: normalizedDecision,
      opinion: String(opinion || '').trim().slice(0, 2000) || null,
      sourceTenantId: report.sourceTenantId,
      assetType: report.assetType
    });

    if (normalizedDecision === 'reject') {
      report.status = 'rejected';
      report.reviewedBy = reviewer;
      report.reviewedAt = nowIso();
      report.rejectReason = String(opinion || '').trim().slice(0, 500) || null;
      await this.repo.updateAssetReport(report);
      await this.audit.log('skill.report.rejected', { reportId, reviewer, reason: report.rejectReason });
      return { report, sharedSkill: null, stage: this.buildApprovalStage(report) };
    }

    const approvals = Array.isArray(report.approvals) ? report.approvals : [];
    if (!approvals.includes(reviewer)) approvals.push(reviewer);
    report.approvals = approvals;
    report.updatedAt = nowIso();
    const stage = this.buildApprovalStage(report);
    let sharedSkill = null;

    if (stage.remainingApprovals === 0) {
      report.status = 'approved';
      report.reviewedBy = reviewer;
      report.reviewedAt = nowIso();
      sharedSkill = (await this.repo.listSharedAssets()).find((x) => x.sourceReportId === report.id) || null;
      if (!sharedSkill) {
        sharedSkill = createSharedSkillFromReport(report, reviewer);
        await this.repo.addSharedAsset(sharedSkill);
      }
      await this.audit.log('skill.report.approved', {
        reportId,
        reviewer,
        assetType: sharedSkill.assetType,
        sharedSkillId: sharedSkill.id,
        sourceTenantId: report.sourceTenantId
      });
    }

    await this.repo.updateAssetReport(report);
    return { report, sharedSkill, stage: this.buildApprovalStage(report) };
  }

  async approveReport(reportId, reviewer = 'platform_admin', opinion = '') {
    return this.reviewReport(reportId, reviewer, 'approve', opinion);
  }

  async rejectReport(reportId, reviewer = 'platform_admin', reason = '') {
    const out = await this.reviewReport(reportId, reviewer, 'reject', reason);
    return out.report;
  }

  async listPendingReviews(reviewer) {
    const rows = await this.listReportsByStatus('pending_review');
    const who = String(reviewer || '').trim();
    if (!who) return rows;
    return rows.filter((x) => !(Array.isArray(x.approvals) && x.approvals.includes(who)));
  }

  async listReviewHistory(reportId) {
    const report = await this.repo.getAssetReport(reportId);
    if (!report) throw new AppError('skill report not found', 404, 'SKILL_REPORT_NOT_FOUND');
    return Array.isArray(report.reviewHistory) ? report.reviewHistory : [];
  }

  async listSharedSkills() {
    return this.listSharedAssets('skill');
  }

  async listSharedAssets(assetType) {
    return this.repo.listSharedAssets(assetType ? normalizeAssetType(assetType) : undefined);
  }

  async bindSharedSkill(tenantId, skillId, actor = 'platform_admin') {
    return this.bindSharedAsset(tenantId, skillId, 'skill', actor);
  }

  async bindSharedAsset(tenantId, assetId, assetType = 'skill', actor = 'platform_admin') {
    if (!String(tenantId || '').trim()) throw new AppError('tenantId is required', 400, 'TENANT_ID_REQUIRED');
    const skill = await this.repo.getSharedAsset(assetId);
    if (!skill) throw new AppError('shared asset not found', 404, 'SHARED_ASSET_NOT_FOUND');
    const type = normalizeAssetType(assetType || skill.assetType);
    if (String(skill.assetType || 'skill') !== type) {
      throw new AppError('asset type mismatch', 409, 'SHARED_ASSET_TYPE_MISMATCH');
    }

    const existed = await this.repo.findAssetBinding(tenantId, assetId);
    if (existed) return existed;

    const binding = type === 'skill'
      ? createSkillBinding(tenantId, assetId, actor)
      : createAssetBinding(tenantId, assetId, type, actor);
    await this.repo.addAssetBinding(binding);
    await this.audit.log('skill.binding.created', {
      tenantId,
      assetId,
      assetType: type,
      bindingId: binding.id,
      actor
    });
    return binding;
  }

  async listBindings() {
    return this.listAssetBindings('skill');
  }

  async listAssetBindings(assetType) {
    return this.repo.listAssetBindings(assetType ? normalizeAssetType(assetType) : undefined);
  }
}

module.exports = { SkillService };

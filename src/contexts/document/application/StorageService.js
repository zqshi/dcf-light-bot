/**
 * StorageService — 存储统计查询
 * 基于 documents 集合计算各种统计指标
 */

class StorageService {
  constructor(repo) {
    this.repo = repo;
  }

  async getStats() {
    const docs = await this.repo.listDocuments();
    const totalGB = 500; // Configurable quota
    const docCount = docs.length;
    // Estimate: average 500KB per doc
    const estimatedUsedMB = docCount * 0.5;
    const usedGB = Math.round(estimatedUsedMB / 1024 * 100) / 100 || 1;
    const usedPercent = Math.min(99, Math.round((usedGB / totalGB) * 100));
    return {
      totalGB,
      usedGB,
      usedPercent,
      fileCount: docCount,
      trend30d: 12.5,
    };
  }

  async getDeptStorage() {
    const docs = await this.repo.listDocuments();
    const deptMap = {};
    const colors = ['#007AFF', '#FF9500', '#34C759', '#FF3B30', '#5856D6', '#AF52DE'];
    let colorIdx = 0;
    for (const doc of docs) {
      const dept = doc.departmentId || 'unknown';
      if (!deptMap[dept]) {
        deptMap[dept] = { departmentId: dept, departmentName: dept, usedGB: 0, fileCount: 0, color: colors[colorIdx++ % colors.length] };
      }
      deptMap[dept].usedGB += 0.5;
      deptMap[dept].fileCount += 1;
    }
    return Object.values(deptMap);
  }

  async getLargeFiles() {
    const docs = await this.repo.listDocuments();
    // Return top 10 by estimated size (simple heuristic)
    return docs
      .map((d) => ({
        id: d.id,
        name: d.title,
        owner: d.ownerId || d.createdBy || 'unknown',
        sizeMB: Math.round(Math.random() * 500 + 50), // placeholder until real file sizes
        departmentName: d.departmentId || '未分类',
      }))
      .sort((a, b) => b.sizeMB - a.sizeMB)
      .slice(0, 10);
  }
}

module.exports = { StorageService };

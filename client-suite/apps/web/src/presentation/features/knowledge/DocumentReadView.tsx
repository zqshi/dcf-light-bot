/**
 * DocumentReadView — 文档只读阅读页 (km_8 对齐)
 * 顶部: 文档图标+标题+收藏星标+协作者头像+申请编辑按钮
 * 中间: 只读文档内容 (指标卡片+正文)
 * 底部浮动: 申请编辑权限按钮 → 触发 RequestEditPermissionModal
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Avatar } from '../../components/ui/Avatar';
import { RequestEditPermissionModal } from './RequestEditPermissionModal';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';

interface DocumentReadViewProps {
  onBack?: () => void;
}

const MOCK_DOC = {
  title: '2024Q1 财务报表汇总',
  author: '陈萨拉',
  authorAvatar: '陈',
  department: '财务部',
  updatedAt: '2024年5月20日 14:30',
  version: 'v2.3',
  readCount: 142,
  onlineReaders: 12,
  path: ['企业知识库', '财务中心', '年度报表'],
  content: `
    <h2>一、总体财务概况</h2>
    <p>2024年第一季度，公司总营收达到 <strong>8,420 万元</strong>，同比增长 18.5%。净利润率保持在 12.3% 的健康水平，较上年同期提升 2.1 个百分点。</p>
    <h3>1.1 收入构成</h3>
    <ul>
      <li>产品收入：5,680 万元（占比 67.5%）</li>
      <li>服务收入：2,180 万元（占比 25.9%）</li>
      <li>其他收入：560 万元（占比 6.6%）</li>
    </ul>
    <h3>1.2 成本与费用</h3>
    <p>营业成本同比下降 3.2%，主要得益于供应链优化和自动化流程改进。研发费用占比维持在 15%，符合年度预算规划。</p>
    <h2>二、各业务线表现</h2>
    <p>数字化业务线增速最快，季度环比增长 <strong>24.7%</strong>，成为公司增长的主要驱动力。传统业务线保持稳健，季度营收同比微增 5.3%。</p>
    <h2>三、现金流与资产状况</h2>
    <p>经营性现金流净额为 1,240 万元，同比增长 31.2%。截至季末，公司现金及等价物余额为 2.8 亿元，财务状况稳健。</p>
    <blockquote>注：本报告数据已经过内部审计复核，最终数据以年度审计报告为准。</blockquote>
  `,
};

const STATS = [
  { label: '总营收 (CNY)', value: '¥84,200,000', change: '+18.5%', color: '#007AFF' },
  { label: '净利润 (CNY)', value: '¥10,350,000', change: '+12.3%', color: '#5856D6' },
  { label: '毛利率', value: '45.8%', change: '+2.1pp', color: '#34C759' },
];

const ONLINE_USERS = [
  { letter: '张', color: 'bg-blue-500' },
  { letter: '李', color: 'bg-emerald-500' },
  { letter: '王', color: 'bg-amber-500' },
];

export function DocumentReadView({ onBack }: DocumentReadViewProps) {
  const [showPermModal, setShowPermModal] = useState(false);
  const [starred, setStarred] = useState(false);
  const setSubView = useUIStore((s) => s.setSubView);

  const handleBack = () => {
    if (onBack) onBack();
    else setSubView(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-white-var">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleBack} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary">
            <Icon name="arrow_back" size={18} />
          </button>
          <Icon name="description" size={18} className="text-primary" />
          <h3 className="text-[15px] font-bold text-text-primary">{MOCK_DOC.title}</h3>
          <button type="button" onClick={() => setStarred(!starred)} className="p-1 text-text-muted hover:text-warning">
            <Icon name={starred ? 'star' : 'star_border'} size={18} className={starred ? 'text-warning' : ''} />
          </button>
          <span className="px-2 py-0.5 text-[9px] font-medium text-warning bg-warning/10 rounded-full">内部机密</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Online readers */}
          <div className="flex items-center gap-2">
            <div className="flex items-center -space-x-1.5">
              {ONLINE_USERS.map((u) => (
                <div
                  key={u.letter}
                  className={`w-6 h-6 rounded-full ${u.color} text-white text-[9px] font-medium flex items-center justify-center ring-2 ring-white`}
                >
                  {u.letter}
                </div>
              ))}
            </div>
            <span className="text-[11px] text-text-muted">{MOCK_DOC.onlineReaders}人正在阅读</span>
          </div>
          <button type="button" onClick={() => useToastStore.getState().addToast('链接已复制到剪贴板', 'success')} className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/15">
            分享
          </button>
          <button
            type="button"
            onClick={() => setShowPermModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-fill-tertiary/50 text-text-secondary rounded-lg text-xs font-medium hover:bg-fill-tertiary/70"
          >
            <Icon name="lock" size={14} />
            申请编辑
          </button>
        </div>
      </div>

      {/* Document content */}
      <div className="flex-1 overflow-y-auto dcf-scrollbar">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {/* Title + meta */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 text-[10px] font-medium text-primary bg-primary/10 rounded">只读</span>
              <span className="px-2 py-0.5 text-[10px] font-medium text-text-muted bg-fill-tertiary rounded">{MOCK_DOC.version}</span>
            </div>
            <h1 className="text-3xl font-bold text-text-primary mb-4">{MOCK_DOC.title}</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Avatar letter={MOCK_DOC.authorAvatar} size={28} gradient="bg-gradient-to-br from-orange-400 to-amber-500" />
                <div>
                  <span className="text-sm font-medium text-text-primary">{MOCK_DOC.author}</span>
                  <span className="text-xs text-text-muted ml-2">{MOCK_DOC.department}</span>
                </div>
              </div>
              <span className="text-xs text-text-muted">更新于 {MOCK_DOC.updatedAt}</span>
              <span className="flex items-center gap-1 text-[11px] text-text-muted">
                <Icon name="visibility" size={14} />
                {MOCK_DOC.readCount} 次阅读
              </span>
            </div>
          </div>

          {/* Financial stat cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="p-4 rounded-xl border text-center"
                style={{ borderColor: `${stat.color}20`, backgroundColor: `${stat.color}05` }}
              >
                <p className="text-[10px] text-text-muted mb-1">{stat.label}</p>
                <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-[10px] text-success mt-1 flex items-center justify-center gap-1">
                  <Icon name="trending_up" size={12} /> {stat.change}
                </p>
              </div>
            ))}
          </div>

          {/* Content body */}
          <div
            className="prose prose-sm max-w-none text-text-primary
              prose-headings:text-text-primary prose-headings:font-semibold
              prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3
              prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
              prose-p:leading-relaxed prose-p:text-text-secondary
              prose-li:text-text-secondary
              prose-strong:text-text-primary
              prose-blockquote:border-l-primary prose-blockquote:text-text-muted prose-blockquote:bg-fill-tertiary/30 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4"
            dangerouslySetInnerHTML={{ __html: MOCK_DOC.content }}
          />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="shrink-0 border-t border-border bg-bg-white-var/80 backdrop-blur-sm px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Icon name="lock" size={14} />
            <span>此文档为只读模式，需要编辑请申请权限</span>
          </div>
          <button
            type="button"
            onClick={() => setShowPermModal(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Icon name="edit" size={16} />
            申请编辑权限
          </button>
        </div>
      </div>

      <RequestEditPermissionModal
        open={showPermModal}
        onClose={() => setShowPermModal(false)}
      />
    </div>
  );
}

/**
 * FactoryWizard — 数字员工创建 4 步向导
 * 参考 im-platform factory.js
 */
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { AgentFactory } from '../../../domain/agent/AgentFactory';
import { useAgentStore } from '../../../application/stores/agentStore';
import { useToastStore } from '../../../application/stores/toastStore';
import type { AgentPersonality, ModelId } from '../../../domain/shared/types';

type Step = 0 | 1 | 2 | 3;

const PERSONALITIES = [
  { key: 'professional', label: '专业严谨', desc: '注重准确性和专业性' },
  { key: 'friendly', label: '友好亲和', desc: '善于沟通，注重体验' },
  { key: 'creative', label: '创意发散', desc: '善于创新，思维活跃' },
  { key: 'analytical', label: '理性分析', desc: '数据驱动，逻辑清晰' },
];

const MODELS = [
  { key: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: '平衡速度与质量' },
  { key: 'claude-opus-4-6', label: 'Claude Opus 4.6', desc: '最强推理能力' },
  { key: 'gpt-4o', label: 'GPT-4o', desc: '多模态均衡' },
  { key: 'deepseek-r1', label: 'DeepSeek R1', desc: '开源深度推理' },
];

export function FactorySidebar() {
  const createdAgents = useAgentStore((s) => s.createdAgents);
  return (
    <div className="p-4 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-text-primary px-1">数字工厂</h3>
      {createdAgents.length > 0 ? (
        <div className="space-y-1">
          {createdAgents.map((agent) => (
            <div key={agent.id} onClick={() => useToastStore.getState().addToast(`已选择: ${agent.name}`, 'info')} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-hover cursor-pointer text-xs">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-white font-bold text-[10px] shrink-0"
                style={{ background: agent.avatarGradient ?? 'linear-gradient(135deg, #007AFF, #5856D6)' }}>
                {agent.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-text-primary font-medium truncate">{agent.name}</p>
                <p className="text-[10px] text-text-muted truncate">{agent.role}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted px-2">暂无已创建的数字员工</p>
      )}
    </div>
  );
}

export function FactoryWizard() {
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState({ name: '', role: '', department: '', persona: '', personality: '', model: '' });
  const [toast, setToast] = useState<string | null>(null);

  const createdAgents = useAgentStore((s) => s.createdAgents);
  const addCreatedAgent = useAgentStore((s) => s.addCreatedAgent);

  const canNext = () => {
    switch (step) {
      case 0: return form.name && form.role;
      case 1: return !!form.personality;
      case 2: return !!form.model;
      default: return true;
    }
  };

  const handleCreate = () => {
    const agent = AgentFactory.createAgent({
      name: form.name,
      role: form.role,
      department: form.department,
      personality: form.personality as AgentPersonality,
      model: form.model as ModelId,
      creatorId: 'current-user',
      description: `${form.role} - ${form.department || '未指定部门'}`,
    });

    addCreatedAgent(agent);
    setToast(`数字员工「${agent.name}」创建成功`);
    setStep(0);
    setForm({ name: '', role: '', department: '', persona: '', personality: '', model: '' });

    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="flex-1 overflow-auto p-6 dcf-scrollbar">
      <div className="max-w-lg mx-auto">
        {/* Toast */}
        {toast && (
          <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
            {toast}
          </div>
        )}

        {/* Created agents grid */}
        {createdAgents.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-text-primary mb-3">已创建的数字员工</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {createdAgents.map((agent) => (
                <Card key={agent.id} className="p-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ background: agent.avatarGradient ?? 'linear-gradient(135deg, #007AFF, #5856D6)' }}
                    >
                      {agent.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text-primary truncate">{agent.name}</p>
                      <p className="text-[10px] text-text-muted truncate">{agent.role}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-xl font-bold text-text-primary mb-1">创建数字员工</h2>
        <p className="text-sm text-text-secondary mb-6">步骤 {step + 1}/4</p>

        {/* Progress */}
        <div className="flex gap-1 mb-6">
          {[0, 1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-black/[0.06]'}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-text-secondary">姓名</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="如：小明" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-secondary">岗位</span>
              <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="如：前端开发工程师" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-secondary">部门</span>
              <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="如：技术部" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-secondary">人设描述（可选）</span>
              <textarea
                value={form.persona || ''}
                onChange={(e) => setForm({ ...form, persona: e.target.value })}
                className="mt-1 w-full h-20 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder="描述这个数字员工的性格和行为特征..."
              />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {PERSONALITIES.map((p) => (
              <Card
                key={p.key}
                onClick={() => setForm({ ...form, personality: p.key })}
                className={`p-3 cursor-pointer ${form.personality === p.key ? 'ring-2 ring-primary' : ''}`}
              >
                <h4 className="text-sm font-medium text-text-primary">{p.label}</h4>
                <p className="text-xs text-text-muted mt-0.5">{p.desc}</p>
              </Card>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            {MODELS.map((m) => (
              <Card
                key={m.key}
                onClick={() => setForm({ ...form, model: m.key })}
                className={`p-3 cursor-pointer ${form.model === m.key ? 'ring-2 ring-primary' : ''}`}
              >
                <h4 className="text-sm font-medium text-text-primary">{m.label}</h4>
                <p className="text-xs text-text-muted">{m.desc}</p>
              </Card>
            ))}
          </div>
        )}

        {step === 3 && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">确认创建</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-text-secondary">姓名：</span>{form.name}</p>
              <p><span className="text-text-secondary">岗位：</span>{form.role}</p>
              <p><span className="text-text-secondary">部门：</span>{form.department || '未指定'}</p>
              <p><span className="text-text-secondary">人设：</span>{PERSONALITIES.find((p) => p.key === form.personality)?.label}</p>
              <p><span className="text-text-secondary">模型：</span>{MODELS.find((m) => m.key === form.model)?.label}</p>
            </div>
          </Card>
        )}

        <div className="flex justify-between mt-6">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1) as Step)} disabled={step === 0}>
            上一步
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((step + 1) as Step)} disabled={!canNext()}>
              下一步
            </Button>
          ) : (
            <Button onClick={handleCreate}>
              创建
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

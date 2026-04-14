import type { MessageBlock } from '../../../../domain/agent/MessageBlock';
import type { OpenClawDrawerContent } from '../../../../domain/agent/DrawerContent';
import { TaskCardBlockComponent } from './TaskCardBlock';
import { SourceRefBlockComponent } from './SourceRefBlock';
import { KPIBlockComponent } from './KPIBlock';
import { DataTableBlockComponent } from './DataTableBlock';
import { ActionConfirmBlockComponent } from './ActionConfirmBlock';
import { CodeResultBlockComponent } from './CodeResultBlock';
import { CollaborationChainBlockComponent } from './CollaborationChainBlockComponent';
import { SuggestedActionsBlockComponent } from './SuggestedActionsBlock';
import { EmailDraftBlockComponent } from './EmailDraftBlock';
import { AppPreviewBlockComponent } from './AppPreviewBlock';
import { DocEditorBlockComponent } from './DocEditorBlock';
import { ProjectBoardBlockComponent } from './ProjectBoardBlock';
import { useOpenClawStore } from '../../../../application/stores/openclawStore';
import { DecisionRequestCard } from '../DecisionRequestCard';

interface Props {
  blocks: MessageBlock[];
  onOpenDrawer: (content: OpenClawDrawerContent) => void;
  onConfirmAction?: (actionId: string) => void;
  onCancelAction?: (actionId: string) => void;
}

export function MessageBlockRenderer({
  blocks,
  onOpenDrawer,
  onConfirmAction,
  onCancelAction,
}: Props) {
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'task-card':
            return (
              <TaskCardBlockComponent
                key={`task-${block.taskId}-${i}`}
                taskId={block.taskId}
                onOpen={onOpenDrawer}
              />
            );

          case 'source-ref':
            return (
              <SourceRefBlockComponent
                key={`src-${block.sourceId}-${i}`}
                sourceId={block.sourceId}
                title={block.title}
                snippet={block.snippet}
                onOpen={onOpenDrawer}
              />
            );

          case 'kpi':
            return <KPIBlockComponent key={`kpi-${i}`} items={block.items} />;

          case 'data-table':
            return (
              <DataTableBlockComponent
                key={`table-${i}`}
                title={block.title}
                columns={block.columns}
                rows={block.rows}
                truncated={block.truncated}
                onOpen={onOpenDrawer}
              />
            );

          case 'action-confirm':
            return (
              <ActionConfirmBlockComponent
                key={`action-${block.actionId}-${i}`}
                actionId={block.actionId}
                title={block.title}
                description={block.description}
                status={block.status}
                onConfirm={onConfirmAction}
                onCancel={onCancelAction}
              />
            );

          case 'file-ref':
            // FileRef 暂用简单文本渲染，后续可独立组件化
            return (
              <div
                key={`file-${block.fileName}-${i}`}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-white/10 bg-white/[0.03]"
              >
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>
                  description
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-200 truncate">
                    {block.fileName}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {block.fileType}
                    {block.size ? ` · ${block.size}` : ''}
                  </div>
                </div>
              </div>
            );

          case 'code-result':
            return (
              <CodeResultBlockComponent
                key={`code-${i}`}
                language={block.language}
                code={block.code}
                fileName={block.fileName}
                onOpen={onOpenDrawer}
              />
            );

          case 'collaboration-chain':
            return (
              <CollaborationChainBlockComponent
                key={`chain-${block.chainId}-${i}`}
                chainId={block.chainId}
                chainName={block.chainName}
                nodeCount={block.nodeCount}
                activeNodeName={block.activeNodeName}
                onOpen={onOpenDrawer}
              />
            );

          case 'decision-request': {
            const decision = useOpenClawStore.getState().decisionRequests.find(
              (d) => d.id === block.decisionId,
            );
            if (!decision) return null;
            return (
              <DecisionRequestCard
                key={`decision-${block.decisionId}-${i}`}
                decision={decision}
                onAccept={() => {
                  useOpenClawStore.getState().respondDecision(block.decisionId, 'accept');
                }}
                onViewDetail={() => {
                  onOpenDrawer({ type: 'decision-detail', title: block.title, data: { decisionId: block.decisionId } });
                }}
                onDefer={() => {
                  useOpenClawStore.getState().respondDecision(block.decisionId, 'defer', { deferUntil: Date.now() + 3_600_000 });
                }}
              />
            );
          }

          case 'goal-progress': {
            const goal = useOpenClawStore.getState().goals.find(
              (g) => g.id === block.goalId,
            );
            if (!goal) return null;
            return (
              <button
                key={`goal-${block.goalId}-${i}`}
                type="button"
                onClick={() => {
                  useOpenClawStore.getState().setActiveGoal(goal.id);
                  onOpenDrawer({ type: 'goal-tracker', title: '目标追踪', data: { goalId: goal.id } });
                }}
                className="w-full p-2.5 rounded-lg border border-green-500/20 bg-green-500/5 hover:bg-green-500/10 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-green-400" style={{ fontSize: 14 }}>flag</span>
                  <span className="text-xs font-medium text-slate-200">{block.title}</span>
                  <span className="text-[10px] text-slate-500 ml-auto">{block.progress}%</span>
                </div>
                {block.milestoneName && (
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 12 }}>radio_button_checked</span>
                    <span className="text-[11px] text-slate-400">{block.milestoneName}</span>
                  </div>
                )}
                <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-400 to-primary transition-all duration-500"
                    style={{ width: `${block.progress}%` }}
                  />
                </div>
              </button>
            );
          }

          case 'suggested-actions':
            return (
              <SuggestedActionsBlockComponent
                key={`sa-${i}`}
                title={block.title}
                actions={block.actions}
              />
            );

          case 'email-draft':
            return (
              <EmailDraftBlockComponent
                key={`email-draft-${i}`}
                from={block.from}
                to={block.to}
                cc={block.cc}
                subject={block.subject}
                date={block.date}
                body={block.body}
              />
            );

          case 'app-preview':
            return (
              <AppPreviewBlockComponent
                key={`app-${block.appId}-${i}`}
                appId={block.appId}
                appName={block.appName}
                stage={block.stage}
                onOpen={onOpenDrawer}
              />
            );

          case 'doc-editor':
            return (
              <DocEditorBlockComponent
                key={`doc-${block.docId}-${i}`}
                docId={block.docId}
                docTitle={block.docTitle}
                sectionsReady={block.sectionsReady}
                totalSections={block.totalSections}
                onOpen={onOpenDrawer}
              />
            );

          case 'project-board':
            return (
              <ProjectBoardBlockComponent
                key={`board-${block.boardId}-${i}`}
                boardId={block.boardId}
                boardName={block.boardName}
                totalCards={block.totalCards}
                activeAgents={block.activeAgents}
                onOpen={onOpenDrawer}
              />
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

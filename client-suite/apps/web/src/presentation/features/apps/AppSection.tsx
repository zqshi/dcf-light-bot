import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';
import type { AppItem } from '../../../data/mockApps';

interface AppSectionProps {
  title: string;
  apps: AppItem[];
}

export function AppSection({ title, apps }: AppSectionProps) {
  if (apps.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-y-5 gap-x-4">
        {apps.map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={() => useToastStore.getState().addToast(`正在打开「${app.name}」…`, 'info')}
            className="group flex flex-col items-center gap-2 cursor-pointer"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ background: `${app.color}12` }}
            >
              <Icon name={app.icon} size={26} style={{ color: app.color }} />
            </div>
            <span className="text-xs text-text-primary font-medium text-center leading-tight line-clamp-1 max-w-[72px]">
              {app.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

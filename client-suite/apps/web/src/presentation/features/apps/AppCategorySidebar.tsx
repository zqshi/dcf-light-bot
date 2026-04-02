/** @deprecated Use inline filter chips in AppsGrid */
import { Icon } from '../../components/ui/Icon';
import { SearchInput } from '../../components/ui/SearchInput';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { APP_CATEGORIES, type AppCategory } from '../../../data/mockApps';

type SidebarView = AppCategory | 'all' | 'recent' | 'favorites';

interface AppCategorySidebarProps {
  activeView: SidebarView;
  onSelect: (view: SidebarView) => void;
  search?: string;
  onSearchChange?: (v: string) => void;
}

const COLLECTIONS: { key: SidebarView; label: string; icon: string }[] = [
  { key: 'all', label: '全部应用', icon: 'apps' },
  { key: 'recent', label: '最近使用', icon: 'history' },
  { key: 'favorites', label: '收藏夹', icon: 'star' },
];

export function AppCategorySidebar({ activeView, onSelect, search, onSearchChange }: AppCategorySidebarProps) {
  return (
    <div className="p-4 flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-text-primary">轻应用</h3>
      {onSearchChange && (
        <SearchInput value={search ?? ''} onChange={onSearchChange} placeholder="搜索应用..." />
      )}

      {/* 合集 */}
      <div className="space-y-0.5">
        <SectionLabel>合集</SectionLabel>
        {COLLECTIONS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
              activeView === key ? 'bg-primary/10 text-primary font-semibold' : 'text-text-primary hover:bg-bg-hover font-medium'
            }`}
          >
            <Icon name={icon} size={16} className={activeView === key ? 'text-primary' : 'text-text-secondary'} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* 分类 */}
      <div className="space-y-0.5">
        <SectionLabel>分类</SectionLabel>
        {APP_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => onSelect(cat.key)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
              activeView === cat.key ? 'bg-primary/10 text-primary font-semibold' : 'text-text-primary hover:bg-bg-hover font-medium'
            }`}
          >
            <Icon name={cat.icon} size={16} className={activeView === cat.key ? 'text-primary' : 'text-text-secondary'} />
            <span>{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

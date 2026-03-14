import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { SearchInput } from '../../components/ui/SearchInput';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Avatar } from '../../components/ui/Avatar';
import { useUIStore } from '../../../application/stores/uiStore';
import { useAuthStore } from '../../../application/stores/authStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { useChatStore } from '../../../application/stores/chatStore';
import { globalSelectRoom } from '../../../application/hooks/useMatrixClient';
import { employeeApi } from '../../../infrastructure/api/dcfApiClient';
import { MOCK_CONTACTS } from '../../../data/mockContacts';

interface Contact {
  id: string;
  name: string;
  letter: string;
  title: string;
  department: string;
  departmentId: string;
  status: 'online' | 'busy' | 'offline';
  email: string;
  matrixUserId?: string;
}

const STATUS_MAP: Record<Contact['status'], { color: string; label: string }> = {
  online: { color: 'bg-green-400', label: '在线' },
  busy: { color: 'bg-amber-400', label: '忙碌' },
  offline: { color: 'bg-slate-400', label: '离线' },
};

/** Map backend status to UI status */
function mapStatus(backendStatus: string): Contact['status'] {
  const s = (backendStatus || '').toLowerCase();
  if (s === 'running' || s === 'active') return 'online';
  if (s === 'degraded' || s === 'busy') return 'busy';
  return 'offline';
}

/** Get department ID from department name */
function deptId(dept: string): string {
  const map: Record<string, string> = {
    operations: 'ops', engineering: 'product', finance: 'finance',
    marketing: 'marketing', hr: 'hr', product: 'product', design: 'design',
  };
  return map[dept?.toLowerCase()] || dept?.toLowerCase() || 'other';
}

/** Convert backend employee to Contact */
function toContact(emp: Record<string, any>): Contact {
  const name = emp.displayName || emp.name || emp.id;
  return {
    id: emp.id,
    name,
    letter: name.charAt(0),
    title: emp.jobTitle || emp.role || '',
    department: emp.department || '',
    departmentId: deptId(emp.department),
    status: mapStatus(emp.status),
    email: emp.email || '',
    matrixUserId: emp.matrixRoomId ? undefined : undefined, // Matrix DM uses room matching by name
  };
}

/** Shared hook for loading contacts from backend (demo mode → mock data) */
function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const isDemo = useAuthStore((s) => s.isDemo);

  useEffect(() => {
    if (isDemo) {
      setContacts(MOCK_CONTACTS as Contact[]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await employeeApi.list();
        if (!cancelled) {
          const mapped = (Array.isArray(rows) ? rows : []).map(toContact);
          setContacts(mapped.length > 0 ? mapped : MOCK_CONTACTS as Contact[]);
        }
      } catch {
        // Backend unreachable — fallback to mock
        if (!cancelled) setContacts(MOCK_CONTACTS as Contact[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isDemo]);

  return { contacts, loading };
}

/** Build department list from actual contact data */
function buildDepartments(contacts: Contact[]) {
  const deptMap = new Map<string, { id: string; label: string; count: number }>();
  for (const c of contacts) {
    const did = c.departmentId;
    const existing = deptMap.get(did);
    if (existing) {
      existing.count++;
    } else {
      deptMap.set(did, { id: did, label: c.department || did, count: 1 });
    }
  }
  const sorted = Array.from(deptMap.values()).sort((a, b) => b.count - a.count);
  return [{ id: 'all', label: '全部成员', count: contacts.length }, ...sorted];
}

export function ContactsSidebar() {
  const [search, setSearch] = useState('');
  const activeDept = useUIStore((s) => s.contactsDept);
  const setDept = useUIStore((s) => s.setContactsDept);
  const { contacts } = useContacts();
  const departments = buildDepartments(contacts);

  return (
    <div className="p-4 flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-text-primary">通讯录</h3>
      <SearchInput value={search} onChange={setSearch} placeholder="搜索联系人..." />
      <div className="space-y-0.5">
        <SectionLabel>组织架构</SectionLabel>
        {departments.filter((d) => !search || d.label.includes(search)).map((dept) => (
          <button
            key={dept.id}
            type="button"
            onClick={() => setDept(dept.id)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
              activeDept === dept.id ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-bg-hover text-text-primary font-medium'
            }`}
          >
            <Icon name="folder" size={16} className={activeDept === dept.id ? 'text-primary' : 'text-text-secondary'} />
            <span className="flex-1 text-left">{dept.label}</span>
            <span className="text-[10px] text-text-muted">{dept.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ContactsPage() {
  const activeDept = useUIStore((s) => s.contactsDept);
  const [search, setSearch] = useState('');
  const { contacts, loading } = useContacts();

  const filtered = contacts.filter((c) => {
    if (activeDept !== 'all' && c.departmentId !== activeDept) return false;
    if (search && !c.name.includes(search) && !c.title.includes(search)) return false;
    return true;
  });

  const handleStartChat = async (contact: Contact) => {
    const rooms = useChatStore.getState().rooms;
    const existingRoom = contact.matrixUserId
      ? rooms.find((r) => r.type === 'dm' && r.name === contact.name)
      : null;

    useUIStore.getState().setDock('messages');

    if (existingRoom) {
      await globalSelectRoom(existingRoom.id);
      useToastStore.getState().addToast(`已打开与 ${contact.name} 的对话`, 'success');
    } else if (contact.matrixUserId) {
      const { getMatrixClient } = await import('../../../application/hooks/useMatrixClient');
      const client = getMatrixClient();
      if (!client) return;
      try {
        const roomId = await client.createDmRoom(contact.matrixUserId);
        if (roomId) {
          await globalSelectRoom(roomId);
          useToastStore.getState().addToast(`已创建与 ${contact.name} 的对话`, 'success');
        }
      } catch {
        useToastStore.getState().addToast('创建对话失败', 'error');
      }
    } else {
      useToastStore.getState().addToast(`${contact.name} 暂无 IM 账号`, 'info');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">
            {activeDept === 'all' ? '全部成员' : (buildDepartments(contacts).find((d) => d.id === activeDept)?.label ?? activeDept)}
          </h2>
          <SearchInput value={search} onChange={setSearch} placeholder="搜索..." className="w-48" />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        <div className="space-y-1">
          {!loading && filtered.map((contact) => {
            const st = STATUS_MAP[contact.status];
            return (
              <div
                key={contact.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-bg-hover transition-colors cursor-pointer"
                onClick={() => useToastStore.getState().addToast(`查看联系人: ${contact.name}`, 'info')}
              >
                <div className="relative">
                  <Avatar letter={contact.letter} size={40} />
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${st.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{contact.name}</span>
                    <span className="text-[10px] text-text-muted">{st.label}</span>
                  </div>
                  <p className="text-xs text-text-secondary">{contact.title} · {contact.department}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => handleStartChat(contact)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted transition-colors" title="发消息">
                    <Icon name="chat" size={16} />
                  </button>
                  <button type="button" onClick={() => { window.open(`mailto:${contact.email}`); }} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted transition-colors" title="发邮件">
                    <Icon name="email" size={16} />
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-text-muted text-center py-12">暂无匹配的联系人</p>
          )}
        </div>
      </div>
    </div>
  );
}

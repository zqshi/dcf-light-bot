export interface FolderProps {
  id: string;
  name: string;
  parentId: string | null;
  icon: string;
  children?: Folder[];
  documentCount?: number;
}

export class Folder {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly icon: string;
  readonly children: Folder[];
  readonly documentCount: number;

  private constructor(props: FolderProps) {
    this.id = props.id;
    this.name = props.name;
    this.parentId = props.parentId;
    this.icon = props.icon;
    this.children = props.children ?? [];
    this.documentCount = props.documentCount ?? 0;
  }

  static create(props: FolderProps): Folder {
    return new Folder(props);
  }

  get isRoot(): boolean {
    return this.parentId === null;
  }

  get hasChildren(): boolean {
    return this.children.length > 0;
  }

  withChildren(children: Folder[]): Folder {
    return new Folder({ ...this, children });
  }

  matchesSearch(query: string): boolean {
    if (!query) return true;
    return this.name.toLowerCase().includes(query.toLowerCase());
  }
}

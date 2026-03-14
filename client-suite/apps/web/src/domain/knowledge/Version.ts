export interface VersionProps {
  id: string;
  documentId: string;
  version: number;
  author: { name: string; avatar?: string };
  createdAt: string;
  changeDescription: string;
  diffStats: { added: number; removed: number };
}

export class Version {
  readonly id: string;
  readonly documentId: string;
  readonly version: number;
  readonly author: { name: string; avatar?: string };
  readonly createdAt: string;
  readonly changeDescription: string;
  readonly diffStats: { added: number; removed: number };

  private constructor(props: VersionProps) {
    this.id = props.id;
    this.documentId = props.documentId;
    this.version = props.version;
    this.author = props.author;
    this.createdAt = props.createdAt;
    this.changeDescription = props.changeDescription;
    this.diffStats = props.diffStats;
  }

  static create(props: VersionProps): Version {
    return new Version(props);
  }

  get totalChanges(): number {
    return this.diffStats.added + this.diffStats.removed;
  }
}

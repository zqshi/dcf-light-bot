export type DocumentType = 'doc' | 'sheet' | 'slide' | 'markdown';

export interface DocumentProps {
  id: string;
  title: string;
  content: string;
  folderId: string;
  type: DocumentType;
  createdAt: string;
  updatedAt: string;
  author: { name: string; avatar?: string };
  tags?: string[];
  starred?: boolean;
  size?: string;
}

export class Document {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly folderId: string;
  readonly type: DocumentType;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly author: { name: string; avatar?: string };
  readonly tags: string[];
  readonly starred: boolean;
  readonly size: string;

  private constructor(props: DocumentProps) {
    this.id = props.id;
    this.title = props.title;
    this.content = props.content;
    this.folderId = props.folderId;
    this.type = props.type;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.author = props.author;
    this.tags = props.tags ?? [];
    this.starred = props.starred ?? false;
    this.size = props.size ?? '0 KB';
  }

  static create(props: DocumentProps): Document {
    return new Document(props);
  }

  withContent(content: string): Document {
    return new Document({
      ...this,
      content,
      updatedAt: new Date().toISOString(),
    });
  }

  withStarred(starred: boolean): Document {
    return new Document({ ...this, starred });
  }

  get excerpt(): string {
    const plain = this.content.replace(/<[^>]*>/g, '');
    return plain.length > 100 ? plain.slice(0, 100) + '...' : plain;
  }

  matchesSearch(query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      this.title.toLowerCase().includes(q) ||
      this.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
}

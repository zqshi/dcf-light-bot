export type CoTStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface CoTStep {
  id: string;
  label: string;
  status: CoTStepStatus;
  detail: string;
}

import type { MessageBlock } from './MessageBlock';

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio';
  name: string;
  size: number;
  mimeType: string;
  url: string;
}

export interface CoTMessageProps {
  id: string;
  agentId: string;
  sessionId: string;
  role: 'user' | 'agent';
  text: string;
  html?: string;
  timestamp: number;
  cotSteps?: CoTStep[];
  blocks?: MessageBlock[];
  attachments?: Attachment[];
}

export class CoTMessage {
  readonly id: string;
  readonly agentId: string;
  readonly sessionId: string;
  readonly role: 'user' | 'agent';
  readonly text: string;
  readonly html?: string;
  readonly timestamp: number;
  readonly cotSteps?: CoTStep[];
  readonly blocks?: MessageBlock[];
  readonly attachments?: Attachment[];

  private constructor(props: CoTMessageProps) {
    this.id = props.id;
    this.agentId = props.agentId;
    this.sessionId = props.sessionId;
    this.role = props.role;
    this.text = props.text;
    this.html = props.html;
    this.timestamp = props.timestamp;
    this.cotSteps = props.cotSteps;
    this.blocks = props.blocks;
    this.attachments = props.attachments;
  }

  static create(props: CoTMessageProps): CoTMessage {
    return new CoTMessage(props);
  }

  appendText(chunk: string): CoTMessage {
    return new CoTMessage({ ...this.toProps(), text: this.text + chunk });
  }

  withText(text: string): CoTMessage {
    return new CoTMessage({ ...this.toProps(), text });
  }

  withHtml(html: string): CoTMessage {
    return new CoTMessage({ ...this.toProps(), html });
  }

  withSteps(steps: CoTStep[]): CoTMessage {
    return new CoTMessage({ ...this.toProps(), cotSteps: steps });
  }

  withBlocks(blocks: MessageBlock[]): CoTMessage {
    return new CoTMessage({ ...this.toProps(), blocks });
  }

  appendBlock(block: MessageBlock): CoTMessage {
    return new CoTMessage({ ...this.toProps(), blocks: [...(this.blocks ?? []), block] });
  }

  withAttachments(attachments: Attachment[]): CoTMessage {
    return new CoTMessage({ ...this.toProps(), attachments });
  }

  private toProps(): CoTMessageProps {
    return {
      id: this.id,
      agentId: this.agentId,
      sessionId: this.sessionId,
      role: this.role,
      text: this.text,
      html: this.html,
      timestamp: this.timestamp,
      cotSteps: this.cotSteps,
      blocks: this.blocks,
      attachments: this.attachments,
    };
  }
}

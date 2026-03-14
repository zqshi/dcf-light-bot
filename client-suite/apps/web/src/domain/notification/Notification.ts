export type NotificationType = 'system' | 'mention' | 'approval' | 'update';

export interface NotificationSender {
  name: string;
  avatar?: string;
}

export interface NotificationProps {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  sender: NotificationSender;
  roomId?: string;
}

export class Notification {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly timestamp: string;
  readonly read: boolean;
  readonly sender: NotificationSender;
  readonly roomId?: string;

  private constructor(props: NotificationProps) {
    this.id = props.id;
    this.type = props.type;
    this.title = props.title;
    this.body = props.body;
    this.timestamp = props.timestamp;
    this.read = props.read;
    this.sender = props.sender;
    this.roomId = props.roomId;
  }

  static create(props: NotificationProps): Notification {
    return new Notification(props);
  }

  markAsRead(): Notification {
    return new Notification({ ...this.toProps(), read: true });
  }

  get isUnread(): boolean {
    return !this.read;
  }

  private toProps(): NotificationProps {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      body: this.body,
      timestamp: this.timestamp,
      read: this.read,
      sender: this.sender,
      roomId: this.roomId,
    };
  }
}

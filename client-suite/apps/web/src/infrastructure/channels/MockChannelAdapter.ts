import type { ChannelAdapter } from './ChannelAdapter';
import type { ChannelType } from '../../domain/shared/types';
import type { NotificationProps } from '../../domain/notification/Notification';

/**
 * MockChannelAdapter — demo mode adapter that injects pre-built notifications.
 * In production, each platform gets a real adapter (LarkSDK, Slack Bolt, SMTP, etc.)
 */
export class MockChannelAdapter implements ChannelAdapter {
  constructor(
    public readonly channelType: ChannelType,
    public readonly displayName: string,
  ) {}

  get isConnected(): boolean {
    return true;
  }

  startListening(onMessage: (props: NotificationProps) => void): () => void {
    // In demo mode, no-op — notifications are injected via openclawStore.initialize()
    return () => {};
  }

  async sendReply(params: { externalId: string; roomId?: string; body: string }): Promise<void> {
    console.log(`[MockChannelAdapter:${this.channelType}] Reply sent to ${params.externalId}:`, params.body);
  }

  async markAsRead(externalId: string): Promise<void> {
    console.log(`[MockChannelAdapter:${this.channelType}] Marked as read:`, externalId);
  }
}

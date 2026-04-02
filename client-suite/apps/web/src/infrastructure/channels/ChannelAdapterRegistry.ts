import type { ChannelType } from '../../domain/shared/types';
import type { ChannelAdapter } from './ChannelAdapter';
import { MockChannelAdapter } from './MockChannelAdapter';

/**
 * ChannelAdapterRegistry — manages all registered platform adapters.
 * Provides lookup by channel type and iteration over all adapters.
 */
class ChannelAdapterRegistryImpl {
  private adapters = new Map<ChannelType, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.channelType, adapter);
  }

  get(channelType: ChannelType): ChannelAdapter | undefined {
    return this.adapters.get(channelType);
  }

  getAll(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }

  /** Initialize with mock adapters for demo mode */
  static createDemo(): ChannelAdapterRegistryImpl {
    const registry = new ChannelAdapterRegistryImpl();
    const configs: Array<{ type: ChannelType; name: string }> = [
      { type: 'lark', name: 'Lark (飞书)' },
      { type: 'slack', name: 'Slack' },
      { type: 'email', name: 'Email' },
      { type: 'matrix', name: 'Matrix' },
      { type: 'wechat', name: 'WeChat (微信)' },
      { type: 'teams', name: 'Microsoft Teams' },
    ];
    for (const cfg of configs) {
      registry.register(new MockChannelAdapter(cfg.type, cfg.name));
    }
    return registry;
  }
}

export const channelAdapterRegistry = ChannelAdapterRegistryImpl.createDemo();

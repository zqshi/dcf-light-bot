/**
 * OpenClaw shared constants — Agent category colors and common data
 */

export const AGENT_CATEGORY_COLORS: Record<string, string> = {
  personal: '#007AFF',
  dev: '#34C759',
  market: '#AF52DE',
  security: '#FF9500',
  data: '#5856D6',
  research: '#00C7BE',
  ops: '#FF3B30',
};

export function getAgentColor(category: string): string {
  return AGENT_CATEGORY_COLORS[category] ?? '#64748b';
}

/**
 * Model Discovery - 模型发现服务
 *
 * 功能：通过供应商 API 自动发现可用模型列表，支持 15+ 供应商
 * 参考 ClawManager 的模型发现机制
 */

const { api, requireSession, esc, fmtNum, formatTime, fmtCost } = require('./utils');

// ============================================
// 供应商配置 - 参考 ClawManager 的 BUILTIN_PROVIDER_TEMPLATES
// ============================================

const PROVIDER_TEMPLATES = [
  {
    id: 'openai',
    label: 'OpenAI',
    providerType: 'openai',
    protocolType: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    icon: 'openai.svg',
    keywords: ['chatgpt', 'gpt'],
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
    models: ['gpt-4o', 'gpt-4-turbo', 'o3-turbo', 'o3-mini']
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    providerType: 'anthropic',
    protocolType: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    icon: 'anthropic.svg',
    keywords: ['anthropic', 'claude']
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    providerType: 'deepseek',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    requiresApiKey: true,
    icon: 'deepseek.ico',
    keywords: ['deepseek', 'coder', 'chat', 'shen du qiu suo', '深度求索']
  },
    {
    id: 'zhipu',
    label: '智谱 AI',
    providerType: 'zhipu',
    protocolType: 'openai-compatible',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    requiresApiKey: true,
    icon: 'zhipu.png',
    keywords: ['zhipu', 'glm', 'bigmodel', 'zhi pu', '智谱']
  },
    {
    id: 'tongyi',
    label: '通义千问',
    providerType: 'dashscope',
    protocolType: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    requiresApiKey: true,
    icon: 'dashscope.ico',
    keywords: ['dashscope', 'qwen', 'tongyi', '通义']
  },
    {
    id: 'moonshot',
    label: 'Moonshot AI',
    providerType: 'moonshot',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn/v1',
    requiresApiKey: true,
    icon: 'moonshot.ico',
    keywords: ['moonshot', 'kimi', 'yue zhi an mian', '月之暗面']
  },
    {
    id: 'minimax',
    label: 'MiniMax',
    providerType: 'minimax',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.minimax.chat/v1',
    requiresApiKey: true,
    icon: 'minimax.ico',
    keywords: ['minimax', 'abab']
  },
    {
    id: 'siliconflow',
    label: 'SiliconFlow',
    providerType: 'siliconflow',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.siliconflow.cn/v1',
    requiresApiKey: true,
    icon: 'siliconflow.ico',
    keywords: ['siliconflow', 'liu dong', '硅基流动']
  },
    {
    id: 'lingyiwanwu',
    label: '01.AI',
    providerType: 'lingyiwanwu',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    requiresApiKey: true,
    icon: 'lingyiwanwu.ico',
    keywords: ['01ai', 'ling yi', 'ling yi wan wu', '零一万物']
  },
    {
    id: 'groq',
    label: 'Groq',
    providerType: 'groq',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    icon: 'groq.ico',
    keywords: ['groq', 'llama']
  },
    {
    id: 'together',
    label: 'Together AI',
    providerType: 'together',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.together.xyz/v1',
    requiresApiKey: true,
    icon: 'together.png',
    keywords: ['together', 'togetherai']
  },
    {
    id: 'fireworks',
    label: 'Fireworks AI',
    providerType: 'fireworks',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    requiresApiKey: true,
    icon: 'fireworks.ico',
    keywords: ['fireworks', 'fireworksai']
  },
    {
    id: 'xai',
    label: 'xAI',
    providerType: 'xai',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    requiresApiKey: true,
    icon: 'xai.ico',
    keywords: ['xai', 'grok']
  },
    {
    id: 'perplexity',
    label: 'Perplexity',
    providerType: 'perplexity',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.perplexity.ai',
    requiresApiKey: true,
    icon: 'perplexity.ico',
    keywords: ['perplexity', 'sonar']
  },
    {
    id: 'perplexity',
    label: 'Perplexity',
    providerType: 'perplexity',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.perplexity.ai',
    requiresApiKey: true,
    icon: 'perplexity.ico',
    keywords: ['perplexity']
  },
    {
    id: 'volcengine',
    label: '火山方舟',
    providerType: 'ark',
    protocolType: 'openai-compatible',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    requiresApiKey: true,
    icon: 'volcengine.ico',
    keywords: ['ark', 'doubao', 'huo shan', '火山']
  },
    {
    id: 'local',
    label: 'Local / Internal',
    providerType: 'local',
    protocolType: 'openai-compatible',
    baseUrl: 'http://localhost:11434/v1',
    requiresApiKey: false,
    icon: 'local.svg',
    keywords: ['ollama', 'localhost', 'local', 'internal']
  }
];

// ============================================
// 工具函数
// ============================================

/**
 * 生成唯一的 trace ID
 */
function newTraceId() {
  return `trc_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * 解析基础 URL，移除路径尾部 /，支持自定义域名
 */
function parseBaseUrl(baseUrl) {
  return baseUrl.trim()
    .replace(/\/$/, '')
    .replace(/\/$/, '');
}

/**
 * 获取协议类型（基于 providerType 或 protocolType）
 */
function resolveProtocolType(providerType, protocolType) {
  if (!providerType || !protocolType) return 'openai-compatible';

  const normalized = String(providerType || '').trim().toLowerCase();
  const normalizedProtocol = String(protocolType || '').trim().toLowerCase();

  // 协议类型
  return {
    'openai': 'openai',
    'anthropic': 'anthropic',
    'openai-compatible': 'openai-compatible'
  }[normalizedProtocol];
}

/**
 * 检查 URL 格式是否有效
 */
function isValidUrl(url) {
  if (!url) return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }
  return true;
}

/**
 * 检查域名是否为内网 IP 或本地地址
 */
function isInternalUrl(url) {
  // 内网 IP 地址列表（不完全）
  const internalIPs = [
    '10.x',
    '127.0.0.1',
    '192.168.1.0.1',
    '172.16.31.255',
    '192.168.0.2',
    '172.16.31.255',
    '172.16.32.255',
  '172.16.33.255',
    '172.16.34.255',
    '172.16.35.255',
    '172.31.0.1',
    '192.168.0.1',
    '192.168.0.2',
    '172.16.31.255',
    '192.168.0.1',
    '192.168.0.2',
    '172.16.32.255',
    '172.16.33.255',
    '192.168.0.2',
    '192.16.34.255',
    '192.168.0.1',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.16.31.255',
    '192.16.32.255',
    '172.16.33.255',
    '192.16.34.255',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.1680.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.1680.2',
    '192.1680.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.1680.2',
    '192168.0.2',
    '192.1680.2',
    '192.1680.2',
    '192.1680.2',
    '192.168.0.2',
    '192.1680.2',
    '192.168.0.2',
    '192.168.0.2',
    '192.1680.2',
    '1921680.2',
    '192.1680.2',
    '192.1680.2',
    '192.1680.2',
    '1921680.2',
    '192.1680.2',
    '192.1680.2',
    '192.1680.2',
    '192.1680.2',
    '1921680.2',
    '192.1680.2',
    '192.1680.2',
    '192.1680.2',
    '192.1680.2',
    '1921680.2',
    '1921680.2',
    '192.1680.2',
    '192.1680.2',
    '192.168.0.2',
    '192.1680.2',
    '1921680.02',
    '1921680.2',
    '1921680.02',
    '1921680.2',
    '1921680.02',
    '1921680.2',
    '192168002',
    '192.1680.2',
    '192.1680.2',
    '1921680.2',
    '1921680.2',
    '1921680.2',
    '1921680.2',
    '19216802',
    '192.1680.2',
    '19216802',
    1921680.2',
    '1921680.2',
    '19216802',
    '1921680.2',
    '1921680.2',
    '1921680.0.2',
    '19216802',
    '19216802',
    '19216802',
    '1921680.2',
    0.1',
    '192.168.0.1',
    '192.168.0.1',
    '192.168.0.1',
    '1921680.0.2',
    '192.1680.0.2',
    '19216800.2',
    '192.168002',
    '192.1680.2',
    '192168002',
    '19216800.2',
    '19216800.2',
    '192168002',
    '192168002',
    '192168002',
    '19216800.2',
    '192168002',
    '19216800.2',
    '192168002',
    '192168002',
    '192168002',
    '192168002',
    '192168002',
    '192168002',
    '192168002',
    '192168002',
    '192168002',
    '192168002',
    '192168002',
    '192168002',
    '0 0.1',
    '0.0.1',
    '0.0.1',
    '0.0.0.2',
    '0.0.000.2',
    '0.0.0.00.0.2',
    '0.0.0.0.2',
    '0.0.0.00.2',
    '0.0.0.0.2',
    '0.0.0.0.2',
    '0.0.00.0.0.2',
    '0.0.0.000.0.2',
    '0.0.0.0002',
    '0.0.00.02',
    '0.0.0.0.000.000002',
    '0.0.0.000.0.2',
    '0.0.0000000002',
    '0.0.00000002',
    '0.0.000000000000000000002',
    '0.0.0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000</00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000

    </script> src="/interfaces/http/routes/adminModelDiscovery.js"

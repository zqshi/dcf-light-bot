/**
 * AI Gateway - 模型供应商模板
 * 参考 ClawManager frontend/src/lib/modelProviderTemplates.ts
 * 用于快速配置不同供应商的模型
 */

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
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', displayName: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', displayName: 'GPT-4o Mini' },
      { id: 'o1', name: 'o1', displayName: 'o1' },
      { id: 'o3-mini', name: 'o3-mini', displayName: 'o3-mini' }
    ]
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    providerType: 'anthropic',
    protocolType: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    icon: 'anthropic.svg',
    keywords: ['anthropic', 'claude'],
    models: [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', displayName: 'Claude Opus 4.6' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', displayName: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', displayName: 'Claude Haiku 4.5' }
    ]
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    providerType: 'deepseek',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    requiresApiKey: true,
    icon: 'deepseek.ico',
    keywords: ['deepseek', 'coder', 'chat', 'shen du qiu suo', '深度求索'],
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', displayName: 'deepseek-chat' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', displayName: 'deepseek-reasoner' }
    ]
  },
  {
    id: 'zhipu',
    label: '智谱 AI',
    providerType: 'zhipu',
    protocolType: 'openai-compatible',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    requiresApiKey: true,
    icon: 'zhipu.png',
    keywords: ['zhipu', 'glm', 'bigmodel', 'zhi pu', '智谱'],
    models: [
      { id: 'glm-4', name: 'GLM-4', displayName: 'glm-4' },
      { id: 'glm-4-plus', name: 'GLM-4 Plus', displayName: 'glm-4-plus' },
      { id: 'glm-4-flash', name: 'GLM-4 Flash', displayName: 'glm-4-flash' }
    ]
  },
  {
    id: 'tongyi',
    label: '通义千问',
    providerType: 'dashscope',
    protocolType: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    requiresApiKey: true,
    icon: 'dashscope.ico',
    keywords: ['dashscope', 'qwen', 'tongyi', 'tong yi', '通义'],
    models: [
      { id: 'qwen-plus', name: 'Qwen Plus', displayName: 'qwen-plus' },
      { id: 'qwen-turbo', name: 'Qwen Turbo', displayName: 'qwen-turbo' },
      { id: 'qwen-max', name: 'Qwen Max', displayName: 'qwen-max' }
    ]
  },
  {
    id: 'moonshot',
    label: 'Moonshot AI',
    providerType: 'moonshot',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn/v1',
    requiresApiKey: true,
    icon: 'moonshot.ico',
    keywords: ['moonshot', 'kimi', 'yue zhi an mian', '月之暗面'],
    models: [
      { id: 'moonshot-v1-8k', name: 'Moonshot v1-8k', displayName: 'moonshot-v1-8k' },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1-32k', displayName: 'moonshot-v1-32k' },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1-128k', displayName: 'moonshot-v1-128k' }
    ]
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    providerType: 'minimax',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.minimax.chat/v1',
    requiresApiKey: true,
    icon: 'minimax.ico',
    keywords: ['minimax', 'abab'],
    models: [
      { id: 'minimax-m2.5', name: 'M2.5', displayName: 'MiniMax-M2.5' },
      { id: 'abab6.5s-chat', name: 'abab6.5s-chat', displayName: 'abab6.5s-chat' }
    ]
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow',
    providerType: 'siliconflow',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.siliconflow.cn/v1',
    requiresApiKey: true,
    icon: 'siliconflow.ico',
    keywords: ['siliconflow', 'silicon', 'liu dong', '硅基流动'],
    models: [
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', displayName: 'deepseek-ai' },
      { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5', displayName: 'Qwen 2.5' }
    ]
  },
  {
    id: 'lingyiwanwu',
    label: '01.AI',
    providerType: 'lingyiwanwu',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    requiresApiKey: true,
    icon: 'lingyiwanwu.ico',
    keywords: ['01ai', 'lingyi', 'yi', 'ling yi wan wu', '零一万物'],
    models: [
      { id: 'yi-large', name: 'Yi-Large', displayName: 'Yi-Large' }
    ]
  },
  {
    id: 'groq',
    label: 'Groq',
    providerType: 'groq',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    icon: 'groq.ico',
    keywords: ['groq', 'llama'],
    models: [
      { id: 'llama-3.3-70b-versatile-turbo', name: 'Llama 3.3 70B', displayName: 'llama-3.3-70b' }
    ]
  },
  {
    id: 'together',
    label: 'Together AI',
    providerType: 'together',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.together.xyz/v1',
    requiresApiKey: true,
    icon: 'together.png',
    keywords: ['together', 'togetherai'],
    models: [
      { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', name: 'Llama 3.1 70B', displayName: 'Llama 3.1' }
    ]
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    providerType: 'fireworks',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    requiresApiKey: true,
    icon: 'fireworks.ico',
    keywords: ['fireworks', 'fireworksai'],
    models: [
      { id: 'accounts/fireworks/models/llama-v3p1-70b-instruct', name: 'Llama v3p1 70B', displayName: 'llama-v3p1-70b' }
    ]
  },
  {
    id: 'xai',
    label: 'xAI',
    providerType: 'xai',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    requiresApiKey: true,
    icon: 'xai.ico',
    keywords: ['xai', 'grok'],
    models: [
      { id: 'grok-2', name: 'Grok-2', displayName: 'grok-2' },
      { id: 'grok-beta', name: 'Grok-Beta', displayName: 'grok-beta' }
    ]
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    providerType: 'perplexity',
    protocolType: 'openai-compatible',
    baseUrl: 'https://api.perplexity.ai',
    requiresApiKey: true,
    icon: 'perplexity.ico',
    keywords: ['perplexity', 'sonar'],
    models: [
      { id: 'sonar', name: 'Sonar', displayName: 'sonar' },
      { id: 'sonar-pro', name: 'Sonar Pro', displayName: 'sonar-pro' }
    ]
  },
  {
    id: 'volcengine',
    label: '火山方舟',
    providerType: 'ark',
    protocolType: 'openai-compatible',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    requiresApiKey: true,
    icon: 'volcengine.ico',
    keywords: ['ark', 'doubao', 'huo shan', '火山'],
    models: [
      { id: 'doubao-pro-32k', name: 'Doubao Pro 32K', displayName: 'doubao-pro-32k' },
      { id: 'doubao-lite-32k', name: 'Doubao Lite 32K', displayName: 'doubao-lite-32k' }
    ]
  },
  {
    id: 'local',
    label: 'Local / Internal',
    providerType: 'local',
    protocolType: 'openai-compatible',
    baseUrl: 'http://localhost:11434/v1',
    requiresApiKey: false,
    icon: 'local.svg',
    keywords: ['ollama', 'localhost', 'local', 'internal'],
    models: [
      { id: 'llama3', name: 'Llama 3', displayName: 'llama3' },
      { id: 'mistral', name: 'Mistral', displayName: 'Mistral' },
      { id: 'codellama', name: 'Code Llama', displayName: 'Code Llama' }
    ]
  }
];

/**
 * 获取供应商模板
 */
function getProviderTemplates() {
  return PROVIDER_TEMPLATES;
}

/**
 * 根据 providerType 查找模板
 */
function findProviderTemplate(providerType) {
  return PROVIDER_TEMPLATES.find((p) => p.providerType === providerType) || null;
}

/**
 * 获取供应商的所有模型
 */
function getProviderModels(providerType) {
  const template = findProviderTemplate(providerType);
  return template ? (template.models || []) : [];
}

// 如果在前端环境，暴露给全局
if (typeof window !== 'undefined') {
  window.PROVIDER_TEMPLATES = PROVIDER_TEMPLATES;
  window.getProviderTemplates = getProviderTemplates;
  window.findProviderTemplate = findProviderTemplate;
  window.getProviderModels = getProviderModels;
}

// Node.js 环境导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PROVIDER_TEMPLATES,
    getProviderTemplates,
    findProviderTemplate,
    getProviderModels
  };
}

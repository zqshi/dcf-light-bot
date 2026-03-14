/**
 * 公共工具函数 — 消除各模块中的重复定义
 */

/** DOM 查询缩写 */
export const $ = (s, p) => (p || document).querySelector(s);
export const $$ = (s, p) => Array.from((p || document).querySelectorAll(s));

/** HTML 转义（防 XSS） */
export function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** 从 localStorage 安全加载 JSON */
export function loadFromStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

/** 保存 JSON 到 localStorage */
export function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** 简易 Markdown → HTML（用于消息和抽屉面板） */
export function simpleMarkdownToHtml(text, { escape = true } = {}) {
  let html = escape ? escHtml(text) : text;
  return html
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

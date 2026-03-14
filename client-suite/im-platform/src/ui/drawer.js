/**
 * Drawer Panels — 右侧抽屉内容面板管理
 * 支持：文档编辑、代码查看、原型预览、自然语言修改
 */
import { bus, Events } from '../lib/events.js';
import { $, $$, escHtml, simpleMarkdownToHtml } from '../lib/utils.js';

export function initDrawerPanels() {
  // Tab switching within drawer
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.drawer-tab');
    if (!tab) return;
    const panelId = tab.dataset.drawerPanel;
    switchDrawerPanel(panelId);
    $$('.drawer-tab').forEach(t => t.classList.toggle('active', t === tab));
  });

  // Close button
  document.addEventListener('click', (e) => {
    if (e.target.closest('.drawer-close-btn')) {
      bus.emit(Events.DRAWER_TOGGLE, { open: false });
    }
  });

  // Listen for content updates
  bus.on(Events.DRAWER_CONTENT, ({ type, data }) => {
    renderDrawerContent(type, data);
  });

  // Natural language input in preview panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.preview-nl-input input')) {
      e.preventDefault();
      const input = e.target;
      const instruction = input.value.trim();
      if (instruction) {
        handleNaturalLanguageEdit(instruction);
        input.value = '';
      }
    }
  });
}

function switchDrawerPanel(panelId) {
  $$('.drawer-panel').forEach(p => {
    p.classList.toggle('active', p.id === panelId);
  });
}

function renderDrawerContent(type, data) {
  if (!data) return;

  switch (type) {
    case 'doc':
      activateDocPanel(data);
      break;
    case 'code':
      activateCodePanel(data);
      break;
    case 'preview':
      activatePreviewPanel(data);
      break;
  }

  // Auto-switch to the right tab
  const tabMap = { doc: 'panel-doc', code: 'panel-code', preview: 'panel-preview' };
  switchDrawerPanel(tabMap[type]);
  $$('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.drawerPanel === tabMap[type]));
}

function activateDocPanel(data) {
  const editor = $('#doc-editor');
  if (!editor) return;

  if (data.html) {
    editor.innerHTML = data.html;
  } else if (data.markdown) {
    // Simple markdown render
    editor.innerHTML = simpleMarkdownToHtml(data.markdown);
  } else if (data.text) {
    editor.textContent = data.text;
  }

  // Setup toolbar
  $$('.doc-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd) document.execCommand(cmd, false, null);
    });
  });
}

function activateCodePanel(data) {
  const viewer = $('#code-viewer');
  const fileName = $('#code-file-name');
  const langBadge = $('#code-lang-badge');
  if (!viewer) return;

  if (fileName) fileName.textContent = data.fileName || 'untitled';
  if (langBadge) langBadge.textContent = data.language || 'text';

  const lines = (data.code || '').split('\n');
  viewer.innerHTML = `<pre>${lines.map((line, i) =>
    `<span class="line-number">${i + 1}</span>${escHtml(line)}`
  ).join('\n')}</pre>`;
}

function activatePreviewPanel(data) {
  const frame = $('#preview-frame');
  const urlInput = $('#preview-url-input');
  if (!frame) return;

  if (data.url) {
    frame.src = data.url;
    if (urlInput) urlInput.value = data.url;
  } else if (data.html) {
    frame.srcdoc = data.html;
    if (urlInput) urlInput.value = 'preview://local';
  }
}

function handleNaturalLanguageEdit(instruction) {
  // This would integrate with the Agent backend to process natural language edits
  // For now, emit an event that the chat module can pick up
  bus.emit('drawer:nl_edit', { instruction, panelType: getCurrentPanelType() });
  showToast(`正在处理: "${instruction}"`, 'info');
}

function getCurrentPanelType() {
  const active = document.querySelector('.drawer-panel.active');
  if (!active) return null;
  if (active.id === 'panel-doc') return 'doc';
  if (active.id === 'panel-code') return 'code';
  if (active.id === 'panel-preview') return 'preview';
  return null;
}

// simpleMarkdownToHtml, escHtml 已从 lib/utils.js 统一导入

function showToast(msg, type = 'info') {
  bus.emit(Events.TOAST, { message: msg, type });
}

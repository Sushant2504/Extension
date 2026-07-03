import * as vscode from 'vscode';
import { Prompt } from './types';

export class PromptDetailPanel {
  private static currentPanel: PromptDetailPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  static show(prompt: Prompt): void {
    const column = vscode.ViewColumn.Beside;

    if (PromptDetailPanel.currentPanel) {
      PromptDetailPanel.currentPanel.panel.reveal(column);
      PromptDetailPanel.currentPanel.update(prompt);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'gologchat.promptDetail',
      'Prompt Detail',
      column,
      { enableScripts: true }
    );

    PromptDetailPanel.currentPanel = new PromptDetailPanel(panel);
    PromptDetailPanel.currentPanel.update(prompt);
  }

  private update(prompt: Prompt): void {
    const truncated = prompt.prompt.length > 30
      ? prompt.prompt.substring(0, 30) + '...'
      : prompt.prompt;
    this.panel.title = `Prompt: ${truncated}`;
    this.panel.webview.html = this.getHtml(prompt);
  }

  private getHtml(prompt: Prompt): string {
    const timestamp = new Date(prompt.timestamp).toLocaleString();
    const relativeTime = this.getRelativeTime(prompt.timestamp);
    const promptLen = prompt.prompt.length;
    const responseLen = prompt.response?.length ?? 0;
    const esc = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prompt Detail</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 0;
      line-height: 1.6;
    }

    /* Top bar with meta */
    .top-bar {
      padding: 16px 20px;
      background: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.04));
      border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }
    .meta-card {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .meta-label {
      font-size: 0.7em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--vscode-descriptionForeground);
    }
    .meta-value {
      font-size: 0.9em;
      font-weight: 500;
      word-break: break-all;
    }
    .meta-value.mono {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.82em;
      opacity: 0.8;
    }

    /* Content area */
    .content {
      padding: 20px;
      max-width: 800px;
    }

    .block {
      margin-bottom: 24px;
    }
    .block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .block-title {
      font-weight: 600;
      font-size: 0.82em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .char-count {
      font-size: 0.92em;
      font-weight: 400;
      text-transform: none;
      letter-spacing: 0;
      opacity: 0.7;
    }

    .copy-btn {
      padding: 3px 10px;
      font-size: 0.78em;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.3));
      border-radius: 3px;
      cursor: pointer;
      font-family: var(--vscode-font-family);
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .copy-btn:hover {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-background);
    }
    .copy-btn.copied {
      background: var(--vscode-testing-iconPassed, #4ec9b0);
      color: #fff;
      border-color: var(--vscode-testing-iconPassed, #4ec9b0);
    }

    .block-content {
      background: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.04));
      border-left: 3px solid var(--vscode-textBlockQuote-border, var(--vscode-button-background));
      padding: 12px 16px;
      white-space: pre-wrap;
      word-break: break-word;
      border-radius: 0 4px 4px 0;
      font-size: 0.92em;
      line-height: 1.7;
    }
    .block-content.response {
      border-left-color: var(--vscode-testing-iconPassed, #4ec9b0);
    }

    .no-response {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      padding: 12px 16px;
      opacity: 0.7;
    }

    .divider {
      border: none;
      border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
      margin: 0;
    }

    /* Prompt ID tag */
    .id-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background: var(--vscode-badge-background, rgba(128,128,128,0.15));
      color: var(--vscode-badge-foreground, var(--vscode-foreground));
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.78em;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .id-tag:hover { opacity: 0.75; }
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="meta-grid">
      <div class="meta-card">
        <span class="meta-label">Developer</span>
        <span class="meta-value">${esc(prompt.developerId)}</span>
      </div>
      <div class="meta-card">
        <span class="meta-label">Team</span>
        <span class="meta-value">${esc(prompt.teamId)}</span>
      </div>
      <div class="meta-card">
        <span class="meta-label">Time</span>
        <span class="meta-value">${esc(timestamp)}</span>
        <span class="meta-label" style="margin-top:1px">${esc(relativeTime)}</span>
      </div>
      <div class="meta-card">
        <span class="meta-label">ID</span>
        <span class="id-tag" onclick="copyText('${esc(prompt.id)}', this)" title="Click to copy">${esc(prompt.id.substring(0, 8))}...</span>
      </div>
    </div>
  </div>

  <div class="content">
    <div class="block">
      <div class="block-header">
        <span class="block-title">
          Prompt
          <span class="char-count">${promptLen.toLocaleString()} chars</span>
        </span>
        <button class="copy-btn" onclick="copyBlock('prompt', this)">Copy</button>
      </div>
      <div class="block-content" id="prompt-content">${esc(prompt.prompt)}</div>
    </div>

    <div class="block">
      <div class="block-header">
        <span class="block-title">
          Response
          ${prompt.response ? `<span class="char-count">${responseLen.toLocaleString()} chars</span>` : ''}
        </span>
        ${prompt.response ? `<button class="copy-btn" onclick="copyBlock('response', this)">Copy</button>` : ''}
      </div>
      ${prompt.response
        ? `<div class="block-content response" id="response-content">${esc(prompt.response)}</div>`
        : `<div class="no-response">No response recorded</div>`}
    </div>
  </div>

  <script>
    function copyBlock(id, btn) {
      const el = document.getElementById(id + '-content');
      if (!el) return;
      const text = el.textContent || '';
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 1500);
      });
    }

    function copyText(text, el) {
      navigator.clipboard.writeText(text).then(() => {
        const orig = el.textContent;
        el.textContent = 'Copied!';
        setTimeout(() => { el.textContent = orig; }, 1200);
      });
    }
  </script>
</body>
</html>`;
  }

  private getRelativeTime(timestamp: string): string {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) { return 'just now'; }
    if (diffMin < 60) { return `${diffMin}m ago`; }
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) { return `${diffHr}h ago`; }
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  }

  private dispose(): void {
    PromptDetailPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

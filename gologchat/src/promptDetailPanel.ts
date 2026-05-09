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
      { enableScripts: false }
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
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 16px;
      line-height: 1.5;
    }
    .field { margin-bottom: 16px; }
    .label {
      font-weight: 600;
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .value {
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textBlockQuote-border);
      padding: 8px 12px;
      white-space: pre-wrap;
      word-break: break-word;
      border-radius: 3px;
    }
    .meta {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }
    .meta-item { font-size: 0.9em; }
    .meta-label {
      color: var(--vscode-descriptionForeground);
      margin-right: 4px;
    }
    hr {
      border: none;
      border-top: 1px solid var(--vscode-widget-border);
      margin: 16px 0;
    }
    .no-response {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="meta">
    <div class="meta-item"><span class="meta-label">Developer:</span>${esc(prompt.developerId)}</div>
    <div class="meta-item"><span class="meta-label">Team:</span>${esc(prompt.teamId)}</div>
    <div class="meta-item"><span class="meta-label">Time:</span>${esc(timestamp)}</div>
    <div class="meta-item"><span class="meta-label">ID:</span>${esc(prompt.id)}</div>
  </div>
  <hr />
  <div class="field">
    <div class="label">Prompt</div>
    <div class="value">${esc(prompt.prompt)}</div>
  </div>
  <div class="field">
    <div class="label">Response</div>
    ${prompt.response
      ? `<div class="value">${esc(prompt.response)}</div>`
      : `<div class="no-response">No response recorded</div>`}
  </div>
</body>
</html>`;
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

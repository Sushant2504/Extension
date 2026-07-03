import * as vscode from 'vscode';
import { DeveloperPatterns } from './types';
import { ApiClient } from './apiClient';

const patternColors: Record<string, string> = {
  debugging: '#e45649',
  refactoring: '#c678dd',
  testing: '#61afef',
  feature: '#98c379',
  documentation: '#e5c07b',
  review: '#56b6c2',
  deployment: '#d19a66',
  configuration: '#abb2bf',
  learning: '#be5046',
  api: '#61afef',
  other: '#636d83',
};

export class TeamPatternsDashboard {
  private static currentPanel: TeamPatternsDashboard | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, private readonly client: ApiClient) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  static async show(client: ApiClient): Promise<void> {
    const column = vscode.ViewColumn.One;

    if (TeamPatternsDashboard.currentPanel) {
      TeamPatternsDashboard.currentPanel.panel.reveal(column);
      await TeamPatternsDashboard.currentPanel.update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'gologchat.teamPatternsDashboard',
      'Team Working Patterns',
      column,
      { enableScripts: false }
    );

    TeamPatternsDashboard.currentPanel = new TeamPatternsDashboard(panel, client);
    await TeamPatternsDashboard.currentPanel.update();
  }

  private async update(): Promise<void> {
    try {
      const patterns = await this.client.getTeamPatterns();
      this.panel.webview.html = this.getHtml(patterns);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.panel.webview.html = this.getErrorHtml(msg);
    }
  }

  private getHtml(developers: DeveloperPatterns[]): string {
    const esc = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const teamTotals = new Map<string, number>();
    let totalPrompts = 0;
    for (const dev of developers) {
      totalPrompts += dev.totalPrompts;
      for (const p of dev.patterns) {
        teamTotals.set(p.pattern, (teamTotals.get(p.pattern) ?? 0) + p.count);
      }
    }
    const sortedTeamPatterns = [...teamTotals.entries()].sort((a, b) => b[1] - a[1]);

    const teamSummaryBars = sortedTeamPatterns.map(([pattern, count]) => {
      const pct = totalPrompts > 0 ? Math.round((count / totalPrompts) * 100) : 0;
      const color = patternColors[pattern] ?? patternColors['other'];
      return `<div class="bar-row">
        <span class="bar-label">${esc(pattern)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
        </div>
        <span class="bar-count">${count}</span>
      </div>`;
    }).join('\n');

    const developerCards = developers.map(dev => {
      const lastActive = new Date(dev.lastActive).toLocaleString();
      const maxCount = dev.patterns.length > 0 ? dev.patterns[0].count : 1;

      const bars = dev.patterns.map(p => {
        const pct = Math.round((p.count / maxCount) * 100);
        const color = patternColors[p.pattern] ?? patternColors['other'];
        return `<div class="bar-row">
          <span class="bar-label">${esc(p.pattern)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
          </div>
          <span class="bar-count">${p.count}</span>
        </div>`;
      }).join('\n');

      const recentRows = dev.recentPrompts.map(rp => {
        const time = new Date(rp.timestamp).toLocaleTimeString();
        const color = patternColors[rp.pattern] ?? patternColors['other'];
        return `<tr>
          <td class="time-cell">${esc(time)}</td>
          <td><span class="pattern-badge" style="background-color: ${color};">${esc(rp.pattern)}</span></td>
          <td>${esc(rp.summary)}</td>
        </tr>`;
      }).join('\n');

      return `<div class="dev-card">
        <div class="dev-header">
          <span class="dev-name">${esc(dev.developerId)}</span>
          <span class="dev-stats">${dev.totalPrompts} prompts &middot; Last active: ${esc(lastActive)}</span>
        </div>
        <div class="dev-patterns">
          ${bars}
        </div>
        ${dev.recentPrompts.length > 0 ? `
        <div class="recent-section">
          <div class="section-label">Recent Activity</div>
          <table class="recent-table">
            ${recentRows}
          </table>
        </div>` : ''}
      </div>`;
    }).join('\n');

    const emptyState = developers.length === 0
      ? '<div class="empty-state">No team activity yet. Log some prompts to see patterns.</div>'
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Team Working Patterns</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.5;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 {
      font-size: 1.4em;
      margin: 0 0 4px 0;
      font-weight: 600;
    }
    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
      margin-bottom: 20px;
    }
    .section-label {
      font-weight: 600;
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .team-summary {
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textBlockQuote-border);
      padding: 12px 16px;
      border-radius: 3px;
      margin-bottom: 24px;
    }
    .team-summary .summary-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .team-summary .summary-stat {
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
    }
    .bar-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .bar-label {
      width: 110px;
      font-size: 0.85em;
      text-align: right;
      flex-shrink: 0;
    }
    .bar-track {
      flex: 1;
      height: 14px;
      background: var(--vscode-input-background);
      border-radius: 3px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 3px;
      min-width: 2px;
    }
    .bar-count {
      width: 30px;
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      text-align: right;
      flex-shrink: 0;
    }
    .dev-card {
      border: 1px solid var(--vscode-widget-border);
      border-radius: 4px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .dev-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 12px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .dev-name {
      font-weight: 600;
      font-size: 1.1em;
    }
    .dev-stats {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }
    .dev-patterns {
      margin-bottom: 12px;
    }
    .recent-section {
      border-top: 1px solid var(--vscode-widget-border);
      padding-top: 12px;
    }
    .recent-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85em;
    }
    .recent-table td {
      padding: 4px 8px 4px 0;
      vertical-align: top;
    }
    .time-cell {
      white-space: nowrap;
      color: var(--vscode-descriptionForeground);
      width: 80px;
    }
    .pattern-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 0.8em;
      color: #fff;
      white-space: nowrap;
    }
    .empty-state {
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      padding: 40px 0;
    }
  </style>
</head>
<body>
  <h1>Team Working Patterns</h1>
  <div class="subtitle">${developers.length} team member${developers.length === 1 ? '' : 's'} &middot; ${totalPrompts} total prompts</div>
  ${emptyState}
  ${developers.length > 0 ? `
  <div class="team-summary">
    <div class="section-label">Team Overview</div>
    ${teamSummaryBars}
  </div>` : ''}
  ${developerCards}
</body>
</html>`;
  }

  private getErrorHtml(message: string): string {
    const esc = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
    }
    .error {
      color: var(--vscode-errorForeground);
      padding: 16px;
      background: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="error">Failed to load team patterns: ${esc(message)}</div>
</body>
</html>`;
  }

  private dispose(): void {
    TeamPatternsDashboard.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

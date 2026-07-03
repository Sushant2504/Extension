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
      { enableScripts: true }
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
    let mostRecentActivity = '';
    for (const dev of developers) {
      totalPrompts += dev.totalPrompts;
      if (!mostRecentActivity || dev.lastActive > mostRecentActivity) {
        mostRecentActivity = dev.lastActive;
      }
      for (const p of dev.patterns) {
        teamTotals.set(p.pattern, (teamTotals.get(p.pattern) ?? 0) + p.count);
      }
    }
    const sortedTeamPatterns = [...teamTotals.entries()].sort((a, b) => b[1] - a[1]);
    const topPattern = sortedTeamPatterns.length > 0 ? sortedTeamPatterns[0][0] : 'none';
    const uniquePatterns = teamTotals.size;

    const statCards = `
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-number">${totalPrompts}</div>
          <div class="stat-label">Total Prompts</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${developers.length}</div>
          <div class="stat-label">Developers</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${uniquePatterns}</div>
          <div class="stat-label">Pattern Types</div>
        </div>
        <div class="stat-card">
          <div class="stat-number highlight">${esc(topPattern)}</div>
          <div class="stat-label">Top Pattern</div>
        </div>
      </div>`;

    const maxTeamCount = sortedTeamPatterns.length > 0 ? sortedTeamPatterns[0][1] : 1;
    const teamSummaryBars = sortedTeamPatterns.map(([pattern, count], i) => {
      const pct = maxTeamCount > 0 ? Math.round((count / maxTeamCount) * 100) : 0;
      const color = patternColors[pattern] ?? patternColors['other'];
      const globalPct = totalPrompts > 0 ? Math.round((count / totalPrompts) * 100) : 0;
      return `<div class="bar-row" style="animation-delay: ${i * 50}ms">
        <span class="bar-label">${esc(pattern)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
        </div>
        <span class="bar-count">${count}</span>
        <span class="bar-pct">${globalPct}%</span>
      </div>`;
    }).join('\n');

    const developerCards = developers.map(dev => {
      const lastActive = new Date(dev.lastActive).toLocaleString();
      const maxCount = dev.patterns.length > 0 ? dev.patterns[0].count : 1;

      const bars = dev.patterns.map((p, i) => {
        const pct = Math.round((p.count / maxCount) * 100);
        const color = patternColors[p.pattern] ?? patternColors['other'];
        return `<div class="bar-row" style="animation-delay: ${i * 40}ms">
          <span class="bar-label">${esc(p.pattern)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
          </div>
          <span class="bar-count">${p.count}</span>
        </div>`;
      }).join('\n');

      const recentRows = dev.recentPrompts.slice(0, 5).map(rp => {
        const time = new Date(rp.timestamp).toLocaleTimeString();
        const color = patternColors[rp.pattern] ?? patternColors['other'];
        return `<tr>
          <td class="time-cell">${esc(time)}</td>
          <td><span class="pattern-badge" style="background-color: ${color};">${esc(rp.pattern)}</span></td>
          <td class="summary-cell">${esc(rp.summary)}</td>
        </tr>`;
      }).join('\n');

      const initials = dev.developerId.substring(0, 2).toUpperCase();

      return `<div class="dev-card">
        <div class="dev-header">
          <div class="dev-identity">
            <div class="dev-avatar">${esc(initials)}</div>
            <div>
              <span class="dev-name">${esc(dev.developerId)}</span>
              <span class="dev-stats">${dev.totalPrompts} prompt${dev.totalPrompts === 1 ? '' : 's'} · Last active: ${esc(lastActive)}</span>
            </div>
          </div>
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
      ? `<div class="empty-state">
          <div class="empty-icon">📊</div>
          <div class="empty-title">No team activity yet</div>
          <div class="empty-desc">Log some prompts to start seeing team working patterns here.</div>
        </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Team Working Patterns</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 24px;
      line-height: 1.5;
      max-width: 960px;
      margin: 0 auto;
    }

    /* Page header */
    .page-header {
      margin-bottom: 24px;
    }
    .page-header h1 {
      font-size: 1.5em;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
    }

    /* Stat cards */
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.06));
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
      border-radius: 8px;
      padding: 14px 16px;
      text-align: center;
    }
    .stat-number {
      font-size: 1.6em;
      font-weight: 700;
      line-height: 1.2;
      color: var(--vscode-foreground);
    }
    .stat-number.highlight {
      font-size: 1em;
      color: var(--vscode-button-background);
      text-transform: capitalize;
    }
    .stat-label {
      font-size: 0.72em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }

    /* Section titles */
    .section-label {
      font-weight: 600;
      font-size: 0.78em;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
    }

    /* Team summary */
    .team-summary {
      background: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.04));
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }

    /* Bar chart */
    @keyframes barGrow {
      from { width: 0; }
    }
    .bar-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      animation: fadeIn 0.3s ease both;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateX(-4px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .bar-label {
      width: 100px;
      font-size: 0.82em;
      text-align: right;
      flex-shrink: 0;
      text-transform: capitalize;
    }
    .bar-track {
      flex: 1;
      height: 18px;
      background: var(--vscode-input-background);
      border-radius: 4px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 4px;
      min-width: 3px;
      animation: barGrow 0.6s ease both;
      transition: width 0.3s ease;
    }
    .bar-count {
      width: 32px;
      font-size: 0.82em;
      font-weight: 600;
      text-align: right;
      flex-shrink: 0;
    }
    .bar-pct {
      width: 36px;
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground);
      text-align: right;
      flex-shrink: 0;
    }

    /* Developer cards */
    .dev-card {
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
      border-radius: 8px;
      padding: 18px 20px;
      margin-bottom: 16px;
      transition: border-color 0.2s;
    }
    .dev-card:hover {
      border-color: var(--vscode-focusBorder, var(--vscode-button-background));
    }
    .dev-header {
      margin-bottom: 14px;
    }
    .dev-identity {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .dev-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.82em;
      font-weight: 700;
      flex-shrink: 0;
    }
    .dev-name {
      font-weight: 600;
      font-size: 1.05em;
      display: block;
    }
    .dev-stats {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
      display: block;
      margin-top: 1px;
    }
    .dev-patterns {
      margin-bottom: 12px;
    }

    /* Recent activity table */
    .recent-section {
      border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.12));
      padding-top: 14px;
      margin-top: 4px;
    }
    .recent-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82em;
    }
    .recent-table tr {
      transition: background 0.15s;
    }
    .recent-table tr:hover {
      background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.06));
    }
    .recent-table td {
      padding: 5px 8px 5px 0;
      vertical-align: top;
    }
    .time-cell {
      white-space: nowrap;
      color: var(--vscode-descriptionForeground);
      width: 80px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.95em;
    }
    .summary-cell {
      line-height: 1.4;
    }
    .pattern-badge {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 10px;
      font-size: 0.85em;
      color: #fff;
      white-space: nowrap;
      font-weight: 500;
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
    }
    .empty-icon {
      font-size: 3em;
      margin-bottom: 12px;
      opacity: 0.6;
    }
    .empty-title {
      font-size: 1.1em;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .empty-desc {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }

    /* Developers section label */
    .developers-header {
      margin-bottom: 14px;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="page-header">
    <h1>Team Working Patterns</h1>
    <div class="subtitle">${developers.length} developer${developers.length === 1 ? '' : 's'} · ${totalPrompts} total prompts</div>
  </div>

  ${emptyState}

  ${developers.length > 0 ? `
  ${statCards}

  <div class="team-summary">
    <div class="section-label">Pattern Distribution</div>
    ${teamSummaryBars}
  </div>

  <div class="developers-header">
    <div class="section-label">Developers</div>
  </div>
  ${developerCards}
  ` : ''}

  <script>
    // Trigger bar animations on load
    document.querySelectorAll('.bar-fill').forEach((bar, i) => {
      bar.style.animationDelay = (i * 60) + 'ms';
    });
  </script>
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
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
    }
    .error-card {
      max-width: 400px;
      text-align: center;
      padding: 24px;
    }
    .error-icon {
      font-size: 2.5em;
      margin-bottom: 12px;
      opacity: 0.7;
    }
    .error-title {
      font-weight: 600;
      margin-bottom: 8px;
    }
    .error-msg {
      color: var(--vscode-errorForeground, #f44747);
      font-size: 0.9em;
      padding: 10px 14px;
      background: var(--vscode-inputValidation-errorBackground, rgba(244,71,71,0.1));
      border: 1px solid var(--vscode-inputValidation-errorBorder, rgba(244,71,71,0.4));
      border-radius: 6px;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="error-card">
    <div class="error-icon">⚠</div>
    <div class="error-title">Failed to load team patterns</div>
    <div class="error-msg">${esc(message)}</div>
  </div>
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

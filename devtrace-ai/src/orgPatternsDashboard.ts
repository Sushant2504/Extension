import * as vscode from 'vscode';
import { OrgAnalytics } from './types';
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

const providerColors: Record<string, string> = {
  'Cursor': '#00b4d8',
  'Claude Code': '#d4a574',
  'GitHub Copilot': '#6e40c9',
  'Aider': '#2ecc71',
  'Continue': '#e67e22',
  'Other': '#636d83',
  'Unknown': '#636d83',
};

export class OrgPatternsDashboard {
  private static currentPanel: OrgPatternsDashboard | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private teamId?: string;

  private constructor(panel: vscode.WebviewPanel, private readonly client: ApiClient, teamId?: string) {
    this.panel = panel;
    this.teamId = teamId;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  static async show(client: ApiClient, teamId?: string): Promise<void> {
    const column = vscode.ViewColumn.One;

    if (OrgPatternsDashboard.currentPanel) {
      OrgPatternsDashboard.currentPanel.teamId = teamId;
      OrgPatternsDashboard.currentPanel.panel.reveal(column);
      await OrgPatternsDashboard.currentPanel.update();
      return;
    }

    const title = teamId ? 'Team Analytics Dashboard' : 'AI Observability Dashboard';
    const panel = vscode.window.createWebviewPanel(
      'devtraceai.orgPatternsDashboard',
      title,
      column,
      { enableScripts: true }
    );

    OrgPatternsDashboard.currentPanel = new OrgPatternsDashboard(panel, client, teamId);
    await OrgPatternsDashboard.currentPanel.update();
  }

  private async update(): Promise<void> {
    try {
      const analytics = this.teamId
        ? await this.client.getTeamAnalytics(this.teamId)
        : await this.client.getOrgAnalytics();
      this.panel.webview.html = this.getHtml(analytics);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.panel.webview.html = this.getErrorHtml(msg);
    }
  }

  private formatTokens(n: number): string {
    if (n >= 1_000_000) { return (n / 1_000_000).toFixed(1) + 'M'; }
    if (n >= 1_000) { return (n / 1_000).toFixed(1) + 'K'; }
    return String(n);
  }

  private getHtml(data: OrgAnalytics): string {
    const esc = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const topProvider = data.providers.length > 0 ? data.providers[0].provider : 'none';
    const topModel = data.models.length > 0 ? data.models[0].model : 'none';
    const topPattern = data.patterns.length > 0 ? data.patterns[0].pattern : 'none';

    // --- Overview tab: stat cards ---
    const statCards = `
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-number">${data.totalPrompts}</div>
          <div class="stat-label">Total Prompts</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${data.developers.length}</div>
          <div class="stat-label">Developers</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${this.formatTokens(data.totalEstimatedTokens)}</div>
          <div class="stat-label">Est. Tokens</div>
        </div>
        <div class="stat-card">
          <div class="stat-number highlight">${esc(topProvider)}</div>
          <div class="stat-label">Top Provider</div>
        </div>
        <div class="stat-card">
          <div class="stat-number highlight">${esc(topModel)}</div>
          <div class="stat-label">Top Model</div>
        </div>
        <div class="stat-card">
          <div class="stat-number highlight">${esc(topPattern)}</div>
          <div class="stat-label">Top Pattern</div>
        </div>
      </div>`;

    // --- Overview tab: provider bars ---
    const maxProvCount = data.providers.length > 0 ? data.providers[0].count : 1;
    const providerBars = data.providers.map(({ provider, count }, i) => {
      const pct = maxProvCount > 0 ? Math.round((count / maxProvCount) * 100) : 0;
      const color = providerColors[provider] ?? providerColors['Other'];
      const globalPct = data.totalPrompts > 0 ? Math.round((count / data.totalPrompts) * 100) : 0;
      return `<div class="bar-row" style="animation-delay: ${i * 50}ms">
        <span class="bar-label">${esc(provider)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
        </div>
        <span class="bar-count">${count}</span>
        <span class="bar-pct">${globalPct}%</span>
      </div>`;
    }).join('\n');

    // --- Overview tab: model bars ---
    const maxModelCount = data.models.length > 0 ? data.models[0].count : 1;
    const modelBars = data.models.map(({ model, provider, count }, i) => {
      const pct = maxModelCount > 0 ? Math.round((count / maxModelCount) * 100) : 0;
      const color = providerColors[provider] ?? providerColors['Other'];
      const globalPct = data.totalPrompts > 0 ? Math.round((count / data.totalPrompts) * 100) : 0;
      return `<div class="bar-row" style="animation-delay: ${i * 50}ms">
        <span class="bar-label">${esc(model)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
        </div>
        <span class="bar-count">${count}</span>
        <span class="bar-pct">${globalPct}%</span>
      </div>`;
    }).join('\n');

    // --- Patterns tab: pattern bars ---
    const maxPatCount = data.patterns.length > 0 ? data.patterns[0].count : 1;
    const patternBars = data.patterns.map(({ pattern, count }, i) => {
      const pct = maxPatCount > 0 ? Math.round((count / maxPatCount) * 100) : 0;
      const color = patternColors[pattern] ?? patternColors['other'];
      const globalPct = data.totalPrompts > 0 ? Math.round((count / data.totalPrompts) * 100) : 0;
      return `<div class="bar-row" style="animation-delay: ${i * 50}ms">
        <span class="bar-label">${esc(pattern)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
        </div>
        <span class="bar-count">${count}</span>
        <span class="bar-pct">${globalPct}%</span>
      </div>`;
    }).join('\n');

    // --- Developers tab: developer cards ---
    const developerCards = data.developers.map(dev => {
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
        const provBadge = rp.provider
          ? `<span class="provider-mini" style="background-color: ${providerColors[rp.provider] ?? providerColors['Other']};">${esc(rp.provider)}</span>`
          : '';
        return `<tr>
          <td class="time-cell">${esc(time)}</td>
          <td><span class="pattern-badge" style="background-color: ${color};">${esc(rp.pattern)}</span></td>
          <td>${provBadge}</td>
          <td class="summary-cell">${esc(rp.summary)}</td>
        </tr>`;
      }).join('\n');

      const initials = dev.developerId.substring(0, 2).toUpperCase();
      const provTag = dev.topProvider
        ? `<span class="provider-tag" style="background-color: ${providerColors[dev.topProvider] ?? providerColors['Other']};">${esc(dev.topProvider)}</span>`
        : '';

      return `<div class="dev-card">
        <div class="dev-header">
          <div class="dev-identity">
            <div class="dev-avatar">${esc(initials)}</div>
            <div>
              <span class="dev-name">${esc(dev.developerId)} ${provTag}</span>
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

    // --- Overview tab: project bars ---
    const projects = data.projects ?? [];
    const maxProjCount = projects.length > 0 ? projects[0].count : 1;
    const projectBars = projects.map(({ project, count }, i) => {
      const pct = maxProjCount > 0 ? Math.round((count / maxProjCount) * 100) : 0;
      const globalPct = data.totalPrompts > 0 ? Math.round((count / data.totalPrompts) * 100) : 0;
      return `<div class="bar-row" style="animation-delay: ${i * 50}ms">
        <span class="bar-label">${esc(project)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; background-color: #61afef;"></div>
        </div>
        <span class="bar-count">${count}</span>
        <span class="bar-pct">${globalPct}%</span>
      </div>`;
    }).join('\n');

    // --- Effectiveness tab ---
    const effectiveness = data.effectiveness ?? [];
    const totalRated = effectiveness.reduce((sum, e) => sum + e.accepted + e.rejected + e.edited, 0);
    const totalAccepted = effectiveness.reduce((sum, e) => sum + e.accepted, 0);
    const totalRejected = effectiveness.reduce((sum, e) => sum + e.rejected, 0);
    const totalEdited = effectiveness.reduce((sum, e) => sum + e.edited, 0);
    const totalPending = effectiveness.reduce((sum, e) => sum + e.pending, 0);

    const effectivenessCards = `
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-number" style="color: #4ec9b0;">${totalAccepted}</div>
          <div class="stat-label">Accepted</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color: #cca700;">${totalEdited}</div>
          <div class="stat-label">Edited</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color: #f44747;">${totalRejected}</div>
          <div class="stat-label">Rejected</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${totalPending}</div>
          <div class="stat-label">Pending</div>
        </div>
      </div>`;

    const effectivenessBars = effectiveness.filter(e => e.total > 0).map((e, i) => {
      const accPct = Math.round((e.accepted / e.total) * 100);
      const editPct = Math.round((e.edited / e.total) * 100);
      const rejPct = Math.round((e.rejected / e.total) * 100);
      return `<div class="bar-row" style="animation-delay: ${i * 50}ms">
        <span class="bar-label">${esc(e.model)}</span>
        <div class="bar-track stacked">
          <div class="bar-segment" style="width: ${accPct}%; background-color: #4ec9b0;" title="Accepted: ${e.accepted}"></div>
          <div class="bar-segment" style="width: ${editPct}%; background-color: #cca700;" title="Edited: ${e.edited}"></div>
          <div class="bar-segment" style="width: ${rejPct}%; background-color: #f44747;" title="Rejected: ${e.rejected}"></div>
        </div>
        <span class="bar-count">${Math.round(e.acceptanceRate * 100)}%</span>
        <span class="bar-pct">${e.total}</span>
      </div>`;
    }).join('\n');

    const emptyState = data.developers.length === 0
      ? `<div class="empty-state">
          <div class="empty-icon">📊</div>
          <div class="empty-title">No org activity yet</div>
          <div class="empty-desc">Log some prompts to start seeing AI observability data here.</div>
        </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Observability Dashboard</title>
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

    .page-header { margin-bottom: 20px; }
    .page-header h1 { font-size: 1.5em; font-weight: 700; margin-bottom: 4px; }
    .subtitle { color: var(--vscode-descriptionForeground); font-size: 0.85em; }

    /* Tab bar */
    .tab-bar {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
      margin-bottom: 20px;
    }
    .tab {
      padding: 8px 16px;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-family: var(--vscode-font-family);
      font-size: 0.9em;
      font-weight: 500;
      transition: color 0.15s, border-color 0.15s;
    }
    .tab:hover { color: var(--vscode-foreground); }
    .tab.active {
      color: var(--vscode-foreground);
      border-bottom-color: var(--vscode-button-background);
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    /* Stat cards */
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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
    .stat-number { font-size: 1.6em; font-weight: 700; line-height: 1.2; }
    .stat-number.highlight {
      font-size: 1em;
      color: var(--vscode-button-background);
      text-transform: capitalize;
    }
    .stat-label {
      font-size: 0.72em; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.6px; color: var(--vscode-descriptionForeground); margin-top: 4px;
    }

    .section-label {
      font-weight: 600; font-size: 0.78em; color: var(--vscode-descriptionForeground);
      text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;
    }

    .chart-card {
      background: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.04));
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 20px;
    }

    /* Bar chart */
    @keyframes barGrow { from { width: 0; } }
    .bar-row {
      display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
      animation: fadeIn 0.3s ease both;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateX(-4px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .bar-label { width: 100px; font-size: 0.82em; text-align: right; flex-shrink: 0; text-transform: capitalize; }
    .bar-track { flex: 1; height: 18px; background: var(--vscode-input-background); border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 4px; min-width: 3px; animation: barGrow 0.6s ease both; transition: width 0.3s ease; }
    .bar-count { width: 32px; font-size: 0.82em; font-weight: 600; text-align: right; flex-shrink: 0; }
    .bar-pct { width: 36px; font-size: 0.75em; color: var(--vscode-descriptionForeground); text-align: right; flex-shrink: 0; }

    /* Developer cards */
    .dev-card {
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
      border-radius: 8px; padding: 18px 20px; margin-bottom: 16px; transition: border-color 0.2s;
    }
    .dev-card:hover { border-color: var(--vscode-focusBorder, var(--vscode-button-background)); }
    .dev-header { margin-bottom: 14px; }
    .dev-identity { display: flex; align-items: center; gap: 12px; }
    .dev-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: var(--vscode-button-background); color: var(--vscode-button-foreground);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.82em; font-weight: 700; flex-shrink: 0;
    }
    .dev-name { font-weight: 600; font-size: 1.05em; display: block; }
    .dev-stats { font-size: 0.8em; color: var(--vscode-descriptionForeground); display: block; margin-top: 1px; }
    .dev-patterns { margin-bottom: 12px; }

    .recent-section {
      border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.12));
      padding-top: 14px; margin-top: 4px;
    }
    .recent-table { width: 100%; border-collapse: collapse; font-size: 0.82em; }
    .recent-table tr { transition: background 0.15s; }
    .recent-table tr:hover { background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.06)); }
    .recent-table td { padding: 5px 8px 5px 0; vertical-align: top; }
    .time-cell {
      white-space: nowrap; color: var(--vscode-descriptionForeground); width: 80px;
      font-family: var(--vscode-editor-font-family, monospace); font-size: 0.95em;
    }
    .summary-cell { line-height: 1.4; }
    .pattern-badge {
      display: inline-block; padding: 1px 8px; border-radius: 10px;
      font-size: 0.85em; color: #fff; white-space: nowrap; font-weight: 500;
    }
    .provider-tag {
      display: inline-block; padding: 1px 6px; border-radius: 3px;
      font-size: 0.72em; color: #fff; font-weight: 500; margin-left: 6px;
      vertical-align: middle;
    }
    .provider-mini {
      display: inline-block; padding: 1px 6px; border-radius: 10px;
      font-size: 0.78em; color: #fff; white-space: nowrap; font-weight: 500;
    }

    .bar-track.stacked { display: flex; gap: 0; }
    .bar-segment { height: 100%; min-width: 1px; transition: width 0.3s ease; }
    .bar-segment:first-child { border-radius: 4px 0 0 4px; }
    .bar-segment:last-child { border-radius: 0 4px 4px 0; }

    .legend-row { display: flex; gap: 16px; margin-bottom: 12px; }
    .legend-item { display: flex; align-items: center; gap: 5px; font-size: 0.78em; color: var(--vscode-descriptionForeground); }
    .legend-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }

    .empty-state { text-align: center; padding: 60px 20px; }
    .empty-icon { font-size: 3em; margin-bottom: 12px; opacity: 0.6; }
    .empty-title { font-size: 1.1em; font-weight: 600; margin-bottom: 6px; }
    .empty-desc { color: var(--vscode-descriptionForeground); font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="page-header">
    <h1>AI Observability Dashboard</h1>
    <div class="subtitle">${data.developers.length} developer${data.developers.length === 1 ? '' : 's'} · ${data.totalPrompts} total prompts · ~${this.formatTokens(data.totalEstimatedTokens)} tokens</div>
  </div>

  ${emptyState}

  ${data.developers.length > 0 ? `
  <div class="tab-bar">
    <button class="tab active" data-tab="overview">Overview</button>
    <button class="tab" data-tab="patterns">Patterns</button>
    <button class="tab" data-tab="effectiveness">Effectiveness</button>
    <button class="tab" data-tab="developers">Developers</button>
  </div>

  <div id="tab-overview" class="tab-content active">
    ${statCards}

    <div class="chart-card">
      <div class="section-label">Provider Distribution</div>
      ${providerBars || '<div class="empty-desc">No provider data yet</div>'}
    </div>

    <div class="chart-card">
      <div class="section-label">Model Usage</div>
      ${modelBars || '<div class="empty-desc">No model data yet</div>'}
    </div>

    ${projects.length > 0 ? `
    <div class="chart-card">
      <div class="section-label">Project Breakdown</div>
      ${projectBars}
    </div>` : ''}
  </div>

  <div id="tab-patterns" class="tab-content">
    <div class="chart-card">
      <div class="section-label">Pattern Distribution</div>
      ${patternBars}
    </div>
  </div>

  <div id="tab-effectiveness" class="tab-content">
    ${effectivenessCards}

    <div class="chart-card">
      <div class="section-label">Model Acceptance Rates</div>
      <div class="legend-row">
        <span class="legend-item"><span class="legend-dot" style="background:#4ec9b0;"></span> Accepted</span>
        <span class="legend-item"><span class="legend-dot" style="background:#cca700;"></span> Edited</span>
        <span class="legend-item"><span class="legend-dot" style="background:#f44747;"></span> Rejected</span>
      </div>
      ${effectivenessBars || '<div class="empty-desc">No outcome data yet — rate your AI outputs to see effectiveness</div>'}
    </div>
  </div>

  <div id="tab-developers" class="tab-content">
    ${developerCards}
  </div>
  ` : ''}

  <script>
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });
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
      display: flex; align-items: center; justify-content: center; min-height: 200px;
    }
    .error-card { max-width: 400px; text-align: center; padding: 24px; }
    .error-icon { font-size: 2.5em; margin-bottom: 12px; opacity: 0.7; }
    .error-title { font-weight: 600; margin-bottom: 8px; }
    .error-msg {
      color: var(--vscode-errorForeground, #f44747); font-size: 0.9em;
      padding: 10px 14px;
      background: var(--vscode-inputValidation-errorBackground, rgba(244,71,71,0.1));
      border: 1px solid var(--vscode-inputValidation-errorBorder, rgba(244,71,71,0.4));
      border-radius: 6px; word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="error-card">
    <div class="error-icon">⚠</div>
    <div class="error-title">Failed to load analytics</div>
    <div class="error-msg">${esc(message)}</div>
  </div>
</body>
</html>`;
  }

  private dispose(): void {
    OrgPatternsDashboard.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

import * as vscode from 'vscode';
import { Team } from './types';
import { ApiClient } from './apiClient';

export class TeamManagementPanel {
  private static currentPanel: TeamManagementPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, private readonly client: ApiClient) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'loadTeams':
            await this.sendTeams();
            break;
          case 'createTeam':
            await this.handleCreateTeam(message.name, message.members);
            break;
          case 'addMember':
            await this.handleAddMember(message.teamId, message.memberId);
            break;
          case 'removeMember':
            await this.handleRemoveMember(message.teamId, message.memberId);
            break;
        }
      },
      null,
      this.disposables
    );
  }

  static show(client: ApiClient): void {
    const column = vscode.ViewColumn.One;

    if (TeamManagementPanel.currentPanel) {
      TeamManagementPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'devtraceai.teamManagement',
      'Team Management',
      column,
      { enableScripts: true }
    );

    TeamManagementPanel.currentPanel = new TeamManagementPanel(panel, client);
    panel.webview.html = TeamManagementPanel.currentPanel.getHtml();
  }

  private async sendTeams(): Promise<void> {
    try {
      const teams = await this.client.listTeams();
      void this.panel.webview.postMessage({ type: 'teamsLoaded', teams });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      void this.panel.webview.postMessage({ type: 'error', message: msg });
    }
  }

  private async handleCreateTeam(name: string, members: string[]): Promise<void> {
    try {
      await this.client.createTeam(name, members);
      vscode.window.showInformationMessage(`DevTrace AI: Team "${name}" created.`);
      await this.sendTeams();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`DevTrace AI: Failed to create team: ${msg}`);
    }
  }

  private async handleAddMember(teamId: string, memberId: string): Promise<void> {
    try {
      await this.client.updateTeamMembers(teamId, [memberId], []);
      await this.sendTeams();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`DevTrace AI: Failed to add member: ${msg}`);
    }
  }

  private async handleRemoveMember(teamId: string, memberId: string): Promise<void> {
    try {
      await this.client.updateTeamMembers(teamId, [], [memberId]);
      await this.sendTeams();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`DevTrace AI: Failed to remove member: ${msg}`);
    }
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Team Management</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 24px;
      line-height: 1.5;
      max-width: 720px;
      margin: 0 auto;
    }

    h1 { font-size: 1.5em; font-weight: 700; margin-bottom: 4px; }
    .subtitle { color: var(--vscode-descriptionForeground); font-size: 0.85em; margin-bottom: 20px; }

    .section-title {
      font-weight: 600; font-size: 0.78em; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--vscode-descriptionForeground);
      margin-bottom: 10px;
    }

    .create-form {
      background: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.06));
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }

    .field { margin-bottom: 12px; }
    .field:last-child { margin-bottom: 0; }
    .field-label { display: block; font-size: 0.85em; font-weight: 500; margin-bottom: 4px; }

    input[type="text"] {
      width: 100%; padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.3));
      border-radius: 4px;
      font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);
      outline: none;
    }
    input[type="text"]:focus { border-color: var(--vscode-focusBorder); }
    .field-hint { font-size: 0.78em; color: var(--vscode-descriptionForeground); margin-top: 3px; }

    .btn {
      padding: 7px 14px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none; border-radius: 4px;
      cursor: pointer; font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size); font-weight: 500;
      transition: background 0.15s;
    }
    .btn:hover { background: var(--vscode-button-hoverBackground, var(--vscode-button-background)); }
    .btn-sm { padding: 3px 10px; font-size: 0.82em; }
    .btn-danger {
      background: transparent;
      color: var(--vscode-errorForeground, #f44747);
      border: 1px solid var(--vscode-errorForeground, #f44747);
    }
    .btn-danger:hover { background: rgba(244,71,71,0.1); }

    .team-card {
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
      border-radius: 8px; padding: 16px 20px; margin-bottom: 12px;
      transition: border-color 0.2s;
    }
    .team-card:hover { border-color: var(--vscode-focusBorder, var(--vscode-button-background)); }

    .team-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .team-name { font-weight: 600; font-size: 1.05em; }
    .team-meta { font-size: 0.8em; color: var(--vscode-descriptionForeground); }

    .member-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .member-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 10px; border-radius: 12px;
      background: var(--vscode-badge-background, rgba(128,128,128,0.15));
      color: var(--vscode-badge-foreground, var(--vscode-foreground));
      font-size: 0.82em;
    }
    .member-remove {
      background: none; border: none; color: var(--vscode-descriptionForeground);
      cursor: pointer; font-size: 1em; padding: 0 2px; line-height: 1;
    }
    .member-remove:hover { color: var(--vscode-errorForeground, #f44747); }

    .add-member-row { display: flex; gap: 8px; }
    .add-member-row input { flex: 1; }

    .empty-state { text-align: center; padding: 40px 20px; color: var(--vscode-descriptionForeground); }
    .loading { text-align: center; padding: 20px; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <h1>Team Management</h1>
  <div class="subtitle">Create and manage teams to track AI usage across your reports</div>

  <div class="create-form">
    <div class="section-title">Create New Team</div>
    <div class="field">
      <label class="field-label" for="teamName">Team Name</label>
      <input type="text" id="teamName" placeholder="e.g., Frontend Squad" />
    </div>
    <div class="field">
      <label class="field-label" for="teamMembers">Members</label>
      <input type="text" id="teamMembers" placeholder="developer IDs, comma-separated" />
      <div class="field-hint">Enter developer IDs separated by commas</div>
    </div>
    <div class="field">
      <button class="btn" onclick="createTeam()">Create Team</button>
    </div>
  </div>

  <div class="section-title">Your Teams</div>
  <div id="teamsList">
    <div class="loading">Loading teams...</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    vscode.postMessage({ type: 'loadTeams' });

    function createTeam() {
      const name = document.getElementById('teamName').value.trim();
      const membersRaw = document.getElementById('teamMembers').value.trim();
      if (!name) { return; }
      const members = membersRaw ? membersRaw.split(',').map(m => m.trim()).filter(Boolean) : [];
      vscode.postMessage({ type: 'createTeam', name, members });
      document.getElementById('teamName').value = '';
      document.getElementById('teamMembers').value = '';
    }

    function addMember(teamId) {
      const input = document.getElementById('add-' + teamId);
      const memberId = input.value.trim();
      if (!memberId) { return; }
      vscode.postMessage({ type: 'addMember', teamId, memberId });
      input.value = '';
    }

    function removeMember(teamId, memberId) {
      vscode.postMessage({ type: 'removeMember', teamId, memberId });
    }

    function esc(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'teamsLoaded') {
        renderTeams(msg.teams);
      }
      if (msg.type === 'error') {
        document.getElementById('teamsList').innerHTML =
          '<div class="empty-state">Error: ' + esc(msg.message) + '</div>';
      }
    });

    function renderTeams(teams) {
      const container = document.getElementById('teamsList');
      if (!teams || teams.length === 0) {
        container.innerHTML = '<div class="empty-state">No teams yet. Create one above.</div>';
        return;
      }
      container.innerHTML = teams.map(team => {
        const memberChips = (team.members || []).map(m =>
          '<span class="member-chip">' + esc(m) +
          ' <button class="member-remove" onclick="removeMember(\\'' + esc(team.id) + '\\', \\'' + esc(m) + '\\')" title="Remove">&times;</button></span>'
        ).join('');

        return '<div class="team-card">' +
          '<div class="team-header">' +
            '<span class="team-name">' + esc(team.name) + '</span>' +
            '<span class="team-meta">Manager: ' + esc(team.managerId) + ' &middot; ' + (team.members || []).length + ' member' + ((team.members || []).length === 1 ? '' : 's') + '</span>' +
          '</div>' +
          '<div class="member-list">' + (memberChips || '<span class="team-meta">No members yet</span>') + '</div>' +
          '<div class="add-member-row">' +
            '<input type="text" id="add-' + esc(team.id) + '" placeholder="Developer ID" />' +
            '<button class="btn btn-sm" onclick="addMember(\\'' + esc(team.id) + '\\')">Add</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  </script>
</body>
</html>`;
  }

  private dispose(): void {
    TeamManagementPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

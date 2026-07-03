import * as vscode from 'vscode';
import { ExtensionConfig, PromptFilter } from './types';
import { ApiClient } from './apiClient';
import { PromptTreeProvider } from './promptTreeProvider';
import { PromptDetailPanel } from './promptDetailPanel';
import { TeamPatternsTreeProvider } from './teamPatternsTreeProvider';
import { TeamPatternsDashboard } from './teamPatternsDashboard';

let statusBarItem: vscode.StatusBarItem;

function getConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration('gologchat');
  return {
    apiUrl: config.get<string>('apiUrl', 'https://extension-2n4y.onrender.com'),
    developerId: config.get<string>('developerId'),
    teamId: config.get<string>('teamId'),
    enableLogging: config.get<boolean>('enableLogging', true),
    isAdmin: config.get<boolean>('isAdmin', false),
  };
}

export function activate(context: vscode.ExtensionContext) {
  const config = getConfig();
  const client = new ApiClient(config);
  const treeProvider = new PromptTreeProvider(client);
  const teamPatternsProvider = new TeamPatternsTreeProvider(client);

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.command = 'gologchat.checkConnection';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  void checkOnboarding(config);
  void checkBackendHealth(client);
  void autoRegister(client, config);

  const treeView = vscode.window.createTreeView('gologchat.promptHistory', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  const teamPatternsView = vscode.window.createTreeView('gologchat.teamPatterns', {
    treeDataProvider: teamPatternsProvider,
    showCollapseAll: true,
  });

  void treeProvider.refresh();
  void teamPatternsProvider.refresh();

  const logPromptCmd = vscode.commands.registerCommand('gologchat.logPrompt', async () => {
    const currentConfig = getConfig();
    if (!currentConfig.enableLogging) {
      vscode.window.showInformationMessage('GoLogChat logging is disabled in settings.');
      return;
    }
    if (!currentConfig.developerId || !currentConfig.teamId) {
      const setup = await vscode.window.showErrorMessage(
        'GoLogChat: Please set developerId and teamId in settings.',
        'Open Settings'
      );
      if (setup === 'Open Settings') {
        void vscode.commands.executeCommand('workbench.action.openSettings', 'gologchat');
      }
      return;
    }

    const promptText = await vscode.window.showInputBox({
      title: 'GoLogChat: Prompt',
      placeHolder: 'Enter the prompt you sent to the AI assistant',
      ignoreFocusOut: true,
    });
    if (!promptText) { return; }

    const responseText = await vscode.window.showInputBox({
      title: 'GoLogChat: Response (optional)',
      placeHolder: 'Enter the AI response (optional)',
      ignoreFocusOut: true,
    });

    try {
      client.updateConfig(currentConfig);
      await client.createPrompt(promptText, responseText || undefined);
      vscode.window.showInformationMessage('GoLogChat: Prompt logged successfully.');
      void treeProvider.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`GoLogChat: Failed to log prompt: ${msg}`);
    }
  });

  const refreshCmd = vscode.commands.registerCommand('gologchat.refreshPrompts', () => {
    void treeProvider.refresh();
  });

  const filterCmd = vscode.commands.registerCommand('gologchat.filterPrompts', async () => {
    await filterPromptsCommand(treeProvider);
  });

  const clearFilterCmd = vscode.commands.registerCommand('gologchat.clearFilter', async () => {
    await treeProvider.clearFilter();
    void vscode.commands.executeCommand('setContext', 'gologchat.filterActive', false);
  });

  const viewDetailCmd = vscode.commands.registerCommand(
    'gologchat.viewPromptDetail',
    (prompt) => {
      if (prompt) {
        PromptDetailPanel.show(prompt);
      }
    }
  );

  const refreshPatternsCmd = vscode.commands.registerCommand('gologchat.refreshTeamPatterns', () => {
    void teamPatternsProvider.refresh();
  });

  const showDashboardCmd = vscode.commands.registerCommand('gologchat.showTeamDashboard', () => {
    void TeamPatternsDashboard.show(client);
  });

  const editDeveloperCmd = vscode.commands.registerCommand('gologchat.editDeveloper', async (item: { data?: { developerId: string } }) => {
    const developerId = item?.data?.developerId;
    if (!developerId) { return; }

    const currentUser = await (async () => {
      try { return await client.getUser(developerId); }
      catch { return null; }
    })();

    const newTeamId = await vscode.window.showInputBox({
      title: `Edit Profile: ${developerId}`,
      prompt: 'Team ID',
      value: currentUser?.teamId ?? getConfig().teamId ?? '',
      ignoreFocusOut: true,
    });
    if (newTeamId === undefined) { return; }

    const adminChoice = await vscode.window.showQuickPick(
      ['No', 'Yes'],
      {
        title: `Edit Profile: ${developerId}`,
        placeHolder: `Admin access? (currently: ${currentUser?.isAdmin ? 'Yes' : 'No'})`,
      }
    );
    if (adminChoice === undefined) { return; }

    try {
      await client.updateUser(developerId, newTeamId, adminChoice === 'Yes');
      vscode.window.showInformationMessage(`GoLogChat: Updated profile for ${developerId}.`);
      void teamPatternsProvider.refresh();
      void treeProvider.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`GoLogChat: Failed to update profile: ${msg}`);
    }
  });

  const checkConnectionCmd = vscode.commands.registerCommand('gologchat.checkConnection', () => {
    void checkBackendHealth(client);
  });

  const searchCmd = vscode.commands.registerCommand('gologchat.searchPrompts', async () => {
    const query = await vscode.window.showInputBox({
      title: 'GoLogChat: Search Prompts',
      placeHolder: 'Enter search text...',
      ignoreFocusOut: true,
    });
    if (!query) { return; }

    try {
      const allPrompts = await client.getPrompts();
      const lower = query.toLowerCase();
      const matches = allPrompts.filter(p =>
        p.prompt.toLowerCase().includes(lower) ||
        (p.response?.toLowerCase().includes(lower))
      );

      if (matches.length === 0) {
        vscode.window.showInformationMessage('GoLogChat: No prompts matched your search.');
        return;
      }

      const items = matches.map(p => ({
        label: p.prompt.length > 80 ? p.prompt.substring(0, 80) + '...' : p.prompt,
        description: `${p.developerId} - ${new Date(p.timestamp).toLocaleDateString()}`,
        detail: p.response ? (p.response.length > 120 ? p.response.substring(0, 120) + '...' : p.response) : undefined,
        prompt: p,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        title: `GoLogChat: ${matches.length} result${matches.length === 1 ? '' : 's'} for "${query}"`,
        matchOnDescription: true,
        matchOnDetail: true,
      });
      if (selected) {
        PromptDetailPanel.show(selected.prompt);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`GoLogChat: Search failed: ${msg}`);
    }
  });

  const exportCmd = vscode.commands.registerCommand('gologchat.exportPrompts', async () => {
    const format = await vscode.window.showQuickPick(
      ['JSON', 'CSV'],
      { placeHolder: 'Choose export format' }
    );
    if (!format) { return; }

    try {
      const prompts = await client.getPrompts();
      if (prompts.length === 0) {
        vscode.window.showInformationMessage('GoLogChat: No prompts to export.');
        return;
      }

      let content: string;
      let language: string;

      if (format === 'JSON') {
        content = JSON.stringify(prompts, null, 2);
        language = 'json';
      } else {
        const header = 'id,developerId,teamId,timestamp,prompt,response';
        const csvEscape = (s: string) => `"${s.replace(/"/g, '""')}"`;
        const rows = prompts.map(p =>
          [p.id, p.developerId, p.teamId, p.timestamp, csvEscape(p.prompt), csvEscape(p.response ?? '')].join(',')
        );
        content = [header, ...rows].join('\n');
        language = 'csv';
      }

      const doc = await vscode.workspace.openTextDocument({ content, language });
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(`GoLogChat: Exported ${prompts.length} prompts as ${format}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`GoLogChat: Export failed: ${msg}`);
    }
  });

  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('gologchat')) {
      const newConfig = getConfig();
      client.updateConfig(newConfig);
      void treeProvider.refresh();
      void teamPatternsProvider.refresh();
      void checkBackendHealth(client);
    }
  });

  context.subscriptions.push(
    treeView,
    teamPatternsView,
    logPromptCmd,
    refreshCmd,
    refreshPatternsCmd,
    showDashboardCmd,
    editDeveloperCmd,
    filterCmd,
    clearFilterCmd,
    viewDetailCmd,
    checkConnectionCmd,
    searchCmd,
    exportCmd,
    configWatcher
  );
}

export function deactivate() {
  statusBarItem?.dispose();
}

async function checkBackendHealth(client: ApiClient): Promise<void> {
  statusBarItem.text = '$(sync~spin) GoLogChat';
  statusBarItem.tooltip = 'Checking backend connection...';

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await client.checkHealth();
      statusBarItem.text = '$(check) GoLogChat';
      statusBarItem.tooltip = 'Connected to GoLogChat backend';
      statusBarItem.backgroundColor = undefined;
      return;
    } catch {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  statusBarItem.text = '$(warning) GoLogChat';
  statusBarItem.tooltip = 'Cannot reach GoLogChat backend — click to retry';
  statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
}

async function autoRegister(client: ApiClient, config: ExtensionConfig): Promise<void> {
  if (!config.developerId || !config.teamId) { return; }
  try {
    await client.registerUser();
  } catch {
    console.warn('GoLogChat: Auto-registration failed. Backend may be unavailable.');
  }
}

async function checkOnboarding(config: ExtensionConfig): Promise<void> {
  if (config.developerId && config.teamId) { return; }

  const action = await vscode.window.showInformationMessage(
    'GoLogChat: Set up your Developer ID and Team ID to start logging prompts.',
    'Configure Now',
    'Later'
  );

  if (action !== 'Configure Now') { return; }

  const developerId = await vscode.window.showInputBox({
    title: 'GoLogChat Setup',
    prompt: 'Enter your Developer ID (e.g., your username)',
    placeHolder: 'john-doe',
    ignoreFocusOut: true,
  });
  if (!developerId) { return; }

  const teamId = await vscode.window.showInputBox({
    title: 'GoLogChat Setup',
    prompt: 'Enter your Team ID',
    placeHolder: 'platform',
    ignoreFocusOut: true,
  });
  if (!teamId) { return; }

  const wsConfig = vscode.workspace.getConfiguration('gologchat');
  await wsConfig.update('developerId', developerId, vscode.ConfigurationTarget.Global);
  await wsConfig.update('teamId', teamId, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(`GoLogChat: Welcome, ${developerId}! You're all set.`);
}

async function filterPromptsCommand(treeProvider: PromptTreeProvider): Promise<void> {
  const filterType = await vscode.window.showQuickPick(
    ['By Developer ID', 'By Date Range', 'By Developer ID and Date Range'],
    { placeHolder: 'Choose filter type' }
  );
  if (!filterType) { return; }

  const filter: PromptFilter = {};

  if (filterType.includes('Developer ID')) {
    const devId = await vscode.window.showInputBox({
      prompt: 'Enter Developer ID to filter by',
      placeHolder: 'developer-id',
    });
    if (devId === undefined) { return; }
    filter.developerId = devId || undefined;
  }

  if (filterType.includes('Date Range')) {
    const startDate = await vscode.window.showInputBox({
      prompt: 'Start date (YYYY-MM-DD), leave empty for no start bound',
      placeHolder: '2026-01-01',
      validateInput: (v) => {
        if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) { return 'Use YYYY-MM-DD format'; }
        return null;
      },
    });
    if (startDate === undefined) { return; }
    if (startDate) {
      filter.startDate = new Date(startDate + 'T00:00:00Z').toISOString();
    }

    const endDate = await vscode.window.showInputBox({
      prompt: 'End date (YYYY-MM-DD), leave empty for no end bound',
      placeHolder: '2026-12-31',
      validateInput: (v) => {
        if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) { return 'Use YYYY-MM-DD format'; }
        return null;
      },
    });
    if (endDate === undefined) { return; }
    if (endDate) {
      filter.endDate = new Date(endDate + 'T23:59:59Z').toISOString();
    }
  }

  await treeProvider.setFilter(filter);
  void vscode.commands.executeCommand('setContext', 'gologchat.filterActive', treeProvider.isFilterActive);
}

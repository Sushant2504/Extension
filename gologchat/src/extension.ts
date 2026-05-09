import * as vscode from 'vscode';
import { ExtensionConfig, PromptFilter } from './types';
import { ApiClient } from './apiClient';
import { PromptTreeProvider } from './promptTreeProvider';
import { PromptDetailPanel } from './promptDetailPanel';

function getConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration('gologchat');
  return {
    apiUrl: config.get<string>('apiUrl', 'http://localhost:8080'),
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

  void autoRegister(client, config);

  const treeView = vscode.window.createTreeView('gologchat.promptHistory', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  void treeProvider.refresh();

  const logPromptCmd = vscode.commands.registerCommand('gologchat.logPrompt', async () => {
    const currentConfig = getConfig();
    if (!currentConfig.enableLogging) {
      vscode.window.showInformationMessage('GoLogChat logging is disabled in settings.');
      return;
    }
    if (!currentConfig.developerId || !currentConfig.teamId) {
      vscode.window.showErrorMessage('GoLogChat: Please set developerId and teamId in settings.');
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

  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('gologchat')) {
      client.updateConfig(getConfig());
      void treeProvider.refresh();
    }
  });

  context.subscriptions.push(
    treeView,
    logPromptCmd,
    refreshCmd,
    filterCmd,
    clearFilterCmd,
    viewDetailCmd,
    configWatcher
  );
}

export function deactivate() {}

async function autoRegister(client: ApiClient, config: ExtensionConfig): Promise<void> {
  if (!config.developerId || !config.teamId) { return; }
  try {
    await client.registerUser();
  } catch {
    console.warn('GoLogChat: Auto-registration failed. Backend may be unavailable.');
  }
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

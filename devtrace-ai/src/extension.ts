import * as vscode from 'vscode';
import { ExtensionConfig, CONFIG_KEYS, API_BASE_URL, PromptFilter, PROVIDERS, MODELS } from './types';
import { ApiClient } from './apiClient';
import { PromptTreeProvider } from './promptTreeProvider';
import { PromptDetailPanel } from './promptDetailPanel';
import { OrgPatternsTreeProvider } from './orgPatternsTreeProvider';
import { OrgPatternsDashboard } from './orgPatternsDashboard';
import { SettingsViewProvider } from './settingsViewProvider';

let statusBarItem: vscode.StatusBarItem;

function getConfig(context: vscode.ExtensionContext): ExtensionConfig {
  const gs = context.globalState;
  const vs = vscode.workspace.getConfiguration('devtraceai');
  return {
    apiUrl: API_BASE_URL,
    developerId: gs.get<string>(CONFIG_KEYS.developerId) ?? vs.get<string>('developerId'),
    orgId: gs.get<string>(CONFIG_KEYS.orgId) ?? vs.get<string>('orgId'),
    enableLogging: gs.get<boolean>(CONFIG_KEYS.enableLogging) ?? vs.get<boolean>('enableLogging', true),
    isAdmin: gs.get<boolean>(CONFIG_KEYS.isAdmin) ?? vs.get<boolean>('isAdmin', false),
    defaultProvider: gs.get<string>(CONFIG_KEYS.defaultProvider) ?? vs.get<string>('defaultProvider'),
    defaultModel: gs.get<string>(CONFIG_KEYS.defaultModel) ?? vs.get<string>('defaultModel'),
    role: (gs.get<string>(CONFIG_KEYS.role) ?? vs.get<string>('role')) as ExtensionConfig['role'],
  };
}

export function activate(context: vscode.ExtensionContext) {
  const config = getConfig(context);
  const client = new ApiClient(config);
  const treeProvider = new PromptTreeProvider(client);
  const orgPatternsProvider = new OrgPatternsTreeProvider(client);

  // Settings webview in sidebar
  const settingsProvider = new SettingsViewProvider(context);
  const settingsViewDisposable = vscode.window.registerWebviewViewProvider(
    SettingsViewProvider.viewId,
    settingsProvider
  );

  // React to config changes from the settings webview
  const settingsConfigWatcher = settingsProvider.onDidChangeConfig((newConfig) => {
    client.updateConfig(newConfig);
    void treeProvider.refresh();
    void orgPatternsProvider.refresh();
    void checkBackendHealth(client);
    void autoRegister(client, newConfig);
  });

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.command = 'devtraceai.checkConnection';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  void checkOnboarding(context);
  void checkBackendHealth(client);
  void autoRegister(client, config);

  const treeView = vscode.window.createTreeView('devtraceai.promptHistory', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  const orgPatternsView = vscode.window.createTreeView('devtraceai.orgPatterns', {
    treeDataProvider: orgPatternsProvider,
    showCollapseAll: true,
  });

  void treeProvider.refresh();
  void orgPatternsProvider.refresh();

  const logPromptCmd = vscode.commands.registerCommand('devtraceai.logPrompt', async () => {
    const currentConfig = getConfig(context);
    if (!currentConfig.enableLogging) {
      vscode.window.showInformationMessage('DevTrace AI logging is disabled in settings.');
      return;
    }
    if (!currentConfig.developerId || !currentConfig.orgId) {
      const setup = await vscode.window.showErrorMessage(
        'DevTrace AI: Please set Developer ID and Organization ID in the Settings panel.',
        'Open Settings'
      );
      if (setup === 'Open Settings') {
        void vscode.commands.executeCommand('devtraceai.settings.focus');
      }
      return;
    }

    const promptText = await vscode.window.showInputBox({
      title: 'DevTrace AI: Prompt',
      placeHolder: 'Enter the prompt you sent to the AI assistant',
      ignoreFocusOut: true,
    });
    if (!promptText) { return; }

    const responseText = await vscode.window.showInputBox({
      title: 'DevTrace AI: Response (optional)',
      placeHolder: 'Enter the AI response (optional)',
      ignoreFocusOut: true,
    });

    const defaultProvider = currentConfig.defaultProvider
      || context.globalState.get<string>('devtraceai.lastProvider');
    const providerItems = PROVIDERS.map(p => ({
      label: p,
      description: p === defaultProvider ? '(default)' : undefined,
    }));
    if (defaultProvider) {
      const idx = providerItems.findIndex(i => i.label === defaultProvider);
      if (idx > 0) {
        const [item] = providerItems.splice(idx, 1);
        providerItems.unshift(item);
      }
    }
    const selectedProvider = await vscode.window.showQuickPick(providerItems, {
      title: 'DevTrace AI: AI Provider',
      placeHolder: 'Which AI tool generated this?',
    });
    if (!selectedProvider) { return; }

    const defaultModel = currentConfig.defaultModel
      || context.globalState.get<string>('devtraceai.lastModel');
    const modelItems = MODELS.map(m => ({
      label: m,
      description: m === defaultModel ? '(default)' : undefined,
    }));
    if (defaultModel) {
      const idx = modelItems.findIndex(i => i.label === defaultModel);
      if (idx > 0) {
        const [item] = modelItems.splice(idx, 1);
        modelItems.unshift(item);
      }
    }
    const selectedModel = await vscode.window.showQuickPick(modelItems, {
      title: 'DevTrace AI: AI Model',
      placeHolder: 'Which model was used?',
    });
    if (!selectedModel) { return; }

    const activeEditor = vscode.window.activeTextEditor;
    const language = activeEditor?.document.languageId || undefined;
    const fileContext = activeEditor?.document.fileName
      ? activeEditor.document.fileName.split(/[\\/]/).pop()
      : undefined;
    const project = vscode.workspace.workspaceFolders?.[0]?.name;

    try {
      client.updateConfig(currentConfig);
      const savedPrompt = await client.createPrompt(
        promptText,
        responseText || undefined,
        selectedProvider.label,
        selectedModel.label,
        language,
        fileContext,
        project,
      );
      void context.globalState.update('devtraceai.lastProvider', selectedProvider.label);
      void context.globalState.update('devtraceai.lastModel', selectedModel.label);
      vscode.window.showInformationMessage('DevTrace AI: Prompt logged successfully.');
      const feedbackChoice = await vscode.window.showInformationMessage(
        'How did this AI suggestion work out?',
        'Accepted', 'Rejected', 'Edited'
      );
      if (feedbackChoice) {
        await client.updatePromptOutcome(
          savedPrompt.id,
          feedbackChoice.toLowerCase() as 'accepted' | 'rejected' | 'edited'
        );
      }
      void treeProvider.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`DevTrace AI: Failed to log prompt: ${msg}`);
    }
  });

  const refreshCmd = vscode.commands.registerCommand('devtraceai.refreshPrompts', () => {
    void treeProvider.refresh();
  });

  const filterCmd = vscode.commands.registerCommand('devtraceai.filterPrompts', async () => {
    await filterPromptsCommand(treeProvider);
  });

  const clearFilterCmd = vscode.commands.registerCommand('devtraceai.clearFilter', async () => {
    await treeProvider.clearFilter();
    void vscode.commands.executeCommand('setContext', 'devtraceai.filterActive', false);
  });

  const viewDetailCmd = vscode.commands.registerCommand(
    'devtraceai.viewPromptDetail',
    (prompt) => {
      if (prompt) {
        PromptDetailPanel.show(prompt, client);
      }
    }
  );

  const refreshPatternsCmd = vscode.commands.registerCommand('devtraceai.refreshOrgPatterns', () => {
    void orgPatternsProvider.refresh();
  });

  const showDashboardCmd = vscode.commands.registerCommand('devtraceai.showOrgDashboard', () => {
    void OrgPatternsDashboard.show(client);
  });

  const editDeveloperCmd = vscode.commands.registerCommand('devtraceai.editDeveloper', async (item: { data?: { developerId: string } }) => {
    const developerId = item?.data?.developerId;
    if (!developerId) { return; }

    const currentUser = await (async () => {
      try { return await client.getUser(developerId); }
      catch { return null; }
    })();

    const newOrgId = await vscode.window.showInputBox({
      title: `Edit Profile: ${developerId}`,
      prompt: 'Organization ID',
      value: currentUser?.orgId ?? getConfig(context).orgId ?? '',
      ignoreFocusOut: true,
    });
    if (newOrgId === undefined) { return; }

    const adminChoice = await vscode.window.showQuickPick(
      ['No', 'Yes'],
      {
        title: `Edit Profile: ${developerId}`,
        placeHolder: `Admin access? (currently: ${currentUser?.isAdmin ? 'Yes' : 'No'})`,
      }
    );
    if (adminChoice === undefined) { return; }

    try {
      await client.updateUser(developerId, newOrgId, adminChoice === 'Yes');
      vscode.window.showInformationMessage(`DevTrace AI: Updated profile for ${developerId}.`);
      void orgPatternsProvider.refresh();
      void treeProvider.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`DevTrace AI: Failed to update profile: ${msg}`);
    }
  });

  const checkConnectionCmd = vscode.commands.registerCommand('devtraceai.checkConnection', () => {
    void checkBackendHealth(client);
  });

  const openSettingsCmd = vscode.commands.registerCommand('devtraceai.openSettings', () => {
    void vscode.commands.executeCommand('devtraceai.settings.focus');
  });

  const searchCmd = vscode.commands.registerCommand('devtraceai.searchPrompts', async () => {
    const query = await vscode.window.showInputBox({
      title: 'DevTrace AI: Search Prompts',
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
        vscode.window.showInformationMessage('DevTrace AI: No prompts matched your search.');
        return;
      }

      const items = matches.map(p => ({
        label: p.prompt.length > 80 ? p.prompt.substring(0, 80) + '...' : p.prompt,
        description: `${p.developerId} - ${new Date(p.timestamp).toLocaleDateString()}`,
        detail: p.response ? (p.response.length > 120 ? p.response.substring(0, 120) + '...' : p.response) : undefined,
        prompt: p,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        title: `DevTrace AI: ${matches.length} result${matches.length === 1 ? '' : 's'} for "${query}"`,
        matchOnDescription: true,
        matchOnDetail: true,
      });
      if (selected) {
        PromptDetailPanel.show(selected.prompt, client);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`DevTrace AI: Search failed: ${msg}`);
    }
  });

  const exportCmd = vscode.commands.registerCommand('devtraceai.exportPrompts', async () => {
    const format = await vscode.window.showQuickPick(
      ['JSON', 'CSV'],
      { placeHolder: 'Choose export format' }
    );
    if (!format) { return; }

    try {
      const prompts = await client.getPrompts();
      if (prompts.length === 0) {
        vscode.window.showInformationMessage('DevTrace AI: No prompts to export.');
        return;
      }

      let content: string;
      let language: string;

      if (format === 'JSON') {
        content = JSON.stringify(prompts, null, 2);
        language = 'json';
      } else {
        const header = 'id,developerId,orgId,provider,model,language,estimatedTokens,project,outcome,timestamp,prompt,response';
        const csvEscape = (s: string) => `"${s.replace(/"/g, '""')}"`;
        const rows = prompts.map(p =>
          [p.id, p.developerId, p.orgId, csvEscape(p.provider ?? ''), csvEscape(p.model ?? ''), csvEscape(p.language ?? ''), p.estimatedTokens ?? 0, csvEscape(p.project ?? ''), csvEscape(p.outcome ?? ''), p.timestamp, csvEscape(p.prompt), csvEscape(p.response ?? '')].join(',')
        );
        content = [header, ...rows].join('\n');
        language = 'csv';
      }

      const doc = await vscode.workspace.openTextDocument({ content, language });
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(`DevTrace AI: Exported ${prompts.length} prompts as ${format}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`DevTrace AI: Export failed: ${msg}`);
    }
  });

  const quickCaptureCmd = vscode.commands.registerCommand('devtraceai.quickCapture', async () => {
    const currentConfig = getConfig(context);
    if (!currentConfig.developerId || !currentConfig.orgId) {
      vscode.window.showErrorMessage('DevTrace AI: Please set Developer ID and Organization ID first.');
      return;
    }

    const clipboardText = await vscode.env.clipboard.readText();
    if (!clipboardText || clipboardText.trim().length < 20) {
      vscode.window.showInformationMessage('DevTrace AI: Clipboard content too short to capture.');
      return;
    }

    const appName = vscode.env.appName;
    let detectedProvider = 'Other';
    if (appName.includes('Cursor')) { detectedProvider = 'Cursor'; }
    else if (appName.includes('Visual Studio Code')) { detectedProvider = 'GitHub Copilot'; }
    else if (appName.includes('Windsurf')) { detectedProvider = 'Continue'; }

    const project = vscode.workspace.workspaceFolders?.[0]?.name;
    const activeEditor = vscode.window.activeTextEditor;
    const language = activeEditor?.document.languageId || undefined;
    const fileContext = activeEditor?.document.fileName
      ? activeEditor.document.fileName.split(/[\\/]/).pop()
      : undefined;

    const outcomeChoice = await vscode.window.showQuickPick(
      [
        { label: 'Accepted', description: 'AI output was used as-is' },
        { label: 'Edited', description: 'AI output was modified before use' },
        { label: 'Rejected', description: 'AI output was discarded' },
        { label: 'Skip', description: 'Log without rating' },
      ],
      {
        title: `DevTrace AI: Quick Capture (${detectedProvider})`,
        placeHolder: 'How useful was this AI output?',
      }
    );
    if (!outcomeChoice) { return; }

    try {
      client.updateConfig(currentConfig);
      const savedPrompt = await client.createPrompt(
        clipboardText,
        undefined,
        detectedProvider,
        currentConfig.defaultModel || context.globalState.get<string>('devtraceai.lastModel') || 'Other',
        language,
        fileContext,
        project,
      );
      if (outcomeChoice.label !== 'Skip') {
        await client.updatePromptOutcome(
          savedPrompt.id,
          outcomeChoice.label.toLowerCase() as 'accepted' | 'rejected' | 'edited'
        );
      }
      vscode.window.showInformationMessage(`DevTrace AI: Captured from clipboard (${detectedProvider}).`);
      void treeProvider.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`DevTrace AI: Quick capture failed: ${msg}`);
    }
  });

  const manageTeamsCmd = vscode.commands.registerCommand('devtraceai.manageTeams', async () => {
    const { TeamManagementPanel } = await import('./teamManagementPanel.js');
    TeamManagementPanel.show(client);
  });

  const showTeamDashboardCmd = vscode.commands.registerCommand('devtraceai.showTeamDashboard', async () => {
    const teams = await client.listTeams();
    if (teams.length === 0) {
      vscode.window.showInformationMessage('DevTrace AI: No teams found. Create a team first.');
      return;
    }
    const items = teams.map(t => ({
      label: t.name,
      description: `${t.members.length} member${t.members.length === 1 ? '' : 's'}`,
      teamId: t.id,
    }));
    const selected = await vscode.window.showQuickPick(items, {
      title: 'DevTrace AI: Select Team',
      placeHolder: 'Which team\'s dashboard?',
    });
    if (selected) {
      void OrgPatternsDashboard.show(client, selected.teamId);
    }
  });

  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('devtraceai')) {
      const newConfig = getConfig(context);
      client.updateConfig(newConfig);
      settingsProvider.refreshView();
      void treeProvider.refresh();
      void orgPatternsProvider.refresh();
      void checkBackendHealth(client);
    }
  });

  context.subscriptions.push(
    treeView,
    orgPatternsView,
    settingsViewDisposable,
    settingsConfigWatcher,
    logPromptCmd,
    refreshCmd,
    refreshPatternsCmd,
    showDashboardCmd,
    editDeveloperCmd,
    filterCmd,
    clearFilterCmd,
    viewDetailCmd,
    checkConnectionCmd,
    openSettingsCmd,
    searchCmd,
    exportCmd,
    quickCaptureCmd,
    manageTeamsCmd,
    showTeamDashboardCmd,
    configWatcher
  );
}

export function deactivate() {
  statusBarItem?.dispose();
}

async function checkBackendHealth(client: ApiClient): Promise<void> {
  statusBarItem.text = '$(sync~spin) DevTrace AI';
  statusBarItem.tooltip = 'Checking backend connection...';

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await client.checkHealth();
      statusBarItem.text = '$(check) DevTrace AI';
      statusBarItem.tooltip = 'Connected to DevTrace AI backend';
      statusBarItem.backgroundColor = undefined;
      return;
    } catch {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  statusBarItem.text = '$(warning) DevTrace AI';
  statusBarItem.tooltip = 'Cannot reach DevTrace AI backend — click to retry';
  statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
}

async function autoRegister(client: ApiClient, config: ExtensionConfig): Promise<void> {
  if (!config.developerId || !config.orgId) { return; }
  try {
    await client.registerUser();
  } catch {
    console.warn('DevTrace AI: Auto-registration failed. Backend may be unavailable.');
  }
}

async function checkOnboarding(context: vscode.ExtensionContext): Promise<void> {
  const config = getConfig(context);
  if (config.developerId && config.orgId) { return; }

  const action = await vscode.window.showInformationMessage(
    'DevTrace AI: Set up your Developer ID and Organization ID to start logging prompts.',
    'Open Settings'
  );

  if (action === 'Open Settings') {
    await vscode.commands.executeCommand('devtraceai.settings.focus');
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
  void vscode.commands.executeCommand('setContext', 'devtraceai.filterActive', treeProvider.isFilterActive);
}

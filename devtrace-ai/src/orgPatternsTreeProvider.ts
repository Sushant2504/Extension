import * as vscode from 'vscode';
import { DeveloperPatterns, PatternCount, RecentPromptSummary } from './types';
import { ApiClient } from './apiClient';

const patternIcons: Record<string, string> = {
  debugging: 'bug',
  refactoring: 'tools',
  testing: 'beaker',
  feature: 'lightbulb',
  documentation: 'book',
  review: 'git-pull-request',
  deployment: 'rocket',
  configuration: 'gear',
  learning: 'mortar-board',
  api: 'plug',
  other: 'circle-outline',
};

class DeveloperItem extends vscode.TreeItem {
  constructor(public readonly data: DeveloperPatterns) {
    super(data.developerId, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon('person');
    this.description = `${data.totalPrompts} prompt${data.totalPrompts === 1 ? '' : 's'}`;
    const lastActive = new Date(data.lastActive).toLocaleString();
    this.tooltip = new vscode.MarkdownString(
      `**Developer:** ${data.developerId}\n\n` +
      `**Total Prompts:** ${data.totalPrompts}\n\n` +
      `**Last Active:** ${lastActive}`
    );
    this.contextValue = 'developer';
  }
}

class PatternItem extends vscode.TreeItem {
  constructor(
    public readonly patternData: PatternCount,
    public readonly developerData: DeveloperPatterns
  ) {
    const label = patternData.pattern.charAt(0).toUpperCase() + patternData.pattern.slice(1);
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon(patternIcons[patternData.pattern] ?? 'circle-outline');
    this.description = `(${patternData.count})`;
    this.contextValue = 'pattern';
  }
}

class RecentPromptItem extends vscode.TreeItem {
  constructor(public readonly summary: RecentPromptSummary) {
    const label = summary.summary.length > 60
      ? summary.summary.substring(0, 60) + '...'
      : summary.summary;
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('comment');
    this.description = new Date(summary.timestamp).toLocaleTimeString();
    this.tooltip = new vscode.MarkdownString(
      `**Prompt:** ${summary.summary}\n\n` +
      `**Pattern:** ${summary.pattern}\n\n` +
      `**Time:** ${new Date(summary.timestamp).toLocaleString()}`
    );
    this.contextValue = 'recentPrompt';
  }
}

type TreeElement = DeveloperItem | PatternItem | RecentPromptItem;

export class OrgPatternsTreeProvider implements vscode.TreeDataProvider<TreeElement> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeElement | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private patterns: DeveloperPatterns[] = [];

  constructor(private readonly client: ApiClient) {}

  async refresh(): Promise<void> {
    try {
      this.patterns = await this.client.getOrgPatterns();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`DevTrace AI: Failed to fetch org patterns: ${msg}`);
      this.patterns = [];
    }
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeElement): TreeElement[] {
    if (!element) {
      return this.patterns.map(dp => new DeveloperItem(dp));
    }
    if (element instanceof DeveloperItem) {
      return element.data.patterns.map(p => new PatternItem(p, element.data));
    }
    if (element instanceof PatternItem) {
      return element.developerData.recentPrompts
        .filter(rp => rp.pattern === element.patternData.pattern)
        .map(rp => new RecentPromptItem(rp));
    }
    return [];
  }
}

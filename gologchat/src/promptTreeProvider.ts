import * as vscode from 'vscode';
import { Prompt, PromptFilter } from './types';
import { ApiClient } from './apiClient';

class DateGroupItem extends vscode.TreeItem {
  constructor(
    public readonly dateLabel: string,
    public readonly prompts: Prompt[]
  ) {
    super(dateLabel, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon('calendar');
    this.description = `${prompts.length} prompt${prompts.length === 1 ? '' : 's'}`;
    this.contextValue = 'dateGroup';
  }
}

class PromptTreeItem extends vscode.TreeItem {
  constructor(public readonly prompt: Prompt) {
    const label = prompt.prompt.length > 60
      ? prompt.prompt.substring(0, 60) + '...'
      : prompt.prompt;
    super(label, vscode.TreeItemCollapsibleState.None);

    this.iconPath = new vscode.ThemeIcon(
      prompt.response ? 'comment-discussion' : 'comment'
    );
    const time = new Date(prompt.timestamp).toLocaleTimeString();
    this.description = `${prompt.developerId} at ${time}`;
    this.tooltip = new vscode.MarkdownString(
      `**Prompt:** ${prompt.prompt}\n\n` +
      (prompt.response ? `**Response:** ${prompt.response}\n\n` : '') +
      `**Developer:** ${prompt.developerId}\n\n` +
      `**Time:** ${new Date(prompt.timestamp).toLocaleString()}`
    );
    this.contextValue = 'prompt';
    this.command = {
      command: 'devtraceai.viewPromptDetail',
      title: 'View Details',
      arguments: [this.prompt],
    };
  }
}

type TreeElement = DateGroupItem | PromptTreeItem;

export class PromptTreeProvider implements vscode.TreeDataProvider<TreeElement> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeElement | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private prompts: Prompt[] = [];
  private filter: PromptFilter = {};

  constructor(private readonly client: ApiClient) {}

  async refresh(): Promise<void> {
    try {
      this.prompts = await this.client.getPrompts(this.filter);
      this.prompts.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`DevTrace AI: Failed to fetch prompts: ${msg}`);
      this.prompts = [];
    }
    this._onDidChangeTreeData.fire();
  }

  async setFilter(filter: PromptFilter): Promise<void> {
    this.filter = filter;
    await this.refresh();
  }

  async clearFilter(): Promise<void> {
    this.filter = {};
    await this.refresh();
  }

  get isFilterActive(): boolean {
    return !!(this.filter.developerId || this.filter.startDate || this.filter.endDate);
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeElement): TreeElement[] {
    if (!element) {
      const groups = new Map<string, Prompt[]>();
      for (const p of this.prompts) {
        const dateKey = new Date(p.timestamp).toLocaleDateString('en-CA');
        const list = groups.get(dateKey) ?? [];
        list.push(p);
        groups.set(dateKey, list);
      }
      const sortedKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a));
      return sortedKeys.map(key => new DateGroupItem(key, groups.get(key)!));
    }
    if (element instanceof DateGroupItem) {
      return element.prompts.map(p => new PromptTreeItem(p));
    }
    return [];
  }
}

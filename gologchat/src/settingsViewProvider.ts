import * as vscode from 'vscode';
import { ExtensionConfig, CONFIG_KEYS, API_BASE_URL } from './types';

export class SettingsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'gologchat.settings';

  private _view?: vscode.WebviewView;

  private readonly _onDidChangeConfig = new vscode.EventEmitter<ExtensionConfig>();
  public readonly onDidChangeConfig = this._onDidChangeConfig.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;

    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(
      async (message: { type: string; config?: Partial<ExtensionConfig> }) => {
        if (message.type === 'saveConfig' && message.config) {
          await this.saveConfig(message.config);
        } else if (message.type === 'getConfig') {
          this.sendCurrentConfig();
        }
      }
    );

    this.sendCurrentConfig();
  }

  public refreshView(): void {
    if (this._view?.visible) {
      this.sendCurrentConfig();
    }
  }

  private sendCurrentConfig(): void {
    const config = this.readConfig();
    void this._view?.webview.postMessage({ type: 'configLoaded', config });
  }

  private readConfig(): ExtensionConfig {
    const gs = this.context.globalState;
    const vs = vscode.workspace.getConfiguration('gologchat');
    return {
      apiUrl: API_BASE_URL,
      developerId: gs.get<string>(CONFIG_KEYS.developerId) ?? vs.get<string>('developerId'),
      teamId: gs.get<string>(CONFIG_KEYS.teamId) ?? vs.get<string>('teamId'),
      enableLogging: gs.get<boolean>(CONFIG_KEYS.enableLogging) ?? vs.get<boolean>('enableLogging', true),
      isAdmin: gs.get<boolean>(CONFIG_KEYS.isAdmin) ?? vs.get<boolean>('isAdmin', false),
    };
  }

  private async saveConfig(partial: Partial<ExtensionConfig>): Promise<void> {
    const gs = this.context.globalState;

    if (partial.developerId !== undefined) {
      await gs.update(CONFIG_KEYS.developerId, partial.developerId || undefined);
    }
    if (partial.teamId !== undefined) {
      await gs.update(CONFIG_KEYS.teamId, partial.teamId || undefined);
    }
    if (partial.enableLogging !== undefined) {
      await gs.update(CONFIG_KEYS.enableLogging, partial.enableLogging);
    }
    if (partial.isAdmin !== undefined) {
      await gs.update(CONFIG_KEYS.isAdmin, partial.isAdmin);
    }

    const newConfig = this.readConfig();
    this._onDidChangeConfig.fire(newConfig);

    void this._view?.webview.postMessage({ type: 'saveResult', success: true });
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GoLogChat Settings</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
      padding: 12px;
      line-height: 1.5;
      font-size: var(--vscode-font-size);
    }
    h2 { font-size: 1.1em; margin: 0 0 12px 0; font-weight: 600; }
    .field { margin-bottom: 12px; }
    label {
      display: block;
      font-size: 0.85em;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      padding: 4px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 2px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      outline: none;
    }
    input[type="text"]:focus {
      border-color: var(--vscode-focusBorder);
    }
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .toggle-label { font-size: 0.9em; }
    input[type="checkbox"] {
      accent-color: var(--vscode-checkbox-background);
    }
    button {
      width: 100%;
      padding: 6px 14px;
      margin-top: 8px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .saved-msg {
      color: var(--vscode-testing-iconPassed);
      font-size: 0.85em;
      text-align: center;
      margin-top: 8px;
      display: none;
    }
    .desc {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <h2>Settings</h2>
  <div class="field">
    <label for="developerId">Developer ID</label>
    <input type="text" id="developerId" placeholder="e.g., john-doe" />
    <div class="desc">Your unique identifier for logging prompts</div>
  </div>
  <div class="field">
    <label for="teamId">Team ID</label>
    <input type="text" id="teamId" placeholder="e.g., platform" />
    <div class="desc">Your team identifier for access control</div>
  </div>
  <div class="field">
    <div class="toggle-row">
      <span class="toggle-label">Enable Logging</span>
      <input type="checkbox" id="enableLogging" />
    </div>
    <div class="desc">Log prompts to the GoLogChat backend</div>
  </div>
  <div class="field">
    <div class="toggle-row">
      <span class="toggle-label">Admin Mode</span>
      <input type="checkbox" id="isAdmin" />
    </div>
    <div class="desc">Enable admin access (only if authorized)</div>
  </div>
  <button id="saveBtn">Save Settings</button>
  <div class="saved-msg" id="savedMsg">Settings saved</div>
  <script>
    const vscode = acquireVsCodeApi();
    const f = {
      developerId: document.getElementById('developerId'),
      teamId: document.getElementById('teamId'),
      enableLogging: document.getElementById('enableLogging'),
      isAdmin: document.getElementById('isAdmin'),
    };
    const savedMsg = document.getElementById('savedMsg');

    vscode.postMessage({ type: 'getConfig' });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'configLoaded') {
        f.developerId.value = msg.config.developerId || '';
        f.teamId.value = msg.config.teamId || '';
        f.enableLogging.checked = msg.config.enableLogging !== false;
        f.isAdmin.checked = msg.config.isAdmin === true;
      }
      if (msg.type === 'saveResult' && msg.success) {
        savedMsg.style.display = 'block';
        setTimeout(() => { savedMsg.style.display = 'none'; }, 2000);
      }
    });

    document.getElementById('saveBtn').addEventListener('click', () => {
      vscode.postMessage({
        type: 'saveConfig',
        config: {
          developerId: f.developerId.value.trim(),
          teamId: f.teamId.value.trim(),
          enableLogging: f.enableLogging.checked,
          isAdmin: f.isAdmin.checked,
        },
      });
    });
  </script>
</body>
</html>`;
  }
}

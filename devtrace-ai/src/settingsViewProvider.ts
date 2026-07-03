import * as vscode from 'vscode';
import { ExtensionConfig, CONFIG_KEYS, API_BASE_URL } from './types';

export class SettingsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'devtraceai.settings';

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
    const vs = vscode.workspace.getConfiguration('devtraceai');
    return {
      apiUrl: API_BASE_URL,
      developerId: gs.get<string>(CONFIG_KEYS.developerId) ?? vs.get<string>('developerId'),
      orgId: gs.get<string>(CONFIG_KEYS.orgId) ?? vs.get<string>('orgId'),
      enableLogging: gs.get<boolean>(CONFIG_KEYS.enableLogging) ?? vs.get<boolean>('enableLogging', true),
      isAdmin: gs.get<boolean>(CONFIG_KEYS.isAdmin) ?? vs.get<boolean>('isAdmin', false),
      defaultProvider: gs.get<string>(CONFIG_KEYS.defaultProvider) ?? vs.get<string>('defaultProvider'),
      defaultModel: gs.get<string>(CONFIG_KEYS.defaultModel) ?? vs.get<string>('defaultModel'),
      role: (gs.get<string>(CONFIG_KEYS.role) ?? vs.get<string>('role', 'developer')) as ExtensionConfig['role'],
    };
  }

  private async saveConfig(partial: Partial<ExtensionConfig>): Promise<void> {
    const gs = this.context.globalState;

    if (partial.developerId !== undefined) {
      await gs.update(CONFIG_KEYS.developerId, partial.developerId || undefined);
    }
    if (partial.orgId !== undefined) {
      await gs.update(CONFIG_KEYS.orgId, partial.orgId || undefined);
    }
    if (partial.enableLogging !== undefined) {
      await gs.update(CONFIG_KEYS.enableLogging, partial.enableLogging);
    }
    if (partial.isAdmin !== undefined) {
      await gs.update(CONFIG_KEYS.isAdmin, partial.isAdmin);
    }
    if (partial.defaultProvider !== undefined) {
      await gs.update(CONFIG_KEYS.defaultProvider, partial.defaultProvider || undefined);
    }
    if (partial.defaultModel !== undefined) {
      await gs.update(CONFIG_KEYS.defaultModel, partial.defaultModel || undefined);
    }
    if (partial.role !== undefined) {
      await gs.update(CONFIG_KEYS.role, partial.role || undefined);
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
  <title>DevTrace AI Settings</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
      padding: 0;
      line-height: 1.5;
      font-size: var(--vscode-font-size);
    }

    .header {
      padding: 16px 14px 12px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--vscode-button-background), var(--vscode-button-hoverBackground, var(--vscode-button-background)));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: var(--vscode-button-foreground);
      flex-shrink: 0;
      font-weight: 700;
      letter-spacing: -1px;
    }
    .header-text h2 {
      font-size: 1.05em;
      font-weight: 600;
      line-height: 1.2;
    }
    .header-text .version {
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground);
    }

    .connection-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      font-size: 0.82em;
      background: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.05));
      border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .status-dot.connected { background: var(--vscode-testing-iconPassed, #4ec9b0); }
    .status-dot.disconnected { background: var(--vscode-testing-iconFailed, #f44747); }
    .status-dot.checking {
      background: var(--vscode-editorWarning-foreground, #cca700);
      animation: pulse 1s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .status-text { flex: 1; color: var(--vscode-descriptionForeground); }

    .section {
      padding: 14px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.12));
    }
    .section:last-of-type { border-bottom: none; }
    .section-title {
      font-size: 0.72em;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 10px;
    }

    .field { margin-bottom: 12px; }
    .field:last-child { margin-bottom: 0; }
    .field-label {
      display: block;
      font-size: 0.85em;
      font-weight: 500;
      margin-bottom: 4px;
    }
    input[type="text"] {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.3));
      border-radius: 4px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      outline: none;
      transition: border-color 0.15s;
    }
    input[type="text"]:focus {
      border-color: var(--vscode-focusBorder);
    }
    input[type="text"]::placeholder {
      color: var(--vscode-input-placeholderForeground, rgba(128,128,128,0.5));
    }
    select {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.3));
      border-radius: 4px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      outline: none;
      transition: border-color 0.15s;
    }
    select:focus {
      border-color: var(--vscode-focusBorder);
    }
    .field-hint {
      font-size: 0.78em;
      color: var(--vscode-descriptionForeground);
      margin-top: 3px;
      opacity: 0.85;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 0;
    }
    .toggle-row + .toggle-row {
      border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.08));
      margin-top: 2px;
      padding-top: 8px;
    }
    .toggle-info {
      flex: 1;
      margin-right: 12px;
    }
    .toggle-label {
      font-size: 0.85em;
      font-weight: 500;
      display: block;
    }
    .toggle-desc {
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground);
      margin-top: 1px;
    }

    .switch {
      position: relative;
      width: 36px;
      height: 20px;
      flex-shrink: 0;
    }
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.4));
      border-radius: 20px;
      transition: background 0.2s, border-color 0.2s;
    }
    .slider::before {
      content: '';
      position: absolute;
      height: 14px;
      width: 14px;
      left: 2px;
      bottom: 2px;
      background: var(--vscode-descriptionForeground);
      border-radius: 50%;
      transition: transform 0.2s, background 0.2s;
    }
    .switch input:checked + .slider {
      background: var(--vscode-button-background);
      border-color: var(--vscode-button-background);
    }
    .switch input:checked + .slider::before {
      transform: translateX(16px);
      background: var(--vscode-button-foreground);
    }
    .switch input:focus-visible + .slider {
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: 2px;
    }

    .actions { padding: 14px; }
    .save-btn {
      width: 100%;
      padding: 7px 14px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      font-weight: 500;
      transition: background 0.15s, opacity 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .save-btn:hover {
      background: var(--vscode-button-hoverBackground, var(--vscode-button-background));
    }
    .save-btn:active { opacity: 0.85; }
    .save-btn.saved {
      background: var(--vscode-testing-iconPassed, #4ec9b0);
      pointer-events: none;
    }

    .toast {
      position: fixed;
      bottom: 12px;
      left: 14px;
      right: 14px;
      padding: 8px 12px;
      background: var(--vscode-notificationsBackground, var(--vscode-editor-background));
      border: 1px solid var(--vscode-testing-iconPassed, #4ec9b0);
      border-radius: 6px;
      font-size: 0.82em;
      display: flex;
      align-items: center;
      gap: 6px;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.25s, transform 0.25s;
      pointer-events: none;
      z-index: 10;
    }
    .toast.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .toast-icon { color: var(--vscode-testing-iconPassed, #4ec9b0); }

    .dirty-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--vscode-editorWarning-foreground, #cca700);
      margin-left: 4px;
      vertical-align: middle;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .dirty-dot.visible { opacity: 1; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-icon">DT</div>
    <div class="header-text">
      <h2>DevTrace AI</h2>
      <span class="version">v0.1.0</span>
    </div>
  </div>

  <div class="connection-bar" id="connectionBar">
    <span class="status-dot checking" id="statusDot"></span>
    <span class="status-text" id="statusText">Checking connection...</span>
  </div>

  <div class="section">
    <div class="section-title">Identity</div>
    <div class="field">
      <label class="field-label" for="developerId">Developer ID</label>
      <input type="text" id="developerId" placeholder="e.g., john-doe" spellcheck="false" />
      <div class="field-hint">Your unique identifier for prompt attribution</div>
    </div>
    <div class="field">
      <label class="field-label" for="orgId">Organization ID</label>
      <input type="text" id="orgId" placeholder="e.g., acme-corp" spellcheck="false" />
      <div class="field-hint">Your organization — determines which org's prompts you can see</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Preferences</div>
    <div class="toggle-row">
      <div class="toggle-info">
        <span class="toggle-label">Enable Logging</span>
        <span class="toggle-desc">Automatically log prompts to the backend</span>
      </div>
      <label class="switch">
        <input type="checkbox" id="enableLogging" />
        <span class="slider"></span>
      </label>
    </div>
    <div class="toggle-row">
      <div class="toggle-info">
        <span class="toggle-label">Admin Mode</span>
        <span class="toggle-desc">View all orgs' prompts and patterns</span>
      </div>
      <label class="switch">
        <input type="checkbox" id="isAdmin" />
        <span class="slider"></span>
      </label>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Role</div>
    <div class="field">
      <label class="field-label" for="role">Your Role</label>
      <select id="role">
        <option value="developer">Developer</option>
        <option value="manager">Manager</option>
        <option value="admin">Admin</option>
      </select>
      <div class="field-hint">Managers can create teams and view team analytics</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">AI Defaults</div>
    <div class="field">
      <label class="field-label" for="defaultProvider">Default Provider</label>
      <select id="defaultProvider">
        <option value="">None</option>
        <option value="Cursor">Cursor</option>
        <option value="Claude Code">Claude Code</option>
        <option value="GitHub Copilot">GitHub Copilot</option>
        <option value="Aider">Aider</option>
        <option value="Continue">Continue</option>
        <option value="Other">Other</option>
      </select>
      <div class="field-hint">Pre-selected provider when logging prompts</div>
    </div>
    <div class="field">
      <label class="field-label" for="defaultModel">Default Model</label>
      <select id="defaultModel">
        <option value="">None</option>
        <option value="GPT-4o">GPT-4o</option>
        <option value="GPT-4">GPT-4</option>
        <option value="GPT-4o mini">GPT-4o mini</option>
        <option value="Claude Sonnet">Claude Sonnet</option>
        <option value="Claude Opus">Claude Opus</option>
        <option value="Claude Haiku">Claude Haiku</option>
        <option value="Gemini Pro">Gemini Pro</option>
        <option value="Gemini Flash">Gemini Flash</option>
        <option value="Codex">Codex</option>
        <option value="Other">Other</option>
      </select>
      <div class="field-hint">Pre-selected model when logging prompts</div>
    </div>
  </div>

  <div class="actions">
    <button class="save-btn" id="saveBtn">
      <span id="saveBtnText">Save Settings</span>
      <span class="dirty-dot" id="dirtyDot"></span>
    </button>
  </div>

  <div class="toast" id="toast">
    <span class="toast-icon">✓</span>
    <span>Settings saved successfully</span>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const f = {
      developerId: document.getElementById('developerId'),
      orgId: document.getElementById('orgId'),
      enableLogging: document.getElementById('enableLogging'),
      isAdmin: document.getElementById('isAdmin'),
      defaultProvider: document.getElementById('defaultProvider'),
      defaultModel: document.getElementById('defaultModel'),
      role: document.getElementById('role'),
    };
    const saveBtn = document.getElementById('saveBtn');
    const saveBtnText = document.getElementById('saveBtnText');
    const toast = document.getElementById('toast');
    const dirtyDot = document.getElementById('dirtyDot');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    let originalValues = {};

    vscode.postMessage({ type: 'getConfig' });

    function checkDirty() {
      const current = {
        developerId: f.developerId.value.trim(),
        orgId: f.orgId.value.trim(),
        enableLogging: f.enableLogging.checked,
        isAdmin: f.isAdmin.checked,
        defaultProvider: f.defaultProvider.value,
        defaultModel: f.defaultModel.value,
        role: f.role.value,
      };
      const dirty = JSON.stringify(current) !== JSON.stringify(originalValues);
      dirtyDot.classList.toggle('visible', dirty);
    }

    f.developerId.addEventListener('input', checkDirty);
    f.orgId.addEventListener('input', checkDirty);
    f.enableLogging.addEventListener('change', checkDirty);
    f.isAdmin.addEventListener('change', checkDirty);
    f.defaultProvider.addEventListener('change', checkDirty);
    f.defaultModel.addEventListener('change', checkDirty);
    f.role.addEventListener('change', checkDirty);

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'configLoaded') {
        f.developerId.value = msg.config.developerId || '';
        f.orgId.value = msg.config.orgId || '';
        f.enableLogging.checked = msg.config.enableLogging !== false;
        f.isAdmin.checked = msg.config.isAdmin === true;
        f.defaultProvider.value = msg.config.defaultProvider || '';
        f.defaultModel.value = msg.config.defaultModel || '';
        f.role.value = msg.config.role || 'developer';

        originalValues = {
          developerId: f.developerId.value.trim(),
          orgId: f.orgId.value.trim(),
          enableLogging: f.enableLogging.checked,
          isAdmin: f.isAdmin.checked,
          defaultProvider: f.defaultProvider.value,
          defaultModel: f.defaultModel.value,
          role: f.role.value,
        };
        dirtyDot.classList.remove('visible');

        if (msg.config.apiUrl) {
          statusText.textContent = 'Connected';
          statusDot.className = 'status-dot connected';
        }
      }
      if (msg.type === 'saveResult' && msg.success) {
        saveBtn.classList.add('saved');
        saveBtnText.textContent = '\\u2713 Saved';

        originalValues = {
          developerId: f.developerId.value.trim(),
          orgId: f.orgId.value.trim(),
          enableLogging: f.enableLogging.checked,
          isAdmin: f.isAdmin.checked,
          defaultProvider: f.defaultProvider.value,
          defaultModel: f.defaultModel.value,
          role: f.role.value,
        };
        dirtyDot.classList.remove('visible');

        toast.classList.add('visible');
        setTimeout(() => { toast.classList.remove('visible'); }, 2500);

        setTimeout(() => {
          saveBtn.classList.remove('saved');
          saveBtnText.textContent = 'Save Settings';
        }, 1500);
      }
    });

    saveBtn.addEventListener('click', () => {
      vscode.postMessage({
        type: 'saveConfig',
        config: {
          developerId: f.developerId.value.trim(),
          orgId: f.orgId.value.trim(),
          enableLogging: f.enableLogging.checked,
          isAdmin: f.isAdmin.checked,
          defaultProvider: f.defaultProvider.value || undefined,
          defaultModel: f.defaultModel.value || undefined,
          role: f.role.value || undefined,
        },
      });
    });
  </script>
</body>
</html>`;
  }
}

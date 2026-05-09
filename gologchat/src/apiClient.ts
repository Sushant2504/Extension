import { Prompt, User, PromptFilter, ExtensionConfig } from './types';

export class ApiClient {
  private baseUrl: string;
  private developerId: string;
  private teamId: string;
  private isAdmin: boolean;

  constructor(config: ExtensionConfig) {
    this.baseUrl = config.apiUrl.replace(/\/+$/, '');
    this.developerId = config.developerId ?? '';
    this.teamId = config.teamId ?? '';
    this.isAdmin = config.isAdmin;
  }

  updateConfig(config: ExtensionConfig): void {
    this.baseUrl = config.apiUrl.replace(/\/+$/, '');
    this.developerId = config.developerId ?? '';
    this.teamId = config.teamId ?? '';
    this.isAdmin = config.isAdmin;
  }

  private defaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Developer-ID': this.developerId,
      'X-Team-ID': this.teamId,
      'X-Is-Admin': String(this.isAdmin),
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: this.defaultHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed with status ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  async checkHealth(): Promise<{ status: string }> {
    return this.request('GET', '/api/health');
  }

  async createPrompt(prompt: string, response?: string): Promise<Prompt> {
    return this.request('POST', '/api/prompts', {
      prompt,
      response,
      developerId: this.developerId,
      teamId: this.teamId,
    });
  }

  async getPrompts(filter?: PromptFilter): Promise<Prompt[]> {
    const params = new URLSearchParams();
    if (filter?.developerId) { params.set('developerId', filter.developerId); }
    if (filter?.startDate) { params.set('startDate', filter.startDate); }
    if (filter?.endDate) { params.set('endDate', filter.endDate); }
    const qs = params.toString();
    const path = '/api/prompts' + (qs ? `?${qs}` : '');
    const result = await this.request<Prompt[] | null>('GET', path);
    return result ?? [];
  }

  async registerUser(): Promise<User> {
    return this.request('POST', '/api/users', {
      developerId: this.developerId,
      teamId: this.teamId,
      isAdmin: this.isAdmin,
    });
  }

  async getUser(developerId: string): Promise<User> {
    return this.request('GET', `/api/users/${encodeURIComponent(developerId)}`);
  }
}

import { Prompt, User, PromptFilter, ExtensionConfig, DeveloperPatterns, OrgAnalytics, Team } from './types';

export class ApiClient {
  private baseUrl: string;
  private developerId: string;
  private orgId: string;
  private isAdmin: boolean;

  constructor(config: ExtensionConfig) {
    this.baseUrl = config.apiUrl.replace(/\/+$/, '');
    this.developerId = config.developerId ?? '';
    this.orgId = config.orgId ?? '';
    this.isAdmin = config.isAdmin;
  }

  updateConfig(config: ExtensionConfig): void {
    this.baseUrl = config.apiUrl.replace(/\/+$/, '');
    this.developerId = config.developerId ?? '';
    this.orgId = config.orgId ?? '';
    this.isAdmin = config.isAdmin;
  }

  private defaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Developer-ID': this.developerId,
      'X-Org-ID': this.orgId,
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

  async createPrompt(
    prompt: string,
    response?: string,
    provider?: string,
    model?: string,
    language?: string,
    fileContext?: string,
    project?: string,
  ): Promise<Prompt> {
    return this.request('POST', '/api/prompts', {
      prompt,
      response,
      provider,
      model,
      language,
      fileContext,
      project,
      developerId: this.developerId,
      orgId: this.orgId,
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
      orgId: this.orgId,
      isAdmin: this.isAdmin,
    });
  }

  async getUser(developerId: string): Promise<User> {
    return this.request('GET', `/api/users/${encodeURIComponent(developerId)}`);
  }

  async updateUser(developerId: string, orgId: string, isAdmin: boolean): Promise<User> {
    return this.request('POST', '/api/users', { developerId, orgId, isAdmin });
  }

  async getOrgPatterns(): Promise<DeveloperPatterns[]> {
    const result = await this.request<DeveloperPatterns[] | null>('GET', '/api/org/patterns');
    return result ?? [];
  }

  async getOrgAnalytics(): Promise<OrgAnalytics> {
    return this.request<OrgAnalytics>('GET', '/api/org/analytics');
  }

  async updatePromptOutcome(promptId: string, outcome: 'accepted' | 'rejected' | 'edited'): Promise<Prompt> {
    return this.request('PATCH', `/api/prompts/${encodeURIComponent(promptId)}/outcome`, { outcome });
  }

  async createTeam(name: string, members: string[]): Promise<Team> {
    return this.request('POST', '/api/teams', {
      name,
      managerId: this.developerId,
      orgId: this.orgId,
      members,
    });
  }

  async listTeams(): Promise<Team[]> {
    const result = await this.request<Team[] | null>('GET', '/api/teams');
    return result ?? [];
  }

  async getTeam(id: string): Promise<Team> {
    return this.request('GET', `/api/teams/${encodeURIComponent(id)}`);
  }

  async updateTeamMembers(id: string, add: string[], remove: string[]): Promise<Team> {
    return this.request('PUT', `/api/teams/${encodeURIComponent(id)}/members`, { add, remove });
  }

  async getTeamAnalytics(teamId: string): Promise<OrgAnalytics> {
    return this.request<OrgAnalytics>('GET', `/api/teams/${encodeURIComponent(teamId)}/analytics`);
  }
}

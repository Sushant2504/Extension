export const PROVIDERS = [
  'Cursor',
  'Claude Code',
  'GitHub Copilot',
  'Aider',
  'Continue',
  'Other',
] as const;
export type Provider = typeof PROVIDERS[number];

export const MODELS = [
  'GPT-4o',
  'GPT-4',
  'GPT-4o mini',
  'Claude Sonnet',
  'Claude Opus',
  'Claude Haiku',
  'Gemini Pro',
  'Gemini Flash',
  'Codex',
  'Other',
] as const;
export type Model = typeof MODELS[number];

export interface Prompt {
  id: string;
  developerId: string;
  orgId: string;
  prompt: string;
  response?: string;
  provider?: string;
  model?: string;
  language?: string;
  fileContext?: string;
  estimatedTokens?: number;
  project?: string;
  outcome?: 'accepted' | 'rejected' | 'edited';
  outcomeTimestamp?: string;
  timestamp: string;
}

export interface User {
  developerId: string;
  orgId: string;
  isAdmin: boolean;
  role?: 'developer' | 'manager' | 'admin';
}

export const API_BASE_URL = 'https://extension-2n4y.onrender.com';

export const CONFIG_KEYS = {
  developerId: 'devtraceai.developerId',
  orgId: 'devtraceai.orgId',
  enableLogging: 'devtraceai.enableLogging',
  isAdmin: 'devtraceai.isAdmin',
  defaultProvider: 'devtraceai.defaultProvider',
  defaultModel: 'devtraceai.defaultModel',
  role: 'devtraceai.role',
} as const;

export interface ExtensionConfig {
  apiUrl: string;
  developerId?: string;
  orgId?: string;
  enableLogging: boolean;
  isAdmin: boolean;
  defaultProvider?: string;
  defaultModel?: string;
  role?: 'developer' | 'manager' | 'admin';
}

export interface PromptFilter {
  developerId?: string;
  startDate?: string;
  endDate?: string;
}

export interface PatternCount {
  pattern: string;
  count: number;
}

export interface ProviderCount {
  provider: string;
  count: number;
}

export interface ModelCount {
  model: string;
  provider: string;
  count: number;
}

export interface LanguageCount {
  language: string;
  count: number;
}

export interface RecentPromptSummary {
  id: string;
  summary: string;
  pattern: string;
  provider?: string;
  model?: string;
  timestamp: string;
}

export interface DeveloperPatterns {
  developerId: string;
  totalPrompts: number;
  lastActive: string;
  topProvider?: string;
  patterns: PatternCount[];
  recentPrompts: RecentPromptSummary[];
}

export interface OrgAnalytics {
  totalPrompts: number;
  totalEstimatedTokens: number;
  providers: ProviderCount[];
  models: ModelCount[];
  languages: LanguageCount[];
  patterns: PatternCount[];
  developers: DeveloperPatterns[];
  projects?: ProjectCount[];
  effectiveness?: ModelEffectiveness[];
}

export interface Team {
  id: string;
  name: string;
  managerId: string;
  orgId: string;
  members: string[];
  createdAt: string;
}

export interface ProjectCount {
  project: string;
  count: number;
}

export interface ModelEffectiveness {
  model: string;
  provider: string;
  total: number;
  accepted: number;
  rejected: number;
  edited: number;
  pending: number;
  acceptanceRate: number;
}

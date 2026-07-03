export interface Prompt {
  id: string;
  developerId: string;
  orgId: string;
  prompt: string;
  response?: string;
  timestamp: string;
}

export interface User {
  developerId: string;
  orgId: string;
  isAdmin: boolean;
}

export const API_BASE_URL = 'https://extension-2n4y.onrender.com';

export const CONFIG_KEYS = {
  developerId: 'devtraceai.developerId',
  orgId: 'devtraceai.orgId',
  enableLogging: 'devtraceai.enableLogging',
  isAdmin: 'devtraceai.isAdmin',
} as const;

export interface ExtensionConfig {
  apiUrl: string;
  developerId?: string;
  orgId?: string;
  enableLogging: boolean;
  isAdmin: boolean;
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

export interface RecentPromptSummary {
  id: string;
  summary: string;
  pattern: string;
  timestamp: string;
}

export interface DeveloperPatterns {
  developerId: string;
  totalPrompts: number;
  lastActive: string;
  patterns: PatternCount[];
  recentPrompts: RecentPromptSummary[];
}

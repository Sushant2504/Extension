export interface Prompt {
  id: string;
  developerId: string;
  teamId: string;
  prompt: string;
  response?: string;
  timestamp: string;
}

export interface User {
  developerId: string;
  teamId: string;
  isAdmin: boolean;
}

export interface ExtensionConfig {
  apiUrl: string;
  developerId?: string;
  teamId?: string;
  enableLogging: boolean;
  isAdmin: boolean;
}

export interface PromptFilter {
  developerId?: string;
  startDate?: string;
  endDate?: string;
}

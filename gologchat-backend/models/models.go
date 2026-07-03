package models

import "time"

type Prompt struct {
	ID               string     `json:"id"`
	DeveloperID      string     `json:"developerId"`
	OrgID            string     `json:"orgId"`
	Prompt           string     `json:"prompt"`
	Response         string     `json:"response,omitempty"`
	Provider         string     `json:"provider,omitempty"`
	Model            string     `json:"model,omitempty"`
	Language         string     `json:"language,omitempty"`
	FileContext      string     `json:"fileContext,omitempty"`
	EstimatedTokens  int        `json:"estimatedTokens,omitempty"`
	Project          string     `json:"project,omitempty"`
	Outcome          string     `json:"outcome,omitempty"`
	OutcomeTimestamp *time.Time `json:"outcomeTimestamp,omitempty"`
	Timestamp        time.Time  `json:"timestamp"`
}

type User struct {
	DeveloperID string `json:"developerId"`
	OrgID       string `json:"orgId"`
	IsAdmin     bool   `json:"isAdmin"`
	Role        string `json:"role,omitempty"`
}

type PatternCount struct {
	Pattern string `json:"pattern"`
	Count   int    `json:"count"`
}

type ProviderCount struct {
	Provider string `json:"provider"`
	Count    int    `json:"count"`
}

type ModelCount struct {
	Model    string `json:"model"`
	Provider string `json:"provider"`
	Count    int    `json:"count"`
}

type LanguageCount struct {
	Language string `json:"language"`
	Count    int    `json:"count"`
}

type RecentPromptSummary struct {
	ID        string    `json:"id"`
	Summary   string    `json:"summary"`
	Pattern   string    `json:"pattern"`
	Provider  string    `json:"provider,omitempty"`
	Model     string    `json:"model,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

type DeveloperPatterns struct {
	DeveloperID   string                `json:"developerId"`
	TotalPrompts  int                   `json:"totalPrompts"`
	LastActive    time.Time             `json:"lastActive"`
	TopProvider   string                `json:"topProvider,omitempty"`
	Patterns      []PatternCount        `json:"patterns"`
	RecentPrompts []RecentPromptSummary `json:"recentPrompts"`
}

type OrgAnalytics struct {
	TotalPrompts         int                  `json:"totalPrompts"`
	TotalEstimatedTokens int                  `json:"totalEstimatedTokens"`
	Providers            []ProviderCount      `json:"providers"`
	Models               []ModelCount         `json:"models"`
	Languages            []LanguageCount      `json:"languages"`
	Patterns             []PatternCount       `json:"patterns"`
	Developers           []DeveloperPatterns  `json:"developers"`
	Projects             []ProjectCount       `json:"projects,omitempty"`
	Effectiveness        []ModelEffectiveness `json:"effectiveness,omitempty"`
}

type Team struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	ManagerID string    `json:"managerId"`
	OrgID     string    `json:"orgId"`
	Members   []string  `json:"members"`
	CreatedAt time.Time `json:"createdAt"`
}

type ProjectCount struct {
	Project string `json:"project"`
	Count   int    `json:"count"`
}

type ModelEffectiveness struct {
	Model          string  `json:"model"`
	Provider       string  `json:"provider"`
	Total          int     `json:"total"`
	Accepted       int     `json:"accepted"`
	Rejected       int     `json:"rejected"`
	Edited         int     `json:"edited"`
	Pending        int     `json:"pending"`
	AcceptanceRate float64 `json:"acceptanceRate"`
}

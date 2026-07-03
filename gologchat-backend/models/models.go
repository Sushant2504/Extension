package models

import "time"

// Prompt represents a captured prompt from Cursor
type Prompt struct {
	ID          string    `json:"id"`
	DeveloperID string    `json:"developerId"`
	OrgID       string    `json:"orgId"`
	Prompt      string    `json:"prompt"`
	Response    string    `json:"response,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
}

// User represents a user with their role
type User struct {
	DeveloperID string `json:"developerId"`
	OrgID       string `json:"orgId"`
	IsAdmin     bool   `json:"isAdmin"`
}

type PatternCount struct {
	Pattern string `json:"pattern"`
	Count   int    `json:"count"`
}

type RecentPromptSummary struct {
	ID        string    `json:"id"`
	Summary   string    `json:"summary"`
	Pattern   string    `json:"pattern"`
	Timestamp time.Time `json:"timestamp"`
}

type DeveloperPatterns struct {
	DeveloperID   string                `json:"developerId"`
	TotalPrompts  int                   `json:"totalPrompts"`
	LastActive    time.Time             `json:"lastActive"`
	Patterns      []PatternCount        `json:"patterns"`
	RecentPrompts []RecentPromptSummary `json:"recentPrompts"`
}


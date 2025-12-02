package models

import "time"

// Prompt represents a captured prompt from Cursor
type Prompt struct {
	ID          string    `json:"id"`
	DeveloperID string    `json:"developerId"`
	TeamID      string    `json:"teamId"`
	Prompt      string    `json:"prompt"`
	Response    string    `json:"response,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
}

// User represents a user with their role
type User struct {
	DeveloperID string `json:"developerId"`
	TeamID      string `json:"teamId"`
	IsAdmin     bool   `json:"isAdmin"`
}


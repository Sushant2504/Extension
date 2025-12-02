package storage

import (
	"fmt"
	"time"

	"gologchat-backend/models"
)

// Storage interface for prompt persistence
type Storage interface {
	SavePrompt(prompt *models.Prompt) error
	GetPrompts(teamID string, developerID string, isAdmin bool, startDate, endDate *time.Time) ([]models.Prompt, error)
	GetUser(developerID string) (*models.User, error)
	SaveUser(user *models.User) error
}

// InMemoryStorage is a simple in-memory storage (can be replaced with database)
type InMemoryStorage struct {
	prompts map[string]*models.Prompt
	users   map[string]*models.User
}

func NewInMemoryStorage() *InMemoryStorage {
	return &InMemoryStorage{
		prompts: make(map[string]*models.Prompt),
		users:   make(map[string]*models.User),
	}
}

func (s *InMemoryStorage) SavePrompt(prompt *models.Prompt) error {
	s.prompts[prompt.ID] = prompt
	return nil
}

func (s *InMemoryStorage) GetPrompts(teamID string, developerID string, isAdmin bool, startDate, endDate *time.Time) ([]models.Prompt, error) {
	var results []models.Prompt
	
	for _, prompt := range s.prompts {
		// Access control: Admin sees all, others only see their team's prompts
		if !isAdmin && prompt.TeamID != teamID {
			continue
		}
		
		// Filter by developer ID if specified
		if developerID != "" && prompt.DeveloperID != developerID {
			continue
		}
		
		// Filter by date range if specified
		if startDate != nil && prompt.Timestamp.Before(*startDate) {
			continue
		}
		if endDate != nil && prompt.Timestamp.After(*endDate) {
			continue
		}
		
		results = append(results, *prompt)
	}
	
	return results, nil
}

func (s *InMemoryStorage) GetUser(developerID string) (*models.User, error) {
	user, exists := s.users[developerID]
	if !exists {
		return nil, fmt.Errorf("user not found")
	}
	return user, nil
}

func (s *InMemoryStorage) SaveUser(user *models.User) error {
	s.users[user.DeveloperID] = user
	return nil
}


package storage

import (
	"fmt"
	"sync"
	"time"

	"gologchat-backend/models"
)

type Storage interface {
	SavePrompt(prompt *models.Prompt) error
	GetPrompts(teamID string, developerID string, isAdmin bool, startDate, endDate *time.Time) ([]models.Prompt, error)
	GetPromptsByTeam(teamID string) ([]models.Prompt, error)
	GetAllPrompts() ([]models.Prompt, error)
	GetUser(developerID string) (*models.User, error)
	SaveUser(user *models.User) error
}

type InMemoryStorage struct {
	mu      sync.RWMutex
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
	s.mu.Lock()
	defer s.mu.Unlock()
	s.prompts[prompt.ID] = prompt
	return nil
}

func (s *InMemoryStorage) GetPrompts(teamID string, developerID string, isAdmin bool, startDate, endDate *time.Time) ([]models.Prompt, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []models.Prompt
	for _, prompt := range s.prompts {
		if !isAdmin && prompt.TeamID != teamID {
			continue
		}
		if developerID != "" && prompt.DeveloperID != developerID {
			continue
		}
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

func (s *InMemoryStorage) GetPromptsByTeam(teamID string) ([]models.Prompt, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []models.Prompt
	for _, prompt := range s.prompts {
		if prompt.TeamID == teamID {
			results = append(results, *prompt)
		}
	}
	return results, nil
}

func (s *InMemoryStorage) GetAllPrompts() ([]models.Prompt, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []models.Prompt
	for _, prompt := range s.prompts {
		results = append(results, *prompt)
	}
	return results, nil
}

func (s *InMemoryStorage) GetUser(developerID string) (*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	user, exists := s.users[developerID]
	if !exists {
		return nil, fmt.Errorf("user not found")
	}
	return user, nil
}

func (s *InMemoryStorage) SaveUser(user *models.User) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.users[user.DeveloperID] = user
	return nil
}

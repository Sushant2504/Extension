package storage

import (
	"fmt"
	"sync"
	"time"

	"gologchat-backend/models"
)

type Storage interface {
	SavePrompt(prompt *models.Prompt) error
	GetPrompts(orgID string, developerID string, isAdmin bool, startDate, endDate *time.Time) ([]models.Prompt, error)
	GetPromptsByOrg(orgID string) ([]models.Prompt, error)
	GetAllPrompts() ([]models.Prompt, error)
	GetPromptByID(id string) (*models.Prompt, error)
	UpdatePromptOutcome(id string, outcome string, timestamp time.Time) (*models.Prompt, error)
	GetPromptsByDeveloperIDs(developerIDs []string) ([]models.Prompt, error)
	GetUser(developerID string) (*models.User, error)
	SaveUser(user *models.User) error
	SaveTeam(team *models.Team) error
	GetTeam(id string) (*models.Team, error)
	GetTeamsByManager(managerID string) ([]models.Team, error)
	GetTeamsByMember(developerID string) ([]models.Team, error)
	UpdateTeamMembers(id string, add []string, remove []string) (*models.Team, error)
}

type InMemoryStorage struct {
	mu      sync.RWMutex
	prompts map[string]*models.Prompt
	users   map[string]*models.User
	teams   map[string]*models.Team
}

func NewInMemoryStorage() *InMemoryStorage {
	return &InMemoryStorage{
		prompts: make(map[string]*models.Prompt),
		users:   make(map[string]*models.User),
		teams:   make(map[string]*models.Team),
	}
}

func (s *InMemoryStorage) SavePrompt(prompt *models.Prompt) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.prompts[prompt.ID] = prompt
	return nil
}

func (s *InMemoryStorage) GetPrompts(orgID string, developerID string, isAdmin bool, startDate, endDate *time.Time) ([]models.Prompt, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []models.Prompt
	for _, prompt := range s.prompts {
		if !isAdmin && prompt.OrgID != orgID {
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

func (s *InMemoryStorage) GetPromptsByOrg(orgID string) ([]models.Prompt, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []models.Prompt
	for _, prompt := range s.prompts {
		if prompt.OrgID == orgID {
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

func (s *InMemoryStorage) GetPromptByID(id string) (*models.Prompt, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	prompt, exists := s.prompts[id]
	if !exists {
		return nil, fmt.Errorf("prompt not found")
	}
	return prompt, nil
}

func (s *InMemoryStorage) UpdatePromptOutcome(id string, outcome string, timestamp time.Time) (*models.Prompt, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	prompt, exists := s.prompts[id]
	if !exists {
		return nil, fmt.Errorf("prompt not found")
	}
	prompt.Outcome = outcome
	prompt.OutcomeTimestamp = &timestamp
	return prompt, nil
}

func (s *InMemoryStorage) GetPromptsByDeveloperIDs(developerIDs []string) ([]models.Prompt, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	idSet := make(map[string]bool, len(developerIDs))
	for _, id := range developerIDs {
		idSet[id] = true
	}

	var results []models.Prompt
	for _, prompt := range s.prompts {
		if idSet[prompt.DeveloperID] {
			results = append(results, *prompt)
		}
	}
	return results, nil
}

func (s *InMemoryStorage) SaveTeam(team *models.Team) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.teams[team.ID] = team
	return nil
}

func (s *InMemoryStorage) GetTeam(id string) (*models.Team, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	team, exists := s.teams[id]
	if !exists {
		return nil, fmt.Errorf("team not found")
	}
	return team, nil
}

func (s *InMemoryStorage) GetTeamsByManager(managerID string) ([]models.Team, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []models.Team
	for _, team := range s.teams {
		if team.ManagerID == managerID {
			results = append(results, *team)
		}
	}
	return results, nil
}

func (s *InMemoryStorage) GetTeamsByMember(developerID string) ([]models.Team, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []models.Team
	for _, team := range s.teams {
		if team.ManagerID == developerID {
			results = append(results, *team)
			continue
		}
		for _, m := range team.Members {
			if m == developerID {
				results = append(results, *team)
				break
			}
		}
	}
	return results, nil
}

func (s *InMemoryStorage) UpdateTeamMembers(id string, add []string, remove []string) (*models.Team, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	team, exists := s.teams[id]
	if !exists {
		return nil, fmt.Errorf("team not found")
	}

	removeSet := make(map[string]bool, len(remove))
	for _, r := range remove {
		removeSet[r] = true
	}

	var updated []string
	for _, m := range team.Members {
		if !removeSet[m] {
			updated = append(updated, m)
		}
	}

	existing := make(map[string]bool, len(updated))
	for _, m := range updated {
		existing[m] = true
	}
	for _, a := range add {
		if !existing[a] {
			updated = append(updated, a)
			existing[a] = true
		}
	}

	team.Members = updated
	return team, nil
}

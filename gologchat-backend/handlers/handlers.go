package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/google/uuid"

	"gologchat-backend/models"
	"gologchat-backend/storage"
)

// API handlers
type API struct {
	storage storage.Storage
}

func NewAPI(storage storage.Storage) *API {
	return &API{storage: storage}
}

// POST /api/prompts - Save a new prompt
func (api *API) SavePrompt(w http.ResponseWriter, r *http.Request) {
	var prompt models.Prompt
	if err := json.NewDecoder(r.Body).Decode(&prompt); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	// Generate ID and timestamp if not provided
	if prompt.ID == "" {
		prompt.ID = uuid.New().String()
	}
	if prompt.Timestamp.IsZero() {
		prompt.Timestamp = time.Now()
	}
	
	if err := api.storage.SavePrompt(&prompt); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(prompt)
}

// GET /api/prompts - Get prompts with filters
func (api *API) GetPrompts(w http.ResponseWriter, r *http.Request) {
	// Get user info from headers (set by extension)
	developerID := r.Header.Get("X-Developer-ID")
	teamID := r.Header.Get("X-Team-ID")
	isAdmin := r.Header.Get("X-Is-Admin") == "true"
	
	// Get user from storage to verify admin status
	if developerID != "" {
		user, err := api.storage.GetUser(developerID)
		if err == nil {
			teamID = user.TeamID
			isAdmin = user.IsAdmin
		}
	}
	
	// Parse query parameters
	query := r.URL.Query()
	filterDeveloperID := query.Get("developerId")
	
	var startDate, endDate *time.Time
	if startStr := query.Get("startDate"); startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			startDate = &t
		}
	}
	if endStr := query.Get("endDate"); endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			endDate = &t
		}
	}
	
	prompts, err := api.storage.GetPrompts(teamID, filterDeveloperID, isAdmin, startDate, endDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(prompts)
}

// POST /api/users - Register or update a user
func (api *API) SaveUser(w http.ResponseWriter, r *http.Request) {
	var user models.User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	if err := api.storage.SaveUser(&user); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// GET /api/users/:id - Get user info
func (api *API) GetUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	developerID := vars["id"]
	
	user, err := api.storage.GetUser(developerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// GET /api/team/patterns - Get team working patterns
func (api *API) GetTeamPatterns(w http.ResponseWriter, r *http.Request) {
	teamID := r.Header.Get("X-Team-ID")
	isAdmin := r.Header.Get("X-Is-Admin") == "true"

	developerID := r.Header.Get("X-Developer-ID")
	if developerID != "" {
		user, err := api.storage.GetUser(developerID)
		if err == nil {
			teamID = user.TeamID
			isAdmin = user.IsAdmin
		}
	}

	if teamID == "" && !isAdmin {
		http.Error(w, "teamId is required", http.StatusBadRequest)
		return
	}

	prompts, err := api.storage.GetPromptsByTeam(teamID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	results := aggregatePatterns(prompts)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// Health check endpoint
func (api *API) Health(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}


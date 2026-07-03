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

	if prompt.EstimatedTokens == 0 {
		charCount := len(prompt.Prompt) + len(prompt.Response)
		prompt.EstimatedTokens = (charCount + 3) / 4
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
	orgID := r.Header.Get("X-Org-ID")
	isAdmin := r.Header.Get("X-Is-Admin") == "true"

	// Get user from storage to verify admin status
	if developerID != "" {
		user, err := api.storage.GetUser(developerID)
		if err == nil {
			orgID = user.OrgID
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

	prompts, err := api.storage.GetPrompts(orgID, filterDeveloperID, isAdmin, startDate, endDate)
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

// GET /api/org/patterns - Get org working patterns
func (api *API) GetOrgPatterns(w http.ResponseWriter, r *http.Request) {
	orgID := r.Header.Get("X-Org-ID")
	isAdmin := r.Header.Get("X-Is-Admin") == "true"

	developerID := r.Header.Get("X-Developer-ID")
	if developerID != "" {
		user, err := api.storage.GetUser(developerID)
		if err == nil {
			orgID = user.OrgID
			isAdmin = user.IsAdmin
		}
	}

	if orgID == "" && !isAdmin {
		http.Error(w, "orgId is required", http.StatusBadRequest)
		return
	}

	var prompts []models.Prompt
	var err error
	if isAdmin {
		prompts, err = api.storage.GetAllPrompts()
	} else {
		prompts, err = api.storage.GetPromptsByOrg(orgID)
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	results := aggregatePatterns(prompts)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func (api *API) GetOrgAnalytics(w http.ResponseWriter, r *http.Request) {
	orgID := r.Header.Get("X-Org-ID")
	isAdmin := r.Header.Get("X-Is-Admin") == "true"

	developerID := r.Header.Get("X-Developer-ID")
	if developerID != "" {
		user, err := api.storage.GetUser(developerID)
		if err == nil {
			orgID = user.OrgID
			isAdmin = user.IsAdmin
		}
	}

	if orgID == "" && !isAdmin {
		http.Error(w, "orgId is required", http.StatusBadRequest)
		return
	}

	var prompts []models.Prompt
	var err error
	if isAdmin {
		prompts, err = api.storage.GetAllPrompts()
	} else {
		prompts, err = api.storage.GetPromptsByOrg(orgID)
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	analytics := aggregateAnalytics(prompts)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analytics)
}

// PATCH /api/prompts/:id/outcome - Record accept/reject/edit feedback
func (api *API) UpdatePromptOutcome(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var body struct {
		Outcome string `json:"outcome"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if body.Outcome != "accepted" && body.Outcome != "rejected" && body.Outcome != "edited" {
		http.Error(w, "outcome must be one of: accepted, rejected, edited", http.StatusBadRequest)
		return
	}

	prompt, err := api.storage.UpdatePromptOutcome(id, body.Outcome, time.Now())
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(prompt)
}

func (api *API) Health(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}


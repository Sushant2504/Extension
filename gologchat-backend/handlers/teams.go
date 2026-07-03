package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"gologchat-backend/models"
)

func (api *API) CreateTeam(w http.ResponseWriter, r *http.Request) {
	var team models.Team
	if err := json.NewDecoder(r.Body).Decode(&team); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if team.Name == "" || team.ManagerID == "" {
		http.Error(w, "name and managerId are required", http.StatusBadRequest)
		return
	}

	callerID := r.Header.Get("X-Developer-ID")
	if callerID != "" {
		user, err := api.storage.GetUser(callerID)
		if err == nil && !user.IsAdmin && user.Role != "manager" && user.Role != "admin" {
			http.Error(w, "only managers and admins can create teams", http.StatusForbidden)
			return
		}
	}

	team.ID = uuid.New().String()
	team.CreatedAt = time.Now()
	if team.Members == nil {
		team.Members = []string{}
	}

	if err := api.storage.SaveTeam(&team); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(team)
}

func (api *API) ListTeams(w http.ResponseWriter, r *http.Request) {
	developerID := r.Header.Get("X-Developer-ID")
	if developerID == "" {
		http.Error(w, "X-Developer-ID header is required", http.StatusBadRequest)
		return
	}

	teams, err := api.storage.GetTeamsByMember(developerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if teams == nil {
		teams = []models.Team{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(teams)
}

func (api *API) GetTeam(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	team, err := api.storage.GetTeam(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(team)
}

func (api *API) UpdateTeamMembers(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var body struct {
		Add    []string `json:"add"`
		Remove []string `json:"remove"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	team, err := api.storage.GetTeam(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	callerID := r.Header.Get("X-Developer-ID")
	isAuthorized := callerID == team.ManagerID
	if !isAuthorized && callerID != "" {
		user, err := api.storage.GetUser(callerID)
		if err == nil && (user.IsAdmin || user.Role == "admin") {
			isAuthorized = true
		}
	}
	if !isAuthorized {
		http.Error(w, "only the team manager or an admin can update members", http.StatusForbidden)
		return
	}

	updated, err := api.storage.UpdateTeamMembers(id, body.Add, body.Remove)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func (api *API) GetTeamAnalytics(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	team, err := api.storage.GetTeam(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	allMembers := make([]string, 0, len(team.Members)+1)
	allMembers = append(allMembers, team.ManagerID)
	allMembers = append(allMembers, team.Members...)

	prompts, err := api.storage.GetPromptsByDeveloperIDs(allMembers)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	analytics := aggregateAnalytics(prompts)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analytics)
}

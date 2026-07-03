package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gorilla/mux"

	"gologchat-backend/handlers"
	"gologchat-backend/middleware"
	"gologchat-backend/storage"
)

func main() {
	storage := storage.NewInMemoryStorage()
	api := handlers.NewAPI(storage)

	router := mux.NewRouter()

	// Enable CORS
	router.Use(middleware.CORS)

	// API routes
	router.HandleFunc("/api/health", api.Health).Methods("GET")
	router.HandleFunc("/api/prompts", api.SavePrompt).Methods("POST")
	router.HandleFunc("/api/prompts", api.GetPrompts).Methods("GET")
	router.HandleFunc("/api/users", api.SaveUser).Methods("POST")
	router.HandleFunc("/api/users/{id}", api.GetUser).Methods("GET")
	router.HandleFunc("/api/org/patterns", api.GetOrgPatterns).Methods("GET")
	router.HandleFunc("/api/org/analytics", api.GetOrgAnalytics).Methods("GET")
	router.HandleFunc("/api/prompts/{id}/outcome", api.UpdatePromptOutcome).Methods("PATCH")
	router.HandleFunc("/api/teams", api.CreateTeam).Methods("POST")
	router.HandleFunc("/api/teams", api.ListTeams).Methods("GET")
	router.HandleFunc("/api/teams/{id}", api.GetTeam).Methods("GET")
	router.HandleFunc("/api/teams/{id}/members", api.UpdateTeamMembers).Methods("PUT")
	router.HandleFunc("/api/teams/{id}/analytics", api.GetTeamAnalytics).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, router))
}

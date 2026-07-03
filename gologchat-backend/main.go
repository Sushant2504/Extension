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
	router.HandleFunc("/api/team/patterns", api.GetTeamPatterns).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, router))
}

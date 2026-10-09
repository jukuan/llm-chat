package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type App struct {
	FrontDir   string
	ContextDir string
	OllamaURL  string
	GitHistory bool
	Context    *ContextStore
}

func (a *App) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/health", a.handleHealth)
	mux.HandleFunc("/api/tags", a.handleTags)
	mux.HandleFunc("/api/chat", a.handleChat)
	mux.HandleFunc("/api/context/preview", a.handleContextPreview)
	mux.HandleFunc("/api/context/files", a.handleListFiles)
	mux.HandleFunc("/api/context/file", a.handleFile)
	mux.HandleFunc("/api/learn", a.handleLearn)
	mux.Handle("/", http.FileServer(http.Dir(a.FrontDir)))
}

func (a *App) handleListFiles(w http.ResponseWriter, r *http.Request) {
	writeCORS(w, "GET, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	files, err := a.Context.List()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if files == nil {
		files = []FileInfo{}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"files": files})
}

func (a *App) handleFile(w http.ResponseWriter, r *http.Request) {
	writeCORS(w, "GET, PUT, DELETE, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	name := r.URL.Query().Get("name")

	switch r.Method {
	case http.MethodGet:
		content, err := a.Context.Read(name)
		if err != nil {
			http.Error(w, "not found: "+err.Error(), http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"name":    name,
			"content": content,
		})

	case http.MethodPut:
		var body struct {
			Name    string `json:"name"`
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json: "+err.Error(), http.StatusBadRequest)
			return
		}
		if body.Name == "" {
			body.Name = name
		}
		if err := a.Context.Write(body.Name, body.Content); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "name": body.Name})

	case http.MethodDelete:
		if err := a.Context.Delete(name); err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *App) handleLearn(w http.ResponseWriter, r *http.Request) {
	writeCORS(w, "POST, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		File string `json:"file"`
		Text string `json:"text"`
		By   string `json:"by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json: "+err.Error(), http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(body.Text) == "" {
		http.Error(w, "empty text", http.StatusBadRequest)
		return
	}
	if body.File == "" {
		body.File = "learned.md"
	}
	stamp := time.Now().Format(time.RFC3339)
	who := body.By
	if who == "" {
		who = "someone"
	}
	entry := fmt.Sprintf("- _%s, added by %s_ — %s", stamp, who, strings.TrimSpace(body.Text))
	if err := a.Context.Append(body.File, entry); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "file": body.File})
}

func writeCORS(w http.ResponseWriter, methods string) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", methods)
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

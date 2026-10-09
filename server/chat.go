package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Model    string        `json:"model"`
	Role     string        `json:"role"`
	Messages []ChatMessage `json:"messages"`
}

func (a *App) handleChat(w http.ResponseWriter, r *http.Request) {
	writeCORS(w, "POST, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json: "+err.Error(), http.StatusBadRequest)
		return
	}

	ctx, _ := a.Context.Load()
	sys := buildSystemPrompt(req.Role, ctx)

	out := []ChatMessage{{Role: "system", Content: sys}}
	for _, m := range req.Messages {
		if m.Role == "system" {
			continue
		}
		out = append(out, m)
	}

	body := map[string]any{
		"model":    req.Model,
		"messages": out,
		"stream":   true,
	}
	payload, _ := json.Marshal(body)

	upReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost,
		a.OllamaURL+"/api/chat", strings.NewReader(string(payload)))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	upReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(upReq)
	if err != nil {
		http.Error(w, "ollama: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		w.WriteHeader(resp.StatusCode)
		_, _ = w.Write(b)
		return
	}

	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)

	flusher, _ := w.(http.Flusher)
	buf := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				return
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
		if err != nil {
			break
		}
	}
}

func (a *App) handleTags(w http.ResponseWriter, r *http.Request) {
	writeCORS(w, "GET, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	resp, err := http.Get(a.OllamaURL + "/api/tags")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	_, _ = io.Copy(w, resp.Body)
}

func (a *App) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeCORS(w, "GET, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"ok":true}`))
}

func (a *App) handleContextPreview(w http.ResponseWriter, r *http.Request) {
	writeCORS(w, "GET, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	role := r.URL.Query().Get("role")
	ctx, _ := a.Context.Load()
	sys := buildSystemPrompt(role, ctx)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"role":   role,
		"system": sys,
	})
}

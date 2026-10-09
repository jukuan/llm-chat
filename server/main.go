package main

import (
	"flag"
	"log"
	"net/http"
	"os"

	_ "github.com/joho/godotenv/autoload"
)

func main() {
	addrDefault   := getenv("ADDR", ":8283")
	frontDefault  := getenv("FRONT_DIR", "../front")
	ctxDefault    := getenv("CONTEXT_DIR", "context")
	ollamaDefault := getenv("OLLAMA_URL", "http://127.0.0.1:11434")

	addr    := flag.String("addr", addrDefault, "bind address")
	front   := flag.String("front", frontDefault, "static frontend directory")
	ctxDir  := flag.String("context", ctxDefault, "markdown context directory")
	ollama  := flag.String("ollama", ollamaDefault, "Ollama base URL")
	gitHist := flag.Bool("git-history", false, "commit context changes to git")
	flag.Parse()

	if err := os.MkdirAll(*ctxDir, 0o755); err != nil {
		log.Fatalf("context dir: %v", err)
	}

	app := &App{
		FrontDir:   *front,
		ContextDir: *ctxDir,
		OllamaURL:  *ollama,
		GitHistory: *gitHist,
		Context:    NewContextStore(*ctxDir, *gitHist),
	}

	mux := http.NewServeMux()
	app.Register(mux)

	log.Printf("Frontend:    %s", app.FrontDir)
	log.Printf("Context dir: %s", app.ContextDir)
	log.Printf("Ollama:      %s", app.OllamaURL)
	log.Printf("  local:   http://127.0.0.1%s", *addr)
	if ip := lanIP(); ip != "" {
		log.Printf("  network: http://%s%s", ip, *addr)
	}
	log.Fatal(http.ListenAndServe(*addr, mux))
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

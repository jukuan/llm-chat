package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

type ContextStore struct {
	dir        string
	gitHistory bool
	mu         sync.Mutex
}

func NewContextStore(dir string, gitHistory bool) *ContextStore {
	return &ContextStore{dir: dir, gitHistory: gitHistory}
}

type FileInfo struct {
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	Modified string `json:"modified"`
}

func (s *ContextStore) List() ([]FileInfo, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []FileInfo{}, nil
		}
		return nil, err
	}
	var out []FileInfo
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		n := e.Name()
		if !strings.HasSuffix(strings.ToLower(n), ".md") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, FileInfo{
			Name:     n,
			Size:     info.Size(),
			Modified: info.ModTime().Format("2006-01-02 15:04"),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

func (s *ContextStore) Read(name string) (string, error) {
	path, err := safeName(s.dir, name)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (s *ContextStore) Write(name, content string) error {
	path, err := safeName(s.dir, name)
	if err != nil {
		return err
	}
	s.mu.Lock()
	err = os.WriteFile(path, []byte(content), 0o644)
	s.mu.Unlock()
	if err != nil {
		return err
	}
	s.maybeCommit("write", filepath.Base(path))
	return nil
}

func (s *ContextStore) Delete(name string) error {
	path, err := safeName(s.dir, name)
	if err != nil {
		return err
	}
	s.mu.Lock()
	err = os.Remove(path)
	s.mu.Unlock()
	if err != nil {
		return err
	}
	s.maybeCommit("delete", filepath.Base(path))
	return nil
}

func (s *ContextStore) Append(name, text string) error {
	path, err := safeName(s.dir, name)
	if err != nil {
		return err
	}
	s.mu.Lock()
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		s.mu.Unlock()
		return err
	}
	_, err = f.WriteString(text + "\n")
	f.Close()
	s.mu.Unlock()
	if err != nil {
		return err
	}
	s.maybeCommit("append", filepath.Base(path))
	return nil
}

// Load concatenates every loadable .md file as "## Title\n\nContent".
// Files starting with "_" or "." are skipped (e.g. _issues.md).
func (s *ContextStore) Load() (string, error) {
	files, err := s.List()
	if err != nil {
		return "", err
	}
	var b strings.Builder
	for _, f := range files {
		n := f.Name
		if strings.HasPrefix(n, "_") || strings.HasPrefix(n, ".") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.dir, n))
		if err != nil {
			continue
		}
		content := strings.TrimSpace(string(data))
		if content == "" {
			continue
		}

		title := strings.TrimSuffix(n, filepath.Ext(n))
		title = strings.ReplaceAll(title, "-", " ")
		title = strings.ReplaceAll(title, "_", " ")
		title = titleCase(title)

		fmt.Fprintf(&b, "## %s\n\n%s\n\n", title, content)
	}
	return strings.TrimSpace(b.String()), nil
}

func (s *ContextStore) maybeCommit(action, file string) {
	if !s.gitHistory {
		return
	}
	go gitCommit(s.dir, "context: "+action+" "+file)
}

// safeName validates a filename and returns the full path inside dir.
func safeName(dir, name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", fmt.Errorf("empty name")
	}
	if strings.ContainsAny(name, `/\`) || strings.Contains(name, "..") {
		return "", fmt.Errorf("invalid name")
	}
	if !strings.HasSuffix(strings.ToLower(name), ".md") {
		name += ".md"
	}
	return filepath.Join(dir, name), nil
}

func titleCase(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		r := []rune(w)
		if len(r) == 0 {
			continue
		}
		words[i] = strings.ToUpper(string(r[0])) + string(r[1:])
	}
	return strings.Join(words, " ")
}

func gitCommit(dir, msg string) {
	if _, err := os.Stat(filepath.Join(dir, ".git")); err != nil {
		return
	}
	_ = exec.Command("git", "-C", dir, "add", "-A").Run()
	_ = exec.Command("git", "-C", dir, "commit", "-m", msg, "--no-verify").Run()
}

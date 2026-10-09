# server up
curl http://127.0.0.1:8283/api/health
# → {"ok":true}

# model list proxied from Ollama
curl http://127.0.0.1:8283/api/tags | head -c 200

# write a context file
curl -X PUT http://127.0.0.1:8283/api/context/file \
  -H 'Content-Type: application/json' \
  -d '{"name":"wifi.md","content":"# WiFi\n\nNetwork: HomeSweet\nPassword: sunny-2024"}'

# read it back
curl 'http://127.0.0.1:8283/api/context/file?name=wifi.md'

# see what the model would be told (debug)
curl 'http://127.0.0.1:8283/api/context/preview?role=kid'

// Fetch wrappers for the Go server. All endpoints live under one origin.

export const HOST = location.hostname || '127.0.0.1';
export const SERVER = `http://${HOST}:8283`;

async function jsonOrThrow(res) {
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const t = await res.text(); if (t) msg += `: ${t.trim()}`; } catch {}
        throw new Error(msg);
    }
    return res.json();
}

export async function health() {
    const res = await fetch(SERVER + '/api/health');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
}

export async function listFiles() {
    return jsonOrThrow(await fetch(SERVER + '/api/context/files'));
}

export async function readFile(name) {
    const url = SERVER + '/api/context/file?name=' + encodeURIComponent(name);
    return jsonOrThrow(await fetch(url));
}

export async function writeFile(name, content) {
    return jsonOrThrow(await fetch(SERVER + '/api/context/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content }),
    }));
}

export async function deleteFile(name) {
    const url = SERVER + '/api/context/file?name=' + encodeURIComponent(name);
    return jsonOrThrow(await fetch(url, { method: 'DELETE' }));
}

export async function learn(file, text, by) {
    return jsonOrThrow(await fetch(SERVER + '/api/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, text, by }),
    }));
}

export async function listModels() {
    return jsonOrThrow(await fetch(SERVER + '/api/tags'));
}

export async function previewContext(role) {
    return jsonOrThrow(await fetch(SERVER + '/api/context/preview?role=' + encodeURIComponent(role)));
}

// Stream chat from the Go server. Resolves when the stream ends.
// onChunk(text) is called as tokens arrive.
export async function streamChat({ model, role, messages, signal, onChunk }) {
    const res = await fetch(SERVER + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, role, messages }),
        signal,
    });

    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${txt.trim()}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let full = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line) continue;
            let obj;
            try { obj = JSON.parse(line); } catch { continue; }
            if (obj.error) throw new Error(obj.error);
            if (obj.message && obj.message.content) {
                full += obj.message.content;
                if (onChunk) onChunk(obj.message.content, full);
            }
        }
    }
    return full;
}

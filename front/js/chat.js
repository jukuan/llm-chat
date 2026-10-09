import * as api from './api.js';
import { t } from './i18n.js';

const LS_HISTORY = 'houseChat.history.';

export function createChat({ logEl, inputEl, sendBtn, statusEl, clearBtn, getRole, getModel }) {
    let history = [];
    let role = 'father';
    let busy = false;
    let abort = null;

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function loadHistory(r) {
        try { return JSON.parse(localStorage.getItem(LS_HISTORY + r) || '[]'); }
        catch { return []; }
    }

    function saveHistory() {
        localStorage.setItem(LS_HISTORY + role, JSON.stringify(history));
    }

    function renderMarkdown(text) {
        if (!text) return '';
        if (window.marked && window.DOMPurify) {
            return window.DOMPurify.sanitize(window.marked.parse(text));
        }
        // Fallback: escape and show as plain text
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
    }

    function addBubble(kind, text, opts = {}) {
        const el = document.createElement('div');
        el.className = 'bubble ' + (kind === 'user' ? 'user' : 'assistant');

        const who = document.createElement('span');
        who.className = 'who';
        const label = document.createElement('span');
        label.textContent = kind === 'user' ? '👤' : '🏠 House Assistant';
        who.appendChild(label);

        const body = document.createElement('div');
        body.className = 'body';

        if (kind === 'user') {
            body.textContent = text;
        } else if (opts.typing) {
            body.textContent = text || '';
            body.classList.add('typing');
        } else {
            body.innerHTML = renderMarkdown(text);
        }

        if (kind === 'assistant') {
            const tools = document.createElement('span');
            tools.className = 'tools';

            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.title = t('copy');
            copyBtn.textContent = '📋';
            copyBtn.onclick = () => {
                const raw = body.dataset.raw || body.textContent || '';
                navigator.clipboard.writeText(raw).then(() => {
                    copyBtn.textContent = '✓';
                    setTimeout(() => { copyBtn.textContent = '📋'; }, 1000);
                });
            };
            tools.appendChild(copyBtn);

            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.title = t('saveToContext');
            saveBtn.textContent = '📌';
            saveBtn.onclick = () => saveToContext(body.dataset.raw || body.textContent || '');
            tools.appendChild(saveBtn);

            who.appendChild(tools);
        }

        el.appendChild(who);
        el.appendChild(body);
        logEl.appendChild(el);
        logEl.scrollTop = logEl.scrollHeight;
        return { el, body };
    }

    async function saveToContext(rawText) {
        let name = prompt(t('savePromptFile'), 'learned.md');
        if (!name) return;
        if (!name.endsWith('.md')) name += '.md';

        let text = prompt(t('savePromptText'), rawText.slice(0, 400));
        if (!text) return;

        try {
            await api.learn(name, text, role);
            setStatus(t('statusSavedTo') + ' ' + name);
        } catch (e) {
            setStatus(t('statusSaveFailed') + ' ' + e.message);
        }
    }

    function renderHistory() {
        logEl.innerHTML = '';
        if (history.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = '💬';
            logEl.appendChild(empty);
            return;
        }
        for (const m of history) {
            if (m.role === 'assistant') {
                const { body } = addBubble('assistant', m.content);
                body.dataset.raw = m.content;
            } else {
                addBubble('user', m.content);
            }
        }
    }

    async function send() {
        if (busy) return;
        const text = inputEl.value.trim();
        if (!text) return;
        const model = getModel();
        if (!model) { setStatus(t('statusSaveFailed')); return; }

        inputEl.value = '';
        autosize();
        history.push({ role: 'user', content: text });
        saveHistory();
        renderHistory();
        setStatus(t('statusThinking'));

        const { body } = addBubble('assistant', '', { typing: true });
        busy = true;
        sendBtn.textContent = t('stop');
        sendBtn.disabled = false;

        abort = new AbortController();
        let acc = '';

        try {
            await api.streamChat({
                model,
                role,
                messages: history,
                signal: abort.signal,
                onChunk: (_chunk, full) => {
                    acc = full;
                    body.textContent = acc;
                    logEl.scrollTop = logEl.scrollHeight;
                },
            });
        } catch (e) {
            if (e.name === 'AbortError') {
                acc += (acc ? '\n\n' : '') + '_\\[stopped\\]_';
            } else {
                acc += (acc ? '\n\n' : '') + '⚠ ' + e.message;
            }
        } finally {
            body.classList.remove('typing');
            if (acc) {
                body.innerHTML = renderMarkdown(acc);
                body.dataset.raw = acc;
                history.push({ role: 'assistant', content: acc });
                saveHistory();
            } else {
                body.parentElement && body.parentElement.remove();
            }
            busy = false;
            sendBtn.textContent = t('send');
            abort = null;
            setStatus(t('statusReady'));
            inputEl.focus();
        }
    }

    function stop() {
        if (abort) abort.abort();
    }

    function clear() {
        if (!confirm(t('clearChatConfirm'))) return;
        history = [];
        saveHistory();
        renderHistory();
        setStatus(t('statusCleared'));
    }

    function autosize() {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
    }

    function setRole(newRole) {
        if (busy) return;
        saveHistory();
        role = newRole;
        history = loadHistory(role);
        renderHistory();
    }

    function rerender() {
        // Re-translate tools buttons labels on existing bubbles
        renderHistory();
        setStatus(t('statusReady'));
    }

    // Wire events
    sendBtn.addEventListener('click', () => { busy ? stop() : send(); });
    inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!busy) send();
        }
    });
    inputEl.addEventListener('input', autosize);
    clearBtn.addEventListener('click', clear);

    // Init
    role = getRole();
    history = loadHistory(role);
    renderHistory();
    autosize();

    return { setRole, send, stop, clear, rerender };
}

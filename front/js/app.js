import * as api from './api.js';
import { initLanguage, setLanguage, applyTranslations, t, getLanguage, onLanguageChange } from './i18n.js';
import { createChat } from './chat.js';
import { createContext } from './context.js';

const LS_ROLE  = 'houseChat.role';
const LS_MODEL = 'houseChat.model';
const HEALTH_INTERVAL = 5000;

let currentRole  = localStorage.getItem(LS_ROLE)  || 'father';
let currentModel = localStorage.getItem(LS_MODEL) || '';

// ---------- Element refs ----------
const el = {
    log:            document.getElementById('log'),
    input:          document.getElementById('input'),
    send:           document.getElementById('send'),
    status:         document.getElementById('status'),
    clearChat:      document.getElementById('clearChat'),
    modelSel:       document.getElementById('modelSelect'),
    roleBar:        document.getElementById('roleBar'),
    langToggle:     document.getElementById('langToggle'),
    offlineBanner:  document.getElementById('offlineBanner'),

    contextForm:    document.getElementById('contextForm'),
    contextRaw:     document.getElementById('contextRaw'),
    fileList:       document.getElementById('fileList'),
    fileName:       document.getElementById('fileName'),
    fileContent:    document.getElementById('fileContent'),
    saveFileBtn:    document.getElementById('saveFileBtn'),
    deleteFileBtn:  document.getElementById('deleteFileBtn'),
    newFileBtn:     document.getElementById('newFileBtn'),
    editorStatus:   document.getElementById('editorStatus'),
};

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t === tab));
        const name = tab.dataset.tab;
        document.querySelectorAll('.tab-panel').forEach(p => {
            p.hidden = p.dataset.panel !== name;
        });
        if (name === 'context') ctx.loadForm();
        if (name === 'chat')    el.input.focus();
    });
});

// ---------- Context mode toggle (form / raw) ----------
document.querySelectorAll('.mode-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-toggle').forEach(b => b.classList.toggle('is-active', b === btn));
        const mode = btn.dataset.mode;
        el.contextForm.hidden = mode !== 'form';
        el.contextRaw.hidden  = mode !== 'raw';
        if (mode === 'form') ctx.loadForm();
        if (mode === 'raw')  ctx.loadFileList();
    });
});

// ---------- Chat module ----------
const chat = createChat({
    logEl:   el.log,
    inputEl: el.input,
    sendBtn: el.send,
    statusEl: el.status,
    clearBtn: el.clearChat,
    getRole:  () => currentRole,
    getModel: () => currentModel,
});

// ---------- Context module ----------
const ctx = createContext({
    formEl:        el.contextForm,
    rawEl:         el.contextRaw,
    fileListEl:    el.fileList,
    fileNameIn:    el.fileName,
    fileContentIn: el.fileContent,
    saveFileBtn:   el.saveFileBtn,
    deleteFileBtn: el.deleteFileBtn,
    newFileBtn:    el.newFileBtn,
    editorStatus:  el.editorStatus,
    getRole:       () => currentRole,
});

// ---------- Role bar ----------
function renderRoleBar() {
    el.roleBar.querySelectorAll('[data-role]').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.role === currentRole);
    });
}

el.roleBar.addEventListener('click', e => {
    const btn = e.target.closest('[data-role]');
    if (!btn) return;
    const newRole = btn.dataset.role;
    if (newRole === currentRole) return;
    currentRole = newRole;
    localStorage.setItem(LS_ROLE, currentRole);
    renderRoleBar();
    chat.setRole(currentRole);
});

// ---------- Models ----------
async function loadModels() {
    el.modelSel.disabled = true;
    el.modelSel.innerHTML = '<option>…</option>';
    try {
        const data = await api.listModels();
        const chatModels = (data.models || []).filter(m => {
            const caps = m.capabilities || [];
            return caps.length === 0 || caps.includes('completion');
        });
        if (chatModels.length === 0) {
            el.modelSel.innerHTML = '<option>no chat models</option>';
            return;
        }
        const isCoder = n => /coder|deepseek/i.test(n);
        const general = chatModels.filter(m => !isCoder(m.name));
        const coders  = chatModels.filter(m =>  isCoder(m.name));

        el.modelSel.innerHTML = '';
        const addGroup = (label, arr) => {
            if (!arr.length) return;
            const g = document.createElement('optgroup');
            g.label = label;
            for (const m of arr) {
                const opt = document.createElement('option');
                opt.value = m.name;
                opt.textContent = `${m.name} · ${(m.size / 1e9).toFixed(1)} GB`;
                g.appendChild(opt);
            }
            el.modelSel.appendChild(g);
        };
        addGroup('General', general);
        addGroup('Code', coders);

        const names = chatModels.map(m => m.name);
        if (names.includes(currentModel)) {
            el.modelSel.value = currentModel;
        } else {
            currentModel = names.find(n => /^llama3\.1:8b/.test(n))
                || general[0]?.name
                || chatModels[0].name;
            el.modelSel.value = currentModel;
            localStorage.setItem(LS_MODEL, currentModel);
        }
        el.modelSel.disabled = false;
    } catch (e) {
        el.modelSel.innerHTML = '<option>failed</option>';
        el.status.textContent = '⚠ ' + e.message;
    }
}

el.modelSel.addEventListener('change', () => {
    currentModel = el.modelSel.value;
    localStorage.setItem(LS_MODEL, currentModel);
});

// ---------- Health polling / offline banner ----------
let offline = false;

async function checkHealth() {
    try {
        await api.health();
        if (offline) {
            offline = false;
            el.offlineBanner.hidden = true;
            el.input.disabled = false;
            el.send.disabled = false;
        }
    } catch {
        if (!offline) {
            offline = true;
            el.offlineBanner.hidden = false;
            el.offlineBanner.textContent = t('offlineBanner');
            el.input.disabled = true;
            el.input.placeholder = t('offlinePlaceholder');
            el.send.disabled = true;
        }
    }
}

// ---------- Language ----------
function renderLangButtons() {
    const lang = getLanguage();
    el.langToggle.querySelectorAll('button').forEach(b => {
        b.classList.toggle('is-active', b.dataset.lang === lang);
    });
}

el.langToggle.addEventListener('click', async e => {
    const btn = e.target.closest('[data-lang]');
    if (!btn) return;
    await setLanguage(btn.dataset.lang);
});

onLanguageChange(() => {
    applyTranslations();
    renderLangButtons();
    chat.rerender();
    ctx.rerender();
    if (offline) {
        el.offlineBanner.textContent = t('offlineBanner');
        el.input.placeholder = t('offlinePlaceholder');
    }
});

// ---------- Service worker (best-effort) ----------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Expected on http://<lan-ip>: only localhost or HTTPS works.
        });
    });
}

// ---------- Boot ----------
(async function boot() {
    await initLanguage();
    applyTranslations();
    renderLangButtons();
    renderRoleBar();

    await loadModels();
    await checkHealth();
    setInterval(checkHealth, HEALTH_INTERVAL);

    // Context loads lazily when the tab is opened, but load once now so the
    // first "Other files" list is populated.
    ctx.loadForm().catch(() => {});

    ctx.loadFileList().catch(() => {});
})();

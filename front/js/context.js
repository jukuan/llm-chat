import * as api from './api.js';
import { t } from './i18n.js';
import { SECTIONS } from './sections.js';

const SAVE_DEBOUNCE = 1200;

export function createContext({ formEl, rawEl, fileListEl, fileNameIn, fileContentIn,
                                  saveFileBtn, deleteFileBtn, newFileBtn, editorStatus,
                                  getRole }) {

    // ---------- Form view ----------
    let formState = {};   // { key: { content, timer, statusEl } }
    let otherFiles = [];

    function setEditorStatus(text) { editorStatus.textContent = text; }

    function sectionLabel(s, lang) {
        return s[lang] || s.en || s.key;
    }

    function buildForm() {
        formEl.innerHTML = '';
        formState = {};

        for (const s of SECTIONS) {
            formEl.appendChild(buildSectionCard(s));
        }

        // "Other files" section for anything not in SECTIONS
        const knownKeys = new Set(SECTIONS.map(s => s.key));
        otherFiles = otherFiles.filter(f => {
            const base = f.name.replace(/\.md$/i, '');
            return !knownKeys.has(base) && !base.startsWith('_') && !base.startsWith('.');
        });

        if (otherFiles.length > 0) {
            const wrap = document.createElement('div');
            wrap.className = 'section-card';
            const h = document.createElement('h3');
            h.textContent = '📁 ' + t('otherSection');
            wrap.appendChild(h);
            const list = document.createElement('div');
            for (const f of otherFiles) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'file-item';
                btn.textContent = f.name;
                btn.onclick = () => switchToRawAndOpen(f.name);
                list.appendChild(btn);
            }
            wrap.appendChild(list);
            formEl.appendChild(wrap);
        }
    }

    function buildSectionCard(section) {
        const card = document.createElement('div');
        card.className = 'section-card';
        card.dataset.key = section.key;

        const h = document.createElement('h3');
        h.textContent = section.icon + ' ' + (section.en || section.key);
        card.appendChild(h);

        const hint = document.createElement('p');
        hint.className = 'hint';
        hint.textContent = (section.hint && section.hint.en) || '';
        card.appendChild(hint);

        const ta = document.createElement('textarea');
        ta.rows = 5;
        ta.placeholder = t('emptySectionHint');
        card.appendChild(ta);

        const row = document.createElement('div');
        row.className = 'save-row';
        const status = document.createElement('span');
        status.className = 'meta';
        row.appendChild(status);
        card.appendChild(row);

        const state = {
            content: '',
            section,
            ta,
            hintEl: hint,
            titleEl: h,
            statusEl: status,
            timer: null,
        };

        ta.addEventListener('input', () => {
            state.content = ta.value;
            clearTimeout(state.timer);
            state.statusEl.textContent = t('saving');
            state.timer = setTimeout(() => saveSection(section.key), SAVE_DEBOUNCE);
        });

        formState[section.key] = state;
        return card;
    }

    async function saveSection(key) {
        const state = formState[key];
        if (!state) return;
        const section = state.section;
        const body = state.content.replace(/^\s+|\s+$/g, '');
        const content = body
            ? `# ${section.en}\n\n${body}\n`
            : '';

        try {
            await api.writeFile(section.key + '.md', content);
            state.statusEl.textContent = t('savedAt') + ' ' + new Date().toLocaleTimeString();
        } catch (e) {
            state.statusEl.textContent = t('saveError') + ' ' + e.message;
        }
    }

    // Strip a leading "# Heading\n\n" line when loading, since the form shows
    // its own header. Keeps the on-disk format markdown-friendly.
    function stripHeading(content) {
        return content.replace(/^#\s+[^\n]*\n+/, '');
    }

    async function loadForm() {
        let files = [];
        try {
            const data = await api.listFiles();
            files = data.files || [];
        } catch (e) {
            formEl.innerHTML = '<p class="meta">⚠ ' + e.message + '</p>';
            return;
        }
        otherFiles = files;

        buildForm();

        for (const section of SECTIONS) {
            const match = files.find(f => f.name === section.key + '.md');
            if (!match) continue;
            try {
                const data = await api.readFile(match.name);
                const state = formState[section.key];
                if (!state) continue;
                state.content = stripHeading(data.content || '');
                state.ta.value = state.content;
                state.statusEl.textContent = t('savedAt') + ' ' + match.modified;
            } catch (e) {
                // ignore per-file errors
            }
        }
    }

    // ---------- Raw view ----------
    let currentFile = null;
    let editorDirty = false;

    async function loadFileList() {
        fileListEl.innerHTML = '<span class="meta">…</span>';
        try {
            const data = await api.listFiles();
            const files = data.files || [];
            if (files.length === 0) {
                fileListEl.innerHTML = '<span class="meta">' + t('noFiles') + '</span>';
                return;
            }
            fileListEl.innerHTML = '';
            for (const f of files) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'file-item';
                if (f.name === currentFile) btn.classList.add('is-active');
                btn.innerHTML = f.name + '<span class="meta">' + (f.size/1024).toFixed(1) + ' KB · ' + f.modified + '</span>';
                btn.onclick = () => openFile(f.name);
                fileListEl.appendChild(btn);
            }
        } catch (e) {
            fileListEl.innerHTML = '<span class="meta">⚠ ' + e.message + '</span>';
        }
    }

    async function openFile(name) {
        if (editorDirty && !confirm('Discard unsaved changes?')) return;
        try {
            const data = await api.readFile(name);
            currentFile = data.name;
            fileNameIn.value = data.name;
            fileContentIn.value = data.content;
            editorDirty = false;
            setEditorStatus('');
            loadFileList();
        } catch (e) {
            setEditorStatus('⚠ ' + e.message);
        }
    }

    async function saveCurrentFile() {
        let name = fileNameIn.value.trim();
        if (!name) { setEditorStatus('⚠ filename required'); return; }
        if (!name.endsWith('.md')) name += '.md';
        try {
            const res = await api.writeFile(name, fileContentIn.value);
            currentFile = res.name;
            fileNameIn.value = res.name;
            editorDirty = false;
            setEditorStatus(t('savedAt') + ' ' + new Date().toLocaleTimeString());
            loadFileList();
        } catch (e) {
            setEditorStatus(t('saveError') + ' ' + e.message);
        }
    }

    async function deleteCurrentFile() {
        if (!currentFile) { setEditorStatus('⚠ no file selected'); return; }
        if (!confirm(t('confirmDelete') + ' (' + currentFile + ')')) return;
        try {
            await api.deleteFile(currentFile);
            currentFile = null;
            fileNameIn.value = '';
            fileContentIn.value = '';
            editorDirty = false;
            setEditorStatus('');
            loadFileList();
        } catch (e) {
            setEditorStatus('⚠ ' + e.message);
        }
    }

    function newFile() {
        if (editorDirty && !confirm('Discard unsaved changes?')) return;
        const n = prompt(t('filenamePlaceholder'), '');
        if (!n) return;
        fileNameIn.value = n.endsWith('.md') ? n : n + '.md';
        fileContentIn.value = '';
        currentFile = null;
        editorDirty = true;
        setEditorStatus('');
        fileContentIn.focus();
    }

    function switchToRawAndOpen(name) {
        // Called from form view "Other files" list.
        document.querySelectorAll('.mode-toggle').forEach(b => {
            b.classList.toggle('is-active', b.dataset.mode === 'raw');
        });
        formEl.hidden = true;
        rawEl.hidden = false;
        openFile(name);
    }

    // Events
    fileContentIn.addEventListener('input', () => { editorDirty = true; });
    fileNameIn.addEventListener('input',    () => { editorDirty = true; });
    fileContentIn.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            saveCurrentFile();
        }
    });
    saveFileBtn.addEventListener('click', saveCurrentFile);
    deleteFileBtn.addEventListener('click', deleteCurrentFile);
    newFileBtn.addEventListener('click', newFile);

    function rerender() {
        // Called when language changes — rebuild the form labels but keep content.
        const snapshot = {};
        for (const [k, s] of Object.entries(formState)) snapshot[k] = s.content;
        buildForm();
        for (const [k, v] of Object.entries(snapshot)) {
            const st = formState[k];
            if (!st) continue;
            st.content = v;
            st.ta.value = v;
        }
        loadFileList();
    }

    return { loadForm, loadFileList, rerender, saveCurrentFile };
}

// Tiny translation layer.
// - First visit: navigator.language startsWith 'be' → Belarusian, else English.
// - User choice persists in localStorage under 'houseChat.lang'.
// - Missing key falls back to English, then to the key itself.

const LS_LANG = 'houseChat.lang';

let currentLang = 'en';
let dict = {};
let fallback = {};
const listeners = new Set();

export function t(key) {
    return dict[key] ?? fallback[key] ?? key;
}

export function getLanguage() {
    return currentLang;
}

export function onLanguageChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

async function loadDict(lang) {
    const res = await fetch('/i18n/' + lang + '.json');
    if (!res.ok) throw new Error('cannot load ' + lang);
    return res.json();
}

export async function setLanguage(lang) {
    if (lang !== 'en' && lang !== 'be') lang = 'en';

    if (!fallback || Object.keys(fallback).length === 0) {
        fallback = await loadDict('en');
    }

    try {
        dict = lang === 'en' ? fallback : await loadDict(lang);
    } catch {
        dict = fallback;
        lang = 'en';
    }

    currentLang = lang;
    localStorage.setItem(LS_LANG, lang);
    document.documentElement.lang = lang;

    for (const cb of listeners) {
        try { cb(lang); } catch {}
    }
}

export async function initLanguage() {
    const saved = localStorage.getItem(LS_LANG);
    if (saved) {
        await setLanguage(saved);
        return;
    }
    const nav = (navigator.language || 'en').toLowerCase();
    await setLanguage(nav.startsWith('be') ? 'be' : 'en');
}

// Apply translations to all elements with data-i18n / data-i18n-placeholder.
export function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
}

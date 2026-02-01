import type { ThemeName } from '@/types/theme';

export type ThemeDefaultMode = 'last' | 'fixed';

const SESSION_THEME_PREFIX = 'fangyu-theme-session:';
const PROJECT_THEME_PREFIX = 'fangyu-theme-project:';
const DEFAULT_THEME_MODE_KEY = 'fangyu-theme-default-mode';
const DEFAULT_THEME_KEY = 'fangyu-theme-default';
const LAST_THEME_KEY = 'fangyu-theme-last';
const LEGACY_THEME_KEY = 'fangyu-theme';

const VALID_THEMES: ThemeName[] = ['deep-glass-pro', 'deep-glass-scifi'];

function isValidTheme(value: string | null | undefined): value is ThemeName {
  if (!value) return false;
  return VALID_THEMES.includes(value as ThemeName);
}

export function normalizeProjectPath(path?: string | null): string | null {
  if (!path) return null;
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '').trim();
  return normalized ? normalized.toLowerCase() : null;
}

function projectKey(projectPath?: string | null): string | null {
  const normalized = normalizeProjectPath(projectPath);
  if (!normalized) return null;
  return `${PROJECT_THEME_PREFIX}${encodeURIComponent(normalized)}`;
}

function sessionKey(sessionId?: string | null): string | null {
  if (!sessionId) return null;
  return `${SESSION_THEME_PREFIX}${sessionId}`;
}

export function getSessionThemePreference(params: {
  sessionId?: string | null;
  projectPath?: string | null;
}): ThemeName | null {
  const sessionStorageKey = sessionKey(params.sessionId);
  if (sessionStorageKey) {
    const stored = localStorage.getItem(sessionStorageKey);
    if (isValidTheme(stored)) return stored;
  }

  const projectStorageKey = projectKey(params.projectPath);
  if (projectStorageKey) {
    const stored = localStorage.getItem(projectStorageKey);
    if (isValidTheme(stored)) return stored;
  }

  return null;
}

export function setSessionThemePreference(
  params: { sessionId?: string | null; projectPath?: string | null },
  themeName: ThemeName,
) {
  const sessionStorageKey = sessionKey(params.sessionId);
  if (sessionStorageKey) {
    localStorage.setItem(sessionStorageKey, themeName);
  }

  const projectStorageKey = projectKey(params.projectPath);
  if (projectStorageKey) {
    localStorage.setItem(projectStorageKey, themeName);
  }
}

export function getDefaultThemeMode(): ThemeDefaultMode {
  const stored = localStorage.getItem(DEFAULT_THEME_MODE_KEY);
  if (stored === 'fixed') return 'fixed';
  return 'last';
}

export function setDefaultThemeMode(mode: ThemeDefaultMode) {
  localStorage.setItem(DEFAULT_THEME_MODE_KEY, mode);
}

export function getDefaultTheme(): ThemeName {
  const mode = getDefaultThemeMode();
  if (mode === 'fixed') {
    const stored = localStorage.getItem(DEFAULT_THEME_KEY);
    if (isValidTheme(stored)) {
      return stored;
    }
  }

  const last = getLastTheme();
  if (last) return last;
  return 'deep-glass-pro';
}

export function setDefaultTheme(themeName: ThemeName) {
  localStorage.setItem(DEFAULT_THEME_KEY, themeName);
}

export function getLastTheme(): ThemeName | null {
  const stored = localStorage.getItem(LAST_THEME_KEY);
  if (isValidTheme(stored)) return stored;

  const legacy = localStorage.getItem(LEGACY_THEME_KEY);
  if (isValidTheme(legacy)) return legacy;
  return null;
}

export function setLastTheme(themeName: ThemeName) {
  localStorage.setItem(LAST_THEME_KEY, themeName);
  localStorage.setItem(LEGACY_THEME_KEY, themeName);
}


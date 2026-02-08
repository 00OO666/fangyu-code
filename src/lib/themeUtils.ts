import type { Theme, ThemeName } from "@/types/theme";

const DARK_THEMES: ThemeName[] = ["deep-glass-pro", "deep-glass-scifi"];

export function isDarkThemeName(name?: ThemeName | null): boolean {
  if (!name) return false;
  return DARK_THEMES.includes(name);
}

export function isDarkTheme(theme?: Theme | null): boolean {
  if (!theme) return false;
  return isDarkThemeName(theme.name);
}

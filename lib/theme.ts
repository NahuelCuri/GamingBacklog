// Shared with the legacy app: same key and values ('dark' | 'light'), so the
// user's choice carries over and both apps can read/write it safely.
export const THEME_KEY = "backlog:theme";

export type ThemeMode = "dark" | "light";

export function readTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {}
}

// Runs in <head> before first paint so there is no dark→light flash.
export const themeInitScript = `try{if(localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)})==='light')document.documentElement.dataset.theme='light'}catch(e){}`;

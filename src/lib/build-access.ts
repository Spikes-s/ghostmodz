// Per-session Build Mode access flag (cleared on browser close / new session).
const KEY = "ghost.build.access.v1";

export function hasBuildAccess(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function grantBuildAccess() {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function revokeBuildAccess() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

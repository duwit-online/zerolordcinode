// Native platform detection. Capacitor injects a global only inside the native shell.
declare global { interface Window { Capacitor?: any } }

export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = window.Capacitor;
  return !!(cap?.isNativePlatform?.() || cap?.platform === "android" || cap?.platform === "ios");
}

export function nativePlatform(): "android" | "ios" | "web" {
  if (typeof window === "undefined") return "web";
  const cap = window.Capacitor;
  const p = cap?.getPlatform?.() || cap?.platform;
  return p === "android" || p === "ios" ? p : "web";
}

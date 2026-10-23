/**
 * Reports sent from this browser, kept in localStorage so a Reporter without an email or
 * account can find their Tracking Links again at /me. Storage can be missing or blocked
 * (private windows, cleared site data), so every read and write tolerates failure.
 */

export interface DeviceReport {
  code: string;
  token: string;
  savedAt: string;
}

const KEY = "sumbong:reports";
const MAX = 50;
const CHANGE_EVENT = "sumbong:reports-changed";

function isDeviceReport(value: unknown): value is DeviceReport {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === "string" && typeof v.token === "string" && typeof v.savedAt === "string";
}

export function readDeviceReports(): DeviceReport[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isDeviceReport).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(reports: DeviceReport[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(reports.slice(0, MAX)));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage unavailable: the done screen still shows the link to copy.
  }
}

export function saveDeviceReport(code: string, token: string) {
  const rest = readDeviceReports().filter((r) => r.code !== code);
  write([{ code, token, savedAt: new Date().toISOString() }, ...rest]);
}

export function forgetDeviceReport(code: string) {
  write(readDeviceReports().filter((r) => r.code !== code));
}

/** For useSyncExternalStore: changes from this tab and from other tabs. */
export function subscribeDeviceReports(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Raw stored string, stable between changes, as the useSyncExternalStore snapshot. */
export function deviceReportsSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

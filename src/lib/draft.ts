/**
 * An unfinished Report kept on this device, so a reload or a dropped connection doesn't lose
 * the pin, answers and photos. Fields go to localStorage and photos to IndexedDB (Blobs are
 * too big for localStorage). The email is never saved: phones are often shared.
 * Storage can be missing or blocked, so every call tolerates failure and the form works without it.
 */

export interface DraftFields {
  step: string;
  location: { lat: number; lng: number } | null;
  landmark: string;
  categoryId: string | null;
  answers: Record<string, string>;
  title: string;
  description: string;
}

export interface Draft extends DraftFields {
  photos: Blob[];
}

const KEY = "sumbong:draft";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DB_NAME = "sumbong";
const STORE = "draft";
const PHOTOS = "photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function loadDraft(): Promise<Draft | null> {
  let fields: (DraftFields & { savedAt: number }) | null = null;
  try {
    fields = JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
  if (!fields || typeof fields !== "object" || typeof fields.savedAt !== "number") return null;
  if (Date.now() - fields.savedAt > MAX_AGE_MS) {
    await clearDraft();
    return null;
  }

  let photos: Blob[] = [];
  try {
    const stored = await withStore<unknown>("readonly", (store) => store.get(PHOTOS));
    if (Array.isArray(stored)) photos = stored.filter((p): p is Blob => p instanceof Blob);
  } catch {
    // No IndexedDB: restore the fields without photos.
  }

  return {
    step: typeof fields.step === "string" ? fields.step : "location",
    location: fields.location ?? null,
    landmark: fields.landmark ?? "",
    categoryId: fields.categoryId ?? null,
    answers: fields.answers ?? {},
    title: fields.title ?? "",
    description: fields.description ?? "",
    photos,
  };
}

export function saveDraftFields(fields: DraftFields) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...fields, savedAt: Date.now() }));
  } catch {
    // Storage full or blocked: nothing to do.
  }
}

export async function saveDraftPhotos(photos: Blob[]) {
  try {
    await withStore("readwrite", (store) => store.put(photos, PHOTOS));
  } catch {
    // No IndexedDB: photos just aren't kept across a reload.
  }
}

export async function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  try {
    await withStore("readwrite", (store) => store.delete(PHOTOS));
  } catch {
    // ignore
  }
}

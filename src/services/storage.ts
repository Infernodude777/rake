const STORAGE_PREFIX = 'rake_';

function getStorageKey(userId: string | null, collection: string): string {
  const scope = userId || 'anonymous';
  return `${STORAGE_PREFIX}${scope}_${collection}`;
}

export function getData<T>(userId: string | null, collection: string, defaultValue: T): T {
  try {
    const key = getStorageKey(userId, collection);
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function setData<T>(userId: string | null, collection: string, data: T): void {
  try {
    const key = getStorageKey(userId, collection);
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

export function removeData(userId: string | null, collection: string): void {
  const key = getStorageKey(userId, collection);
  localStorage.removeItem(key);
}

export function clearAllUserData(userId: string | null): void {
  const scope = userId || 'anonymous';
  const prefix = `${STORAGE_PREFIX}${scope}_`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

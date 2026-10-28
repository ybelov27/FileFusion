/*
 * Hands files dropped on the landing page over to the converter page.
 * Uses IndexedDB, which can store File objects as-is.
 */

const DB = "filefusion";
const STORE = "handoff";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const request = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
}

export const handoff = {
  async put(files: FileList | File[]): Promise<void> {
    await tx("readwrite", (s) => s.put(Array.from(files), "files"));
  },
  async take(): Promise<File[]> {
    try {
      const files = (await tx("readonly", (s) => s.get("files"))) as
        File[] | undefined;
      await tx("readwrite", (s) => s.delete("files"));
      return files ?? [];
    } catch {
      return [];
    }
  },
};

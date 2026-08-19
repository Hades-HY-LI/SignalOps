const DATABASE_NAME = "signalops-workspace-v2";
const STORE_NAME = "requirement-attachments";
const DATABASE_VERSION = 1;

function openAttachmentDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    return Promise.reject(
      new Error("IndexedDB is not available in this environment."),
    );
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME))
        database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open attachment storage."));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openAttachmentDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(
        transaction.error ??
          new Error("Attachment storage transaction failed."),
      );
    };
    transaction.onabort = () => {
      database.close();
      reject(
        request.error ??
          transaction.error ??
          new Error("Attachment storage transaction was aborted."),
      );
    };
  });
}

export function putAttachment(storageKey: string, blob: Blob) {
  return withStore<IDBValidKey>("readwrite", (store) =>
    store.put(blob, storageKey),
  );
}
export function getAttachment(storageKey: string) {
  return withStore<Blob | undefined>("readonly", (store) =>
    store.get(storageKey),
  );
}
export function deleteAttachment(storageKey: string) {
  return withStore<undefined>("readwrite", (store) => store.delete(storageKey));
}
export function clearAttachments() {
  return withStore<undefined>("readwrite", (store) => store.clear());
}

/**
 * Opens a connection to the BalatroCacheDB database.
 * @returns {Promise<IDBDatabase>}
 */
async function openGameDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("BalatroCacheDB", 1);

        request.onupgradeneeded = () => {
            request.result.createObjectStore("cache");
        };

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);
        
        // Handle cases where another tab or connection is blocking a version change.
        // This is important for robustness, especially if other tabs might be open.
        request.onblocked = () => {
             console.error("Database open blocked, likely by another tab. Please close other tabs and try again.");
        };
    });
}

/**
 * Loads a cached game from IndexedDB.
 * @param {string} key
 * @returns {Promise<any | null>}
 */
async function loadCachedGame(key = "vanilla") {
    const db = await openGameDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("cache", "readonly");
        const store = transaction.objectStore("cache");
        const getReq = store.get(key);

        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => reject(getReq.error);

        // Crucially, close the database *only* after the transaction is complete.
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => db.close();
        transaction.onabort = () => db.close();
    });
}

/**
 * Saves a game to cache in IndexedDB.
 * @param {Blob} blob
 * @param {string} key
 * @returns {Promise<void>}
 */
async function saveGameToCache(blob, key = "vanilla") {
    const db = await openGameDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("cache", "readwrite");
        const store = transaction.objectStore("cache");
        const putReq = store.put(blob, key);

        putReq.onerror = () => reject(putReq.error);
        
        // Resolve only when the entire transaction completes successfully.
        transaction.oncomplete = () => {
            db.close();
            resolve();
        };

        // Reject if the transaction is aborted or errors.
        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
        transaction.onabort = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

/**
 * Deletes a cached game from IndexedDB.
 * @param {string} key
 * @returns {Promise<void>}
 */
async function deleteCachedGame(key) {
    const db = await openGameDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("cache", "readwrite");
        const store = transaction.objectStore("cache");
        const deleteReq = store.delete(key);

        deleteReq.onerror = () => reject(deleteReq.error);

        transaction.oncomplete = () => {
            db.close();
            resolve();
        };
        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
        transaction.onabort = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

/**
 * Lists all cached versions from IndexedDB.
 * @returns {Promise<IDBValidKey[]>}
 */
async function listCachedVersions() {
    const db = await openGameDB();
    return new Promise((res, rej) => {
        const found_keys = [];
        const transaction = db.transaction("cache", "readonly");
        const store = transaction.objectStore("cache");
        const cursorReq = store.openCursor();

        cursorReq.onsuccess = (evt) => {
            const cursor = evt.target.result;
            if (cursor) {
                found_keys.push(cursor.key);
                cursor.continue();
            }
        };
        cursorReq.onerror = () => rej(cursorReq.error);
        
        transaction.oncomplete = () => {
            db.close();
            res(found_keys);
        };
        transaction.onerror = () => {
            db.close();
            rej(transaction.error);
        };
        transaction.onabort = () => {
            db.close();
            rej(transaction.error);
        };
    });
}


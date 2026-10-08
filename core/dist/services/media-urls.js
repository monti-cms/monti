/**
 * Finds the registered media file a public URL belongs to. A public URL is the media store's base followed by the storage key, so the key is what follows
 * the base; the file is the ready one stored under it. A URL outside the store, or one no ready file holds, is not in the result.
 */
export const mediaUrlResolver = (store, mediaStore) => async (urls) => {
    const found = new Map();
    try {
        const media = mediaStore();
        // The base of the public URLs: what `getPublicUrl` puts in front of a key.
        const probe = "k";
        const base = media.getPublicUrl(probe).slice(0, -probe.length);
        const keyOf = new Map();
        for (const url of urls)
            if (url.startsWith(base) && url.length > base.length)
                keyOf.set(url, url.slice(base.length));
        if (keyOf.size === 0)
            return found;
        const rows = await store().findReadyMediaByStorageKeys({ keys: [...new Set(keyOf.values())] });
        const idByKey = new Map(rows.map((row) => [row.storageKey, row.id]));
        for (const [url, key] of keyOf) {
            const id = idByKey.get(key);
            if (id)
                found.set(url, id);
        }
    }
    catch {
        // No media store or no database: the URLs stay as written.
    }
    return found;
};

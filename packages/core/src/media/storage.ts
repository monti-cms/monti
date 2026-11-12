import { isMediaKey } from "./accept";

/**
 * Where the media files are (doc 09, principle 6): a plugin hands one to the site, and without one the library says so. Keys are the server's, written
 * once and never changed: a replaced file gets a new key, so no cache keeps showing the old picture.
 */
export type Storage = {
	put(key: string, bytes: Uint8Array, meta: { mime: string }): Promise<void>;
	/** What is known without reading the file; `null` when there is no such key. */
	stat(key: string): Promise<{ size: number; mime: string } | null>;
	read(key: string): Promise<{ bytes: Uint8Array; mime: string } | null>;
	remove(key: string): Promise<void>;
	/** The address the admin and the site load the file from. */
	url(key: string): string;
	/**
	 * The file's first bytes, at most `length` of them: what the type check reads (`HEAD_BYTES`), without fetching the whole file. A storage
	 * without it is read whole.
	 */
	readStart?(key: string, length: number): Promise<Uint8Array | null>;
	/**
	 * Where a browser sends a file's bytes straight to the storage (doc 20, the direct way up): an address signed for one `PUT` of this key,
	 * with the headers that request must carry. The signature binds the key, the type and the size, so the address takes nothing else. A
	 * storage without it takes files through the site (`PUT …/media/bytes`).
	 */
	ticket?(key: string, file: { mime: string; size: number }): Promise<UploadTicket>;
	/**
	 * `"folder"` when the files are on this machine's disk (`localFolderStorage`): `monti doctor` says so on a host that keeps no disk. Other
	 * storages leave it out.
	 */
	kind?: "folder";
};

/** A signed address for one upload. Nothing is added to `url`: a changed address is one the storage refuses. */
export type UploadTicket = { url: string; headers: Record<string, string> };

/** Files in memory, for tests and Storybook: in a browser a key's address is an object URL, so the picture really loads. */
export function memoryStorage(options: { url?: (key: string) => string } = {}): Storage {
	const files = new Map<string, { bytes: Uint8Array; mime: string; url?: string }>();
	return {
		async put(key, bytes, { mime }) {
			if (!isMediaKey(key)) throw new Error(`"${key}" is no media key.`);
			const url =
				"document" in globalThis ? URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mime })) : undefined;
			files.set(key, { bytes, mime, url });
		},
		async stat(key) {
			const file = files.get(key);
			return file ? { size: file.bytes.length, mime: file.mime } : null;
		},
		async read(key) {
			const file = files.get(key);
			return file ? { bytes: file.bytes, mime: file.mime } : null;
		},
		async remove(key) {
			const url = files.get(key)?.url;
			if (url) URL.revokeObjectURL(url);
			files.delete(key);
		},
		url: (key) => options.url?.(key) ?? files.get(key)?.url ?? `/media/${key}`,
	};
}

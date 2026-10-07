import type { Cms } from "../../cms";
import type { PluginCollection } from "../../plugin/storage";

/**
 * What an import remembers, so running it again updates entries instead of duplicating them.
 *
 * It lives in the **plugin storage of the database** (`cms.storage("monti-import")`), not in a file next to the posts: the memory belongs to the entries it
 * points to. A second database (a staging copy) starts with no memory and imports everything, a restored backup brings the memory back with the entries, and two
 * people running the import from different checkouts do not each keep a file that disagrees with the database.
 *
 * - `files`, keyed by the path of the source file relative to the working directory: the entry it became, a hash of what was imported, whether it was published,
 *   and the version the entry had when the import left it (a different version later means somebody edited the entry in the CMS).
 * - `media`, keyed by the SHA-256 of an image file: the media item it was uploaded as, so the same image is never uploaded twice.
 */

export const IMPORT_STORAGE = "monti-import";

export interface FileRecord {
	readonly entryId: string;
	/** The id of the translation group (the id of the source entry): what a link to the post points to. */
	readonly groupId: string;
	readonly collection: string;
	readonly locale: string;
	readonly slug: string;
	/** Hash of the file and of the mapping it was read with. */
	readonly hash: string;
	readonly published: boolean;
	/** The version of the entry after the last import wrote it. */
	readonly version: number;
	readonly importedAt: string;
}

export interface MediaRecord {
	readonly mediaId: string;
	readonly filename: string;
	readonly byteSize: number;
}

export interface ImportState {
	file(key: string): Promise<FileRecord | undefined>;
	putFile(key: string, record: FileRecord): Promise<void>;
	media(sha: string): Promise<MediaRecord | undefined>;
	putMedia(sha: string, record: MediaRecord): Promise<void>;
}

async function put<T>(collection: PluginCollection<T>, key: string, value: T): Promise<void> {
	const current = await collection.get(key);
	await collection.set(key, value, { expectedVersion: current?.version ?? 0 });
}

export function importState(cms: Cms): ImportState {
	const storage = cms.storage(IMPORT_STORAGE);
	const files = storage.collection<FileRecord>("files");
	const media = storage.collection<MediaRecord>("media");
	return {
		file: async (key) => (await files.get(key))?.value,
		putFile: (key, record) => put(files, key, record),
		media: async (sha) => (await media.get(sha))?.value,
		putMedia: (sha, record) => put(media, sha, record),
	};
}

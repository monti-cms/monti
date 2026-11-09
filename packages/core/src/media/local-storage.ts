import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isMediaKey } from "./accept";
import type { Storage } from "./storage";

const missing = (error: unknown) => error instanceof Error && "code" in error && error.code === "ENOENT";

/**
 * Media files in a folder on disk, for the dev server (doc 09): the bytes under the key, the MIME type next to them. The admin API serves them
 * (`GET …/media/files/<key>`), and `base` is where it is mounted. A live site uses a storage plugin of its own (T102).
 */
export function localFolderStorage({ dir, base = "/admin/api" }: { dir: string; base?: string }): Storage {
	const fileOf = (key: string) => {
		if (!isMediaKey(key)) throw new Error(`"${key}" is no media key.`);
		return path.join(dir, key);
	};
	const mimeOf = (key: string) => `${fileOf(key)}.mime`;
	return {
		async put(key, bytes, { mime }) {
			await mkdir(dir, { recursive: true });
			await writeFile(fileOf(key), bytes);
			await writeFile(mimeOf(key), mime);
		},
		async stat(key) {
			try {
				const [info, mime] = await Promise.all([stat(fileOf(key)), readFile(mimeOf(key), "utf8")]);
				return { size: info.size, mime };
			} catch (error) {
				if (missing(error)) return null;
				throw error;
			}
		},
		async read(key) {
			try {
				const [bytes, mime] = await Promise.all([readFile(fileOf(key)), readFile(mimeOf(key), "utf8")]);
				return { bytes, mime };
			} catch (error) {
				if (missing(error)) return null;
				throw error;
			}
		},
		async remove(key) {
			await Promise.all([rm(fileOf(key), { force: true }), rm(mimeOf(key), { force: true })]);
		},
		url: (key) => `${base}/media/files/${key}`,
	};
}

import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MediaAdapter, MediaStore } from "@monti-cms/core/adapters";

/**
 * The media storage of the flows' app copy: files on disk under `.flows-files`, uploaded and read through the app's own `/flows-files/<key>` route
 * (`app/flows-files/[...key]/route.ts`). The example's demo storage refuses uploads, and a flow has no S3 bucket. Never used outside `pnpm flows`.
 */
export const FILES_DIR = path.join(process.cwd(), ".flows-files");

const fileOf = (key: string) => {
	const file = path.resolve(FILES_DIR, key);
	if (!file.startsWith(`${FILES_DIR}${path.sep}`)) throw new Error(`flows storage: ${key} is outside the files folder`);
	return file;
};
const typeOf = async (key: string) =>
	(await readFile(`${fileOf(key)}.type`, "utf8").catch(() => "")) || "application/octet-stream";

export function flowsStorage(): MediaAdapter {
	const head = async (key: string) => {
		const info = await stat(fileOf(key)).catch(() => null);
		return info ? { key, contentType: await typeOf(key), contentLength: info.size, lastModified: info.mtime } : null;
	};
	return {
		name: "flows-disk",
		createStore: (): MediaStore => ({
			prepareUpload: async (input) => ({
				url: `/flows-files/${input.stagingKey}`,
				method: "PUT",
				requiredHeaders: { "Content-Type": input.contentType },
				expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
			}),
			headFile: ({ key }) => head(key),
			readFile: async ({ key }) => new Uint8Array(await readFile(fileOf(key))),
			promoteFile: async ({ stagingKey, finalKey, contentType }) => {
				await mkdir(path.dirname(fileOf(finalKey)), { recursive: true });
				await rename(fileOf(stagingKey), fileOf(finalKey));
				await rm(`${fileOf(stagingKey)}.type`, { force: true });
				await writeFile(`${fileOf(finalKey)}.type`, contentType);
				const promoted = await head(finalKey);
				if (!promoted) throw new Error(`flows storage: ${finalKey} is missing after the move`);
				return promoted;
			},
			deleteFile: async ({ key }) => {
				await rm(fileOf(key), { force: true });
				await rm(`${fileOf(key)}.type`, { force: true });
			},
			getPublicUrl: (key) => `/flows-files/${key}`,
		}),
	};
}

/** Writes an upload's body (the route's PUT). */
export async function putFile(key: string, body: ArrayBuffer, contentType: string): Promise<void> {
	await mkdir(path.dirname(fileOf(key)), { recursive: true });
	await writeFile(fileOf(key), new Uint8Array(body));
	await writeFile(`${fileOf(key)}.type`, contentType);
}

/** Reads a file and its type (the route's GET), or `null`. */
export async function getFile(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
	const body = await readFile(fileOf(key)).catch(() => null);
	return body ? { body: new Uint8Array(body), contentType: await typeOf(key) } : null;
}

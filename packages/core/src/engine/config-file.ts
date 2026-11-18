import { readFile, writeFile } from "node:fs/promises";

/** The site's name in `monti.config.ts`: the first `name` property, a double-quoted string. */
const SITE_NAME = /name: "[^"]*"/;

/** Rewrites the site's name in `monti.config.ts` and leaves the rest of the file as it is. */
export async function writeConfigName(file: string, name: string): Promise<void> {
	const text = await readFile(file, "utf8");
	await writeFile(
		file,
		text.replace(SITE_NAME, () => `name: ${JSON.stringify(name)}`),
	);
}

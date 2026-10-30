import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Imports the text of a schema file the way a site's module graph does: it is written to a temporary `.ts` file, and the `@monti-cms/core` import of that text
 * resolves to this package's sources (an alias of the test config). Returns what the file exports as default.
 */
export async function importSchemaText(text: string): Promise<unknown> {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-schema-import-"));
	try {
		const file = path.join(dir, "monti.schema.ts");
		writeFileSync(file, text);
		const loaded = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as { default?: unknown };
		return loaded.default;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

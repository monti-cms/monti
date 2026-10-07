import { parse, stringify } from "yaml";

/**
 * The text of a synced file: YAML front matter between `---` lines, a blank line, and the body in the target's format.
 *
 * ```
 * ---
 * title: Hello
 * tagIds:
 *   - 1f0c...
 * slug: hello
 * date: 2026-10-07T09:00:00.000Z
 * lastmod: 2026-10-08T10:30:00.000Z
 * monti:
 *   id: 8a3b...
 *   collection: post
 *   locale: en
 * ---
 *
 * The body.
 * ```
 */

const FRONT_MATTER = /^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/;

/** A file text as it is stored in git, with `\n` line endings and no byte order mark. */
const normalise = (text: string) => text.replace(/^﻿/, "").replace(/\r\n/g, "\n");

/** Writes a file: the data as front matter, then the body. A body with no text leaves the file as front matter only. */
export function composeFile(data: Readonly<Record<string, unknown>>, body: string): string {
	const yaml = stringify(data, { lineWidth: 0, minContentWidth: 0 });
	const trimmed = body.replace(/^\n+/, "");
	return `---\n${yaml}---\n${trimmed ? `\n${trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`}` : ""}`;
}

export type ParsedFile =
	| { readonly ok: true; readonly data: Record<string, unknown>; readonly body: string }
	| { readonly ok: false; readonly message: string; readonly line?: number };

/** Reads a file written by {@link composeFile} (or by hand). A file with no front matter has no data; a front matter that is not a YAML mapping is an error. */
export function parseFile(raw: string): ParsedFile {
	const text = normalise(raw);
	const found = FRONT_MATTER.exec(text);
	if (!found) return { ok: true, data: {}, body: text };
	let data: unknown;
	try {
		data = parse(found[1] ?? "", { schema: "core", prettyErrors: false });
	} catch (error) {
		const line = (error as { linePos?: { line: number }[] }).linePos?.[0]?.line;
		return {
			ok: false,
			message: `front matter is not valid YAML: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
			...(line === undefined ? {} : { line: line + 1 }),
		};
	}
	if (data === null || data === undefined) data = {};
	if (typeof data !== "object" || Array.isArray(data)) {
		return { ok: false, message: "front matter must be a YAML mapping (key: value lines)" };
	}
	return { ok: true, data: data as Record<string, unknown>, body: text.slice(found[0].length).replace(/^\n/, "") };
}

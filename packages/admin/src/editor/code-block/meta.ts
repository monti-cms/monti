import { parseCodeFenceMeta } from "@monti-cms/core/code-block";
import type { ParsedCodeBlockMeta } from "./types";

/**
 * Parses a code fence meta string (`title="file.ts" lnum`).
 */
export function parseMeta(meta: string | null | undefined): ParsedCodeBlockMeta {
	if (!meta || typeof meta !== "string") {
		return { title: "", showLineNumbers: false, raw: {} };
	}

	const raw: Record<string, unknown> = { ...parseCodeFenceMeta(meta) };
	let title = "";
	let showLineNumbers = false;

	// match title="value", title='value' or title=value
	const titleMatch = meta.match(/title=(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|([^\s]+))/);
	if (titleMatch) {
		title = titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? "";
		raw.title = title;
	}

	// An explicit `lnum=false` is not treated as on.
	showLineNumbers = raw.lnum === true || raw.showLineNumbers === true;

	return { title, showLineNumbers, raw };
}

/**
 * Serializes parsed meta attributes into a code fence meta string.
 */
export function formatMeta({
	title,
	showLineNumbers,
	raw = {},
}: {
	title?: string;
	showLineNumbers?: boolean;
	raw?: Record<string, unknown>;
}): string | null {
	const parts: string[] = [];

	const cleanTitle = title?.trim();
	if (cleanTitle) {
		parts.push(`title=${JSON.stringify(cleanTitle)}`);
	}

	if (showLineNumbers) {
		parts.push("lnum");
	}

	for (const [key, value] of Object.entries(raw)) {
		if (key === "title") continue;
		if (key === "lnum" || key === "showLineNumbers") {
			if (!showLineNumbers && value === false) parts.push(`${key}=false`);
			continue;
		}
		if (typeof value === "boolean") {
			parts.push(value ? key : `${key}=false`);
		} else if (value != null && value !== "") {
			parts.push(`${key}=${JSON.stringify(value)}`);
		}
	}

	return parts.length > 0 ? parts.join(" ") : null;
}

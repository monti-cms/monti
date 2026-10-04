import { parseCodeFenceMeta } from "@monti-cms/core/code-block";
import type { ParsedCodeBlockMeta } from "./types";

/**
 * 코드 펜스 meta 문자열(`title="file.ts" lnum`)을 파싱한다.
 */
export function parseMeta(meta: string | null | undefined): ParsedCodeBlockMeta {
	if (!meta || typeof meta !== "string") {
		return { title: "", showLineNumbers: false, raw: {} };
	}

	const raw: Record<string, unknown> = { ...parseCodeFenceMeta(meta) };
	let title = "";
	let showLineNumbers = false;

	// title="value" 또는 title='value' 또는 title=value 매칭
	const titleMatch = meta.match(/title=(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|([^\s]+))/);
	if (titleMatch) {
		title = titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? "";
		raw.title = title;
	}

	// 명시적 `lnum=false`는 켜진 상태로 간주하지 않는다.
	showLineNumbers = raw.lnum === true || raw.showLineNumbers === true;

	return { title, showLineNumbers, raw };
}

/**
 * 파싱된 meta 속성을 코드 펜스 meta 문자열로 직렬화한다.
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

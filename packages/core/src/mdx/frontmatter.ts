import type { CmsJsonValue } from "./types";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export const splitFrontmatter = (source: string): { raw: string | null; body: string } => {
	const match = source.match(FRONTMATTER_RE);
	if (!match) return { raw: null, body: source };
	return { raw: match[1] ?? "", body: source.slice(match[0].length) };
};

const unquote = (raw: string): string => {
	if (
		(raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) ||
		(raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2)
	) {
		try {
			return JSON.parse(raw.startsWith("'") ? `"${raw.slice(1, -1).replace(/"/g, '\\"')}"` : raw);
		} catch {
			return raw.slice(1, -1);
		}
	}
	return raw;
};

const parseScalar = (raw: string): CmsJsonValue => {
	const value = raw.trim();
	if (value === "true") return true;
	if (value === "false") return false;
	if (value === "null" || value === "~" || value === "") return null;
	if (value === "[]") return [];
	if (value === "{}") return {};
	if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
	return unquote(value);
};

type YamlLine = { indent: number; text: string };

const parseBlock = (lines: YamlLine[], start: number, parentIndent: number): { value: CmsJsonValue; next: number } => {
	if (start >= lines.length) return { value: null, next: start };

	const first = lines[start];
	if (!first || first.indent < parentIndent) return { value: null, next: start };

	if (first.text.startsWith("- ")) {
		const list: CmsJsonValue[] = [];
		let index = start;
		while (index < lines.length) {
			const line = lines[index];
			if (!line || line.indent !== first.indent || !line.text.startsWith("- ")) break;
			const itemText = line.text.slice(2).trim();
			index += 1;
			if (itemText.length === 0) {
				const nested = parseBlock(lines, index, first.indent + 1);
				list.push(nested.value);
				index = nested.next;
				continue;
			}
			if (itemText.includes(": ")) {
				const colon = itemText.indexOf(": ");
				const nested = parseBlock(lines, index, first.indent + 1);
				const record: Record<string, CmsJsonValue> = {
					[itemText.slice(0, colon)]: parseScalar(itemText.slice(colon + 2)),
				};
				if (nested.next > index && nested.value && typeof nested.value === "object" && !Array.isArray(nested.value)) {
					Object.assign(record, nested.value);
					index = nested.next;
				}
				list.push(record);
				continue;
			}
			list.push(parseScalar(itemText));
		}
		return { value: list, next: index };
	}

	const record: Record<string, CmsJsonValue> = {};
	let index = start;
	while (index < lines.length) {
		const line = lines[index];
		if (!line || line.indent < parentIndent) break;
		if (line.indent !== parentIndent) break;
		if (line.text.startsWith("- ")) break;

		const colon = line.text.indexOf(":");
		if (colon < 0) {
			index += 1;
			continue;
		}

		const key = line.text.slice(0, colon).trim();
		const rest = line.text.slice(colon + 1).trim();
		index += 1;
		if (rest.length > 0) {
			record[key] = parseScalar(rest);
			continue;
		}

		const nextLine = lines[index];
		const nestedIndent = nextLine && nextLine.indent > line.indent ? nextLine.indent : parentIndent + 2;
		const nested = parseBlock(lines, index, nestedIndent);
		record[key] = nested.value ?? null;
		index = nested.next;
	}

	return { value: record, next: index };
};

export const parseYamlMapping = (raw: string): Record<string, CmsJsonValue> => {
	const lines: YamlLine[] = [];
	for (const line of raw.split(/\r?\n/)) {
		if (!line.trim() || line.trimStart().startsWith("#")) continue;
		const indent = line.match(/^ */)?.[0].length ?? 0;
		lines.push({ indent, text: line.slice(indent) });
	}

	const parsed = parseBlock(lines, 0, 0).value;
	if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
	return {};
};

const isSafeUnquoted = (value: string) => {
	if (value.length === 0) return false;
	if (!/^[A-Za-z0-9_./\u00A0-\uFFFF][A-Za-z0-9_./ :+T\-()\u00A0-\uFFFF]*$/.test(value)) return false;
	if (/^[-?:]/.test(value)) return false;
	return true;
};

const emitYamlValue = (value: CmsJsonValue, indent: number): string => {
	const pad = "  ".repeat(indent);
	if (value === null) return "null";
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") return String(value);
	if (typeof value === "string") return isSafeUnquoted(value) ? value : JSON.stringify(value);
	if (Array.isArray(value)) {
		if (value.length === 0) return "[]";
		return value
			.map((item) => {
				if (item && typeof item === "object" && !Array.isArray(item)) {
					const body = emitYamlMapping(item, indent + 1);
					return `${pad}- ${body.trimStart()}`;
				}
				return `${pad}- ${emitYamlValue(item, 0)}`;
			})
			.join("\n");
	}
	return emitYamlMapping(value, indent);
};

const emitYamlMapping = (value: Record<string, CmsJsonValue>, indent: number): string => {
	const pad = "  ".repeat(indent);
	return Object.entries(value)
		.map(([key, item]) => {
			if (item && typeof item === "object") {
				if (Array.isArray(item)) {
					if (item.length === 0) return `${pad}${key}: []`;
					return `${pad}${key}:\n${emitYamlValue(item, indent + 1)}`;
				}
				if (Object.keys(item).length === 0) return `${pad}${key}: {}`;
				return `${pad}${key}:\n${emitYamlMapping(item, indent + 1)}`;
			}
			return `${pad}${key}: ${emitYamlValue(item, 0)}`;
		})
		.join("\n");
};

export const serializeFrontmatter = (data: Record<string, CmsJsonValue>): string => {
	const body = emitYamlMapping(data, 0);
	return `---\n${body}\n---\n`;
};

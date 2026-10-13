import type { CmsJsonValue } from "@monti-cms/core/document";
import { parse, stringify } from "yaml";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export const splitFrontmatter = (source: string): { raw: string | null; body: string } => {
	const match = source.match(FRONTMATTER_RE);
	if (!match) return { raw: null, body: source };
	return { raw: match[1] ?? "", body: source.slice(match[0].length) };
};

/** Reads the YAML of a front matter block as a mapping. Throws on invalid YAML; anything that is not a mapping reads as no data. */
export const parseYamlMapping = (raw: string): Record<string, CmsJsonValue> => {
	const parsed: unknown = parse(raw, { schema: "core" });
	if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, CmsJsonValue>;
	return {};
};

export const serializeFrontmatter = (data: Record<string, CmsJsonValue>): string => {
	if (Object.keys(data).length === 0) return "---\n---\n";
	return `---\n${stringify(data, { schema: "core", lineWidth: 0, minContentWidth: 0 })}---\n`;
};

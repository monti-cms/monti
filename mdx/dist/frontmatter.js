import { parse, stringify } from "yaml";
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
export const splitFrontmatter = (source) => {
    const match = source.match(FRONTMATTER_RE);
    if (!match)
        return { raw: null, body: source };
    return { raw: match[1] ?? "", body: source.slice(match[0].length) };
};
/** Reads the YAML of a front matter block as a mapping. Throws on invalid YAML; anything that is not a mapping reads as no data. */
export const parseYamlMapping = (raw) => {
    const parsed = parse(raw, { schema: "core" });
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        return parsed;
    return {};
};
export const serializeFrontmatter = (data) => {
    if (Object.keys(data).length === 0)
        return "---\n---\n";
    return `---\n${stringify(data, { schema: "core", lineWidth: 0, minContentWidth: 0 })}---\n`;
};

import type { Block, Doc, Inline } from "@monti-cms/core";
import { KEPT } from "./kept";

export type WriteOptions = {
	/** The address of a library file, for pictures and files; a body's own name for it (`media:<id>`) when left out. */
	mediaUrl?: (id: string) => string;
};

const escaped = (text: string) => text.replace(/([\\`*_[\]<])/g, "\\$1");

/** Marks from the outside in, so the same body always writes the same text. */
const WRAP: Record<string, (inner: string, mark: Record<string, unknown>) => string> = {
	link: (inner, mark) => `[${inner}](${String(mark.href ?? "")})`,
	bold: (inner) => `**${inner}**`,
	italic: (inner) => `*${inner}*`,
	strike: (inner) => `~~${inner}~~`,
	underline: (inner) => `<u>${inner}</u>`,
	sup: (inner) => `<sup>${inner}</sup>`,
	sub: (inner) => `<sub>${inner}</sub>`,
};
const ORDER = Object.keys(WRAP);

function inline(content: readonly Inline[] = []): string {
	return content
		.map((each) => {
			if (each.type === "hardBreak") return "\\\n";
			if (each.type === "footnoteRef") return `[^${each.id}]`;
			const marks = each.marks ?? [];
			// Code is written as it is: nothing in it is markup.
			const code = marks.some((mark) => mark.type === "code");
			let text = code ? `\`${each.text}\`` : escaped(each.text);
			for (const type of [...ORDER].reverse()) {
				const mark = marks.find((one) => one.type === type);
				if (mark) text = (WRAP[type] as (typeof WRAP)[string])(text, mark);
			}
			return text;
		})
		.join("");
}

const attributes = (attrs: Record<string, unknown> | undefined) => {
	const pairs = Object.entries(attrs ?? {}).filter(
		([, value]) => value !== undefined && value !== null && typeof value !== "object",
	);
	if (pairs.length === 0) return "";
	return `{${pairs.map(([key, value]) => (value === true ? key : `${key}=${JSON.stringify(String(value))}`)).join(" ")}}`;
};

const indent = (text: string, by: string) =>
	text
		.split("\n")
		.map((line) => (line === "" ? line : by + line))
		.join("\n");

/** The core's block types: each has markdown of its own. Any other block is the site's, and is written as a directive. */
const CORE = new Set([
	"paragraph",
	"heading",
	"bulletList",
	"orderedList",
	"checklist",
	"listItem",
	"quote",
	"codeBlock",
	"table",
	"divider",
	"footnote",
	"image",
	"file",
]);

function block(each: Block, options: WriteOptions, depth: number): string {
	const attrs = each.attrs ?? {};
	const url = (id: unknown) => (typeof id === "string" && id !== "" ? (options.mediaUrl?.(id) ?? `media:${id}`) : "");
	switch (each.type) {
		case "paragraph":
			return inline(each.content);
		case "heading":
			return `${"#".repeat(Number(attrs.level ?? 2))} ${inline(each.content)}`;
		case "bulletList":
			return (each.children ?? []).map((item) => `- ${inline(item.content)}`).join("\n");
		case "orderedList": {
			const start = typeof attrs.start === "number" ? attrs.start : 1;
			return (each.children ?? []).map((item, index) => `${start + index}. ${inline(item.content)}`).join("\n");
		}
		case "checklist":
			return (each.children ?? [])
				.map((item) => `- [${item.attrs?.checked ? "x" : " "}] ${inline(item.content)}`)
				.join("\n");
		case "quote":
			return indent(blocks(each.children ?? [], options, depth + 1), "> ").replace(/^$/gm, ">");
		case "codeBlock": {
			const text = (each.content ?? []).map((part) => (part.type === "text" ? part.text : "")).join("");
			const language = typeof attrs.language === "string" ? attrs.language : "";
			// What was kept as written (a component no block is known for, raw HTML) goes back as it was.
			if (language === KEPT || language === "html") return text;
			const fence = "`".repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((run) => run[0].length + 1)));
			return `${fence}${language}\n${text}\n${fence}`;
		}
		case "table": {
			const rows = (Array.isArray(attrs.rows) ? attrs.rows : []) as string[][];
			const [head = [], ...rest] = rows;
			const line = (cells: string[]) =>
				`| ${cells.map((cell) => String(cell).replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`;
			return [line(head), line(head.map(() => "---")), ...rest.map(line)].join("\n");
		}
		case "divider":
			return "---";
		case "footnote":
			return `[^${String(attrs.id ?? "")}]: ${inline(each.content)}`;
		case "image": {
			const caption =
				typeof attrs.caption === "string" && attrs.caption !== "" ? ` ${JSON.stringify(attrs.caption)}` : "";
			return `![${escaped(String(attrs.alt ?? ""))}](${url(attrs.media) || String(attrs.src ?? "")}${caption})`;
		}
		case "file":
			return `[${escaped(String(attrs.name ?? "file"))}](${url(attrs.media)})`;
		case "listItem":
			return inline(each.content);
		default: {
			// A block of the site's own: a directive, with more colons than any it holds.
			const colons = ":".repeat(3 + depthOf(each));
			if (each.children)
				return `${colons}${each.type}${attributes(attrs)}\n${blocks(each.children, options, depth + 1)}\n${colons}`;
			if (each.content) return `${colons}${each.type}${attributes(attrs)}\n${inline(each.content)}\n${colons}`;
			return `::${each.type}${attributes(attrs)}`;
		}
	}
}

/** How many of the site's own blocks stand inside one another under this block: an outer directive's fence is longer than an inner one's. */
const depthOf = (each: Block): number =>
	Math.max(0, ...(each.children ?? []).map((child) => (CORE.has(child.type) ? 0 : 1) + depthOf(child)));

const blocks = (list: readonly Block[], options: WriteOptions, depth: number): string =>
	list.map((each) => block(each, options, depth)).join("\n\n");

/**
 * A body as MDX (doc 14): the core's blocks as markdown, the site's own blocks as `:::name{…}` directives, and what an import kept as
 * written as it was. With `values`, they go first as front matter.
 */
export function toMdx(doc: Doc | null, options: WriteOptions & { values?: Record<string, unknown> } = {}): string {
	const head = Object.entries(options.values ?? {}).filter(
		([, value]) => value !== undefined && value !== null && value !== "",
	);
	const front =
		head.length === 0
			? ""
			: `---\n${head.map(([key, value]) => `${key}: ${typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value)}`).join("\n")}\n---\n\n`;
	const body = blocks(doc?.blocks ?? [], options, 0);
	return `${front}${body}${body === "" ? "" : "\n"}`;
}

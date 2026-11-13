import type { Inline, Mark, NewBlock } from "@monti-cms/core";

// Small builders for the seed's bodies: a body is JSON blocks (doc 03), written here the way an operation takes them.

/** Text with marks: `t("bold", { type: "bold" })`. */
export const t = (text: string, ...marks: Mark[]): Inline =>
	marks.length ? { type: "text", text, marks } : { type: "text", text };

export const bold: Mark = { type: "bold" };
export const italic: Mark = { type: "italic" };
export const underline: Mark = { type: "underline" };
export const strike: Mark = { type: "strike" };
export const code: Mark = { type: "code" };
export const sup: Mark = { type: "sup" };
export const sub: Mark = { type: "sub" };
export const link = (href: string): Mark => ({ type: "link", href });

export const p = (id: string, ...content: Inline[]): NewBlock => ({ id, type: "paragraph", content });
export const aligned = (id: string, align: "center" | "right", ...content: Inline[]): NewBlock => ({
	id,
	type: "paragraph",
	attrs: { align },
	content,
});
export const heading = (id: string, level: 2 | 3 | 4, text: string): NewBlock => ({
	id,
	type: "heading",
	attrs: { level },
	content: [t(text)],
});
const item = (id: string, content: Inline[], checked?: boolean): NewBlock => ({
	id,
	type: "listItem",
	...(checked === undefined ? {} : { attrs: { checked } }),
	content,
});
export const bullets = (id: string, items: Inline[][]): NewBlock => ({
	id,
	type: "bulletList",
	children: items.map((content, at) => item(`${id}-${at}`, content)),
});
export const numbers = (id: string, items: Inline[][], start?: number): NewBlock => ({
	id,
	type: "orderedList",
	...(start === undefined ? {} : { attrs: { start } }),
	children: items.map((content, at) => item(`${id}-${at}`, content)),
});
export const checklist = (id: string, items: [Inline[], boolean][]): NewBlock => ({
	id,
	type: "checklist",
	children: items.map(([content, checked], at) => item(`${id}-${at}`, content, checked)),
});
export const quote = (id: string, ...children: NewBlock[]): NewBlock => ({ id, type: "quote", children });
export const codeBlock = (id: string, language: string, text: string): NewBlock => ({
	id,
	type: "codeBlock",
	attrs: { language },
	content: [t(text)],
});
export const table = (id: string, rows: string[][], widths?: number[]): NewBlock => ({
	id,
	type: "table",
	attrs: { header: true, rows, ...(widths ? { widths } : {}) },
});
export const divider = (id: string): NewBlock => ({ id, type: "divider" });
export const footnote = (id: string, note: string, ...content: Inline[]): NewBlock => ({
	id,
	type: "footnote",
	attrs: { id: note },
	content,
});
export const ref = (note: string): Inline => ({ type: "footnoteRef", id: note });
export const image = (id: string, attrs: Record<string, unknown>): NewBlock => ({ id, type: "image", attrs });
export const file = (id: string, media: string, name?: string): NewBlock => ({
	id,
	type: "file",
	attrs: { media, ...(name ? { name } : {}) },
});
export const doc = (...blocks: NewBlock[]) => ({ type: "doc" as const, blocks });

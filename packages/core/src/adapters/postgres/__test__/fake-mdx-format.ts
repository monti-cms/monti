import { docOf as docOfText } from "../../../../test/stored-content";
import type { StoredDocument } from "../../../doc/stored-document";
import { createFormatRegistry } from "../../../format/registry";
import { defineFormat, type LegacyBodies } from "../../../format/types";

/** The plain text of a document: the text of each block, blocks separated by a blank line. */
const textOf = (doc: StoredDocument): string =>
	doc.content.map((block) => (block.content ?? []).map((inline) => inline.text ?? "").join("")).join("\n\n");

/**
 * A stand-in for the old-body reader of the `mdx` format of `@monti-cms/mdx` (`legacyBodies`), written over the plain-text reader of the core tests. It lets
 * core test its own SQL and steps without the MDX parser: the text of an old body is read as paragraphs and written back as they are.
 * `calls` counts how often the migrations asked it for something, so a test can tell "never asked" from "asked and answered".
 */
export const fakeLegacyBodies = (): LegacyBodies & { readonly calls: { count: number } } => {
	const calls = { count: 0 };
	return {
		calls,
		insertSoftBreaks: () => {
			calls.count += 1;
			return { status: "unchanged" };
		},
		read: (text, options) => {
			calls.count += 1;
			return { text, doc: docOfText(text, options?.previous ?? undefined) };
		},
		write: (doc) => {
			calls.count += 1;
			return { text: textOf(doc), doc };
		},
		documentOf: (text) => {
			calls.count += 1;
			return docOfText(text);
		},
	};
};

/** A registry with a fake `mdx` format that has the old-body reader, and that reader. */
export const fakeMdxRegistry = () => {
	const bodies = fakeLegacyBodies();
	const format = defineFormat({
		name: "mdx",
		label: "MDX (test double)",
		mimeType: "text/mdx",
		extension: "mdx",
		export: textOf,
		legacyBodies: bodies,
	});
	return { formats: createFormatRegistry([format]), bodies };
};

import type { SyntaxExtension } from "@monti-cms/mdx";
import { analyze, parseMdxAst, serialize, toDocument } from "@monti-cms/mdx/format";

/**
 * The MDX pipeline (`analyze`, `toDocument`, `serialize`) with a given list of syntax extensions instead of the site config's `mdx.syntax`.
 * The test site configs run without extensions (standard MDX), so tests of the directive notation build the pipeline with it here.
 * The pipeline functions are the production ones; only the extension list is passed in.
 */
export const mdxWith = (syntax: readonly SyntaxExtension[]) => {
	const read = (source: string, name?: string) => analyze(source, name, syntax);
	const write = (source: string): string => serialize(toDocument(read(source)), syntax);
	return {
		analyze: read,
		parse: (body: string) => parseMdxAst(body, syntax),
		toDocument,
		serialize: (doc: unknown) => serialize(doc, syntax),
		/** `MDX → analyze → toDocument → serialize`. */
		write,
		/** Reading then writing the written string again must give the same string. */
		writeTwice: (source: string): string => write(write(source)),
	};
};

/**
 * Markdown read into a body (`@monti-cms/core/markdown`): the MDX plugin imports `.md` and `.mdx` with it, and the admin reads the assistant's answers
 * with it. It lives here so both depend on it and neither on the other.
 */
export { KEPT, KEPT_HTML } from "./kept";
export {
	type FencedBlocks,
	type KnownBlocks,
	type KnownMarks,
	type ReadFile,
	type ReadOptions,
	readMarkdown,
} from "./read";

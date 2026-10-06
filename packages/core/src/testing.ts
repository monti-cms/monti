/** Test helpers: isolated-schema DB, sample data, sample content and API handlers. Use only in app and plugin tests. */

import { bodyDocument, bodyFromMdx } from "./mdx/stored-document";
import type { SyntaxExtension } from "./syntax/types";

export * from "./adapters/postgres/__test__/test-database";
export { createContentStore, migrateContentStore } from "./adapters/postgres/content-store";
export { createPluginStorage as pluginStorageFor } from "./adapters/postgres/plugin-storage";
export { mdxContentHash, mdxSearchText } from "./adapters/postgres/store/mdx-body";
export { rewriteContent } from "./adapters/postgres/store/rewrite";
export { type FakeCmsParts, fakeCms } from "./cms";
export { type BodyTextOptions, documentText, EXCERPT_TEXT, SEARCH_TEXT } from "./core/body-text";
export { formatRewriteReport } from "./core/store";
export * from "./core/store/__test__/seed";
export { matchRoute } from "./http/router";
export { readSamples } from "./mdx/__test__/fixtures/samples";
export { parseMdxAst } from "./mdx/parse";
export { insertSoftBreaks, type SoftBreakResult } from "./mdx/soft-breaks";
export { bodyDocument, bodyFromMdx, documentToMdx } from "./mdx/stored-document";
export { syntaxRemarkPlugins } from "./mdx/syntax";
export { createMemoryPluginStorage, type MemoryPluginStorage } from "./plugin/memory-storage";

/** The stored document of MDX text (an `unparsed` body when it cannot be read), as a write would store it. */
export const docOfMdx = (mdx: string, syntax?: readonly SyntaxExtension[]) => bodyDocument(bodyFromMdx(mdx, syntax));

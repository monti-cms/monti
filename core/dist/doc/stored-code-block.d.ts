import type { CodeBlockDocument } from "../annotation/code-block/types.js";
import type { Site } from "../site/index.js";
import type { CmsJsonValue } from "./types.js";
/** What the code block functions need of a site: its code fence comment config (the line effects it uses). */
export type CodeBlockSite = Pick<Site, "annotationConfig">;
/** Names of the line annotations of a working code block whose range reaches past its last code line. Stored, they are cut or dropped. */
export declare const outOfRangeAnnotationNames: (site: CodeBlockSite, attrs: Record<string, CmsJsonValue>) => string[];
/** The stored attributes of a code block from its working attributes (`language`, `meta`, and `value` with the annotation comments). */
export declare const storedCodeBlockAttrs: (site: CodeBlockSite, attrs: Record<string, CmsJsonValue>) => Record<string, CmsJsonValue>;
/** The fence text of a stored code block: its code with the annotations written back as Monti annotation comments. */
export declare const storedCodeBlockFence: (site: CodeBlockSite, attrs: Record<string, CmsJsonValue>) => string;
/** The annotation document of a stored code block (the one `workingCodeBlockAttrs` keeps as `codeDocument`), for a renderer that needs only that. */
export declare const codeBlockDocumentOf: (site: CodeBlockSite, attrs: Record<string, CmsJsonValue>) => CodeBlockDocument;
/**
 * The working attributes of a stored code block (what `toDocument` makes from a fence): `language`, `meta`, `value` with the annotation
 * comments, the parsed annotation document, and the fence's meta keys as attributes.
 */
export declare const workingCodeBlockAttrs: (site: CodeBlockSite, attrs: Record<string, CmsJsonValue>) => Record<string, CmsJsonValue>;

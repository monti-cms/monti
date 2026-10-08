import { type BrowserFormat } from "@monti-cms/admin";
import type { Site } from "@monti-cms/core/client";
import type { JSONContent } from "@tiptap/core";
/**
 * The text a model reads and writes is MDX, so the AI plugin works through the `mdx` format: the editor holds documents, and the format turns them into the
 * text sent to the model and the model's text back into documents. The format is a plugin's (`useFormat`), not something the AI plugin parses with itself.
 */
/** The name of the format the AI plugin talks to the model in. */
export declare const MDX_FORMAT = "mdx";
/** The `mdx` format as the admin has it registered, or `undefined` when it is not (the AI actions that work on the body cannot run then). */
export declare const useMdxFormat: () => BrowserFormat | undefined;
/** The text of a piece of the editor's content (blocks as Tiptap JSON), written in the format. */
export declare const textOfContent: (site: Site, format: BrowserFormat, content: readonly JSONContent[]) => string;
/** The editor's content for a text the model wrote. A text the format cannot read is kept as it is, in a box, rather than dropped or half read. */
export declare function contentOfText(site: Site, format: BrowserFormat, text: string): JSONContent[];
/** The document a text reads as, or `null` when the format cannot read it. For showing a preview of what the model wrote. */
export declare const documentOfText: (format: BrowserFormat, text: string) => import("@monti-cms/core/read").StoredDocument | null;

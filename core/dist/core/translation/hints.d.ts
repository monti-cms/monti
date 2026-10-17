import type { StoredDocument } from "../../doc/stored-document.js";
import type { Site } from "../../site/index.js";
/**
 * Body of a new translation: keeps the source structure (headings, paragraphs, boxes, lists, tables) as is and gives its text the translation
 * hint mark (`untranslated`). The editor shows the hint text dimmed and removes it on typing.
 * Things that are not text nodes, such as code, images, math and box titles, are copied from the source unchanged. The blocks of a translation
 * are its own, so the result carries no block ids; instead every block links to the source block it was copied from (`sourceId`), which is how
 * the translation screen pairs them. A source that is not a document (an `unparsed` body) is returned without ids or links.
 */
export declare function withTranslationHints(site: Pick<Site, "sortMarks">, source: StoredDocument): StoredDocument;

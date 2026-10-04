/**
 * Body of a new translation: keeps the source structure (headings, paragraphs, boxes, lists, tables) as is and wraps text
 * in translation hint markers (`:untranslated[source text]`). The editor shows the hint text dimmed and removes it on typing.
 * Things that are not text nodes, such as code, images, math and box titles, are copied from the source unchanged. If the source cannot be parsed, it is returned unchanged.
 */
export declare function withTranslationHints(sourceMdx: string): string;

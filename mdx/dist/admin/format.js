import { createMdxFormat } from "../format.js";
import { siteCodeLineEffects, siteSyntaxBlocks } from "../syntax-config.js";
/**
 * The `mdx` format as the browser uses it: its context (the site, its blocks and language) is bound, so a caller only gives documents and text. Both directions are
 * synchronous, as the format promises (`@monti-cms/core/format`), so the editor can ask for the text at once.
 */
const formatContext = (site) => ({
    locale: site.DEFAULT_LOCALE,
    blocks: siteSyntaxBlocks(site),
    codeLineEffects: siteCodeLineEffects(site),
    site,
});
/**
 * The context a text for an editor is written with: purpose `sync`, so the text can be read again as it is. An internal link keeps the id of its entry
 * (`entry:<id>`) and an image keeps its media id, unless the caller can give the address of the entry (`options.link`).
 */
const exportContext = (site, link) => ({
    ...formatContext(site),
    purpose: "sync",
    link: (entryId) => {
        const url = link?.(entryId);
        return url ? { url, title: null, locale: site.DEFAULT_LOCALE } : null;
    },
    media: () => null,
    report: () => { },
});
/** The browser side of the `mdx` format for `site`, reading and writing with the given syntax extensions (none: standard MDX). */
export const createMdxBrowserFormat = (site, options = {}) => {
    const format = createMdxFormat(options);
    return {
        name: format.name,
        label: format.label,
        export(doc, exportOptions) {
            const text = format.export(doc, exportContext(site, exportOptions?.link));
            // The format is synchronous; one that is not cannot run where the editor needs the text at once.
            if (typeof text !== "string")
                throw new TypeError("The mdx format must write synchronously");
            return text;
        },
        import(text) {
            const read = format.import?.(text, formatContext(site));
            if (!read || "then" in read)
                throw new TypeError("The mdx format must read synchronously");
            return read.ok ? { ok: true, doc: read.doc, warnings: read.warnings ?? [] } : { ok: false, issues: read.issues };
        },
    };
};

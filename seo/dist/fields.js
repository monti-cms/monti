import { createActiveTranslator, fields, } from "@monti-cms/core";
import { seoMessages } from "./messages.js";
/** Field role for each slot. The public page helper (`seoOf`), search preview and AI features find values by these roles. */
export const SEO_ROLES = {
    title: "seoTitle",
    description: "seoDescription",
    image: "ogImage",
    noindex: "noindex",
    canonical: "canonical",
};
/** Default field names. */
export const SEO_DEFAULT_KEYS = {
    preview: "seoPreview",
    title: "seoTitle",
    description: "seoDescription",
    image: "seoImage",
    noindex: "seoNoindex",
    canonical: "seoCanonical",
};
// When the config file loads this module the display language is not known yet, so default labels are chosen when the text is read.
const t = createActiveTranslator(seoMessages);
/** Default labels (follow the display language). */
export const SEO_DEFAULT_LABELS = {
    get title() {
        return t("field.title");
    },
    get description() {
        return t("field.description");
    },
    get image() {
        return t("field.image");
    },
    get noindex() {
        return t("field.noindex");
    },
    get canonical() {
        return t("field.canonical");
    },
};
/** Approximate length that is not truncated in search results (the standard used by Strapi, Yoast and others). Used for the character count and AI suggestion length. */
export const SEO_DEFAULT_LIMITS = { title: 60, description: 155 };
/** Admin UI input names (registered by the SEO extension's admin side). If not registered, the default input is rendered. */
export const SEO_INPUTS = { title: "seo-title", description: "seo-description", noindex: "seo-noindex" };
/** Name of the view field for the search result and share preview. */
export const SEO_PREVIEW_VIEW = "search";
/** Builds the SEO field set. */
export function seoFields(options = {}) {
    const key = (part) => options.keys?.[part] ?? SEO_DEFAULT_KEYS[part];
    const custom = (part) => options.labels?.[part];
    /** If the site did not set a label, it is chosen by display language at read time (the language is not known yet when the field is built). */
    const lazyLabel = (field, part) => custom(part) === undefined
        ? Object.defineProperty(field, "label", {
            get: () => SEO_DEFAULT_LABELS[part],
            enumerable: true,
            configurable: true,
        })
        : field;
    const tab = options.tab ?? "SEO";
    const localized = options.localized ?? true;
    const limits = { ...SEO_DEFAULT_LIMITS, ...options.limits };
    const shared = { tab, ...(localized ? { localized: true } : {}) };
    const result = {
        /** Search result and share preview. Values are read from the role fields, falling back to the title and summary when empty. */
        [key("preview")]: fields.view({
            view: SEO_PREVIEW_VIEW,
            tab,
            ...(options.labels?.preview ? { label: options.labels.preview } : {}),
        }),
        /** Search result title. Falls back to the title when empty. */
        [key("title")]: lazyLabel(fields.text({
            label: custom("title") ?? "",
            role: SEO_ROLES.title,
            input: SEO_INPUTS.title,
            inputOptions: { limit: limits.title },
            ...shared,
        }), "title"),
        /** Search result description. Falls back to the summary when empty. */
        [key("description")]: lazyLabel(fields.text({
            label: custom("description") ?? "",
            role: SEO_ROLES.description,
            multiline: true,
            input: SEO_INPUTS.description,
            inputOptions: { limit: limits.description },
            ...shared,
        }), "description"),
        /** Link preview and search result image. Falls back to the site's default image when empty. */
        [key("image")]: lazyLabel(fields.media({ label: custom("image") ?? "", role: SEO_ROLES.image, accept: "image", ...shared }), "image"),
        /** Hidden from search engines when `noindex`. */
        [key("noindex")]: lazyLabel(fields.select({
            label: custom("noindex") ?? "",
            role: SEO_ROLES.noindex,
            options: {
                get index() {
                    return t("option.index");
                },
                get noindex() {
                    return t("option.noindex");
                },
            },
            defaultValue: "index",
            input: SEO_INPUTS.noindex,
            tab,
        }), "noindex"),
        /** URL of the post first published elsewhere (canonical). */
        [key("canonical")]: lazyLabel(fields.text({
            label: custom("canonical") ?? "",
            role: SEO_ROLES.canonical,
            placeholder: "https://",
            ...shared,
        }), "canonical"),
    };
    for (const part of options.omit ?? [])
        delete result[key(part)];
    return result;
}

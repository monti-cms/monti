import { valueFieldsOf } from "@monti-cms/core";
import { SEO_ROLES } from "./fields.js";
/**
 * Checks that SEO roles are attached to fields of the right kind (`validate` of `seo()`). Title, description and canonical URL must be text, the share image media,
 * and hiding a select field that has a `noindex` option.
 */
export function validateSeoFields({ collections }) {
    for (const [collection, schema] of Object.entries(collections)) {
        for (const { name, field } of valueFieldsOf(schema)) {
            const at = `cms.config: ${collection}.${name} role "${field.role}"`;
            switch (field.role) {
                case SEO_ROLES.title:
                case SEO_ROLES.description:
                case SEO_ROLES.canonical:
                    if (field.kind !== "text")
                        throw new Error(`${at} needs a text field`);
                    break;
                case SEO_ROLES.image:
                    if (field.kind !== "media")
                        throw new Error(`${at} needs a media field (fields.media)`);
                    break;
                case SEO_ROLES.noindex:
                    if (field.kind !== "select" || !Object.hasOwn(field.options, "noindex")) {
                        throw new Error(`${at} needs a select field with a "noindex" option`);
                    }
                    break;
            }
        }
    }
}

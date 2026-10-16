import { type Issue, IssueList, type PluginConfigView, pathOf } from "@monti-cms/core";
import { valueFieldsOf } from "@monti-cms/core/site";
import { SEO_ROLES } from "./fields";

/**
 * Checks that SEO roles are attached to fields of the right kind (`validate` of `seo()`). Title, description and canonical URL must be text, the share image media,
 * and hiding a select field that has a `noindex` option.
 */
export function checkSeoFields({ collections }: Pick<PluginConfigView, "collections">): Issue[] {
	const list = new IssueList();
	for (const [collection, schema] of Object.entries(collections)) {
		for (const { name, field, when } of valueFieldsOf(schema)) {
			const place = when
				? pathOf("collections", collection, "fields", when.field, "values", when.value)
				: pathOf("collections", collection, "fields");
			const at = pathOf(place, name, "role");
			switch (field.role) {
				case SEO_ROLES.title:
				case SEO_ROLES.description:
				case SEO_ROLES.canonical:
					if (field.kind !== "text") list.add(at, "role-kind", `"${field.role}" needs a text field`);
					break;
				case SEO_ROLES.image:
					if (field.kind !== "media") list.add(at, "role-kind", `"${field.role}" needs a media field (fields.media)`);
					break;
				case SEO_ROLES.noindex:
					if (field.kind !== "select" || !Object.hasOwn(field.options, "noindex")) {
						list.add(at, "role-kind", `"${field.role}" needs a select field with a "noindex" option`);
					}
					break;
			}
		}
	}
	return list.issues;
}

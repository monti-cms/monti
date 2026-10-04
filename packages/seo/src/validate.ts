import { type PluginConfigView, valueFieldsOf } from "@monti-cms/core";
import { SEO_ROLES } from "./fields";

/**
 * SEO 역할이 맞는 종류의 필드에 붙었는지 확인한다(`seo()`의 `validate`). 제목·설명·원본 주소는 텍스트, 공유 이미지는 미디어,
 * 숨기기는 `noindex` 선택지가 있는 선택 필드다.
 */
export function validateSeoFields({ collections }: Pick<PluginConfigView, "collections">): void {
	for (const [collection, schema] of Object.entries(collections)) {
		for (const { name, field } of valueFieldsOf(schema)) {
			const at = `cms.config: ${collection}.${name} role "${field.role}"`;
			switch (field.role) {
				case SEO_ROLES.title:
				case SEO_ROLES.description:
				case SEO_ROLES.canonical:
					if (field.kind !== "text") throw new Error(`${at} needs a text field`);
					break;
				case SEO_ROLES.image:
					if (field.kind !== "media") throw new Error(`${at} needs a media field (fields.media)`);
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

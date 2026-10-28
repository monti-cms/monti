import { defineMessages } from "@monti-cms/core";
import { josa } from "@monti-cms/core/site";

/** The name of a thing in a to-do, in code style; without one the text says "a …". */
const code = (name: unknown) => `\`${String(name)}\``;
const named = (vars: { name?: string | number }) => (vars.name === undefined || vars.name === "" ? null : vars.name);

/**
 * What a problem found by the publish check asks the writer to do, as a plain to-do. A key is `issue.<code>` of the server's issue code; `name`
 * is the thing the server's `message` names (a field label, a block attribute, a link). A code with no text here is shown with the server's own text.
 */
export const publishReadinessMessages = defineMessages("cms-admin.entries.publishReadiness", {
	en: {
		"issue.null_slug": "Add an address (slug)",
		"issue.empty_body": "Write something in the body",
		"issue.missing_field": (vars) => {
			const name = named(vars);
			return name === null ? "Fill in a required field" : `Fill in ${name}`;
		},
		"issue.field_too_long": (vars) => {
			const name = named(vars);
			return name === null ? "A text is too long" : `${name} is too long`;
		},
		"issue.unresolved_reference": "A linked item can't be found",
		"issue.unresolved_media": "A linked image can't be found",
		"issue.unpublished_reference": "A linked item isn't published yet",
		"issue.invalid_reference_collection": "A linked item is the wrong kind",
		"issue.unresolved_internal_link": (vars) => {
			const name = named(vars);
			return name === null ? "An internal link points to nothing" : `The link to ${code(name)} points to nothing`;
		},
		"issue.mdx_error": "The body has a syntax error",
		"issue.frontmatter_present": "Remove the frontmatter from the body",
		"issue.unparsed_body": "The body can't be read. Fix it in the source",
		"issue.missing_block_attribute": (vars) => {
			const name = named(vars);
			return name === null ? "A block is missing a required value" : `Fill in ${code(name)} of a block`;
		},
		"issue.invalid_block_attribute": (vars) => {
			const name = named(vars);
			return name === null ? "A block has a value that isn't valid" : `${code(name)} of a block isn't valid`;
		},
		"issue.disallowed_block": "A block here isn't allowed in this body",
		"issue.disallowed_mark": "A text style here isn't allowed in this body",
		"issue.missing_image_alt": "An image needs a description (alt)",
		"issue.missing_media_id": "An image has no address",
		"issue.invalid_reference_id": "An image ID isn't valid",
		"issue.source_not_published": "Publish the original first",
		"issue.untranslated_text": "Some text isn't translated yet",
		"issue.code_ref_broken": (vars) => {
			const name = named(vars);
			return name === null
				? "A code link points to a code block that doesn't exist"
				: `The code link ${code(name)} points to a code block that doesn't exist`;
		},
		"issue.unpublished_internal_link":
			"A link points to an entry that isn't published yet; it shows as plain text until then",
		"issue.image_src_not_allowed": "An image address isn't allowed",
		"issue.image_media_not_ready": "An image isn't ready yet",
		"issue.image_media_unresolved": "An image can't be found",
		"issue.image_media_missing_in_storage": "An image file is missing from storage",
		"issue.unknown_block_attribute": "A block has a value the site doesn't know",
		"issue.code_annotation_out_of_range": "A code annotation reaches past the last line and was cut",
		"issue.footnote_definition_missing": "A footnote has no definition",
		"issue.footnote_definition_unused": "A footnote definition is never used",
		"issue.footnote_definition_duplicate": "A footnote name is defined more than once",
		"issue.orphaned_metadata_key": "A value is kept for a field the site no longer has",
		"issue.unknown_select_value": "A choice that no longer exists is still in use",
		"issue.code_anchor_duplicate": "Two code blocks use the same line name",
		"field.write": ({ name }) => `Write ${name}`,
		"field.pick": ({ name }) => `Choose ${name}`,
		"field.empty": ({ name }) => `${name} · empty`,
		"group.missing_image_alt": ({ count }) => `${count} ${Number(count) === 1 ? "image" : "images"} without alt text`,
		"place.body": ({ number }) => `Body ${number}`,
		"place.bodyAny": "Body",
		"done.imageAlt": ({ count }) => `Alt text on ${count} ${Number(count) === 1 ? "image" : "images"}`,
		title: "Before publishing",
		checking: "Checking…",
		ready: "Ready to publish",
		blocked: ({ count }) => `${count} to fix before publishing`,
		nothingToFix: "Nothing to fix. This is ready to publish.",
	},
	ko: {
		"issue.null_slug": "주소(slug)를 입력해 주세요",
		"issue.empty_body": "본문을 입력해 주세요",
		"issue.missing_field": (vars) => {
			const name = named(vars);
			return name === null ? "필수 항목을 입력해 주세요" : `${josa(String(name), "을", "를")} 입력해 주세요`;
		},
		"issue.field_too_long": (vars) => {
			const name = named(vars);
			return name === null ? "입력한 글이 너무 길어요" : `${josa(String(name), "이", "가")} 너무 길어요`;
		},
		"issue.unresolved_reference": "연결된 항목을 찾을 수 없어요",
		"issue.unresolved_media": "연결된 이미지를 찾을 수 없어요",
		"issue.unpublished_reference": "연결된 항목이 아직 공개되지 않았어요",
		"issue.invalid_reference_collection": "연결된 항목의 종류가 맞지 않아요",
		"issue.unresolved_internal_link": (vars) => {
			const name = named(vars);
			return name === null
				? "가리키는 곳이 없는 내부 링크가 있어요"
				: `내부 링크 ${code(name)}의 대상을 찾을 수 없어요`;
		},
		"issue.mdx_error": "본문 구문에 오류가 있어요",
		"issue.frontmatter_present": "본문에서 frontmatter를 지워 주세요",
		"issue.unparsed_body": "본문을 읽을 수 없어요. 소스에서 고쳐 주세요",
		"issue.missing_block_attribute": (vars) => {
			const name = named(vars);
			return name === null ? "블록에 꼭 필요한 값이 비어 있어요" : `블록의 ${code(name)} 값을 입력해 주세요`;
		},
		"issue.invalid_block_attribute": (vars) => {
			const name = named(vars);
			return name === null ? "블록에 올바르지 않은 값이 있어요" : `블록의 ${code(name)} 값이 올바르지 않아요`;
		},
		"issue.disallowed_block": "이 본문에서 쓸 수 없는 블록이 있어요",
		"issue.disallowed_mark": "이 본문에서 쓸 수 없는 글자 스타일이 있어요",
		"issue.missing_image_alt": "이미지에 설명(alt)이 필요해요",
		"issue.missing_media_id": "이미지에 주소가 없어요",
		"issue.invalid_reference_id": "이미지 ID 형식이 올바르지 않아요",
		"issue.source_not_published": "원문을 먼저 발행해 주세요",
		"issue.untranslated_text": "아직 번역하지 않은 글이 있어요",
		"issue.code_ref_broken": (vars) => {
			const name = named(vars);
			return name === null
				? "코드 링크가 가리키는 코드 블록이 없어요"
				: `코드 링크 ${code(name)}가 가리키는 코드 블록이 없어요`;
		},
		"issue.unpublished_internal_link":
			"아직 공개되지 않은 글로 가는 링크가 있어요. 그 글이 공개될 때까지 일반 글자로 보여요",
		"issue.image_src_not_allowed": "허용되지 않는 이미지 주소가 있어요",
		"issue.image_media_not_ready": "아직 준비되지 않은 이미지가 있어요",
		"issue.image_media_unresolved": "찾을 수 없는 이미지가 있어요",
		"issue.image_media_missing_in_storage": "저장소에 파일이 없는 이미지가 있어요",
		"issue.unknown_block_attribute": "사이트가 모르는 블록 값이 있어요",
		"issue.code_annotation_out_of_range": "코드 주석이 마지막 줄을 넘어 잘렸어요",
		"issue.footnote_definition_missing": "내용이 없는 각주가 있어요",
		"issue.footnote_definition_unused": "어디에도 쓰이지 않는 각주 내용이 있어요",
		"issue.footnote_definition_duplicate": "이름이 같은 각주가 둘 이상이에요",
		"issue.orphaned_metadata_key": "사이트에서 없어진 필드의 값이 남아 있어요",
		"issue.unknown_select_value": "더는 없는 선택지가 그대로 쓰이고 있어요",
		"issue.code_anchor_duplicate": "줄 이름이 같은 코드 블록이 둘 이상이에요",
		"field.write": ({ name }) => `${name} 쓰기`,
		"field.pick": ({ name }) => `${name} 고르기`,
		"field.empty": ({ name }) => `${name} · 비어 있음`,
		"group.missing_image_alt": ({ count }) => `대체 텍스트 없는 이미지 ${count}개`,
		"place.body": ({ number }) => `본문 ${number}`,
		"place.bodyAny": "본문",
		"done.imageAlt": ({ count }) => `이미지 대체 텍스트 ${count}개`,
		title: "발행 전 확인",
		checking: "검사 중…",
		ready: "발행 준비됨",
		blocked: ({ count }) => `발행 전 ${count}`,
		nothingToFix: "고칠 곳이 없어요. 바로 발행할 수 있어요.",
	},
});

import { defineMessages, josa } from "../i18n/define";

/**
 * The text a person reads for each issue code (a problem found in content), in the admin language. A key is an issue code; `field.*` are the
 * required-value and length texts that name the field, `invalid_value` is the text of a request value that does not check, `unknown` the text of a
 * code with neither a text here nor a message of its own, and `position` the place in a body text.
 * Sites override the text with `admin.messages["cms.core.issues"]` in the config.
 */
export const issueMessages = defineMessages("cms.core.issues", {
	en: {
		null_slug: "Enter an address (slug).",
		empty_body: "Enter the body.",
		unresolved_reference: "A referenced item can't be found.",
		unresolved_media: "A referenced image can't be found.",
		unpublished_reference: "A referenced item isn't published.",
		invalid_reference_collection: "A referenced item is the wrong kind.",
		unresolved_internal_link: "There is an internal link that can't be resolved.",
		unpublished_internal_link:
			"There is an internal link to an item that isn't published yet. It shows as plain text until that item is published.",
		mdx_error: "Check the MDX syntax of the body.",
		frontmatter_present: "The body can't contain frontmatter.",
		image_src_not_allowed: "This image address isn't allowed.",
		image_media_not_ready: "The image isn't ready yet.",
		image_media_unresolved: "The image can't be found.",
		image_media_missing_in_storage: "The image file can't be found in storage.",
		missing_block_attribute: "A required block attribute is empty.",
		invalid_block_attribute: "A block attribute value is invalid.",
		unknown_block_attribute: "There is an unknown block attribute.",
		code_annotation_out_of_range: "A code annotation reaches past the last line of its code and was cut.",
		footnote_definition_missing: "A footnote reference has no definition.",
		footnote_definition_unused: "A footnote definition is never referenced.",
		footnote_definition_duplicate: "A footnote label is defined more than once.",
		orphaned_metadata_key:
			"This field is no longer in the site settings. Its value is kept but isn't shown on the site.",
		unknown_select_value: "This choice is no longer an option. The value is kept as it is.",
		code_ref_broken: "A code link points to a code line label that no code block has.",
		code_anchor_duplicate: "Two code blocks use the same line label; links go to the first one.",
		missing_image_alt: "Enter alt text for the image, or mark it as decorative.",
		missing_media_id: "The image has no address (mediaId or src).",
		invalid_reference_id: "The media ID format is invalid.",
		missing_field: "Fill in the required field.",
		field_too_long: "The text is too long.",
		source_not_published:
			"Publish the source first. Shared values of a translation, like categories and the publish date, come from the published source.",
		untranslated_text: "Untranslated text remains.",
		unparsed_body: "The body could not be read as a document. Fix it in the source before publishing.",
		disallowed_block:
			"This block isn't allowed in this body. What is already saved is kept as it is, but new ones can't be added.",
		disallowed_mark:
			"This text style isn't allowed in this body. What is already saved is kept as it is, but it can't be added to more text.",
		"field.missing": "Fill in {label}.",
		"field.tooLong": "{label} is too long.",
		invalid_value: "This value isn't valid.",
		unknown: "Something here needs fixing.",
		position: "line {line}, column {column}",
	},
	ko: {
		null_slug: "주소(slug)를 입력하세요.",
		empty_body: "본문을 입력하세요.",
		unresolved_reference: "참조 항목을 찾을 수 없습니다.",
		unresolved_media: "이미지 미디어를 찾을 수 없습니다.",
		unpublished_reference: "참조 항목이 공개 상태가 아닙니다.",
		invalid_reference_collection: "참조 항목의 종류가 올바르지 않습니다.",
		unresolved_internal_link: "해결할 수 없는 내부 링크가 있습니다.",
		unpublished_internal_link:
			"아직 공개되지 않은 항목을 가리키는 내부 링크가 있습니다. 그 항목이 공개될 때까지 일반 글자로 보입니다.",
		mdx_error: "MDX 본문 구문을 확인하세요.",
		frontmatter_present: "본문 안에 frontmatter를 넣을 수 없습니다.",
		image_src_not_allowed: "허용되지 않는 이미지 주소입니다.",
		image_media_not_ready: "이미지가 아직 준비되지 않았습니다.",
		image_media_unresolved: "이미지를 찾을 수 없습니다.",
		image_media_missing_in_storage: "이미지 파일을 저장소에서 찾을 수 없습니다.",
		missing_block_attribute: "블록의 필수 속성이 비어 있습니다.",
		invalid_block_attribute: "블록 속성 값이 올바르지 않습니다.",
		unknown_block_attribute: "정의되지 않은 블록 속성이 있습니다.",
		code_annotation_out_of_range: "코드 주석이 코드의 마지막 줄을 넘어서 잘렸습니다.",
		footnote_definition_missing: "정의가 없는 각주 참조가 있습니다.",
		footnote_definition_unused: "어디에서도 참조하지 않는 각주 정의가 있습니다.",
		footnote_definition_duplicate: "같은 각주 레이블이 두 번 이상 정의되어 있습니다.",
		orphaned_metadata_key: "사이트 설정에서 사라진 필드입니다. 값은 남아 있지만 사이트에는 나오지 않습니다.",
		unknown_select_value: "더 이상 없는 선택지입니다. 값은 그대로 남아 있습니다.",
		code_ref_broken: "코드 연결이 가리키는 코드 줄 이름이 어느 코드 블록에도 없습니다.",
		code_anchor_duplicate: "두 코드 블록이 같은 줄 이름을 씁니다. 연결은 첫 번째 블록으로 갑니다.",
		missing_image_alt: "이미지 대체 텍스트를 입력하거나 장식 이미지로 표시하세요.",
		missing_media_id: "이미지 주소(mediaId 또는 src)가 없습니다.",
		invalid_reference_id: "미디어 ID 형식이 올바르지 않습니다.",
		missing_field: "필수 항목을 입력하세요.",
		field_too_long: "입력한 글이 너무 깁니다.",
		source_not_published: "원문을 먼저 발행하세요. 번역본의 분류·발행일 같은 공통 값은 원문 공개본에서 옵니다.",
		untranslated_text: "번역하지 않은 글이 남아 있습니다.",
		unparsed_body: "본문을 문서로 읽을 수 없습니다. 발행하기 전에 소스에서 고치세요.",
		disallowed_block:
			"이 본문에서 허용하지 않는 블록입니다. 이미 저장된 내용은 그대로 남지만 새로 추가할 수는 없습니다.",
		disallowed_mark:
			"이 본문에서 허용하지 않는 텍스트 스타일입니다. 이미 저장된 내용은 그대로 남지만 더 많은 글에 적용할 수는 없습니다.",
		"field.missing": ({ label }) => `${josa(String(label), "을", "를")} 입력하세요.`,
		"field.tooLong": ({ label }) => `${josa(String(label), "이", "가")} 너무 깁니다.`,
		invalid_value: "올바른 값이 아닙니다.",
		unknown: "고쳐야 할 곳이 있습니다.",
		position: "{line}행 {column}열",
	},
});

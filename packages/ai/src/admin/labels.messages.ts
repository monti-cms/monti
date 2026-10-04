import { defineMessages } from "@monti-cms/core";
import { createTranslator } from "@monti-cms/core/client";
import type { AiProviderKind } from "../connection";
import type { AiCheckKind, AiEngine, AiResult, AiSlot } from "../definition";

/** 관리자 AI 화면이 함께 쓰는 선택지 이름(자리·결과 모양·방식·검사·연결 종류). */
export const labelMessages = defineMessages("cms-ai.admin.labels", {
	en: {
		"slot.field": "Field",
		"slot.image": "Body image",
		"slot.codeRules": "Code block rules",
		"slot.media": "Media file",
		"slot.translation": "Translation",
		"slot.selection": "Selection menu",
		"slot.insert": "Insert menu",
		"slot.block": "Block",
		"target.image.alt": "Alt text",
		"target.image.caption": "Caption",
		"target.codeRules.fold": "Fold rule",
		"target.media.filename": "File name",
		"target.media.defaultAlt": "Default alt text",
		"target.media.defaultCaption": "Default caption",
		"result.candidates": "Several short candidates",
		"result.text": "One long text",
		"result.mdx": "Body fragment",
		"result.note": "Note only",
		"check.pattern": "Format",
		"check.maxLength": "Length",
		"check.exists": "Existing values only",
		"check.oneOf": "Within choices",
		"engine.generate": "Generate",
		"engine.decide": "Decide",
		"provider.chat": "Generate",
		"provider.decisions": "Decide",
	},
	ko: {
		"slot.field": "필드",
		"slot.image": "본문 이미지",
		"slot.codeRules": "코드 블록 규칙",
		"slot.media": "미디어 파일",
		"slot.translation": "번역",
		"slot.selection": "선택 영역 메뉴",
		"slot.insert": "넣기 메뉴",
		"slot.block": "블록",
		"target.image.alt": "대체 텍스트",
		"target.image.caption": "캡션",
		"target.codeRules.fold": "글자 접기 규칙",
		"target.media.filename": "파일 이름",
		"target.media.defaultAlt": "기본 대체 텍스트",
		"target.media.defaultCaption": "기본 캡션",
		"result.candidates": "짧은 후보 여러 개",
		"result.text": "긴 글 하나",
		"result.mdx": "본문 조각",
		"result.note": "메모만",
		"check.pattern": "형식",
		"check.maxLength": "길이",
		"check.exists": "있는 값만",
		"check.oneOf": "선택지 안",
		"engine.generate": "생성",
		"engine.decide": "판단",
		"provider.chat": "생성",
		"provider.decisions": "판단",
	},
});

const t = createTranslator(labelMessages);

/** 자리 이름(`필드`, `본문 이미지`…). */
export const slotLabel = (slot: AiSlot) => t(`slot.${slot}`);
/** 필드 밖 자리의 대상 이름. 모르는 대상은 그대로 돌려준다. */
export const slotTargetLabel = (slot: "image" | "codeRules" | "media", target: string) => {
	const key = `target.${slot}.${target}`;
	return key in labelMessages.messages.en ? t(key as Parameters<typeof t>[0]) : target;
};
export const resultLabel = (result: AiResult) => t(`result.${result}`);
export const checkLabel = (kind: AiCheckKind) => t(`check.${kind as "pattern" | "maxLength" | "exists" | "oneOf"}`);
export const engineLabel = (engine: AiEngine) => t(`engine.${engine}`);
export const providerKindLabel = (kind: AiProviderKind) => t(`provider.${kind}`);

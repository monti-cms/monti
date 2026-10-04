/**
 * 번역본의 번역 상태(`entry_bodies.translation`, v3). 원문은 `null`이다.
 * 번역자가 마지막으로 확인한 원문 본문(`baseSource`)을 담는다. 원문 최신 초안이 이 값과 다르면
 * 번역 화면이 "원문이 바뀌었어요"를 보이고, 이전·지금 원문을 블록 단위로 비교해 준다.
 */
export interface TranslationState {
	readonly version: 2;
	readonly baseSource: string;
}

/** 번역 상태 크기 상한. 원문 본문 상한(2MiB)과 같다. */
export const MAX_TRANSLATION_BYTES = 2 * 1024 * 1024;

/** 들어온 값을 번역 상태로 검증한다. 모양이 다르면 오류로 본다(`undefined` 반환). */
export function parseTranslationState(value: unknown): TranslationState | null | undefined {
	if (value === null) return null;
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const record = value as Record<string, unknown>;
	if (Object.keys(record).length !== 2 || record.version !== 2 || typeof record.baseSource !== "string") {
		return undefined;
	}
	if (new TextEncoder().encode(record.baseSource).length > MAX_TRANSLATION_BYTES) return undefined;
	return { version: 2, baseSource: record.baseSource };
}

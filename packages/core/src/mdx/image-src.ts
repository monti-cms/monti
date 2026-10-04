/**
 * `::image`의 주소 해석 규칙.
 *
 * 사이트의 공개 이미지 렌더러와 발행 전 검사가 **같은 함수**를 쓴다 —
 * 허용 규칙을 두 곳에 복사하면 한쪽만 고치는 실수가 난다.
 *
 * **해석 실패 계약(§4.4, A3 확정):** 공개 화면은 중립 플레이스홀더와 캡션을 남기고 `width`·`align`은 적용하지 않는다.
 * 내부 실패 사유는 공개 화면에 노출하지 않는다. `alt` 글자로 대체하지 않는다 — 문서 의미가 조용히 바뀌고 장식 이미지는 대체할 alt가 없다.
 *
 * 비차단 경고 대상은 **정상 데이터에서 실제로 발생하는 3가지**뿐이다:
 * ① 미디어 행은 있으나 `ready` 아님 ② `ready`인데 저장소 객체를 해석할 수 없음 ③ 외부 `src`가 허용 규칙에 걸림.
 * 미디어 행이 아예 없는 경우는 `entry_references`의 FK·CHECK와 발행 검사가 먼저 막으므로 경고 대상이 아니다.
 */

export type ImageResolveFailure =
	/** 미디어 행은 있는데 업로드가 `ready`가 아니다. */
	| "not-ready"
	/** 미디어 행은 `ready`인데 객체(저장소 키)를 해석하지 못했다. */
	| "unresolved"
	/** 허용되지 않는 주소다(`javascript:` 등). */
	| "rejected";

/** `width`·`height`는 등록 미디어의 원본 픽셀 크기다. 알면 공개 화면이 로드 전에 자리를 잡는다. */
export type ImageResolveResult =
	| {
			url: string;
			width?: number;
			height?: number;
			/** 첨부 파일 카드(v3)가 쓰는 올린 파일 정보. */
			file?: { filename: string; byteSize: number | null; mimeType: string | null };
	  }
	| { failure: ImageResolveFailure };

export type ImageResolver = (input: { mediaId?: string; src?: string }) => ImageResolveResult;

/** 절대 http(s) 또는 사이트 상대 경로만 통과시킨다. 실행 가능한 URL(`javascript:`, `data:`)은 거부한다. */
export const resolveImageUrl = (src: string | undefined): ImageResolveResult | null => {
	const trimmed = src?.trim();
	if (!trimmed) return null;
	// `//host/path`는 프로토콜 상대 주소라 사이트 상대 경로로 취급하지 않는다.
	if (trimmed.startsWith("//")) return { failure: "rejected" };
	if (/^https?:\/\//i.test(trimmed)) return { url: trimmed };
	if (trimmed.startsWith("/")) return { url: trimmed };
	return { failure: "rejected" };
};

/** 외부 `src`가 허용 규칙을 통과하는가. 발행 전 검사가 경고를 만들 때 쓴다. */
export const isAllowedImageSrc = (src: string | undefined): boolean => {
	const resolved = resolveImageUrl(src);
	return resolved !== null && "url" in resolved;
};

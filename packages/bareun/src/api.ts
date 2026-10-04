import type { TextCheckSegment, TextIssue } from "@monti-cms/core";
import { type BareunResponse, bareunIssues, joinSegments } from "./mapping";
import type { ResolvedBareunOptions } from "./options";

/** 바른 API를 부르는 데 필요한 값. 키는 서버에서만 다룬다. */
export interface BareunRequestOptions extends Pick<ResolvedBareunOptions, "baseUrl" | "customDictNames"> {
	readonly apiKey: string;
	readonly signal?: AbortSignal;
}

/** 바른 맞춤법 검사(`CorrectError`)를 부른다. 실패하면 상태 코드만 담은 오류를 던진다(키·응답 본문은 넣지 않는다). */
export async function requestBareun(content: string, options: BareunRequestOptions): Promise<BareunResponse> {
	const response = await fetch(`${options.baseUrl}/bareun.RevisionService/CorrectError`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"api-key": options.apiKey,
			"connect-protocol-version": "1",
		},
		body: JSON.stringify({
			document: { content, language: "ko_KR" },
			// 위치를 JS 문자열 인덱스(UTF-16)로 받는다.
			encodingType: "UTF16",
			...(options.customDictNames.length > 0 ? { customDictNames: options.customDictNames } : {}),
		}),
		signal: options.signal,
	});
	if (!response.ok) {
		// 본문을 읽어 연결을 닫는다. 오류 본문은 내보내지 않는다.
		await response.body?.cancel().catch(() => {});
		throw new Error(`Bareun request failed: HTTP ${response.status}`);
	}
	const body = (await response.json()) as unknown;
	if (!body || typeof body !== "object") throw new Error("Bareun response is not an object");
	return body as BareunResponse;
}

const isKorean = (locale: string) => locale.toLowerCase().split(/[-_]/)[0] === "ko";

/** 문단을 이어 한 번에 검사하고 문단별 결과로 나눈다. 한국어가 아닌 문단·빈 글은 보내지 않는다. */
export async function checkWithBareun(
	segments: readonly TextCheckSegment[],
	options: BareunRequestOptions,
): Promise<TextIssue[]> {
	const korean = segments.filter((segment) => isKorean(segment.locale));
	const content = joinSegments(korean);
	if (content.trim() === "") return [];
	return bareunIssues(korean, await requestBareun(content, options));
}

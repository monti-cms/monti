import { defineTextChecker, type TextChecker, type TextCheckerOptions, type TextIssue } from "./types";

export interface RemoteTextCheckerOptions extends Omit<TextCheckerOptions, "check"> {
	/** 사이트의 검사 경로(예: `/api/text-check`). `{ segments }`를 JSON으로 받아 `{ issues }`를 돌려준다. */
	readonly url: string;
	/** 더 보낼 머리글. API 키는 넣지 않는다(브라우저에 드러난다). 키는 서버 경로가 가진다. */
	readonly headers?: Readonly<Record<string, string>>;
}

/**
 * 사이트 서버 경로를 거치는 검사기. 키가 필요한 API(바른·LanguageTool 등)는 서버 경로에서 부르고,
 * 브라우저는 이 검사기로 문단만 보낸다. 서버 경로는 `@monti-cms/core/plugin/server`의 `textCheckRoute`로 만든다.
 */
export function remoteTextChecker({ url, headers, ...options }: RemoteTextCheckerOptions): TextChecker {
	return defineTextChecker({
		...options,
		check: async (segments, { signal }) => {
			const response = await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/json", ...headers },
				credentials: "same-origin",
				body: JSON.stringify({ segments }),
				signal,
			});
			const body = (await response.json().catch(() => null)) as { issues?: unknown; message?: unknown } | null;
			if (!response.ok) {
				// 본체 API 오류 모양(`{ code, message }`)이면 그 문구를 쓴다.
				const message = typeof body?.message === "string" ? body.message : `HTTP ${response.status}`;
				throw new Error(message);
			}
			if (!Array.isArray(body?.issues)) throw new Error("Invalid text check response");
			return body.issues as TextIssue[];
		},
	});
}

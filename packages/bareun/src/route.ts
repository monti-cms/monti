import { createActiveTranslator } from "@monti-cms/core";
import { adminRoute, json, textCheckRoute } from "@monti-cms/core/plugin/server";
import { checkWithBareun } from "./api";
import { bareunMessages } from "./messages";
import type { ResolvedBareunOptions } from "./options";

const t = createActiveTranslator(bareunMessages);

/**
 * 바른 검사 경로(`POST /api/cms/v1/text-check/bareun`). 관리자만 부를 수 있다. `{ segments }`를 받아 `{ issues }`를 돌려준다.
 * 키가 없으면 바른을 부르지 않고 503이다. 바른 오류는 검사 경로 도우미(`textCheckRoute`)가 일반 오류(502)로 바꾼다.
 */
export function bareunRoute(options: ResolvedBareunOptions) {
	// 키는 부를 때마다 서버 환경 변수에서 읽는다. 브라우저에는 보내지 않는다.
	const readKey = () => process.env[options.apiKeyEnv]?.trim() || undefined;
	const unavailable = adminRoute(async () =>
		json({ code: "text_check_unavailable", message: t("error.keyMissing") }, { status: 503 }),
	);
	const check = textCheckRoute({
		limits: options.limits,
		check: async (segments, { signal }) => {
			const apiKey = readKey();
			if (!apiKey) throw new Error("Bareun API key is missing");
			return checkWithBareun(segments, {
				apiKey,
				baseUrl: options.baseUrl,
				customDictNames: options.customDictNames,
				signal,
			});
		},
	});
	const POST: typeof check = (request, context) => (readKey() ? check : unavailable)(request, context);
	return { POST };
}

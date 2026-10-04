import type { TextCheckerLimits } from "@monti-cms/core";
import { createActiveTranslator } from "@monti-cms/core";
import { bareunMessages } from "./messages";

// `bareun()`은 사이트 설정 파일에서 불리므로 기본 이름은 읽는 때에 화면 언어로 고른다.
const t = createActiveTranslator(bareunMessages);

/** 사이트 설정의 `plugins`에서 바른 검사기를 찾는 이름. */
export const BAREUN_PLUGIN_NAME = "text-check-bareun";

/** 검사기 이름(결과의 출처). */
export const BAREUN_CHECKER_ID = "bareun";

/** 서버 경로. 본체 API 주소(`/api/cms/`) 뒤에 붙는다. */
export const BAREUN_ROUTE = "v1/text-check/bareun";

export interface BareunOptions {
	/** API 키를 담은 환경 변수 이름. 기본 `BAREUN_API_KEY`. 키는 서버에서만 읽는다. */
	readonly apiKeyEnv?: string;
	/** 바른 API 주소. 기본 `https://api.bareun.ai`. 직접 띄운 바른 서버를 쓸 때 바꾼다. */
	readonly baseUrl?: string;
	/** 도구 모음 버튼 이름이자 결과 창의 출처. 기본은 화면 언어의 "바른 맞춤법 검사". */
	readonly label?: string;
	/** 입력을 멈추면 바뀐 문단만 저절로 검사한다. 바른 API는 쓴 만큼 요금이 들어 기본은 끈다. */
	readonly auto?: boolean;
	/** 바른에 미리 올려 둔 사용자 사전 이름. */
	readonly customDictNames?: readonly string[];
	/** 한 번에 보낼 문단 수·글자 수. 기본 100문단·10,000자. 넘으면 나눠 보낸다. */
	readonly limits?: TextCheckerLimits;
}

export interface ResolvedBareunOptions {
	readonly apiKeyEnv: string;
	readonly baseUrl: string;
	readonly label: string;
	readonly auto: boolean;
	readonly customDictNames: readonly string[];
	readonly limits: TextCheckerLimits;
}

const DEFAULT_LIMITS: TextCheckerLimits = { maxSegments: 100, maxChars: 10_000 };

/** 기본값을 채우고 잘못된 값을 막는다. */
export function resolveBareunOptions(options: BareunOptions = {}): ResolvedBareunOptions {
	const apiKeyEnv = options.apiKeyEnv ?? "BAREUN_API_KEY";
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(apiKeyEnv)) throw new Error(`bareun: invalid apiKeyEnv "${apiKeyEnv}"`);
	const baseUrl = (options.baseUrl ?? "https://api.bareun.ai").replace(/\/+$/, "");
	if (!/^https?:\/\//.test(baseUrl)) throw new Error(`bareun: baseUrl must be an http(s) URL`);
	const limits = { ...DEFAULT_LIMITS, ...options.limits };
	for (const [key, value] of Object.entries(limits)) {
		if (value !== undefined && (!Number.isInteger(value) || value <= 0))
			throw new Error(`bareun: limits.${key} must be a positive integer`);
	}
	const label = options.label?.trim();
	return {
		apiKeyEnv,
		baseUrl,
		get label() {
			return label || t("label");
		},
		auto: options.auto ?? false,
		customDictNames: [...(options.customDictNames ?? [])],
		limits,
	};
}

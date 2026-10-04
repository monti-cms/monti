import { z } from "zod";

/**
 * AI 서비스 연결(v2 D). 관리자 AI 화면 `연결` 탭에서 여러 개를 저장하고, 기능마다 어느 연결의 어느 모델을 쓸지 고른다.
 *
 * - 생성(`chat`): OpenAI와 같은 방식의 주소(`…/v1`). OpenRouter·OpenCode Go·Gemini·xAI 등.
 * - 판단(`decisions`): 선택지마다 확률을 매기는 System One 모델(예: Jev). TypeSafe `…/v1/systemone`,
 *   OpenRouter `…/api/alpha/decisions` 같은 주소다. 둘 다 `state`·`model`·`questions` → `answers` 모양이다.
 *
 * 키는 서버에서 암호화해 저장하고 화면에는 끝 네 글자만 보여 준다. 이 파일은 서버·브라우저가 함께 쓴다.
 */

export const AI_PROVIDER_KINDS = ["chat", "decisions"] as const;
export type AiProviderKind = (typeof AI_PROVIDER_KINDS)[number];

/** 종류별 주소·모델 예시(입력 칸의 흐린 글자). */
export const PROVIDER_EXAMPLES: Record<AiProviderKind, { url: string; model: string }> = {
	chat: { url: "https://openrouter.ai/api/v1", model: "google/gemini-2.5-flash" },
	decisions: { url: "https://api.typesafe.ai/v1/systemone", model: "jev-latest" },
};

const url = z.union([z.literal(""), z.string().trim().url().max(500)]);

export const aiProviderInputSchema = z.object({
	name: z.string().trim().min(1).max(60),
	kind: z.enum(AI_PROVIDER_KINDS),
	url,
	/** 빠지면 저장된 키를 그대로 두고, `null`이면 지운다. */
	apiKey: z.string().trim().min(1).max(1000).nullable().optional(),
	/** 기능이 모델을 정하지 않았을 때 쓰는 모델. */
	defaultModel: z.string().trim().max(200),
});

export type AiProviderInput = z.output<typeof aiProviderInputSchema>;

/** 연결 추가·수정 요청. 설정 전체의 버전으로 충돌을 막는다(처음이면 0). */
export const aiProviderRequestSchema = z.object({
	expectedVersion: z.number().int().min(0),
	provider: aiProviderInputSchema,
});

/** 화면에 보내는 연결. 키 대신 끝 네 글자만 있다. */
export interface AiProviderView {
	id: string;
	name: string;
	kind: AiProviderKind;
	url: string;
	keyHint: string | null;
	defaultModel: string;
	/** 주소·키·기본 모델이 모두 있어 쓸 수 있는가. */
	ready: boolean;
}

export interface AiSettingsView {
	version: number;
	providers: AiProviderView[];
	/** 개발용 가짜 연결을 쓰는 중(`CMS_AI_FAKE=1`). 설정과 상관없이 모든 기능이 동작한다. */
	fake: boolean;
}

/** 저장 전 연결 확인. `providerId`가 있으면 키를 새로 넣지 않았을 때 그 연결의 키를 쓴다. */
export const aiProviderCheckSchema = z.object({
	providerId: z.string().max(60).optional(),
	/** 이름은 확인에 쓰지 않으므로 비어도 된다. */
	provider: aiProviderInputSchema.extend({ name: z.string().max(60) }),
});

export const aiModelsQuerySchema = z.object({
	/** 저장한 연결의 목록. 주소·키는 서버가 채운다. */
	providerId: z.string().max(60).optional(),
	/** 저장하기 전 주소로 목록을 받을 때. */
	url: url.optional(),
	apiKey: z.string().trim().min(1).max(1000).optional(),
});

export interface AiModelInfo {
	id: string;
	name?: string;
}

export type AiCheckResult = { ok: true; ms: number; model: string } | { ok: false; message: string };

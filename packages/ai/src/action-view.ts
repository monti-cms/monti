import {
	type AiActionEditable,
	type AiActionOverride,
	type AiAttach,
	type AiChoices,
	type AiInputKind,
	aiActionOverrideSchema,
	type ResolvedAiAction,
	resolveAction,
} from "./action";
import { type CustomBase, type CustomValue, customDefinition } from "./custom";
import type { AiApply, AiCheck, AiEngine, AiPick, AiResult } from "./definition";

/**
 * 관리자 화면에 보내는 기능의 모양(서버·브라우저 공용). 서버는 저장한 값으로, 관리자 화면은 아직 저장하지 않은 새
 * 화면 기능의 미리보기로 만든다.
 */

/** 관리자 화면에 보내는 기능 하나. 정의의 고정 부분과 지금 값(고친 값을 얹은 것). */
export interface AiActionView extends AiActionEditable {
	key: string;
	label: string;
	result: AiResult;
	apply: AiApply;
	engine: AiEngine;
	pick: AiPick;
	input: Record<string, { kind: AiInputKind; label: string; required: boolean }>;
	choices?: AiChoices;
	attach: readonly AiAttach[];
	checks: AiCheck[];
	/** 기능 정의가 정한 검사(`checkKey`, 끌 수만 있다). 나머지는 관리자 화면에서 더한 검사다. */
	definedChecks: string[];
	/** 코드 검사 이름 → 보이는 이름. 코드 검사는 켜고 끄기만 한다. */
	validatorLabels: Record<string, string>;
	/** 결과를 흘려받는 기능인가. */
	stream: boolean;
	/** 관리자 화면에서 만든 기능(화면 기능)이면 그 기본 정보(이름·붙을 곳·결과 모양). 코드 기능은 없다. */
	custom?: CustomBase;
	/** 고친 값의 버전. 고친 적 없으면 0. */
	version: number;
	updatedAt: string | null;
	/** 기본값과 다른 값 이름. */
	overridden: string[];
}

/** 저장된 고친 값을 읽는다. 모양이 맞지 않는 값은 버린다(정의가 바뀌어 맞지 않게 된 경우). */
export const readOverride = (value: unknown): AiActionOverride => {
	const parsed = aiActionOverrideSchema.safeParse(value);
	return parsed.success ? parsed.data : {};
};

export const viewOf = (
	action: ResolvedAiAction,
	row: { value: unknown; version: number; updatedAt: Date } | undefined,
	custom?: CustomValue,
): AiActionView => ({
	...(custom ? { custom: custom.base } : {}),
	key: action.key,
	label: action.label,
	result: action.result,
	apply: action.apply,
	engine: action.engine,
	pick: action.pick,
	input: Object.fromEntries(
		Object.entries(action.input).map(([name, spec]) => [
			name,
			{ kind: spec.kind, label: spec.label, required: spec.required === true },
		]),
	),
	...(action.choices ? { choices: action.choices } : {}),
	attach: action.attach,
	stream: action.stream,
	enabled: action.enabled,
	askInstruction: action.askInstruction,
	instant: action.instant,
	providerId: action.providerId,
	modelName: action.modelName,
	prompt: action.prompt,
	threshold: action.threshold,
	maxCount: action.maxCount,
	checks: [...action.checks],
	definedChecks: [...action.definedChecks],
	validatorLabels: Object.fromEntries(Object.values(action.validators).map((check) => [check.name, check.label])),
	send: [...action.send],
	version: row?.version ?? 0,
	updatedAt: row ? row.updatedAt.toISOString() : null,
	overridden: Object.keys(custom ? custom.override : readOverride(row?.value)),
});

/** 아직 저장하지 않은 새 화면 기능의 이름(key). 저장할 때 서버가 새 이름을 붙인다. */
export const NEW_CUSTOM_KEY = "custom_new";

/** 저장하지 않은 새 화면 기능의 모양. 관리자 화면이 기본 정보를 고를 때마다 다시 만든다. */
export const draftCustomView = (base: CustomBase): AiActionView =>
	viewOf(resolveAction(NEW_CUSTOM_KEY, customDefinition(base), {}), undefined, { base, override: {} });

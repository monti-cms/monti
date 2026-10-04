"use client";

import { useCallback, useMemo } from "react";
import type { AiActionView } from "../actions";
import type { AiActionInputOf, AiActionKey, AiActionResultOf } from "../registry";
import { type AiRunOptions, runAiAction, runAiActionMany, streamAiAction, useAiActions } from "./ai-slot-provider";

export interface UseAiAction<K extends AiActionKey> {
	/** 켜져 있고 연결이 준비되어 지금 부를 수 있는가. */
	available: boolean;
	/** 기능 정의와 지금 값(이름·추가 요청 받기 등). 목록을 받기 전에는 없다. */
	action: AiActionView | undefined;
	run: (input: AiActionInputOf<K>, options?: AiRunOptions) => Promise<AiActionResultOf<K>>;
	/** 흘려받기로 실행한다(M8-1). 받은 글이 늘 때마다 지금까지 받은 글 전체로 `onText`를 부른다. */
	stream: (
		input: AiActionInputOf<K>,
		options: AiRunOptions & { onText: (text: string) => void },
	) => Promise<AiActionResultOf<K>>;
	/** 같은 기능을 여러 입력에 돌린다(한 요청 최대 8개). 입력마다 결과나 실패 이유가 순서대로 온다. */
	runMany: (
		inputs: readonly AiActionInputOf<K>[],
		options?: AiRunOptions,
	) => Promise<Array<{ result: AiActionResultOf<K> } | { error: string }>>;
}

/**
 * 사이트 설정(`aiPlugin({ actions })`)의 기능을 이름으로 부른다. 이름·입력·결과 타입은 설정에서 나온다.
 *
 * ```ts
 * const summary = useAiAction("summary");
 * const result = await summary.run({ title, body }); // { kind: "text"; text: string }
 * ```
 */
export function useAiAction<K extends AiActionKey>(key: K, enabled = true): UseAiAction<K> {
	const { data } = useAiActions(enabled);
	const action = data?.items.find((item) => item.key === key);
	const available = Boolean(action?.enabled && data?.usable.includes(key));
	const run = useCallback(
		(input: AiActionInputOf<K>, options?: AiRunOptions) =>
			runAiAction(key, input as Record<string, unknown>, options) as Promise<AiActionResultOf<K>>,
		[key],
	);
	const runMany = useCallback(
		(inputs: readonly AiActionInputOf<K>[], options?: AiRunOptions) =>
			runAiActionMany(key, inputs as ReadonlyArray<Record<string, unknown>>, options) as Promise<
				Array<{ result: AiActionResultOf<K> } | { error: string }>
			>,
		[key],
	);
	const stream = useCallback(
		(input: AiActionInputOf<K>, options: AiRunOptions & { onText: (text: string) => void }) =>
			streamAiAction(key, input as Record<string, unknown>, options) as Promise<AiActionResultOf<K>>,
		[key],
	);
	return useMemo(() => ({ available, action, run, runMany, stream }), [available, action, run, runMany, stream]);
}

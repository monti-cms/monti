"use client";

import { Button, Spinner } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import { Sparkles } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import type { AiActionInputOf, AiActionKey, AiActionResultOf } from "../registry";
import { aiCommonMessages } from "./ai-common.messages";
import { useAiAction } from "./use-ai-action";

const t = createTranslator(aiCommonMessages);

export interface AiButtonProps<K extends AiActionKey> {
	/** 부를 기능 이름(사이트 설정의 `aiPlugin({ actions })`). */
	action: K;
	/** 누를 때 읽는 입력. 이름·타입은 기능 정의에서 나온다. */
	input: () => AiActionInputOf<K>;
	/** 결과. 값을 바꿀지는 받는 쪽이 정한다. */
	onResult: (result: AiActionResultOf<K>) => void;
	/** 버튼 글자. 없으면 기능 이름(관리자 AI 화면의 이름)이다. */
	children?: ReactNode;
	className?: string;
}

/**
 * 직접 만든 화면(플러그인 화면·필드 입력 등)에 넣는 AI 버튼. 기능이 꺼져 있거나 연결이 없으면 그리지 않는다.
 *
 * ```tsx
 * <AiButton action="summary" input={() => ({ title, body })} onResult={(result) => setSummary(result.text)} />
 * ```
 */
export function AiButton<K extends AiActionKey>({ action, input, onResult, children, className }: AiButtonProps<K>) {
	const ai = useAiAction(action);
	const [running, setRunning] = useState(false);
	if (!ai.available) return null;
	const label = ai.action?.label ?? action;
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className={className}
			disabled={running}
			onClick={async () => {
				setRunning(true);
				try {
					onResult(await ai.run(input()));
				} catch (error) {
					toast.error(error instanceof Error && error.message ? error.message : t("runFailed"));
				} finally {
					setRunning(false);
				}
			}}
		>
			{running ? <Spinner /> : <Sparkles aria-hidden />}
			{running ? t("running") : (children ?? label)}
		</Button>
	);
}

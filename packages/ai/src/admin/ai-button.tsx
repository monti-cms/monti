"use client";

import { Button, Spinner } from "@monti-cms/admin/kit";
import { type AnyCmsConfig, useTranslator } from "@monti-cms/core/client";
import { Sparkles } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import type { AiActionInputOf, AiActionKey, AiActionResultOf } from "../registry";
import { aiCommonMessages } from "./ai-common.messages";
import { useAiAction } from "./use-ai-action";

export interface AiButtonProps<K extends AiActionKey<Config>, Config extends AnyCmsConfig = AnyCmsConfig> {
	/** Action name to call (`aiPlugin({ actions })` in the site config). */
	action: K;
	/** Input read on click. Names and types come from the action definition. */
	input: () => AiActionInputOf<K, Config>;
	/** Result. The receiver decides whether to change any value. */
	onResult: (result: AiActionResultOf<K, Config>) => void;
	/** Button label. Defaults to the action name (its name in the admin AI screen). */
	children?: ReactNode;
	className?: string;
}

/**
 * AI button for custom screens (plugin screens, field inputs, etc.). Renders nothing if the action is off or has no connection. `aiClient<typeof config>()` gives the
 * button with action names, inputs and results typed by the config.
 *
 * ```tsx
 * <AiButton action="summary" input={() => ({ title, body })} onResult={(result) => setSummary(result.text)} />
 * ```
 */
export function AiButton<K extends AiActionKey<Config>, Config extends AnyCmsConfig = AnyCmsConfig>({
	action,
	input,
	onResult,
	children,
	className,
}: AiButtonProps<K, Config>) {
	const t = useTranslator(aiCommonMessages);
	const ai = useAiAction<K, Config>(action);
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

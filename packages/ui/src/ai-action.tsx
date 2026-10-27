"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { RotateCw } from "lucide-react";
import { cn } from "./cn";
import { useUiLabels } from "./labels";
import { Spark } from "./spark";
import { Spinner } from "./spinner";

/**
 * The assistant's action on one field: "✦ Fill" while the field is empty, "↻ Again" once it has a value. It is a text button set exactly like
 * the field's label, only in the proposal color, and it goes at the right end of the label row (`FormFieldLabel action`). Inside a `FormField`
 * it shows only on the field the pointer or the keyboard is in. The value goes in at once, with no proposal to accept; ⌘Z undoes it.
 * While the request runs (`loading`) a spinner takes the place of ✦ or ↻ and the label says "Writing…"; it cannot be pressed again, it is not dimmed
 * (only `disabled` dims), and it is `aria-busy`.
 */
function AiAction({
	filled = false,
	loading = false,
	disabled,
	className,
	...props
}: Omit<ButtonPrimitive.Props, "children"> & {
	/** The field has a value: the action asks again instead of filling. */
	filled?: boolean;
	/** The request is running: a spinner replaces the mark, the label says it is writing, and the action cannot be pressed again. */
	loading?: boolean;
}) {
	const labels = useUiLabels();
	return (
		<ButtonPrimitive
			data-slot="ai-action"
			type="button"
			data-loading={loading || undefined}
			aria-busy={loading || undefined}
			disabled={disabled || loading}
			className={cn(
				"inline-flex items-center gap-monti-4 whitespace-nowrap border-0 bg-transparent p-0 text-monti-micro text-monti-proposal outline-none transition-opacity focus-visible:rounded-monti-sm focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-monti-proposal/30 disabled:opacity-45 data-loading:cursor-not-allowed data-loading:opacity-100",
				className,
			)}
			{...props}
		>
			{loading ? (
				<Spinner className="size-2.5" />
			) : filled ? (
				<RotateCw aria-hidden className="size-3 shrink-0" strokeWidth={1.8} />
			) : (
				<Spark className="size-monti-icon-xs" />
			)}
			{loading ? labels.aiWorking : filled ? labels.aiAgain : labels.aiFill}
		</ButtonPrimitive>
	);
}

export { AiAction };

"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { RotateCw } from "lucide-react";
import { cn } from "./cn";
import { useUiLabels } from "./labels";

/** The AI mark: a four-point spark. */
export function Spark({ className }: { className?: string }) {
	return (
		<svg
			data-slot="spark"
			aria-hidden="true"
			focusable="false"
			viewBox="0 0 16 16"
			fill="currentColor"
			className={cn("size-3 shrink-0", className)}
		>
			<path d="M8 1.5l1.7 4.8 4.8 1.7-4.8 1.7L8 14.5l-1.7-4.8L1.5 8l4.8-1.7z" />
		</svg>
	);
}

/**
 * The assistant's action on one field: "✦ Fill" while the field is empty, "↻ Again" once it has a value. It is a text button set exactly like
 * the field's label, only in the proposal color, and it goes at the right end of the label row (`FormFieldLabel action`). Inside a `FormField`
 * it shows only on the field the pointer or the keyboard is in. The value goes in at once, with no proposal to accept; ⌘Z undoes it.
 */
function AiAction({
	filled = false,
	className,
	...props
}: Omit<ButtonPrimitive.Props, "children"> & {
	/** The field has a value: the action asks again instead of filling. */
	filled?: boolean;
}) {
	const labels = useUiLabels();
	return (
		<ButtonPrimitive
			data-slot="ai-action"
			type="button"
			className={cn(
				"inline-flex items-center gap-monti-4 whitespace-nowrap border-0 bg-transparent p-0 text-monti-micro text-monti-proposal outline-none transition-opacity focus-visible:rounded-monti-sm focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-monti-proposal/30 disabled:opacity-45",
				className,
			)}
			{...props}
		>
			{filled ? <RotateCw aria-hidden className="size-3 shrink-0" strokeWidth={1.8} /> : <Spark />}
			{filled ? labels.aiAgain : labels.aiFill}
		</ButtonPrimitive>
	);
}

export { AiAction };

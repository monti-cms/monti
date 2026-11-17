import { cn } from "./cn";

/**
 * The fold-out mark after a text button that opens a list (filter, sort, changed places, move to folder, pick a model). 12px, 6px from the text and
 * centered on it. Use `solo` when the caret is all the button holds, and `ink` on a dark surface where it follows the text color.
 * A text character ▾ is too small and reads as decoration, so it is not used.
 */
export function Caret({ solo = false, ink = false, className }: { solo?: boolean; ink?: boolean; className?: string }) {
	return (
		<svg
			data-slot="caret"
			aria-hidden="true"
			focusable="false"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={cn(
				"inline-block size-3 shrink-0 align-[-1px]",
				solo ? "ml-0" : "ml-monti-6",
				ink ? "text-current" : "text-monti-subtle",
				className,
			)}
		>
			<path d="M4 6l4 4 4-4" />
		</svg>
	);
}

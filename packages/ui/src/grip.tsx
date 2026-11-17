import { cn } from "./cn";

/** The six dots a thing is dragged by. It takes the color of the text around it. */
function Grip({ className }: { className?: string }) {
	return (
		<svg
			data-slot="grip"
			aria-hidden="true"
			focusable="false"
			width="8"
			height="13"
			viewBox="0 0 8 13"
			fill="currentColor"
			className={cn("shrink-0", className)}
		>
			<circle cx="2" cy="2" r="1.2" />
			<circle cx="6" cy="2" r="1.2" />
			<circle cx="2" cy="6.5" r="1.2" />
			<circle cx="6" cy="6.5" r="1.2" />
			<circle cx="2" cy="11" r="1.2" />
			<circle cx="6" cy="11" r="1.2" />
		</svg>
	);
}

export { Grip };

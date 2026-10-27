import { cn } from "./cn";

/**
 * The working mark: a 14px ring in the ink of the text beside it, with its right quarter open, turning once a second (once every three seconds
 * when the system asks for less motion). It is decorative: the words beside it say what is happening, and the control that shows it carries
 * `aria-busy`. A `Button`, a `SplitButton` and an `AiAction` show it themselves while they are `loading`; use it directly only next to a status line.
 */
function Spinner({ className }: { className?: string }) {
	return (
		<span
			data-slot="spinner"
			aria-hidden="true"
			className={cn(
				"inline-block size-3.5 shrink-0 animate-spin rounded-monti-full border-[1.5px] border-current border-r-transparent motion-reduce:[animation-duration:3s]",
				className,
			)}
		/>
	);
}

export { Spinner };

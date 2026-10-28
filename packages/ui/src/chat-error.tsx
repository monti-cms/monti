import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/**
 * An answer that could not be given, in the conversation itself: a red line on the left, the problem in one bold red line, one grey line that says
 * what happened (which key, how much was spent, when it opens again), and what can be done next (`actions`, text buttons). Sending is never blocked
 * beforehand; this is what comes back after.
 */
function ChatError({
	title,
	actions,
	className,
	children,
	...props
}: Omit<ComponentProps<"div">, "title"> & {
	title: ReactNode;
	/** One or two text buttons. */
	actions?: ReactNode;
	/** The one grey line. */
	children?: ReactNode;
}) {
	return (
		<div
			data-slot="chat-error"
			role="alert"
			className={cn("flex flex-col gap-monti-4 border-monti-danger border-l-2 pl-monti-12", className)}
			{...props}
		>
			<span className="font-semibold text-monti-body text-monti-danger">{title}</span>
			{children && <span className="text-monti-muted text-monti-note">{children}</span>}
			{actions && <span className="mt-monti-6 flex items-center gap-monti-16 text-monti-note">{actions}</span>}
		</div>
	);
}

export { ChatError };

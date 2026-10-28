import type * as React from "react";
import { cn } from "./cn";

/** A quiet line led by a 6px dot, 8px before its words: the state of what a panel shows ("In the trash · 3 days left · Read only"). */
function DotNote({ className, children, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="dot-note"
			className={cn("m-0 flex items-center gap-monti-8 text-monti-note text-monti-subtle", className)}
			{...props}
		>
			<span aria-hidden="true" className="size-1.5 shrink-0 rounded-monti-full bg-current" />
			{children}
		</p>
	);
}

export { DotNote };

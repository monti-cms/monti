import { Locked } from "@carbon/icons-react";
import { cn } from "./cn";

/**
 * The lock after a read-only value or a section title: this cannot be changed. 12px and faint, 6px from the text before it. `label` names it for screen
 * readers ("cannot be changed"); the meaning is in the name, never in the icon alone. `flush` drops the margin where a row already spaces it (beside a label).
 */
function LockMark({ label, flush = false, className }: { label: string; flush?: boolean; className?: string }) {
	return (
		<Locked
			data-slot="lock-mark"
			role="img"
			aria-label={label}
			className={cn("inline-block size-3 shrink-0 align-middle text-monti-faint", !flush && "ml-monti-6", className)}
		/>
	);
}

export { LockMark };

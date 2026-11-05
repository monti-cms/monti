import { cn } from "./cn";
import { Locked } from "./icons";

/**
 * The lock after a read-only value or its row's label: this cannot be changed. It goes on the locked row, never on a section title. 12px and faint, 6px from the text before it. `label` names it for screen
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

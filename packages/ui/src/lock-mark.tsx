import { cn } from "./cn";
import { Locked } from "./icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * The lock after a read-only value or its row's label: this cannot be changed. It goes on the locked row, never on a section title. 12px and faint, 6px from the text before it. `label` says why
 * ("locked on the live site", "cannot be changed"): a screen reader hears it as the mark's name, and a pointer on the mark reads it in a tooltip (2026-11-12, owner: the reason reaches the
 * one who looks, too). The meaning is in the name, never in the icon alone. It is no stop of the Tab key. `flush` drops the margin where a row already spaces it (beside a label).
 */
function LockMark({ label, flush = false, className }: { label: string; flush?: boolean; className?: string }) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Locked
						data-slot="lock-mark"
						role="img"
						aria-label={label}
						className={cn(
							"inline-block size-3 shrink-0 align-middle text-monti-faint",
							!flush && "ml-monti-6",
							className,
						)}
					/>
				}
			/>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

export { LockMark };

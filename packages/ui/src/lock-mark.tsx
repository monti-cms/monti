import { cn } from "./cn";
import { Locked } from "./icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * The lock after a read-only value or its row's label: this cannot be changed. It goes on the locked row, never on a section title. 12px and faint, 6px from the text before it. `label` says why
 * ("locked on the live site", "cannot be changed"): a screen reader hears it as the mark's name, and it is read in a tooltip by a pointer on the mark and by the keyboard, which stops on it
 * (2026-11-13, decided while building: the reason reaches the one who looks and uses no pointer, too; WCAG 1.4.13). The meaning is in the name, never in the icon alone. `flush` drops the
 * margin where a row already spaces it; after a `Label`'s words the label's own gap is taken off, so it still stands 6px from them.
 */
function LockMark({ label, flush = false, className }: { label: string; flush?: boolean; className?: string }) {
	const named = label.trim() !== "";
	const mark = (
		<span
			data-slot="lock-mark"
			role="img"
			aria-label={label}
			// A stop of the Tab key while it has something to say: its tooltip opens on the keyboard's focus as on the pointer.
			tabIndex={named ? 0 : undefined}
			className={cn(
				"inline-flex size-3 shrink-0 rounded-monti-sm align-middle text-monti-faint outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/50",
				!flush && "ml-monti-6",
				className,
			)}
		>
			<Locked aria-hidden className="size-full" />
		</span>
	);
	// No tooltip without words: an empty one would be a bare black pill.
	if (!named) return mark;
	return (
		<Tooltip>
			<TooltipTrigger render={mark} />
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

export { LockMark };

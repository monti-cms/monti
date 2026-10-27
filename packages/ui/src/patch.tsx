import type { ComponentProps } from "react";
import { cn } from "./cn";
import { TextButton } from "./text-button";

/** One line of a patch: kept (`same`), taken out (`remove`) or put in (`add`). */
export interface PatchLine {
	readonly type: "same" | "add" | "remove";
	readonly text: string;
}

/**
 * What changes in one file, line by line: the file's name (mono) and how many lines are added in the head, then the lines. Added lines have a green
 * background and a +, removed lines a red one and a −; the lines around them are dimmed. `actionLabel` is one text button at the end of the head
 * (copy).
 */
function Patch({
	file,
	lines,
	actionLabel,
	onAction,
	className,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	file: string;
	lines: readonly PatchLine[];
	actionLabel?: string;
	onAction?: () => void;
}) {
	const added = lines.filter((line) => line.type === "add").length;
	return (
		<div
			data-slot="patch"
			className={cn("overflow-hidden rounded-monti-lg border border-monti-default bg-monti-page", className)}
			{...props}
		>
			<div className="flex h-10 items-center gap-monti-12 border-monti-muted border-b pr-monti-6 pl-monti-12 text-monti-note">
				<span className="min-w-0 grow truncate text-monti-meta text-monti-muted">{file}</span>
				{added > 0 && <span className="text-monti-meta text-monti-success">+{added}</span>}
				{actionLabel && (
					<TextButton type="button" onClick={onAction}>
						{actionLabel}
					</TextButton>
				)}
			</div>
			<pre className="m-0 overflow-auto py-monti-6 text-monti-meta">
				{lines.map((line, index) => (
					<span
						key={index}
						data-type={line.type}
						className={cn(
							"block whitespace-pre px-monti-12 py-monti-2 text-monti-subtle",
							line.type === "add" && "bg-monti-success-muted text-monti-default",
							line.type === "remove" && "bg-monti-danger-muted text-monti-muted",
						)}
					>
						<span
							aria-hidden
							className={cn(
								"select-none text-monti-faint",
								line.type === "add" && "text-monti-success",
								line.type === "remove" && "text-monti-danger",
							)}
						>
							{line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}
						</span>
						{line.text}
					</span>
				))}
			</pre>
		</div>
	);
}

export { Patch };

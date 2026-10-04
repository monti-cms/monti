import { Children, type ReactNode, useId } from "react";

const dropLeadingNewline = (lines: ReactNode[]) => {
	const first = lines[0];
	if (typeof first !== "string" || !first.startsWith("\n")) return lines;
	const trimmed = first.slice(1);
	return trimmed ? [trimmed, ...lines.slice(1)] : lines.slice(1);
};

/** Code line folding (the `collapse` line effect). The first line is the title and the rest show when expanded. */
export function CmsCodeCollapse({ children, open }: { children: ReactNode; open?: boolean }) {
	const nodes = Children.toArray(children);
	let first = 0;
	while (first < nodes.length && typeof nodes[first] === "string" && (nodes[first] as string).trim() === "") first += 1;
	const lines = nodes.slice(first);
	const rest = dropLeadingNewline(lines.slice(1));
	return (
		<details className="cms-code-collapse" open={open}>
			<summary>{lines[0] ?? null}</summary>
			{rest.length > 0 ? <div>{rest}</div> : null}
		</details>
	);
}

/** Folding text inside code (the `fold` line effect). Clicking `...` expands it (no script needed). */
export function CmsCodeFold({
	children,
	open,
	label = "Show folded code",
}: {
	children: ReactNode;
	open?: boolean;
	label?: string;
}) {
	const id = useId();
	return (
		<span className="cms-code-fold">
			<input id={id} type="checkbox" aria-label={label} defaultChecked={open} />
			<label htmlFor={id} className="cms-code-fold-closed">
				...
			</label>
			<label htmlFor={id} className="cms-code-fold-open">
				{children}
			</label>
		</span>
	);
}

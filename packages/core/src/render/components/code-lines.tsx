import { Children, type ReactNode, useId } from "react";

const dropLeadingNewline = (lines: ReactNode[]) => {
	const first = lines[0];
	if (typeof first !== "string" || !first.startsWith("\n")) return lines;
	const trimmed = first.slice(1);
	return trimmed ? [trimmed, ...lines.slice(1)] : lines.slice(1);
};

/** 코드 줄 접기(`collapse` 줄 효과). 첫 줄이 제목이고 나머지는 펼치면 보인다. */
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

/** 코드 안 글자 접기(`fold` 줄 효과). `...`을 누르면 펼친다(스크립트 없이). */
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

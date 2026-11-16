import { CodeArea, CodeFrame, CodeGround, CodeNumber, CompareBody, Text } from "../../index";

/**
 * A code block of a reference board, drawn as a body draws one (`ReadBody`): the editor's frame in its `data-block="codeBlock"`, 12px lines
 * (`compact`), numbered. It stands in a `CompareBody`, which gives it the body's spacing.
 */
export function RefCode({
	code,
	language = "tsx",
	ground,
}: {
	code: string;
	language?: string;
	ground?: "page" | "tool";
}) {
	const lines = code.split("\n");
	return (
		<CompareBody ground={ground}>
			<div data-block="codeBlock">
				<CodeFrame
					head={
						<Text variant="caption" tone="muted">
							{language}
						</Text>
					}
				>
					<CodeArea
						compact
						gutter={lines.map((line, at) => <CodeNumber compact readOnly key={`${at}:${line}`} number={at + 1} />)}
						grounds={lines.map((line, at) => <CodeGround compact key={`${at}:${line}`} />)}
					>
						{code}
					</CodeArea>
				</CodeFrame>
			</div>
		</CompareBody>
	);
}

/** A table of a reference board as the editor's table: a grid under the body's classes, its head cells in `th`. */
export function RefTable({
	head,
	rows,
	ground,
}: {
	head: readonly string[];
	rows: readonly (readonly string[])[];
	ground?: "page" | "tool";
}) {
	return (
		<CompareBody ground={ground}>
			<table>
				<tbody>
					<tr>
						{head.map((name) => (
							<th key={name}>{name}</th>
						))}
					</tr>
					{rows.map((row) => (
						<tr key={row.join("\t")}>
							{row.map((value, at) => (
								<td key={`${at}:${value}`}>{value}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</CompareBody>
	);
}

/**
 * A callout of a reference board: the design system does not know the site's blocks, so it is drawn as a body draws a block it has no drawing for, the
 * box (`data-box`) with the block's name, its title and its words inside.
 */
export function RefCallout({
	title,
	lines,
	ground,
}: {
	title: string;
	lines: readonly string[];
	ground?: "page" | "tool";
}) {
	return (
		<CompareBody ground={ground}>
			<div data-whole="" data-box="" data-block="callout">
				콜아웃 · {title} · {lines.join(" ")}
			</div>
		</CompareBody>
	);
}

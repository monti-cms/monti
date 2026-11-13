import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronDown, ChevronRight } from "./icons";
import {
	CodeArea,
	CodeFrame,
	CodeGround,
	CodeLine,
	CodeMark,
	CodeNumber,
	CodeRefText,
	CodeToken,
	IconButton,
	Text,
	TextButton,
} from "./index";

/** A code block in the editor (doc 17): the box, its head row (language and file name), the numbers' column, the lines' grounds and the code. */
const meta = {
	title: "Monti/EditorTools/CodeFrame",
	component: CodeFrame,
} satisfies Meta<typeof CodeFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

const head = (
	<>
		<Text variant="caption" tone="muted">
			TypeScript
		</Text>
		<Text variant="caption" mono>
			src/counter.ts
		</Text>
	</>
);

const LINES = [
	"function count(list: number[]) {",
	"  let total = 0;",
	"  for (const n of list) {",
	"    total += n;",
	"  }",
	"  return total;",
	"}",
];

/**
 * The code being written: lines 2–3 picked (one ground, no gap between them), a fold over lines 3–5 with its bracket, line 6 added, line 7 a warning.
 */
export const Editing: Story = {
	args: {
		head,
		children: (
			<CodeArea
				picking
				gutter={LINES.map((_, line) => (
					<CodeNumber
						key={LINES[line]}
						number={line + 1}
						folds
						tone={line === 1 || line === 2 ? "picked" : line === 5 ? "plus" : undefined}
						mark={line === 5 ? "+" : undefined}
						edge={line === 2 ? "start" : line === 3 ? "middle" : line === 4 ? "end" : undefined}
						fold={
							line === 2 ? (
								<IconButton size="xs" label="3번째 줄부터 접기">
									<ChevronDown aria-hidden />
								</IconButton>
							) : undefined
						}
					/>
				))}
				grounds={LINES.map((text, line) => (
					<CodeGround key={text} tone={line === 1 || line === 2 ? "picked" : line === 5 ? "plus" : undefined} />
				))}
			>
				<div>
					<span data-token="" style={{ "--shiki-light": "#d73a49" } as React.CSSProperties}>
						function
					</span>
					{` count(list: number[]) {\n  let total = 0;\n  for (const n of list) {\n    total += n;\n  }\n  return total;\n`}
					<span data-wavy="warning">{"}"}</span>
				</div>
			</CodeArea>
		),
	},
};

/** A closed fold: its first line stays with its button turned, the summary of what is hidden after it. */
export const Folded: Story = {
	args: {
		head,
		children: (
			<CodeArea
				gutter={[0, 1, 2, 5, 6].map((line) => (
					<CodeNumber
						key={line}
						number={line + 1}
						folds
						fold={
							line === 2 ? (
								<IconButton size="xs" label="3번째 줄부터 펼치기">
									<ChevronRight aria-hidden />
								</IconButton>
							) : undefined
						}
					/>
				))}
				grounds={[0, 1, 2, 5, 6].map((line) => <CodeGround key={line} />)}
			>
				<div>
					{`function count(list: number[]) {\n  let total = 0;\n  for (const n of list) { `}
					<TextButton size="caption">접힌 2줄</TextButton>
					{"\n  return total;\n}"}
				</div>
			</CodeArea>
		),
	},
};

/** Read-only rows (a comparison): numbers fainter where the site hides them, a fold's button, the code's own marks. */
export const Rows: Story = {
	args: {
		head,
		children: (
			<div className="py-monti-8">
				<CodeLine number={1} readOnly numbersOff>
					<CodeToken light="#d73a49">const</CodeToken> a = <CodeToken light="#005cc5">1</CodeToken>
					{";"}
				</CodeLine>
				<CodeLine number={2} readOnly numbersOff tone="highlight" wavy="error">
					<CodeMark kind="tip">a tooltip</CodeMark> <CodeMark kind="fold">folded words</CodeMark>{" "}
					<CodeMark kind="bold">bold</CodeMark>
				</CodeLine>
				<CodeLine number={3} readOnly numbersOff tone="minus" mark="−">
					removed
				</CodeLine>
			</div>
		),
	},
};

/** Words of the text pointing at code lines: linked, broken, picked first while linking. */
export const CodeLinks: Story = {
	render: () => (
		<Text as="p" variant="reading">
			<CodeRefText>이 줄</CodeRefText>, <CodeRefText state="broken">없는 줄</CodeRefText>,{" "}
			<CodeRefText state="picking">고르는 중</CodeRefText>
		</Text>
	),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronDown, Copy, ListNumbered, Row, TypePattern } from "./icons";
import {
	Caret,
	CodeFileTab,
	CodeFrame,
	CodeLine,
	CodeMark,
	CodeRefText,
	CodeToken,
	IconButton,
	Inline,
	Input,
	Text,
	TextButton,
} from "./index";

/** A code block in the editor (doc 17): the box, its head row, the file name's tab, lines with their effects and marks. */
const meta = {
	title: "Monti/EditorTools/CodeFrame",
	component: CodeFrame,
} satisfies Meta<typeof CodeFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

const head = (
	<>
		<TextButton size="caption">
			TypeScript
			<Caret />
		</TextButton>
		<Inline gap={2}>
			<IconButton size="xs" label="줄 효과">
				<Row aria-hidden />
			</IconButton>
			<IconButton size="xs" label="정규식 규칙">
				<TypePattern aria-hidden />
			</IconButton>
			<IconButton size="xs" label="줄 번호" pressed>
				<ListNumbered aria-hidden />
			</IconButton>
			<IconButton size="xs" label="코드 복사">
				<Copy aria-hidden />
			</IconButton>
		</Inline>
	</>
);

/** Every line look: plain, a mark, the effects' grounds, picked, lit, a wavy line, a linked line, a fold's button, folded lines. */
export const Lines: Story = {
	args: {
		tab: (
			<CodeFileTab>
				<Input appearance="inline" size="sm" mono width="fit" aria-label="파일 이름" defaultValue="src/counter.ts" />
			</CodeFileTab>
		),
		head,
		children: (
			<>
				<CodeLine number={1} folds>
					<CodeToken light="#d73a49">const</CodeToken> a = <CodeToken light="#005cc5">1</CodeToken>
					{";"}
				</CodeLine>
				<CodeLine number={2} folds mark="›">
					focus
				</CodeLine>
				<CodeLine number={3} folds tone="highlight" linked>
					highlight, linked
				</CodeLine>
				<CodeLine number={4} folds tone="minus" mark="−">
					removed
				</CodeLine>
				<CodeLine number={5} folds tone="plus" mark="+">
					added
				</CodeLine>
				<CodeLine number={6} folds tone="picked">
					picked by its number
				</CodeLine>
				<CodeLine number={7} folds tone="lit">
					lit by a code link
				</CodeLine>
				<CodeLine number={8} folds wavy="warning">
					a warning
				</CodeLine>
				<CodeLine number={9} folds wavy="error">
					an error
				</CodeLine>
				<CodeLine
					number={10}
					folds
					fold={
						<IconButton size="xs" label="10번째 줄부터 접기">
							<ChevronDown aria-hidden />
						</IconButton>
					}
				>
					<CodeMark kind="tip">a tooltip</CodeMark> <CodeMark kind="fold">folded words</CodeMark>{" "}
					<CodeMark kind="bold">bold</CodeMark> <CodeMark kind="picked">picked</CodeMark>
				</CodeLine>
				<CodeLine folds>
					<TextButton size="caption">접힌 3줄</TextButton>
				</CodeLine>
			</>
		),
	},
};

/** Read-only, numbers hidden on the site: no pointer on the numbers, fainter numbers. */
export const ReadOnly: Story = {
	args: {
		head: (
			<Text variant="caption" tone="muted">
				TypeScript
			</Text>
		),
		children: (
			<>
				<CodeLine number={1} readOnly numbersOff>
					const a = 1;
				</CodeLine>
				<CodeLine number={2} readOnly numbersOff>
					const b = 2;
				</CodeLine>
			</>
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

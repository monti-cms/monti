import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock, DiffMark, DiffView } from "./code-block";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Layout/CodeBlock",
	component: CodeBlock,
	args: { wrap: true, maxHeight: "list", size: "caption", children: SAMPLE() },
} satisfies Meta<typeof CodeBlock>;
export default meta;
type Story = StoryObj<typeof meta>;

function SAMPLE() {
	return JSON.stringify({ 제목: "여름 여행 기록", 상태: "초안", 태그: ["여행", "일상"] }, null, 2);
}

const LONG_LINE = `{"설명":"${"아주 긴 한 줄의 값입니다. ".repeat(12)}"}`;
const MANY_LINES = Array.from({ length: 60 }, (_, i) => `${i + 1}번째 줄`).join("\n");

export const Playground: Story = {};

export const Wrap: Story = {
	render: () => (
		<Stack gap={12}>
			{[true, false].map((wrap) => (
				<Stack key={String(wrap)} gap={4}>
					<Text variant="label" tone="muted">
						wrap {String(wrap)}
					</Text>
					<CodeBlock wrap={wrap}>{LONG_LINE}</CodeBlock>
				</Stack>
			))}
		</Stack>
	),
};

export const MaxHeight: Story = {
	render: () => (
		<Stack direction="row" gap={12} align="start">
			{(["list", "half", "none"] as const).map((maxHeight) => (
				<Stack key={maxHeight} gap={4} className="min-w-0 flex-1">
					<Text variant="label" tone="muted">
						maxHeight {maxHeight}
					</Text>
					<CodeBlock maxHeight={maxHeight}>{MANY_LINES}</CodeBlock>
				</Stack>
			))}
		</Stack>
	),
};

export const Size: Story = {
	render: () => (
		<Stack gap={12}>
			{(["caption", "label"] as const).map((size) => (
				<Stack key={size} gap={4}>
					<Text variant="label" tone="muted">
						size {size}
					</Text>
					<CodeBlock size={size}>{SAMPLE()}</CodeBlock>
				</Stack>
			))}
		</Stack>
	),
};

const DIFF_LINES = [
	{ type: "same", text: "---" },
	{ type: "remove", text: "title: 여름 여행" },
	{ type: "add", text: "title: 여름 여행 기록" },
	{ type: "same", text: "status: 초안" },
	{ type: "add", text: "tags: [여행, 일상]" },
	{ type: "same", text: "---" },
	{ type: "remove", text: "오래된 첫 문단입니다." },
	{ type: "add", text: "새로 고쳐 쓴 첫 문단입니다." },
] as const;

/** Every line type: same, remove, add. */
export const Diff: Story = {
	render: () => <DiffView lines={DIFF_LINES} />,
};

export const DiffLineTypes: Story = {
	render: () => (
		<Stack gap={12}>
			{(["same", "remove", "add"] as const).map((type) => (
				<Stack key={type} gap={4}>
					<Text variant="label" tone="muted">
						type {type}
					</Text>
					<DiffView lines={[{ type, text: "여름 여행 기록" }]} />
				</Stack>
			))}
		</Stack>
	),
};

/** Marks inside a sentence: a suggested rewrite. */
export const Marks: Story = {
	render: () => (
		<Stack gap={12}>
			{(["remove", "add"] as const).map((type) => (
				<Stack key={type} gap={4}>
					<Text variant="label" tone="muted">
						DiffMark {type}
					</Text>
					<Text>
						오늘은 <DiffMark type={type}>맑은 하루</DiffMark>였다.
					</Text>
				</Stack>
			))}
			<Text>
				오늘은 <DiffMark type="remove">흐린</DiffMark>
				<DiffMark type="add">맑은</DiffMark> 하루였다.
			</Text>
		</Stack>
	),
};

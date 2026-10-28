import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock } from "./code-block";
import { Stack } from "./stack";
import { StoryCaption } from "./story-caption";

const meta = {
	title: "Primitives/CodeBlock",
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
					<StoryCaption>wrap {String(wrap)}</StoryCaption>
					<CodeBlock wrap={wrap}>{LONG_LINE}</CodeBlock>
				</Stack>
			))}
		</Stack>
	),
};

export const MaxHeight: Story = {
	render: () => (
		<Stack gap={24}>
			{(["list", "half", "none"] as const).map((maxHeight) => (
				<Stack key={maxHeight} gap={4}>
					<StoryCaption>
						maxHeight {maxHeight} ({{ list: "384px", half: "half the window", none: "no limit" }[maxHeight]})
					</StoryCaption>
					<CodeBlock maxHeight={maxHeight}>{MANY_LINES}</CodeBlock>
				</Stack>
			))}
		</Stack>
	),
};

export const Size: Story = {
	render: () => (
		<Stack gap={12}>
			{(["caption", "note"] as const).map((size) => (
				<Stack key={size} gap={4}>
					<StoryCaption>size {size}</StoryCaption>
					<CodeBlock size={size}>{SAMPLE()}</CodeBlock>
				</Stack>
			))}
		</Stack>
	),
};

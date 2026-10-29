import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { StoryCaption } from "./story-caption";
import { Textarea } from "./textarea";

const meta = {
	title: "Controls/Field/Textarea",
	component: Textarea,
	args: { placeholder: "글 요약" },
	decorators: [
		(Story) => (
			<Stack className="max-w-sm">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
	render: () => (
		<Stack gap={16}>
			<Stack gap={4}>
				<StoryCaption>placeholder</StoryCaption>
				<Textarea placeholder="글 요약" />
			</Stack>
			<Stack gap={4}>
				<StoryCaption>filled, grows with content</StoryCaption>
				<Textarea
					defaultValue={
						"검색 결과와 공유 카드에 보이는 요약이에요.\n두 줄이 넘어가면 입력창이 같이 늘어납니다.\n세 번째 줄."
					}
				/>
			</Stack>
			<Stack gap={4}>
				<StoryCaption>disabled</StoryCaption>
				<Textarea disabled defaultValue="수정할 수 없는 요약" />
			</Stack>
			<Stack gap={4}>
				<StoryCaption>proposal (written by the assistant, not yet touched)</StoryCaption>
				<Textarea proposal defaultValue="어시스턴트가 쓴 요약" />
			</Stack>
			<Stack gap={4}>
				<StoryCaption>invalid</StoryCaption>
				<Textarea aria-invalid defaultValue="너무 긴 요약" />
			</Stack>
		</Stack>
	),
};

/** `tall` keeps two lines of height while the text is short, like the help text of a field; it still grows past that. */
export const Tall: Story = {
	render: () => (
		<Stack gap={12} className="max-w-sm">
			<Textarea tall placeholder="도움말" />
			<Textarea tall defaultValue={"결론을 먼저, 120자 안으로.\n두 번째 줄.\n세 번째 줄."} />
		</Stack>
	),
};

/** `sm` writes at the note size for compact panels; `mono` for code and source text. */
export const SizesAndMono: Story = {
	render: () => (
		<Stack gap={12} className="max-w-sm">
			<Textarea size="sm" placeholder="작게: 패널 안의 메모" />
			<Textarea mono defaultValue={"export const a = 1;\nexport const b = 2;"} />
		</Stack>
	),
};

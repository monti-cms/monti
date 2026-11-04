import type { Meta, StoryObj } from "@storybook/react-vite";
import { Banner, TextButton } from "./index";

/** A one-line notice across the top of a pane: cream ground, a rule below, a dot before the sentence, and what can be done at the right end. */
const meta = {
	title: "Patterns/Frame/Banner",
	component: Banner,
	parameters: { bleed: true },
} satisfies Meta<typeof Banner>;
export default meta;
type Story = StoryObj<typeof meta>;

const actions = (
	<>
		<TextButton variant="underline">비교</TextButton>
		<TextButton>확인</TextButton>
	</>
);

/** `warning` (the default): something to know about the whole page, with a small mono detail. */
export const Warning: Story = {
	args: { title: "한국어 원문이 바뀌었어요", meta: "10. 26 · 블록 2개", children: actions },
};

/** `danger`: something failed. */
export const Danger: Story = {
	args: {
		tone: "danger",
		title: "전달하지 못했어요",
		meta: "webhook · 503",
		children: <TextButton variant="underline">다시 보내기</TextButton>,
	},
};

/** `neutral`: a state that is neither; the detail is a plain sentence. */
export const Neutral: Story = {
	args: {
		tone: "neutral",
		title: "휴지통에 있는 글이에요",
		meta: "복원하면 초안으로 돌아와요",
		children: <TextButton variant="underline">복원</TextButton>,
	},
};

/** `plainMeta` makes the detail a sentence on any tone. */
export const PlainMeta: Story = {
	args: { title: "이 글은 저장할 수 없어요", meta: "필수 필드 2개가 비어 있어요", plainMeta: true },
};

/** `lines`: several sentences, one per line, each with its dot (the warnings of one block). */
export const Lines: Story = {
	args: { lines: ["대체 텍스트가 없어요", "이미지가 1600px보다 커서 줄여서 올려요"] },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Banner, Box, TextButton } from "./index";

/** A one-line notice across the very top of a screen: cream ground, a rule below, a dot before the sentence, and what can be done at the right end. */
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
	args: { title: "한국어 원문 변경", meta: "10. 26 · 블록 2개", children: actions },
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
		title: "휴지통에 있는 글입니다",
		meta: "복원하면 초안으로 돌아와요",
		children: <TextButton variant="underline">복원</TextButton>,
	},
};

/** `plainMeta` makes the detail a sentence on any tone. */
export const PlainMeta: Story = {
	args: { title: "이 글은 저장할 수 없습니다", meta: "필수 필드 2개가 비어 있어요", plainMeta: true },
};

/**
 * A sentence longer than the line (a server's reason for a refused save): it does not wrap or run out of the frame. It ends in "…", the action
 * stays whole at the right end, and a pointer on the sentence reads it whole.
 */
export const LongSentence: Story = {
	args: {
		tone: "danger",
		title:
			"저장하지 못했습니다. 게시글 컬렉션의 공개 주소 /posts/:slug 를 메모 컬렉션이 이미 쓰고 있고, 미리보기 주소 /preview/:slug 는 다른 컬렉션의 미리보기 주소와 같아서 구조를 적용할 수 없습니다.",
		children: <TextButton>다시 저장</TextButton>,
	},
	decorators: [(Story) => <Box width="sheet">{Story()}</Box>],
};

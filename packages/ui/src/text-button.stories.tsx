import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { TextButton } from "./text-button";

/** The text of an action inside a section: add, edit, cancel, go to. No box; the color and a 1px rule say what it is. */
const meta = {
	title: "Controls/TextButton",
	component: TextButton,
	args: { children: "취소" },
} satisfies Meta<typeof TextButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Plain, underline (goes somewhere or opens something), quiet (less important) and danger (a risky second choice). */
export const Variants: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center" wrap>
			<TextButton>취소</TextButton>
			<TextButton variant="underline">목록에서 보기 →</TextButton>
			<TextButton variant="quiet">+ 묶음 추가</TextButton>
			<TextButton variant="danger">저장하지 않고 나가기</TextButton>
			<TextButton disabled>막힘</TextButton>
		</Stack>
	),
};

/** As a link, with `render`; `mono` for an address. */
export const AsLink: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			<TextButton variant="underline" href="#top">
				열기
			</TextButton>
			<TextButton variant="underline" mono href="#top">
				/first-post
			</TextButton>
		</Stack>
	),
};

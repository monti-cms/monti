import { SettingsAdjust, Upload } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box } from "./box";
import { Stack } from "./stack";
import { Text } from "./text";
import { TextButton } from "./text-button";

/** The text of an action inside a section: add, edit, cancel, go to. No box; the color and a 1px rule say what it is. */
const meta = {
	title: "Controls/Button/TextButton",
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
			<span className="text-monti-note text-monti-warning">
				가리키는 글 4편 <TextButton variant="inherit">연결 끊기</TextButton>
			</span>
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

/** An icon before the text sits on the same line, 14px with a 6px gap. */
export const WithIcon: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			<TextButton variant="quiet">
				<SettingsAdjust aria-hidden />
				보기
			</TextButton>
			<TextButton>
				<Upload aria-hidden />
				올리기
			</TextButton>
		</Stack>
	),
};

/** Inside a sentence the text sits on the text's own baseline, and an icon does not lift the line. */
export const InRunningText: Story = {
	render: () => (
		<Box maxWidth="panel">
			<Text variant="body">
				글이 아직 저장되지 않았어요. <TextButton variant="underline">목록에서 보기 →</TextButton> 또는{" "}
				<TextButton variant="quiet">
					<Upload aria-hidden />
					올리기
				</TextButton>
				를 눌러 이어서 하세요.
			</Text>
		</Box>
	),
};

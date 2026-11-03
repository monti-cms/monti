import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, ErrorNote, TextButton } from "./index";

/** Something that failed, where it failed (an answer in the conversation, a change a screen could not apply): a red line on the left, the problem in one bold red line, one grey line, then what can be done. */
const meta = {
	title: "Controls/Status/ErrorNote",
	component: ErrorNote,
	args: { title: "Anthropic 크레딧이 부족해요" },
	decorators: [
		(Story) => (
			<Box width="assistant" padding={24}>
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof ErrorNote>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The service refused: send the same message with another model. */
export const Refused: Story = {
	args: {
		title: "Anthropic 크레딧이 부족해요",
		children: "Anthropic 개인 · 서비스 사이트에서 충전해 주세요.",
		actions: <TextButton>다른 모델로 보내기</TextButton>,
	},
};

/** The connection dropped after work started: what was done stays above; go on. */
export const Disconnected: Story = {
	args: {
		title: "연결이 끊겼어요",
		children: "여기까지 한 일은 위에 남아 있어요.",
		actions: <TextButton>이어서 하기</TextButton>,
	},
};

/** It failed before anything started. */
export const Failed: Story = {
	args: {
		title: "요청을 보내지 못했어요",
		children: "서버가 응답하지 않아요.",
		actions: <TextButton>다시 시도</TextButton>,
	},
};

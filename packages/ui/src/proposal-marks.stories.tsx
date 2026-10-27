import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChangeDot } from "./change-dot";
import { CurrentProposal, Del, Fill, Highlight, Ins } from "./proposal-marks";
import { Stack } from "./stack";
import { Text } from "./text";

/**
 * The blue pencil: every mark of a proposal the assistant made and nobody has accepted. Text it takes out is blue with a line through it, text it
 * puts in has a pale blue background, a suggestion for an empty place is blue letters only. The proposal being looked at has a blue line in the
 * margin. The same marks are used in the editor, settings, review and the assistant's cards.
 */
const meta = { title: "Proposal/Marks", component: Ins, args: { children: "만든" } } satisfies Meta<typeof Ins>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** In reading text: one phrase replaced, and a suggestion that fills an empty place. */
export const InText: Story = {
	render: () => (
		<Stack gap={16} className="max-w-md pl-monti-20">
			<CurrentProposal>
				<Text as="p" variant="reading">
					블로그를 다시 <Del>만들기로 한</Del> <Ins>만든</Ins> 건 도구를 고치는 시간이 길어졌기 때문이다.
				</Text>
			</CurrentProposal>
			<Text as="p" variant="reading">
				<Fill>The list keeps only the title and the status.</Fill>
			</Text>
		</Stack>
	),
};

/** A long insertion wraps across lines and keeps its background on each. */
export const Wrapping: Story = {
	render: () => (
		<Text as="p" variant="reading" className="max-w-xs">
			앞 문장. <Ins>새로 들어오는 아주 긴 문장은 여러 줄에 걸쳐 나뉘어도 한 덩어리로 보여야 한다.</Ins> 뒷 문장.
		</Text>
	),
};

/** On a tab that has proposals the name has a blue dot; on a tab with a change of your own, a yellow one. */
export const OnTabs: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			<Text>
				내용 <ChangeDot tone="proposal" label="제안 있음" />
			</Text>
			<Text>
				SEO <ChangeDot label="바뀜" />
			</Text>
		</Stack>
	),
};

/** A note's words stay on the highlight, in their own color. */
export const NoteAnchor: Story = {
	render: () => (
		<Text as="p" className="max-w-md">
			<Highlight>설정 화면은 그대로 두었다.</Highlight> 자주 바꾸지 않는 것까지…
		</Text>
	),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, CurrentProposal, Del, Fill, Highlight, Ins, RequestAnchor, Text } from "./index";

/** The blue pencil: text put in, text taken out, an empty place filled, the proposal being looked at, the words a request is on; and the highlight. */
const meta = {
	title: "Monti/Proposal/Marks",
	component: Ins,
	decorators: [
		(Story) => (
			<Box width="reading" paddingX={24}>
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof Ins>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Taken out (`Del`) and put in (`Ins`). */
export const InsDel: Story = {
	render: () => (
		<Text as="p" variant="reading">
			Monti는 글을 쓰는 사람이 <Del>코드를 몰라도</Del>
			<Ins>설정 파일을 열지 않아도</Ins> 사이트를 고칠 수 있게 합니다.
		</Text>
	),
};

/** An empty place filled with a suggestion: blue letters, no background. */
export const FillEmpty: Story = {
	render: () => (
		<Text as="p" variant="reading">
			<Fill>설정 파일을 열지 않아도 사이트를 고칠 수 있어요.</Fill>
		</Text>
	),
};

/** The proposal being looked at: a blue line in the left margin. */
export const Current: Story = {
	render: () => (
		<CurrentProposal>
			<Text as="p" variant="reading">
				단풍이 시작된 산길을 <Del>걸었다</Del>
				<Ins>걸었습니다</Ins>.
			</Text>
		</CurrentProposal>
	),
};

/** The words a request is attached to: a blue dotted underline, no background, so they never read as text put in. Beside an `Ins` for contrast. */
export const Anchor: Story = {
	render: () => (
		<Text as="p" variant="reading">
			<Ins>설정 파일을 열지 않아도 됩니다.</Ins> <RequestAnchor>설정 화면은 그대로 두었다.</RequestAnchor> 자주 바꾸지
			않는 것까지 덜어낼 필요는 없었다.
		</Text>
	),
};

/** The words that differ between two versions. It keeps the text's own color. */
export const HighlightWords: Story = {
	render: () => (
		<Text as="p" variant="reading">
			왼쪽 목록에서 <Highlight>컬렉션을 고르고</Highlight> 새 글을 씁니다.
		</Text>
	),
};

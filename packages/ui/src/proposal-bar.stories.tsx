import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, ProposalBar } from "./index";

/** The toolbar over the media grid while alt-text proposals wait: the count in proposal blue, then discard all and accept all. */
const meta = {
	title: "Monti/Proposal/ProposalBar",
	component: ProposalBar,
	args: {
		label: "제안 3",
		discardAllLabel: "모두 버리기",
		onDiscardAll: () => {},
		acceptAllLabel: "모두 받기",
		onAcceptAll: () => {},
	},
	decorators: [
		(Story) => (
			<Box width="list">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof ProposalBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

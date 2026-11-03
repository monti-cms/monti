import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProposalBar } from "./proposal-bar";

/**
 * The toolbar over a grid while the assistant's proposals wait on its tiles (the alt texts of media files): how many, then discard all and accept all.
 * One proposal is accepted, discarded or asked about again in the card its tile opens.
 */
const meta = {
	title: "Monti/Proposal/Bar",
	component: ProposalBar,
	args: {
		label: "제안 3",
		discardAllLabel: "모두 버리기",
		onDiscardAll: () => undefined,
		acceptAllLabel: "모두 받기",
		onAcceptAll: () => undefined,
	},
} satisfies Meta<typeof ProposalBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

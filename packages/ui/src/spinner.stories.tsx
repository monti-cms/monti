import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "./spinner";
import { Stack } from "./stack";
import { StoryCaption } from "./story-caption";

/**
 * The working mark: a 14px ring in the ink of the text beside it, a quarter open, one turn a second. Decorative; the words beside it say what is
 * happening. Buttons show it themselves while they are `loading`.
 */
const meta = { title: "Primitives/Spinner", component: Spinner } satisfies Meta<typeof Spinner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** It takes the color of the text it stands next to: the ink pill, the secondary pill, the proposal blue. */
export const Inks: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			<Stack gap={4} align="center">
				<span className="inline-flex h-monti-control-md items-center gap-monti-6 rounded-monti-full bg-monti-emphasis px-[18px] text-monti-body text-monti-on-emphasis">
					<Spinner />
					저장 중…
				</span>
				<StoryCaption>on the ink pill</StoryCaption>
			</Stack>
			<Stack gap={4} align="center">
				<span className="inline-flex h-monti-control-md items-center gap-monti-6 rounded-monti-full bg-monti-muted px-[16px] text-monti-body text-monti-muted">
					<Spinner />
					올리는 중 64%
				</span>
				<StoryCaption>on secondary</StoryCaption>
			</Stack>
			<Stack gap={4} align="center">
				<span className="inline-flex h-monti-control-md items-center gap-monti-4 text-monti-micro text-monti-proposal">
					<Spinner className="size-2.5" />
					쓰는 중…
				</span>
				<StoryCaption>in proposal blue</StoryCaption>
			</Stack>
		</Stack>
	),
};

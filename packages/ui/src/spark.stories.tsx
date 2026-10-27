import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icon } from "./icon";
import { Spark } from "./spark";
import { Stack } from "./stack";
import { Text } from "./text";

/**
 * The one AI mark: a four-point star ✦, never a lucide sparkles icon. It is an icon like the others (it goes wherever an `icon` does), drawn in
 * `currentColor` and decorative.
 */
const meta = { title: "Primitives/AI mark", component: Spark } satisfies Meta<typeof Spark>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const SIZES = ["xs", "sm", "md", "lg"] as const;

/** Sized by name like any icon, and colored by the text it stands next to. */
export const Sizes: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="end">
			{SIZES.map((size) => (
				<Stack key={size} gap={4} align="center">
					<Icon icon={Spark} size={size} />
					<Text variant="label" tone="muted">
						size {size}
					</Text>
				</Stack>
			))}
			<Stack gap={4} align="center">
				<span className="text-monti-proposal">
					<Icon icon={Spark} />
				</span>
				<Text variant="label" tone="muted">
					in proposal blue
				</Text>
			</Stack>
		</Stack>
	),
};

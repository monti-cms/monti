import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "./skeleton";
import { Stack } from "./stack";

const meta = {
	title: "Feedback/Skeleton",
	component: Skeleton,
	args: {},
	render: (args) => (
		<div className="w-64">
			<Skeleton {...args} className="h-4 w-full" />
		</div>
	),
} satisfies Meta<typeof Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A list row while the entries load: a thumbnail, two lines and a trailing marker. */
export const ListRows: Story = {
	render: () => (
		<Stack gap={16} className="max-w-md">
			{[0, 1, 2].map((i) => (
				<Stack key={i} direction="row" gap={12} align="center">
					<Skeleton className="size-10" />
					<Stack gap={4} className="flex-1">
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-3 w-1/2" />
					</Stack>
					<Skeleton className="h-5 w-12" />
				</Stack>
			))}
		</Stack>
	),
};

export const Shapes: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			<Skeleton className="size-12 rounded-monti-full" />
			<Skeleton className="h-8 w-24" />
			<Skeleton className="h-24 w-40" />
		</Stack>
	),
};

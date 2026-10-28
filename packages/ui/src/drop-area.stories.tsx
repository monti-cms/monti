import type { Meta, StoryObj } from "@storybook/react-vite";
import { DropArea } from "./drop-area";
import { FolderTile } from "./tile";

const meta = {
	title: "Patterns/List/DropArea",
	component: DropArea,
	decorators: [
		(Story) => (
			<div className="w-[480px]">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof DropArea>;
export default meta;
type Story = StoryObj<typeof meta>;

const folders = (
	<div className="grid grid-cols-3 gap-x-monti-20 px-monti-12 pt-monti-24 pb-monti-24">
		<FolderTile name="covers" count={6} />
		<FolderTile name="diagrams" count={3} />
	</div>
);

export const Idle: Story = { render: () => <DropArea>{folders}</DropArea> };

/** Files are dragged over the area: a line runs around it and a tint covers the whole of it. */
export const Over: Story = { render: () => <DropArea over>{folders}</DropArea> };

/** Over a folder instead: the folder takes the mark and the area's frame goes out. */
export const OverFolder: Story = {
	render: () => (
		<DropArea>
			<div className="grid grid-cols-3 gap-x-monti-20 px-monti-12 pt-monti-24 pb-monti-24">
				<FolderTile name="covers" count={6} dropTarget />
				<FolderTile name="diagrams" count={3} />
			</div>
		</DropArea>
	),
};

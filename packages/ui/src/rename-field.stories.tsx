import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { RenameField } from "./rename-field";
import { FolderTile } from "./tile";

const meta = { title: "Patterns/List/RenameField" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Demo({ fill }: { fill?: boolean }) {
	const [name, setName] = useState("새 폴더");
	const field = (
		<RenameField
			value={name}
			onValueChange={setName}
			onCommit={() => {}}
			onCancel={() => {}}
			label="폴더 이름"
			fill={fill}
		/>
	);
	return fill ? (
		<div className="w-48">
			<FolderTile>{field}</FolderTile>
		</div>
	) : (
		field
	);
}

/** In a list row: 200px wide, with its text on the line of the other names. It opens with the whole name selected. */
export const InRow: Story = { render: () => <Demo /> };

/** In a folder tile: it fills the tile. */
export const InFolderTile: Story = { render: () => <Demo fill /> };

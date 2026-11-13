import type { Meta, StoryObj } from "@storybook/react-vite";
import { Add, TrashCan } from "./icons";
import { Box, Button, FileTree, FileTreeRow, IconButton } from "./index";

/** A code explorer's file tree (editor-tools.md, the code explorer). */
const meta = { title: "Monti/EditorTools/FileTree", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const more = (
	<IconButton label="파일 지우기" size="xs" tone="danger">
		<TrashCan aria-hidden />
	</IconButton>
);

/** Folders and files by their paths, the current file on the current ground with its remove button, "+ 파일" at the end. */
export const Default: Story = {
	render: () => (
		<Box width="menu">
			<FileTree aria-label="파일">
				<FileTreeRow name="src" folder />
				<FileTreeRow name="app.ts" depth={1} current more={more} />
				<FileTreeRow name="db.ts" depth={1} more={more} />
				<FileTreeRow name="lib" folder open={false} depth={1} />
				<FileTreeRow name="package.json" more={more} />
				<Button variant="ghost" size="sm">
					<Add aria-hidden />
					파일
				</Button>
			</FileTree>
		</Box>
	),
};

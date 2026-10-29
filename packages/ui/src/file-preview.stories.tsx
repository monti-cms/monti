import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilePreview } from "./file-preview";
import { Stack } from "./stack";
import { Tile } from "./tile";

/** The preview of a file that is not a picture: a file icon and its extension. It takes the place of the picture in a tile, and is fainter when the file failed. */
const meta = {
	title: "Patterns/List/File preview",
	component: FilePreview,
	args: { ext: "PDF" },
	decorators: [
		(Story) => (
			<div className="w-48">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof FilePreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<Tile preview={<FilePreview {...args} />} title="price-list-2026.pdf" detail="PDF · 1.2 MB · 글 1" />
	),
};

/** Ready, uploading and failed look the same as for a picture. */
export const States: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="start">
			<div className="w-48">
				<Tile preview={<FilePreview ext="CSV" />} title="subscribers.csv" detail="CSV · 340 KB · 사용 안 함" />
			</div>
			<div className="w-48">
				<Tile
					preview={<FilePreview ext="PDF" />}
					title="price-list-2026.pdf"
					detail="올리는 중 · 64%"
					status="uploading"
					progress={64}
				/>
			</div>
			<div className="w-48">
				<Tile
					preview={<FilePreview ext="EXE" />}
					title="setup.exe"
					detail="이미지 · PDF · ZIP · 텍스트만"
					status="failed"
					actions={[{ label: "빼기", onClick: () => {} }]}
				/>
			</div>
		</Stack>
	),
};

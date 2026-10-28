import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { StoryCaption } from "./story-caption";
import { UploadingImage } from "./uploading-image";

const SAMPLE = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320"><rect width="640" height="320" fill="#8d7a5d"/><circle cx="500" cy="90" r="40" fill="#cdbfa6"/><path d="M0 320V220l160-90 140 100 120-70 220 120v40z" fill="#5d4f3a"/></svg>',
)}`;

/** The picture in its place in the body while it goes up: faded, with the 3px bar along its bottom edge. */
const meta = {
	title: "Monti/EditorTools/UploadingImage",
	component: UploadingImage,
	args: { src: SAMPLE, progress: 64, label: "올리는 중" },
	decorators: [
		(Story) => (
			<div className="max-w-2xl">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof UploadingImage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Progress: Story = {
	render: () => (
		<Stack gap={16}>
			{[0, 64, 100].map((progress) => (
				<Stack key={progress} gap={4}>
					<StoryCaption>{progress}%</StoryCaption>
					<UploadingImage src={SAMPLE} progress={progress} label={`올리는 중 ${progress}%`} />
				</Stack>
			))}
		</Stack>
	),
};

/** No local picture yet. */
export const NoPicture: Story = { args: { src: null } };

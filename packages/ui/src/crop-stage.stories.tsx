import type { Meta, StoryObj } from "@storybook/react-vite";
import { CropStage } from "./crop-stage";

const SAMPLE = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="#8d7a5d"/><circle cx="500" cy="110" r="44" fill="#cdbfa6"/><path d="M0 420V300l160-110 140 120 120-80 220 140v50z" fill="#5d4f3a"/></svg>',
)}`;

/** The picture of the crop sheet in its frame (at most 380 high, the picture at most 360); the mask and the crop box lay over it in % of the picture. */
const meta = {
	title: "Monti/EditorTools/CropStage",
	component: CropStage,
	args: { src: SAMPLE, alt: "자를 이미지" },
	decorators: [
		(Story) => (
			<div className="max-w-monti-sheet">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof CropStage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** With a crop box over the middle of the picture, as the sheet draws it while a crop is set. */
export const WithCropBox: Story = {
	args: {
		children: (
			<div
				className="absolute border-2 border-monti-emphasis"
				// design-allow: the story's sample crop, in % of the picture as the sheet sets it
				style={{ left: "20%", top: "15%", width: "60%", height: "60%" }}
			/>
		),
	},
};

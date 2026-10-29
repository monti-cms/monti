import type { Meta, StoryObj } from "@storybook/react-vite";
import { CropStage } from "./crop-stage";

const SAMPLE = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="#8d7a5d"/><circle cx="500" cy="110" r="44" fill="#cdbfa6"/><path d="M0 420V300l160-110 140 120 120-80 220 140v50z" fill="#5d4f3a"/></svg>',
)}`;

/** The picture of the crop sheet in its frame (at most 380 high, the picture at most 360); the mask and the crop box lay over it in % of the picture. */
const meta = {
	title: "Monti/EditorTools/CropStage",
	component: CropStage,
	args: {
		src: SAMPLE,
		alt: "자를 이미지",
		cornerLabels: { nw: "왼쪽 위 손잡이", ne: "오른쪽 위 손잡이", sw: "왼쪽 아래 손잡이", se: "오른쪽 아래 손잡이" },
	},
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

/** With a crop set: the picture outside it under the backdrop, the box and its four corners. */
export const WithCrop: Story = { args: { crop: { x: 20, y: 15, width: 60, height: 60 } } };

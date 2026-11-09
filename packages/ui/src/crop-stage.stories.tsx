import type { Meta, StoryObj } from "@storybook/react-vite";
import { CropStage, Stack } from "./index";

/** A sample picture: a warm gradient with a sun, drawn inline so the story needs no file. It has a size of its own, as a photo has. */
const PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3c98b"/><stop offset="1" stop-color="#c76b4a"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1150" cy="300" r="120" fill="#fff3d6"/><path d="M0 700 L400 480 L800 700 L1200 520 L1600 700 V900 H0 Z" fill="#6b3a2e"/></svg>',
)}`;

/** The picture of the crop dialog: the tool ground with an edge, the picture centered. With a crop, the outside lies under the backdrop and the crop is a 2px ink box with corner handles. */
const meta = {
	title: "Patterns/Sheet/CropStage",
	component: CropStage,
	args: {
		src: PHOTO,
		alt: "노을 진 산",
		cornerLabels: { nw: "왼쪽 위 모서리", ne: "오른쪽 위 모서리", sw: "왼쪽 아래 모서리", se: "오른쪽 아래 모서리" },
	},
	render: (args) => (
		<Stack width="sheet">
			<CropStage {...args} />
		</Stack>
	),
} satisfies Meta<typeof CropStage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A crop chosen. */
export const Cropped: Story = { args: { crop: { x: 20, y: 15, width: 55, height: 60 } } };

/** No crop yet: the whole picture. */
export const Whole: Story = {};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack, UploadingImage } from "./index";

/** A sample picture: a warm gradient with a sun, drawn inline so the story needs no file. */
const PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3c98b"/><stop offset="1" stop-color="#c76b4a"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1150" cy="300" r="120" fill="#fff3d6"/><path d="M0 700 L400 480 L800 700 L1200 520 L1600 700 V900 H0 Z" fill="#6b3a2e"/></svg>',
)}`;

/** An image still going up in the body: the picture faded under the page ground, 240px high, with the 3px bar along its bottom. */
const meta = {
	title: "Patterns/Frame/UploadingImage",
	component: UploadingImage,
	args: { src: PHOTO, progress: 64, label: "올리는 중 64%" },
	render: (args) => (
		<Stack width="content">
			<UploadingImage {...args} />
		</Stack>
	),
} satisfies Meta<typeof UploadingImage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Uploading: Story = {};

/** Before the picture is read: the neutral fill. */
export const NoPicture: Story = { args: { src: null, progress: 8, label: "올리는 중 8%" } };

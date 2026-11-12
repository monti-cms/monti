import type { Meta, StoryObj } from "@storybook/react-vite";
import { Image as ImageIcon } from "./icons";
import { Image, Inline, Stack } from "./index";

/** A sample picture: a warm gradient with a sun, drawn inline so the story needs no file. */
const PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3c98b"/><stop offset="1" stop-color="#c76b4a"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1150" cy="300" r="120" fill="#fff3d6"/><path d="M0 700 L400 480 L800 700 L1200 520 L1600 700 V900 H0 Z" fill="#6b3a2e"/></svg>',
)}`;

/** A picture in a frame of a fixed shape: `cover` fills and crops, `contain` shows all of it. A missing source shows `fallback` on the neutral fill. */
const meta = {
	title: "Patterns/Frame/Image",
	component: Image,
	args: { src: PHOTO, alt: "노을 진 산" },
} satisfies Meta<typeof Image>;
export default meta;
type Story = StoryObj<typeof meta>;

/** `frame`, from the core's `imageFrame`: the middle half of a 16:9 picture, and the whole of it turned a quarter. The frame takes the new shape. */
export const Framed: Story = {
	tags: ["visual"],
	render: (args) => (
		<Inline gap={16} align="start">
			<Stack width="panel">
				<Image
					{...args}
					frame={{ aspectRatio: 8 / 9, image: { left: 50, top: 50, width: 200, height: 100, rotate: 0 } }}
				/>
			</Stack>
			<Stack width="panel">
				<Image
					{...args}
					frame={{ aspectRatio: 9 / 16, image: { left: 50, top: 50, width: 16000 / 90, height: 56.25, rotate: 90 } }}
				/>
			</Stack>
		</Inline>
	),
};

/**
 * `shape` with `ratio="auto"`: the frame stands at the picture's own shape (here 3:2) before the picture is in, so what is under it does not
 * move when it comes. The second frame's picture never comes: its place is held all the same.
 */
export const ShapeHeld: Story = {
	tags: ["visual"],
	render: (args) => (
		<Inline gap={16} align="start">
			<Stack width="panel">
				<Image {...args} ratio="auto" shape={3 / 2} fit="contain" />
			</Stack>
			<Stack width="panel">
				<Image src="data:image/png;base64," alt="" ratio="auto" shape={3 / 2} />
			</Stack>
		</Inline>
	),
};

/** The ratios: square, photo (4:3), wide (16:9), share (1.91:1), banner (3:1). */
export const Ratios: Story = {
	render: (args) => (
		<Stack gap={16} width="panel">
			<Image {...args} ratio="photo" />
			<Image {...args} ratio="wide" />
			<Image {...args} ratio="share" />
			<Image {...args} ratio="banner" />
		</Stack>
	),
};

/** `contain` in a square, with an edge. */
export const Contain: Story = {
	render: (args) => (
		<Stack width="menu">
			<Image {...args} fit="contain" border />
		</Stack>
	),
};

/** The small sizes: a field's 20px, a thumb, a large thumb, a list row's 40px. */
export const Sizes: Story = {
	render: (args) => (
		<Inline gap={12}>
			<Image {...args} size="thumb-sm" radius="sm" />
			<Image {...args} size="thumb" />
			<Image {...args} size="thumb-lg" />
			<Image {...args} size="row" ratio="photo" radius="sm" />
		</Inline>
	),
};

/** No picture: the fallback icon on the neutral fill. */
export const Missing: Story = {
	render: () => (
		<Stack width="menu">
			<Image src={null} alt="" ratio="wide" fallback={ImageIcon} />
		</Stack>
	),
};

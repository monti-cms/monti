import { Image as ImageIcon } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type * as React from "react";
import { Image } from "./image";
import { Stack } from "./stack";
import { StoryCaption } from "./story-caption";

/** An inline SVG, so the stories load nothing from the network. */
const SAMPLE = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#8fb8de"/><circle cx="240" cy="50" r="24" fill="#f6d365"/><path d="M0 180V120l80-50 70 60 60-40 110 70v20z" fill="#4c7a5a"/></svg>',
)}`;

const meta = {
	title: "Primitives/Image",
	component: Image,
	args: {
		src: SAMPLE,
		alt: "여름 바다 풍경",
		ratio: "photo",
		size: "fill",
		radius: "md",
		fit: "cover",
		fallback: ImageIcon,
	},
	decorators: [
		(Story) => (
			<div className="max-w-xs">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Image>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Labelled({ name, children }: { name: string; children: React.ReactNode }) {
	return (
		<Stack gap={4} align="start">
			<StoryCaption>{name}</StoryCaption>
			{children}
		</Stack>
	);
}

export const Ratio: Story = {
	render: () => (
		<Stack direction="row" gap={24} wrap align="start">
			{(["square", "photo", "wide", "share", "banner", "auto"] as const).map((ratio) => (
				<Labelled key={ratio} name={`ratio ${ratio}`}>
					<div className="w-40">
						<Image src={SAMPLE} alt="여름 바다 풍경" ratio={ratio} />
					</div>
				</Labelled>
			))}
		</Stack>
	),
};

export const Size: Story = {
	render: () => (
		<Stack direction="row" gap={24} wrap align="start">
			{(["fill", "thumb", "thumb-lg", "icon"] as const).map((size) => (
				<Labelled key={size} name={`size ${size}`}>
					<div className="w-40">
						<Image src={SAMPLE} alt="여름 바다 풍경" size={size} border />
					</div>
				</Labelled>
			))}
		</Stack>
	),
};

export const Radius: Story = {
	render: () => (
		<Stack direction="row" gap={24} wrap align="start">
			{(["none", "sm", "md", "lg"] as const).map((radius) => (
				<Labelled key={radius} name={`radius ${radius}`}>
					<div className="w-32">
						<Image src={SAMPLE} alt="여름 바다 풍경" radius={radius} />
					</div>
				</Labelled>
			))}
		</Stack>
	),
};

export const Border: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="start">
			{[false, true].map((border) => (
				<Labelled key={String(border)} name={`border ${border}`}>
					<div className="w-32">
						<Image src={SAMPLE} alt="여름 바다 풍경" border={border} />
					</div>
				</Labelled>
			))}
		</Stack>
	),
};

/** `cover` fills the frame and crops; `contain` shows all of it. */
export const Fit: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="start">
			{(["cover", "contain"] as const).map((fit) => (
				<Labelled key={fit} name={`fit ${fit}`}>
					<div className="w-40">
						<Image src={SAMPLE} alt="여름 바다 풍경" ratio="square" fit={fit} border />
					</div>
				</Labelled>
			))}
		</Stack>
	),
};

/** Without a source (or when it fails) the frame shows the fallback icon on the neutral fill. */
export const Fallback: Story = {
	render: () => (
		<Stack direction="row" gap={24} wrap align="start">
			<Labelled name="src 없음, fallback 있음">
				<div className="w-40">
					<Image src={null} alt="" fallback={ImageIcon} ratio="photo" />
				</div>
			</Labelled>
			<Labelled name="src 없음, fallback 없음">
				<div className="w-40">
					<Image src={null} alt="" ratio="photo" />
				</div>
			</Labelled>
			<Labelled name="size thumb, fallback 있음">
				<Image src={null} alt="" fallback={ImageIcon} size="thumb" />
			</Labelled>
			<Labelled name="깨진 src">
				<div className="w-40">
					<Image src="data:image/png;base64,invalid" alt="" fallback={ImageIcon} ratio="photo" />
				</div>
			</Labelled>
		</Stack>
	),
};

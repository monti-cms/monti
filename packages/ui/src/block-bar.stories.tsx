import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent } from "storybook/test";
import { Edit, Settings, TextAlignCenter, TextAlignLeft, TextAlignRight } from "./icons";
import { BlockBox, FloatingBar, FloatingBarButton, Image, ResizeCorner, Separator, Stack } from "./index";

const SAMPLE = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><rect width="480" height="270" fill="#8fb8de"/><circle cx="360" cy="75" r="36" fill="#f6d365"/><path d="M0 270V180l120-75 105 90 90-60 165 105v30z" fill="#4c7a5a"/></svg>',
)}`;

/**
 * The tools of a selected image: the block bar above its top left (align | edit · settings), a 2px ink line around it, and a square handle on each
 * corner that changes the width when dragged, its size shown meanwhile ("420 × 236", or "62%" for a picture sized as a share of the body). Delete is in
 * the block menu, not here.
 */
const meta = {
	title: "Monti/EditorTools/BlockBar",
	component: ResizeCorner,
	args: { corner: "se", label: "오른쪽에서 크기 바꾸기" },
} satisfies Meta<typeof ResizeCorner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OnImage: Story = {
	render: () => (
		<Stack gap={8} align="start" maxWidth="reading">
			<FloatingBar aria-label="이미지 도구">
				<FloatingBarButton label="왼쪽 정렬">
					<TextAlignLeft aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="가운데 정렬" pressed>
					<TextAlignCenter aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="오른쪽 정렬">
					<TextAlignRight aria-hidden />
				</FloatingBarButton>
				<Separator orientation="vertical" length="bar" />
				<FloatingBarButton label="편집">
					<Edit aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="설정">
					<Settings aria-hidden />
				</FloatingBarButton>
			</FloatingBar>
			<BlockBox selected width="420px" measure="420 × 236">
				<Image src={SAMPLE} alt="언덕 위로 해가 뜨는 풍경" ratio="wide" radius="md" />
				<ResizeCorner corner="nw" />
				<ResizeCorner corner="ne" />
				<ResizeCorner corner="sw" label="왼쪽에서 크기 바꾸기" />
				<ResizeCorner corner="se" label="오른쪽에서 크기 바꾸기" />
			</BlockBox>
		</Stack>
	),
};

/** A picture sized as a share of the body: the width is a percent, and so is what a dragged corner shows. */
export const ShareOfBody: Story = {
	render: () => (
		<Stack gap={8} align="start" maxWidth="reading">
			<BlockBox selected width="62%" measure="62%">
				<Image src={SAMPLE} alt="언덕 위로 해가 뜨는 풍경" ratio="wide" radius="md" />
				<ResizeCorner corner="nw" />
				<ResizeCorner corner="ne" />
				<ResizeCorner corner="sw" label="왼쪽에서 크기 바꾸기" />
				<ResizeCorner corner="se" label="오른쪽에서 크기 바꾸기" />
			</BlockBox>
		</Stack>
	),
};

/**
 * In a body that cannot be written in, the keyboard stops at each picture. Two states, each as it looks everywhere: the first picture is picked (the ink line,
 * and its bar with what can be read of it); the keyboard is on the second, which shows the ordinary focus ring.
 */
export const ReadOnlyStops: Story = {
	render: () => (
		<Stack gap={20} align="start" maxWidth="reading">
			<FloatingBar aria-label="이미지 도구">
				<FloatingBarButton label="설정">
					<Settings aria-hidden />
				</FloatingBarButton>
			</FloatingBar>
			<BlockBox selected tabIndex={0} role="group" aria-label="이미지" width="420px">
				<Image src={SAMPLE} alt="언덕 위로 해가 뜨는 풍경" ratio="wide" radius="md" />
			</BlockBox>
			<BlockBox tabIndex={0} role="group" aria-label="이미지" width="420px">
				<Image src={SAMPLE} alt="언덕 위로 해가 뜨는 풍경" ratio="wide" radius="md" />
			</BlockBox>
		</Stack>
	),
	play: async ({ canvasElement }) => {
		// As the keyboard arrives: the browser draws the keyboard's focus after a key.
		await userEvent.keyboard("{Shift}");
		canvasElement.querySelectorAll<HTMLElement>("[data-slot=block-box]")[1]?.focus();
	},
};

import { Crop, SettingsAdjust, TextAlignCenter, TextAlignLeft, TextAlignRight } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, FloatingBar, FloatingBarButton, Image, ResizeCorner, Separator, Stack } from "./index";

const SAMPLE = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><rect width="480" height="270" fill="#8fb8de"/><circle cx="360" cy="75" r="36" fill="#f6d365"/><path d="M0 270V180l120-75 105 90 90-60 165 105v30z" fill="#4c7a5a"/></svg>',
)}`;

/**
 * The tools of a selected image: the block bar above its top left (align | settings · crop), and a square handle on each bottom corner that
 * changes the width when dragged. Delete is in the block menu, not here.
 */
const meta = {
	title: "Monti/EditorTools/BlockBar",
	component: ResizeCorner,
	args: { side: "right", label: "폭 바꾸기" },
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
				<FloatingBarButton label="설정">
					<SettingsAdjust aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="자르기와 회전">
					<Crop aria-hidden />
				</FloatingBarButton>
			</FloatingBar>
			<Box position="relative" width="full">
				<Image src={SAMPLE} alt="언덕 위로 해가 뜨는 풍경" ratio="wide" />
				<ResizeCorner side="left" label="폭 바꾸기" />
				<ResizeCorner side="right" label="폭 바꾸기" />
			</Box>
		</Stack>
	),
};

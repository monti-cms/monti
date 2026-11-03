import { Crop, SettingsAdjust, TextAlignCenter, TextAlignLeft, TextAlignRight } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ResizeCorner } from "./block-bar";
import { FloatingBar, FloatingBarButton } from "./floating-bar";
import { Image } from "./image";
import { Separator } from "./separator";
import { Stack } from "./stack";

const SAMPLE = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><rect width="480" height="270" fill="#8fb8de"/><circle cx="360" cy="75" r="36" fill="#f6d365"/><path d="M0 270V180l120-75 105 90 90-60 165 105v30z" fill="#4c7a5a"/></svg>',
)}`;

/**
 * The tools of a block that has settings, in a small floating row: align, then settings and crop after a rule. A tool that is on keeps its
 * background. Delete is not here; it is in the block menu.
 */
const meta = { title: "Monti/EditorTools/BlockBar", component: FloatingBar } satisfies Meta<typeof FloatingBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: () => (
		<FloatingBar aria-label="이미지 도구">
			<FloatingBarButton label="왼쪽">
				<TextAlignLeft aria-hidden />
			</FloatingBarButton>
			<FloatingBarButton label="가운데" pressed>
				<TextAlignCenter aria-hidden />
			</FloatingBarButton>
			<FloatingBarButton label="오른쪽">
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
	),
};

/** On a selected image: the bar above its top left, and a handle on each bottom corner to change the width. */
export const OnImage: Story = {
	render: () => (
		<Stack gap={8} className="max-w-md">
			<FloatingBar aria-label="이미지 도구" className="self-start">
				<FloatingBarButton label="왼쪽">
					<TextAlignLeft aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="가운데" pressed>
					<TextAlignCenter aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="오른쪽">
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
			<div className="relative">
				<Image src={SAMPLE} alt="" ratio="photo" />
				<ResizeCorner side="left" label="너비 줄이기" />
				<ResizeCorner side="right" label="너비 늘리기" />
			</div>
		</Stack>
	),
};

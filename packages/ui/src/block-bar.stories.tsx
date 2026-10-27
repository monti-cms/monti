import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlignCenter, AlignLeft, AlignRight, Crop, SlidersHorizontal } from "lucide-react";
import { BlockBar, BlockBarButton, BlockBarSeparator, ResizeCorner } from "./block-bar";
import { Image } from "./image";
import { Stack } from "./stack";

const SAMPLE = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><rect width="480" height="270" fill="#8fb8de"/><circle cx="360" cy="75" r="36" fill="#f6d365"/><path d="M0 270V180l120-75 105 90 90-60 165 105v30z" fill="#4c7a5a"/></svg>',
)}`;

/**
 * The tools of a block that has settings, in a small floating row: align, then settings and crop after a rule. A tool that is on keeps its
 * background. Delete is not here; it is in the block menu.
 */
const meta = { title: "Editor/BlockBar", component: BlockBar } satisfies Meta<typeof BlockBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: () => (
		<BlockBar aria-label="이미지 도구">
			<BlockBarButton label="왼쪽">
				<AlignLeft aria-hidden />
			</BlockBarButton>
			<BlockBarButton label="가운데" pressed>
				<AlignCenter aria-hidden />
			</BlockBarButton>
			<BlockBarButton label="오른쪽">
				<AlignRight aria-hidden />
			</BlockBarButton>
			<BlockBarSeparator />
			<BlockBarButton label="설정">
				<SlidersHorizontal aria-hidden />
			</BlockBarButton>
			<BlockBarButton label="자르기와 회전">
				<Crop aria-hidden />
			</BlockBarButton>
		</BlockBar>
	),
};

/** On a selected image: the bar above its top left, and a handle on each bottom corner to change the width. */
export const OnImage: Story = {
	render: () => (
		<Stack gap={8} className="max-w-md">
			<BlockBar aria-label="이미지 도구" className="self-start">
				<BlockBarButton label="왼쪽">
					<AlignLeft aria-hidden />
				</BlockBarButton>
				<BlockBarButton label="가운데" pressed>
					<AlignCenter aria-hidden />
				</BlockBarButton>
				<BlockBarButton label="오른쪽">
					<AlignRight aria-hidden />
				</BlockBarButton>
				<BlockBarSeparator />
				<BlockBarButton label="설정">
					<SlidersHorizontal aria-hidden />
				</BlockBarButton>
				<BlockBarButton label="자르기와 회전">
					<Crop aria-hidden />
				</BlockBarButton>
			</BlockBar>
			<div className="relative">
				<Image src={SAMPLE} alt="" ratio="photo" />
				<ResizeCorner side="left" label="너비 줄이기" />
				<ResizeCorner side="right" label="너비 늘리기" />
			</div>
		</Stack>
	),
};

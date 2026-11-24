import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageHeader } from "./page-header";
import { PagePath } from "./page-path";

/** The page title as the way down to the open folder (2026-11 redesign, `media-empty.html`, `media-deep.html`). */
const meta = {
	title: "Patterns/Frame/PagePath",
	component: PagePath,
	tags: ["visual"],
	args: {
		trail: [{ name: "미디어" }, { name: "표지" }],
		current: "2026 가을 걷기 길 백과 — 지역별 대표 사진 (강원·경상·전라·제주)",
	},
} satisfies Meta<typeof PagePath>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** As a page head's title, with its note beside it. */
export const InPageHeader: Story = {
	render: (args) => <PageHeader layout="bar" title={<PagePath {...args} />} note="비어 있음" />,
};

/** A deep folder: the folders between the first and the parent fold into a ⋯, its menu open. */
export const Folded: Story = {
	args: {
		trail: [{ name: "미디어" }, { name: "지역별" }],
		hidden: [{ name: "표지" }, { name: "2026" }, { name: "가을 걷기" }],
		hiddenLabel: "상위 폴더",
		defaultOpen: true,
	},
	render: (args) => <PageHeader layout="bar" title={<PagePath {...args} />} note="비어 있음" />,
};

/** Short of room the open folder's name is cut at its end; the folders above it stay whole. */
export const Narrow: Story = {
	render: (args) => (
		<div style={{ width: 420 }}>
			<PageHeader layout="bar" title={<PagePath {...args} />} />
		</div>
	),
};

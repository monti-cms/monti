import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilterButton } from "./filter-button";
import { FilterChip } from "./filter-chip";
import { PageToolbar } from "./page-header";

/** A filter that is on, where its name stood in the filter row: 24px on the selected ground, with its × (2026-11 redesign, `media.html`). */
const meta = {
	title: "Patterns/List/FilterChip",
	component: FilterChip,
	tags: ["visual"],
	args: { name: "종류", value: "이미지", named: true, clearLabel: "종류 필터 지우기" },
} satisfies Meta<typeof FilterChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** In the 36px head row, beside conditions that are not on and the sort (`PageToolbar size="head"`, `FilterButton size="caption"`). */
export const InHeadRow: Story = {
	render: () => (
		<PageToolbar size="head">
			<FilterChip name="종류" value="이미지" named clearLabel="종류 필터 지우기" />
			<FilterChip name="글쓴이" value="김하늘" clearLabel="글쓴이 필터 지우기" />
			<FilterButton size="caption">쓰임</FilterButton>
			<FilterButton size="caption" sort="desc">
				올린 날
			</FilterButton>
		</PageToolbar>
	),
};

/** A long value is cut at its end; the condition's name and the × stay. */
export const LongValue: Story = {
	render: () => (
		<PageToolbar size="head">
			<FilterChip
				name="폴더"
				value="2026 가을 걷기 길 백과 — 지역별 대표 사진 (강원·경상·전라·제주)"
				named
				clearLabel="폴더 필터 지우기"
			/>
		</PageToolbar>
	),
};

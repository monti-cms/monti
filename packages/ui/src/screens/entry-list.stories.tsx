import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ScreenSpecDocument } from "../spec/format";
import { ScreenSpec } from "../spec/render";
import spec from "./entry-list.screen.json";

/** The post list drawn from `entry-list.screen.json` alone: a pilot of screens written as data, beside the `Main` board's first state. */
const meta = {
	title: "Screens/Spec/EntryList",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const KO: Record<string, string> = {
	posts: "게시글",
	addFolder: "+ 폴더",
	search: "검색",
	writeNew: "새 글 쓰기",
	folderCount: "글 {count}",
	rowMenu: "행 메뉴",
	pick: "{title} 고르기",
	range: "{range} / {total}",
	pageSize: "쪽마다 보일 수",
};

const fill = (text: string, params: Record<string, string | number>) =>
	text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));

const STATUS = { published: "발행됨", editing: "수정 중", draft: "초안" } as const;
const row = (
	status: keyof typeof STATUS,
	title: string,
	slug: string,
	category: string,
	tags: string,
	locales: string,
	updated: string,
) => ({
	status,
	statusName: STATUS[status],
	quiet: status === "published",
	title,
	address: `/${slug}`,
	href: `#${slug}`,
	category,
	tags,
	locales,
	updated,
});

const data = {
	addressRule: "/posts/:slug",
	columnSizes: [92, undefined, 140, 160, 64, 88, 54],
	columns: [
		{ id: "status", label: "상태", size: 92 },
		{ id: "title", label: "제목" },
		{ id: "category", label: "카테고리", size: 140 },
		{ id: "tags", label: "태그", size: 160 },
		{ id: "locale", label: "언어", size: 64 },
		{ id: "updatedAt", label: "수정일", size: 88, sort: "desc" },
	],
	folders: [{ name: "시리즈 원고", count: 2, href: "#series" }],
	rows: [
		row("editing", "발행 후 고친 글", "edited-post", "개발", "리액트", "KO", "10. 26"),
		row("draft", "리액트 서버 컴포넌트 다시 보기", "rsc-again", "개발", "리액트 · 성능", "KO", "10. 25"),
		row("draft", "가을 사진 정리", "autumn-photos", "일상", "", "KO", "10. 22"),
		row("published", "첫 번째 글", "first-post", "개발", "리액트", "KO +1", "10. 01"),
		row("published", "CMS elements: details", "cms-elements-details", "개발", "", "KO +1", "09. 20"),
		row("published", "CMS elements", "cms-elements", "개발", "Blocks", "KO", "09. 14"),
		row("published", "서울의 밤", "seoul-night", "일상", "", "KO", "09. 02"),
		row("published", "타입스크립트 5.9 정리", "ts-59", "개발", "", "KO", "08. 28"),
		row("published", "여름 휴가 메모", "summer-notes", "일상", "", "KO", "08. 11"),
		row(
			"published",
			"리액트 19 마이그레이션, 서버 컴포넌트와 액션까지 한 번에 옮긴 기록",
			"react-19",
			"개발",
			"리액트 · 마이그레이션 · 성능",
			"KO +2",
			"08. 03",
		),
	],
	range: "1–25",
	total: 148,
	pageSize: 25,
	pageSizes: [25, 50, 100].map((size) => ({ value: size, label: `${size}개씩` })),
	previous: { href: "#", disabled: true },
	next: { href: "#page-2" },
	pages: [1, 2, 3, 4, 5, 6].map((number) => ({ number, href: `#page-${number}`, current: number === 1 })),
};

export const Default: Story = {
	render: () => (
		<div className="flex h-screen">
			<ScreenSpec
				spec={spec as ScreenSpecDocument}
				data={data}
				text={(key, params) => (key in KO ? fill(KO[key] as string, params) : undefined)}
			/>
		</div>
	),
};

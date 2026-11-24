import type { Meta, StoryObj } from "@storybook/react-vite";
import { Folder, Tag, TrashCan } from "../icons";
import { BulkBar, Button, Separator } from "../index";
import { Num } from "./frame";
import { type ListRow, ListScreen } from "./list";

/**
 * 기준 화면 · 글 목록. 승인된 시안(v5 `list.html` · `list-filter.html` · `list-extreme.html`)을 `@monti-cms/ui` 부품과 지어낸 자료만으로 다시
 * 그린 것이다. 관리자 앱이 아니다. 1440×900에서 시안과 견준다.
 */
const meta = {
	title: "Screens/List",
	parameters: { layout: "fullscreen", bleed: true, viewport: { defaultViewport: "desktop" } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** 시안 `list.html`: 폴더 셋과 글 여덟, 일곱째 줄에 포인터가 있다(그 줄에만 ⋯). */
export const List: Story = {
	render: () => <ListScreen hovered={6} />,
	parameters: { pseudo: { hover: ["tr[data-hovered]"] } },
};

const FILTERED: readonly ListRow[] = [
	{
		kind: "post",
		status: "draft",
		title: "걷기 메모 (가져온 글)",
		author: "김하늘",
		language: "한국어",
		date: "11월 14일",
	},
	{ kind: "post", status: "draft", author: "김하늘", language: "한국어", date: "11월 14일" },
	{
		kind: "post",
		status: "draft",
		title: "사막의 밤하늘 (바깥 링크)",
		tags: "사막, 밤",
		author: "김하늘",
		language: "한국어",
		more: 1,
		date: "11월 13일",
	},
	{
		kind: "post",
		status: "draft",
		title: "끊긴 코드 링크가 있는 초안",
		author: "김하늘",
		language: "한국어",
		date: "11월 12일",
	},
	{
		kind: "post",
		status: "draft",
		title: "영상 주소가 빠진 초안",
		tags: "영상",
		author: "김하늘",
		language: "한국어",
		date: "11월 9일",
	},
];

/** 시안 `list-filter.html`: 필터는 열 머리의 칩이다(필터 버튼 없음, 밀림 없음). 상태 열의 메뉴가 열려 있다. */
export const ListFilter: Story = {
	render: () => <ListScreen rows={FILTERED} filtered total={26} />,
	play: async ({ canvasElement }) => {
		const chip = [...canvasElement.querySelectorAll<HTMLElement>("thead button")].find((button) =>
			button.textContent?.includes("초안"),
		);
		chip?.click();
	},
};

const LONG = "2026년 가을 전국 걷기 길 백과 — 강원·경상·전라·제주의 숨은 산책로 120곳과 계절별 준비물";
const ENGLISH = "A very long English title that keeps going to test truncation in a narrow column";
const SPRING = "봄 산책 코스 — 서울 둘레길 8코스 완주 기록과 지도";
const TAGS = "여행 사진 모음, 아주 긴 태그 이름";
const WALK = "걷기, 가을, 강원 +6";
const post = (
	status: "draft" | "published" | "editing",
	title: string | undefined,
	tags: string | undefined,
	author: string | undefined,
	language: string,
	more: number | undefined,
	date: string,
	selected = false,
): ListRow => ({ kind: "post", status, title, tags, author, language, more, date, selected });

/** 시안 `list-extreme.html`의 줄: 긴 제목, 긴 태그, 여러 언어, 고른 줄 셋. */
const EXTREME: readonly ListRow[] = [
	post("published", LONG, TAGS, "이바다", "한국어", 9, "2025년 3월 2일"),
	post("draft", undefined, TAGS, undefined, "English", undefined, "11월 14일"),
	post("published", "사막의 밤하늘 (바깥 링크)", "사막, 밤", "박산 외 2", "English", undefined, "2025년 3월 2일", true),
	post("published", ENGLISH, "사막, 밤", "이바다", "English", undefined, "오늘 09:41", true),
	post("draft", "코드 블록 도구를 모두 쓴 글", "사막, 밤", undefined, "한국어", 9, "오늘 09:41"),
	post("published", SPRING, "코드", "박산 외 2", "English", undefined, "2025년 3월 2일", true),
	post("editing", "주소 없는 초안", "사막, 밤", "김하늘", "한국어", undefined, "오늘 09:41"),
	post("published", "영상 주소가 빠진 초안", "코드", "이바다", "한국어", 9, "2025년 3월 2일"),
	post("published", "걷기 메모 (가져온 글)", "코드", "박산 외 2", "한국어", 9, "2025년 3월 2일"),
	post("published", "끊긴 코드 링크가 있는 초안", WALK, undefined, "한국어", 9, "어제"),
	post("published", "🌙 이모지가 들어간 제목도 잘 잘리는지", TAGS, undefined, "한국어", 1, "11월 14일"),
	post("published", "숲길 지도", undefined, undefined, "English", undefined, "2025년 3월 2일"),
	post("draft", LONG, WALK, undefined, "English", undefined, "어제"),
	post("draft", undefined, WALK, "박산 외 2", "English", undefined, "오늘 09:41"),
	post("draft", "사막의 밤하늘 (바깥 링크)", TAGS, undefined, "English", undefined, "11월 14일"),
	post("published", ENGLISH, TAGS, "이바다", "한국어", undefined, "11월 14일"),
	post("draft", "코드 블록 도구를 모두 쓴 글", undefined, undefined, "한국어", undefined, "어제"),
	post("editing", SPRING, WALK, "김하늘", "한국어", 1, "오늘 09:41"),
];

/** 시안 `list-extreme.html`: 긴 제목, 긴 태그, 여러 언어, 많은 줄, 고른 줄 셋과 페이지 아래에 뜬 막대. */
export const ListExtreme: Story = {
	render: () => (
		<ListScreen
			rows={EXTREME}
			sizes={{ status: 128, tags: 150, author: 104, language: 112, date: 112, end: 54 }}
			note={<Num>1,284</Num>}
			bulk={
				<BulkBar place="float" label="3개 선택" clearLabel="고르기 풀기" onClear={() => {}}>
					<Button variant="ghost" size="sm">
						<Folder aria-hidden />
						폴더로 옮기기
					</Button>
					<Button variant="ghost" size="sm">
						<Tag aria-hidden />
						태그
					</Button>
					<Button variant="ghost" size="sm">
						발행 취소
					</Button>
					<Separator orientation="vertical" length="bar" />
					<Button variant="ghost-danger" size="sm">
						<TrashCan aria-hidden />
						휴지통으로
					</Button>
				</BulkBar>
			}
		/>
	),
};

/** 글이 하나도 없을 때(시안 없음: 같은 부품으로). */
export const ListEmpty: Story = { render: () => <ListScreen rows={[]} /> };

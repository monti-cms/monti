import type * as React from "react";
import {
	Button,
	FieldRow,
	FieldTree,
	FolderTab,
	FolderTabs,
	FolderTabsAdd,
	FolderTabsBody,
	FolderTabsList,
	Inline,
	NavLink,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	PageToolbarEnd,
	RailAction,
	RailLayout,
	Stack,
	TabLink,
	TabLinks,
	Text,
} from "../../index";
import { AdminFrame } from "./frame";
import { SettingsTabs } from "./settings";

type Field = React.ComponentProps<typeof FieldRow>;

const START: Field[] = [
	{ name: "title !", label: "제목", note: "속성 패널에 안 나옴", kind: "text" },
	{ name: "slug !", label: "주소", kind: "slug" },
];
const SUMMARY: Field = {
	name: "summary",
	label: "요약",
	description: "목록과 검색 결과에 나오는 한 문장. 결론을 먼저.",
	kind: "text · 120",
};
const END: Field[] = [
	{ name: "cover", label: "대표 이미지", description: "대체 텍스트는 보이는 것만, 80자 안.", kind: "image" },
	{ name: "분류", group: true },
	{ name: "category", label: "카테고리", kind: "→ Category", depth: 1 },
	{ name: "tags", label: "태그", kind: "[] → Tag", depth: 1 },
	{ name: "series", label: "시리즈", kind: "→ Series", depth: 1 },
];

/** The fields of the post collection as saved. */
export const SAVED_FIELDS: Field[] = [...START, SUMMARY, ...END];

/** The fields of the post collection with three unsaved changes. */
export const CHANGED_FIELDS: Field[] = [
	...START,
	{ name: "excerpt", label: "요약", note: "← summary", kind: "text · 120", tone: "warning" },
	{ name: "subtitle", label: "부제", note: "지움", kind: "text", tone: "faint" },
	{ name: "format !", label: "글 종류", note: "새로", kind: "select", tone: "success" },
	...END,
];

/** Settings, Collections tab, the post collection's fields; the screen under the add-field and review sheets too. */
export function SchemaPage({
	fields = SAVED_FIELDS,
	changed,
	head,
}: {
	fields?: Field[];
	/** The post collection has unsaved changes. */
	changed?: boolean;
	/** What sits at the end of the title row (the save group). */
	head?: React.ReactNode;
}) {
	const collections = [
		["게시글", "post"],
		["메모", "memo"],
		["카테고리", "category"],
		["태그", "tag"],
		["시리즈", "series"],
	];
	return (
		<PageColumn>
			<PageHeader title="설정">{head}</PageHeader>
			<PageToolbar>
				<SettingsTabs open="schema" />
			</PageToolbar>
			<PageBody>
				<RailLayout
					label="컬렉션"
					rail={
						<>
							{collections.map(([label, note], index) => (
								<NavLink
									key={note}
									active={index === 0}
									note={note}
									dot={changed && index === 0 ? "changed" : undefined}
								>
									{label}
								</NavLink>
							))}
							<RailAction>+ 새 컬렉션</RailAction>
						</>
					}
				>
					<Stack grow minWidth={0}>
						<PageToolbar>
							<TabLinks variant="toolbar">
								<TabLink>기본</TabLink>
								<TabLink current count="10">
									필드
								</TabLink>
								<TabLink>에디터</TabLink>
							</TabLinks>
							<PageToolbarEnd>
								<Button variant="ghost" size="sm">
									속성 패널 미리보기
								</Button>
							</PageToolbarEnd>
						</PageToolbar>
						<Stack gap={12} paddingTop={4}>
							<FolderTabs value="기본">
								<FolderTabsList add={<FolderTabsAdd aria-label="탭 추가">+</FolderTabsAdd>}>
									<FolderTab value="기본" count="7" draggable>
										기본
									</FolderTab>
									<FolderTab value="SEO" count="3" locked draggable>
										SEO
									</FolderTab>
								</FolderTabsList>
								<FolderTabsBody value="기본">
									<FieldTree>
										{fields.map((field) => (
											// A field opens its settings sheet; a group's row only holds its fields.
											<FieldRow key={String(field.name)} grip onOpen={field.group ? undefined : () => {}} {...field} />
										))}
									</FieldTree>
								</FolderTabsBody>
							</FolderTabs>
							<Stack gap={12}>
								<Inline gap={20}>
									<Button variant="ghost" size="sm">
										+ 필드 추가
									</Button>
									<Button variant="ghost" size="sm">
										+ 묶음 추가
									</Button>
								</Inline>
								<Text as="p" variant="meta" tone="subtle">
									! 필수 · → 관계 · [] 여러 개
								</Text>
							</Stack>
						</Stack>
					</Stack>
				</RailLayout>
			</PageBody>
		</PageColumn>
	);
}

/** Settings, Collections tab: the post collection's fields. */
export function SchemaScreen() {
	return (
		<AdminFrame open="settings">
			<SchemaPage />
		</AdminFrame>
	);
}

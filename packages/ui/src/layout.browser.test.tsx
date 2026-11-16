import { useState } from "react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { box, centreY, rightEdge } from "../../../testing/measure";
import { render } from "../test/render";
import { Document } from "./icons";
import {
	BulkBar,
	Button,
	Count,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSearch,
	DropdownMenuTrigger,
	EntryStatus,
	folderTree,
	LocaleCodes,
	PageHeader,
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	RowTitle,
	Sidebar,
	SidebarContent,
	SidebarFoot,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarProvider,
	SidebarScreenMode,
	SplitButton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Text,
} from "./index";

/**
 * Where things stand on the page, measured (T51, causes 14 and 15 of the admin QA audit): what a still picture and a reading of the classes cannot
 * show. One group, one edge: a count ends where the counts above it end, a name stands where its parent's does, a cell's words are centred in
 * their row, a row is whole pixels high, and a control whose words change keeps its width.
 */

const DEPTHS = [0, 1, 1, 2, 0] as const;
const NAMES = ["안내", "국내", "해외", "서울", "소식"];

function Tree() {
	const tree = folderTree(DEPTHS);
	return (
		<SidebarProvider rail={false} onRailChange={() => {}}>
			<Sidebar label="관리자 메뉴">
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu aria-label="콘텐츠">
								<SidebarMenuItem>
									<SidebarMenuButton isActive render={<button type="button" />}>
										<Document />
										<span>게시글</span>
										<SidebarMenuBadge>148</SidebarMenuBadge>
									</SidebarMenuButton>
									<SidebarMenuSub aria-label="게시글 폴더">
										{DEPTHS.map((depth, index) => (
											<li key={NAMES[index]}>
												<SidebarMenuSubButton render={<button type="button" />} depth={depth} tree={tree[index]}>
													<span>{NAMES[index]}</span>
													<Count>{index + 1}</Count>
												</SidebarMenuSubButton>
											</li>
										))}
									</SidebarMenuSub>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton render={<button type="button" />}>
										<Document />
										<span>미디어</span>
										<SidebarMenuBadge>2</SidebarMenuBadge>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
		</SidebarProvider>
	);
}

const element = (text: string) => page.getByText(text, { exact: true }).first().element() as HTMLElement;
const rowOf = (name: string) => element(name).closest("a, button") as HTMLElement;

describe("the sidebar's rows (MN-1, MN-2, LS-03, LS-05)", () => {
	it("every count ends at the same edge, in a top row and in a folder at any depth", async () => {
		render(<Tree />);
		await expect.element(page.getByText("서울")).toBeVisible();
		const edges = [...document.querySelectorAll("[data-slot=sidebar-menu-badge], [data-slot=count]")].map((count) =>
			rightEdge(count),
		);
		expect(edges.length).toBe(DEPTHS.length + 2);
		expect(new Set(edges.map((edge) => edge.toFixed(1))).size).toBe(1);
	});

	it("a folder's name stands where its parent's does, and a level in is one 22px step", async () => {
		render(<Tree />);
		await expect.element(page.getByText("서울")).toBeVisible();
		const left = (name: string) => box(element(name)).left;
		const top = left("게시글");
		expect(left("안내")).toBe(top);
		expect(left("국내")).toBe(top + 22);
		expect(left("서울")).toBe(top + 44);
		expect(left("소식")).toBe(top);
	});

	it("a top row is 36px and a folder row 32px; their words are one size", async () => {
		render(<Tree />);
		await expect.element(page.getByText("서울")).toBeVisible();
		expect(box(rowOf("게시글")).height).toBe(36);
		expect(box(rowOf("미디어")).height).toBe(36);
		for (const name of NAMES) expect(box(rowOf(name)).height).toBe(32);
		expect(getComputedStyle(element("안내")).fontSize).toBe(getComputedStyle(element("게시글")).fontSize);
	});

	it("the tree's rule runs under the row's ground, so a row pointed at is not cut by it", async () => {
		render(<Tree />);
		await expect.element(page.getByText("서울")).toBeVisible();
		const style = getComputedStyle(rowOf("국내"), "::before");
		expect(Number.parseInt(style.zIndex, 10)).toBeLessThan(0);
	});
});

describe("a control whose words change keeps its width (TB-02)", () => {
	const widthOf = () => box(page.getByRole("button").first().element()).width;

	it("a plain pill is as wide in 'Publish' as in 'Published'", async () => {
		function Pill() {
			const [done, setDone] = useState(false);
			return (
				<Button reserve={["발행하기", "발행됨"]} onClick={() => setDone(true)}>
					{done ? "발행됨" : "발행하기"}
				</Button>
			);
		}
		render(<Pill />);
		await expect.element(page.getByRole("button")).toBeVisible();
		const before = widthOf();
		await page.getByRole("button").click();
		await expect.element(page.getByRole("button", { name: "발행됨" })).toBeVisible();
		expect(widthOf()).toBe(before);
	});

	it("a split pill keeps its width and the left edge of its neighbour", async () => {
		function Pill() {
			const [done, setDone] = useState(false);
			return (
				<div className="flex justify-end gap-monti-16">
					<Button variant="secondary">미리보기</Button>
					<SplitButton
						menuLabel="발행 방식"
						reserve={["발행하기", "발행됨"]}
						onClick={() => setDone(true)}
						menu={<DropdownMenuItem>오늘 날짜로</DropdownMenuItem>}
					>
						{done ? "발행됨" : "발행하기"}
					</SplitButton>
				</div>
			);
		}
		render(<Pill />);
		await expect.element(page.getByRole("button", { name: "미리보기" })).toBeVisible();
		const side = () => box(page.getByRole("button", { name: "미리보기" }).element()).left;
		const before = side();
		await page.getByRole("button", { name: "발행하기" }).click();
		await expect.element(page.getByRole("button", { name: "발행됨" })).toBeVisible();
		expect(side()).toBe(before);
	});
});

describe("menus (LT-14, LC-05, LC-09, LH-09, LP-02)", () => {
	function Menu({ search = false }: { search?: boolean }) {
		return (
			<DropdownMenu defaultOpen>
				<DropdownMenuTrigger render={<Button variant="secondary">열기</Button>} />
				<DropdownMenuContent>
					{search && <DropdownMenuSearch value="" onValueChange={() => {}} label="찾기" />}
					<DropdownMenuItem>전체</DropdownMenuItem>
					<DropdownMenuItem>제목</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	}

	it("a search row is one medium control high, as the rows under it", async () => {
		render(<Menu search />);
		await expect.element(page.getByText("전체")).toBeVisible();
		const search = document.querySelector("[data-slot=dropdown-menu-search]") as HTMLElement;
		// Whole pixels from the layout (`offset*`), not the box on screen: a menu opening is scaled while it fades in.
		expect(search.offsetHeight).toBe(32);
		expect((document.querySelector("[data-slot=dropdown-menu-item]") as HTMLElement).offsetHeight).toBe(32);
	});

	it("a menu of short words is 240px wide, not the width of its words", async () => {
		render(<Menu />);
		await expect.element(page.getByText("전체")).toBeVisible();
		expect((document.querySelector("[data-slot=dropdown-menu-content]") as HTMLElement).offsetWidth).toBe(240);
	});
});

describe("a status and a row of a table (LR-04, LR-01, LR-02, LR-14, LT-03)", () => {
	it("the mark stands 6px from the status name, the token's gap", async () => {
		render(<EntryStatus status="published">발행됨</EntryStatus>);
		await expect.element(page.getByText("발행됨")).toBeVisible();
		const mark = box(document.querySelector("[data-slot=entry-status-mark]") as HTMLElement);
		const name = box(element("발행됨"));
		expect(name.left - mark.right).toBe(6);
	});

	function Rows() {
		return (
			<Table container="none" layout="fixed" columns={[120, undefined, 80, 100, 90]}>
				<TableHeader>
					<TableRow>
						<TableHead>상태</TableHead>
						<TableHead>제목</TableHead>
						<TableHead>태그</TableHead>
						<TableHead>번역</TableHead>
						<TableHead>수정일</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{[0, 1].map((row) => (
						<TableRow key={row} data-row>
							<TableCell>
								<EntryStatus status={row === 0 ? "published" : "draft"} quiet={row === 0}>
									{row === 0 ? "발행됨" : "초안"}
								</EntryStatus>
							</TableCell>
							<TableCell truncate>
								<Text>{`첫 번째 글 ${row}`}</Text>
							</TableCell>
							<TableCell tone="subtle">개발</TableCell>
							<TableCell>
								<Text variant="caption">KO</Text>
							</TableCell>
							<TableCell tone="subtle">
								<Text variant="caption" mono>
									10. 26
								</Text>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		);
	}

	it("the words of every cell are centred on the row, one centre for the row (LR-01, LR-02, LR-14)", async () => {
		render(<Rows />);
		await expect.element(page.getByText("첫 번째 글 0")).toBeVisible();
		for (const row of document.querySelectorAll("tbody tr")) {
			const centre = centreY(row);
			for (const cell of row.querySelectorAll("td")) {
				const words = cell.querySelector("[data-slot=entry-status], span, p") ?? cell;
				const at = centreY(words);
				expect(
					Math.abs(at - centre),
					`${cell.textContent} centre ${at} against the row's ${centre}`,
				).toBeLessThanOrEqual(1.5);
			}
		}
	});

	it("a row with a check, language codes, a title with its address, a status and a row menu is 41px, as a plain one (LT-03, LR-14)", async () => {
		render(
			<Table container="none" layout="fixed" columns={[60, undefined, 100, 90, 48]}>
				<TableBody>
					<TableRow>
						<TableCell>
							<RowCheck checked={false} onCheckedChange={() => {}} label="고르기" />
							<LocaleCodes codes={["ko", "en", "ja"]} names="한국어, 영어, 일본어" />
						</TableCell>
						<TableCell truncate>
							<RowTitle title={<RowLink href="#/first">첫 번째 글</RowLink>} address="/posts/first-post" />
						</TableCell>
						<TableCell>
							<EntryStatus status="published">발행됨</EntryStatus>
						</TableCell>
						<TableCell tone="subtle">
							<Text variant="caption" mono>
								10. 26
							</Text>
						</TableCell>
						<TableCell>
							<RowActions>
								<RowMore label="더 보기" />
							</RowActions>
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>,
		);
		await expect.element(page.getByText("첫 번째 글")).toBeVisible();
		expect((document.querySelector("tbody tr") as HTMLElement).getBoundingClientRect().height).toBe(41);
	});

	it("a row is a whole number of pixels high, the head too (LT-03)", async () => {
		render(<Rows />);
		await expect.element(page.getByText("첫 번째 글 0")).toBeVisible();
		for (const row of document.querySelectorAll("tr")) {
			const { height } = row.getBoundingClientRect();
			expect(Number.isInteger(height), `${row.textContent} is ${height}px`).toBe(true);
		}
		const heights = [...document.querySelectorAll("tbody tr")].map((row) => row.getBoundingClientRect().height);
		expect(new Set(heights).size).toBe(1);
	});
});

describe("a page header (LH-02, LH-04)", () => {
	it("the title and the buttons of its end share one line's centre", async () => {
		render(
			<PageHeader title="게시글">
				<Button variant="secondary">검색</Button>
				<Button>새 글</Button>
			</PageHeader>,
		);
		await expect.element(page.getByText("게시글")).toBeVisible();
		const title = centreY(document.querySelector("h1") as HTMLElement);
		for (const button of document.querySelectorAll("button"))
			expect(Math.abs(centreY(button) - title)).toBeLessThanOrEqual(2);
		const [first, second] = [...document.querySelectorAll("button")].map((button) => box(button));
		expect(second.left - first.right).toBe(16);
	});
});

describe("the screen mode switch and the bulk bar (LS-02, LB-05)", () => {
	it("the switch's track, with its 2px ring, spans the same edges as a row of the nav above it", async () => {
		render(
			<SidebarProvider rail={false} onRailChange={() => {}}>
				<Sidebar label="관리자 메뉴">
					<SidebarContent>
						<SidebarMenu aria-label="콘텐츠">
							<SidebarMenuItem>
								<SidebarMenuButton render={<button type="button" />}>
									<Document />
									<span>미디어</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarContent>
					<SidebarFooter>
						<SidebarFoot>
							<SidebarScreenMode
								value="system"
								labels={{ label: "화면 모드", system: "시스템", light: "밝게", dark: "어둡게" }}
							/>
						</SidebarFoot>
					</SidebarFooter>
				</Sidebar>
			</SidebarProvider>,
		);
		await expect.element(page.getByText("미디어")).toBeVisible();
		const row = box(rowOf("미디어"));
		const track = box(document.querySelector("[data-slot=segmented]") as HTMLElement);
		expect(track.left - 2).toBe(row.left);
		expect(track.right + 2).toBe(row.right);
	});

	it("the bar's groups are the same distance apart: one gap between a count, a divider and a button", async () => {
		render(
			<BulkBar
				label="3개 선택"
				clearLabel="선택 해제"
				onClear={() => {}}
				request={{ label: "요청", onClick: () => {} }}
				more={{ label: "더 보기", children: null }}
			>
				<Button variant="ghost" size="sm">
					폴더로
				</Button>
			</BulkBar>,
		);
		await expect.element(page.getByText("3개 선택")).toBeVisible();
		const bar = document.querySelector("[data-slot=bulk-bar]") as HTMLElement;
		const parts = [...bar.children]
			.filter(
				(child) => !child.matches("[data-slot=select-all]") && !child.matches("[data-slot=text-button]:last-child"),
			)
			.map((child) => box(child));
		const gaps = parts.slice(1).map((part, index) => Math.round(part.left - parts[index].right));
		expect(new Set(gaps).size, `gaps ${gaps.join(", ")}`).toBe(1);
	});
});

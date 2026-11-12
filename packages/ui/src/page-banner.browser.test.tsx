import { useState } from "react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "../test/render";
import {
	Banner,
	Button,
	EditorHeader,
	IconButton,
	PageBanner,
	PageBody,
	PageColumn,
	PageHeader,
	Sidebar,
	SidebarInset,
	SidebarProvider,
	StandalonePage,
	Text,
} from "./index";

const box = (element: Element | null | undefined) => (element as Element).getBoundingClientRect();
const inset = () => document.querySelector("[data-slot=sidebar-inset]");
const place = () => document.querySelector("[data-slot=sidebar-inset-banner]");
const banner = (title: string) => page.getByText(title).element().closest("[data-slot=banner]");
/** Whether `first` comes before `second` in the document, which is the order a screen reader reads. */
const precedes = (first: Element | null, second: Element | null) =>
	Boolean((first as Element).compareDocumentPosition(second as Element) & Node.DOCUMENT_POSITION_FOLLOWING);

/** A frame with one page. The page's banner is written last in the page, under its title and its list; two buttons bring each banner in. */
function Frame({ site = false, own = true }: { site?: boolean; own?: boolean }) {
	const [siteShown, setSiteShown] = useState(site);
	const [ownShown, setOwnShown] = useState(own);
	return (
		<SidebarProvider rail={false} onRailChange={() => {}}>
			<Sidebar label="관리자 메뉴">
				<Text>몬티 블로그</Text>
			</Sidebar>
			<SidebarInset
				fixed
				banner={siteShown ? <Banner tone="danger" title="스키마를 적용하지 못했습니다" /> : null}
				corner={<IconButton label="어시스턴트 열기">✦</IconButton>}
			>
				<PageColumn>
					<PageHeader title="설정" />
					<PageBody>
						<Button onClick={() => setOwnShown(true)}>저장</Button>
						<Button onClick={() => setSiteShown(true)}>스키마 바꾸기</Button>
						<PageBanner>{ownShown ? <Banner tone="danger" title="저장하지 못했습니다" /> : null}</PageBanner>
					</PageBody>
				</PageColumn>
			</SidebarInset>
		</SidebarProvider>
	);
}

describe("PageBanner", () => {
	it("stands at the very top of the frame's page, edge to edge, with the page and the corner under it", async () => {
		render(<Frame />);
		await expect.element(page.getByText("저장하지 못했습니다")).toBeVisible();
		const own = box(banner("저장하지 못했습니다"));
		expect(own.top).toBe(box(inset()).top);
		expect(own.left).toBe(box(inset()).left);
		expect(own.right).toBe(box(inset()).right);
		expect(box(page.getByRole("heading", { name: "설정" }).element()).top).toBeGreaterThan(own.bottom);
		// The corner keeps its 12px, measured from under the banner.
		expect(box(page.getByRole("button", { name: "어시스턴트 열기" }).element()).top).toBe(own.bottom + 12);
	});

	it("is read before the page, as the frame's banners are, and is announced as they are", async () => {
		render(<Frame />);
		await expect.element(page.getByText("저장하지 못했습니다")).toBeVisible();
		const own = banner("저장하지 못했습니다");
		expect(place()?.contains(own)).toBe(true);
		expect(precedes(own, page.getByRole("heading", { name: "설정" }).element())).toBe(true);
		expect(own?.getAttribute("role")).toBe("status");
	});

	it("stands under the frame's banner, whichever of the two came first", async () => {
		render(<Frame site />);
		await expect.element(page.getByText("저장하지 못했습니다")).toBeVisible();
		expect(box(banner("스키마를 적용하지 못했습니다")).top).toBe(box(inset()).top);
		expect(box(banner("저장하지 못했습니다")).top).toBe(box(banner("스키마를 적용하지 못했습니다")).bottom);
	});

	it("keeps under a frame's banner that shows after it", async () => {
		render(<Frame />);
		await page.getByRole("button", { name: "스키마 바꾸기" }).click();
		await expect.element(page.getByText("스키마를 적용하지 못했습니다")).toBeVisible();
		expect(box(banner("스키마를 적용하지 못했습니다")).top).toBe(box(inset()).top);
		expect(box(banner("저장하지 못했습니다")).top).toBe(box(banner("스키마를 적용하지 못했습니다")).bottom);
	});

	it("takes no room while the page has nothing to say, and shows when it does", async () => {
		render(<Frame own={false} />);
		await expect.element(page.getByRole("heading", { name: "설정" })).toBeVisible();
		expect(box(place()).height).toBe(0);
		expect(document.querySelector("[data-slot=banner]")).toBeNull();
		const corner = page.getByRole("button", { name: "어시스턴트 열기" }).element();
		expect(box(corner).top).toBe(box(inset()).top + 12);
		await page.getByRole("button", { name: "저장" }).click();
		await expect.element(page.getByText("저장하지 못했습니다")).toBeVisible();
		expect(box(banner("저장하지 못했습니다")).top).toBe(box(inset()).top);
		expect(box(corner).top).toBe(box(banner("저장하지 못했습니다")).bottom + 12);
	});

	it("outside the frame, stands over the head row of a standalone page, under the page's own banners", async () => {
		render(
			<StandalonePage banner={<Banner tone="danger" title="로그인이 풀렸습니다" />}>
				<EditorHeader>
					<Text>게시글</Text>
				</EditorHeader>
				<PageBanner>
					<Banner title="원문 변경" />
				</PageBanner>
			</StandalonePage>,
		);
		await expect.element(page.getByText("원문 변경")).toBeVisible();
		const screen = box(document.querySelector("[data-slot=standalone-page]"));
		const session = box(banner("로그인이 풀렸습니다"));
		const own = box(banner("원문 변경"));
		expect(session.top).toBe(screen.top);
		expect(own.top).toBe(session.bottom);
		expect([own.left, own.right]).toEqual([screen.left, screen.right]);
		expect(box(document.querySelector("[data-slot=editor-header]")).top).toBe(own.bottom);
	});

	it("with no frame around it, is drawn where it stands", async () => {
		render(
			<PageColumn>
				<PageHeader title="설정" />
				<PageBanner>
					<Banner title="원문 변경" />
				</PageBanner>
			</PageColumn>,
		);
		await expect.element(page.getByText("원문 변경")).toBeVisible();
		expect(precedes(page.getByRole("heading", { name: "설정" }).element(), banner("원문 변경"))).toBe(true);
	});
});

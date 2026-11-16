import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { box } from "../../../testing/measure";
import { render } from "../test/render";
import { Caret } from "./caret";
import { Edit } from "./icons";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	BlockBox,
	BulkBar,
	Button,
	Checkbox,
	EditorHeader,
	EditorTitleRule,
	FilePreview,
	FloatingBar,
	FloatingBarButton,
	Image,
	Option,
	PageHeader,
	Switch,
	Tabs,
	TabsList,
	TabsTrigger,
} from "./index";
import { HELD } from "./sortable";

/** Parts the audit found to differ in the middle of a screen, measured on their own (PP-18, PP-24, LB-06, EB-04, MD-20, ST-39). */

describe("tabs (PP-18)", () => {
	it("tabs stand 20px apart, and each is pressable over 24px", async () => {
		render(
			<Tabs defaultValue="a">
				<TabsList>
					<TabsTrigger value="a">기본</TabsTrigger>
					<TabsTrigger value="b">검색 노출</TabsTrigger>
					<TabsTrigger value="c">활동</TabsTrigger>
				</TabsList>
			</Tabs>,
		);
		await expect.element(page.getByRole("tab", { name: "기본" })).toBeVisible();
		const tabs = [...document.querySelectorAll("[role=tab]")];
		const boxes = tabs.map((tab) => box(tab));
		for (const [at, each] of boxes.entries()) {
			if (at > 0) expect(each.left - boxes[at - 1].right).toBe(20);
			const layer = getComputedStyle(tabs[at] as Element, "::after");
			expect(Number.parseFloat(layer.height)).toBeGreaterThanOrEqual(24);
		}
	});
});

describe("a choice row with a switch (PP-24)", () => {
	it("the words stand at the start of the row and the switch at its far end, in a row 32px high", async () => {
		render(
			<div className="w-80">
				<Option spread>
					맨 위에 고정
					<Switch defaultChecked />
				</Option>
			</div>,
		);
		await expect.element(page.getByText("맨 위에 고정")).toBeVisible();
		const row = box(document.querySelector("label") as Element);
		const toggle = box(document.querySelector("[role=switch]") as Element);
		expect(row.height).toBe(32);
		expect(row.right - toggle.right).toBeLessThanOrEqual(1);
		expect(box(page.getByText("맨 위에 고정").element()).left).toBe(row.left);
	});
});

describe("a bar's icons (LB-06)", () => {
	it("the icons of one bar, in its buttons and its menus, are 16px, as the icon size of a 14px line", async () => {
		render(
			<BulkBar
				label="2개 선택"
				clearLabel="선택 해제"
				onClear={() => {}}
				request={{ label: "요청", onClick: () => {} }}
				more={{ label: "더 보기", children: null }}
			>
				<Button variant="ghost" size="sm">
					폴더로
					<Caret />
				</Button>
			</BulkBar>,
		);
		await expect.element(page.getByText("2개 선택")).toBeVisible();
		const icons = [...document.querySelectorAll("[data-slot=bulk-bar] button svg:not([data-slot=caret])")].map(
			(svg) => svg.getBoundingClientRect().width,
		);
		const named = [...document.querySelectorAll("[data-slot=bulk-bar] button svg:not([data-slot=caret])")].map(
			(svg) => `${svg.getAttribute("data-slot")}:${svg.getBoundingClientRect().width}`,
		);
		expect(icons.length).toBeGreaterThan(1);
		expect(new Set(icons).size, `icon sizes ${named.join(", ")}`).toBe(1);
	});
});

describe("the floating tool row's ink (EB-04)", () => {
	it("its text colour is a token of the design system, never pure black", async () => {
		render(
			<FloatingBar aria-label="도구">
				<FloatingBarButton label="편집">
					<Edit aria-hidden />
				</FloatingBarButton>
			</FloatingBar>,
		);
		await expect.element(page.getByRole("button", { name: "편집" })).toBeVisible();
		for (const element of [
			document.querySelector("[role=toolbar], [data-slot=floating-bar]"),
			document.querySelector("button"),
		]) {
			expect(getComputedStyle(element as Element).color).not.toBe("rgb(0, 0, 0)");
		}
	});
});

describe("the rule under a title (MD-20, ST-39)", () => {
	it("a page's title rule and an editor's are 1px, the same line as the rules under them", async () => {
		render(
			<>
				<PageHeader title="미디어" />
				<EditorHeader />
				<EditorTitleRule />
			</>,
		);
		await expect.element(page.getByText("미디어")).toBeVisible();
		const rule = document.querySelector("[data-slot=page-header]") as Element;
		expect(getComputedStyle(rule).borderBottomWidth).toBe("1px");
		expect(getComputedStyle(document.querySelector("[data-slot=editor-title-rule]") as Element).borderBottomWidth).toBe(
			"1px",
		);
	});
});

describe("a picked picture's line (EI-01)", () => {
	it("the line around a picked picture has the picture's own corner, so the two meet", async () => {
		render(
			<div className="w-80">
				<BlockBox selected>
					<Image src={null} alt="그림" ratio="photo" />
				</BlockBox>
			</div>,
		);
		await expect.poll(() => document.querySelector("[data-slot=block-line]")).not.toBeNull();
		const line = getComputedStyle(document.querySelector("[data-slot=block-line]") as Element).borderTopLeftRadius;
		const frame = document.querySelector("[data-slot=image]") as Element;
		expect(line).toBe(getComputedStyle(frame).borderTopLeftRadius);
	});
});

describe("hover grounds are the system's (LH-07)", () => {
	it("a quiet button's ground under the pointer is the muted ground of the system, and the primary pill's is the pill's own colour at 90%", async () => {
		render(
			<>
				<Button variant="ghost">검색</Button>
				<Button>새 글</Button>
			</>,
		);
		await expect.element(page.getByRole("button", { name: "검색" })).toBeVisible();
		const token = (name: string) => {
			const probe = document.createElement("i");
			probe.style.backgroundColor = `var(${name})`;
			document.body.append(probe);
			const colour = getComputedStyle(probe).backgroundColor;
			probe.remove();
			return colour;
		};
		await page.getByRole("button", { name: "검색" }).hover();
		await expect
			.poll(() => getComputedStyle(page.getByRole("button", { name: "검색" }).element()).backgroundColor)
			.toBe(token("--monti-bg-muted"));
		await page.getByRole("button", { name: "새 글" }).hover();
		// The pill's own colour at 90%: the colour mixed with some transparency, never another grey of its own.
		await expect
			.poll(() =>
				getComputedStyle(page.getByRole("button", { name: "새 글" }).element()).backgroundColor.replace(/\s/g, ""),
			)
			.toMatch(/\/0\.9\)$/);
	});
});

describe("a checkbox's keyboard focus (LK-02)", () => {
	it("the focus is the 2px line the checkbox's rule gives, standing off a square box with its own 3px corner", async () => {
		render(<Checkbox aria-label="고르기" />);
		const box = page.getByRole("checkbox", { name: "고르기" });
		await expect.element(box).toBeVisible();
		await userEvent.tab();
		const style = getComputedStyle(box.element());
		expect(style.outlineStyle).toBe("solid");
		expect(style.outlineWidth).toBe("2px");
		expect(style.borderTopLeftRadius).toBe("3px");
	});
});

describe("a file's place in dark (MD-54)", () => {
	it("the picture's place and a file's preview take the muted ground of the system, not a grey of their own", async () => {
		document.documentElement.dataset.theme = "dark";
		try {
			render(
				<div className="w-80">
					<FilePreview ext="CSV" framed />
				</div>,
			);
			await expect.element(page.getByText("CSV")).toBeInTheDocument();
			const probe = document.createElement("i");
			probe.style.backgroundColor = "var(--monti-bg-muted)";
			document.body.append(probe);
			const muted = getComputedStyle(probe).backgroundColor;
			probe.remove();
			expect(getComputedStyle(document.querySelector("[data-slot=file-preview]") as Element).backgroundColor).toBe(
				muted,
			);
		} finally {
			delete document.documentElement.dataset.theme;
		}
	});
});

describe("a question's two buttons (TL-03)", () => {
	it("the safe and the risky button are one height (36px), 16px apart, at the dialog's right edge", async () => {
		render(
			<AlertDialog defaultOpen>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>저장하지 않은 변경이 있어요</AlertDialogTitle>
						<AlertDialogDescription>나가면 이 화면에서 바꾼 것이 사라져요.</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel variant="danger">저장하지 않고 나가기</AlertDialogCancel>
						<AlertDialogAction>계속 편집</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>,
		);
		await expect.element(page.getByRole("button", { name: "계속 편집" })).toBeVisible();
		await new Promise((resolve) => setTimeout(resolve, 400));
		const [risky, safe] = [
			page.getByRole("button", { name: "저장하지 않고 나가기" }).element(),
			page.getByRole("button", { name: "계속 편집" }).element(),
		];
		expect([(risky as HTMLElement).offsetHeight, (safe as HTMLElement).offsetHeight]).toEqual([36, 36]);
		expect(Math.round(box(safe).left - box(risky).right)).toBe(16);
		const content = document.querySelector("[data-slot=alert-dialog-content]") as HTMLElement;
		expect(Math.round(box(content).right - box(safe).right)).toBe(
			24 + Number.parseFloat(getComputedStyle(content).borderRightWidth),
		);
	});
});

describe("a thing in hand, in dark (floating shadow: a transparent one)", () => {
	it("draws a 1px border-emphasis edge inside its box, and its shadow is valid: a ring written beside it still draws", async () => {
		document.documentElement.dataset.theme = "dark";
		try {
			render(<div className={`${HELD} h-10 w-40 ring-2 ring-monti-contrast`}>들고 있는 것</div>);
			await expect.element(page.getByText("들고 있는 것")).toBeVisible();
			const held = getComputedStyle(page.getByText("들고 있는 것").element());
			const probe = document.createElement("i");
			probe.style.color = "var(--monti-border-emphasis)";
			document.body.append(probe);
			const wanted = getComputedStyle(probe).color;
			probe.remove();
			expect([held.outlineStyle, held.outlineWidth, held.outlineColor]).toEqual(["solid", "1px", wanted]);
			expect(held.borderTopWidth).toBe("0px");
			// A shadow list with `none` in it is void whole: the ring and the floating shadow are both there.
			expect(held.boxShadow).not.toBe("none");
			expect(held.boxShadow).toContain("2px");
		} finally {
			delete document.documentElement.dataset.theme;
		}
	});
});

describe("a page header's two slots (one font each)", () => {
	it("the address after the title is mono, the note is sans, as a row title's two are", async () => {
		render(
			<>
				<PageHeader title="게시글" address="/posts/:slug" />
				<PageHeader title="휴지통" note="30일 남음" />
			</>,
		);
		await expect.element(page.getByText("30일 남음")).toBeVisible();
		expect(getComputedStyle(page.getByText("/posts/:slug").element()).fontFamily).toContain("Plex Mono");
		expect(getComputedStyle(page.getByText("30일 남음").element()).fontFamily).toContain("Pretendard");
	});
});

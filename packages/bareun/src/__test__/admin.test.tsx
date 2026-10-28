import { AdminComponentsProvider, useAdminComponents } from "@monti-cms/admin";
import { SiteProvider } from "@monti-cms/core/site";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TextIssueItem, TextIssues } from "../../../admin/src/editor/text-check/findings";
import { StatusBar, StatusCellsProvider } from "../../../admin/src/screens/shared/status-bar";
import { createTestRouter } from "../../../admin/src/test/router";
import { SiteWrapper } from "../../../admin/src/test/site";
import { testSite } from "../../test/site";
import bareunAdmin from "../admin";
import { bareun } from "../index";

const testRouter = createTestRouter();
const renderWithRouter = testRouter.render;

afterEach(cleanup);

function Checkers() {
	const { textCheckers = [] } = useAdminComponents();
	return <p>{textCheckers.map((checker) => checker.id).join(",")}</p>;
}

describe("Bareun checker admin side", () => {
	it("declares Bareun as the admin text checker, made from the site config values", () => {
		const { components } = bareunAdmin;
		expect(typeof components).toBe("function");
		if (typeof components !== "function") return;
		render(
			<SiteProvider site={testSite}>
				<AdminComponentsProvider components={components(testSite)}>
					<Checkers />
				</AdminComponentsProvider>
			</SiteProvider>,
		);
		expect(screen.getByText("bareun")).toBeTruthy();
	});

	it("the plugin definition fills in defaults and rejects invalid values", () => {
		const plugin = bareun();
		expect(plugin.name).toBe("text-check-bareun");
		expect(typeof plugin.server).toBe("function");
		expect(typeof plugin.admin).toBe("function");
		expect(plugin.nav ?? []).toEqual([]);
		expect(bareunAdmin.pages ?? {}).toEqual({});
		expect(() => bareun({ baseUrl: "ftp://x" })).toThrow();
		expect(() => bareun({ limits: { maxChars: 0 } })).toThrow();
	});

	describe("status bar cell (flow 1 step 06)", () => {
		const finding = (
			key: string,
			text: string,
			suggestion: string | null,
			over: Partial<TextIssueItem> = {},
		): TextIssueItem => ({
			key,
			text,
			suggestion,
			paragraph: 1,
			context: `${text} 동안`,
			jump: () => {},
			fix: suggestion === null ? null : () => {},
			...over,
		});
		const showBar = (textIssues: TextIssues | null, locale = "ko") => {
			const { statusCells } = bareunAdmin;
			if (!statusCells || typeof statusCells === "function") throw new Error("statusCells is a plain record");
			renderWithRouter(
				<SiteWrapper site={testSite}>
					<StatusCellsProvider cells={statusCells}>
						<StatusBar
							save={{ status: "saved", savedAt: null, backupAvailable: true, onSave: () => {} }}
							todo={null}
							chars={0}
							context={{ collection: "post", locale, textIssues }}
						/>
					</StatusCellsProvider>
				</SiteWrapper>,
			);
		};
		const issues = (items: TextIssueItem[], fixAll: (() => void) | null = null): TextIssues => ({
			count: items.length,
			items,
			fixAll,
		});
		const open = async () => {
			fireEvent.click(screen.getByRole("button", { name: /^맞춤법 \d/ }));
			return within(await screen.findByRole("dialog"));
		};

		it("counts the findings and lists each as what to change, where it is and one action", async () => {
			showBar(
				issues([
					finding("a", "몇일", "며칠"),
					finding("b", "안되요", "안 돼요", { paragraph: 3, context: "그래서 안되요" }),
				]),
			);
			const list = await open();
			expect(list.getByText("몇일 → 며칠")).toBeTruthy();
			expect(list.getByText("문단 3 · 그래서 안되요")).toBeTruthy();
			expect(list.getAllByRole("button", { name: "고치기" })).toHaveLength(2);
		});

		it("fixes one finding from its row", async () => {
			const fix = vi.fn();
			showBar(issues([finding("a", "몇일", "며칠", { fix }), finding("b", "안되요", "안 돼요")]));
			const list = await open();
			fireEvent.click(list.getAllByRole("button", { name: "고치기" })[0] as HTMLElement);
			expect(fix).toHaveBeenCalledTimes(1);
		});

		it("goes to the word when its row is pressed", async () => {
			const jump = vi.fn();
			showBar(issues([finding("a", "몇일", "며칠", { jump })]));
			fireEvent.click((await open()).getByText("몇일 → 며칠"));
			expect(jump).toHaveBeenCalledTimes(1);
		});

		it("fixes every finding from the footer", async () => {
			const fixAll = vi.fn();
			showBar(issues([finding("a", "몇일", "며칠")], fixAll));
			fireEvent.click((await open()).getByRole("button", { name: "모두 고치기" }));
			expect(fixAll).toHaveBeenCalledTimes(1);
		});

		it("offers no fix for a finding the checker has no suggestion for", async () => {
			showBar(issues([finding("a", "몇일", "며칠"), finding("b", "이상한 말", null)]));
			const list = await open();
			expect(list.getByText("이상한 말")).toBeTruthy();
			expect(list.getAllByRole("button", { name: "고치기" })).toHaveLength(1);
			expect(list.queryByRole("button", { name: "모두 고치기" })).toBeNull();
		});

		it("opens the place where the Bareun key is set from the footer", async () => {
			showBar(issues([finding("a", "몇일", "며칠")]));
			fireEvent.click((await open()).getByRole("button", { name: "설정" }));
			expect(testRouter.navigate).toHaveBeenCalledWith(testSite.adminHref("/api-keys"));
		});

		it("draws no cell when there is nothing to fix or no checker covers the language", () => {
			showBar(issues([]));
			expect(screen.queryByRole("button", { name: /맞춤법/ })).toBeNull();
			cleanup();
			showBar(null, "en");
			expect(screen.queryByRole("button", { name: /맞춤법/ })).toBeNull();
		});
	});
});

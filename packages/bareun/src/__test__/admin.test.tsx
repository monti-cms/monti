import { AdminComponentsProvider, useAdminComponents } from "@monti-cms/admin";
import { SiteProvider } from "@monti-cms/core/site";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type EditorStatus, StatusBar, StatusItemsProvider } from "../../../admin/src/screens/shared/status-bar";
import { SiteWrapper } from "../../../admin/src/test/site";
import { testSite } from "../../test/site";
import bareunAdmin from "../admin";
import { bareun } from "../index";

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

	describe("status bar item", () => {
		const editorStatus = (textIssues: EditorStatus["textIssues"]): EditorStatus => ({
			saveStatus: "saved",
			savedAt: null,
			statusLabel: "Draft",
			charCount: 0,
			readingMinutes: 1,
			bodyStats: { charsWithSpaces: 0, words: 0, paragraphs: 0, headings: 0 },
			backupAvailable: true,
			recovery: null,
			translations: null,
			save: () => {},
			publishReadiness: null,
			textIssues,
		});
		const showBar = (textIssues: EditorStatus["textIssues"]) => {
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
			);
			const { statusItems } = bareunAdmin;
			if (!statusItems || typeof statusItems === "function") throw new Error("statusItems is a plain record");
			render(
				<SiteWrapper site={testSite}>
					<StatusItemsProvider items={statusItems}>
						<StatusBar context={{ screen: "entry", editor: editorStatus(textIssues) }} />
					</StatusItemsProvider>
				</SiteWrapper>,
			);
		};

		const issues = (over: Partial<NonNullable<EditorStatus["textIssues"]>> = {}) => ({
			count: 2,
			jumpToFirst: () => {},
			items: [],
			recheck: null,
			checking: false,
			...over,
		});

		it("counts the findings of the body, and lists them with the suggestion when opened", async () => {
			showBar(
				issues({
					items: [
						{ text: "됬다", suggestion: "됐다", jump: () => {} },
						{ text: "안되", suggestion: null, jump: () => {} },
					],
				}),
			);
			fireEvent.click(screen.getByRole("button", { name: "맞춤법 2건" }));
			const popup = within(await screen.findByRole("dialog"));
			expect(popup.getByText("됬다")).toBeTruthy();
			expect(popup.getByText("→ 됐다")).toBeTruthy();
			expect(popup.getByText("안되")).toBeTruthy();
			expect(popup.queryByRole("button", { name: "다시 검사" })).toBeNull();
		});

		it("goes to the finding that is clicked, and checks again from the header", async () => {
			const jump = vi.fn();
			const recheck = vi.fn();
			showBar(issues({ items: [{ text: "됬다", suggestion: "됐다", jump }], recheck }));
			fireEvent.click(screen.getByRole("button", { name: "맞춤법 2건" }));
			const popup = within(await screen.findByRole("dialog"));
			fireEvent.click(popup.getByRole("button", { name: /됬다/ }));
			expect(jump).toHaveBeenCalledTimes(1);
			fireEvent.click(screen.getByRole("button", { name: "맞춤법 2건" }));
			fireEvent.click(await screen.findByRole("button", { name: "다시 검사" }));
			expect(recheck).toHaveBeenCalledTimes(1);
		});

		it("is hidden when there is nothing to fix or no checker covers the text", () => {
			showBar(issues({ count: 0 }));
			expect(screen.queryByRole("button", { name: /맞춤법/ })).toBeNull();
			cleanup();
			showBar(null);
			expect(screen.queryByRole("button", { name: /맞춤법/ })).toBeNull();
		});
	});
});

// @vitest-environment jsdom

import { translate } from "@monti-cms/core";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse as json } from "../../../../admin/src/test/fetch";
import { SiteWrapper } from "../../../../admin/src/test/site";
import { testSite } from "../../../test/site";
import type { AiActionView } from "../../actions";
import { AiManager } from "../ai-manager";
import { aiManagerMessages } from "../ai-manager.messages";
import { labelMessages, labelsOf } from "../labels.messages";

const tManager = testSite.createTranslator(aiManagerMessages);

const SAMPLE_ACTIONS: AiActionView[] = [
	{
		key: "slug",
		label: "Suggest slug",
		result: "candidates",
		apply: "replace",
		engine: "generate",
		pick: "one",
		input: { title: { kind: "text", label: "Title", required: true } },
		attach: [{ slot: "field", field: "slug", collections: ["post"] }],
		checks: [],
		definedChecks: [],
		validatorLabels: {},
		stream: false,
		defaults: {
			enabled: true,
			hidden: false,
			label: "Suggest slug",
			askInstruction: false,
			instant: false,
			providerId: null,
			modelName: "",
			prompt: "Generate slug",
			send: ["title"],
			threshold: 0.6,
			maxCount: 5,
			checks: [],
		},
		version: 1,
		updatedAt: null,
		overridden: [],
		enabled: true,
		hidden: false,
		askInstruction: false,
		instant: false,
		providerId: null,
		modelName: "",
		prompt: "Generate slug",
		send: ["title"],
		threshold: 0.6,
		maxCount: 5,
	},
	{
		key: "summary",
		label: "Write summary",
		result: "text",
		apply: "replace",
		engine: "generate",
		pick: "one",
		input: { body: { kind: "mdx", label: "Body", required: true } },
		attach: [{ slot: "field", field: "summary", collections: ["post"] }],
		checks: [],
		definedChecks: [],
		validatorLabels: {},
		stream: true,
		defaults: {
			enabled: true,
			hidden: false,
			label: "Write summary",
			askInstruction: false,
			instant: false,
			providerId: null,
			modelName: "",
			prompt: "Generate summary",
			send: ["body"],
			threshold: 0.6,
			maxCount: 5,
			checks: [],
		},
		version: 1,
		updatedAt: null,
		overridden: [],
		enabled: false,
		hidden: true,
		askInstruction: false,
		instant: false,
		providerId: null,
		modelName: "",
		prompt: "Generate summary",
		send: ["body"],
		threshold: 0.6,
		maxCount: 5,
	},
];

describe("AI Manager UI", () => {
	let actions: AiActionView[];
	let usable: string[];
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		// The Advanced choice is remembered in the browser; every test starts without one.
		window.localStorage.clear();
		actions = structuredClone(SAMPLE_ACTIONS);
		usable = ["slug", "summary"];
		fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
			if (input === "/api/monti/v1/ai/actions" && !init?.method) {
				return json({ usable, items: actions });
			}
			if (input === "/api/monti/v1/ai/settings" && !init?.method) {
				return json({ version: 1, providers: [], fake: true });
			}
			if (input === "/api/monti/v1/ai/snippets" && !init?.method) {
				return json({ version: 1, items: [] });
			}
			if (input.startsWith("/api/monti/v1/ai/actions/") && init?.method === "PATCH") {
				const key = input.split("/").pop() ?? "";
				const body = JSON.parse(String(init.body));
				const target = actions.find((item) => item.key === key);
				if (target) {
					Object.assign(target, body.value);
					target.version += 1;
					return json(target);
				}
			}
			throw new Error(`Unexpected fetch ${init?.method ?? "GET"} ${input}`);
		});
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("translates slot names and check names with concise titles", () => {
		const labelsKo = labelsOf((key, vars) => translate(labelMessages, "ko", key, vars));
		expect(labelsKo.slotLabel("selection")).toBe("선택 텍스트 메뉴");
		expect(labelsKo.slotLabel("insert")).toBe("블록 삽입 메뉴");
		expect(labelsKo.checkLabel("oneOf")).toBe("허용 값 목록");
		expect(labelsKo.checkLabel("exists")).toBe("기존에 등록된 값만");

		const labelsEn = labelsOf((key, vars) => translate(labelMessages, "en", key, vars));
		expect(labelsEn.slotLabel("selection")).toBe("Selected text menu");
		expect(labelsEn.slotLabel("insert")).toBe("Slash menu");
		expect(labelsEn.checkLabel("oneOf")).toBe("Allowed values list");
		expect(labelsEn.checkLabel("exists")).toBe("Existing values only");
	});

	it("warns that no feature runs while no connection is usable, and not otherwise", async () => {
		usable = [];
		const { unmount } = render(
			<SiteWrapper site={testSite}>
				<AiManager />
			</SiteWrapper>,
		);
		const notice = await screen.findByText(tManager("banner.needsConnection"));
		expect(notice.closest("output")).not.toBeNull();
		expect(screen.getByRole("button", { name: tManager("banner.goToConnections") })).toBeInTheDocument();
		// The switches show as off and cannot be turned on.
		const off = screen.getByLabelText(tManager("toggle.enableAction", { label: "Suggest slug" }));
		expect(off).toHaveAttribute("aria-checked", "false");
		expect(
			off.hasAttribute("disabled") || off.getAttribute("aria-disabled") === "true" || off.hasAttribute("data-disabled"),
		).toBe(true);
		unmount();

		usable = ["slug"];
		render(
			<SiteWrapper site={testSite}>
				<AiManager />
			</SiteWrapper>,
		);
		await screen.findByText("Suggest slug");
		expect(screen.queryByText(tManager("banner.needsConnection"))).not.toBeInTheDocument();
	});

	it("labels the grey line under a feature as where it shows up", async () => {
		render(
			<SiteWrapper site={testSite}>
				<AiManager />
			</SiteWrapper>,
		);
		await screen.findByText("Suggest slug");
		expect(screen.getAllByText(/^표시 위치: |^Shows in: /).length).toBeGreaterThan(0);
	});

	it("renders action list with direct toggle switch on rows and hides hidden built-ins by default", async () => {
		render(
			<SiteWrapper site={testSite}>
				<AiManager />
			</SiteWrapper>,
		);

		await waitFor(() => {
			expect(screen.getByText("Suggest slug")).toBeInTheDocument();
		});

		// Hidden action is not visible by default
		expect(screen.queryByText("Write summary")).not.toBeInTheDocument();

		// Has toggle switch directly on the row
		const slugToggle = screen.getByLabelText(tManager("toggle.enableAction", { label: "Suggest slug" }));
		expect(slugToggle).toBeInTheDocument();
		expect(slugToggle).toHaveAttribute("aria-checked", "true");

		// Clicking toggle updates the action
		fireEvent.click(slugToggle);
		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				expect.stringContaining("/api/monti/v1/ai/actions/slug"),
				expect.objectContaining({ method: "PATCH" }),
			);
		});

		// Hidden toggle button is shown
		const showHiddenBtn = screen.getByText(tManager("list.showHidden", { count: 1 }));
		expect(showHiddenBtn).toBeInTheDocument();

		// Click show hidden
		fireEvent.click(showHiddenBtn);
		await waitFor(() => {
			expect(screen.getByText("Write summary")).toBeInTheDocument();
		});
	});

	it("immediately saves when clicking hide button in feature editor without requiring save button click", async () => {
		render(
			<SiteWrapper site={testSite}>
				<AiManager />
			</SiteWrapper>,
		);

		await waitFor(() => {
			expect(screen.getByText("Suggest slug")).toBeInTheDocument();
		});

		// Open Suggest slug feature
		fireEvent.click(screen.getByText("Suggest slug"));

		// Hide button should say "Hide"
		const hideBtn = await screen.findByRole("button", { name: tManager("button.hide") });
		expect(hideBtn).toBeInTheDocument();

		// Clicking hide button immediately saves
		fireEvent.click(hideBtn);
		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				expect.stringContaining("/api/monti/v1/ai/actions/slug"),
				expect.objectContaining({
					method: "PATCH",
					body: expect.stringContaining('"hidden":true'),
				}),
			);
		});
	});

	const renderManager = () =>
		render(
			<SiteWrapper site={testSite}>
				<AiManager />
			</SiteWrapper>,
		);

	it("shows the essentials of an action and keeps the advanced fields behind Advanced", async () => {
		renderManager();
		fireEvent.click(await screen.findByText("Suggest slug"));

		expect(await screen.findByRole("button", { name: tManager("test.run") })).toBeInTheDocument();
		expect(screen.getByLabelText(tManager("field.model"))).toBeInTheDocument();
		expect(screen.getByText(tManager("about.candidates"))).toBeInTheDocument();
		expect(screen.queryByLabelText(tManager("field.prompt"))).not.toBeInTheDocument();
		expect(screen.queryByText(tManager("toggle.ask"))).not.toBeInTheDocument();
		expect(screen.queryByText(tManager("status.modified"))).not.toBeInTheDocument();

		fireEvent.click(screen.getByTestId("ai-advanced-toggle"));
		expect(await screen.findByLabelText(tManager("field.prompt"))).toBeInTheDocument();
		expect(screen.getByText(tManager("toggle.ask"))).toBeInTheDocument();
		expect(screen.getByText(tManager("field.send"))).toBeInTheDocument();
		expect(screen.getByText(tManager("field.checks"))).toBeInTheDocument();
	});

	it("marks an action with an edited instruction as modified and opens Advanced for it", async () => {
		// The fixture is a fresh clone per test (beforeEach), so replacing the item here touches nothing else.
		actions[0] = { ...(actions[0] as AiActionView), prompt: "Write a very different slug", overridden: ["prompt"] };
		renderManager();
		await screen.findByText("Suggest slug");
		expect(screen.getAllByText(tManager("status.modified"))).toHaveLength(1);

		fireEvent.click(screen.getByText("Suggest slug"));
		const prompt = await screen.findByLabelText(tManager("field.prompt"));
		expect((prompt as HTMLTextAreaElement).value).toBe("Write a very different slug");
	});

	it("resets an edited instruction to the default", async () => {
		actions[0] = { ...(actions[0] as AiActionView), prompt: "Write a very different slug" };
		renderManager();
		fireEvent.click(await screen.findByText("Suggest slug"));
		const prompt = (await screen.findByLabelText(tManager("field.prompt"))) as HTMLTextAreaElement;

		fireEvent.click(screen.getByRole("button", { name: tManager("button.reset") }));
		await waitFor(() => expect(prompt.value).toBe("Generate slug"));
		expect(screen.queryAllByText(tManager("status.modified")).length).toBeLessThanOrEqual(1);
	});

	it("remembers that Advanced was opened for the next action", async () => {
		actions[1] = { ...(actions[1] as AiActionView), hidden: false };
		renderManager();
		fireEvent.click(await screen.findByText("Suggest slug"));
		fireEvent.click(await screen.findByTestId("ai-advanced-toggle"));
		await screen.findByLabelText(tManager("field.prompt"));

		fireEvent.click(screen.getByText("Write summary"));
		await screen.findByRole("heading", { name: "Write summary" });
		expect(await screen.findByLabelText(tManager("field.prompt"))).toBeInTheDocument();
	});
});

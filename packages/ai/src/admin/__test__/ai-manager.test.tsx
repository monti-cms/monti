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
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		actions = structuredClone(SAMPLE_ACTIONS);
		fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
			if (input === "/api/monti/v1/ai/actions" && !init?.method) {
				return json({ usable: ["slug", "summary"], items: actions });
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

	it("translates slot names and check names with descriptive titles", () => {
		const labelsKo = labelsOf((key, vars) => translate(labelMessages, "ko", key, vars));
		expect(labelsKo.slotLabel("selection")).toBe("선택 텍스트 메뉴 (본문 드래그 시)");
		expect(labelsKo.slotLabel("insert")).toBe("블록 삽입 메뉴 ('/' 입력 시)");
		expect(labelsKo.checkLabel("oneOf")).toBe("허용 값 목록");
		expect(labelsKo.checkLabel("exists")).toBe("기존에 등록된 값만");

		const labelsEn = labelsOf((key, vars) => translate(labelMessages, "en", key, vars));
		expect(labelsEn.slotLabel("selection")).toBe("Selected text menu (on highlight)");
		expect(labelsEn.slotLabel("insert")).toBe("Slash menu (typed '/' in body)");
		expect(labelsEn.checkLabel("oneOf")).toBe("Allowed values list");
		expect(labelsEn.checkLabel("exists")).toBe("Existing values only");
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
});

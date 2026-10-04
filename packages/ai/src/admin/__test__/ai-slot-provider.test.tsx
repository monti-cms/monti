// @vitest-environment jsdom

import { TooltipProvider } from "@monti-cms/admin/kit";
import { useSlot } from "@monti-cms/admin/slots";
import { createTranslator } from "@monti-cms/core/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiCommonMessages } from "../ai-common.messages";
import { AiSlotProvider } from "../ai-slot-provider";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

const t = createTranslator(aiCommonMessages);

/** Checks only how a screen slot receives the AI action. The list response is fake. */
const view = (key: string, label: string) => ({
	key,
	label,
	enabled: true,
	apply: "replace",
	askInstruction: false,
	instant: false,
	attach: [{ slot: "field", field: "title" }],
});

let items: ReturnType<typeof view>[] = [];

beforeEach(() => {
	items = [view("a", "Suggest titles")];
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({
			ok: true,
			status: 200,
			json: async () => ({ usable: items.map((item) => item.key), items }),
		})),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function Place() {
	const { trigger } = useSlot({ slot: "field", target: "title", getContext: () => ({}), apply: () => {} });
	return <span data-testid="trigger">{trigger}</span>;
}

function renderPlace() {
	render(
		<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
			<TooltipProvider>
				<AiSlotProvider>
					<Place />
				</AiSlotProvider>
			</TooltipProvider>
		</QueryClientProvider>,
	);
}

describe("AI slot source", () => {
	it("gives each action the AI look (sparkles icon, its own label)", async () => {
		renderPlace();
		const button = await screen.findByRole("button", { name: "Suggest titles" });
		expect(button.querySelector("svg.lucide-sparkles")).toBeTruthy();
	});

	it("groups several actions in one menu named AI, each item with the sparkles icon", async () => {
		items = [view("a", "Suggest titles"), view("b", "Write summary")];
		renderPlace();
		const menu = await screen.findByRole("button", { name: t("slotMenu") });
		expect(menu.querySelector("svg.lucide-sparkles")).toBeTruthy();
		fireEvent.click(menu);
		await waitFor(() => expect(screen.getAllByRole("menuitem")).toHaveLength(2));
		for (const item of screen.getAllByRole("menuitem")) {
			expect(item.querySelector("svg.lucide-sparkles")).toBeTruthy();
		}
	});
});

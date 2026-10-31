import { TooltipProvider } from "@monti-cms/ui";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { NoticeError } from "../../api/client";
import { renderWithSite } from "../../test/site";
import { slotsMessages } from "../messages";
import { type SlotAction, SlotRegistryProvider, type SlotRequest, type SlotSource, useSlot } from "../slots";

const t = testSite.createTranslator(slotsMessages);

afterEach(cleanup);

function Host({ request }: { request: SlotRequest }) {
	const { trigger, panel } = useSlot(request);
	return (
		<div>
			<span data-testid="trigger">{trigger}</span>
			{panel}
		</div>
	);
}

const action = (overrides: Partial<SlotAction> = {}): SlotAction => ({
	id: "a1",
	label: "Suggest a slug",
	apply: "replace",
	run: async () => ({ kind: "candidates", items: [{ value: "react-query", label: "react-query" }] }),
	...overrides,
});

function renderSlot(sources: SlotSource[], request: Partial<SlotRequest> = {}) {
	const apply = vi.fn();
	const getContext = vi.fn(() => ({ title: "Title" }));
	renderWithSite(
		<TooltipProvider>
			<SlotRegistryProvider sources={sources}>
				<Host request={{ slot: "field", target: "slug", collection: "post", getContext, apply, ...request }} />
			</SlotRegistryProvider>
		</TooltipProvider>,
	);
	return { apply, getContext };
}

describe("the fill action of a slot", () => {
	it("renders nothing when no action is attached, and asks the source with the slot, target and collection", () => {
		const source = vi.fn<SlotSource>(() => []);
		renderSlot([source]);
		expect(source).toHaveBeenCalledWith({ slot: "field", target: "slug", collection: "post" });
		expect(screen.getByTestId("trigger").childElementCount).toBe(0);
	});

	it("PLUG-A3 one press runs the action with the current context and puts the result in at once, with no result panel", async () => {
		const { apply, getContext } = renderSlot([() => [action()]]);
		fireEvent.click(screen.getByRole("button"));
		await waitFor(() => expect(apply).toHaveBeenCalledWith("react-query", "replace"));
		expect(getContext).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.getAllByRole("button")).toHaveLength(1);
	});

	it("says fill while the target is empty and again once it has a value; both are the same press", () => {
		renderSlot([() => [action()]]);
		expect(screen.getByRole("button").textContent).toMatch(/Fill/);
		cleanup();
		renderSlot([() => [action()]], { filled: true });
		expect(screen.getByRole("button").textContent).toMatch(/Again/);
	});

	it("shows writing while the request runs and cannot be pressed again", async () => {
		let finish: (() => void) | undefined;
		const run = vi.fn(
			() =>
				new Promise<Awaited<ReturnType<SlotAction["run"]>>>((resolve) => {
					finish = () => resolve({ kind: "text", text: "Done." });
				}),
		);
		const { apply } = renderSlot([() => [action({ run })]]);
		fireEvent.click(screen.getByRole("button"));
		const busy = await screen.findByRole("button", { name: /Writing/ });
		expect(busy.getAttribute("aria-busy")).toBe("true");
		fireEvent.click(busy);
		expect(run).toHaveBeenCalledTimes(1);
		finish?.();
		await waitFor(() => expect(apply).toHaveBeenCalledWith("Done.", "replace"));
		await waitFor(() => expect(screen.getByRole("button").getAttribute("aria-busy")).toBeNull());
	});

	it("PLUG-A3 a failed run leaves one error line and writes nothing", async () => {
		const run = vi.fn(async () => {
			throw new NoticeError("No connection is ready.");
		});
		const { apply } = renderSlot([() => [action({ run })]]);
		fireEvent.click(screen.getByRole("button"));
		expect((await screen.findByRole("alert")).textContent).toContain("No connection is ready.");
		expect(apply).not.toHaveBeenCalled();
	});

	it("PLUG-A3 an empty result says so instead of writing", async () => {
		const { apply } = renderSlot([() => [action({ run: async () => ({ kind: "candidates", items: [] }) })]]);
		fireEvent.click(screen.getByRole("button"));
		expect((await screen.findByRole("alert")).textContent).toContain(t("nothingToApply"));
		expect(apply).not.toHaveBeenCalled();
	});

	it("with more than one action the press lists them by name and runs the one picked", async () => {
		const second = vi.fn(async () => ({ kind: "text" as const, text: "From the second." }));
		const { apply } = renderSlot([() => [action(), action({ id: "a2", label: "Rewrite it", run: second })]]);
		fireEvent.click(screen.getByRole("button"));
		fireEvent.click(await screen.findByRole("menuitem", { name: "Rewrite it" }));
		await waitFor(() => expect(apply).toHaveBeenCalledWith("From the second.", "replace"));
	});

	it("is disabled when the request is", () => {
		renderSlot([() => [action()]], { disabled: true });
		expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
	});
});

// @vitest-environment jsdom
import { Editor, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import type { ImageInserted, ImageInsertedEvent } from "../../events";
import { toast } from "../../test/ui-toast";
import { BLOCK_ID_ATTRIBUTE, CmsBlockIds, findBlock } from "../block-ids";
import { runImageInserted } from "../image-inserted";

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

/** The attributes of the core image node that `editor.imageInserted` reads and fills. */
const Image = Node.create({
	name: "image",
	group: "block",
	atom: true,
	addAttributes: () => ({
		mediaId: { default: null },
		alt: { default: "" },
		caption: { default: "" },
		decorative: { default: null },
	}),
	parseHTML: () => [{ tag: "figure" }],
	renderHTML: () => ["figure"],
});

const ID = "img00001";
let editor: Editor;
beforeEach(() => {
	editor = new Editor({
		extensions: [StarterKit, Image, CmsBlockIds],
		content: {
			type: "doc",
			content: [
				{ type: "paragraph", content: [{ type: "text", text: "Before the image." }] },
				{ type: "image", attrs: { [BLOCK_ID_ATTRIBUTE]: ID, mediaId: "m1", alt: "", caption: "" } },
				{ type: "paragraph", content: [{ type: "text", text: "After it." }] },
			],
		},
	});
});
afterEach(() => editor.destroy());

const attrs = () => editor.state.doc.nodeAt(findBlock(editor.state.doc, ID) ?? -1)?.attrs ?? {};
const run = (subscribers: readonly ImageInserted[]) =>
	runImageInserted({
		editor,
		blockId: ID,
		subscribers,
		site: testSite,
		marker: "[image]",
		failed: "Could not fill it in.",
	});
/** A subscriber that waits until it is let go, and hands its event out. */
const held = () => {
	let release: () => void = () => undefined;
	let event: ImageInsertedEvent | undefined;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const subscriber: ImageInserted = async (given) => {
		event = given;
		await gate;
	};
	return { subscriber, release: () => release(), event: () => event as ImageInsertedEvent };
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("editor.imageInserted", () => {
	it("hands the image and the text around it, and fills fields that are still empty", async () => {
		const sub = held();
		run([sub.subscriber]);
		await settle();
		expect(sub.event().image).toEqual({ mediaId: "m1", alt: "", caption: "", decorative: false });
		expect(sub.event().around).toBe("Before the image.\n[image]\nAfter it.");
		expect(sub.event().fill({ alt: "A cat on a sofa", caption: "The cat" })).toBe(true);
		expect(attrs()).toMatchObject({ alt: "A cat on a sofa", caption: "The cat" });
		sub.release();
	});

	it("keeps what the person typed after the insert, even when they cleared it again", async () => {
		const sub = held();
		run([sub.subscriber]);
		await settle();
		const pos = findBlock(editor.state.doc, ID) as number;
		editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, "alt", "Mine"));
		expect(sub.event().fill({ alt: "Generated", caption: "Generated caption" })).toBe(true);
		expect(attrs()).toMatchObject({ alt: "Mine", caption: "Generated caption" });
		editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, "alt", ""));
		expect(sub.event().fill({ alt: "Generated" })).toBe(false);
		expect(attrs().alt).toBe("");
		sub.release();
	});

	it("writes nothing and aborts the signal once the image was removed", async () => {
		const sub = held();
		run([sub.subscriber]);
		await settle();
		const pos = findBlock(editor.state.doc, ID) as number;
		editor.view.dispatch(editor.state.tr.delete(pos, pos + 1));
		expect(sub.event().signal.aborted).toBe(true);
		expect(sub.event().fill({ alt: "Late" })).toBe(false);
		sub.release();
	});

	it("runs every subscriber on its own: a failing one leaves the image and the others alone", async () => {
		const failing: ImageInserted = async () => {
			throw new Error("The model is down");
		};
		const filling: ImageInserted = async (event) => void event.fill({ caption: "From the other one" });
		run([failing, filling]);
		await settle();
		await settle();
		expect(attrs()).toMatchObject({ alt: "", caption: "From the other one", mediaId: "m1" });
		expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Could not fill it in."));
	});
});

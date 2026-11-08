import { describe, expect, it, vi } from "vitest";
import { putFile } from "./put-file";

const PDF = new TextEncoder().encode("%PDF-1.7\n");

describe("putting a file", () => {
	it("09-1 a file that cannot be read, as a folder dropped from the OS, stops with its reason and sends nothing", async () => {
		const uploader = vi.fn();
		const folder = new File([], "photos");
		folder.slice = () => {
			const blob = new Blob();
			blob.arrayBuffer = () => Promise.reject(new DOMException("A requested file could not be found", "NotFoundError"));
			return blob;
		};
		expect(await putFile(folder, uploader)).toEqual({ ok: false, problem: "cannotRead", kind: null });
		expect(uploader).not.toHaveBeenCalled();
	});

	it("09-3 a place that takes only images refuses another file before it goes up", async () => {
		const uploader = vi.fn();
		const pdf = new File([PDF], "price.pdf", { type: "application/pdf" });
		expect(await putFile(pdf, uploader, { only: "image" })).toEqual({ ok: false, problem: "notImage", kind: "file" });
		expect(uploader).not.toHaveBeenCalled();
	});
});

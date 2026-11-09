import { describe, expect, it, vi } from "vitest";
import { putFile, refusalOf } from "./put-file";

const PDF = new TextEncoder().encode("%PDF-1.7\n");

describe("what shows of a file before it is sent", () => {
	it("09-1 the library refuses a kind it does not take, and one over the limit", async () => {
		expect(await refusalOf(new File([new Uint8Array([0x4d, 0x5a])], "setup.exe"))).toBe("type");
		expect(await refusalOf(new File([PDF, new Uint8Array(10 * 1024 * 1024)], "price.pdf"))).toBe("tooBig");
	});

	it("09-3 a file goes where it fits", async () => {
		const pdf = new File([PDF], "price.pdf", { type: "application/pdf" });
		expect(await refusalOf(pdf)).toBeNull();
		expect(await refusalOf(pdf, "image")).toBe("notImage");
	});
});

describe("putting a file", () => {
	it("09-1 a file that cannot be read, as a folder dropped from the OS, stops with its reason and sends nothing", async () => {
		const uploader = vi.fn();
		const folder = new File([], "photos");
		folder.slice = () => {
			const blob = new Blob();
			blob.arrayBuffer = () => Promise.reject(new DOMException("A requested file could not be found", "NotFoundError"));
			return blob;
		};
		expect(await putFile(folder, uploader)).toEqual({ ok: false, problem: "unreadable" });
		expect(uploader).not.toHaveBeenCalled();
	});

	it("09-3 a place that takes only images refuses another file before it goes up", async () => {
		const uploader = vi.fn();
		const pdf = new File([PDF], "price.pdf", { type: "application/pdf" });
		expect(await putFile(pdf, uploader, { only: "image" })).toEqual({ ok: false, problem: "notImage" });
		expect(uploader).not.toHaveBeenCalled();
	});
});

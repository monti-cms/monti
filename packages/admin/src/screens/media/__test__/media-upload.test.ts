import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import {
	acceptedKinds,
	checkUpload,
	enqueue,
	extensionOf,
	nextToUpload,
	patchEntry,
	removeEntry,
	replaceProblem,
} from "../media-upload";

const file = (name: string, type: string, size = 10) => {
	const made = new File(["x"], name, { type });
	Object.defineProperty(made, "size", { value: size });
	return made;
};

describe("checking a file before it is sent", () => {
	it("lets pictures and accepted files through", () => {
		expect(checkUpload(testSite, file("a.png", "image/png"))).toBeNull();
		expect(checkUpload(testSite, file("a.pdf", "application/pdf"))).toBeNull();
	});

	it("refuses a type the site does not take, with nothing to fix", () => {
		expect(checkUpload(testSite, file("IMG_2041.HEIC", "image/heic"))).toEqual({ kind: "type" });
		expect(checkUpload(testSite, file("setup.exe", "application/x-msdownload"))).toEqual({ kind: "type" });
	});

	it("says a picture over the limit can be shrunk and another file cannot", () => {
		const big = testSite.api.MAX_MEDIA_BYTES + 1;
		expect(checkUpload(testSite, file("panorama.jpg", "image/jpeg", big))).toEqual({
			kind: "size",
			bytes: big,
			limit: testSite.api.MAX_MEDIA_BYTES,
			shrinkable: true,
		});
		const bigFile = testSite.api.MAX_FILE_BYTES + 1;
		expect(checkUpload(testSite, file("a.pdf", "application/pdf", bigFile))).toMatchObject({
			kind: "size",
			shrinkable: false,
		});
	});

	it("names the kinds the site takes, images first", () => {
		const kinds = acceptedKinds(testSite);
		expect(kinds[0]).toBe("image");
		expect(kinds).toContain("pdf");
	});
});

describe("the queue", () => {
	it("starts with files waiting and the ones with a known problem already failed, and sends one at a time in order", () => {
		const queue = enqueue(
			testSite,
			[file("a.png", "image/png"), file("setup.exe", "application/x-msdownload"), file("b.png", "image/png")],
			"blog",
		);
		expect(queue.map((entry) => entry.status)).toEqual(["waiting", "failed", "waiting"]);
		expect(queue.every((entry) => entry.folderId === "blog")).toBe(true);
		expect(new Set(queue.map((entry) => entry.id)).size).toBe(3);
		expect(nextToUpload(queue)?.file.name).toBe("a.png");
		const going = patchEntry(queue, queue[0]?.id ?? "", { status: "uploading", percent: 40 });
		expect(nextToUpload(going)).toBeUndefined();
		const done = removeEntry(going, queue[0]?.id ?? "");
		expect(nextToUpload(done)?.file.name).toBe("b.png");
	});
});

describe("extension", () => {
	it("is the last part of the name, lowercase", () => {
		expect(extensionOf("Price.List.PDF")).toBe("pdf");
		expect(extensionOf("README")).toBe("");
	});
});

describe("replacing a file", () => {
	it("lets a picture take a picture's place and a file a file of the same type's", () => {
		expect(replaceProblem(testSite, { mimeType: "image/jpeg" }, file("v2.png", "image/png"))).toBeNull();
		expect(replaceProblem(testSite, { mimeType: "application/pdf" }, file("v2.pdf", "application/pdf"))).toBeNull();
	});

	it("refuses a picture for a file, a file for a picture, and a file of another type", () => {
		expect(replaceProblem(testSite, { mimeType: "image/jpeg" }, file("v2.pdf", "application/pdf"))).toBe("kind");
		expect(replaceProblem(testSite, { mimeType: "application/pdf" }, file("v2.png", "image/png"))).toBe("kind");
		expect(replaceProblem(testSite, { mimeType: "application/pdf" }, file("v2.txt", "text/plain"))).toBe("type");
	});
});

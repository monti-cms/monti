import { describe, expect, it } from "vitest";
import { kindDefaults } from "../collection";

describe("kindDefaults", () => {
	it("gives a document collection a body and folders", () => {
		expect(kindDefaults("document")).toEqual({ body: true, folders: true });
	});

	it("gives an item collection neither", () => {
		expect(kindDefaults("item")).toEqual({ body: false, folders: false });
	});

	it("treats an unknown kind like an item collection", () => {
		expect(kindDefaults(undefined)).toEqual({ body: false, folders: false });
	});
});

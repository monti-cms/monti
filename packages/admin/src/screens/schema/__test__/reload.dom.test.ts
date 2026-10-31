import { afterEach, describe, expect, it } from "vitest";
import { rememberSaved, takeSavedMessage } from "../reload";

describe("the note a save leaves for the reload", () => {
	afterEach(() => window.sessionStorage.clear());

	it("SCHEMA-N3 hands the message back once", () => {
		rememberSaved("적용됐어요");
		expect(takeSavedMessage()).toEqual({ message: "적용됐어요" });
		expect(takeSavedMessage()).toBeNull();
	});

	it("SCHEMA-N3 carries the address its action opens", () => {
		rememberSaved("노트를 만들었어요", "/admin?collection=note");
		expect(takeSavedMessage()).toEqual({ message: "노트를 만들었어요", href: "/admin?collection=note" });
		expect(takeSavedMessage()).toBeNull();
	});

	it("SCHEMA-N3 does not keep the address of an earlier save", () => {
		rememberSaved("노트를 만들었어요", "/admin?collection=note");
		rememberSaved("적용됐어요");
		expect(takeSavedMessage()).toEqual({ message: "적용됐어요" });
	});
});

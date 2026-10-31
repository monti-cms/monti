import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assignStateSilently, createStateStore, notifyStateStore, useStoreSelector } from "../store";

afterEach(cleanup);

describe("state store", () => {});

describe("mirroring props into a store", () => {
	it("a silent write is visible to a render in the same pass, and subscribers are told afterwards", () => {
		const store = createStateStore({ title: "a", body: "x" });
		const listener = vi.fn();
		store.subscribe(listener);
		expect(assignStateSilently(store, { title: "a", body: "x" })).toBe(false);
		expect(assignStateSilently(store, { title: "b", body: "x" })).toBe(true);
		expect(store.getState().title).toBe("b");
		expect(listener).not.toHaveBeenCalled();
		notifyStateStore(store);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(store.getState().title).toBe("b");
	});
});

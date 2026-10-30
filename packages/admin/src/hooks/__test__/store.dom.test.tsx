import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assignStateSilently, createStateStore, notifyStateStore, useStoreSelector } from "../store";

afterEach(cleanup);

describe("state store", () => {
	it("merges partial updates and notifies subscribers", () => {
		const store = createStateStore({ a: 1, b: 2 });
		const listener = vi.fn();
		const unsubscribe = store.subscribe(listener);
		store.setState({ a: 5 });
		store.setState((state) => ({ b: state.b + 1 }));
		expect(store.getState()).toEqual({ a: 5, b: 3 });
		expect(listener).toHaveBeenCalledTimes(2);
		unsubscribe();
		store.setState({ a: 6 });
		expect(listener).toHaveBeenCalledTimes(2);
		expect(store.getInitialState()).toEqual({ a: 1, b: 2 });
	});

	it("a selector hook re-renders only when its slice changes", () => {
		const store = createStateStore({ title: "a", body: "x" });
		const renders = vi.fn();
		function Title() {
			const title = useStoreSelector(store, (state) => state.title);
			renders();
			return <p>{title}</p>;
		}
		render(<Title />);
		expect(renders).toHaveBeenCalledTimes(1);

		act(() => store.setState({ body: "y" }));
		expect(renders).toHaveBeenCalledTimes(1);

		act(() => store.setState({ title: "b" }));
		expect(screen.getByText("b")).toBeTruthy();
		expect(renders).toHaveBeenCalledTimes(2);
	});
});

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

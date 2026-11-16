import { useState } from "react";
import { flushSync } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { scene } from "../../../test/scene";
import { useToday } from "./use-today";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** The day of the month the hook gives, written where the test reads it. */
function Today() {
	return <output aria-label="today">{useToday().getDate()}</output>;
}

/** Puts the hook's reader in the page and takes it out: the test sets its clock first, then asks for it. */
let show: (on: boolean) => void = () => {};
function Gate() {
	const [on, setOn] = useState(false);
	show = setOn;
	return on ? <Today /> : <output aria-label="gate" />;
}

describe("useToday: the day while the screen stays open", () => {
	const shown = () => document.querySelector('output[aria-label="today"]')?.textContent ?? null;
	/** Time goes by, and what the timers set is drawn before the next line. */
	const pass = (ms: number) => flushSync(() => vi.advanceTimersByTime(ms));

	afterEach(() => {
		vi.useRealTimers();
	});

	it("[TB-04] the day changes at the next local midnight with no event, the timer waits for the midnight after it, and leaving clears it", async () => {
		await scene({ render: () => <Gate /> }, { title: "useToday" }).run();
		await expect.element(page.getByRole("status", { name: "gate" })).toBeInTheDocument();
		// A minute before midnight, by the local clock. Only this hook's timer is counted: nothing else is in the page.
		vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"], now: new Date(2026, 10, 16, 23, 59, 0) });
		const before = vi.getTimerCount();
		flushSync(() => show(true));
		expect(shown()).toBe("16");
		expect(vi.getTimerCount()).toBe(before + 1);

		// Not yet midnight: the same day.
		pass(MINUTE - 1000);
		expect(shown()).toBe("16");
		// Midnight: the next day, and one timer waits again.
		pass(1000);
		expect(shown()).toBe("17");
		expect(vi.getTimerCount()).toBe(before + 1);

		// The midnight after it: a whole day on, and not before.
		pass(DAY - 1000);
		expect(shown()).toBe("17");
		pass(1000);
		expect(shown()).toBe("18");
		expect(vi.getTimerCount()).toBe(before + 1);

		// Gone from the page: nothing waits, and no later midnight draws anything.
		flushSync(() => show(false));
		expect(shown()).toBeNull();
		expect(vi.getTimerCount()).toBe(before);
		pass(DAY);
		expect(shown()).toBeNull();
	});
});

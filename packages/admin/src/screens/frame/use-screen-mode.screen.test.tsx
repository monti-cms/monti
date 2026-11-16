import { composeStory } from "@storybook/react-vite";
import { useLayoutEffect, useState } from "react";
import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { SCREEN_MODE_KEY, screenModeScript } from "../../screen-mode";
import { setScreenMode, useApplyScreenMode } from "./use-screen-mode";

function Applied() {
	useApplyScreenMode();
	return null;
}

/** Reads the page's mode in its own layout effect, which runs after the sibling before it and before the first paint. */
function Probe({ seen }: { seen: { theme?: string } }) {
	useLayoutEffect(() => {
		seen.theme = document.documentElement.dataset.theme;
	}, [seen]);
	return null;
}

/** The admin's root while it is on the page, and a button that takes it away: the page after the admin has gone. */
function Page() {
	const [admin, setAdmin] = useState(true);
	return (
		<>
			{admin ? <Applied /> : null}
			<button type="button" onClick={() => setAdmin(false)}>
				관리자 닫기
			</button>
		</>
	);
}

it("the admin leaves no data-theme on the page when it goes: a site opened after it follows its own mode", async () => {
	const story = composeStory({ render: () => <Page /> } as never, {} as never);
	try {
		setScreenMode("dark");
		await story.run();
		await expect.element(page.getByRole("button", { name: "관리자 닫기" })).toBeVisible();
		await expect.poll(() => document.documentElement.dataset.theme).toBe("dark");
		setScreenMode("light");
		await expect.poll(() => document.documentElement.dataset.theme).toBe("light");
		await userEvent.click(page.getByRole("button", { name: "관리자 닫기" }));
		await expect.poll(() => document.documentElement.dataset.theme).toBeUndefined();
	} finally {
		setScreenMode("system");
		delete document.documentElement.dataset.theme;
	}
});

it("the mode is on the page right after the first render, before the first paint", async () => {
	const seen: { theme?: string } = {};
	function First() {
		return (
			<>
				<Applied />
				<Probe seen={seen} />
			</>
		);
	}
	const story = composeStory({ render: () => <First /> } as never, {} as never);
	try {
		setScreenMode("dark");
		await story.run();
		expect(seen.theme).toBe("dark");
	} finally {
		setScreenMode("system");
		delete document.documentElement.dataset.theme;
	}
});

it("the script the admin's page carries sets the mode before any paint: the stored one, or the system's, under the key the hook keeps", () => {
	const run = () => new Function(screenModeScript())();
	const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	try {
		expect(screenModeScript()).toContain(JSON.stringify(SCREEN_MODE_KEY));
		for (const [stored, expected] of [
			["dark", "dark"],
			["light", "light"],
			["system", system],
			["junk", system],
		] as const) {
			delete document.documentElement.dataset.theme;
			localStorage.setItem(SCREEN_MODE_KEY, stored);
			run();
			expect(document.documentElement.dataset.theme, `stored ${stored}`).toBe(expected);
		}
		delete document.documentElement.dataset.theme;
		localStorage.removeItem(SCREEN_MODE_KEY);
		run();
		expect(document.documentElement.dataset.theme).toBe(system);
	} finally {
		localStorage.removeItem(SCREEN_MODE_KEY);
		delete document.documentElement.dataset.theme;
	}
});

it("the hook and the script agree: what the hook stores, the script reads back", () => {
	try {
		setScreenMode("dark");
		delete document.documentElement.dataset.theme;
		new Function(screenModeScript())();
		expect(document.documentElement.dataset.theme).toBe("dark");
	} finally {
		setScreenMode("system");
		localStorage.removeItem(SCREEN_MODE_KEY);
		delete document.documentElement.dataset.theme;
	}
});

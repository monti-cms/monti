import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { scene } from "../../../test/scene";
import * as frame from "./frame.stories";

const { DevBypass, Fresh } = composeStories(frame);
const note = () => page.getByText("개발 서버 · 로그인 없이");

describe("the dev server's note in the sidebar", () => {
	it("16-5 let in without signing in, the sidebar's last line says why; signed in, it says nothing", async () => {
		await DevBypass.run();
		await expect.element(note()).toBeVisible();
		// Words only: nothing to press, and not in the way of the rows above it.
		expect(note().element().closest("button, a")).toBeNull();
		await userEvent.click(page.getByRole("button", { name: "설정", exact: true }));
		await expect.element(page.getByRole("heading", { name: "설정" })).toBeVisible();
		await Fresh.run();
		await expect.element(page.getByRole("navigation", { name: "관리 메뉴" })).toBeVisible();
		await expect.element(note()).not.toBeInTheDocument();
	});

	it("16-5 a folded sidebar has no room for the words: the line is not shown, and comes back unfolded", async () => {
		await DevBypass.run();
		await expect.element(note()).toBeVisible();
		await userEvent.keyboard("{Meta>}b{/Meta}");
		await expect.element(note()).not.toBeVisible();
		await userEvent.keyboard("{Meta>}b{/Meta}");
		await expect.element(note()).toBeVisible();
	});
});

describe("getting in on the dev server", () => {
	// The dev server: it has a schema file to write (nothing is written here) and a proof of a local browser. The proof's ticket comes from a
	// loopback address, which this test's page cannot reach: its fetch is answered here, as the listener would.
	const PROOF = "http://127.0.0.1:9/";
	const devServer = (ticket: string | null) => {
		const asked: string[] = [];
		const story = scene(
			{
				loaders: frame.signedIn(undefined, {
					signedIn: false,
					files: { write: async () => {}, readChanges: async () => [] },
					devProof: { url: () => PROOF, take: (given: string) => given === "good" },
				}),
			},
			frame.default,
		);
		const real = window.fetch;
		window.fetch = async (input, init) => {
			if (String(input) !== PROOF) return real(input, init);
			asked.push(String(input));
			return ticket === null ? new Response(null, { status: 403 }) : Response.json({ ticket });
		};
		return {
			story,
			asked,
			restore: () => {
				window.fetch = real;
			},
		};
	};

	it("16-5 the admin fetches a ticket from this machine and hands it in: it opens without the login screen, and says why", async () => {
		const dev = devServer("good");
		try {
			await dev.story.run();
			await expect.element(note()).toBeVisible();
			await expect.element(page.getByLabelText("이메일")).not.toBeInTheDocument();
			expect(dev.asked).toEqual([PROOF]);
		} finally {
			dev.restore();
		}
	});

	it("16-5 with no ticket to get, or one the server does not take, the login screen shows, and the admin asks once", async () => {
		for (const ticket of [null, "forged"]) {
			const dev = devServer(ticket);
			try {
				await dev.story.run();
				await expect.element(page.getByLabelText("이메일")).toBeVisible();
				await expect.element(note()).not.toBeInTheDocument();
				expect(dev.asked).toEqual([PROOF]);
			} finally {
				dev.restore();
			}
		}
	});
});

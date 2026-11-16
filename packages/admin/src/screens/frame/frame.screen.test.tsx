import { defineSchema } from "@monti-cms/core";
import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { scene } from "../../../test/scene";
import { MontiAdmin } from "../../app";
import type { Transport } from "../../operations/transport";
import { schema } from "../story-schema";
import * as frame from "./frame.stories";
import { setScreenMode } from "./use-screen-mode";

const menu = () => page.getByRole("navigation", { name: "관리 메뉴" });

describe("getting in on the dev server", () => {
	// The dev server: it has a schema file to write (nothing is written here) and a proof of a local browser. The proof's ticket comes from a
	// loopback address, which this test's page cannot reach: its fetch is answered here, as the listener would.
	const PROOF = "http://127.0.0.1:9/";
	const devServer = (ticket: string | null, render?: object) => {
		const asked: string[] = [];
		const story = scene(
			{
				...render,
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

	it("16-5 the admin fetches a ticket from this machine and hands it in: it opens without the login screen", async () => {
		const dev = devServer("good");
		try {
			await dev.story.run();
			await expect.element(menu()).toBeVisible();
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
				await expect.element(menu()).not.toBeInTheDocument();
				expect(dev.asked).toEqual([PROOF]);
			} finally {
				dev.restore();
			}
		}
	});

	for (const [how, call] of [
		["is refused by the network", () => Promise.reject(new TypeError("Failed to fetch"))],
		// Never settles: no answer and no error, for as long as the page lives.
		["never answers", () => new Promise<never>(() => {})],
	] as const)
		it(`16-5 when handing the ticket in ${how}, the login screen shows: the admin does not stay blank`, async () => {
			type Loaded = { site: { transport: Transport } };
			const dev = devServer("good", {
				render: (_args: unknown, { loaded }: { loaded: Loaded }) => (
					<MontiAdmin
						transport={(name, input, options) =>
							name === "auth.devSignIn" ? call() : loaded.site.transport(name, input, options)
						}
						siteName="example.dev"
					/>
				),
			});
			try {
				await dev.story.run();
				await expect.element(page.getByLabelText("이메일")).toBeVisible();
				await expect.element(menu()).not.toBeInTheDocument();
				expect(dev.asked).toEqual([PROOF]);
			} finally {
				dev.restore();
			}
		});
});

describe("the screen mode (TT-01)", () => {
	it("a screen drawn outside the frame has the stored dark mode: the login at its address, and the page reloaded", async () => {
		setScreenMode("dark");
		try {
			// No session: the login screen, which stands outside the sidebar's frame.
			const story = scene({ loaders: frame.signedIn(undefined, { signedIn: false }) }, frame.default);
			await story.run();
			await expect.element(page.getByLabelText("이메일")).toBeVisible();
			await expect.element(menu()).not.toBeInTheDocument();
			expect(document.documentElement.dataset.theme).toBe("dark");
			setScreenMode("light");
			await expect.poll(() => document.documentElement.dataset.theme).toBe("light");
		} finally {
			setScreenMode("system");
		}
	});
});

describe("the frame's banner", () => {
	const { FailedChange } = composeStories(frame);

	it('"apply again" pressed with the keyboard takes its line away and hands the focus to the page\'s first control, not to the page', async () => {
		await FailedChange.run();
		const again = page.getByRole("button", { name: "다시 적용" });
		await expect.element(again).toBeVisible();
		for (let pressed = 0; pressed < 40 && document.activeElement !== again.element(); pressed++)
			await userEvent.keyboard("{Tab}");
		await expect.element(again).toHaveFocus();
		expect(again.element().matches(":focus-visible")).toBe(true);
		// The page's first control: the stop after the banner's action.
		await userEvent.keyboard("{Tab}");
		const first = document.activeElement;
		expect(first).not.toBe(document.body);
		await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
		await expect.element(again).toHaveFocus();

		await userEvent.keyboard("{Enter}");
		await expect.element(again).not.toBeInTheDocument();
		await expect.poll(() => document.activeElement).toBe(first);
	});
});

describe("a screen that cannot be drawn", () => {
	it("[ST-01] a screen that throws while it is drawn says so at the top, the sidebar still opens the other screens, and 'try again' draws it once more", async () => {
		const broken = { now: true };
		const Page = () => {
			if (broken.now) throw new Error("a screen that throws");
			return <p>색인 화면</p>;
		};
		await scene(
			{
				loaders: frame.signedIn(),
				render: (_args: unknown, { loaded }: { loaded: unknown }) => (
					<MontiAdmin
						transport={(loaded as { site: { transport: Transport } }).site.transport}
						siteName="example.dev"
						plugins={[{ name: "search", toolPages: { index: Page } }]}
					/>
				),
			},
			frame.default,
		).run();
		await expect.element(menu()).toBeVisible();
		const failed = () => page.getByRole("note").filter({ hasText: "불러오지 못했습니다" });
		const open = () => {
			window.location.hash = "#/tools/p/search/index";
		};
		open();
		await expect.element(failed()).toBeVisible();
		// A head row stands in its place with the screen's name (the one a page has, so the assistant's ✦ stays at its end).
		const head = page.getByRole("heading", { name: "도구" });
		await expect.element(head).toBeVisible();
		expect(head.element().closest("[data-slot=page-header]")).not.toBeNull();
		// The frame stands: the sidebar opens another screen, and the banner goes with the screen it was about.
		await expect.element(menu()).toBeVisible();
		await userEvent.click(menu().getByRole("button", { name: /^휴지통/ }));
		await expect.element(failed()).not.toBeInTheDocument();
		await expect.element(page.getByRole("heading", { name: "휴지통" })).toBeVisible();
		// Back at the screen that throws: still said; once it can be drawn, "try again" draws it.
		open();
		await expect.element(failed()).toBeVisible();
		broken.now = false;
		// Pressed with the keyboard: the banner goes with its button, and the focus it held goes on into the page, not to the document.
		const again = failed().getByRole("button", { name: "다시 시도" });
		// The keyboard is what was last used, so a focus set here is the keyboard's.
		await userEvent.keyboard("{Shift}");
		(again.element() as HTMLElement).focus();
		expect(again.element().matches(":focus-visible")).toBe(true);
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByText("색인 화면")).toBeVisible();
		await expect.element(failed()).not.toBeInTheDocument();
		await expect.poll(() => document.activeElement !== document.body && document.activeElement !== null).toBe(true);
	});

	/** An entry whose editor throws while it is drawn (a field's own input that throws), in the trash or not. */
	const brokenEditor = async (trashed: boolean) => {
		const Field = () => {
			throw new Error("a field that throws");
		};
		let id = "";
		await scene(
			{
				loaders: frame.signedIn(
					async (monti) => {
						const made = (await monti.run(
							"entries.create",
							{ collection: "post", locale: "ko", title: "열리지 않는 글", values: {} },
							{ actor: "admin" },
						)) as { output: { id: string } };
						id = made.output.id;
						if (trashed) await monti.run("trash.move", { rows: [{ kind: "entry", id }] }, { actor: "admin" });
					},
					{
						schema: defineSchema({
							...schema,
							collections: {
								...schema.collections,
								post: {
									...schema.collections.post,
									fields: { ...schema.collections.post.fields, subtitle: { kind: "text", input: "site.broken" } },
								},
							},
						}),
					},
				),
				render: (_args: unknown, { loaded }: { loaded: unknown }) => (
					<MontiAdmin
						transport={(loaded as { site: { transport: Transport } }).site.transport}
						siteName="example.dev"
						plugins={[{ name: "site", inputs: { "site.broken": Field } }]}
					/>
				),
			},
			frame.default,
		).run();
		await expect.element(menu()).toBeVisible();
		return id;
	};

	it("[ST-01] an entry opened from the trash whose editor throws keeps the way back its head has: '휴지통', to the trash", async () => {
		await brokenEditor(true);
		// Opened as a person does, from its row of the trash: the address says where it came from.
		await userEvent.click(menu().getByRole("button", { name: /^휴지통/ }));
		await userEvent.click(page.getByRole("main").getByRole("link", { name: "열리지 않는 글" }));
		expect(window.location.hash).toMatch(/^#\/c\/post\/[^?]+\?from=trash$/);
		const failed = () => page.getByRole("note").filter({ hasText: "불러오지 못했습니다" });
		await expect.element(failed()).toBeVisible();
		const back = page.getByRole("banner").getByRole("button", { name: "휴지통" });
		await expect.element(back).toBeVisible();
		await expect.element(page.getByRole("banner").getByRole("button", { name: "게시글" })).not.toBeInTheDocument();
		await userEvent.click(back);
		await expect.element(failed()).not.toBeInTheDocument();
		expect(window.location.hash).toBe("#/trash");
		await expect.element(page.getByRole("heading", { name: "휴지통" })).toBeVisible();
	});

	it("[ST-01] an editor that throws stands outside the frame, so its place keeps the editor's way back: the banner at the top, and the collection's name goes to its list", async () => {
		const broken = { now: true };
		const Field = () => {
			if (broken.now) throw new Error("a field that throws");
			return <p>부제 입력</p>;
		};
		let id = "";
		await scene(
			{
				loaders: frame.signedIn(
					async (monti) => {
						const made = (await monti.run(
							"entries.create",
							{ collection: "post", locale: "ko", title: "열리지 않는 글", values: {} },
							{ actor: "admin" },
						)) as { output: { id: string } };
						id = made.output.id;
					},
					{
						schema: defineSchema({
							...schema,
							collections: {
								...schema.collections,
								post: {
									...schema.collections.post,
									fields: { ...schema.collections.post.fields, subtitle: { kind: "text", input: "site.broken" } },
								},
							},
						}),
					},
				),
				render: (_args: unknown, { loaded }: { loaded: unknown }) => (
					<MontiAdmin
						transport={(loaded as { site: { transport: Transport } }).site.transport}
						siteName="example.dev"
						plugins={[{ name: "site", inputs: { "site.broken": Field } }]}
					/>
				),
			},
			frame.default,
		).run();
		await expect.element(menu()).toBeVisible();
		window.location.hash = `#/c/post/${id}`;
		const failed = () => page.getByRole("note").filter({ hasText: "불러오지 못했습니다" });
		await expect.element(failed()).toBeVisible();
		// No sidebar here: the editor's own back, under the collection's name, is the way out.
		await expect.element(menu()).not.toBeInTheDocument();
		const back = page.getByRole("banner").getByRole("button", { name: "게시글" });
		await expect.element(back).toBeVisible();
		await userEvent.click(back);
		await expect.element(failed()).not.toBeInTheDocument();
		await expect.element(menu()).toBeVisible();
		expect(window.location.hash).toBe("#/c/post");
		await expect.element(page.getByRole("link", { name: "열리지 않는 글" })).toBeVisible();
	});
});

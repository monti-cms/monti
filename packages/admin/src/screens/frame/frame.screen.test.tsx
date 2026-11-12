import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { scene } from "../../../test/scene";
import { MontiAdmin } from "../../app";
import type { Transport } from "../../operations/transport";
import * as frame from "./frame.stories";

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

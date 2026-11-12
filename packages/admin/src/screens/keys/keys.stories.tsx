import { createMonti } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";

type Loaded = {
	site: StorySite;
	net: Network;
	letRead: () => void;
	/** Operations the server breaks on. */
	failing: Set<string>;
	/** Holds an operation's answer back until the function it gives is called. */
	holdCall: (name: string) => () => void;
};
type Monti = StorySite["monti"];

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Tools/ApiKeys",
	render: (_args, { loaded }) => <MontiAdmin transport={(loaded as Loaded).site.transport} siteName="example.dev" />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const admin = { actor: "admin" } as const;
const wait = { timeout: 15000 };

export const siteSecret = "story-secret-for-the-keys-screen";
// Lower-case names: a story file's capitalized exports are its stories.
/** Keys the story's services take, one that a service refuses, and one for a service that does not answer. */
export const sample = {
	anthropic: "sk-ant-api03-story-key-of-anthropic-a1b2",
	anthropicNew: "sk-ant-api03-story-key-entered-new-7c0e",
	openai: "sk-proj-story-key-of-the-company-77de",
	gemini: "AIzaSy-story-key-of-old-gemini-9f0c",
	refused: "sk-ant-api03-a-key-the-service-refuses",
	unanswered: "sk-ant-api03-a-key-nobody-answers-for",
};
/** A name longer than a row: as long as a key's name may be (60 characters), with no room to break at. */
export const longName =
	"블로그초안과요약에만쓰려고개인계정으로따로받아둔한도가낮은키이며다른일에는절대로쓰지않기로한바로그키입니다그리고이름이아";

export type Network = {
	fetch: typeof globalThis.fetch;
	/** Every request that reached a service: its address and headers. */
	requests: { url: string; headers: Record<string, string> }[];
	/** Held, the services answer nothing until it is let go (`null`): the moment the window says "확인하는 중…". */
	hold: (until: "held" | null) => void;
};

/** The services as the stories' network: which keys each takes and the models it lists. No story reaches a real service. */
export function network(): Network {
	const requests: Network["requests"] = [];
	let held: Promise<void> | null = null;
	let letGo = () => {};
	const gate = () =>
		new Promise<void>((resolve) => {
			letGo = resolve;
		});
	const json = (status: number, body: unknown) =>
		new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
	const taken = new Set<string>([sample.anthropic, sample.anthropicNew, sample.openai, sample.gemini]);
	const fetch: typeof globalThis.fetch = async (input, init) => {
		const url = String(input);
		const headers = Object.fromEntries(new Headers(init?.headers).entries());
		requests.push({ url, headers });
		if (held) await held;
		const sent =
			headers["x-api-key"] ?? headers["x-goog-api-key"] ?? headers.authorization?.replace(/^Bearer /, "") ?? "";
		if (sent === sample.unanswered) throw new TypeError("fetch failed");
		if (url.startsWith("https://api.anthropic.com/"))
			return taken.has(sent)
				? json(200, {
						data: ["claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5"].map((id) => ({
							id,
							capabilities: { thinking: { supported: true }, image_input: { supported: true } },
						})),
					})
				: json(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });
		if (url.startsWith("https://api.openai.com/"))
			return taken.has(sent) ? json(200, { data: [{ id: "gpt-5.5" }, { id: "gpt-5.4-mini" }] }) : json(401, {});
		if (url.startsWith("https://generativelanguage.googleapis.com/"))
			return taken.has(sent)
				? json(200, {
						models: [
							{
								name: "models/gemini-3.8-flash",
								displayName: "Gemini 3.8 Flash",
								supportedGenerationMethods: ["generateContent"],
							},
						],
					})
				: json(400, {});
		// A server of the person's own, at the address they gave: it lists one model and asks for no key.
		if (url.startsWith("http://localhost:11434/")) return json(200, { data: [{ id: "llama4" }] });
		return json(404, {});
	};
	return {
		fetch,
		requests,
		hold: (until) => {
			letGo();
			held = until === null ? null : gate();
		},
	};
}

/** The reference screen's three keys, with what they used this month. */
async function threeKeys(monti: Monti) {
	const add = async (input: { service: string; name: string; secret: string }, tokens: number) => {
		const made = (await monti.run("keys.add", input, admin)) as { output: { id: string } };
		if (tokens > 0) await monti.keys.addUsage(made.output.id, tokens);
	};
	await add({ service: "anthropic", name: "Anthropic 개인", secret: sample.anthropic }, 1_240_000);
	await add({ service: "openai", name: "OpenAI 회사", secret: sample.openai }, 312_000);
	await add({ service: "gemini", name: "예전 Gemini 키", secret: sample.gemini }, 0);
}

/**
 * A site for a keys story. `keys`: which keys it has. `secret`: the server's secret as the story's server has it; `"other"` is a server whose
 * secret changed since the keys were stored, `null` one that has none (the keys, if any, were stored when it had one). `reading`: the list of keys
 * does not come until `letRead` is called (the screen before its read).
 */
export const site = ({
	keys = "three",
	secret = siteSecret,
	reading = false,
}: {
	keys?: "three" | "none" | "named" | "long";
	secret?: string | null | "other";
	reading?: boolean;
} = {}) => [
	async (): Promise<Loaded> => {
		startAt("#/tools/keys");
		const net = network();
		const made = await storySite({
			schema,
			auth: { password: true },
			signedIn: true,
			secret: secret === "other" ? "another-secret-than-the-keys-were-stored-with" : secret,
			fetch: net.fetch,
			setup: async (monti) => {
				if (keys === "none") return;
				// The keys are stored by a server that has the first secret, on the same database.
				const first = createMonti({ db: monti.db, schema, files: null, secret: siteSecret, fetch: net.fetch });
				if (keys === "named")
					await first.run("keys.add", { service: "anthropic", name: "Anthropic", secret: sample.anthropic }, admin);
				else if (keys === "long") {
					await first.run("keys.add", { service: "anthropic", name: longName, secret: sample.anthropic }, admin);
					await first.run("keys.add", { service: "openai", name: "OpenAI 회사", secret: sample.openai }, admin);
				} else await threeKeys(first);
			},
		});
		// What the setup asked of the services is not what the story is about.
		net.requests.length = 0;
		let letRead = () => {};
		const read = reading
			? new Promise<void>((resolve) => {
					letRead = resolve;
				})
			: null;
		const failing = new Set<string>();
		const gates = new Map<string, Promise<void>>();
		const holdCall = (name: string) => {
			let release = () => {};
			gates.set(
				name,
				new Promise<void>((resolve) => {
					release = resolve;
				}),
			);
			return () => {
				gates.delete(name);
				release();
			};
		};
		const transport: StorySite["transport"] = async (name, ...rest) => {
			if (read && name === "keys.list") await read;
			await gates.get(name);
			// A server that breaks on this operation: an answer with no reason in it.
			if (failing.has(name)) return { status: 500, body: { error: "unexpected" } };
			return made.transport(name, ...rest);
		};
		return { site: { ...made, transport }, net, letRead, failing, holdCall };
	},
];

const screen = async (canvasElement: HTMLElement) => {
	const page = within(canvasElement.ownerDocument.body);
	await page.findByRole("link", { name: "API 키" }, wait);
	return page;
};
const more = async (page: Awaited<ReturnType<typeof screen>>, name: string, item: string) => {
	await userEvent.click(await page.findByRole("button", { name: `${name} 더 보기` }, wait));
	await userEvent.click(await page.findByRole("menuitem", { name: item }));
};

/** Three keys with what they used this month, and the quick tasks' model under them. */
export const Keys: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await page.findByText("이번 달 1.24M 토큰", {}, wait);
	},
};

/** No key yet: one quiet line, and the model field opens the way to add one. */
export const NoKeys: Story = {
	loaders: site({ keys: "none" }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await page.findByText("아직 키가 없습니다.", {}, wait);
	},
};

/** A name longer than its row is cut, and the key's last four keep their room. */
export const LongName: Story = {
	loaders: site({ keys: "long" }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await page.findByText("OpenAI 회사", {}, wait);
	},
};

/** A row's ⋯: change the key, remove it. */
export const RowMenu: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "Anthropic 개인 더 보기" }, wait));
		await page.findByRole("menuitem", { name: "지우기" });
	},
};

/** "+ 키 추가": which service the key is for (flow 10, step 1). */
export const PickService: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "키 추가" }, wait));
		await page.findByRole("option", { name: "Anthropic" });
	},
};

/** The key window for a new key: the name is the service's, the caret is in the key (step 2). */
export const AddKey: Story = {
	loaders: site({ keys: "none" }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "키 추가" }, wait));
		await userEvent.click(await page.findByRole("option", { name: "Anthropic" }));
		await page.findByLabelText("키");
	},
};

/** A server of the person's own: the window asks for its address, and the key may stay empty (step 2b). */
export const AddAddress: Story = {
	loaders: site({ keys: "none" }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "키 추가" }, wait));
		await userEvent.click(await page.findByRole("option", { name: "OpenAI 호환 주소" }));
		await userEvent.type(await page.findByLabelText(/주소/), "http://localhost:11434/v1");
	},
};

/** The name is taken: the window puts a number after it and says which name that was (step 5). */
export const NameTaken: Story = {
	loaders: site({ keys: "named" }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "키 추가" }, wait));
		await userEvent.click(await page.findByRole("option", { name: "Anthropic" }));
		await page.findByText("이름이 Anthropic인 키가 이미 있습니다.");
	},
};

/** A key its service refuses: one line under the key, the window open with what was typed (step 4). */
export const Refused: Story = {
	loaders: site({ keys: "none" }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "키 추가" }, wait));
		await userEvent.click(await page.findByRole("option", { name: "Anthropic" }));
		await userEvent.type(await page.findByLabelText("키"), sample.refused);
		await userEvent.click(page.getByRole("button", { name: "추가" }));
		await page.findByText("맞지 않는 키입니다.", {}, wait);
	},
};

/** The service is being asked whether it takes the key: the pill says so and cannot be pressed again (step 3). */
export const Checking: Story = {
	loaders: site({ keys: "none" }),
	play: async ({ canvasElement, loaded }) => {
		const page = await screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "키 추가" }, wait));
		await userEvent.click(await page.findByRole("option", { name: "Anthropic" }));
		await userEvent.type(await page.findByLabelText("키"), sample.anthropic);
		(loaded as Loaded).net.hold("held");
		await userEvent.click(page.getByRole("button", { name: "추가" }));
		await page.findByRole("button", { name: "확인하는 중…" }, wait);
	},
};

/** A service that does not answer: the same place says so, and pressing again asks again. */
export const NoAnswer: Story = {
	loaders: site({ keys: "none" }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "키 추가" }, wait));
		await userEvent.click(await page.findByRole("option", { name: "Anthropic" }));
		await userEvent.type(await page.findByLabelText("키"), sample.unanswered);
		await userEvent.click(page.getByRole("button", { name: "추가" }));
		await page.findByText("서비스가 답하지 않습니다.", {}, wait);
	},
};

/** Sent with the key empty: the field says to fill it in, and the service is not asked. */
export const MissingField: Story = {
	loaders: site({ keys: "none" }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "키 추가" }, wait));
		await userEvent.click(await page.findByRole("option", { name: "Anthropic" }));
		await userEvent.click(await page.findByRole("button", { name: "추가" }));
		await page.findByText("이 칸을 채워 주세요.");
	},
};

/** The key window for a stored key: the service as words, the key as its last four (step 7). */
export const EditKey: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await more(page, "Anthropic 개인", "편집");
		await within(await page.findByRole("dialog")).findByText("··· a1b2");
	},
};

/** "바꾸기": the stored key gives way to an empty field with "그대로" at its end (step 8). */
export const ReplaceKey: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await more(page, "Anthropic 개인", "편집");
		await userEvent.click(await page.findByRole("button", { name: "바꾸기" }));
		await page.findByRole("button", { name: "그대로" });
	},
};

/** Removing a key that is in use: what stops is listed (step 11). */
export const RemoveKey: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await more(page, "Anthropic 개인", "지우기");
		await page.findByRole("alertdialog");
	},
};

/** Removing a key nothing uses: only that it cannot be undone (step 11b). */
export const RemoveUnusedKey: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await more(page, "예전 Gemini 키", "지우기");
		await page.findByRole("alertdialog");
	},
};

/** The quick tasks' model: a menu to search, the models under their keys (step 13). */
export const PickModel: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: /빠른 작업/ }, wait));
		await page.findByRole("menuitemradio", { name: /gpt-5\.4-mini/ });
	},
};

/** The server's secret changed: the banner counts the keys it can no longer read, and each row says so (step 14). */
export const Unreadable: Story = {
	loaders: site({ secret: "other" }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await page.findByText("키 3개를 읽을 수 없습니다", {}, wait);
	},
};

/** Editing a key the server cannot read: the key is asked for again (step 14b). */
export const EnterAgain: Story = {
	loaders: site({ secret: "other" }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await more(page, "Anthropic 개인", "편집");
		await page.findByText("키를 다시 넣어 주세요.");
	},
};

/** No secret on the server: the banner says so, and there is nothing to add a key with (step 15). */
export const NoSecret: Story = {
	loaders: site({ keys: "none", secret: null }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await page.findByText("키를 저장할 수 없습니다", {}, wait);
	},
};

/** No secret, and keys from when there was one: they can only be removed. */
export const NoSecretWithKeys: Story = {
	loaders: site({ secret: null }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "Anthropic 개인 더 보기" }, wait));
		await page.findByRole("menuitem", { name: "지우기" });
	},
};

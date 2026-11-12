import { createMonti } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";

type Loaded = { site: StorySite; net: Network };
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

export const SECRET = "story-secret-for-the-keys-screen";
/** Keys the story's services take, one that a service refuses, and one for a service that does not answer. */
export const KEYS = {
	anthropic: "sk-ant-api03-story-key-of-anthropic-a1b2",
	anthropicNew: "sk-ant-api03-story-key-entered-new-7c0e",
	openai: "sk-proj-story-key-of-the-company-77de",
	gemini: "AIzaSy-story-key-of-old-gemini-9f0c",
	refused: "sk-ant-api03-a-key-the-service-refuses",
	unanswered: "sk-ant-api03-a-key-nobody-answers-for",
};

export type Network = {
	fetch: typeof globalThis.fetch;
	/** Every request that reached a service: its address and headers. */
	requests: { url: string; headers: Record<string, string> }[];
	/** Held, the services answer nothing until it is let go: the moment the window says "확인하는 중…". */
	hold: (until: Promise<void> | null) => void;
};

/** The services as the stories' network: which keys each takes and the models it lists. No story reaches a real service. */
export function network(): Network {
	const requests: Network["requests"] = [];
	let held: Promise<void> | null = null;
	const json = (status: number, body: unknown) =>
		new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
	const taken = new Set<string>([KEYS.anthropic, KEYS.anthropicNew, KEYS.openai, KEYS.gemini]);
	const fetch: typeof globalThis.fetch = async (input, init) => {
		const url = String(input);
		const headers = Object.fromEntries(new Headers(init?.headers).entries());
		requests.push({ url, headers });
		if (held) await held;
		const sent =
			headers["x-api-key"] ?? headers["x-goog-api-key"] ?? headers.authorization?.replace(/^Bearer /, "") ?? "";
		if (sent === KEYS.unanswered) throw new TypeError("fetch failed");
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
			held = until;
		},
	};
}

/** The reference screen's three keys, with what they used this month. */
async function threeKeys(monti: Monti) {
	const add = async (input: { service: string; name: string; secret: string }, tokens: number) => {
		const made = (await monti.run("keys.add", input, admin)) as { output: { id: string } };
		if (tokens > 0) await monti.keys.addUsage(made.output.id, tokens);
	};
	await add({ service: "anthropic", name: "Anthropic 개인", secret: KEYS.anthropic }, 1_240_000);
	await add({ service: "openai", name: "OpenAI 회사", secret: KEYS.openai }, 312_000);
	await add({ service: "gemini", name: "예전 Gemini 키", secret: KEYS.gemini }, 0);
}

/**
 * A site for a keys story. `keys`: which keys it has. `secret`: the server's secret as the story's server has it; `"other"` is a server whose
 * secret changed since the keys were stored, `null` one that has none (the keys, if any, were stored when it had one).
 */
const site = ({
	keys = "three",
	secret = SECRET,
}: {
	keys?: "three" | "none" | "named";
	secret?: string | null | "other";
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
				const first = createMonti({ db: monti.db, schema, files: null, secret: SECRET, fetch: net.fetch });
				if (keys === "named")
					await first.run("keys.add", { service: "anthropic", name: "Anthropic", secret: KEYS.anthropic }, admin);
				else await threeKeys(first);
			},
		});
		// What the setup asked of the services is not what the story is about.
		net.requests.length = 0;
		return { site: made, net };
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
		await userEvent.type(await page.findByLabelText("키"), KEYS.refused);
		await userEvent.click(page.getByRole("button", { name: "추가" }));
		await page.findByText("맞지 않는 키입니다.", {}, wait);
	},
};

/** The key window for a stored key: the service as words, the key as its last four (step 7). */
export const EditKey: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await more(page, "Anthropic 개인", "편집");
		await page.findByText("··· a1b2");
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

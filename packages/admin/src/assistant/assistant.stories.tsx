import {
	assistant,
	ProviderError,
	type RunLimits,
	type Scripted,
	type ScriptedProvider,
	scriptedProvider,
} from "@monti-cms/ai";
import type { Monti } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useSyncExternalStore } from "react";
import { userEvent, within } from "storybook/test";
import { nextStorySite, type StorySite, startAt, storySite } from "../../.storybook/pglite-site";
import { MontiAdmin } from "../app";
import { NO_ANSWER, type StreamTransport, type Transport } from "../operations/transport";
import { schema } from "../screens/story-schema";

export type Loaded = {
	site: StorySite;
	model: ScriptedProvider;
	ids: { first: string; second: string; third: string };
	/** Lets a turn that waits on the story's gate go on. */
	release: () => void;
	net: Net;
};

/** What a test does to the page's traffic and to the page, to bring about a moment no press brings about by itself. */
export type Net = {
	/**
	 * From now on the requests of this name wait (an operation's answer, or a stream's start), after `skip` of them have gone through, until
	 * the function this gives is called.
	 */
	hold: (name: string, skip?: number) => () => void;
	/**
	 * From now on the answers of this operation are held back after the server gave them (what they say is as old as the asking), until the
	 * function this gives is called.
	 */
	late: (name: string) => () => void;
	/**
	 * From now on the requests of this name get no answer, as when the network is down (after `skip` of them have gone through), until the
	 * function this gives is called.
	 */
	lose: (name: string, skip?: number) => () => void;
	/** The stream the page listens to breaks here, as when the network goes. The run goes on in the server. */
	cut: () => void;
	/** Every request the page made, in order; a stream's has the signal it was asked with. */
	sent: { name: string; input: unknown; signal?: AbortSignal }[];
	/** Takes the admin off the page, as when the session ends. */
	leave: () => void;
};

/** The story site's two ways to the server, with what a test can do to them (`Net`). */
function netOf(made: StorySite): { net: Net; transport: Transport; streams: StreamTransport; left: Left } {
	const holds = new Map<string, { skip: number; open: Promise<void> }>();
	const sent: Net["sent"] = [];
	const lost = new Map<string, { skip: number }>();
	const lates = new Map<string, Promise<void>>();
	const isLost = (name: string) => {
		const losing = lost.get(name);
		if (!losing) return false;
		if (losing.skip > 0) {
			losing.skip -= 1;
			return false;
		}
		return true;
	};
	const cuts = new Set<() => void>();
	const watchers = new Set<() => void>();
	let gone = false;
	const held = async (name: string) => {
		const hold = holds.get(name);
		if (!hold) return;
		if (hold.skip > 0) hold.skip -= 1;
		else await hold.open;
	};
	const transport: Transport = async (name, input, options) => {
		sent.push({ name, input });
		await held(name);
		if (isLost(name)) return NO_ANSWER;
		const answer = await made.transport(name, input, options);
		await lates.get(name);
		return answer;
	};
	const streams: StreamTransport = async (name, input, options) => {
		sent.push({ name, input, signal: options?.signal });
		await held(name);
		if (isLost(name)) return NO_ANSWER;
		const answer = await made.streams(name, input, options);
		if (!("events" in answer)) return answer;
		const events = answer.events[Symbol.asyncIterator]();
		return {
			status: 200,
			events: (async function* () {
				let broke = () => {};
				const broken = new Promise<"cut">((resolve) => {
					broke = () => resolve("cut");
				});
				cuts.add(broke);
				try {
					for (;;) {
						const next = events.next();
						const got = await Promise.race([next, broken]);
						if (got === "cut") {
							// Read on without the page: only the page's connection went, and the server's run is not cut.
							void (async () => {
								await next;
								while (!(await events.next()).done);
							})().catch(() => {});
							throw new Error("The network went.");
						}
						if (got.done) return;
						yield got.value;
					}
				} finally {
					cuts.delete(broke);
				}
			})(),
		};
	};
	return {
		transport,
		streams,
		left: {
			subscribe: (watcher) => {
				watchers.add(watcher);
				return () => watchers.delete(watcher);
			},
			now: () => gone,
		},
		net: {
			hold: (name, skip = 0) => {
				let release = () => {};
				holds.set(name, {
					skip,
					open: new Promise<void>((resolve) => {
						release = resolve;
					}),
				});
				return () => {
					holds.delete(name);
					release();
				};
			},
			late: (name) => {
				let release = () => {};
				lates.set(
					name,
					new Promise<void>((resolve) => {
						release = resolve;
					}),
				);
				return () => {
					lates.delete(name);
					release();
				};
			},
			lose: (name, skip = 0) => {
				lost.set(name, { skip });
				return () => lost.delete(name);
			},
			cut: () => {
				for (const broke of [...cuts]) broke();
			},
			sent,
			leave: () => {
				gone = true;
				for (const watcher of watchers) watcher();
			},
		},
	};
}
type Left = { subscribe: (watcher: () => void) => () => void; now: () => boolean };

/** The admin on a story's site, until a test takes it off the page. */
function Stage({ site: made, left }: { site: StorySite; left: Left }) {
	const gone = useSyncExternalStore(left.subscribe, left.now);
	return gone ? null : <MontiAdmin transport={made.transport} streams={made.streams} siteName="example.dev" />;
}

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Assistant",
	render: (_args, { loaded }) => {
		const { site: made, left } = loaded as Loaded & { left: Left };
		return <Stage site={made} left={left} />;
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const admin = { actor: "admin" } as const;
const wait = { timeout: 15000 };
// Lower-case names: a story file's capitalized exports are its stories.
/** The key the story's service takes. No story reaches a real service. */
const KEY = "sk-ant-api03-story-key-of-the-assistant-a1b2";
const GROUP = "_group";

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
/** The one service of the stories, asked only for its models when the key is added. */
const serviceWith =
	(pictures: boolean): typeof globalThis.fetch =>
	async (input) =>
		String(input).startsWith("https://api.anthropic.com/")
			? json(200, {
					data: ["claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5"].map((id) => ({
						id,
						capabilities: { thinking: { supported: id !== "claude-haiku-5-5" }, image_input: { supported: pictures } },
					})),
				})
			: json(404, {});
const network = serviceWith(true);

/**
 * A loader for a test of another screen's story: the site that story makes next has the assistant, with a key and a model that says
 * what `script` tells it (`answer` for the quick tasks). The model comes back with what the story loaded (`model`).
 */
export const assisted =
	(
		script: Scripted[] = [],
		answer?: Parameters<typeof scriptedProvider>[1],
		/** `key: false`: no AI key on the site. `pictures: false`: its models do not read pictures. */
		options: { key?: boolean; pictures?: boolean } = {},
	) =>
	async (): Promise<{ model: ScriptedProvider }> => {
		const model = scriptedProvider(script, answer);
		nextStorySite({
			plugins: [assistant({ provider: model.for })],
			fetch: options.pictures === false ? serviceWith(false) : network,
			secret: "story-secret-for-the-assistant",
			after:
				options.key === false
					? undefined
					: async (monti) => {
							await monti.run("keys.add", { service: "anthropic", name: "Anthropic 개인", secret: KEY }, admin);
						},
		});
		return { model };
	};

/** A turn that never ends: the moment a story shows is the one while it works. */
const never = new Promise<never>(() => {});

type Ids = Loaded["ids"];
/** What the scripted model says, made once the entries have their ids. */
export type Script = (
	ids: Ids,
	version: (id: string) => Promise<number>,
	/** Settles when the test lets go: a turn that holds on it is "the assistant still working". */
	gate: Promise<void>,
) => Scripted[] | Promise<Scripted[]>;

/** "Find the entries with an empty summary": one read, then the answer that names them as links. */
export const found: Script = (ids) => [
	{ calls: [{ name: "entries_query", input: { collection: "post" } }] },
	{
		text: `요약이 비어 있는 글은 2편입니다.\n\n1. [둘째 글](#/c/post/${ids.second})\n2. [셋째 글](#/c/post/${ids.third})`,
	},
];

/** "Fill both summaries": two writes of one kind, which become one proposal, then a line about it. */
export const proposed: Script = async (ids, version) => [
	{
		calls: [
			{
				name: "entries_save",
				input: {
					id: ids.second,
					version: await version(ids.second),
					values: { summary: "둘째 글은 관리자 화면을 처음 여는 사람을 위한 안내입니다." },
					[GROUP]: "요약 채우기",
				},
			},
			{
				name: "entries_save",
				input: {
					id: ids.third,
					version: await version(ids.third),
					values: { summary: "셋째 글은 배포한 뒤에 확인할 것을 정리합니다." },
					[GROUP]: "요약 채우기",
				},
			},
		],
	},
	{ text: "요약 두 개를 제안했습니다. 검토하고 적용해 주세요." },
];

/** Several kinds of change in one proposal: summaries, and a title. */
export const proposedKinds: Script = async (ids, version) => [
	{
		calls: [
			{
				name: "entries_save",
				input: {
					id: ids.second,
					version: await version(ids.second),
					values: { summary: "둘째 글은 관리자 화면을 처음 여는 사람을 위한 안내입니다." },
					[GROUP]: "요약 채우기",
				},
			},
			{
				name: "entries_save",
				input: {
					id: ids.third,
					version: await version(ids.third),
					values: { summary: "셋째 글은 배포한 뒤에 확인할 것을 정리합니다." },
					[GROUP]: "요약 채우기",
				},
			},
			{
				name: "entries_save",
				input: { id: ids.first, version: await version(ids.first), title: "첫 번째 글, 다시", [GROUP]: "제목 다듬기" },
			},
		],
	},
	{ text: "요약 두 개와 제목 하나를 제안했습니다." },
];

/**
 * A site for an assistant story: three posts (two without a summary), an AI key unless `key` is false, and a model that says what `script`
 * tells it. `limits` shortens the run's limits to bring a state about.
 */
export const site = ({
	script = () => [],
	key = true,
	plugin = true,
	limits,
	at = "#/c/post",
}: {
	script?: Script;
	key?: boolean;
	/** `false`: a site that does not have the assistant at all. */
	plugin?: boolean;
	limits?: Partial<RunLimits>;
	at?: string;
} = {}) => [
	async (): Promise<Loaded & { left: Left }> => {
		startAt(at);
		const model = scriptedProvider();
		const ids = { first: "", second: "", third: "" };
		const made = await storySite({
			schema,
			auth: { password: true },
			signedIn: true,
			secret: "story-secret-for-the-assistant",
			fetch: network,
			plugins: plugin ? [assistant({ provider: model.for, limits })] : [],
			setup: async (monti: Monti) => {
				const create = async (title: string, slug: string, values?: Record<string, unknown>) =>
					(
						(await monti.run("entries.create", { collection: "post", locale: "ko", title, slug, values }, admin)) as {
							output: { id: string };
						}
					).output.id;
				ids.first = await create("첫 번째 글", "first-post", { summary: "Monti를 처음 쓰는 날의 기록입니다." });
				ids.second = await create("둘째 글", "second-post");
				ids.third = await create("셋째 글", "third-post");
				if (key) await monti.run("keys.add", { service: "anthropic", name: "Anthropic 개인", secret: KEY }, admin);
			},
		});
		const version = async (id: string) =>
			((await made.monti.run("entries.get", { id }, admin)) as { entry: { version: number } }).entry.version;
		let release = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		model.add(...(await script(ids, version, gate)));
		const { net, transport, streams, left } = netOf(made);
		return { site: { ...made, transport, streams }, model, ids, release, net, left };
	},
];

/** Several scripts, one after another: what the model says to the requests of one story in turn. */
export const scripts =
	(...parts: Script[]): Script =>
	async (ids, version, gate) =>
		(await Promise.all(parts.map((part) => part(ids, version, gate)))).flat();

const screen = async (canvasElement: HTMLElement) => {
	const page = within(canvasElement.ownerDocument.body);
	await page.findByRole("heading", { name: "post" }, wait);
	return page;
};
type Page = Awaited<ReturnType<typeof screen>>;
export const openPanel = async (page: Page) => {
	await userEvent.click(await page.findByRole("button", { name: "어시스턴트 열기" }, wait));
	return page.findByRole("complementary", { name: "어시스턴트" });
};
export const say = async (page: Page, words: string) => {
	await userEvent.type(await page.findByRole("textbox", { name: "어시스턴트에게 묻기" }), `${words}{Enter}`);
};

/** The panel before anything is asked: the requests to start from on this screen, and the box to ask in with what goes along. */
export const First: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await page.findByRole("button", { name: "요약이 비어 있는 글 찾아 줘" });
	},
};

/** No AI key on the site: the one step to add one, and no box to ask in. */
export const NoKey: Story = {
	loaders: site({ key: false }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await page.findByText("AI 연결이 없습니다");
	},
};

/** Asked, and the assistant is reading: a tool line that is going, and the send button is the stop button. */
export const Asking: Story = {
	loaders: site({
		script: () => [{ calls: [{ name: "entries_query", input: { collection: "post" } }] }, { hold: never }],
	}),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "요약이 비어 있는 글 찾아 줘");
		await page.findByText("글 목록 읽음 · 3편", {}, wait);
	},
};

/** The answer is arriving: its words so far, and the caret after them. */
export const Writing: Story = {
	loaders: site({ script: () => [{ text: "요약이 비어 있는 글은 2편입니다. 둘째 글과", hold: never }] }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "요약이 비어 있는 글 찾아 줘");
		await page.findByText(/둘째 글과/, {}, wait);
	},
};

/** Answered: the tool line that was read, and the answer with the entries it names as links. */
export const Answered: Story = {
	loaders: site({ script: found }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "요약이 비어 있는 글 찾아 줘");
		await page.findByRole("button", { name: "셋째 글" }, wait);
	},
};

/** A tool line opened: what was sent. */
export const ToolOpen: Story = {
	loaders: site({ script: found }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "요약이 비어 있는 글 찾아 줘");
		await userEvent.click(await page.findByRole("button", { name: /글 목록 읽음/ }, wait));
		await page.findByText("보낸 값");
	},
};

/** Words said while it works wait over the box, each with send now, edit and cancel. */
export const Queued: Story = {
	loaders: site({
		script: () => [{ calls: [{ name: "entries_query", input: { collection: "post" } }] }, { hold: never }],
	}),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "요약이 비어 있는 글 찾아 줘");
		await page.findByText("글 목록 읽음 · 3편", {}, wait);
		await say(page, "초안만 봐 줘");
		await page.findByRole("button", { name: "지금 보내기" });
	},
};

/** The service refused: what it said after the key's name, and the way to send the same words with another model. */
export const Refused: Story = {
	loaders: site({ script: () => [{ fail: new ProviderError("refused", "Your credit balance is too low.") }] }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "요약이 비어 있는 글 찾아 줘");
		await page.findByText("서비스가 거절했습니다", {}, wait);
	},
};

/** The service did not answer: the same words can be sent again. */
export const NoAnswer: Story = {
	loaders: site({ script: () => [{ fail: new ProviderError("unreachable", "fetch failed") }] }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "요약이 비어 있는 글 찾아 줘");
		await page.findByText("서비스가 답하지 않습니다", {}, wait);
	},
};

/** The answer broke off after work was done: what was done stays, and the run can be gone on with. */
export const Dropped: Story = {
	loaders: site({
		script: () => [
			{ calls: [{ name: "entries_query", input: { collection: "post" } }] },
			{ text: "요약이 비어 있는 글은", breaksOff: true },
		],
	}),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "요약이 비어 있는 글 찾아 줘");
		await page.findByText("연결이 끊겼습니다", {}, wait);
	},
};

/** The run reached its limit of turns: it says so, and goes on when told to. */
export const Limit: Story = {
	loaders: site({
		limits: { turns: 1 },
		script: () => [{ calls: [{ name: "entries_query", input: { collection: "post" } }] }],
	}),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "요약이 비어 있는 글 찾아 줘");
		await page.findByText("한도에 닿아 멈췄습니다", {}, wait);
	},
};

/** A proposal in the conversation: its changes, and what can be done with all of them. */
export const Card: Story = {
	loaders: site({ script: proposed }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "둘 다 요약 채워 줘");
		await page.findByRole("button", { name: "2건 적용" }, wait);
	},
};

/** A proposal of several kinds of change: one row a kind, and the way to its review. */
export const CardOfKinds: Story = {
	loaders: site({ script: proposedKinds }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "요약 채우고 제목도 다듬어 줘");
		await page.findByRole("button", { name: "검토" }, wait);
	},
};

/** Applied: how many, and the way to undo them. */
export const Applied: Story = {
	loaders: site({ script: proposed }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "둘 다 요약 채워 줘");
		await userEvent.click(await page.findByRole("button", { name: "2건 적용" }, wait));
		await page.findByText("✓ 2건 적용", {}, wait);
	},
};

/** Being applied: how far it is, in place of the buttons. */
export const CardApplying: Story = {
	loaders: site({ script: proposed }),
	play: async ({ canvasElement, loaded }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "둘 다 요약 채워 줘");
		// The apply's first result is a long time coming.
		(loaded as Loaded).net.hold("proposals.apply");
		await userEvent.click(await page.findByRole("button", { name: "2건 적용" }, wait));
		await page.findByText("적용 중", {}, wait);
	},
};

/** Applied and undone: the card says so, with nothing left to press. */
export const CardUndone: Story = {
	loaders: site({ script: proposed }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "둘 다 요약 채워 줘");
		await userEvent.click(await page.findByRole("button", { name: "2건 적용" }, wait));
		const undo = await page.findByRole("button", { name: "되돌리기" }, wait);
		// A person reads that it was applied before pressing again: a press in the moment the button appears is not taken.
		await new Promise((resolve) => setTimeout(resolve, 600));
		await userEvent.click(undo);
		await page.findByText("되돌림", {}, wait);
	},
};

/** Discarded: the card goes faint and says so. */
export const Discarded: Story = {
	loaders: site({ script: proposed }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "둘 다 요약 채워 줘");
		await userEvent.click(await page.findByRole("button", { name: "버리기" }, wait));
		await page.findByText("버림", {}, wait);
	},
};

/** The model menu: the models under their keys, and how hard the current one thinks. */
export const Models: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await userEvent.click(await page.findByRole("button", { name: "모델 고르기" }));
		await page.findByRole("menuitemradio", { name: /claude-opus-5-5/ });
	},
};

/** The past conversations: what was asked first, when, and what came of it. */
export const PastConversations: Story = {
	loaders: site({
		script: (ids, version, gate) =>
			Promise.all([found(ids, version, gate), proposed(ids, version, gate)]).then((all) => all.flat()),
	}),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "요약이 비어 있는 글 찾아 줘");
		await page.findByRole("button", { name: "셋째 글" }, wait);
		await userEvent.click(page.getByRole("button", { name: "새 대화" }));
		await say(page, "둘 다 요약 채워 줘");
		await page.findByRole("button", { name: "2건 적용" }, wait);
		await userEvent.click(page.getByRole("button", { name: "지난 대화" }));
		await page.findByText(/검토 대기/, {}, wait);
	},
};

/** No past conversations yet. */
export const NoPastConversations: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await userEvent.click(page.getByRole("button", { name: "지난 대화" }));
		await page.findByText("지난 대화가 없습니다");
	},
};

/** The entry editor on a site with the assistant: ✦ at the end of its head opens the panel beside the page. */
export const InEditor: Story = {
	loaders: site(),
	play: async ({ canvasElement, loaded }) => {
		const page = await screen(canvasElement);
		window.location.hash = `#/c/post/${(loaded as Loaded).ids.second}`;
		await page.findByRole("textbox", { name: "제목" }, wait);
		await page.findByRole("button", { name: "어시스턴트 열기" }, wait);
	},
};

/**
 * Asked to open another entry while this one has unsaved changes: the screen did not move, the assistant says so, and the one step that
 * saves this entry and then opens the other stands under its answer.
 */
export const SaveAndOpen: Story = {
	loaders: site({
		script: (ids) => [
			{ calls: [{ name: "screen_openEntry", input: { id: ids.third } }] },
			{ text: "저장하지 않은 변경이 있어 셋째 글을 열지 않았습니다." },
		],
	}),
	play: async ({ canvasElement, loaded }) => {
		const page = await screen(canvasElement);
		window.location.hash = `#/c/post/${(loaded as Loaded).ids.second}`;
		const title = await page.findByRole("textbox", { name: "제목" }, wait);
		await userEvent.click(await page.findByRole("button", { name: "어시스턴트 열기" }, wait));
		await userEvent.type(title, ", 고치는 중");
		await say(page, "셋째 글 열어 줘");
		await page.findByRole("button", { name: "저장하고 열기" }, wait);
	},
};

/** A proposal's review page: each kind of change as a titled list, each change with its check. */
export const Review: Story = {
	loaders: site({ script: proposedKinds }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "요약 채우고 제목도 다듬어 줘");
		await userEvent.click(await page.findByRole("button", { name: "검토" }, wait));
		await page.findByRole("heading", { name: "제안 검토" }, wait);
		await within(await page.findByRole("main")).findByText("글, 다시", {}, wait);
	},
};

/** The review page with a kind of change looked at side by side: as it is, and as proposed. */
export const ReviewSideBySide: Story = {
	loaders: site({ script: proposedKinds }),
	play: async (context) => {
		await Review.play?.(context);
		const page = within(context.canvasElement.ownerDocument.body);
		await userEvent.click((await page.findAllByRole("tab", { name: "나란히" }))[0] as HTMLElement);
		await page.findByRole("tab", { name: "나란히", selected: true });
	},
};

/** The review page after its changes were applied: each row's result, and the way to undo them. */
export const ReviewApplied: Story = {
	loaders: site({ script: proposedKinds }),
	play: async (context) => {
		await Review.play?.(context);
		const page = within(context.canvasElement.ownerDocument.body);
		await userEvent.click((await page.findAllByRole("button", { name: "3건 적용" }))[0] as HTMLElement);
		await page.findAllByText("✓ 3건 적용", {}, wait);
	},
};

/** A change whose entry was edited after it was proposed: the row says so, is out of the count, and can be made again. */
export const ReviewChangedMeanwhile: Story = {
	loaders: site({ script: proposed }),
	play: async ({ canvasElement, loaded }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "둘 다 요약 채워 줘");
		await page.findByRole("button", { name: "2건 적용" }, wait);
		// The third post is edited elsewhere while its change waits.
		const { site: made, ids } = loaded as Loaded;
		const now = (await made.monti.run("entries.get", { id: ids.third }, admin)) as { entry: { version: number } };
		await made.monti.run("entries.save", { id: ids.third, version: now.entry.version, title: "셋째 글, 고침" }, admin);
		const [proposal] = await made.db.selectFrom("monti_proposal").select("id").execute();
		window.location.hash = `#/ai/review/${proposal?.id}`;
		await page.findByRole("heading", { name: "제안 검토" }, wait);
		await page.findByRole("button", { name: "다시 만들기" }, wait);
	},
};

/** "Make again" for the third post's summary: the change made on the entry as it is now, then a line about it. */
export const madeAgain: Script = async (ids, version) => [
	{
		calls: [
			{
				name: "entries_save",
				input: {
					id: ids.third,
					version: (await version(ids.third)) + 1,
					values: { summary: "다시 쓴 요약입니다." },
					[GROUP]: "요약 채우기",
				},
			},
		],
	},
	{ text: "다시 만들었습니다." },
];

/**
 * "Make again" pressed with the keyboard on the review page (T241): the button goes once the change is made again, and the focus is on
 * that row's check, not on the page.
 */
export const ReviewMadeAgainByKeyboard: Story = {
	loaders: site({ script: scripts(proposed, madeAgain) }),
	play: async (context) => {
		await ReviewChangedMeanwhile.play?.(context);
		const page = within(context.canvasElement.ownerDocument.body);
		const again = await page.findByRole("button", { name: "다시 만들기" }, wait);
		// As the Tab key leaves it: the keyboard's focus is on the button, and Enter presses it.
		await userEvent.tab();
		again.focus();
		await userEvent.keyboard("{Enter}");
		// The row with its new change; the focus is on its check. Where the focus lands is asserted by the screen test, with a real key:
		// a story's keys are made by script, and whether a browser takes a focus set after them for the keyboard's depends on what was
		// pressed in the page before.
		await page.findAllByText("다시 쓴 요약입니다.", {}, wait);
	},
};

/** "Polish the second post": one change of its first paragraph, made on the entry as it is when asked. */
export const polished: Script = (ids, version) => [
	async () => ({
		calls: [
			{
				name: "body_edit",
				input: {
					id: ids.second,
					version: await version(ids.second),
					ops: [{ op: "replaceText", block: "b_1", from: 0, to: 2, text: "첫" }],
					[GROUP]: "다듬기",
				},
			},
		],
	}),
	{ text: "첫 문단을 다듬었습니다." },
];

/** Gives the second post a body of one paragraph, as it is before the assistant is asked to polish it. */
export const writeSecond = async ({ site: made, ids }: Loaded, words = "처음 문단입니다.") => {
	const now = (await made.monti.run("entries.get", { id: ids.second }, admin)) as { entry: { version: number } };
	await made.monti.run(
		"entries.save",
		{
			id: ids.second,
			version: now.entry.version,
			doc: { type: "doc", blocks: [{ id: "b_1", type: "paragraph", content: [{ type: "text", text: words }] }] },
		},
		admin,
	);
};

/**
 * The name on a proposal's bubble in the editor (T241): pressed, it opens the panel on the conversation that proposed the change, whatever
 * conversation the panel was on and though it was closed.
 */
export const BubbleOpensItsConversation: Story = {
	loaders: site({ script: polished }),
	play: async ({ canvasElement, loaded }) => {
		const page = await screen(canvasElement);
		await writeSecond(loaded as Loaded);
		await openPanel(page);
		await say(page, "둘째 글 다듬어 줘");
		await page.findByText("첫 문단을 다듬었습니다.", {}, wait);
		await page.findByRole("button", { name: "보내기" }, wait);
		// Another conversation is open, and the panel is closed, when the person reads the entry.
		await userEvent.click(await page.findByRole("button", { name: "새 대화" }));
		await userEvent.click(await page.findByRole("button", { name: "닫기" }));
		window.location.hash = `#/c/post/${(loaded as Loaded).ids.second}`;
		await userEvent.click(await page.findByRole("button", { name: "둘째 글 다듬어 줘" }, wait));
		await page.findByText("첫 문단을 다듬었습니다.", {}, wait);
	},
};

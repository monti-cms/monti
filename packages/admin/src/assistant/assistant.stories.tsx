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
import { userEvent, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../.storybook/pglite-site";
import { MontiAdmin } from "../app";
import { schema } from "../screens/story-schema";

export type Loaded = {
	site: StorySite;
	model: ScriptedProvider;
	ids: { first: string; second: string; third: string };
};

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Assistant",
	render: (_args, { loaded }) => {
		const { site: made } = loaded as Loaded;
		return <MontiAdmin transport={made.transport} streams={made.streams} siteName="example.dev" />;
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
const network: typeof globalThis.fetch = async (input) =>
	String(input).startsWith("https://api.anthropic.com/")
		? json(200, {
				data: ["claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5"].map((id) => ({
					id,
					capabilities: { thinking: { supported: id !== "claude-haiku-5-5" }, image_input: { supported: true } },
				})),
			})
		: json(404, {});

/** A turn that never ends: the moment a story shows is the one while it works. */
const never = new Promise<never>(() => {});

type Ids = Loaded["ids"];
/** What the scripted model says, made once the entries have their ids. */
type Script = (ids: Ids, version: (id: string) => Promise<number>) => Scripted[] | Promise<Scripted[]>;

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
	limits,
	at = "#/c/post",
}: {
	script?: Script;
	key?: boolean;
	limits?: Partial<RunLimits>;
	at?: string;
} = {}) => [
	async (): Promise<Loaded> => {
		startAt(at);
		const model = scriptedProvider();
		const ids = { first: "", second: "", third: "" };
		const made = await storySite({
			schema,
			auth: { password: true },
			signedIn: true,
			secret: "story-secret-for-the-assistant",
			fetch: network,
			plugins: [assistant({ provider: model.for, limits })],
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
		model.add(...(await script(ids, version)));
		return { site: made, model, ids };
	},
];

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
		script: (ids, version) => Promise.all([found(ids, version), proposed(ids, version)]).then((all) => all.flat()),
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

/** A proposal's review page: each kind of change as a titled list, each change with its check. */
export const Review: Story = {
	loaders: site({ script: proposedKinds }),
	play: async ({ canvasElement }) => {
		const page = await screen(canvasElement);
		await openPanel(page);
		await say(page, "요약 채우고 제목도 다듬어 줘");
		await userEvent.click(await page.findByRole("button", { name: "검토" }, wait));
		await page.findByRole("heading", { name: "제안 검토" }, wait);
		await page.findByText("첫 번째 글, 다시", {}, wait);
	},
};

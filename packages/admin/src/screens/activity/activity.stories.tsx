import { type MontiEvent, type Receiver, ReceiverAnswer, SITE_CACHE_LABEL } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { sql } from "kysely";
import { userEvent, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";

type Monti = StorySite["monti"];
export const wait = { timeout: 15000 };

/** The site's own cache refresh, and a search index's webhook: the two receivers of the stories' site. */
export const SITE = "plugin:next";
export const SEARCH = "webhook:search.example.dev";

/** The stories' receivers, for a test to take down and bring back, and to read what arrived. */
export type Hooks = {
	down: Set<string>;
	/** Entries the site's refresh fails for while the rest gets through. */
	refuse: Set<string>;
	arrived: { destination: string; event: MontiEvent }[];
	/** While set, a send waits for it: a delivery is on its way for as long as a test needs. */
	hold: Promise<void> | null;
	/** Operations the server fails at and says nothing (a 502 with no body): the call comes back with no reason. */
	lose: Set<string>;
	/** Operations whose call the network drops: no answer comes at all. */
	drop: Set<string>;
	/** Operations that wait for this before they answer: a call is on its way for as long as a test needs. */
	slow: Map<string, Promise<void>>;
	/** Every operation the screen called, in order. */
	calls: string[];
};
const receiversOf = (hooks: Hooks): Receiver[] =>
	[SITE, SEARCH].map((destination) => ({
		destination,
		// The search index hears of what is published; the site of everything it shows. The site's refresh has a name of its own, as the Next
		// adapter's has; the webhook, given no name, goes by its host.
		...(destination === SEARCH
			? { accepts: (event: MontiEvent) => event.type === "entry.published" }
			: { label: SITE_CACHE_LABEL }),
		async send(event) {
			if (hooks.hold) await hooks.hold;
			if (hooks.down.has(destination) || (destination === SITE && event.ids.some((id) => hooks.refuse.has(id))))
				throw new ReceiverAnswer("503 Service Unavailable");
			hooks.arrived.push({ destination, event });
		},
	}));

const admin = { actor: "admin" } as const;
type Written = { output: { id: string }; activityId: string };
const run = <Output = Written>(monti: Monti, name: string, input: unknown) =>
	monti.run(name, input, admin) as Promise<Output>;

export type LogIds = Awaited<ReturnType<typeof fillLog>>;
type Loaded = { site: StorySite; hooks: Hooks; ids: LogIds | null };

/**
 * A site's first days as the log shows them, oldest first: yesterday's settings and a thrown-away post, today's posts, the assistant's work for one
 * request, a publish whose delivery to the site failed (`failures` of them), a template from the command line, and a save.
 */
export async function fillLog(site: StorySite, hooks: Hooks, { failures = 1 }: { failures?: number } = {}) {
	const { monti, db } = site;
	const create = async (title: string, slug: string) =>
		(await run(monti, "entries.create", { collection: "post", locale: "ko", title, slug })).output.id;
	const versionOf = async (id: string) =>
		(await db.selectFrom("entries").select("version").where("id", "=", id).executeTakeFirstOrThrow()).version;

	await run(monti, "collections.updateAdminValues", { collection: "post", values: { label: "게시글" } });
	const old = await create("옛 소개 글", "about-old");
	await run(monti, "entries.publish", { ids: [old] });
	await run(monti, "trash.move", { rows: [{ kind: "entry", id: old }] });
	// All of that was yesterday.
	await sql`update monti_activity set "at" = "at" - interval '1 day'`.execute(db);

	const first = await create("첫 번째 글", "first-post");
	await run(monti, "entries.publish", { ids: [first] });
	await run(monti, "folders.create", { scope: "media", parentId: null, name: "Blog Assets" });
	await monti.run("templates.save", { name: "기본 틀", doc: { type: "doc", blocks: [] } }, { actor: "cli" });

	// The assistant's work for one request: two posts' summaries.
	const second = await create("리액트 19 마이그레이션", "react-19");
	const proposal = await monti.proposals.create("conversation-1", "이 두 편 요약 채워 줘. 말투는 그대로.");
	for (const id of [first, second])
		await monti.proposals.add(proposal, "entries.save", {
			id,
			version: await versionOf(id),
			values: { summary: "한 줄 요약" },
		});
	await monti.proposals.apply(proposal);
	const assistant = await db
		.selectFrom("monti_activity")
		.select("id")
		.where("proposal_id", "=", proposal)
		.orderBy("seq")
		.executeTakeFirstOrThrow();

	// Publishes the site did not hear of: its cache refresh was down. The posts were made while it was up.
	const titles = ["리액트 19 마이그레이션", "가을 사진 정리", "서울의 밤"];
	const toPublish = [second];
	for (let index = 1; index < failures; index++)
		toPublish.push(await create(titles[index] ?? `글 ${index}`, `failed-${index}`));
	hooks.down.add(SITE);
	const failed: { entry: string; line: string }[] = [];
	for (const entry of toPublish)
		failed.push({ entry, line: (await run(monti, "entries.publish", { ids: [entry] })).activityId });
	hooks.down.clear();

	const draft = await create("발행 후 고친 글", "edited-post");
	const saved = await run(monti, "entries.save", { id: draft, version: await versionOf(draft), title: "고친 글" });
	return { first, second, draft, old, proposal, assistant: assistant.id, failed, saved: saved.activityId };
}

/** Starts at an address with the log filled, signed in. `hash` may be made from what was put in (a line's id). */
export const log = (
	hash: string | ((ids: LogIds) => string) = "#/activity",
	{
		failures = 1,
		empty = false,
		receivers = true,
		also,
	}: {
		failures?: number;
		empty?: boolean;
		receivers?: boolean;
		also?: (site: StorySite, ids: LogIds, hooks: Hooks) => Promise<void>;
	} = {},
) => [
	async (): Promise<Loaded> => {
		startAt(typeof hash === "string" ? hash : "#/activity");
		localStorage.removeItem("monti:activity-columns");
		const hooks: Hooks = {
			down: new Set(),
			refuse: new Set(),
			arrived: [],
			hold: null,
			lose: new Set(),
			drop: new Set(),
			slow: new Map(),
			calls: [],
		};
		const made = await storySite({
			schema,
			auth: { password: true },
			signedIn: true,
			receivers: receivers ? receiversOf(hooks) : [],
		});
		const site: StorySite = {
			...made,
			async transport(name, ...rest) {
				hooks.calls.push(name);
				await hooks.slow.get(name);
				if (hooks.drop.has(name)) throw new TypeError("Failed to fetch");
				if (hooks.lose.has(name)) return { status: 502, body: null };
				return made.transport(name, ...rest);
			},
		};
		if (empty) return { site, hooks, ids: null };
		const ids = await fillLog(site, hooks, { failures });
		await also?.(site, ids, hooks);
		if (typeof hash !== "string") startAt(hash(ids));
		return { site, hooks, ids };
	},
];

const meta = {
	excludeStories: /^[a-z]|^SITE$|^SEARCH$/,
	tags: ["visual"],
	title: "Screens/Activity",
	render: (_args, { loaded }) => {
		const { site } = loaded as Loaded;
		return <MontiAdmin transport={site.transport} uploader={site.uploader} siteName="example.dev" />;
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const rowOf = async (canvas: HTMLElement, title: string) => {
	const row = (await within(canvas).findAllByText(title, {}, wait))[0]?.closest("tr");
	if (!row) throw new Error(`No row "${title}".`);
	return row;
};

/**
 * Flow 12·01: the log as it opens, newest first. One delivery failed: its row says so, the sidebar counts it, and the banner at the top offers to send it again. The
 * delivery cell's three ends stand side by side here: "보냄" in quiet words where every delivery went, the red mark where one failed, and nothing
 * where the write told no receiver (the template saved from the command line).
 */
export const Log: Story = { loaders: log() };

/** A row's ⋯: its details, and what can be done with it: send the failed delivery again, undo the publish. */
export const RowMenu: Story = {
	loaders: log(),
	play: async ({ canvasElement }) => {
		const row = await rowOf(canvasElement, '"리액트 19 마이그레이션" 발행');
		await userEvent.click(within(row).getByRole("button", { name: "행 메뉴" }));
		await within(document.body).findByRole("menu", {}, wait);
	},
};

/** The first column's menu: the kinds to filter by, each with how many rows it would show (flow 12·09). */
export const KindMenu: Story = {
	loaders: log(),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "작업" }, wait));
		await within(document.body).findByRole("menu", {}, wait);
	},
};

/** Flow 12·01b: filtered to failed deliveries. A dot after the column's name says so. */
export const FailedOnly: Story = { loaders: log("#/activity?delivery=failed") };

/** Flow 12·03: a row open beside the list: when and who, the entry as it was, and each receiver's delivery. */
export const Panel: Story = { loaders: log((ids) => `#/activity?open=${ids.failed[0]?.line}`) };

/** The assistant's row open: its request whole, everything it did and touched. */
export const AssistantPanel: Story = { loaders: log((ids) => `#/activity?open=${ids.assistant}`) };

/** Flow 12·05: three failed deliveries. The banner at the top of the screen counts them and offers to send them all. */
export const ThreeFailed: Story = { loaders: log("#/activity", { failures: 3 }) };

/**
 * One publish neither receiver got: two failed deliveries on one row, with the first story's one. The sidebar, the banner and the delivery
 * column's menu all count deliveries (three), while two rows say they failed.
 */
export const TwoOnOneRow: Story = {
	loaders: log("#/activity", {
		also: async (site, _ids, hooks) => {
			const made = await run(site.monti, "entries.create", {
				collection: "post",
				locale: "ko",
				title: "두 곳에 못 간 글",
				slug: "two-failed",
			});
			hooks.down.add(SITE);
			hooks.down.add(SEARCH);
			await run(site.monti, "entries.publish", { ids: [made.output.id] });
			hooks.down.clear();
		},
	}),
};

/** The failed delivery was tried again by itself twice and failed each time: three tries. The row says only that it failed; the panel counts. */
export const FailedThrice: Story = {
	loaders: log("#/activity", {
		also: async (site, _ids, hooks) => {
			hooks.down.add(SITE);
			for (let again = 0; again < 2; again++) {
				// Its next try has come.
				await sql`update monti_delivery set next_attempt_at = now() - interval '1 second' where state = 'failed'`.execute(
					site.db,
				);
				await site.monti.deliveries.sendDue();
			}
			hooks.down.clear();
		},
	}),
};

/**
 * A category that a published post points at was thrown away and restored. Undoing that restore puts it in the trash again, and the post
 * loses it on the site: the undo's question says so, in the sentence throwing it away by hand says.
 */
export const ItemRestored: Story = {
	loaders: log("#/activity", {
		also: async (site, ids) => {
			const { monti } = site;
			await run(monti, "collections.updateAdminValues", { collection: "category", values: { label: "카테고리" } });
			const made = await run<{ output: { group: string; locales: Record<string, { id: string }> } }>(
				monti,
				"items.saveGroup",
				{ collection: "category", locales: { ko: { title: "개발", slug: "dev" } } },
			);
			await run(monti, "relations.edit", {
				collection: "post",
				entryIds: [ids.first],
				field: "category",
				set: made.output.group,
			});
			await run(monti, "entries.publish", { ids: [ids.first] });
			const item = { kind: "entry", id: made.output.locales.ko?.id };
			await run(monti, "trash.move", { rows: [item] });
			await run(monti, "trash.restore", { rows: [item] });
		},
	}),
};

/** Flow 12·10: a site with no receiver. The log has no delivery column, and nothing counts. */
export const NoReceivers: Story = { loaders: log("#/activity", { receivers: false }) };

/** Flow 12·11: nothing logged yet. */
export const Empty: Story = { loaders: log("#/activity", { empty: true }) };

/** Search and a filter with nothing under them. */
export const NoMatch: Story = { loaders: log("#/activity?q=없는+글&kind=media") };

/** More rows than a page holds: the range and the pages under the table. */
export const Pages: Story = {
	loaders: log("#/activity", {
		also: async (site) => {
			for (let index = 1; index <= 48; index++)
				await run(site.monti, "entries.create", {
					collection: "memo",
					locale: "ko",
					title: `메모 ${index}`,
					slug: `memo-${index}`,
				});
		},
	}),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { sql } from "kysely";
import { type StorySite, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";

type Loaded = { site: StorySite };

/** The collections' Korean names, as the admin keeps them (admin values, doc 01). */
async function labelCollections(monti: {
	run: (name: string, input: unknown, options: { actor: "admin" }) => Promise<unknown>;
}) {
	for (const [collection, label] of [
		["post", "게시글"],
		["memo", "메모"],
		["category", "카테고리"],
	])
		await monti.run("collections.updateAdminValues", { collection, values: { label } }, { actor: "admin" });
}

const meta = {
	tags: ["visual"],
	title: "Screens/Frame",
	render: (_args, { loaded }) => <MontiAdmin transport={(loaded as Loaded).site.transport} siteName="example.dev" />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const signedIn = (
	setup?: (site: StorySite["monti"]) => Promise<void>,
	options: Partial<Parameters<typeof storySite>[0]> = {},
) => [
	async () => ({
		site: await storySite({
			schema,
			auth: { password: true },
			signedIn: true,
			setup: async (monti) => {
				await labelCollections(monti);
				await setup?.(monti);
			},
			...options,
		}),
	}),
];

/** Flow 8, step 03: the first admin is in, and the first collection is empty. A new site has no counts. */
export const Fresh: Story = { loaders: signedIn() };

/** The sidebar's numbers: entries per collection, the trash, failed deliveries (doc 15). */
export const Counts: Story = {
	loaders: signedIn(async (monti) => {
		for (const title of ["첫 번째 글", "두 번째 글", "세 번째 글"])
			await monti.run("entries.create", { collection: "post", locale: "ko", title }, { actor: "admin" });
		await monti.run("entries.create", { collection: "memo", locale: "ko", title: "메모" }, { actor: "admin" });
		await sql`update entries set trashed_at = now() where title = '세 번째 글'`.execute(monti.db);
		await sql`update monti_delivery set state = 'failed' where id in (select id from monti_delivery limit 1)`.execute(
			monti.db,
		);
		await sql`insert into monti_delivery (id, activity_id, destination, event, state)
			select 'story-failed', id, 'webhook:https://example.dev/hook', '{"type":"entry.saved","ids":[]}', 'failed' from monti_activity limit 1`.execute(
			monti.db,
		);
	}),
};

/** On the dev server, `monti.schema.ts` was edited by hand after the database followed it (T16). */
export const FileChanged: Story = {
	loaders: [
		async () => {
			const site = await storySite({
				schema,
				auth: { password: true },
				signedIn: true,
				setup: labelCollections,
				// The dev server: it has the schema files (a story writes none).
				files: { write: async () => {}, readChanges: async () => [] },
			});
			await sql`update schema_state set applied_hash = 'older'`.execute(site.db);
			return { site };
		},
	],
};

/** A schema change whose database step failed: its files are saved, and "apply again" finishes it (doc 12, T16). */
export const FailedChange: Story = {
	loaders: [
		async () => {
			const site = await storySite({ schema, auth: { password: true }, signedIn: true, setup: labelCollections });
			await sql`update schema_state set failed_change = '2026-11-05-143207-post'`.execute(site.db);
			return { site };
		},
	],
};

/** The live site's database is behind its schema: the admin sees nothing; the server's log says to run `monti db:migrate` (doc 01). */
export const LiveBehind: Story = {
	loaders: [
		async () => {
			const site = await storySite({ schema, auth: { password: true }, signedIn: true, setup: labelCollections });
			await sql`update schema_state set applied_hash = 'older'`.execute(site.db);
			return { site };
		},
	],
};

import { mdxAdmin } from "@monti-cms/mdx/admin";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { type StorySite, startAt } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { site as blog } from "../list/import.stories";

type Loaded = { site: StorySite };

const wait = { timeout: 15000 };

/** The blog with the MDX plugin (or without), on the editor of its first post. */
export const site = (options: { mdx?: boolean } = {}) => [
	async () => {
		const [load] = blog({ mdx: options.mdx });
		const loaded = await (load as () => Promise<Loaded>)();
		const post = await loaded.site.db
			.selectFrom("entries")
			.select("id")
			.where("slug", "=", "first-post")
			.executeTakeFirstOrThrow();
		startAt(`#/c/post/${post.id}`);
		return { ...loaded, mdx: options.mdx !== false };
	},
];

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Editor/DocumentTools",
	render: (_args, { loaded }) => {
		const { site: made, mdx } = loaded as Loaded & { mdx: boolean };
		return (
			<MontiAdmin
				transport={made.transport}
				uploader={made.uploader}
				siteName="example.dev"
				plugins={mdx ? [mdxAdmin] : []}
			/>
		);
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const openMenu = async (canvasElement: HTMLElement) => {
	await userEvent.click(await within(canvasElement).findByRole("button", { name: "더 보기" }, wait));
	return within(await within(document.body).findByRole("menu", {}, wait));
};

/** The editor's ⋯ with the document tools in its middle group: the plugin's view as a switch, and the body's width with its value. */
export const Menu: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const menu = await openMenu(canvasElement);
		await waitFor(() => expect(menu.getByRole("menuitemcheckbox", { name: "MDX로 보기" })).toBeTruthy(), wait);
	},
};

/** "View as MDX" on: the body as MDX beside the text, in the place of the properties. */
export const MdxView: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const menu = await openMenu(canvasElement);
		await userEvent.click(menu.getByRole("menuitemcheckbox", { name: "MDX로 보기" }));
		await userEvent.keyboard("{Escape}");
		await waitFor(
			() => expect(within(canvasElement).getByRole("complementary", { name: "MDX로 보기" })).toBeTruthy(),
			wait,
		);
	},
};

/** The body's width picked "full": the second level with the two widths. */
export const WidthMenu: Story = {
	loaders: site({ mdx: false }),
	play: async ({ canvasElement }) => {
		const menu = await openMenu(canvasElement);
		await userEvent.click(menu.getByRole("menuitem", { name: /본문 폭/ }));
		await waitFor(
			() => expect(within(document.body).getByRole("menuitemradio", { name: "꽉 차게" })).toBeTruthy(),
			wait,
		);
	},
};

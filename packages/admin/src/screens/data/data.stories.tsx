import { mdxAdmin } from "@monti-cms/mdx/admin";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { StorySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { site as blog, catchDownloads } from "../list/import.stories";

type Loaded = { site: StorySite; saved: ReturnType<typeof catchDownloads> };

const wait = { timeout: 15000 };

/** The blog with a file in its library, on the tools' data tab; what the page saves is kept at hand. */
export const site = (options: { picture?: boolean; hold?: string } = { picture: true }) => [
	...blog({ hash: "#/tools/data", picture: options.picture, hold: options.hold }),
	async () => ({ saved: catchDownloads() }),
];

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Tools/Data",
	render: (_args, { loaded }) => {
		const { site: made } = loaded as Loaded;
		return (
			<MontiAdmin transport={made.transport} uploader={made.uploader} siteName="example.dev" plugins={[mdxAdmin]} />
		);
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Flow 9, 01: the backup, with the choice to take the media files along (off) and no backup taken yet. */
export const Default: Story = {
	loaders: site(),
	play: ({ canvasElement }) =>
		waitFor(() => expect(within(canvasElement).getByRole("button", { name: "백업 받기" })).toBeTruthy(), wait),
};

/** Flow 9, 02: the backup is being made. The pill works and says how far it is. */
export const Making: Story = {
	loaders: site({ picture: true, hold: "data.backup" }),
	play: async (context) => {
		await Default.play?.(context);
		await userEvent.click(within(context.canvasElement).getByRole("button", { name: "백업 받기" }));
		await waitFor(() => expect(within(context.canvasElement).getByText("만드는 중 0%")).toBeTruthy(), wait);
	},
};

/** Flow 9, 03: the backup was taken. The toast says so and the last backup is today's. */
export const Taken: Story = {
	loaders: site(),
	play: async (context) => {
		await Default.play?.(context);
		await userEvent.click(within(context.canvasElement).getByRole("button", { name: "백업 받기" }));
		await waitFor(() => expect(within(document.body).getByText("백업을 저장했습니다")).toBeTruthy(), wait);
	},
};

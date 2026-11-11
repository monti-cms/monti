import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";

type Loaded = { site: StorySite };

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Login",
	render: (_args, { loaded }) => <MontiAdmin transport={(loaded as Loaded).site.transport} siteName="example.dev" />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The form, once `auth.state` has come back and drawn it. */
async function form(canvasElement: HTMLElement) {
	const page = within(canvasElement);
	await page.findByLabelText("이메일");
	return page;
}

/** Fills a field as typing would, through the input's change event. */
const fill = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });

const site = (options: Parameters<typeof storySite>[0]) => [
	async () => {
		startAt();
		return { site: await storySite(options) };
	},
];
const password = { password: true };
const github = { clientId: "id", clientSecret: "secret", admin: "monti-owner" };
const withAdmin = {
	schema,
	auth: { ...password, github },
	setup: async (monti: StorySite["monti"]) => {
		await monti.run(
			"auth.createFirstAdmin",
			{ email: "me@example.dev", password: "story password", confirm: "story password" },
			{ actor: "admin" },
		);
	},
};

/** Flow 8, step 01: no admin yet, so the first visit makes one. */
export const FirstAdmin: Story = { loaders: site({ schema, auth: password }) };

/** Flow 8, step 02: both rules show at once, before anything is sent. */
export const FirstAdminErrors: Story = {
	loaders: site({ schema, auth: password }),
	play: async ({ canvasElement }) => {
		const page = await form(canvasElement);
		fill(page.getByLabelText("이메일"), "me@example.dev");
		fill(page.getByLabelText("비밀번호"), "short");
		fill(page.getByLabelText("비밀번호 확인"), "shorter");
		await userEvent.click(page.getByRole("button", { name: "생성" }));
		await expect(await page.findByText("10자 이상이어야 합니다.")).toBeInTheDocument();
	},
};

/** Flow 8, step 04: someone made the admin in the meantime. */
export const Closed: Story = {
	loaders: site({ schema, auth: password }),
	play: async ({ canvasElement, loaded }) => {
		const page = await form(canvasElement);
		fill(page.getByLabelText("이메일"), "me@example.dev");
		fill(page.getByLabelText("비밀번호"), "story password");
		fill(page.getByLabelText("비밀번호 확인"), "story password");
		// Another browser is first.
		await (loaded as Loaded).site.monti.run(
			"auth.createFirstAdmin",
			{ email: "other@example.dev", password: "another password", confirm: "another password" },
			{ actor: "admin" },
		);
		await userEvent.click(page.getByRole("button", { name: "생성" }));
		await expect(await page.findByText("이미 관리자가 있습니다.")).toBeInTheDocument();
	},
};

/** Flow 8, step 05: email and password, or GitHub. */
export const SignIn: Story = { loaders: site(withAdmin) };

/** Flow 8, step 06: one wrong password. */
export const Wrong: Story = {
	loaders: site(withAdmin),
	play: async ({ canvasElement }) => {
		const page = await form(canvasElement);
		fill(page.getByLabelText("이메일"), "me@example.dev");
		fill(page.getByLabelText("비밀번호"), "not it at all");
		await userEvent.click(page.getByRole("button", { name: "로그인" }));
		await expect(await page.findByText("이메일 또는 비밀번호가 맞지 않습니다.")).toBeInTheDocument();
	},
};

/** Flow 8, step 07: five wrong in a minute lock the button. */
export const Locked: Story = {
	loaders: site({
		...withAdmin,
		setup: async (monti) => {
			await withAdmin.setup(monti);
			for (let index = 0; index < 5; index += 1)
				await monti.run("auth.signIn", { email: "me@example.dev", password: "nope" }, { actor: "admin" });
		},
	}),
	play: async ({ canvasElement }) => {
		const page = await form(canvasElement);
		fill(page.getByLabelText("이메일"), "me@example.dev");
		fill(page.getByLabelText("비밀번호"), "story password");
		await userEvent.click(page.getByRole("button", { name: "로그인" }));
		await expect(await page.findByText("1분 뒤에 다시 시도해 주세요.")).toBeInTheDocument();
	},
};

/** Flow 8, step 08: a GitHub-only site has no email form. */
export const GitHubOnly: Story = { loaders: site({ schema, auth: { github } }) };

/** Flow 8, step 09: GitHub signed in someone who is not the admin. */
export const GitHubDenied: Story = {
	loaders: site({ schema, auth: { github } }),
	render: (_args, { loaded }) => (
		<MontiAdmin transport={(loaded as Loaded).site.transport} siteName="example.dev" denied="octo-kim" />
	),
};

/** Flow 8, step 10: `monti init` chose no way to sign in. The screen names the one place to fix it. */
export const NoLogin: Story = {
	loaders: site({ schema, auth: {} }),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		await expect(await page.findByText("monti.config.ts의 auth에 로그인 방법을 넣어 주세요.")).toBeInTheDocument();
	},
};

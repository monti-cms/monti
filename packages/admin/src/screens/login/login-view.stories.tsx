import { createTranslator } from "@monti-cms/core/site";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent } from "storybook/test";
import { type LoginMode, LoginView } from "./login-view";
import { loginMessages } from "./messages";

/**
 * The login screen in every state of its board (`Login.dc.html`, attempt), with the board's data. The fields are typed in by the play, as a person
 * would, so the dots and the email are the board's. The story names are the board's states.
 */
const meta = {
	title: "Screens/Login",
	component: LoginView,
	parameters: { bleed: true },
	tags: ["visual"],
} satisfies Meta<typeof LoginView>;
export default meta;
type Story = StoryObj<typeof meta>;

const github = { id: "github", name: "GitHub", icon: "logo--github", action: "#github" };

const signIn = (extra: Partial<Extract<LoginMode, { kind: "sign-in" }>> = {}): LoginMode => ({
	kind: "sign-in",
	passwordAction: "#password",
	buttons: [github],
	...extra,
});
const firstAdmin = (extra: Partial<Extract<LoginMode, { kind: "first-admin" }>> = {}): LoginMode => ({
	kind: "first-admin",
	action: "#first-admin",
	minPasswordLength: 10,
	...extra,
});

/** A story of one state: the screen in the toolbar's language, and what the board has typed into its fields (by input id). */
const state = (mode: LoginMode, typed: Record<string, string> = {}): Story => ({
	args: { mode, siteName: "example.dev", version: "Monti 0.2", t: createTranslator(loginMessages, "ko") },
	render: (args, { globals }) => (
		<LoginView {...args} t={createTranslator(loginMessages, globals.language === "en" ? "en" : "ko")} />
	),
	play: async ({ canvasElement }) => {
		for (const [id, value] of Object.entries(typed)) {
			const field = canvasElement.querySelector<HTMLInputElement>(`#${id}`);
			if (field) await userEvent.type(field, value);
		}
		(document.activeElement as HTMLElement | null)?.blur();
	},
});

const SIGN_IN = { email: "me@example.dev", password: "aaaaaaaaaa" };

export const First: Story = { name: "처음", ...state(signIn(), SIGN_IN) };
export const OnceWrong: Story = { name: "한 번 틀림", ...state(signIn({ error: "credentials" }), SIGN_IN) };
export const Locked: Story = { name: "잠김", ...state(signIn({ error: "credentials", locked: true }), SIGN_IN) };
export const FirstAdmin: Story = {
	name: "첫 관리자",
	...state(firstAdmin(), { email: "me@example.dev", password: "aaaaaaaaaa", confirm: "aaaaaaaaaa" }),
};
export const FirstAdminErrors: Story = {
	name: "첫 관리자 오류",
	...state(firstAdmin({ errors: ["password", "confirm"] }), {
		email: "me@example.dev",
		password: "aaaaaa",
		confirm: "aaaaaaa",
	}),
};
export const AlreadyExists: Story = { name: "이미 있음", ...state({ kind: "closed", signInHref: "#login" }) };
export const GithubOnly: Story = { name: "GitHub만", ...state({ kind: "sign-in", buttons: [github] }) };
export const GithubDenied: Story = {
	name: "GitHub 권한 없음",
	...state({ kind: "sign-in", buttons: [github], denied: { name: "octo-kim", signOutAction: "#sign-out" } }),
};
export const NoLogin: Story = { name: "로그인 없음", ...state({ kind: "no-login" }) };

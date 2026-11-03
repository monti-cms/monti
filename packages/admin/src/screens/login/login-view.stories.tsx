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

/** The GitHub login's own mark (`@monti-cms/auth`'s `github()` icon). */
const GITHUB_ICON = `data:image/svg+xml,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#8b949e"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
)}`;
const github = { id: "github", name: "GitHub", icon: GITHUB_ICON, action: "#github" };

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

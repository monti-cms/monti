import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoginScreen } from "./login";

/** The login screen in each of its states, as the admin's own login screen draws them (Screens/Login in the admin's Storybook). */
const meta = {
	title: "Screens/Reference/Login",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const First: Story = { name: "처음", render: () => <LoginScreen state={{ kind: "sign-in", password: true }} /> };
export const OnceWrong: Story = {
	name: "한 번 틀림",
	render: () => <LoginScreen state={{ kind: "sign-in", password: true, error: "credentials" }} />,
};
export const Locked: Story = {
	name: "잠김",
	render: () => <LoginScreen state={{ kind: "sign-in", password: true, error: "credentials", locked: true }} />,
};
export const FirstAdmin: Story = { name: "첫 관리자", render: () => <LoginScreen state={{ kind: "first-admin" }} /> };
export const FirstAdminErrors: Story = {
	name: "첫 관리자 오류",
	render: () => <LoginScreen state={{ kind: "first-admin", errors: ["password", "confirm"] }} />,
};
export const AlreadyExists: Story = { name: "이미 있음", render: () => <LoginScreen state={{ kind: "closed" }} /> };
export const GithubOnly: Story = { name: "GitHub만", render: () => <LoginScreen state={{ kind: "sign-in" }} /> };
export const GithubDenied: Story = {
	name: "GitHub 권한 없음",
	render: () => <LoginScreen state={{ kind: "sign-in", denied: "octo-kim" }} />,
};
export const NoLogin: Story = { name: "로그인 없음", render: () => <LoginScreen state={{ kind: "no-login" }} /> };

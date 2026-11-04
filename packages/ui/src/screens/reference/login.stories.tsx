import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoginScreen } from "./login";

/** The login screen in each of its states, as the admin's own login screen draws them (Screens/Login in the admin's Storybook). */
const meta = {
	title: "Screens/Reference/Login",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const First: Story = { render: () => <LoginScreen state={{ kind: "sign-in", password: true }} /> };
export const OnceWrong: Story = {
	render: () => <LoginScreen state={{ kind: "sign-in", password: true, error: "credentials" }} />,
};
export const Locked: Story = {
	render: () => <LoginScreen state={{ kind: "sign-in", password: true, error: "credentials", locked: true }} />,
};
export const FirstAdmin: Story = { render: () => <LoginScreen state={{ kind: "first-admin" }} /> };
export const FirstAdminErrors: Story = {
	render: () => <LoginScreen state={{ kind: "first-admin", errors: ["password", "confirm"] }} />,
};
export const AlreadyExists: Story = { render: () => <LoginScreen state={{ kind: "closed" }} /> };
export const GithubOnly: Story = { render: () => <LoginScreen state={{ kind: "sign-in" }} /> };
export const GithubDenied: Story = {
	render: () => <LoginScreen state={{ kind: "sign-in", denied: "octo-kim" }} />,
};
export const NoLogin: Story = { render: () => <LoginScreen state={{ kind: "no-login" }} /> };

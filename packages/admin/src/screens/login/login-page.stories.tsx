import type { Cms } from "@monti-cms/core/server";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { testSite } from "../../../../core/test/site";
import type { AdminServer } from "../../host/server";
import AdminLoginPage from "./page";

const meta = { title: "Screens/Login", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const server: AdminServer = {
	redirect: (href) => {
		throw new Error(`redirect ${href}`);
	},
	notFound: () => {
		throw new Error("not found");
	},
};

const password = { id: "password", name: "Email and password", label: "Sign in", credentials: true };
const github = { id: "github", name: "GitHub", label: "Sign in with GitHub" };

/** The parts of the CMS the login page reads: the site, the dev-bypass check and the auth (its providers, accounts and session). */
const cmsOf = ({
	providers,
	hasAdmin = true,
	accountId,
}: {
	providers: unknown[];
	hasAdmin?: boolean;
	accountId?: string;
}) =>
	({
		site: testSite,
		authGateway: { isDevBypassActive: async () => false },
		auth: () => ({
			providers,
			isAdmin: () => false,
			session: async () => (accountId ? { user: { accountId } } : null),
			accounts: providers.includes(password) ? { minPasswordLength: 10, hasAny: async () => hasAdmin } : undefined,
		}),
	}) as unknown as Cms;

/** The login page is an async server component: a loader awaits it, and the story shows what it returned. */
const login = (cms: Cms, error?: string): Story => ({
	loaders: [
		async () => ({
			element: await AdminLoginPage({ cms, server, searchParams: Promise.resolve(error ? { error } : {}) }),
		}),
	],
	render: (_args, { loaded }) => loaded.element,
});

export const WithPassword = login(cmsOf({ providers: [password] }));
export const WithGitHub = login(cmsOf({ providers: [github] }));
export const WithPasswordAndGitHub = login(cmsOf({ providers: [password, github] }));
export const WrongPassword = login(cmsOf({ providers: [password] }), "CredentialsSignin");
export const FirstAdminSetup = login(cmsOf({ providers: [password], hasAdmin: false }));
export const FirstAdminPasswordMismatch = login(cmsOf({ providers: [password], hasAdmin: false }), "confirm");
export const FirstAdminClosed = login(cmsOf({ providers: [password] }), "closed");
export const NotAnAdmin = login(cmsOf({ providers: [github], accountId: "octocat" }));
export const NoLoginConfigured = login(cmsOf({ providers: [] }));

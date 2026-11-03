import type { Meta, StoryObj } from "@storybook/react-vite";
import { screenCatalog } from "../spec/catalog";
import { ScreenSpec, type ScreenSpecDocument } from "../spec/registry";
import loginSpec from "./login.spec.json";

/**
 * The login screen drawn from `login.spec.json` with the design system's parts, one story per state of the Login board. The admin's login page
 * draws the same spec; each story here only fills the state the page would build (texts, addresses, errors).
 */
const spec = loginSpec as ScreenSpecDocument;
const issues = screenCatalog.validate(spec);

const text = {
	email: "이메일",
	password: "비밀번호",
	confirmPassword: "비밀번호 확인",
	signInSubmit: "로그인",
	createFirstAdmin: "생성",
	or: "또는",
	otherAccount: "다른 계정으로 로그인",
	goToSignIn: "로그인하기",
	errorClosed: "이미 관리자가 있어요.",
};
/** A sign-in method's icon is an address the provider gives (Auth.js's `icon`); here, the GitHub mark the board draws. */
const GITHUB_ICON = `data:image/svg+xml,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#888"><path fill-rule="evenodd" d="M16,2a14,14,0,0,0-4.43,27.28c.7.13,1-.3,1-.67s0-1.21,0-2.38c-3.89.84-4.71-1.88-4.71-1.88A3.71,3.71,0,0,0,6.24,22.3c-1.27-.86.1-.85.1-.85A2.94,2.94,0,0,1,8.48,22.9a3,3,0,0,0,4.08,1.16,2.93,2.93,0,0,1,.88-1.87c-3.1-.36-6.37-1.56-6.37-6.92a5.4,5.4,0,0,1,1.44-3.76,5,5,0,0,1,.14-3.7s1.17-.38,3.85,1.43a13.3,13.3,0,0,1,7,0c2.67-1.81,3.84-1.43,3.84-1.43a5,5,0,0,1,.14,3.7,5.4,5.4,0,0,1,1.44,3.76c0,5.38-3.27,6.56-6.39,6.91a3.33,3.33,0,0,1,.95,2.59c0,1.87,0,3.38,0,3.84s.25.81,1,.67A14,14,0,0,0,16,2Z"/></svg>',
)}`;
const github = { id: "github", label: "GitHub로 로그인", action: "#", icon: GITHUB_ICON };
/** The board shows a filled form; the page leaves the fields empty. */
const values = { email: "me@example.dev", password: "••••••••••", confirm: "••••••••••" };
const base = {
	values,
	siteName: "example.dev",
	version: "Monti 0.2",
	title: null,
	mode: "sign-in",
	text,
	errors: {},
	password: { action: "#" },
	hasButtons: true,
	buttons: [{ ...github, primary: false }],
	denied: null,
	locked: false,
};
const first = {
	...base,
	mode: "first-admin",
	title: "첫 관리자 만들기",
	first: { action: "#", minLength: 10, passwordHint: "10자 이상" },
};

const STATES: Record<string, Record<string, unknown>> = {
	처음: base,
	"한 번 틀림": { ...base, errors: { password: "이메일 또는 비밀번호가 맞지 않아요." } },
	잠김: { ...base, locked: true, errors: { password: "1분 뒤에 다시 시도해 주세요." } },
	"첫 관리자": first,
	"첫 관리자 오류": {
		...first,
		values: { ...values, password: "••••••", confirm: "•••••••" },
		errors: { password: "10자 이상이어야 해요.", confirm: "두 비밀번호가 같지 않아요." },
	},
	"이미 있음": { ...base, mode: "closed", closed: { href: "#" } },
	GitHub만: { ...base, password: { action: null }, buttons: [{ ...github, primary: true }] },
	"GitHub 권한 없음": {
		...base,
		password: { action: null },
		buttons: [{ ...github, primary: true }],
		denied: { text: "octo-kim은 관리자가 아니에요.", action: "#" },
	},
	"로그인 없음": { ...base, mode: "no-login", title: "로그인이 설정되지 않았어요", hasButtons: false, buttons: [] },
};

function LoginScreen({ state }: { state: string }) {
	if (!issues.success) return <pre>{JSON.stringify(issues, null, 2)}</pre>;
	return <ScreenSpec spec={spec} state={STATES[state] ?? base} />;
}

const meta = {
	title: "Screens/Login",
	component: LoginScreen,
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta<typeof LoginScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Start: Story = { name: "처음", args: { state: "처음" } };
export const WrongOnce: Story = { name: "한 번 틀림", args: { state: "한 번 틀림" } };
export const Locked: Story = { name: "잠김", args: { state: "잠김" } };
export const FirstAdmin: Story = { name: "첫 관리자", args: { state: "첫 관리자" } };
export const FirstAdminError: Story = { name: "첫 관리자 오류", args: { state: "첫 관리자 오류" } };
export const Closed: Story = { name: "이미 있음", args: { state: "이미 있음" } };
export const GitHubOnly: Story = { name: "GitHub만", args: { state: "GitHub만" } };
export const GitHubDenied: Story = { name: "GitHub 권한 없음", args: { state: "GitHub 권한 없음" } };
export const NoLogin: Story = { name: "로그인 없음", args: { state: "로그인 없음" } };

import { LogoGithub } from "../../icons";
import {
	Box,
	Button,
	FormField,
	FormFieldError,
	FormFieldLabel,
	Heading,
	Input,
	SecretInput,
	Separator,
	Stack,
	Text,
} from "../../index";

/** What the login screen shows, as the admin's own login (`packages/admin/src/screens/login/login-view.tsx`) takes it. */
export type LoginState =
	| {
			readonly kind: "sign-in";
			/** The email and password form is on. */
			readonly password?: boolean;
			readonly error?: "credentials" | "other";
			readonly locked?: boolean;
			/** Signed in with GitHub as someone who is not an admin. */
			readonly denied?: string;
	  }
	| { readonly kind: "first-admin"; readonly errors?: readonly ("password" | "confirm")[] }
	| { readonly kind: "closed" }
	| { readonly kind: "no-login" };

/** The fields of a form stand this far apart, in every state: their reserved error lines already hold the room under each. */
const FIELD_GAP = 16;

/** The login screen: the site's name over the ink rule, then one narrow form, and the version at the foot. */
export function LoginScreen({ state }: { state: LoginState }) {
	const title =
		state.kind === "first-admin"
			? "첫 관리자 만들기"
			: state.kind === "no-login"
				? "로그인이 설정되지 않았어요"
				: undefined;
	return (
		<Stack gap={32} minHeight="screen" paddingTop={48} paddingBottom={24} paddingX={16} background="page">
			<Stack grow align="center" justify="center">
				<Box width="full" maxWidth="side-panel">
					<Stack gap={32}>
						<Stack gap={20}>
							<Heading as="h1" variant="page">
								example.dev
							</Heading>
							<Box border="bottom-contrast" />
						</Stack>
						<Stack gap={24}>
							{title !== undefined ? (
								<Text as="p" variant="title">
									{title}
								</Text>
							) : null}
							{state.kind === "sign-in" ? <SignIn {...state} /> : null}
							{state.kind === "first-admin" ? <FirstAdmin {...state} /> : null}
							{state.kind === "closed" ? <Closed /> : null}
							{state.kind === "no-login" ? <NoLogin /> : null}
						</Stack>
					</Stack>
				</Box>
			</Stack>
			<Text as="p" variant="micro" tone="faint" align="center">
				Monti 0.2
			</Text>
		</Stack>
	);
}

function SignIn({ password = false, error, locked = false, denied }: Extract<LoginState, { kind: "sign-in" }>) {
	const passwordError = locked
		? "1분 뒤에 다시 시도해 주세요."
		: error === "credentials"
			? "이메일 또는 비밀번호가 맞지 않아요."
			: undefined;
	return (
		<Stack gap={12}>
			<Stack gap={20}>
				{password ? (
					<form>
						<Stack gap={12}>
							<Stack gap={FIELD_GAP}>
								<EmailField />
								<PasswordField id="password" label="비밀번호" value="aaaaaaaaaa" error={passwordError} />
							</Stack>
							<Button variant="primary" width="full" disabled={locked} pendingLabel="로그인 중…">
								로그인
							</Button>
						</Stack>
					</form>
				) : null}
				{password ? <Separator label="또는" /> : null}
				<form>
					{/* The one black pill: the password form's button, or the first method when there is no form. */}
					<Button variant={password ? "secondary" : "primary"} width="full" pendingLabel="로그인 중…">
						<LogoGithub aria-hidden />
						GitHub로 로그인
					</Button>
				</form>
			</Stack>
			{/* The form's own error line keeps its room under the password form, so an error moves nothing. */}
			{error === "other" || password ? (
				<FormFieldError reserve>
					{error === "other" ? "로그인하지 못했어요. 다시 시도해 주세요." : undefined}
				</FormFieldError>
			) : null}
			{/* "GitHub로 로그인" opens GitHub's account picker now, so the line needs no button of its own. */}
			{denied ? <FormFieldError>{denied}는 관리자가 아니에요.</FormFieldError> : null}
		</Stack>
	);
}

function FirstAdmin({ errors = [] }: Extract<LoginState, { kind: "first-admin" }>) {
	const wrong = errors.length > 0;
	return (
		<form>
			<Stack gap={12}>
				<Stack gap={12}>
					<Stack gap={FIELD_GAP}>
						<EmailField />
						<PasswordField
							id="password"
							label="비밀번호"
							value={wrong ? "aaaaaa" : "aaaaaaaaaa"}
							hint="10자 이상"
							error={errors.includes("password") ? "10자 이상이어야 해요." : undefined}
						/>
						<PasswordField
							id="confirm"
							label="비밀번호 확인"
							value={wrong ? "aaaaaaa" : "aaaaaaaaaa"}
							error={errors.includes("confirm") ? "두 비밀번호가 같지 않아요." : undefined}
						/>
					</Stack>
					<Button variant="primary" width="full" pendingLabel="생성 중…">
						생성
					</Button>
				</Stack>
				<FormFieldError reserve />
			</Stack>
		</form>
	);
}

/** Nothing failed: the admin exists already, so the one thing to do, signing in, is the pill. */
function Closed() {
	return (
		<Stack gap={16} paddingTop={16}>
			<Text as="p">이미 관리자가 있어요.</Text>
			<form>
				<Button type="submit" variant="primary" width="full">
					로그인하기
				</Button>
			</form>
		</Stack>
	);
}

/** Where login is turned on: the one place to fix it, named. */
function NoLogin() {
	return (
		<Text as="p">
			<Text mono>monti.config.ts</Text>의 <Text mono>auth</Text>에 로그인 방법을 넣어 주세요.
		</Text>
	);
}

function EmailField() {
	return (
		<FormField>
			<FormFieldLabel htmlFor="email">이메일</FormFieldLabel>
			<Input id="email" type="email" defaultValue="me@example.dev" />
			{/* The line stays when empty, as the password's does: an error after a send moves nothing. */}
			<FormFieldError reserve />
		</FormField>
	);
}

function PasswordField({
	id,
	label,
	value,
	error,
	hint,
}: {
	id: "password" | "confirm";
	label: string;
	value: string;
	error?: string;
	hint?: string;
}) {
	return (
		<FormField>
			<FormFieldLabel htmlFor={id}>{label}</FormFieldLabel>
			<SecretInput
				kind="password"
				id={id}
				defaultValue={value}
				showLabel="비밀번호 보기"
				hideLabel="비밀번호 가리기"
				aria-invalid={error ? true : undefined}
			/>
			{/* The line stays when empty: the error comes back after a send, and the button must not move. */}
			<FormFieldError reserve hint={hint}>
				{error}
			</FormFieldError>
		</FormField>
	);
}

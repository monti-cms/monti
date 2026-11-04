import { LogoGithub } from "../../icons";
import {
	Box,
	Button,
	FormField,
	FormFieldError,
	FormFieldLabel,
	Heading,
	Input,
	Separator,
	Stack,
	SubmitButton,
	Text,
	TextButton,
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
						{title !== undefined || state.kind !== "no-login" ? (
							<Stack gap={24}>
								{title !== undefined ? (
									<Text as="p" variant="title">
										{title}
									</Text>
								) : null}
								{state.kind === "sign-in" ? <SignIn {...state} /> : null}
								{state.kind === "first-admin" ? <FirstAdmin {...state} /> : null}
								{state.kind === "closed" ? <Closed /> : null}
							</Stack>
						) : null}
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
							<Stack gap={24}>
								<EmailField />
								<PasswordField id="password" label="비밀번호" value="aaaaaaaaaa" error={passwordError} />
							</Stack>
							<SubmitButton variant="primary" width="full" disabled={locked} pendingLabel="로그인 중…">
								로그인
							</SubmitButton>
						</Stack>
					</form>
				) : null}
				{password ? <Separator label="또는" /> : null}
				<form>
					{/* The one black pill: the password form's button, or the first method when there is no form. */}
					<SubmitButton variant={password ? "secondary" : "primary"} width="full" pendingLabel="로그인 중…">
						<LogoGithub aria-hidden />
						GitHub로 로그인
					</SubmitButton>
				</form>
			</Stack>
			{/* The form's own error line keeps its room under the password form, so an error moves nothing. */}
			{error === "other" || password ? (
				<FormFieldError reserve>
					{error === "other" ? "로그인하지 못했어요. 다시 시도해 주세요." : undefined}
				</FormFieldError>
			) : null}
			{denied ? (
				<Stack gap={8} align="start">
					<FormFieldError>{denied}는 관리자가 아니에요.</FormFieldError>
					<form>
						<TextButton type="submit">다른 계정으로 로그인</TextButton>
					</form>
				</Stack>
			) : null}
		</Stack>
	);
}

function FirstAdmin({ errors = [] }: Extract<LoginState, { kind: "first-admin" }>) {
	const wrong = errors.length > 0;
	return (
		<form>
			<Stack gap={12}>
				<Stack gap={12}>
					<Stack gap={24}>
						<EmailField />
						<Stack gap={16}>
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
					</Stack>
					<SubmitButton variant="primary" width="full" pendingLabel="생성 중…">
						생성
					</SubmitButton>
				</Stack>
				<FormFieldError reserve />
			</Stack>
		</form>
	);
}

function Closed() {
	return (
		<Stack gap={16} paddingTop={16}>
			<FormFieldError>이미 관리자가 있어요.</FormFieldError>
			<form>
				<Button type="submit" variant="secondary" width="full">
					로그인하기
				</Button>
			</form>
		</Stack>
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
			<Input id={id} type="password" defaultValue={value} aria-invalid={error ? true : undefined} />
			{/* The line stays when empty: the error comes back after a send, and the button must not move. */}
			<FormFieldError reserve hint={hint}>
				{error}
			</FormFieldError>
		</FormField>
	);
}

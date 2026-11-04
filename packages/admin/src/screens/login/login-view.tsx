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
} from "@monti-cms/ui";
import { iconNamed } from "@monti-cms/ui/icons";
import type { TranslatorFor } from "../../translator";
import type { loginMessages } from "./messages";

/** Why the last attempt did not work: a wrong email or password, a field the first-admin form refused, or anything else. */
export type LoginError = "credentials" | "email" | "password" | "confirm" | "other";

/** A login method that is one button (an OAuth provider): its name, its icon and the address its form posts to. */
export interface LoginButton {
	readonly id: string;
	readonly name: string;
	/** The icon's name in the design system's list (`logo--github`); an unknown name draws none. */
	readonly icon?: string;
	readonly action: string;
}

/** What the login screen shows. */
export type LoginMode =
	/** The sign-in form and buttons of the methods that are on. */
	| {
			readonly kind: "sign-in";
			/** Where the email and password form posts; absent when the site has no password login. */
			readonly passwordAction?: string;
			readonly buttons: readonly LoginButton[];
			readonly error?: LoginError;
			/** Too many failed sign-ins: the form says to wait and its button is off. */
			readonly locked?: boolean;
			/** Signed in with an account that is not an admin: its name, and where the form that signs it out posts. */
			readonly denied?: { readonly name: string; readonly signOutAction: string };
	  }
	/** No account exists yet: the form that creates the first admin. */
	| {
			readonly kind: "first-admin";
			readonly action: string;
			readonly minPasswordLength: number;
			/** The route reports one reason per post; the board shows the password and the confirmation refused together. */
			readonly errors?: readonly LoginError[];
	  }
	/** The first admin was created elsewhere in the meantime: say so and lead back to the sign-in form. */
	| { readonly kind: "closed"; readonly signInHref: string }
	/** The site has no login method. */
	| { readonly kind: "no-login" };

export interface LoginViewProps {
	readonly t: TranslatorFor<typeof loginMessages>;
	/** The site's name, the screen's heading. */
	readonly siteName: string;
	/** The line at the foot of the screen ("Monti 0.2"); none when unknown. */
	readonly version?: string;
	readonly mode: LoginMode;
}

/**
 * The login screen as drawn (docs/design/admin/screens/login.md): the site name over the ink rule, then one narrow form. It only draws; the page reads
 * the session and the login methods and passes what to show. The forms are plain posts to the core's session routes.
 */
export function LoginView({ t, siteName, version, mode }: LoginViewProps) {
	const title =
		mode.kind === "first-admin" ? t("firstAdminTitle") : mode.kind === "no-login" ? t("noLoginTitle") : undefined;
	return (
		<Stack gap={32} minHeight="screen" paddingTop={48} paddingBottom={24} paddingX={16} background="page">
			<Stack grow align="center" justify="center">
				<Box width="full" maxWidth="side-panel">
					<Stack gap={32}>
						<Stack gap={20}>
							<Heading as="h1" variant="page">
								{siteName}
							</Heading>
							<Box border="bottom-contrast" />
						</Stack>
						{title !== undefined || mode.kind !== "no-login" ? (
							<Stack gap={24}>
								{title !== undefined ? (
									<Text as="p" variant="title">
										{title}
									</Text>
								) : null}
								{mode.kind === "sign-in" ? <SignIn t={t} {...mode} /> : null}
								{mode.kind === "first-admin" ? <FirstAdmin t={t} {...mode} /> : null}
								{mode.kind === "closed" ? <Closed t={t} {...mode} /> : null}
							</Stack>
						) : null}
					</Stack>
				</Box>
			</Stack>
			{version ? (
				<Text as="p" variant="micro" tone="faint" align="center">
					{version}
				</Text>
			) : null}
		</Stack>
	);
}

type T = LoginViewProps["t"];

function SignIn({
	t,
	passwordAction,
	buttons,
	error,
	locked = false,
	denied,
}: Extract<LoginMode, { kind: "sign-in" }> & { t: T }) {
	const passwordError = locked ? t("errorLocked") : error === "credentials" ? t("errorCredentials") : undefined;
	// What no field of this form explains (an OAuth sign-in that did not finish, an unknown reason) goes under the buttons.
	const formError =
		error !== undefined && !(passwordAction && (error === "credentials" || error === "email"))
			? t("errorOther")
			: undefined;
	return (
		<Stack gap={12}>
			<Stack gap={20}>
				{passwordAction ? (
					<form method="post" action={passwordAction}>
						<Stack gap={12}>
							<Stack gap={24}>
								<EmailField t={t} error={error === "email" ? t("errorEmail") : undefined} />
								<PasswordField
									id="password"
									label={t("password")}
									autoComplete="current-password"
									error={passwordError}
								/>
							</Stack>
							<SubmitButton variant="primary" width="full" disabled={locked} pendingLabel={t("signingIn")}>
								{t("signInSubmit")}
							</SubmitButton>
						</Stack>
					</form>
				) : null}
				{passwordAction && buttons.length > 0 ? <Separator label={t("or")} /> : null}
				{buttons.length > 0 ? (
					<Stack gap={8}>
						{buttons.map((button, index) => {
							const Mark = button.icon ? iconNamed(button.icon) : undefined;
							return (
								<form key={button.id} method="post" action={button.action}>
									{/* The one black pill: the password form's button, or the first method when there is no form. */}
									<SubmitButton
										variant={!passwordAction && index === 0 ? "primary" : "secondary"}
										width="full"
										pendingLabel={t("signingIn")}
									>
										{Mark ? <Mark aria-hidden /> : null}
										{t("signIn", { provider: button.name })}
									</SubmitButton>
								</form>
							);
						})}
					</Stack>
				) : null}
			</Stack>
			{/* Its line is kept under the password form, so an error there moves nothing. */}
			{formError || passwordAction ? <FormFieldError reserve>{formError}</FormFieldError> : null}
			{denied ? (
				<Stack gap={8} align="start">
					<FormFieldError>{t("notAdmin", { name: denied.name })}</FormFieldError>
					<form method="post" action={denied.signOutAction}>
						<TextButton type="submit">{t("otherAccount")}</TextButton>
					</form>
				</Stack>
			) : null}
		</Stack>
	);
}

function FirstAdmin({
	t,
	action,
	minPasswordLength,
	errors = [],
}: Extract<LoginMode, { kind: "first-admin" }> & { t: T }) {
	const has = (error: LoginError) => errors.includes(error);
	return (
		<form method="post" action={action}>
			<Stack gap={12}>
				<Stack gap={12}>
					<Stack gap={24}>
						<EmailField t={t} error={has("email") ? t("errorEmail") : undefined} />
						<Stack gap={16}>
							<PasswordField
								id="password"
								label={t("password")}
								autoComplete="new-password"
								minLength={minPasswordLength}
								hint={t("passwordHint", { min: minPasswordLength })}
								error={has("password") ? t("errorPassword", { min: minPasswordLength }) : undefined}
							/>
							<PasswordField
								id="confirm"
								label={t("confirmPassword")}
								autoComplete="new-password"
								minLength={minPasswordLength}
								error={has("confirm") ? t("errorConfirm") : undefined}
							/>
						</Stack>
					</Stack>
					<SubmitButton variant="primary" width="full" pendingLabel={t("creating")}>
						{t("createFirstAdmin")}
					</SubmitButton>
				</Stack>
				<FormFieldError reserve>{has("other") || has("credentials") ? t("errorCreate") : undefined}</FormFieldError>
			</Stack>
		</form>
	);
}

function Closed({ t, signInHref }: Extract<LoginMode, { kind: "closed" }> & { t: T }) {
	return (
		<Stack gap={16} paddingTop={16}>
			<FormFieldError>{t("errorClosed")}</FormFieldError>
			<form method="get" action={signInHref}>
				<Button type="submit" variant="secondary" width="full">
					{t("goToSignIn")}
				</Button>
			</form>
		</Stack>
	);
}

function EmailField({ t, error }: { t: T; error?: string }) {
	return (
		<FormField>
			<FormFieldLabel htmlFor="email">{t("email")}</FormFieldLabel>
			<Input
				id="email"
				name="email"
				type="email"
				autoComplete="username"
				required
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? "email-error" : undefined}
			/>
			{/* The line stays when empty, as the password's does: an error after a send moves nothing. */}
			<FormFieldError id="email-error" reserve>
				{error}
			</FormFieldError>
		</FormField>
	);
}

function PasswordField({
	id,
	label,
	error,
	autoComplete,
	minLength,
	hint,
}: {
	id: "password" | "confirm";
	label: string;
	error?: string;
	autoComplete: "current-password" | "new-password";
	minLength?: number;
	/** What the line under the field says before any error (the first admin's length rule). */
	hint?: string;
}) {
	return (
		<FormField>
			<FormFieldLabel htmlFor={id}>{label}</FormFieldLabel>
			<Input
				id={id}
				name={id}
				type="password"
				autoComplete={autoComplete}
				required
				minLength={minLength}
				aria-invalid={error ? true : undefined}
				aria-describedby={error || hint ? `${id}-error` : undefined}
			/>
			{/* The line stays when empty: the error comes back after a send, and the button must not move. */}
			<FormFieldError id={`${id}-error`} reserve hint={hint}>
				{error}
			</FormFieldError>
		</FormField>
	);
}

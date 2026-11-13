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
} from "@monti-cms/ui";
import { LogoGithub } from "@monti-cms/ui/icons";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import pkg from "../../../package.json";
import { useAdmin } from "../../operations/admin-context";
import { useOperation } from "../../operations/use-operation";
import type { AuthState } from "../../session";

const MIN_PASSWORD = 10;
/** The fields of a form stand this far apart, in every state: their reserved error lines already hold the room under each. */
const FIELD_GAP = 16;
const VERSION = pkg.version.split(".").slice(0, 2).join(".");

/**
 * The login screen (doc 15, flow 8): what it shows follows `auth.state`. The site's name over the ink rule, one narrow form, the version at the
 * foot, as the reference screen `LoginScreen` draws it.
 */
export function LoginScreen({
	state,
	denied,
	onSignedIn,
}: {
	state: AuthState;
	denied?: string;
	onSignedIn: () => void;
}) {
	const { t, siteName } = useAdmin();
	// Another browser made the first admin while this one was filling the form: from then on this screen knows there is an admin, whatever the
	// state it was opened with says, so going on leads to signing in and never back to the first-admin form.
	const [adminMade, setAdminMade] = useState(false);
	const [closed, setClosed] = useState(false);
	const none = !state.methods.password && state.methods.external.length === 0;
	const first = state.methods.password && !state.hasAdmin && !adminMade;
	const title = none ? t("login.notSetUp") : first ? t("login.firstAdmin") : undefined;
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
						{none ? (
							<Stack gap={24}>
								<Text as="p" variant="title">
									{title}
								</Text>
								<Text as="p">{t("login.setUpAuth", { file: "monti.config.ts" })}</Text>
							</Stack>
						) : (
							<Stack gap={24}>
								{title !== undefined ? (
									<Text as="p" variant="title">
										{title}
									</Text>
								) : null}
								{closed ? (
									<Closed onSignIn={() => setClosed(false)} />
								) : first ? (
									<FirstAdmin
										onMade={onSignedIn}
										onClosed={() => {
											setAdminMade(true);
											setClosed(true);
										}}
									/>
								) : (
									<SignIn state={state} denied={denied} onSignedIn={onSignedIn} />
								)}
							</Stack>
						)}
					</Stack>
				</Box>
			</Stack>
			<Text as="p" variant="micro" tone="faint" align="center">
				Monti {VERSION}
			</Text>
		</Stack>
	);
}

/** The icon of a sign-in at another site, by its id; one with no icon here is a button with its name alone. */
const EXTERNAL_ICON: Record<string, ReactNode> = { github: <LogoGithub aria-hidden /> };

/**
 * The sign-in form (doc 15): the email and password when that way is on, then a button for each sign-in at another site that `auth.state` lists
 * (the screen knows none of them by name). Such a button sends the browser there and back.
 */
function SignIn({ state, denied, onSignedIn }: { state: AuthState; denied?: string; onSignedIn: () => void }) {
	const { t, apiBase } = useAdmin();
	const signIn = useOperation("auth.signIn");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const key = signIn.refusal?.reason?.key;
	const locked = key === "auth.locked";
	// The lock lasts a minute; then the button works again.
	useEffect(() => {
		if (!locked) return;
		const timer = setTimeout(signIn.clear, 60_000);
		return () => clearTimeout(timer);
	}, [locked, signIn.clear]);
	const passwordError = key === "auth.locked" || key === "auth.wrong" ? t(key) : undefined;
	// "Wrong" is about what was sent: typed over, the line goes. A lock is about the minute, and stays.
	const retyped = () => {
		if (key === "auth.wrong") signIn.clear();
	};
	const other = signIn.refusal !== null && passwordError === undefined;
	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if ((await signIn.run({ email, password })).ok) onSignedIn();
	};
	const withPassword = state.methods.password;
	return (
		<Stack gap={12}>
			<Stack gap={20}>
				{withPassword ? (
					<form onSubmit={submit}>
						<Stack gap={12}>
							<Stack gap={FIELD_GAP}>
								<FormField>
									<FormFieldLabel htmlFor="email">{t("login.email")}</FormFieldLabel>
									<Input
										id="email"
										type="email"
										autoComplete="username"
										value={email}
										onChange={(event) => {
											setEmail(event.target.value);
											retyped();
										}}
									/>
									<FormFieldError reserve />
								</FormField>
								<FormField>
									<FormFieldLabel htmlFor="password">{t("login.password")}</FormFieldLabel>
									<SecretInput
										kind="password"
										showLabel={t("login.showPassword")}
										hideLabel={t("login.hidePassword")}
										id="password"
										autoComplete="current-password"
										value={password}
										onChange={(event) => {
											setPassword(event.target.value);
											retyped();
										}}
										aria-invalid={passwordError ? true : undefined}
									/>
									<FormFieldError reserve>{passwordError}</FormFieldError>
								</FormField>
							</Stack>
							<Button type="submit" variant="primary" width="full" disabled={locked} loading={signIn.pending}>
								{signIn.pending ? t("login.signingIn") : t("login.signIn")}
							</Button>
						</Stack>
					</form>
				) : null}
				{withPassword && state.methods.external.length > 0 ? <Separator label={t("login.or")} /> : null}
				{state.methods.external.map((method, index) => {
					const variant = withPassword || index > 0 ? "secondary" : "primary";
					const label = (
						<>
							{EXTERNAL_ICON[method.id]}
							{t("login.with", { label: method.label })}
						</>
					);
					return (
						// A plain form: the browser goes to the other site and comes back to the admin (doc 15). After a refused account the site would
						// hand the same one back, so the next try asks it for its account picker.
						<form key={method.id} method="get" action={`${apiBase}/${method.path}`}>
							{denied ? <input type="hidden" name="pick" value="1" /> : null}
							<Button variant={variant} width="full" pendingLabel={t("login.signingIn")}>
								{label}
							</Button>
						</form>
					);
				})}
			</Stack>
			{other || withPassword ? <FormFieldError reserve>{other ? t("login.failed") : undefined}</FormFieldError> : null}
			{denied ? <FormFieldError>{t("login.denied", { login: denied })}</FormFieldError> : null}
		</Stack>
	);
}

function FirstAdmin({ onMade, onClosed }: { onMade: () => void; onClosed: () => void }) {
	const { t } = useAdmin();
	const create = useOperation("auth.createFirstAdmin");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [shown, setShown] = useState<{ email?: string; password?: string; confirm?: string; form?: string }>({});
	/** A field's line is about the value that was sent: typed over, it goes (its place stays, `reserve`). */
	const retyped = (field: "email" | "password" | "confirm") =>
		// "The passwords differ" stands under the second and is about both.
		setShown(({ [field]: _gone, ...rest }) => (field === "password" ? { ...rest, confirm: undefined } : rest));
	const submit = async (event: FormEvent) => {
		event.preventDefault();
		// Both rules show at once, before anything is sent; the server checks them again.
		const errors = {
			password: password.length < MIN_PASSWORD ? t("auth.passwordShort", { min: MIN_PASSWORD }) : undefined,
			confirm: confirm !== password ? t("auth.passwordsDiffer") : undefined,
		};
		setShown(errors);
		if (errors.password || errors.confirm) return;
		const result = await create.run({ email, password, confirm });
		if (result.ok) return onMade();
		// The server's refusal goes on the line of the field it is about; what no field explains goes under the button.
		const key = result.refusal.reason?.key;
		if (key === "auth.adminExists") onClosed();
		else if (result.refusal.error === "invalid-input") setShown({ email: t("login.badEmail") });
		else if (key === "auth.passwordShort") setShown({ password: t(key, { min: MIN_PASSWORD }) });
		else if (key === "auth.passwordsDiffer") setShown({ confirm: t(key) });
		else setShown({ form: t("login.createFailed") });
	};
	return (
		<form onSubmit={submit}>
			<Stack gap={12}>
				<Stack gap={12}>
					<Stack gap={FIELD_GAP}>
						<FormField>
							<FormFieldLabel htmlFor="email">{t("login.email")}</FormFieldLabel>
							<Input
								id="email"
								type="email"
								autoComplete="username"
								value={email}
								onChange={(event) => {
									setEmail(event.target.value);
									retyped("email");
								}}
								aria-invalid={shown.email ? true : undefined}
							/>
							<FormFieldError reserve>{shown.email}</FormFieldError>
						</FormField>
						<FormField>
							<FormFieldLabel htmlFor="password">{t("login.password")}</FormFieldLabel>
							<SecretInput
								kind="password"
								showLabel={t("login.showPassword")}
								hideLabel={t("login.hidePassword")}
								id="password"
								autoComplete="new-password"
								value={password}
								onChange={(event) => {
									setPassword(event.target.value);
									retyped("password");
								}}
								aria-invalid={shown.password ? true : undefined}
							/>
							<FormFieldError reserve hint={t("login.passwordHint", { min: MIN_PASSWORD })}>
								{shown.password}
							</FormFieldError>
						</FormField>
						<FormField>
							<FormFieldLabel htmlFor="confirm">{t("login.confirm")}</FormFieldLabel>
							<SecretInput
								kind="password"
								showLabel={t("login.showPassword")}
								hideLabel={t("login.hidePassword")}
								id="confirm"
								autoComplete="new-password"
								value={confirm}
								onChange={(event) => {
									setConfirm(event.target.value);
									retyped("confirm");
								}}
								aria-invalid={shown.confirm ? true : undefined}
							/>
							<FormFieldError reserve>{shown.confirm}</FormFieldError>
						</FormField>
					</Stack>
					<Button type="submit" variant="primary" width="full" loading={create.pending}>
						{create.pending ? t("login.creating") : t("login.create")}
					</Button>
				</Stack>
				<FormFieldError reserve>{shown.form}</FormFieldError>
			</Stack>
		</form>
	);
}

function Closed({ onSignIn }: { onSignIn: () => void }) {
	const { t } = useAdmin();
	return (
		<Stack gap={16} paddingTop={16}>
			<Text as="p">{t("auth.adminExists")}</Text>
			<Button type="button" variant="primary" width="full" onClick={onSignIn}>
				{t("login.goSignIn")}
			</Button>
		</Stack>
	);
}

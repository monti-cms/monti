import type { TranslatorFor } from "../../translator";
import type { LoginMode } from "./login-view";
import type { loginMessages } from "./messages";

/**
 * What `login.spec.json` reads: the texts in the admin's language, the addresses the forms post to and which state the screen is in. The
 * spec decides how it looks; this decides only what it says and where it goes.
 */
export function loginState(
	t: TranslatorFor<typeof loginMessages>,
	{ siteName, version, mode }: { siteName: string; version?: string; mode: LoginMode },
): Record<string, unknown> {
	const text = {
		email: t("email"),
		password: t("password"),
		confirmPassword: t("confirmPassword"),
		signInSubmit: t("signInSubmit"),
		createFirstAdmin: t("createFirstAdmin"),
		or: t("or"),
		otherAccount: t("otherAccount"),
		goToSignIn: t("goToSignIn"),
		errorClosed: t("errorClosed"),
	};
	const base = {
		siteName,
		version: version ?? null,
		title: mode.kind === "first-admin" ? t("firstAdminTitle") : mode.kind === "no-login" ? t("noLoginTitle") : null,
		mode: mode.kind,
		text,
		errors: {},
		password: {},
		hasButtons: false,
		buttons: [],
		denied: null,
		locked: false,
	};
	switch (mode.kind) {
		case "sign-in": {
			const { passwordAction, buttons, error, locked = false, denied } = mode;
			return {
				...base,
				locked,
				password: { action: passwordAction ?? null },
				errors: {
					email: error === "email" ? t("errorEmail") : null,
					password: locked ? t("errorLocked") : error === "credentials" ? t("errorCredentials") : null,
					// What no field of this form explains (an OAuth sign-in that did not finish, an unknown reason) goes under the buttons.
					form:
						error !== undefined && !(passwordAction && (error === "credentials" || error === "email"))
							? t("errorOther")
							: null,
				},
				hasButtons: buttons.length > 0,
				// The one black pill is the password form's button, or the first method when there is no form.
				buttons: buttons.map((button, index) => ({
					id: button.id,
					label: t("signIn", { provider: button.name }),
					action: button.action,
					icon: button.icon ?? null,
					primary: !passwordAction && index === 0,
				})),
				denied: denied ? { text: t("notAdmin", { name: denied.name }), action: denied.signOutAction } : null,
			};
		}
		case "first-admin": {
			const { action, minPasswordLength, error } = mode;
			return {
				...base,
				first: {
					action,
					minLength: minPasswordLength,
					passwordHint: t("passwordHint", { min: minPasswordLength }),
				},
				errors: {
					email: error === "email" ? t("errorEmail") : null,
					password: error === "password" ? t("errorPassword", { min: minPasswordLength }) : null,
					confirm: error === "confirm" ? t("errorConfirm") : null,
					form: error === "other" || error === "credentials" ? t("errorOther") : null,
				},
			};
		}
		case "closed":
			return { ...base, closed: { href: mode.signInHref } };
		case "no-login":
			return base;
	}
}

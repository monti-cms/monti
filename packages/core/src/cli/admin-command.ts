import type { LoginAccountRefusal } from "../server/define";
import { type AppOptions, loadApp } from "./app";
import { InitCancelled } from "./init-prompts";

/** What `monti admin:reset-password` asks the person at the terminal. The prompt library sits behind it, so the command is tested with scripted answers. */
export interface AdminPrompts {
	text(message: string): Promise<string>;
	/** A secret: not echoed. */
	password(message: string): Promise<string>;
}

export interface ResetPasswordOptions extends AppOptions {
	/** The admin's email (`--email`). Asked when not given. */
	readonly email?: string;
	/** Default: the terminal, when there is one. */
	readonly prompts?: AdminPrompts;
	readonly error?: (message: string) => void;
}

const REFUSALS: Record<LoginAccountRefusal, (min: number) => string> = {
	unknown: () =>
		"no admin account has that email. Check the spelling; accounts are created on the admin's first-admin screen.",
	email: () => "that is not an email address.",
	password: (min) => `the password needs at least ${min} characters.`,
	closed: () => "the accounts are closed.",
};

/** The prompts for a person at the terminal, on `@clack/prompts` (loaded here, so nothing else loads it). */
export async function createTerminalAdminPrompts(): Promise<AdminPrompts> {
	if (!(process.stdin.isTTY && process.stdout.isTTY)) {
		throw new Error(
			"`monti admin:reset-password` asks for the new password, so it needs a terminal. Run it in one (use --email to skip the first question).",
		);
	}
	const clack = await import("@clack/prompts");
	const answer = <T>(value: T | symbol): T => {
		if (clack.isCancel(value)) throw new InitCancelled();
		return value as T;
	};
	return {
		text: async (message) => answer<string>(await clack.text({ message })),
		password: async (message) => answer<string>(await clack.password({ message })),
	};
}

/**
 * `monti admin:reset-password [--email <email>]`: sets a new password for an admin of the built-in email and password login. It asks for the email (unless given) and for
 * the new password twice, and writes straight to the database of the app: there is no mail, so this is how a forgotten password is replaced. Returns the exit code.
 */
export async function adminResetPassword(options: ResetPasswordOptions): Promise<number> {
	const log = options.log ?? console.log;
	const error = options.error ?? console.error;
	const cms = await loadApp(options);
	try {
		const accounts = cms.auth().accounts;
		if (!accounts) {
			error(
				"This site's login keeps no accounts of its own, so there is no password to reset. `monti admin:reset-password` is for the email and password login: `auth({ providers: [password()] })`.",
			);
			return 1;
		}
		const prompts = options.prompts ?? (await createTerminalAdminPrompts());
		const email = (options.email ?? (await prompts.text("Email of the admin"))).trim();
		const password = await prompts.password(`New password (at least ${accounts.minPasswordLength} characters)`);
		if (password !== (await prompts.password("Repeat the new password"))) {
			error("The two passwords are not the same. Nothing was changed.");
			return 1;
		}
		const result = await accounts.resetPassword({ email, password });
		if (!result.ok) {
			error(`Nothing was changed: ${REFUSALS[result.reason](accounts.minPasswordLength)}`);
			return 1;
		}
		log(`Password changed for ${email}. Sessions that are already signed in stay valid until they expire (8 hours).`);
		return 0;
	} finally {
		await cms.close();
	}
}

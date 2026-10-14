import { loadApp } from "./app.js";
import { appOptionsOf, defineCommand } from "./command.js";
import { createClackPrompter, isInteractive } from "./prompt.js";
const REFUSALS = {
    unknown: () => "no admin account has that email. Check the spelling; accounts are created on the admin's first-admin screen.",
    email: () => "that is not an email address.",
    password: (min) => `the password needs at least ${min} characters.`,
    closed: () => "the accounts are closed.",
};
/** The prompter for a person at the terminal. The command asks for a password, so without a terminal it cannot run. */
async function terminalPrompter() {
    if (!isInteractive()) {
        throw new Error("`monti admin:reset-password` asks for the new password, so it needs a terminal. Run it in one (use --email to skip the first question).");
    }
    return createClackPrompter();
}
/**
 * `monti admin:reset-password [--email <email>]`: sets a new password for an admin of the built-in email and password login. It asks for the email (unless given) and for
 * the new password twice, and writes straight to the database of the app: there is no mail, so this is how a forgotten password is replaced. Returns the exit code.
 */
export async function adminResetPassword(options) {
    const { log, error } = options;
    const cms = await loadApp(options);
    try {
        const accounts = cms.auth().accounts;
        if (!accounts) {
            error("This site's login keeps no accounts of its own, so there is no password to reset. `monti admin:reset-password` is for the email and password login: `auth({ providers: [password()] })`.");
            return 1;
        }
        const prompts = options.prompter ?? (await terminalPrompter());
        const email = (options.email ?? (await prompts.text({ message: "Email of the admin" }))).trim();
        const password = await prompts.password({
            message: `New password (at least ${accounts.minPasswordLength} characters)`,
        });
        if (password !== (await prompts.password({ message: "Repeat the new password" }))) {
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
    }
    finally {
        await cms.close();
    }
}
export const adminResetPasswordCommand = defineCommand({
    name: "admin:reset-password",
    summary: `Set a new password for an admin of the email and password login (auth({ providers: [password()] })). It asks for the new password twice
and writes it straight to the database of monti.config.ts; there is no mail, so this is the way to replace a forgotten password. The first admin is
created on the admin's own screen, not here.`,
    options: { email: { type: "string", value: "<email>", help: "The admin's email (asked when left out)" } },
    app: true,
    run: (context) => adminResetPassword({
        ...appOptionsOf(context),
        email: context.values.email,
        prompter: context.prompter,
    }),
});

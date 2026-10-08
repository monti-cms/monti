import { type AppOptions } from "./app.js";
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
/** The prompts for a person at the terminal, on `@clack/prompts` (loaded here, so nothing else loads it). */
export declare function createTerminalAdminPrompts(): Promise<AdminPrompts>;
/**
 * `monti admin:reset-password [--email <email>]`: sets a new password for an admin of the built-in email and password login. It asks for the email (unless given) and for
 * the new password twice, and writes straight to the database of the app: there is no mail, so this is how a forgotten password is replaced. Returns the exit code.
 */
export declare function adminResetPassword(options: ResetPasswordOptions): Promise<number>;

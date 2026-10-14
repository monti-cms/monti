import { type AppOptions } from "./app.js";
import { type Prompter } from "./prompt.js";
export interface ResetPasswordOptions extends AppOptions {
    /** The admin's email (`--email`). Asked when not given. */
    readonly email?: string;
    /** Default: the terminal, when there is one. */
    readonly prompter?: Pick<Prompter, "text" | "password">;
}
/**
 * `monti admin:reset-password [--email <email>]`: sets a new password for an admin of the built-in email and password login. It asks for the email (unless given) and for
 * the new password twice, and writes straight to the database of the app: there is no mail, so this is how a forgotten password is replaced. Returns the exit code.
 */
export declare function adminResetPassword(options: ResetPasswordOptions): Promise<number>;
export declare const adminResetPasswordCommand: import("./command.js").Command;

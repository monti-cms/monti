/**
 * What a `monti doctor` check reports. A check says what it found, where (a file, an environment variable or an option), and for a warn or a fail how to fix
 * it, in plain words. It never changes anything, and it never prints a secret.
 */
/** Everything is as it should be. */
export const ok = (message, details = {}) => ({
    status: "ok",
    message,
    ...details,
});
/** Works, but something should change. Say how in `fix`. */
export const warn = (message, details = {}) => ({ status: "warn", message, ...details });
/** Broken: the app (or a feature) will not work. Say how to fix it in `fix`. */
export const fail = (message, details = {}) => ({ status: "fail", message, ...details });
/** Could not be checked, because an earlier problem blocks it. Not a failure: say what blocks it. */
export const skip = (message) => ({ status: "skip", message });

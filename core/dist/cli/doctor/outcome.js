/** A warn or a fail that tells a {@link Problem} an error already carries (a `SetupError`'s `problem`). */
export const fromProblem = (status, problem) => ({
    status,
    message: problem.what,
    ...(problem.where ? { where: problem.where } : {}),
    fix: problem.fix,
});
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

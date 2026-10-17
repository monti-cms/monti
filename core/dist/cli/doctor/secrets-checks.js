import { WHERE_TO_SET_ENV } from "../../core/env.js";
import { fail, ok, warn } from "./outcome.js";
import { whereSet } from "./types.js";
/** The `secrets` group of `monti doctor`: MONTI_SECRET. */
const WEAK_SECRETS = /^(secret|password|changeme|change-me|test|example|your[-_ ]?secret|xxx+|0+|1234)/i;
const montiSecret = {
    group: "secrets",
    id: "monti-secret",
    title: "MONTI_SECRET",
    run: (state) => {
        const value = state.env.MONTI_SECRET?.trim();
        const available = state.cms ? state.cms.plugin("doctor").secrets.available : Boolean(value);
        if (!available) {
            return fail("MONTI_SECRET is not set, so login sessions cannot be signed and no key or token can be stored", {
                where: WHERE_TO_SET_ENV,
                fix: "generate one with `openssl rand -base64 32` and put it in MONTI_SECRET. Use the same value wherever the site runs, and keep it: values encrypted with it (AI keys, git-sync tokens) cannot be read without it",
            });
        }
        if (!value)
            return ok("set by the `secret` option of monti.config.ts (its strength is not checked)");
        const distinct = new Set(value).size;
        if (value.length < 32 || distinct < 8 || WEAK_SECRETS.test(value)) {
            return warn(`MONTI_SECRET is easy to guess (${value.length} characters, ${distinct} different)`, {
                where: whereSet(state, "MONTI_SECRET"),
                fix: "use a long random value: `openssl rand -base64 32`. Changing it signs everyone out once; to keep stored AI keys and tokens readable, move the old value to `previousSecrets` in monti.config.ts",
            });
        }
        return ok(`set (${value.length} characters)`, { where: whereSet(state, "MONTI_SECRET") });
    },
};
/** The checks of the `secrets` group. */
export const SECRETS_CHECKS = [montiSecret];

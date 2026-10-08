import { problemText } from "@monti-cms/core";
import { splitAccountId } from "./provider.js";
/**
 * The admin ids of every provider, as canonical ids inside each provider: the ones listed on a provider (`github({ admins })`, `MONTI_ADMIN_GITHUB_ID`) and the
 * qualified ones of `auth({ admins })`. Throws when an entry is listed under the wrong provider or is not qualified.
 */
export function collectAdmins(options) {
    const sets = new Map(options.providers.map((provider) => [provider.id, new Set()]));
    const ignored = [];
    const add = (provider, entry) => {
        const raw = entry?.trim();
        if (!raw)
            return;
        const normalized = (provider.normalizeId ?? ((id) => id.trim() || null))(raw);
        if (normalized === null) {
            ignored.push({ provider, entry: raw });
            return;
        }
        sets.get(provider.id)?.add(normalized);
    };
    for (const provider of options.providers) {
        for (const entry of provider.admins ?? []) {
            const prefixed = entry ? splitAccountId(entry.trim(), options.providers) : null;
            if (prefixed && prefixed.providerId !== provider.id) {
                throw new Error(`[cms-auth] ${problemText({
                    what: `The admin "${entry}" is listed on the ${provider.id} provider but belongs to ${prefixed.providerId}`,
                    where: `the admins of the ${provider.id} provider`,
                    fix: `move it to the ${prefixed.providerId} provider, or to \`admins\` of auth() as written (\`${entry}\`)`,
                })}`);
            }
            add(provider, prefixed ? prefixed.id : entry);
        }
    }
    for (const entry of options.admins ?? []) {
        if (!entry?.trim())
            continue;
        const split = splitAccountId(entry.trim(), options.providers);
        if (!split) {
            const known = options.providers.map((provider) => `${provider.id}:<id>`).join(", ");
            throw new Error(`[cms-auth] ${problemText({
                what: `The admin "${entry}" must be a qualified account id (${known})`,
                where: "`admins` of auth() in monti.config.ts",
                fix: `write it with its provider in front, for example \`${options.providers[0]?.id ?? "github"}:12345678\`, or list the bare id on the provider itself`,
            })}`);
        }
        const provider = options.providers.find((candidate) => candidate.id === split.providerId);
        if (provider)
            add(provider, split.id);
    }
    return { sets, ignored };
}
/** The message for an admin entry that was left out. */
export const ignoredAdminText = ({ provider, entry }) => problemText({
    what: `Ignored the admin "${entry}": it is not an account id of ${provider.name}`,
    where: provider.adminSource?.env ?? `the admins of the ${provider.id} provider`,
    fix: provider.adminSource?.findId
        ? `use the account's id, not its name: ${provider.adminSource.findId}`
        : `use the account id the ${provider.name} login gives`,
});

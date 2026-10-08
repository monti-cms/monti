import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { problemText } from "../core/problem.js";
import { CmsError } from "../core/store/index.js";
/**
 * Per-plugin secrets. A plugin never sees the master secret (`secret` in the server config). The CMS instance derives one key per plugin from it
 * (HKDF-SHA256, the plugin name in the `info` string) and hands the plugin this small API, so a plugin cannot decrypt another plugin's values,
 * and a value taken from one plugin's table says nothing about the master secret.
 */
const SALT = "monti:secrets";
/** Version of the derivation. It is part of the `info` string, so a future change of the scheme gets its own `v2` keys beside these. */
const INFO_VERSION = "v1";
/** Prefix of an encrypted value. `mk1` = format 1 of the key-versioned value: `mk1:<key id>:<iv>:<tag>:<body>` (base64 parts). */
const PREFIX = "mk1";
const PLUGIN_NAME = /^[a-z][a-z0-9-]*$/;
const KEY_BYTES = 32;
const unavailable = () => new CmsError(problemText({
    what: "MONTI_SECRET is not set, so values (AI keys, tokens) cannot be encrypted",
    where: ".env.local (and the environment settings of your host), or `secret` in defineConfig",
    fix: "set it to a long random value (`openssl rand -base64 32`) and restart the server; `monti doctor` checks it",
}), "secret_not_configured");
const hkdf = (key, info) => Buffer.from(hkdfSync("sha256", key, SALT, info, KEY_BYTES));
const pluginInfo = (plugin) => `monti:plugin:${plugin}:${INFO_VERSION}`;
function pluginKey(secret, plugin) {
    const info = pluginInfo(plugin);
    return { id: hkdf(secret, `${info}:id`).subarray(0, 6).toString("base64url"), key: hkdf(secret, info) };
}
function open(key, iv, tag, body) {
    try {
        const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
        decipher.setAuthTag(Buffer.from(tag, "base64"));
        return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
    }
    catch {
        return null;
    }
}
/**
 * The master secrets of an instance: the current one (`secret`) and the ones it replaced (`previousSecrets`). Hands out the secrets API of one plugin.
 * Only the CMS instance holds this; a plugin gets {@link PluginSecrets}.
 */
export function createSecretsVault(master) {
    const current = master.secret || undefined;
    const previous = [...new Set(master.previousSecrets ?? [])].filter((secret) => secret && secret !== current);
    return {
        forPlugin(plugin, options = {}) {
            if (!PLUGIN_NAME.test(plugin))
                throw new Error(`cms secrets: invalid plugin name "${plugin}"`);
            const now = current ? pluginKey(current, plugin) : undefined;
            const before = previous.map((secret) => pluginKey(secret, plugin));
            const { legacy } = options;
            const decryptLegacy = (stored) => {
                if (!legacy)
                    return null;
                const [prefix, iv, tag, body] = stored.split(":");
                if (prefix !== legacy.prefix || !iv || !tag || !body)
                    return null;
                for (const secret of [current, ...previous]) {
                    if (!secret)
                        continue;
                    const plain = open(createHash("sha256").update(`${legacy.domain}${secret}`).digest(), iv, tag, body);
                    if (plain !== null)
                        return plain;
                }
                return null;
            };
            return {
                available: Boolean(now),
                encrypt(plain) {
                    if (!now)
                        throw unavailable();
                    const iv = randomBytes(12);
                    const cipher = createCipheriv("aes-256-gcm", now.key, iv);
                    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
                    return [
                        PREFIX,
                        now.id,
                        iv.toString("base64"),
                        cipher.getAuthTag().toString("base64"),
                        body.toString("base64"),
                    ].join(":");
                },
                decrypt(stored) {
                    const [prefix, id, iv, tag, body] = stored.split(":");
                    if (prefix !== PREFIX)
                        return decryptLegacy(stored);
                    if (!id || !iv || !tag || !body)
                        return null;
                    const found = [now, ...before].find((candidate) => candidate?.id === id);
                    return found ? open(found.key, iv, tag, body) : null;
                },
                isCurrent: (stored) => Boolean(now) && stored.startsWith(`${PREFIX}:${now?.id}:`),
                deriveKey(purpose) {
                    if (!now)
                        throw unavailable();
                    if (!purpose)
                        throw new Error("cms secrets: deriveKey needs a purpose");
                    return hkdf(now.key, `${pluginInfo(plugin)}:purpose:${purpose}`);
                },
            };
        },
    };
}

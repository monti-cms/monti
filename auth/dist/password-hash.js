import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
/*
 * Password hashing with scrypt from `node:crypto`: no hashing dependency. A hash is stored as one text, `scrypt$<N>$<r>$<p>$<salt>$<key>` (salt and key in
 * base64url), so the cost it was made with travels with it and can be raised later without breaking old hashes.
 */
const COST = { N: 2 ** 14, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const derive = (password, salt, cost) => new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { ...cost, maxmem: 128 * cost.N * cost.r * 2 }, (error, key) => (error ? reject(error) : resolve(key)));
});
/** Hashes a password with a new random salt. */
export async function hashPassword(password) {
    const salt = randomBytes(SALT_LENGTH);
    const key = await derive(password, salt, COST);
    return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}
/** Whether `password` is the one `stored` was made from. Compared in constant time; a stored value that is not a hash of ours is never a match. */
export async function verifyPassword(password, stored) {
    const [scheme, n, r, p, salt, key] = stored.split("$");
    if (scheme !== "scrypt" || !n || !r || !p || !salt || !key)
        return false;
    const cost = { N: Number(n), r: Number(r), p: Number(p) };
    if (![cost.N, cost.r, cost.p].every((value) => Number.isInteger(value) && value > 0))
        return false;
    const expected = Buffer.from(key, "base64url");
    const actual = await derive(password, Buffer.from(salt, "base64url"), cost);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export declare function encryptSecret(plain: string): string;
/** `null` if it cannot be decrypted (`secret` changed or the value is corrupted). */
export declare function decryptSecret(stored: string): string | null;
/** The last four characters of the key, shown on screen. */
export declare const keyHint: (plain: string | null) => string | null;

/** Hashes a password with a new random salt. */
export declare function hashPassword(password: string): Promise<string>;
/** Whether `password` is the one `stored` was made from. Compared in constant time; a stored value that is not a hash of ours is never a match. */
export declare function verifyPassword(password: string, stored: string): Promise<boolean>;

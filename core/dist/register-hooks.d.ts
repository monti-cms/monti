/** Alias files passed at registration (`register(url, { data: { aliases } })`). */
export declare const initialize: (data?: {
    aliases?: Readonly<Record<string, string>>;
}) => void;
type Resolve = (specifier: string, context: unknown, next: (specifier: string, context: unknown) => Promise<unknown>) => Promise<unknown>;
export declare const resolve: Resolve;
export {};

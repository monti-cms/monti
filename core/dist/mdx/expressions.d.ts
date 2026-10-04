import type { CmsJsonValue } from "./types.js";
export declare const isStaticEstree: (node: unknown) => boolean;
export declare const estreeToJson: (node: unknown) => CmsJsonValue;
export declare const programExpression: (estree: unknown) => unknown;
export declare const isCallExpression: (node: unknown) => boolean;
export declare const isIdentifierExpression: (node: unknown) => boolean;
export declare const hasSpread: (node: unknown) => boolean;

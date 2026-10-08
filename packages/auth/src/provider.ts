import type { PluginStorage } from "@monti-cms/core";

/*
 * The types below describe what the Auth.js provider objects and sign-in results look like, as small structural types of our own. The published
 * declarations then do not import `@auth/core` (whose own declaration files do not pass a strict `skipLibCheck: false` check), and a provider
 * package passes the result of any `@auth/core/providers/*` function straight in.
 */

/** An Auth.js provider config (OAuth, OIDC or credentials): what `GitHub({ ... })` or `Credentials({ ... })` of `@auth/core/providers/*` returns. */
export interface AuthJsProvider {
	readonly id: string;
	readonly type: string;
}

/** The user Auth.js knows after a sign-in (what the provider's `profile()` or `authorize()` returned). */
export interface SignedInUser {
	readonly id?: string | undefined;
	readonly name?: string | null | undefined;
	readonly email?: string | null | undefined;
	readonly image?: string | null | undefined;
}

/** The provider account record of a sign-in. */
export interface SignedInProviderAccount {
	/** The `id` of the provider config. */
	readonly provider: string;
	/** The id the provider's `profile()` or `authorize()` returned. */
	readonly providerAccountId: string;
	readonly type: string;
}

/** What a login provider can use when it is set up (once, when the login connection is created). */
export interface LoginProviderContext {
	/** Storage of a plugin (`cms.storage(plugin)`). A provider that keeps its own users, like a password login, keeps them here. */
	readonly storage: (plugin: string) => PluginStorage;
	/** Whether the request host may be trusted (the config's `trustHost`, `AUTH_TRUST_HOST`, or a detected proxy platform). */
	readonly trustHost: boolean;
}

/** The account a provider's sign-in resolved to. Qualified with the provider id (`github:123`) before it leaves this package. */
export interface LoginAccount {
	/** The id inside the provider (the numeric GitHub id, a user key in plugin storage). Must not change for a person. */
	readonly id: string;
	/** Name to show and to record as the author of a change. */
	readonly name?: string;
}

/** What Auth.js knew at the end of a sign-in, for {@link LoginProvider.account}. */
export interface SignedInAccount {
	/**
	 * The user the provider's Auth.js config returned (`profile()` of an OAuth provider, `authorize()` of a credentials one). Without a database adapter,
	 * Auth.js replaces `user.id` with a random value, so take the id from `account.providerAccountId` instead: it is the `id` the provider's own
	 * `profile()` or `authorize()` returned, and it does not change between sign-ins.
	 */
	readonly user: SignedInUser;
	readonly account: SignedInProviderAccount;
	/** The profile as the OAuth provider sent it. Not set for a credentials provider. */
	readonly profile?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * One way to log in. `github()` is the shipped one; another package adds a method by returning one of these:
 * an OAuth provider (GitLab, Google) is the Auth.js provider plus a few labels, a password provider is a credentials provider whose `authorize`
 * reads its users from `context.storage(plugin)`. Nothing here changes in core for either.
 */
export interface LoginProvider {
	/**
	 * Stable id. It is the `/callback/<id>` of the OAuth app, the name in `signIn(id)` and the prefix of the account ids that admins are matched on
	 * (`github:123`). Lower case letters, digits and `-`.
	 */
	readonly id: string;
	/** Display name (`GitHub`), used in permission messages and on the login page. */
	readonly name: string;
	/** Button text per language, `en` required (`{ en: "Sign in with GitHub" }`). A site overrides it with `admin.messages["cms.auth"]["<id>.label"]`. */
	readonly label: { readonly en: string } & Readonly<Record<string, string>>;
	/** Icon of the button: an image address (an `https:` or `data:` URL). */
	readonly icon?: string;
	/** Admins of this provider: ids inside the provider (`"123"`) or qualified (`"github:123"`). Unset entries (an unset environment variable) are skipped. */
	readonly admins?: readonly (string | undefined)[];
	/**
	 * Where the admins of this provider come from: the environment variable they are read from, and how a person finds their id.
	 * Used in the messages about an admin list that is empty or has an entry that is not an id.
	 */
	readonly adminSource?: { readonly env: string; readonly findId: string };
	/** Where this provider's settings come from, for `monti doctor` (`client id from env AUTH_GITHUB_ID, ...`). */
	provenance?(env: Readonly<Record<string, string | undefined>>): string;
	/** `true` for an OAuth-style provider: the app registered at the provider must list the callback URL (`<site>/api/cms/auth/callback/<id>`), which `monti doctor` prints. */
	readonly usesCallbackUrl?: boolean;
	/**
	 * Throws a clear error that names the missing setting (an unset `AUTH_GITHUB_ID`). Called when the login connection is created in a server that
	 * requires login, and before any sign-in is attempted, so a development server running on the dev bypass does not need the provider set up.
	 */
	requireConfigured?(): void;
	/** The Auth.js provider config. Called once when the login connection is created. */
	setup(context: LoginProviderContext): AuthJsProvider;
	/** Turns the account of a finished sign-in into the Monti account. Returning `null` refuses the sign-in. */
	account(signedIn: SignedInAccount): LoginAccount | null;
	/**
	 * The canonical form of an id for comparison, or `null` if it can never be an account of this provider (so it is never an admin).
	 * Default: trimmed, and empty is `null`. GitHub compares numeric ids without leading zeros.
	 */
	normalizeId?(id: string): string | null;
}

/** Splits `github:123` into the provider id and the id inside it. A value without a known provider prefix has no provider. */
export const splitAccountId = (accountId: string, providers: readonly Pick<LoginProvider, "id">[]) => {
	const index = accountId.indexOf(":");
	if (index <= 0) return null;
	const providerId = accountId.slice(0, index);
	if (!providers.some((provider) => provider.id === providerId)) return null;
	return { providerId, id: accountId.slice(index + 1) };
};

/** The qualified account id (`github:123`). */
export const qualifyAccountId = (provider: Pick<LoginProvider, "id">, id: string): string => `${provider.id}:${id}`;

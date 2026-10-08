/** Splits `github:123` into the provider id and the id inside it. A value without a known provider prefix has no provider. */
export const splitAccountId = (accountId, providers) => {
    const index = accountId.indexOf(":");
    if (index <= 0)
        return null;
    const providerId = accountId.slice(0, index);
    if (!providers.some((provider) => provider.id === providerId))
        return null;
    return { providerId, id: accountId.slice(index + 1) };
};
/** The qualified account id (`github:123`). */
export const qualifyAccountId = (provider, id) => `${provider.id}:${id}`;

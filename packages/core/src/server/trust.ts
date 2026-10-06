import { resolveTrustHost } from "../adapters/auth/trust-host";
import type { CmsServerConfig } from "./define";
import { cmsServerConfig } from "./resolved";

/**
 * Whether `Host` and `X-Forwarded-Host` can be trusted: `trustHost` in the server config, else the `AUTH_TRUST_HOST` environment variable,
 * else only outside production. Kept apart from `container.ts` so request checks do not pull in the connection container.
 */
export const isCmsHostTrusted = (): boolean =>
	resolveTrustHost((cmsServerConfig as Pick<CmsServerConfig, "trustHost">).trustHost);

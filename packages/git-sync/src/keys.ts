import type { ApiKeyView } from "@monti-cms/core/client";
import type { Cms } from "@monti-cms/core/plugin/server";
import { GIT_SYNC_PLUGIN_NAME, GIT_SYNC_TOKEN_SLOT, GIT_SYNC_WEBHOOK_SLOT } from "./options";

/**
 * The plugin holds two secrets, both keys of the central API key store (`cms.apiKeys`) assigned to the plugin's key slots (`keySlots` in `index.ts`):
 * the GitHub `token` it calls GitHub with, and the `webhook-secret` the push webhook is signed with. The plugin reads each value from the store when it needs it;
 * neither is ever sent to the browser, which learns a key by its name and last four characters.
 */

/** A key of the store as the admin screen shows it. */
export type SlotKeyView = Pick<ApiKeyView, "id" | "name" | "tail" | "readable">;

/** What the admin screen learns about the two keys. */
export interface KeysView {
	/** Whether the server config has a `secret`: without one nothing can be saved. */
	readonly secretsAvailable: boolean;
	/** The key assigned to the token slot, or `null` when none is (or the key was deleted: that is the same as no token yet). */
	readonly token: SlotKeyView | null;
	readonly webhookSecret: SlotKeyView | null;
}

/** The key assigned to one of the plugin's slots, or `null` when none is. */
export async function slotKeyOf(cms: Cms, slot: string): Promise<SlotKeyView | null> {
	const slots = await cms.apiKeys.slots();
	return slots.find((entry) => entry.plugin === GIT_SYNC_PLUGIN_NAME && entry.slot === slot)?.key ?? null;
}

export const tokenKeyOf = (cms: Cms) => slotKeyOf(cms, GIT_SYNC_TOKEN_SLOT);

export async function keysView(cms: Cms): Promise<KeysView> {
	const [token, webhookSecret] = await Promise.all([tokenKeyOf(cms), slotKeyOf(cms, GIT_SYNC_WEBHOOK_SLOT)]);
	return { secretsAvailable: cms.apiKeys.available, token, webhookSecret };
}

/** The webhook secret, or `null` when none is assigned (or it cannot be read). */
export const readWebhookSecret = (cms: Cms): Promise<string | null> =>
	cms.apiKeys.slot(GIT_SYNC_PLUGIN_NAME, GIT_SYNC_WEBHOOK_SLOT).read();

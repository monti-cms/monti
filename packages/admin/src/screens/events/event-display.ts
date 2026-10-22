import type { Site } from "@monti-cms/core/site";
import type { EventDeliveryItem } from "../../api/events";
import type { StatusTone } from "../../ui/status-indicator";

export const STATE_TONE: Record<EventDeliveryItem["state"], StatusTone> = {
	delivered: "success",
	failed: "destructive",
	dead: "destructive",
	pending: "warning",
	delivering: "warning",
	dismissed: "neutral",
	recorded: "neutral",
};

/** What names the entry of an event: its title when the change was made, else its address, else the id (an entry may have no title). */
export const eventEntryLabel = (change: EventDeliveryItem["change"]): string =>
	change.title || change.workingSlug || change.publishedSlug || change.entryId;

/** The collection of an event as the site names it ("Post"); the key itself when the schema no longer has that collection. */
export const eventCollectionLabel = (
	site: Pick<Site, "isCollection" | "COLLECTION_DEFINITIONS">,
	collection: string,
): string => (site.isCollection(collection) ? site.COLLECTION_DEFINITIONS[collection].label : collection);

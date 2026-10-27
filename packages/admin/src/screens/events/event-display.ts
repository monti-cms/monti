import type { Site } from "@monti-cms/core/site";
import type { EntryStatusKind } from "@monti-cms/ui";
import type { EventDeliveryItem } from "../../api/events";

/** The status mark of a delivery state: arrived is a filled dot, on its way is orange, did not arrive is red, set aside is a bar, only recorded is a ring. */
export const STATE_STATUS: Record<EventDeliveryItem["state"], EntryStatusKind> = {
	delivered: "published",
	failed: "failed",
	dead: "failed",
	pending: "editing",
	delivering: "editing",
	dismissed: "archived",
	recorded: "draft",
};

/** What names the entry of an event: its title when the change was made, else its address, else the id (an entry may have no title). */
export const eventEntryLabel = (change: EventDeliveryItem["change"]): string =>
	change.title || change.workingSlug || change.publishedSlug || change.entryId;

/** The collection of an event as the site names it ("Post"); the key itself when the schema no longer has that collection. */
export const eventCollectionLabel = (
	site: Pick<Site, "isCollection" | "COLLECTION_DEFINITIONS">,
	collection: string,
): string => (site.isCollection(collection) ? site.COLLECTION_DEFINITIONS[collection].label : collection);

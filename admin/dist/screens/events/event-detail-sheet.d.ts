import type { EventDeliveryItem } from "../../api/events.js";
/**
 * Everything the log knows about one event: the entry it was made on, who made it and when, and how it went to each subscriber.
 * `deliveries` are the rows of the same event on the page (one per subscriber); `item` is the one that was opened.
 */
export declare function EventDetailSheet({ item, deliveries, onClose, }: {
    item: EventDeliveryItem | null;
    deliveries: readonly EventDeliveryItem[];
    onClose: () => void;
}): import("react").JSX.Element;

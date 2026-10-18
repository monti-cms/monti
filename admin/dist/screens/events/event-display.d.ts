import type { EventDeliveryItem } from "../../api/events.js";
import type { StatusTone } from "../../ui/status-indicator.js";
export declare const STATE_TONE: Record<EventDeliveryItem["state"], StatusTone>;
/** What names the entry of an event: its title when the change was made, else its address, else the id (an entry may have no title). */
export declare const eventEntryLabel: (change: EventDeliveryItem["change"]) => string;

import type { CollectionSchema } from "../../schema/collection.js";
import { type IssueList } from "./issue.js";
/** The collections of a config, checked against each other. `defineSite` runs it for every source. */
export declare function checkCollections(list: IssueList, collections: Readonly<Record<string, CollectionSchema>>): void;
/** One collection: its fields and their roles, its title, layout, public address, and the fields that point to other collections. */
export declare function checkCollection(list: IssueList, name: string, schema: CollectionSchema, collections: Readonly<Record<string, CollectionSchema>>): void;

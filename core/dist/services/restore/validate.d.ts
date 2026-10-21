import type { RestorePlan } from "../../core/store/types.js";
import type { Site } from "../../site/index.js";
import type { RestoreProblem } from "./types.js";
/**
 * Checks a backup against the site it is restored into, without writing anything, and lists every problem. The checks are the ones a normal write makes:
 * - every id is an id, and no id or address repeats;
 * - the collection and the language of each entry exist in the schema;
 * - the metadata and the document of each body pass the checks of a save (`prepareSnapshot`), and the published body of an entry that is published passes
 *   those of a publish (`validateForPublish`), against the targets, media and addresses the archive itself holds, because those are what the restored site will have;
 * - every folder, media record, translation source and reference target an entry names is in the archive.
 * The plugins' `beforeSave` and `beforePublish` subscribers do not run: a restore puts back what was already accepted.
 */
export declare function validateRestorePlan(site: Site, plan: RestorePlan): Promise<RestoreProblem[]>;

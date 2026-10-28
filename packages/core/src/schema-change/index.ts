export {
	type ApplyOptions,
	applySchemaChange,
	type PlanOptions,
	planSchemaChange,
	type SchemaApplyResult,
	SchemaChangeError,
	type SchemaPlan,
	snapshotSchema,
} from "./apply";
export {
	type ChangeImpact,
	type CheckOptions,
	type CollectionDropImpact,
	checkSchemaChange,
	dropBlockers,
	type ImpactConsequence,
	type ImpactSample,
	type SchemaImpact,
	scanAllBodies,
} from "./check";
export { describeSchemaChange, diffSchema } from "./diff";
export {
	applyTransforms,
	checkTransforms,
	droppedCollections,
	type SuggestedTransform,
	suggestTransforms,
	type TransformProblem,
	type TransformResult,
	transformCollections,
} from "./transforms";
export {
	type AllowedShape,
	changeKey,
	type DiffOptions,
	type FieldBranch,
	type RenameHint,
	type SchemaChange,
	type SchemaChangeKind,
	type SchemaDiff,
	type SchemaLike,
} from "./types";

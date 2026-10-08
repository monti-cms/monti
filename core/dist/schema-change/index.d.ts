export type { SchemaMigration } from "../schema-file/types.js";
export { type ApplyOptions, applySchemaChange, type PlanOptions, planSchemaChange, type SchemaApplyResult, SchemaChangeError, type SchemaPlan, schemaVersionOf, snapshotSchema, } from "./apply.js";
export { type ChangeImpact, type CheckOptions, checkSchemaChange, type ImpactConsequence, type ImpactSample, type SchemaImpact, scanAllBodies, } from "./check.js";
export { describeSchemaChange, diffSchema } from "./diff.js";
export { applyTransforms, checkTransforms, type SuggestedTransform, suggestTransforms, type TransformProblem, type TransformResult, transformCollections, } from "./transforms.js";
export { type AllowedShape, changeKey, type DiffOptions, type FieldBranch, type RenameHint, type SchemaChange, type SchemaChangeKind, type SchemaDiff, type SchemaLike, } from "./types.js";

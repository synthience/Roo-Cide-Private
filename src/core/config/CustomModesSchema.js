import { z } from "zod"
import { TOOL_GROUPS } from "../../shared/tool-groups"
// Create a schema for valid tool groups using the keys of TOOL_GROUPS
const ToolGroupSchema = z.enum(Object.keys(TOOL_GROUPS))
// Schema for array of groups
const GroupsArraySchema = z
	.array(ToolGroupSchema)
	.min(1, "At least one tool group is required")
	.refine(
		(groups) => {
			const seen = new Set()
			return groups.every((group) => {
				if (seen.has(group)) return false
				seen.add(group)
				return true
			})
		},
		{ message: "Duplicate groups are not allowed" },
	)
// Schema for mode configuration
export const CustomModeSchema = z.object({
	slug: z.string().regex(/^[a-zA-Z0-9-]+$/, "Slug must contain only letters numbers and dashes"),
	name: z.string().min(1, "Name is required"),
	roleDefinition: z.string().min(1, "Role definition is required"),
	customInstructions: z.string().optional(),
	groups: GroupsArraySchema,
})
// Schema for the entire custom modes settings file
export const CustomModesSettingsSchema = z.object({
	customModes: z.array(CustomModeSchema).refine(
		(modes) => {
			const slugs = new Set()
			return modes.every((mode) => {
				if (slugs.has(mode.slug)) {
					return false
				}
				slugs.add(mode.slug)
				return true
			})
		},
		{
			message: "Duplicate mode slugs are not allowed",
		},
	),
})
/**
 * Validates a custom mode configuration against the schema
 * @throws {z.ZodError} if validation fails
 */
export function validateCustomMode(mode) {
	CustomModeSchema.parse(mode)
}
//# sourceMappingURL=CustomModesSchema.js.map

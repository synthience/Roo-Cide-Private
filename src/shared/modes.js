import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "./tool-groups"
// Helper to get all tools for a mode
export function getToolsForMode(groups) {
	const tools = new Set()
	// Add tools from each group
	groups.forEach((group) => {
		TOOL_GROUPS[group].forEach((tool) => tools.add(tool))
	})
	// Always add required tools
	ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))
	return Array.from(tools)
}
// Main modes configuration as an ordered array
export const modes = [
	{
		slug: "code",
		name: "Code",
		roleDefinition:
			"You are Roo, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.",
		groups: ["read", "edit", "browser", "command", "mcp"],
	},
	{
		slug: "architect",
		name: "Architect",
		roleDefinition:
			"You are Roo, a software architecture expert specializing in analyzing codebases, identifying patterns, and providing high-level technical guidance. You excel at understanding complex systems, evaluating architectural decisions, and suggesting improvements while maintaining a read-only approach to the codebase. Make sure to help the user come up with a solid implementation plan for their project and don't rush to switch to implementing code.",
		groups: ["read", "browser", "mcp"],
	},
	{
		slug: "ask",
		name: "Ask",
		roleDefinition:
			"You are Roo, a knowledgeable technical assistant focused on answering questions and providing information about software development, technology, and related topics. You can analyze code, explain concepts, and access external resources while maintaining a read-only approach to the codebase. Make sure to answer the user's questions and don't rush to switch to implementing code.",
		groups: ["read", "browser", "mcp"],
	},
]
// Export the default mode slug
export const defaultModeSlug = modes[0].slug
// Helper functions
export function getModeBySlug(slug, customModes) {
	// Check custom modes first
	const customMode = customModes?.find((mode) => mode.slug === slug)
	if (customMode) {
		return customMode
	}
	// Then check built-in modes
	return modes.find((mode) => mode.slug === slug)
}
export function getModeConfig(slug, customModes) {
	const mode = getModeBySlug(slug, customModes)
	if (!mode) {
		throw new Error(`No mode found for slug: ${slug}`)
	}
	return mode
}
// Get all available modes, with custom modes overriding built-in modes
export function getAllModes(customModes) {
	if (!customModes?.length) {
		return [...modes]
	}
	// Start with built-in modes
	const allModes = [...modes]
	// Process custom modes
	customModes.forEach((customMode) => {
		const index = allModes.findIndex((mode) => mode.slug === customMode.slug)
		if (index !== -1) {
			// Override existing mode
			allModes[index] = customMode
		} else {
			// Add new mode
			allModes.push(customMode)
		}
	})
	return allModes
}
// Check if a mode is custom or an override
export function isCustomMode(slug, customModes) {
	return !!customModes?.some((mode) => mode.slug === slug)
}
export function isToolAllowedForMode(tool, modeSlug, customModes) {
	// Always allow these tools
	if (ALWAYS_AVAILABLE_TOOLS.includes(tool)) {
		return true
	}
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		return false
	}
	// Check if tool is in any of the mode's groups
	return mode.groups.some((group) => TOOL_GROUPS[group].includes(tool))
}
export const enhance = {
	prompt: "Generate an enhanced version of this prompt (reply with only the enhanced prompt - no conversation, explanations, lead-in, bullet points, placeholders, or surrounding quotes):",
}
// Completely separate enhance prompt handling
export const enhancePrompt = {
	default: enhance.prompt,
	get: (customPrompts) => {
		return customPrompts?.enhance ?? enhance.prompt
	},
}
// Create the mode-specific default prompts
export const defaultPrompts = Object.freeze(
	Object.fromEntries(modes.map((mode) => [mode.slug, { roleDefinition: mode.roleDefinition }])),
)
// Helper function to safely get role definition
export function getRoleDefinition(modeSlug, customModes) {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.roleDefinition
}
//# sourceMappingURL=modes.js.map

import { modes, defaultModeSlug, getModeBySlug } from "../../shared/modes"
import { getToolDescriptionsForMode } from "./tools"
import {
	getRulesSection,
	getSystemInfoSection,
	getObjectiveSection,
	getSharedToolUseSection,
	getMcpServersSection,
	getToolUseGuidelinesSection,
	getCapabilitiesSection,
	getModesSection,
	addCustomInstructions,
} from "./sections"
async function generatePrompt(
	context,
	cwd,
	supportsComputerUse,
	mode,
	mcpHub,
	diffStrategy,
	browserViewportSize,
	promptComponent,
	customModeConfigs,
	globalCustomInstructions,
) {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}
	const [mcpServersSection, modesSection] = await Promise.all([
		getMcpServersSection(mcpHub, diffStrategy),
		getModesSection(context),
	])
	// Get the full mode config to ensure we have the role definition
	const modeConfig = getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0]
	const roleDefinition = modeConfig.roleDefinition
	const basePrompt = `${roleDefinition}

${getSharedToolUseSection()}

${getToolDescriptionsForMode(mode, cwd, supportsComputerUse, diffStrategy, browserViewportSize, mcpHub, customModeConfigs)}

${getToolUseGuidelinesSection()}

${mcpServersSection}

${getCapabilitiesSection(cwd, supportsComputerUse, mcpHub, diffStrategy)}

${modesSection}

${getRulesSection(cwd, supportsComputerUse, diffStrategy, context)}

${getSystemInfoSection(cwd, mode, customModeConfigs)}

${getObjectiveSection()}

${await addCustomInstructions(modeConfig.customInstructions || "", globalCustomInstructions || "", cwd, mode, {})}`
	return basePrompt
}
export const SYSTEM_PROMPT = async (
	context,
	cwd,
	supportsComputerUse,
	mcpHub,
	diffStrategy,
	browserViewportSize,
	mode = defaultModeSlug,
	customPrompts,
	customModes,
	globalCustomInstructions,
) => {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}
	const getPromptComponent = (value) => {
		if (typeof value === "object" && value !== null) {
			return value
		}
		return undefined
	}
	// Check if it's a custom mode
	const promptComponent = getPromptComponent(customPrompts?.[mode])
	// Get full mode config from custom modes or fall back to built-in modes
	const currentMode = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0]
	return generatePrompt(
		context,
		cwd,
		supportsComputerUse,
		currentMode.slug,
		mcpHub,
		diffStrategy,
		browserViewportSize,
		promptComponent,
		customModes,
		globalCustomInstructions,
	)
}
//# sourceMappingURL=system.js.map

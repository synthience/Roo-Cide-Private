import { isToolAllowedForMode } from "../shared/modes"
export { isToolAllowedForMode }
export function validateToolUse(toolName, mode, customModes) {
	if (!isToolAllowedForMode(toolName, mode, customModes ?? [])) {
		throw new Error(`Tool "${toolName}" is not allowed in ${mode} mode.`)
	}
}
//# sourceMappingURL=mode-validator.js.map

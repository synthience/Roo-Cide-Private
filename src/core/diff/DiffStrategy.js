import { UnifiedDiffStrategy } from "./strategies/unified"
import { SearchReplaceDiffStrategy } from "./strategies/search-replace"
import { NewUnifiedDiffStrategy } from "./strategies/new-unified"
/**
 * Get the appropriate diff strategy for the given model
 * @param model The name of the model being used (e.g., 'gpt-4', 'claude-3-opus')
 * @returns The appropriate diff strategy for the model
 */
export function getDiffStrategy(model, fuzzyMatchThreshold, experimentalDiffStrategy = false) {
	if (experimentalDiffStrategy) {
		return new NewUnifiedDiffStrategy(fuzzyMatchThreshold)
	}
	return new SearchReplaceDiffStrategy(fuzzyMatchThreshold)
}
export { UnifiedDiffStrategy, SearchReplaceDiffStrategy }
//# sourceMappingURL=DiffStrategy.js.map

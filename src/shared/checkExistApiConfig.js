export function checkExistKey(config) {
	return config
		? [
				config.apiKey,
				config.glamaApiKey,
				config.openRouterApiKey,
				config.awsRegion,
				config.vertexProjectId,
				config.openAiApiKey,
				config.ollamaModelId,
				config.lmStudioModelId,
				config.geminiApiKey,
				config.openAiNativeApiKey,
				config.deepSeekApiKey,
				config.mistralApiKey,
				config.vsCodeLmModelSelector,
			].some((key) => key !== undefined)
		: false
}
//# sourceMappingURL=checkExistApiConfig.js.map

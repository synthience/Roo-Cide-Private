export class ConfigManager {
	defaultConfig = {
		currentApiConfigName: "default",
		apiConfigs: {
			default: {
				id: this.generateId(),
			},
		},
	}
	SCOPE_PREFIX = "roo_cline_config_"
	context
	constructor(context) {
		this.context = context
		this.initConfig().catch(console.error)
	}
	generateId() {
		return Math.random().toString(36).substring(2, 15)
	}
	/**
	 * Initialize config if it doesn't exist
	 */
	async initConfig() {
		try {
			const config = await this.readConfig()
			if (!config) {
				await this.writeConfig(this.defaultConfig)
				return
			}
			// Migrate: ensure all configs have IDs
			let needsMigration = false
			for (const [name, apiConfig] of Object.entries(config.apiConfigs)) {
				if (!apiConfig.id) {
					apiConfig.id = this.generateId()
					needsMigration = true
				}
			}
			if (needsMigration) {
				await this.writeConfig(config)
			}
		} catch (error) {
			throw new Error(`Failed to initialize config: ${error}`)
		}
	}
	/**
	 * List all available configs with metadata
	 */
	async listConfig() {
		try {
			const config = await this.readConfig()
			return Object.entries(config.apiConfigs).map(([name, apiConfig]) => ({
				name,
				id: apiConfig.id || "",
				apiProvider: apiConfig.apiProvider,
			}))
		} catch (error) {
			throw new Error(`Failed to list configs: ${error}`)
		}
	}
	/**
	 * Save a config with the given name
	 */
	async saveConfig(name, config) {
		try {
			const currentConfig = await this.readConfig()
			const existingConfig = currentConfig.apiConfigs[name]
			currentConfig.apiConfigs[name] = {
				...config,
				id: existingConfig?.id || this.generateId(),
			}
			await this.writeConfig(currentConfig)
		} catch (error) {
			throw new Error(`Failed to save config: ${error}`)
		}
	}
	/**
	 * Load a config by name
	 */
	async loadConfig(name) {
		try {
			const config = await this.readConfig()
			const apiConfig = config.apiConfigs[name]
			if (!apiConfig) {
				throw new Error(`Config '${name}' not found`)
			}
			config.currentApiConfigName = name
			await this.writeConfig(config)
			return apiConfig
		} catch (error) {
			throw new Error(`Failed to load config: ${error}`)
		}
	}
	/**
	 * Delete a config by name
	 */
	async deleteConfig(name) {
		try {
			const currentConfig = await this.readConfig()
			if (!currentConfig.apiConfigs[name]) {
				throw new Error(`Config '${name}' not found`)
			}
			// Don't allow deleting the default config
			if (Object.keys(currentConfig.apiConfigs).length === 1) {
				throw new Error(`Cannot delete the last remaining configuration.`)
			}
			delete currentConfig.apiConfigs[name]
			await this.writeConfig(currentConfig)
		} catch (error) {
			throw new Error(`Failed to delete config: ${error}`)
		}
	}
	/**
	 * Set the current active API configuration
	 */
	async setCurrentConfig(name) {
		try {
			const currentConfig = await this.readConfig()
			if (!currentConfig.apiConfigs[name]) {
				throw new Error(`Config '${name}' not found`)
			}
			currentConfig.currentApiConfigName = name
			await this.writeConfig(currentConfig)
		} catch (error) {
			throw new Error(`Failed to set current config: ${error}`)
		}
	}
	/**
	 * Check if a config exists by name
	 */
	async hasConfig(name) {
		try {
			const config = await this.readConfig()
			return name in config.apiConfigs
		} catch (error) {
			throw new Error(`Failed to check config existence: ${error}`)
		}
	}
	/**
	 * Set the API config for a specific mode
	 */
	async setModeConfig(mode, configId) {
		try {
			const currentConfig = await this.readConfig()
			if (!currentConfig.modeApiConfigs) {
				currentConfig.modeApiConfigs = {}
			}
			currentConfig.modeApiConfigs[mode] = configId
			await this.writeConfig(currentConfig)
		} catch (error) {
			throw new Error(`Failed to set mode config: ${error}`)
		}
	}
	/**
	 * Get the API config ID for a specific mode
	 */
	async getModeConfigId(mode) {
		try {
			const config = await this.readConfig()
			return config.modeApiConfigs?.[mode]
		} catch (error) {
			throw new Error(`Failed to get mode config: ${error}`)
		}
	}
	/**
	 * Get the key used for storing config in secrets
	 */
	getConfigKey() {
		return `${this.SCOPE_PREFIX}api_config`
	}
	/**
	 * Reset all configuration by deleting the stored config from secrets
	 */
	async resetAllConfigs() {
		await this.context.secrets.delete(this.getConfigKey())
	}
	async readConfig() {
		try {
			const content = await this.context.secrets.get(this.getConfigKey())
			if (!content) {
				return this.defaultConfig
			}
			return JSON.parse(content)
		} catch (error) {
			throw new Error(`Failed to read config from secrets: ${error}`)
		}
	}
	async writeConfig(config) {
		try {
			const content = JSON.stringify(config, null, 2)
			await this.context.secrets.store(this.getConfigKey(), content)
		} catch (error) {
			throw new Error(`Failed to write config to secrets: ${error}`)
		}
	}
}
//# sourceMappingURL=ConfigManager.js.map

import { CustomModeSchema } from "../CustomModesSchema"
describe("GroupConfigSchema", () => {
	const validBaseMode = {
		slug: "123e4567-e89b-12d3-a456-426614174000",
		name: "Test Mode",
		roleDefinition: "Test role definition",
	}
	describe("group format validation", () => {
		test("accepts single group", () => {
			const mode = {
				...validBaseMode,
				groups: ["read"],
			}
			expect(() => CustomModeSchema.parse(mode)).not.toThrow()
		})
		test("accepts multiple groups", () => {
			const mode = {
				...validBaseMode,
				groups: ["read", "edit", "browser"],
			}
			expect(() => CustomModeSchema.parse(mode)).not.toThrow()
		})
		test("accepts all available groups", () => {
			const mode = {
				...validBaseMode,
				groups: ["read", "edit", "browser", "command", "mcp"],
			}
			expect(() => CustomModeSchema.parse(mode)).not.toThrow()
		})
		test("rejects non-array group format", () => {
			const mode = {
				...validBaseMode,
				groups: "not-an-array",
			}
			expect(() => CustomModeSchema.parse(mode)).toThrow()
		})
		test("rejects empty groups array", () => {
			const mode = {
				...validBaseMode,
				groups: [],
			}
			expect(() => CustomModeSchema.parse(mode)).toThrow("At least one tool group is required")
		})
		test("rejects invalid group names", () => {
			const mode = {
				...validBaseMode,
				groups: ["invalid_group"],
			}
			expect(() => CustomModeSchema.parse(mode)).toThrow()
		})
		test("rejects duplicate groups", () => {
			const mode = {
				...validBaseMode,
				groups: ["read", "read"],
			}
			expect(() => CustomModeSchema.parse(mode)).toThrow("Duplicate groups are not allowed")
		})
		test("rejects null or undefined groups", () => {
			const modeWithNull = {
				...validBaseMode,
				groups: null,
			}
			const modeWithUndefined = {
				...validBaseMode,
				groups: undefined,
			}
			expect(() => CustomModeSchema.parse(modeWithNull)).toThrow()
			expect(() => CustomModeSchema.parse(modeWithUndefined)).toThrow()
		})
	})
})
//# sourceMappingURL=GroupConfigSchema.test.js.map

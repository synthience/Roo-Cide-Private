import { TerminalRegistry } from "../TerminalRegistry"
// Mock vscode.window.createTerminal
const mockCreateTerminal = jest.fn()
jest.mock("vscode", () => ({
	window: {
		createTerminal: (...args) => {
			mockCreateTerminal(...args)
			return {
				exitStatus: undefined,
			}
		},
	},
	ThemeIcon: jest.fn(),
}))
describe("TerminalRegistry", () => {
	beforeEach(() => {
		mockCreateTerminal.mockClear()
	})
	describe("createTerminal", () => {
		it("creates terminal with PAGER set to cat", () => {
			TerminalRegistry.createTerminal("/test/path")
			expect(mockCreateTerminal).toHaveBeenCalledWith({
				cwd: "/test/path",
				name: "Roo Code",
				iconPath: expect.any(Object),
				env: {
					PAGER: "cat",
				},
			})
		})
	})
})
//# sourceMappingURL=TerminalRegistry.test.js.map

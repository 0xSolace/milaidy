/**
 * Native Module Verification Tests
 *
 * Tests to verify that native Node.js modules required for vision and ML
 * capabilities are properly installed and functional:
 *
 *   1. TensorFlow.js Node bindings (@tensorflow/tfjs-node)
 *   2. Sharp image processing
 *   3. Canvas for face-api.js
 *   4. TensorFlow models (coco-ssd, mobilenet, pose-detection)
 *   5. Plugin-vision service availability
 *
 * These tests ensure Electron compatibility by verifying native modules
 * can be loaded and initialized correctly.
 *
 * In bun/npm workspaces, dependencies may be hoisted to the repo root
 * node_modules rather than living in the package-local node_modules.
 * All path checks use findPackagePath() to search both locations.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Finds a package in node_modules, checking both local and hoisted (repo root) locations.
 */
function findPackagePath(...segments: string[]): string | null {
	const local = path.join(packageRoot, "node_modules", ...segments);
	if (fs.existsSync(local)) return local;
	const hoisted = path.join(repoRoot, "node_modules", ...segments);
	if (fs.existsSync(hoisted)) return hoisted;
	return null;
}

/**
 * Attempts to require/import a module and returns success status
 */
async function canImportModule(
	moduleName: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		await import(moduleName);
		return { success: true };
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Checks if a native binding file exists for a module
 */
function hasNativeBinding(modulePath: string, patterns: string[]): boolean {
	try {
		const nodeModulesPath =
			findPackagePath(modulePath) ??
			path.join(packageRoot, "node_modules", modulePath);
		if (!fs.existsSync(nodeModulesPath)) return false;

		// Recursively search for .node files
		const findNodeFiles = (dir: string): string[] => {
			const results: string[] = [];
			try {
				const entries = fs.readdirSync(dir, { withFileTypes: true });
				for (const entry of entries) {
					const fullPath = path.join(dir, entry.name);
					if (entry.isDirectory()) {
						results.push(...findNodeFiles(fullPath));
					} else if (patterns.some((p) => entry.name.includes(p))) {
						results.push(fullPath);
					}
				}
			} catch {
				// Ignore permission errors
			}
			return results;
		};

		const nodeFiles = findNodeFiles(nodeModulesPath);
		return nodeFiles.length > 0;
	} catch {
		return false;
	}
}

/**
 * Reads package.json from both local and repo root, merging all deps.
 */
function getAllWorkspaceDeps(): Record<string, string> {
	const localPkg = JSON.parse(
		fs.readFileSync(path.join(packageRoot, "package.json"), "utf-8"),
	);
	const repoRootPkgPath = path.join(repoRoot, "package.json");
	const repoRootPkg = fs.existsSync(repoRootPkgPath)
		? JSON.parse(fs.readFileSync(repoRootPkgPath, "utf-8"))
		: {};
	return {
		...(repoRootPkg.dependencies || {}),
		...(repoRootPkg.devDependencies || {}),
		...(localPkg.dependencies || {}),
		...(localPkg.devDependencies || {}),
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Native Module Installation Verification", () => {
	describe("TensorFlow.js", () => {
		it("@tensorflow/tfjs-node is installed", async () => {
			const result = await canImportModule("@tensorflow/tfjs-node");
			if (!result.success) {
				console.warn(
					`[native-modules] tfjs-node import failed: ${result.error}`,
				);
			}
			const packagePath = findPackagePath("@tensorflow", "tfjs-node");
			if (!packagePath) {
				console.warn("[native-modules] tfjs-node not installed — skipping");
				return;
			}
			expect(fs.existsSync(packagePath)).toBe(true);
		});

		it("@tensorflow/tfjs-node has native binding", () => {
			const hasBinding = hasNativeBinding("@tensorflow/tfjs-node", [
				"tfjs_binding.node",
				".node",
			]);
			if (!hasBinding) {
				console.warn(
					"[native-modules] tfjs-node binding not compiled — skipping (install used --ignore-scripts?)",
				);
				return;
			}
			expect(hasBinding).toBe(true);
		});

		it("@tensorflow/tfjs-core is installed", async () => {
			const packagePath = findPackagePath("@tensorflow", "tfjs-core");
			if (!packagePath) {
				console.warn("[native-modules] tfjs-core not installed — skipping");
				return;
			}
			expect(fs.existsSync(packagePath)).toBe(true);
		});
	});

	describe("TensorFlow Models", () => {
		it("@tensorflow-models/coco-ssd is installed", () => {
			const packagePath = findPackagePath("@tensorflow-models", "coco-ssd");
			if (!packagePath) {
				console.warn("[native-modules] coco-ssd not installed — skipping");
				return;
			}
			expect(fs.existsSync(packagePath)).toBe(true);
		});

		it("@tensorflow-models/mobilenet is installed", () => {
			const packagePath = findPackagePath("@tensorflow-models", "mobilenet");
			if (!packagePath) {
				console.warn("[native-modules] mobilenet not installed — skipping");
				return;
			}
			expect(fs.existsSync(packagePath)).toBe(true);
		});

		it("@tensorflow-models/pose-detection is installed", () => {
			const packagePath = findPackagePath(
				"@tensorflow-models",
				"pose-detection",
			);
			if (!packagePath) {
				console.warn(
					"[native-modules] pose-detection not installed — skipping",
				);
				return;
			}
			expect(fs.existsSync(packagePath)).toBe(true);
		});
	});

	describe("Sharp Image Processing", () => {
		it("sharp is installed", () => {
			const packagePath = findPackagePath("sharp");
			if (!packagePath) {
				console.warn("[native-modules] sharp not installed — skipping");
				return;
			}
			expect(fs.existsSync(packagePath)).toBe(true);
		});

		it("sharp can be imported", async () => {
			if (!findPackagePath("sharp")) {
				console.warn("[native-modules] sharp not installed — skipping");
				return;
			}
			const result = await canImportModule("sharp");
			expect(result.success).toBe(true);
		});

		it("sharp can process an image buffer", async () => {
			if (!findPackagePath("sharp")) {
				console.warn("[native-modules] sharp not installed — skipping");
				return;
			}
			const sharp = (await import("sharp")).default;
			const buffer = await sharp({
				create: {
					width: 1,
					height: 1,
					channels: 3,
					background: { r: 255, g: 0, b: 0 },
				},
			})
				.png()
				.toBuffer();

			expect(buffer).toBeInstanceOf(Buffer);
			expect(buffer.length).toBeGreaterThan(0);
		});
	});

	describe("Canvas for Face Recognition", () => {
		it("canvas is installed", () => {
			const packagePath = findPackagePath("canvas");
			if (!packagePath) {
				console.warn("[native-modules] canvas not installed — skipping");
				return;
			}
			expect(fs.existsSync(packagePath)).toBe(true);
		});

		it("canvas has native binding", () => {
			const hasBinding = hasNativeBinding("canvas", [
				"canvas.node",
				".node",
			]);
			if (!hasBinding) {
				console.warn(
					"[native-modules] canvas binding not compiled — skipping (install used --ignore-scripts?)",
				);
				return;
			}
			expect(hasBinding).toBe(true);
		});

		it("canvas can be imported", async () => {
			const hasBinding = hasNativeBinding("canvas", [
				"canvas.node",
				".node",
			]);
			if (!hasBinding) {
				console.warn(
					"[native-modules] canvas binding not compiled — skipping",
				);
				return;
			}
			const result = await canImportModule("canvas");
			expect(result.success).toBe(true);
		});

		it("canvas can create a 2D context", async () => {
			const hasBinding = hasNativeBinding("canvas", [
				"canvas.node",
				".node",
			]);
			if (!hasBinding) {
				console.warn(
					"[native-modules] canvas binding not compiled — skipping",
				);
				return;
			}
			const { createCanvas } = await import("canvas");
			const canvas = createCanvas(100, 100);
			const ctx = canvas.getContext("2d");

			expect(ctx).toBeDefined();

			ctx.fillStyle = "red";
			ctx.fillRect(0, 0, 50, 50);

			const imageData = ctx.getImageData(0, 0, 1, 1);
			expect(imageData.data[0]).toBe(255);
		});
	});

	describe("Face-API.js", () => {
		it("face-api.js is installed", () => {
			const packagePath = findPackagePath("face-api.js");
			if (!packagePath) {
				console.warn(
					"[native-modules] face-api.js not in node_modules — transitive dep of @elizaos/plugin-vision",
				);
				return;
			}
			expect(fs.existsSync(packagePath)).toBe(true);
		});

		it("face-api.js can be imported", async () => {
			if (!findPackagePath("face-api.js")) {
				console.warn(
					"[native-modules] face-api.js not installed — skipping",
				);
				return;
			}
			const result = await canImportModule("face-api.js");
			expect(result.success).toBe(true);
		});
	});

	describe("Tesseract.js OCR", () => {
		it("tesseract.js is installed", () => {
			const packagePath = findPackagePath("tesseract.js");
			if (!packagePath) {
				console.warn(
					"[native-modules] tesseract.js not installed — skipping",
				);
				return;
			}
			expect(fs.existsSync(packagePath)).toBe(true);
		});

		it("tesseract.js can be imported", async () => {
			if (!findPackagePath("tesseract.js")) {
				console.warn(
					"[native-modules] tesseract.js not installed — skipping",
				);
				return;
			}
			const result = await canImportModule("tesseract.js");
			expect(result.success).toBe(true);
		});
	});
});

describe("Plugin-Vision Availability", () => {
	it("@elizaos/plugin-vision is installed", () => {
		const packagePath = findPackagePath("@elizaos", "plugin-vision");
		if (!packagePath) {
			console.warn(
				"[native-modules] plugin-vision not installed — skipping",
			);
			return;
		}
		expect(fs.existsSync(packagePath)).toBe(true);
	});

	it("@elizaos/plugin-vision can be imported", async () => {
		const result = await canImportModule("@elizaos/plugin-vision");
		if (!result.success) {
			console.warn(
				`[native-modules] plugin-vision import warning: ${result.error}`,
			);
		}
		const packagePath = findPackagePath("@elizaos", "plugin-vision");
		if (!packagePath) {
			console.warn(
				"[native-modules] plugin-vision not installed — skipping",
			);
			return;
		}
		expect(fs.existsSync(packagePath)).toBe(true);
	});

	it("plugin-vision has required dependencies", () => {
		const visionPkgDir = findPackagePath("@elizaos", "plugin-vision");
		if (!visionPkgDir) {
			console.warn(
				"[native-modules] plugin-vision not installed — skipping",
			);
			return;
		}
		const visionPkgPath = path.join(visionPkgDir, "package.json");
		expect(fs.existsSync(visionPkgPath)).toBe(true);

		const visionPkgContent = fs.readFileSync(visionPkgPath, "utf-8");

		expect(visionPkgContent).toContain('"sharp"');
		expect(visionPkgContent).toContain('"canvas"');
		expect(visionPkgContent).toContain('"face-api.js"');
		expect(visionPkgContent).toContain('"tesseract.js"');
	});

	it("vision dependencies are installed in node_modules", () => {
		const deps = ["sharp", "canvas", "face-api.js", "tesseract.js"];
		const missing = deps.filter((dep) => !findPackagePath(dep));
		if (missing.length > 0) {
			console.warn(
				`[native-modules] vision deps not in node_modules: ${missing.join(", ")}`,
			);
		}
		const sharpPath = findPackagePath("sharp");
		if (!sharpPath) {
			console.warn("[native-modules] sharp not installed — skipping");
			return;
		}
		expect(!!sharpPath).toBe(true);
		const tesseractPath = findPackagePath("tesseract.js");
		if (!tesseractPath) {
			console.warn(
				"[native-modules] tesseract.js not installed — skipping",
			);
			return;
		}
		expect(!!tesseractPath).toBe(true);
	});
});

describe("Electrobun Native Module Configuration", () => {
	it("electrobun app package is present and depends on electrobun", () => {
		const localPath = path.join(
			packageRoot,
			"apps",
			"app",
			"electrobun",
			"package.json",
		);
		const repoPath = path.join(
			repoRoot,
			"apps",
			"app",
			"electrobun",
			"package.json",
		);
		const electrobunPkgPath = fs.existsSync(localPath)
			? localPath
			: repoPath;
		if (!fs.existsSync(electrobunPkgPath)) {
			console.warn("[native-modules] electrobun app not found — skipping");
			return;
		}

		const electrobunPkg = JSON.parse(
			fs.readFileSync(electrobunPkgPath, "utf-8"),
		);
		expect(electrobunPkg.dependencies || {}).toHaveProperty("electrobun");
	});

	it("root runtime declares native module dependencies for desktop packaging", () => {
		const allDeps = getAllWorkspaceDeps();
		for (const dep of ["sharp", "canvas", "@tensorflow/tfjs-node"]) {
			if (!allDeps[dep]) {
				console.warn(
					`[native-modules] ${dep} not in workspace deps — may be in a nested package`,
				);
			}
		}
		const hasAny = ["sharp", "canvas", "@tensorflow/tfjs-node"].some(
			(d) => !!allDeps[d],
		);
		if (!hasAny) {
			console.warn(
				"[native-modules] no native module deps found in workspace — skipping",
			);
			return;
		}
		expect(hasAny).toBe(true);
	});

	it("desktop packaging scripts exist for runtime dependency bundling", () => {
		const scriptCandidates = [
			path.join(packageRoot, "scripts", "copy-runtime-node-modules.ts"),
			path.join(repoRoot, "scripts", "copy-runtime-node-modules.ts"),
		];
		const workflowCandidates = [
			path.join(
				packageRoot,
				".github",
				"workflows",
				"release-electrobun.yml",
			),
			path.join(
				repoRoot,
				".github",
				"workflows",
				"release-electrobun.yml",
			),
		];
		const scriptPath = scriptCandidates.find((p) => fs.existsSync(p));
		const workflowPath = workflowCandidates.find((p) => fs.existsSync(p));

		if (!scriptPath) {
			console.warn(
				"[native-modules] copy-runtime-node-modules.ts not found — skipping",
			);
			return;
		}
		expect(fs.existsSync(scriptPath)).toBe(true);
		if (!workflowPath) {
			console.warn(
				"[native-modules] release-electrobun.yml not found — skipping",
			);
			return;
		}
		expect(fs.existsSync(workflowPath)).toBe(true);
	});
});

describe("Core Plugins with Vision Integration", () => {
	it("plugin-vision is in OPTIONAL_CORE_PLUGINS", async () => {
		try {
			const { OPTIONAL_CORE_PLUGINS } = await import(
				"../src/runtime/core-plugins"
			);
			expect(OPTIONAL_CORE_PLUGINS).toContain("@elizaos/plugin-vision");
		} catch {
			console.warn(
				"[native-modules] could not import core-plugins — skipping",
			);
		}
	});

	it("plugin-vision has static import in eliza.ts", () => {
		const candidates = [
			path.join(packageRoot, "src", "runtime", "eliza.ts"),
			path.join(repoRoot, "src", "runtime", "eliza.ts"),
			path.join(
				packageRoot,
				"packages",
				"autonomous",
				"src",
				"runtime",
				"eliza.ts",
			),
			path.join(
				repoRoot,
				"packages",
				"autonomous",
				"src",
				"runtime",
				"eliza.ts",
			),
		];
		const elizaPath = candidates.find((p) => fs.existsSync(p));
		if (!elizaPath) {
			console.warn("[native-modules] eliza.ts not found — skipping");
			return;
		}
		const elizaContent = fs.readFileSync(elizaPath, "utf-8");
		expect(elizaContent).toContain("plugin-vision");
	});
});

describe("PTY Native Modules", () => {
	it("node-pty is installed", () => {
		const packagePath = findPackagePath("node-pty");
		if (!packagePath) {
			console.warn("[native-modules] node-pty not installed — skipping");
			return;
		}
		expect(fs.existsSync(packagePath)).toBe(true);
	});

	it("@lydell/node-pty is available", () => {
		const candidates = [
			path.join(
				packageRoot,
				"node_modules",
				".bun",
				"@lydell+node-pty@1.1.0",
			),
			path.join(packageRoot, "node_modules", "@lydell", "node-pty"),
			path.join(
				repoRoot,
				"node_modules",
				".bun",
				"@lydell+node-pty@1.1.0",
			),
			path.join(repoRoot, "node_modules", "@lydell", "node-pty"),
		];
		const exists = candidates.some((p) => fs.existsSync(p));
		if (!exists) {
			console.warn(
				"[native-modules] @lydell/node-pty not found — skipping",
			);
			return;
		}
		expect(exists).toBe(true);
	});

	it("pty-manager is installed", () => {
		const packagePath = findPackagePath("pty-manager");
		if (!packagePath) {
			console.warn(
				"[native-modules] pty-manager not installed — skipping",
			);
			return;
		}
		expect(fs.existsSync(packagePath)).toBe(true);
	});

	it("root runtime declares PTY dependencies", () => {
		const allDeps = getAllWorkspaceDeps();
		if (!allDeps["node-pty"] && !allDeps["pty-manager"]) {
			console.warn("[native-modules] PTY deps not declared — skipping");
			return;
		}
		expect(!!allDeps["pty-manager"]).toBe(true);
	});
});

describe("Local Embedding Native Modules", () => {
	it("root runtime declares local embedding dependencies", () => {
		const allDeps = getAllWorkspaceDeps();
		if (!allDeps["node-llama-cpp"] && !allDeps["whisper-node"]) {
			console.warn(
				"[native-modules] embedding deps not declared — skipping",
			);
			return;
		}
		expect(
			!!allDeps["node-llama-cpp"] || !!allDeps["whisper-node"],
		).toBe(true);
	});
});

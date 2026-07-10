import * as esbuild from "esbuild";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const scriptsDir = "src/scripts";
const entryPoints = readdirSync(scriptsDir)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))
    .map((file) => join(scriptsDir, file));

const ctx = await esbuild.context({
    entryPoints,
    outdir: "scripts",
    bundle: true,
    format: "esm",
    target: "es2022",
    platform: "neutral",
    external: ["cs_script/point_script"],
    logLevel: "info",
});

if (process.argv.includes("--watch")) {
    await ctx.watch();
} else {
    await ctx.rebuild();
    await ctx.dispose();
}

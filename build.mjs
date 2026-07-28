import * as esbuild from "esbuild";
import { copyCfgs } from "./copy-cfgs.mjs";

const ctx = await esbuild.context({
    entryPoints: ["src/scripts/index.ts"],
    outdir: "scripts",
    bundle: true,
    format: "esm",
    target: "es2022",
    platform: "neutral",
    external: ["cs_script/point_script"],
    logLevel: "info",
    plugins: [{ name: "copy-cfgs", setup: (build) => build.onEnd(copyCfgs) }],
});

if (process.argv.includes("--watch")) {
    await ctx.watch();
} else {
    await ctx.rebuild();
    await ctx.dispose();
}

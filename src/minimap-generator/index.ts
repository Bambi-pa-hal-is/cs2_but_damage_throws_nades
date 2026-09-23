import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ConfigError, loadConfig, type MinimapVolume } from "./config.ts";
import {
    RADAR_TEXTURE_SETTINGS,
    dynamicImageManifest,
    dynamicImageName,
    mergeOverview,
    radarBaseName,
} from "./minimap-assets.ts";
import { decodePng, encodeTga, type RgbaImage } from "./radar-image.ts";
import { generateVmap, type VolumeBox } from "./vmap-generator.ts";

const moduleDir = dirname(fileURLToPath(import.meta.url));
// src/minimap-generator -> addon root, independent of the shell's working directory.
const addonRoot = resolve(moduleDir, "..", "..");
const configPath = join(moduleDir, "minimap.config.json");
const imageDir = join(moduleDir, "images");

/** content/csgo_addons/<addon> -> the CS2 install root and game/csgo_addons/<addon>. */
const resolveGamePaths = () => {
    const addonsDir = dirname(addonRoot);
    const contentDir = dirname(addonsDir);
    if (basename(addonsDir) !== "csgo_addons" || basename(contentDir) !== "content") {
        throw new ConfigError(`Expected the addon to live in .../content/csgo_addons/<addon> (got ${addonRoot})`);
    }
    const installRoot = dirname(contentDir);
    const gameAddonsDir = join(installRoot, "game", "csgo_addons");
    if (!existsSync(gameAddonsDir)) throw new ConfigError(`Game addons folder not found: ${gameAddonsDir}`);
    return { installRoot, gameAddonDir: join(gameAddonsDir, basename(addonRoot)) };
};

/** Rounds away float noise such as 1024 * 4.4 = 4505.6000000000004. */
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The overview maps the image's top-left pixel to (posX, posY) at `scale` world units per pixel,
 * so the volume covers exactly the area the radar image shows.
 */
const volumeBox = (volume: MinimapVolume, image: RgbaImage): VolumeBox => ({
    minimapName: volume.minimapName,
    targetname: volume.targetname,
    min: [volume.posX, round(volume.posY - image.height * volume.scale), volume.zMin],
    max: [round(volume.posX + image.width * volume.scale), volume.posY, volume.zMax],
});

/**
 * Writes via a sibling temp file and rename so a failure never leaves a half-written file.
 * Unchanged files are left alone so the asset system doesn't recompile them.
 * @returns Whether the file changed.
 */
const writeIfChanged = (path: string, contents: string | Buffer): boolean => {
    const buffer = typeof contents === "string" ? Buffer.from(contents, "utf8") : contents;
    if (existsSync(path) && readFileSync(path).equals(buffer)) return false;
    mkdirSync(dirname(path), { recursive: true });
    const tempPath = `${path}.${process.pid}.tmp`;
    try {
        writeFileSync(tempPath, buffer);
        renameSync(tempPath, path);
    } catch (error) {
        rmSync(tempPath, { force: true });
        throw error;
    }
    return true;
};

export const updateMinimap = () => {
    const { levelName, outputFile, outputPath, volumes } = loadConfig(configPath, addonRoot, imageDir);
    const { installRoot, gameAddonDir } = resolveGamePaths();

    // Decode every image before writing anything, so a bad image can't leave a partial update.
    const images: RgbaImage[] = [];
    const imageErrors: string[] = [];
    for (const volume of volumes) {
        try {
            images.push(decodePng(readFileSync(volume.imagePath)));
        } catch (error) {
            const reason = error instanceof Error ? error.message : error;
            imageErrors.push(`"${volume.minimapName}": ${relative(moduleDir, volume.imagePath)}: ${reason}`);
        }
    }
    if (imageErrors.length > 0) {
        throw new ConfigError(`Could not load radar images:\n  - ${imageErrors.join("\n  - ")}`);
    }
    const boxes = volumes.map((volume, i) => volumeBox(volume, images[i]));

    const overheadDir = join(addonRoot, "panorama", "images", "overheadmaps");
    const overviewPath = join(gameAddonDir, "resource", "overviews", `${levelName}.txt`);
    const existingOverview = existsSync(overviewPath) ? readFileSync(overviewPath, "utf8") : undefined;

    const outputs: [path: string, contents: string | Buffer][] = [
        [outputPath, generateVmap(boxes, outputFile)],
        [overviewPath, mergeOverview(existingOverview, levelName, volumes)],
    ];
    volumes.forEach((volume, i) => {
        const base = radarBaseName(levelName, volume.minimapName);
        outputs.push(
            [join(overheadDir, `${base}.tga`), encodeTga(images[i])],
            [join(overheadDir, `${base}.txt`), RADAR_TEXTURE_SETTINGS],
            [join(addonRoot, "panorama", dynamicImageName(levelName, volume.minimapName)), dynamicImageManifest(levelName, volume.minimapName)],
        );
    });

    const changed = outputs.filter(([path, contents]) => writeIfChanged(path, contents)).length;

    console.log("Generated minimap prefab:");
    console.log(`  ${outputFile}`);
    console.log(`  ${relative(installRoot, overviewPath).split(sep).join("/")}`);
    console.log(`  ${boxes.length} minimap volume${boxes.length === 1 ? "" : "s"}, ${changed} of ${outputs.length} files changed`);
    for (const box of boxes) {
        console.log(`    ${box.targetname.padEnd(40)} ${box.min.join(" ")}  ->  ${box.max.join(" ")}`);
    }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        updateMinimap();
    } catch (error) {
        console.error(error instanceof ConfigError ? error.message : error);
        process.exitCode = 1;
    }
}

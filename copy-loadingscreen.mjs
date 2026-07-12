import { mkdirSync, copyFileSync } from "node:fs";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";

// Every map shares the same loading screen text, so instead of maintaining a duplicate .txt per
// map we keep one source file and stamp out a copy per map name. Keep this in sync with the maps
// array in src/scripts/mapselect.ts (can't import it directly - that file pulls in cs_script/point_script,
// which only resolves inside the esbuild bundle, not plain Node).
const MAP_NAMES = [
    "but_damage_throws_nades",
    "de_overpass",
    "de_dust2",
    "de_nuke",
    "de_mirage",
    "de_inferno",
    "de_train",
    "de_vertigo",
    "de_ancient",
    "de_ancient_night",
    "de_anubis",
    "cs_office",
    "cs_italy",
    "de_cache",
];

export const copyLoadingscreen = () => {
    const sourceFile = join("maps", "loadingscreen", "loadingscreen.txt");

    const cwdParts = process.cwd().split(sep);
    const contentIndex = cwdParts.lastIndexOf("content");
    if (contentIndex === -1) {
        console.error("Expected to run from inside a .../content/csgo_addons/<addon> folder");
        return;
    }
    const addonName = cwdParts[cwdParts.length - 1];
    const gameRoot = cwdParts.slice(0, contentIndex).join(sep);
    const destDir = join(gameRoot, "game", "csgo_addons", addonName, "maps");

    mkdirSync(destDir, { recursive: true });

    for (const mapName of MAP_NAMES) {
        copyFileSync(sourceFile, join(destDir, `${mapName}.txt`));
    }

    console.log(`Copied loadingscreen.txt to ${MAP_NAMES.length} map file(s) in ${destDir}`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    copyLoadingscreen();
}

import { mkdirSync, copyFileSync } from "node:fs";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const copyAddoninfo = () => {
    const sourceFile = "addoninfo.txt";

    const cwdParts = process.cwd().split(sep);
    const contentIndex = cwdParts.lastIndexOf("content");
    if (contentIndex === -1) {
        console.error("Expected to run from inside a .../content/csgo_addons/<addon> folder");
        return;
    }
    const addonName = cwdParts[cwdParts.length - 1];
    const gameRoot = cwdParts.slice(0, contentIndex).join(sep);
    const destDir = join(gameRoot, "game", "csgo_addons", addonName);

    mkdirSync(destDir, { recursive: true });

    copyFileSync(sourceFile, join(destDir, "addoninfo.txt"));

    console.log(`Copied addoninfo.txt to ${destDir}`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    copyAddoninfo();
}

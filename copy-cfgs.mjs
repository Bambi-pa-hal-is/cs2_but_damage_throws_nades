import { mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const copyCfgs = () => {
    const sourceDir = "cfg/maps";

    const cwdParts = process.cwd().split(sep);
    const contentIndex = cwdParts.lastIndexOf("content");
    if (contentIndex === -1) {
        console.error("Expected to run from inside a .../content/csgo_addons/<addon> folder");
        return;
    }
    const addonName = cwdParts[cwdParts.length - 1];
    const gameRoot = cwdParts.slice(0, contentIndex).join(sep);
    const destDir = join(gameRoot, "game", "csgo_addons", addonName, "cfg", "maps");

    mkdirSync(destDir, { recursive: true });

    const files = readdirSync(sourceDir).filter((file) => file.endsWith(".cfg"));
    for (const file of files) {
        copyFileSync(join(sourceDir, file), join(destDir, file));
    }

    console.log(`Copied ${files.length} cfg file(s) to ${destDir}`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    copyCfgs();
}

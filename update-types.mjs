import { copyFileSync } from "node:fs";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const updateTypes = () => {
    const cwdParts = process.cwd().split(sep);
    const contentIndex = cwdParts.lastIndexOf("content");
    if (contentIndex === -1) {
        console.error("Expected to run from inside a .../content/csgo_addons/<addon> folder");
        return;
    }
    const contentRoot = cwdParts.slice(0, contentIndex + 1).join(sep);
    const sourceFile = join(contentRoot, "csgo", "maps", "editor", "zoo", "scripts", "point_script.d.ts");
    const destFile = join("src", "scripts", "point_script.d.ts");

    copyFileSync(sourceFile, destFile);

    console.log(`Copied latest point_script.d.ts from ${sourceFile} to ${destFile}`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    updateTypes();
}

import { readFileSync } from "node:fs";
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

/**
 * One radar image and the volume in which it is shown, as written in minimap.config.json.
 * posX/posY/scale are the map's official overview values (resource/overviews/<map>.txt in pak01):
 * posX/posY is the world position of the image's top-left corner, scale is world units per pixel.
 */
export type MinimapEntityConfig = {
    minimapName: string;
    posX: number;
    posY: number;
    scale: number;
    /** Overrides the top-level zMin (vertical sections, e.g. "_lower" maps). */
    zMin?: number;
    /** Overrides the top-level zMax. */
    zMax?: number;
    /** Source PNG in images/, defaults to "<minimapName>_radar_psd.png". */
    image?: string;
};

export type MinimapVolume = {
    minimapName: string;
    targetname: string;
    posX: number;
    posY: number;
    scale: number;
    zMin: number;
    zMax: number;
    /** Absolute path of the source PNG. */
    imagePath: string;
};

export type ResolvedConfig = {
    levelName: string;
    /** Normalized, forward-slash path relative to the addon root. */
    outputFile: string;
    /** Absolute output path. */
    outputPath: string;
    volumes: MinimapVolume[];
};

// Entity names end up unquoted in I/O strings and cs_script lookups, and minimap names in file
// names, so keep them boring.
const NAME_PATTERN = /^[A-Za-z0-9_.-]*$/;
const NAME_CHARS = `letters, digits, "_", "." and "-"`;

/** An expected, user-fixable failure: printed as a plain message instead of a stack trace. */
export class ConfigError extends Error {}

export const loadConfig = (configPath: string, addonRoot: string, imageDir: string): ResolvedConfig => {
    let raw: unknown;
    try {
        raw = JSON.parse(readFileSync(configPath, "utf8"));
    } catch (error) {
        throw new ConfigError(`Could not read ${configPath}: ${error instanceof Error ? error.message : error}`);
    }
    return validateConfig(raw, addonRoot, imageDir);
};

export const validateConfig = (raw: unknown, addonRoot: string, imageDir: string): ResolvedConfig => {
    if (!isRecord(raw)) throw new ConfigError("Config must be a JSON object");
    const errors: string[] = [];

    const levelName = checkName(raw.levelName, `"levelName"`, errors, false);
    const namePrefix = checkName(raw.namePrefix, `"namePrefix"`, errors, true);
    const output = checkOutputFile(raw.outputFile, addonRoot, errors);
    const defaultZMin = checkNumber(raw.zMin, `"zMin"`, errors);
    const defaultZMax = checkNumber(raw.zMax, `"zMax"`, errors);

    const volumes: MinimapVolume[] = [];
    const { entities } = raw;
    if (entities === undefined) {
        errors.push(`"entities" is required`);
    } else if (!Array.isArray(entities)) {
        errors.push(`"entities" must be an array`);
    } else {
        // Unique minimap names also mean unique targetnames, since they all share namePrefix.
        const seenNames = new Map<string, number>();
        entities.forEach((entity: unknown, index) => {
            const label = `entities[${index}]`;
            if (!isRecord(entity)) {
                errors.push(`${label} must be an object`);
                return;
            }
            const where =
                typeof entity.minimapName === "string" && entity.minimapName !== ""
                    ? `${label} ("${entity.minimapName}")`
                    : label;
            const entityErrors: string[] = [];

            let minimapName = checkName(entity.minimapName, `${where}: "minimapName"`, entityErrors, false);
            if (minimapName !== undefined) {
                const previous = seenNames.get(minimapName);
                if (previous !== undefined) {
                    entityErrors.push(`${where}: duplicate "minimapName", already used by entities[${previous}]`);
                    minimapName = undefined;
                } else {
                    seenNames.set(minimapName, index);
                }
            }

            const posX = checkNumber(entity.posX, `${where}: "posX"`, entityErrors);
            const posY = checkNumber(entity.posY, `${where}: "posY"`, entityErrors);
            const scale = checkNumber(entity.scale, `${where}: "scale"`, entityErrors);
            if (scale !== undefined && scale <= 0) entityErrors.push(`${where}: "scale" must be greater than 0 (got ${scale})`);

            const zMin = entity.zMin === undefined ? defaultZMin : checkNumber(entity.zMin, `${where}: "zMin"`, entityErrors);
            const zMax = entity.zMax === undefined ? defaultZMax : checkNumber(entity.zMax, `${where}: "zMax"`, entityErrors);
            if (zMin !== undefined && zMax !== undefined && zMin >= zMax) {
                entityErrors.push(`${where}: zMin (${zMin}) must be less than zMax (${zMax})`);
            }

            const { image } = entity;
            if (image !== undefined && (typeof image !== "string" || image === "" || /[\\/]/.test(image))) {
                entityErrors.push(`${where}: "image" must be a file name inside images/ (got ${JSON.stringify(image)})`);
            }

            errors.push(...entityErrors);
            if (
                entityErrors.length > 0 ||
                minimapName === undefined ||
                posX === undefined ||
                posY === undefined ||
                scale === undefined ||
                zMin === undefined ||
                zMax === undefined
            ) {
                return;
            }
            volumes.push({
                minimapName,
                targetname: `${namePrefix ?? ""}${minimapName}`,
                posX,
                posY,
                scale,
                zMin,
                zMax,
                imagePath: join(imageDir, typeof image === "string" ? image : `${minimapName}_radar_psd.png`),
            });
        });
    }

    if (errors.length > 0 || levelName === undefined || output === undefined) {
        throw new ConfigError(`Invalid minimap config:\n  - ${errors.join("\n  - ")}`);
    }
    return { levelName, ...output, volumes };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const checkName = (value: unknown, label: string, errors: string[], allowEmpty: boolean): string | undefined => {
    if (value === undefined) {
        errors.push(`${label} is required`);
    } else if (typeof value !== "string" || (!allowEmpty && value.trim() === "")) {
        errors.push(`${label} must be a ${allowEmpty ? "" : "non-empty "}string`);
    } else if (!NAME_PATTERN.test(value)) {
        errors.push(`${label} may only contain ${NAME_CHARS} (got "${value}")`);
    } else {
        return value;
    }
    return undefined;
};

const checkOutputFile = (value: unknown, addonRoot: string, errors: string[]) => {
    if (typeof value !== "string" || value.trim() === "") {
        errors.push(`"outputFile" is required and must be a non-empty string`);
        return undefined;
    }
    if (isAbsolute(value)) {
        errors.push(`"outputFile" must be relative to the addon root (got "${value}")`);
        return undefined;
    }
    const outputPath = resolve(addonRoot, value);
    const rel = relative(addonRoot, outputPath);
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
        errors.push(`"outputFile" must point inside the addon root (got "${value}")`);
        return undefined;
    }
    if (!outputPath.toLowerCase().endsWith(".vmap")) {
        errors.push(`"outputFile" must end in .vmap (got "${value}")`);
        return undefined;
    }
    return { outputFile: normalize(rel).split(sep).join("/"), outputPath };
};

const checkNumber = (value: unknown, label: string, errors: string[]): number | undefined => {
    if (value === undefined) {
        errors.push(`${label} is required`);
        return undefined;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push(`${label} must be a finite number (got ${JSON.stringify(value)})`);
        return undefined;
    }
    return value;
};

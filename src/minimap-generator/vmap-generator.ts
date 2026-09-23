import { createHash } from "node:crypto";
import {
    EDGE_COUNT,
    FACE_COUNT,
    FACE_TEXTURE_AXIS_U,
    FACE_TEXTURE_AXIS_V,
    FACE_TEXTURE_SCALE,
    FACE_VERTEX_NORMALS,
    FACE_VERTEX_TANGENTS,
    HALF_EDGE_COUNT,
    TOPOLOGY,
    VERTEX_COUNT,
    buildCuboidMesh,
    type CuboidMesh,
    type Vec3,
} from "./cuboid-mesh.ts";

export type VolumeBox = {
    minimapName: string;
    targetname: string;
    /** World-space minimum corner. */
    min: Vec3;
    /** World-space maximum corner. */
    max: Vec3;
};

// Values copied from a Hammer-saved reference prefab (editor build 10924).
const HEADER = "<!-- dmx encoding keyvalues2 4 format vmap 40 -->";
const EDITOR_BUILD = "10924";
const EDITOR_VERSION = "400";
const MATERIAL = "materials/tools/toolstrigger.vmat";
const CLASSNAME = "cs_minimap_volume";
// Hammer wrote this for both reference volumes (default flags for this class).
const SPAWNFLAGS = "4097";

/*
 * Minimal KeyValues2 model. Each attribute is [name, type, value] where value is a string
 * (scalar), string[] (*_array), a nested element, or Element[] (element_array).
 */
type Element = { type: string; id: string; attrs: Attr[] };
type Attr = [name: string, type: string, value: string | string[] | Element | Element[]];

const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const num = (n: number) => String(Object.is(n, -0) ? 0 : n);

const vec = (v: number[]) => v.map(num).join(" ");

const writeElementBody = (element: Element, indent: string, out: string[]) => {
    const inner = indent + "\t";
    out.push(`${indent}{`);
    out.push(`${inner}"id" "elementid" ${quote(element.id)}`);
    for (const [name, type, value] of element.attrs) {
        if (typeof value === "string") {
            out.push(`${inner}${quote(name)} ${quote(type)} ${quote(value)}`);
        } else if (Array.isArray(value)) {
            out.push(`${inner}${quote(name)} ${quote(type)} `);
            out.push(`${inner}[`);
            value.forEach((item: string | Element, i) => {
                const comma = i < value.length - 1 ? "," : "";
                if (typeof item === "string") {
                    out.push(`${inner}\t${quote(item)}${comma}`);
                } else {
                    out.push(`${inner}\t${quote(item.type)}`);
                    writeElementBody(item, inner + "\t", out);
                    out[out.length - 1] += comma;
                }
            });
            out.push(`${inner}]`);
        } else {
            out.push(`${inner}${quote(name)} ${quote(type)}`);
            writeElementBody(value, inner, out);
            out.push("");
        }
    }
    out.push(`${indent}}`);
};

const serialize = (roots: Element[]) => {
    const out = [HEADER];
    for (const root of roots) {
        out.push(quote(root.type));
        writeElementBody(root, "", out);
    }
    out.push("");
    return out.join("\r\n") + "\r\n";
};

/*
 * Deterministic identities. Every id is derived from (output file, owner, sequence) so an
 * unchanged config regenerates byte-identical output, and ids are stable per minimapName
 * even if entities are reordered.
 */
class IdSource {
    private readonly scope: string;
    private counter = 0;

    constructor(scope: string) {
        this.scope = scope;
    }

    /** RFC 4122 name-based (v5-style) UUID. */
    uuid() {
        const hash = createHash("sha1").update(`${this.scope}#uuid#${this.counter++}`).digest();
        hash[6] = (hash[6] & 0x0f) | 0x50;
        hash[8] = (hash[8] & 0x3f) | 0x80;
        const hex = hash.subarray(0, 16).toString("hex");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    /** Non-zero uint64 in Hammer's "0x..." form (0x0 means "no reference"). */
    referenceId() {
        const hash = createHash("sha256").update(`${this.scope}#ref#${this.counter++}`).digest();
        let value = hash.readBigUInt64BE(0);
        if (value === 0n) value = 1n;
        return `0x${value.toString(16)}`;
    }
}

const element = (ids: IdSource, type: string, attrs: Attr[]): Element => ({ type, id: ids.uuid(), attrs });

const transformPin = (ids: IdSource) =>
    element(ids, "DmElement", [
        ["name", "string", "transformPin"],
        ["referenceName", "string", ""],
        ["targetReferenceID", "uint64", "0x0"],
        ["offsetOrigin", "vector3", "0 0 0"],
        ["offsetAngles", "qangle", "0 0 0"],
        ["pinAngles", "bool", "1"],
        ["twoWay", "bool", "0"],
    ]);

const emptyPlugList = (ids: IdSource) =>
    element(ids, "DmePlugList", [
        ["names", "string_array", []],
        ["dataTypes", "int_array", []],
        ["plugTypes", "int_array", []],
        ["descriptions", "string_array", []],
    ]);

type MapNodeIdentity = { nodeId: number; referenceId: string; children?: Element[]; origin?: Vec3 };

/** A CMapNode: Hammer writes node identity first, then the type's own attributes, then the transform. */
const mapNode = (
    ids: IdSource,
    type: string,
    { nodeId, referenceId, children = [], origin = [0, 0, 0] }: MapNodeIdentity,
    attrs: Attr[],
) =>
    element(ids, type, [
        ["nodeID", "int", String(nodeId)],
        ["referenceID", "uint64", referenceId],
        ["children", "element_array", children],
        ...attrs,
        ["origin", "vector3", vec(origin)],
        ["angles", "qangle", "0 0 0"],
        ["scales", "vector3", "1 1 1"],
        ["transformPin", "DmElement", transformPin(ids)],
    ]);

const stream = (ids: IdSource, semantic: string, dataStateFlags: string, dataType: string, data: string[]) =>
    element(ids, "CDmePolygonMeshDataStream", [
        ["name", "string", `${semantic}:0`],
        ["standardAttributeName", "string", semantic],
        ["semanticName", "string", semantic],
        ["semanticIndex", "int", "0"],
        ["vertexBufferLocation", "int", "0"],
        ["dataStateFlags", "int", dataStateFlags],
        ["subdivisionBinding", "element", ""],
        ["data", dataType, data],
    ]);

const dataArray = (ids: IdSource, size: number, streams: Element[]) =>
    element(ids, "CDmePolygonMeshDataArray", [
        ["size", "int", String(size)],
        ["streams", "element_array", streams],
    ]);

const repeat = (count: number, value: string): string[] => new Array(count).fill(value);

const polygonMesh = (ids: IdSource, mesh: CuboidMesh) =>
    element(ids, "CDmePolygonMesh", [
        ["name", "string", "meshData"],
        ...Object.entries(TOPOLOGY).map(([name, values]): Attr => [name, "int_array", values.map(String)]),
        ["materials", "string_array", [MATERIAL]],
        [
            "vertexData",
            "CDmePolygonMeshDataArray",
            dataArray(ids, VERTEX_COUNT, [stream(ids, "position", "3", "vector3_array", mesh.positions.map(vec))]),
        ],
        [
            "faceVertexData",
            "CDmePolygonMeshDataArray",
            dataArray(ids, HALF_EDGE_COUNT, [
                stream(ids, "texcoord", "1", "vector2_array", mesh.texcoords.map(vec)),
                stream(ids, "normal", "1", "vector3_array", FACE_VERTEX_NORMALS),
                stream(ids, "tangent", "1", "vector4_array", FACE_VERTEX_TANGENTS),
            ]),
        ],
        [
            "edgeData",
            "CDmePolygonMeshDataArray",
            dataArray(ids, EDGE_COUNT, [stream(ids, "flags", "3", "int_array", repeat(EDGE_COUNT, "0"))]),
        ],
        [
            "faceData",
            "CDmePolygonMeshDataArray",
            dataArray(ids, FACE_COUNT, [
                stream(ids, "textureScale", "0", "vector2_array", repeat(FACE_COUNT, vec(FACE_TEXTURE_SCALE))),
                stream(ids, "textureAxisU", "0", "vector4_array", FACE_TEXTURE_AXIS_U.map(vec)),
                stream(ids, "textureAxisV", "0", "vector4_array", FACE_TEXTURE_AXIS_V.map(vec)),
                stream(ids, "materialindex", "8", "int_array", repeat(FACE_COUNT, "0")),
                stream(ids, "flags", "3", "int_array", repeat(FACE_COUNT, "0")),
                stream(ids, "lightmapScaleBias", "1", "int_array", repeat(FACE_COUNT, "0")),
            ]),
        ],
        [
            "subdivisionData",
            "CDmePolygonMeshSubdivisionData",
            element(ids, "CDmePolygonMeshSubdivisionData", [
                ["subdivisionLevels", "int_array", repeat(HALF_EDGE_COUNT, "0")],
                ["streams", "element_array", []],
            ]),
        ],
    ]);

/**
 * One cs_minimap_volume with its cuboid mesh as the only child. Entity and mesh share the cuboid's
 * world-space center as origin, as Hammer saves them.
 * @param nodeId First of the two node ids this entity uses.
 */
const minimapEntity = (volume: VolumeBox, scope: string, nodeId: number) => {
    const ids = new IdSource(`${scope}|entity|${volume.minimapName}`);
    const mesh = buildCuboidMesh(volume.min, volume.max);

    const meshNode = mapNode(
        ids,
        "CMapMesh",
        { nodeId: nodeId + 1, referenceId: ids.referenceId(), origin: mesh.origin },
        [["meshData", "CDmePolygonMesh", polygonMesh(ids, mesh)]],
    );
    return mapNode(
        ids,
        "CMapEntity",
        { nodeId, referenceId: ids.referenceId(), children: [meshNode], origin: mesh.origin },
        [
            ["relayPlugData", "DmePlugList", emptyPlugList(ids)],
            [
                "entity_properties",
                "EditGameClassProps",
                element(ids, "EditGameClassProps", [
                    ["classname", "string", CLASSNAME],
                    ["targetname", "string", volume.targetname],
                    ["minimap_name", "string", volume.minimapName],
                    ["StartDisabled", "string", "1"],
                    ["spawnflags", "string", SPAWNFLAGS],
                ]),
            ],
        ],
    );
};

/**
 * Builds the complete prefab. The config is the only input; nothing is read from any previous output.
 * @param outputFile Normalized addon-relative path, used to scope generated ids.
 */
export const generateVmap = (volumes: VolumeBox[], outputFile: string): string => {
    const scope = outputFile.toLowerCase();
    const ids = new IdSource(`${scope}|root`);

    // Node ids follow Hammer's layout: visibility manager 0, world 1, then entity/mesh pairs.
    const entities = volumes.map((volume, i) => minimapEntity(volume, scope, 2 + i * 2));

    // Hammer's asset summary header; it rewrites this on save.
    const hasVolumes = volumes.length > 0;
    const prefix = element(ids, "$prefix_element$", [
        ["map_subasset_reference_counts", "int_array", hasVolumes ? [String(volumes.length)] : []],
        ["map_subasset_reference_names", "string_array", hasVolumes ? [CLASSNAME] : []],
        ["map_subasset_reference_types", "string_array", hasVolumes ? ["entity"] : []],
        ["map_asset_references", "string_array", hasVolumes ? [MATERIAL] : []],
    ]);

    const world = mapNode(ids, "CMapWorld", { nodeId: 1, referenceId: "0x0", children: entities }, [
        ["relayPlugData", "DmePlugList", emptyPlugList(ids)],
        ["entity_properties", "EditGameClassProps", element(ids, "EditGameClassProps", [["classname", "string", "worldspawn"]])],
        // Off, so the volumes keep their exact targetnames when the prefab is instanced. With it on,
        // Hammer compiles them as "[PR#]<instance id>_dynamic_minimap_..." and the script's
        // EntFireAtName("dynamic_minimap_<map>", "Enable") never finds them.
        ["fixupEntityNames", "bool", "0"],
        ["mapUsageType", "string", "standard"],
    ]);

    const visibility = mapNode(ids, "CVisibilityMgr", { nodeId: 0, referenceId: "0x0" }, [
        ["nodes", "element_array", []],
        ["hiddenFlags", "int_array", []],
    ]);

    const root = element(ids, "CMapRootElement", [
        ["isprefab", "bool", "0"],
        ["editorbuild", "int", EDITOR_BUILD],
        ["editorversion", "int", EDITOR_VERSION],
        ["itemFile", "string", ""],
        ["world", "CMapWorld", world],
        // Hammer's own (misspelled) attribute name.
        ["visbility", "CVisibilityMgr", visibility],
        [
            "mapVariables",
            "CMapVariableSet",
            element(ids, "CMapVariableSet", [
                ["variableNames", "string_array", []],
                ["variableValues", "string_array", []],
                ["variableTypeNames", "string_array", []],
                ["variableTypeParameters", "string_array", []],
                ["variableGroupNames", "string_array", []],
                ["m_ChoiceGroups", "element_array", []],
                ["variableAndChoiceOrder", "int_array", []],
            ]),
        ],
        [
            "rootSelectionSet",
            "CMapSelectionSet",
            element(ids, "CMapSelectionSet", [
                ["children", "element_array", []],
                ["selectionSetName", "string", ""],
                ["selectionSetData", "element", ""],
            ]),
        ],
    ]);

    assertUniqueIds([prefix, root]);
    return serialize([prefix, root]);
};

const assertUniqueIds = (roots: Element[]) => {
    const seen = new Set<string>();
    const claim = (kind: string, value: string) => {
        const key = `${kind}:${value}`;
        if (seen.has(key)) throw new Error(`Generated duplicate ${kind} ${value}`);
        seen.add(key);
    };
    const visit = (el: Element) => {
        claim("elementid", el.id);
        for (const [name, , value] of el.attrs) {
            if (typeof value === "string") {
                if (name === "nodeID") claim("nodeID", value);
                if (name === "referenceID" && value !== "0x0") claim("referenceID", value);
            } else if (Array.isArray(value)) {
                value.forEach((item: string | Element) => typeof item !== "string" && visit(item));
            } else {
                visit(value);
            }
        }
    };
    roots.forEach(visit);
};

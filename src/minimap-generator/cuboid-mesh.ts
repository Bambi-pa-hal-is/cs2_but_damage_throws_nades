// Canonical Hammer cuboid, taken verbatim from two cuboid meshes in a Hammer-saved reference
// prefab. Both were identical apart from element ids and origin, so everything here except vertex
// positions and texcoords is constant.

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

// Sign of each vertex on (x, y, z), in the reference's vertex order.
const VERTEX_SIGNS: Vec3[] = [
    [-1, -1, 1],
    [1, -1, 1],
    [-1, 1, 1],
    [1, 1, -1],
    [-1, 1, -1],
    [1, 1, 1],
    [1, -1, -1],
    [-1, -1, -1],
];

export const TOPOLOGY = {
    vertexEdgeIndices: [0, 1, 22, 15, 8, 14, 6, 18],
    vertexDataIndices: [0, 1, 2, 3, 4, 5, 6, 7],
    edgeVertexIndices: [1, 0, 5, 1, 2, 5, 1, 6, 3, 4, 6, 3, 7, 6, 3, 5, 7, 4, 0, 7, 2, 0, 4, 2],
    edgeOppositeIndices: [1, 0, 3, 2, 5, 4, 7, 6, 9, 8, 11, 10, 13, 12, 15, 14, 17, 16, 19, 18, 21, 20, 23, 22],
    edgeNextIndices: [2, 19, 4, 7, 21, 14, 1, 11, 10, 23, 12, 15, 17, 6, 9, 3, 18, 8, 20, 13, 22, 0, 16, 5],
    edgeFaceIndices: [0, 5, 0, 3, 0, 4, 5, 3, 1, 4, 1, 3, 1, 5, 4, 3, 2, 1, 2, 5, 2, 0, 2, 4],
    edgeDataIndices: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
    edgeVertexDataIndices: [1, 0, 3, 2, 5, 4, 6, 7, 9, 8, 11, 10, 13, 12, 14, 15, 17, 16, 19, 18, 21, 20, 23, 22],
    faceEdgeIndices: [21, 17, 22, 15, 14, 6],
    faceDataIndices: [0, 1, 2, 3, 4, 5],
} satisfies Record<string, number[]>;

export const VERTEX_COUNT = VERTEX_SIGNS.length;
export const HALF_EDGE_COUNT = TOPOLOGY.edgeVertexIndices.length;
export const EDGE_COUNT = HALF_EDGE_COUNT / 2;
export const FACE_COUNT = TOPOLOGY.faceEdgeIndices.length;

// Per face-vertex (indexed by face-vertex data index), verbatim strings incl. Hammer's "-0".
export const FACE_VERTEX_NORMALS = [
    "0 -1 0", "0 0 1", "1 0 0", "0 0 1", "0 1 0", "0 0 1", "0 -1 0", "1 0 0",
    "0 1 0", "0 0 -1", "1 0 0", "0 0 -1", "0 -1 0", "0 0 -1", "0 1 0", "1 0 0",
    "0 0 -1", "-1 0 0", "0 -1 0", "-1 0 0", "0 0 1", "-1 0 0", "0 1 0", "-1 0 0",
];
export const FACE_VERTEX_TANGENTS = [
    "1 0 0 -1", "1 0 0 -1", "0 1 0 -1", "1 0 0 -1", "1 -0 0 1", "1 0 0 -1", "1 0 0 -1", "0 1 0 -1",
    "1 -0 0 1", "1 0 0 1", "0 1 0 -1", "1 0 0 1", "1 0 0 -1", "1 0 0 1", "1 -0 0 1", "0 1 0 -1",
    "1 0 0 1", "0 1 0 1", "1 0 0 -1", "0 1 0 1", "1 0 0 -1", "0 1 0 1", "1 -0 0 1", "0 1 0 1",
];

// Per face (indexed by face data index).
export const FACE_TEXTURE_SCALE: Vec2 = [0.125, 0.125];
export const FACE_TEXTURE_AXIS_U: Vec4[] = [
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 1, 0, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
];
export const FACE_TEXTURE_AXIS_V: Vec4[] = [
    [0, -1, 0, 0],
    [0, -1, 0, 0],
    [0, 0, -1, 0],
    [0, 0, -1, 0],
    [0, 0, -1, 0],
    [0, 0, -1, 0],
];

// Face-vertex data index -> [vertex, face] it belongs to. A half-edge's face-vertex data is the
// corner at the half-edge's destination vertex inside the half-edge's face.
const FACE_VERTEX_CORNERS = (() => {
    const corners = new Array<[vertex: number, face: number]>(HALF_EDGE_COUNT);
    for (let edge = 0; edge < HALF_EDGE_COUNT; edge++) {
        corners[TOPOLOGY.edgeVertexDataIndices[edge]] = [TOPOLOGY.edgeVertexIndices[edge], TOPOLOGY.edgeFaceIndices[edge]];
    }
    return corners;
})();

export type CuboidMesh = {
    /** World-space center; used as both entity and mesh origin. */
    origin: Vec3;
    /** Vertex positions relative to origin. */
    positions: Vec3[];
    /** World-aligned UVs per face-vertex. */
    texcoords: Vec2[];
};

const mapVec3 = (fn: (axis: number) => number): Vec3 => [fn(0), fn(1), fn(2)];

export const buildCuboidMesh = (min: Vec3, max: Vec3): CuboidMesh => {
    const origin = mapVec3((i) => (min[i] + max[i]) / 2);
    const half = mapVec3((i) => (max[i] - min[i]) / 2);
    const positions = VERTEX_SIGNS.map((signs) => mapVec3((i) => signs[i] * half[i]));

    // Hammer stores world-aligned texture projection: uv = dot(worldPos, axis) * textureScale.
    // This reproduces every texcoord in the reference exactly.
    const texcoords = FACE_VERTEX_CORNERS.map(([vertex, face]): Vec2 => {
        const world = mapVec3((i) => (VERTEX_SIGNS[vertex][i] > 0 ? max[i] : min[i]));
        const faceData = TOPOLOGY.faceDataIndices[face];
        return [
            dot(world, FACE_TEXTURE_AXIS_U[faceData]) * FACE_TEXTURE_SCALE[0],
            dot(world, FACE_TEXTURE_AXIS_V[faceData]) * FACE_TEXTURE_SCALE[1],
        ];
    });

    return { origin, positions, texcoords };
};

const dot = (p: Vec3, axis: Vec4) => p[0] * axis[0] + p[1] * axis[1] + p[2] * axis[2];

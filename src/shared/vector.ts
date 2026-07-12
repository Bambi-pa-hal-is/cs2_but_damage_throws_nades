import type { Vector } from "cs_script/point_script";

export const vectorLength = (v: Vector): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

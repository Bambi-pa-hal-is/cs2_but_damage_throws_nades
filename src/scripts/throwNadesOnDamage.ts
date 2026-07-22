import { CSDamageTypes, CSPlayerPawn, Entity, Instance, type QAngle, type Vector } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { getGameHasStarted } from "../shared/gamestate";
import { forceSpawnTemplate } from "../shared/spawn";
import { vectorLength } from "../shared/vector";
import * as timers from "../shared/timers";

export type NadeType = "he" | "flashbang" | "smoke" | "molotov" | "decoy";

export interface ThrowNadesConfiguration {
    throwGrenadeWhenShooting: boolean;
    chanceToThrowGrenadeWhenShooting: number;
    throwGrenadeWhenDealingDamage: boolean;
    chanceToThrowGrenadeWhenDealingDamage: number;
    isHeAllowed: boolean;
    isFlashbangAllowed: boolean;
    isSmokeAllowed: boolean;
    isMolotovAllowed: boolean;
    isDecoyAllowed: boolean;
    onlyEquippedNades: boolean;
    projectileSpeed: number;
    playerHealth: number;
}

let configuration: ThrowNadesConfiguration = {
    throwGrenadeWhenShooting: false,
    chanceToThrowGrenadeWhenShooting: 1.0,
    throwGrenadeWhenDealingDamage: true,
    chanceToThrowGrenadeWhenDealingDamage: 1.0,
    isHeAllowed: true,
    isFlashbangAllowed: false,
    isSmokeAllowed: true,
    isMolotovAllowed: true,
    isDecoyAllowed: false,
    onlyEquippedNades: false,
    projectileSpeed: 675.0,
    playerHealth: 300,
};

// The UI module reads/writes fields on this directly - it's the single shared source of truth.
export const getConfiguration = (): ThrowNadesConfiguration => configuration;

// The real thrown projectile, same templates as before. These fly with proper physics but,
// since Valve's engine update, he/smoke/molotov no longer self-detonate when spawned via script.
const projectileTemplateNameByType: Record<NadeType, string> = {
    he: "hegrenade_point_template",
    flashbang: "flashbang_point_template",
    smoke: "smokegrenade_point_template",
    molotov: "molotov_point_template",
    decoy: "decoy_point_template",
};

// Workaround for the types that no longer self-detonate: alongside the real projectile, also spawn
// a pickup-able "dropped" grenade from the *_action_point_template. Damaging it forces detonation
// (requires mp_shoot_dropped_grenades 1). Flashbang still detonates normally on its own, so it has
// no entry here and keeps using only the real projectile above.
const actionTemplateNameByType: Partial<Record<NadeType, string>> = {
    he: "he_action_point_template",
    smoke: "smoke_action_point_template",
    molotov: "molotov_action_point_template",
    decoy: "decoy_action_point_template",
};

// Used to detect which grenades a player actually has equipped (for onlyEquippedNades) and, for the
// molotov family specifically, whether they're carrying a real molotov or an incendiary.
const weaponNamesByNadeType: Record<NadeType, string[]> = {
    he: ["weapon_hegrenade"],
    flashbang: ["weapon_flashbang"],
    smoke: ["weapon_smokegrenade"],
    molotov: ["weapon_molotov", "weapon_incgrenade"],
    decoy: ["weapon_decoy"],
};

const isNadeTypeEquipped = (pawn: CSPlayerPawn, nadeType: NadeType): boolean =>
    weaponNamesByNadeType[nadeType].some((weaponName) => pawn.FindWeapon(weaponName) !== undefined);

const INCENDIARY_WEAPON_NAME = "weapon_incgrenade";
const INCENDIARY_ACTION_TEMPLATE_NAME = "inc_action_point_template";

// The incendiary grenade's own projectile is bugged and can't be spawned, so the molotov family
// always launches via the molotov projectile (see projectileTemplateNameByType). But if the player
// is actually carrying an incendiary rather than a real molotov, the detonation pickup - and
// therefore the resulting fire - should still look/act like an incendiary.
const getActionTemplateName = (pawn: CSPlayerPawn, nadeType: NadeType): string | undefined => {
    if (nadeType === "molotov" && pawn.FindWeapon(INCENDIARY_WEAPON_NAME) !== undefined) {
        return INCENDIARY_ACTION_TEMPLATE_NAME;
    }
    return actionTemplateNameByType[nadeType];
};

// Condition that decides when a spawned grenade gets force-detonated via damage. He/molotov use a
// fixed delay; smoke and decoy instead wait until they stop moving (settled on the ground), matching
// how they'd normally pop once at rest.
type DetonationTrigger =
    | { kind: "delay"; seconds: number }
    | { kind: "stoppedMoving"; speedThreshold: number };

const STOPPED_MOVING_SPEED_THRESHOLD = 5.0;

const detonationTriggerByNadeType: Partial<Record<NadeType, DetonationTrigger>> = {
    he: { kind: "delay", seconds: 1.5 },
    smoke: { kind: "stoppedMoving", speedThreshold: STOPPED_MOVING_SPEED_THRESHOLD },
    molotov: { kind: "delay", seconds: 1.5 },
    decoy: { kind: "stoppedMoving", speedThreshold: STOPPED_MOVING_SPEED_THRESHOLD },
};

export const onActivate = () => {
    Instance.ServerCommand("mp_shoot_dropped_grenades 1");
    timers.setTimeout(processPending, 0);
};

const deg2rad = (deg: number) => { return (deg * Math.PI) / 180.0; }

const forwardFromAngles = (ang: { pitch: number; yaw: number; }) => {
    // Source pitch: +down, -up. Roll unused for forward vector.
    const cp = Math.cos(deg2rad(ang.pitch));
    const sp = Math.sin(deg2rad(ang.pitch));
    const cy = Math.cos(deg2rad(ang.yaw));
    const sy = Math.sin(deg2rad(ang.yaw));
    return { x: cp * cy, y: cp * sy, z: -sp };
}

const vecScale = (v: { x: number; y: number; z: number; }, s: number) => {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
};

const spawnAndLaunch = (templateName: string, pawn: CSPlayerPawn, eyePos: Vector, eyeAng: QAngle, velocity: Vector) : Entity | undefined => {
    const spawned = forceSpawnTemplate(templateName, eyePos, eyeAng);
    if (!spawned) return;
    const entity = spawned[0];

    entity.SetOwner(pawn); //Does this even do anything?!?!
    entity.Teleport({
        position: eyePos,
        angles: eyeAng,
        velocity: velocity
    });
    //according to the wiki this is supposed to activate the grenade but it does not https://developer.valvesoftware.com/wiki/Molotov_projectile
    Instance.EntFireAtTarget({
        target: entity,
        input: "InitializeSpawnFromWorld",
        activator: pawn,
        caller: pawn,
        delay: 0
    });

    return entity;
};

type PendingDetonation = { nadeType: NadeType; projectile: Entity; pawn: CSPlayerPawn; detonateAt?: number; actionTemplateName: string };

let pendingDetonations: PendingDetonation[] = [];

const scheduleDetonation = (nadeType: NadeType, projectile: Entity, pawn: CSPlayerPawn, trigger: DetonationTrigger, actionTemplateName: string) => {
    const detonateAt = trigger.kind === "delay" ? Instance.GetGameTime() + trigger.seconds : undefined;
    pendingDetonations.push({ nadeType, projectile, pawn, detonateAt, actionTemplateName });
};

const isReadyToDetonate = (pending: PendingDetonation, now: number): boolean => {
    const trigger = detonationTriggerByNadeType[pending.nadeType];
    if (!trigger) return true;

    if (trigger.kind === "delay") {
        return pending.detonateAt !== undefined && now >= pending.detonateAt;
    }

    const speed = vectorLength(pending.projectile.GetAbsVelocity());
    return speed < trigger.speedThreshold;
};

// Tracks the type/thrower of every live projectile so other events (e.g. OnGrenadeBounce) can
// identify which nade type they're dealing with, since those events only expose the entity.
type ThrownProjectile = { entity: Entity; nadeType: NadeType; pawn: CSPlayerPawn; actionTemplateName?: string; lastVelocityZ?: number; lastSampleTime?: number };

let thrownProjectiles: ThrownProjectile[] = [];

const trackProjectile = (entity: Entity, nadeType: NadeType, pawn: CSPlayerPawn, actionTemplateName?: string) => {
    thrownProjectiles.push({ entity, nadeType, pawn, actionTemplateName });
};

const untrackProjectile = (entity: Entity) => {
    const index = thrownProjectiles.findIndex((p) => p.entity === entity);
    if (index !== -1) {
        thrownProjectiles.splice(index, 1);
    }
};

// There's no gravity getter/setter in the cs_script API, so gravity can't be read or set directly.
// Each tracked nade's actual fall acceleration is measured every tick (logged below) by diffing
// velocity.z between ticks. test_grenade_physics.ts measured real native HE throws falling at a
// consistent -320 u/s^2 (12/12 samples, exact match every time) - the same number originally
// flagged as flashbang's "anomaly". Our own ForceSpawn'd he/smoke/molotov/decoy replicas default to
// generic-physics-prop gravity (~800 u/s^2) instead, so those are the ones that are actually wrong
// and need pulling down to 320 to match real grenades. Flashbang's replica already naturally falls
// at 320, so it's left out here (no correction needed). For any type listed here, its measured
// acceleration gets corrected up/down toward the given target (u/s^2) every tick.
const gravityAccelTargetByNadeType: Partial<Record<NadeType, number>> = {
    he: 320,
    smoke: 320,
    molotov: 320,
    decoy: 320,
};

const updateProjectileGravity = (tracked: ThrownProjectile, now: number) => {
    if (!tracked.entity.IsValid()) return;

    const velocity = tracked.entity.GetAbsVelocity();

    if (tracked.lastVelocityZ !== undefined && tracked.lastSampleTime !== undefined) {
        const dt = now - tracked.lastSampleTime;
        if (dt > 0) {
            const measuredAccel = (tracked.lastVelocityZ - velocity.z) / dt;

            const targetAccel = gravityAccelTargetByNadeType[tracked.nadeType];
            if (targetAccel !== undefined) {
                // velocity.z already reflects this tick's real (wrong) acceleration; add back the
                // difference between what actually happened and what we want to have happened.
                const newVelocityZ = velocity.z + (measuredAccel - targetAccel) * dt;
                tracked.entity.Teleport({ velocity: { x: velocity.x, y: velocity.y, z: newVelocityZ } });
            }
        }
    }

    tracked.lastVelocityZ = velocity.z;
    tracked.lastSampleTime = now;
};

// Spawns the correct pickup grenade for this nade type at the projectile's current position,
// damages it to force detonation, then instantly kills it - it only exists to trigger the explosion.
const detonate = (pending: PendingDetonation) => {
    // Idempotent: whether this was triggered by the timer or by an early wall bounce, make sure
    // there's no leftover scheduled detonation left to fire again for the same projectile.
    pendingDetonations = pendingDetonations.filter((p) => p.projectile !== pending.projectile);
    untrackProjectile(pending.projectile);

    const position = pending.projectile.IsValid() ? pending.projectile.GetAbsOrigin() : pending.pawn.GetEyePosition();

    if (pending.projectile.IsValid()) {
        Instance.EntFireAtTarget({ target: pending.projectile, input: "kill" });
    }

    const actionTemplateName = pending.actionTemplateName;

    const eyeAng = pending.pawn.GetEyeAngles();
    const pickupGrenade = spawnAndLaunch(actionTemplateName, pending.pawn, position, eyeAng, { x: 0, y: 0, z: 0 });
    if (!pickupGrenade) {
        Instance.Msg(`Failed to spawn pickup grenade ${actionTemplateName} for ${pending.nadeType} detonation`);
        return;
    }

    pickupGrenade.TakeDamage({ damage: 100, damageTypes: CSDamageTypes.BULLET, attacker: pending.pawn });
    Instance.EntFireAtTarget({ target: pickupGrenade, input: "kill", delay: 0.5 });
};

// Runs every tick via the shared timer module (self-reschedules with a 0s delay) instead of
// index.ts pumping a dedicated think() export.
const processPending = () => {
    const now = Instance.GetGameTime();
    const remaining: PendingDetonation[] = [];
    for (const pending of pendingDetonations) {
        if (!pending.projectile.IsValid()) {
            // Already gone by some other means (e.g. a smoke consumed by a burning molotov
            // detonates itself) - our workaround has nothing left to do, just drop it.
            untrackProjectile(pending.projectile);
            continue;
        }

        if (isReadyToDetonate(pending, now)) {
            detonate(pending);
        } else {
            remaining.push(pending);
        }
    }
    pendingDetonations = remaining;

    for (const tracked of thrownProjectiles) {
        updateProjectileGravity(tracked, now);
    }
    thrownProjectiles = thrownProjectiles.filter((p) => p.entity.IsValid());

    timers.setTimeout(processPending, 0);
};

// Real CS2 grenades get a slight upward toss baked into the throw regardless of exact aim (confirmed
// by throwing dead-level with a static crosshair and still measuring upward velocity). Without this,
// ours launch perfectly flat and fly noticeably straighter than the real thing. Starting guess - tune
// by comparing a level-aim mod throw against a level-aim real throw in test_grenade_physics.ts.
const THROW_UPWARD_ANGLE_DEGREES = 12;

const throwNadeForPlayer = (pawn: CSPlayerPawn, nadeType: NadeType) : Entity | undefined => {
    const eyePos = pawn.GetEyePosition();
    const eyeAng = pawn.GetEyeAngles();
    // Source pitch is +down/-up, so subtracting tilts the launch direction upward.
    const throwAng = { pitch: eyeAng.pitch - THROW_UPWARD_ANGLE_DEGREES, yaw: eyeAng.yaw, roll: eyeAng.roll };
    const fwd = forwardFromAngles(throwAng);
    let velocity = vecScale(fwd, configuration.projectileSpeed);
    const playerVelocity = pawn.GetAbsVelocity();
    velocity.x += playerVelocity.x;
    velocity.y += playerVelocity.y;
    velocity.z += playerVelocity.z;

    const projectile = spawnAndLaunch(projectileTemplateNameByType[nadeType], pawn, eyePos, eyeAng, velocity);
    if (!projectile) return;

    // Resolved once, at throw time, so a later weapon switch can't change what the detonation
    // (scheduled or bounce-triggered) ends up spawning.
    const actionTemplateName = getActionTemplateName(pawn, nadeType);
    trackProjectile(projectile, nadeType, pawn, actionTemplateName);

    const detonationTrigger = detonationTriggerByNadeType[nadeType];
    if (detonationTrigger !== undefined && actionTemplateName) {
        scheduleDetonation(nadeType, projectile, pawn, detonationTrigger, actionTemplateName);
    } else {
        // Self-detonating nades (flashbang/decoy): fall back to the old safety-net kill.
        Instance.EntFireAtTarget({
            target: projectile,
            input: "kill",
            delay: 10.0
        });
    }

    return projectile;
};

const getRandomAllowedNadeType = (pawn: CSPlayerPawn) : NadeType | null => {
    const allowedNades : NadeType[] = [];

    if (configuration.isHeAllowed) allowedNades.push("he");
    if (configuration.isFlashbangAllowed) allowedNades.push("flashbang");
    if (configuration.isSmokeAllowed) allowedNades.push("smoke");
    if (configuration.isMolotovAllowed) allowedNades.push("molotov");
    if (configuration.isDecoyAllowed) allowedNades.push("decoy");

    const candidates = configuration.onlyEquippedNades
        ? allowedNades.filter((nadeType) => isNadeTypeEquipped(pawn, nadeType))
        : allowedNades;

    if (candidates.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
};

// --- main hook ---
Instance.OnGunFire((event) => {
    if (!getGameHasStarted()) return;

    const shooter = event.weapon.GetOwner();
    if (!shooter) return;

    const randomValue = Math.random();
    if(configuration.throwGrenadeWhenShooting && randomValue < configuration.chanceToThrowGrenadeWhenShooting)
    {
        //throw nade
        const nadeType = getRandomAllowedNadeType(shooter);
        if(!nadeType) return;
        throwNadeForPlayer(shooter, nadeType);
    }
});

Instance.OnModifyPlayerDamage((event) => {
    if (!getGameHasStarted()) return;

    const attacker = event.attacker;
    if (!attacker) return;
    if (!(attacker instanceof CSPlayerPawn))
    {
        Instance.Msg("attacker not playercontroller");
        return;
    }
    const randomValue = Math.random();
    if(configuration.throwGrenadeWhenDealingDamage && randomValue < configuration.chanceToThrowGrenadeWhenDealingDamage)
    {
        //throw nade
        const nadeType = getRandomAllowedNadeType(attacker);
        if(!nadeType) return;
        throwNadeForPlayer(attacker, nadeType);
    }
});

persistOnReload("throwNadesOnDamage", {
    configuration: { get: () => configuration, set: (value) => { configuration = value; } },
    pendingDetonations: { get: () => pendingDetonations, set: (value) => { pendingDetonations = value; } },
    thrownProjectiles: { get: () => thrownProjectiles, set: (value) => { thrownProjectiles = value; } },
}, () => {
    // processPending's self-reschedule chain closes over this module instance's state. A tools-mode
    // reload clears callbacks and re-evaluates the module, so the already-scheduled call becomes a
    // stale closure that keeps ticking against orphaned state instead of the freshly restored one.
    // onActivate only fires on a real map load, not on reload, so restart the loop here too.
    timers.setTimeout(processPending, 0);
});

// Bounce speed loss applied to every grenade type, every bounce. Speed is reduced by a percentage
// first, then by a flat amount, and never goes below 0. Both knobs are here so they're easy to tune.
const BOUNCE_VELOCITY_PERCENT_LOSS = 0.15; // fraction of speed lost per bounce, e.g. 0.3 = lose 30%
const BOUNCE_VELOCITY_FLAT_LOSS = 15; // flat units/sec subtracted per bounce, after the percentage loss

//We need to apply a velocity loss because the friction or something is bugged for projectiles so they slide around forever. This is a workaround to make them slow down and eventually stop moving.
const applyBounceVelocityLoss = (entity: Entity) => {
    const velocity = entity.GetAbsVelocity();
    const speed = vectorLength(velocity);
    if (speed <= 0) return;

    const newSpeed = Math.max(0, speed * (1 - BOUNCE_VELOCITY_PERCENT_LOSS) - BOUNCE_VELOCITY_FLAT_LOSS);
    const scale = newSpeed / speed;

    entity.Teleport({
        velocity: { x: velocity.x * scale, y: velocity.y * scale, z: velocity.z * scale },
    });
};

// OnGrenadeBounce only gives us { projectile, bounces } - no surface info. To tell a wall bounce
// from a floor bounce, trace straight down from the bounce point: if solid ground is close below,
// the grenade is resting on the floor; if not, the bounce must have been off a wall.
// The trace starts a bit above the contact point instead of exactly on it - starting a trace on
// (or inside) the surface the grenade just hit gives unreliable didHit/fraction results.
// Ground contact detonates the molotov; a wall bounce just lets it keep bouncing.
const GROUND_TRACE_UP_OFFSET = 4;
const GROUND_TRACE_DISTANCE = 40;

Instance.OnGrenadeBounce((event) => {
    const tracked = thrownProjectiles.find((p) => p.entity === event.projectile);
    if (!tracked) return;

    applyBounceVelocityLoss(event.projectile);

    if (tracked.nadeType !== "molotov") return;

    const position = event.projectile.GetAbsOrigin();
    const traceStart = { x: position.x, y: position.y, z: position.z + GROUND_TRACE_UP_OFFSET };
    const traceEnd = { x: position.x, y: position.y, z: position.z - GROUND_TRACE_DISTANCE };

    const trace = Instance.TraceLine({ start: traceStart, end: traceEnd, ignoreEntity: event.projectile });
    if (!trace.didHit) return;

    detonate({
        nadeType: "molotov",
        projectile: event.projectile,
        pawn: tracked.pawn,
        detonateAt: Instance.GetGameTime(),
        actionTemplateName: tracked.actionTemplateName ?? actionTemplateNameByType.molotov!,
    });
});

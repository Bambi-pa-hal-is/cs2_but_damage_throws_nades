import { BaseModelEntity, CSDamageTypes, CSGearSlot, CSPlayerController, CSPlayerPawn, Entity, Instance, PointTemplate, type QAngle, type Vector } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { setEntityMessageByName } from "../shared/ui";

var configuration = {
    throwGrenadeWhenShooting: false,
    chanceToThrowGrenadeWhenShooting: 0.1,
    throwGrenadeWhenDealingDamage: true,
    chanceToThrowGrenadeWhenDealingDamage: 1.0,
    isHeAllowed : true,
    isFlashbangAllowed: true,
    isSmokeAllowed: true,
    isMolotovAllowed: true,
    isDecoyAllowed: false,
    onlyEquippedNades: true,
    projectileSpeed: 675.0,
}

type NadeType = "he" | "flashbang" | "smoke" | "molotov" | "decoy";

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

const updateCheck = (show: boolean, entityName: string) => {
    var check = Instance.FindEntityByName(entityName + "_check");
    if(check instanceof BaseModelEntity)
    {
        var size = show ? 1.0 : 0.0;
        check.SetModelScale(size);
    }
}

const updatePercentageText = (entityName: string, percent: number) => {
    var text = Math.floor(percent * 100) + "%";
    setEntityMessageByName(entityName, text);
}

export const onActivate = () => {
    Instance.ServerCommand("mp_shoot_dropped_grenades 1");
};

export const onRoundStart = () => {
    updateCheck(configuration.throwGrenadeWhenShooting, "throw_a_nade_when_shooting_button");
    updateCheck(configuration.throwGrenadeWhenDealingDamage, "throw_a_nade_when_dealing_damage_button");
    updateCheck(configuration.isHeAllowed, "allow_he_button");
    updateCheck(configuration.isFlashbangAllowed, "allow_flashbang_button");
    updateCheck(configuration.isSmokeAllowed, "allow_smoke_button");
    updateCheck(configuration.isMolotovAllowed, "allow_molotov_button");
    updateCheck(configuration.isDecoyAllowed, "allow_decoy_button");
    updateCheck(configuration.onlyEquippedNades, "only_random_equipped_nades_button");
    updatePercentageText("chance_to_throw_nade_when_shooting_text",configuration.chanceToThrowGrenadeWhenShooting);
    updatePercentageText("chance_to_throw_nade_when_dealing_damage_text",configuration.chanceToThrowGrenadeWhenDealingDamage);
};

Instance.OnScriptInput("toggle_throw_nade_when_shooting", () => {
    Instance.Msg("TOGGLE NADE WHEN SHOOTING");
    configuration.throwGrenadeWhenShooting = !configuration.throwGrenadeWhenShooting;
    updateCheck(configuration.throwGrenadeWhenShooting, "throw_a_nade_when_shooting_button");
});

Instance.OnScriptInput("toggle_throw_nade_when_dealing_damage", () => {
    configuration.throwGrenadeWhenDealingDamage = !configuration.throwGrenadeWhenDealingDamage;
    updateCheck(configuration.throwGrenadeWhenDealingDamage, "throw_a_nade_when_dealing_damage_button");
});

Instance.OnScriptInput("throw_a_nade_when_shooting_increment_chance_press", () => {
    configuration.chanceToThrowGrenadeWhenShooting+=0.01;
    configuration.chanceToThrowGrenadeWhenShooting = Math.max(configuration.chanceToThrowGrenadeWhenShooting,0.0);
    configuration.chanceToThrowGrenadeWhenShooting = Math.min(configuration.chanceToThrowGrenadeWhenShooting,1.0);
    updatePercentageText("chance_to_throw_nade_when_shooting_text",configuration.chanceToThrowGrenadeWhenShooting);
});
Instance.OnScriptInput("throw_a_nade_when_shooting_decrement_chance_press", () => {
    configuration.chanceToThrowGrenadeWhenShooting-=0.01;
    configuration.chanceToThrowGrenadeWhenShooting = Math.max(configuration.chanceToThrowGrenadeWhenShooting,0.0);
    configuration.chanceToThrowGrenadeWhenShooting = Math.min(configuration.chanceToThrowGrenadeWhenShooting,1.0);
    updatePercentageText("chance_to_throw_nade_when_shooting_text",configuration.chanceToThrowGrenadeWhenShooting);
});

Instance.OnScriptInput("throw_a_nade_when_dealing_damage_increment_chance_press", () => {
    configuration.chanceToThrowGrenadeWhenDealingDamage+=0.01;
    configuration.chanceToThrowGrenadeWhenDealingDamage = Math.max(configuration.chanceToThrowGrenadeWhenDealingDamage,0.0);
    configuration.chanceToThrowGrenadeWhenDealingDamage = Math.min(configuration.chanceToThrowGrenadeWhenDealingDamage,1.0);
    updatePercentageText("chance_to_throw_nade_when_dealing_damage_text",configuration.chanceToThrowGrenadeWhenDealingDamage);
});
Instance.OnScriptInput("throw_a_nade_when_dealing_damage_decrement_chance_press", () => {
    configuration.chanceToThrowGrenadeWhenDealingDamage-=0.01;
    configuration.chanceToThrowGrenadeWhenDealingDamage = Math.max(configuration.chanceToThrowGrenadeWhenDealingDamage,0.0);
    configuration.chanceToThrowGrenadeWhenDealingDamage = Math.min(configuration.chanceToThrowGrenadeWhenDealingDamage,1.0);
    updatePercentageText("chance_to_throw_nade_when_dealing_damage_text",configuration.chanceToThrowGrenadeWhenDealingDamage);
});

Instance.OnScriptInput("toggle_he", () => {
    configuration.isHeAllowed = !configuration.isHeAllowed;
    updateCheck(configuration.isHeAllowed, "allow_he_button");
});

Instance.OnScriptInput("toggle_flashbang", () => {
    configuration.isFlashbangAllowed = !configuration.isFlashbangAllowed;
    updateCheck(configuration.isFlashbangAllowed, "allow_flashbang_button");
});

Instance.OnScriptInput("toggle_smoke", () => {
    configuration.isSmokeAllowed = !configuration.isSmokeAllowed;
    updateCheck(configuration.isSmokeAllowed, "allow_smoke_button");
});

Instance.OnScriptInput("toggle_molotov", () => {
    configuration.isMolotovAllowed = !configuration.isMolotovAllowed;
    updateCheck(configuration.isMolotovAllowed, "allow_molotov_button");
});

Instance.OnScriptInput("toggle_decoy", () => {
    configuration.isDecoyAllowed = !configuration.isDecoyAllowed;
    updateCheck(configuration.isDecoyAllowed, "allow_decoy_button");
});

Instance.OnScriptInput("toggle_only_equipped_nades", () => {
    configuration.onlyEquippedNades = !configuration.onlyEquippedNades;
    updateCheck(configuration.onlyEquippedNades, "only_random_equipped_nades_button");
});


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
    const template = Instance.FindEntityByName(templateName);
    if (!template) {
        Instance.Msg(`${templateName} not found`);
        return;
    }
    if(!(template instanceof PointTemplate))
    {
        Instance.Msg(`${templateName} is not of type point template`);
        return;
    }

    const spawned = template.ForceSpawn(eyePos,eyeAng);
    if (!spawned || spawned.length === 0) return;
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

type PendingDetonation = { nadeType: NadeType; projectile: Entity; pawn: CSPlayerPawn; detonateAt?: number };

var pendingDetonations: PendingDetonation[] = [];

const scheduleDetonation = (nadeType: NadeType, projectile: Entity, pawn: CSPlayerPawn, trigger: DetonationTrigger) => {
    const detonateAt = trigger.kind === "delay" ? Instance.GetGameTime() + trigger.seconds : undefined;
    pendingDetonations.push({ nadeType, projectile, pawn, detonateAt });
};

const isReadyToDetonate = (pending: PendingDetonation, now: number): boolean => {
    const trigger = detonationTriggerByNadeType[pending.nadeType];
    if (!trigger) return true;

    if (trigger.kind === "delay") {
        return pending.detonateAt !== undefined && now >= pending.detonateAt;
    }

    const velocity = pending.projectile.GetAbsVelocity();
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
    return speed < trigger.speedThreshold;
};

// Tracks the type/thrower of every live projectile so other events (e.g. OnGrenadeBounce) can
// identify which nade type they're dealing with, since those events only expose the entity.
type ThrownProjectile = { entity: Entity; nadeType: NadeType; pawn: CSPlayerPawn; lastVelocityZ?: number; lastSampleTime?: number };

var thrownProjectiles: ThrownProjectile[] = [];

const trackProjectile = (entity: Entity, nadeType: NadeType, pawn: CSPlayerPawn) => {
    thrownProjectiles.push({ entity, nadeType, pawn });
};

const untrackProjectile = (entity: Entity) => {
    const index = thrownProjectiles.findIndex((p) => p.entity === entity);
    if (index !== -1) {
        thrownProjectiles.splice(index, 1);
    }
};

// There's no gravity getter/setter in the cs_script API, so gravity can't be read or set directly.
// Each tracked nade's actual fall acceleration is measured every tick (logged below) by diffing
// velocity.z between ticks - e.g. flashbang measured a consistent 320 u/s^2 versus the ~800 u/s^2
// standard gravity every other type uses. For any type listed here, its measured acceleration gets
// corrected up/down toward the given target (u/s^2) every tick. Types left out are untouched.
const gravityAccelTargetByNadeType: Partial<Record<NadeType, number>> = {
    flashbang: 800,
};

const updateProjectileGravity = (tracked: ThrownProjectile, now: number) => {
    if (!tracked.entity.IsValid()) return;

    const velocity = tracked.entity.GetAbsVelocity();

    if (tracked.lastVelocityZ !== undefined && tracked.lastSampleTime !== undefined) {
        const dt = now - tracked.lastSampleTime;
        if (dt > 0) {
            const measuredAccel = (tracked.lastVelocityZ - velocity.z) / dt;
            Instance.Msg(`${tracked.nadeType} measured gravity: ${measuredAccel.toFixed(1)} u/s^2 (vz=${velocity.z.toFixed(1)})`);

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
    Instance.Msg(`Detonating ${pending.nadeType} at game time ${Instance.GetGameTime()}`);

    // Idempotent: whether this was triggered by the timer or by an early wall bounce, make sure
    // there's no leftover scheduled detonation left to fire again for the same projectile.
    pendingDetonations = pendingDetonations.filter((p) => p.projectile !== pending.projectile);
    untrackProjectile(pending.projectile);

    const position = pending.projectile.IsValid() ? pending.projectile.GetAbsOrigin() : pending.pawn.GetEyePosition();
    Instance.Msg(`${pending.nadeType} detonation position: ${JSON.stringify(position)}`);

    if (pending.projectile.IsValid()) {
        Instance.EntFireAtTarget({ target: pending.projectile, input: "kill" });
        Instance.Msg(`Killed ${pending.nadeType} projectile`);
    } else {
        Instance.Msg(`${pending.nadeType} projectile was already invalid at detonation time`);
    }

    const actionTemplateName = actionTemplateNameByType[pending.nadeType];
    if (!actionTemplateName) {
        Instance.Msg(`No action template configured for ${pending.nadeType}, skipping detonation`);
        return;
    }

    const eyeAng = pending.pawn.GetEyeAngles();
    const pickupGrenade = spawnAndLaunch(actionTemplateName, pending.pawn, position, eyeAng, { x: 0, y: 0, z: 0 });
    if (!pickupGrenade) {
        Instance.Msg(`Failed to spawn pickup grenade ${actionTemplateName} for ${pending.nadeType} detonation`);
        return;
    }

    Instance.Msg(`Damaging pickup grenade ${actionTemplateName} to force ${pending.nadeType} detonation`);
    pickupGrenade.TakeDamage({ damage: 100, damageTypes: CSDamageTypes.BULLET, attacker: pending.pawn });
    Instance.EntFireAtTarget({ target: pickupGrenade, input: "kill", delay: 0.5 });
};

export const think = () => {
    const now = Instance.GetGameTime();
    const remaining: PendingDetonation[] = [];
    for (const pending of pendingDetonations) {
        if (!pending.projectile.IsValid()) {
            // Already gone by some other means (e.g. a smoke consumed by a burning molotov
            // detonates itself) - our workaround has nothing left to do, just drop it.
            Instance.Msg(`${pending.nadeType} projectile no longer valid before our detonation trigger fired, ignoring`);
            untrackProjectile(pending.projectile);
            continue;
        }

        if (isReadyToDetonate(pending, now)) {
            Instance.Msg(`Detonation trigger fired for ${pending.nadeType} (now=${now})`);
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
};

const throwNadeForPlayer = (pawn: CSPlayerPawn, nadeType: NadeType) : Entity | undefined => {
    const eyePos = pawn.GetEyePosition();
    const eyeAng = pawn.GetEyeAngles();
    const fwd = forwardFromAngles(eyeAng);
    let velocity = vecScale(fwd, configuration.projectileSpeed);
    const playerVelocity = pawn.GetAbsVelocity();
    velocity.x += playerVelocity.x;
    velocity.y += playerVelocity.y;
    velocity.z += playerVelocity.z;

    Instance.Msg(`Throwing ${nadeType} for ${pawn.GetEntityName()} at ${JSON.stringify(eyePos)} with velocity ${JSON.stringify(velocity)}`);

    const projectile = spawnAndLaunch(projectileTemplateNameByType[nadeType], pawn, eyePos, eyeAng, velocity);
    if (!projectile) return;

    trackProjectile(projectile, nadeType, pawn);

    const detonationTrigger = detonationTriggerByNadeType[nadeType];
    const actionTemplateName = actionTemplateNameByType[nadeType];
    if (detonationTrigger !== undefined && actionTemplateName) {
        scheduleDetonation(nadeType, projectile, pawn, detonationTrigger);
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



const getRandomAllowedNadeType = () : NadeType | null => {
    const allowedNades : NadeType[] = [];

    if (configuration.isHeAllowed) allowedNades.push("he");
    if (configuration.isFlashbangAllowed) allowedNades.push("flashbang");
    if (configuration.isSmokeAllowed) allowedNades.push("smoke");
    if (configuration.isMolotovAllowed) allowedNades.push("molotov");
    if (configuration.isDecoyAllowed) allowedNades.push("decoy");

    if (allowedNades.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * allowedNades.length);
    return allowedNades[randomIndex];
};

// --- main hook ---
// TA INTE BORT/// DET FUNGERA FÖR FLASH
Instance.OnGunFire((event) => {
    const shooter = event.weapon.GetOwner();
    if (!shooter) return;

    var randomValue = Math.random();
    if(configuration.throwGrenadeWhenShooting && randomValue < configuration.chanceToThrowGrenadeWhenShooting)
    {
        //throw nade
        var nadeType = getRandomAllowedNadeType();
        if(!nadeType) return;
        throwNadeForPlayer(shooter, nadeType);
    }
});

Instance.OnBeforePlayerDamage((event) => {

    var attacker = event.attacker;
    if (!attacker) return;
    if (!(attacker instanceof CSPlayerPawn))
    {
        Instance.Msg("attacker not playercontroller");
        return;
    }
    var randomValue = Math.random();
    if(configuration.throwGrenadeWhenDealingDamage && randomValue < configuration.chanceToThrowGrenadeWhenDealingDamage)
    {
        //throw nade
        var nadeType = getRandomAllowedNadeType();
        if(!nadeType) return;
        throwNadeForPlayer(attacker, nadeType);
    }
});

persistOnReload("throw_nades_on_damage_configuration", {
    configuration: { get: () => configuration, set: (value) => { configuration = value; } },
    pendingDetonations: { get: () => pendingDetonations, set: (value) => { pendingDetonations = value; } },
    thrownProjectiles: { get: () => thrownProjectiles, set: (value) => { thrownProjectiles = value; } },
});

Instance.OnGrenadeThrow((event) => {
    var velocity = event.projectile.GetAbsVelocity();
    var speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
    Instance.Msg("Grenade thrown with speed: " + speed);
});

// Bounce speed loss applied to every grenade type, every bounce. Speed is reduced by a percentage
// first, then by a flat amount, and never goes below 0. Both knobs are here so they're easy to tune.
const BOUNCE_VELOCITY_PERCENT_LOSS = 0.15; // fraction of speed lost per bounce, e.g. 0.3 = lose 30%
const BOUNCE_VELOCITY_FLAT_LOSS = 15; // flat units/sec subtracted per bounce, after the percentage loss

//We need to apply a velocity loss because the friction or something is bugged for projectiles so they slide around forever. This is a workaround to make them slow down and eventually stop moving.
const applyBounceVelocityLoss = (entity: Entity) => {
    const velocity = entity.GetAbsVelocity();
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
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
    Instance.Msg(`Grenade bounce #${event.bounces} for ${event.projectile.GetClassName()}`);
    const tracked = thrownProjectiles.find((p) => p.entity === event.projectile);
    if (!tracked) return;

    applyBounceVelocityLoss(event.projectile);

    if (tracked.nadeType !== "molotov") return;

    const position = event.projectile.GetAbsOrigin();
    const traceStart = { x: position.x, y: position.y, z: position.z + GROUND_TRACE_UP_OFFSET };
    const traceEnd = { x: position.x, y: position.y, z: position.z - GROUND_TRACE_DISTANCE };

    const trace = Instance.TraceLine({ start: traceStart, end: traceEnd, ignoreEntity: event.projectile });
    Instance.Msg(`Molotov bounce #${event.bounces}: start=${JSON.stringify(traceStart)}, end=${JSON.stringify(traceEnd)}, didHit=${trace.didHit}, fraction=${trace.fraction}, hitPos=${JSON.stringify(trace.end)}`);
    if (!trace.didHit) return;

    detonate({ nadeType: "molotov", projectile: event.projectile, pawn: tracked.pawn, detonateAt: Instance.GetGameTime() });
});

// @ts-nocheck

import { BaseModelEntity, CSPlayerController, Instance, PointTemplate } from "cs_script/point_script";

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
    projectileSpeed: 1300,
}

function updateCheck(show, entityName)
{
    var check = Instance.FindEntityByName(entityName + "_check");
    if(check instanceof BaseModelEntity)
    {
        var size = show ? 1.0 : 0.0;
        check.SetModelScale(size);
    }
}

function updatePercentageText(entityName, percent)
{
    var text = Math.floor(percent * 100) + "%";
    Instance.EntFireAtName(entityName, "setmessage",text,0);
}

Instance.OnRoundStart(() => {
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
})

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


function deg2rad(deg) { return (deg * Math.PI) / 180.0; }

function forwardFromAngles(ang) {
    // Source pitch: +down, -up. Roll unused for forward vector.
    const cp = Math.cos(deg2rad(ang.pitch));
    const sp = Math.sin(deg2rad(ang.pitch));
    const cy = Math.cos(deg2rad(ang.yaw));
    const sy = Math.sin(deg2rad(ang.yaw));
    return { x: cp * cy, y: cp * sy, z: -sp };
}

function vecScale(v, s) { return { x: v.x * s, y: v.y * s, z: v.z * s }; }

// --- main hook ---
// TA INTE BORT/// DET FUNGERA FÖR FLASH
Instance.OnGunFire((event) => {
    const owner = event.weapon.GetOwner();
    if (!owner) return;

    const controller = owner.GetOriginalPlayerController();
    if (!controller) return;

    const template = Instance.FindEntityByName("molotov_template");
    if (!template) {
        Instance.Msg("molotov_template not found");
        return;
    }
    if(!(template instanceof PointTemplate))
    {
        Instance.Msg("molotov_template is not of type point template");
        return;
    }

    const eyePos = owner.GetEyePosition();
    const eyeAng = owner.GetEyeAngles();
    const fwd = forwardFromAngles(eyeAng);
    const velocity = vecScale(fwd, configuration.projectileSpeed);

    const spawned = template.ForceSpawn(eyePos,eyeAng);
    if (!spawned || spawned.length === 0) return;

    const molotov = spawned[0]; 

    molotov.SetOwner(owner); //Does this even do anything?!?!
    molotov.Teleport({
        position: eyePos,
        angles: eyeAng,
        velocity: velocity
    });
    //according to the wiki this is supposed to activate the grenade but it does not https://developer.valvesoftware.com/wiki/Molotov_projectile
    Instance.EntFireAtTarget({ 
        target: molotov,
        input: "InitializeSpawnFromWorld",
        activator: owner,
        caller: owner,
        delay: 0
    });
});


Instance.OnScriptInput("player_hurt", (caller) => {
    Instance.Msg("Player hurt event");
});


Instance.OnScriptReload({
    before: () => {
        return { configuration };
    },
    after: (memory) => {
        if (memory && memory.configuration !== undefined) {
            configuration = memory.configuration;
        }
    },
});


// Instance.SetNextThink(Instance.GetGameTime());


// function createMolotov(weapon)
// {
//     //ent_create molotov_projectile {"targetname" "kalle"} (DETTA FUNGERAR och den får targetname!)
//     const owner = weapon.GetOwner();
//     if (!owner) return;

//     const controller = owner.GetOriginalPlayerController();
//     if (!controller) return;

//     const name = Math.floor(Math.random() * 10000) + Instance.GetGameTime();
//     Instance.ServerCommand(`ent_create molotov_projectile {"targetname" "${name}"}`);
    
//     const eyePos = owner.GetEyePosition();
//     const eyeAng = owner.GetEyeAngles();
//     const fwd = forwardFromAngles(eyeAng);
//     const velocity = vecScale(fwd, configuration.projectileSpeed);
//     // Instance.SetThink(() => {

//     // });
//     Instance.EntFireAtTarget("kalle", "","",2);
//     var molotov = Instance.FindEntityByName("kalle");
//     molotov.Teleport(eyePos, eyeAng, velocity);
    
//     // // 2) Spawn the template
//     // const spawned = template.ForceSpawn(eyePos,eyeAng);
//     // if (!spawned || spawned.length === 0) return;

//     // // 3) Move the spawned flashbang to the player's eyes
//     // const flash = spawned[0]; // your template should only spawn one projectile

// }


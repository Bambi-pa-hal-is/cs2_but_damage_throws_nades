import { BaseModelEntity, CSGearSlot, CSPlayerController, CSPlayerPawn, Entity, Instance, PointTemplate } from "cs_script/point_script";

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

type nadeTemplate = "molotov_point_template" | "flashbang_point_template" | "hegrenade_point_template" | "smokegrenade_point_template" | "decoy_point_template";

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


const throwNadeForPlayer = (pawn: CSPlayerPawn, templateName: nadeTemplate) : Entity | undefined => {
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
    const eyePos = pawn.GetEyePosition();
    const eyeAng = pawn.GetEyeAngles();
    const fwd = forwardFromAngles(eyeAng);
    let velocity = vecScale(fwd, configuration.projectileSpeed);
    const playerVelocity = pawn.GetAbsVelocity();
    velocity.x += playerVelocity.x;
    velocity.y += playerVelocity.y;
    velocity.z += playerVelocity.z;

    const spawned = template.ForceSpawn(eyePos,eyeAng);
    if (!spawned || spawned.length === 0) return;
    const nade = spawned[0]; 

    nade.SetOwner(pawn); //Does this even do anything?!?!
    nade.Teleport({
        position: eyePos,
        angles: eyeAng,
        velocity: velocity
    });
    //according to the wiki this is supposed to activate the grenade but it does not https://developer.valvesoftware.com/wiki/Molotov_projectile
    Instance.EntFireAtTarget({ 
        target: nade,
        input: "InitializeSpawnFromWorld",
        activator: pawn,
        caller: pawn,
        delay: 0
    });
    Instance.EntFireAtTarget({ 
        target: nade,
        input: "kill",
        delay: 10.0
    });
    return nade;
}; 

const getRandomAllowedNadeTemplate = () : nadeTemplate | null => {
    const allowedNades : nadeTemplate[] = [];

    if (configuration.isHeAllowed) allowedNades.push("hegrenade_point_template");
    if (configuration.isFlashbangAllowed) allowedNades.push("flashbang_point_template");
    if (configuration.isSmokeAllowed) allowedNades.push("smokegrenade_point_template");
    if (configuration.isMolotovAllowed) allowedNades.push("molotov_point_template");
    if (configuration.isDecoyAllowed) allowedNades.push("decoy_point_template");

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
        var nadeTemplateName = getRandomAllowedNadeTemplate();
        if(!nadeTemplateName) return;
        throwNadeForPlayer(shooter, nadeTemplateName);
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
        var nadeTemplateName = getRandomAllowedNadeTemplate();
        if(!nadeTemplateName) return;
        throwNadeForPlayer(attacker, nadeTemplateName);
    }
});

// Instance.OnScriptInput("player_hurt", (event) => {
//     const attacker = event.activator;
//     if (!attacker) return;
//     Instance.Msg("player_hurt by " + event?.activator?.GetClassName());
//     if (!(attacker instanceof CSPlayerPawn)) return;

//     var randomValue = Math.random();
//     if(configuration.throwGrenadeWhenShooting && randomValue < configuration.chanceToThrowGrenadeWhenShooting)
//     {
//         //throw nade
//         var nadeTemplateName = getRandomAllowedNadeTemplate();
//         if(!nadeTemplateName) return;
//         throwNadeForPlayer(attacker, nadeTemplateName);
//     }
// });


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

Instance.OnGrenadeThrow((event) => {
    var velocity = event.projectile.GetAbsVelocity();
    var speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
    Instance.Msg("Grenade thrown with speed: " + speed);
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


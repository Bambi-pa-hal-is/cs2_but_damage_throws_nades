// import { CSGearSlot, log, ParameterScheduler, timingHandler } from '@wonfsy/cs-script-extensions'

// Instance.ServerCommand("mp_warmup_offline_enabled 1");
// Instance.ServerCommand("mp_warmup_pausetimer 1");

// const playerSpawnThrottle = new ParameterScheduler((userId: number) => {
//   log("player spawned:", userId);
//   const player = Instance.GetPlayerController(userId);

//   if (!player) return;

//   const playerPawn = player.GetPlayerPawn();

//   if (!playerPawn) return;

//   playerPawn.SetColor({ r: 0, g: 0, b: 0 });
//   // Without the throttle the following 2 lines wont work
//   playerPawn.DestroyWeapon(playerPawn.FindWeaponBySlot(CSGearSlot.knife));
//   playerPawn.DestroyWeapon(playerPawn.FindWeaponBySlot(CSGearSlot.pistol));
//   playerPawn.GiveNamedItem('weapon_awp', true)
//   playerPawn.SetArmor(2000);
//   playerPawn.SetMaxHealth(1000);
//   playerPawn.SetHealth(500);
// }, 500, { type: 'throttle' })

// Instance.OnGameEvent("player_activate", (event) => {
//   const player = Instance.GetPlayerController(event.userid);
//   if (!player) return;
//   player.JoinTeam(2);
// });

// Instance.OnGameEvent("player_spawn", (event) => {
//   playerSpawnThrottle.call(event.userid)
// });

// // No zoom allowed
// Instance.OnGameEvent('weapon_zoom', event => {
//   log('weapon_zoom')
//   const player = Instance.GetPlayerController(event.userid);

//   if (!player) return;
//   const playerPawn = player.GetPlayerPawn();
//   if (!playerPawn) return;

//   const weapon = playerPawn.FindWeaponBySlot(CSGearSlot.rifle);
//   if (!weapon) return;

//   playerPawn.DestroyWeapon(weapon);
//   playerPawn.GiveNamedItem(weapon.GetClassName(), true)
// })

// Instance.SetThink(() => {
//   // This is very important to have, without it all functions that require waiting will not work
//   timingHandler();
//   Instance.SetNextThink(Instance.GetGameTime());
// });
// Instance.SetNextThink(Instance.GetGameTime());

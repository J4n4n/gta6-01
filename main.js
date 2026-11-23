// Solmar Heat: boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between six screens: title, briefing, play, paused, game over
// and the ending. ?seed=N fixes the world. ?shot=start|drive|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import {
  VIEW_WIDTH, VIEW_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, STEP, SAVE_KEY,
  PLAYER, CAR, WANTED, POLICE, BUST_FINE,
} from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createAudio } from './audio.js';
import {
  createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, ACTION_ENTER_CAR, ACTION_PUNCH,
} from './input.js';
import { makeCar, makePed, makePlayer, stepCar, stepPlayerOnFoot } from './entities.js';
import { stepTrafficCar, stepPed, stepPoliceCar, policeCountForStars } from './ai.js';
import { createMissions, createMissionRunner, STORY_INTRO } from './missions.js';
import { createRenderer } from './render.js';
import { readSave, writeSave, clearSave, readBest, writeBest } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const TRAFFIC_TARGET = 14;
const PED_TARGET = 24;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const input = createInput(canvas);
const renderer = createRenderer(canvas);

const game = {
  rng: createRandom(seed),
  city: null,
  player: null,
  cars: [],
  peds: [],
  cops: [],
  particles: [],
  pickups: [],
  mission: null,
  wanted: 0,
  crimeTimer: 0,
  camera: { x: 0, y: 0 },
  time: 0,
  save: readSave(),
  best: readBest(),
  overReason: 'busted',
  saveTimer: 0,
};

// --- world setup -----------------------------------------------------------

function spawnTrafficCar(farFromPlayer) {
  for (let tries = 0; tries < 12; tries += 1) {
    const p = game.city.randomRoadPoint();
    if (farFromPlayer && Math.hypot(p.x - game.player.x, p.y - game.player.y) < 420) continue;
    const angle = game.rng.chance(0.5) ? 0 : Math.PI / 2;
    const car = makeCar(p.x, p.y, angle, 'traffic', game.rng);
    car.speed = CAR.trafficSpeed * game.rng.range(0.7, 1);
    return car;
  }
  return null;
}

function spawnPed(farFromPlayer) {
  for (let tries = 0; tries < 12; tries += 1) {
    const p = game.city.randomRoadPoint();
    if (farFromPlayer && Math.hypot(p.x - game.player.x, p.y - game.player.y) < 380) continue;
    return makePed(p.x, p.y, game.rng);
  }
  return null;
}

function spawnParkedCars() {
  const spots = [];
  for (let i = 0; i < 9; i += 1) {
    const p = game.city.randomRoadPoint();
    // Face along the road, like a real parked car: pressing W drives away
    // down the street instead of into the nearest building.
    const axis = game.city.roadAxis(p.x, p.y);
    const angle = axis === 'ns'
      ? game.rng.pick([-Math.PI / 2, Math.PI / 2])
      : game.rng.pick([0, Math.PI]);
    const car = makeCar(p.x, p.y, angle, 'parked', game.rng);
    spots.push(car);
  }
  // The yellow coupe Job 2 needs, parked in the North Lot.
  const coupe = makeCar(2100, 180, Math.PI / 2, 'parked', game.rng);
  coupe.model = 'Coupe';
  coupe.color = '#e8c33d';
  spots.push(coupe);
  // A starter car by Mara's garage so the first job can be driven.
  const starter = makeCar(420, 1990, -Math.PI / 2, 'parked', game.rng);
  starter.model = 'Sedan';
  starter.color = '#d94f3d';
  spots.push(starter);
  return spots;
}

function resetWorld(nextSeed) {
  game.rng = createRandom(nextSeed);
  game.city = createCity(game.rng);
  // Jax wakes up at St. Anselm Hospital, across town from Mara's garage:
  // Job 0 is a real trip, not a step out of the front door.
  game.player = makePlayer(900, 300);
  game.cars = spawnParkedCars();
  for (let i = 0; i < TRAFFIC_TARGET; i += 1) {
    const car = spawnTrafficCar(false);
    if (car) game.cars.push(car);
  }
  game.peds = [];
  for (let i = 0; i < PED_TARGET; i += 1) {
    const ped = spawnPed(false);
    if (ped) game.peds.push(ped);
  }
  game.cops = [];
  game.particles = [];
  game.pickups = [];
  for (let i = 0; i < 6; i += 1) {
    const p = game.city.randomRoadPoint();
    game.pickups.push({ x: p.x, y: p.y, kind: 'cash', amount: 50, timer: 0 });
  }
  for (let i = 0; i < 3; i += 1) {
    game.pickups.push({ x: 900 + game.rng.range(-80, 80), y: 300 + game.rng.range(-80, 80), kind: 'health', amount: 50, timer: 0 });
  }
  game.mission = createMissionRunner(createMissions());
  game.wanted = 0;
  game.crimeTimer = 0;
  game.time = 0;
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  game.saveTimer = 0;
}

function givePlayerCar(model, color) {
  const car = makeCar(game.player.x, game.player.y, game.player.angle, 'player', game.rng);
  car.model = model;
  car.color = color;
  game.cars.push(car);
  game.player.onFoot = false;
  game.player.car = car;
  return car;
}

function setWanted(value) {
  game.wanted = Math.max(game.wanted, Math.min(WANTED.maxStars, value));
  game.crimeTimer = 0;
}

function addWanted(value) {
  game.wanted = Math.min(WANTED.maxStars, game.wanted + value);
  game.crimeTimer = 0;
}

function nearestCar(x, y, maxDist, kinds) {
  let best = null;
  let bestD = maxDist;
  for (const car of game.cars) {
    if (kinds && !kinds.includes(car.kind)) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function addParticles(kind, x, y, angle, count) {
  for (let i = 0; i < count; i += 1) {
    const a = angle === undefined ? game.rng.range(0, Math.PI * 2) : angle + game.rng.range(-0.5, 0.5);
    const speed = game.rng.range(40, 190);
    game.particles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: game.rng.range(0.25, 0.7),
      maxLife: 0.7,
      size: game.rng.range(2, 5),
      color: kind === 'spark' ? '#ffd23f' : kind === 'smoke' ? '#888888' : kind === 'blood' ? '#d93d3d' : '#ffffff',
      kind: 'dot',
    });
  }
}

// --- combat and crime ------------------------------------------------------

function punch() {
  const player = game.player;
  if (!player.onFoot || player.punchTimer > 0) return;
  player.punchTimer = PLAYER.punchCooldown;
  audio.punch();
  let hit = false;
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - player.x, ped.y - player.y);
    if (d < PLAYER.punchRange + 12) {
      ped.state = 'down';
      ped.timer = 6;
      addParticles('blood', ped.x, ped.y, undefined, 6);
      hit = true;
    }
  }
  if (hit) addWanted(WANTED.assaultStars);
}

function shoot() {
  const player = game.player;
  if (!player.onFoot || player.shootTimer > 0 || player.ammo <= 0) return;
  player.shootTimer = PLAYER.shootCooldown;
  player.ammo -= 1;
  audio.shot();
  const mouse = input.mouse();
  const wx = mouse.x + game.camera.x - VIEW_WIDTH / 2;
  const wy = mouse.y + game.camera.y - VIEW_HEIGHT / 2;
  const angle = Math.atan2(wy - player.y, wx - player.x);
  player.angle = angle;
  const mx = player.x + Math.cos(angle) * 22;
  const my = player.y + Math.sin(angle) * 22;
  addParticles('spark', mx, my, angle, 3);
  // Hitscan: the nearest ped or cop car close to the ray, inside 520 px.
  let best = null;
  let bestD = 520;
  let bestKind = '';
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - player.x;
    const dy = ped.y - player.y;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (along < 10 || along > 520) continue;
    const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (perp < 16 && along < bestD) { bestD = along; best = ped; bestKind = 'ped'; }
  }
  for (const cop of game.cops) {
    const dx = cop.x - player.x;
    const dy = cop.y - player.y;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (along < 10 || along > 520) continue;
    const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (perp < 26 && along < bestD) { bestD = along; best = cop; bestKind = 'cop'; }
  }
  if (best) {
    addParticles('blood', best.x, best.y, undefined, 8);
    if (bestKind === 'ped') {
      best.state = 'down';
      best.timer = 8;
      addWanted(WANTED.shootStars);
    } else {
      best.hp -= PLAYER.bulletDamage;
      addWanted(WANTED.shootStars);
      if (best.hp <= 0) {
        addWanted(WANTED.copKillStars);
        addParticles('smoke', best.x, best.y, undefined, 14);
      }
    }
  }
}

function enterCar() {
  const player = game.player;
  if (!player.onFoot) {
    // Exit: step out beside the car.
    const car = player.car;
    car.kind = 'parked';
    car.speed = 0;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    player.onFoot = true;
    player.car = null;
    audio.click();
    return;
  }
  const car = nearestCar(player.x, player.y, 78, ['parked', 'traffic']);
  if (!car) return;
  if (car.kind === 'traffic') {
    // Steal it: the driver flees on foot, and the law notices.
    const driver = makePed(car.x, car.y, game.rng);
    driver.state = 'flee';
    game.peds.push(driver);
    addWanted(WANTED.stealStars);
    audio.crash();
  } else {
    audio.click();
  }
  car.kind = 'player';
  player.onFoot = false;
  player.car = car;
}

function hurtPlayer(amount) {
  const player = game.player;
  if (player.hurtTimer > 0) return;
  player.hp -= amount;
  player.hurtTimer = 0.5;
  if (player.hp <= 0) {
    player.hp = 0;
    wastePlayer();
  }
}

function bustPlayer() {
  game.overReason = 'busted';
  game.player.money = Math.max(0, game.player.money - BUST_FINE);
  audio.busted();
  endRun();
}

function wastePlayer() {
  game.overReason = 'wasted';
  game.player.money = Math.max(0, game.player.money - BUST_FINE);
  audio.busted();
  endRun();
}

function endRun() {
  game.mission.fail();
  game.resumeMission = game.mission.missionIndex();
  game.wanted = 0;
  game.cops = [];
  screen = 'over';
  game.save = {
    money: game.player.money,
    missionIndex: game.resumeMission,
    x: 900, y: 300,
    hp: PLAYER.maxHp,
    ammo: game.player.ammo,
  };
  writeSave(game.save);
}

// --- police ----------------------------------------------------------------

function maintainPolice(dt) {
  const want = policeCountForStars(game.wanted);
  while (game.cops.length < want) {
    const angle = game.rng.range(0, Math.PI * 2);
    const px = game.player.onFoot ? game.player.x : game.player.car.x;
    const py = game.player.onFoot ? game.player.y : game.player.car.y;
    const cop = makeCar(px + Math.cos(angle) * 700, py + Math.sin(angle) * 700, angle, 'police', game.rng);
    cop.speed = CAR.policeSpeed * 0.7;
    game.cops.push(cop);
  }
  while (game.cops.length > want) game.cops.pop();
}

// --- the world step ----------------------------------------------------------

function tickWorld(dt, autopilot) {
  game.time += dt;
  const player = game.player;
  // Traffic and pedestrians keep the city alive.
  for (const car of game.cars) {
    if (car.kind === 'traffic') stepTrafficCar(car, dt, game.city, game.rng, game.cars);
  }
  let danger = null;
  if (game.wanted > 0) {
    danger = player.onFoot ? { x: player.x, y: player.y } : { x: player.car.x, y: player.car.y };
  }
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      ped.timer -= dt;
      if (ped.timer <= 0) {
        const p = spawnPed(true);
        if (p) { ped.x = p.x; ped.y = p.y; }
        ped.state = 'walk';
        ped.timer = game.rng.range(2, 6);
      }
      continue;
    }
    stepPed(ped, dt, game.city, game.rng, danger);
  }
  // Keep the street population steady.
  if (game.cars.filter((c) => c.kind === 'traffic').length < TRAFFIC_TARGET) {
    const car = spawnTrafficCar(true);
    if (car) game.cars.push(car);
  }
  if (game.peds.length < PED_TARGET) {
    const ped = spawnPed(true);
    if (ped) game.peds.push(ped);
  }
  // Police chase, ram and bust.
  maintainPolice(dt);
  const playerPos = player.onFoot
    ? { x: player.x, y: player.y, vx: 0, vy: 0 }
    : { x: player.car.x, y: player.car.y, vx: Math.cos(player.car.angle) * player.car.speed, vy: Math.sin(player.car.angle) * player.car.speed };
  for (let i = game.cops.length - 1; i >= 0; i -= 1) {
    const cop = game.cops[i];
    if (cop.hp <= 0) {
      cop.wreckTimer = (cop.wreckTimer || 0) + dt;
      addParticles('smoke', cop.x, cop.y, undefined, 1);
      if (cop.wreckTimer > 3) game.cops.splice(i, 1);
      continue;
    }
    cop.touch = stepPoliceCar(cop, dt, playerPos, 0, game.city, game.cars, cop.touch || 0);
    const dist = Math.hypot(cop.x - playerPos.x, cop.y - playerPos.y);
    if (!autopilot && dist < 70) {
      if (player.onFoot && cop.touch > POLICE.bustSeconds) { bustPlayer(); return; }
      if (!player.onFoot && cop.touch > POLICE.bustSeconds * 2.5) { bustPlayer(); return; }
    }
    if (dist < 60 && !player.onFoot) {
      player.car.hp -= POLICE.ramDamage * dt;
      if (player.car.hp <= 0) {
        addParticles('smoke', player.car.x, player.car.y, undefined, 10);
        audio.crash();
        player.car.speed = 0;
      }
    }
  }
  // Wanted decays when the player lies low.
  if (game.wanted > 0) {
    game.crimeTimer += dt;
    let copNear = false;
    for (const cop of game.cops) {
      if (Math.hypot(cop.x - playerPos.x, cop.y - playerPos.y) < 600) { copNear = true; break; }
    }
    if (game.crimeTimer > WANTED.decaySeconds && !copNear) {
      game.wanted -= 1;
      game.crimeTimer = 0;
    }
  }
  // Pickups.
  for (const pickup of game.pickups) {
    if (pickup.timer > 0) {
      pickup.timer -= dt;
      if (pickup.timer <= 0) {
        const p = game.city.randomRoadPoint();
        pickup.x = p.x;
        pickup.y = p.y;
      }
      continue;
    }
    const d = Math.hypot(pickup.x - playerPos.x, pickup.y - playerPos.y);
    if (d < 34) {
      if (pickup.kind === 'cash') {
        player.money += pickup.amount;
        game.mission.showToast(`+$${pickup.amount}`, 1.6);
      } else {
        player.hp = Math.min(PLAYER.maxHp, player.hp + pickup.amount);
        game.mission.showToast(`+${pickup.amount} HP`, 1.6);
      }
      audio.pickup();
      addParticles('spark', pickup.x, pickup.y, undefined, 8);
      pickup.timer = 20;
    }
  }
  // Particles.
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const p = game.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
  // Mission.
  const result = game.mission.update(dt, game);
  if (result === 'completed' && !autopilot) {
    audio.missionDone();
    saveProgress();
    screen = 'brief';
  } else if (result === 'finished' && !autopilot) {
    audio.missionDone();
    saveProgress();
    screen = 'ending';
  } else if (result === 'completed' || result === 'finished') {
    audio.missionDone();
  }
  // Health regen while calm.
  if (game.wanted === 0 && player.hp > 0 && player.hp < PLAYER.maxHp && player.hurtTimer <= 0) {
    player.hp = Math.min(PLAYER.maxHp, player.hp + 3 * dt);
  }
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
  // Camera follows the player.
  const tx = player.onFoot ? player.x : player.car.x;
  const ty = player.onFoot ? player.y : player.car.y;
  const k = 1 - Math.exp(-5 * dt);
  game.camera.x += (tx - game.camera.x) * k;
  game.camera.y += (ty - game.camera.y) * k;
  game.camera.x = Math.max(VIEW_WIDTH / 2, Math.min(WORLD_WIDTH - VIEW_WIDTH / 2, game.camera.x));
  game.camera.y = Math.max(VIEW_HEIGHT / 2, Math.min(WORLD_HEIGHT - VIEW_HEIGHT / 2, game.camera.y));
  // Engine and siren follow the action.
  const driving = !player.onFoot && player.car;
  audio.engine(driving ? Math.abs(player.car.speed) / CAR.maxSpeed : 0, !!driving);
  audio.siren(game.wanted > 0 && game.cops.length > 0);
}

function saveProgress() {
  const player = game.player;
  writeSave({
    money: player.money,
    missionIndex: game.mission.missionIndex(),
    x: player.onFoot ? player.x : player.car.x,
    y: player.onFoot ? player.y : player.car.y,
    hp: Math.ceil(player.hp),
    ammo: player.ammo,
  });
  if (player.money > game.best) {
    game.best = player.money;
    writeBest(game.best);
  }
}

// --- screens -----------------------------------------------------------------

let screen = 'title';

function announce(message) {
  status.textContent = message;
}

function startNewGame() {
  clearSave();
  game.save = null;
  resetWorld(Math.floor(Math.random() * 4294967296));
  game.mission.jumpTo(0);
  screen = 'brief';
  announce('New game. Mara has work for you.');
}

function continueGame() {
  const save = game.save;
  resetWorld(Math.floor(Math.random() * 4294967296));
  game.player.money = save.money;
  game.player.hp = save.hp || PLAYER.maxHp;
  game.player.ammo = save.ammo || PLAYER.startAmmo;
  game.player.x = save.x;
  game.player.y = save.y;
  game.city.collideCircle(game.player, PLAYER.radius);
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  game.mission.jumpTo(save.missionIndex || 0);
  screen = 'brief';
  announce('Continuing. Mara has work for you.');
}

function stepPlay(dt) {
  const player = game.player;
  const drive = input.drive();
  if (player.onFoot) {
    const move = input.walk();
    stepPlayerOnFoot(player, move, dt, game.city, game.cars);
    if (input.shootPressed()) shoot();
  } else {
    const car = player.car;
    if (car.hp > 0) {
      const hitWall = stepCar(car, drive.throttle, drive.steer, drive.handbrake, dt, game.city, game.cars);
      if (hitWall && Math.abs(car.speed) > 300) {
        hurtPlayer(6);
        audio.crash();
        addParticles('smoke', car.x, car.y, undefined, 6);
      }
    } else {
      car.speed *= Math.max(0, 1 - 2 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      game.city.collideCircle(car, CAR.radius - 4);
    }
  }
  tickWorld(dt, false);
  game.saveTimer += dt;
  if (game.saveTimer > 10) {
    game.saveTimer = 0;
    saveProgress();
  }
}

function handleActions() {
  // Key-specific presses must be read before takeActions clears them.
  const enterPressed = input.wasPressed('Enter') || input.wasPressed('NumpadEnter');
  const spacePressed = input.wasPressed('Space');
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) {
    audio.setMuted(!audio.isMuted());
  }
  if (screen === 'title') {
    if (input.has('KeyN')) {
      audio.unlock();
      audio.startMusic();
      startNewGame();
      return;
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      audio.startMusic();
      if (game.save) continueGame();
      else startNewGame();
    }
    return;
  }
  if (screen === 'brief') {
    if (actions & ACTION_CONFIRM) {
      audio.click();
      game.mission.start();
      screen = 'play';
      announce(`Job started: ${game.mission.current().title}`);
    }
    return;
  }
  if (screen === 'play') {
    if (actions & ACTION_PAUSE) {
      screen = 'pause';
      saveProgress();
      announce('Paused.');
      return;
    }
    if (actions & ACTION_ENTER_CAR) enterCar();
    if ((actions & ACTION_PUNCH) || (spacePressed && game.player.onFoot)) punch();
    // Start the next job at Mara's garage (Enter only; Space is punch).
    if (enterPressed && !game.mission.isActive() && !game.mission.isDone()) {
      const d = Math.hypot(game.player.x - 330, game.player.y - 1980);
      if (d < 160) {
        screen = 'brief';
        announce(game.mission.current().title);
      }
    }
    return;
  }
  if (screen === 'pause') {
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
      screen = 'play';
      announce('Playing.');
    }
    return;
  }
  if (screen === 'over') {
    if (actions & ACTION_CONFIRM) {
      resetWorld(Math.floor(Math.random() * 4294967296));
      game.mission.jumpTo(game.resumeMission || 0);
      game.player.x = 900;
      game.player.y = 300;
      game.player.hp = PLAYER.maxHp;
      // Keep the bust/waste fine: the respawned player starts with what the
      // save holds, not a fresh $150.
      game.player.money = game.save ? game.save.money : PLAYER.startMoney;
      game.city.collideCircle(game.player, PLAYER.radius);
      game.camera.x = game.player.x;
      game.camera.y = game.player.y;
      screen = 'brief';
      announce('Back on your feet. Mara is waiting.');
    }
    return;
  }
  if (screen === 'ending') {
    if (actions & ACTION_CONFIRM) {
      screen = 'play';
      announce('Free roam. Solmar is yours.');
    }
  }
}

function runShot(name) {
  const scene = stageShot(name, game);
  announce(name === 'start'
    ? 'Solmar Heat. Press Enter or click to start.'
    : 'Solmar Heat — a living city. Press Enter to start.');
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen, game.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  resetWorld(seed);
  let accumulator = 0;
  let last = performance.now();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'pause';
      saveProgress();
      announce('Paused.');
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === 'play') {
      while (accumulator >= STEP && screen === 'play') {
        stepPlay(STEP);
        accumulator -= STEP;
      }
    } else if (screen === 'title') {
      while (accumulator >= STEP) {
        tickWorld(STEP, false);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game, screen, game.best);
  }

  announce('Solmar Heat. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

// The game object the screenshot scenes drive (reset, step, give, wanted).
game.resetWorld = resetWorld;
game.tickWorld = tickWorld;
game.setWanted = setWanted;
game.givePlayerCar = givePlayerCar;

// Debug and test handle: the live game object, for automated playtests.
// Read-only in spirit — the game itself never reads it back.
window.__solmar = game;
game.getScreen = () => screen;

if (shot) {
  resetWorld(seed);
  runShot(shot);
} else {
  runGame();
}

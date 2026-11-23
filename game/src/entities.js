// The things that move: the player on foot, cars (parked, traffic, police and
// the player's), and pedestrians. Cars drive with arcade physics: throttle
// along the heading, steering that bites harder the faster the car goes.
import { PLAYER, CAR } from './config.js';

const CAR_COLORS = ['#d94f3d', '#3d7ad9', '#e8c33d', '#7ad93d', '#d9d9d9', '#8a5fd9', '#e07f3d', '#3dd9c2'];
const CAR_MODELS = ['Coupe', 'Sedan', 'Hatch', 'Van', 'Pickup'];

export function makeCar(x, y, angle, kind, rng) {
  return {
    kind, // 'parked' | 'traffic' | 'police' | 'player'
    x, y, angle,
    speed: 0,
    steer: 0,
    color: kind === 'police' ? '#e8e8e8' : rng.pick(CAR_COLORS),
    model: rng.pick(CAR_MODELS),
    hp: 100,
    target: null,
    stuck: 0,
    siren: 0,
    hurtTimer: 0,
    touch: 0,
    wreckTimer: 0,
  };
}

export function makePed(x, y, rng) {
  return {
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(38, 62),
    color: rng.pick(['#e86a6a', '#6a9ae8', '#e8c96a', '#8ae86a', '#c96ae8', '#e8e8e8']),
    state: 'walk', // 'walk' | 'flee' | 'down'
    dir: rng.range(0, Math.PI * 2),
    timer: rng.range(1, 4),
  };
}

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    hp: PLAYER.maxHp,
    money: PLAYER.startMoney,
    ammo: PLAYER.startAmmo,
    onFoot: true,
    car: null,
    punchTimer: 0,
    shootTimer: 0,
    hurtTimer: 0,
    run: false,
  };
}

// Arcade car step: throttle accelerates along the heading, steering turns the
// car, and the velocity is pulled toward the heading (grip) so it drifts a
// little instead of sliding forever. Buildings stop the car; the world bounds it.
export function stepCar(car, throttle, steer, handbrake, dt, city, others) {
  const maxFwd = car.kind === 'police' ? CAR.policeSpeed : CAR.maxSpeed;
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 12) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 190 * dt;
    if (Math.abs(car.speed) < 6) car.speed = 0;
  }
  if (handbrake) car.speed *= Math.max(0, 1 - 3.2 * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(maxFwd, car.speed));
  // Steering bites even at low speed, so a car nosed against a wall can
  // still turn away instead of grinding there forever.
  const speedFactor = car.speed === 0 ? 0 : Math.max(0.3, Math.min(1, Math.abs(car.speed) / 220));
  car.angle += steer * CAR.steer * speedFactor * Math.sign(car.speed || 1) * dt;
  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  car.x += vx * dt;
  car.y += vy * dt;
  city.clampToWorld(car, 24);
  const hitWall = city.collideCircle(car, CAR.radius - 4);
  if (car.hurtTimer > 0) car.hurtTimer -= dt;
  if (hitWall) {
    car.speed *= 0.45;
    if (car.hurtTimer <= 0) {
      car.hp -= 2;
      car.hurtTimer = 0.5;
    }
  }
  for (const other of others) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    const min = CAR.radius * 2 - 6;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      car.x -= nx * push;
      car.y -= ny * push;
      other.x += nx * push;
      other.y += ny * push;
      const exchange = car.speed * 0.4;
      car.speed -= exchange;
      other.speed += exchange * 0.5;
      if (car.hurtTimer <= 0) {
        car.hp -= 1;
        other.hp -= 1;
        car.hurtTimer = 0.4;
        other.hurtTimer = 0.4;
      }
    }
  }
  return hitWall;
}

// The player on foot: WASD movement, pushed out of buildings and cars.
export function stepPlayerOnFoot(player, move, dt, city, cars) {
  const speed = (move.run ? PLAYER.runSpeed : PLAYER.walkSpeed);
  player.x += move.x * speed * dt;
  player.y += move.y * speed * dt;
  if (move.moving) player.angle = Math.atan2(move.y, move.x);
  city.clampToWorld(player, PLAYER.radius);
  city.collideCircle(player, PLAYER.radius);
  for (const car of cars) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const d = Math.hypot(dx, dy);
    const min = PLAYER.radius + CAR.radius - 8;
    if (d > 0.01 && d < min) {
      player.x = car.x + (dx / d) * min;
      player.y = car.y + (dy / d) * min;
    }
  }
}

export function carColorList() {
  return CAR_COLORS;
}

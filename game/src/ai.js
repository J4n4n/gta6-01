// The city's brains: traffic that follows the road graph, pedestrians that
// stroll the sidewalks and flee from trouble, and police that chase the player.
import { CAR } from './config.js';
import { stepCar } from './entities.js';

function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Drive toward a point: throttle up, steer by the heading error, ease off in
// sharp turns. Returns true when the car is close to the point.
export function driveToward(car, tx, ty, dt, city, others, topSpeed) {
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  const wanted = angleTo(car.x, car.y, tx, ty);
  const err = angleDiff(wanted, car.angle);
  const steer = Math.max(-1, Math.min(1, err * 2.2));
  let throttle = 1;
  if (Math.abs(err) > 1.1) throttle = 0.25;
  if (dist < 90) throttle = 0.4;
  // A car ahead, close and in the way, means brake.
  for (const other of others) {
    if (other === car) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const od = Math.hypot(ox, oy);
    if (od < 110 && Math.abs(angleDiff(angleTo(car.x, car.y, other.x, other.y), car.angle)) < 0.5) {
      throttle = Math.min(throttle, 0);
      break;
    }
  }
  stepCar(car, throttle, steer, false, dt, city, others);
  return dist < 70;
}

// Traffic: pick the next intersection, drive to it, then pick another one.
// A car that cannot move for a while picks a new target instead of waiting.
export function stepTrafficCar(car, dt, city, rng, others) {
  if (!car.target) {
    const node = city.nearestIntersection(car.x, car.y);
    const next = city.neighbours(node);
    car.target = next.length ? rng.pick(next) : node;
  }
  const arrived = driveToward(car, car.target.x, car.target.y, dt, city, others, CAR.trafficSpeed);
  if (car.speed < 4) car.stuck += dt;
  else car.stuck = 0;
  if (arrived || car.stuck > 4) {
    const node = city.nearestIntersection(car.target.x, car.target.y);
    const next = city.neighbours(node).filter((n) => !(n.x === car.x && n.y === car.y));
    car.target = next.length ? rng.pick(next) : node;
    car.stuck = 0;
  }
  if (car.speed > CAR.trafficSpeed) car.speed = CAR.trafficSpeed;
}

// Pedestrians: stroll along the road edges and turn at crossings. When danger
// (a gunshot, a speeding car, a police chase) is close they run away from it.
export function stepPed(ped, dt, city, rng, danger) {
  if (ped.state === 'down') return;
  let fx = 0;
  let fy = 0;
  if (danger) {
    const d = Math.hypot(ped.x - danger.x, ped.y - danger.y);
    if (d < 260) {
      ped.state = 'flee';
      fx = (ped.x - danger.x) / (d || 1);
      fy = (ped.y - danger.y) / (d || 1);
    }
  }
  if (ped.state !== 'flee') {
    ped.timer -= dt;
    if (ped.timer <= 0) {
      ped.timer = rng.range(2, 6);
      ped.dir += rng.pick([-Math.PI / 2, Math.PI / 2, 0, 0, Math.PI]);
    }
    fx = Math.cos(ped.dir);
    fy = Math.sin(ped.dir);
  }
  const speed = ped.state === 'flee' ? 150 : ped.speed;
  ped.x += fx * speed * dt;
  ped.y += fy * speed * dt;
  ped.angle = Math.atan2(fy, fx);
  city.clampToWorld(ped, 12);
  city.collideCircle(ped, 10);
  if (ped.state === 'flee' && !danger) ped.state = 'walk';
}

// Police: chase the player's position, predict a little ahead when the player
// is driving, and ram. Returns how long this cop has stayed touching the player.
export function stepPoliceCar(cop, dt, playerPos, playerSpeed, city, others, touchTime) {
  const lead = 0.35;
  const tx = playerPos.x + (playerPos.vx || 0) * lead;
  const ty = playerPos.y + (playerPos.vy || 0) * lead;
  const dx = tx - cop.x;
  const dy = ty - cop.y;
  const dist = Math.hypot(dx, dy);
  const wanted = angleTo(cop.x, cop.y, tx, ty);
  const err = angleDiff(wanted, cop.angle);
  const steer = Math.max(-1, Math.min(1, err * 2.6));
  let throttle = 1;
  if (Math.abs(err) > 1.4) throttle = 0.3;
  stepCar(cop, throttle, steer, false, dt, city, others);
  cop.siren += dt;
  if (dist < 70) return touchTime + dt;
  return Math.max(0, touchTime - dt * 2);
}

export function policeCountForStars(stars) {
  return [0, 1, 2, 3, 4, 5][Math.max(0, Math.min(5, stars))];
}

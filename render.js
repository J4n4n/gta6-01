// Everything the player sees: the city from above, the cars and people in it,
// the HUD (objective, money, health, wanted stars, minimap) and the menus.
// All drawing is canvas shapes — no images, no fonts from the network.
import { VIEW_WIDTH, VIEW_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, AVENUES, STREETS, ROAD_HALF, COLORS, PLACES } from './config.js';

const MINIMAP_W = 210;
const MINIMAP_H = 140;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGround(ctx, city, cam) {
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(cam.x - VIEW_WIDTH / 2 - 40, cam.y - VIEW_HEIGHT / 2 - 40, VIEW_WIDTH + 80, VIEW_HEIGHT + 80);
  // Beach and water along the south edge.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(cam.x - VIEW_WIDTH / 2 - 40, 2230, VIEW_WIDTH + 80, 120);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(cam.x - VIEW_WIDTH / 2 - 40, 2350, VIEW_WIDTH + 80, 60);
  ctx.fillStyle = '#ffffff22';
  for (let x = 0; x < WORLD_WIDTH; x += 260) {
    ctx.fillRect(x, 2352, 120, 4);
  }
  // Park.
  ctx.fillStyle = COLORS.park;
  ctx.fillRect(1440, 940, 720, 520);
  ctx.fillStyle = '#6fb25a';
  ctx.fillRect(1500, 1000, 600, 400);
}

function drawRoads(ctx, cam) {
  ctx.fillStyle = COLORS.sidewalk;
  for (const x of AVENUES) ctx.fillRect(x - ROAD_HALF - 14, 0, ROAD_HALF * 2 + 28, WORLD_HEIGHT);
  for (const y of STREETS) ctx.fillRect(0, y - ROAD_HALF - 14, WORLD_WIDTH, ROAD_HALF * 2 + 28);
  ctx.fillStyle = COLORS.road;
  for (const x of AVENUES) ctx.fillRect(x - ROAD_HALF, 0, ROAD_HALF * 2, WORLD_HEIGHT);
  for (const y of STREETS) ctx.fillRect(0, y - ROAD_HALF, WORLD_WIDTH, ROAD_HALF * 2);
  // Centre dashes.
  ctx.fillStyle = COLORS.lane;
  for (const x of AVENUES) {
    for (let y = 40; y < WORLD_HEIGHT; y += 90) ctx.fillRect(x - 3, y, 6, 44);
  }
  for (const y of STREETS) {
    for (let x = 40; x < WORLD_WIDTH; x += 90) ctx.fillRect(x, y - 3, 44, 6);
  }
  // Crosswalks at every intersection: bars across each road mouth.
  ctx.fillStyle = '#e8e8e8cc';
  for (const x of AVENUES) {
    for (const y of STREETS) {
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(x - ROAD_HALF - 4, y + i * 16 - 5, ROAD_HALF * 2 + 8, 9);
        ctx.fillRect(x + i * 16 - 5, y - ROAD_HALF - 4, 9, ROAD_HALF * 2 + 8);
      }
    }
  }
}

function drawCityDetails(ctx, city) {
  for (const b of city.buildings) {
    ctx.fillStyle = '#00000030';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.globalAlpha = b.shade;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#00000055';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#ffffff2e';
    ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, 14);
    ctx.fillStyle = '#0000002e';
    ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.35, b.w * 0.4, b.h * 0.3);
  }
  for (const c of city.crates) {
    ctx.fillStyle = '#a86f2e';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = '#7a4f1e';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x, c.y, c.w, c.h);
  }
  for (const t of city.trees) {
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
    ctx.fillStyle = COLORS.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f8f3f';
    ctx.beginPath();
    ctx.arc(t.x - 4, t.y - 4, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mara's garage: a marked yard with a sign.
  ctx.fillStyle = '#c9c2b2';
  ctx.fillRect(200, 1850, 260, 260);
  ctx.fillStyle = '#3a3f4a';
  ctx.fillRect(230, 1890, 200, 120);
  ctx.fillStyle = '#e8d44d';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("MARA'S", 330, 1955);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.fillText('GARAGE', 330, 1978);
  // Hospital cross.
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(880, 240, 40, 40);
  ctx.fillStyle = '#d93d3d';
  ctx.fillRect(896, 248, 8, 24);
  ctx.fillRect(888, 256, 24, 8);
}

function drawCarShape(ctx, car, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = '#00000033';
  roundRect(ctx, -24 + 4, -13 + 5, 48, 26, 8);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#111';
  ctx.fillRect(-18, -15, 12, 5);
  ctx.fillRect(-18, 10, 12, 5);
  ctx.fillRect(8, -15, 12, 5);
  ctx.fillRect(8, 10, 12, 5);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -24, -13, 48, 26, 8);
  ctx.fill();
  // Windshield and roof.
  ctx.fillStyle = '#22303e';
  roundRect(ctx, 4, -10, 12, 20, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff22';
  roundRect(ctx, -12, -10, 12, 20, 4);
  ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#2b5cff';
    ctx.fillRect(-24, -4, 48, 8);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    const flash = Math.floor(car.siren * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2b5cff';
    ctx.beginPath();
    ctx.arc(-6, -11, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#2b5cff' : '#ff2e2e';
    ctx.beginPath();
    ctx.arc(6, -11, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    roundRect(ctx, -27, -16, 54, 32, 9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPedShape(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(ped.angle);
  ctx.fillStyle = '#00000030';
  ctx.beginPath();
  ctx.arc(2, 3, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc(4, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayerShape(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#00000040';
  ctx.beginPath();
  ctx.arc(2, 3, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(5, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // Direction tick.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(20, 0);
  ctx.stroke();
  ctx.restore();
  // Punch arc flash.
  if (player.punchTimer > 0.2) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.strokeStyle = '#ffffffcc';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 30, -0.7, 0.7);
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMissionMarker(ctx, marker, time) {
  if (!marker) return;
  const pulse = 1 + Math.sin(time * 5) * 0.18;
  ctx.save();
  ctx.translate(marker.x, marker.y);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -26 * pulse);
  ctx.lineTo(18 * pulse, 0);
  ctx.lineTo(0, 26 * pulse);
  ctx.lineTo(-18 * pulse, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#ffd23f66';
  ctx.beginPath();
  ctx.arc(0, 0, 30 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // A beam so the marker reads from far away.
  ctx.save();
  ctx.globalAlpha = 0.25 + Math.sin(time * 5) * 0.08;
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(marker.x - 3, marker.y - 320, 6, 320);
  ctx.restore();
}

function drawMinimap(ctx, game) {
  const x0 = 16;
  const y0 = VIEW_HEIGHT - MINIMAP_H - 16;
  const sx = MINIMAP_W / WORLD_WIDTH;
  const sy = MINIMAP_H / WORLD_HEIGHT;
  ctx.save();
  ctx.fillStyle = '#10131add';
  roundRect(ctx, x0 - 6, y0 - 6, MINIMAP_W + 12, MINIMAP_H + 12, 8);
  ctx.fill();
  ctx.strokeStyle = '#ffffff44';
  ctx.lineWidth = 1;
  roundRect(ctx, x0 - 6, y0 - 6, MINIMAP_W + 12, MINIMAP_H + 12, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x0, y0, MINIMAP_W, MINIMAP_H);
  ctx.clip();
  ctx.fillStyle = '#3d5a34';
  ctx.fillRect(x0, y0, MINIMAP_W, MINIMAP_H);
  ctx.fillStyle = '#3f8fbf';
  ctx.fillRect(x0, y0 + MINIMAP_H - 8, MINIMAP_W, 8);
  ctx.strokeStyle = '#8a8f9a';
  ctx.lineWidth = 3;
  for (const ax of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(x0 + ax * sx, y0);
    ctx.lineTo(x0 + ax * sx, y0 + MINIMAP_H);
    ctx.stroke();
  }
  for (const sy2 of STREETS) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + sy2 * sy);
    ctx.lineTo(x0 + MINIMAP_W, y0 + sy2 * sy);
    ctx.stroke();
  }
  for (const car of game.cars) {
    ctx.fillStyle = car.kind === 'police' ? '#5f8dff' : '#e8e8e8';
    ctx.fillRect(x0 + car.x * sx - 2, y0 + car.y * sy - 2, 4, 4);
  }
  for (const ped of game.peds) {
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(x0 + ped.x * sx - 1, y0 + ped.y * sy - 1, 2, 2);
  }
  const marker = game.mission.marker();
  if (marker) {
    const blink = Math.floor(game.time * 3) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(x0 + marker.x * sx, y0 + marker.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const px = game.player.onFoot ? game.player.x : game.player.car.x;
  const py = game.player.onFoot ? game.player.y : game.player.car.y;
  ctx.fillStyle = '#ffd23f';
  ctx.save();
  ctx.translate(x0 + px * sx, y0 + py * sy);
  ctx.rotate(game.player.angle);
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#ffffffcc';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR', x0, y0 - 10 + 0);
}

function drawHud(ctx, game) {
  const player = game.player;
  // Objective bar, top centre.
  ctx.fillStyle = '#10131acc';
  const obj = game.mission.objectiveText();
  ctx.font = 'bold 17px Arial, sans-serif';
  const objW = Math.min(760, ctx.measureText(obj).width + 36);
  roundRect(ctx, VIEW_WIDTH / 2 - objW / 2, 12, objW, 34, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.textAlign = 'center';
  ctx.fillText(obj, VIEW_WIDTH / 2, 35);
  // Money, health, wanted — top right.
  ctx.textAlign = 'right';
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillStyle = '#7dff8a';
  ctx.fillText(`$${player.money}`, VIEW_WIDTH - 20, 44);
  ctx.fillStyle = '#10131acc';
  roundRect(ctx, VIEW_WIDTH - 220, 54, 200, 16, 6);
  ctx.fill();
  ctx.fillStyle = player.hp > 30 ? '#54d654' : '#d93d3d';
  roundRect(ctx, VIEW_WIDTH - 218, 56, 196 * Math.max(0, player.hp / 100), 12, 5);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.fillText(`HP ${Math.ceil(player.hp)}`, VIEW_WIDTH - 20, 82);
  // Wanted stars.
  ctx.font = '28px Arial, sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < game.wanted ? '★' : '☆';
  ctx.fillStyle = game.wanted > 0 ? '#ffd23f' : '#ffffff88';
  ctx.fillText(stars, VIEW_WIDTH - 20, 116);
  if (game.wanted > 0) {
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillStyle = '#ff6a5e';
    ctx.fillText(game.wanted >= 3 ? 'THE HEAT IS ON' : 'POLICE ALERTED', VIEW_WIDTH - 20, 136);
  }
  // Speed, bottom right.
  ctx.textAlign = 'right';
  if (!player.onFoot && player.car) {
    const kmh = Math.round(Math.abs(player.car.speed) * 0.36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillText(`${kmh} km/h`, VIEW_WIDTH - 20, VIEW_HEIGHT - 20);
    ctx.font = '13px Arial, sans-serif';
    ctx.fillStyle = '#ffffffaa';
    ctx.fillText('W/S — drive/reverse · E — exit · Space — handbrake', VIEW_WIDTH - 20, VIEW_HEIGHT - 44);
  } else {
    ctx.font = '13px Arial, sans-serif';
    ctx.fillStyle = '#ffffffcc';
    ctx.fillText('E — enter car · F — punch · Click — shoot', VIEW_WIDTH - 20, VIEW_HEIGHT - 20);
    ctx.fillText('WASD — move · Shift — run · P — pause · M — mute', VIEW_WIDTH - 20, VIEW_HEIGHT - 44);
  }
  // Toast.
  const toast = game.mission.getToast();
  if (toast) {
    ctx.font = 'bold 19px Arial, sans-serif';
    const w = ctx.measureText(toast).width + 40;
    ctx.fillStyle = '#10131add';
    roundRect(ctx, VIEW_WIDTH / 2 - w / 2, VIEW_HEIGHT - 96, w, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'center';
    ctx.fillText(toast, VIEW_WIDTH / 2, VIEW_HEIGHT - 69);
  }
  // Hurt flash.
  if (player.hurtTimer > 0) {
    ctx.fillStyle = `rgba(217, 40, 40, ${player.hurtTimer * 0.25})`;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }
  // Off-screen marker arrow.
  const marker = game.mission.marker();
  if (marker) {
    const px = player.onFoot ? player.x : player.car.x;
    const py = player.onFoot ? player.y : player.car.y;
    const dx = marker.x - px;
    const dy = marker.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist > 620) {
      const angle = Math.atan2(dy, dx);
      const ax = VIEW_WIDTH / 2 + Math.cos(angle) * 300;
      const ay = VIEW_HEIGHT / 2 + Math.sin(angle) * 200;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(angle);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 15px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(dist / 10)}m`, ax, ay + 34);
    }
  }
}

function drawTitle(ctx, game, best) {
  ctx.fillStyle = '#0c0e14d9';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 84px Arial, sans-serif';
  ctx.fillText('SOLMAR HEAT', VIEW_WIDTH / 2, 190);
  ctx.fillStyle = '#ff5e4d';
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillText('AN OPEN-WORLD CRIME GAME', VIEW_WIDTH / 2, 232);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '19px Arial, sans-serif';
  ctx.fillText('Jax owes Sal $5,000. Mara has three jobs that pay it off.', VIEW_WIDTH / 2, 290);
  ctx.fillText('Steal cars. Outrun the police. Deliver the goods.', VIEW_WIDTH / 2, 320);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 22px Arial, sans-serif';
  if (game.save) ctx.fillText('ENTER — Continue  ·  N — New game', VIEW_WIDTH / 2, 400);
  else ctx.fillText('ENTER or CLICK — Start', VIEW_WIDTH / 2, 400);
  ctx.fillStyle = '#c9c9c9';
  ctx.font = '16px Arial, sans-serif';
  ctx.fillText('WASD move / drive · E enter & exit cars · F punch · Click shoot · Shift run', VIEW_WIDTH / 2, 470);
  ctx.fillText('P pause · M mute · progress saves automatically', VIEW_WIDTH / 2, 496);
  if (best > 0) {
    ctx.fillStyle = '#7dff8a';
    ctx.fillText(`Best fortune: $${best}`, VIEW_WIDTH / 2, 540);
  }
  ctx.fillStyle = '#888';
  ctx.font = '14px Arial, sans-serif';
  ctx.fillText('A work of fiction. Solmar, its people and its streets are invented.', VIEW_WIDTH / 2, 660);
}

function drawBriefing(ctx, mission) {
  ctx.fillStyle = '#0c0e14cc';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.fillText(mission.title, VIEW_WIDTH / 2, 220);
  ctx.fillStyle = '#fff';
  ctx.font = '20px Arial, sans-serif';
  const words = mission.brief.split(' ');
  const lines = [''];
  for (const word of words) {
    if ((lines[lines.length - 1] + ' ' + word).trim().length > 62) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  lines.forEach((line, i) => ctx.fillText(line.trim(), VIEW_WIDTH / 2, 280 + i * 30));
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillText(`Reward: $${mission.reward}`, VIEW_WIDTH / 2, 300 + lines.length * 30);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText('ENTER or CLICK — Start the job', VIEW_WIDTH / 2, 360 + lines.length * 30);
}

function drawPause(ctx) {
  ctx.fillStyle = '#0c0e14b8';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px Arial, sans-serif';
  ctx.fillText('PAUSED', VIEW_WIDTH / 2, 320);
  ctx.font = '20px Arial, sans-serif';
  ctx.fillStyle = '#c9c9c9';
  ctx.fillText('P or Esc — resume · progress is saved', VIEW_WIDTH / 2, 370);
}

function drawGameOver(ctx, reason, money) {
  ctx.fillStyle = '#1a0c0cd9';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5e4d';
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.fillText(reason === 'busted' ? 'BUSTED' : 'WASTED', VIEW_WIDTH / 2, 300);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '20px Arial, sans-serif';
  ctx.fillText(reason === 'busted'
    ? 'The Solmar PD caught up with you. The fine stings, the job waits.'
    : 'You went down in the streets of Solmar. The job waits.', VIEW_WIDTH / 2, 350);
  ctx.fillStyle = '#7dff8a';
  ctx.fillText(`You keep $${money} — the mission restarts from its start.`, VIEW_WIDTH / 2, 390);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillText('ENTER or CLICK — Try again', VIEW_WIDTH / 2, 460);
}

function drawEnding(ctx) {
  ctx.fillStyle = '#0c1410d9';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 56px Arial, sans-serif';
  ctx.fillText('DEBT PAID', VIEW_WIDTH / 2, 280);
  ctx.fillStyle = '#fff';
  ctx.font = '21px Arial, sans-serif';
  ctx.fillText('Sal is square. Mara is smiling. Solmar is yours now, Jax.', VIEW_WIDTH / 2, 330);
  ctx.fillText('Free roam continues — steal, drive, and stay out of the cells.', VIEW_WIDTH / 2, 362);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText('ENTER or CLICK — Keep playing', VIEW_WIDTH / 2, 430);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function draw(game, screen, best) {
    const cam = game.camera;
    ctx.save();
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.translate(VIEW_WIDTH / 2 - cam.x, VIEW_HEIGHT / 2 - cam.y);
    drawGround(ctx, game.city, cam);
    drawRoads(ctx, cam);
    drawCityDetails(ctx, game.city);
    drawMissionMarker(ctx, game.mission.marker(), game.time);
    for (const car of game.cars) drawCarShape(ctx, car, game.player.car === car);
    for (const ped of game.peds) drawPedShape(ctx, ped);
    for (const cop of game.cops) drawCarShape(ctx, cop, false);
    if (game.player.onFoot) drawPlayerShape(ctx, game.player, game.time);
    drawParticles(ctx, game.particles);
    ctx.restore();
    if (screen === 'play' || screen === 'pause') drawHud(ctx, game);
    drawMinimap(ctx, game);
    if (screen === 'title') drawTitle(ctx, game, best);
    else if (screen === 'brief') drawBriefing(ctx, game.mission.current());
    else if (screen === 'pause') drawPause(ctx);
    else if (screen === 'over') drawGameOver(ctx, game.overReason, game.player.money);
    else if (screen === 'ending') drawEnding(ctx);
  }
  return { draw };
}

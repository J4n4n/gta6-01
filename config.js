// Solmar Heat: every number the game tunes by, in one place.
// The city is a road grid; the player explores it on foot and by car.
export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;
export const WORLD_WIDTH = 3600;
export const WORLD_HEIGHT = 2400;
export const STEP = 1 / 60;
export const ROAD_HALF = 60;
export const SAVE_KEY = 'solmar-heat-save-v1';
export const BEST_KEY = 'solmar-heat-best-v1';

// Avenues run north-south, streets east-west. Intersections are the traffic graph.
export const AVENUES = [300, 900, 1500, 2100, 2700, 3300];
export const STREETS = [300, 900, 1500, 2100];

// Named places the story and the missions use.
export const PLACES = {
  garage: { x: 330, y: 1980, label: "Mara's Garage" },
  docks: { x: 3420, y: 1500, label: 'Solmar Docks' },
  northLot: { x: 2100, y: 180, label: 'North Lot' },
  downtown: { x: 1500, y: 900, label: 'Downtown' },
  hospital: { x: 900, y: 300, label: 'St. Anselm Hospital' },
  salDrop: { x: 2700, y: 2100, label: "Sal's Drop" },
  beach: { x: 1500, y: 2320, label: 'Solmar Beach' },
  park: { x: 1800, y: 1200, label: 'Palm Park' },
};

export const PLAYER = {
  walkSpeed: 230,
  runSpeed: 330,
  radius: 14,
  maxHp: 100,
  punchRange: 34,
  punchDamage: 12,
  punchCooldown: 0.35,
  shootCooldown: 0.28,
  bulletDamage: 26,
  startAmmo: 24,
  startMoney: 150,
};

export const CAR = {
  accel: 520,
  brake: 760,
  reverseAccel: 300,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  grip: 6.5,
  radius: 26,
  trafficSpeed: 170,
  // Cops are a touch slower than the player's car: a good driver can pull
  // away from them, which is what makes "lose the cops" winnable.
  policeSpeed: 500,
};

export const WANTED = {
  decaySeconds: 14,
  maxStars: 5,
  stealStars: 1,
  assaultStars: 1,
  shootStars: 1,
  copKillStars: 2,
};

// Cops per wanted level, and how close one must stay to bust the player on foot.
export const POLICE = {
  perStar: [0, 1, 2, 3, 4, 5],
  bustRange: 62,
  bustSeconds: 1.2,
  ramDamage: 9,
};

export const COLORS = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  road: '#3a3f4a',
  roadEdge: '#2e323c',
  sidewalk: '#b9b3a4',
  lane: '#e8d44d',
  buildingRoof: ['#c96f4a', '#4a7a96', '#8a6fb0', '#b0a06f', '#5f8f6a', '#96504a'],
  buildingEdge: '#00000033',
  water: '#3f8fbf',
  sand: '#e0c98f',
  park: '#5d9b4a',
  tree: '#2f6b2f',
  player: '#ffd23f',
  cop: '#2b5cff',
  copLight: '#ff2e2e',
};

// The three jobs pay the $5,000 debt exactly: $1,400 + $1,600 + $2,000.
// Job 0 (meet Mara) pays nothing — it is the introduction.
export const MISSION_REWARDS = [0, 1400, 1600, 2000];
export const BUST_FINE = 200;

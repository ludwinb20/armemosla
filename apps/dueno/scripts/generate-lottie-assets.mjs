import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../assets/lottie');
mkdirSync(outDir, { recursive: true });

const BRAND = [0, 0.7725490196078432, 0.43137254901960786, 1];
const BRAND_DARK = [0, 0.6274509803921569, 0.35294117647058826, 1];
const WHITE = [1, 1, 1, 1];
const GRAY = [0.55, 0.55, 0.55, 1];
const GOLD = [0.96, 0.76, 0.26, 1];

function base(name, w, h, op, layers) {
  return {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op,
    w,
    h,
    nm: name,
    ddd: 0,
    assets: [],
    layers,
  };
}

function shapeLayer(name, ind, shapes, ks, op = 60) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm: name,
    sr: 1,
    ks,
    ao: 0,
    shapes,
    ip: 0,
    op,
    st: 0,
    bm: 0,
  };
}

function ellipse(name, w, h, fill) {
  return {
    ty: 'gr',
    it: [
      { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [w, h] }, nm: 'Ellipse' },
      { ty: 'fl', c: { a: 0, k: fill }, o: { a: 0, k: 100 }, r: 1, nm: 'Fill' },
      {
        ty: 'tr',
        p: { a: 0, k: [0, 0] },
        a: { a: 0, k: [0, 0] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        sk: { a: 0, k: 0 },
        sa: { a: 0, k: 0 },
        nm: 'Transform',
      },
    ],
    nm: name,
    np: 3,
    cix: 2,
    bm: 0,
  };
}

function rect(name, w, h, fill, round = 0) {
  return {
    ty: 'gr',
    it: [
      { ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [w, h] }, r: { a: 0, k: round }, nm: 'Rect' },
      { ty: 'fl', c: { a: 0, k: fill }, o: { a: 0, k: 100 }, r: 1, nm: 'Fill' },
      {
        ty: 'tr',
        p: { a: 0, k: [0, 0] },
        a: { a: 0, k: [0, 0] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        sk: { a: 0, k: 0 },
        sa: { a: 0, k: 0 },
        nm: 'Transform',
      },
    ],
    nm: name,
    np: 3,
    cix: 2,
    bm: 0,
  };
}

function staticKs(x, y) {
  return {
    o: { a: 0, k: 100 },
    r: { a: 0, k: 0 },
    p: { a: 0, k: [x, y, 0] },
    a: { a: 0, k: [0, 0, 0] },
    s: { a: 0, k: [100, 100, 100] },
  };
}

const soccerBallLoading = base('SoccerBallLoading', 200, 200, 60, [
  shapeLayer(
    'Ball',
    1,
    [ellipse('Ball', 72, 72, BRAND)],
    {
      o: { a: 0, k: 100 },
      r: {
        a: 1,
        k: [
          { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 0, s: [0] },
          { t: 60, s: [360] },
        ],
      },
      p: {
        a: 1,
        k: [
          {
            i: { x: 0.667, y: 1 },
            o: { x: 0.333, y: 0 },
            t: 0,
            s: [100, 130, 0],
            to: [0, -6.667, 0],
            ti: [0, 6.667, 0],
          },
          {
            i: { x: 0.667, y: 1 },
            o: { x: 0.333, y: 0 },
            t: 30,
            s: [100, 90, 0],
            to: [0, 6.667, 0],
            ti: [0, -6.667, 0],
          },
          { t: 60, s: [100, 130, 0] },
        ],
      },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    }
  ),
]);

const soccerFieldEmpty = base('SoccerFieldEmpty', 220, 160, 90, [
  shapeLayer('Field', 1, [rect('Field', 180, 110, BRAND_DARK, 8)], staticKs(110, 85)),
  shapeLayer('Line', 2, [rect('Line', 120, 4, WHITE, 2)], staticKs(110, 85)),
  shapeLayer('GoalLeft', 3, [rect('Goal', 8, 44, WHITE, 2)], staticKs(28, 85)),
  shapeLayer('GoalRight', 4, [rect('Goal', 8, 44, WHITE, 2)], staticKs(192, 85)),
  shapeLayer(
    'Pulse',
    5,
    [ellipse('Pulse', 18, 18, WHITE)],
    {
      o: {
        a: 1,
        k: [
          { t: 0, s: [20] },
          { t: 45, s: [70] },
          { t: 90, s: [20] },
        ],
      },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [110, 85, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    90
  ),
]);

const playerPulse = (opacityKeyframes) => ({
  o: { a: 1, k: opacityKeyframes },
  r: { a: 0, k: 0 },
  p: { a: 0, k: [0, 0, 0] },
  a: { a: 0, k: [0, 0, 0] },
  s: { a: 0, k: [100, 100, 100] },
});

const playersWaiting = base('PlayersWaiting', 220, 160, 90, [
  shapeLayer(
    'PlayerABody',
    1,
    [rect('Body', 34, 42, BRAND_DARK, 6)],
    { ...playerPulse([{ t: 0, s: [100] }, { t: 45, s: [55] }, { t: 90, s: [100] }]), p: { a: 0, k: [78, 102, 0] } },
    90
  ),
  shapeLayer(
    'PlayerAHead',
    2,
    [ellipse('Head', 26, 26, BRAND)],
    { ...playerPulse([{ t: 0, s: [100] }, { t: 45, s: [55] }, { t: 90, s: [100] }]), p: { a: 0, k: [78, 72, 0] } },
    90
  ),
  shapeLayer(
    'PlayerBBody',
    3,
    [rect('Body', 34, 42, GRAY, 6)],
    { ...playerPulse([{ t: 0, s: [55] }, { t: 45, s: [100] }, { t: 90, s: [55] }]), p: { a: 0, k: [142, 102, 0] } },
    90
  ),
  shapeLayer(
    'PlayerBHead',
    4,
    [ellipse('Head', 26, 26, GRAY)],
    { ...playerPulse([{ t: 0, s: [55] }, { t: 45, s: [100] }, { t: 90, s: [55] }]), p: { a: 0, k: [142, 72, 0] } },
    90
  ),
  shapeLayer('Ball', 5, [ellipse('Ball', 20, 20, WHITE)], staticKs(110, 128)),
]);

const trophyIdle = base('TrophyIdle', 180, 180, 90, [
  shapeLayer('Cup', 1, [rect('Cup', 70, 52, GOLD, 8)], staticKs(90, 78)),
  shapeLayer('Base', 2, [rect('Base', 46, 16, GOLD, 4)], staticKs(90, 118)),
  shapeLayer('HandleL', 3, [rect('Handle', 14, 34, GOLD, 6)], staticKs(52, 78)),
  shapeLayer('HandleR', 4, [rect('Handle', 14, 34, GOLD, 6)], staticKs(128, 78)),
  shapeLayer(
    'Shine',
    5,
    [ellipse('Shine', 24, 24, WHITE)],
    {
      o: {
        a: 1,
        k: [
          { t: 0, s: [15] },
          { t: 45, s: [55] },
          { t: 90, s: [15] },
        ],
      },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [104, 68, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    90
  ),
]);

const teamJersey = base('TeamJersey', 180, 180, 90, [
  shapeLayer('Shirt', 1, [rect('Shirt', 84, 96, BRAND, 10)], staticKs(90, 92)),
  shapeLayer('Collar', 2, [rect('Collar', 36, 14, WHITE, 4)], staticKs(90, 58)),
  shapeLayer('Stripe', 3, [rect('Stripe', 84, 12, WHITE, 0)], staticKs(90, 92)),
  shapeLayer(
    'Badge',
    4,
    [ellipse('Badge', 22, 22, GOLD)],
    {
      o: {
        a: 1,
        k: [
          { t: 0, s: [70] },
          { t: 45, s: [100] },
          { t: 90, s: [70] },
        ],
      },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [90, 86, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    90
  ),
]);

const files = {
  'soccer-ball-loading.json': soccerBallLoading,
  'soccer-field-empty.json': soccerFieldEmpty,
  'players-waiting.json': playersWaiting,
  'trophy-idle.json': trophyIdle,
  'team-jersey.json': teamJersey,
};

for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(outDir, name), JSON.stringify(data));
  console.log(`Wrote ${name}`);
}

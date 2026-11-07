/**
 * 哈希驱动的前端视觉重构生成器
 * ------------------------------------------------------------------
 * 规则：每个 SHA-256 十六进制串共 64 位，"每一位都要用上"。
 *   位  0..35 : 6 组颜色种子，每组 6 位 = #RRGGBB（每位分别是 R/G/B 的高低位）
 *   位 36..63 : 28 个设计维度，每位取 0..15 的满量程值（4 bit 全部参与）
 * 全部 64 位会被逐位写入 trace（溯源表），并断言 64/64 无遗漏、无重复消费。
 * 输出的每份 HTML 自带"哈希指纹条"（64 格）与"逐位溯源表"，可自行核对。
 *
 * 用法：node tools/generate-design.mjs            # 生成 4 份预览到 design-previews/
 *       node tools/generate-design.mjs --final    # 生成深色 A 定稿到 site/index.html
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PREVIEW_DIR = path.join(ROOT, 'design-previews');
const SITE_DIR = path.join(ROOT, 'site');

const HASHES = {
  A: '1e4b46aee916671ecc6c7fc9350b2849bc98fec4486eac2b15bcb7d66a95eebd',
  B: '2d4fa62b0f299744037599c72769b9c9066346ce4f7748268104188470865b36',
  C: '4898f5907452e0e0f47f8f04198c0979320921e3b2402db6869aa62faf66067a',
  D: '117ea9792e19b3ebc4d4326ac8b52bb4632cf60fb10f7b28fb66461f8169df0e',
};

/* ---------------------------------------------------------------- 工具 */
const n = (c) => parseInt(c, 16);                     // 单个 hex 字符 -> 0..15
const scale = (a, b, v) => a + (b - a) * (v / 15);    // 0..15 满量程线性映射
const mix = (a, b, t) => a + (b - a) * t;             // 0..1 混合
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const f1 = (x) => Number(x).toFixed(1);
const f2 = (x) => Number(x).toFixed(2);
const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0, s = 0; const l = (max + min) / 2;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60; if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

/* 全串 64 位参与：FNV-1a 逐位混合，任何一位变化都会改变种子 */
function hashSeed(chars) {
  let h = 0x811c9dc5;
  for (const c of chars) { h ^= n(c); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/* ------------------------------------------------- 64 位消费表（静态定义） */
const COLOR_SEEDS = [
  { key: 'bg',       label: '背景基色', start: 0 },
  { key: 'surface',  label: '面板基色', start: 6 },
  { key: 'primary',  label: '主色',     start: 12 },
  { key: 'accent',   label: '强调色',   start: 18 },
  { key: 'tertiary', label: '第三色',   start: 24 },
  { key: 'ink',      label: '墨色',     start: 30 },
];
const CHANNEL = ['R 高位', 'R 低位', 'G 高位', 'G 低位', 'B 高位', 'B 低位'];

const FONTS = [
  '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  'Georgia, "Songti SC", "SimSun", serif',
  '"SFMono-Regular", Consolas, "Courier New", monospace',
  '"Trebuchet MS", "PingFang SC", sans-serif',
  '"Arial Black", Impact, "Microsoft YaHei", sans-serif',
  'Verdana, "Microsoft YaHei", sans-serif',
  '"Times New Roman", "SimSun", serif',
  'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
  '"Comic Sans MS", "Microsoft YaHei", cursive',
  '"Palatino Linotype", "Songti SC", serif',
  '"Lucida Console", Consolas, monospace',
  '"Helvetica Neue", Arial, "PingFang SC", sans-serif',
  '"Century Gothic", "Microsoft YaHei", sans-serif',
  'Baskerville, "Songti SC", serif',
  '"Courier New", "SimSun", monospace',
  'Optima, "PingFang SC", "Microsoft YaHei", sans-serif',
];

const TEXTURES = [
  ['无纹理', 'none', 0],
  ['细网格', 'linear-gradient(rgba(127,127,127,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(127,127,127,.10) 1px,transparent 1px)', .55],
  ['粗网格', 'linear-gradient(rgba(127,127,127,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(127,127,127,.14) 1px,transparent 1px)', .7],
  ['点阵', 'radial-gradient(rgba(127,127,127,.28) 1px,transparent 1.2px)', .6],
  ['斜线', 'repeating-linear-gradient(45deg,rgba(127,127,127,.10) 0 1px,transparent 1px 9px)', .7],
  ['十字', 'linear-gradient(rgba(127,127,127,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(127,127,127,.09) 1px,transparent 1px),radial-gradient(rgba(127,127,127,.18) 1px,transparent 1px)', .6],
  ['扫描线', 'repeating-linear-gradient(0deg,rgba(127,127,127,.10) 0 1px,transparent 1px 4px)', .65],
  ['光晕', 'radial-gradient(ellipse at 18% 8%,rgba(255,255,255,.14),transparent 46%),radial-gradient(ellipse at 82% 78%,rgba(255,255,255,.09),transparent 44%)', .9],
  ['同心圆', 'repeating-radial-gradient(circle at 50% 0%,rgba(127,127,127,.10) 0 1px,transparent 1px 22px)', .7],
  ['棋盘', 'conic-gradient(rgba(127,127,127,.10) 25%,transparent 0 50%,rgba(127,127,127,.10) 0 75%,transparent 0)', .5],
  ['竖纹', 'repeating-linear-gradient(90deg,rgba(127,127,127,.10) 0 1px,transparent 1px 12px)', .7],
  ['波纹', 'repeating-radial-gradient(ellipse at 50% 120%,rgba(127,127,127,.11) 0 1px,transparent 1px 18px)', .7],
  ['条形码', 'repeating-linear-gradient(90deg,rgba(127,127,127,.16) 0 2px,transparent 2px 5px,rgba(127,127,127,.12) 5px 6px,transparent 6px 11px)', .55],
  ['星点', 'radial-gradient(rgba(255,255,255,.30) 1px,transparent 1.5px),radial-gradient(rgba(255,255,255,.18) 1px,transparent 1.5px)', .5],
  ['电路', 'linear-gradient(90deg,rgba(127,127,127,.09) 1px,transparent 1px),linear-gradient(rgba(127,127,127,.09) 1px,transparent 1px),radial-gradient(circle,rgba(127,127,127,.22) 1.5px,transparent 2px)', .6],
  ['纸纹', 'repeating-linear-gradient(0deg,rgba(127,127,127,.045) 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,rgba(127,127,127,.045) 0 1px,transparent 1px 3px)', .8],
];

const MOTIONS = [
  ['静态', ''],
  ['淡入', '.zone{animation:dxFade .8s both}@keyframes dxFade{from{opacity:0}to{opacity:1}}'],
  ['上浮', '.zone{animation:dxUp .7s both}@keyframes dxUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}'],
  ['缩放', '.zone{animation:dxZoom .7s both}@keyframes dxZoom{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}'],
  ['左滑入', '.zone{animation:dxLeft .7s both}@keyframes dxLeft{from{opacity:0;transform:translateX(-22px)}to{opacity:1;transform:none}}'],
  ['倾斜归位', '.zone{animation:dxTilt .8s both}@keyframes dxTilt{from{opacity:0;transform:perspective(800px) rotateY(6deg)}to{opacity:1;transform:none}}'],
  ['呼吸', '.card{animation:dxBreath 5s ease-in-out infinite}@keyframes dxBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.008)}}'],
  ['节拍脉冲', '.big-num{animation:dxBeat 1.4s ease-in-out infinite}@keyframes dxBeat{0%,100%{opacity:.82;transform:scale(1)}50%{opacity:1;transform:scale(1.045)}}'],
  ['顶栏滑落', '.topbar{animation:dxDrop .7s both}@keyframes dxDrop{from{transform:translateY(-100%)}to{transform:none}}'],
  ['光扫', '.card{position:relative;overflow:hidden}.card::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.10) 50%,transparent 65%);transform:translateX(-120%);animation:dxSweep 6s linear infinite;pointer-events:none}@keyframes dxSweep{to{transform:translateX(120%)}}'],
  ['渐次浮现', '.zone{animation:dxFade .9s both}.zone:nth-child(2){animation-delay:.08s}.zone:nth-child(3){animation-delay:.16s}.zone:nth-child(4){animation-delay:.24s}.zone:nth-child(5){animation-delay:.32s}.zone:nth-child(6){animation-delay:.4s}.zone:nth-child(7){animation-delay:.48s}.zone:nth-child(8){animation-delay:.56s}.zone:nth-child(9){animation-delay:.64s}'],
  ['微浮动', '.hero-readout{animation:dxFloat 6s ease-in-out infinite}@keyframes dxFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}'],
  ['边框绘制', '.card{animation:dxDraw 1.1s both}@keyframes dxDraw{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}'],
  ['色相漂移', '@keyframes dxHue{0%,100%{filter:none}50%{filter:hue-rotate(14deg)}}.wrap{animation:dxHue 14s ease-in-out infinite}'],
  ['数字跳动', '.big-num{animation:dxJump 2.4s ease-in-out infinite}@keyframes dxJump{0%,100%{transform:translateY(0)}45%{transform:translateY(-6px)}55%{transform:translateY(0)}}'],
  ['极缓呼吸', '.wrap{animation:dxBreath2 9s ease-in-out infinite}@keyframes dxBreath2{0%,100%{opacity:.97}50%{opacity:1}}'],
];

const MICROS = [
  ['无', ''],
  ['抬升', '.card:hover,.btn:hover{transform:translateY(-4px)}'],
  ['发光', '.card:hover,.btn:hover{box-shadow:0 0 0 1px var(--primary),0 0 26px color-mix(in srgb,var(--primary) 45%,transparent)}'],
  ['放大', '.card:hover{transform:scale(1.012)}.btn:hover{transform:scale(1.06)}'],
  ['反转', '.btn:hover{background:var(--ink);color:var(--bg);border-color:var(--ink)}'],
  ['边框绘制', '.card:hover{outline:2px solid var(--accent);outline-offset:3px}'],
  ['阴影加深', '.card:hover{box-shadow:0 16px 40px rgba(0,0,0,.28)}'],
  ['下划线展开', '.zone-title::after{content:"";display:block;height:2px;width:0;background:var(--accent);transition:width .35s}.zone:hover .zone-title::after{width:100%}'],
  ['背景滑入', '.btn{position:relative;overflow:hidden;z-index:0}.btn::before{content:"";position:absolute;inset:0;background:var(--accent);transform:translateX(-101%);transition:transform .32s;z-index:-1}.btn:hover::before{transform:none}.btn:hover{color:var(--bg)}'],
  ['轻微旋转', '.card:hover{transform:rotate(-.4deg)}'],
  ['模糊聚焦', '.stage:hover .card:not(:hover){filter:blur(1.2px);opacity:.72}'],
  ['斜切', '.btn:hover{transform:skewX(-6deg)}'],
  ['脉冲圈', '.card:hover{animation:dxPulse .6s ease-out}@keyframes dxPulse{50%{box-shadow:0 0 0 8px color-mix(in srgb,var(--accent) 22%,transparent)}}'],
  ['数字高亮', '.card:hover .num{color:var(--accent)}'],
  ['边框呼吸', '.card{transition:border-color .3s}.card:hover{border-color:var(--tertiary)}'],
  ['磁吸位移', '.btn:hover{transform:translateY(-2px) translateX(2px)}'],
];

const BUTTONS = [
  ['实心', 'background:var(--primary);color:var(--on-primary);border-color:var(--primary)'],
  ['描边', 'background:transparent;color:var(--primary);border-color:var(--primary)'],
  ['幽灵', 'background:color-mix(in srgb,var(--primary) 12%,transparent);color:var(--primary);border-color:color-mix(in srgb,var(--primary) 32%,transparent)'],
  ['药丸', 'background:var(--primary);color:var(--on-primary);border-color:transparent;border-radius:999px'],
  ['方角', 'background:var(--surface-2);color:var(--ink);border-color:var(--line);border-radius:0'],
  ['斜切', 'background:var(--accent);color:var(--bg);border-color:transparent;clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%)'],
  ['下划线', 'background:transparent;color:var(--ink);border:0;border-bottom:2px solid var(--primary);border-radius:0'],
  ['霓虹', 'background:transparent;color:var(--accent);border-color:var(--accent);box-shadow:inset 0 0 12px color-mix(in srgb,var(--accent) 25%,transparent),0 0 12px color-mix(in srgb,var(--accent) 22%,transparent)'],
  ['立体', 'background:var(--surface-2);color:var(--ink);border-color:var(--line);box-shadow:0 4px 0 var(--line)'],
  ['渐变', 'background:linear-gradient(100deg,var(--primary),var(--tertiary));color:var(--on-primary);border-color:transparent'],
  ['双线', 'background:transparent;color:var(--ink);border:2px solid var(--line);outline:1px solid var(--line);outline-offset:3px'],
  ['左色条', 'background:var(--surface-2);color:var(--ink);border-color:var(--line);border-left:4px solid var(--accent)'],
  ['圆点', 'background:var(--surface-2);color:var(--ink);border-color:var(--line);border-radius:999px;padding-left:1.4em'],
  ['反色', 'background:var(--ink);color:var(--bg);border-color:var(--ink)'],
  ['细框大字', 'background:transparent;color:var(--primary);border-color:var(--primary);font-weight:800;letter-spacing:.08em'],
  ['点阵底', 'background-image:radial-gradient(color-mix(in srgb,var(--primary) 35%,transparent) 1px,transparent 1.5px);background-size:6px 6px;color:var(--primary);border-color:var(--primary)'],
];

const PRESENTS = [
  ['常规卡片', ''],
  ['整屏分章', '.wrap{scroll-snap-type:y proximity}.zone{scroll-snap-align:start;min-height:72vh;display:flex}.zone>.card{width:100%}'],
  ['无边框极简', '.card{border:0;box-shadow:none;background:transparent;padding:0}.stage{gap:calc(var(--gap) * 1.8)}'],
  ['厚描边', '.card{border-width:3px;box-shadow:6px 6px 0 color-mix(in srgb,var(--line) 70%,transparent)}'],
  ['斑马交替', '.zone:nth-child(even)>.card{background:var(--surface-2)}'],
  ['报纸分栏', '.guide-body{column-count:2;column-gap:2.4em;column-rule:1px solid var(--line)}'],
  ['终端流', '.card{background:color-mix(in srgb,var(--bg) 88%,var(--ink));border-color:color-mix(in srgb,var(--primary) 40%,transparent);font-family:monospace}.eyebrow::before{content:"> "}'],
  ['蓝图', '.card{background:transparent;border:1px solid var(--primary);background-image:linear-gradient(color-mix(in srgb,var(--primary) 12%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--primary) 12%,transparent) 1px,transparent 1px);background-size:16px 16px}'],
  ['贴纸墙', '.zone:nth-child(3n+1)>.card{transform:rotate(-.7deg)}.zone:nth-child(3n+2)>.card{transform:rotate(.6deg)}.card{box-shadow:3px 6px 0 color-mix(in srgb,var(--ink) 18%,transparent)}'],
  ['仪表盘', '.card{padding:calc(var(--pad) * .7)}.stage{gap:calc(var(--gap) * .65)}.zone-title{font-size:.82rem;letter-spacing:.14em;text-transform:uppercase}'],
  ['杂志', '.hero-card h2{font-size:2.6em;line-height:1.05}.zone:first-child>.card{padding:calc(var(--pad) * 1.6)}.zone-title{font-style:italic}'],
  ['层叠', '.stage{gap:0}.card{border-radius:0;margin-bottom:-1px}.zone:nth-child(odd)>.card{background:var(--surface-2)}'],
  ['玻璃', '.card{background:color-mix(in srgb,var(--surface) 68%,transparent);backdrop-filter:blur(14px);border-color:color-mix(in srgb,var(--ink) 16%,transparent)}'],
  ['霓虹', '.card{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 30%,transparent),0 0 22px color-mix(in srgb,var(--primary) 18%,transparent)}.zone-title{text-shadow:0 0 14px color-mix(in srgb,var(--accent) 60%,transparent)}'],
  ['纸感', '.card{background:color-mix(in srgb,var(--surface) 92%,var(--ink));border-color:color-mix(in srgb,var(--ink) 30%,transparent);box-shadow:1px 2px 0 color-mix(in srgb,var(--ink) 14%,transparent)}'],
  ['极细线框', '.card{background:transparent;border-width:1px;box-shadow:none}.zone:not(:last-child){border-bottom:1px solid var(--line)}'],
];

const DECORS = [
  ['◆', '.zone::before{content:"◆";top:10px;right:14px;color:var(--primary)}'],
  ['▮', '.zone::before{content:"▮";top:0;left:0;color:var(--accent);font-size:1.4em;line-height:1}'],
  ['＋', '.zone::before{content:"＋";top:8px;right:12px;color:var(--tertiary);font-size:1.3em}'],
  ['／／', '.zone::before{content:"／／";bottom:8px;right:14px;color:var(--line);letter-spacing:-.15em}'],
  ['□', '.zone::before{content:"□";top:10px;left:12px;color:var(--primary);font-size:1.2em}'],
  ['✳', '.zone::before{content:"✳";top:8px;right:12px;color:var(--accent)}'],
  ['┌┐', '.zone::before{content:"┌──────┐";top:6px;left:12px;color:var(--line);font-size:.7em;letter-spacing:.1em}'],
  ['● ○', '.zone::before{content:"● ○ ○";bottom:10px;left:14px;color:var(--tertiary);font-size:.7em;letter-spacing:.3em}'],
  ['№', '.zone::before{content:"№";top:8px;right:14px;color:var(--ink-soft);font-size:1.3em}'],
  ['═', '.zone::before{content:"══════";bottom:0;left:0;right:0;color:var(--primary);font-size:.6em;letter-spacing:.2em;opacity:.5}'],
  ['◤', '.zone::before{content:"◤";top:0;right:0;color:var(--accent);font-size:1.8em;line-height:1}'],
  ['✦', '.zone::before{content:"✦";top:10px;left:14px;color:var(--tertiary)}'],
  ['░', '.zone::before{content:"░░░░░";bottom:8px;right:12px;color:var(--line);font-size:.7em}'],
  ['⌁', '.zone::before{content:"⌁";top:6px;right:16px;color:var(--accent);font-size:1.5em}'],
  ['◉', '.zone::before{content:"◉";top:10px;right:14px;color:var(--primary)}'],
  ['· · ·', '.zone::before{content:"· · ·";bottom:8px;left:14px;color:var(--ink-soft);letter-spacing:.4em}'],
];

const ICONS = ['●', '■', '◆', '▲', '✦', '▸', '○', '□', '◇', '△', '✳', '►', '⬡', '✚', '※', '·'];
const DIVIDERS = [
  '1px solid', '2px solid', '1px dashed', '1px dotted', '3px double', '1px solid',
  '2px dashed', '2px dotted', '4px solid', '1px solid', '2px dashed', '3px double',
  '1px dotted', '4px double', '2px solid', '0 none',
];
const MODE_FILTERS = [
  'none', 'saturate(1.22)', 'contrast(1.09)', 'saturate(.78) contrast(1.06)',
  'hue-rotate(9deg)', 'saturate(1.38) contrast(.96)', 'grayscale(.22)', 'hue-rotate(-11deg) saturate(1.14)',
];

/* 28 个单字符维度：索引 36..63 一一对应，顺序不可改 */
const DIMS = [
  { key: 'FONT',       label: '字体族',     describe: (v) => `字体栈 #${v} · ${FONTS[v].split(',')[0]}` },
  { key: 'SCALE',      label: '字号比例',   describe: (v) => `基准 ${f1(scale(13, 19, v))}px / 比例 ${f2(scale(1.12, 1.42, v))}` },
  { key: 'SPACE',      label: '间距单位',   describe: (v) => `${f1(scale(4, 13, v))}px` },
  { key: 'RADIUS',     label: '圆角',       describe: (v) => `${f1(scale(0, 30, v))}px` },
  { key: 'LAYOUT',     label: '布局架构',   describe: (v) => `骨架 ${v >> 2}/3 · 变体 ${v & 3}/3（叠加全串 64 位 PRNG 派生的列宽/跨度/顺序）` },
  { key: 'NAV',        label: '导航形态',   describe: (v) => `${v & 1 ? '侧栏' : '顶栏'} / ${v & 2 ? '竖排' : '横排'} / ${v & 4 ? '实心' : '透明'} / ${v & 8 ? '悬浮' : '常规'}` },
  { key: 'ALIGN',      label: '排版对齐',   describe: (v) => `标题${v & 1 ? '居中' : '左'} · 正文${v & 2 ? '居中' : '左'} · 字距${v & 4 ? '松' : '紧'} · 数字${v & 8 ? '等宽' : '比例'}` },
  { key: 'DENSITY',    label: '信息密度',   describe: (v) => `内边距 ${f1(scale(10, 34, v))}px / 行高 ${f2(scale(1.3, 1.95, v))}` },
  { key: 'BORDER',     label: '边框',       describe: (v) => `${f1(scale(0, 3, v))}px ${['solid', 'dashed', 'dotted', 'double'][v % 4]}` },
  { key: 'SHADOW',     label: '阴影',       describe: (v) => `偏移 ${f1(scale(0, 12, v))}px / 模糊 ${f1(scale(4, 46, v))}px` },
  { key: 'MOTION',     label: '动效',       describe: (v) => MOTIONS[v][0] },
  { key: 'TEXTURE',    label: '背景纹理',   describe: (v) => TEXTURES[v][0] },
  { key: 'DIRECTION',  label: '排列方向',   describe: (v) => `Hero${v & 1 ? '纵' : '横'} / 按钮${v & 2 ? '纵' : '横'} / 键值${v & 4 ? '纵' : '横'} / ${v & 8 ? '反序' : '正序'}` },
  { key: 'WEIGHT',     label: '字重',       describe: (v) => `${Math.round(scale(300, 900, v) / 100) * 100}` },
  { key: 'BUTTON',     label: '按钮造型',   describe: (v) => BUTTONS[v][0] },
  { key: 'VIZ',        label: '波形可视化', describe: (v) => `波形样式 #${v} / ${['条形', '圆点', '折线', '面积', '镜像', '阶梯', '环形', '放射', '频谱', '粒子', '网格柱', '烛台', '玫瑰', '心电', '波纹', '点阵'][v]}` },
  { key: 'DECOR',      label: '装饰角标',   describe: (v) => `角标 ${DECORS[v][0]}` },
  { key: 'COLS',       label: '栅格列数',   describe: (v) => `${2 + Math.floor(v / 4)} 列` },
  { key: 'MODE',       label: '明暗与色调', describe: (v) => `${v >= 8 ? '浅色' : '深色'} / 色调档 ${v % 8}` },
  { key: 'CORNER',     label: '边角形态',   describe: (v) => `四角圆角位 ${v.toString(2).padStart(4, '0')}` },
  { key: 'ICON',       label: '列表符号',   describe: (v) => `符号 ${ICONS[v]}` },
  { key: 'RHYTHM',     label: '区块节奏',   describe: (v) => `栅格间距 ${f1(scale(8, 30, v))}px` },
  { key: 'MICRO',      label: '微交互',     describe: (v) => MICROS[v][0] },
  { key: 'DIVIDER',    label: '分隔线',     describe: (v) => DIVIDERS[v] },
  { key: 'WHITESPACE', label: '留白',       describe: (v) => `内容宽 ${Math.round(scale(880, 1560, v))}px` },
  { key: 'PRESENT',    label: '呈现风格',   describe: (v) => PRESENTS[v][0] },
  { key: 'SIGNATURE',  label: '签名水印',   describe: (v) => `角度 ${f1(scale(-16, 16, v))}° / 位置 ${v % 4}` },
  { key: 'FINGERPRINT',label: '指纹条形态', describe: (v) => `${[8, 16, 16, 32, 32, 64, 64, 8, 16, 32, 64, 16, 32, 8, 64, 32][v]} 格排列 · 样式 #${v}` },
];

/* ------------------------------------------------------------- 布局 16 套 */
const ZONES = ['hero', 'transport', 'monitor', 'result', 'candidates', 'audio', 'algos', 'guide', 'foot'];
function layoutOf(v) {
  const frame = v >> 2, flavor = v & 3;
  const ratio = [
    (c) => Array.from({ length: c }, () => '1fr').join(' '),
    (c) => c === 2 ? '1.35fr 1fr' : c === 3 ? '1.3fr 1fr 1fr' : '1.4fr 1fr 1fr 1fr',
    (c) => c === 2 ? '1fr 1.35fr' : c === 3 ? '1fr 1.3fr 1fr' : '1fr 1fr 1.4fr 1fr',
    (c) => c === 2 ? '2fr 1fr' : c === 3 ? '1fr 2fr 1fr' : '2fr 1fr 1fr 1fr',
  ][flavor];

  let cols, spans, order, name;
  if (frame === 0) {                       // 单列长卷
    cols = 1;
    spans = Object.fromEntries(ZONES.map((z) => [z, 1]));
    const orders = [
      ZONES,
      ['hero', 'result', 'candidates', 'transport', 'monitor', 'audio', 'algos', 'guide', 'foot'],
      ['hero', 'monitor', 'transport', 'result', 'candidates', 'algos', 'audio', 'guide', 'foot'],
      ['hero', 'transport', 'result', 'monitor', 'candidates', 'audio', 'guide', 'algos', 'foot'],
    ];
    order = orders[flavor];
    name = '单列长卷 · 顺序 ' + flavor;
  } else if (frame === 1) {                // 主区 + 侧栏
    cols = 2 + (flavor % 2);
    spans = { hero: cols, foot: cols, guide: cols, result: 2, monitor: cols - 1, transport: 1, candidates: 1, audio: 1, algos: cols - 1 };
    order = flavor % 2 ? ['hero', 'result', 'candidates', 'audio', 'transport', 'monitor', 'algos', 'guide', 'foot']
                       : ['hero', 'transport', 'monitor', 'result', 'candidates', 'audio', 'algos', 'guide', 'foot'];
    name = '主区+侧栏 · 比 ' + flavor;
  } else if (frame === 2) {                // Bento 仪表盘
    cols = 3 + (flavor % 2);
    spans = { hero: cols, result: 2, monitor: 2, algos: cols - 1, guide: cols - 1, foot: cols, transport: 1, candidates: 1, audio: 1 };
    order = flavor >= 2 ? ['hero', 'result', 'monitor', 'candidates', 'audio', 'transport', 'algos', 'guide', 'foot']
                        : ['hero', 'result', 'monitor', 'transport', 'candidates', 'audio', 'algos', 'guide', 'foot'];
    name = 'Bento 网格 · 比 ' + flavor;
  } else {                                 // 双栏分屏对照
    cols = 2 + (flavor === 3 ? 1 : 0);
    spans = { hero: cols, monitor: cols, guide: cols, foot: cols, transport: 1, result: 1, candidates: 1, audio: 1, algos: cols - 1 };
    order = flavor % 2 ? ['hero', 'result', 'transport', 'candidates', 'audio', 'monitor', 'algos', 'guide', 'foot']
                       : ['hero', 'transport', 'result', 'candidates', 'audio', 'monitor', 'algos', 'guide', 'foot'];
    name = '分屏对照 · 比 ' + flavor;
  }
  spans = Object.fromEntries(ZONES.map((z) => [z, Math.min(cols, Math.max(1, spans[z] || 1))]));
  return { cols, columns: ratio(cols), spans, order, name, frame, flavor };
}

/* ------------------------------------------------------------ 波形 16 种 */
function vizSVG(v, chars) {
  const wave = chars.map((c) => n(c) / 15);
  const W = 640, H = 120, N = 64, step = W / N;
  const y = (t) => (H - 8) - t * (H - 20);
  let inner = '';
  const color = 'var(--primary)', color2 = 'var(--accent)';
  switch (v) {
    case 0: // 条形
      inner = wave.map((t, i) => `<rect x="${f1(i * step + 1)}" y="${f1(y(t))}" width="${f1(step - 2)}" height="${f1(H - 8 - y(t))}" fill="${i % 7 === 0 ? color2 : color}" opacity="${f2(.45 + t * .55)}"/>`).join(''); break;
    case 1: // 圆点
      inner = wave.map((t, i) => `<circle cx="${f1(i * step + step / 2)}" cy="${f1(y(t))}" r="${f1(1.4 + t * 3.2)}" fill="${i % 5 === 0 ? color2 : color}"/>`).join(''); break;
    case 2: // 折线
      inner = `<polyline points="${wave.map((t, i) => `${f1(i * step)},${f1(y(t))}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`
            + `<polyline points="${wave.map((t, i) => `${f1(i * step)},${f1(y(t * .55))}`).join(' ')}" fill="none" stroke="${color2}" stroke-width="1.4" opacity=".7"/>`; break;
    case 3: // 面积
      inner = `<path d="M0,${H} ${wave.map((t, i) => `L${f1(i * step)},${f1(y(t))}`).join(' ')} L${W},${H} Z" fill="${color}" opacity=".30"/>`
            + `<polyline points="${wave.map((t, i) => `${f1(i * step)},${f1(y(t))}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`; break;
    case 4: // 镜像
      inner = wave.map((t, i) => `<rect x="${f1(i * step + 1)}" y="${f1(H / 2 - t * (H / 2 - 6))}" width="${f1(step - 2)}" height="${f1(t * (H - 12))}" fill="${i % 6 === 0 ? color2 : color}" opacity=".8"/>`).join('')
            + `<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="${color2}" opacity=".4"/>`; break;
    case 5: // 阶梯
      inner = `<path d="${wave.map((t, i) => `${i ? 'H' : 'M'}${f1(i * step)} ${i ? `V${f1(y(t))}` : `V${f1(y(t))}`}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`; break;
    case 6: // 环形
      inner = wave.map((t, i) => {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2, r0 = 26, r1 = 26 + t * 26;
        return `<line x1="${f1(80 + Math.cos(a) * r0)}" y1="${f1(60 + Math.sin(a) * r0)}" x2="${f1(80 + Math.cos(a) * r1)}" y2="${f1(60 + Math.sin(a) * r1)}" stroke="${i % 8 === 0 ? color2 : color}" stroke-width="2"/>`;
      }).join('') + `<circle cx="80" cy="60" r="24" fill="none" stroke="${color2}" opacity=".5"/>`; break;
    case 7: // 放射
      inner = wave.map((t, i) => {
        const a = (i / N) * Math.PI * 2;
        return `<line x1="${W / 2}" y1="${H / 2}" x2="${f1(W / 2 + Math.cos(a) * (18 + t * 120))}" y2="${f1(H / 2 + Math.sin(a) * (14 + t * 46))}" stroke="${i % 9 === 0 ? color2 : color}" stroke-width="1.4" opacity="${f2(.3 + t * .6)}"/>`;
      }).join(''); break;
    case 8: // 频谱
      inner = wave.map((t, i) => `<rect x="${f1(i * step + .5)}" y="${f1(H - 8 - Math.pow(t, 1.6) * (H - 16))}" width="${f1(step - 1)}" height="${f1(Math.pow(t, 1.6) * (H - 16))}" fill="${t > .7 ? color2 : color}" opacity=".85"/>`).join(''); break;
    case 9: // 粒子
      inner = wave.map((t, i) => `<circle cx="${f1(i * step + step / 2)}" cy="${f1(12 + ((i * 37) % 96))}" r="${f1(.8 + t * 2.6)}" fill="${color}" opacity="${f2(.25 + t * .7)}"/>`).join(''); break;
    case 10: // 网格柱
      inner = `<g opacity=".18">${Array.from({ length: 7 }, (_, j) => `<line x1="0" y1="${f1(j * 18 + 6)}" x2="${W}" y2="${f1(j * 18 + 6)}" stroke="${color2}"/>`).join('')}</g>`
            + wave.filter((_, i) => i % 2 === 0).map((t, i) => `<rect x="${f1(i * step * 2 + 1)}" y="${f1(y(t))}" width="${f1(step * 2 - 3)}" height="${f1(H - 8 - y(t))}" fill="${color}"/>`).join(''); break;
    case 11: // 烛台
      inner = wave.filter((_, i) => i % 4 === 0).map((t, i) => {
        const x = i * step * 4 + step * 2, top = y(Math.min(1, t + .15)), bot = y(Math.max(0, t - .15));
        return `<line x1="${f1(x)}" y1="${f1(top - 10)}" x2="${f1(x)}" y2="${f1(bot + 10)}" stroke="${color2}" stroke-width="1"/><rect x="${f1(x - 5)}" y="${f1(top)}" width="10" height="${f1(Math.max(3, bot - top))}" fill="${color}"/>`;
      }).join(''); break;
    case 12: // 玫瑰
      inner = wave.map((t, i) => {
        const a = (i / N) * Math.PI * 2, r = 10 + t * 48;
        return `<line x1="${W / 2}" y1="${H / 2}" x2="${f1(W / 2 + Math.cos(a) * r)}" y2="${f1(H / 2 + Math.sin(a) * r)}" stroke="${color}" stroke-width="1" opacity=".55"/>`;
      }).join('') + `<polyline points="${wave.map((t, i) => { const a = (i / N) * Math.PI * 2, r = 10 + t * 48; return `${f1(W / 2 + Math.cos(a) * r)},${f1(H / 2 + Math.sin(a) * r)}`; }).join(' ')}" fill="none" stroke="${color2}" stroke-width="2"/>`; break;
    case 13: // 心电
      inner = `<polyline points="${wave.map((t, i) => `${f1(i * step)},${f1(H / 2 + (i % 8 === 3 ? -1 : 1) * t * (i % 8 === 3 ? 42 : 12))}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`; break;
    case 14: // 波纹
      inner = [0, 1, 2].map((k) => `<polyline points="${wave.map((t, i) => `${f1(i * step)},${f1(H / 2 + Math.sin(i / 4 + k) * (8 + t * 26))}`).join(' ')}" fill="none" stroke="${k === 1 ? color2 : color}" stroke-width="${k === 1 ? 2 : 1.2}" opacity="${f2(.35 + k * .22)}"/>`).join(''); break;
    default: // 点阵
      inner = wave.map((t, i) => Array.from({ length: Math.max(1, Math.round(t * 5)) }, (_, j) =>
        `<rect x="${f1(i * step + 1)}" y="${f1(H - 10 - j * 9)}" width="${f1(step - 2)}" height="5" rx="1" fill="${j === 0 ? color2 : color}" opacity="${f2(.9 - j * .12)}"/>`).join('')).join('');
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="由哈希 64 位生成的波形">${inner}</svg>`;
}

/* ---------------------------------------------------------- Token 构建 */
function build(key, hash, opts = {}) {
  const darkOverride = !!opts.dark;   // 深色适配：仅翻转 MODE 位的明暗解释
  const final = !!opts.final;         // 正式定稿：去掉预览元数据，溯源收进折叠面板
  const chars = [...hash];
  if (chars.length !== 64 || chars.some((c) => !/[0-9a-f]/.test(c))) {
    throw new Error(`${key}: 哈希必须是 64 位小写十六进制，实际 ${chars.length} 位`);
  }

  const trace = new Array(64).fill(null);
  const seeds = {};

  COLOR_SEEDS.forEach((s) => {
    const group = chars.slice(s.start, s.start + 6).join('');
    const rgb = [0, 2, 4].map((i) => parseInt(group.slice(i, i + 2), 16));
    seeds[s.key] = { hex: '#' + group, rgb, hsl: rgbToHsl(...rgb) };
    for (let j = 0; j < 6; j++) {
      const idx = s.start + j;
      trace[idx] = { index: idx, char: chars[idx], consumer: `COLOR.${s.key} · ${CHANNEL[j]}`,
        value: chars[idx], effect: `${s.label} #${group}（RGB ${rgb.join(', ')}）` };
    }
  });

  const v = {};
  DIMS.forEach((d, i) => {
    const idx = 36 + i;
    v[d.key] = n(chars[idx]);
    trace[idx] = { index: idx, char: chars[idx], consumer: `${d.key} · ${d.label}`,
      value: v[d.key], effect: d.describe(v[d.key]) };
  });

  const missing = trace.map((t, i) => (t ? null : i)).filter((i) => i !== null);
  if (missing.length) throw new Error(`${key}: 第 ${missing.join(',')} 位未被消费`);
  if (new Set(trace.map((t) => t.consumer)).size !== 64) throw new Error(`${key}: 消费项重复`);

  // 深色适配：A 的哈希 64 位保持不变，只把第 54 位（MODE）的明暗解释翻转，
  // 色调档 v.MODE % 8 与其余 63 位的全部作用原样保留，并在溯源表里如实标注。
  if (darkOverride) {
    trace[54].consumer = 'MODE · 明暗与色调（深色适配）';
    trace[54].effect = `深色适配：明暗解释由「浅色」翻转为「深色」，色调档 ${v.MODE % 8} 与其余 63 位全部保留`;
  }

  /* ---- 颜色：完全由 6 组种子 + MODE 位派生，仅做可读性区间约束 ---- */
  const isLight = darkOverride ? false : v.MODE >= 8;
  const tint = v.MODE % 8;
  const role = (name, kind) => {
    const [h, s0, l0] = seeds[name].hsl;
    let s, l;
    if (kind === 'bg') { s = mix(4, 30, s0 / 100); l = isLight ? mix(92, 99, l0 / 100) : mix(4, 14, l0 / 100); }
    else if (kind === 'surface') { s = mix(5, 34, s0 / 100); l = isLight ? mix(84, 97, l0 / 100) : mix(8, 22, l0 / 100); }
    else if (kind === 'ink') { s = mix(2, 20, s0 / 100); l = isLight ? mix(6, 24, l0 / 100) : mix(86, 99, l0 / 100); }
    else { s = mix(46, 92, s0 / 100); l = isLight ? mix(34, 52, l0 / 100) : mix(50, 70, l0 / 100); }
    return { h, s, l, css: `hsl(${f1(h)}, ${f1(s)}%, ${f1(l)}%)` };
  };
  const C = { bg: role('bg', 'bg'), surface: role('surface', 'surface'),
    primary: role('primary', 'chroma'), accent: role('accent', 'chroma'),
    tertiary: role('tertiary', 'chroma'), ink: role('ink', 'ink') };
  const surf2L = clamp(C.surface.l + (isLight ? -5 : 6), 3, 97);
  const onPrimary = C.primary.l > 58 ? 'hsl(0, 0%, 8%)' : '#ffffff';
  const lineL = isLight ? mix(30, 60, C.ink.l / 100) : mix(30, 70, C.ink.l / 100);

  /* ---- 数值型 token（全部 0..15 满量程） ---- */
  const T = {
    font: FONTS[v.FONT],
    fs: f1(scale(13, 19, v.SCALE)),
    ratio: f2(scale(1.12, 1.42, v.SCALE)),
    space: f1(scale(4, 13, v.SPACE)),
    radius: f1(scale(0, 30, v.RADIUS)),
    weight: Math.round(scale(300, 900, v.WEIGHT) / 100) * 100,
    pad: f1(scale(10, 34, v.DENSITY)),
    lh: f2(scale(1.3, 1.95, v.DENSITY)),
    bw: f1(scale(0, 3, v.BORDER)),
    bstyle: ['solid', 'dashed', 'dotted', 'double'][v.BORDER % 4],
    shadow: v.SHADOW === 0 ? 'none' : `0 ${f1(scale(0, 12, v.SHADOW))}px ${f1(scale(4, 46, v.SHADOW))}px hsla(${f1(C.ink.h)}, 40%, ${isLight ? 30 : 3}%, ${f2(scale(.08, .42, v.SHADOW))})`,
    gap: f1(scale(8, 30, v.RHYTHM)),
    contentW: Math.round(scale(880, 1560, v.WHITESPACE)),
    pageY: f1(scale(14, 58, v.WHITESPACE)),
    cols: layoutOf(v.LAYOUT).cols,
    tracking: (v.ALIGN & 4) ? f2(scale(.01, .10, v.SPACE)) + 'em' : f2(scale(-.02, .02, v.SPACE)) + 'em',
  };

  const corners = [v.CORNER & 1, v.CORNER & 2, v.CORNER & 4, v.CORNER & 8].map((b) => (b ? T.radius + 'px' : '0'));
  const alignTitle = (v.ALIGN & 1) ? 'center' : 'left';
  const alignBody = (v.ALIGN & 2) ? 'center' : 'left';
  const heroDir = (v.DIRECTION & 1) ? 'column' : 'row';
  const btnDir = (v.DIRECTION & 2) ? 'column' : 'row';
  const kvDir = (v.DIRECTION & 4) ? 'column' : 'row';
  const orderReverse = !!(v.DIRECTION & 8);

  /* ---- 布局：位 40 定骨架，全串 64 位经 PRNG 派生列宽 / 跨度 / 顺序微参数 ---- */
  const base = layoutOf(v.LAYOUT);
  const prngSeed = hashSeed(chars);          // 64 位逐位混合 -> 每份方案的布局细节必然不同
  const rand = rng(prngSeed);
  const lcols = base.cols;
  const columns = base.columns.split(' ').map((w) => f2(parseFloat(w) * (0.86 + rand() * 0.32)) + 'fr').join(' ');
  const spans = { ...base.spans };
  ZONES.forEach((z) => { if (rand() < 0.34) spans[z] = Math.min(lcols, spans[z] + 1); });
  // 顺序：保持骨架次序，用全串哈希对中间区块做确定性交错；hero/foot 固定首尾（可用性约束）
  const middle0 = ZONES.filter((z) => z !== 'hero' && z !== 'foot')
    .map((z) => ({ z, k: base.order.indexOf(z) + rand() * 1.9 }))
    .sort((a, b) => a.k - b.k).map((o) => o.z);
  const middle = orderReverse ? [...middle0].reverse() : middle0;
  const order = ['hero', ...middle, 'foot'];
  const layout = { ...base, cols: lcols, columns, spans, order, prngSeed };

  /* ---- CSS ---- */
  const root = `
:root{
  --bg:${C.bg.css}; --surface:${C.surface.css};
  --surface-2:hsl(${f1(C.surface.h)}, ${f1(C.surface.s)}%, ${f1(surf2L)}%);
  --primary:${C.primary.css}; --accent:${C.accent.css}; --tertiary:${C.tertiary.css};
  --ink:${C.ink.css}; --ink-soft:hsla(${f1(C.ink.h)}, ${f1(C.ink.s)}%, ${f1(C.ink.l)}%, .62);
  --line:hsla(${f1(C.ink.h)}, ${f1(C.ink.s)}%, ${f1(lineL)}%, .30);
  --on-primary:${onPrimary};
  --font:${T.font}; --fs-base:${T.fs}px; --ratio:${T.ratio}; --weight:${T.weight};
  --lh:${T.lh}; --tracking:${T.tracking}; --space:${T.space}px;
  --radius:${T.radius}px; --rtl:${corners[0]}; --rtr:${corners[1]}; --rbr:${corners[2]}; --rbl:${corners[3]};
  --border-w:${T.bw}px; --border-style:${T.bstyle}; --shadow:${T.shadow};
  --pad:${T.pad}px; --gap:${T.gap}px; --content-w:${T.contentW}px; --page-y:${T.pageY}px;
  --mode-filter:${MODE_FILTERS[tint]};
  --tex:${TEXTURES[v.TEXTURE][1]}; --tex-size:${[32, 24, 40, 14, 12, 24, 6, 100, 44, 20, 14, 36, 22, 46, 24, 4][v.TEXTURE]}px;
  --tex-opacity:${TEXTURES[v.TEXTURE][2]};
  --divider:${DIVIDERS[v.DIVIDER]};
  --icon:"${ICONS[v.ICON]}";
  --align-title:${alignTitle}; --align-body:${alignBody};
  --hero-dir:${heroDir}; --btn-dir:${btnDir}; --kv-dir:${kvDir};
  --cols:${layout.cols}; --col-template:${layout.columns};
  --sub-cols:${2 + Math.floor(v.COLS / 4)}; --num-variant:${(v.ALIGN & 8) ? 'tabular-nums' : 'proportional-nums'};
  --sig-angle:${f1(scale(-16, 16, v.SIGNATURE))}deg;
  --fp-cols:${[8, 16, 16, 32, 32, 64, 64, 8, 16, 32, 64, 16, 32, 8, 64, 32][v.FINGERPRINT]};
  --fp-gap:${[3, 2, 4, 2, 3, 1, 2, 5, 3, 2, 1, 4, 2, 6, 1, 3][v.FINGERPRINT]}px;
  --fp-radius:${[2, 0, 3, 1, 4, 0, 2, 6, 1, 2, 0, 3, 5, 0, 1, 4][v.FINGERPRINT]}px;
}`;

  const navCSS = (() => {
    const side = !!(v.NAV & 1), vertical = !!(v.NAV & 2), solid = !!(v.NAV & 4), floating = !!(v.NAV & 8);
    let s = '';
    if (side) {
      s += `.wrap{display:grid;grid-template-columns:minmax(150px,190px) minmax(0,1fr);gap:calc(var(--gap) * 1.5);align-items:start}`
        + `.topbar{grid-column:1;grid-row:1 / span 4;position:${floating ? 'sticky;top:18px' : 'relative'};flex-direction:column;align-items:flex-start;height:auto;gap:1.6em;padding:calc(var(--pad) * .9);border:var(--border-w) var(--border-style) var(--line);border-radius:var(--radius)}`
        + `.headline,.stage,.dna,.site-foot{grid-column:2}.topbar .brand{font-size:calc(var(--fs-base) * 1.05)}`
        + `.nav ul{flex-direction:column;align-items:flex-start;gap:.9em}`
        + `@media(max-width:900px){.wrap{display:block}.topbar{flex-direction:row;position:relative;height:auto}.nav ul{flex-direction:row}}`;
    } else {
      s += `.topbar{flex-direction:${vertical ? 'column' : 'row'};align-items:${vertical ? 'flex-start' : 'center'};gap:${vertical ? '.8em' : '1em'}}`
        + (vertical ? `.nav ul{flex-wrap:wrap}` : '');
      if (floating) s += `.topbar{position:sticky;top:12px;z-index:20;margin-bottom:calc(var(--gap) * 1.2);padding:calc(var(--pad) * .55) var(--pad);border:var(--border-w) var(--border-style) var(--line);border-radius:999px;backdrop-filter:blur(10px);box-shadow:var(--shadow)}`;
    }
    if (solid) s += `.topbar{background:var(--surface-2);border:var(--border-w) var(--border-style) var(--line);border-radius:var(--radius);padding:calc(var(--pad) * .6) var(--pad)}`;
    return s;
  })();

  const layoutCSS = `
.stage{display:grid;grid-template-columns:var(--col-template);gap:var(--gap);grid-auto-flow:row dense;align-items:stretch}
${ZONES.map((z) => `.zone[data-z="${z}"]{grid-column:span ${layout.spans[z]};order:${order.indexOf(z)}}`).join('\n')}
@media(max-width:900px){.stage{grid-template-columns:1fr}.zone{grid-column:span 1 !important}}
`;

  const presentCSS = PRESENTS[v.PRESENT][1];
  const motionCSS = MOTIONS[v.MOTION][1];
  const microCSS = MICROS[v.MICRO][1];
  const btnCSS = `.btn{${BUTTONS[v.BUTTON][1]}}`;
  const decorCSS = `.zone::before{position:absolute;z-index:3;font-size:.8em;pointer-events:none;opacity:.85;${DECORS[v.DECOR][1].split('{')[1].replace('}', '')}}`;

  const finalCSS = final ? `.dna>summary{font-size:.82em}.dna>p{margin-top:.9em}.dna .sub-trace{margin-top:1.1em;border-top:var(--divider) var(--line);padding-top:1em}` : '';

  const css = [root, baseCSS(), layoutCSS, navCSS, `.btn{${BUTTONS[v.BUTTON][1]}}`,
    presentCSS, motionCSS, microCSS, decorCSS, fingerprintCSS(v.FINGERPRINT), signatureCSS(v.SIGNATURE, key, hash), finalCSS].join('\n');

  return { key, hash, chars, trace, v, C, T, isLight, tint, layout, order, css,
    darkOverride, final,
    codename: `F${v.FONT} · L${v.LAYOUT} · P${v.PRESENT} · M${v.MODE}`,
    summary: {
      明暗: isLight ? '浅色' : '深色', 架构: layout.name, 呈现: PRESENTS[v.PRESENT][0],
      字体: FONTS[v.FONT].split(',')[0], 纹理: TEXTURES[v.TEXTURE][0], 动效: MOTIONS[v.MOTION][0],
      按钮: BUTTONS[v.BUTTON][0], 波形: v.VIZ, 列数: layout.cols,
      主色: C.primary.css, 强调: C.accent.css, 第三色: C.tertiary.css,
      背景: C.bg.css, 面板: C.surface.css, 墨色: C.ink.css,
    } };
}

/* ------------------------------------------------------------ 基础 CSS */
function baseCSS() {
  return `
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);font-size:var(--fs-base);
  font-weight:var(--weight);line-height:var(--lh);letter-spacing:var(--tracking);-webkit-font-smoothing:antialiased}
body::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background-image:var(--tex);
  background-size:var(--tex-size) var(--tex-size);opacity:var(--tex-opacity)}
.wrap{position:relative;z-index:1;max-width:calc(var(--content-w) + 64px);margin:0 auto;
  padding:var(--page-y) 32px;filter:var(--mode-filter)}
a{color:inherit;text-decoration:none}
h1,h2,h3,h4,p,ul{margin:0}
ul{padding:0;list-style:none}
.topbar{display:flex;justify-content:space-between;align-items:center;gap:1em;margin-bottom:calc(var(--gap) * 1.4);
  padding-bottom:calc(var(--space) * 1.2);border-bottom:var(--divider) var(--line)}
.brand{display:flex;align-items:center;gap:.6em;font-size:calc(var(--fs-base) * var(--ratio));font-weight:800;letter-spacing:-.02em;white-space:nowrap}
.brand em{font-style:normal;color:var(--ink-soft);font-weight:400}
.brand-mark{display:inline-grid;place-items:center;width:2.1em;height:2.1em;border-radius:var(--radius);
  background:var(--primary);color:var(--on-primary);font-size:.8em}
.nav ul{display:flex;gap:1.5em;font-size:.9em}
.nav a{color:var(--ink-soft);transition:color .2s}
.nav a:hover{color:var(--primary)}
.seed-badge{font-size:.72em;letter-spacing:.12em;color:var(--ink-soft);border:var(--border-w) var(--border-style) var(--line);
  padding:.35em .8em;border-radius:999px;white-space:nowrap}
.headline{margin-bottom:calc(var(--gap) * 1.6)}
.eyebrow{display:inline-block;font-size:.7em;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);
  margin-bottom:.7em;font-weight:700}
.headline h1{font-size:calc(var(--fs-base) * var(--ratio) * var(--ratio) * 2.1);line-height:1.04;
  letter-spacing:-.035em;font-weight:800;background:linear-gradient(100deg,var(--primary),var(--tertiary),var(--accent));
  -webkit-background-clip:text;background-clip:text;color:transparent}
.headline p{max-width:62ch;margin-top:.8em;color:var(--ink-soft);font-size:1.02em;text-align:var(--align-body)}
.head-meta{display:flex;flex-wrap:wrap;gap:.5em;margin-top:1.2em}
.chip{font-size:.72em;letter-spacing:.06em;padding:.35em .85em;border:var(--border-w) var(--border-style) var(--line);
  border-radius:999px;color:var(--ink-soft)}
.chip strong{color:var(--primary)}
.zone{position:relative;min-width:0}
.card{height:100%;background:var(--surface);border:var(--border-w) var(--border-style) var(--line);
  border-radius:var(--rtl) var(--rtr) var(--rbr) var(--rbl);box-shadow:var(--shadow);
  padding:var(--pad);transition:transform .28s ease,box-shadow .28s ease,border-color .28s ease,border-radius .28s ease}
.zone-title{font-size:calc(var(--fs-base) * var(--ratio) * 1.05);font-weight:800;letter-spacing:-.01em;
  text-align:var(--align-title);margin-bottom:.25em}
.zone-sub{font-size:.8em;color:var(--ink-soft);text-align:var(--align-body);margin-bottom:1.1em}
.divider{border-top:var(--divider) var(--line);margin:1.1em 0}
.hero-card{display:flex;flex-direction:var(--hero-dir);gap:calc(var(--gap) * 1.2);align-items:center}
.hero-copy{flex:1 1 50%;min-width:0;text-align:var(--align-body)}
.hero-copy h2{font-size:calc(var(--fs-base) * var(--ratio) * 1.7);line-height:1.1;letter-spacing:-.03em;margin-bottom:.5em}
.hero-copy p{color:var(--ink-soft);font-size:.95em;margin-bottom:1.3em}
.btn-row{display:flex;flex-direction:var(--btn-dir);flex-wrap:wrap;gap:.7em;justify-content:flex-start}
.btn{display:inline-flex;align-items:center;gap:.5em;cursor:pointer;font:inherit;font-size:.88em;font-weight:700;
  padding:.72em 1.25em;border:var(--border-w) var(--border-style) var(--line);border-radius:var(--radius);
  color:var(--ink);background:var(--surface-2);transition:transform .25s ease,box-shadow .25s ease,background .25s ease,color .25s ease}
.btn.primary{background:var(--primary);color:var(--on-primary);border-color:var(--primary)}
.btn.ghost{background:transparent}
.hero-readout{flex:1 1 38%;min-width:0;text-align:center;padding:calc(var(--pad) * .7);
  border:var(--border-w) var(--border-style) var(--line);border-radius:var(--radius);background:var(--surface-2)}
.big-num{font-size:calc(var(--fs-base) * var(--ratio) * 3.5);line-height:1;font-weight:800;letter-spacing:-.05em;
  color:var(--primary);font-variant-numeric:${'var(--num-variant, normal)'}}
.unit{font-size:.7em;letter-spacing:.2em;color:var(--ink-soft);text-transform:uppercase}
.beat-dots{display:flex;justify-content:center;gap:.4em;margin-top:.8em}
.beat-dots i{width:.45em;height:.45em;border-radius:50%;background:var(--accent);opacity:.35;animation:dot 1.2s infinite}
.beat-dots i:nth-child(2){animation-delay:.2s}.beat-dots i:nth-child(3){animation-delay:.4s}
@keyframes dot{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.3)}}
.viz{margin-top:1em;height:88px;overflow:hidden;border-radius:calc(var(--radius) * .5)}
.viz svg{width:100%;height:100%;display:block}
.kv-list{display:flex;flex-direction:var(--kv-dir);flex-wrap:wrap;gap:.55em}
.kv{flex:1 1 calc(100% / var(--sub-cols) - var(--space));min-width:0;display:flex;justify-content:space-between;gap:.6em;font-size:.84em;
  padding:.55em .7em;background:var(--surface-2);border:var(--border-w) var(--border-style) var(--line);border-radius:var(--radius)}
.kv span{color:var(--ink-soft)}
.kv b{color:var(--ink);font-variant-numeric:var(--num-variant, normal)}
.kv b.hi{color:var(--accent)}
.plain-list{display:flex;flex-direction:column;gap:.6em;font-size:.85em;color:var(--ink-soft)}
.plain-list li{display:flex;gap:.6em;align-items:flex-start}
.plain-list li::before{content:var(--icon);color:var(--primary);flex:0 0 auto}
.row{display:flex;align-items:center;justify-content:space-between;gap:1em;flex-wrap:wrap}
.transport-btns{display:flex;gap:.6em;justify-content:center;flex-wrap:wrap;margin:1em 0}
.icon-btn{width:3.1em;height:3.1em;display:grid;place-items:center;font-size:1em;border-radius:var(--radius);
  border:var(--border-w) var(--border-style) var(--line);background:var(--surface-2);color:var(--ink);cursor:pointer}
.icon-btn.main{background:var(--primary);color:var(--on-primary);border-color:var(--primary)}
.progress{height:.5em;border-radius:999px;background:var(--surface-2);overflow:hidden;border:var(--border-w) var(--border-style) var(--line)}
.progress i{display:block;height:100%;width:62%;background:linear-gradient(90deg,var(--primary),var(--accent))}
.mono{font-family:ui-monospace,Consolas,monospace;font-variant-numeric:tabular-nums}
.cand{display:flex;align-items:center;gap:.8em;font-size:.86em;padding:.55em 0;border-bottom:var(--divider) var(--line)}
.cand:last-child{border-bottom:0}
.cand b{width:3.4em;color:var(--primary);font-size:1.15em}
.cand .track{flex:1;height:.45em;background:var(--surface-2);border-radius:999px;overflow:hidden}
.cand .track i{display:block;height:100%;background:var(--accent)}
.cand small{width:3.2em;text-align:right;color:var(--ink-soft)}
.algo-grid{display:grid;grid-template-columns:repeat(var(--sub-cols),minmax(0,1fr));gap:.7em}
.algo{padding:.9em .6em;text-align:center;background:var(--surface-2);border:var(--border-w) var(--border-style) var(--line);border-radius:var(--radius)}
.algo .num{font-size:calc(var(--fs-base) * var(--ratio) * 1.25);font-weight:800;color:var(--accent);line-height:1.1}
.algo small{display:block;color:var(--ink-soft);font-size:.75em;margin-top:.35em}
.guide-body{font-size:.85em;color:var(--ink-soft);line-height:var(--lh)}
.guide-body h4{color:var(--ink);font-size:1.02em;margin:1em 0 .45em}
.guide-body li{margin-bottom:.45em}
.note{margin-top:1.2em;padding:.9em 1em;border-left:3px solid var(--accent);background:var(--surface-2);
  border-radius:calc(var(--radius) * .5);font-size:.8em;color:var(--ink-soft)}
.site-foot{margin-top:calc(var(--gap) * 1.6);padding-top:1.2em;border-top:var(--divider) var(--line);
  display:flex;justify-content:space-between;gap:1em;flex-wrap:wrap;font-size:.78em;color:var(--ink-soft)}
.site-foot .foot-links{display:flex;gap:1.2em}
.dna{margin-top:calc(var(--gap) * 2);padding:var(--pad);border:var(--border-w) var(--border-style) var(--line);
  border-radius:var(--radius);background:var(--surface)}
.dna h2{font-size:calc(var(--fs-base) * var(--ratio));margin-bottom:.3em}
.dna>p{font-size:.82em;color:var(--ink-soft);margin-bottom:1.1em}
.fp{display:grid;grid-template-columns:repeat(var(--fp-cols),minmax(0,1fr));gap:var(--fp-gap);margin-bottom:1.2em}
.fp i{display:block;aspect-ratio:1;border-radius:var(--fp-radius);transition:transform .2s}
.fp i:hover{transform:scale(1.55);z-index:2;position:relative}
details{border-top:var(--divider) var(--line);padding-top:1em}
summary{cursor:pointer;font-size:.85em;font-weight:700;color:var(--primary)}
table{width:100%;border-collapse:collapse;margin-top:1em;font-size:.76em}
th,td{text-align:left;padding:.42em .6em;border-bottom:var(--divider) var(--line);vertical-align:top}
th{color:var(--ink-soft);font-weight:700;letter-spacing:.08em;text-transform:uppercase}
td.idx{font-family:ui-monospace,Consolas,monospace;color:var(--tertiary);width:3em}
td.ch{font-family:ui-monospace,Consolas,monospace;font-weight:800;color:var(--primary);width:2em}
td.con{color:var(--ink);white-space:nowrap}
td.eff{color:var(--ink-soft)}
.dx-sig{position:fixed;z-index:0;pointer-events:none;font-size:clamp(60px,13vw,190px);font-weight:900;
  color:var(--primary);opacity:.035;transform:rotate(var(--sig-angle));white-space:nowrap;letter-spacing:-.06em}
@media(max-width:640px){.wrap{padding:18px 14px}.hero-card{flex-direction:column}.brand{font-size:1.1em}.algo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.kv{flex-basis:100%}}
@media(prefers-reduced-motion:reduce){*{animation:none !important;transition:none !important}}
`;
}

function fingerprintCSS(v) {
  const extra = [
    '', '.fp i:nth-child(4n){opacity:.55}', '.fp i:nth-child(3n){transform:scale(.8)}',
    '.fp i:nth-child(2n){opacity:.7}', '.fp{transform:rotate(-1.2deg)}', '.fp i{border-radius:50%}',
    '.fp i:nth-child(7n){transform:scaleY(.55)}', '.fp i{opacity:.85}', '.fp i:nth-child(5n){opacity:.4}',
    '.fp{transform:skewX(-4deg)}', '.fp i{opacity:.9;transform:scaleY(1.5)}', '.fp i:nth-child(8n){opacity:.5}',
    '.fp{transform:rotate(1deg) scaleY(.85)}', '.fp i{border-radius:0 50% 0 50%}', '.fp i:nth-child(11n){opacity:.3}',
    '.fp{letter-spacing:1px}',
  ][v];
  return `.fp i:hover{outline:2px solid var(--ink)}${extra}`;
}

function signatureCSS(v, key, hash) {
  const pos = [
    'top:6%;left:-2%', 'top:38%;left:8%', 'bottom:4%;right:-2%', 'top:12%;right:6%',
  ][v % 4];
  return `.dx-sig{${pos}}.dx-sig::after{content:"${key}·${hash.slice(-8)}"}`;
}

/* ------------------------------------------------------------ HTML 渲染 */
function fingerprintHTML(t) {
  return t.chars.map((c, i) => {
    const hue = Math.round((n(c) / 15) * 360);
    const col = `hsl(${hue}, 72%, ${t.isLight ? 45 : 60}%)`;
    const tr = t.trace[i];
    return `<i style="background:${col}" title="第 ${i} 位 · ${c} · ${esc(tr.consumer)} · ${esc(tr.effect)}"></i>`;
  }).join('');
}

function traceHTML(t) {
  return t.trace.map((r) => `<tr><td class="idx">${String(r.index).padStart(2, '0')}</td><td class="ch">${r.char}</td>`
    + `<td class="con">${esc(r.consumer)}</td><td class="eff">${esc(r.effect)}</td></tr>`).join('');
}

function renderHTML(t) {
  const Z = (name, inner, extra = '') => `<section class="zone" data-z="${name}" ${extra}>
  <div class="card">${inner}</div></section>`;

  const hero = Z('hero', `
    <div class="hero-card">
      <div class="hero-copy">
        <span class="eyebrow">01 / 输入源</span>
        <h2>把音乐交给算法</h2>
        <p>上传 WAV、MP3 或 FLAC 音频文件，或用麦克风录制，快速精准分析音乐的每分钟节拍数。</p>
        <div class="btn-row">
          <button class="btn primary">♫ &nbsp;选择音频文件</button>
          <button class="btn">◉ &nbsp;麦克风录制</button>
          <button class="btn ghost">▶ &nbsp;开始分析</button>
        </div>
      </div>
      <div class="hero-readout">
        <span class="eyebrow">当前 BPM</span>
        <div class="big-num">128</div>
        <div class="unit">beats / minute</div>
        <div class="beat-dots"><i></i><i></i><i></i></div>
        <div class="viz">${vizSVG(t.v.VIZ, t.chars)}</div>
      </div>
    </div>`);

  const transport = Z('transport', `
    <h3 class="zone-title">音频播放控制</h3>
    <p class="zone-sub">播放 / 暂停 / 停止，跟随节拍指示。</p>
    <div class="transport-btns">
      <button class="icon-btn main">▶</button><button class="icon-btn">⏸</button><button class="icon-btn">■</button>
    </div>
    <div class="progress"><i></i></div>
    <div class="row" style="margin-top:.8em;font-size:.78em;color:var(--ink-soft)">
      <span class="mono">02:14 / 03:48</span><span>正在播放 · track_07.flac</span>
    </div>`);

  const monitor = Z('monitor', `
    <div class="row">
      <div><h3 class="zone-title" style="text-align:left">实时 BPM 监测 <span class="chip" style="vertical-align:middle">β</span></h3>
      <p class="zone-sub" style="text-align:left;margin-bottom:0">直接监听系统或麦克风输入，按桌面版算法实时估算节奏。</p></div>
      <div class="btn-row" style="justify-content:flex-end"><button class="btn primary">开始监测</button><button class="btn">停止</button></div>
    </div>
    <div class="divider"></div>
    <div class="kv-list">
      <div class="kv"><span>实时 BPM</span><b class="hi mono">127.6</b></div>
      <div class="kv"><span>信号强度 RMS</span><b class="mono">0.184</b></div>
      <div class="kv"><span>采样窗口</span><b class="mono">4.0 s</b></div>
      <div class="kv"><span>状态</span><b class="hi">监测中</b></div>
    </div>
    <ul class="plain-list" style="margin-top:1em">
      <li>启用"立体声混音"可捕获系统音频；仅监听麦克风则使用默认输入</li>
      <li>低通滤波 → 峰值检测 → 间隔统计 → BPM 候选融合（三连音判定）</li>
    </ul>`);

  const result = Z('result', `
    <span class="eyebrow">02 / 结果</span>
    <div class="row"><h3 class="zone-title" style="margin-bottom:0">主 BPM</h3><span class="chip" style="color:var(--accent);border-color:var(--accent)">置信度 96%</span></div>
    <div style="text-align:center;padding:calc(var(--pad) * .5) 0">
      <div class="big-num" style="font-size:calc(var(--fs-base) * var(--ratio) * 3)">128</div>
      <div class="unit">BPM · 4/4 拍</div>
    </div>
    <div class="divider"></div>
    <div class="kv"><span>置信度达标</span><b class="hi">98% ✓</b></div>`);

  const candidates = Z('candidates', `
    <h3 class="zone-title">候选 BPM</h3><p class="zone-sub">按置信度排序，含谐波与三连音判定。</p>
    <div class="cand"><b>128</b><div class="track"><i style="width:96%"></i></div><small>96%</small></div>
    <div class="cand"><b>96</b><div class="track"><i style="width:71%"></i></div><small>71%</small></div>
    <div class="cand"><b>160</b><div class="track"><i style="width:43%"></i></div><small>43%</small></div>
    <div class="cand"><b>64</b><div class="track"><i style="width:28%"></i></div><small>28%</small></div>
    <div class="note">☞ 有时置信度第一与第二的均值才是实际 BPM（往往检测的是实际值的谐波）。</div>`);

  const audio = Z('audio', `
    <h3 class="zone-title">音频信息</h3><p class="zone-sub">当前已加载文件元数据。</p>
    <div class="kv-list" style="flex-direction:column">
      <div class="kv"><span>文件名</span><b class="mono">track_07.flac</b></div>
      <div class="kv"><span>格式 / 采样率</span><b class="mono">FLAC · 44.1 kHz</b></div>
      <div class="kv"><span>时长</span><b class="mono">03:48</b></div>
      <div class="kv"><span>声道 / 位深</span><b class="mono">Stereo · 16 bit</b></div>
    </div>`);

  const algos = Z('algos', `
    <span class="eyebrow">03 / 交叉验证</span>
    <h3 class="zone-title">多算法 BPM 分析</h3><p class="zone-sub">自相关算法 与 低通滤波（鼓点检测）互相印证。</p>
    <div class="algo-grid">
      <div class="algo"><div class="num">128</div><small>自相关 · 原值</small><small>置信 94%</small></div>
      <div class="algo"><div class="num">64</div><small>自相关 · 2 倍值</small><small>置信 88%</small></div>
      <div class="algo"><div class="num">128</div><small>低通 · 主算法</small><small>置信 96% ✓</small></div>
      <div class="algo"><div class="num">127</div><small>低通 · 自相关</small><small>置信 91%</small></div>
    </div>`);

  const guide = Z('guide', `
    <h3 class="zone-title">使用指南</h3><p class="zone-sub">四步完成一次测定，结果自动保存至本地历史。</p>
    <div class="guide-body">
      <ul class="plain-list">
        <li>选择音频文件上传，或点击"麦克风录制"按钮录制实时音频</li>
        <li>选择文件后自动开始 BPM 分析；录制时点击停止按钮结束录制</li>
        <li>分析完成后自动开始播放音频，可暂停 / 恢复 / 停止</li>
        <li>查看主 BPM、候选 BPM（含置信度）与多算法交叉验证结果</li>
      </ul>
      <h4>注意事项</h4>
      <ul class="plain-list">
        <li>支持 WAV、MP3、FLAC；建议使用高质量音频文件</li>
        <li>候选 BPM 旁的百分比为置信度，数值越高越可靠</li>
        <li>需实时检测当前播放音乐时，请在"实时 BPM 监测（β）"区开启</li>
        <li>分析结果自动保存到浏览器本地存储，可一键清除历史</li>
      </ul>
      <div class="note">☞ 有时候结合看似置信度不高的自相关算法结果（×2）与主算法第 2、3 候选，可得到实际 BPM 值。</div>
    </div>`);

  const foot = Z('foot', `
    <div class="site-foot" style="border:0;margin:0;padding:0">
      <span>© 2025 BPM 分析器${t.final ? '' : ' · 视觉重构预览稿（静态数据，不含分析逻辑）'}</span>
      <span class="foot-links"><a href="#">首页</a><a href="#">历史记录</a><a href="#">关于</a><a href="#">帮助</a></span>
    </div>`);

  const zones = { hero, transport, monitor, result, candidates, audio, algos, guide, foot };
  const stage = t.order.map((z) => zones[z]).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.final ? 'BPM 分析器 · 听歌识 BPM' : `DESIGN ${t.key} · 哈希驱动视觉重构预览`}</title>
<!--
  ${t.final ? `DESIGN A · DARK / 正式定稿 · 深色主题由 MODE 位明暗解释翻转而来` : `DESIGN ${t.key}`}
  seed : ${t.hash}
  规则 : 64/64 位全部参与设计决策（0..35 颜色种子 / 36..63 设计维度）
  ${t.final ? '深色适配：仅翻转第 54 位（MODE）的明暗解释，色调档与其余 63 位保持不变' : ''}
  本文件由 tools/generate-design.mjs 生成，可复现。
-->
<style>
${t.css}
</style>
</head>
<body>
<div class="dx-sig" aria-hidden="true"></div>
<div class="wrap">
  <header class="topbar">
    <div class="brand"><span class="brand-mark">♫</span><span>BPM<em> 分析器</em></span></div>
    <nav class="nav"><ul><li><a href="#">首页</a></li><li><a href="#">历史记录</a></li><li><a href="#">关于</a></li><li><a href="#">帮助</a></li></ul></nav>
    <span class="seed-badge">${t.final ? 'DESIGN A · DARK' : `DESIGN ${t.key} · ${t.hash.slice(0, 8)}…${t.hash.slice(-6)}`}</span>
  </header>

  <section class="headline">
    ${t.final ? '<span class="eyebrow">节拍分析工具 / BPM ANALYZER</span>' : '<span class="eyebrow">Hash-driven redesign · 64-bit DNA</span>'}
    <h1>听歌识 BPM</h1>
    <p>上传 WAV、MP3 或 FLAC 音频文件，或用麦克风录制，快速精准分析音乐的每分钟节拍数。</p>
    ${t.final ? '' : `<div class="head-meta">
      <span class="chip"><strong>64 / 64</strong> 位已映射</span>
      <span class="chip">${esc(t.codename)}</span>
      <span class="chip">${esc(t.layout.name)}</span>
      <span class="chip">${t.isLight ? '浅色' : '深色'} · 色调 ${t.tint}</span>
      <span class="chip">${esc(t.summary.呈现)}</span>
    </div>`}
  </section>

  <main class="stage">
${stage}
  </main>

  ${t.final ? `<details class="dna">
    <summary>设计溯源 · 64 位哈希 DNA（${t.hash.slice(0, 8)}…）</summary>
    <p>本页视觉沿用 DESIGN A 的 64 位哈希：前 36 位组成 6 组颜色种子，后 28 位各驱动一个设计维度，64 位全串还作为 PRNG 种子派生布局细节。深色适配仅翻转第 54 位（MODE）的明暗解释，色调档 ${t.tint} 与其余 63 位全部保留。</p>
    <div class="fp" aria-label="64 位哈希指纹">${fingerprintHTML(t)}</div>
    <details class="sub-trace">
      <summary>展开逐位设计溯源表（64 行 · 可核对每一位都被使用）</summary>
      <table>
        <thead><tr><th>位</th><th>字符</th><th>消费维度</th><th>作用</th></tr></thead>
        <tbody>${traceHTML(t)}</tbody>
      </table>
    </details>
  </details>` : `<section class="dna">
    <h2>哈希指纹 · 64 / 64 位</h2>
    <p>下面 64 个色格与本页每一位一一对应：色相由该位字符决定，悬停可查看该位被用来决定了什么。前 36 位组成 6 组颜色种子，后 28 位各驱动一个设计维度；此外 64 位全串还作为确定性 PRNG 种子，派生布局的列宽、区块跨度与排列顺序——因此没有任何一位被闲置。</p>
    <div class="fp" aria-label="64 位哈希指纹">${fingerprintHTML(t)}</div>
    <details>
      <summary>展开逐位设计溯源表（64 行 · 可核对每一位都被使用）</summary>
      <table>
        <thead><tr><th>位</th><th>字符</th><th>消费维度</th><th>作用</th></tr></thead>
        <tbody>${traceHTML(t)}</tbody>
      </table>
    </details>
  </section>`}

  <footer class="site-foot">
    <span>seed ${t.hash.slice(0, 16)}…${t.hash.slice(-16)}</span>
    <span>${t.final ? 'DESIGN A / DARK · 由 64 位哈希驱动生成 · 无外部依赖' : `DESIGN ${t.key} · 由哈希全位驱动生成 · 无外部依赖`}</span>
  </footer>
</div>
</body>
</html>
`;
}

/* ---------------------------------------------------------------- 画廊 */
function renderIndex(all) {
  const cards = all.map((t) => `
  <article class="pick">
    <div class="pick-head"><span class="letter">${t.key}</span><div>
      <h2>方案 ${t.key}</h2><code>${t.hash.slice(0, 12)}…${t.hash.slice(-8)}</code></div></div>
    <div class="swatches">${['bg', 'surface', 'primary', 'accent', 'tertiary', 'ink'].map((k) =>
      `<span style="background:${t.C[k].css}" title="${k}: ${t.C[k].css}"></span>`).join('')}</div>
    <dl>
      <div><dt>明暗 / 色调</dt><dd>${t.isLight ? '浅色' : '深色'} · 档 ${t.tint}</dd></div>
      <div><dt>布局架构</dt><dd>${esc(t.layout.name)} · ${t.layout.cols} 列</dd></div>
      <div><dt>呈现风格</dt><dd>${esc(t.summary.呈现)}</dd></div>
      <div><dt>字体 / 纹理</dt><dd>${esc(t.summary.字体)} · ${esc(t.summary.纹理)}</dd></div>
      <div><dt>按钮 / 波形</dt><dd>${esc(t.summary.按钮)} · #${t.v.VIZ}</dd></div>
      <div><dt>动效 / 微交互</dt><dd>${esc(t.summary.动效)} · ${esc(t.summary['微交互'] || MICROS[t.v.MICRO][0])}</dd></div>
    </dl>
    <div class="pick-actions">
      <a class="open" href="design-${t.key}.html" target="_blank">单独打开 ↗</a>
      <a class="trace" href="design-${t.key}.html" target="_blank">查看 64 位溯源 ↗</a>
    </div>
  </article>`).join('');

  const frames = all.map((t) => `
  <div class="frame"><div class="frame-bar"><span>DESIGN ${t.key}</span>
    <a href="design-${t.key}.html" target="_blank">全屏 ↗</a></div>
    <iframe src="design-${t.key}.html" title="DESIGN ${t.key}" loading="lazy"></iframe></div>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>哈希驱动 · 4 套前端视觉重构预览</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:#0b0d12;color:#e8ecf4;font:15px/1.6 "Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
a{color:inherit}.page{max-width:1500px;margin:0 auto;padding:40px 28px 80px}
.kicker{font-size:.72em;letter-spacing:.28em;text-transform:uppercase;color:#6ee7d0}
h1{font-size:clamp(28px,3.6vw,46px);margin:.3em 0 .35em;letter-spacing:-.03em}
.lead{color:#9aa6bb;max-width:76ch;margin-bottom:2em}
.hashline{font-family:ui-monospace,Consolas,monospace;font-size:.74em;color:#67748c;word-break:break-all;margin-top:.5em}
.grid4{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:44px}
.pick{background:#12161f;border:1px solid #242c3b;border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:14px}
.pick-head{display:flex;gap:14px;align-items:center}
.letter{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;background:#1c2b3a;color:#6ee7d0;font-size:1.4em;font-weight:800}
.pick h2{font-size:1.1em;margin:0}.pick code{font-size:.7em;color:#6b778d;word-break:break-all}
.swatches{display:flex;height:26px;border-radius:7px;overflow:hidden;border:1px solid #2a3446}
.swatches span{flex:1}
dl{margin:0;display:grid;gap:7px;font-size:.82em}
dl div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px dashed #242c3b;padding-bottom:6px}
dt{color:#7f8ca3}dd{margin:0;text-align:right;color:#d6deeb}
.pick-actions{display:flex;gap:10px;margin-top:auto;padding-top:6px}
.pick-actions a{flex:1;text-align:center;font-size:.8em;padding:.6em;border-radius:9px;text-decoration:none;border:1px solid #2c3a50;color:#b9c6da}
.pick-actions .open{background:#1d4b52;border-color:#2b7c86;color:#a6f2e6}
.pick-actions a:hover{filter:brightness(1.25)}
h2.sec{font-size:1.2em;margin:0 0 .4em}
.sec-note{color:#8b98ae;font-size:.85em;margin-bottom:18px}
.frames{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
@media(max-width:1000px){.frames{grid-template-columns:1fr}}
.frame{background:#12161f;border:1px solid #242c3b;border-radius:14px;overflow:hidden}
.frame-bar{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;font-size:.76em;color:#93a1b8;border-bottom:1px solid #242c3b;letter-spacing:.1em}
.frame-bar a{color:#6ee7d0;text-decoration:none}
iframe{width:100%;height:640px;border:0;display:block;background:#000}
.mix{margin-top:44px;padding:22px 24px;border:1px dashed #3a4a63;border-radius:16px;background:#10141d}
.mix h2{margin:0 0 .5em;font-size:1.15em}.mix p,.mix li{color:#9aa6bb;font-size:.88em}
.mix code{color:#6ee7d0;background:#182231;padding:.1em .4em;border-radius:4px}
.mix ul{padding-left:1.2em;margin:.7em 0 0}
.files{margin-top:26px;font-size:.8em;color:#75839b}
.files code{color:#b9c6da}
</style>
</head>
<body><div class="page">
  <span class="kicker">Hash-driven UI redesign / 64-bit DNA</span>
  <h1>4 套完全由哈希驱动的视觉重构</h1>
  <p class="lead">每套方案的 <strong>颜色、架构、风格、布局、结构、排列、字体、纹理、动效</strong> 全部由对应的 64 位哈希逐位决定：前 36 位组成 6 组颜色种子，后 28 位各驱动一个 0–15 满量程的设计维度。四个哈希的每一位都参与了决策，未使用任何人工配色或预设风格挑选。页面内容沿用现有 BPM 分析器（静态示例数据），仅作视觉预览。</p>
  <div class="hashline">A ${HASHES.A}<br>B ${HASHES.B}<br>C ${HASHES.C}<br>D ${HASHES.D}</div>

  <div class="grid4">${cards}</div>

  <h2 class="sec">并排预览</h2>
  <p class="sec-note">下方为 4 个实时 iframe，可直接在里面滚动；点"全屏 ↗"单独查看。每份页面底部都有 <em>64 格哈希指纹条</em> 与 <em>逐位溯源表</em>，可核对每一位被用在了哪里。</p>
  <div class="frames">${frames}</div>

  <div class="mix">
    <h2>关于"杂糅"</h2>
    <p>4 套方案共享同一套 <code>Design Token</code> 结构和同一份语义 HTML，差别只在 token 取值与布局配置。因此任意维度都可以跨方案自由组合，例如：</p>
    <ul>
      <li>「要 <code>A 的配色</code> + <code>C 的布局架构</code> + <code>D 的按钮与波形</code>」</li>
      <li>「整体用 <code>B</code>，但把 <code>PRESENT（呈现风格）</code> 换成 A 的、<code>TEXTURE（纹理）</code> 换成 C 的」</li>
      <li>「只保留某一套的 <code>颜色 6 组种子</code>，其余 28 个维度取另一套」</li>
    </ul>
    <p>告诉我组合方式即可，我会基于 <code>generate.mjs</code> 的映射表重新生成一份合并方案。每套方案的全部 token 与 64 位溯源也保存在 <code>tokens.json</code>，便于精确指定。</p>
  </div>

  <div class="files">目录：<code>design-previews/</code> · 生成器 <code>generate.mjs</code> · 令牌表 <code>tokens.json</code> · 该目录已加入 <code>.gitignore</code>。</div>
</div></body></html>
`;
}

/* ------------------------------------------------------------------ 主流程 */
export { build, HASHES, renderHTML };

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const FINAL = process.argv.includes('--final');
  const POSTER = process.argv.includes('--poster');

  if (FINAL) {
    // 定稿：把 DESIGN A / DARK 主题套回带完整功能的主页面，输出到 site/index.html
    const t = build('A', HASHES.A, { dark: true });
    const { buildThemedApp } = await import('./apply-theme.mjs');
    const info = buildThemedApp(t);
    console.log('DESIGN A · DARK 定稿已生成: site/index.html（保留完整功能）');
    console.log(`  64/64 位已消费 | 深色（MODE 位明暗解释翻转）| 色调档 ${t.tint} | ${t.layout.name} | ${PRESENTS[t.v.PRESENT][0]}`);
    console.log(`  背景 ${t.C.bg.css} / 主色 ${t.C.primary.css} / 墨色 ${t.C.ink.css}`);
    console.log(`  功能页 body 原样保留: ${info.bodyPreserved} | 元素 id ${info.ids} 个 | onclick ${info.onclicks} 处 | 内联脚本 ${info.scripts} 段`);
  } else if (POSTER) {
    // 静态视觉稿（仅留档比对，不作为部署入口）
    mkdirSync(PREVIEW_DIR, { recursive: true });
    const t = build('A', HASHES.A, { dark: true, final: true });
    writeFileSync(path.join(PREVIEW_DIR, 'design-A-dark.html'), renderHTML(t), 'utf8');
    console.log('深色 A 静态视觉稿已生成: design-previews/design-A-dark.html');
  } else {
    mkdirSync(PREVIEW_DIR, { recursive: true });
    const all = Object.entries(HASHES).map(([k, h]) => build(k, h));
    for (const t of all) {
      writeFileSync(path.join(PREVIEW_DIR, `design-${t.key}.html`), renderHTML(t), 'utf8');
      console.log(`DESIGN ${t.key}  ${t.hash.slice(0, 10)}…  64/64 位已消费  |  ${t.isLight ? '浅' : '深'}色 / ${t.layout.name} / ${t.summary.呈现}`);
    }
    writeFileSync(path.join(PREVIEW_DIR, 'index.html'), renderIndex(all), 'utf8');
    writeFileSync(path.join(PREVIEW_DIR, 'tokens.json'), JSON.stringify(all.map((t) => ({
      design: t.key, hash: t.hash, codename: t.codename, summary: { ...t.summary, 微交互: MICROS[t.v.MICRO][0] },
      values: t.v, layout: { name: t.layout.name, cols: t.layout.cols, columns: t.layout.columns, spans: t.layout.spans, order: t.order, prngSeed: t.layout.prngSeed },
      colors: Object.fromEntries(Object.entries(t.C).map(([k, c]) => [k, c.css])),
      trace64: t.trace,
    })), null, 2), 'utf8');
    console.log('\n已生成 index.html / design-A..D.html / tokens.json（全部位于 design-previews/）');
  }
}

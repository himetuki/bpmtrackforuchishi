/**
 * 把 DESIGN A / DARK 的视觉 token 套回 html_version/index.html。
 *
 * 关键约束：只替换 <head> 中「Tailwind 配色配置 + 自定义样式块」这一段，
 * 从 <body 开始的全部内容按字节原样保留 —— 因此上传、麦克风录制、播放控制、
 * 实时 BPM 监测、多算法分析、置信度、历史记录等所有 DOM / ID / 事件 / JS 完整可用。
 *
 * 由 tools/generate-design.mjs --final 调用，也可单独导入 buildThemedApp(t)。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(ROOT, 'html_version', 'index.html');
const OUT_DIR = path.join(ROOT, 'site');
const OUT = path.join(OUT_DIR, 'index.html');

const f1 = (x) => Number(x).toFixed(1);

export function buildThemedApp(t) {
  const src = readFileSync(SRC, 'utf8');

  /* ---- 由 A 的 64 位哈希派生出的深色 token ---- */
  const C = Object.fromEntries(Object.entries(t.C).map(([k, c]) => [k, c.css]));
  const T = t.T;
  const surf2L = Math.min(97, t.C.surface.l + 6);
  const surf2 = `hsl(${f1(t.C.surface.h)}, ${f1(t.C.surface.s)}%, ${f1(surf2L)}%)`;
  const inkSoft = `hsla(${f1(t.C.ink.h)}, ${f1(t.C.ink.s)}%, ${f1(t.C.ink.l)}%, .62)`;
  const line = `hsla(${f1(t.C.ink.h)}, ${f1(t.C.ink.s)}%, ${f1(t.C.ink.l)}%, .28)`;
  const onPrimary = t.C.primary.l > 58 ? 'hsl(0, 0%, 8%)' : '#ffffff';

  // Tailwind 需要可注入透明度占位符的现代 hsl 写法，才能支持 bg-secondary/10 之类
  const tw = (name, lOverride) => {
    const c = t.C[name];
    return `hsl(${f1(c.h)} ${f1(c.s)}% ${f1(lOverride ?? c.l)}% / <alpha-value>)`;
  };
  const cfg = {
    primary: tw('bg'),
    secondary: tw('primary'),
    accent: tw('accent'),
    dark: tw('bg', Math.max(2, t.C.bg.l - 3)),
    card: tw('surface'),
    light: tw('ink'),
    muted: tw('ink', Math.max(20, t.C.ink.l - 22)),
    gradient: tw('tertiary'),
  };

  /* ---- 主题样式层：只覆盖外观，不改变 DOM 结构 ---- */
  const css = `
/* ===== DESIGN A / DARK 主题层 =====
   由 A 的 64 位哈希逐位派生；MODE 位明暗解释翻转为深色，色调档 ${t.tint} 保留。
   本层只覆盖颜色 / 字体 / 纹理 / 圆角 / 边框 / 阴影 / 动效 / 排列，
   body 起始的 DOM 与全部脚本原样保留，功能不受影响。            */
:root{
  --a-bg:${C.bg}; --a-surface:${C.surface}; --a-surface-2:${surf2};
  --a-primary:${C.primary}; --a-accent:${C.accent}; --a-tertiary:${C.tertiary};
  --a-ink:${C.ink}; --a-ink-soft:${inkSoft}; --a-line:${line};
  --a-on-primary:${onPrimary}; --a-radius:${T.radius}px;
  --a-font:${T.font}; --a-shadow:${T.shadow}; --a-gap:${T.gap}px;
}
html{scroll-behavior:smooth}
body{
  background-color:var(--a-bg) !important;
  background-image:repeating-radial-gradient(ellipse at 50% 120%,rgba(160,180,170,.10) 0 1px,transparent 1px 18px) !important;
  background-size:36px 36px;
  color:var(--a-ink) !important;
  font-family:var(--a-font) !important;
  letter-spacing:.01em;
}
h1,h2,h3,h4{letter-spacing:-.01em}

/* 顶栏：A 的悬浮胶囊导航 */
header.bg-dark\\/70{
  background:var(--a-surface-2) !important;
  border:2px dotted var(--a-line) !important;
  border-radius:999px !important;
  backdrop-filter:blur(12px);
  box-shadow:var(--a-shadow);
  width:calc(100% - 40px) !important;
  max-width:1100px !important;
  margin:14px auto 0 !important;
}

/* 卡片 / 玻璃面板：A 的 2px 点线边框 + 两角圆角(0110) */
.bg-card,.glass{
  background:var(--a-surface) !important;
  border:2px dotted var(--a-line) !important;
  border-radius:0 var(--a-radius) var(--a-radius) 0 !important;
  box-shadow:var(--a-shadow) !important;
}
.glass{background:var(--a-surface-2) !important;backdrop-filter:blur(16px)}
.rounded-3xl,.rounded-2xl,.rounded-xl{border-radius:0 var(--a-radius) var(--a-radius) 0 !important}
.bg-primary{background:var(--a-bg) !important}

/* 细分隔线保留 1px，只换颜色与线型 */
.border-white\\/5,.border-white\\/10,.border-white\\/20,
.border-secondary\\/30,.border-accent\\/30,.border-red-500\\/30{
  border-color:var(--a-line) !important;border-style:dotted !important;
}

/* 文字 / 主色按钮 */
.text-secondary{color:var(--a-primary) !important}
.text-accent{color:var(--a-accent) !important}
.text-light,.text-white{color:var(--a-ink) !important}
.text-light\\/70,.text-muted,.text-muted\\/60,.text-muted\\/70,.text-muted\\/80{color:var(--a-ink-soft) !important}
.bg-secondary\\/10,.bg-secondary\\/20,.bg-secondary\\/30,
.bg-accent\\/10,.bg-accent\\/20,.bg-accent\\/30,
.bg-white\\/5,.bg-white\\/10{background:var(--a-surface-2) !important}
.bg-secondary,.bg-accent{background:var(--a-primary) !important;color:var(--a-on-primary) !important}
.bg-gradient-to-r.from-secondary{
  background-image:linear-gradient(100deg,var(--a-primary),var(--a-tertiary),var(--a-accent)) !important;
}

/* 按钮：A 的左色条造型 */
main button,main label[for="fileInput"]{
  font-family:inherit !important;font-weight:700 !important;
  border-left:4px solid var(--a-accent) !important;
  transition:transform .25s ease,box-shadow .25s ease;
}
main button:hover,main label[for="fileInput"]:hover{transform:rotate(-.4deg) translateY(-2px)}

/* 置信度 / 状态语义色映射到 A 的强调色与第三色 */
.bg-green-900{background:color-mix(in srgb,var(--a-tertiary) 22%,var(--a-surface-2)) !important}
.text-green-400,.text-green-200,.text-green-100{color:var(--a-tertiary) !important}
.text-yellow-400,.text-yellow-200,.text-yellow-100{color:var(--a-accent) !important}
.bg-yellow-500\\/10{background:color-mix(in srgb,var(--a-accent) 14%,var(--a-surface-2)) !important}
.border-yellow-500\\/20,.border-yellow-600{border-color:var(--a-line) !important}
.text-red-400{color:var(--a-tertiary) !important}
.bg-red-500\\/10,.bg-red-600{background:color-mix(in srgb,var(--a-tertiary) 18%,var(--a-surface-2)) !important}
.border-red-500\\/30{border-color:var(--a-line) !important}

/* ===== 原 <style type="text/tailwindcss"> 中被移除的自定义工具类，按 A 重新定义 ===== */
.text-shadow{text-shadow:0 2px 4px rgba(0,0,0,.35)}
.gradient-border{position:relative;border-radius:0 var(--a-radius) var(--a-radius) 0;z-index:0}
.gradient-border::before{
  content:"";position:absolute;top:-2px;left:-2px;right:-2px;bottom:-2px;
  background:linear-gradient(135deg,var(--a-primary),var(--a-tertiary),var(--a-accent));
  border-radius:0 var(--a-radius) var(--a-radius) 0;z-index:-1;opacity:.6;
}
.pulse-glow{animation:aPulse 2s ease-in-out infinite}
@keyframes aPulse{
  0%,100%{box-shadow:0 0 20px color-mix(in srgb,var(--a-primary) 30%,transparent),0 0 40px color-mix(in srgb,var(--a-tertiary) 20%,transparent)}
  50%{box-shadow:0 0 40px color-mix(in srgb,var(--a-primary) 50%,transparent),0 0 80px color-mix(in srgb,var(--a-tertiary) 30%,transparent)}
}
.beat-bar{
  background-color:var(--a-accent);height:100%;width:.25rem;margin-left:.125rem;margin-right:.125rem;
  border-radius:2px;animation:aBeat 1.2s ease-in-out infinite;
}
@keyframes aBeat{0%,100%{opacity:.3;transform:scaleY(.6)}50%{opacity:1;transform:scaleY(1.4)}}
.breath{animation:aBreath 3s ease-in-out infinite}
@keyframes aBreath{0%,100%{opacity:.6;transform:scale(.98)}50%{opacity:.9;transform:scale(1.02)}}
.float{animation:aFloat 4s ease-in-out infinite}
@keyframes aFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
.confidence-98{
  background-color:var(--a-tertiary);color:var(--a-bg);font-size:.65rem;padding:2px 8px;
  border-radius:9999px;margin-left:6px;letter-spacing:.5px;
}
.confidence-98::after{content:"98%达标";font-size:.65rem;opacity:.85;margin-left:4px}
.confidence-good,.confidence-mid,.confidence-low{
  color:var(--a-bg);border:1px solid var(--a-line);font-size:.65rem;
  padding:2px 8px;border-radius:9999px;
}
.confidence-good{background-color:var(--a-tertiary)}
.confidence-mid{background-color:var(--a-accent)}
.confidence-low{background-color:var(--a-tertiary);opacity:.75}
.confidence-score{display:inline-flex;align-items:center;justify-content:center}
.stat-card{transition:all .3s cubic-bezier(.4,0,.2,1)}
.stat-card:hover{
  transform:rotate(-.4deg) translateY(-2px);
  box-shadow:0 8px 30px color-mix(in srgb,var(--a-primary) 30%,transparent);
}

/* 图标字体不可用时的可见降级（纯 CSS，不改 DOM） */
.fa-music::before{content:"♫" !important}
.fa-upload::before{content:"↑" !important}
.fa-microphone::before{content:"◉" !important}
.fa-play::before,.fa-play-circle::before{content:"▶" !important}
.fa-pause::before{content:"⏸" !important}
.fa-stop::before{content:"■" !important}
.fa-line-chart::before{content:"∿" !important}
.fa-info-circle::before{content:"ⓘ" !important}
.fa-lightbulb-o::before{content:"☞" !important}
.fa-history::before{content:"↺" !important}
.fa-trash::before{content:"✕" !important}
.fa-github::before{content:"⌘" !important}
.fa-twitter::before{content:"✦" !important}
.fa-envelope::before{content:"✉" !important}

/* A 的「上浮」入场动效。保留原页面的单列堆叠结构：
   功能页的 DOM 与各区块内部栅格是按单列设计的，强行改成 2 列会挤压
   实时监测区的 xl:grid-cols-3 等内部布局，因此只在配色 / 字体 / 纹理 /
   圆角 / 边框 / 导航 / 按钮 / 动效上套用 A 的视觉，不动结构。 */
main.container > section{animation:aUp .7s both}
@keyframes aUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){*{animation:none !important;transition:none !important}}
`;

  const tailwindConfig = `      tailwind.config = {
        theme: {
          extend: {
            colors: {
              primary: "${cfg.primary}",
              secondary: "${cfg.secondary}",
              accent: "${cfg.accent}",
              dark: "${cfg.dark}",
              card: "${cfg.card}",
              light: "${cfg.light}",
              muted: "${cfg.muted}",
              gradient: "${cfg.gradient}",
            },
            borderRadius: { '3xl': '1.5rem' },
            boxShadow: {
              'glow': '0 0 40px ${C.primary.replace('hsl(', 'hsla(').replace(')', ', .3)')}',
              'glow-strong': '0 0 60px ${C.primary.replace('hsl(', 'hsla(').replace(')', ', .5)')}',
            }
          },
        },
      };`;

  const themedHead = `    <!-- Tailwind CSS v3 -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Font Awesome - 使用本地fallback -->
    <link
      href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css"
      rel="stylesheet"
      onerror="this.onerror=null; this.href='data:text/css,.fa:before{content:\\'\\'}'"
    />
    <!-- DESIGN A / DARK 配色：由 A 的 64 位哈希派生，MODE 位明暗翻转为深色 -->
    <script>
${tailwindConfig}
    </script>
    <style type="text/css">
${css}
    </style>`;

  const startMarker = '    <!-- Tailwind CSS v3 -->';
  const endMarker = '    </style>';
  const s = src.indexOf(startMarker);
  const e = src.indexOf(endMarker, s);
  if (s < 0 || e < 0) throw new Error('未在 html_version/index.html 中找到 head 样式区标记');
  const cut = e + endMarker.length;

  const bodyStart = src.indexOf('<body');
  if (bodyStart < cut) throw new Error('head 标记越过了 body，拒绝生成以免破坏功能');

  const out = src.slice(0, s) + themedHead + src.slice(cut);

  /* ---- 强校验：body 起始部分必须逐字节相同（尾部是原样拼接的） ---- */
  const tail = src.slice(bodyStart);
  const outBodyStart = out.length - tail.length;
  const bodyPreserved = out.slice(outBodyStart) === tail;
  if (!bodyPreserved) throw new Error('<body> 内容发生变化，已中止生成');

  const ids = (out.match(/id="[A-Za-z0-9_-]*"/g) || []).length;
  const onclicks = (out.match(/onclick=/g) || []).length;
  const scripts = (out.match(/<script/g) || []).length;
  if (ids < 30 || onclicks < 5 || scripts < 3) throw new Error('功能元素数量异常，已中止生成');

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, out, 'utf8');
  return { bodyPreserved, ids, onclicks, scripts, bytes: Buffer.byteLength(out, 'utf8') };
}

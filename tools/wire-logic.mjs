/**
 * 把原站的 BPM 分析逻辑接入 DESIGN A / DARK 视觉稿，生成正式版 site/index.html。
 *
 * 方向：以「视觉稿」为本体（保留 A 的全部 64 位视觉 token、布局、波形、指纹），
 * 把 html_version/index.html 里那段完整的分析脚本原样注入，并把视觉稿上的元素
 * 挂到脚本需要的 36 个 ID / onclick 上；再补一层 CSS 兼容脚本动态生成的类名。
 *
 * 不改动、也不复制原站的外观结构 —— 原站 DOM 只是逻辑来源。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const LOGIC_SRC = path.join(ROOT, 'html_version', 'index.html');
const OUT_DIR = path.join(ROOT, 'site');
const OUT = path.join(OUT_DIR, 'index.html');

/** 原站脚本依赖的全部 36 个 ID，生成后逐个校验 */
const REQUIRED_IDS = [
  'fileInput', 'mic-btn', 'current-bpm', 'play-btn', 'pause-btn', 'stop-btn',
  'playback-status', 'beat-indicator-1', 'beat-indicator-2', 'beat-indicator-3',
  'realtime-start-btn', 'realtime-stop-btn', 'realtime-bpm-display',
  'realtime-last-update', 'realtime-rms-value', 'realtime-window-info',
  'realtime-detail-text', 'realtime-status-text',
  'bpm-confidence-badge', 'bpm-confidence-98', 'bpm-display', 'bpm-suggestion',
  'candidates-display', 'audio-info', 'history-section', 'history-list',
  'autocorr-bpm', 'autocorr-confidence', 'autocorr-double-bpm',
  'autocorr-double-confidence', 'lowpass-main-bpm', 'lowpass-main-confidence',
  'lowpass-main-confidence-98', 'lowpass-autocorr-bpm',
  'lowpass-autocorr-confidence', 'lowpass-autocorr-confidence-98',
];

/** 脚本动态生成的 HTML 用的是 Tailwind 类名，视觉稿没有 Tailwind，这里补一层兼容 */
const COMPAT_CSS = `
/* ===== 功能逻辑接入层：脚本动态生成内容的类名适配 ===== */
.hidden{display:none !important}
.opacity-60{opacity:.6}
.opacity-70,.opacity-80{opacity:.82}
button:disabled{opacity:.4;cursor:not-allowed;filter:grayscale(.3)}
button:disabled:hover{transform:none}

/* 置信度徽章：setConfidenceBadge 会整体替换 className */
.confidence-score{display:inline-flex;align-items:center;justify-content:center;font-size:.72em;padding:.3em .8em;border-radius:999px}
.confidence-98{background:var(--tertiary);color:var(--bg)}
.confidence-good{background:color-mix(in srgb,var(--tertiary) 70%,var(--surface));color:var(--bg)}
.confidence-mid{background:var(--accent);color:var(--bg)}
.confidence-low{background:color-mix(in srgb,var(--tertiary) 45%,var(--surface));color:var(--bg)}
.rounded-full{border-radius:999px}
.rounded-lg{border-radius:var(--radius)}
.px-2,.px-3{padding-left:.7em;padding-right:.7em}
.py-1{padding-top:.25em;padding-bottom:.25em}
.p-3,.p-4{padding:.8em 1em}
.mt-2{margin-top:.5em}
.mt-4{margin-top:1em}
.mb-2{margin-bottom:.5em}
.mr-2{margin-right:.5em}
.text-xs{font-size:.75em}
.text-sm{font-size:.85em}
.font-bold{font-weight:700}
.font-medium{font-weight:600}
.text-center{text-align:center}
.items-center{align-items:center}
.items-start{align-items:flex-start}
.justify-between{justify-content:space-between}
.flex{display:flex;gap:.6em;flex-wrap:wrap}
.grid{display:grid;gap:.6em}
.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.bg-primary,.bg-opacity-50,.bg-blue-900{background:var(--surface-2)}
.text-secondary{color:var(--primary)}
.text-light{color:var(--ink)}
.text-blue-200,.text-blue-100{color:var(--accent)}
.border-blue-600{border:1px solid var(--line)}
.bg-green-900{background:color-mix(in srgb,var(--tertiary) 25%,var(--surface-2))}
.text-green-400,.text-red-400{color:var(--tertiary)}
.bg-yellow-900{background:var(--surface-2)}
.border{border:1px solid var(--line)}
.border-green-600,.border-yellow-600,.border-blue-600{border-color:var(--line)}
.text-blue-400,.text-yellow-400{color:var(--accent)}
.text-white{color:var(--ink)}

/* 原脚本会整体替换麦克风按钮的 className，这里按 ID 锁回 A 的按钮外观 */
#mic-btn{
  display:inline-flex;align-items:center;gap:.5em;cursor:pointer;font:inherit;font-size:.88em;
  font-weight:700;padding:.72em 1.25em;border:var(--border-w) var(--border-style) var(--line);
  border-left:4px solid var(--accent);border-radius:0 var(--radius) var(--radius) 0;
  background:var(--surface-2);color:var(--ink);
}
#mic-btn.bg-red-600{background:var(--tertiary);color:var(--bg);border-color:var(--tertiary)}
.bg-green-600,.bg-green-500{background:var(--surface-2)}
.bg-red-600,.bg-red-500{background:var(--tertiary)}

/* 动态容器 */
#candidates-display > div,#history-list > div,#bpm-suggestion > div,#audio-info{
  background:var(--surface-2);border:var(--border-w) var(--border-style) var(--line);
  border-radius:var(--radius);padding:.8em 1em;margin-bottom:.6em;
}
#audio-info{margin-bottom:0;line-height:var(--lh)}
#bpm-suggestion{margin-top:1em}
#history-list p{color:var(--ink-soft);font-size:.85em;text-align:center}
#lowpass-main-confidence-98,#lowpass-autocorr-confidence-98{
  display:inline-block;margin-top:.4em;padding:.2em .6em;border-radius:999px;
  background:var(--tertiary);color:var(--bg);font-size:.68em;
}
#bpm-confidence-98{color:var(--tertiary)}
.fa-microphone::before{content:"◉" !important}
.fa-stop::before{content:"■" !important}
.fa-lightbulb-o::before{content:"☞" !important}
.fa-music::before{content:"♫" !important}
.fa-play::before{content:"▶" !important}
.fa-pause::before{content:"⏸" !important}
.fa-upload::before{content:"↑" !important}
.fa-trash::before{content:"✕" !important}
.fa-history::before{content:"↺" !important}
`;

export function wireLogic(posterHtml) {
  let html = posterHtml;

  /** 精确替换，且必须且只能命中一次；视觉稿结构变化时立即报错，避免静默漏接 */
  const rep = (from, to, label) => {
    const count = html.split(from).length - 1;
    if (count !== 1) throw new Error(`[${label}] 期望命中 1 次，实际 ${count} 次`);
    html = html.replace(from, to);
  };

  /* ---- 导航 ---- */
  rep('<li><a href="#">历史记录</a></li>',
      '<li><a href="#" onclick="toggleHistorySection()">历史记录</a></li>', 'nav-history');

  /* ---- Hero：文件输入 / 麦克风 / 开始分析 / 当前 BPM / 节拍指示 ---- */
  rep(`          <button class="btn primary">♫ &nbsp;选择音频文件</button>
          <button class="btn">◉ &nbsp;麦克风录制</button>
          <button class="btn ghost">▶ &nbsp;开始分析</button>`,
      `          <label for="fileInput" class="btn primary">♫ &nbsp;选择音频文件</label>
          <input type="file" id="fileInput" accept=".wav,.mp3,.flac" class="hidden" />
          <button class="btn" id="mic-btn" onclick="startMicrophoneRecording()">◉ &nbsp;麦克风录制</button>
          <button class="btn ghost" onclick="analyze()">▶ &nbsp;开始分析</button>`, 'hero-actions');
  rep('<div class="big-num">128</div>',
      '<div class="big-num" id="current-bpm">--</div>', 'current-bpm');
  rep('<div class="beat-dots"><i></i><i></i><i></i></div>',
      '<div class="beat-dots"><i id="beat-indicator-1"></i><i id="beat-indicator-2"></i><i id="beat-indicator-3"></i></div>', 'beat-indicators');

  /* ---- 播放控制 ---- */
  rep('<button class="icon-btn main">▶</button><button class="icon-btn">⏸</button><button class="icon-btn">■</button>',
      '<button class="icon-btn main" id="play-btn" onclick="playAudio()" disabled>▶</button>' +
      '<button class="icon-btn" id="pause-btn" onclick="pauseAudio()" disabled>⏸</button>' +
      '<button class="icon-btn" id="stop-btn" onclick="stopAudio()" disabled>■</button>', 'transport-buttons');
  rep(`    <div class="row" style="margin-top:.8em;font-size:.78em;color:var(--ink-soft)">
      <span class="mono">02:14 / 03:48</span><span>正在播放 · track_07.flac</span>
    </div>`,
      `    <div class="row" style="margin-top:.8em;font-size:.78em;color:var(--ink-soft)">
      <span id="playback-status">未加载音频</span>
    </div>`, 'playback-status');

  /* ---- 实时 BPM 监测 ---- */
  rep('<button class="btn primary">开始监测</button><button class="btn">停止</button>',
      '<button class="btn primary" id="realtime-start-btn">开始监测</button>' +
      '<button class="btn" id="realtime-stop-btn" disabled>停止</button>', 'realtime-buttons');
  rep('<b class="hi mono">127.6</b>', '<b class="hi mono" id="realtime-bpm-display">--</b>', 'realtime-bpm');
  rep('<b class="mono">0.184</b>', '<b class="mono" id="realtime-rms-value">--</b>', 'realtime-rms');
  rep('<b class="mono">4.0 s</b>', '<b class="mono" id="realtime-window-info">--</b>', 'realtime-window');
  rep('<b class="hi">监测中</b>', '<b class="hi" id="realtime-status-text">未启动</b>', 'realtime-status');
  rep(`    </div>
    <ul class="plain-list" style="margin-top:1em">`,
      `    </div>
    <p class="zone-sub" style="text-align:left;margin:.8em 0 0;font-size:.76em"><span id="realtime-last-update">最近更新：--</span> · <span id="realtime-detail-text">点击“开始实时监测”以启动。</span></p>
    <ul class="plain-list" style="margin-top:1em">`, 'realtime-detail');

  /* ---- 主 BPM 结果 ---- */
  rep('<span class="chip" style="color:var(--accent);border-color:var(--accent)">置信度 96%</span>',
      '<span class="chip" id="bpm-confidence-badge" style="color:var(--accent);border-color:var(--accent)">置信度 --</span>', 'bpm-badge');
  rep('<div class="big-num" style="font-size:calc(var(--fs-base) * var(--ratio) * 3)">128</div>',
      '<div class="big-num" id="bpm-display" style="font-size:calc(var(--fs-base) * var(--ratio) * 3)">--</div>', 'bpm-display');
  rep('<div class="kv"><span>置信度达标</span><b class="hi">98% ✓</b></div>',
      '<div class="kv hidden" id="bpm-confidence-98"><span>置信度达标</span><b class="hi">98%达标</b></div>', 'bpm-98');

  /* ---- 音频信息：改成脚本写入的容器 ---- */
  rep(`    <div class="kv-list" style="flex-direction:column">
      <div class="kv"><span>文件名</span><b class="mono">track_07.flac</b></div>
      <div class="kv"><span>格式 / 采样率</span><b class="mono">FLAC · 44.1 kHz</b></div>
      <div class="kv"><span>时长</span><b class="mono">03:48</b></div>
      <div class="kv"><span>声道 / 位深</span><b class="mono">Stereo · 16 bit</b></div>
    </div>`,
      '    <div id="audio-info">请上传 WAV、MP3 或 FLAC 音频文件开始分析</div>', 'audio-info');

  /* ---- 候选 BPM + 智能建议容器 ---- */
  rep(`    <div class="cand"><b>128</b><div class="track"><i style="width:96%"></i></div><small>96%</small></div>
    <div class="cand"><b>96</b><div class="track"><i style="width:71%"></i></div><small>71%</small></div>
    <div class="cand"><b>160</b><div class="track"><i style="width:43%"></i></div><small>43%</small></div>
    <div class="cand"><b>64</b><div class="track"><i style="width:28%"></i></div><small>28%</small></div>`,
      `    <div id="candidates-display"><div class="zone-sub">请上传音频文件开始分析</div></div>
    <div id="bpm-suggestion" class="hidden"></div>`, 'candidates');

  /* ---- 多算法结果 ---- */
  rep(`      <div class="algo"><div class="num">128</div><small>自相关 · 原值</small><small>置信 94%</small></div>
      <div class="algo"><div class="num">64</div><small>自相关 · 2 倍值</small><small>置信 88%</small></div>
      <div class="algo"><div class="num">128</div><small>低通 · 主算法</small><small>置信 96% ✓</small></div>
      <div class="algo"><div class="num">127</div><small>低通 · 自相关</small><small>置信 91%</small></div>`,
      `      <div class="algo"><div class="num" id="autocorr-bpm">--</div><small>自相关 · 原值</small><small id="autocorr-confidence">--</small></div>
      <div class="algo"><div class="num" id="autocorr-double-bpm">--</div><small>自相关 · 2 倍值</small><small id="autocorr-double-confidence">--</small></div>
      <div class="algo"><div class="num" id="lowpass-main-bpm">--</div><small>低通 · 主算法</small><small id="lowpass-main-confidence">--</small><small id="lowpass-main-confidence-98" class="hidden">98%达标</small></div>
      <div class="algo"><div class="num" id="lowpass-autocorr-bpm">--</div><small>低通 · 自相关</small><small id="lowpass-autocorr-confidence">--</small><small id="lowpass-autocorr-confidence-98" class="hidden">98%达标</small></div>`, 'algos');

  /* ---- 历史记录区（默认隐藏，由导航切换） ---- */
  rep('  </main>',
      `<section class="zone hidden" id="history-section" style="order:99;grid-column:1/-1">
  <div class="card">
    <div class="row"><h3 class="zone-title">测定历史记录</h3><button class="btn" onclick="clearHistory()">✕ &nbsp;清除历史</button></div>
    <div id="history-list" style="margin-top:1em"></div>
  </div></section>
  </main>`, 'history-section');

  /* ---- 补兼容样式 ---- */
  rep('</style>', COMPAT_CSS + '\n</style>', 'compat-css');

  /* ---- 注入原站完整分析脚本（第 3 个 <script> 块，原样） ---- */
  const logic = readFileSync(LOGIC_SRC, 'utf8');
  const opens = [...logic.matchAll(/<script/g)].map((m) => m.index);
  const closes = [...logic.matchAll(/<\/script>/g)].map((m) => m.index);
  if (opens.length < 3 || closes.length < 3) throw new Error('未找到原站主分析脚本块');
  const scriptBlock = logic.slice(opens[2], closes[2] + '</script>'.length);
  if (!scriptBlock.includes('performLowPassBPMAnalysis') || !scriptBlock.includes('DOMContentLoaded')) {
    throw new Error('提取到的脚本块不含分析逻辑，已中止');
  }
  rep('</body>', scriptBlock + '\n</body>', 'inject-script');

  /* ---- 强校验 ---- */
  const missing = REQUIRED_IDS.filter((id) => !html.includes(`id="${id}"`));
  if (missing.length) throw new Error(`缺少脚本必需的元素 ID: ${missing.join(', ')}`);
  const wired = REQUIRED_IDS.length;
  const handlers = (html.match(/onclick=/g) || []).length;
  const funcs = ['analyze', 'startMicrophoneRecording', 'playAudio', 'pauseAudio',
    'stopAudio', 'clearHistory', 'toggleHistorySection', 'startRealTimeMonitoring'];
  const missingFuncs = funcs.filter((fn) => !html.includes(`function ${fn}`));
  if (missingFuncs.length) throw new Error(`缺少函数: ${missingFuncs.join(', ')}`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, html, 'utf8');
  return { ids: wired, handlers, scriptBytes: Buffer.byteLength(scriptBlock, 'utf8'),
           bytes: Buffer.byteLength(html, 'utf8') };
}

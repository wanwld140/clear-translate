import { getDocument, GlobalWorkerOptions } from "./vendor/pdfjs/pdf.mjs";
import { extractParagraphs } from "./pdf-text.js";
GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
  "vendor/pdfjs/pdf.worker.mjs",
);
const fileInput = document.querySelector("#file"),
  engine = document.querySelector("#engine"),
  status = document.querySelector("#status"),
  pages = document.querySelector("#pages"),
  pause = document.querySelector("#pause");
let loading = null,
  doc = null,
  documentVersion = 0,
  translationVersion = 0,
  observer = null,
  queue = [],
  working = false,
  paused = false,
  states = [];
const renderTasks = new Set();
const ready = chrome.storage.local.get("engine").then((saved) => {
  engine.value = ["google", "tencent", "microsoft"].includes(saved.engine)
    ? saved.engine
    : "microsoft";
});
function visible(s) {
  const r = s.card.getBoundingClientRect();
  return r.bottom > -500 && r.top < innerHeight + 1000;
}
function progress() {
  const done = states.filter((s) => s.translated).length;
  status.textContent = `共 ${states.length} 页 · 已译 ${done} 页${paused ? " · 已暂停" : " · 滚动继续"}`;
  pause.textContent = paused ? "继续翻译" : "暂停翻译";
}
function enqueue(s) {
  if (!queue.includes(s) && (!s.drawn || (!s.translated && !paused)))
    queue.push(s);
  run();
}
async function translatePage(s, version) {
  const token = translationVersion;
  if (paused || s.translated || version !== documentVersion) return;
  s.note.textContent = "正在自动识别并翻译…";
  s.note.className = "page-status";
  const output = [];
  try {
    for (let at = 0; at < s.paragraphs.length; ) {
      if (paused || token !== translationVersion || version !== documentVersion)
        return;
      const group = [];
      while (at < s.paragraphs.length && group.length < 6) {
        const index = at++,
          text = s.paragraphs[index];
        if (!clearTranslateLanguage.shouldTranslate(text)) {
          output[index] = text;
          continue;
        }
        group.push({ index, text });
      }
      if (group.length) {
        const reply = await chrome.runtime.sendMessage({
          type: "CLEAR_BATCH",
          engine: engine.value,
          texts: group.map((x) => x.text),
        });
        if (!reply?.ok)
          throw new Error(reply?.error || "没有收到译文，请稍后重试。");
        if (
          token !== translationVersion ||
          version !== documentVersion ||
          paused
        )
          return;
        group.forEach((x, i) => (output[x.index] = reply.texts[i]));
      }
    }
    s.output.replaceChildren(
      ...output.map((text) => {
        const p = document.createElement("p");
        p.className = "paragraph";
        p.lang = "zh-CN";
        p.textContent = text;
        return p;
      }),
    );
    s.translated = true;
    s.note.textContent = "";
    progress();
  } catch (e) {
    if (token === translationVersion && version === documentVersion) {
      s.note.textContent = e.message;
      s.note.className = "page-status error";
    }
  }
}
async function render(s, version) {
  if (!s.drawn) {
    const page = await doc.getPage(s.number);
    if (version !== documentVersion) return;
    const base = page.getViewport({ scale: 1 }),
      width = s.original.clientWidth || 550,
      scale = Math.min(1.6, width / base.width),
      viewport = page.getViewport({ scale }),
      ratio = Math.min(2, devicePixelRatio || 1);
    s.canvas.width = Math.ceil(viewport.width * ratio);
    s.canvas.height = Math.ceil(viewport.height * ratio);
    s.canvas.hidden = false;
    s.placeholder.hidden = true;
    const task = page.render({
      canvasContext: s.canvas.getContext("2d"),
      viewport,
      transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0],
    });
    renderTasks.add(task);
    try {
      await task.promise;
    } finally {
      renderTasks.delete(task);
    }
    if (version !== documentVersion) return;
    s.drawn = true;
    if (!s.paragraphs)
      s.paragraphs = extractParagraphs((await page.getTextContent()).items);
    if (!s.paragraphs.length) {
      s.note.textContent = "这页没有可提取文字，暂不支持扫描图片。";
      return;
    }
    // 释放远离视口的画布，保留文字和译文；返回该页时再绘制。
    for (const old of states)
      if (old !== s && old.drawn && !visible(old)) {
        old.canvas.width = 0;
        old.canvas.height = 0;
        old.canvas.hidden = true;
        old.placeholder.hidden = false;
        old.drawn = false;
      }
  }
  if (s.paragraphs?.length) await translatePage(s, version);
}
async function run() {
  if (working) return;
  working = true;
  try {
    while (queue.length) {
      const s = queue.shift(),
        version = documentVersion;
      if (!states.includes(s) || !visible(s)) continue;
      try {
        await render(s, version);
      } catch (e) {
        if (
          version === documentVersion &&
          e.name !== "RenderingCancelledException"
        ) {
          s.note.textContent = `无法读取这一页：${e.message}`;
          s.note.className = "page-status error";
        }
      }
    }
  } finally {
    working = false;
    if (queue.length) run();
  }
}
async function openFile(file) {
  if (!file) return;
  if (file.size > 100 * 1024 * 1024) {
    status.textContent = "文件超过100 MB，请分拆后打开。";
    return;
  }
  const version = ++documentVersion;
  translationVersion++;
  paused = false;
  observer?.disconnect();
  queue = [];
  for (const task of renderTasks) task.cancel();
  chrome.runtime.sendMessage({ type: "CLEAR_CANCEL" }).catch(() => {});
  const previous = loading;
  loading = null;
  doc = null;
  states = [];
  pages.replaceChildren();
  pause.hidden = true;
  status.textContent = "正在本机读取 PDF…";
  document.querySelector("#filename").textContent = file.name;
  try {
    await previous?.destroy();
    const data = new Uint8Array(await file.arrayBuffer());
    if (version !== documentVersion) return;
    const task = getDocument({
      data,
      isEvalSupported: false,
      cMapUrl: chrome.runtime.getURL("vendor/pdfjs/cmaps/"),
      cMapPacked: true,
      standardFontDataUrl: chrome.runtime.getURL(
        "vendor/pdfjs/standard_fonts/",
      ),
      wasmUrl: chrome.runtime.getURL("vendor/pdfjs/wasm/"),
    });
    loading = task;
    task.onPassword = () => {
      task.destroy();
      if (version === documentVersion)
        status.textContent = "这份 PDF 需要密码，请先解锁后再打开。";
    };
    const loaded = await task.promise;
    if (version !== documentVersion) {
      await task.destroy();
      return;
    }
    doc = loaded;
    for (let number = 1; number <= doc.numPages; number++) {
      const card = document.createElement("section");
      card.className = "page";
      card.innerHTML = `<div class="original"><h2>原文 · 第 ${number} 页</h2><div class="loading">正在准备原页…</div><canvas hidden aria-label="第${number}页原文"></canvas></div><div class="translation"><h2>中文对照</h2><div class="output"></div><p class="page-status">滚动至此页后翻译</p></div>`;
      pages.append(card);
      states.push({
        number,
        card,
        original: card.querySelector(".original"),
        placeholder: card.querySelector(".loading"),
        canvas: card.querySelector("canvas"),
        output: card.querySelector(".output"),
        note: card.querySelector(".page-status"),
        drawn: false,
        translated: false,
        paragraphs: null,
      });
    }
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            const s = states.find((s) => s.card === entry.target);
            if (s) enqueue(s);
          }
      },
      { rootMargin: "500px 0px 1000px 0px" },
    );
    for (const s of states) observer.observe(s.card);
    pause.hidden = false;
    progress();
  } catch (e) {
    if (version === documentVersion) {
      status.textContent = `无法打开 PDF：${e.message || "请检查文件是否完整。"}`;
      status.className = "error";
    }
  }
}
fileInput.addEventListener("change", async () => {
  await ready;
  status.className = "";
  await openFile(fileInput.files[0]);
  fileInput.value = "";
});
engine.addEventListener("change", () => {
  translationVersion++;
  chrome.runtime.sendMessage({ type: "CLEAR_CANCEL" }).catch(() => {});
  paused = false;
  for (const s of states) {
    s.translated = false;
    s.output.replaceChildren();
    s.note.textContent = "等待翻译";
    if (visible(s)) enqueue(s);
  }
  if (states.length) progress();
});
pause.addEventListener("click", () => {
  paused = !paused;
  translationVersion++;
  if (paused)
    chrome.runtime.sendMessage({ type: "CLEAR_CANCEL" }).catch(() => {});
  else for (const s of states) if (visible(s)) enqueue(s);
  progress();
});
window.addEventListener("pagehide", () => {
  documentVersion++;
  translationVersion++;
  observer?.disconnect();
  for (const t of renderTasks) t.cancel();
  loading?.destroy();
  chrome.runtime.sendMessage({ type: "CLEAR_CANCEL" }).catch(() => {});
});

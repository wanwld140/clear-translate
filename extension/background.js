import { normalizeText, translateBatchOnline } from "./core.js";

const cache = new Map();
const waiting = [],
  cooldown = new Map(),
  controllers = new Map();
let jobs = 0;
function schedule(job, priority = false) {
  return new Promise((resolve, reject) => {
    const task = { job, resolve, reject };
    if (priority) waiting.unshift(task);
    else waiting.push(task);
    drain();
  });
}
function drain() {
  while (jobs < 2 && waiting.length) {
    const task = waiting.shift();
    jobs++;
    Promise.resolve()
      .then(task.job)
      .then(task.resolve, task.reject)
      .finally(async () => {
        await new Promise((r) => setTimeout(r, 250));
        jobs--;
        drain();
      });
  }
}
const errorText = (error) => error?.message || "操作失败，请重试。";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() =>
    chrome.contextMenus.create({
      id: "clear-selection",
      title: "用清译翻译选中文字",
      contexts: ["selection"],
    }),
  );
});

async function inject(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["dates.js", "languages.js", "content.js", "video.js"],
  });
}

async function action(tabId, command, text) {
  if (!Number.isInteger(tabId)) throw new Error("没有找到可以翻译的网页。");
  const { engine = "microsoft" } = await chrome.storage.local.get("engine");
  const message = { type: "CLEAR_ACTION", command, engine, text };
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    if (
      !/Receiving end does not exist|Could not establish connection/.test(
        errorText(e),
      )
    )
      throw e;
    await inject(tabId);
    return chrome.tabs.sendMessage(tabId, message);
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === "CLEAR_OPEN_PDF") {
    chrome.tabs.create({ url: chrome.runtime.getURL("pdf.html") }).then(
      () => reply({ ok: true }),
      () => reply({ ok: false, error: "无法打开PDF阅读器。" }),
    );
    return true;
  }
  const pdfViewer =
    sender.url === chrome.runtime.getURL("pdf.html") &&
    typeof sender.documentId === "string";
  const scopeId = sender.tab?.id ?? (pdfViewer ? sender.documentId : null);
  const scope =
    scopeId === null
      ? null
      : `${scopeId}:${message?.channel === "video" ? "video" : "page"}`;
  if (message?.type === "CLEAR_CANCEL" && scope !== null) {
    for (const controller of controllers.get(scope) || []) controller.abort();
    reply({ ok: true });
    return;
  }
  if (message?.type === "CLEAR_TRANSLATE" || message?.type === "CLEAR_BATCH") {
    const texts =
      message.type === "CLEAR_BATCH" ? message.texts : [message.text];
    if (
      scope === null ||
      !Array.isArray(texts) ||
      !texts.length ||
      texts.length > 6 ||
      texts.some((t) => typeof t !== "string" || !t.trim() || t.length > 30000)
    ) {
      reply({ ok: false, error: "待翻译内容为空或过长，请选择较短的段落。" });
      return;
    }
    const cleanTexts = texts.map(normalizeText);
    const provider = message.engine === "online" ? "google" : message.engine;
    if (!["google", "microsoft", "tencent"].includes(provider)) {
      reply({ ok: false, error: "未知翻译方式。" });
      return;
    }
    const keys = cleanTexts.map((t) => provider + ":" + t);
    const control = new AbortController();
    if (!controllers.has(scope)) controllers.set(scope, new Set());
    const controls = controllers.get(scope);
    controls.add(control);
    const job = async () => {
      if (control.signal.aborted) throw new Error("翻译已取消。");
      if (keys.every((k) => cache.has(k))) return keys.map((k) => cache.get(k));
      if (Date.now() < (cooldown.get(provider) || 0))
        throw new Error("免费服务暂时限流，请等待半分钟后重试。");
      try {
        const output = keys.map((k) => cache.get(k));
        const missing = cleanTexts
          .map((text, i) => ({ text, i }))
          .filter(({ i }) => output[i] === undefined);
        const translated = await translateBatchOnline(
          missing.map((t) => t.text),
          { provider, signal: control.signal },
        );
        translated.forEach((value, i) => {
          const at = missing[i].i;
          cache.set(keys[at], value);
          output[at] = value;
        });
        while (cache.size > 250) cache.delete(cache.keys().next().value);
        return output;
      } catch (e) {
        if (e.permanent) cooldown.set(provider, Date.now() + 30000);
        throw e;
      }
    };
    const pending = schedule(job, message.priority === true).finally(() => {
      controls.delete(control);
      if (!controls.size) controllers.delete(scope);
    });
    pending.then(
      (texts) =>
        reply(
          message.type === "CLEAR_BATCH"
            ? { ok: true, texts }
            : { ok: true, text: texts[0] },
        ),
      (e) => reply({ ok: false, error: errorText(e) }),
    );
    return true;
  }
  if (message?.type === "CLEAR_POPUP" && !sender.tab) {
    if (!["page", "selection", "restore"].includes(message.command)) return;
    action(message.tabId, message.command).then(reply, (e) =>
      reply({
        ok: false,
        error:
          /Cannot access|chrome:\/\/|extensions gallery|Missing host permission/i.test(
            errorText(e),
          )
            ? "这个页面受浏览器保护。请在普通 http/https 网页使用清译。"
            : errorText(e),
      }),
    );
    return true;
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "clear-selection" || !tab?.id) return;
  try {
    await action(tab.id, "selection", info.selectionText);
  } catch {
    await chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
  }
});
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "translate-page") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await action(tab?.id, "page");
  } catch {
    if (tab?.id) await chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
  }
});

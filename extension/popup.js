const engine = document.getElementById("engine");
const status = document.getElementById("status");
const note = document.getElementById("engine-note");
const showBall = document.getElementById("show-ball");
const autoEnglish = document.getElementById("auto-english");
const preserveNavigation = document.getElementById("preserve-navigation");
const selectionAuto = document.getElementById("selection-auto");
const videoSubtitles = document.getElementById("video-subtitles");
function updateNote() {
  const names = { microsoft: "微软", google: "Google", tencent: "腾讯" };
  note.textContent =
    engine.value === "local"
      ? "本地模式仅英文；首次可能需下载语言包。"
      : `自动识别原文 → 简体中文。文字将发送至${names[engine.value]}翻译服务。`;
}
const ready = chrome.storage.local
  .get([
    "engine",
    "ballVisible",
    "autoEnglish",
    "preserveNavigation",
    "selectionAuto",
    "videoSubtitles",
  ])
  .then((saved) => {
    engine.value = ["local", "google", "tencent", "microsoft"].includes(
      saved.engine,
    )
      ? saved.engine
      : "microsoft";
    showBall.checked = saved.ballVisible !== false;
    autoEnglish.checked = saved.autoEnglish === true;
    preserveNavigation.checked = saved.preserveNavigation !== false;
    selectionAuto.checked = saved.selectionAuto !== false;
    videoSubtitles.checked = saved.videoSubtitles !== false;
    updateNote();
  });
showBall.addEventListener("change", async () => {
  await chrome.storage.local.set({ ballVisible: showBall.checked });
});
autoEnglish.addEventListener("change", async () => {
  await chrome.storage.local.set({ autoEnglish: autoEnglish.checked });
});
preserveNavigation.addEventListener("change", async () => {
  await chrome.storage.local.set({
    preserveNavigation: preserveNavigation.checked,
  });
});
selectionAuto.addEventListener("change", async () => {
  await chrome.storage.local.set({ selectionAuto: selectionAuto.checked });
});
videoSubtitles.addEventListener("change", () =>
  chrome.storage.local.set({ videoSubtitles: videoSubtitles.checked }),
);
document
  .querySelector("#pdf")
  .addEventListener("click", () =>
    chrome.tabs.create({ url: chrome.runtime.getURL("pdf.html") }),
  );
engine.addEventListener("change", async () => {
  updateNote();
  await chrome.storage.local.set({ engine: engine.value });
});
for (const command of ["page", "selection", "restore"]) {
  document.getElementById(command).addEventListener("click", async () => {
    await ready;
    const buttons = [...document.querySelectorAll("button")];
    buttons.forEach((b) => (b.disabled = true));
    status.className = "";
    status.textContent = "正在连接当前网页…";
    try {
      await chrome.storage.local.set({ engine: engine.value });
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id || (tab.url && !/^https?:\/\//i.test(tab.url)))
        throw new Error(
          "请打开普通网页后使用。浏览器设置页、扩展商店和 PDF 暂不支持。",
        );
      const result = await chrome.runtime.sendMessage({
        type: "CLEAR_POPUP",
        tabId: tab.id,
        command,
      });
      if (!result?.ok)
        throw new Error(result?.error || "没有连接到网页，请刷新网页重试。");
      status.textContent = result.message || "已开始，请在网页中查看。";
    } catch (e) {
      status.className = "error";
      status.textContent = e.message;
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  });
}

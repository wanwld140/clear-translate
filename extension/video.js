(() => {
  if (
    globalThis.__clearTranslateVideo ||
    !/(^|\.)(youtube\.com|youtu\.be|x\.com|twitter\.com)$/i.test(
      location.hostname,
    )
  )
    return;
  globalThis.__clearTranslateVideo = true;
  const OWN = "data-clear-translate",
    controllers = new Map(),
    cache = new Map(),
    failed = new Map();
  let enabled = true,
    engine = "microsoft",
    version = 0,
    discoverTimer;
  const normal = (text) => text.replace(/\s+/gu, " ").trim();
  function current(controller) {
    const { video, player } = controller;
    for (const track of video.textTracks) {
      if (
        track.mode !== "showing" ||
        !["subtitles", "captions"].includes(track.kind)
      )
        continue;
      const text = normal(
        [...(track.activeCues || [])]
          .map((cue) => cue.getCueAsHTML().textContent)
          .join(" "),
      );
      if (text) return { text, lang: track.language, track };
    }
    if (location.hostname.endsWith("youtube.com")) {
      const pieces = [
        ...player.querySelectorAll(".ytp-caption-segment"),
      ].filter(
        (el) =>
          el.getClientRects().length &&
          getComputedStyle(el).visibility !== "hidden",
      );
      const text = normal(pieces.map((el) => el.textContent).join(" "));
      if (text)
        return {
          text,
          lang:
            pieces[0]?.closest("[lang]")?.lang || document.documentElement.lang,
        };
    }
    return null;
  }
  function key(text) {
    return engine + ":" + text;
  }
  function place(c) {
    const r = c.video.getBoundingClientRect();
    if (
      !enabled ||
      !c.video.isConnected ||
      document.hidden ||
      c.video.seeking ||
      r.width < 80 ||
      r.height < 60 ||
      r.bottom <= 0 ||
      r.top >= innerHeight ||
      c.video.ended
    ) {
      c.host.hidden = true;
      return false;
    }
    const fullscreen = document.fullscreenElement;
    const parent =
      fullscreen && fullscreen.contains(c.video) ? fullscreen : document.body;
    if (c.host.parentElement !== parent) parent.append(c.host);
    const nativeCaption = c.player.querySelector(".caption-window");
    const captionRect = nativeCaption?.getBoundingClientRect();
    const bottom = captionRect?.height
      ? captionRect.top - 6
      : r.bottom - Math.min(r.height * 0.45, Math.max(116, r.height * 0.25));
    c.host.style.setProperty(
      "left",
      `${r.left + Math.max(10, r.width * 0.06)}px`,
      "important",
    );
    c.host.style.setProperty(
      "top",
      `${Math.max(r.top + Math.min(r.height - 10, 60), Math.min(r.bottom - 10, innerHeight - 20, bottom))}px`,
      "important",
    );
    c.host.style.setProperty(
      "width",
      `${r.width - Math.max(20, r.width * 0.12)}px`,
      "important",
    );
    return true;
  }
  function display(c) {
    if (!place(c)) return;
    const source = current(c);
    if (
      !source ||
      !clearTranslateLanguage.shouldTranslate(source.text, source.lang)
    ) {
      c.host.hidden = true;
      return;
    }
    const text = cache.get(key(source.text)),
      error = failed.get(key(source.text));
    c.host.hidden = !text && !error;
    c.output.textContent = text || error || "";
    c.output.classList.toggle("error", !text && !!error);
  }
  function textsToRequest(c) {
    const source = current(c);
    if (
      !source ||
      !clearTranslateLanguage.shouldTranslate(source.text, source.lang)
    )
      return [];
    const values = [source.text];
    // 可读取完整轨道时预取接下来15秒，DOM字幕只取当前句，不抓取音视频。
    if (source.track?.cues)
      for (const cue of source.track.cues) {
        if (values.length >= 6) break;
        if (
          cue.endTime < c.video.currentTime ||
          cue.startTime > c.video.currentTime + 15
        )
          continue;
        const text = normal(cue.getCueAsHTML().textContent);
        if (
          text &&
          !values.includes(text) &&
          clearTranslateLanguage.shouldTranslate(text, source.lang)
        )
          values.push(text);
      }
    return values.filter((t) => !cache.has(key(t)) && !failed.has(key(t)));
  }
  async function pump(c) {
    if (c.busy || !enabled || engine === "local" || !place(c)) return;
    const texts = textsToRequest(c);
    if (!texts.length) {
      display(c);
      return;
    }
    const ticket = version,
      provider = engine;
    c.busy = true;
    try {
      const reply = await chrome.runtime.sendMessage({
        type: "CLEAR_BATCH",
        channel: "video",
        engine: provider,
        texts,
      });
      if (!reply?.ok) throw new Error(reply?.error || "字幕翻译暂不可用");
      if (ticket !== version) return;
      texts.forEach((t, i) => cache.set(provider + ":" + t, reply.texts[i]));
      while (cache.size > 300) cache.delete(cache.keys().next().value);
    } catch (e) {
      if (ticket === version)
        for (const text of texts) failed.set(provider + ":" + text, e.message);
      while (failed.size > 300) failed.delete(failed.keys().next().value);
    } finally {
      c.busy = false;
      if (c.video.isConnected) {
        display(c);
        if (enabled && textsToRequest(c).length) pump(c);
      }
    }
  }
  function update(c) {
    display(c);
    clearTimeout(c.timer);
    if (enabled && engine !== "local") c.timer = setTimeout(() => pump(c), 100);
  }
  function attach(video) {
    if (controllers.has(video)) return;
    const player =
      video.closest(
        '.html5-video-player,[data-testid="videoComponent"],[data-testid="videoPlayer"]',
      ) || video.parentElement;
    if (!player) return;
    const host = document.createElement("span");
    host.setAttribute(OWN, "");
    host.setAttribute("translate", "no");
    host.hidden = true;
    host.style.cssText =
      "all:initial!important;position:fixed!important;z-index:2147483646!important;pointer-events:none!important;transform:translateY(-100%)!important;text-align:center!important;";
    const root = host.attachShadow({ mode: "open" }),
      sheet = document.createElement("style");
    sheet.textContent =
      ':host([hidden]){display:none!important}.subtitle-output{display:inline-block;max-width:100%;padding:4px 10px;border-radius:5px;background:#000c;color:white;font:500 clamp(14px,1.6vw,23px)/1.5 "Microsoft YaHei",sans-serif;text-shadow:0 1px 2px #000;white-space:pre-wrap;overflow-wrap:anywhere}.subtitle-output.error{font-size:12px;color:#ffd4c7}';
    const output = document.createElement("span");
    output.className = "subtitle-output";
    output.lang = "zh-CN";
    root.append(sheet, output);
    document.body.append(host);
    const c = {
      video,
      player,
      host,
      output,
      busy: false,
      timer: null,
      tracks: new Set(),
      listeners: [],
    };
    controllers.set(video, c);
    const listen = (target, type, fn) => {
      target.addEventListener(type, fn);
      c.listeners.push(() => target.removeEventListener(type, fn));
    };
    const registerTracks = () => {
      for (const track of video.textTracks)
        if (!c.tracks.has(track)) {
          c.tracks.add(track);
          listen(track, "cuechange", () => update(c));
        }
      update(c);
    };
    for (const event of [
      "timeupdate",
      "play",
      "pause",
      "seeked",
      "loadedmetadata",
      "emptied",
      "ended",
    ])
      listen(video, event, () => update(c));
    listen(video, "seeking", () => {
      host.hidden = true;
    });
    listen(video.textTracks, "addtrack", registerTracks);
    listen(video.textTracks, "change", registerTracks);
    c.observer = new MutationObserver((records) => {
      if (
        records.some(
          (r) =>
            !r.target.parentElement?.closest(`[${OWN}]`) &&
            !(r.target.nodeType === 1 && r.target.closest(`[${OWN}]`)),
        )
      )
        update(c);
    });
    c.observer.observe(player, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    registerTracks();
  }
  function discover() {
    clearTimeout(discoverTimer);
    discoverTimer = null;
    for (const [video, c] of controllers)
      if (!video.isConnected) {
        clearTimeout(c.timer);
        c.observer.disconnect();
        c.listeners.forEach((remove) => remove());
        c.host.remove();
        controllers.delete(video);
      }
    if (enabled) document.querySelectorAll("video").forEach(attach);
  }
  const observer = new MutationObserver((records) => {
    if (
      records.some((r) =>
        [...r.addedNodes, ...r.removedNodes].some(
          (n) =>
            n.nodeType === 1 &&
            !n.hasAttribute(OWN) &&
            (n.matches("video") || n.querySelector("video")),
        ),
      ) &&
      !discoverTimer
    )
      discoverTimer = setTimeout(discover, 150);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const refresh = () => {
    for (const c of controllers.values()) update(c);
  };
  document.addEventListener("scroll", refresh, true);
  window.addEventListener("resize", refresh);
  document.addEventListener("fullscreenchange", refresh);
  document.addEventListener("visibilitychange", refresh);
  chrome.storage.local.get(["videoSubtitles", "engine"]).then((saved) => {
    enabled = saved.videoSubtitles !== false;
    engine = saved.engine || "microsoft";
    discover();
    refresh();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.videoSubtitles)
      enabled = changes.videoSubtitles.newValue !== false;
    if (changes.engine) engine = changes.engine.newValue || "microsoft";
    if (changes.videoSubtitles || changes.engine) {
      version++;
      chrome.runtime
        .sendMessage({ type: "CLEAR_CANCEL", channel: "video" })
        .catch(() => {});
      failed.clear();
      discover();
      refresh();
    }
  });
  window.addEventListener("pagehide", () => {
    chrome.runtime
      .sendMessage({ type: "CLEAR_CANCEL", channel: "video" })
      .catch(() => {});
    observer.disconnect();
    clearTimeout(discoverTimer);
    for (const c of controllers.values()) {
      clearTimeout(c.timer);
      c.observer.disconnect();
      c.listeners.forEach((remove) => remove());
      c.host.remove();
    }
    controllers.clear();
  });
})();

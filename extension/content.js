(() => {
  if (globalThis.__clearTranslateV1) return;
  globalThis.__clearTranslateV1 = true;

  const OWN = "data-clear-translate";
  const SKIP = `script,style,noscript,pre,textarea,input,select,option,video,audio,track,.html5-video-player,svg,canvas,math,iframe,[hidden],[inert],[contenteditable]:not([contenteditable="false"]),[translate="no"],.notranslate,[aria-hidden="true"],[${OWN}]`;
  const BLOCK =
    "p,li,h1,h2,h3,h4,h5,h6,blockquote,figcaption,td,th,dd,dt,div,section,article,main";
  const LAYER =
    'dialog,[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[role="tooltip"],[aria-modal="true"],[popover],[data-component="AnchoredOverlay"],[data-component="Overlay"],.dropdown-menu,.Overlay,.SelectMenu-modal';
  const CONTROL =
    'a[href],button,label,summary,[role="button"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="option"],[role="tooltip"]';
  const PROSE = "p,h1,h2,h3,h4,h5,h6,blockquote,figcaption,td,th,dd,dt";
  const isGithub = /(^|\.)github\.com$/i.test(location.hostname);
  const IDENTITY =
    '[data-login],[data-hovercard-type="user"],[data-hovercard-type="organization"],[data-hovercard-type="bot"],[rel="author"],[itemprop="name"],[itemprop="additionalName"],.author,.p-name,.p-nickname' +
    (isGithub
      ? ',.react-directory-filename-cell,.react-directory-truncate,[data-testid="path-name-segment"],button.overview-ref-selector,.branch-name,a[href^="/topics/"]'
      : "");
  const githubLogin = document.querySelector(
    'meta[name="user-login"]',
  )?.content;
  const uiTitles = new Map();
  const githubLabels = new Map(
    Object.entries({
      Profile: "个人资料",
      "Public profile": "公开资料",
      Repositories: "仓库",
      Stars: "收藏",
      Gists: "代码片段",
      Organizations: "组织",
      Enterprises: "企业",
      Sponsors: "赞助",
      Settings: "设置",
      "Copilot settings": "Copilot 设置",
      "Edit profile": "编辑个人资料",
      "Account settings": "账号设置",
      "Feature preview": "功能预览",
      Appearance: "外观",
      Accessibility: "辅助功能",
      "Try Enterprise": "试用企业版",
      "Sign out": "退出登录",
      "Set status": "设置状态",
      "Account switcher": "切换账号",
      Name: "姓名",
      "Public email": "公开邮箱",
      "Profile picture": "头像",
      Edit: "编辑",
      Bio: "个人简介",
      Pronouns: "人称代词",
      URL: "网址",
      "Social accounts": "社交账号",
      Code: "代码",
      Clone: "克隆",
      "Clone using the web URL.": "使用网页地址克隆。",
      "Open in GitHub Copilot app": "在 GitHub Copilot 应用中打开",
      "Open with GitHub Desktop": "用 GitHub Desktop 打开",
      "Download ZIP": "下载 ZIP",
      "MIT license": "MIT 许可证",
    }),
  );
  function uiTarget(node) {
    const parent = node.parentElement,
      control = parent?.closest(CONTROL);
    if (!control || control.closest(PROSE)) return null;
    let label = parent;
    while (
      label !== control &&
      label.parentElement &&
      label.parentElement !== control &&
      ["inline", "contents"].includes(
        getComputedStyle(label.parentElement).display,
      )
    )
      label = label.parentElement;
    return label;
  }
  function compact(el) {
    return !!el.closest(CONTROL) && !el.matches(PROSE);
  }
  const commonLabels = new Map(
    Object.entries({
      Cancel: "取消",
      Close: "关闭",
      Save: "保存",
      "Save changes": "保存更改",
      Edit: "编辑",
      Continue: "继续",
      Back: "返回",
      Next: "下一步",
      Delete: "删除",
    }),
  );
  function labelTranslation(text, el) {
    return (
      (compact(el) ? commonLabels.get(text) : undefined) ??
      (isGithub ? githubLabels.get(text) : undefined)
    );
  }
  function removeUiTitle(s) {
    if (!s.titleEl) return;
    const el = s.titleEl,
      record = uiTitles.get(el);
    s.titleEl = null;
    if (!record) return;
    record.values.delete(s);
    if (el.getAttribute("title") !== record.after) {
      record.before = el.getAttribute("title");
    }
    if (record.values.size) {
      record.after = [record.before, ...record.values.values()]
        .filter(Boolean)
        .join(" · ");
      el.setAttribute("title", record.after);
    } else {
      if (el.getAttribute("title") === record.after) {
        if (record.before === null) el.removeAttribute("title");
        else el.setAttribute("title", record.before);
      }
      uiTitles.delete(el);
    }
  }
  function fitCompact(s) {
    if (!s.compact || !s.slot?.isConnected) return;
    const control = s.el.closest(CONTROL);
    if (!control) return;
    s.slot.style.setProperty("display", "inline", "important");
    const r = s.slot.getBoundingClientRect(),
      c = control.getBoundingClientRect();
    const clipped = getComputedStyle(s.el);
    const truncated =
      ["hidden", "clip"].includes(clipped.overflowX) &&
      s.el.scrollWidth > s.el.clientWidth + 1;
    if (
      truncated ||
      r.top < c.top - 1 ||
      r.bottom > c.bottom + 1 ||
      r.left < c.left - 1 ||
      r.right > c.right + 1
    ) {
      s.slot.style.setProperty("display", "none", "important");
      let record = uiTitles.get(control);
      if (!record) {
        record = {
          before: control.getAttribute("title"),
          after: null,
          values: new Map(),
        };
        uiTitles.set(control, record);
      } else if (control.getAttribute("title") !== record.after)
        record.before = control.getAttribute("title");
      record.values.set(s, s.translation);
      record.after = [record.before, ...record.values.values()]
        .filter(Boolean)
        .join(" · ");
      control.setAttribute("title", record.after);
      s.titleEl = control;
    } else removeUiTitle(s);
  }
  const normal = (text) => text.replace(/\s+/gu, " ").trim();
  const states = new Map();
  let engine = "microsoft",
    epoch = 0,
    running = false,
    working = 0,
    active = false;
  const engineNames = {
    microsoft: "微软",
    google: "Google",
    tencent: "腾讯",
    local: "本地",
  };
  let status,
    pauseButton,
    retryButton,
    selectionHost,
    observer,
    mutations,
    scanTimer;
  let session = null,
    sessionCreating = null,
    selectionToken = 0;
  let queue = [],
    lastError = "",
    limited = 0;
  const titles = new Map(),
    tooltipTexts = new Map(),
    dirtyRoots = new Set();
  const isX = /(^|\.)(x\.com|twitter\.com)$/i.test(location.hostname);
  const X_POST = '[data-testid="tweetText"]';
  const X_FLOW_TEXT = 'article div[dir="auto"]';
  let ballHost, ballRoot, ballButton, ballPanel, ballEngine, ballNote;
  let uiObserver, uiBody;
  // 存储键沿用旧版本autoEnglish，V4起表示自动翻译外语页，保留已有开关选择。
  let autoEnglish = false,
    preserveNavigation = true,
    autoBox,
    navigationBox;
  let autoTimer;
  let selectionAuto = true,
    selectionBox,
    videoBox,
    selectionRange = null,
    selectionText = "",
    selectionTimer;

  const style = `:host{all:initial;color-scheme:light;font:13px/1.65 "Segoe UI","Microsoft YaHei",sans-serif;color:#214c39}*{box-sizing:border-box}button{font:inherit;border:1px solid #ccddd0;border-radius:6px;background:#fff;color:#28563c;padding:5px 10px;cursor:pointer;white-space:nowrap}button:hover{background:#e5eee7}button:focus-visible{outline:3px solid #84b596;outline-offset:2px}button:disabled{opacity:.6;cursor:wait}.status{flex:1;min-width:100px;overflow-wrap:anywhere}.error{color:#a84031}.translation{display:block;border-left:2px solid #67a680;padding:5px 11px;margin:7px 0;color:inherit;font-size:0.95em;line-height:1.75;white-space:pre-wrap;overflow-wrap:anywhere}`;

  function host(where, fixed = false) {
    const h = document.createElement("span");
    h.setAttribute(OWN, "");
    h.setAttribute("translate", "no");
    h.style.cssText = fixed
      ? "all:initial!important;position:fixed!important;z-index:2147483647!important;"
      : "all:initial!important;display:block!important;color:inherit!important;font:inherit!important;line-height:inherit!important;max-width:100%!important;";
    const root = h.attachShadow({ mode: "open" });
    const sheet = document.createElement("style");
    sheet.textContent = style;
    root.append(sheet);
    where.append(h);
    return { h, root };
  }
  function button(label, click) {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = label;
    el.addEventListener("click", click);
    return el;
  }
  function setEngine(value) {
    const next =
      value === "online"
        ? "google"
        : Object.hasOwn(engineNames, value)
          ? value
          : "microsoft";
    if (next !== engine) restore(false);
    engine = next;
    if (ballEngine) ballEngine.value = engine;
    if (ballNote)
      ballNote.textContent =
        engine === "local"
          ? "本地模式仅英文；首次需准备语言包。"
          : `自动识别原文 → 简体中文。文字将发送至${engineNames[engine]}翻译服务。`;
  }
  let autoObserver,
    autoSuppressed = false;
  function languageHint(el) {
    return el?.closest("[lang]")?.getAttribute("lang") || "";
  }
  function translatable(text, el, englishOnly = engine === "local") {
    return globalThis.clearTranslateLanguage.shouldTranslate(
      text,
      languageHint(el),
      englishOnly,
    );
  }
  function foreignPage() {
    const root = document.querySelector('main,[role="main"]') || document.body;
    const visibility = new Map();
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        return n.parentElement?.closest(SKIP) ||
          !visibleText(n, visibility) ||
          (isX && !blockFor(n))
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      },
    });
    const seen = new Set();
    let sampled = 0,
      letters = 0,
      foreign = 0,
      n;
    while (sampled < 16000 && (n = walk.nextNode())) {
      const block = blockFor(n);
      if (!block || seen.has(block)) continue;
      seen.add(block);
      const text = readText(block, visibility);
      const count = globalThis.clearTranslateLanguage.counts(text).letters;
      sampled += text.length;
      letters += count;
      if (translatable(text, block)) foreign += count;
    }
    return foreign >= 12 && foreign / letters >= 0.5;
  }
  function watchAutoEnglish() {
    autoObserver?.disconnect();
    clearTimeout(autoTimer);
    autoTimer = null;
    if (!autoEnglish || active || autoSuppressed || !document.body) return;
    const check = () => {
      if (autoTimer) return;
      autoTimer = setTimeout(() => {
        autoTimer = null;
        if (autoEnglish && !active && !autoSuppressed && foreignPage())
          startPage();
      }, 180);
    };
    autoObserver = new MutationObserver(check);
    autoObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["hidden", "aria-hidden", "class", "style"],
    });
    check();
  }
  async function togglePage() {
    if (active && (engine !== "local" || session)) {
      restore();
      return;
    }
    if (!active) startPage();
    if (engine === "local") {
      try {
        await ensureLocal();
        running = true;
        lastError = "";
        updateStatus();
        pump();
      } catch (e) {
        lastError = e.message;
        running = false;
        updateStatus();
      }
    }
  }
  function createBall() {
    const made = host(document.body, true);
    ballHost = made.h;
    ballRoot = made.root;
    ballHost.style.setProperty("right", "12px", "important");
    ballHost.style.setProperty("top", "42%", "important");
    const sheet = document.createElement("style");
    sheet.textContent = `[hidden]{display:none!important}.orb{display:grid;place-items:center;border:2px solid #f3faf5;border-radius:50%;width:44px;height:44px;padding:0;background:#226547;color:white;font-size:21px;font-weight:700;box-shadow:0 3px 15px #143d3130;touch-action:none;user-select:none;position:relative}.orb:hover{background:#174f36}.orb.active{background:#184b35}.orb.busy:after{content:"";position:absolute;right:-2px;bottom:-2px;width:10px;height:10px;border-radius:50%;background:#d5e7a0;border:2px solid #fff}.panel{position:absolute;right:0;width:min(300px,calc(100vw - 32px));background:#f9fcfa;border:1px solid #cbded0;border-radius:14px;padding:17px;box-shadow:0 8px 36px #143d312c;max-height:calc(100vh - 32px);overflow:auto}.panel h2{font-size:17px;margin:0}.panel .sub{color:#728277;font-size:11px;margin:1px 0 14px}.panel select{width:100%;font:inherit;font-size:12px;padding:9px 4px;border:1px solid #d4e0d7;border-radius:7px;color:#365b45;background:white}.panel .note{font-size:10px;line-height:1.5;margin:7px 0 14px;color:#7a877c}.panel .line{display:flex;gap:7px;margin-top:9px}.panel .line button{flex:1;font-size:11px;padding:7px 3px}.panel label{display:block;font-size:11px;color:#66806c;margin-bottom:5px}.panel .toggle{display:flex;justify-content:space-between;align-items:center;margin:11px 0;gap:10px;font-size:12px}.panel input{appearance:none;width:32px;height:18px;flex:0 0 32px;border-radius:12px;background:#b4c3b8;position:relative;margin:0;cursor:pointer}.panel input:checked{background:#226547}.panel input:before{content:"";position:absolute;left:3px;top:3px;width:12px;height:12px;background:#fff;border-radius:50%}.panel input:checked:before{transform:translateX(14px)}.panel input:focus-visible{outline:3px solid #96c3a5;outline-offset:2px}.panel .close{float:right;border:0;padding:0 3px;color:#718378;background:transparent}.panel .status{display:block;border-top:1px solid #dce6df;padding-top:11px;margin-top:13px;font-size:11px;line-height:1.6}`;
    made.root.append(sheet);
    let dragged = false,
      dragStart = null,
      closeTimer;
    function closePanel() {
      ballPanel.hidden = true;
      ballButton.setAttribute("aria-expanded", "false");
    }
    function positionPanel() {
      if (ballPanel.hidden) return;
      const r = ballButton.getBoundingClientRect(),
        height = ballPanel.getBoundingClientRect().height;
      const below = r.height + 8;
      ballPanel.style.top = `${r.top + below + height <= innerHeight - 12 ? below : Math.max(12 - r.top, -height - 8)}px`;
    }
    function openPanel() {
      clearTimeout(closeTimer);
      ballPanel.hidden = false;
      ballButton.setAttribute("aria-expanded", "true");
      updateStatus();
      positionPanel();
    }
    ballButton = button("译", () => {
      if (dragged) {
        dragged = false;
        return;
      }
      togglePage();
    });
    ballButton.className = "orb";
    ballButton.setAttribute("aria-label", "清译悬浮球");
    ballButton.setAttribute("aria-expanded", "false");
    ballPanel = document.createElement("div");
    ballPanel.className = "panel";
    ballPanel.hidden = true;
    const close = button("×", closePanel);
    close.className = "close";
    close.setAttribute("aria-label", "收起翻译设置");
    const title = document.createElement("h2");
    title.textContent = "清译";
    const sub = document.createElement("p");
    sub.className = "sub";
    sub.textContent = "单击翻译 · 再次单击恢复";
    const label = document.createElement("label");
    label.textContent = "翻译方式";
    label.htmlFor = "ball-engine";
    ballEngine = document.createElement("select");
    ballEngine.id = "ball-engine";
    for (const [value, text] of [
      ["microsoft", "微软翻译 · 免费免密钥"],
      ["google", "Google 翻译 · 免费免密钥"],
      ["tencent", "腾讯交互翻译 · 免费免密钥"],
      ["local", "浏览器本地翻译 · 仅英文"],
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      ballEngine.append(option);
    }
    ballEngine.addEventListener("change", () => {
      setEngine(ballEngine.value);
      chrome.storage.local.set({ engine });
      positionPanel();
    });
    ballNote = document.createElement("p");
    ballNote.className = "note";
    function makeToggle(id, text, onChange) {
      const row = document.createElement("label");
      row.className = "toggle";
      row.htmlFor = id;
      const name = document.createElement("span");
      name.textContent = text;
      const box = document.createElement("input");
      box.type = "checkbox";
      box.id = id;
      box.addEventListener("change", () => onChange(box.checked));
      row.append(name, box);
      return { row, box };
    }
    const automatic = makeToggle(
      "ball-auto-english",
      "自动翻译外语网页",
      (value) => {
        autoEnglish = value;
        autoSuppressed = false;
        chrome.storage.local.set({ autoEnglish: value });
        watchAutoEnglish();
      },
    );
    autoBox = automatic.box;
    const selectionSetting = makeToggle(
      "ball-selection-auto",
      "划词后自动翻译",
      (value) => {
        selectionAuto = value;
        chrome.storage.local.set({ selectionAuto: value });
        if (!value) closeSelection();
      },
    );
    selectionBox = selectionSetting.box;
    const videoSetting = makeToggle(
      "ball-video-subtitles",
      "翻译视频字幕",
      (value) => chrome.storage.local.set({ videoSubtitles: value }),
    );
    videoBox = videoSetting.box;
    const navigation = makeToggle(
      "ball-preserve-navigation",
      "保留导航栏原样",
      (value) => {
        preserveNavigation = value;
        chrome.storage.local.set({ preserveNavigation: value });
        if (active) scan();
      },
    );
    navigationBox = navigation.box;
    const hide = button("隐藏悬浮球", () =>
      chrome.storage.local.set({ ballVisible: false }),
    );
    const line = document.createElement("div");
    line.className = "line";
    const selected = button("翻译选中文字", () => {
      const text = normal(window.getSelection()?.toString() || "");
      if (!text || text.length > 30000) {
        lastError = text
          ? "选中文字过长，请分段翻译。"
          : "请先在网页中选中文字。";
        updateStatus();
        return;
      }
      showSelection(text);
      closePanel();
    });
    selected.addEventListener("pointerdown", (e) => e.preventDefault());
    line.append(selected, hide);
    const documentLine = document.createElement("div");
    documentLine.className = "line";
    documentLine.append(
      button("打开 PDF 对照阅读器", () =>
        chrome.runtime.sendMessage({ type: "CLEAR_OPEN_PDF" }),
      ),
    );
    status = document.createElement("p");
    status.className = "status";
    status.setAttribute("role", "status");
    const controls = document.createElement("div");
    controls.className = "line";
    pauseButton = button("暂停", async () => {
      if (engine === "local" && !session) {
        try {
          await ensureLocal();
        } catch (e) {
          lastError = e.message;
          updateStatus();
          return;
        }
      }
      running = !running;
      lastError = "";
      updateStatus();
      if (running) pump();
    });
    retryButton = button("重试失败段落", async () => {
      try {
        if (engine === "local") await ensureLocal();
      } catch (e) {
        lastError = e.message;
        updateStatus();
        return;
      }
      for (const s of states.values())
        if (s.phase === "error") {
          s.phase = "queued";
          queue.unshift(s);
        }
      running = true;
      lastError = "";
      updateStatus();
      pump();
    });
    controls.append(pauseButton, retryButton);
    ballPanel.append(
      close,
      title,
      sub,
      label,
      ballEngine,
      ballNote,
      automatic.row,
      selectionSetting.row,
      videoSetting.row,
      navigation.row,
      line,
      documentLine,
      status,
      controls,
    );
    made.root.append(ballButton, ballPanel);
    ballHost.addEventListener("pointerenter", openPanel);
    ballHost.addEventListener("pointerleave", () => {
      closeTimer = setTimeout(closePanel, 240);
    });
    ballPanel.addEventListener("focusin", () => clearTimeout(closeTimer));
    ballButton.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        openPanel();
        ballEngine.focus();
      }
    });
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (!e.composedPath().includes(ballHost)) closePanel();
      },
      true,
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePanel();
    });
    ballButton.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragStart = { y: e.clientY, top: ballHost.getBoundingClientRect().top };
      dragged = false;
      ballButton.setPointerCapture(e.pointerId);
    });
    ballButton.addEventListener("pointermove", (e) => {
      if (!dragStart) return;
      if (Math.abs(e.clientY - dragStart.y) > 5) dragged = true;
      if (!dragged) return;
      ballHost.style.setProperty(
        "top",
        `${Math.max(12, Math.min(innerHeight - 56, dragStart.top + e.clientY - dragStart.y))}px`,
        "important",
      );
      positionPanel();
    });
    ballButton.addEventListener("pointerup", () => {
      if (dragged)
        chrome.storage.local.set({
          ballY: ballHost.getBoundingClientRect().top / innerHeight,
        });
      dragStart = null;
    });
    ballButton.addEventListener("pointercancel", () => {
      dragStart = null;
      dragged = false;
    });
    window.addEventListener("resize", () => {
      ballHost.style.setProperty(
        "top",
        `${Math.max(12, Math.min(innerHeight - 56, ballHost.getBoundingClientRect().top))}px`,
        "important",
      );
      positionPanel();
    });
    function showBall(visible) {
      ballHost.style.setProperty(
        "display",
        visible ? "block" : "none",
        "important",
      );
      if (!visible) closePanel();
    }
    chrome.storage.local
      .get([
        "engine",
        "ballY",
        "ballVisible",
        "autoEnglish",
        "preserveNavigation",
        "selectionAuto",
        "videoSubtitles",
      ])
      .then((saved) => {
        selectionAuto = saved.selectionAuto !== false;
        selectionBox.checked = selectionAuto;
        videoBox.checked = saved.videoSubtitles !== false;
        autoEnglish = saved.autoEnglish === true;
        preserveNavigation = saved.preserveNavigation !== false;
        autoBox.checked = autoEnglish;
        navigationBox.checked = preserveNavigation;
        setEngine(saved.engine);
        showBall(saved.ballVisible !== false);
        if (typeof saved.ballY === "number")
          ballHost.style.setProperty(
            "top",
            `${Math.max(12, Math.min(innerHeight - 56, saved.ballY * innerHeight))}px`,
            "important",
          );
        watchAutoEnglish();
        updateStatus();
      });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.engine) setEngine(changes.engine.newValue);
      if (changes.ballVisible) showBall(changes.ballVisible.newValue !== false);
      if (changes.videoSubtitles)
        videoBox.checked = changes.videoSubtitles.newValue !== false;
      if (changes.selectionAuto) {
        selectionAuto = changes.selectionAuto.newValue !== false;
        selectionBox.checked = selectionAuto;
        if (!selectionAuto) closeSelection();
      }
      if (changes.autoEnglish) {
        autoEnglish = changes.autoEnglish.newValue === true;
        autoBox.checked = autoEnglish;
        autoSuppressed = false;
        watchAutoEnglish();
      }
      if (changes.preserveNavigation) {
        preserveNavigation = changes.preserveNavigation.newValue !== false;
        navigationBox.checked = preserveNavigation;
        if (active) scan();
      }
    });
    setEngine(engine);
    updateStatus();
    uiBody = document.body;
    uiObserver = new MutationObserver(() => {
      if (!document.body) return;
      if (!ballHost.isConnected) document.body.append(ballHost);
      if (selectionHost && !selectionHost.isConnected)
        document.body.append(selectionHost);
      if (uiBody !== document.body) {
        uiBody = document.body;
        uiObserver.disconnect();
        uiObserver.observe(document.documentElement, { childList: true });
        uiObserver.observe(uiBody, { childList: true });
        if (active) {
          mutations?.observe(uiBody, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: [
              "title",
              "hidden",
              "aria-hidden",
              "class",
              "style",
              "dir",
              "data-testid",
              "open",
              "inert",
              "role",
              "aria-modal",
              "popover",
              "data-state",
              "placeholder",
              "data-visibility-visible",
              "aria-expanded",
              "aria-controls",
            ],
          });
          scan();
        } else watchAutoEnglish();
      }
    });
    uiObserver.observe(document.documentElement, { childList: true });
    uiObserver.observe(document.body, { childList: true });
  }
  function clippedCompletely(style, rect) {
    const length = (value, extent) => {
      if (!/^[-+]?(?:\d*\.)?\d+(?:px|%)?$/.test(value)) return NaN;
      return value.endsWith("%")
        ? (parseFloat(value) * extent) / 100
        : parseFloat(value);
    };
    const legacy = /^rect\((.*)\)$/.exec(style.clip);
    if (legacy && ["absolute", "fixed"].includes(style.position)) {
      const values = legacy[1].trim().split(/[\s,]+/);
      if (values.length === 4) {
        const limits = [0, rect.width, rect.height, 0];
        const [top, right, bottom, left] = values.map((v, i) =>
          v === "auto"
            ? limits[i]
            : length(v, i % 2 ? rect.width : rect.height),
        );
        if (
          [top, right, bottom, left].every(Number.isFinite) &&
          (bottom <= top || right <= left)
        )
          return true;
      }
    }
    const inset = /^inset\((.*?)\)$/.exec(style.clipPath);
    if (inset) {
      const parts = inset[1]
        .split(/\s+round\s+/)[0]
        .trim()
        .split(/\s+/);
      if (parts.length >= 1 && parts.length <= 4) {
        const edges =
          parts.length === 1
            ? [parts[0], parts[0], parts[0], parts[0]]
            : parts.length === 2
              ? [parts[0], parts[1], parts[0], parts[1]]
              : parts.length === 3
                ? [parts[0], parts[1], parts[2], parts[1]]
                : parts;
        const [top, right, bottom, left] = edges.map((v, i) =>
          length(v, i % 2 ? rect.width : rect.height),
        );
        if (
          [top, right, bottom, left].every(Number.isFinite) &&
          (top + bottom >= rect.height || left + right >= rect.width)
        )
          return true;
      }
    }
    return false;
  }
  function readableElement(el, cache = new Map(), ancestorOnly = false) {
    if (!el || !el.isConnected) return false;
    if (cache.has(el))
      return cache.get(el)[ancestorOnly ? "rendered" : "visible"];
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const clippedX = ["hidden", "clip"].includes(style.overflowX);
    const clippedY = ["hidden", "clip"].includes(style.overflowY);
    const hidden =
      el.hasAttribute("hidden") ||
      el.hasAttribute("inert") ||
      el.getAttribute("aria-hidden") === "true" ||
      style.display === "none" ||
      style.contentVisibility === "hidden" ||
      Number(style.opacity) === 0 ||
      (clippedX && rect.width <= 1) ||
      (clippedY && rect.height <= 1) ||
      clippedCompletely(style, rect);
    const rendered =
      !hidden &&
      (!el.parentElement || readableElement(el.parentElement, cache, true));
    // visibility可被后代显式覆盖；display/裁切/透明度则仍受祖先约束。
    const visible =
      rendered && !["hidden", "collapse"].includes(style.visibility);
    cache.set(el, { rendered, visible });
    return ancestorOnly ? rendered : visible;
  }
  function visibleText(node, cache = new Map()) {
    if (!readableElement(node.parentElement, cache)) return false;
    const range = document.createRange();
    range.selectNodeContents(node);
    return [...range.getClientRects()].some((r) => r.width > 0 && r.height > 1);
  }
  function readText(el, visibility = new Map()) {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        return n.parentElement?.closest(SKIP) ||
          blockFor(n) !== el ||
          !visibleText(n, visibility)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      },
    });
    let n,
      previousBlock,
      text = "";
    while ((n = walk.nextNode())) {
      const block = n.parentElement.closest(BLOCK);
      if (previousBlock && block !== previousBlock) text += " ";
      text += n.textContent;
      previousBlock = block;
    }
    return normal(text);
  }
  function blockFor(node) {
    const identity = node.parentElement?.closest(IDENTITY);
    if (identity && (!isX || node.parentElement.closest(LAYER))) {
      const prose = node.parentElement.closest(PROSE);
      if (!prose || identity.contains(prose)) return null;
    }
    if (!isX || node.parentElement?.closest(LAYER))
      return uiTarget(node) || node.parentElement?.closest(BLOCK);
    // X只使用已确认的正文入口，身份、导航、辅助提示不回退到整页扫描。
    const tweet = node.parentElement?.closest(X_POST);
    if (tweet) return tweet;
    const flow = node.parentElement?.closest(X_FLOW_TEXT);
    if (
      flow &&
      ["pre-wrap", "pre-line", "break-spaces"].includes(
        getComputedStyle(flow).whiteSpace,
      )
    )
      return flow;
    const card = node.parentElement?.closest(
      'article [data-testid="card.wrapper"]',
    );
    const leaf = node.parentElement?.closest(BLOCK);
    return card && leaf && card.contains(leaf) ? leaf : null;
  }
  function nearViewport(el) {
    const r = el.getBoundingClientRect();
    return r.bottom >= -900 && r.top <= innerHeight + 1400;
  }
  function enqueue(s) {
    if (s.phase !== "idle") return;
    s.phase = "queued";
    queue.push(s);
  }
  function localizeXDates(root = document.body) {
    if (!isX || !active) return;
    const scope = root.nodeType === 1 ? root : root.parentElement;
    if (!scope || scope.closest(`[${OWN}]`)) return;
    const visibility = new Map();
    const titleEls = [...scope.querySelectorAll("[title]")];
    if (scope.hasAttribute("title")) titleEls.push(scope);
    for (const el of titleEls) {
      if (!readableElement(el, visibility)) continue;
      const raw = el.getAttribute("title");
      const translated = globalThis.clearTranslateDate?.(raw);
      if (!translated || translated === raw) continue;
      titles.set(el, { before: raw, after: translated });
      el.setAttribute("title", translated);
    }
    const timeLinks = [...scope.querySelectorAll('a[href*="/status/"]')];
    if (scope.matches('a[href*="/status/"]')) timeLinks.push(scope);
    for (const el of timeLinks) {
      if (!readableElement(el, visibility)) continue;
      if (el.hasAttribute("title")) continue;
      if (
        !el.querySelector("time") &&
        !(
          el.hasAttribute("data-base-ui-tooltip-trigger") &&
          /^(\d+\s*(?:[smhd]|秒|分钟|小时|天)|[A-Za-z]{3}\s+\d{1,2})$/i.test(
            el.textContent.trim(),
          )
        )
      )
        continue;
      const datetime = el
        .querySelector("time[datetime]")
        ?.getAttribute("datetime");
      const match = /\/status\/(\d{10,22})(?:\/|$)/.exec(el.pathname);
      let date;
      if (datetime) date = new Date(datetime);
      else if (match) {
        try {
          date = new Date(Number((BigInt(match[1]) >> 22n) + 1288834974657n));
        } catch {
          continue;
        }
      }
      if (!date || !Number.isFinite(date.getTime())) continue;
      const translated = new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short",
      }).format(date);
      titles.set(el, { before: null, after: translated });
      el.setAttribute("title", translated);
    }
    const tips = [...scope.querySelectorAll('[role="tooltip"]')];
    if (scope.matches('[role="tooltip"]')) tips.push(scope);
    for (const tip of tips) {
      if (!readableElement(tip, visibility)) continue;
      const walk = document.createTreeWalker(tip, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        if (!visibleText(n, visibility)) continue;
        const translated = globalThis.clearTranslateDate?.(n.textContent);
        if (translated && translated !== n.textContent) {
          tooltipTexts.set(n, { before: n.textContent, after: translated });
          n.textContent = translated;
        }
      }
    }
    for (const el of titles.keys()) if (!el.isConnected) titles.delete(el);
    for (const n of tooltipTexts.keys())
      if (!n.isConnected) tooltipTexts.delete(n);
  }
  function eligible(el, text, visibility = new Map(), placeholder = false) {
    if (
      placeholder &&
      ![...el.getClientRects()].some((r) => r.width > 0 && r.height > 1)
    )
      return false;
    if (
      !el.isConnected ||
      (placeholder
        ? el.parentElement?.closest(SKIP) ||
          el.matches('[translate="no"],.notranslate,[aria-hidden="true"]')
        : el.closest(SKIP)) ||
      (placeholder && isX && !el.closest(LAYER)) ||
      el.closest(IDENTITY) ||
      (isGithub &&
        (text === githubLogin ||
          ["Copilot", "GitHub", "HTTPS", "SSH", "GitHub CLI"].includes(
            text,
          ))) ||
      !translatable(text, el)
    )
      return false;
    if (
      preserveNavigation &&
      !el.closest(LAYER) &&
      el.closest(
        'nav,aside,header,footer,[role="navigation"],[role="complementary"]',
      )
    )
      return false;
    return readableElement(el, visibility);
  }
  function stateText(s, visibility = new Map()) {
    if (!s.placeholder) return readText(s.el, visibility);
    const current = s.el.getAttribute("placeholder");
    return current === s.translation ? s.text : normal(current || "");
  }
  function stateEligible(s, text, visibility = new Map()) {
    return eligible(s.el, text, visibility, s.placeholder);
  }
  function restorePlaceholder(s) {
    if (s.placeholder && s.el.getAttribute("placeholder") === s.translation)
      s.el.setAttribute("placeholder", s.originalPlaceholder);
  }
  function updateStatus(message) {
    if (!status) return;
    const counted = [...states.values()].filter((s) => !s.unchanged);
    const done = counted.filter((s) => s.phase === "done").length;
    status.className = "status" + (lastError ? " error" : "");
    status.textContent =
      message ||
      lastError ||
      (active
        ? `${engineNames[engine]} · 已译 ${done} / ${counted.length} 段${running ? " · 滚动继续" : " · 已暂停"}${limited ? ` · ${limited} 段过长` : ""}`
        : "点击悬浮球翻译当前网页");
    pauseButton.hidden = !active;
    pauseButton.textContent =
      engine === "local" && !session
        ? "开始本地翻译"
        : running
          ? "暂停"
          : "继续";
    retryButton.hidden = !lastError || !active;
    ballButton.classList.toggle("active", active);
    ballButton.classList.toggle(
      "busy",
      active && running && done < counted.length,
    );
    ballButton.title =
      lastError ||
      (active
        ? "清译：点击恢复原文，悬停打开设置"
        : "清译：点击翻译，悬停打开设置");
  }
  async function ensureLocal() {
    if (session) return session;
    if (sessionCreating) return sessionCreating;
    if (typeof globalThis.Translator === "undefined")
      throw new Error("当前浏览器未提供本地翻译，请在插件面板选择在线翻译。");
    const ticket = epoch;
    const api = globalThis.Translator;
    // create 必须直接发生在页面按钮点击路径，首次下载需要用户激活。
    const pending = api
      .create({
        sourceLanguage: "en",
        targetLanguage: "zh",
        monitor(m) {
          m.addEventListener("downloadprogress", (e) => {
            if (ticket !== epoch) return;
            const ratio =
              Number.isFinite(e.total) && e.total > 0
                ? e.loaded / e.total
                : e.loaded;
            updateStatus(
              `正在准备本地语言包 ${Math.min(100, Math.round(ratio * 100))}%…`,
            );
          });
        },
      })
      .then((value) => {
        if (ticket !== epoch) {
          value.destroy();
          throw new Error("翻译已取消。");
        }
        session = value;
        return value;
      })
      .catch((e) => {
        throw new Error(
          e.name === "NotAllowedError"
            ? "浏览器未允许本地翻译，请点击按钮重试或选择在线翻译。"
            : `本地语言包不可用：${e.message || "请改用在线翻译。"}`,
        );
      });
    sessionCreating = pending;
    try {
      return await pending;
    } finally {
      if (sessionCreating === pending) sessionCreating = null;
    }
  }
  async function translate(text, priority = false) {
    if (engine === "local") {
      if (!session) throw new Error("请先点击“开始本地翻译”准备语言包。");
      const detected = await chrome.i18n.detectLanguage(text);
      if (detected.languages?.[0]?.language !== "en")
        throw new Error(
          "本地模式目前仅支持英文，请手动选择微软或 Google 自动识别其他语言。",
        );
      const value = await session.translate(text);
      if (typeof value !== "string" || !value.trim())
        throw new Error("本地翻译未返回译文，请重试。");
      return value;
    }
    const result = await chrome.runtime.sendMessage({
      type: "CLEAR_TRANSLATE",
      text,
      engine,
      priority,
    });
    if (!result?.ok)
      throw new Error(result?.error || "没有收到翻译结果，请重试。");
    return result.text;
  }
  function discardState(s) {
    s.version++;
    s.phase = "discarded";
    s.slot?.remove();
    removeUiTitle(s);
    restorePlaceholder(s);
    observer?.unobserve(s.el);
    if (states.get(s.el) === s) states.delete(s.el);
  }
  function scan(root = document.body) {
    if (!active) return;
    if (!root?.isConnected) return;
    if (root.nodeType !== 1) root = root.parentElement;
    if (!root || root.closest(`[${OWN}]`)) return;
    localizeXDates(root);
    const visibility = new Map();
    // 隐藏/改为非正文后可能已没有可遍历文字，也必须清掉已有译文及待返回任务。
    for (const [el, s] of states) {
      if (
        !el.isConnected ||
        ((root.contains(el) || el.contains(root)) &&
          !stateEligible(s, stateText(s, visibility), visibility))
      )
        discardState(s);
    }
    // 以最近的语义段落分组，链接、加粗等行内元素不会把句子拆开。
    const candidates = new Set();
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (
          !n.textContent.trim() ||
          n.parentElement?.closest(SKIP) ||
          !visibleText(n, visibility)
        )
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walk.nextNode())) {
      const el = blockFor(n);
      if (el && el !== document.body) candidates.add(el);
    }
    const placeholders = "input[placeholder],textarea[placeholder]";
    if (root.matches(placeholders)) candidates.add(root);
    for (const el of root.querySelectorAll(placeholders)) candidates.add(el);
    if (root === document.body) limited = 0;
    for (const el of candidates) {
      const placeholder = el.matches(placeholders),
        existing = states.get(el);
      const text = placeholder
        ? existing?.placeholder
          ? stateText(existing)
          : normal(el.getAttribute("placeholder") || "")
        : readText(el, visibility);
      if (!eligible(el, text, visibility, placeholder)) {
        const old = states.get(el);
        if (old) discardState(old);
        continue;
      }
      if (text.length > 30000) {
        const old = states.get(el);
        if (old) discardState(old);
        limited++;
        continue;
      }
      let s = states.get(el);
      if (
        s &&
        s.text === text &&
        (s.phase !== "done" ||
          s.unchanged ||
          placeholder ||
          s.compact === compact(el)) &&
        (s.phase !== "done" ||
          s.unchanged ||
          s.slot?.isConnected ||
          (s.placeholder && el.getAttribute("placeholder") === s.translation))
      ) {
        if (s.phase === "done") fitCompact(s);
        continue;
      }
      if (s) {
        if (placeholder && el.getAttribute("placeholder") !== s.translation)
          s.originalPlaceholder = el.getAttribute("placeholder");
        s.slot?.remove();
        removeUiTitle(s);
        s.version++;
        s.text = text;
        s.unchanged = false;
        s.slot = null;
        s.phase = "idle";
      } else {
        s = {
          el,
          text,
          phase: "idle",
          slot: null,
          version: 0,
          placeholder,
          originalPlaceholder: placeholder
            ? el.getAttribute("placeholder")
            : null,
        };
        states.set(el, s);
      }
      observer.unobserve(el);
      observer.observe(el);
      if (nearViewport(el)) enqueue(s);
    }
    updateStatus();
    pump();
  }
  async function pump() {
    if (working >= 2 || !queue.length || !running || !active) return;
    working++;
    const ticket = epoch;
    queueMicrotask(pump);
    try {
      while (queue.length && running && active && ticket === epoch) {
        // 视口内最优先；快速滚动后不再排队等待已经划走的段落。
        const ranks = new Map(
          queue.map((s) => {
            const r = s.el.getBoundingClientRect();
            const distance =
              r.bottom < 0
                ? -r.bottom + 100
                : r.top > innerHeight
                  ? r.top - innerHeight
                  : 0;
            const content = s.el.closest(LAYER)
              ? -1
              : s.el.closest('article,[role="article"]')
                ? 0
                : s.el.closest('main,[role="main"]')
                  ? 1
                  : s.el.closest(
                        'nav,aside,[role="navigation"],[role="complementary"]',
                      )
                    ? 3
                    : 2;
            return [s, [distance === 0 ? 0 : 1, content, distance]];
          }),
        );
        queue.sort((a, b) => {
          const x = ranks.get(a),
            y = ranks.get(b);
          return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
        });
        const batch = [];
        const count = engine === "local" ? 1 : 6;
        let chars = 0;
        while (queue.length && batch.length < count && chars < 4500) {
          const s = queue.shift();
          if (s.phase !== "queued" || states.get(s.el) !== s) continue;
          const current = stateText(s);
          if (!stateEligible(s, current)) {
            discardState(s);
            continue;
          }
          if (current !== s.text) {
            scan(s.el);
            continue;
          }
          if (!nearViewport(s.el)) {
            s.phase = "idle";
            observer.unobserve(s.el);
            observer.observe(s.el);
            continue;
          }
          batch.push({ s, version: s.version });
          chars += s.text.length;
          s.phase = "working";
        }
        if (!batch.length) continue;
        try {
          const values = batch.map(({ s }) => labelTranslation(s.text, s.el));
          const missing = batch
            .map(({ s }, i) => ({ s, i }))
            .filter(({ i }) => values[i] === undefined);
          if (missing.length === 1)
            values[missing[0].i] = await translate(missing[0].s.text);
          else if (missing.length) {
            const response = await chrome.runtime.sendMessage({
              type: "CLEAR_BATCH",
              engine,
              texts: missing.map(({ s }) => s.text),
            });
            if (!response?.ok)
              throw new Error(response?.error || "没有收到翻译结果，请重试。");
            missing.forEach(({ i }, at) => (values[i] = response.texts[at]));
          }
          for (let i = 0; i < batch.length; i++) {
            const { s, version } = batch[i];
            if (ticket !== epoch || version !== s.version || !s.el.isConnected)
              continue;
            const current = stateText(s);
            if (!stateEligible(s, current)) {
              discardState(s);
              continue;
            }
            if (current !== s.text) {
              s.phase = "idle";
              scan(s.el);
              continue;
            }
            s.translation = values[i];
            if (normal(values[i]) === s.text) {
              s.unchanged = true;
              s.phase = "done";
              continue;
            }
            if (s.placeholder) {
              s.el.setAttribute("placeholder", values[i]);
              s.phase = "done";
              continue;
            }
            const computed = getComputedStyle(s.el);
            s.compact = compact(s.el);
            const outside =
              !s.compact &&
              Number.parseInt(computed.webkitLineClamp, 10) > 0 &&
              ["static", "relative"].includes(computed.position);
            const made = host(s.el);
            s.slot = made.h;
            if (outside) {
              // 只对明确的正文行数折叠外置；普通裁切容器不能被译文越过。
              s.el.after(made.h);
              made.h.style.setProperty("font", computed.font, "important");
              made.h.style.setProperty("color", computed.color, "important");
              made.h.style.setProperty(
                "line-height",
                computed.lineHeight,
                "important",
              );
            }
            const output = document.createElement("span");
            output.className = "translation";
            output.style.cssText =
              "border:0;padding:0;margin:8px 0 0;font:inherit;color:inherit;line-height:inherit;";
            output.lang = "zh-CN";
            output.textContent = values[i];
            s.translation = values[i];
            if (s.compact) {
              const walk = document.createTreeWalker(
                s.el,
                NodeFilter.SHOW_TEXT,
                {
                  acceptNode: (n) =>
                    !n.parentElement?.closest(SKIP) && blockFor(n) === s.el
                      ? NodeFilter.FILTER_ACCEPT
                      : NodeFilter.FILTER_REJECT,
                },
              );
              let source, last;
              while ((source = walk.nextNode())) last = source;
              if (last) last.after(made.h);
              made.h.style.setProperty("display", "inline", "important");
              made.h.style.setProperty("min-width", "0", "important");
              made.h.style.setProperty("flex", "0 1 auto", "important");
              made.h.style.setProperty("pointer-events", "none", "important");
              output.style.cssText =
                "display:inline;border:0;padding:0;margin:0 0 0 .45em;font:inherit;color:inherit;line-height:inherit;white-space:nowrap;";
            }
            made.root.append(output);
            s.phase = "done";
            fitCompact(s);
          }
        } catch (e) {
          if (ticket !== epoch) continue;
          for (const { s, version } of batch)
            if (version === s.version) s.phase = "error";
          lastError = e.message;
          running = false;
        }
        if (ticket === epoch) updateStatus();
      }
    } finally {
      working--;
      if (queue.length && active && running) pump();
    }
  }
  function startPage() {
    active = true;
    lastError = "";
    autoObserver?.disconnect();
    clearTimeout(autoTimer);
    autoTimer = null;
    running = engine !== "local" || !!session;
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            const s = states.get(e.target);
            if (s?.phase === "idle") enqueue(s);
          }
        pump();
      },
      { rootMargin: "900px 0px 1400px 0px" },
    );
    mutations = new MutationObserver((records) => {
      const relevant = records.filter((r) => {
        if (r.type === "attributes" && r.attributeName === "placeholder") {
          const s = states.get(r.target);
          if (
            s?.placeholder &&
            s.phase === "done" &&
            r.target.getAttribute("placeholder") === s.translation
          )
            return false;
        }
        if (r.target.nodeType === 1 && r.target.closest(`[${OWN}]`))
          return false;
        if (r.type === "childList")
          return (
            [...r.addedNodes, ...r.removedNodes].some(
              (n) => !(n.nodeType === 1 && n.hasAttribute(OWN)),
            ) ||
            [...r.removedNodes].some((n) =>
              [...states.values()].some((s) => s.slot === n),
            )
          );
        return !r.target.parentElement?.closest(`[${OWN}]`);
      });
      if (relevant.length) {
        for (const r of relevant) {
          if (r.type === "attributes") {
            if (["aria-expanded", "aria-controls"].includes(r.attributeName))
              for (const id of (
                r.target.getAttribute("aria-controls") || ""
              ).split(/\s+/)) {
                const layer = document.getElementById(id);
                if (layer) dirtyRoots.add(layer);
              }
            if (r.attributeName === "title") localizeXDates(r.target);
            else dirtyRoots.add(r.target);
            continue;
          }
          if (r.type === "characterData")
            dirtyRoots.add(blockFor(r.target) || r.target.parentElement);
          else {
            dirtyRoots.add(
              r.target.nodeType === 1 ? r.target : r.target.parentElement,
            );
            for (const n of r.addedNodes)
              if (n.nodeType === 1) dirtyRoots.add(n);
          }
        }
        scheduleScan();
      }
    });
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "title",
        "hidden",
        "aria-hidden",
        "class",
        "style",
        "dir",
        "data-testid",
        "open",
        "inert",
        "role",
        "aria-modal",
        "popover",
        "data-state",
        "placeholder",
        "data-visibility-visible",
        "aria-expanded",
        "aria-controls",
      ],
    });
    scan();
    if (engine === "local" && !session)
      updateStatus("本地模式 · 点击按钮准备语言包后开始");
  }
  function scheduleScan(root) {
    if (!active) return;
    if (root) dirtyRoots.add(root);
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      const roots = [...dirtyRoots];
      dirtyRoots.clear();
      for (const root of roots)
        if (!roots.some((other) => other !== root && other?.contains(root)))
          scan(root);
    }, 120);
  }
  function layerChanged(event) {
    const target = event.target;
    if (target?.nodeType !== 1 || target.closest(`[${OWN}]`)) return;
    const root = target.matches(`details,${LAYER}`)
      ? target
      : target.closest(LAYER);
    if (!root) return;
    if (active) scheduleScan(root);
    else if (autoEnglish) watchAutoEnglish();
  }
  document.addEventListener("toggle", layerChanged, true);
  document.addEventListener("transitionend", layerChanged, true);
  document.addEventListener("animationend", layerChanged, true);
  window.addEventListener("resize", () => {
    if (active) for (const s of states.values()) fitCompact(s);
  });
  function restore(suppressAuto = true) {
    clearTimeout(selectionTimer);
    autoSuppressed = Boolean(suppressAuto);
    autoObserver?.disconnect();
    clearTimeout(autoTimer);
    autoTimer = null;
    if (active || selectionHost)
      chrome.runtime.sendMessage({ type: "CLEAR_CANCEL" }).catch(() => {});
    epoch++;
    active = false;
    running = false;
    queue = [];
    lastError = "";
    limited = 0;
    clearTimeout(scanTimer);
    observer?.disconnect();
    mutations?.disconnect();
    scanTimer = null;
    dirtyRoots.clear();
    for (const [el, v] of titles)
      if (el.getAttribute("title") === v.after) {
        if (v.before === null) el.removeAttribute("title");
        else el.setAttribute("title", v.before);
      }
    for (const [n, v] of tooltipTexts)
      if (n.textContent === v.after) n.textContent = v.before;
    titles.clear();
    tooltipTexts.clear();
    for (const s of states.values()) {
      s.slot?.remove();
      removeUiTitle(s);
      restorePlaceholder(s);
    }
    states.clear();
    updateStatus();
    selectionToken++;
    selectionHost?.remove();
    selectionHost = null;
    session?.destroy();
    session = null;
    sessionCreating = null;
  }
  function closeSelection(clearRange = false) {
    selectionToken++;
    selectionHost?.remove();
    selectionHost = null;
    if (clearRange) {
      selectionRange = null;
      selectionText = "";
    }
  }
  function positionSelection() {
    if (!selectionHost || !selectionRange) return;
    if (!selectionRange.commonAncestorContainer.isConnected) {
      closeSelection(true);
      return;
    }
    const rects = [...selectionRange.getClientRects()];
    const r = rects.at(-1);
    if (!r || r.bottom < 0 || r.top > innerHeight) {
      selectionHost.style.setProperty("display", "none", "important");
      return;
    }
    selectionHost.style.setProperty("display", "block", "important");
    const box = selectionHost.getBoundingClientRect();
    const left = Math.max(12, Math.min(innerWidth - box.width - 12, r.left));
    const below = r.bottom + 7;
    const top =
      below + box.height <= innerHeight - 12
        ? below
        : Math.max(12, r.top - box.height - 7);
    selectionHost.style.setProperty("left", `${left}px`, "important");
    selectionHost.style.setProperty("top", `${top}px`, "important");
  }
  function captureSelection() {
    const selected = window.getSelection();
    const text = normal(selected?.toString() || "");
    if (!selected?.rangeCount || selected.isCollapsed || !text) {
      closeSelection(true);
      return null;
    }
    const range = selected.getRangeAt(0);
    const container =
      range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    if (!container || container.closest(SKIP) || !readableElement(container))
      return null;
    selectionRange = range.cloneRange();
    selectionText = text;
    return { text, range: selectionRange };
  }
  function scheduleSelection() {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
      const captured = captureSelection();
      if (
        selectionAuto &&
        captured &&
        translatable(
          captured.text,
          captured.range.commonAncestorContainer.nodeType === 1
            ? captured.range.commonAncestorContainer
            : captured.range.commonAncestorContainer.parentElement,
          false,
        )
      )
        showSelection(captured.text, captured.range);
    }, 160);
  }
  function showSelection(text, range) {
    if (!range) {
      const captured = captureSelection();
      range =
        captured?.text === text
          ? captured.range
          : selectionText === text
            ? selectionRange
            : null;
    }
    if (!range) return false;
    closeSelection();
    selectionRange = range.cloneRange();
    selectionText = text;
    const token = selectionToken;
    const made = host(document.body, true);
    selectionHost = made.h;
    const sheet = document.createElement("style");
    sheet.textContent = `.selection-popover{display:flex;align-items:flex-start;gap:8px;background:#f8fcf9;border:1px solid #bcd7c6;border-radius:9px;box-shadow:0 5px 20px #143d3128;padding:9px 10px;max-width:min(360px,calc(100vw - 24px));min-width:75px;color:#234f36;font:14px/1.7 "Segoe UI","Microsoft YaHei",sans-serif}.selection-result{white-space:pre-wrap;overflow-wrap:anywhere;max-height:38vh;overflow:auto;min-width:35px}.selection-close{border:0;padding:0 3px;line-height:1.7;color:#718579;background:transparent}.selection-run{padding:2px 6px;font-size:11px;margin-top:4px}`;
    const box = document.createElement("div");
    box.className = "selection-popover";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "选中文字的翻译");
    const content = document.createElement("div");
    const result = document.createElement("div");
    result.className = "selection-result";
    result.setAttribute("role", "status");
    result.textContent = "正在翻译…";
    const close = button("×", () => closeSelection());
    close.className = "selection-close";
    close.setAttribute("aria-label", "关闭选词翻译");
    const run = button(
      engine === "local" ? "开始本地翻译" : "重试",
      async () => {
        const element =
          range.commonAncestorContainer.nodeType === 1
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement;
        if (!translatable(text, element, false)) {
          result.textContent = "选中内容已是中文或没有可翻译文字。";
          run.hidden = true;
          positionSelection();
          return;
        }
        run.disabled = true;
        run.hidden = true;
        result.className = "selection-result";
        result.textContent = "正在翻译…";
        positionSelection();
        try {
          if (text.length > 30000)
            throw new Error("选中文字过长，请分段翻译。");
          if (engine === "local") await ensureLocal();
          const value = await translate(text, true);
          if (token !== selectionToken) return;
          result.textContent = value;
          positionSelection();
        } catch (e) {
          if (token === selectionToken) {
            result.className = "selection-result error";
            result.textContent = e.message;
            run.hidden = false;
            positionSelection();
          }
        } finally {
          run.disabled = false;
        }
      },
    );
    run.className = "selection-run";
    content.append(result, run);
    box.append(content, close);
    made.root.append(sheet, box);
    box.addEventListener("pointerdown", (e) => e.preventDefault());
    positionSelection();
    if (engine === "local" && !session) {
      result.textContent = "点击在本机翻译";
      positionSelection();
    } else run.click();
    return true;
  }
  document.addEventListener("pointerup", (e) => {
    if (e.composedPath().some((n) => n?.nodeType === 1 && n.hasAttribute(OWN)))
      return;
    scheduleSelection();
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "Shift" || e.shiftKey) scheduleSelection();
  });
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (selectionHost && !e.composedPath().includes(selectionHost))
        closeSelection();
    },
    true,
  );
  document.addEventListener("scroll", positionSelection, true);
  window.addEventListener("resize", positionSelection);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSelection();
  });
  chrome.runtime.onMessage.addListener((m, sender, reply) => {
    if (sender.id !== chrome.runtime.id || m?.type !== "CLEAR_ACTION") return;
    if (m.command === "restore") {
      restore();
      reply({ ok: true, message: "已恢复原网页。" });
      return;
    }
    const selected =
      m.command === "selection"
        ? normal(
            typeof m.text === "string"
              ? m.text
              : window.getSelection()?.toString() || selectionText || "",
          )
        : "";
    if (m.command === "selection" && (!selected || selected.length > 30000)) {
      reply({
        ok: false,
        error: selected
          ? "选中文字过长，请分段翻译（每次最多 30000 字符）。"
          : "请先在网页中选中文字，再点击翻译或使用右键菜单。",
      });
      return;
    }
    setEngine(m.engine);
    if (m.command === "page") {
      if (!active) startPage();
      reply({
        ok: true,
        message:
          engine === "local" && !session
            ? "请悬停悬浮球，再点击“开始本地翻译”。"
            : "已开启双语翻译，滚动网页时继续。",
      });
    } else if (m.command === "selection") {
      const shown = showSelection(selected);
      reply(
        shown
          ? { ok: true, message: "译文已显示在选中文字下方。" }
          : { ok: false, error: "请先在网页中选中文字。" },
      );
    }
  });
  window.addEventListener("pagehide", restore);
  if (isX)
    document.addEventListener(
      "pointerover",
      (e) => {
        if (active)
          localizeXDates(
            e.target.closest?.('a,time,[title],[role="tooltip"]') || e.target,
          );
      },
      true,
    );
  if (document.body) createBall();
})();

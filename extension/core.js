export function normalizeText(text) {
  return text.replace(/\s+/gu, " ").trim();
}

// 按句子边界拆分过长段落，避免截断正文或超出请求长度。
export function splitText(text, max = 1500) {
  const parts = [];
  let rest = normalizeText(text);
  while (rest.length > max) {
    let at = -1;
    const prefix = rest.slice(0, max);
    for (const m of prefix.matchAll(/[.!?;。！？；]\s+/gu))
      at = m.index + m[0].length;
    if (at < max / 3) at = prefix.lastIndexOf(" ");
    if (at < max / 3) at = max;
    if (/[\uD800-\uDBFF]/u.test(rest[at - 1])) at--;
    parts.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export function parseTranslation(data) {
  if (
    !Array.isArray(data) ||
    !Array.isArray(data[0]) ||
    !data[0].length ||
    !data[0].every((s) => Array.isArray(s) && typeof s[0] === "string")
  ) {
    throw new Error("翻译服务返回了无法识别的内容，请稍后重试。");
  }
  const text = data[0]
    .map((s) => s[0])
    .join("")
    .trim();
  if (!text) throw new Error("翻译服务没有返回译文，请重试。");
  return text;
}

export function parseProvider(data, provider) {
  if (provider === "google") return parseTranslation(data);
  if (provider === "tencent" && data?.header?.ret_code === "error") {
    const error = new Error(
      "腾讯未能识别或暂不支持这段原文，请选择微软或 Google 翻译。",
    );
    error.retryable = false;
    throw error;
  }
  const items =
    provider === "microsoft"
      ? data?.[0]?.translations?.map((t) => t.text)
      : data?.auto_translation;
  if (
    !Array.isArray(items) ||
    !items.length ||
    !items.every((t) => typeof t === "string" && t.trim())
  )
    throw new Error("翻译服务返回格式异常，请重试或选择其他翻译方式。");
  return items.join(" ");
}

function makeRequest(provider, texts) {
  let url,
    request = {};
  if (provider === "microsoft") {
    url = new URL(
      "https://edge.microsoft.com/translate/translatetext?to=zh-Hans&isEnterpriseClient=false",
    );
    request = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(texts),
    };
  } else if (provider === "tencent") {
    url = new URL("https://transmart.qq.com/api/imt");
    request = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        header: {
          fn: "auto_translation",
          client_key: "browser-chrome-" + crypto.randomUUID(),
        },
        type: "plain",
        model_category: "normal",
        source: { text_list: texts, lang: "auto" },
        target: { lang: "zh" },
      }),
    };
  } else if (provider === "google") {
    url = new URL("https://translate.googleapis.com/translate_a/single");
    url.search = new URLSearchParams({
      client: "gtx",
      sl: "auto",
      tl: "zh-CN",
      dt: "t",
      q: texts[0],
    });
  } else throw new Error("未知翻译方式。");
  return { url, request };
}

async function requestJson(
  url,
  request,
  parse,
  {
    signal,
    fetcher = fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  },
) {
  for (let attempt = 0; ; attempt++) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 12000);
    const cancel = () => abort.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      if (signal?.aborted) throw new Error("翻译已取消。");
      const res = await fetcher(url.href, {
        ...request,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: abort.signal,
      });
      if (res.status === 429 || res.status === 403) {
        const e = new Error(
          res.status === 429
            ? "免费服务暂时限流，请稍后点击重试，或改用本地翻译。"
            : "在线服务拒绝了请求，请检查网络或改用本地翻译。",
        );
        e.permanent = true;
        throw e;
      }
      if (!res.ok) {
        const e = new Error(`翻译服务暂时不可用（HTTP ${res.status}）。`);
        e.permanent = res.status < 500;
        throw e;
      }
      let data;
      try {
        data = await res.json();
      } catch {
        const e = new Error("翻译服务返回格式异常，请稍后重试。");
        e.permanent = true;
        throw e;
      }
      return parse(data);
    } catch (error) {
      if (signal?.aborted) throw new Error("翻译已取消。");
      if (error.permanent || error.retryable === false || attempt >= 1) {
        if (error.name === "AbortError")
          throw new Error("翻译请求超时，请检查网络后重试。");
        if (error instanceof TypeError)
          throw new Error("无法连接翻译服务，请检查网络，或改用本地翻译。");
        throw error;
      }
      await sleep(900);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
  }
}

export async function translateOnline(text, options = {}) {
  const provider = options.provider || "google";
  const output = [];
  for (const part of splitText(text)) {
    if (options.signal?.aborted) throw new Error("翻译已取消。");
    const { url, request } = makeRequest(provider, [part]);
    output.push(
      await requestJson(
        url,
        request,
        (data) => parseProvider(data, provider),
        options,
      ),
    );
  }
  return output.join(" ");
}

export async function translateBatchOnline(texts, options = {}) {
  const provider = options.provider || "google";
  if (provider === "google" && texts.length > 1) {
    const url = new URL("https://translate.googleapis.com/translate_a/t");
    url.search = new URLSearchParams({
      client: "dict-chrome-ex",
      sl: "auto",
      tl: "zh-CN",
    });
    for (const text of texts) url.searchParams.append("q", text);
    // 使用服务原生多q顺序数组，过长URL分组处理，避免分隔符或截断正文。
    if (url.href.length > 6500) {
      const at = Math.max(1, Math.floor(texts.length / 2));
      return [
        ...(await translateBatchOnline(texts.slice(0, at), options)),
        ...(await translateBatchOnline(texts.slice(at), options)),
      ];
    }
    return requestJson(
      url,
      {},
      (data) => {
        if (
          !Array.isArray(data) ||
          data.length !== texts.length ||
          data.some(
            (t) =>
              !(
                (typeof t === "string" && t.trim()) ||
                (Array.isArray(t) &&
                  t.length === 2 &&
                  typeof t[0] === "string" &&
                  t[0].trim() &&
                  typeof t[1] === "string" &&
                  /^[a-z]{2,3}(?:-[a-zA-Z0-9]+)*$/.test(t[1]))
              ),
          )
        )
          throw new Error("Google批量译文数量或格式异常，请重试。");
        return data.map((t) => (Array.isArray(t) ? t[0] : t));
      },
      options,
    );
  }
  // 仅使用支持列表的原生接口，逐条返回与原段落对应，不用分隔符猜映射。
  if (
    provider === "google" ||
    // 腾讯auto对整批只返回一个src_lang，混合语言必须逐段请求，避免套错源语言。
    provider === "tencent" ||
    texts.length === 1 ||
    texts.some((t) => t.length > 1500)
  ) {
    const result = [];
    for (const text of texts) result.push(await translateOnline(text, options));
    return result;
  }
  const { url, request } = makeRequest(provider, texts);
  return requestJson(
    url,
    request,
    (data) => {
      const values =
        provider === "microsoft"
          ? Array.isArray(data) &&
            data.map((item) => parseProvider([item], provider))
          : data?.auto_translation;
      if (
        !Array.isArray(values) ||
        values.length !== texts.length ||
        values.some((t) => typeof t !== "string" || !t.trim())
      )
        throw new Error("批量译文数量或格式异常，请重试。");
      return values;
    },
    options,
  );
}

(() => {
  const month = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  // 只重排原提示中已有的日期/时钟字段，不重新解析为另一时区。
  globalThis.clearTranslateDate = (value) => {
    if (typeof value !== "string" || value.length > 250) return null;
    let s = value.trim();
    const date =
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,)?\s+(\d{4})\b/i.exec(
        s,
      );
    if (!date) return null;
    const m = month[date[1].slice(0, 3).toLowerCase()],
      day = Number(date[2]),
      year = Number(date[3]);
    const check = new Date(Date.UTC(year, m - 1, day));
    if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== day)
      return null;
    s = s.replace(date[0], `${year}年${m}月${day}日`);
    s = s.replace(
      /\b(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM)\b/gi,
      (_, time, period) =>
        `${period.toUpperCase() === "AM" ? "上午" : "下午"}${time}`,
    );
    s = s.replace(
      /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi,
      (word) =>
        ({
          monday: "星期一",
          tuesday: "星期二",
          wednesday: "星期三",
          thursday: "星期四",
          friday: "星期五",
          saturday: "星期六",
          sunday: "星期日",
        })[word.toLowerCase()],
    );
    return s;
  };
})();

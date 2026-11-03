(() => {
  function counts(text) {
    const letters = (text.match(/\p{L}/gu) || []).length;
    const han = (text.match(/\p{Script=Han}/gu) || []).length;
    const kana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);
    const hangul = /\p{Script=Hangul}/u.test(text);
    return { letters, han, kana, hangul };
  }
  function shouldTranslate(text, hint = "", englishOnly = false) {
    const { letters, han, kana, hangul } = counts(text);
    if (letters < 2) return false;
    const language = hint.toLowerCase().replace(/_/g, "-").split("-")[0];
    if (englishOnly) {
      if (language && !["en", "zh"].includes(language)) return false;
      return (
        /^[\p{Script=Latin}\p{Script=Han}\p{Script=Common}\p{Script=Inherited}]*$/u.test(
          text,
        ) && (text.match(/[a-zA-Z]/g) || []).length > han
      );
    }
    if (kana || hangul || (han && ["ja", "ko"].includes(language))) return true;
    // 无语言线索的纯汉字短词无法与中文可靠区分；保留中文，交给上下文补充线索。
    return letters - han >= 2 && letters - han > han;
  }
  globalThis.clearTranslateLanguage = { counts, shouldTranslate };
})();

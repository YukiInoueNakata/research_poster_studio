// Minimal i18n: a language context + `t(key, vars?)` lookup with Japanese
// fallback. Language is persisted to localStorage ("rps-lang") like recent
// projects. Components call `const { t, lang, setLang } = useLang()`.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { lang_jp } from "./lang_jp";
import { lang_en } from "./lang_en";

export type Lang = "ja" | "en";

const DICTS: Record<Lang, Record<string, string>> = { ja: lang_jp, en: lang_en };
const STORAGE_KEY = "rps-lang";

export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFunc;
}

const Ctx = createContext<LangCtx | null>(null);

function readStored(): Lang {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "ja" || s === "en") return s;
  } catch {
    // ignore
  }
  return "ja";
}

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? lang_jp[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}

// Module-level current language for non-React contexts (e.g. lib/columns.ts).
// Kept in sync by LangProvider; components should prefer useLang() for
// reactivity. Functions that read this are called during the render of
// components that DO re-render on language change, so results stay current.
let currentLang: Lang = readStored();
export function tStatic(key: string, vars?: Record<string, string | number>): string {
  return translate(currentLang, key, vars);
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStored);
  const setLang = (l: Lang) => {
    setLangState(l);
    currentLang = l;
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  };
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const t: TFunc = (key, vars) => translate(lang, key, vars);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLang must be used within a LangProvider");
  return c;
}

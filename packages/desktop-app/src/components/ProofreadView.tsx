// 校正モード — 1 カラムの通読ビュー．ポスター全文を読み順に並べ，その場で
// 編集できる．上部に表記ゆれ簡易チェックの結果を出し，項目へジャンプできる．

import { useEffect, useMemo, useRef } from "react";
import type { AlnumKind, PosterProject, ProofItem, ProofTarget, WidthTarget } from "@rps/core";
import { proofItems, checkTextConsistency } from "@rps/core";
import { useLang } from "../i18n";

interface Props {
  project: PosterProject;
  onEdit: (target: ProofTarget, text: string) => void;
  /** 英字 / 数字の全角・半角を全文で統一する */
  onUnify: (kind: AlnumKind, target: WidthTarget) => void;
}

/** warning code -> どの種別の統一ボタンを出すか */
const UNIFY_KIND: Record<string, AlnumKind | undefined> = {
  "alpha-width": "alpha",
  "digit-width": "digit",
};

/** Auto-growing textarea (height follows content). */
function GrowingTextarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      style={{ resize: "none", overflow: "hidden", lineHeight: 1.6 }}
    />
  );
}

export default function ProofreadView({ project, onEdit, onUnify }: Props) {
  const { t } = useLang();
  const items: ProofItem[] = useMemo(
    () => proofItems(project.doc, project.content),
    [project.doc, project.content],
  );
  const warnings = useMemo(() => checkTextConsistency(items), [items]);
  const labelById = useMemo(
    () => new Map(items.map((it) => [it.id, it.label])),
    [items],
  );

  const jump = (id: string) => {
    document
      .getElementById(`proof-item-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="proofread">
      <div className="proof-inner">
        <div className="proof-head">
          <span className="legend">{t("proof.title")}</span>
          <span className="hint" style={{ marginTop: 0 }}>
            {t("proof.intro")}
          </span>
        </div>

        {warnings.length > 0 ? (
          <div className="proof-warnings">
            <div className="legend">{t("proof.check_legend")}</div>
            {warnings.map((w) => (
              <div key={w.code} className="proof-warning">
                <div>WARN: {w.message}</div>
                {UNIFY_KIND[w.code] ? (
                  <div className="proof-warn-links">
                    <button
                      className="primary"
                      onClick={() => onUnify(UNIFY_KIND[w.code]!, "half")}
                      title={t("proof.unify_half_title")}
                    >
                      {t("proof.unify_half")}
                    </button>
                    <button
                      className="primary"
                      onClick={() => onUnify(UNIFY_KIND[w.code]!, "full")}
                      title={t("proof.unify_full_title")}
                    >
                      {t("proof.unify_full")}
                    </button>
                  </div>
                ) : null}
                <div className="proof-warn-links">
                  {w.itemIds.map((id) => (
                    <button key={id} onClick={() => jump(id)} title={t("proof.jump")}>
                      {labelById.get(id) ?? id}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="proof-warnings ok">
            <div className="legend">{t("proof.check_legend")}</div>
            <div className="hint" style={{ marginTop: 0 }}>
              {t("proof.ok_message")}
            </div>
          </div>
        )}

        {items.map((it) => (
          <div key={it.id} id={`proof-item-${it.id}`} className="field proof-item">
            <label>{it.label}</label>
            {it.multiline ? (
              <GrowingTextarea value={it.text} onChange={(v) => onEdit(it.target, v)} />
            ) : (
              <input
                type="text"
                value={it.text}
                spellCheck={false}
                onChange={(e) => onEdit(it.target, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

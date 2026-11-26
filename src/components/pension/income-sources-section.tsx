"use client";

import { useState } from "react";
import type { IncomeSourceRow } from "@/lib/pension-data";
import {
  FAMILY_MEMBER_LABELS,
  INCOME_SOURCE_LABELS,
  type FamilyMember,
  type IncomeSourceType,
} from "@/lib/pension-planning";
import { formatFullKRW } from "@/lib/utils";
import { Field, SectionCard, inputClass, parseNumberInput, primaryButtonClass, secondaryButtonClass, sendJson } from "./ui";

type FormState = {
  member: FamilyMember;
  sourceType: IncomeSourceType;
  label: string;
  monthlyAmount: string;
  startAge: string;
  endAge: string;
};

const EMPTY_FORM: FormState = {
  member: "self",
  sourceType: "national_pension",
  label: "",
  monthlyAmount: "",
  startAge: "65",
  endAge: "",
};

interface Props {
  sources: IncomeSourceRow[];
  onChange: (sources: IncomeSourceRow[]) => void;
}

export function IncomeSourcesSection({ sources, onChange }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const monthlyAmount = parseNumberInput(form.monthlyAmount);
    const startAge = parseNumberInput(form.startAge);
    const endAge = parseNumberInput(form.endAge);
    const body = {
      member: form.member,
      sourceType: form.sourceType,
      label: form.label,
      monthlyAmount,
      startAge,
      endAge,
    };
    setIsSaving(true);
    setError("");
    try {
      if (editingId) {
        const data = await sendJson<{ source: IncomeSourceRow }>(`/api/pension/income-sources/${editingId}`, "PATCH", body);
        onChange(sources.map((s) => (s.id === editingId ? data.source : s)));
      } else {
        const data = await sendJson<{ source: IncomeSourceRow }>("/api/pension/income-sources", "POST", body);
        onChange([...sources, data.source]);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const edit = (source: IncomeSourceRow) => {
    setEditingId(source.id);
    setForm({
      member: source.member,
      sourceType: source.source_type,
      label: source.label ?? "",
      monthlyAmount: String(source.monthly_amount),
      startAge: String(source.start_age),
      endAge: source.end_age === null ? "" : String(source.end_age),
    });
  };

  const remove = async (id: string) => {
    if (!confirm("이 항목을 삭제할까요?")) return;
    try {
      await sendJson(`/api/pension/income-sources/${id}`, "DELETE");
      onChange(sources.filter((s) => s.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <SectionCard
      title="국민연금·퇴직연금·연금보험"
      description={
        <>
          국민연금공단 &lsquo;내 연금 알아보기&rsquo;, 금융감독원 통합연금포털 조회값을 옮겨 적으세요.{" "}
          <a href="https://www.nps.or.kr" target="_blank" rel="noreferrer" className="text-indigo-500 underline">
            국민연금공단
          </a>{" "}
          ·{" "}
          <a href="https://100lifeplan.fss.or.kr" target="_blank" rel="noreferrer" className="text-indigo-500 underline">
            통합연금포털
          </a>
          <span className="block mt-0.5">
            앱에 등록한 DC·IRP·연금저축 계좌는 평가액으로 따로 계산하므로 여기에 중복해 적지 마세요.
          </span>
        </>
      }
    >
      {(["self", "spouse"] as FamilyMember[]).map((member) => {
        const items = sources.filter((s) => s.member === member);
        return (
          <div key={member} className="space-y-1">
            <p className="text-xs font-semibold text-zinc-500">{FAMILY_MEMBER_LABELS[member]}</p>
            {items.length === 0 ? (
              <p className="text-xs text-zinc-400">입력한 항목이 없습니다.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <p className="text-sm font-medium">
                        {INCOME_SOURCE_LABELS[s.source_type]}
                        {s.label && <span className="text-zinc-400"> · {s.label}</span>}
                      </p>
                      <p className="text-xs text-zinc-400">
                        월 {formatFullKRW(s.monthly_amount)} · {s.start_age}세부터
                        {s.end_age === null ? " 종신" : ` ${s.end_age}세까지`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => edit(s)} className={secondaryButtonClass}>
                        수정
                      </button>
                      <button onClick={() => remove(s.id)} className={secondaryButtonClass}>
                        삭제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="가족 구성원">
          <select value={form.member} onChange={(e) => set("member", e.target.value as FamilyMember)} className={inputClass}>
            <option value="self">본인</option>
            <option value="spouse">배우자</option>
          </select>
        </Field>
        <Field label="종류">
          <select value={form.sourceType} onChange={(e) => set("sourceType", e.target.value as IncomeSourceType)} className={inputClass}>
            {(Object.keys(INCOME_SOURCE_LABELS) as IncomeSourceType[]).map((t) => (
              <option key={t} value={t}>
                {INCOME_SOURCE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="메모(선택)">
          <input value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="예: 회사 DB" className={inputClass} />
        </Field>
        <Field label="예상 월 수령액(원, 세전)">
          <input inputMode="numeric" value={form.monthlyAmount} onChange={(e) => set("monthlyAmount", e.target.value)} className={inputClass} />
        </Field>
        <Field label="수령 개시 나이">
          <input inputMode="numeric" value={form.startAge} onChange={(e) => set("startAge", e.target.value)} className={inputClass} />
        </Field>
        <Field label="종료 나이(비우면 종신)">
          <input inputMode="numeric" value={form.endAge} onChange={(e) => set("endAge", e.target.value)} className={inputClass} />
        </Field>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={isSaving || !form.monthlyAmount} className={primaryButtonClass}>
          {isSaving ? "저장 중..." : editingId ? "수정 저장" : "항목 추가"}
        </button>
        {editingId && (
          <button
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY_FORM);
            }}
            className={secondaryButtonClass}
          >
            취소
          </button>
        )}
      </div>
    </SectionCard>
  );
}

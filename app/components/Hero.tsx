"use client";

import { type FormEvent, useRef, useState } from "react";
import type { OcrResult } from "../lib/types";
import { normalizeCertificateQuery } from "../lib/search-ranking";

type Suggestion = { name: string; slug: string; count: number };

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: (e: FormEvent) => void;
  onRunExample: (value: string) => void;
  searchHistory: string[];
  onClearHistory: () => void;
  imagePreview: string;
  ocrStatus: string;
  ocrResult: OcrResult | null;
  onChooseImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUseSampleImage: () => void;
  onOcrCompanyChange: (company: string) => void;
  onOcrCodeChange: (code: string) => void;
  onSearchRecognized: () => void;
};

export default function Hero({
  query,
  onQueryChange,
  onSearch,
  onRunExample,
  searchHistory,
  onClearHistory,
  imagePreview,
  ocrStatus,
  ocrResult,
  onChooseImage,
  onUseSampleImage,
  onOcrCompanyChange,
  onOcrCodeChange,
  onSearchRecognized,
}: Props) {
  const examples = ["2024年30克熊猫金币", "袁大头三年", "8181356-116"];
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function handleInputChange(value: string) {
    onQueryChange(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    // A year such as “2024年” is a coin keyword, not a certificate number.
    const certificate = normalizeCertificateQuery(value);
    if (certificate.isLikelyCertificate && /^(?:NGC|PCGS)?\s*[\d\s-]+$/i.test(value.trim())) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await fetch(`/api/suggest?q=${encodeURIComponent(value.trim())}`);
        if (resp.ok) {
          const data = await resp.json() as { suggestions: Suggestion[] };
          setSuggestions(data.suggestions ?? []);
          setShowSuggestions((data.suggestions ?? []).length > 0);
        }
      } catch {
        setSuggestions([]);
      }
    }, 200);
  }

  function selectSuggestion(name: string) {
    onQueryChange(name);
    setSuggestions([]);
    setShowSuggestions(false);
    // Auto-submit
    onRunExample(name);
  }

  return (
    <section className="hero" id="top">
      <div className="eyebrow">
        <span /> NGC · PCGS 评级币交易查询
      </div>
      <h1>
        查行情<span className="hero-dot">·</span>核盒号
      </h1>
      <p className="hero-copy">
        输入钱币名称查看成交记录，或用 NGC / PCGS 盒号精准追踪单枚币的交易历史
      </p>

      <form className="searchbox" id="search" onSubmit={onSearch} style={{ position: "relative" }}>
        <span className="search-icon" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          onBlur={() => { setTimeout(() => setShowSuggestions(false), 150); }}
          aria-label="搜索钱币名称或评级盒号"
          placeholder="搜索钱币名称，或输入 NGC / PCGS 盒号…"
          autoComplete="off"
        />
        <button type="submit">查询</button>

        {showSuggestions && suggestions.length > 0 && (
          <ul className="suggest-dropdown" style={suggestDropdownStyle}>
            {suggestions.map((s) => (
              <li
                key={s.slug}
                onMouseDown={() => selectSuggestion(s.name)}
                style={suggestItemStyle}
              >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}
                </span>
                <span style={{ fontSize: 10, color: "#98a2b3", flexShrink: 0 }}>
                  {s.count}条
                </span>
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="examples">
        <span>试试：</span>
        {examples.map((item) => (
          <button key={item} type="button" onClick={() => onRunExample(item)}>
            {item}
          </button>
        ))}
      </div>

      {searchHistory.length > 0 && (
        <div className="recent-searches">
          <span>最近</span>
          {searchHistory.map((item) => (
            <button key={item} type="button" onClick={() => onRunExample(item)}>
              {item}
            </button>
          ))}
          <button className="clear-history" type="button" onClick={onClearHistory}>
            清除
          </button>
        </div>
      )}

      <details className="image-search">
        <summary className="image-search-toggle">
          <span className="camera-icon" aria-hidden="true">📷</span>
          <span>拍照识别盒号</span>
          <span className="toggle-arrow">▾</span>
        </summary>
        <div className="image-search-body">
          <p className="image-search-hint">
            上传评级盒标签照片，自动识别 NGC / PCGS 盒号
          </p>
          <div className="image-actions">
            <button type="button" className="sample-button" onClick={onUseSampleImage}>
              使用示例图片
            </button>
            <label className="upload-button">
              上传图片
              <input type="file" accept="image/*" onChange={onChooseImage} />
            </label>
          </div>

          {(imagePreview || ocrStatus) && (
            <div className="ocr-panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {imagePreview && <img src={imagePreview} alt="待识别的评级盒照片预览" />}
              <div className="ocr-content">
                <span className="kicker">识别结果</span>
                <h3>{ocrStatus}</h3>
                {ocrResult && (
                  <>
                    <div className="ocr-confidence">
                      <span>文字识别可信度</span>
                      <b>{ocrResult.confidence}%</b>
                      <i style={{ width: `${ocrResult.confidence}%` }} />
                    </div>
                    <div className="ocr-fields">
                      <label>
                        <span>评级机构</span>
                        <select
                          value={ocrResult.company}
                          onChange={(event) => onOcrCompanyChange(event.target.value)}
                        >
                          <option>NGC</option>
                          <option>PCGS</option>
                          <option>待人工确认</option>
                        </select>
                      </label>
                      <label>
                        <span>盒号（请逐位核对）</span>
                        <input
                          value={ocrResult.code}
                          placeholder="例如 8616098-030"
                          inputMode="numeric"
                          onChange={(event) => onOcrCodeChange(event.target.value)}
                        />
                      </label>
                      <p>
                        <span>评级</span>
                        <b>{ocrResult.grade}</b>
                      </p>
                      <p>
                        <span>币种标签</span>
                        <b>{ocrResult.coin}</b>
                      </p>
                    </div>
                  </>
                )}
                {ocrResult?.code && (
                  <button type="button" onClick={onSearchRecognized}>
                    已核对，查询这个盒号
                  </button>
                )}
                <small className="ocr-warning">
                  图片识别可能看错数字；只有你确认后的盒号才会用于查询。
                </small>
              </div>
            </div>
          )}
        </div>
      </details>

      <div className="data-note">
        <span>✓</span> 可验证成交记录 · 跨平台聚合 · 持续更新
      </div>
    </section>
  );
}

const suggestDropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 40,
  right: 100,
  marginTop: 4,
  background: "#fff",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  boxShadow: "0 8px 24px rgba(0,0,0,.12)",
  zIndex: 50,
  listStyle: "none",
  padding: "4px 0",
  overflow: "hidden",
};

const suggestItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  cursor: "pointer",
  fontSize: 14,
  color: "#1f2937",
  borderBottom: "1px solid #f3f4f6",
  transition: "background .1s",
};

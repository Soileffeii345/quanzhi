"use client";

import Link from "next/link";
import type { RealRecord } from "../lib/types";

type RealUnitGroup = {
  title: string;
  unit: string;
  count: number;
  low: number;
  high: number;
  latest: number;
};

type Props = {
  submitted: string;
  realRecords: RealRecord[];
  realUnitGroups: RealUnitGroup[];
  realFetchedAt: string;
  realLoading: boolean;
  realError: string;
  onExport: () => void;
  onRetry: () => void;
  platformSearchUrl: (platform: string, term: string) => string;
};

export default function KeywordResults({
  submitted,
  realRecords,
  realUnitGroups,
  realFetchedAt,
  realLoading,
  realError,
  onExport,
  onRetry,
  platformSearchUrl,
}: Props) {
  return (
    <div className="real-results">
      <div className="section-heading">
        <div>
          <span className="kicker">历史成交 · 邮宝</span>
          <h2>{`"${submitted}"的成交记录`}</h2>
          <p>
            点击原始交易可以查看对应成交详情。
            {" "}
            <Link
              href={`/coin?name=${encodeURIComponent(submitted)}`}
              style={{ color: "#155eef", fontSize: 12, fontWeight: 600 }}
            >
              查看完整币种行情 →
            </Link>
          </p>
        </div>
        <div className="result-actions">
          {realRecords.length > 0 && (
            <button type="button" onClick={onExport}>
              导出记录
            </button>
          )}
          <span className="result-count">
            {realLoading ? "查询中" : `${realRecords.length} 条`}
          </span>
        </div>
      </div>

      {realLoading ? (
        <div style={{ border: "1px solid #e4e7ec", borderRadius: 12, overflow: "hidden" }}>
          {/* Skeleton header */}
          <div style={{ padding: "16px 20px", background: "#f9fafb", borderBottom: "1px solid #e4e7ec", display: "flex", gap: 8, alignItems: "center" }}>
            <div className="skeleton" style={{ width: 100, height: 14 }} />
            <div className="skeleton" style={{ width: 60, height: 14 }} />
          </div>
          {/* Skeleton rows */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 12, alignItems: "center" }}>
              <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 6 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: "70%", height: 13, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: "40%", height: 10 }} />
              </div>
              <div className="skeleton" style={{ width: 70, height: 16 }} />
              <div className="skeleton" style={{ width: 80, height: 16 }} />
            </div>
          ))}
        </div>
      ) : realError ? (
        <div className="real-empty">
          <b>暂时无法查询</b>
          <p>数据源暂不可用，请稍后重试</p>
          <button type="button" onClick={onRetry}>
            重新查询
          </button>
        </div>
      ) : realRecords.length === 0 ? (
        <div className="real-empty">
          <b>暂未找到相关成交</b>
          <p>试试减少关键词，或前往平台继续查找。</p>
          <a href={platformSearchUrl("邮宝", submitted)} target="_blank" rel="noreferrer">
            去邮宝查找 ↗
          </a>
        </div>
      ) : (
        <>
          <div className="real-source-bar">
            <span>
              <i /> 来源状态：实时公开页面
            </span>
            <span>
              抓取时间：
              {realFetchedAt
                ? new Date(realFetchedAt).toLocaleString("zh-CN")
                : "刚刚"}
            </span>
            <span>已排除交割失败记录</span>
          </div>

          <div className="unit-metrics">
            {realUnitGroups.map((group) => (
              <article key={`${group.title}-${group.unit}`}>
                <span>
                  {group.title} · 按{`"${group.unit}"`}计价
                </span>
                <strong>
                  ¥{group.latest.toLocaleString()}
                  <i>/{group.unit}</i>
                </strong>
                <p>
                  区间 ¥{group.low.toLocaleString()}—{group.high.toLocaleString()} · {group.count}
                  条
                </p>
              </article>
            ))}
          </div>

          <div className="table-wrap real-table">
            <table>
              <thead>
                <tr>
                  <th>平台与钱币</th>
                  <th>品相</th>
                  <th>成交时间</th>
                  <th>数量</th>
                  <th>成交单价</th>
                  <th>核验</th>
                </tr>
              </thead>
              <tbody>
                {realRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <span className="platform platform-youbao">邮</span>
                      <div>
                        <b>{record.title}</b>
                        <small>
                          邮宝 · <em>交割成功</em>
                        </small>
                      </div>
                    </td>
                    <td>
                      <span className="grade">{record.condition}</span>
                    </td>
                    <td>{record.completedAt}</td>
                    <td>{record.quantity}</td>
                    <td className="price-cell">
                      <b>
                        ¥{record.price.toLocaleString()}/{record.unit}
                      </b>
                      <small>平台公开成交单价</small>
                    </td>
                    <td>
                      <a href={record.url} target="_blank" rel="noreferrer">
                        原始交易 ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="method-note">
            <b>价格说明：</b>
            不同商品和不同计价单位（枚、卷、套、盒）分别展示，避免把不一样的商品价格混在一起。
          </div>
        </>
      )}
    </div>
  );
}

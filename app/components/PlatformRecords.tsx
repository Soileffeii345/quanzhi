"use client";

import Link from "next/link";
import type { PlatformRecord } from "../lib/types";

type Props = {
  submitted: string;
  platformRecords: PlatformRecord[];
  platformRecordsLoading: boolean;
  platformImageStatus: string;
};

export default function PlatformRecordsPanel({
  submitted,
  platformRecords,
  platformRecordsLoading,
  platformImageStatus,
}: Props) {
  return (
    <div className="priority-platforms">
      <div>
        <span className="kicker">更多平台</span>
        <h3>{`用"${submitted}"继续查询`}</h3>
      </div>

      {platformImageStatus && (
        <div className="image-scan-status">
          <span />
          {platformImageStatus}
        </div>
      )}

      {platformRecordsLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, margin: "0 0 18px" }}>
          {[1, 2].map((i) => (
            <div key={i} style={{ padding: 16, border: "1px solid #e4e7ec", borderRadius: 13, background: "#f9fafb" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div className="skeleton" style={{ width: 55, height: 20, borderRadius: 999 }} />
                <div className="skeleton" style={{ width: 40, height: 20 }} />
              </div>
              <div className="skeleton" style={{ width: "90%", height: 14, marginBottom: 10 }} />
              <div className="skeleton" style={{ width: "60%", height: 14, marginBottom: 12 }} />
              <div style={{ display: "flex", gap: 24 }}>
                <div className="skeleton" style={{ width: 80, height: 16 }} />
                <div className="skeleton" style={{ width: 60, height: 16 }} />
              </div>
            </div>
          ))}
        </div>
      ) : platformRecords.length > 0 ? (
        <div className="platform-records">
          {platformRecords.map((record) => (
            <article key={record.id}>
              <div>
                <span className={`record-match ${record.match}`}>
                  {record.match === "exact-box" ? "同一盒号" : "关键词相关"}
                </span>
                <b>{record.source}</b>
              </div>
              <h4>{record.title}</h4>
              <dl>
                <div>
                  <dt>{record.priceLabel}</dt>
                  <dd>¥{record.price.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>{record.timeLabel}</dt>
                  <dd>{record.time}</dd>
                </div>
              </dl>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {record.url ? (
                  <a href={record.url} target="_blank" rel="noreferrer">
                    查看商品详情 ↗
                  </a>
                ) : (
                  <span className="record-pending">{record.status}</span>
                )}
                {record.coinName && (
                  <Link
                    href={`/coin?name=${encodeURIComponent(record.coinName)}`}
                    style={{
                      color: "#155eef",
                      fontSize: 12,
                      textDecoration: "none",
                      padding: "3px 8px",
                      borderRadius: 5,
                      background: "#eff4ff",
                    }}
                  >
                    同款行情 →
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="platform-records-empty">
          暂未找到同时包含价格、时间和详情链接的公开记录。
        </div>
      )}

      <div className="priority-platform-links">
        <a
          href={`/api/platform?name=zhao&q=${encodeURIComponent(submitted)}`}
          target="_blank"
          rel="noreferrer"
        >
          <b>赵涌在线</b>
          <small>关键词搜索</small>
          <span>↗</span>
        </a>
        <a
          href={`/api/platform?name=yijin&q=${encodeURIComponent(submitted)}`}
          target="_blank"
          rel="noreferrer"
        >
          <b>易金在线</b>
          <small>关键词搜索</small>
          <span>↗</span>
        </a>
        <a
          href={`/api/platform?name=jinbiyunji&q=${encodeURIComponent(submitted)}`}
          target="_blank"
          rel="noreferrer"
        >
          <b>金币云集</b>
          <small>平台入口</small>
          <span>↗</span>
        </a>
        <a
          href={`/api/platform?name=maixiqi&q=${encodeURIComponent(submitted)}`}
          target="_blank"
          rel="noreferrer"
        >
          <b>麦稀奇</b>
          <small>拍品入口</small>
          <span>↗</span>
        </a>
      </div>
      <p>
        关键词搜索会携带当前内容；平台入口需在平台内再次搜索。只有完整盒号一致，才能确认是同一枚币。
      </p>
    </div>
  );
}

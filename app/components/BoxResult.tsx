"use client";

import Link from "next/link";
import type { BoxDatabaseRecord, CertInfo, RealRecord } from "../lib/types";

type Props = {
  boxAgency: string;
  boxCode: string;
  databaseNumericGrade: string;
  officialCertUrl: string;
  boxDatabaseRecords: BoxDatabaseRecord[];
  realRecords: RealRecord[];
  realFetchedAt: string;
  realLoading: boolean;
  realError: string;
  savedBoxes: string[];
  submitted: string;
  certInfo: CertInfo | null;
  sameModelRecords: RealRecord[];
  certMethodology: string;
  onToggleSaved: () => void;
  onExport: () => void;
  onRetry: () => void;
  platformSearchUrl: (platform: string, term: string) => string;
};

export default function BoxResult({
  boxAgency,
  boxCode,
  officialCertUrl,
  boxDatabaseRecords,
  realRecords,
  realFetchedAt,
  realLoading,
  realError,
  savedBoxes,
  certInfo,
  sameModelRecords,
  certMethodology,
  onToggleSaved,
  onExport,
  onRetry,
  platformSearchUrl,
}: Props) {
  const hasDbPrices = boxDatabaseRecords.some((r) => r.price !== null);
  const hasExactBoxMatch = hasDbPrices || realRecords.length > 0;
  const hasSameModelRecords = sameModelRecords.length > 0;
  const totalRecords = realRecords.length + sameModelRecords.length;

  return (
    <div className="box-result">
      {/* ---- Header ---- */}
      <div className="section-heading">
        <div>
          <span className="kicker">盒号查询结果</span>
          <h2>
            {boxAgency === "待确认"
              ? `盒号 ${boxCode}`
              : `${boxAgency} ${boxCode}`}
          </h2>
          <p>核对官方评级信息，查看这枚币的历史成交与同款行情。</p>
        </div>
        <div className="result-actions">
          <button type="button" onClick={onToggleSaved}>
            {savedBoxes.includes(boxCode) ? "★ 已收藏" : "☆ 收藏盒号"}
          </button>
          {totalRecords > 0 && (
            <button type="button" onClick={onExport}>
              导出记录
            </button>
          )}
          <span className="result-count">精确查询</span>
        </div>
      </div>

      {/* ---- Official certification card (always shown) ---- */}
      <div className="box-card official-cert-card">
        <div className="cert-seal">
          {certInfo?.ok ? certInfo.agency : boxAgency === "待确认" ? "?" : boxAgency}
        </div>
        <div className="box-main">
          <span className="status">
            {certInfo?.ok
              ? certInfo.source === "database"
                ? "数据库已收录"
                : "官方认证已获取"
              : "核对评级信息"}
          </span>
          <h3>{certInfo?.ok ? certInfo.coinName : boxCode}</h3>
          <p>
            {certInfo?.ok
              ? `${certInfo.grade ? certInfo.grade + " · " : ""}查看官方详情确认币种信息`
              : "点击下方链接打开 NGC/PCGS 官方页面，查看币种、年份、评级。"}
          </p>
        </div>
        <div className="box-sale">
          <span>第一步</span>
          <strong>核对评级信息</strong>
          <p>确认标签与实物一致</p>
        </div>
        {certInfo?.certUrl ? (
          <a
            className="outline-link"
            href={certInfo.certUrl}
            target="_blank"
            rel="noreferrer"
          >
            打开 {certInfo.agency} 官方详情 ↗
          </a>
        ) : officialCertUrl ? (
          <a
            className="outline-link"
            href={officialCertUrl}
            target="_blank"
            rel="noreferrer"
          >
            打开 {boxAgency} 官方详情 ↗
          </a>
        ) : (
          <div className="official-options">
            <a
              href="https://www.ngccoin.com/certlookup/"
              target="_blank"
              rel="noreferrer"
            >
              NGC 核验 ↗
            </a>
            <a href="https://cn.pcgs.com/cert" target="_blank" rel="noreferrer">
              PCGS 核验 ↗
            </a>
          </div>
        )}
      </div>

      {/* ---- Not in database hint ---- */}
      {certInfo && !certInfo.ok && (
        <div className="method-note" style={{ marginTop: -8, marginBottom: 16 }}>
          <b>💡 提示：</b>
          数据库尚未收录此盒号。点击上方 NGC/PCGS 官方链接查看币种名称后，
          回到首页用<strong>币名关键词</strong>（如「吉祥文化 30克」）搜索，即可查到同款币的各平台成交记录。
        </div>
      )}

      {/* ---- Database hit card (exact box match in local index) ---- */}
      {boxDatabaseRecords.length > 0 && (
        <div className="box-card">
          <div className="cert-seal">✓</div>
          <div className="box-main">
            <span className="status">盒号已收录</span>
            <h3>
              <Link
                href={`/coin?name=${encodeURIComponent(boxDatabaseRecords[0].coinName)}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {boxDatabaseRecords[0].coinName}
              </Link>
            </h3>
            <p>
              {boxDatabaseRecords[0].gradingCompany}{" "}
              {boxDatabaseRecords[0].grade} ·{" "}
              {boxDatabaseRecords[0].displayBoxCode}
            </p>
          </div>
          <div className="box-sale">
            <span>数据状态</span>
            <strong>
              {boxDatabaseRecords[0].price === null
                ? "身份已确认"
                : "成交已收录"}
            </strong>
            <p>
              {boxDatabaseRecords[0].price === null
                ? "暂无可核验成交详情，不展示猜测价格"
                : boxDatabaseRecords[0].platform}
            </p>
          </div>
        </div>
      )}

      {/* ---- Loading ---- */}
      {realLoading && (
        <div className="real-loading">
          <span />
          <b>正在查询这枚币的成交记录与同款行情</b>
          <p>请稍候，正在搜索多平台数据…</p>
        </div>
      )}

      {/* ---- Error ---- */}
      {realError && !hasDbPrices && !hasSameModelRecords && (
        <div className="real-empty">
          <b>暂时无法完成查询</b>
          <p>{realError}</p>
          <button type="button" onClick={onRetry}>
            重新查询
          </button>
        </div>
      )}

      {/* ---- Done loading, show results ---- */}
      {!realLoading && (
        <>
          {/* ---- Methodology note ---- */}
          {certMethodology && (
            <div className="method-note" style={{ marginBottom: 16 }}>
              <b>查询方式：</b>
              {certMethodology}
            </div>
          )}

          {/* ---- Exact box match: database records ---- */}
          {hasDbPrices && (
            <>
              <div className="box-trace-head">
                <div>
                  <span className="kicker">精确盒号成交</span>
                  <h3>同一枚币的已收录成交记录</h3>
                </div>
                <span>{boxDatabaseRecords.filter((r) => r.price !== null).length} 条</span>
              </div>
              <div className="real-source-bar">
                <span>
                  <i /> 泉知数据库已命中完整盒号
                </span>
                <span>其他平台在后台补充，不影响本条展示</span>
              </div>
              <div className="table-wrap real-table">
                <table>
                  <thead>
                    <tr>
                      <th>平台与商品</th>
                      <th>评级</th>
                      <th>成交时间</th>
                      <th>成交价</th>
                      <th>核验</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boxDatabaseRecords
                      .filter((r) => r.price !== null)
                      .map((record) => (
                        <tr key={`${record.platform}-${record.productCode}`}>
                          <td>
                            <span className={`platform ${record.platform === '赵涌在线' ? 'platform-zhao' : 'platform-yijin'}`}>{record.platform === '赵涌在线' ? '赵' : '易'}</span>
                            <div>
                              <b>{record.coinName}</b>
                              <small>
                                {record.platform} · 产品编号 {record.productCode}
                              </small>
                            </div>
                          </td>
                          <td>
                            <span className="grade">
                              {record.gradingCompany} {record.grade}
                            </span>
                          </td>
                          <td>{record.transactedAt}</td>
                          <td className="price-cell">
                            <b>¥{record.price!.toLocaleString()}</b>
                            {record.priceWithFee !== null && (
                              <small>
                                含佣价 ¥{record.priceWithFee.toLocaleString()}
                              </small>
                            )}
                          </td>
                          <td>
                            {record.detailUrl ? (
                              <a
                                href={record.detailUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                原始交易 ↗
                              </a>
                            ) : (
                              <span className="record-pending">
                                截图证据 · 原链接待复核
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ---- Same-model records (from cert lookup keyword search) ---- */}
          {hasSameModelRecords && (
            <>
              <div className="box-trace-head">
                <div>
                  <span className="kicker">同款币行情</span>
                  <h3>
                    {certInfo?.ok
                      ? `"${certInfo.coinName}" 的市场成交`
                      : "同品种市场成交"}
                  </h3>
                </div>
                <span>{sameModelRecords.length} 条</span>
              </div>
              <div className="real-source-bar">
                <span>
                  <i /> 同款币（同品种、同年份、同评级）的公开成交
                </span>
                <span>
                  非同一枚币，仅作市场行情参考
                </span>
              </div>
              <div className="table-wrap real-table">
                <table>
                  <thead>
                    <tr>
                      <th>平台与商品标题</th>
                      <th>品相</th>
                      <th>成交时间</th>
                      <th>成交价</th>
                      <th>核验</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sameModelRecords.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <span className="platform platform-youbao">邮</span>
                          <div>
                            <b>{record.title}</b>
                            <small>邮宝 · 同款币成交</small>
                          </div>
                        </td>
                        <td>{record.condition}</td>
                        <td>{record.completedAt}</td>
                        <td className="price-cell">
                          <b>
                            ¥{record.price.toLocaleString()}/{record.unit}
                          </b>
                        </td>
                        <td>
                          <a
                            href={record.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            原始交易 ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ---- Exact box match: 邮宝 real records ---- */}
          {!hasDbPrices && realRecords.length > 0 && (
            <>
              <div className="box-trace-head">
                <div>
                  <span className="kicker">精确盒号成交</span>
                  <h3>标题包含完整盒号的成交</h3>
                </div>
                <span>{realRecords.length} 条</span>
              </div>
              <div className="real-source-bar">
                <span>
                  <i /> 精确匹配：商品标题包含完整盒号
                </span>
                <span>
                  抓取时间：
                  {realFetchedAt
                    ? new Date(realFetchedAt).toLocaleString("zh-CN")
                    : "刚刚"}
                </span>
              </div>
              <div className="table-wrap real-table">
                <table>
                  <thead>
                    <tr>
                      <th>平台与原始标题</th>
                      <th>品相</th>
                      <th>成交时间</th>
                      <th>成交价</th>
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
                            <small>邮宝 · 完整盒号匹配</small>
                          </div>
                        </td>
                        <td>{record.condition}</td>
                        <td>{record.completedAt}</td>
                        <td className="price-cell">
                          <b>
                            ¥{record.price.toLocaleString()}/{record.unit}
                          </b>
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
            </>
          )}

          {/* ---- Empty: no exact match, no same-model ---- */}
          {!hasExactBoxMatch && !hasSameModelRecords && !realError && (
            <div className="real-empty box-no-sale">
              <b>暂未找到这枚评级币的公开信息</b>
              <p>
                {certInfo?.ok
                  ? `已通过${certInfo.agency}官方认证确认为"${certInfo.coinName}"，但各平台暂未找到相关成交。`
                  : "未能从官方认证获取币名，也未找到标题包含完整盒号的成交。"}
              </p>
              <div className="box-search-links">
                <a
                  href={platformSearchUrl("邮宝", boxCode)}
                  target="_blank"
                  rel="noreferrer"
                >
                  去邮宝查找 ↗
                </a>
                <a
                  href={platformSearchUrl("闲鱼", boxCode)}
                  target="_blank"
                  rel="noreferrer"
                >
                  去闲鱼查找 ↗
                </a>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---- Footer note ---- */}
      <div className="method-note">
        <b>如何确认是同一枚？</b>{" "}
        成交页面中的盒号需要与查询号码逐位一致。同款币仅展示同品种、同年份、同评级的公开成交，用于判断当前市场行情，不代表同一枚币。
      </div>
    </div>
  );
}

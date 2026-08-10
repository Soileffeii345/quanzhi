"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  activePage?: "search" | "coin" | "collection";
};

export default function TopBar({ activePage }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const linkStyle = (page: Props["activePage"]) => ({
    display: "flex",
    alignItems: "center",
    color: activePage === page ? "#155eef" : "#667085",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: activePage === page ? (700 as const) : (400 as const),
    position: "relative" as const,
  });

  const activeDot = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    background: "#155eef",
    borderRadius: "3px 3px 0 0",
  };

  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="泉知首页">
        <span className="brand-seal">泉</span>
        <span>泉知</span>
      </Link>

      {/* Desktop nav */}
      <nav aria-label="主导航">
        <Link href="/" style={linkStyle("search")}>
          查行情
          {activePage === "search" && <span style={activeDot} />}
        </Link>
        <Link href="/coin" style={linkStyle("coin")}>
          币种详情
          {activePage === "coin" && <span style={activeDot} />}
        </Link>
        <Link href="/collection" style={linkStyle("collection")}>
          我的收藏
          {activePage === "collection" && <span style={activeDot} />}
        </Link>
        <a
          href="/database.html"
          target="_blank"
          rel="noreferrer"
          style={{ marginLeft: 4, color: "#98a2b3", fontSize: 13, textDecoration: "none" }}
        >
          📊 数据库
        </a>
      </nav>

      {/* Mobile hamburger */}
      <button
        className="hamburger"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
        aria-expanded={menuOpen}
      >
        <span className={menuOpen ? "hamburger-line open" : "hamburger-line"} />
        <span className={menuOpen ? "hamburger-line open" : "hamburger-line"} />
        <span className={menuOpen ? "hamburger-line open" : "hamburger-line"} />
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="mobile-menu" onClick={() => setMenuOpen(false)}>
          <Link
            href="/"
            style={{
              ...mobileLink,
              color: activePage === "search" ? "#155eef" : "#101828",
              fontWeight: activePage === "search" ? 700 : 500,
            }}
          >
            查行情
          </Link>
          <Link
            href="/coin"
            style={{
              ...mobileLink,
              color: activePage === "coin" ? "#155eef" : "#101828",
              fontWeight: activePage === "coin" ? 700 : 500,
            }}
          >
            币种详情
          </Link>
          <Link
            href="/collection"
            style={{
              ...mobileLink,
              color: activePage === "collection" ? "#155eef" : "#101828",
              fontWeight: activePage === "collection" ? 700 : 500,
            }}
          >
            我的收藏
          </Link>
          <a
            href="/database.html"
            target="_blank"
            rel="noreferrer"
            style={{ ...mobileLink, color: "#667085", borderBottom: "none" }}
          >
            📊 数据库
          </a>
        </div>
      )}
    </header>
  );
}

const mobileLink: React.CSSProperties = {
  display: "block",
  padding: "14px 20px",
  fontSize: 15,
  textDecoration: "none",
  borderBottom: "1px solid #f3f4f6",
};

"use client";

import { useEffect, useState } from "react";
import { foods, geography, mealPlan, places, restaurants, tips, type Restaurant } from "./data";

const TABS = ["장소", "맛집", "먹거리", "지리", "꿀팁"] as const;
type Tab = (typeof TABS)[number];
const GROUPS: Restaurant["group"][] = ["해산물", "전통음식", "팔시 간식", "구랑위", "미쉐린"];

// 350200 = 샤먼 행정코드. callnative=1이면 고덕 앱이 설치돼 있을 때 앱으로 연다.
function amapUrl(keyword: string) {
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}&city=350200&callnative=1`;
}

// 다중뎬핑(大众点评) 검색. 도시 ID 15 = 샤먼. 실시간 평점·리뷰 확인용.
function dianpingUrl(keyword: string) {
  return `https://www.dianping.com/search/keyword/15/0_${encodeURIComponent(keyword)}`;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  }
}

function CopyRow({ label, text, onCopy }: { label: string; text: string; onCopy: (t: string) => void }) {
  return (
    <div className="copy-row">
      <div className="copy-text">
        <span className="copy-label">{label}</span>
        <span className="zh">{text}</span>
      </div>
      <button type="button" className="btn" onClick={() => onCopy(text)}>복사</button>
    </div>
  );
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("장소");
  const [group, setGroup] = useState<Restaurant["group"]>("해산물");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const onCopy = async (text: string) => {
    const ok = await copyText(text);
    setToast(ok ? "복사했어요 · 고덕 검색창에 붙여넣기" : "복사에 실패했어요. 길게 눌러 직접 복사해 주세요");
  };

  const selectTab = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">厦门 · XIAMEN</p>
        <h1>샤먼 여행 노트</h1>
        <p className="lead">
          대만 바로 맞은편, 바다와 섬의 도시. 숙소는 구랑위가 정면으로 보이는 <b>스위스 그랜드 샤먼</b>이에요.
        </p>
        <div className="facts">
          <span>📅 10.21 – 10.25</span>
          <span>🕐 한국 −1시간</span>
          <span>🌴 아열대 · 습함</span>
          <span>💳 알리페이/위챗</span>
        </div>
      </header>

      <nav className="tabs" aria-label="섹션">
        {TABS.map((t) => (
          <button key={t} type="button" className={t === tab ? "tab active" : "tab"} onClick={() => selectTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      {tab === "장소" && (
        <section className="list">
          <p className="hint">주소를 <b>복사</b>해서 고덕지도 검색창에 붙여넣거나, <b>고덕에서 열기</b>를 누르세요.</p>
          {places.map((p) => (
            <article key={p.id} className="card">
              <div className="card-head">
                <span className={`tag tag-${p.tag}`}>{p.tag}</span>
                <h2>{p.name}</h2>
                <p className="zh-title">{p.zh}</p>
                <p className="muted">{p.area}</p>
              </div>
              <p>{p.summary}</p>
              <ul className="tips">
                {p.tips.map((t) => <li key={t}>{t}</li>)}
              </ul>
              <CopyRow label={p.copy === p.zh ? "검색어" : "주소"} text={p.copy} onCopy={onCopy} />
              <a className="btn wide" href={amapUrl(p.copy)} target="_blank" rel="noreferrer">고덕에서 열기</a>
            </article>
          ))}
        </section>
      )}

      {tab === "맛집" && (
        <section className="list">
          <p className="hint">
            호텔 기준 중산로·팔시시장이 걸어서 10분 거리예요. <b>★</b>는 우선 추천. 가격은 후기 기준 참고값이에요.
            실시간 평점은 <b>평점 보기</b>(다중뎬핑)나 고덕에서 확인하세요.
          </p>
          <div className="chips">
            {GROUPS.map((g) => (
              <button key={g} type="button" className={g === group ? "chip active" : "chip"} onClick={() => setGroup(g)}>
                {g}
              </button>
            ))}
          </div>
          {group === "미쉐린" && (
            <p className="hint">2026 푸젠 미쉐린 가이드에 샤먼 식당 42곳이 실렸고, 그중 31곳이 가성비 식당인 빕 구르망이에요.</p>
          )}
          {restaurants.filter((r) => r.group === group).map((r) => (
            <article key={r.name} className="card">
              <div className="card-head">
                <h2>{r.star && <span className="star">★ </span>}{r.name}</h2>
                {r.zh && <p className="zh-title">{r.zh}</p>}
                {(r.distance || r.price) && (
                  <p className="muted">{[r.distance, r.price].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <p><b>대표</b> {r.menu}</p>
              {r.note && <p className="muted">{r.note}</p>}
              {r.zh && <CopyRow label="상호" text={r.zh} onCopy={onCopy} />}
              {r.addr && <CopyRow label="주소" text={r.addr} onCopy={onCopy} />}
              {(r.zh || r.addr) && (
                <div className="btn-pair">
                  <a className="btn wide" href={amapUrl(r.zh ?? r.addr!)} target="_blank" rel="noreferrer">고덕에서 열기</a>
                  {r.zh && (
                    <a className="btn wide dp" href={dianpingUrl(r.zh)} target="_blank" rel="noreferrer">평점 보기 · 点评</a>
                  )}
                </div>
              )}
            </article>
          ))}
          <div className="card">
            <h2>이렇게 먹는 걸 추천해요</h2>
            {mealPlan.map((m) => (
              <div key={m.q} className="qa">
                <h3>{m.q}</h3>
                <p>{m.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "먹거리" && (
        <section className="list">
          <p className="hint">맵지 않고 해산물 감칠맛이 강한 민남(闽南) 음식이에요. 중국어 이름을 가게에 보여주면 주문이 쉬워요.</p>
          {foods.map((f) => (
            <article key={f.zh} className="card food">
              <div className="food-head">
                <h2>{f.name}</h2>
                <button type="button" className="zh-big" onClick={() => onCopy(f.zh)}>{f.zh}</button>
              </div>
              <p>{f.desc}</p>
              {f.where && <p className="muted">📍 {f.where}</p>}
            </article>
          ))}
        </section>
      )}

      {tab === "지리" && (
        <section className="list">
          {geography.map((g) => (
            <article key={g.q} className="card qa">
              <h2>{g.q}</h2>
              <p>{g.a}</p>
            </article>
          ))}
        </section>
      )}

      {tab === "꿀팁" && (
        <section className="list">
          {tips.map((g) => (
            <article key={g.q} className="card qa">
              <h2>{g.q}</h2>
              <p>{g.a}</p>
            </article>
          ))}
        </section>
      )}

      <footer className="foot">예약 규칙·가격·영업시간은 바뀔 수 있어요. 출발 전 현지 앱에서 한 번 더 확인하세요.</footer>

      <div className={toast ? "toast show" : "toast"} role="status">{toast}</div>
    </main>
  );
}

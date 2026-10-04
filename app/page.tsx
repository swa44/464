"use client";

import { useEffect, useRef, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const TARGET_OPTIONS = [50, 100, 200];

export default function Home() {
  const [count, setCount] = useState(0);
  const [target, setTarget] = useState(100);
  const [hydrated, setHydrated] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const completeSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio("/sounds/complete.wav");
    audio.preload = "auto";
    completeSound.current = audio;

    const savedCount = Number(window.localStorage.getItem("workout-count"));
    const savedTarget = Number(window.localStorage.getItem("workout-target"));
    if (Number.isFinite(savedCount) && savedCount >= 0) setCount(savedCount);
    if (Number.isFinite(savedTarget) && savedTarget > 0) setTarget(savedTarget);
    setHydrated(true);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }

    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstall);
      audio.pause();
      completeSound.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("workout-count", String(count));
    window.localStorage.setItem("workout-target", String(target));
  }, [count, target, hydrated]);

  const isComplete = count >= target;
  const progress = Math.min(100, Math.round((count / target) * 100));
  const remaining = Math.max(0, target - count);

  function addTen() {
    const nextCount = count + 10;
    setCount(nextCount);

    if (count < target && nextCount >= target) {
      if (completeSound.current) {
        completeSound.current.currentTime = 0;
        void completeSound.current.play();
      }
      if ("vibrate" in navigator) navigator.vibrate([80, 50, 160]);
    } else if ("vibrate" in navigator) {
      navigator.vibrate(28);
    }
  }

  function changeTarget(nextTarget: number) {
    if (!Number.isFinite(nextTarget)) return;
    setTarget(Math.max(10, Math.min(9990, Math.round(nextTarget / 10) * 10)));
  }

  async function installApp() {
    if (!installPrompt) {
      setShowInstallHelp((current) => !current);
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">10</span>
          <span>딱 10개</span>
        </div>
        <button className="install-button" type="button" onClick={installApp}>
          <DownloadIcon />
          설치
        </button>
      </header>

      {showInstallHelp && (
        <aside className="install-help">
          브라우저 메뉴의 <strong>홈 화면에 추가</strong> 또는 <strong>앱 설치</strong>를 눌러주세요.
        </aside>
      )}

      <section className="counter-card" aria-live="polite">
        <div className="status-row">
          <span className={`status-pill ${isComplete ? "complete" : ""}`}>
            <span className="status-dot" />
            {isComplete ? "오늘 운동 완료" : "운동 진행 중"}
          </span>
          <span className="percent">{progress}%</span>
        </div>

        <div className="count-wrap">
          <p className="count-label">현재 횟수</p>
          <p className="count-number">{count.toLocaleString("ko-KR")}</p>
          <p className="remaining">
            {isComplete ? "목표를 달성했어요!" : `${remaining.toLocaleString("ko-KR")}개 남았어요`}
          </p>
        </div>

        <div className="progress-track" aria-label={`목표 달성률 ${progress}%`}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <button className={`add-button ${isComplete ? "done" : ""}`} type="button" onClick={addTen}>
          <span className="plus">+</span>
          <span>10개</span>
          <small>탭해서 기록</small>
        </button>

        <div className="quick-actions">
          <button type="button" onClick={() => setCount((value) => Math.max(0, value - 10))} disabled={count === 0}>
            <UndoIcon />
            10개 취소
          </button>
          <button type="button" onClick={() => setCount(0)} disabled={count === 0}>
            <ResetIcon />
            처음부터
          </button>
        </div>
      </section>

      <section className="target-card">
        <div>
          <p className="section-kicker">오늘의 목표</p>
          <h2>{target.toLocaleString("ko-KR")}개</h2>
        </div>
        <div className="stepper" aria-label="목표 횟수 조절">
          <button type="button" aria-label="목표 10개 줄이기" onClick={() => changeTarget(target - 10)}>−</button>
          <input
            aria-label="목표 횟수"
            inputMode="numeric"
            value={target}
            onChange={(event) => {
              const value = event.target.value.replace(/[^0-9]/g, "");
              if (value) setTarget(Math.min(9990, Number(value)));
            }}
            onBlur={() => changeTarget(target)}
          />
          <button type="button" aria-label="목표 10개 늘리기" onClick={() => changeTarget(target + 10)}>+</button>
        </div>
        <div className="preset-row">
          {TARGET_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={target === option ? "selected" : ""}
              onClick={() => setTarget(option)}
            >
              {option}개
            </button>
          ))}
        </div>
      </section>

      <p className="save-note"><CheckIcon /> 기록은 이 기기에 자동 저장돼요</p>
    </main>
  );
}

function DownloadIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 19h14" /></svg>;
}

function UndoIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5M5 12h9a5 5 0 0 1 5 5" /></svg>;
}

function ResetIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 9m0-6v6h6" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>;
}

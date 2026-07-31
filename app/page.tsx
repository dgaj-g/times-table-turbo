"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CorrectionsReview, {
  type MistakeRecord,
} from "./CorrectionsReview";
import MultiplayerGame from "./MultiplayerGame";
import type { MultiplayerMode } from "./multiplayer-core";
import {
  createQuestionSequence,
  questionAt,
  type Question,
  type QuestionSequence,
} from "./question-sequence";

type Screen = "home" | "playing" | "results" | "multiplayer";
type Feedback = "idle" | "correct" | "wrong";
type SelectionMode = "multi" | "single";
type MultiplayerEntry =
  | { kind: "host"; mode: MultiplayerMode }
  | { kind: "join" };

type SavedProgress = {
  bestScore: number;
  totalStars: number;
  rounds: number;
  unlockedAwards: string[];
};

const ROUND_SECONDS = 60;
const ALL_TABLES = Array.from({ length: 11 }, (_, index) => index + 2);
const DEFAULT_PROGRESS: SavedProgress = {
  bestScore: 0,
  totalStars: 0,
  rounds: 0,
  unlockedAwards: [],
};

const AWARDS = [
  {
    id: "first-launch",
    icon: "🚀",
    title: "First Launch",
    description: "Answer your first question",
  },
  {
    id: "hot-streak",
    icon: "🔥",
    title: "Hot Streak",
    description: "Build a 5-answer combo",
  },
  {
    id: "turbo-ten",
    icon: "⚡",
    title: "Turbo Ten",
    description: "Get 10 right in one round",
  },
  {
    id: "sharp-shooter",
    icon: "🎯",
    title: "Sharp Shooter",
    description: "Score 90% with 10+ answers",
  },
  {
    id: "twelve-tamer",
    icon: "🐉",
    title: "Twelve Tamer",
    description: "Beat five 12× questions",
  },
  {
    id: "flawless",
    icon: "👑",
    title: "Flawless",
    description: "A perfect 10+ answer round",
  },
];

function scoreStars(score: number) {
  if (score >= 3000) return 3;
  if (score >= 1700) return 2;
  if (score >= 600) return 1;
  return 0;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedTables, setSelectedTables] = useState(ALL_TABLES);
  const [selectionMode, setSelectionMode] =
    useState<SelectionMode>("multi");
  const [question, setQuestion] = useState<Question>({ a: 7, b: 8 });
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [correctCount, setCorrectCount] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [twelvesCorrect, setTwelvesCorrect] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [message, setMessage] = useState("Ready?");
  const [locked, setLocked] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [newAwards, setNewAwards] = useState<string[]>([]);
  const [progress, setProgress] = useState<SavedProgress>(DEFAULT_PROGRESS);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [mistakesConfirmed, setMistakesConfirmed] = useState(false);
  const [multiplayerEntry, setMultiplayerEntry] =
    useState<MultiplayerEntry | null>(null);
  const questionStartedAt = useRef(Date.now());
  const audioContext = useRef<AudioContext | null>(null);
  const roundActionTimer = useRef<number | null>(null);
  const finishing = useRef(false);
  const questionSequence = useRef<QuestionSequence | null>(null);
  const questionIndex = useRef(0);

  const accuracy = attempts ? Math.round((correctCount / attempts) * 100) : 0;
  const stars = scoreStars(score);
  const tableLabel =
    selectedTables.length === ALL_TABLES.length
      ? "All 2–12"
      : selectedTables.length === 1
        ? `${selectedTables[0]} only`
      : selectedTables.slice().sort((a, b) => a - b).join(", ");

  const unlocked = useMemo(
    () => new Set(progress.unlockedAwards),
    [progress.unlockedAwards],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem("times-table-turbo-progress");
      if (saved) {
        setProgress({ ...DEFAULT_PROGRESS, ...JSON.parse(saved) });
      }
    } catch {
      // The game still works when private browsing blocks storage.
    }

    if ("serviceWorker" in navigator) {
      const serviceWorkerPath = new URL("sw.js", window.location.href).pathname;
      let refreshing = false;
      const refreshForUpdate = () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener(
        "controllerchange",
        refreshForUpdate,
      );
      navigator.serviceWorker
        .register(serviceWorkerPath, { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => undefined);

      return () => {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          refreshForUpdate,
        );
      };
    }
  }, []);

  useEffect(() => {
    if (screen !== "playing") return;
    const timer = window.setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    if (screen === "playing" && timeLeft === 0) {
      finishRound();
    }
  }, [timeLeft, screen]);

  useEffect(() => {
    if (screen !== "playing" || locked) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) enterDigit(event.key);
      if (event.key === "Backspace") eraseDigit();
      if (event.key === "Enter") submitAnswer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function saveProgress(next: SavedProgress) {
    setProgress(next);
    try {
      localStorage.setItem("times-table-turbo-progress", JSON.stringify(next));
    } catch {
      // Saving progress is a bonus, never a requirement to play.
    }
  }

  function playSound(kind: "start" | "correct" | "wrong" | "award" | "tap") {
    if (!soundOn) return;
    try {
      const AudioCtor =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext: typeof AudioContext;
          }
        ).webkitAudioContext;
      if (!audioContext.current) audioContext.current = new AudioCtor();
      const context = audioContext.current;
      const now = context.currentTime;
      const notes = {
        tap: [340],
        start: [392, 523, 659],
        correct: [523, 784],
        wrong: [180, 135],
        award: [523, 659, 784, 1047],
      }[kind];

      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = kind === "wrong" ? "sawtooth" : "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(
          kind === "tap" ? 0.025 : 0.085,
          now + index * 0.08 + 0.012,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + index * 0.08 + 0.16,
        );
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + index * 0.08);
        oscillator.stop(now + index * 0.08 + 0.18);
      });
    } catch {
      // Audio is intentionally optional.
    }
  }

  function clearRoundAction() {
    if (roundActionTimer.current !== null) {
      window.clearTimeout(roundActionTimer.current);
      roundActionTimer.current = null;
    }
  }

  function scheduleRoundAction(action: () => void, delay: number) {
    clearRoundAction();
    roundActionTimer.current = window.setTimeout(() => {
      roundActionTimer.current = null;
      action();
    }, delay);
  }

  function chooseTable(table: number) {
    playSound("tap");
    if (selectionMode === "single") {
      setSelectedTables([table]);
      return;
    }

    setSelectedTables((current) => {
      if (current.includes(table)) {
        return current.length === 1
          ? current
          : current.filter((item) => item !== table);
      }
      return [...current, table].sort((a, b) => a - b);
    });
  }

  function startGame() {
    clearRoundAction();
    finishing.current = false;
    const seed = Math.floor(Math.random() * 0x100000000);
    const sequence = createQuestionSequence(selectedTables, seed);
    questionSequence.current = sequence;
    questionIndex.current = 0;
    setQuestion(questionAt(sequence, 0));
    questionStartedAt.current = Date.now();
    setAnswer("");
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setLives(3);
    setTimeLeft(ROUND_SECONDS);
    setCorrectCount(0);
    setAttempts(0);
    setTwelvesCorrect(0);
    setFeedback("idle");
    setMessage("Turbo on!");
    setLocked(false);
    setNewAwards([]);
    setMistakes([]);
    setMistakesConfirmed(false);
    setScreen("playing");
    playSound("start");
  }

  function exitToHome() {
    clearRoundAction();
    finishing.current = true;
    setLocked(true);
    setAnswer("");
    setFeedback("idle");
    setMessage("Ready?");
    setScreen("home");
    playSound("tap");
  }

  function openMultiplayer(entry: MultiplayerEntry) {
    clearRoundAction();
    setMultiplayerEntry(entry);
    setScreen("multiplayer");
    playSound("tap");
  }

  function enterDigit(digit: string) {
    if (locked) return;
    playSound("tap");
    setAnswer((current) => (current.length < 3 ? current + digit : current));
  }

  function eraseDigit() {
    if (locked) return;
    playSound("tap");
    setAnswer((current) => current.slice(0, -1));
  }

  function nextQuestion() {
    if (questionSequence.current) {
      questionIndex.current += 1;
      setQuestion(questionAt(questionSequence.current, questionIndex.current));
    }
    setAnswer("");
    setFeedback("idle");
    setMessage("Keep flying!");
    setLocked(false);
    questionStartedAt.current = Date.now();
  }

  function recordMistake(missedQuestion: Question) {
    setMistakes((current) => {
      const existing = current.find(
        (mistake) =>
          mistake.a === missedQuestion.a && mistake.b === missedQuestion.b,
      );
      if (existing) {
        return current.map((mistake) =>
          mistake.a === missedQuestion.a && mistake.b === missedQuestion.b
            ? { ...mistake, count: mistake.count + 1 }
            : mistake,
        );
      }
      return [...current, { ...missedQuestion, count: 1 }];
    });
  }

  function submitAnswer() {
    if (!answer || locked || screen !== "playing") return;
    setLocked(true);
    const isCorrect = Number(answer) === question.a * question.b;
    const responseTime = (Date.now() - questionStartedAt.current) / 1000;
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (isCorrect) {
      const nextCombo = combo + 1;
      const speedBonus = Math.max(0, Math.round((5 - responseTime) * 18));
      const comboBonus = Math.min(nextCombo * 20, 240);
      setScore((current) => current + 100 + speedBonus + comboBonus);
      setCombo(nextCombo);
      setBestCombo((current) => Math.max(current, nextCombo));
      setCorrectCount((current) => current + 1);
      if (question.a === 12 || question.b === 12) {
        setTwelvesCorrect((current) => current + 1);
      }
      setFeedback("correct");
      setMessage(
        nextCombo > 1
          ? `${nextCombo}× combo!`
          : responseTime < 2
            ? "Lightning fast!"
            : "Boom! Correct.",
      );
      if (nextCombo > 0 && nextCombo % 5 === 0) {
        setTimeLeft((current) => Math.min(ROUND_SECONDS, current + 3));
        setMessage(`${nextCombo}× COMBO — +3 SECONDS!`);
        playSound("award");
      } else {
        playSound("correct");
      }
      scheduleRoundAction(nextQuestion, 360);
      return;
    }

    const nextLives = lives - 1;
    recordMistake(question);
    setLives(nextLives);
    setCombo(0);
    setTimeLeft((current) => Math.max(0, current - 2));
    setFeedback("wrong");
    setMessage(`${question.a} × ${question.b} = ${question.a * question.b}`);
    playSound("wrong");

    if (nextLives <= 0) {
      scheduleRoundAction(finishRound, 900);
    } else {
      scheduleRoundAction(nextQuestion, 900);
    }
  }

  function finishRound() {
    if (finishing.current) return;
    finishing.current = true;
    clearRoundAction();
    setLocked(true);

    const roundAccuracy = attempts ? correctCount / attempts : 0;
    const earned = [
      correctCount >= 1 ? "first-launch" : "",
      bestCombo >= 5 ? "hot-streak" : "",
      correctCount >= 10 ? "turbo-ten" : "",
      attempts >= 10 && roundAccuracy >= 0.9 ? "sharp-shooter" : "",
      twelvesCorrect >= 5 ? "twelve-tamer" : "",
      attempts >= 10 && correctCount === attempts ? "flawless" : "",
    ].filter(Boolean);
    const freshlyEarned = earned.filter(
      (award) => !progress.unlockedAwards.includes(award),
    );
    const mergedAwards = Array.from(
      new Set([...progress.unlockedAwards, ...earned]),
    );
    const nextProgress = {
      bestScore: Math.max(progress.bestScore, score),
      totalStars: progress.totalStars + scoreStars(score),
      rounds: progress.rounds + 1,
      unlockedAwards: mergedAwards,
    };
    saveProgress(nextProgress);
    setNewAwards(freshlyEarned);
    setScreen("results");
    playSound(freshlyEarned.length ? "award" : "start");
  }

  const soundButton = (
    <button
      className="sound-button"
      type="button"
      onClick={() => setSoundOn((current) => !current)}
      aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
      aria-pressed={soundOn}
    >
      <span aria-hidden="true">{soundOn ? "🔊" : "🔇"}</span>
    </button>
  );

  if (screen === "multiplayer" && multiplayerEntry) {
    return (
      <MultiplayerGame
        entry={multiplayerEntry}
        tables={selectedTables}
        soundOn={soundOn}
        onToggleSound={() => setSoundOn((current) => !current)}
        onHome={() => {
          setMultiplayerEntry(null);
          setScreen("home");
        }}
        playSound={playSound}
      />
    );
  }

  if (screen === "playing") {
    return (
      <main className={`game-shell feedback-${feedback}`}>
        <header className="game-header">
          <div className="game-nav">
            <button
              type="button"
              className="home-button"
              onClick={exitToHome}
              aria-label="End this round and return to the home screen"
            >
              <span aria-hidden="true">←</span>
              HOME
            </button>
            <div className="wordmark compact" aria-hidden="true">
              <span className="bolt">⚡</span>
              TURBO
            </div>
          </div>
          <div className="hearts" aria-label={`${lives} lives remaining`}>
            {[0, 1, 2].map((heart) => (
              <span
                key={heart}
                className={heart < lives ? "heart live" : "heart lost"}
                aria-hidden="true"
              >
                ♥
              </span>
            ))}
          </div>
          {soundButton}
        </header>

        <section className="play-area" aria-live="polite">
          <div className="score-strip">
            <div>
              <span className="stat-label">Score</span>
              <strong>{score.toLocaleString()}</strong>
            </div>
            <div className={`combo-stat ${combo >= 5 ? "on-fire" : ""}`}>
              <span className="stat-label">Combo</span>
              <strong>{combo}×</strong>
            </div>
            <div
              className={`timer ${timeLeft <= 10 ? "danger" : ""}`}
              aria-label={`${timeLeft} seconds remaining`}
            >
              <span className="stat-label">Time</span>
              <strong>{timeLeft}</strong>
            </div>
          </div>

          <div className="question-card">
            <div className="question-kicker">{message}</div>
            <div className="equation" aria-label={`${question.a} times ${question.b}`}>
              <span>{question.a}</span>
              <span className="times">×</span>
              <span>{question.b}</span>
              <span className="equals">=</span>
              <span className={`answer-slot ${answer ? "filled" : ""}`}>
                {answer || "?"}
              </span>
            </div>
            <div className="micro-copy">
              {feedback === "wrong"
                ? "Heart lost • −2 seconds • combo reset"
                : feedback === "correct"
                  ? "Nice one!"
                  : "Tap your answer, then GO"}
            </div>
          </div>

          <div className="number-pad" aria-label="Answer keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => enterDigit(digit)}
                disabled={locked}
                aria-label={digit}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              className="delete-key"
              onClick={eraseDigit}
              disabled={locked}
              aria-label="Delete last digit"
            >
              ⌫
            </button>
            <button
              type="button"
              onClick={() => enterDigit("0")}
              disabled={locked}
              aria-label="0"
            >
              0
            </button>
            <button
              type="button"
              className="go-key"
              onClick={submitAnswer}
              disabled={locked || !answer}
            >
              GO
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "results") {
    const isNewBest = score > 0 && score >= progress.bestScore;
    const correctionsRequired = mistakes.length > 0 && !mistakesConfirmed;
    return (
      <main className="home-shell results-shell">
        <header className="top-bar">
          <button
            type="button"
            className="wordmark"
            disabled={correctionsRequired}
            onClick={() => setScreen("home")}
          >
            <span className="bolt" aria-hidden="true">
              ⚡
            </span>
            JARLATH AND ANYA’S TIMES TABLE TURBO
          </button>
          {soundButton}
        </header>

        <section className="result-card">
          <div className="eyebrow">
            {lives <= 0 ? "TURBO OVER — HEARTS EMPTY" : "TIME!"}
          </div>
          <div className="result-stars" aria-label={`${stars} out of 3 stars`}>
            {[0, 1, 2].map((star) => (
              <span key={star} className={star < stars ? "earned" : ""}>
                ★
              </span>
            ))}
          </div>
          <h1>{score.toLocaleString()}</h1>
          <p className="result-caption">
            {isNewBest
              ? "New high score! That was turbo-charged."
              : score < 600
                ? "Every round makes your brain faster."
                : "Great run — can you beat it?"}
          </p>

          <div className="result-grid">
            <div>
              <strong>{correctCount}</strong>
              <span>Correct</span>
            </div>
            <div>
              <strong>{accuracy}%</strong>
              <span>Accuracy</span>
            </div>
            <div>
              <strong>{bestCombo}×</strong>
              <span>Best combo</span>
            </div>
          </div>

          {newAwards.length > 0 && (
            <div className="new-awards">
              <div className="eyebrow">NEW AWARD!</div>
              {AWARDS.filter((award) => newAwards.includes(award.id)).map(
                (award) => (
                  <div className="award-pop" key={award.id}>
                    <span aria-hidden="true">{award.icon}</span>
                    <div>
                      <strong>{award.title}</strong>
                      <small>{award.description}</small>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          <CorrectionsReview
            mistakes={mistakes}
            onAnswer={(correct) =>
              playSound(correct ? "correct" : "wrong")
            }
            onComplete={() => {
              setMistakesConfirmed(true);
              playSound("award");
            }}
          />

          <button
            type="button"
            className="primary-cta"
            onClick={startGame}
            disabled={correctionsRequired}
          >
            PLAY AGAIN <span aria-hidden="true">↻</span>
          </button>
          <button
            type="button"
            className="secondary-cta"
            onClick={() => setScreen("home")}
            disabled={correctionsRequired}
          >
            CHANGE TABLES
          </button>
          {correctionsRequired && (
            <p className="review-lock-note">
              Read the corrections, then complete the retry to continue.
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="home-shell">
      <header className="top-bar">
        <div className="wordmark">
          <span className="bolt" aria-hidden="true">
            ⚡
          </span>
          JARLATH AND ANYA’S TIMES TABLE TURBO
        </div>
        <div className="header-actions">
          <div className="mini-stat" title="Stars earned">
            <span aria-hidden="true">★</span> {progress.totalStars}
          </div>
          {soundButton}
        </div>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow">60-SECOND MATHS MAYHEM</div>
          <div className="family-title">
            Jarlath and Anya’s Times Table Turbo
          </div>
          <h1>
            READY.
            <br />
            SET. <span>×</span> GO!
          </h1>
          <p>
            Race the clock, build monster combos and master every table from
            2 to 12.
          </p>

          <div className="best-strip">
            <div>
              <span>Personal best</span>
              <strong>{progress.bestScore.toLocaleString()}</strong>
            </div>
            <div>
              <span>Rounds flown</span>
              <strong>{progress.rounds}</strong>
            </div>
          </div>

          <button type="button" className="primary-cta" onClick={startGame}>
            START SOLO TURBO <span aria-hidden="true">→</span>
          </button>
          <p className="touch-note">Big-button mode • made for tapping</p>
        </div>

        <aside className="mission-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">YOUR MISSION</span>
              <h2>Choose your tables</h2>
            </div>
            <button
              type="button"
              className="all-button"
              onClick={() => {
                setSelectionMode("multi");
                setSelectedTables(ALL_TABLES);
                playSound("tap");
              }}
            >
              ALL
            </button>
          </div>
          <div
            className="selection-mode"
            role="group"
            aria-label="How to choose times tables"
          >
            <button
              type="button"
              className={selectionMode === "multi" ? "active" : ""}
              aria-pressed={selectionMode === "multi"}
              onClick={() => {
                setSelectionMode("multi");
                playSound("tap");
              }}
            >
              PICK SEVERAL
            </button>
            <button
              type="button"
              className={selectionMode === "single" ? "active" : ""}
              aria-pressed={selectionMode === "single"}
              onClick={() => {
                setSelectionMode("single");
                playSound("tap");
              }}
            >
              FOCUS ONE
            </button>
          </div>
          <p className="selection-hint">
            {selectionMode === "single"
              ? "Tap one number to practise only that table."
              : "Tap tables to add or remove them."}
          </p>
          <div className="table-picker" aria-label="Choose times tables">
            {ALL_TABLES.map((table) => {
              const active = selectedTables.includes(table);
              return (
                <button
                  key={table}
                  type="button"
                  className={active ? "active" : ""}
                  aria-pressed={active}
                  onClick={() => chooseTable(table)}
                >
                  {table}
                </button>
              );
            })}
          </div>
          <div className="selected-label">
            <span>Playing</span>
            <strong>{tableLabel}</strong>
          </div>
          <div className="rules">
            <div>
              <span className="rule-icon">⏱</span>
              <span>
                <strong>60 seconds</strong>
                Race the clock
              </span>
            </div>
            <div>
              <span className="rule-icon">♥</span>
              <span>
                <strong>3 hearts</strong>
                Wrong = −2 seconds
              </span>
            </div>
            <div>
              <span className="rule-icon">⚡</span>
              <span>
                <strong>5× combo</strong>
                Wins +3 seconds
              </span>
            </div>
          </div>
        </aside>
      </section>

      <section className="together-section" aria-labelledby="together-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TWO IPADS • ONE LIVE ROOM</span>
            <h2 id="together-title">Play together</h2>
          </div>
          <span>Uses your selected tables: {tableLabel}</span>
        </div>
        <div className="together-grid">
          <button
            type="button"
            className="mode-card race-card"
            onClick={() => openMultiplayer({ kind: "host", mode: "race" })}
          >
            <span className="mode-icon" aria-hidden="true">
              🏁
            </span>
            <span className="mode-copy">
              <small>COMPETE LIVE</small>
              <strong>Race Mode</strong>
              <span>
                Same clock, live scores. Fastest brain takes the trophy.
              </span>
            </span>
            <b aria-hidden="true">→</b>
          </button>
          <button
            type="button"
            className="mode-card coop-card"
            onClick={() => openMultiplayer({ kind: "host", mode: "coop" })}
          >
            <span className="mode-icon" aria-hidden="true">
              🤝
            </span>
            <span className="mode-copy">
              <small>WORK TOGETHER</small>
              <strong>Team Turbo</strong>
              <span>
                Take turns, share hearts and build one monster score.
              </span>
            </span>
            <b aria-hidden="true">→</b>
          </button>
          <button
            type="button"
            className="mode-card join-card"
            onClick={() => openMultiplayer({ kind: "join" })}
          >
            <span className="mode-icon" aria-hidden="true">
              🔑
            </span>
            <span className="mode-copy">
              <small>GOT A CODE?</small>
              <strong>Join Room</strong>
              <span>Enter the five characters shown on the other iPad.</span>
            </span>
            <b aria-hidden="true">→</b>
          </button>
        </div>
        <p className="live-note">
          <span aria-hidden="true">●</span> Realtime play needs both iPads online.
          Solo mode still works offline after the first visit.
        </p>
      </section>

      <section className="awards-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TROPHY CABINET</span>
            <h2>Collect them all</h2>
          </div>
          <span>
            {progress.unlockedAwards.length}/{AWARDS.length} unlocked
          </span>
        </div>
        <div className="awards-grid">
          {AWARDS.map((award) => {
            const isUnlocked = unlocked.has(award.id);
            return (
              <article
                className={`award-card ${isUnlocked ? "unlocked" : "locked"}`}
                key={award.id}
              >
                <span className="award-icon" aria-hidden="true">
                  {isUnlocked ? award.icon : "?"}
                </span>
                <div>
                  <h3>{award.title}</h3>
                  <p>{award.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <footer>
        <span>Progress stays on this device.</span>
        <span>
          iPad tip: Safari → Share <span aria-hidden="true">▧</span> → Add to
          Home Screen
        </span>
      </footer>
    </main>
  );
}

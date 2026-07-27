"use client";

import { useState } from "react";

export type MistakeRecord = {
  a: number;
  b: number;
  count: number;
};

type Props = {
  mistakes: MistakeRecord[];
  onComplete: () => void;
  onAnswer?: (correct: boolean) => void;
  ownerLabel?: string;
};

export default function CorrectionsReview({
  mistakes,
  onComplete,
  onAnswer,
  ownerLabel,
}: Props) {
  const [phase, setPhase] = useState<"list" | "retry" | "complete">("list");
  const [retryIndex, setRetryIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  if (!mistakes.length) {
    return (
      <div className="perfect-review" role="status">
        <span aria-hidden="true">✨</span>
        <div>
          <strong>No corrections this time!</strong>
          <small>Every answer was right.</small>
        </div>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className="review-complete" role="status">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>Correction mission complete!</strong>
          <small>Every missed fact has been tried again.</small>
        </div>
      </div>
    );
  }

  if (phase === "list") {
    return (
      <section className="corrections-review" aria-labelledby="corrections-title">
        <div className="corrections-heading">
          <span aria-hidden="true">🧠</span>
          <div>
            <span className="eyebrow">CORRECTION CHECK</span>
            <h2 id="corrections-title">
              {ownerLabel
                ? `${ownerLabel} — read these`
                : "Read these before flying again"}
            </h2>
          </div>
        </div>
        <p>
          These were answered incorrectly. Say each complete fact out loud,
          then confirm it has been read.
        </p>
        <ul className="corrections-list">
          {mistakes.map((mistake) => (
            <li key={`${mistake.a}x${mistake.b}`}>
              <span>
                {mistake.a} × {mistake.b}
              </span>
              <strong>= {mistake.a * mistake.b}</strong>
              {mistake.count > 1 && (
                <small>missed {mistake.count} times</small>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="confirm-corrections"
          onClick={() => {
            setPhase("retry");
            setAnswer("");
            setFeedback(null);
          }}
        >
          <span aria-hidden="true">□</span>
          I’VE READ MY CORRECTIONS
        </button>
      </section>
    );
  }

  const mistake = mistakes[retryIndex] ?? mistakes[0]!;
  const correctAnswer = mistake.a * mistake.b;

  function enterDigit(digit: string) {
    if (feedback) return;
    setAnswer((current) => (current.length < 3 ? current + digit : current));
  }

  function eraseDigit() {
    if (feedback) return;
    setAnswer((current) => current.slice(0, -1));
  }

  function checkAnswer() {
    if (!answer || feedback) return;
    const isCorrect = Number(answer) === correctAnswer;
    setFeedback(isCorrect ? "correct" : "wrong");
    onAnswer?.(isCorrect);
  }

  function continueReview() {
    if (retryIndex + 1 >= mistakes.length) {
      setPhase("complete");
      onComplete();
      return;
    }
    setRetryIndex((current) => current + 1);
    setAnswer("");
    setFeedback(null);
  }

  return (
    <section
      className={`corrections-review retry-review retry-${feedback ?? "idle"}`}
      aria-labelledby="retry-title"
    >
      <div className="retry-progress">
        <span className="eyebrow">TRY IT AGAIN</span>
        <strong>
          {retryIndex + 1} / {mistakes.length}
        </strong>
      </div>
      <h2 id="retry-title">
        {ownerLabel
          ? `${ownerLabel}’s correction question`
          : "Correction question"}
      </h2>
      <p>The answers are hidden now. Solve this fact again.</p>

      <div
        className="correction-equation"
        aria-label={`${mistake.a} times ${mistake.b}`}
      >
        <span>{mistake.a}</span>
        <span className="times">×</span>
        <span>{mistake.b}</span>
        <span className="equals">=</span>
        <span className={`answer-slot ${answer || feedback ? "filled" : ""}`}>
          {feedback === "wrong" ? correctAnswer : answer || "?"}
        </span>
      </div>

      {feedback ? (
        <div className={`retry-feedback ${feedback}`} aria-live="assertive">
          <strong>
            {feedback === "correct"
              ? "Correct — well remembered!"
              : "Not quite. Read this:"}
          </strong>
          {feedback === "wrong" && (
            <p>
              {mistake.a} × {mistake.b} = {correctAnswer}
            </p>
          )}
          <button type="button" onClick={continueReview}>
            {retryIndex + 1 >= mistakes.length
              ? "FINISH CORRECTION REVIEW"
              : "NEXT CORRECTION"}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : (
        <div
          className="number-pad correction-pad"
          aria-label="Correction answer keypad"
        >
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => enterDigit(digit)}
              aria-label={digit}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className="delete-key"
            onClick={eraseDigit}
            aria-label="Delete last digit"
          >
            ⌫
          </button>
          <button type="button" onClick={() => enterDigit("0")} aria-label="0">
            0
          </button>
          <button
            type="button"
            className="go-key"
            onClick={checkAnswer}
            disabled={!answer}
          >
            CHECK
          </button>
        </div>
      )}
    </section>
  );
}

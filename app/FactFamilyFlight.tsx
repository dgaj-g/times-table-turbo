"use client";

import { useMemo, useState } from "react";
import {
  createFactFamilyRound,
  divisionChoices,
  divisionConnection,
  type FactFamily,
} from "./fact-family-core";

type SoundKind = "start" | "correct" | "wrong" | "award" | "tap";

type Props = {
  tables: number[];
  soundOn: boolean;
  onToggleSound: () => void;
  onHome: () => void;
  playSound: (kind: SoundKind) => void;
};

const FAMILIES_PER_FLIGHT = 5;

function FamilyMap({ family }: { family: FactFamily }) {
  return (
    <div
      className="fact-family-map"
      aria-label={`Number family: ${family.a}, ${family.b} and ${family.product}`}
    >
      <span className="fact-family-map-lines" aria-hidden="true" />
      <span className="fact-family-node product">{family.product}</span>
      <span className="fact-family-node factor-a">{family.a}</span>
      <span className="fact-family-node factor-b">{family.b}</span>
    </div>
  );
}

export default function FactFamilyFlight({
  tables,
  soundOn,
  onToggleSound,
  onHome,
  playSound,
}: Props) {
  const [families, setFamilies] = useState(() =>
    createFactFamilyRound(tables, FAMILIES_PER_FLIGHT),
  );
  const [familyIndex, setFamilyIndex] = useState(0);
  const [divisionStep, setDivisionStep] = useState<0 | 1>(0);
  const [chosenAnswer, setChosenAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"idle" | "wrong" | "correct">(
    "idle",
  );

  const currentFamily = families[familyIndex];
  const connection = currentFamily
    ? divisionConnection(currentFamily, divisionStep)
    : null;
  const choices = useMemo(
    () =>
      currentFamily ? divisionChoices(currentFamily, divisionStep) : [],
    [currentFamily, divisionStep],
  );

  function resetAnswer(nextStep: 0 | 1) {
    setDivisionStep(nextStep);
    setChosenAnswer(null);
    setFeedback("idle");
  }

  function chooseAnswer(choice: number) {
    if (!connection || feedback === "correct") return;
    setChosenAnswer(choice);
    if (choice === connection.answer) {
      setFeedback("correct");
      playSound(divisionStep === 1 ? "award" : "correct");
      return;
    }
    setFeedback("wrong");
    playSound("wrong");
  }

  function continueFlight() {
    if (divisionStep === 0) {
      resetAnswer(1);
      playSound("tap");
      return;
    }
    setFamilyIndex((current) => current + 1);
    resetAnswer(0);
    playSound(familyIndex + 1 >= families.length ? "award" : "start");
  }

  function restartFlight() {
    setFamilies(createFactFamilyRound(tables, FAMILIES_PER_FLIGHT));
    setFamilyIndex(0);
    resetAnswer(0);
    playSound("start");
  }

  const soundButton = (
    <button
      className="sound-button"
      type="button"
      onClick={onToggleSound}
      aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
      aria-pressed={soundOn}
    >
      <span aria-hidden="true">{soundOn ? "🔊" : "🔇"}</span>
    </button>
  );

  if (!currentFamily || !connection) {
    return (
      <main className="game-shell family-flight-shell">
        <header className="game-header">
          <div className="game-nav">
            <button type="button" className="home-button" onClick={onHome}>
              <span aria-hidden="true">←</span>
              HOME
            </button>
            <div className="wordmark compact" aria-hidden="true">
              <span className="bolt">⚡</span>
              FACT FAMILY FLIGHT
            </div>
          </div>
          {soundButton}
        </header>

        <section className="fact-family-finish">
          <div className="fact-family-finish-icon" aria-hidden="true">
            ⚡
          </div>
          <span className="eyebrow">ALL CONNECTIONS POWERED</span>
          <h1>FAMILY FLIGHT COMPLETE!</h1>
          <p>
            Every multiplication fact unlocked its two matching division facts.
          </p>
          <div className="completed-family-list" aria-label="Completed families">
            {families.map((family) => (
              <span key={`${family.a}x${family.b}`}>
                {family.a} • {family.b} • {family.product}
              </span>
            ))}
          </div>
          <button type="button" className="primary-cta" onClick={restartFlight}>
            FLY AGAIN <span aria-hidden="true">↻</span>
          </button>
          <button type="button" className="secondary-cta" onClick={onHome}>
            BACK HOME
          </button>
        </section>
      </main>
    );
  }

  const connectedCount = 2 + divisionStep + (feedback === "correct" ? 1 : 0);
  const firstDivisionConnected = divisionStep === 1 || feedback === "correct";
  const secondDivisionConnected = divisionStep === 1 && feedback === "correct";

  return (
    <main className="game-shell family-flight-shell">
      <header className="game-header">
        <div className="game-nav">
          <button type="button" className="home-button" onClick={onHome}>
            <span aria-hidden="true">←</span>
            HOME
          </button>
          <div className="wordmark compact" aria-hidden="true">
            <span className="bolt">⚡</span>
            FACT FAMILY FLIGHT
          </div>
        </div>
        <div className="family-flight-counter">
          FAMILY {familyIndex + 1} / {families.length}
        </div>
        {soundButton}
      </header>

      <section className="fact-family-flight-area">
        <div className="fact-family-stage">
          <div className="fact-family-stage-heading">
            <span className="eyebrow">THE SAME THREE NUMBERS</span>
            <strong>{connectedCount} OF 4 CONNECTED</strong>
          </div>
          <FamilyMap family={currentFamily} />
          <div className="fact-family-connections" aria-live="polite">
            <div className="connected">
              {currentFamily.a} × {currentFamily.b} = {currentFamily.product}
            </div>
            <div className="connected">
              {currentFamily.b} × {currentFamily.a} = {currentFamily.product}
            </div>
            <div className={firstDivisionConnected ? "connected" : ""}>
              {currentFamily.product} ÷ {currentFamily.b} ={" "}
              {firstDivisionConnected ? currentFamily.a : "?"}
            </div>
            <div className={secondDivisionConnected ? "connected" : ""}>
              {currentFamily.product} ÷ {currentFamily.a} ={" "}
              {secondDivisionConnected ? currentFamily.b : "?"}
            </div>
          </div>
        </div>

        <div className={`fact-family-question feedback-${feedback}`}>
          <span className="eyebrow">
            {feedback === "correct"
              ? connectedCount === 4
                ? "NUMBER FAMILY POWERED!"
                : "CONNECTION MADE!"
              : "MAKE THE DIVISION CONNECTION"}
          </span>
          <div
            className="fact-family-equation"
            aria-label={`${connection.dividend} divided by ${connection.divisor}`}
          >
            <span>{connection.dividend}</span>
            <span className="divide">÷</span>
            <span>{connection.divisor}</span>
            <span className="equals">=</span>
            <span className="answer-slot">
              {feedback === "correct" ? connection.answer : "?"}
            </span>
          </div>

          {feedback === "correct" ? (
            <div className="fact-family-success" aria-live="assertive">
              <strong>
                {connection.dividend} ÷ {connection.divisor} ={" "}
                {connection.answer}
              </strong>
              <span>
                {divisionStep === 0
                  ? "Now reverse the other multiplication fact."
                  : "Two multiplication facts. Two division facts. One family."}
              </span>
              <button type="button" onClick={continueFlight}>
                {divisionStep === 0
                  ? "MAKE THE OTHER CONNECTION"
                  : familyIndex + 1 >= families.length
                    ? "FINISH THE FLIGHT"
                    : "NEXT NUMBER FAMILY"}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : (
            <>
              <div className="fact-family-answer-grid" aria-label="Choose an answer">
                {choices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className={
                      feedback === "wrong" && chosenAnswer === choice
                        ? "chosen-wrong"
                        : ""
                    }
                    onClick={() => chooseAnswer(choice)}
                    aria-label={`Answer ${choice}`}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              <p className={feedback === "wrong" ? "wrong" : ""} aria-live="polite">
                {feedback === "wrong"
                  ? "Not quite — use the same three numbers and try again."
                  : "Choose the missing number from this family."}
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

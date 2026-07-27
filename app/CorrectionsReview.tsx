"use client";

export type MistakeRecord = {
  a: number;
  b: number;
  count: number;
};

type Props = {
  mistakes: MistakeRecord[];
  confirmed: boolean;
  onConfirm: () => void;
  ownerLabel?: string;
};

export default function CorrectionsReview({
  mistakes,
  confirmed,
  onConfirm,
  ownerLabel,
}: Props) {
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

  return (
    <section className="corrections-review" aria-labelledby="corrections-title">
      <div className="corrections-heading">
        <span aria-hidden="true">🧠</span>
        <div>
          <span className="eyebrow">CORRECTION CHECK</span>
          <h2 id="corrections-title">
            {ownerLabel ? `${ownerLabel} — read these` : "Read these before flying again"}
          </h2>
        </div>
      </div>
      <p>
        These were answered incorrectly. Say each complete fact out loud, then
        confirm it has been read.
      </p>
      <ul className="corrections-list">
        {mistakes.map((mistake) => (
          <li key={`${mistake.a}x${mistake.b}`}>
            <span>
              {mistake.a} × {mistake.b}
            </span>
            <strong>= {mistake.a * mistake.b}</strong>
            {mistake.count > 1 && <small>missed {mistake.count} times</small>}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`confirm-corrections ${confirmed ? "confirmed" : ""}`}
        onClick={onConfirm}
        aria-pressed={confirmed}
      >
        <span aria-hidden="true">{confirmed ? "✓" : "□"}</span>
        {confirmed ? "CORRECTIONS READ — NICE WORK!" : "I’VE READ MY CORRECTIONS"}
      </button>
    </section>
  );
}

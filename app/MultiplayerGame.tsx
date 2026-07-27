"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  get,
  onDisconnect,
  onValue,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import { getRealtimeServices } from "./firebase";
import {
  makeRoomCode,
  MULTIPLAYER_SECONDS,
  multiplayerQuestion,
  otherPlayer,
  PLAYERS,
  PlayerName,
  MultiplayerMode,
  RoomState,
  ROOM_LIFETIME_MS,
} from "./multiplayer-core";

type Entry =
  | { kind: "host"; mode: MultiplayerMode }
  | { kind: "join" };

type Props = {
  entry: Entry;
  tables: number[];
  soundOn: boolean;
  onToggleSound: () => void;
  onHome: () => void;
  playSound: (
    kind: "start" | "correct" | "wrong" | "award" | "tap",
  ) => void;
};

type LocalStage = "setup" | "lobby" | "game" | "results";
type Feedback = "idle" | "correct" | "wrong";

function playerLabel(player: PlayerName) {
  return player === "Jarlath" ? "JARLATH" : "ANYA";
}

export default function MultiplayerGame({
  entry,
  tables,
  soundOn,
  onToggleSound,
  onHome,
  playSound,
}: Props) {
  const [stage, setStage] = useState<LocalStage>("setup");
  const [player, setPlayer] = useState<PlayerName>("Jarlath");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [message, setMessage] = useState("Ready?");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(true);
  const [timeLeft, setTimeLeft] = useState(MULTIPLAYER_SECONDS);
  const [serverOffset, setServerOffset] = useState(0);
  const [currentUid, setCurrentUid] = useState("");
  const databaseRef = useRef<Awaited<
    ReturnType<typeof getRealtimeServices>
  >["database"] | null>(null);
  const uidRef = useRef("");
  const unsubscribeRoom = useRef<null | (() => void)>(null);
  const unsubscribeConnection = useRef<null | (() => void)>(null);
  const unsubscribeOffset = useRef<null | (() => void)>(null);
  const feedbackTimer = useRef<number | null>(null);
  const finishSent = useRef(false);

  const myState = room?.players[player];
  const opponentName = otherPlayer(player);
  const activeStage: LocalStage =
    room?.status === "playing"
      ? "game"
      : room?.status === "finished"
        ? "results"
        : room?.status === "waiting"
          ? "lobby"
          : stage;
  const questionIndex =
    room?.mode === "coop"
      ? room.coop?.questionIndex ?? 0
      : myState?.questionIndex ?? 0;
  const question = useMemo(
    () =>
      multiplayerQuestion(
        room?.seed ?? 1,
        questionIndex,
        room?.tables ?? tables,
      ),
    [questionIndex, room?.seed, room?.tables, tables],
  );
  const myTurn =
    room?.mode === "race" || room?.coop?.currentTurn === player;
  const gameLocked =
    busy || feedback !== "idle" || !myTurn || !connected || timeLeft <= 0;

  useEffect(() => {
    return () => {
      unsubscribeRoom.current?.();
      unsubscribeConnection.current?.();
      unsubscribeOffset.current?.();
      if (feedbackTimer.current !== null) {
        window.clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeStage !== "game" || !room?.startedAt) return;
    const updateClock = () => {
      const elapsed =
        (Date.now() + serverOffset - room.startedAt!) / 1000;
      setTimeLeft(Math.max(0, Math.ceil(MULTIPLAYER_SECONDS - elapsed)));
    };
    updateClock();
    const timer = window.setInterval(updateClock, 250);
    return () => window.clearInterval(timer);
  }, [activeStage, room?.startedAt, serverOffset]);

  useEffect(() => {
    if (
      activeStage !== "game" ||
      !roomCode ||
      !room ||
      finishSent.current ||
      (timeLeft > 0 && (room.coop?.lives ?? 1) > 0)
    ) {
      return;
    }
    finishSent.current = true;
    const database = databaseRef.current;
    if (database) {
      update(ref(database, `rooms/${roomCode}`), { status: "finished" }).catch(
        () => undefined,
      );
    }
  }, [activeStage, room, roomCode, timeLeft]);

  function clearFeedbackAfter(delay: number) {
    if (feedbackTimer.current !== null) {
      window.clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = window.setTimeout(() => {
      setFeedback("idle");
      setAnswer("");
      setMessage("Keep flying!");
      feedbackTimer.current = null;
    }, delay);
  }

  async function connectToRoom(code: string, selectedPlayer: PlayerName) {
    const services = await getRealtimeServices();
    databaseRef.current = services.database;
    uidRef.current = services.user.uid;
    setCurrentUid(services.user.uid);

    unsubscribeRoom.current?.();
    unsubscribeConnection.current?.();
    unsubscribeOffset.current?.();

    const roomPath = ref(services.database, `rooms/${code}`);
    unsubscribeRoom.current = onValue(
      roomPath,
      (snapshot) => {
        setRoom(snapshot.val() as RoomState | null);
        setError("");
      },
      () => setError("The room connection dropped. Try again."),
    );
    unsubscribeConnection.current = onValue(
      ref(services.database, ".info/connected"),
      (snapshot) => setConnected(Boolean(snapshot.val())),
    );
    unsubscribeOffset.current = onValue(
      ref(services.database, ".info/serverTimeOffset"),
      (snapshot) => setServerOffset(Number(snapshot.val()) || 0),
    );

    const playerPath = ref(
      services.database,
      `rooms/${code}/players/${selectedPlayer}`,
    );
    await onDisconnect(playerPath).update({ online: false });
  }

  async function createRoom() {
    if (entry.kind !== "host") return;
    setBusy(true);
    setError("");
    try {
      const services = await getRealtimeServices();
      databaseRef.current = services.database;
      uidRef.current = services.user.uid;
      setCurrentUid(services.user.uid);
      let code = "";

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = makeRoomCode();
        const snapshot = await get(
          ref(services.database, `rooms/${candidate}`),
        );
        if (!snapshot.exists()) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new Error("Could not make a room code. Try again.");

      const now = Date.now();
      const initialRoom: RoomState = {
        mode: entry.mode,
        status: "waiting",
        createdBy: services.user.uid,
        createdAt: now,
        expiresAt: now + ROOM_LIFETIME_MS - 5000,
        tables,
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
        startedAt: null,
        players: {
          [player]: {
            uid: services.user.uid,
            online: true,
            score: 0,
            correct: 0,
            combo: 0,
            questionIndex: 0,
            joinedAt: now,
          },
        },
        ...(entry.mode === "coop"
          ? {
              coop: {
                score: 0,
                correct: 0,
                attempts: 0,
                combo: 0,
                lives: 3,
                questionIndex: 0,
                currentTurn: player,
              },
            }
          : {}),
      };

      await set(ref(services.database, `rooms/${code}`), initialRoom);
      setRoomCode(code);
      await connectToRoom(code, player);
      setStage("lobby");
      playSound("start");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The room could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 5) {
      setError("Enter the 5-character room code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const services = await getRealtimeServices();
      databaseRef.current = services.database;
      uidRef.current = services.user.uid;
      setCurrentUid(services.user.uid);
      const roomPath = ref(services.database, `rooms/${code}`);
      const snapshot = await get(roomPath);
      if (!snapshot.exists()) throw new Error("Room not found. Check the code.");
      const found = snapshot.val() as RoomState;
      if (found.expiresAt <= Date.now()) throw new Error("That room expired.");
      if (found.status !== "waiting") {
        throw new Error("That round has already started.");
      }
      const occupied = found.players[player];
      if (occupied?.online && occupied.uid !== services.user.uid) {
        throw new Error(`${player} is already in that room.`);
      }

      await set(ref(services.database, `rooms/${code}/players/${player}`), {
        uid: services.user.uid,
        online: true,
        score: 0,
        correct: 0,
        combo: 0,
        questionIndex: 0,
        joinedAt: Date.now(),
      });
      setRoomCode(code);
      await connectToRoom(code, player);
      setStage("lobby");
      playSound("start");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not join that room.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function startRound() {
    if (!room || !databaseRef.current) return;
    if (!PLAYERS.every((name) => room.players[name]?.online)) {
      setError("Both players need to be in the room first.");
      return;
    }
    setBusy(true);
    setError("");
    finishSent.current = false;
    try {
      await update(ref(databaseRef.current, `rooms/${roomCode}`), {
        status: "playing",
        startedAt: serverTimestamp(),
      });
      playSound("start");
    } catch {
      setError("The round could not start. Check the connection.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer() {
    if (!answer || gameLocked || !room || !databaseRef.current) return;
    setBusy(true);
    const isCorrect = Number(answer) === question.a * question.b;
    const answerText = `${question.a} × ${question.b} = ${question.a * question.b}`;

    try {
      if (room.mode === "race") {
        const playerPath = ref(
          databaseRef.current,
          `rooms/${roomCode}/players/${player}`,
        );
        await runTransaction(playerPath, (current) => {
          if (!current || current.uid !== uidRef.current) return;
          const nextCombo = isCorrect ? current.combo + 1 : 0;
          return {
            ...current,
            score: isCorrect
              ? current.score + 100 + Math.min(nextCombo * 15, 150)
              : Math.max(0, current.score - 50),
            correct: current.correct + (isCorrect ? 1 : 0),
            combo: nextCombo,
            questionIndex: current.questionIndex + 1,
          };
        });
      } else {
        const coopPath = ref(
          databaseRef.current,
          `rooms/${roomCode}/coop`,
        );
        await runTransaction(coopPath, (current) => {
          if (!current || current.currentTurn !== player) return;
          const nextCombo = isCorrect ? current.combo + 1 : 0;
          return {
            ...current,
            score: isCorrect
              ? current.score + 100 + Math.min(nextCombo * 15, 150)
              : current.score,
            correct: current.correct + (isCorrect ? 1 : 0),
            attempts: current.attempts + 1,
            combo: nextCombo,
            lives: isCorrect ? current.lives : Math.max(0, current.lives - 1),
            questionIndex: current.questionIndex + 1,
            currentTurn: otherPlayer(player),
          };
        });
      }

      setFeedback(isCorrect ? "correct" : "wrong");
      setMessage(
        isCorrect
          ? room.mode === "coop"
            ? `Great! Pass to ${opponentName}.`
            : "Boom! +points"
          : room.mode === "coop"
            ? `${answerText} — pass it on!`
            : `${answerText} — 50 points lost`,
      );
      playSound(isCorrect ? "correct" : "wrong");
      clearFeedbackAfter(isCorrect ? 450 : 850);
    } catch {
      setError("That answer did not reach the room. Tap GO again.");
    } finally {
      setBusy(false);
    }
  }

  function enterDigit(digit: string) {
    if (gameLocked) return;
    setAnswer((current) => (current.length < 3 ? current + digit : current));
    playSound("tap");
  }

  function eraseDigit() {
    if (gameLocked) return;
    setAnswer((current) => current.slice(0, -1));
    playSound("tap");
  }

  async function leaveRoom() {
    const database = databaseRef.current;
    if (database && roomCode) {
      await update(ref(database, `rooms/${roomCode}/players/${player}`), {
        online: false,
      }).catch(() => undefined);
    }
    unsubscribeRoom.current?.();
    unsubscribeConnection.current?.();
    unsubscribeOffset.current?.();
    onHome();
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setMessage("Room code copied!");
    } catch {
      setMessage(`Tell them the code: ${roomCode}`);
    }
    playSound("tap");
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

  const multiplayerHeader = (
    <header className="game-header">
      <div className="game-nav">
        <button
          type="button"
          className="home-button"
          onClick={leaveRoom}
          aria-label="Leave this room and return to the home screen"
        >
          <span aria-hidden="true">←</span>
          HOME
        </button>
        <div className="wordmark compact" aria-hidden="true">
          <span className="bolt">⚡</span>
          DUO TURBO
        </div>
      </div>
      <div className={`connection-pill ${connected ? "" : "offline"}`}>
        <span aria-hidden="true">●</span>
        {connected ? "LIVE" : "OFFLINE"}
      </div>
      {soundButton}
    </header>
  );

  if (activeStage === "setup") {
    const hosting = entry.kind === "host";
    return (
      <main className="home-shell multiplayer-shell">
        {multiplayerHeader}
        <section className="setup-card">
          <span className="eyebrow">
            {hosting
              ? entry.mode === "race"
                ? "HEAD-TO-HEAD RACE"
                : "TAKE-TURNS TEAM MODE"
              : "JOIN THEIR ROOM"}
          </span>
          <h1>{hosting ? "Who’s holding this iPad?" : "Enter the room code"}</h1>
          <p>
            {hosting
              ? "Pick a player, then share the code shown on the next screen."
              : "Choose who is playing here, then type the code from the other iPad."}
          </p>

          <div className="player-picker" role="group" aria-label="Choose player">
            {PLAYERS.map((name) => (
              <button
                key={name}
                type="button"
                className={player === name ? "active" : ""}
                aria-pressed={player === name}
                onClick={() => {
                  setPlayer(name);
                  playSound("tap");
                }}
              >
                <span aria-hidden="true">{name === "Jarlath" ? "🚀" : "⭐"}</span>
                {name}
              </button>
            ))}
          </div>

          {!hosting && (
            <label className="room-code-field">
              <span>5-character code</span>
              <input
                value={roomCode}
                onChange={(event) =>
                  setRoomCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z2-9]/g, "")
                      .slice(0, 5),
                  )
                }
                placeholder="AB3XY"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                aria-label="Room code"
              />
            </label>
          )}

          {error && <div className="room-error">{error}</div>}
          <button
            type="button"
            className="primary-cta"
            onClick={hosting ? createRoom : joinRoom}
            disabled={busy || (!hosting && roomCode.length !== 5)}
          >
            {busy ? "CONNECTING…" : hosting ? "CREATE ROOM" : "JOIN ROOM"}
            <span aria-hidden="true">→</span>
          </button>
          <p className="privacy-note">
            No accounts or chat. Rooms expire after two hours.
          </p>
        </section>
      </main>
    );
  }

  if (activeStage === "lobby") {
    const amHost = room?.createdBy === currentUid;
    return (
      <main className="home-shell multiplayer-shell">
        {multiplayerHeader}
        <section className="lobby-card">
          <span className="eyebrow">
            {room?.mode === "race" ? "RACE ROOM" : "TEAM TURBO ROOM"}
          </span>
          <h1>Room {roomCode}</h1>
          <button type="button" className="copy-code" onClick={copyCode}>
            COPY CODE <span aria-hidden="true">▣</span>
          </button>
          <p>Open the app on the other iPad, tap Join Room, and enter this code.</p>

          <div className="lobby-players">
            {PLAYERS.map((name) => {
              const joined = room?.players[name]?.online;
              return (
                <div className={joined ? "joined" : ""} key={name}>
                  <span aria-hidden="true">{name === "Jarlath" ? "🚀" : "⭐"}</span>
                  <strong>{name}</strong>
                  <small>{joined ? "READY!" : "WAITING…"}</small>
                </div>
              );
            })}
          </div>

          {error && <div className="room-error">{error}</div>}
          {amHost ? (
            <button
              type="button"
              className="primary-cta"
              onClick={startRound}
              disabled={
                busy || !PLAYERS.every((name) => room?.players[name]?.online)
              }
            >
              {PLAYERS.every((name) => room?.players[name]?.online)
                ? "START TOGETHER"
                : "WAITING FOR BOTH…"}
              <span aria-hidden="true">⚡</span>
            </button>
          ) : (
            <div className="waiting-banner">The room maker starts the round.</div>
          )}
        </section>
      </main>
    );
  }

  if (activeStage === "results") {
    const raceWinner =
      room?.mode === "race"
        ? (room.players.Jarlath?.score ?? 0) ===
          (room.players.Anya?.score ?? 0)
          ? "It’s a draw!"
          : `${(room.players.Jarlath?.score ?? 0) >
              (room.players.Anya?.score ?? 0)
              ? "Jarlath"
              : "Anya"} wins!`
        : "Team mission complete!";
    return (
      <main className="home-shell multiplayer-shell">
        {multiplayerHeader}
        <section className="result-card multiplayer-results">
          <div className="eyebrow">
            {room?.mode === "race" ? "FINAL SCORES" : "TEAM SCORE"}
          </div>
          <div className="duo-trophy" aria-hidden="true">
            {room?.mode === "race" ? "🏆" : "🤝"}
          </div>
          <h2>{raceWinner}</h2>
          {room?.mode === "race" ? (
            <div className="race-scoreboard results-board">
              {PLAYERS.map((name) => (
                <div key={name}>
                  <span>{name}</span>
                  <strong>{room.players[name]?.score ?? 0}</strong>
                  <small>{room.players[name]?.correct ?? 0} correct</small>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="team-final-score">
                {(room?.coop?.score ?? 0).toLocaleString()}
              </div>
              <p>{room?.coop?.correct ?? 0} answers solved together</p>
            </>
          )}
          <button type="button" className="primary-cta" onClick={leaveRoom}>
            BACK HOME <span aria-hidden="true">→</span>
          </button>
        </section>
      </main>
    );
  }

  const score = room?.mode === "coop" ? room.coop?.score ?? 0 : myState?.score ?? 0;
  const combo = room?.mode === "coop" ? room.coop?.combo ?? 0 : myState?.combo ?? 0;
  const lives = room?.coop?.lives ?? 3;

  return (
    <main className={`game-shell multiplayer-game feedback-${feedback}`}>
      {multiplayerHeader}
      <section className="play-area" aria-live="polite">
        {room?.mode === "race" ? (
          <div className="race-scoreboard">
            {PLAYERS.map((name) => (
              <div className={name === player ? "me" : ""} key={name}>
                <span>{name}</span>
                <strong>{room.players[name]?.score ?? 0}</strong>
              </div>
            ))}
            <div className={`timer ${timeLeft <= 10 ? "danger" : ""}`}>
              <span>TIME</span>
              <strong>{timeLeft}</strong>
            </div>
          </div>
        ) : (
          <div className="coop-status">
            <div className="team-score">
              <span>TEAM SCORE</span>
              <strong>{score.toLocaleString()}</strong>
            </div>
            <div className="turn-banner">
              <span>NOW ANSWERING</span>
              <strong>{room?.coop?.currentTurn}</strong>
            </div>
            <div className={`timer ${timeLeft <= 10 ? "danger" : ""}`}>
              <span>TIME</span>
              <strong>{timeLeft}</strong>
            </div>
          </div>
        )}

        <div className="question-card">
          <div className="question-kicker">
            {!connected
              ? "RECONNECTING…"
              : !myTurn
                ? `${opponentName} is answering…`
                : message}
          </div>
          <div
            className="equation"
            aria-label={`${question.a} times ${question.b}`}
          >
            <span>{question.a}</span>
            <span className="times">×</span>
            <span>{question.b}</span>
            <span className="equals">=</span>
            <span className={`answer-slot ${answer ? "filled" : ""}`}>
              {myTurn ? answer || "?" : "…"}
            </span>
          </div>
          <div className="micro-copy">
            {room?.mode === "coop"
              ? myTurn
                ? `${playerLabel(player)} — your turn!`
                : `Pass the moment to ${opponentName}`
              : `You: ${score} • combo ${combo}× • wrong answer −50`}
          </div>
        </div>

        {room?.mode === "coop" && (
          <div className="coop-lives" aria-label={`${lives} team lives remaining`}>
            <span>TEAM HEARTS</span>
            {[0, 1, 2].map((heart) => (
              <b
                key={heart}
                className={heart < lives ? "heart live" : "heart lost"}
                aria-hidden="true"
              >
                ♥
              </b>
            ))}
          </div>
        )}

        <div className="number-pad" aria-label="Answer keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => enterDigit(digit)}
              disabled={gameLocked}
              aria-label={digit}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className="delete-key"
            onClick={eraseDigit}
            disabled={gameLocked}
            aria-label="Delete last digit"
          >
            ⌫
          </button>
          <button
            type="button"
            onClick={() => enterDigit("0")}
            disabled={gameLocked}
            aria-label="0"
          >
            0
          </button>
          <button
            type="button"
            className="go-key"
            onClick={submitAnswer}
            disabled={gameLocked || !answer}
          >
            GO
          </button>
        </div>
        {error && <div className="room-error compact-error">{error}</div>}
      </section>
    </main>
  );
}

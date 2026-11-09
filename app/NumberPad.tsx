"use client";

import {
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { pointerEndedInsideKey } from "./keypad-core";

type KeyButtonProps = {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onActivate: () => void;
};

type NumberPadProps = {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  disabled?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  ariaLabel?: string;
  className?: string;
};

function KeyButton({
  children,
  ariaLabel,
  className = "",
  disabled = false,
  onActivate,
}: KeyButtonProps) {
  const [pressed, setPressed] = useState(false);
  const touchPointer = useRef<number | null>(null);
  const suppressClickUntil = useRef(0);

  function finishTouch(event: PointerEvent<HTMLButtonElement>) {
    if (touchPointer.current !== event.pointerId) return;

    const button = event.currentTarget;
    const endedInside = pointerEndedInsideKey(
      button.getBoundingClientRect(),
      event.clientX,
      event.clientY,
    );

    touchPointer.current = null;
    setPressed(false);
    suppressClickUntil.current = performance.now() + 750;

    if (button.hasPointerCapture?.(event.pointerId)) {
      button.releasePointerCapture(event.pointerId);
    }
    if (endedInside && !disabled) onActivate();
  }

  function cancelTouch(event: PointerEvent<HTMLButtonElement>) {
    if (touchPointer.current !== event.pointerId) return;
    touchPointer.current = null;
    setPressed(false);
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const isSyntheticTouchClick =
      event.detail > 0 && performance.now() < suppressClickUntil.current;
    if (isSyntheticTouchClick) {
      event.preventDefault();
      return;
    }
    onActivate();
  }

  return (
    <button
      type="button"
      className={`${className} ${pressed ? "keypad-pressed" : ""}`.trim()}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={handleClick}
      onPointerDown={(event) => {
        if (
          disabled ||
          event.pointerType === "mouse" ||
          !event.isPrimary ||
          event.button !== 0
        ) {
          return;
        }
        touchPointer.current = event.pointerId;
        setPressed(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerUp={finishTouch}
      onPointerCancel={cancelTouch}
      onLostPointerCapture={() => {
        touchPointer.current = null;
        setPressed(false);
      }}
    >
      <span>{children}</span>
    </button>
  );
}

export default function NumberPad({
  onDigit,
  onDelete,
  onSubmit,
  disabled = false,
  submitDisabled = false,
  submitLabel = "GO",
  ariaLabel = "Answer keypad",
  className = "",
}: NumberPadProps) {
  return (
    <div className={`number-pad ${className}`.trim()} aria-label={ariaLabel}>
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
        <KeyButton
          key={digit}
          ariaLabel={digit}
          disabled={disabled}
          onActivate={() => onDigit(digit)}
        >
          {digit}
        </KeyButton>
      ))}
      <KeyButton
        className="delete-key"
        ariaLabel="Delete last digit"
        disabled={disabled}
        onActivate={onDelete}
      >
        ⌫
      </KeyButton>
      <KeyButton
        ariaLabel="0"
        disabled={disabled}
        onActivate={() => onDigit("0")}
      >
        0
      </KeyButton>
      <KeyButton
        className="go-key"
        ariaLabel={submitLabel}
        disabled={disabled || submitDisabled}
        onActivate={onSubmit}
      >
        {submitLabel}
      </KeyButton>
    </div>
  );
}

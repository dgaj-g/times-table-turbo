export type KeypadBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function pointerEndedInsideKey(
  bounds: KeypadBounds,
  clientX: number,
  clientY: number,
) {
  return (
    clientX >= bounds.left &&
    clientX <= bounds.right &&
    clientY >= bounds.top &&
    clientY <= bounds.bottom
  );
}

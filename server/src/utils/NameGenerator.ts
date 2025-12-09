export function generatePlayerName(): string {
  const num = Math.floor(Math.random() * 900) + 100; // 100-999
  return `Player ${num}`;
}

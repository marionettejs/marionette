let idCounter = 0;

export default function uniqueId(prefix?: string): string {
  const id = `${++idCounter}`;
  return prefix ? prefix + id : id;
}

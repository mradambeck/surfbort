export function cx(...names: Array<string | false | null | undefined>): string | undefined {
  const joined = names.filter(Boolean).join(" ");
  return joined || undefined;
}

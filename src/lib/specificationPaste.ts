export type SpecificationKV = {
  label: string;
  value: string;
};

const normalizeSpaces = (s: string) => s.replace(/\s+/g, " ").trim();

const findFirstNonSpaceUpperBoundary = (line: string): number | null => {
  // Finds a boundary like: "PackerSalty" -> split before "S"
  // Also works for: "Generic NameRing Watch" -> split before "R"
  for (let i = 1; i < line.length; i++) {
    const prev = line[i - 1];
    const curr = line[i];
    if (prev === " " || curr === " ") continue;
    const isPrevLower = prev >= "a" && prev <= "z";
    const isCurrUpper = curr >= "A" && curr <= "Z";
    if (isPrevLower && isCurrUpper) return i;
  }
  return null;
};

export const parseSpecificationLine = (rawLine: string): SpecificationKV | null => {
  const line = normalizeSpaces(rawLine);
  if (!line) return null;

  // 1) Common explicit separators
  // Avoid treating hyphens as separators because they frequently appear in addresses
  // (e.g. "Delhi - 110020"), which would cause incorrect splits.
  const explicitSeparators = [":", "\t", "=", "|", "→"];
  for (const sep of explicitSeparators) {
    const idx = line.indexOf(sep);
    if (idx > 0) {
      const label = normalizeSpaces(line.slice(0, idx));
      const value = normalizeSpaces(line.slice(idx + sep.length));
      if (label && value) return { label, value };
    }
  }

  // 2) Camel boundary: "PackerSalty ..." -> label="Packer", value="Salty ..."
  const upperBoundary = findFirstNonSpaceUpperBoundary(line);
  if (upperBoundary && upperBoundary > 0 && upperBoundary <= 40) {
    const label = normalizeSpaces(line.slice(0, upperBoundary));
    const value = normalizeSpaces(line.slice(upperBoundary));
    if (label && value) return { label, value };
  }

  // 3) If the first digit starts the value: "Item Weight25 g" -> label="Item Weight", value="25 g"
  const digitIdx = line.search(/\d/);
  if (digitIdx > 0) {
    const label = normalizeSpaces(line.slice(0, digitIdx));
    const value = normalizeSpaces(line.slice(digitIdx));
    if (label && value) return { label, value };
  }

  return null;
};

export const parseSpecificationsFromText = (text: string): SpecificationKV[] => {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  const items: SpecificationKV[] = [];
  for (const line of lines) {
    const kv = parseSpecificationLine(line);
    if (kv) items.push(kv);
  }

  // De-dupe by label (keep first)
  const seen = new Set<string>();
  return items.filter((it) => {
    const key = it.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

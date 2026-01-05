export type InferredPlatform =
  | "instagram"
  | "x"
  | "twitter"
  | "linkedin"
  | "github"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "medium"
  | "website";

export function inferPlatformFromUrl(url: string): InferredPlatform | undefined {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "x.com" || host.endsWith(".x.com")) return "x";
    if (host === "twitter.com" || host.endsWith(".twitter.com")) return "twitter";
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
    if (host === "github.com" || host.endsWith(".github.com")) return "github";
    if (host === "facebook.com" || host.endsWith(".facebook.com")) return "facebook";
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "youtube";
    if (host === "medium.com" || host.endsWith(".medium.com")) return "medium";
    return "website";
  } catch {
    return undefined;
  }
}

export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "https://" + trimmed;
}

export function buildInstagramUrl(instagramId: string): string {
  const id = instagramId.trim().replace(/^@+/, "");
  return "https://instagram.com/" + id;
}

export function buildXUrl(xId: string): string {
  const id = xId.trim().replace(/^@+/, "");
  return "https://x.com/" + id;
}

function isSafeHref(href: string) {
  const lower = href.trim().toLowerCase();
  return (
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("mailto:")
  );
}

export function sanitizeRichTextHtml(input: string): string {
  if (!input) return "";
  if (typeof DOMParser === "undefined") {
    // Best-effort fallback for non-browser environments.
    return input.replace(/<script[\s\S]*?<\/script>/gi, "");
  }

  const allowedTags = new Set([
    "P", "BR", "STRONG", "EM", "U",
    "UL", "OL", "LI", "A",
    "H1", "H2", "H3",
    "BLOCKQUOTE", "CODE", "PRE"
  ]);

  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");

  const unwrap = (el: Element) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (!allowedTags.has(el.tagName)) {
        unwrap(el);
        return;
      }

      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        if (el.tagName === "A" && (name === "href" || name === "target" || name === "rel")) continue;
        el.removeAttribute(attr.name);
      }

      if (el.tagName === "A") {
        const href = el.getAttribute("href") ?? "";
        if (!isSafeHref(href)) {
          el.removeAttribute("href");
        } else {
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noreferrer noopener");
        }
      }
    }

    const children = Array.from(node.childNodes);
    for (const child of children) walk(child);
  };

  walk(doc.body);
  return doc.body.innerHTML;
}

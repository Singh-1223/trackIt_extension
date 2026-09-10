import type { CSSProperties } from "react";

interface MarkdownRendererProps {
  content: string;
}

type InlineSegment =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string };

function parseInline(line: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: line.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      segments.push({ type: "bold", text: match[2] });
    } else if (match[3]) {
      segments.push({ type: "italic", text: match[3] });
    } else if (match[4]) {
      segments.push({ type: "code", text: match[4] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    segments.push({ type: "text", text: line.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ type: "text", text: line });
  }

  return segments;
}

const codeStyle: CSSProperties = {
  backgroundColor: "var(--surface-strong)",
  padding: "1px 5px",
  borderRadius: 3,
  fontFamily: "monospace",
  fontSize: "0.85em",
};

function InlineContent({ segments }: { segments: InlineSegment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case "bold":
            return <strong key={i} style={{ fontWeight: 700 }}>{seg.text}</strong>;
          case "italic":
            return <em key={i} style={{ fontStyle: "italic" }}>{seg.text}</em>;
          case "code":
            return <code key={i} style={codeStyle}>{seg.text}</code>;
          default:
            return <span key={i}>{seg.text}</span>;
        }
      })}
    </>
  );
}

type LineBlock =
  | { type: "h1"; content: string }
  | { type: "h2"; content: string }
  | { type: "h3"; content: string }
  | { type: "bullet"; content: string; level: number }
  | { type: "numbered"; content: string; number: string; level: number }
  | { type: "hr" }
  | { type: "empty" }
  | { type: "paragraph"; content: string };

// Count the indentation level from leading whitespace. Every 2 spaces (or a
// tab) counts as one nesting level so indented "- " lines become nested bullets.
function indentLevel(leading: string): number {
  let spaces = 0;
  for (const ch of leading) {
    spaces += ch === "\t" ? 2 : 1;
  }
  return Math.min(Math.floor(spaces / 2), 6);
}

function parseLine(line: string): LineBlock {
  if (line.startsWith("### ")) return { type: "h3", content: line.slice(4) };
  if (line.startsWith("## ")) return { type: "h2", content: line.slice(3) };
  if (line.startsWith("# ")) return { type: "h1", content: line.slice(2) };

  if (/^---+\s*$/.test(line)) return { type: "hr" };

  const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
  if (bulletMatch) return { type: "bullet", content: bulletMatch[2], level: indentLevel(bulletMatch[1]) };

  const numMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (numMatch) return { type: "numbered", content: numMatch[3], number: numMatch[2], level: indentLevel(numMatch[1]) };

  if (line.trim() === "") return { type: "empty" };

  return { type: "paragraph", content: line };
}

type ListItem = { content: string; number?: string; level: number; key: number };

// CSS list-style markers cycle by nesting depth so levels are visually distinct.
const UL_MARKERS = ["disc", "circle", "square"];

// Build a nested <ul>/<ol> tree from a flat list of items that carry a `level`.
// Items deeper than the current level become children of the preceding item.
function renderList(items: ListItem[], ordered: boolean): JSX.Element {
  const baseLevel = items[0].level;
  const Tag = ordered ? "ol" : "ul";
  const marker = ordered ? "decimal" : UL_MARKERS[baseLevel % UL_MARKERS.length];
  const children: JSX.Element[] = [];
  let idx = 0;

  while (idx < items.length) {
    const item = items[idx];
    // Collect any deeper-nested items that follow this one into a sublist.
    const nested: ListItem[] = [];
    let j = idx + 1;
    while (j < items.length && items[j].level > baseLevel) {
      nested.push(items[j]);
      j++;
    }
    children.push(
      <li key={item.key} style={{ margin: "2px 0", lineHeight: 1.6, color: "var(--ink)" }}>
        <InlineContent segments={parseInline(item.content)} />
        {nested.length > 0 ? renderList(nested, nested[0].number !== undefined) : null}
      </li>
    );
    idx = j;
  }

  return (
    <Tag key={items[0].key} style={{ paddingLeft: 18, margin: "0 0 6px", listStyleType: marker }}>
      {children}
    </Tag>
  );
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const blocks = lines.map(parseLine);

  // Group consecutive bullets / numbered items into lists
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    switch (block.type) {
      case "h1":
        elements.push(
          <h1 key={i} style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 8px", color: "var(--ink)" }}>
            {block.content}
          </h1>
        );
        break;
      case "h2":
        elements.push(
          <h2 key={i} style={{ fontSize: "1.15rem", fontWeight: 700, margin: "12px 0 6px", color: "var(--ink)" }}>
            {block.content}
          </h2>
        );
        break;
      case "h3":
        elements.push(
          <h3 key={i} style={{ fontSize: "1rem", fontWeight: 700, margin: "10px 0 4px", color: "var(--ink)" }}>
            {block.content}
          </h3>
        );
        break;
      case "hr":
        elements.push(
          <hr key={i} style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0" }} />
        );
        break;
      case "empty":
        elements.push(<div key={i} style={{ height: 6 }} />);
        break;
      case "bullet": {
        const items: ListItem[] = [];
        while (i < blocks.length && blocks[i].type === "bullet") {
          const b = blocks[i] as { type: "bullet"; content: string; level: number };
          items.push({ content: b.content, level: b.level, key: i });
          i++;
        }
        elements.push(renderList(items, false));
        continue; // skip i++ at end
      }
      case "numbered": {
        const items: ListItem[] = [];
        while (i < blocks.length && blocks[i].type === "numbered") {
          const b = blocks[i] as { type: "numbered"; content: string; number: string; level: number };
          items.push({ content: b.content, number: b.number, level: b.level, key: i });
          i++;
        }
        elements.push(renderList(items, true));
        continue; // skip i++ at end
      }
      case "paragraph":
        elements.push(
          <p key={i} style={{ margin: "0 0 6px", lineHeight: 1.6, color: "var(--ink)" }}>
            <InlineContent segments={parseInline(block.content)} />
          </p>
        );
        break;
    }

    i++;
  }

  return <div style={{ wordBreak: "break-word" }}>{elements}</div>;
}

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontSize, spacing } from "../theme";

interface MarkdownRendererProps {
  content: string;
  selectable?: boolean;
}

type InlineSegment =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string };

function parseInline(line: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  // Match **bold**, *italic*, or `code`
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    // Text before the match
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

  // Remaining text
  if (lastIndex < line.length) {
    segments.push({ type: "text", text: line.slice(lastIndex) });
  }

  // If nothing was parsed, return the whole line as text
  if (segments.length === 0) {
    segments.push({ type: "text", text: line });
  }

  return segments;
}

function InlineText({ segments, selectable }: { segments: InlineSegment[]; selectable: boolean }) {
  return (
    <Text selectable={selectable} style={s.paragraph}>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case "bold":
            return <Text key={i} style={s.bold}>{seg.text}</Text>;
          case "italic":
            return <Text key={i} style={s.italic}>{seg.text}</Text>;
          case "code":
            return <Text key={i} style={s.code}>{seg.text}</Text>;
          default:
            return <Text key={i}>{seg.text}</Text>;
        }
      })}
    </Text>
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
// tab) counts as one nesting level so that indented "- " lines become nested
// bullets. Levels are capped to keep deeply indented text readable.
function indentLevel(leading: string): number {
  let spaces = 0;
  for (const ch of leading) {
    spaces += ch === "\t" ? 2 : 1;
  }
  return Math.min(Math.floor(spaces / 2), 6);
}

function parseLine(line: string): LineBlock {
  // Headings
  if (line.startsWith("### ")) return { type: "h3", content: line.slice(4) };
  if (line.startsWith("## ")) return { type: "h2", content: line.slice(3) };
  if (line.startsWith("# ")) return { type: "h1", content: line.slice(2) };

  // Horizontal rule
  if (/^---+\s*$/.test(line)) return { type: "hr" };

  // Bullet points (support leading indentation for nesting)
  const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
  if (bulletMatch) {
    return { type: "bullet", content: bulletMatch[2], level: indentLevel(bulletMatch[1]) };
  }

  // Numbered list (support leading indentation for nesting)
  const numMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (numMatch) {
    return { type: "numbered", content: numMatch[3], number: numMatch[2], level: indentLevel(numMatch[1]) };
  }

  // Empty line
  if (line.trim() === "") return { type: "empty" };

  // Regular paragraph
  return { type: "paragraph", content: line };
}

// Bullet markers cycle by depth so nested levels are visually distinct.
const BULLET_MARKERS = ["•", "◦", "▪"];

export function MarkdownRenderer({ content, selectable = true }: MarkdownRendererProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const blocks = lines.map(parseLine);

  return (
    <View>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h1":
            return (
              <Text key={i} selectable={selectable} style={s.h1}>
                {block.content}
              </Text>
            );
          case "h2":
            return (
              <Text key={i} selectable={selectable} style={s.h2}>
                {block.content}
              </Text>
            );
          case "h3":
            return (
              <Text key={i} selectable={selectable} style={s.h3}>
                {block.content}
              </Text>
            );
          case "hr":
            return <View key={i} style={s.hr} />;
          case "empty":
            return <View key={i} style={s.emptyLine} />;
          case "bullet":
            return (
              <View key={i} style={[s.listRow, { paddingLeft: spacing.sm + block.level * spacing.lg }]}>
                <Text selectable={selectable} style={s.bullet}>
                  {BULLET_MARKERS[block.level % BULLET_MARKERS.length]}
                </Text>
                <View style={s.listContent}>
                  <InlineText segments={parseInline(block.content)} selectable={selectable} />
                </View>
              </View>
            );
          case "numbered":
            return (
              <View key={i} style={[s.listRow, { paddingLeft: spacing.sm + block.level * spacing.lg }]}>
                <Text selectable={selectable} style={s.bullet}>{block.number}.</Text>
                <View style={s.listContent}>
                  <InlineText segments={parseInline(block.content)} selectable={selectable} />
                </View>
              </View>
            );
          case "paragraph":
            return (
              <View key={i} style={s.paragraphWrap}>
                <InlineText segments={parseInline(block.content)} selectable={selectable} />
              </View>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}

const s = StyleSheet.create({
  h1: {
    fontSize: fontSize.xl,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  h2: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  h3: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginVertical: spacing.sm,
  },
  emptyLine: {
    height: spacing.sm,
  },
  listRow: {
    flexDirection: "row",
    paddingLeft: spacing.sm,
    marginBottom: spacing.xs,
  },
  bullet: {
    fontSize: fontSize.base,
    color: colors.ink,
    width: 20,
    lineHeight: 22,
  },
  listContent: {
    flex: 1,
  },
  paragraphWrap: {
    marginBottom: spacing.xs,
  },
  paragraph: {
    fontSize: fontSize.base,
    color: colors.ink,
    lineHeight: 22,
  },
  bold: {
    fontWeight: "700",
  },
  italic: {
    fontStyle: "italic",
  },
  code: {
    backgroundColor: colors.bg,
    paddingHorizontal: 4,
    borderRadius: 3,
    fontFamily: "monospace",
    fontSize: fontSize.sm,
  },
});

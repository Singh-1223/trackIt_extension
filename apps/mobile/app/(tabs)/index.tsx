import { useAuth } from "@clerk/clerk-expo";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GroupSection } from "../../components/GroupSection";
import { HabitView } from "../../components/HabitView";
import { SyncStatusIndicator } from "../../components/SyncStatusIndicator";
import { TodoList } from "../../components/TodoList";
import { useStoreContext } from "../../hooks/StoreContext";
import { formatNanakshahiDate } from "../../lib/nanakshahi";
import { ensureSnapshot, upsertEntry } from "../../lib/store";
import { formatDateLabel, getLastNDays, getTodayString } from "../../lib/utils";
import { colors, fontSize, radius, shadow, spacing, TOP_PADDING } from "../../theme";
import type { TrackItStore } from "../../types/index";

const TODAY = getTodayString();
const ENGLISH_DAY = new Intl.DateTimeFormat("en", { weekday: "long" }).format(new Date());
const ENGLISH_DATE = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date());
const NANAKSHAHI_DATE = formatNanakshahiDate();

export default function TodayScreen() {
  const { store, loading, error, syncStatus, save } = useStoreContext();
  const { signOut } = useAuth();

  if (loading || !store) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Loading…</Text>
      </View>
    );
  }

  const sortedGroups = [...store.groups].sort((a, b) => a.order - b.order);
  const todayEntries = store.entries.filter((e) => e.date === TODAY);
  const past7Days = getLastNDays(8).slice(1);
  const pendingTodos = store.todos.filter((t) => !t.done);
  const recentNotes = [...store.notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

  function handleUpdate(date: string, taskId: string, patch: { done: boolean; comment: string }) {
    const snapshotStore = ensureSnapshot(store!, date);
    const updatedEntries = upsertEntry(snapshotStore.entries, { date, taskId, ...patch });
    save({ ...snapshotStore, entries: updatedEntries });
  }

  function handleTodoSave(updated: TrackItStore["todos"]) {
    save({ ...store!, todos: updated });
  }

  function handleHabitSave(updated: TrackItStore) {
    save(updated);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {/* Hero */}
      <View style={s.hero}>
        <View style={s.heroTop}>
          <View style={s.badge}>
            <Text style={s.badgeText}>TrackIt</Text>
          </View>
          <View style={s.heroRight}>
            <SyncStatusIndicator status={syncStatus} />
            <Text style={s.dateText}>{ENGLISH_DAY}, {ENGLISH_DATE}</Text>
            <TouchableOpacity onPress={() => signOut()} style={s.signOutBtn}>
              <Text style={s.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={s.heroTitle}> ਸ. ਮ. ਸ. ਦ. ਮ. ਦ. ਕ. ਰ. ਲ. </Text>
        <Text style={s.nanakshahiDate}>{NANAKSHAHI_DATE}</Text>
      </View>

      {error ? <Text style={s.errorText}>{error}</Text> : null}

      {/* Daily Grind — wraps all task group accordions */}
      {sortedGroups.length === 0 ? (
        <Text style={s.empty}>No task groups yet. Go to Manage to create some.</Text>
      ) : (
        <Accordion
          label="Daily Grind"
          badge={`${todayEntries.filter((e) => e.done).length} / ${store.tasks.length}`}
        >
          {sortedGroups.map((group) => {
            const groupTasks = store.tasks
              .filter((t) => t.groupId === group.id)
              .sort((a, b) => a.order - b.order);
            return (
              <GroupSection
                key={group.id}
                group={group}
                tasks={groupTasks}
                entries={todayEntries}
                onUpdate={(taskId, patch) => handleUpdate(TODAY, taskId, patch)}
              />
            );
          })}
        </Accordion>
      )}

      {/* To-Dos compact accordion */}
      <Accordion
        label="To-Dos"
        badge={pendingTodos.length > 0 ? `${pendingTodos.length} pending` : undefined}
      >
        {pendingTodos.length === 0 ? (
          <Text style={s.muted}>No pending to-dos.</Text>
        ) : (
          <TodoList todos={store.todos} onSave={handleTodoSave} compact today={TODAY} />
        )}
      </Accordion>

      {/* Notes compact accordion */}
      <Accordion
        label="Notes"
        badge={store.notes.length > 0 ? `${store.notes.length}` : undefined}
      >
        {recentNotes.length === 0 ? (
          <Text style={s.muted}>No notes yet.</Text>
        ) : (
          <>
            {recentNotes.map((note) => (
              <Accordion key={note.id} label={note.heading} nested>
                {note.description ? (
                  <Text selectable style={s.noteDescExpanded}>{note.description}</Text>
                ) : (
                  <Text style={s.muted}>No description.</Text>
                )}
              </Accordion>
            ))}
            {store.notes.length > 5 && (
              <Text style={s.muted}>+{store.notes.length - 5} more — open Notes tab to see all</Text>
            )}
          </>
        )}
      </Accordion>

      {/* Build-Up compact accordion */}
      <Accordion
        label="Build-Up"
        badge={store.habits.length > 0 ? `${store.habits.length} habit${store.habits.length === 1 ? "" : "s"}` : undefined}
      >
        <HabitView store={store} onSave={handleHabitSave} compact />
      </Accordion>

      {/* Library compact accordion */}
      <Accordion
        label="Library"
        badge={(store.books ?? []).filter((b) => b.status === "reading").length > 0
          ? `${(store.books ?? []).filter((b) => b.status === "reading").length} reading`
          : undefined}
      >
        {(store.books ?? []).filter((b) => b.status === "reading").length === 0 ? (
          <Text style={s.muted}>No books currently reading.</Text>
        ) : (
          (store.books ?? []).filter((b) => b.status === "reading").map((book) => (
            <BookAccordion key={book.id} book={book} />
          ))
        )}
      </Accordion>

      {/* Past 7 days accordion */}
      {sortedGroups.length > 0 && (
        <Accordion label="Past 7 Days">
          {past7Days.map((date) => {
            const dateEntries = store.entries.filter((e) => e.date === date);
            const doneCount = dateEntries.filter((e) => e.done).length;
            const snapshot = store.snapshots?.find((s) => s.date === date);
            const totalCount = snapshot ? snapshot.tasks.length : store.tasks.length;
            const activeTasks = snapshot ? snapshot.tasks : store.tasks;
            const activeGroups = snapshot ? snapshot.groups : store.groups;
            const dateSortedGroups = [...activeGroups].sort((a, b) => a.order - b.order);
            return (
              <Accordion
                key={date}
                label={formatDateLabel(date)}
                badge={`${doneCount} / ${totalCount}`}
                nested
              >
                {dateSortedGroups.map((group) => {
                  const groupTasks = activeTasks
                    .filter((t) => t.groupId === group.id)
                    .sort((a, b) => a.order - b.order);
                  if (groupTasks.length === 0) return null;
                  return (
                    <GroupSection
                      key={group.id}
                      group={group}
                      tasks={groupTasks}
                      entries={dateEntries}
                      onUpdate={(taskId, patch) => handleUpdate(date, taskId, patch)}
                      commentPlaceholder={`Note for ${formatDateLabel(date)}…`}
                    />
                  );
                })}
              </Accordion>
            );
          })}
        </Accordion>
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function Accordion({
  label,
  badge,
  children,
  nested = false,
}: {
  label: string;
  badge?: string;
  children: React.ReactNode;
  nested?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={[accordionS.container, nested && accordionS.nested]}>
      <TouchableOpacity style={accordionS.header} onPress={() => setOpen((v: boolean) => !v)}>
        <Text style={accordionS.chevron}>{open ? "▾" : "▸"}</Text>
        <Text style={[accordionS.label, nested && accordionS.labelNested]}>{label}</Text>
        {badge && (
          <View style={accordionS.badge}>
            <Text style={accordionS.badgeText}>{badge}</Text>
          </View>
        )}
      </TouchableOpacity>
      {open && <View style={accordionS.body}>{children}</View>}
    </View>
  );
}

function BookAccordion({ book }: { book: TrackItStore["books"][number] }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={[accordionS.container, accordionS.nested]}>
      <TouchableOpacity style={accordionS.header} onPress={() => setOpen((v) => !v)}>
        <Text style={accordionS.chevron}>{open ? "▾" : "▸"}</Text>
        <View style={s.bookLabelRow}>
          <Text style={s.bookTitle}>{book.title}</Text>
          {book.author ? <Text style={s.bookAuthor}> — {book.author}</Text> : null}
        </View>
      </TouchableOpacity>
      {open && (
        <View style={accordionS.body}>
          {book.notes.length === 0 ? (
            <Text style={s.muted}>No notes yet.</Text>
          ) : (
            book.notes.map((note) => (
              <View key={note.id} style={s.bookNoteRow}>
                <Text selectable style={s.noteDescExpanded}>{note.text}</Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingTop: TOP_PADDING },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  hero: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  badgeText: { color: colors.white, fontSize: fontSize.xs, fontWeight: "700", letterSpacing: 0.5 },
  heroRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dateText: { fontSize: fontSize.xs, color: colors.inkSoft },
  signOutBtn: { paddingHorizontal: spacing.xs, paddingVertical: 2 },
  signOutText: { fontSize: fontSize.xs, color: colors.accentStrong, fontWeight: "600" },
  heroTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  nanakshahiDate: { fontSize: fontSize.sm, color: colors.inkSoft, fontWeight: "600" },
  heroSub: { fontSize: fontSize.sm, color: colors.inkSoft, lineHeight: 20 },
  errorText: { fontSize: fontSize.sm, color: colors.danger, marginBottom: spacing.sm },
  muted: { fontSize: fontSize.sm, color: colors.inkSoft, paddingVertical: spacing.xs },
  empty: { fontSize: fontSize.sm, color: colors.inkSoft, marginBottom: spacing.sm },
  noteRow: { paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  noteHeading: { fontSize: fontSize.sm, fontWeight: "600", color: colors.ink },
  noteDesc: { fontSize: fontSize.xs, color: colors.inkSoft, marginTop: 2, lineHeight: 18 },
  noteDescExpanded: { fontSize: 16, color: colors.ink, lineHeight: 26, paddingVertical: spacing.xs },
  bookNoteRow: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.xs },
  bookLabelRow: { flex: 1, flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" },
  bookTitle: { fontSize: fontSize.sm, fontWeight: "700", color: colors.ink },
  bookAuthor: { fontSize: fontSize.xs, fontStyle: "italic", color: colors.inkSoft },
});

const accordionS = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  nested: { borderRadius: radius.sm, backgroundColor: colors.bg, marginBottom: spacing.xs },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xs,
  },
  chevron: { fontSize: fontSize.base, color: colors.inkSoft, width: 14 },
  label: { flex: 1, fontSize: fontSize.base, fontWeight: "700", color: colors.ink },
  labelNested: { fontSize: fontSize.sm },
  badge: { backgroundColor: colors.border, borderRadius: 20, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: fontSize.xs, color: colors.inkSoft, fontWeight: "600" },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
});

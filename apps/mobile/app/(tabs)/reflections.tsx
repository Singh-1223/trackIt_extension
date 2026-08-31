import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useStoreContext } from "../../hooks/StoreContext";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import { generateId } from "../../lib/utils";
import { colors, fontSize, radius, spacing, TOP_PADDING } from "../../theme";
import type { Reflection, ReflectionCategory, ReflectionDate } from "../../types/index";

const DEFAULT_CATEGORIES: ReflectionCategory[] = [
  { id: "reflection-daily", name: "Daily Reflections", icon: "sunny", color: "#fbe6dc", order: 0 },
  { id: "reflection-gratitude", name: "Gratitude / Grace", icon: "heart", color: "#fce7d7", order: 1 },
  { id: "reflection-memories", name: "Memories", icon: "sparkles", color: "#eee5fb", order: 2 },
];
const CATEGORY_COLORS = ["#fbe6dc", "#fce7d7", "#eee5fb", "#dff1ee", "#e6edfb"];

function formatDate(date: ReflectionDate) {
  if (date.precision === "unknown") return "Date unknown";
  if (date.precision === "year") return String(date.year);
  const month = new Date(date.year, date.month - 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return date.precision === "month" ? month : new Date(date.year, date.month - 1, date.day).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function timelineLabel(date: ReflectionDate) {
  if (date.precision === "unknown") return "Date unknown";
  if (date.precision === "year") return String(date.year);
  return new Date(date.year, date.month - 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function dateWeight(date: ReflectionDate) {
  if (date.precision === "unknown") return -1;
  return date.year * 100 + (date.precision === "year" ? 0 : date.month);
}

function makeDate(precision: ReflectionDate["precision"], year: string, month: string, day: string): ReflectionDate | null {
  if (precision === "unknown") return { precision };
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || y < 1 || (precision !== "year" && (!Number.isInteger(m) || m < 1 || m > 12)) || (precision === "day" && (!Number.isInteger(d) || d < 1 || d > 31))) return null;
  if (precision === "year") return { precision, year: y };
  if (precision === "month") return { precision, year: y, month: m };
  return { precision, year: y, month: m, day: d };
}

export default function ReflectionsScreen() {
  const { store, loading, save } = useStoreContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [activeEntry, setActiveEntry] = useState<Reflection | null>(null);
  const [editing, setEditing] = useState<Reflection | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [entryCategoryId, setEntryCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsText, setTagsText] = useState("");
  const today = new Date();
  const [precision, setPrecision] = useState<ReflectionDate["precision"]>("day");
  const [year, setYear] = useState(String(today.getFullYear()));
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [day, setDay] = useState(String(today.getDate()));

  const categories = useMemo(() => (store?.reflectionCategories?.length ? store.reflectionCategories : DEFAULT_CATEGORIES).slice().sort((a, b) => a.order - b.order), [store?.reflectionCategories]);

  useEffect(() => {
    if (store && !store.reflectionCategories?.length) void save({ ...store, reflectionCategories: DEFAULT_CATEGORIES });
  }, [store, save]);

  if (loading || !store) return <View style={s.center}><Text>Loading…</Text></View>;

  const openComposer = (entry?: Reflection) => {
    const baseDate = entry?.date ?? { precision: "day" as const, year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };
    setEditing(entry ?? null);
    setEntryCategoryId(entry?.categoryId ?? selectedId ?? "");
    setTitle(entry?.title ?? ""); setContent(entry?.content ?? ""); setTagsText(entry?.tags.join(", ") ?? "");
    setPrecision(baseDate.precision); setYear(baseDate.precision === "unknown" ? "" : String(baseDate.year));
    setMonth(baseDate.precision === "day" || baseDate.precision === "month" ? String(baseDate.month) : "");
    setDay(baseDate.precision === "day" ? String(baseDate.day) : "");
    setActiveEntry(null); setComposerOpen(true);
  };

  const saveEntry = () => {
    if (!title.trim()) return Alert.alert("Add a title", "A reflection needs a short title.");
    const date = makeDate(precision, year, month, day);
    if (!date) return Alert.alert("Check the date", "Use a valid year, month, and day, or select Date unknown.");
    const now = Date.now();
    const entry: Reflection = { id: editing?.id ?? generateId("reflection"), categoryId: entryCategoryId || undefined, title: title.trim(), content: content.trim(), date, tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean), createdAt: editing?.createdAt ?? now, updatedAt: now };
    save({ ...store, reflections: editing ? (store.reflections ?? []).map((item) => item.id === editing.id ? entry : item) : [...(store.reflections ?? []), entry] });
    if (entry.categoryId) setSelectedId(entry.categoryId);
    setComposerOpen(false);
  };

  const deleteEntry = (entry: Reflection) => Alert.alert("Delete reflection?", "This cannot be undone.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => { save({ ...store, reflections: (store.reflections ?? []).filter((item) => item.id !== entry.id) }); setActiveEntry(null); } },
  ]);

  const createCategory = () => {
    const name = categoryName.trim();
    if (!name) return;
    const category: ReflectionCategory = { id: generateId("reflection-category"), name, icon: "folder", color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length], order: categories.length };
    save({ ...store, reflectionCategories: [...categories, category] }); setCategoryName("");
  };
  const renameCategory = (category: ReflectionCategory) => { setRenamingId(category.id); setRenameText(category.name); };
  const saveRename = () => { if (renamingId && renameText.trim()) save({ ...store, reflectionCategories: categories.map((item) => item.id === renamingId ? { ...item, name: renameText.trim() } : item) }); setRenamingId(null); setRenameText(""); };
  const deleteCategory = (category: ReflectionCategory) => Alert.alert("Delete this space?", `Its reflections will move to Unsorted.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => { save({ ...store, reflectionCategories: categories.filter((item) => item.id !== category.id), reflections: (store.reflections ?? []).map((entry) => entry.categoryId === category.id ? { ...entry, categoryId: undefined, updatedAt: Date.now() } : entry) }); if (selectedId === category.id) setSelectedId("unsorted"); } },
  ]);

  const selected = selectedId === "unsorted" ? { id: "unsorted", name: "Unsorted", icon: "folder", color: "#eee9e1", order: 999 } : categories.find((category) => category.id === selectedId);
  const selectedEntries = (store.reflections ?? []).filter((entry) => selectedId === "unsorted" ? !entry.categoryId : entry.categoryId === selectedId).sort((a, b) => b.updatedAt - a.updatedAt);
  const groups = Object.values(selectedEntries.reduce<Record<string, Reflection[]>>((result, entry) => { const label = timelineLabel(entry.date); (result[label] ??= []).push(entry); return result; }, {})).sort((a, b) => dateWeight(b[0].date) - dateWeight(a[0].date));
  const unsortedCount = (store.reflections ?? []).filter((entry) => !entry.categoryId).length;

  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    {selected ? <>
      <TouchableOpacity onPress={() => setSelectedId(null)} style={s.back}><Ionicons name="arrow-back" size={20} color={colors.ink} /><Text style={s.backText}>All spaces</Text></TouchableOpacity>
      <View style={[s.categoryHero, { backgroundColor: selected.color }]}><Ionicons name={selected.icon as never} size={25} color={colors.accentStrong} /><Text style={s.title}>{selected.name}</Text><Text style={s.sub}>{selectedEntries.length} reflection{selectedEntries.length === 1 ? "" : "s"}</Text></View>
      <Text style={s.section}>Timeline</Text>
      {groups.map((group) => <View key={timelineLabel(group[0].date)}><Text style={s.timelineLabel}>{timelineLabel(group[0].date)}</Text>{group.map((entry) => <ReflectionCard key={entry.id} entry={entry} onOpen={() => setActiveEntry(entry)} onEdit={() => openComposer(entry)} onDelete={() => deleteEntry(entry)} />)}</View>)}
      {selectedEntries.length === 0 && <Text style={s.empty}>No reflections here yet. Add the first one.</Text>}
    </> : <>
      <View style={s.headingRow}><View><Text style={s.title}>Reflections</Text><Text style={s.sub}>Keep what matters close.</Text></View><TouchableOpacity style={s.manageButton} onPress={() => setManagerOpen(true)} accessibilityLabel="Manage reflection spaces"><Ionicons name="options-outline" size={22} color={colors.accentStrong} /></TouchableOpacity></View>
      <Text style={s.section}>Your spaces</Text><View style={s.grid}>{categories.map((category) => <TouchableOpacity key={category.id} style={[s.categoryCard, { backgroundColor: category.color }]} onPress={() => setSelectedId(category.id)}><Ionicons name={category.icon as never} size={25} color={colors.accentStrong} /><Text style={s.categoryName}>{category.name}</Text><Text style={s.count}>{(store.reflections ?? []).filter((entry) => entry.categoryId === category.id).length} entries</Text></TouchableOpacity>)}</View>
      <TouchableOpacity style={s.unsortedCard} onPress={() => setSelectedId("unsorted")}><View><Text style={s.categoryName}>Unsorted</Text><Text style={s.count}>A place for uncategorized moments</Text></View><Text style={s.countBadge}>{unsortedCount}</Text></TouchableOpacity>
    </>}
    <TouchableOpacity style={s.addButton} onPress={() => openComposer()}><Ionicons name="add" size={28} color={colors.white} /></TouchableOpacity>
    <EntryComposer visible={composerOpen} onClose={() => setComposerOpen(false)} onSave={saveEntry} categories={categories} categoryId={entryCategoryId} setCategoryId={setEntryCategoryId} title={title} setTitle={setTitle} content={content} setContent={setContent} tags={tagsText} setTags={setTagsText} precision={precision} setPrecision={setPrecision} year={year} setYear={setYear} month={month} setMonth={setMonth} day={day} setDay={setDay} editing={Boolean(editing)} />
    <EntryDetail entry={activeEntry} onClose={() => setActiveEntry(null)} />
    <CategoryManager visible={managerOpen} categories={categories} categoryName={categoryName} setCategoryName={setCategoryName} renamingId={renamingId} renameText={renameText} setRenameText={setRenameText} onClose={() => setManagerOpen(false)} onCreate={createCategory} onRename={renameCategory} onSaveRename={saveRename} onDelete={deleteCategory} />
  </ScrollView>;
}

function ReflectionCard({ entry, onOpen, onEdit, onDelete }: { entry: Reflection; onOpen: () => void; onEdit: () => void; onDelete: () => void }) { return <View style={s.entry}><TouchableOpacity onPress={onOpen} activeOpacity={0.75}><Text style={s.entryDate}>{formatDate(entry.date)}</Text><Text style={s.entryTitle}>{entry.title}</Text>{entry.content ? <Text style={s.entryPreview} numberOfLines={2}>{entry.content}</Text> : null}{entry.tags.length > 0 && <Text style={s.tagPreview}>{entry.tags.map((tag) => `#${tag}`).join("  ")}</Text>}</TouchableOpacity><View style={s.cardActions}><TouchableOpacity style={s.cardIcon} onPress={onEdit} accessibilityLabel="Edit reflection"><Ionicons name="pencil-outline" size={18} color={colors.accentStrong} /></TouchableOpacity><TouchableOpacity style={s.cardIcon} onPress={onDelete} accessibilityLabel="Delete reflection"><Ionicons name="trash-outline" size={18} color="#b34837" /></TouchableOpacity></View></View>; }
function EntryComposer(props: any) { return <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}><View style={s.composerOverlay}><ScrollView contentContainerStyle={s.composerModal} keyboardShouldPersistTaps="handled"><View style={s.modalHead}><Text style={s.modalTitle}>{props.editing ? "Edit reflection" : "New reflection"}</Text><TouchableOpacity onPress={props.onClose}><Ionicons name="close" size={24} color={colors.inkSoft} /></TouchableOpacity></View><Text style={s.formLabel}>Add to a space</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.spacePicker}><Chip label="Unsorted" selected={!props.categoryId} onPress={() => props.setCategoryId("")} />{props.categories.map((category: ReflectionCategory) => <Chip key={category.id} label={category.name} selected={props.categoryId === category.id} onPress={() => props.setCategoryId(category.id)} />)}</ScrollView><TextInput style={s.input} placeholder="Title…" value={props.title} onChangeText={props.setTitle} /><Text style={s.formLabel}>Your reflection</Text><TextInput style={[s.input, s.textarea]} placeholder="Write what you want to remember… Markdown is supported." value={props.content} onChangeText={props.setContent} multiline scrollEnabled textAlignVertical="top" /><TextInput style={s.input} placeholder="Tags (comma separated, optional)" value={props.tags} onChangeText={props.setTags} /><Text style={s.formLabel}>When did this happen?</Text><View style={s.precision}>{(["day", "month", "year", "unknown"] as const).map((item) => <Chip key={item} label={item === "day" ? "Exact day" : item === "month" ? "Month" : item === "year" ? "Year" : "Unknown"} selected={props.precision === item} onPress={() => props.setPrecision(item)} />)}</View>{props.precision !== "unknown" && <View style={s.dateRow}><TextInput style={s.dateInput} value={props.year} onChangeText={props.setYear} keyboardType="number-pad" placeholder="Year" />{props.precision !== "year" && <TextInput style={s.dateInput} value={props.month} onChangeText={props.setMonth} keyboardType="number-pad" placeholder="Month" />}{props.precision === "day" && <TextInput style={s.dateInput} value={props.day} onChangeText={props.setDay} keyboardType="number-pad" placeholder="Day" />}</View>}<TouchableOpacity style={s.save} onPress={props.onSave}><Text style={s.saveText}>Save reflection</Text></TouchableOpacity></ScrollView></View></Modal>; }
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <TouchableOpacity style={[s.chip, selected && s.chipOn]} onPress={onPress}><Text style={[s.chipText, selected && s.chipTextOn]}>{label}</Text></TouchableOpacity>; }
function EntryDetail({ entry, onClose }: { entry: Reflection | null; onClose: () => void }) { if (!entry) return null; return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.readerOverlay}><View style={s.readerModal}><View style={s.modalHead}><Text style={s.modalTitle}>Reflection</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.inkSoft} /></TouchableOpacity></View><ScrollView showsVerticalScrollIndicator={false}><Text style={s.entryDate}>{formatDate(entry.date)}</Text>{entry.tags.length > 0 && <View style={s.tagsTop}>{entry.tags.map((tag) => <View key={tag} style={s.tag}><Text style={s.tagText}>#{tag}</Text></View>)}</View>}<Text style={s.detailTitle}>{entry.title}</Text>{entry.content ? <MarkdownRenderer content={entry.content} selectable /> : <Text style={s.empty}>No additional details.</Text>}</ScrollView></View></View></Modal>; }
function CategoryManager(props: any) { return <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}><View style={s.overlay}><View style={s.modal}><View style={s.modalHead}><Text style={s.modalTitle}>Manage spaces</Text><TouchableOpacity onPress={props.onClose}><Ionicons name="close" size={24} color={colors.inkSoft} /></TouchableOpacity></View><View style={s.createRow}><TextInput style={[s.input, s.createInput]} placeholder="New space name" value={props.categoryName} onChangeText={props.setCategoryName} onSubmitEditing={props.onCreate} /><TouchableOpacity style={s.createButton} onPress={props.onCreate}><Ionicons name="add" size={22} color={colors.white} /></TouchableOpacity></View>{props.categories.map((category: ReflectionCategory) => <View key={category.id} style={s.categoryRow}><View style={[s.categoryDot, { backgroundColor: category.color }]} />{props.renamingId === category.id ? <TextInput autoFocus style={[s.input, s.renameInput]} value={props.renameText} onChangeText={props.setRenameText} onSubmitEditing={props.onSaveRename} /> : <Text style={s.categoryRowName}>{category.name}</Text>}{props.renamingId === category.id ? <TouchableOpacity style={s.iconAction} onPress={props.onSaveRename}><Ionicons name="checkmark" size={21} color={colors.accentStrong} /></TouchableOpacity> : <TouchableOpacity style={s.iconAction} onPress={() => props.onRename(category)}><Ionicons name="pencil-outline" size={19} color={colors.accentStrong} /></TouchableOpacity>}<TouchableOpacity style={s.iconAction} onPress={() => props.onDelete(category)}><Ionicons name="trash-outline" size={19} color="#b34837" /></TouchableOpacity></View>)}</View></View></Modal>; }

const s = StyleSheet.create({ screen:{flex:1,backgroundColor:colors.bg},content:{padding:spacing.md,paddingTop:TOP_PADDING,paddingBottom:100},center:{flex:1,alignItems:"center",justifyContent:"center"},headingRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},title:{fontSize:fontSize.xxl,fontWeight:"800",color:colors.ink,marginBottom:4},sub:{fontSize:fontSize.base,color:colors.inkSoft},section:{fontSize:fontSize.md,fontWeight:"800",color:colors.ink,marginTop:spacing.xl,marginBottom:spacing.sm},grid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},categoryCard:{width:"48.5%",minHeight:142,borderRadius:radius.md,padding:spacing.md,justifyContent:"space-between"},categoryName:{fontSize:fontSize.base,fontWeight:"800",color:colors.ink},count:{fontSize:fontSize.xs,fontWeight:"700",color:colors.inkSoft},countBadge:{backgroundColor:colors.bg,paddingHorizontal:10,paddingVertical:5,borderRadius:99,fontWeight:"800",color:colors.accentStrong},unsortedCard:{backgroundColor:colors.surfaceStrong,borderRadius:radius.md,padding:spacing.md,marginTop:spacing.sm,borderWidth:1,borderColor:colors.border,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},manageButton:{width:43,height:43,borderRadius:22,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.border,backgroundColor:colors.surfaceStrong},back:{flexDirection:"row",gap:spacing.xs,alignItems:"center",marginBottom:spacing.md},backText:{fontWeight:"700",color:colors.ink},categoryHero:{borderRadius:radius.lg,padding:spacing.lg},timelineLabel:{fontSize:fontSize.sm,fontWeight:"800",color:colors.inkSoft,marginTop:spacing.sm,marginBottom:spacing.xs},entry:{backgroundColor:colors.surfaceStrong,borderRadius:radius.md,padding:spacing.md,marginBottom:spacing.sm,borderWidth:1,borderColor:colors.border,position:"relative"},cardActions:{position:"absolute",right:8,bottom:7,flexDirection:"row",gap:2},cardIcon:{padding:8,borderRadius:18,backgroundColor:colors.bg},entryDate:{fontSize:fontSize.xs,fontWeight:"700",color:colors.accentStrong,marginBottom:4},entryTitle:{fontSize:fontSize.base,fontWeight:"800",color:colors.ink,paddingRight:64},entryPreview:{fontSize:fontSize.sm,color:colors.inkSoft,marginTop:4,lineHeight:19,paddingRight:40},tagPreview:{fontSize:fontSize.xs,fontWeight:"700",color:colors.accentStrong,marginTop:8,paddingRight:70},empty:{fontSize:fontSize.sm,color:colors.inkSoft,marginTop:spacing.sm},addButton:{position:"absolute",right:spacing.lg,bottom:spacing.lg,width:56,height:56,borderRadius:28,backgroundColor:colors.accent,alignItems:"center",justifyContent:"center"},overlay:{flex:1,backgroundColor:"rgba(32,21,17,.42)",justifyContent:"flex-end"},composerOverlay:{flex:1,backgroundColor:"rgba(32,21,17,.42)",paddingTop:64,justifyContent:"flex-start"},modal:{backgroundColor:colors.surfaceStrong,borderTopLeftRadius:radius.lg,borderTopRightRadius:radius.lg,padding:spacing.lg,maxHeight:"90%"},composerModal:{backgroundColor:colors.surfaceStrong,borderRadius:radius.lg,padding:spacing.lg,marginHorizontal:spacing.md,maxHeight:"88%"},readerOverlay:{flex:1,backgroundColor:"rgba(32,21,17,.42)",padding:spacing.lg,justifyContent:"center"},readerModal:{backgroundColor:colors.surfaceStrong,borderRadius:radius.lg,padding:spacing.lg,maxHeight:"78%"},modalHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:spacing.md},modalTitle:{fontSize:fontSize.lg,fontWeight:"800",color:colors.ink},formLabel:{fontSize:fontSize.xs,fontWeight:"800",color:colors.inkSoft,marginBottom:spacing.xs},spacePicker:{marginBottom:spacing.sm},input:{backgroundColor:colors.bg,borderRadius:radius.sm,borderWidth:1,borderColor:colors.border,padding:spacing.sm,color:colors.ink,marginBottom:spacing.sm},textarea:{height:250,minHeight:220,maxHeight:320,textAlignVertical:"top"},precision:{flexDirection:"row",flexWrap:"wrap",gap:spacing.xs,marginBottom:spacing.sm},chip:{paddingHorizontal:10,paddingVertical:7,borderRadius:99,borderWidth:1,borderColor:colors.border,marginRight:spacing.xs},chipOn:{backgroundColor:colors.accent,borderColor:colors.accent},chipText:{fontSize:fontSize.xs,color:colors.inkSoft},chipTextOn:{color:colors.white},dateRow:{flexDirection:"row",gap:spacing.xs},dateInput:{flex:1,backgroundColor:colors.bg,borderRadius:radius.sm,borderWidth:1,borderColor:colors.border,padding:spacing.sm},save:{backgroundColor:colors.accent,borderRadius:radius.sm,padding:spacing.md,alignItems:"center",marginTop:spacing.md},saveText:{color:colors.white,fontWeight:"800"},detailTitle:{fontSize:fontSize.xl,fontWeight:"800",color:colors.ink,marginBottom:spacing.sm},tags:{flexDirection:"row",flexWrap:"wrap",gap:spacing.xs,marginTop:spacing.md},tagsTop:{flexDirection:"row",flexWrap:"wrap",gap:spacing.xs,marginBottom:spacing.md},tag:{backgroundColor:"#fbe6dc",paddingHorizontal:9,paddingVertical:5,borderRadius:99},tagText:{fontSize:fontSize.xs,fontWeight:"700",color:colors.accentStrong},actionRow:{flexDirection:"row",gap:spacing.sm,marginTop:spacing.lg},editAction:{flex:1,flexDirection:"row",justifyContent:"center",alignItems:"center",gap:6,padding:spacing.sm,borderRadius:radius.sm,backgroundColor:"#fbe6dc"},editActionText:{fontWeight:"800",color:colors.accentStrong},deleteAction:{flex:1,flexDirection:"row",justifyContent:"center",alignItems:"center",gap:6,padding:spacing.sm,borderRadius:radius.sm,backgroundColor:"#fae7e3"},deleteActionText:{fontWeight:"800",color:"#b34837"},createRow:{flexDirection:"row",gap:spacing.sm},createInput:{flex:1},createButton:{width:45,height:45,borderRadius:radius.sm,backgroundColor:colors.accent,alignItems:"center",justifyContent:"center"},categoryRow:{flexDirection:"row",alignItems:"center",paddingVertical:spacing.sm,borderTopWidth:1,borderTopColor:colors.border,gap:spacing.sm},categoryDot:{width:14,height:14,borderRadius:7},categoryRowName:{flex:1,fontSize:fontSize.base,fontWeight:"700",color:colors.ink},renameInput:{flex:1,marginBottom:0,paddingVertical:7},iconAction:{padding:8} });

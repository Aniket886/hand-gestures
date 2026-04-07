import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw, Plus, Trash2, Settings } from "lucide-react";
import type { GestureMapping } from "@/hooks/useGestureMappings";
import { ACTION_OPTIONS, type PresentationAction } from "@/hooks/useGestureMappings";
import { GESTURE_MAP, type GestureType } from "@/lib/gestures";

const EMOJI_PICKER = [
  "👋", "✋", "🤚", "🖐️", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙",
  "👈", "👉", "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊",
  "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏",
  "💪", "🦾", "🖖", "🤏", "👌", "🫳", "🫴", "🫱", "🫲", "✍️",
  "🎯", "⚡", "🔥", "💫", "✨", "🎵", "🎶", "❤️", "💚", "💙",
  "⭐", "🌟", "💡", "🚀", "🎉", "🎊", "💥", "💣", "🔔", "📌",
];

const DETECTION_GESTURES: { value: GestureType; label: string }[] = [
  { value: "open_palm", label: "✋ Open Palm" },
  { value: "fist", label: "✊ Fist" },
  { value: "pointing", label: "☝️ Pointing" },
  { value: "peace", label: "✌️ Peace" },
  { value: "thumbs_up", label: "👍 Thumbs Up" },
  { value: "thumbs_down", label: "👎 Thumbs Down" },
  { value: "rock", label: "🤘 Rock" },
  { value: "love_you", label: "🤟 Love You" },
  { value: "call_me", label: "🤙 Call Me" },
  { value: "gun", label: "👈 Finger Gun" },
  { value: "ok_sign", label: "👌 OK Sign" },
  { value: "pinch", label: "🤏 Pinch" },
  { value: "three", label: "3️⃣ Three" },
  { value: "four", label: "4️⃣ Four" },
  { value: "vulcan", label: "🖖 Vulcan" },
  { value: "middle_finger", label: "🖕 Middle Finger" },
  { value: "pinky_up", label: "🤙 Pinky Up" },
];

interface GestureSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mappings: GestureMapping[];
  onUpdateAction: (gesture: GestureType, action: PresentationAction) => void;
  onUpdateEmoji: (gesture: GestureType, emoji: string) => void;
  onUpdateLabel: (gesture: GestureType, label: string) => void;
  onAddCustom: (emoji: string, label: string, action: PresentationAction, baseGesture: GestureType) => void;
  onRemoveCustom: (index: number) => void;
  onReset: () => void;
}

const GestureSettingsModal = ({
  isOpen,
  onClose,
  mappings,
  onUpdateAction,
  onUpdateEmoji,
  onUpdateLabel,
  onAddCustom,
  onRemoveCustom,
  onReset,
}: GestureSettingsModalProps) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmoji, setNewEmoji] = useState("🎯");
  const [newLabel, setNewLabel] = useState("");
  const [newAction, setNewAction] = useState<PresentationAction>("none");
  const [newBaseGesture, setNewBaseGesture] = useState<GestureType>("open_palm");
  const [editingEmoji, setEditingEmoji] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    onAddCustom(newEmoji, newLabel.trim(), newAction, newBaseGesture);
    setNewLabel("");
    setNewEmoji("🎯");
    setNewAction("none");
    setNewBaseGesture("open_palm");
    setShowAddForm(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Settings className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="font-mono text-sm font-bold text-foreground">Gesture Mappings</h2>
                <p className="font-mono text-[10px] text-muted-foreground">Customize actions, emojis & add new gestures</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mapping list */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {mappings.map((mapping, index) => (
              <div
                key={`${mapping.gesture}-${index}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary/20 hover:bg-secondary/40 transition-all group"
              >
                {/* Emoji button */}
                <div className="relative">
                  <button
                    onClick={() => setEditingEmoji(editingEmoji === `${index}` ? null : `${index}`)}
                    className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center text-xl hover:border-primary/50 transition-all"
                  >
                    {mapping.emoji}
                  </button>
                  {editingEmoji === `${index}` && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl p-2 shadow-xl w-[260px] grid grid-cols-10 gap-1">
                      {EMOJI_PICKER.map((e) => (
                        <button
                          key={e}
                          onClick={() => {
                            onUpdateEmoji(mapping.gesture, e);
                            setEditingEmoji(null);
                          }}
                          className="w-6 h-6 flex items-center justify-center text-sm hover:bg-primary/20 rounded transition-all"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  {editingLabel === `${index}` ? (
                    <input
                      autoFocus
                      defaultValue={mapping.label}
                      onBlur={(e) => {
                        if (e.target.value.trim()) onUpdateLabel(mapping.gesture, e.target.value.trim());
                        setEditingLabel(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="w-full bg-card border border-primary/50 rounded-md px-2 py-1 font-mono text-xs text-foreground outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingLabel(`${index}`)}
                      className="font-mono text-xs font-medium text-foreground hover:text-primary transition-colors text-left truncate w-full"
                    >
                      {mapping.label}
                    </button>
                  )}
                  {mapping.isCustom && (
                    <span className="font-mono text-[9px] text-accent uppercase">custom</span>
                  )}
                </div>

                {/* Action dropdown */}
                <select
                  value={mapping.action}
                  onChange={(e) => onUpdateAction(mapping.gesture, e.target.value as PresentationAction)}
                  className="bg-card border border-border rounded-lg px-2 py-1.5 font-mono text-[11px] text-foreground outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer min-w-[140px]"
                >
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Delete (custom only) */}
                {mapping.isCustom && (
                  <button
                    onClick={() => onRemoveCustom(index)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add new gesture */}
          <div className="border-t border-border px-6 py-4">
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-primary/30 text-primary font-mono text-xs hover:bg-primary/5 hover:border-primary/50 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Custom Gesture
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-3"
              >
                <div className="flex items-center gap-3">
                  {/* Emoji picker for new */}
                  <div className="relative">
                    <button
                      onClick={() => setEditingEmoji(editingEmoji === "new" ? null : "new")}
                      className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center text-2xl hover:border-primary/50 transition-all"
                    >
                      {newEmoji}
                    </button>
                    {editingEmoji === "new" && (
                      <div className="absolute bottom-full left-0 mb-1 z-50 bg-card border border-border rounded-xl p-2 shadow-xl w-[260px] grid grid-cols-10 gap-1">
                        {EMOJI_PICKER.map((e) => (
                          <button
                            key={e}
                            onClick={() => {
                              setNewEmoji(e);
                              setEditingEmoji(null);
                            }}
                            className="w-6 h-6 flex items-center justify-center text-sm hover:bg-primary/20 rounded transition-all"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Gesture name..."
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-all"
                    />
                    <div className="flex gap-2">
                      <select
                        value={newBaseGesture}
                        onChange={(e) => setNewBaseGesture(e.target.value as GestureType)}
                        className="flex-1 bg-card border border-border rounded-lg px-2 py-1.5 font-mono text-[11px] text-foreground outline-none focus:border-primary/50 appearance-none cursor-pointer"
                      >
                        {DETECTION_GESTURES.map((g) => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                      <select
                        value={newAction}
                        onChange={(e) => setNewAction(e.target.value as PresentationAction)}
                        className="flex-1 bg-card border border-border rounded-lg px-2 py-1.5 font-mono text-[11px] text-foreground outline-none focus:border-primary/50 appearance-none cursor-pointer"
                      >
                        {ACTION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 rounded-lg font-mono text-xs text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={!newLabel.trim()}
                    className="px-4 py-2 rounded-lg font-mono text-xs font-medium bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 disabled:opacity-30 transition-all"
                  >
                    Save Gesture
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GestureSettingsModal;

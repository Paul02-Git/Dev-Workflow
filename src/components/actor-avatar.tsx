import { hashPick } from "@/lib/hash-color";

const AVATAR_PALETTE = ["#2a78d6", "#0ca30c", "#c9720a", "#a259ff", "#d03b3b", "#0b8f8f"];

/** Colored initial avatar for whoever did something — deterministic per name, same palette pattern used for platforms/projects elsewhere. */
export function ActorAvatar({ name, size = 24 }: { name: string; size?: number }) {
  const color = hashPick(name, AVATAR_PALETTE);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  );
}

import type { CSSProperties } from "react";
import { avatarHue, initialOf } from "./panelLogic";

/** Round initial avatar; colour comes from a hue derived from the sender (see mail.css). */
export const Avatar = ({ name, size }: { name: string; size?: "lg" }) => (
  <span className={`mail-av${size ? ` ${size}` : ""}`} style={{ "--h": avatarHue(name) } as CSSProperties} aria-hidden>{initialOf(name)}</span>
);

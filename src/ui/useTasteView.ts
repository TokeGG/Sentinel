// useTaste + the panel's "For you" toggle; `dflt` = the panel's `taste` customize option.
import { useState } from "react";
import { useTaste } from "../core/taste/useTaste";

export function useTasteView(moduleId: string, dflt: boolean) {
  const taste = useTaste(moduleId);
  const [forYou, setForYou] = useState<boolean | null>(null);
  return { taste, forYou: forYou ?? dflt, setForYou };
}

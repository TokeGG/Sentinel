// "Sign in with Google / Microsoft" for the add-account form: connects via
// core/connect, then hands an OAuth draft (no password) to onAdd.
import { ConnectButton } from "../../core/connect/ConnectButton";
import { draftFromPreset, type AccountDraft } from "./presets";
import { OAUTH_PROVIDERS, oauthPreset } from "./mailAuth";

const LABEL: Record<string, string> = { gmail: "Sign in with Google", outlook: "Sign in with Microsoft" };

export function OAuthSignIn({ onAdd }: { onAdd: (d: AccountDraft) => Promise<void> }) {
  return (
    <div className="mail-row">
      {Object.keys(OAUTH_PROVIDERS).map((base) => (
        <ConnectButton key={base} providerId={OAUTH_PROVIDERS[base]} label={LABEL[base]}
          onConnected={(row) => void onAdd({ ...draftFromPreset(base, row.account), preset: oauthPreset(base) })} />
      ))}
    </div>
  );
}

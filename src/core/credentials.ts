import { invoke } from "@tauri-apps/api/core";

// Thin wrapper over the Rust OS-keychain commands. `service` is always the
// owning module's id — modules can never read each other's secrets because
// nothing routes a lookup to a different service string.
export async function setCredential(service: string, key: string, value: string) {
  await invoke("set_credential", { service, key, value });
}

export async function getCredential(service: string, key: string): Promise<string | null> {
  return await invoke<string | null>("get_credential", { service, key });
}

export async function deleteCredential(service: string, key: string) {
  await invoke("delete_credential", { service, key });
}

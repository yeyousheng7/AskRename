export const PRESET_KINDS = ['instruction', 'regex'] as const;

export type PresetKind = (typeof PRESET_KINDS)[number];

export function isPresetKind(value: unknown): value is PresetKind {
  return typeof value === 'string' && (PRESET_KINDS as readonly string[]).includes(value);
}

export interface Preset {
  id: string;
  name: string;
  content: string;
  kind: PresetKind;
}

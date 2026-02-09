export type PresetType = 'regex' | 'prompt';

export interface Preset {
  id: string;
  name: string;
  content: string;
  type: PresetType;
}


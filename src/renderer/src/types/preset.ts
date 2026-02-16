import type { Mode } from '@/types/mode';

export interface Preset {
  id: string;
  name: string;
  content: string;
  modeId: Mode;
}

export type Cue = { slot: number; positionSeconds: number; reverse: boolean };
export type FlipProject = {
  version: 1;
  sampleId: string;
  cues: Cue[];
  reverse: boolean;
  pitch: number;
  sourceBpm: number | null;
  targetBpm: number | null;
};

export const CUE_COLORS = [
  "#ff8b8b",
  "#ffbe75",
  "#f4dd79",
  "#a7df80",
  "#73dfb8",
  "#78d5ed",
  "#92acff",
  "#c49bff",
  "#f397d5",
];
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export function newProject(sampleId: string, bpm: number): FlipProject {
  const sourceBpm = positive(bpm) ? bpm : null;
  return {
    version: 1,
    sampleId,
    cues: [],
    reverse: false,
    pitch: 0,
    sourceBpm,
    targetBpm: sourceBpm,
  };
}

export function addCue(
  project: FlipProject,
  positionSeconds: number,
  requestedSlot?: number,
): FlipProject {
  const slot =
    requestedSlot ??
    Array.from({ length: 9 }, (_, index) => index + 1).find(
      (n) => !project.cues.some((cue) => cue.slot === n),
    );
  if (
    !slot ||
    !Number.isInteger(slot) ||
    slot < 1 ||
    slot > 9 ||
    project.cues.some((cue) => cue.slot === slot)
  )
    return project;
  return {
    ...project,
    cues: [...project.cues, { slot, positionSeconds, reverse: false }].sort(
      (a, b) => a.slot - b.slot,
    ),
  };
}

export const effectiveReverse = (global: boolean, cue = false) =>
  global !== cue;
export const tempoRatio = (project: FlipProject) =>
  project.sourceBpm && project.targetBpm
    ? project.targetBpm / project.sourceBpm
    : 1;
export const bufferOffset = (
  position: number,
  duration: number,
  reverse: boolean,
) => clamp(reverse ? duration - position : position, 0, duration);
export const projectKey = (userId: string, sampleId: string) =>
  `retrosampled:flip:v1:${encodeURIComponent(userId)}:${encodeURIComponent(sampleId)}`;

export function restoreProject(
  raw: string | null,
  initial: FlipProject,
  duration: number,
): FlipProject {
  try {
    const data = JSON.parse(raw ?? "null");
    if (!data || data.version !== 1 || data.sampleId !== initial.sampleId)
      return initial;
    const slots = new Set<number>();
    const cues: Cue[] = [];
    if (Array.isArray(data.cues))
      for (const cue of data.cues) {
        if (
          !cue ||
          !Number.isInteger(cue.slot) ||
          cue.slot < 1 ||
          cue.slot > 9 ||
          slots.has(cue.slot) ||
          typeof cue.positionSeconds !== "number" ||
          !Number.isFinite(cue.positionSeconds)
        )
          continue;
        slots.add(cue.slot);
        cues.push({
          slot: cue.slot,
          positionSeconds: clamp(cue.positionSeconds, 0, duration),
          reverse: cue.reverse === true,
        });
      }
    const sourceBpm = positive(data.sourceBpm)
      ? data.sourceBpm
      : initial.sourceBpm;
    const targetBpm = sourceBpm
      ? clamp(
          positive(data.targetBpm) ? data.targetBpm : sourceBpm,
          sourceBpm * 0.5,
          sourceBpm * 2,
        )
      : null;
    return {
      ...initial,
      cues: cues.sort((a, b) => a.slot - b.slot),
      reverse: data.reverse === true,
      pitch:
        typeof data.pitch === "number" && Number.isFinite(data.pitch)
          ? clamp(Math.round(data.pitch), -24, 12)
          : 0,
      sourceBpm,
      targetBpm,
    };
  } catch {
    return initial;
  }
}

export function ignoresShortcuts(event: KeyboardEvent): boolean {
  const target = event.target;
  return (
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    event.isComposing ||
    (target instanceof HTMLElement &&
      Boolean(
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"]',
        ),
      ))
  );
}

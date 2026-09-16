import { describe, expect, it } from "vitest";
import {
  addCue,
  bufferOffset,
  effectiveReverse,
  newProject,
  projectKey,
  restoreProject,
  tempoRatio,
} from "./flipProject";

describe("flip project", () => {
  it("fills nine stable slots and reuses only the deleted slot", () => {
    let project = newProject("sample", 120);
    for (let index = 0; index < 9; index++) project = addCue(project, index);
    expect(project.cues.map((cue) => cue.slot)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(addCue(project, 10)).toBe(project);
    project = {
      ...project,
      cues: project.cues.filter((cue) => cue.slot !== 3),
    };
    project = addCue(project, 0.5);
    expect(project.cues.find((cue) => cue.slot === 3)?.positionSeconds).toBe(
      0.5,
    );
    expect(project.cues.find((cue) => cue.slot === 4)?.positionSeconds).toBe(3);
  });

  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
    [true, true, false],
  ])("combines global %s and cue %s as %s", (global, cue, result) => {
    expect(effectiveReverse(global, cue)).toBe(result);
  });

  it("maps reverse playback into the reversed buffer while preserving source coordinates", () => {
    expect(bufferOffset(3, 10, false)).toBe(3);
    expect(bufferOffset(3, 10, true)).toBe(7);
    expect(bufferOffset(0, 10, true)).toBe(10);
    expect(bufferOffset(10, 10, true)).toBe(0);
  });

  it("restores validated project data, rejecting duplicate slots and clamping to the decoded duration", () => {
    const initial = newProject("sample", 120);
    const restored = restoreProject(
      JSON.stringify({
        ...initial,
        pitch: -50,
        sourceBpm: 100,
        targetBpm: 500,
        cues: [
          { slot: 2, positionSeconds: 15, reverse: true },
          { slot: 2, positionSeconds: 3 },
          { slot: 0, positionSeconds: 4 },
          { slot: 3, positionSeconds: -1 },
        ],
      }),
      initial,
      10,
    );
    expect(restored.cues).toEqual([
      { slot: 2, positionSeconds: 10, reverse: true },
      { slot: 3, positionSeconds: 0, reverse: false },
    ]);
    expect(restored.pitch).toBe(-24);
    expect(restored.targetBpm).toBe(200);
    expect(tempoRatio(restored)).toBe(2);
    expect(restoreProject("{bad json", initial, 10)).toBe(initial);
    expect(
      restoreProject(
        JSON.stringify({ ...initial, sampleId: "other" }),
        initial,
        10,
      ),
    ).toBe(initial);
    expect(
      restoreProject(JSON.stringify({ ...initial, version: 2 }), initial, 10),
    ).toBe(initial);
  });

  it("keeps missing BPM unknown and isolates projects by user and sample", () => {
    const project = newProject("sample", 0);
    expect(project.sourceBpm).toBeNull();
    expect(tempoRatio(project)).toBe(1);
    expect(projectKey("a", "s")).not.toBe(projectKey("b", "s"));
    expect(projectKey("a", "s")).not.toBe(projectKey("a", "t"));
  });
});

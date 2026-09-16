import React, { useMemo } from "react";
import type { SampleDetail } from "@retrosampled/shared";
import SamplePiece from "../../../components/SamplePiece";
import { toRowSample } from "../uploadConstants";

/** "remake of" card: a `SamplePiece` row inside a #101010 / #ffffff26 frame. */
export const ParentSampleCard: React.FC<{ parent: SampleDetail; compact?: boolean }> = ({
  parent,
  compact = false,
}) => {
  const row = useMemo(() => toRowSample(parent), [parent]);

  return (
    <div className="upload-parent">
      <span className="upload-label">
        <span>remake of</span>
        <small>inherits og credit &amp; tags</small>
      </span>
      <div className="upload-parent__card">
        <SamplePiece sample={row} compact={compact} />
      </div>
    </div>
  );
};

import React from "react";

export type SampleMetaProps = {
  bpm: number;
  musicalKey: string;
};

export const SampleMeta: React.FC<SampleMetaProps> = ({ bpm, musicalKey }) => {
  return (
    <section className="sample-meta" aria-label="Sample metadata">
      <div className="sample-meta__item">
        <span className="sample-meta__label">bpm:</span>
        <span className="sample-meta__value">{bpm}</span>
      </div>
      <div className="sample-meta__item">
        <span className="sample-meta__label">key:</span>
        <span className="sample-meta__value">{musicalKey}</span>
      </div>
    </section>
  );
};

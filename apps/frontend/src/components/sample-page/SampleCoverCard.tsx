import React from "react";
import { useState } from "react";

export type SampleCoverCardProps = {
  imageUrl?: string;
  title: string;
};

export const SampleCoverCard: React.FC<SampleCoverCardProps> = ({ imageUrl, title }) => {
  const [isBroken, setIsBroken] = useState(false);
  const hasImage = Boolean(imageUrl) && !isBroken;

  return (
    <div className="sample-cover-card" aria-label="Sample cover card">
      {hasImage ? (
        <img
          src={imageUrl}
          alt={`${title} cover`}
          className="sample-cover-card__image"
          onError={() => setIsBroken(true)}
        />
      ) : (
        <div className="sample-cover-card__placeholder" aria-label="Cover placeholder">
          Cover
        </div>
      )}
    </div>
  );
};

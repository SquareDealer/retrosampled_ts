import React from "react";
import { Link } from "react-router-dom";

type InheritedRef = {
  id: string;
  title: string;
};

export type SampleHeaderProps = {
  title: string;
  inheritedFrom?: InheritedRef;
  authors: string[];
};

export const SampleHeader: React.FC<SampleHeaderProps> = ({ title, inheritedFrom, authors }) => {
  const isOgSample = !inheritedFrom;

  return (
    <header className="sample-header">
      <h1 className="sample-header__title">
        <span className="sample-header__title-text">{title}</span>
        {isOgSample ? (
          <img className="sample-header__og-icon" src="/icons/og_icon.png" alt="OG sample" />
        ) : null}
      </h1>

      {inheritedFrom ? (
        <div className="sample-header__subtitle">
          Inherited from{" "}
          <Link
            to={`/sample/${inheritedFrom.id}`}
            className="sample-header__link"
            aria-label={`Open original sample ${inheritedFrom.title}`}
          >
            {inheritedFrom.title}
          </Link>
        </div>
      ) : null}

      <div className="sample-header__authors" aria-label="Sample authors">
        {authors.join(" x ")}
      </div>
    </header>
  );
};

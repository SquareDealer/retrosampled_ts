import React from "react";
import { Link } from "react-router-dom";
import { SampleAuthor } from "../../types/sampleDetail";

type InheritedRef = {
  id: string;
  title: string;
};

export type SampleHeaderProps = {
  title: string;
  inheritedFrom?: InheritedRef;
  authors: SampleAuthor[];
};

export const SampleHeader: React.FC<SampleHeaderProps> = ({ title, inheritedFrom, authors }) => {
  const normalizedAuthors = authors
    .map((author) => ({
      id: author.id,
      name: author.name.trim(),
    }))
    .filter((author) => author.id && author.name.length > 0);
  const inheritedId = inheritedFrom?.id ?? "";
  const inheritedTitle = inheritedFrom?.title?.trim() ?? "";
  const hasInheritedFrom = Boolean(inheritedId && inheritedTitle);
  const isOgSample = !hasInheritedFrom;

  return (
    <header className="sample-header">
      <h1 className="sample-header__title">
        <span className="sample-header__title-text">{title}</span>
        {isOgSample ? (
          <img className="sample-header__og-icon" src="/icons/og_icon.png" alt="OG sample" />
        ) : null}
      </h1>

      {hasInheritedFrom ? (
        <div className="sample-header__subtitle">
          Inherited from{" "}
          <Link
            to={`/sample/${inheritedId}`}
            className="sample-header__link"
            aria-label={`Open original sample ${inheritedTitle}`}
          >
            {inheritedTitle}
          </Link>
        </div>
      ) : null}

      {normalizedAuthors.length > 0 ? (
        <div className="sample-header__authors" aria-label="Sample authors">
          {normalizedAuthors.map((author, index) => (
            <React.Fragment key={author.id}>
              {index > 0 ? <span className="sample-header__authors-separator">x</span> : null}
              <Link
                to={`/user/${author.id}`}
                className="sample-header__author-link"
                aria-label={`Open user ${author.name}`}
              >
                {author.name}
              </Link>
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </header>
  );
};

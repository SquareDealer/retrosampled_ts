import React from "react";
import { KEY_OPTIONS, SAMPLE_TYPE_OPTIONS, TITLE_MAX_LENGTH } from "../uploadConstants";
import type { MetadataErrors, MetadataForm } from "../useUploadWizard";
import { CollaboratorPicker } from "./CollaboratorPicker";
import { TagInput } from "./TagInput";

type MetadataFieldsProps = {
  form: MetadataForm;
  errors: MetadataErrors;
  onChange: (patch: Partial<MetadataForm>) => void;
  viewer?: { id: string; username: string } | null;
  /** Remake mode: parent tags render dashed, bpm/key are labelled "from parent". */
  inheritedTags?: string[];
  ogCreator?: { id: string; username: string } | null;
  fromParent?: boolean;
  /** Title is rendered by the caller (mobile layout puts it next to the cover). */
  hideTitle?: boolean;
  idPrefix?: string;
};

export const TitleField: React.FC<{
  value: string;
  error?: string;
  onChange: (value: string) => void;
  hint?: string;
  id?: string;
}> = ({ value, error, onChange, hint, id = "upload-title" }) => (
  <div className="upload-field">
    <label className="upload-label" htmlFor={id}>
      <span>title</span>
      <small>
        {value.length} / {TITLE_MAX_LENGTH}
      </small>
    </label>
    <input
      id={id}
      className={`upload-input${error ? " upload-input--error" : ""}`}
      value={value}
      placeholder="name your sample"
      maxLength={TITLE_MAX_LENGTH}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={Boolean(error)}
    />
    {error ? <span className="upload-error">{error}</span> : hint ? <span className="upload-hint">{hint}</span> : null}
  </div>
);

export const MetadataFields: React.FC<MetadataFieldsProps> = ({
  form,
  errors,
  onChange,
  viewer,
  inheritedTags = [],
  ogCreator,
  fromParent = false,
  hideTitle = false,
  idPrefix = "upload",
}) => {
  return (
    <div className="upload-stack">
      {!hideTitle ? (
        <TitleField
          id={`${idPrefix}-title`}
          value={form.title}
          error={errors.title}
          onChange={(title) => onChange({ title })}
          hint={fromParent ? "tip: keep the original name so people can find the lineage" : undefined}
        />
      ) : null}

      <div className="upload-field">
        <label className="upload-label" htmlFor={`${idPrefix}-description`}>
          <span>description</span>
          <small>optional</small>
        </label>
        <textarea
          id={`${idPrefix}-description`}
          className="upload-input upload-input--area"
          value={form.description}
          maxLength={2000}
          placeholder="where it's from, how you chopped it, anything a producer should know"
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </div>

      <div className="upload-two">
        <div className="upload-field">
          <label className="upload-label" htmlFor={`${idPrefix}-bpm`}>
            <span>bpm</span>
            {fromParent ? <small>from parent</small> : null}
          </label>
          <input
            id={`${idPrefix}-bpm`}
            className={`upload-input${errors.bpm ? " upload-input--error" : ""}`}
            value={form.bpm}
            inputMode="numeric"
            placeholder="94"
            onChange={(event) => onChange({ bpm: event.target.value.replace(/[^\d]/g, "").slice(0, 3) })}
            aria-invalid={Boolean(errors.bpm)}
          />
          {errors.bpm ? <span className="upload-error">{errors.bpm}</span> : null}
        </div>
        <div className="upload-field">
          <label className="upload-label" htmlFor={`${idPrefix}-key`}>
            <span>key</span>
            {fromParent ? <small>from parent</small> : null}
          </label>
          <div className="upload-select-wrap">
            <select
              id={`${idPrefix}-key`}
              className={`upload-input${errors.musicalKey ? " upload-input--error" : ""}`}
              value={form.musicalKey}
              onChange={(event) => onChange({ musicalKey: event.target.value })}
              aria-invalid={Boolean(errors.musicalKey)}
            >
              <option value="">pick a key</option>
              {KEY_OPTIONS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>
          {errors.musicalKey ? <span className="upload-error">{errors.musicalKey}</span> : null}
        </div>
      </div>

      <div className="upload-field">
        <span className="upload-label">
          <span>type</span>
        </span>
        <div className="upload-seg" role="radiogroup" aria-label="Sample type">
          {SAMPLE_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={form.sampleType === option.value}
              className={`upload-seg__b${form.sampleType === option.value ? " upload-seg__b--on" : ""}`}
              onClick={() =>
                onChange({ sampleType: form.sampleType === option.value ? "" : option.value })
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <TagInput
        tags={form.tags}
        inheritedTags={inheritedTags}
        error={errors.tags}
        onChange={(tags) => onChange({ tags })}
      />

      <CollaboratorPicker
        collaborators={form.collaborators}
        onChange={(collaborators) => onChange({ collaborators })}
        viewer={viewer}
        ogCreator={ogCreator}
      />
    </div>
  );
};

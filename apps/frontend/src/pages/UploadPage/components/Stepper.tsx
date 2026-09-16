import React from "react";
import { STEP_LABELS } from "../uploadConstants";
import type { WizardStep } from "../useUploadWizard";

export const Stepper: React.FC<{ step: WizardStep }> = ({ step }) => {
  return (
    <ol className="upload-steps" aria-label="Upload steps">
      {STEP_LABELS.map((label, index) => {
        const number = (index + 1) as WizardStep;
        const isActive = number === step;
        const isDone = number < step;

        return (
          <li
            key={label}
            className={`upload-steps__step${isActive ? " upload-steps__step--active" : ""}${
              isDone ? " upload-steps__step--done" : ""
            }`}
            aria-current={isActive ? "step" : undefined}
          >
            <span className="upload-steps__n">{isDone ? "✓" : String(number).padStart(2, "0")}</span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
};

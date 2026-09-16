import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { SampleDetail, SampleType, SampleVisibility } from "@retrosampled/shared";
import { fetchSampleById, setVisibility, updateSample, retryProcessing, deleteSample } from "../../api/samples";
import { buildSampleFormData, uploadCover, uploadSample } from "../../api/uploads";
import { useAuth } from "../../auth/useAuth";
import { TITLE_MAX_LENGTH, validateAudioFile, validateCoverFile } from "./uploadConstants";

export type WizardStep = 1 | 2 | 3 | 4;

export type CollaboratorRef = {
  id: string;
  username: string;
};

export type MetadataForm = {
  title: string;
  description: string;
  bpm: string;
  musicalKey: string;
  sampleType: SampleType | "";
  tags: string[];
  collaborators: CollaboratorRef[];
};

export type MetadataErrors = Partial<Record<"title" | "bpm" | "musicalKey" | "tags", string>>;

export type UploadWizardOptions = {
  /** Parent sample when the wizard runs in remake mode (`/sample/:id/remake`). */
  parent?: SampleDetail | null;
  /** Poll interval for step 3, exposed for tests. */
  pollIntervalMs?: number;
};

export type UploadWizardState = {
  step: WizardStep;
  file: File | null;
  fileError: string | null;
  uploadPercent: number | null;
  isUploading: boolean;
  sample: SampleDetail | null;
  form: MetadataForm;
  formErrors: MetadataErrors;
  cover: File | null;
  coverError: string | null;
  isSaving: boolean;
  isPublishing: boolean;
  visibility: SampleVisibility;
  error: string | null;
  isHydrating: boolean;
};

export const EMPTY_FORM: MetadataForm = {
  title: "",
  description: "",
  bpm: "",
  musicalKey: "",
  sampleType: "",
  tags: [],
  collaborators: [],
};

export const validateMetadata = (form: MetadataForm): MetadataErrors => {
  const errors: MetadataErrors = {};
  const title = form.title.trim();

  if (!title) {
    errors.title = "title is required";
  } else if (title.length > TITLE_MAX_LENGTH) {
    errors.title = `keep it under ${TITLE_MAX_LENGTH} characters`;
  }

  const bpm = Number(form.bpm);
  if (!form.bpm.trim()) {
    errors.bpm = "bpm is required";
  } else if (!Number.isInteger(bpm) || bpm < 20 || bpm > 400) {
    errors.bpm = "bpm must be a whole number between 20 and 400";
  }

  if (!form.musicalKey) {
    errors.musicalKey = "pick a key";
  }

  return errors;
};

export const formFromSample = (sample: SampleDetail, viewerId?: string): MetadataForm => ({
  title: sample.title ?? "",
  description: sample.description ?? "",
  bpm: sample.bpm ? String(sample.bpm) : "",
  musicalKey: sample.musicalKey ?? "",
  sampleType: (sample.sampleType as SampleType | null) ?? "",
  tags: sample.tags ?? [],
  collaborators: (sample.creators ?? [])
    .filter((creator) => creator.roles.includes("COLLABORATOR") && creator.id !== viewerId)
    .map((creator) => ({ id: creator.id, username: creator.username })),
});

const stepFromParam = (raw: string | null, fallback: WizardStep): WizardStep => {
  const parsed = Number(raw);
  return parsed === 2 || parsed === 3 || parsed === 4 ? parsed : fallback;
};

const nextStepFor = (sample: SampleDetail, requested: WizardStep): WizardStep => {
  if (sample.status === "PUBLISHED" || sample.status === "PRIVATE") {
    return 4;
  }
  if (sample.status === "PROCESSING" || sample.status === "FAILED") {
    return requested === 2 ? 2 : 3;
  }
  return requested < 2 ? 2 : requested;
};

/**
 * State machine of the 4-step upload wizard. The draft is created on the
 * server as soon as step 1 completes, and its id lives in the URL
 * (`?draft=<id>&step=<n>`) so a refresh resumes where the user left off.
 */
export function useUploadWizard(options: UploadWizardOptions = {}) {
  const { parent = null, pollIntervalMs = 1500 } = options;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const draftParam = searchParams.get("draft");
  const stepParam = searchParams.get("step");

  const [step, setStepState] = useState<WizardStep>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sample, setSample] = useState<SampleDetail | null>(null);
  const [form, setForm] = useState<MetadataForm>(() => ({
    ...EMPTY_FORM,
    bpm: parent?.bpm ? String(parent.bpm) : "",
    musicalKey: parent?.musicalKey ?? "",
    sampleType: (parent?.sampleType as SampleType | null) ?? "",
    tags: parent?.tags ?? [],
  }));
  const [formErrors, setFormErrors] = useState<MetadataErrors>({});
  const [cover, setCover] = useState<File | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [visibility, setVisibilityState] = useState<SampleVisibility>("published");
  const [error, setError] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(Boolean(draftParam));
  const hydratedRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const syncUrl = useCallback(
    (nextStep: WizardStep, draftId: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (draftId) {
        next.set("draft", draftId);
        next.set("step", String(nextStep));
      } else {
        next.delete("draft");
        next.delete("step");
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const goTo = useCallback(
    (nextStep: WizardStep, draftId: string | null = sample?.id ?? null) => {
      setStepState(nextStep);
      setError(null);
      syncUrl(nextStep, draftId);
    },
    [sample?.id, syncUrl]
  );

  // Resume a draft from the URL.
  useEffect(() => {
    if (!draftParam || hydratedRef.current === draftParam) {
      return;
    }

    hydratedRef.current = draftParam;
    let cancelled = false;
    let settled = false;
    setIsHydrating(true);

    void fetchSampleById(draftParam)
      .then((loaded) => {
        settled = true;
        if (cancelled) return;
        if (!loaded) {
          setError("that draft is gone — start again.");
          syncUrl(1, null);
          return;
        }
        setSample(loaded);
        setForm(formFromSample(loaded, user?.id));
        setStepState(nextStepFor(loaded, stepFromParam(stepParam, 2)));
      })
      .catch((loadError: unknown) => {
        settled = true;
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "could not load the draft.");
      })
      .finally(() => {
        if (!cancelled) setIsHydrating(false);
      });

    return () => {
      cancelled = true;
      // StrictMode / fast re-mounts: let the next run fetch again instead of
      // leaving the wizard on the skeleton forever.
      if (!settled) hydratedRef.current = null;
    };
  }, [draftParam, stepParam, syncUrl, user?.id]);

  // Poll while processing.
  useEffect(() => {
    if (step !== 3 || !sample || sample.status !== "PROCESSING") {
      return;
    }

    const timer = window.setInterval(() => {
      void fetchSampleById(sample.id).then((loaded) => {
        if (loaded) setSample(loaded);
      });
    }, pollIntervalMs);

    return () => window.clearInterval(timer);
  }, [pollIntervalMs, sample, step]);

  const selectFile = useCallback((candidate: File | null) => {
    setFile(candidate);
    setFileError(candidate ? validateAudioFile(candidate) : null);
    setError(null);
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setFileError(null);
  }, []);

  const updateForm = useCallback((patch: Partial<MetadataForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setFormErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as Array<keyof MetadataForm>) {
        if (key === "title" || key === "bpm" || key === "musicalKey" || key === "tags") {
          delete next[key];
        }
      }
      return next;
    });
  }, []);

  const selectCover = useCallback((candidate: File | null) => {
    setCover(candidate);
    setCoverError(candidate ? validateCoverFile(candidate) : null);
  }, []);

  /** Step 1 → 2: creates the draft on the server (audio + whatever is known). */
  const continueFromDropzone = useCallback(async () => {
    if (!file || fileError || isUploading) {
      return;
    }

    setIsUploading(true);
    setUploadPercent(0);
    setError(null);
    abortRef.current = new AbortController();

    try {
      const formData = buildSampleFormData(file, {
        title: form.title.trim() || undefined,
        parentId: parent?.id,
        tags: form.tags,
        bpm: form.bpm ? Number(form.bpm) : undefined,
        musicalKey: form.musicalKey || undefined,
        sampleType: form.sampleType || undefined,
      });

      const created = await uploadSample(
        formData,
        (progress) => setUploadPercent(progress.percent),
        { signal: abortRef.current.signal }
      );

      // We already hold the fresh row; don't let the URL sync re-hydrate it.
      hydratedRef.current = created.id;
      setSample(created);
      setForm((current) => ({
        ...current,
        title: current.title.trim() || created.title,
        tags: created.tags ?? current.tags,
      }));
      setStepState(2);
      syncUrl(2, created.id);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "upload failed.");
    } finally {
      setIsUploading(false);
      setUploadPercent(null);
      abortRef.current = null;
    }
  }, [file, fileError, form, isUploading, parent?.id, syncUrl]);

  const cancelUpload = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Step 2 → 3 (or "save draft"): PATCH metadata (+ cover), optionally advance. */
  const saveMetadata = useCallback(
    async ({ advance }: { advance: boolean }): Promise<SampleDetail | null> => {
      if (!sample) {
        return null;
      }

      const errors = advance ? validateMetadata(form) : {};
      setFormErrors(errors);
      if (Object.keys(errors).length > 0 || coverError) {
        return null;
      }

      setIsSaving(true);
      setError(null);

      try {
        let updated = await updateSample(sample.id, {
          title: form.title.trim() || sample.title,
          description: form.description.trim() || null,
          bpm: form.bpm.trim() ? Number(form.bpm) : null,
          musicalKey: form.musicalKey || null,
          sampleType: form.sampleType || null,
          tags: form.tags,
          collaboratorIds: form.collaborators.map((collaborator) => collaborator.id),
        });

        if (cover) {
          const { coverUrl } = await uploadCover(sample.id, cover);
          updated = { ...updated, coverUrl };
          setCover(null);
        }

        setSample(updated);

        if (advance) {
          const nextStep: WizardStep = updated.status === "DRAFT" ? 3 : nextStepFor(updated, 3);
          setStepState(nextStep);
          syncUrl(nextStep, updated.id);
        }

        return updated;
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "could not save details.");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [cover, coverError, form, sample, syncUrl]
  );

  const refreshSample = useCallback(async () => {
    if (!sample) return;
    const loaded = await fetchSampleById(sample.id);
    if (loaded) setSample(loaded);
  }, [sample]);

  const retry = useCallback(async () => {
    if (!sample) return;
    setError(null);
    try {
      setSample(await retryProcessing(sample.id));
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "retry failed.");
    }
  }, [sample]);

  const remove = useCallback(async () => {
    if (!sample) return;
    try {
      await deleteSample(sample.id);
      setSample(null);
      setFile(null);
      goTo(1, null);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "could not delete the upload.");
    }
  }, [goTo, sample]);

  /** Step 4: publish (or keep private) and land on the sample page. */
  const publish = useCallback(async () => {
    if (!sample || isPublishing) return;

    setIsPublishing(true);
    setError(null);

    try {
      const updated = await setVisibility(sample.id, visibility);
      setSample(updated);
      navigate(`/sample/${updated.id}`, {
        replace: true,
        state: { notice: visibility === "published" ? "published — it's live in the feed." : "saved as private." },
      });
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "could not publish.");
    } finally {
      setIsPublishing(false);
    }
  }, [isPublishing, navigate, sample, visibility]);

  const saveDraftAndLeave = useCallback(async () => {
    if (sample && step === 2) {
      const saved = await saveMetadata({ advance: false });
      if (!saved) return;
    }
    navigate(sample ? `/sample/${sample.id}` : "/feed");
  }, [navigate, sample, saveMetadata, step]);

  const state: UploadWizardState = {
    step,
    file,
    fileError,
    uploadPercent,
    isUploading,
    sample,
    form,
    formErrors,
    cover,
    coverError,
    isSaving,
    isPublishing,
    visibility,
    error,
    isHydrating,
  };

  return {
    state,
    parent,
    selectFile,
    clearFile,
    continueFromDropzone,
    cancelUpload,
    updateForm,
    selectCover,
    saveMetadata,
    refreshSample,
    retry,
    remove,
    setVisibility: setVisibilityState,
    publish,
    saveDraftAndLeave,
    goTo,
  };
}

export type UploadWizard = ReturnType<typeof useUploadWizard>;

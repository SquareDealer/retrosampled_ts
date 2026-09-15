import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { can } from "@retrosampled/shared";
import type { SampleDetail, SampleStatus, SampleVisibility } from "@retrosampled/shared";
import { deleteSample, fetchSampleById, retryProcessing, setVisibility, updateSample } from "../../api/samples";
import { uploadCover } from "../../api/uploads";
import { useAuth } from "../../auth/useAuth";
import { CoverPicker } from "../UploadPage/components/CoverPicker";
import { MetadataFields, TitleField } from "../UploadPage/components/MetadataFields";
import { Icon } from "../UploadPage/components/icons";
import { validateCoverFile } from "../UploadPage/uploadConstants";
import {
  EMPTY_FORM,
  formFromSample,
  validateMetadata,
  type MetadataErrors,
  type MetadataForm,
} from "../UploadPage/useUploadWizard";
import "../UploadPage/UploadPage.css";
import "./SampleEditPage.css";

type Status = "loading" | "ready" | "missing" | "forbidden" | "error";

const STATUS_LABEL: Record<SampleStatus, string> = {
  DRAFT: "draft",
  PUBLISHED: "published",
  PRIVATE: "private",
  PROCESSING: "processing",
  FAILED: "failed",
};

/** `/sample/:sampleId/edit` — metadata, cover, visibility and delete for an existing sample. */
const SampleEditPage: React.FC = () => {
  const { sampleId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState<Status>("loading");
  const [sample, setSample] = useState<SampleDetail | null>(null);
  const [form, setForm] = useState<MetadataForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<MetadataErrors>({});
  const [cover, setCover] = useState<File | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const actor = user ? { id: user.id, role: user.role } : null;
  const viewer = user ? { id: user.id, username: user.username } : null;

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    void fetchSampleById(sampleId)
      .then((loaded) => {
        if (cancelled) return;
        if (!loaded) {
          setStatus("missing");
          return;
        }

        const allowed = can(actor, "sample:edit", {
          kind: "sample",
          ownerId: loaded.ownerId ?? "",
          status: (loaded.status ?? "PUBLISHED") as SampleStatus,
          collaboratorIds: loaded.collaboratorIds,
        });

        if (!allowed) {
          setStatus("forbidden");
          return;
        }

        setSample(loaded);
        setForm(formFromSample(loaded, user?.id));
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // `actor` is derived from `user`; re-running on user change is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleId, user?.id]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const updateForm = (patch: Partial<MetadataForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as Array<keyof MetadataForm>) {
        if (key === "title" || key === "bpm" || key === "musicalKey" || key === "tags") delete next[key];
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!sample || isSaving) return;

    const nextErrors = sample.status === "PUBLISHED" ? validateMetadata(form) : {};
    if (!form.title.trim()) nextErrors.title = "title is required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || coverError) return;

    setIsSaving(true);

    try {
      await updateSample(sample.id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        bpm: form.bpm.trim() ? Number(form.bpm) : null,
        musicalKey: form.musicalKey || null,
        sampleType: form.sampleType || null,
        tags: form.tags,
        collaboratorIds: form.collaborators.map((collaborator) => collaborator.id),
      });

      if (cover) {
        await uploadCover(sample.id, cover);
      }

      navigate(`/sample/${sample.id}`, { replace: true });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "could not save." });
    } finally {
      setIsSaving(false);
    }
  };

  const changeVisibility = async (visibility: SampleVisibility) => {
    if (!sample || isBusy) return;
    setIsBusy(true);
    try {
      const updated = await setVisibility(sample.id, visibility);
      setSample(updated);
      setNotice({ tone: "ok", text: visibility === "published" ? "published." : "now private." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "could not change visibility." });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRetry = async () => {
    if (!sample || isBusy) return;
    setIsBusy(true);
    try {
      setSample(await retryProcessing(sample.id));
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "retry failed." });
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!sample || isBusy) return;
    if (!window.confirm(`Delete "${sample.title}"? This cannot be undone.`)) return;

    setIsBusy(true);
    try {
      await deleteSample(sample.id);
      navigate("/feed", { replace: true });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "could not delete." });
      setIsBusy(false);
    }
  };

  if (status === "loading") {
    return (
      <main className="upload-page" aria-busy="true">
        <div className="upload-skeleton" aria-label="Loading sample" />
      </main>
    );
  }

  if (status !== "ready" || !sample) {
    const copy =
      status === "missing"
        ? ["sample not found", "it does not exist or was removed."]
        : status === "forbidden"
          ? ["not your sample", "only the owner (or an admin) can edit it."]
          : ["could not load the sample", "please try again."];

    return (
      <main className="upload-page">
        <section className="upload-page__state" aria-live="polite">
          <h2>{copy[0]}</h2>
          <p>{copy[1]}</p>
          <Link className="upload-btn" to={status === "forbidden" ? `/sample/${sampleId}` : "/feed"}>
            {status === "forbidden" ? "open sample" : "back to feed"}
          </Link>
        </section>
      </main>
    );
  }

  const sampleStatus = (sample.status ?? "PUBLISHED") as SampleStatus;
  const ogCreator = sample.creators.find((creator) => creator.roles.includes("OG_CREATOR")) ?? null;
  const canPublish = sampleStatus === "DRAFT" || sampleStatus === "PRIVATE";

  return (
    <main className="upload-page sample-edit">
      <header className="upload-page__header">
        <p className="upload-page__eyebrow">edit sample</p>
        <h1 className="upload-page__title">{sample.title}</h1>
        <p className="upload-page__lede">
          <span className={`library-status library-status--${sampleStatus.toLowerCase()}`}>
            {STATUS_LABEL[sampleStatus]}
          </span>
          {"  "}
          <Link to={`/sample/${sample.id}`}>open sample page</Link>
        </p>
      </header>

      <div className="upload-grid">
        <div className="upload-stack">
          <CoverPicker
            file={cover}
            existingUrl={sample.coverUrl}
            error={coverError}
            onChange={(file) => {
              setCover(file);
              setCoverError(file ? validateCoverFile(file) : null);
            }}
          />

          <div className="upload-field">
            <span className="upload-label">
              <span>visibility</span>
            </span>
            <div className="sample-edit__visibility">
              {canPublish ? (
                <button
                  type="button"
                  className="upload-btn upload-btn--primary"
                  disabled={isBusy}
                  onClick={() => {
                    void changeVisibility("published");
                  }}
                >
                  publish
                </button>
              ) : null}
              {sampleStatus === "PUBLISHED" ? (
                <button
                  type="button"
                  className="upload-btn"
                  disabled={isBusy}
                  onClick={() => {
                    void changeVisibility("private");
                  }}
                >
                  make private
                </button>
              ) : null}
              {sampleStatus === "FAILED" ? (
                <button
                  type="button"
                  className="upload-btn"
                  disabled={isBusy}
                  onClick={() => {
                    void handleRetry();
                  }}
                >
                  retry processing
                </button>
              ) : null}
              {sampleStatus === "PROCESSING" ? (
                <span className="upload-hint">still processing — check back in a moment.</span>
              ) : null}
            </div>
            {sampleStatus === "PUBLISHED" ? (
              <span className="upload-hint">private samples stay in your library and never show in the feed.</span>
            ) : null}
          </div>

          <div className="upload-field sample-edit__danger">
            <span className="upload-label">
              <span>danger zone</span>
            </span>
            <button
              type="button"
              className="upload-btn upload-btn--danger"
              disabled={isBusy}
              onClick={() => {
                void handleDelete();
              }}
            >
              delete sample
            </button>
            <span className="upload-hint">remakes keep existing but lose the link to this sample.</span>
          </div>
        </div>

        <div className="upload-stack">
          <TitleField
            id="edit-title"
            value={form.title}
            error={errors.title}
            onChange={(title) => updateForm({ title })}
          />
          <MetadataFields
            form={form}
            errors={errors}
            onChange={updateForm}
            viewer={viewer}
            inheritedTags={sample.inheritedFrom ? undefined : undefined}
            ogCreator={ogCreator && ogCreator.id !== sample.ownerId ? { id: ogCreator.id, username: ogCreator.username } : null}
            fromParent={Boolean(sample.inheritedFrom)}
            hideTitle
            idPrefix="edit"
          />
        </div>
      </div>

      <div className="upload-actions">
        <Link className="upload-btn" to={`/sample/${sample.id}`}>
          <Icon.Back /> cancel
        </Link>
        <div className="upload-actions__r">
          <button
            type="button"
            className="upload-btn upload-btn--primary"
            disabled={isSaving || isBusy}
            onClick={() => {
              void handleSave();
            }}
          >
            {isSaving ? "saving…" : "save changes"}
          </button>
        </div>
      </div>

      {notice ? (
        <div className={`upload-toast upload-toast--${notice.tone}`} role="status" aria-live="polite">
          {notice.text}
        </div>
      ) : null}
    </main>
  );
};

export default SampleEditPage;

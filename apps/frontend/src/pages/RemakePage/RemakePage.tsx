import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { SampleDetail } from "@retrosampled/shared";
import { fetchSampleById } from "../../api/samples";
import type { RemakeTakeState } from "../SampleFlipPage/FlipWorkspace";
import UploadPage from "../UploadPage/UploadPage";
import "../UploadPage/UploadPage.css";

type Status = "loading" | "ready" | "missing" | "error";

/** `/sample/:sampleId/remake` — the upload wizard in remake mode. */
const RemakePage: React.FC = () => {
  const { sampleId = "" } = useParams();
  const take = (useLocation().state ?? null) as Partial<RemakeTakeState> | null;
  const [status, setStatus] = useState<Status>("loading");
  const [parent, setParent] = useState<SampleDetail | null>(null);
  const [errorText, setErrorText] = useState<string>("");

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
        setParent(loaded);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorText(error instanceof Error ? error.message : "Failed to load sample.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [sampleId]);

  if (status === "loading") {
    return (
      <main className="upload-page" aria-busy="true">
        <div className="upload-skeleton" aria-label="Loading sample" />
      </main>
    );
  }

  if (status !== "ready" || !parent) {
    return (
      <main className="upload-page">
        <section className="upload-page__state" aria-live="polite">
          <h2>{status === "missing" ? "sample not found" : "could not load the sample"}</h2>
          <p>{status === "missing" ? "it does not exist or was removed." : errorText}</p>
          <Link className="upload-btn" to="/feed">
            back to feed
          </Link>
        </section>
      </main>
    );
  }

  return (
    <UploadPage
      parent={parent}
      initialFile={take?.remakeFile instanceof File ? take.remakeFile : null}
      initialBpm={take?.remakeBpm}
    />
  );
};

export default RemakePage;

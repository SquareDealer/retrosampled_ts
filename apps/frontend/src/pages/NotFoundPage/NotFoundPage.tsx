import React from "react";
import { Link, useLocation } from "react-router-dom";
import "../social.css";
import "./NotFoundPage.css";

const NotFoundPage: React.FC = () => {
  const location = useLocation();

  return (
    <main className="social-page not-found">
      <p className="not-found__code">404</p>
      <h1 className="social-title">This crate is empty</h1>
      <p className="social-subtitle">
        Nothing lives at this address. The sample may have been removed, or the link was never real.
      </p>
      <span className="not-found__path">{location.pathname}</span>
      <div className="not-found__actions">
        <Link to="/feed" className="social-btn social-btn--primary">
          Go to feed
        </Link>
        <Link to="/library" className="social-btn">
          Open library
        </Link>
      </div>
    </main>
  );
};

export default NotFoundPage;

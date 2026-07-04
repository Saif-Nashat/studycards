"use client";

// Last-resort error screen: only shows if the root layout itself crashes, so
// it must bring its own <html>/<body> and inline styles (the app's CSS and
// fonts may not have loaded).
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f3f6f0",
          color: "#0c1a11",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
          <p style={{ color: "#5a6e60", fontSize: "0.9rem", lineHeight: 1.6 }}>
            Don&apos;t worry — your cards and progress are safe. Please try again; if it
            keeps happening, come back in a few minutes.
          </p>
          {error?.digest && (
            <p style={{ color: "#5a6e60", fontSize: "0.75rem", marginTop: "0.5rem" }}>
              Error code: {error.digest}
            </p>
          )}
          <button
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1.25rem",
              padding: "0.6rem 1.4rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#15803d",
              color: "#fff",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

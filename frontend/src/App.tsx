import { useEffect, useState, type MouseEvent } from "react";
import { BackupDataSimulPage } from "./pages/BackupDataSimulPage";
import { ComparisonPage } from "./pages/ComparisonPage";
import styles from "./App.module.css";

const VIEW_COMPARISON_PATH = "/view-comparison";
const BACKUP_DATA_SIMUL_PATH = "/backup-data-simul";

type AppPath =
  | typeof VIEW_COMPARISON_PATH
  | typeof BACKUP_DATA_SIMUL_PATH;

function resolvePath(pathname: string): AppPath {
  return pathname === BACKUP_DATA_SIMUL_PATH
    ? BACKUP_DATA_SIMUL_PATH
    : VIEW_COMPARISON_PATH;
}

export function App() {
  const [currentPath, setCurrentPath] = useState<AppPath>(() =>
    resolvePath(window.location.pathname),
  );

  useEffect(() => {
    if (
      window.location.pathname !== VIEW_COMPARISON_PATH &&
      window.location.pathname !== BACKUP_DATA_SIMUL_PATH
    ) {
      window.history.replaceState(null, "", VIEW_COMPARISON_PATH);
    }

    const handlePopState = () => {
      setCurrentPath(resolvePath(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (event: MouseEvent<HTMLAnchorElement>, path: AppPath) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    if (path !== currentPath) {
      window.history.pushState(null, "", path);
      setCurrentPath(path);
    }
  };

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <a
          className={styles.brand}
          href={VIEW_COMPARISON_PATH}
          aria-label="Oracle Lens home"
          onClick={(event) => navigate(event, VIEW_COMPARISON_PATH)}
        >
          <span className={styles.mark}>OL</span>
          <span>
            <strong>Oracle Lens</strong>
            <small>Database comparison workspace</small>
          </span>
        </a>

        <nav className={styles.tabs} aria-label="Main navigation">
          <a
            href={VIEW_COMPARISON_PATH}
            className={currentPath === VIEW_COMPARISON_PATH ? styles.activeTab : undefined}
            aria-current={currentPath === VIEW_COMPARISON_PATH ? "page" : undefined}
            onClick={(event) => navigate(event, VIEW_COMPARISON_PATH)}
          >
            View Comparison
          </a>
          <a
            href={BACKUP_DATA_SIMUL_PATH}
            className={currentPath === BACKUP_DATA_SIMUL_PATH ? styles.activeTab : undefined}
            aria-current={currentPath === BACKUP_DATA_SIMUL_PATH ? "page" : undefined}
            onClick={(event) => navigate(event, BACKUP_DATA_SIMUL_PATH)}
          >
            Backup Data Simul
          </a>
        </nav>

        <div className={styles.security}>
          <span aria-hidden="true">◇</span>
          Session-only credentials
        </div>
      </header>

      {currentPath === BACKUP_DATA_SIMUL_PATH ? (
        <BackupDataSimulPage />
      ) : (
        <ComparisonPage />
      )}

      <footer className={styles.footer}>
        <span>Oracle Lens</span>
        <p>Connection strings exist only in memory for the current page session.</p>
      </footer>
    </div>
  );
}

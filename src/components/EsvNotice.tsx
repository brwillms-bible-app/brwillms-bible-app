import { ESV_NOTICE } from "@/lib/esv/notice";

/** Crossway's mandatory notice, verbatim, with the required link to www.esv.org. */
export function EsvNotice({ compact = false }: { compact?: boolean }) {
  const [before] = ESV_NOTICE.split("https://www.esv.org");
  return (
    <p className={compact ? "esv-notice compact" : "esv-notice"} data-testid="esv-notice">
      {before}
      <a href="https://www.esv.org" target="_blank" rel="noopener noreferrer">
        https://www.esv.org
      </a>
    </p>
  );
}

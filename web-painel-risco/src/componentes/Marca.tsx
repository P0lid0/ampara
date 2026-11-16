/** Marca do Ampara: um arco que abriga (amparo) sobre o selo esmeralda. */
export function Marca() {
  return (
    <span className="marca">
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="9" fill="#14B88A" />
        <path d="M8 23V15.5a8 8 0 0116 0V23" fill="none" stroke="#0F4C4A" strokeWidth="3" strokeLinecap="round" />
        <circle cx="16" cy="19.5" r="2.4" fill="#0F4C4A" />
      </svg>
      <span>Ampara</span>
    </span>
  );
}

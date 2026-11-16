// Ícones SVG inline: traço de 2 px, pontas arredondadas, 24 px. Nada de caractere de fonte (muda de forma por aparelho).
import type { ReactNode } from "react";

function Base({ children, tamanho = 24 }: { children: ReactNode; tamanho?: number }) {
  return (
    <svg
      className="icone"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type P = { tamanho?: number };

export const IconeCheck = (p: P) => (
  <Base {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Base>
);
export const IconeAlerta = (p: P) => (
  <Base {...p}><path d="M12 4l9 16H3L12 4z" /><path d="M12 10v4" /><path d="M12 17.5v.01" /></Base>
);
export const IconeVoltar = (p: P) => (
  <Base {...p}><path d="M15 5l-7 7 7 7" /></Base>
);
export const IconeSair = (p: P) => (
  <Base {...p}><path d="M10 5H6a1 1 0 00-1 1v12a1 1 0 001 1h4" /><path d="M15 8l4 4-4 4" /><path d="M19 12H9" /></Base>
);
export const IconeOlho = (p: P) => (
  <Base {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></Base>
);
export const IconeOlhoRiscado = (p: P) => (
  <Base {...p}><path d="M3 3l18 18" /><path d="M10.3 5.7A9 9 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 01-2.7 3.4" /><path d="M6.6 7.2A16 16 0 002.5 12S6 18.5 12 18.5a9 9 0 003.4-.7" /><path d="M9.9 9.9a2.8 2.8 0 003.2 3.2" /></Base>
);
export const IconeRelogio = (p: P) => (
  <Base {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Base>
);
export const IconePino = (p: P) => (
  <Base {...p}><path d="M12 21s6.5-5.7 6.5-11A6.5 6.5 0 005.5 10C5.5 15.3 12 21 12 21z" /><circle cx="12" cy="10" r="2.3" /></Base>
);
export const IconeCopiar = (p: P) => (
  <Base {...p}><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 6v8A1.5 1.5 0 006 15.5h2.5" /></Base>
);
export const IconeExterno = (p: P) => (
  <Base {...p}><path d="M14 5h5v5" /><path d="M19 5l-8 8" /><path d="M17 14v4a1 1 0 01-1 1H6a1 1 0 01-1-1V8a1 1 0 011-1h4" /></Base>
);
export const IconeAjuda = (p: P) => (
  <Base {...p}><circle cx="12" cy="12" r="8.5" /><path d="M9.7 9.6a2.4 2.4 0 014.6.8c0 1.6-2.3 2-2.3 3.4" /><path d="M12 16.8v.01" /></Base>
);

/** Marca do Ampara: o "A" em ponta, em esmeralda sobre o petróleo da faixa. */
export function Marca({ tamanho = 28 }: P) {
  return (
    <svg className="marca-sinal" width={tamanho} height={tamanho} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <path d="M7 25L16 7l9 18" stroke="#14B88A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export const IconeFechar = (p: P) => (
  <Base {...p}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></Base>
);

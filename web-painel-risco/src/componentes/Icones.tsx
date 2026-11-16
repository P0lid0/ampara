import type { SVGProps } from "react";

/** Ícones desenhados em SVG (traço de 2 px, pontas redondas): não mudam de forma conforme a fonte do aparelho. */
function Base({ tamanho = 24, children, ...resto }: { tamanho?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      {children}
    </svg>
  );
}

type P = { tamanho?: number };

/** Seguro: círculo com visto. */
export const IconeSeguro = ({ tamanho }: P) => (
  <Base tamanho={tamanho}>
    <circle cx="12" cy="12" r="10" />
    <path d="M7.5 12.5l3 3 6-7" />
  </Base>
);

/** Atenção: triângulo com exclamação. */
export const IconeAtencao = ({ tamanho }: P) => (
  <Base tamanho={tamanho}>
    <path d="M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    <path d="M12 9.5v4.5M12 17.5h.01" />
  </Base>
);

/** Risco alto: círculo com exclamação (forma diferente do triângulo para não depender só de cor). */
export const IconeAlto = ({ tamanho }: P) => (
  <Base tamanho={tamanho}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 7v6M12 16.5h.01" />
  </Base>
);

/** Dado protegido: escudo com visto. */
export const IconeProtegido = ({ tamanho }: P) => (
  <Base tamanho={tamanho}>
    <path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.3-7.5 9.5-4.4-1.2-7.5-4.9-7.5-9.5V6L12 3z" />
    <path d="M8.8 12.2l2.4 2.4 4-4.6" />
  </Base>
);

/** Disparo registrado. */
export const IconeEnviado = ({ tamanho }: P) => (
  <Base tamanho={tamanho}>
    <path d="M21 3L10.5 13.5" />
    <path d="M21 3l-6.8 18-3.7-7.5L3 9.8 21 3z" />
  </Base>
);

import { render, screen } from "@testing-library/react";
import { Farol } from "./componentes/Farol";
import type { FarolCor } from "./tipos";

test.each([
  ["verde", "Seguro", 12],
  ["amarelo", "Atenção", 40],
  ["vermelho", "Risco alto", 75],
])("farol %s mostra palavra e índice", (f, palavra, i) => {
  render(<Farol farol={f as FarolCor} indice={i as number} />);
  const s = screen.getByRole("status");
  expect(s).toHaveTextContent(palavra as string);
  expect(s).toHaveTextContent(`${i}/100`);
});

/** Copia texto para a área de transferência. Safari/iPhone fora de HTTPS não tem navigator.clipboard: cai em textarea + execCommand. */
export async function copiarTexto(t: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    /* recusado: tenta o plano B */
  }
  const area = document.createElement("textarea");
  area.value = t;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  document.body.appendChild(area);
  try {
    area.focus();
    area.select();
    area.setSelectionRange(0, t.length); // iOS
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}

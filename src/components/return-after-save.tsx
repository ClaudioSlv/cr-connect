"use client";

import { useEffect } from "react";

// Ordens de Serviço e chamados CR SOS ficam na própria tela depois de salvar,
// para que a oficina acompanhe ou ajuste o atendimento sem ser redirecionada.
const savedMessage = /cliente salvo|veículo salvo|produto salvo|movimentação salva|lançamento salvo|procedimento salvo|dtc salvo|configurações salvas|oficina atualizada|cr sos atualizado|equipe atualizada/i;

export function ReturnAfterSave() {
  useEffect(() => {
    let timer: number | undefined;
    const observer = new MutationObserver(() => {
      if (location.pathname === "/app" || !savedMessage.test(document.body.innerText)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => window.location.assign("/app"), 900);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, []);
  return null;
}

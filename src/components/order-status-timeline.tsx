const steps = [
  ["open", "Recebida pela oficina"],
  ["diagnosing", "Em diagnóstico"],
  ["awaiting_approval", "Aguardando aprovação"],
  ["awaiting_appointment", "Aguardando agendamento"],
  ["appointment_confirmed", "Agendamento confirmado"],
  ["awaiting_part", "Aguardando peça"],
  ["repairing", "Em manutenção"],
  ["finished", "Testes realizados · aguardando retirada"],
  ["delivered", "Entregue"],
] as const;

export function OrderStatusTimeline({ status }: { status: string }) {
  if (status === "cancelled") return <div className="mt-4 rounded-xl border border-red-500/60 bg-red-500/10 p-4"><b className="text-red-300">O.S. cancelada</b><p className="mt-1 text-sm text-zinc-300">O atendimento não seguirá para as próximas etapas.</p></div>;
  const label = steps.find(([value]) => value === status)?.[1] || "Situação não informada";
  return <div className="mt-3"><p className="text-xs text-zinc-400">Situação atual</p><p className="mt-1 font-bold text-[#FFC107]">{label}</p><details className="mt-3"><summary className="cursor-pointer text-sm text-zinc-300">Ver etapas do atendimento</summary><p className="mt-2 text-xs text-zinc-400">Referência de situações possíveis. A ordem não comprova etapas realizadas.</p><ul className="mt-3 space-y-2">{steps.map(([value, title]) => <li key={value} className={value === status ? "rounded-lg bg-[#FFC107]/10 p-2 text-sm font-bold text-[#FFC107]" : "p-2 text-sm text-zinc-400"}>{title}{value === status ? " · Atual" : ""}</li>)}</ul></details></div>;
}

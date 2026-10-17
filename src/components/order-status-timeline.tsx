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
  return <div className="mt-3">
    <p className="text-xs text-zinc-400">Situação atual</p>
    <p className="mt-1 font-bold text-[#FFC107]">{label}</p>
    <details className="mt-3">
      <summary className="cursor-pointer text-sm text-zinc-300">Ver etapas do atendimento</summary>
      <ol aria-label="Etapas do atendimento" className="mt-4">
        {steps.map(([value, title], index) => {
          const active = value === status;
          return <li key={value} aria-current={active ? "step" : undefined} className="grid grid-cols-[32px_1fr] gap-3">
            <div className="flex flex-col items-center">
              <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold ${active ? "border-[#FFC107] bg-[#FFC107] text-black ring-4 ring-[#FFC107]/15" : "border-zinc-600 bg-zinc-800 text-zinc-400"}`}>{index + 1}</span>
              {index < steps.length - 1 && <span aria-hidden="true" className="min-h-6 w-0.5 flex-1 bg-zinc-700" />}
            </div>
            <div className="pb-6 pt-1">
              <p className={active ? "font-bold text-[#FFC107]" : "text-zinc-400"}>{title}</p>
              {active && <p className="mt-1 text-xs text-[#FFC107]">Etapa atual</p>}
            </div>
          </li>;
        })}
      </ol>
    </details>
  </div>;
}

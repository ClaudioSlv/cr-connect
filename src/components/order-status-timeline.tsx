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
  const activeIndex = steps.findIndex(([value]) => value === status);
  const current = activeIndex < 0 ? 0 : activeIndex;
  return <ol className="mt-4 space-y-0">{steps.map(([value, label], index) => {
    const complete = index < current;
    const active = index === current;
    return <li key={value} className="grid grid-cols-[30px_1fr] gap-3"><div className="flex flex-col items-center"><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${complete ? "bg-[#8bdc45] text-black" : active ? "bg-[#FFC107] text-black" : "bg-zinc-700 text-zinc-300"}`}>{complete ? "✓" : index + 1}</span>{index < steps.length - 1 && <span className={`h-7 w-0.5 ${complete ? "bg-[#8bdc45]" : "bg-zinc-700"}`} />}</div><div className="pt-1"><p className={active ? "font-bold text-[#FFC107]" : complete ? "text-zinc-100" : "text-zinc-500"}>{label}</p>{active && <p className="mt-1 text-xs text-[#FFC107]">Etapa atual</p>}</div></li>;
  })}</ol>;
}

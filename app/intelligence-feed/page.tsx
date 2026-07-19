import { AvaPageShell, SectionHeader, StatusPill } from "@/app/components/ava-shell";
import { getAvaDailyContextForCurrentUser } from "@/lib/ava/daily-context-server";

export default async function IntelligenceFeedPage() {
  const { intelligenceFeed } = (await getAvaDailyContextForCurrentUser()).context;
  return (
    <AvaPageShell eyebrow="Ava Intelligence Feed" title="Intelligence Feed" subtitle="I am collecting the signals I notice while working in the background.">
      <section className="panel">
        <SectionHeader title="Signal Timeline" action={<StatusPill>{intelligenceFeed.length} items</StatusPill>} />
        <div className="timeline">
          {intelligenceFeed.map((item) => <article className="timeline-item" key={item.id}><span className={`dot ${item.severity}`} /><div><div className="timeline-meta">{item.timestamp} · {item.category}</div><h2>{item.title}</h2><p>{item.summary}</p></div><button className="inline-button" type="button">{item.action}</button></article>)}
        </div>
      </section>
    </AvaPageShell>
  );
}

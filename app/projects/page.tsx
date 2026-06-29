import { AvaPageShell, SectionHeader, StatusPill } from "@/app/components/ava-shell";
import { getAvaProjects } from "@/lib/ava/projects";

export default function ProjectsPage() {
  const projects = getAvaProjects();
  return (
    <AvaPageShell eyebrow="Ava Projects" title="Projects" subtitle="I am keeping active systems, phases, and next actions organized in the background.">
      <section className="grid project-grid">
        {projects.map((project) => <article className="panel project-card" key={project.name}><SectionHeader title={project.name} action={<StatusPill tone={project.status === "Active" ? "good" : "normal"}>{project.status}</StatusPill>} /><p>{project.description}</p><div className="detail-grid"><span>Phase<strong>{project.phase}</strong></span><span>Updated<strong>{project.lastUpdated}</strong></span></div><div className="next-action">{project.nextAction}</div><div className="tag-row">{project.relatedSystems.map((system) => <span className="badge" key={system}>{system}</span>)}</div><span className="inline-link">{project.source === "local-workspace" ? "I found the local workspace" : "I am waiting on a workspace link"}</span></article>)}
      </section>
    </AvaPageShell>
  );
}

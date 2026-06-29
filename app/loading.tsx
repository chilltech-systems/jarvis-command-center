export default function Loading() {
  return (
    <main className="shell">
      <section className="hero ava-hero">
        <div>
          <div className="eyebrow">Ava Dashboard</div>
          <h1>Loading</h1>
          <div className="subtle">I am refreshing the dashboard signals.</div>
        </div>
        <div className="loading-pulse">Syncing</div>
      </section>
      <nav className="main-tabs" aria-label="Ava dashboard sections">
        {["Home", "Daily Brief", "Calendar", "Tasks", "Projects", "Automations", "Intelligence Feed", "Settings"].map((label) => (
          <span className="main-tab skeleton-tab" key={label}>{label}</span>
        ))}
      </nav>
      <section className="grid brief-grid">
        <div className="panel loading-panel" />
        <div className="panel loading-panel" />
        <div className="panel loading-panel span-full" />
      </section>
    </main>
  );
}

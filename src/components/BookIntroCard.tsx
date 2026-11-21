import type { BookIntro } from "@/lib/content";

export function BookIntroCard({ name, intro }: { name: string; intro?: BookIntro }) {
  if (!intro) return null;
  return (
    <section className="card intro" style={{ borderColor: intro.color }}>
      <div className="intro-head" style={{ background: intro.color }}>
        <span className="pill">{intro.testament}</span>
        <h3>{name}</h3>
      </div>
      <dl>
        <dt>✍️ Who wrote it</dt>
        <dd>{intro.author}</dd>
        <dt>📅 When</dt>
        <dd>{intro.written}</dd>
        <dt>🎯 Big idea</dt>
        <dd>{intro.focus}</dd>
      </dl>
      <h4>🧠 What we learn</h4>
      <ul>
        {intro.objectives.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>
      <p className="fineprint">Book intro written by our team (not Scripture text).</p>
    </section>
  );
}

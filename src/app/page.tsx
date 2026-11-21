import Link from "next/link";
import { bookIntros, scenes, scenesByBook } from "@/lib/content";
import { BookIntroCard } from "@/components/BookIntroCard";

export default function Home() {
  const featured = scenes.find((s) => s.id === "abram-called");
  return (
    <div className="home">
      <section className="hero">
        <h1>Explore the Bible, one picture at a time ✨</h1>
        <p>
          Pick a scene to see the artwork, read the passage, and listen to the audio — all streamed live.
        </p>
        <p>
          The base text is the Berean Standard Bible, which is in the public domain. The ESV is an optional later
          route, under Crossway&apos;s non-commercial terms.
        </p>
      </section>
      {featured && (
        <Link href={`/scene/${featured.id}`} className="featured" data-testid="featured-scene">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={featured.image} alt={`Illustration: ${featured.title}`} />
          <div>
            <span className="pill">⭐ Start here · {featured.passage}</span>
            <h2>{featured.title}</h2>
            <p>God calls Abram to leave Haran and travel to a new land. Follow his journey on the map!</p>
            <span className="go">▶ Open the scene</span>
          </div>
        </Link>
      )}
      {scenesByBook().map(({ book, scenes }) => (
        <section key={book} className="book-row">
          <div className="scenes">
            <h2>{book}</h2>
            <div className="grid">
              {scenes.map((s) => (
                <Link key={s.id} href={`/scene/${s.id}`} className="scene-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image} alt="" />
                  <div>
                    <strong>{s.title}</strong>
                    <span>{s.passage}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <BookIntroCard name={book} intro={bookIntros[book]} />
        </section>
      ))}
    </div>
  );
}

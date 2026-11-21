import Link from "next/link";
export default function NotFound() {
  return (
    <div className="card prose">
      <h1>Scene not found 🐑</h1>
      <Link href="/">Back to all scenes</Link>
    </div>
  );
}

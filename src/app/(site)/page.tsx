import { Board } from "@/ui/Board";
import { Hand } from "@/ui/Hand";
import { Log } from "@/ui/Log";

export default function HomePage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-3xl font-bold">Brass: Birmingham</h1>
      <section className="space-y-2">
        <Board />
        <Hand />
        <Log />
      </section>
    </main>
  );
}

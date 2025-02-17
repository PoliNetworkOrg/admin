import { TRPC_PATH, type AppRouter } from "@polinetwork/backend";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

const url = "http://localhost:3000" + TRPC_PATH;
const api = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url })] });

export default async function TestTRPCPage() {
  const groups = await api.tg.groups.getAll.query();

  return (
    <div className="flex w-full flex-col gap-4">
      {groups.map((g) => (
        <div key={g.id} className="flex items-center justify-between">
          <p className="flex-1">{g.title}</p>
          <a href={g.link ?? ""} className="flex-1">
            {g.link}
          </a>
          <p className="flex-1">{g.telegramId}</p>
        </div>
      ))}
    </div>
  );
}

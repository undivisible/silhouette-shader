import { createMoonshineServer } from "@tschk/moonshine/server";
import { join } from "node:path";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer from 1 to 65535");
}
createMoonshineServer({
  port,
  staticDir: join(import.meta.dir, "dist"),
  pages: {
    "/": { render: () => Bun.file(join(import.meta.dir, "dist/index.html")).text() },
  },
}).listen();

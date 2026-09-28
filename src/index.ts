import { Hono } from "hono";
import { urlsRoute } from "./routes/urls";

const app = new Hono();

app.get("/", (c) => {
  return c.json({ message: "Hello from Shorty!" });
});

app.route("/", urlsRoute);

export default { port: 3000, fetch: app.fetch };

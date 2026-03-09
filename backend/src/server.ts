import { app } from "./app.js";
import { env } from "./config/env.js";

const port = env.PORT;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on port ${port}`);
});


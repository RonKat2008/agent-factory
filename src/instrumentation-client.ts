import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    { path: "/api/agents", method: "POST" },
    { path: "/api/demo/tour", method: "POST" },
  ],
});

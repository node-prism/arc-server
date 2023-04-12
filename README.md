# arc-server

arc-server uses [`@prsm/duplex`](https://github.com/node-prism/duplex) to create a server that [`@prsm/arc-client`](https://github.com/node-prism/arc-client) clients can connect to and communicate with.

## Quickstart

```typescript
import { ArcServer } from "@prsm/arc-server";

ArcServer.init({ host: "0.0.0.0", port: 3351, secure: false });
```

You can listen to command events.

```typescript
ArcServer.emitter.on("auth", ({ payload }) => { });
ArcServer.emitter.on("query", ({ payload }) => { });
ArcServer.emitter.on("createUser", ({ payload }) => { });
ArcServer.emitter.on("removeUser", ({ payload }) => { });
```

You can query directly from the server instance.

```typescript
ArcServer.query({
  collection: "planets",
  operation: "find",
  data: {
    query: { name: { $includes: "M" } },
  },
});
```

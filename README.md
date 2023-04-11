# arc-server

arc-server uses [`@prsm/duplex`](https://github.com/node-prism/duplex) to create a server that [`@prsm/arc-client`](https://github.com/node-prism/arc-client) clients can connect to and communicate with.

## Quickstart

```typescript
import { ArcServer } from "@prsm/arc-server";

ArcServer.init({ host: "localhost", port: 3351, secure: false });
```

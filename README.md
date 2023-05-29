# arc-server

[![NPM version](https://img.shields.io/npm/v/@prsm/arc-server?color=a1b858&label=)](https://www.npmjs.com/package/@prsm/arc-server)

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


## Sharded collections

Normally, when you query for a collection, the server will create a standard `Collection` instance for you.

If you want to have a `ShardedCollection` instance instead, you can define a `ShardedCollectionDefinition[]` and pass it to the server during `init`.

```typescript
const shardedCollections = [
  {
    // Collection name
    name: "planets",
    // The key to shard on
    shardKey: "planet_name",
    // How many shards to create
    shardCount: 3,
    // The adapter to use (not instantiated, just the class)
    adapter: FSAdapter,
    // The options to pass to the adapter when a shard Collection is created
    adapterOptions: {
      storagePath: ".data", // where to store the shards
      name: "planets", // this is the name of the shard files (planets_shard0, etc)
    },
  },
];

ArcServer.init({ ..., shardedCollections });
```

For an explanation of the above options, see [`ShardedCollectionDefinition`](https://github.com/node-prism/arc-server/blob/fe2d4e6efb7be2544ebd6ae1c7470f7c200c7a8e/src/server.ts#L188-L190)
import { Collection, CollectionOptions, FSAdapter, QueryOptions, ShardedCollection, ShardOptions } from "@prsm/arc";
import { CommandServer, Connection } from "@prsm/duplex";
import { EventEmitter } from "node:events";
import { CreateAccessToken, ValidateAccessToken } from "./auth";
import { hash } from "./hasher";

interface User {
  id?: string;
  username: string;
  password: string;
}

type QueryPayload = {
  collection: string;
  operation: "find" | "insert" | "update" | "remove" | "drop";
  data: {
    query?: object;
    operations?: object;
    options?: QueryOptions;
  };
}

type AuthenticatedQueryPayload = QueryPayload & {
  accessToken: string;
};

type AuthPayload = {
  username: string;
  password: string;
};

export type ArcServerOptions = {
  host: string;
  port: number;
  secure: boolean;
  shardedCollections?: ShardedCollectionDefinition<unknown>[];
};

export class ArcServer {
  static queryHandler: QueryHandler;
  static duplex: CommandServer;
  static auth: Partial<{
    users: Collection<User>;
    accessTokens: Collection<{ username: string, accessToken: string }>;
  }> = {};
  static emitter: EventEmitter;

  static init({ host = "localhost", port = 3351, secure = false, shardedCollections = [] }: ArcServerOptions) {
    this.emitter = new EventEmitter();
    this.queryHandler = new QueryHandler(shardedCollections);
    this.initializeCollections();
    this.ensureRootUserExists();
    this.createServer(host, port, secure);
  }

  static initializeCollections() {
    this.auth.users = new Collection({
      autosync: true,
      timestamps: true,
      adapter: new FSAdapter({ storagePath: ".internal", name: "users" }),
    });

    this.auth.accessTokens = new Collection({
      autosync: true,
      timestamps: true,
      adapter: new FSAdapter({ storagePath: ".internal", name: "accessTokens"}),
    });
  }

  private static ensureRootUserExists() {
    const rootUser = this.auth.users.find({ username: "root" });

    if (!rootUser.length) {
      this.auth.users.insert({
        username: "root",
        password: hash.encode("root"),
      });
    }
  }

  static query(payload: QueryPayload) {
    return this.queryHandler.query(payload);
  }

  private static createUser(username: string, password: string) {
    const user = this.auth.users.find({ username })[0];

    if (user) {
      throw new Error("User already exists");
    }

    this.auth.users.insert({
      username,
      password: hash.encode(password),
    });
  }

  private static removeUser(username: string) {
    const user = this.auth.users.find({ username })[0];

    if (!user) {
      throw new Error("User does not exist");
    }

    this.auth.users.remove({ username });
  }

  private static createServer(host: string, port: number, secure = false) {
    this.duplex = new CommandServer({
      host,
      port,
      secure,
    });

    // authenticate
    this.duplex.command(0, async (payload: AuthPayload, connection: Connection) => {
      this.emitter.emit("auth", { payload, connection });
      if (!payload.username || !payload.password) {
        return { error: "Invalid username or password" };
      }

      const user = this.auth.users.find({ username: payload.username })[0];

      if (!user) {
        return { error: "Invalid username or password" };
      }

      if (!hash.verify(user.password, payload.password)) {
        return { error: "Invalid username or password" };
      }

      const accessToken = CreateAccessToken(payload.username);

      this.auth.accessTokens.remove({ username: payload.username });
      this.auth.accessTokens.insert({ username: payload.username, accessToken });

      return { accessToken };
    });

    // query
    this.duplex.command(2, async (payload: AuthenticatedQueryPayload, connection: Connection) => {
      this.emitter.emit("query", { payload, connection });
      const { accessToken } = payload;
      if (!ValidateAccessToken(accessToken).valid) return { error: "Invalid access token" };
      return this.queryHandler.query(payload);
    });

    // create user
    this.duplex.command(3, async (payload: { username: string, password: string, accessToken: string }, connection: Connection) => {
      this.emitter.emit("createUser", { payload, connection });
      const { username, password, accessToken } = payload;
      if (!username || !password) return { error: "Invalid username or password" };

      if (!ValidateAccessToken(accessToken).valid) return { error: "Invalid access token" };

      try {
        ArcServer.createUser(username, password);
        return { success: true };
      } catch (error) {
        return { error: error.message };
      }
    });

    // remove user
    this.duplex.command(4, async (payload: { username: string, password: string, accessToken: string }, connection: Connection) => {
      this.emitter.emit("removeUser", { payload, connection });
      const { username, password, accessToken } = payload;

      if (!username || !password) return { error: "Invalid username or password" };

      if (!ValidateAccessToken(accessToken).valid) return { error: "Invalid access token" };

      try {
        ArcServer.removeUser(username);
        return { success: true };
      } catch (error) {
        return { error: error.message };
      }
    });
  }
}

const defaultCollectionOptions = {
  autosync: true,
  timestamps: true,
};

type ShardedCollectionDefinition<T> = {
  name: string;
} & ShardOptions<T>;

export class CollectionManager {
  shardedCollections: ShardedCollectionDefinition<unknown>[] = [];
  collections: { [name: string]: { collection: Collection<unknown> | ShardedCollection<unknown>; options: CollectionOptions<unknown> | ShardedCollectionDefinition<unknown> } } = {};

  constructor(shardedCollections: ShardedCollectionDefinition<unknown>[] = []) {
    this.shardedCollections = shardedCollections;
  }

  getCollection(name: string) {
    return this.getOrCreateCollection(name);
  }

  getOrCreateCollection(name: string) {
    if (!this.collections[name]) {

      const shardedCollection = this.shardedCollections.find((c) => c.name === name);

      if (shardedCollection) {
        const collectionOptions: CollectionOptions<unknown> = {
          ...defaultCollectionOptions,
          adapter: new FSAdapter({ storagePath: ".data", name }),
        };

        const shardOptions: ShardOptions<unknown> = {
          ...shardedCollection,
          adapterOptions: {
            ...shardedCollection.adapterOptions,
            storagePath: ".data",
            name,
          },
          // shardKey: "id",
          // shardCount: 2,
          // adapter: FSAdapter,
          // adapterOptions: {
          //   storagePath: ".data",
          //   name,
          // },
        };

        this.collections[name] = {
          collection: new ShardedCollection(collectionOptions, shardOptions),
          options: collectionOptions,
        };


      } else {
        const opts: CollectionOptions<unknown> = {
          ...defaultCollectionOptions,
          adapter: new FSAdapter({ storagePath: ".data", name }),
        };
  
        this.collections[name] = {
          collection: new Collection(opts),
          options: opts,
        };
      }

    }

    return this.collections[name].collection;
  }

  createCollectionWithOptions(name: string, options: CollectionOptions<unknown> = {}) {
    if (this.collections[name]) {
      throw new Error(`Collection ${name} already exists`);
    }

    const opts = {
      ...defaultCollectionOptions,
      ...options,
      adapter: new FSAdapter({ storagePath: ".data", name }),
    };

    this.collections[name] = {
      collection: new Collection(opts),
      options: opts,
    };

    return this.collections[name].collection;
  }
}

export class QueryHandler {
  cm: CollectionManager;

  constructor(shardedCollections: ShardedCollectionDefinition<unknown>[] = []) {
    this.cm = new CollectionManager(shardedCollections);
  }

  query(payload: QueryPayload) {
    if (!payload) {
      throw new Error("A payload is required.");
    }

    if (!payload.collection) {
      throw new Error("A query should include a collection property.");
    }

    if (!payload.operation) {
      throw new Error("A query should include an operation property (find, insert, update, remove).");
    }

    const collection = this.cm.getOrCreateCollection(payload.collection);

    if (!collection) {
      throw new Error(`The collection ${payload.collection} does not exist.`);
    }

    if (payload.operation !== "drop" && !payload?.data?.query) {
      throw new Error("This payload is missing a query.");
    }

    const query = payload?.data?.query || {};
    const operations = payload?.data?.operations || {};
    const options = payload?.data?.options || {};

    switch (payload.operation) {
      case "drop":
        return collection.drop();
      case "find":
        return collection.find(query, options);
      case "insert":
        return collection.insert(query);
      case "update":
        return collection.update(query, operations, options);
      case "remove":
        return collection.remove(query, options);
      default:
        throw new Error(`Unsupported operation: "${payload.operation}".`);
    }
  }
}

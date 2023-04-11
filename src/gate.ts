import { Collection, CollectionOptions, FSAdapter, QueryOptions } from "@prsm/arc";
import { CommandServer, Connection } from "@prsm/duplex";
import { CreateAccessToken, CreateRefreshToken, ValidateAccessToken } from "./auth";
import { hash } from "./hasher";
import { verify } from "./jwt";

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
  accessToken: string;
};

type AuthPayload = {
  username: string;
  password: string;
};

type RefreshPayload = {
  accessToken: string;
  refreshToken: string;
};

export class Gate {
  static queryHandler: QueryHandler;
  static duplex: CommandServer;
  static auth: Partial<{
    users: Collection<User>;
    accessTokens: Collection<{ username: string, accessToken: string }>;
    refreshTokens: Collection<{ username: string, accessToken: string, refreshToken: string }>;
  }> = {};

  static init() {
    this.queryHandler = new QueryHandler();
    this.initializeCollections();
    this.ensureRootUserExists();
    this.createServer();
  }

  static initializeCollections() {
    this.auth.users = new Collection({
      autosync: true,
      timestamps: true,
      adapter: new FSAdapter(".internal", "users"),
    });

    this.auth.accessTokens = new Collection({
      autosync: true,
      timestamps: true,
      adapter: new FSAdapter(".internal", "accessTokens"),
    });

    this.auth.refreshTokens = new Collection({
      autosync: true,
      timestamps: true,
      adapter: new FSAdapter(".internal", "refreshTokens"),
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

  private static createServer() {
    this.duplex = new CommandServer({
      host: "localhost",
      port: 3351,
      secure: false,
    });

    // authenticate
    this.duplex.command(0, async (payload: AuthPayload, connection: Connection) => {
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
      const refreshToken = CreateRefreshToken(payload.username);

      // store tokens
      this.auth.refreshTokens.remove({ username: payload.username });
      this.auth.refreshTokens.insert({ username: payload.username, accessToken, refreshToken });

      this.auth.accessTokens.remove({ username: payload.username });
      this.auth.accessTokens.insert({ username: payload.username, accessToken });

      return { accessToken, refreshToken };
    });

    // refresh tokens
    this.duplex.command(1, async (payload: RefreshPayload, connection: Connection) => {
      const { accessToken, refreshToken } = payload;

      if (!accessToken || !refreshToken) {
        return { error: "Invalid access token or refresh token" };
      }

      const refresh = this.auth.refreshTokens.find({ refreshToken })[0];

      if (!refresh) {
        return { error: "Invalid refresh token" };
      }

      if (refresh.accessToken !== accessToken) {
        return { error: "Refresh token access token mismatch" };
      }

      const result = verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

      if (!result.sig) {
        return { error: "Invalid refresh token" };
      }

      const newAccessToken = CreateAccessToken(refresh.username);
      const newRefreshToken = CreateRefreshToken(refresh.username);

      // store tokens
      this.auth.refreshTokens.remove({ username: refresh.username });
      this.auth.refreshTokens.insert({ username: refresh.username, accessToken: newAccessToken, refreshToken: newRefreshToken });

      this.auth.accessTokens.remove({ username: refresh.username });
      this.auth.accessTokens.insert({ username: refresh.username, accessToken: newAccessToken });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    });

    // query
    this.duplex.command(2, async (payload: QueryPayload, connection: Connection) => {
      const { collection, operation, data, accessToken } = payload;
      if (!ValidateAccessToken(accessToken).valid) return { error: "Invalid access token" };
      return this.queryHandler.query(payload, connection);
    });

    console.log("Server created");
  }
}

const defaultCollectionOptions = {
  autosync: true,
  timestamps: true,
};

export class CollectionManager {
  collections: { [name: string]: { collection: Collection<unknown>; options: CollectionOptions<unknown> } } = {};

  getCollection(name: string) {
    return this.getOrCreateCollection(name);
  }

  getOrCreateCollection(name: string) {
    if (!this.collections[name]) {
      const opts: CollectionOptions<unknown> = {
        ...defaultCollectionOptions,
        adapter: new FSAdapter(".data", name),
      };

      this.collections[name] = {
        collection: new Collection(opts),
        options: opts,
      };
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
      adapter: new FSAdapter(".data", name),
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

  constructor() {
    this.cm = new CollectionManager();
  }

  query(payload: QueryPayload, connection: Connection) {
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

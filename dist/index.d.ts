import { Collection, QueryOptions, ShardOptions, ShardedCollection, CollectionOptions } from '@prsm/arc';
import { CommandServer } from '@prsm/duplex';
import { EventEmitter } from 'node:events';

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
};
type ArcServerOptions = {
    host: string;
    port: number;
    secure: boolean;
    shardedCollections?: ShardedCollectionDefinition<unknown>[];
};
declare class ArcServer {
    static queryHandler: QueryHandler;
    static duplex: CommandServer;
    static auth: Partial<{
        users: Collection<User>;
        accessTokens: Collection<{
            username: string;
            accessToken: string;
        }>;
    }>;
    static emitter: EventEmitter;
    static init({ host, port, secure, shardedCollections }: ArcServerOptions): Promise<void>;
    static initializeCollections(): void;
    private static ensureRootUserExists;
    static query(payload: QueryPayload): void | unknown[];
    private static createUser;
    private static removeUser;
    private static createServer;
}
type ShardedCollectionDefinition<T> = {
    name: string;
} & ShardOptions<T>;
declare class CollectionManager {
    shardedCollections: ShardedCollectionDefinition<unknown>[];
    collections: {
        [name: string]: {
            collection: Collection<unknown> | ShardedCollection<unknown>;
            options: CollectionOptions<unknown> | ShardedCollectionDefinition<unknown>;
        };
    };
    constructor(shardedCollections?: ShardedCollectionDefinition<unknown>[]);
    getCollection(name: string): Collection<unknown> | ShardedCollection<unknown>;
    getOrCreateCollection(name: string): Collection<unknown> | ShardedCollection<unknown>;
    createCollectionWithOptions(name: string, options?: CollectionOptions<unknown>): Collection<unknown> | ShardedCollection<unknown>;
}
declare class QueryHandler {
    cm: CollectionManager;
    constructor(shardedCollections?: ShardedCollectionDefinition<unknown>[]);
    query(payload: QueryPayload): void | unknown[];
}

export { ArcServer };

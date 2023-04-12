import { Collection, QueryOptions, CollectionOptions } from '@prsm/arc';
import { CommandServer, Connection } from '@prsm/duplex';

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
declare class ArcServer {
    static queryHandler: QueryHandler;
    static duplex: CommandServer;
    static auth: Partial<{
        users: Collection<User>;
        accessTokens: Collection<{
            username: string;
            accessToken: string;
        }>;
        refreshTokens: Collection<{
            username: string;
            accessToken: string;
            refreshToken: string;
        }>;
    }>;
    static init({ host, port, secure }: {
        host: string;
        port: number;
        secure: boolean;
    }): void;
    static initializeCollections(): void;
    private static ensureRootUserExists;
    private static createUser;
    private static removeUser;
    private static createServer;
}
declare class CollectionManager {
    collections: {
        [name: string]: {
            collection: Collection<unknown>;
            options: CollectionOptions<unknown>;
        };
    };
    getCollection(name: string): Collection<unknown>;
    getOrCreateCollection(name: string): Collection<unknown>;
    createCollectionWithOptions(name: string, options?: CollectionOptions<unknown>): Collection<unknown>;
}
declare class QueryHandler {
    cm: CollectionManager;
    constructor();
    query(payload: QueryPayload, connection: Connection): void | unknown[];
}

export { ArcServer };
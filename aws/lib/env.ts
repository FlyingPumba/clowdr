import assert from "assert";

export interface Env {
    DOTENV_CONFIG_PATH: string;
    STACK_PREFIX: string;
    VONAGE_API_KEY: string | null;

    AUTH0_API_DOMAIN: string;
    AUTH0_AUDIENCE: string;
    AUTH0_ISSUER_DOMAIN: string;
    GRAPHQL_API_SECURE_PROTOCOLS: string;
    GRAPHQL_API_DOMAIN: string;
    FAILURE_NOTIFICATIONS_EMAIL_ADDRESS: string | null;
    ACTIONS_PORT: number;
    ACTIONS_LOG_LEVEL: string;
    ACTIONS_REDIS_URL: string;
    ACTIONS_REDIS_KEY: string;
    ACTIONS_CORS_ORIGIN: string;
    ACTIONS_HOST_SECURE_PROTOCOLS: boolean;
    ACTIONS_HOST_DOMAIN: string;
}

const DOTENV_CONFIG_PATH = process.env.DOTENV_CONFIG_PATH;
assert(DOTENV_CONFIG_PATH, "Must specify DOTENV_CONFIG_PATH");

const STACK_PREFIX = process.env.STACK_PREFIX ?? "dev";
const VONAGE_API_KEY = process.env.VONAGE_API_KEY ?? null;

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

const AUTH0_API_DOMAIN = process.env.AUTH0_API_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE ?? "hasura";
const AUTH0_ISSUER_DOMAIN = process.env.AUTH0_ISSUER_DOMAIN ?? `https://${AUTH0_API_DOMAIN}/`;
assert(AUTH0_API_DOMAIN, "Must specify AUTH0_API_DOMAIN");

const GRAPHQL_API_SECURE_PROTOCOLS = process.env.GRAPHQL_API_SECURE_PROTOCOLS ?? "false";
const GRAPHQL_API_DOMAIN = process.env.GRAPHQL_API_DOMAIN ?? "localhost:8080";

const FAILURE_NOTIFICATIONS_EMAIL_ADDRESS = process.env.FAILURE_NOTIFICATIONS_EMAIL_ADDRESS ?? null;

const ACTIONS_PORT = process.env.ACTIONS_PORT !== undefined ? parseInt(process.env.ACTIONS_PORT, 10) : 3001;
const ACTIONS_LOG_LEVEL = process.env.ACTIONS_LOG_LEVEL ?? "trace";
const ACTIONS_REDIS_URL = process.env.ACTIONS_REDIS_URL ?? "redis://localhost:6379";
const ACTIONS_REDIS_KEY = process.env.ACTIONS_REDIS_KEY ?? "socket.io";
const ACTIONS_CORS_ORIGIN = process.env.ACTIONS_CORS_ORIGIN ?? FRONTEND_URL;
const ACTIONS_HOST_SECURE_PROTOCOLS =
    process.env.ACTIONS_HOST_SECURE_PROTOCOLS !== undefined
        ? process.env.ACTIONS_HOST_SECURE_PROTOCOLS === "true"
        : true;
const ACTIONS_HOST_DOMAIN = process.env.ACTIONS_HOST_DOMAIN;
assert(ACTIONS_HOST_DOMAIN, "Must specify ACTIONS_HOST_DOMAIN");

export const env: Env = {
    DOTENV_CONFIG_PATH,
    STACK_PREFIX,
    VONAGE_API_KEY,
    AUTH0_API_DOMAIN,
    AUTH0_AUDIENCE,
    AUTH0_ISSUER_DOMAIN,
    GRAPHQL_API_SECURE_PROTOCOLS,
    GRAPHQL_API_DOMAIN,
    FAILURE_NOTIFICATIONS_EMAIL_ADDRESS,
    ACTIONS_PORT,
    ACTIONS_LOG_LEVEL,
    ACTIONS_REDIS_URL,
    ACTIONS_REDIS_KEY,
    ACTIONS_CORS_ORIGIN,
    ACTIONS_HOST_SECURE_PROTOCOLS,
    ACTIONS_HOST_DOMAIN,
};

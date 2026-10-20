/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attendance from "../attendance.js";
import type * as auth from "../auth.js";
import type * as cars from "../cars.js";
import type * as events from "../events.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as instagram_client from "../instagram/client.js";
import type * as instagram_credentials from "../instagram/credentials.js";
import type * as instagram_graph from "../instagram/graph.js";
import type * as instagram_posts from "../instagram/posts.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_avatar from "../lib/avatar.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_eventView from "../lib/eventView.js";
import type * as lib_newUser from "../lib/newUser.js";
import type * as lib_passwordReset from "../lib/passwordReset.js";
import type * as lib_redirect from "../lib/redirect.js";
import type * as lib_searchRadius from "../lib/searchRadius.js";
import type * as lib_slug from "../lib/slug.js";
import type * as lib_validation from "../lib/validation.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_vehicleCatalog from "../lib/vehicleCatalog.js";
import type * as publisherRequests from "../publisherRequests.js";
import type * as saves from "../saves.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attendance: typeof attendance;
  auth: typeof auth;
  cars: typeof cars;
  events: typeof events;
  files: typeof files;
  http: typeof http;
  "instagram/client": typeof instagram_client;
  "instagram/credentials": typeof instagram_credentials;
  "instagram/graph": typeof instagram_graph;
  "instagram/posts": typeof instagram_posts;
  "lib/auth": typeof lib_auth;
  "lib/avatar": typeof lib_avatar;
  "lib/errors": typeof lib_errors;
  "lib/eventView": typeof lib_eventView;
  "lib/newUser": typeof lib_newUser;
  "lib/passwordReset": typeof lib_passwordReset;
  "lib/redirect": typeof lib_redirect;
  "lib/searchRadius": typeof lib_searchRadius;
  "lib/slug": typeof lib_slug;
  "lib/validation": typeof lib_validation;
  "lib/validators": typeof lib_validators;
  "lib/vehicleCatalog": typeof lib_vehicleCatalog;
  publisherRequests: typeof publisherRequests;
  saves: typeof saves;
  seed: typeof seed;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

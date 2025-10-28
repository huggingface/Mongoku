import type { RequestEvent } from "@sveltejs/kit";
import { AsyncLocalStorage } from "async_hooks";

export const contextStore = new AsyncLocalStorage<RequestEvent>();

import type { APIRoute } from "astro";

import { handleHostedApiRequest } from "@/server/api/hosted-runtime";

export const prerender = false;

export const ALL: APIRoute = ({ request }) =>
	handleHostedApiRequest(request, process.env);

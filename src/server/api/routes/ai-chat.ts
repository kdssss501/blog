import { handleAIChat } from "../../../workers/ai-chat.js";
import type { StorageEnvironment } from "../../storage";

export function handleAIChatRequest(
	request: Request,
	env: StorageEnvironment,
): Promise<Response> {
	return handleAIChat(request, env);
}

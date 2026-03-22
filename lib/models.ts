import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";

export const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const google = createGoogleGenerativeAI({
	apiKey: process.env.GEMINI_API_KEY,
});
export const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

// Switch the default model here
export const DEFAULT_MODEL = openai("gpt-5.2");

// OpenAI
// openai("gpt-4o")
// openai("gpt-4.1")
// openai("o3-mini")
// openai("o4-mini")

// Google
// google("gemini-2.0-flash")
// google("gemini-2.5-pro")
// google("gemini-2.5-flash")

// Groq
// groq("llama-3.3-70b-versatile")
// groq("llama-3.1-8b-instant")
// groq("gemma2-9b-it")

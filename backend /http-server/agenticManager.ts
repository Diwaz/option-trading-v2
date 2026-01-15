import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import * as z from "zod";
import { StateGraph, START, END, Command } from "@langchain/langgraph";
import { MessagesZodMeta } from "@langchain/langgraph";
import { registry } from "@langchain/langgraph/zod";
import { type BaseMessage } from "@langchain/core/messages";
import { isAIMessage, ToolMessage } from "@langchain/core/messages";
import { SystemMessage } from "@langchain/core/messages";
import { HumanMessage } from "@langchain/core/messages";
import { SYSTEM_PROMPT } from "./prompt";


const MessageState = z.object({
  messages: z.array(z.custom<BaseMessage>()).register(registry, MessagesZodMeta),
  llmCalls: z.number().optional()
})

type State = z.infer<typeof MessageState>;


export async function processAgenticMessage(state:State,ws:WebSocket){

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash-lite",
});




const createFormatStrategy = tool(
  async ({ asset, indicator, condition, value, action }) => {
    try {
      const formattedMessage = {
        asset,
        indicator,
        condition,
        value,
        action,
      };
      return JSON.stringify(formattedMessage);
    } catch (err) {
      return `Unable to format strategy error: ${err}`;
    }
  },
  {
    name: "create_format_strategy",
    description: "Formats the strategy parameters into a strict JSON object for the strategy matcher engine.",
    schema: z.object({
      asset: z.string().describe("Trading pair asset, e.g. BTC_USDT, ETH_USDT, SOL_USDT"),
      indicator: z.string().describe("Technical indicator, e.g. RSI, MACD, PRICE"),
      condition: z.string().describe("Condition type, e.g. crosses_below, increases_by"),
      value: z.number().describe("Threshold value"),
      action: z.string().describe("Action to take, e.g. BUY or SELL"),
    }),
  }
)


const toolsByName = {
  [createFormatStrategy.name]:createFormatStrategy,
};

const tools = Object.values(toolsByName);
const llmWithTools = llm.bindTools(tools);



async function llmCall(state: State) {

  // if (state.llmCalls == 0){
    console.log("1st LLM CALLLLLLLL")
    send("running LLM")
  const llmResponse = await llmWithTools.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages
  ])

  // Send the LLM response to the user's websocket
  send(JSON.stringify({
    type:"message",
    message: llmResponse.content,
  }));
  console.log("llm content",llmResponse.content)

  const newCallCount = state.llmCalls + 1
  console.log("state of llmCalls",state.llmCalls)
  return {
    messages: [...state.messages, llmResponse],
    llmCalls: newCallCount,
  }
  send("LLM done")


}

async function toolNode(state: State) {
  const lastMessage = state.messages.at(-1);

  if (lastMessage == null || !isAIMessage(lastMessage)) {
    return {
      messages: [],
    }
  }
  const result: ToolMessage[] = [];
  for (const toolCall of lastMessage.tool_calls ?? []) {
      const tool = toolsByName[toolCall.name];
      if (!tool) continue;
      const observation = await tool.invoke(toolCall);
      console.log("tool msg")
      send("tool msg")
    result.push(
      new ToolMessage({
        tool_call_id: toolCall.id,
        content:observation
      })
    );

  }

  return {
    messages: result
  }

}
async function shouldContinue(state: State) {
  send("wwelcome to should conti")
  const lastMessage = state.messages.at(-1);
  if (lastMessage == null || !isAIMessage(lastMessage)) {
    return END
  }

  if (lastMessage.tool_calls?.length) {
    console.log("inside smth")
    return "toolNode";
  }
  return END;
}

const agent = new StateGraph(MessageState)
  .addNode("llmCall", llmCall)
  .addNode("toolNode", toolNode)
  .addEdge(START, "llmCall")
  .addConditionalEdges("llmCall", shouldContinue, ["toolNode", END])
  .addEdge("toolNode", "llmCall")
  .compile();


    const send = (msg) => {
        if (ws && ws.readyState === ws.OPEN){
            ws.send(JSON.stringify({
                message:msg
            }))
        }
    };
    console.log("agent started")
    send("Agent started")
    await agent.invoke(state)
    send("LLM DONE")
    console.log("LLM Done")



}
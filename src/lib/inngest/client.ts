import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "snapstock",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

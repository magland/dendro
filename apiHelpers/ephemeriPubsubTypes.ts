/* eslint-disable @typescript-eslint/no-explicit-any */
// publish
export type PublishRequest = {
  type: "publishRequest";
  publishToken: string;
  tokenSignature: string;
  messageJson: string;
};

export const isPublishRequest = (x: any): x is PublishRequest => {
  return (
    x &&
    typeof x === "object" &&
    x.type === "publishRequest" &&
    typeof x.publishToken === "string" &&
    typeof x.tokenSignature === "string" &&
    typeof x.messageJson === "string"
  );
};

export type PublishResponse = {
  type: "publishResponse";
};

export const isPublishResponse = (x: any): x is PublishResponse => {
  return x && typeof x === "object" && x.type === "publishResponse";
};

// subscribe
export type SubscribeRequest = {
  type: "subscribeRequest";
  subscribeToken: string;
  tokenSignature: string;
  channels: string[];
};

export const isSubscribeRequest = (x: any): x is SubscribeRequest => {
  return (
    x &&
    typeof x === "object" &&
    x.type === "subscribeRequest" &&
    typeof x.subscribeToken === "string" &&
    typeof x.tokenSignature === "string" &&
    Array.isArray(x.channels) &&
    x.channels.every((c: any) => typeof c === "string")
  );
};

export type SubscribeResponse = {
  type: "subscribeResponse";
};

export const isSubscribeResponse = (x: any): x is SubscribeResponse => {
  return x && typeof x === "object" && x.type === "subscribeResponse";
};

// publish token object
export type PublishTokenObject = {
  timestamp: number;
  channel: string;
  messageSize: number;
  messageSha1: string;
};

export const isPublishTokenObject = (x: any): x is PublishTokenObject => {
  return (
    x &&
    typeof x === "object" &&
    typeof x.timestamp === "number" &&
    typeof x.channel === "string" &&
    typeof x.messageSize === "number" &&
    typeof x.messageSha1 === "string"
  );
};

// subscribe token object
export type SubscribeTokenObject = {
  timestamp: number;
  channels: string[];
};

export const isSubscribeTokenObject = (x: any): x is SubscribeTokenObject => {
  return (
    x &&
    typeof x === "object" &&
    typeof x.timestamp === "number" &&
    Array.isArray(x.channels) &&
    x.channels.every((c: any) => typeof c === "string")
  );
};

// pubsub message
export type PubsubMessage = {
  type: "message";
  channel: string;
  timestamp: number;
  messageJson: string;
};

export const isPubsubMessage = (x: any): x is PubsubMessage => {
  return (
    x &&
    typeof x === "object" &&
    x.type === "message" &&
    typeof x.channel === "string" &&
    typeof x.timestamp === "number" &&
    typeof x.messageJson === "string"
  );
};

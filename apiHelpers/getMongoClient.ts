import { MongoClient } from "mongodb";

let client: MongoClient | undefined = undefined;
let connecting = false;

export const getMongoClient = async (): Promise<MongoClient> => {
  while (connecting) {
    await sleepMsec(100);
  }
  if (client) return client;
  const MONGO_URI = process.env["MONGO_URI"];
  if (!MONGO_URI) throw Error(`Environment variable not set: MONGO_URI`);
  connecting = true;
  // const C = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const C = new MongoClient(MONGO_URI);
  await C.connect();
  client = C;
  connecting = false;
  return client;
};

export const sleepMsec = async (msec: number): Promise<void> => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, msec);
  });
};

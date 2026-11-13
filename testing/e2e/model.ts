// A model service for the flow tests (doc 10: tests never call a real model): an OpenAI-compatible server on this machine. The assistant's
// key is added with this address, so the key window's check and the run's turns go over the network to it through the real provider.
//
//   tsx testing/e2e/model.ts 4177
import { modelService } from "./model-service";

const port = Number(process.argv[2]);
if (!Number.isInteger(port)) throw new Error("model.ts needs a port.");

modelService().listen(port);

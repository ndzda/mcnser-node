import { createSer } from "./server.js";
import { createCont, opt } from "./proxy.js";
createSer(createCont, opt.port);
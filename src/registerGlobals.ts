//@ts-expect-error
import * as csScriptGlobals from "cs_script/point_script"
import { registerCsScriptNativeGlobally } from "@wonfsy/cs-script-extensions";

registerCsScriptNativeGlobally(csScriptGlobals);
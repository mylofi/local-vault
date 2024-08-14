import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";

import LDL from "@lo-fi/webauthn-local-client/bundlers/vite";


// ********************************

export default LV;


// ********************************

function LV() {
	var lvSrcPath;

	var ldlVite = LDL();

	return {
		...ldlVite,

		name: "vite-plugin-lv",

		async configResolved(cfg) {
			var bundlersDir = path.join(cfg.root,"node_modules","@lo-fi","local-vault","dist","bundlers");
			lvSrcPath = path.join(bundlersDir,"lv.mjs");

			return ldlVite.configResolved(cfg);
		},

		load(id,opts) {
			if (id == "@lo-fi/local-vault") {
				return fs.readFileSync(lvSrcPath,{ encoding: "utf8", });
			}
			else if (/^@lo-fi\/local-vault\/adapter\/[^\/]+$/.test(id)) {
				let bundlersDir = path.dirname(lvSrcPath);
				let [ , adapterName, ] = id.match(/^@lo-fi\/local-vault\/adapter\/([^\/]+)$/) || [];
				return fs.readFileSync(path.join(bundlersDir,`adapter.${adapterName}.mjs`),{ encoding: "utf8" });
			}
			return ldlVite.load(id,opts);
		},
	};
}

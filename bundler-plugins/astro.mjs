import path from "node:path";

import vitePlugin from "./vite.mjs";
import ldlAstroPlugin from "@lo-fi/webauthn-local-client/bundlers/astro";


// ********************************

export default LV;


// ********************************

function LV() {
	var ldlAstro = ldlAstroPlugin();
	var vite = vitePlugin();

	LV.vite = () => {
		// copy a subset of the vite plugin hooks that are still
		// necessary, even though astro plugin is mostly taking
		// over the task
		return {
			name: vite.name,
			enforce: vite.enforce,
			resolveId: vite.resolveId,
			load: vite.load,
		};
	};

	return {
		...ldlAstro,
		name: "astro-plugin-lv",
	};
}

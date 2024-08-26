import LSStore from "@lo-fi/client-storage/local-storage";
import baseAdapter from "./base-adapter.js";
import { defineAdapter } from "./lv.js";


// ***********************

try {
	defineAdapter({
		storageType: "local-storage",
		...baseAdapter(LSStore),
		raw: LSStore,
	});
}
catch (err) {}

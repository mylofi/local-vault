import SSStore from "@byojs/storage/session-storage";
import baseAdapter from "./base-adapter.js";
import { defineAdapter } from "./lv.js";


// ***********************

try {
	defineAdapter({
		storageType: "session-storage",
		...baseAdapter(SSStore),
		raw: SSStore,
	});
}
catch (err) {}

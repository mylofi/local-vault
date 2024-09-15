import OPFSStore from "@byojs/storage/opfs";
import baseAdapter from "./base-adapter.js";
import { defineAdapter } from "./lv.js";


// ***********************

try {
	defineAdapter({
		storageType: "opfs",
		...baseAdapter(OPFSStore),
		raw: OPFSStore,
	});
}
catch (err) {}

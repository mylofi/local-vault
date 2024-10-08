import OPFSWorkerStore from "@byojs/storage/opfs-worker";
import baseAdapter from "./base-adapter.js";
import { defineAdapter } from "./lv.js";


// ***********************

try {
	defineAdapter({
		storageType: "opfs-worker",
		...baseAdapter(OPFSWorkerStore),
		raw: OPFSWorkerStore,
	});
}
catch (err) {}

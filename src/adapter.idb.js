import * as IDBStore from "@lo-fi/client-storage/idb";
import baseAdapter from "./base-adapter.js";
import { defineAdapter } from "./lv.js";


// ***********************

try {
	defineAdapter({
		storageType: "idb",
		...baseAdapter(IDBStore),
		raw: IDBStore,
	});
}
catch (err) {}

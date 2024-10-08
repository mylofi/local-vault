import CookieStore from "@byojs/storage/cookie";
import baseAdapter from "./base-adapter.js";
import { defineAdapter } from "./lv.js";


// ***********************

try {
	defineAdapter({
		storageType: "cookie",
		...baseAdapter(CookieStore),
		raw: CookieStore,
	});
}
catch (err) {}

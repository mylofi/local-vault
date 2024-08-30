// note: these module specifiers come from the import-map
//    in index.html; swap "src" for "dist" here to test
//    against the dist/* files
import "local-vault/src/adapter/idb";
import "local-vault/src/adapter/local-storage";
import "local-vault/src/adapter/session-storage";
import "local-vault/src/adapter/cookie";
import "local-vault/src/adapter/opfs";
import "local-vault/src/adapter/opfs-worker";
import {
	supportsWebAuthn,
	rawStorage,
	connect,
	removeAll,
	listLocalIdentities,
	removeLocalAccount,
} from "local-vault/src";
import { clearLockKeyCache, } from "@lo-fi/local-data-lock";

// simple helper util for showing a spinner
// (during slower passkey operations)
import { startSpinner, stopSpinner, } from "./spinner.js";


// ***********************

const storageTypes = {
	"idb": "IndexedDB",
	"local-storage": "Local Storage",
	"session-storage": "Session Storage",
	"cookie": "Cookies",
	"opfs": "Origin Private FS (Chrome/Firefox)",
	"opfs-worker": "OPFS-Worker",
};

var setupVaultBtn;
var detectVaultBtn;
var removeAllVaultsBtn;
var openVaultBtn;
var lockVaultBtn;
var addPasskeyBtn;
var resetVaultBtn;
var rawStorageTestsResultsEl;

var currentVault;

if (document.readyState == "loading") {
	document.addEventListener("DOMContentLoaded",ready,false);
}
else {
	ready();
}


// ***********************

async function ready() {
	setupVaultBtn = document.getElementById("setup-vault-btn");
	detectVaultBtn = document.getElementById("detect-vault-btn");
	removeAllVaultsBtn = document.getElementById("remove-all-vaults-btn");
	openVaultBtn = document.getElementById("open-vault-btn");
	lockVaultBtn = document.getElementById("lock-vault-btn");
	addPasskeyBtn = document.getElementById("add-passkey-btn");
	resetVaultBtn = document.getElementById("reset-vault-btn");
	rawStorageTestsResultsEl = document.getElementById("raw-storage-tests-result");

	setupVaultBtn.addEventListener("click",setupVault,false);
	detectVaultBtn.addEventListener("click",detectVault,false);
	removeAllVaultsBtn.addEventListener("click",removeAllVaults,false);
	openVaultBtn.addEventListener("click",openVault,false);
	lockVaultBtn.addEventListener("click",lockVault,false);
	addPasskeyBtn.addEventListener("click",addPasskeyToVault,false);
	resetVaultBtn.addEventListener("click",resetVault,false);

	updateElements();

	await runRawStorageTests();
}

function updateElements() {
	if (currentVault != null) {
		lockVaultBtn.disabled = false;
		addPasskeyBtn.disabled = false;
		resetVaultBtn.disabled = false;
	}
	else {
		lockVaultBtn.disabled = true;
		addPasskeyBtn.disabled = true;
		resetVaultBtn.disabled = true;
	}
}

async function promptVaultOptions(
	askForVaultID = false,
	newVaultRegistration = false
) {
	if (!checkWebAuthnSupport()) return;

	var storageTypeEl;
	var vaultIDEl;
	var registerIDEl;
	var generateIDBtn;
	var copyBtn;

	var result = await Swal.fire({
		title: (
			newVaultRegistration ?
				"New Vault Settings" :
				"Vault Info"
		),
		html: `
			<p>
				<select id="storage-type" class="swal2-select">
					<option>-- choose storage type --</option>
					${
						Object.entries(storageTypes).map(([ type, label, ]) => (
							`<option value="${type}">${label}</option>`
						)).join("")
					}
				</select>
			</p>
			${
				askForVaultID ? `
					<p>
						<label>
							Vault ID:
							<input type="text" id="vault-id" class="swal2-input">
						</label>
						${
							newVaultRegistration ? `
								<br>
								<button type="button" id="generate-id-btn" class="swal2-styled swal2-default-outline modal-btn">Generate Random</button>
								<button type="button" id="copy-vault-id-btn" class="swal2-styled swal2-default-outline modal-btn">Copy</button>
							` :
							""
						}
					</p>` :
					""
			}
		`,
		showConfirmButton: true,
		confirmButtonText: "Next",
		confirmButtonColor: "darkslateblue",
		showCancelButton: true,
		cancelButtonColor: "darkslategray",

		allowOutsideClick: true,
		allowEscapeKey: true,

		didOpen(popupEl) {
			storageTypeEl = document.getElementById("storage-type");

			if (askForVaultID) {
				vaultIDEl = document.getElementById("vault-id");
				if (newVaultRegistration) {
					generateIDBtn = document.getElementById("generate-id-btn");
					copyBtn = document.getElementById("copy-vault-id-btn");

					generateIDBtn.addEventListener("click",onGenerateID,false);
					copyBtn.addEventListener("click",onCopyID,false);
				}
			}

			popupEl.addEventListener("keypress",onKeypress,true);

			storageTypeEl.focus();
		},

		willClose(popupEl) {
			popupEl.removeEventListener("keypress",onKeypress,true);
			if (newVaultRegistration) {
				generateIDBtn.removeEventListener("click",onGenerateID,false);
				copyBtn.removeEventListener("click",onCopyID,false);
			}
			storageTypeEl = vaultIDEl = generateIDBtn = copyBtn = null;
		},

		preConfirm() {
			var storageType = storageTypeEl.value;
			var vaultID = (askForVaultID ? (vaultIDEl.value || null) : null);
			if (vaultID != null) {
				vaultID = vaultID.trim().replace(/[^a-zA-Z0-9]+/g,"");
				vaultIDEl.value = vaultID;
			}

			if (![ "local-storage", "session-storage", "idb", "cookie", "opfs", "opfs-worker", ].includes(storageType)) {
				Swal.showValidationMessage("Select a vault storage type.");
				return false;
			}
			if (askForVaultID && (vaultID == null || vaultID == "" || vaultID.length < 3)) {
				Swal.showValidationMessage(`Enter ${newVaultRegistration ? "(or generate) a new" : "an existing"} vault ID (3+ chars).`);
				return false;
			}

			return { storageType, vaultID, };
		},
	});

	if (result.isConfirmed) {
		return result.value;
	}


	// ***********************

	function onKeypress(evt) {
		if (
			evt.key == "Enter" &&
			evt.target.matches(".swal2-input, .swal2-select, .swal2-textarea")
		) {
			cancelEvent(evt);
			Swal.clickConfirm();
		}
	}

	async function onGenerateID() {
		vaultIDEl.value = sodium.to_base64(
			sodium.randombytes_buf(10),
			sodium.base64_variants.ORIGINAL
		).replace(/[^a-zA-Z0-9]+/g,"");
	}

	async function onCopyID() {
		if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
			await navigator.clipboard.writeText(vaultIDEl.value);
		}
		else {
			vaultIDEl.select();
			document.execCommand("copy");
		}
		Swal.showValidationMessage("copied");
		setTimeout(() => Swal.resetValidationMessage(),500);
	}
}

async function promptAddPasskey() {
	if (!checkWebAuthnSupport()) return;

	var passkeyUsernameEl;
	var passkeyDisplayNameEl;

	var result = await Swal.fire({
		title: "Add Passkey",
		html: `
			<p>
				<label>
					Username:
					<input type="text" id="passkey-username" class="swal2-input">
				</label>
			</p>
			<p>
				<label>
					Display Name:
					<input type="text" id="passkey-display-name" class="swal2-input">
				</label>
			</p>
		`,
		showConfirmButton: true,
		confirmButtonText: "Add",
		confirmButtonColor: "darkslateblue",
		showCancelButton: true,
		cancelButtonColor: "darkslategray",

		allowOutsideClick: true,
		allowEscapeKey: true,

		didOpen(popupEl) {
			passkeyUsernameEl = document.getElementById("passkey-username");
			passkeyDisplayNameEl = document.getElementById("passkey-display-name");
			passkeyUsernameEl.focus();
			popupEl.addEventListener("keypress",onKeypress,true);
		},

		willClose(popupEl) {
			popupEl.removeEventListener("keypress",onKeypress,true);
			passkeyUsernameEl = passkeyDisplayNameEl = null;
		},

		preConfirm() {
			var passkeyUsername = passkeyUsernameEl.value.trim();
			var passkeyDisplayName = passkeyDisplayNameEl.value.trim();

			if (!passkeyUsername) {
				Swal.showValidationMessage("Please enter a username.");
				return false;
			}
			if (!passkeyDisplayName) {
				Swal.showValidationMessage("Please enter a display name.");
				return false;
			}

			return { passkeyUsername, passkeyDisplayName, };
		},
	});

	if (result.isConfirmed) {
		return result.value;
	}


	// ***********************

	function onKeypress(evt) {
		if (
			evt.key == "Enter" &&
			evt.target.matches(".swal2-input, .swal2-select, .swal2-textarea")
		) {
			cancelEvent(evt);
			Swal.clickConfirm();
		}
	}
}

async function promptSetupTimeout() {
	var confirmTimeout = await Swal.fire({
		text: "Do you want to test cancellation, by limiting your next passkey authentication with a 5 sec timeout?",
		icon: "question",
		showConfirmButton: true,
		confirmButtonText: "Yes, timeout!",
		confirmButtonColor: "darkslateblue",
		showCancelButton: true,
		cancelButtonColor: "darkslategray",
		cancelButtonText: "Skip timeout",
		focusCancel: true,
		allowOutsideClick: true,
		allowEscapeKey: true,
	});
	return confirmTimeout.isConfirmed;
}

async function setupVault() {
	var { storageType, vaultID, } = (
		(await promptVaultOptions(
			/*askForVaultID=*/true,
			/*newVaultRegistration=*/true
		)) || {}
	);
	if (storageType == null || vaultID == null) return;

	var {
		passkeyUsername: username,
		passkeyDisplayName: displayName,
	} = (await promptAddPasskey()) || {};
	if (username == null || displayName == null) return;

	var setupTimeout = await promptSetupTimeout();
	var { signal, intv } = setupTimeout ? createTimeoutToken() : {};

	try {
		startSpinner();
		currentVault = await connect({
			addNewVault: true,
			storageType,
			vaultID,
			keyOptions: {
				relyingPartyName: "Local Vault Tests",
				username,
				displayName,
			},
			signal,
		});
		if (intv != null) { clearTimeout(intv); }
		updateElements();
		stopSpinner();
		return showVaultContents();
	}
	catch (err) {
		if (intv != null) { clearTimeout(intv); }
		logError(err);
		stopSpinner();
		showError("Setting up vault failed.");
	}
}

async function detectVault() {
	var { storageType, } = (await promptVaultOptions()) || {};
	if (storageType == null) return;

	var setupTimeout = await promptSetupTimeout();
	var { signal, intv } = setupTimeout ? createTimeoutToken() : {};

	try {
		startSpinner();
		currentVault = await connect({
			storageType,
			discoverVault: true,
			keyOptions: {
				relyingPartyName: "Local Vault Tests",
			},
			signal,
		});
		if (intv != null) { clearTimeout(intv); }
		updateElements();
		stopSpinner();
		return showVaultContents();
	}
	catch (err) {
		if (intv != null) { clearTimeout(intv); }
		logError(err);
		stopSpinner();
		showError("Detecting vault with passkey authentication failed.");
	}
}

async function removeAllVaults() {
	var confirmResult = await Swal.fire({
		text: "Removing all local vaults and passkey accounts. Are you sure?",
		icon: "warning",
		showConfirmButton: true,
		confirmButtonText: "Yes, reset!",
		confirmButtonColor: "darkslateblue",
		showCancelButton: true,
		cancelButtonColor: "darkslategray",
		cancelButtonText: "No",
		allowOutsideClick: true,
		allowEscapeKey: true,
	});

	if (confirmResult.isConfirmed) {
		removeAll();
		clearLockKeyCache();
		for (let localIdentity of (await listLocalIdentities())) {
			await removeLocalAccount(localIdentity);
		}
		currentVault = null;
		updateElements();
		showToast("All local vaults and passkey accounts removed.");
	}
}

async function openVault() {
	if (!checkWebAuthnSupport()) return;

	var { storageType, vaultID, } = (
		currentVault != null ?
			{
				storageType: currentVault.storageType,
				vaultID: currentVault.id,
			} :

			(await promptVaultOptions(
				/*askForVaultID=*/true,
				/*newVaultRegistration=*/false
			)) || {}
	);
	if (storageType == null || vaultID == null) return;

	var setupTimeout = ( currentVault == null ? await promptSetupTimeout() : false);
	var { signal, intv } = setupTimeout ? createTimeoutToken() : {};

	try {
		startSpinner();
		currentVault = await connect({
			storageType,
			vaultID,
			keyOptions: {
				relyingPartyName: "Local Vault Tests",
			},
			signal,
		});
		if (intv != null) { clearTimeout(intv); }
		updateElements();
		stopSpinner();
		return showVaultContents();
	}
	catch (err) {
		if (intv != null) { clearTimeout(intv); }
		logError(err);
		stopSpinner();
		showError("Opening vault via passkey failed.");
	}
}

async function lockVault() {
	if (!checkWebAuthnSupport()) return;

	if (currentVault) {
		try {
			currentVault.lock();
			showToast("Vault locked.");
		}
		catch (err) {
			logError(err);
			showError("Locking vault failed.");
		}
		currentVault = null;
		updateElements();
	}
}

async function addPasskeyToVault() {
	if (!checkWebAuthnSupport()) return;

	if (currentVault) {
		let {
			passkeyUsername: username,
			passkeyDisplayName: displayName,
		} = (await promptAddPasskey()) || {};
		if (username == null || displayName == null) return;

		let setupTimeout = await promptSetupTimeout();
		let { signal, intv } = setupTimeout ? createTimeoutToken() : {};

		try {
			startSpinner();
			let added = await currentVault.addPasskey({ username, displayName, signal, });
			if (intv != null) { clearTimeout(intv); }
			stopSpinner();
			if (added) {
				showToast("New passkey added to vault.");
			}
		}
		catch (err) {
			if (intv != null) { clearTimeout(intv); }
			logError(err);
			stopSpinner();
			showError("Adding passkey to vault failed.");
		}
	}
}

async function resetVault() {
	if (!checkWebAuthnSupport()) return;

	if (currentVault != null) {
		let confirmResult = await Swal.fire({
			text: "Resetting a vault's lock-key regenerates a new encryption/decryption key and a new passkey, while discarding previously associated passkeys. Are you sure?",
			icon: "warning",
			showConfirmButton: true,
			confirmButtonText: "Yes, reset!",
			confirmButtonColor: "darkslateblue",
			showCancelButton: true,
			cancelButtonColor: "darkslategray",
			cancelButtonText: "No",
			allowOutsideClick: true,
			allowEscapeKey: true,
		});

		if (confirmResult.isConfirmed) {
			let {
				passkeyUsername: username,
				passkeyDisplayName: displayName,
			} = (await promptAddPasskey()) || {};
			if (username == null || displayName == null) return;

			try {
				startSpinner();
				await currentVault.resetLockKey({
					username,
					displayName,
				});
				stopSpinner();

				showToast("Vault lock-key reset (and previous passkeys discarded).");
			}
			catch (err) {
				logError(err);
				stopSpinner();
				showError("Resetting vault lock-key failed.");
			}
		}
	}
}

async function showVaultContents() {
	var addPropNameEl;
	var addPropValueEl;
	var addPropBtn;
	var entriesTableEl;

	await Swal.fire({
		title: `Vault '${currentVault.id}'`,
		html: `
			<p>
				(${storageTypes[currentVault.storageType]})
			</p>
			<p>
				<label>
					Key:
					<input type="text" id="add-prop-name" class="swal2-input">
				</label>
			</p>
			<p>
				<label>
					Value:
					<input type="text" id="add-prop-value" class="swal2-input">
				</label>
			</p>
			<p>
				<button id="add-prop-btn" class="swal2-styled swal2-default-outline modal-btn edit-btn">
					add to vault
				</button>
			</p>
			<br>
			<table id="entries-table" style="border:1px solid #000;border-collapse:collapse;overflow:auto;max-width:75vw;max-height:30vh;"></table>
		`,
		showConfirmButton: false,
		showCancelButton: true,
		cancelButtonText: "Close",
		cancelButtonColor: "darkslategray",

		allowOutsideClick: true,
		allowEscapeKey: true,

		async didOpen(popupEl) {
			addPropNameEl = document.getElementById("add-prop-name");
			addPropValueEl = document.getElementById("add-prop-value");
			addPropBtn = document.getElementById("add-prop-btn");
			entriesTableEl = document.getElementById("entries-table");

			popupEl.addEventListener("keypress",onKeypress,true);
			addPropBtn.addEventListener("click",addProp,false);
			entriesTableEl.addEventListener("click",propertyActionBtn,true);

			await renderEntries();
			addPropNameEl.focus();
		},

		willClose(popupEl) {
			popupEl.removeEventListener("keypress",onKeypress,true);
			addPropBtn.removeEventListener("click",addProp,false);
			entriesTableEl.removeEventListener("click",propertyActionBtn,true);
		},
	});


	// ***********************

	async function onKeypress(evt) {
		if (
			evt.key == "Enter" &&
			evt.target.matches(".swal2-input, .swal2-select, .swal2-textarea")
		) {
			cancelEvent(evt);
			return addProp();
		}
	}

	async function renderEntries() {
		Swal.resetValidationMessage();

		entriesTableEl.innerHTML = "";
		var entries = await currentVault.entries();
		if (entries.length > 0) {
			for (let [ propName, propVal, ] of entries) {
				let rowEl = document.createElement("tr");
				rowEl.setAttribute("data-prop-name",propName);
				rowEl.setAttribute("data-prop-value",propVal);
				rowEl.innerHTML = `
					<td style="text-align:right;padding:1rem;border:1px solid #000;"><strong></strong></td>
					<td style="text-align:left;padding:1rem;border:1px solid #000;"></td>
					<td style="padding:1rem;border:1px solid #000;">
						<button type="button" class="swal2-styled swal2-default-outline modal-btn edit-btn">edit</button>
						<button type="button" class="swal2-styled swal2-default-outline modal-btn del-btn">del</button>
					</td>
				`;
				// note: avoid XSS!
				rowEl.querySelector("td:nth-child(1) strong").innerText = propName;
				rowEl.querySelector("td:nth-child(2)").innerText = propVal;
				entriesTableEl.appendChild(rowEl);
			}

			entriesTableEl.style.display = "inline-block";
		}
		else {
			entriesTableEl.style.display = "none";
		}
	}

	async function addProp() {
		var addPropName = addPropNameEl.value.trim().replace(/\s+/g,"-").replace(/[^a-zA-Z0-9\-.]+/g,"_").slice(0,20);
		addPropNameEl.value = addPropName;

		var addPropValue = addPropValueEl.value.trim();
		addPropValue = addPropValue;

		if (addPropName == "") {
			Swal.showValidationMessage("Set a property name.");
			return;
		}
		if (await currentVault.has(addPropName)) {
			Swal.showValidationMessage("Property already exists.");
			return;
		}
		if (addPropValue == "") {
			Swal.showValidationMessage("Set a property value.");
			return;
		}

		addPropNameEl.value = addPropValueEl.value = "";
		addPropNameEl.focus();

		try {
			let success = await currentVault.set(addPropName,addPropValue);
			if (!success) {
				throw new Error("set() failed");
			}
		}
		catch (err) {
			logError(err);
			Swal.close();
			showError("Failed adding property to vault.");
			return;
		}
		return renderEntries();
	}

	async function propertyActionBtn(evt) {
		var targetEl = evt.target;
		var parentRowEl = targetEl.closest("tr[data-prop-name]");
		if (targetEl.matches("button.edit-btn")) {
			cancelEvent(evt);
			return promptEditProp(
				parentRowEl.dataset.propName,
				parentRowEl.dataset.propValue
			);
		}
		else if (targetEl.matches("button.del-btn")) {
			cancelEvent(evt);
			try {
				let success = await currentVault.remove(parentRowEl.dataset.propName);
				if (!success) {
					throw new Error("remove() failed");
				}
			}
			catch (err) {
				logError(err);
				Swal.close();
				showError("Failed removing property from vault.");
				return;
			}
			return renderEntries();
		}
	}
}

async function promptEditProp(propName,propValue) {
	var result = await Swal.fire({
		title: `Update Property: ${propName}`,
		input: "text",
		inputLabel: "Value",
		inputValue: propValue,
		showConfirmButton: true,
		confirmButtonText: "Update",
		confirmButtonColor: "darkslateblue",
		showCancelButton: true,
		cancelButtonColor: "darkslategray",
		allowOutsideClick: true,
		allowEscapeKey: true,
	});

	if (result.isConfirmed) {
		try {
			await currentVault.set(propName,result.value);
		}
		catch (err) {
			logError(err);
			Swal.close();
			showError("Failed editing property in vault.");
			return;
		}
	}
	return showVaultContents();
}

function logError(err,returnLog = false) {
	var err = `${
			err.stack ? err.stack : err.toString()
		}${
			err.cause ? `\n${logError(err.cause,/*returnLog=*/true)}` : ""
	}`;
	if (returnLog) return err;
	else console.error(err);
}

function showError(errMsg) {
	return Swal.fire({
		title: "Error!",
		text: errMsg,
		icon: "error",
		confirmButtonText: "OK",
	});
}

function showToast(toastMsg) {
	return Swal.fire({
		text: toastMsg,
		showConfirmButton: false,
		showCloseButton: true,
		timer: 5000,
		toast: true,
		position: "top-end",
		customClass: {
			popup: "toast-popup",
		},
	});
}

function cancelEvent(evt) {
	if (evt) {
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();
	}
}

function createTimeoutToken() {
	var ac = new AbortController();
	var intv = setTimeout(() => ac.abort("Timeout!"),5000);
	return { signal: ac.signal, intv, };
}

async function runRawStorageTests() {
	var expectedResults = [
		[ "idb", "has(1)", false ],
		[ "idb", "get(1)", null ],
		[ "idb", "set(1)", true ],
		[ "idb", "has(2)", true ],
		[ "idb", "get(2)", "world" ],
		[ "idb", "set(2)", true ],
		[ "idb", "keys(1)", [ "hello", "meaning", ], ],
		[ "idb", "entries", [ [ "hello", "world", ], [ "meaning", { ofLife: 42, }, ], ], ],
		[ "idb", "remove", true ],
		[ "idb", "keys(2)", [ "meaning", ], ],
		[ "local-storage", "has(1)", false ],
		[ "local-storage", "get(1)", null ],
		[ "local-storage", "set(1)", true ],
		[ "local-storage", "has(2)", true ],
		[ "local-storage", "get(2)", "world" ],
		[ "local-storage", "set(2)", true ],
		[ "local-storage", "keys(1)", [ "hello", "meaning", ], ],
		[ "local-storage", "entries", [ [ "hello", "world", ], [ "meaning", { ofLife: 42, }, ], ], ],
		[ "local-storage", "remove", true ],
		[ "local-storage", "keys(2)", [ "meaning", ], ],
		[ "session-storage", "has(1)", false ],
		[ "session-storage", "get(1)", null ],
		[ "session-storage", "set(1)", true ],
		[ "session-storage", "has(2)", true ],
		[ "session-storage", "get(2)", "world" ],
		[ "session-storage", "set(2)", true ],
		[ "session-storage", "keys(1)", [ "hello", "meaning", ], ],
		[ "session-storage", "entries", [ [ "hello", "world", ], [ "meaning", { ofLife: 42, }, ], ], ],
		[ "session-storage", "remove", true ],
		[ "session-storage", "keys(2)", [ "meaning", ], ],
		[ "cookie", "has(1)", false ],
		[ "cookie", "get(1)", null ],
		[ "cookie", "set(1)", true ],
		[ "cookie", "has(2)", true ],
		[ "cookie", "get(2)", "world" ],
		[ "cookie", "set(2)", true ],
		[ "cookie", "keys(1)", [ "hello", "meaning", ], ],
		[ "cookie", "entries", [ [ "hello", "world", ], [ "meaning", { ofLife: 42, }, ], ], ],
		[ "cookie", "remove", true ],
		[ "cookie", "keys(2)", [ "meaning", ], ],
		[ "opfs", "has(1)", false ],
		[ "opfs", "get(1)", null ],
		[ "opfs", "set(1)", true ],
		[ "opfs", "has(2)", true ],
		[ "opfs", "get(2)", "world" ],
		[ "opfs", "set(2)", true ],
		[ "opfs", "keys(1)", [ "hello", "meaning", ], ],
		[ "opfs", "entries", [ [ "hello", "world", ], [ "meaning", { ofLife: 42, }, ], ], ],
		[ "opfs", "remove", true ],
		[ "opfs", "keys(2)", [ "meaning", ], ],
		[ "opfs-worker", "has(1)", false ],
		[ "opfs-worker", "get(1)", null ],
		[ "opfs-worker", "set(1)", true ],
		[ "opfs-worker", "has(2)", true ],
		[ "opfs-worker", "get(2)", "world" ],
		[ "opfs-worker", "set(2)", true ],
		[ "opfs-worker", "keys(1)", [ "hello", "meaning", ], ],
		[ "opfs-worker", "entries", [ [ "hello", "world", ], [ "meaning", { ofLife: 42, }, ], ], ],
		[ "opfs-worker", "remove", true ],
		[ "opfs-worker", "keys(2)", [ "meaning", ], ],
	];
	var testResults = [];

	console.log("rawStorage tests running...");

	var IDBStore = rawStorage("idb");
	var LSStore = rawStorage("local-storage");
	var SSStore = rawStorage("session-storage");
	var CookieStore = rawStorage("cookie");
	var OPFSStore = rawStorage("opfs");
	var OPFSWorkerStore = rawStorage("opfs-worker");

	var stores = [ IDBStore, LSStore, SSStore, CookieStore, OPFSStore, OPFSWorkerStore, ];
	for (let store of stores) {
		testResults.push([ store.storageType, "has(1)", await store.has("hello"), ]);
		testResults.push([ store.storageType, "get(1)", await store.get("hello"), ]);
		testResults.push([ store.storageType, "set(1)", await store.set("hello","world"), ]);
		testResults.push([ store.storageType, "has(2)", await store.has("hello"), ]);
		testResults.push([ store.storageType, "get(2)", await store.get("hello"), ]);
		testResults.push([ store.storageType, "set(2)", await store.set("meaning",{ ofLife: 42, }), ]);
		testResults.push([ store.storageType, "keys(1)", sortKeys(filterLocalMetadata(await store.keys())), ]);
		testResults.push([ store.storageType, "entries", sortKeys(filterLocalMetadata(await store.entries())), ]);
		testResults.push([ store.storageType, "remove", await store.remove("hello"), ]);
		testResults.push([ store.storageType, "keys(2)", sortKeys(filterLocalMetadata(await store.keys())), ]);
		await store.remove("meaning");
	}
	var testsPassed = true;
	for (let [ testIdx, testResult ] of testResults.entries()) {
		if (JSON.stringify(testResult[2]) != JSON.stringify(expectedResults[testIdx][2])) {
			testsPassed = false;
			console.log(`(${testIdx}) ${testResult[0]}:${testResult[1]} failed`);
			console.log(`  Expected: ${expectedResults[testIdx][2]}, but found: ${testResult[2]}`);
		}
	}
	if (testsPassed) {
		rawStorageTestsResultsEl.innerText = "PASS";
		console.log("all passed.");
	}
	else {
		rawStorageTestsResultsEl.innerText = "FAIL (see console)";
	}
}

function filterLocalMetadata(vals) {
	if (vals.length > 0) {
		// entries?
		if (Array.isArray(vals[0])) {
			return vals.filter(([ name, value ]) => (
				!/^local-((vault-.+)|(identities))/.test(name)
			));
		}
		else {
			return vals.filter(name => (
				!/^local-((vault-.+)|(identities))/.test(name)
			));
		}
	}
	return vals;
}

function sortKeys(vals) {
	if (vals.length > 0) {
		vals = [ ...vals ];
		// entries?
		if (Array.isArray(vals[0])) {
			return vals.sort(([ name1, ],[ name2, ]) => (
				name1.localeCompare(name2)
			));
		}
		else {
			return vals.sort((name1,name2) => (
				name1.localeCompare(name2)
			));
		}
	}
	return vals;
}

async function checkWebAuthnSupport() {
	if (!supportsWebAuthn) {
		showError("Sorry, but this device doesn't seem to support the proper passkey functionality.");
		return false;
	}
}

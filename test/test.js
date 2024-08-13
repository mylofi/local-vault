// note: these module specifiers come from the import-map
//    in index.html; swap "src" for "dist" here to test
//    against the dist/* files
import "local-vault/src/adapter-local-storage";
import "local-vault/src/adapter-session-storage";
import "local-vault/src/adapter-idb";
import "local-vault/src/adapter-opfs";
import "local-vault/src/adapter-cookie";
import {
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
};

var setupVaultBtn;
var detectVaultBtn;
var removeAllVaultsBtn;
var openVaultBtn;
var lockVaultBtn;
var addPasskeyBtn;
var resetVaultBtn;

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

	setupVaultBtn.addEventListener("click",setupVault,false);
	detectVaultBtn.addEventListener("click",detectVault,false);
	removeAllVaultsBtn.addEventListener("click",removeAllVaults,false);
	openVaultBtn.addEventListener("click",openVault,false);
	lockVaultBtn.addEventListener("click",lockVault,false);
	addPasskeyBtn.addEventListener("click",addPasskeyToVault,false);
	resetVaultBtn.addEventListener("click",resetVault,false);

	updateElements();
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
	var storageTypeEl;
	var vaultIDEl;
	var registerIDEl;
	var generateIDBtn;
	var copyBtn;

	var result = await Swal.fire({
		title: "Vault Options",
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

		async preConfirm() {
			var storageType = storageTypeEl.value;
			var vaultID = (askForVaultID ? (vaultIDEl.value || null) : null);
			if (vaultID != null) {
				vaultID = vaultID.trim().replace(/[^a-zA-Z0-9]+/g,"");
				vaultIDEl.value = vaultID;
			}

			if (![ "local-storage", "session-storage", "idb", "cookie", "opfs", ].includes(storageType)) {
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

		async preConfirm() {
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
		});
		updateElements();
		stopSpinner();
		return showVaultContents();
	}
	catch (err) {
		logError(err);
		stopSpinner();
		showError("Setting up vault failed.");
	}
}

async function detectVault() {
	var { storageType, } = (await promptVaultOptions()) || {};
	if (storageType == null) return;

	try {
		startSpinner();
		currentVault = await connect({
			storageType,
			discoverVault: true,
			keyOptions: {
				relyingPartyName: "Local Vault Tests",
			},
		});
		updateElements();
		stopSpinner();
		return showVaultContents();
	}
	catch (err) {
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
		for (let localIdentity of listLocalIdentities()) {
			removeLocalAccount(localIdentity);
		}
		currentVault = null;
		updateElements();
		showToast("All local vaults and passkey accounts removed.");
	}
}

async function openVault() {
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

	try {
		startSpinner();
		currentVault = await connect({
			storageType,
			vaultID,
			keyOptions: {
				relyingPartyName: "Local Vault Tests",
			},
		});
		updateElements();
		stopSpinner();
		return showVaultContents();
	}
	catch (err) {
		logError(err);
		stopSpinner();
		showError("Opening vault via passkey failed.");
	}
}

async function lockVault() {
	if (currentVault) {
		try {
			currentVault.lock();
			showToast("Vault locked.");
		}
		catch (err) {
			console.log(err);
		}
		currentVault = null;
		updateElements();
	}
}

async function addPasskeyToVault() {
	if (currentVault) {
		let {
			passkeyUsername: username,
			passkeyDisplayName: displayName,
		} = (await promptAddPasskey()) || {};
		if (username == null || displayName == null) return;

		try {
			startSpinner();
			await currentVault.addPasskey({ username, displayName, });
			stopSpinner();
		}
		catch (err) {
			logError(err);
			stopSpinner();
			showError("Adding passkey to vault failed.");
		}
	}
}

async function resetVault() {
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

		await currentVault.set(addPropName,addPropValue);
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
			await currentVault.remove(parentRowEl.dataset.propName);
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
		await currentVault.set(propName,result.value);
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

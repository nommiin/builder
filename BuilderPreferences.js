class BuilderPreferences {
	static path = Electron_App.getPath("userData") + "/GMEdit/config/Builder-preferences.json";
	
	static current = {
		reuseTab: false,
		saveCompile: false,
		stopCompile: false,
		displayLine: true,
		forkArguments: "",
		runtimeSettings: {
			Stable: {
				location: process.env.ProgramData + "/GameMakerStudio2/Cache/runtimes/",
				runtimeList: [],
				selection: ""
			},
			Beta: {
				location: process.env.ProgramData + "/GameMakerStudio2-Beta/Cache/runtimes/",
				runtimeList: [],
				selection: ""
			}
		}
	};
	
	static save() {
		Electron_FS.writeFileSync(this.path, JSON.stringify(this.current, (k, v) => {
			return k == "runtimeList" ? undefined : v;
		}, "    "));
	}
	
	static load() {
		this.current = JSON.parse(Electron_FS.readFileSync(this.path))
	}
	
	static init() {
		if (Electron_FS.existsSync(this.path)) {
			try {
				this.load();
				let pref = this.current;
				if (pref.runtimeLocation != null) {
					// migrate legacy settings
					this.Preferences.runtimeSettings.Stable.location = this.Preferences.runtimeLocation;
                    delete this.Preferences.runtimeLocation;
                    this.Preferences.runtimeSettings.Stable.selection = this.Preferences.runtimeSelection;
                    delete this.Preferences.runtimeSelection;
                    delete this.Preferences.runtimeList;
				}
			} catch (x) {
				console.error("[Builder] Failed to load preferences:", x);
			}
		} else this.save();
	}
	
	static element;
	
	static build() {
		const Preferences = $gmedit["ui.Preferences"];
		let root = document.createElement("div");
		this.element = root;
		
		for (let [key, set] of Object.entries(this.current.runtimeSettings)) {
			let runtimeGroup = Preferences.addGroup(root, `Runtime Settings (${key})`);
			let element, label;
			
			element = Preferences.addInput(runtimeGroup, "Runtime Location", set.location, (value) => {
				set.location = value;
				BuilderPreferences.save();
			});
			let runtimeLocationInput = element.querySelector("input");
			label = element.querySelector("label");
			label.appendChild(document.createTextNode(" ("));
			label.appendChild(Preferences.createFuncAnchor("Reset", function() {
				switch (key) {
					case "Stable": set.location = process.env.ProgramData + "/GameMakerStudio2/Cache/runtimes/"; break;
					case "Beta": set.location = process.env.ProgramData + "/GameMakerStudio2-Beta/Cache/runtimes/"; break;
					default: return;
				}
				runtimeLocationInput.value = set.location;
				BuilderPreferences.save();
			}));
			label.appendChild(document.createTextNode(")"));
			
			element = Preferences.addDropdown(runtimeGroup, "Current Runtime", set.selection, set.runtimeList, (value) => {
				set.selection = value;
				BuilderPreferences.save();
			});
			let runtimeListSelect = element.querySelector("select");
			label = element.querySelector("label");
			label.appendChild(document.createTextNode(" ("));
			label.appendChild(Preferences.createFuncAnchor("Rescan", function() {
				runtimeListSelect.innerHTML = "";
				for (let rt of Builder.GetRuntimes(set.location)) {
					let option = document.createElement("option");
					option.innerHTML = option.value = rt;
					runtimeListSelect.appendChild(option);
				}
				runtimeListSelect.value = set.selection;
				BuilderPreferences.save();
			}));
			label.appendChild(document.createTextNode(")"));
		}
		
		let settingsGroup = Preferences.addGroup(root, "Builder Settings");
		if (Builder.Platform =="win") {
			Preferences.addButton(settingsGroup, "Clean Virtual Drives", () => {
				BuilderDrives.clean();
			});
		}
		Preferences.addInput(settingsGroup, "Fork Arguments", this.current.forkArguments, (value) => {
			this.current.forkArguments = value;
			this.save();
		});
		Preferences.addCheckbox(settingsGroup, "Reuse Output Tab", this.current.reuseTab, (value) => {
			this.current.reuseTab = value;
			this.save();
		});
		Preferences.addCheckbox(settingsGroup, "Save Upon Compile", this.current.saveCompile, (value) => {
			this.current.saveCompile = value;
			this.save();
		});
		Preferences.addCheckbox(settingsGroup, "Stop Upon Compile", this.current.stopCompile, (value) => {
			this.current.stopCompile = value;
			this.save();
		});
		Preferences.addCheckbox(settingsGroup, "Display Line After Fatal Error", this.current.displayLine, (value) => {
			this.current.displayLine = value;
			this.save();
		});
		Preferences.addButton(root, "Back", () => {
			Preferences.setMenu(Preferences.menuMain);
			this.save();
		});
		Preferences.addText(root, `builder v${Builder.Version} by nommiin`);
	}
	
	static ready() {
		GMEdit.on("preferencesBuilt", (e) => {
			const Preferences = $gmedit["ui.Preferences"];
			Preferences.addButton(e.target, "builder Settings", () => {
				if (this.element == null) this.build();
				Preferences.setMenu(this.element);
			});
		});
	}
}
if (require("os").type().includes("Darwin")) process.env.ProgramData = "/Users/Shared";

Builder = {
    Version: "1.23",
    MenuItems: { list: [], run: null, stop: null, fork: null },
    Platform: require("os").type(),
    PreferencesPath: Electron_App.getPath("userData") + "/GMEdit/config/Builder-preferences.json",
    PreferencesElement: document.createElement("div"),
    Preferences: {
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
    },
    RuntimeSettings: null,
    SavePreferences: function() {
        Electron_FS.writeFileSync(this.PreferencesPath, JSON.stringify(this.Preferences, (k, v) => {
            return k == "runtimeList" ? undefined : v;
        }, "    "));
    },
    LoadPreferences: function() {
        return Object.assign(this.Preferences, JSON.parse(Electron_FS.readFileSync(this.PreferencesPath)));
    },
    LoadKeywords: function(path) {
        Electron_FS.readdirSync(path).forEach((e) => {
            let RuntimeStat = Electron_FS.statSync(path + "/" + e);
            if (RuntimeStat.isDirectory() == true) {
                if (Electron_FS.existsSync(path + "/" + e + "/fnames") == true) {
                    $gmedit["parsers.GmlParseAPI"].loadStd(Electron_FS.readFileSync(path + "/" + e + "/fnames").toString(), {kind: GmlAPI.stdKind, doc: GmlAPI.stdDoc, comp: GmlAPI.stdComp })
                }
            }
        });
    },
    ProjectVersion: function(project) {
        // GMEdit seems to adjust the .version property to be a gml_GmlVersion class, check if it's an object or not to maintain backwards compatibility
        if (typeof(project.version) == "object") {
            switch (project.version.config.projectMode) {
                case "gms2": return 2;
                case "gms1": return 1;
            }
            return -1;
        }
        return project.version;
    },
    GetRuntimes: function(path) {
        let Runtimes = [];
        try {
            Electron_FS.readdirSync(path).forEach((e) => {
                let RuntimeStat = Electron_FS.statSync(path + e);
                if (RuntimeStat.isDirectory() == true) {
                    Runtimes.push(e);
                }
            });
        } catch (x) {
            console.warn(`Failed to index ${path}:`, x);
        }
        Runtimes.sort((a, b) => a < b ? 1 : -1);
        return Runtimes;
    },
    InitalizeRuntimes: function(set, showWarning) {
        // [Re-]gather list of runtimes
        set.runtimeList = this.GetRuntimes(set.location);
        
        if (set.runtimeList.length <= 0) {
            if (showWarning) Electron_Dialog.showMessageBox({
                type: "warning",
                message: `builder was unable to find any runtimes in ${set.location}, please verify your runtime location and rescan.`
            });
            set.selection = "";
            return;
        }
        
        if (set.selection.trim() == "" || !set.runtimeList.includes(set.selection)) {
            set.selection = set.runtimeList[0];
        }
    },
    Initalize: function() {
        // Check if platform is supported
        this.Platform = (this.Platform.includes("Windows") ? "win" : (this.Platform.includes("Darwin") ? "mac" : "unknown"));
        if (this.Platform == "unknown") {
            Electron_Dialog.showErrorBox("builder error", `builder v${Builder.Version} is not supported on your platform (${require("os").type()})`);
            return false;
        }

        // Load preferences file
        if (Electron_FS.existsSync(this.PreferencesPath) == true) {
            try {
                this.Preferences = this.LoadPreferences();
                if (this.Preferences.runtimeLocation != null) { // migration
                    this.Preferences.runtimeSettings.Stable.location = this.Preferences.runtimeLocation;
                    delete this.Preferences.runtimeLocation;
                    this.Preferences.runtimeSettings.Stable.selection = this.Preferences.runtimeSelection;
                    delete this.Preferences.runtimeSelection;
                    delete this.Preferences.runtimeList;
                }
            } catch(e) {
                console.error("builder - Failed to read or parse preferences file.");
            }
        } else {
            this.SavePreferences();
        }
        for (let [key, val] of Object.entries(this.Preferences.runtimeSettings)) {
            this.InitalizeRuntimes(val, key == "Stable");
        }
        
        Builder.LoadKeywords(this.Preferences.runtimeSettings.Stable.location + this.Preferences.runtimeSettings.Stable.selection);
        return true;
    }
};

(function() {
    GMEdit.register("builder", {
        init: function() {
            // Initalize Builder!
            if (Builder.Initalize() == false) {
                console.error("builder - Failed to initalize.");
                return;
            }

            // Create main menu items!
            let MainMenu = $gmedit["ui.MainMenu"].menu;
            for (let [index, mainMenuItem] of MainMenu.items.entries()) {
                if (mainMenuItem.id != "close-project") continue;
                Builder.MenuItems.list = [
                    new Electron_MenuItem({
                        id: "builder-sep",
                        type: "separator"
                    }),
                    Builder.MenuItems.run = new Electron_MenuItem({
                        id: "builder-run",
                        label: "Run",
                        accelerator: "F5",
                        enabled: false,
                        click: Builder.Run
                    }),
                    Builder.MenuItems.stop = new Electron_MenuItem({
                        id: "builder-stop",
                        label: "Stop",
                        accelerator: "F6",
                        enabled: false,
                        click: Builder.Stop
                    }),
                    Builder.MenuItems.fork = new Electron_MenuItem({
                        id: "builder-fork",
                        label: "Fork",
                        accelerator: "F7",
                        enabled: false,
                        click: Builder.Fork
                    })
                ];
                for (let newItem of Builder.MenuItems.list) {
                    MainMenu.insert(++index, newItem);
                }
                break;
            }
            if (Builder.MenuItems.run == null) return; // probably running in GMLive.js

            // Create preferences menu!
            let Preferences = $gmedit["ui.Preferences"];
            for (let [key, set] of Object.entries(Builder.Preferences.runtimeSettings)) {
                let runtimeGroup = Preferences.addGroup(Builder.PreferencesElement, `Runtime Settings (${key})`);
                let element, label;
                
                element = Preferences.addInput(runtimeGroup, "Runtime Location", set.location, (value) => {
                    set.location = value; Builder.SavePreferences();
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
                    Builder.SavePreferences();
                }));
                label.appendChild(document.createTextNode(")"));
                
                element = Preferences.addDropdown(runtimeGroup, "Current Runtime", set.selection, set.runtimeList, (value) => {
                    set.selection = value;
                    Builder.SavePreferences();
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
                    Builder.SavePreferences();
                }));
                label.appendChild(document.createTextNode(")"));
            }
            
            let settingsGroup = Preferences.addGroup(Builder.PreferencesElement, "Builder Settings");
            if (Builder.Platform =="win") {
                Preferences.addButton(settingsGroup, "Clean Virtual Drives", () => {
                    let command = require("child_process");
                    let conf = Builder.DrivesFile;
                    if (conf.sync()) conf.data = [];
                    let done = [];
                    for (let c of conf.data) {
                        try {
                            command.execSync(`subst /d ${c}:`);
                            done.push(c);
                        } catch(e) {};
                    }
                    conf.data = [];
                    conf.flush();
                    Electron_Dialog.showMessageBox({type: "info", title: "Builder", message: `Finished cleaning virtual drives (${done.join(", ")}).`});
                });
            }
            Preferences.addInput(settingsGroup, "Fork Arguments", Builder.Preferences.forkArguments, (value) => {
                Builder.Preferences.forkArguments = value;
                Builder.SavePreferences();
            });
            Preferences.addCheckbox(settingsGroup, "Reuse Output Tab", Builder.Preferences.reuseTab, (value) => {
                Builder.Preferences.reuseTab = value;
                Builder.SavePreferences();
            });
            Preferences.addCheckbox(settingsGroup, "Save Upon Compile", Builder.Preferences.saveCompile, (value) => {
                Builder.Preferences.saveCompile = value;
                Builder.SavePreferences();
            });
            Preferences.addCheckbox(settingsGroup, "Stop Upon Compile", Builder.Preferences.stopCompile, (value) => {
                Builder.Preferences.stopCompile = value;
                Builder.SavePreferences();
            });
            Preferences.addCheckbox(settingsGroup, "Display Line After Fatal Error", Builder.Preferences.displayLine, (value) => {
                Builder.Preferences.displayLine = value;
                Builder.SavePreferences();
            });
            Preferences.addButton(Builder.PreferencesElement, "Back", () => {
                Preferences.setMenu(Preferences.menuMain);
                Builder.SavePreferences();
            });
            Preferences.addText(Builder.PreferencesElement, `builder v${Builder.Version} by nommiin`);

            // Add ace commands!
            let AceCommands = $gmedit["ace.AceCommands"];
            AceCommands.add({ name: "run", bindKey: {win: "F5", mac: "F5"}, exec: Builder.Run }, "Run");
            AceCommands.addToPalette({name: "builder: Compile and run your project", exec: "run", title: "Run"});
            AceCommands.add({ name: "stop", bindKey: {win: "F6", mac: "F6"}, exec: Builder.Stop }, "Stop");
            AceCommands.addToPalette({name: "builder: Stop compiler or runner process", exec: "stop", title: "Stop"});
            AceCommands.add({ name: "fork", bindKey: {win: "F7", mac: "F7"}, exec: Builder.Fork }, "Fork");
            AceCommands.addToPalette({name: "builder: Fork instance of runner", exec: "fork", title: "Fork"});
            
            // Hook into finishedIndexing
            let Project = $gmedit["gml.Project"], finishedIndexing = Project.prototype.finishedIndexing;
            function onFinishedIndexing() {
                if (Builder.ProjectVersion(this) != 2) return;
                this.configs = ["default"];
                let project = Project.current;
                let projectContent = project.readTextFileSync(project.name);
                if ($gmedit["yy.YyJson"].isExtJson(projectContent)) { // 2.3
                    function addConfigRec(project, config) {
                        if (!project.configs.includes(config.name)) project.configs.push(config.name);
                        for (let childConfig of config.children) addConfigRec(project, childConfig);
                    }
                    addConfigRec(this, $gmedit["yy.YyJson"].parse(projectContent).configs);
                } else { // 2.2
                    for (let configData of JSON.parse(projectContent).configs) {
                        for (let configName of configData.split(";")) {
                            if (!this.configs.includes(configName)) this.configs.push(configName);
                        }
                    }
                }
                
                let sf = Builder.SessionsFile;
                if (sf.sync()) sf.data = {};
                let path = project.path;
                let pc = sf.data[path];
                if (pc) pc.mtime = Date.now();
                this.config = (pc && pc.config) || "default";
                sf.flush();
                
                let TreeView = $gmedit["ui.treeview.TreeView"];
                let Configurations = undefined;
                for (let dir of document.querySelectorAll(".dir")) {
                    if (dir.textContent == "Configs") {
                        Configurations = dir;
                        break;
                    }
                }
                Configurations = Configurations || TreeView.makeAssetDir("Configs", "");
                
                this.configs.forEach((configName) => {
                    let Configuration = TreeView.makeItem(configName);
                    Configuration.addEventListener("dblclick", function() {
                        Project.current.config = configName;
                        //
                        let sf = Builder.SessionsFile;
                        if (sf.sync()) sf.data = {};
                        let path = Project.current.path;
                        let pc = sf.data[path];
                        if (pc == null) pc = sf.data[path] = { };
                        pc.config = configName;
                        pc.mtime = Date.now();
                        sf.flush();
                        //
                        document.getElementById("project-name").innerText = `${Project.current.displayName} (${configName})`;
                    });
                    Configurations.treeItems.appendChild(Configuration);
                });
                TreeView.element.appendChild(Configurations);
                
                document.getElementById("project-name").innerText = `${Project.current.displayName} (${this.config})`;
            }
            Project.prototype.finishedIndexing = function(arguments) {
                let result = finishedIndexing.apply(this, arguments);
                try {
                    onFinishedIndexing.call(this);
                } catch (x) {
                    console.error(x);
                }
                return result;
            }
            
            GMEdit.on("preferencesBuilt", (e) => {
                Preferences.addButton(e.target, "builder Settings", () => {
                    Preferences.setMenu(Builder.PreferencesElement);
                });
            });
            
            GMEdit.on("projectPropertiesBuilt", (e) => {
                let project = e.project;
                let group = Preferences.addGroup(e.target, "builder Settings");
                const defaultVersion = "<default>";
                //
                let versions = [defaultVersion];
                for (let [key, set] of Object.entries(Builder.Preferences.runtimeSettings)) {
                    versions = versions.concat(set.runtimeList);
                }
                //
                let json = project.properties.builderSettings;
                let ensureJSON = (isDefault) => {
                    let properties = project.properties;
                    let json = properties;
                    if (isDefault && json == null) return null;
                    if (json == null) json = properties.builderSettings = {};
                    return json;
                };
                Preferences.addDropdown(group,
                    "Version override",
                    json?.runtimeVersion ?? defaultVersion,
                    versions,
                (v) => {
                    if (v == defaultVersion) v = null;
                    let json = ensureJSON(v == null);
                    if (json == null) return;
                    json.runtimeVersion = v;
                    $gmedit["ui.project.ProjectProperties"].save(project, project.properties);
                });
                //
                let argsField = Preferences.addInput(group,
                    "Fork arguments override",
                    json?.forkArguments ?? "",
                (v) => {
                    if (v == "") v = null;
                    let json = ensureJSON(v == null);
                    if (json == null) return;
                    json.forkArguments = v;
                    $gmedit["ui.project.ProjectProperties"].save(project, project.properties);
                }).querySelector("input");
                argsField.placeholder = Builder.Preferences.forkArguments;
            });
            
            function projectOpened() {
                for (let item of Builder.MenuItems.list) item.enabled = false;
                let project = $gmedit["gml.Project"].current;
                if (Builder.ProjectVersion(project) == 2) {
                    Builder.MenuItems.run.enabled = true;
                    let runtime;
                    if (project.version.name == "v23"
                        && Builder.Preferences.runtimeSettings.Stable.selection < "runtime-2.3"
                        && Builder.Preferences.runtimeSettings.Beta.selection != ""
                    ) {
                        runtime = Builder.Preferences.runtimeSettings.Beta;
                    } else runtime = Builder.Preferences.runtimeSettings.Stable;
                    Builder.RuntimeSettings = runtime;
                    Builder.LoadKeywords(runtime.location + runtime.selection);
                }
            }
            GMEdit.on("projectOpen", projectOpened);
        
            GMEdit.on("projectClose", function() {
                for (let item of Builder.MenuItems.list) item.enabled = false;
            });
            
            projectOpened();
        }
    });
})();

if (require("os").type().includes("Darwin")) process.env.ProgramData = "/Users/Shared";

Builder = {
    Version: "1.2",
    MenuIndex: -1,
    Platform: require("os").type(),
    PreferencesPath: Electron_App.getPath("userData") + "/GMEdit/config/Builder-preferences.json",
    PreferencesElement: document.createElement("div"),
    Preferences: {
        reuseTab: false,
        saveCompile: false,
        stopCompile: false,
        displayLine: true,
        forkArguments: "",
        runtimeLocation: process.env.ProgramData + "/GameMakerStudio2/Cache/runtimes/",
        runtimeSelection: "",
        runtimeList: []
    },
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
        Electron_FS.readdirSync(path).forEach((e) => {
            let RuntimeStat = Electron_FS.statSync(path + e);
            if (RuntimeStat.isDirectory() == true) {
                Runtimes.push(e);
            }
        });
        return Runtimes;
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
                if (this.Preferences.runtimeSelection.trim() == "" && this.Preferences.runtimeList > 0) {
                    this.Preferences.runtimeSelection = this.Preferences.runtimeList[0];   
                }
            } catch(e) {
                console.error("builder - Failed to read or parse preferences file.");
            }
        } else {
            this.SavePreferences();
        }
        this.Preferences.runtimeList = [];

        // Gather list of runtimes
        this.Preferences.runtimeList = this.GetRuntimes(this.Preferences.runtimeLocation);
        if (this.Preferences.runtimeList.length <= 0) {
            Electron_Dialog.showMessageBox({type: "warning", message: "builder was unable to find any runtimes, please verify your runtime location and rescan."});
        }
        Builder.LoadKeywords(this.Preferences.runtimeLocation + this.Preferences.runtimeSelection);
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
            MainMenu.items.forEach((item, index) => {if (item.label.toLowerCase() == "close project") {
                Builder.MenuIndex = ++index + 1;
                MainMenu.insert(index, new Electron_MenuItem({type: "separator"}));
                MainMenu.insert(++index, new Electron_MenuItem({label: "Run", accelerator: "F5", enabled: false, click: Builder.Run}));
                MainMenu.insert(++index, new Electron_MenuItem({label: "Stop", accelerator: "F6", enabled: false, click: Builder.Stop}));
                MainMenu.insert(++index, new Electron_MenuItem({label: "Fork", accelerator: "F7", enabled: false, click: Builder.Fork}));
                return;
            }});

            // Create preferences menu!
            let Preferences = $gmedit["ui.Preferences"];
            Preferences.addText(Builder.PreferencesElement, "").innerHTML = "<b>Runtime Settings</b>";
            Preferences.addInput(Builder.PreferencesElement, "Runtime Location", Builder.Preferences.runtimeLocation, (value) => { Builder.Preferences.runtimeLocation = value; Builder.SavePreferences(); });
            Preferences.addButton(Builder.PreferencesElement, "Reset Location", () => { 
                Builder.Preferences.runtimeLocation = process.env.ProgramData + "/GameMakerStudio2/Cache/runtimes/";
                Builder.PreferencesElement.children[1].children[1].value = Builder.Preferences.runtimeLocation;
                Builder.SavePreferences();
            });
            Preferences.addButton(Builder.PreferencesElement, "Rescan Runtimes", () => {
                let Selection = Builder.PreferencesElement.children[4].children[1];
                Selection.innerHTML = "";
                Builder.Preferences.runtimeList = Builder.GetRuntimes(Builder.Preferences.runtimeLocation);
                Builder.Preferences.runtimeList.forEach((e, i) => {
                    let Option = document.createElement("option");
                    Option.value = e;
                    Option.innerHTML = Option.value;
                    Selection.appendChild(Option);
                });
            });
            Preferences.addDropdown(Builder.PreferencesElement, "Current Runtime", Builder.Preferences.runtimeSelection, Builder.Preferences.runtimeList, (value) => {
                Builder.Preferences.runtimeSelection = value;
                Builder.SavePreferences();
            });
            if (Builder.Platform =="win") {
                Preferences.addButton(Builder.PreferencesElement, "Clean Virtual Drives", () => {
                    let Command = require("child_process"), Drives = window.localStorage.getItem("builder:drives") || "";
                    for(let i = 0; i < Drives.length; i++) {
                        try {
                            Command.execSync(`subst /d ${Drives[i]}:`);
                        } catch(e) {};
                    }
                    window.localStorage.setItem("builder:drives", "");
                    Electron_Dialog.showMessageBox({type: "info", title: "Builder", message: "Finished cleaning virtual drives."});
                });
            }
            Preferences.addText(Builder.PreferencesElement, "").innerHTML = "<b>Builder Settings</b>";
            Preferences.addInput(Builder.PreferencesElement, "Fork Arguments", Builder.Preferences.forkArguments, (value) => { Builder.Preferences.forkArguments = value; Builder.SavePreferences(); });
            Preferences.addCheckbox(Builder.PreferencesElement, "Reuse Output Tab", Builder.Preferences.reuseTab, (value) => { Builder.Preferences.reuseTab = value; Builder.SavePreferences(); });
            Preferences.addCheckbox(Builder.PreferencesElement, "Save Upon Compile", Builder.Preferences.saveCompile, (value) => { Builder.Preferences.saveCompile = value; Builder.SavePreferences(); });
            Preferences.addCheckbox(Builder.PreferencesElement, "Stop Upon Compile", Builder.Preferences.stopCompile, (value) => { Builder.Preferences.stopCompile = value; Builder.SavePreferences(); });
            Preferences.addCheckbox(Builder.PreferencesElement, "Display Line After Fatal Error", Builder.Preferences.displayLine, (value) => { Builder.Preferences.displayLine = value; Builder.SavePreferences(); });
            Preferences.addButton(Builder.PreferencesElement, "Back", () => { Preferences.setMenu(Preferences.menuMain); Builder.SavePreferences(); });
            Preferences.addText(Builder.PreferencesElement, `builder v${Builder.Version} by nommiin`);
            let buildMain = Preferences.buildMain;
            Preferences.buildMain = function(arguments) {
                let Return = buildMain.apply(this, arguments);
                Preferences.addButton(Return, "builder Settings", function() {
                    Preferences.setMenu(Builder.PreferencesElement);
                })
                return Return;
            }

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
            Project.prototype.finishedIndexing = function(arguments) {
                let Return = finishedIndexing.apply(this, arguments);
                if (Builder.ProjectVersion(this) != 2) return Return;
                this.configs = ["default"];
                JSON.parse(Electron_FS.readFileSync(Project.current.path)).configs.forEach((e) => {
                    e.split(";").forEach((e) => { if (this.configs.includes(e) == false) this.configs.push(e); });
                });
                this.config = (this.configs.includes(window.localStorage.getItem(`config:${Project.current.path}`)) ? window.localStorage.getItem(`config:${Project.current.path}`) : "default");
                window.localStorage.setItem(`config:${Project.current.path}`, this.config);  
                let TreeView = $gmedit["ui.treeview.TreeView"],  Configurations = undefined;
                document.querySelectorAll(".dir").forEach((e) => {
                    if (e.textContent == "Configs") {
                        Configurations = e;
                        return;
                    }
                });
                Configurations = Configurations || TreeView.makeAssetDir("Configs", "");
                this.configs.forEach((e) => {
                    let Configuration = TreeView.makeItem(e);
                    Configuration.addEventListener("dblclick", function() {
                        Project.current.config = this.innerText;
                        window.localStorage.setItem(`config:${Project.current.path}`, Project.current.config);
                        document.getElementById("project-name").innerText = `${Project.current.displayName} (${this.innerText})`;
                    });
                    Configurations.treeItems.appendChild(Configuration);
                });
                TreeView.element.appendChild(Configurations);
                document.getElementById("project-name").innerText = `${Project.current.displayName} (${this.config})`;
                return Return;
            }
        }
    });

    GMEdit.on("projectOpen", function() {
        let MainMenu = $gmedit["ui.MainMenu"].menu;
        if (Builder.MenuIndex != -1) {
            for(let i = 0; i < 3; i++) {
                MainMenu.items[Builder.MenuIndex + i].enabled = false;
            }
            
            if (Builder.ProjectVersion($gmedit["gml.Project"].current) == 2) {
                MainMenu.items[Builder.MenuIndex].enabled = true;
                Builder.LoadKeywords(Builder.Preferences.runtimeLocation + Builder.Preferences.runtimeSelection);
            }
        }
    });

    GMEdit.on("projectClose", function() {
        let MainMenu = $gmedit["ui.MainMenu"].menu;
        if (Builder.MenuIndex != -1) for(let i = 0; i < 3; i++) {
            MainMenu.items[Builder.MenuIndex + i].enabled = false;
        }
    });
})();

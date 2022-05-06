if (require("os").type().includes("Darwin")) process.env.ProgramData = "/Users/Shared";

Builder = {
    Version: "1.24",
    MenuItems: { list: [], run: null, stop: null, fork: null },
    Platform: require("os").type(),
    RuntimeSettings: null,
    LoadKeywords: function(path) {
        const custBase = $gmedit["electron.FileWrap"].userPath + "/api/" + GmlAPI.version.getName();
        const GmlAPILoader = $gmedit["gml.GmlAPILoader"];
        const GmlParseAPI = $gmedit["parsers.GmlParseAPI"];
        const getText = (path) => {
            if (Electron_FS.existsSync(path)) {
                try {
                    return Electron_FS.readFileSync(path, "utf8")
                } catch (x) {
                    console.error(x);
                    return null;
                }
            } else return null;
        }
        for (let platform of Electron_FS.readdirSync(path)) {
            let platformPath = `${path}/${platform}`;
            if (!Electron_FS.statSync(platformPath).isDirectory()) continue;
            let fnamesPath = platformPath + "/fnames";
            if (!Electron_FS.existsSync(fnamesPath)) continue;
            let apiText = Electron_FS.readFileSync(fnamesPath, "utf8");
            //
            let custDir = custBase + "/" + platform;
            if (Electron_FS.existsSync(custDir)) {
                let replText = getText(custDir + "/replace.gml");
                if (replText) apiText = GmlAPILoader.applyPatchFile(apiText, replText);
                //
                let extraText = getText(custDir + "/extra.gml");
                if (extraText) apiText += "\n" + extraText;
            }
            //
            let args = GmlAPILoader.getArgs();
            GmlParseAPI.loadStd(apiText, args);
        }
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
        BuilderPreferences.init();
        for (let [key, val] of Object.entries(BuilderPreferences.current.runtimeSettings)) {
            this.InitalizeRuntimes(val, key == "Stable");
        }
        
        let runtimeSettings = BuilderPreferences.current.runtimeSettings.Stable;
        Builder.LoadKeywords(runtimeSettings.location + runtimeSettings.selection);
        return true;
    }
};

(function() {
    function initCommands() {
        const commands = [{
            name: "builder-run",
            title: "builder: Compile and run",
            bindKey: "F5",
            exec: () => Builder.Run(),
        }, {
            name: "builder-run-and-fork",
            title: "builder: Compile and run two instances",
            bindKey: { win: "ctrl-F5", mac: "cmd-F5" },
            exec: () => Builder.Run(true),
        }, {
            name: "builder-stop",
            title: "builder: Stop compiler or runner process",
            bindKey: "F6",
            exec: Builder.Stop,
        }, {
            name: "builder-fork",
            title: "builder: Fork instance of runner",
            bindKey: "F7",
            exec: Builder.Fork,
        }];
        
        let hashHandler = $gmedit["ui.KeyboardShortcuts"].hashHandler;
        let AceCommands = $gmedit["ace.AceCommands"];
        for (let cmd of commands) {
            hashHandler.addCommand(cmd);
            AceCommands.add(cmd);
            AceCommands.addToPalette({
                name: cmd.title,
                exec: cmd.name,
            })
        }
    }
    GMEdit.register("builder", {
        init: function(config) {
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
						icon: config.dir + "/icons/run.png",
                        enabled: false,
                        click: () => Builder.Run()
                    }),
                    Builder.MenuItems.runAndFork = new Electron_MenuItem({
                       id: "builder-run-and-fork",
                       label: "Run and Fork",
                       accelerator: "Ctrl+F5",
					   icon: config.dir + "/icons/run-and-fork.png",
                       enabled: false,
                       visible: BuilderPreferences.current.showRunAndFork,
                       click: () => Builder.Run(true)
                    }),
                    Builder.MenuItems.stop = new Electron_MenuItem({
                        id: "builder-stop",
                        label: "Stop",
                        accelerator: "F6",
						icon: config.dir + "/icons/stop.png",
                        enabled: false,
                        click: Builder.Stop
                    }),
                    Builder.MenuItems.fork = new Electron_MenuItem({
                        id: "builder-fork",
                        label: "Fork",
                        accelerator: "F7",
						icon: config.dir + "/icons/fork.png",
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

            BuilderPreferences.ready();
            BuilderProjectProperties.ready();
            
            // Add ace commands!
            initCommands();
            
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
            
            function projectOpened() {
                for (let item of Builder.MenuItems.list) item.enabled = false;
                let project = $gmedit["gml.Project"].current;
                if (Builder.ProjectVersion(project) == 2) {
                    Builder.MenuItems.run.enabled = true;
                    Builder.MenuItems.runAndFork.enabled = true;
                    let runtime;
                    const pref = BuilderPreferences.current;
                    if (project.version.name == "v23"
                        && pref.runtimeSettings.Stable.selection < "runtime-2.3"
                        && pref.runtimeSettings.Beta.selection != ""
                    ) {
                        // if runtime is set to 2.2.5 but project uses 2.3, prefer a beta runtime
                        runtime = pref.runtimeSettings.Beta;
                    } else runtime = pref.runtimeSettings.Stable;
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

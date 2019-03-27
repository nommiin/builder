
/*
$gmedit["gml.Project"].current
*/
Builder = {Platform: require("os").type(), Version: 0};
if (Builder.Platform.includes("Windows") == true) Builder.Platform = "win";
if (Builder.Platform.includes("Darwin") == true) {
    Builder.Platform = "mac";
    process.env.ProgramData = "/Users/Shared";
}

(function() {
    Builder = Object.assign(Builder, {
        Index: -1,
        Settings: document.createElement("div"),
        Preferences: {reuseTab: false, saveCompile: false, forkArguments: "-alt", gmsLocation: Electron_App.getPath("appData") + "\\GameMaker-Studio\\", runtimeLocation: process.env.ProgramData + "/GameMakerStudio2/Cache/runtimes/", runtimeList: Electron_FS.readdirSync(process.env.ProgramData + "/GameMakerStudio2/Cache/runtimes/"), runtimeSelection: ""},
        Save: function() {
            Electron_FS.writeFileSync(Electron_App.getPath("userData") + "/GMEdit/config/builder-preferences.json", JSON.stringify(this.Preferences));
        }
    });

    GMEdit.register("builder", {
        init: ()=> {
            // check for windows
            if (Builder.Platform != "win" && Builder.Platform != "mac") {
                Electron_Dialog.showErrorBox("Error", "builder is not supported on non-Windows/macOS platforms.");
                return;
            }

            // Register main menu options
            let menu = $gmedit["ui.MainMenu"].menu;
            menu.items.forEach((item, index) => {
                if (item.label.toLowerCase() == "close project") {
                    //menu.insert(++index, new Electron_MenuItem({label: "Stop Project", accelerator: "F6", enabled: false, click: Builder.Debug}));
                    menu.insert(++index, new Electron_MenuItem({label: "Fork", accelerator: "F7", enabled: false, click: Builder.Fork}));
                    menu.insert(index, new Electron_MenuItem({label: "Stop", accelerator: "F6", enabled: false, click: Builder.Stop}));
                    menu.insert(index, new Electron_MenuItem({label: "Run", accelerator: "F5", enabled: false, click: Builder.Run}));
                    menu.insert(index, new Electron_MenuItem({type: "separator"}));
                    Builder.Index = index + 1;
                    return;
                }
            });

            // Load builder preferences
            Builder.Preferences.runtimeSelection = Builder.Preferences.runtimeList[0];
            if (Electron_FS.existsSync(Electron_App.getPath("userData") + "/GMEdit/config/builder-preferences.json") == true) {
                Builder.Preferences = Object.assign(Builder.Preferences, JSON.parse(Electron_FS.readFileSync(Electron_App.getPath("userData") + "/GMEdit/config/builder-preferences.json")));
            } else {
                Builder.Save();
            }

            // Create builder settings menu
            let preferences = $gmedit["ui.Preferences"];
            var t = preferences.addText(Builder.Settings, "Runtime Settings");
            t.innerHTML = `<b>${t.innerHTML}</b>`; t.style = "border: 1px solid #495057; padding: 2px";
            preferences.addInput(Builder.Settings, "Runtime Location", Builder.Preferences.runtimeLocation, function(v) {
                Builder.Preferences.runtimeLocation = v;
                Builder.Save();
            });
            preferences.addButton(Builder.Settings, "Reset Location", function() {
                Builder.Preferences.runtimeLocation = process.env.ProgramData + "/GameMakerStudio2/Cache/runtimes/";
                Builder.Settings.children[1].value = Builder.Preferences.runtimeLocation;
                Builder.Save();
            });
            preferences.addButton(Builder.Settings, "Reload Runtimes", function() {
                try {
                    Builder.Preferences.runtimeList = Electron_FS.readdirSync(Builder.Preferences.runtimeLocation);
                    Builder.Settings.children[3].children[1].innerHTML = "";
                    Builder.Preferences.runtimeList.forEach((e, i) => {
                        let o = document.createElement("option");
                        o.value = e;
                        o.innerHTML = e;
                        Builder.Settings.children[3].children[1].appendChild(o);
                    });
                } catch (e) {
                    Electron_Dialog.showErrorBox("Error", "The given runtime location does not exist!");
                }
            });
            preferences.addDropdown(Builder.Settings, "Current Runtime", Builder.Preferences.runtimeSelection, Builder.Preferences.runtimeList, function(v) {
                Builder.Preferences.runtimeSelection = v;
                Builder.Save();
            });
            if (Builder.Platform == "win") {
                preferences.addButton(Builder.Settings, "Clean Virtual Drives", function() {
                    let cmd = require("child_process"), vds = window.localStorage.getItem("builder:drives") || "";
                    if (vds.length > 0) {
                        for(var j = 0; j < vds.length; j++) {
                            try {
                                cmd.execSync("subst /d " + vds[j] + ":");
                            } catch(e) {}
                        }
                    }
                    window.localStorage.setItem("builder:drives", "");
                    Electron_Dialog.showMessageBox({message: "Finished cleaning virtual drives"});
                });
            }
            var t = preferences.addText(Builder.Settings, "builder Settings");
            t.innerHTML = `<b>${t.innerHTML}</b>`; t.style = "border: 1px solid #495057; padding: 2px";
            preferences.addInput(Builder.Settings, "Fork Arguments", Builder.Preferences.forkArguments, function(v) {
                Builder.Preferences.forkArguments = v;
                Builder.Save();
            });
            /*
            if (Builder.Platform == "win") {
                var t = preferences.addText(Builder.Settings, "GMS 1 Settings");
                t.innerHTML = `<b>${t.innerHTML}</b>`; t.style = "border: 1px solid #495057; padding: 2px";
                preferences.addInput(Builder.Settings, "Installation Path", Builder.Preferences.gmsLocation, function(v) {
                    Builder.Preferences.gmsLocation = v;
                    Builder.Save();
                });
            }*/
            /*
            preferences.addCheckbox(Builder.Settings, "Reuse Output Tab", Builder.Preferences.reuseTab, function(v) {
                Builder.Preferences.reuseTab = v;
                Builder.Save();
            });*/
            preferences.addCheckbox(Builder.Settings, "Save Upon Compile", Builder.Preferences.saveCompile, function(v) {
                Builder.Preferences.saveCompile = v;
                Builder.Save();
            });
            preferences.addCheckbox(Builder.Settings, "Reuse Output Tab", Builder.Preferences.reuseTab, function(v) {
                Builder.Preferences.reuseTab = v;
                Builder.Save();
            });
            preferences.addButton(Builder.Settings, "Back", function() {
                preferences.setMenu(preferences.menuMain);
                Builder.Save();
            });
            preferences.addText(Builder.Settings, "builder v0.10 (" + Builder.Platform + ") - nommiin");

            // Add ace commands
            $gmedit["ace.AceCommands"].add({ name : "run", bindKey : { win : "F5", mac : "F5"}, exec : () => {
                if ( $gmedit["ui.MainMenu"].menu.items[Builder.Index].enabled == true) {
                    Builder.Run();
                }
            }}, "Run");
            $gmedit["ace.AceCommands"].addToPalette({name: "builder: Compile and run your project", exec: "run", title: "Run"});

            $gmedit["ace.AceCommands"].add({ name : "stop", bindKey : { win : "F6", mac : "F6"}, exec : () => {
                if ( $gmedit["ui.MainMenu"].menu.items[Builder.Index + 1].enabled == true) {
                    Builder.Stop();
                }
            }}, "Stop");
            $gmedit["ace.AceCommands"].addToPalette({name: "builder: Stop compiler or runner process", exec: "stop", title: "Stop"});

            $gmedit["ace.AceCommands"].add({ name : "fork", bindKey : { win : "F7", mac : "F7"}, exec : () => {
                if ( $gmedit["ui.MainMenu"].menu.items[Builder.Index + 2].enabled == true) {
                    Builder.Fork();
                }
            }}, "Fork");
            $gmedit["ace.AceCommands"].addToPalette({name: "builder: Fork instance of runner", exec: "fork", title: "Fork"});

            // Hook into preferences menu
            let buildMain = preferences.buildMain;
            preferences.buildMain = function(arguments) {
                let _return = buildMain.apply(this, arguments);
                preferences.addButton(_return, "builder Settings", function() {
                    preferences.setMenu(Builder.Settings);
                });
                return _return;
            }

            // Hook into finishedIndexing method of Project.hx
            let finishedIndexing = $gmedit["gml.Project"].prototype.finishedIndexing;
            $gmedit["gml.Project"].prototype.finishedIndexing = function(arguments) {
                let _return = finishedIndexing.apply(this, arguments);
                this.configs = ["default"];
                JSON.parse(Electron_FS.readFileSync($gmedit["gml.Project"].current.path)).configs.forEach(config => {
                    config.split(";").forEach(c => {
                        if (this.configs.includes(c) == false) this.configs.push(c);
                    });
                });

                this.config = window.localStorage.getItem(`config:${$gmedit["gml.Project"].current.path}`);
                if (this.config == null || this.configs.includes(this.config) == false) {
                    this.config = this.configs[0];
                    window.localStorage.setItem(`config:${$gmedit["gml.Project"].current.path}`, this.config);
                }

                let configs = $gmedit["ui.treeview.TreeView"].makeAssetDir("Configurations", "");
                this.configs.forEach(c => {
                    let config = $gmedit["ui.treeview.TreeView"].makeItem(c);
                    config.addEventListener("dblclick", function(e) {
                        $gmedit["gml.Project"].current.config = this.innerText;
                        window.localStorage.setItem(`config:${$gmedit["gml.Project"].current.path}`, this.innerText);
                        document.getElementById("project-name").innerText = `${$gmedit["gml.Project"].current.displayName} (${this.innerText})`;
                    });
                    configs.treeItems.appendChild(config);
                });
                $gmedit["ui.treeview.TreeView"].element.appendChild(configs);
                document.getElementById("project-name").innerText = `${this.displayName} (${this.config})`
                return _return;
            }
        }
    });

    GMEdit.on("projectOpen", function() {
        for(var i = 0; i < 1/*2*/; i++) {
            //$gmedit["ui.MainMenu"].menu.items[Builder.Index + i].enabled = ((($gmedit["gml.Project"].current.version == 1 && Builder.Platform == "win") || $gmedit["gml.Project"].current.version == 2) ? true : false);
            $gmedit["ui.MainMenu"].menu.items[Builder.Index + i].enabled = ($gmedit["gml.Project"].current.version == 2 ? true : false);
        }
        Builder.Version = $gmedit["gml.Project"].current.version;
        
    });

    GMEdit.on("projectClose", function() {
        for(var i = 0; i < 3; i++) {
            $gmedit["ui.MainMenu"].menu.items[Builder.Index + i].enabled = false;
        }
    });
})();
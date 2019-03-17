
/*
$gmedit["gml.Project"].current
*/
(function() {
    Builder = {
        Index: -1,
        Settings: document.createElement("div"),
        Preferences: {runtimeLocation: process.env.ProgramData + "\\GameMakerStudio2\\Cache\\runtimes\\", runtimeList: Electron_FS.readdirSync(process.env.ProgramData + "\\GameMakerStudio2\\Cache\\runtimes\\"), runtimeSelection: ""},
        Save: function() {
            Electron_FS.writeFileSync(Electron_App.getPath("userData") + "\\GMEdit\\config\\builder-preferences.json", JSON.stringify(this.Preferences));
        }
    };

    GMEdit.register("builder", {
        init: ()=> {
            // Register main menu options
            let menu = $gmedit["ui.MainMenu"].menu;
            menu.items.forEach((item, index) => {
                if (item.label.toLowerCase() == "close project") {
                    menu.insert(++index, new Electron_MenuItem({label: "Debug Project", accelerator: "F6", enabled: false, click: Builder.Debug}));
                    menu.insert(index, new Electron_MenuItem({label: "Run Project", accelerator: "F5", enabled: false, click: Builder.Run}));
                    menu.insert(index, new Electron_MenuItem({type: "separator"}));
                    Builder.Index = index + 1;
                    return;
                }
            });

            // Load builder preferences
            Builder.Preferences.runtimeSelection = Builder.Preferences.runtimeList[0];
            if (Electron_FS.existsSync(Electron_App.getPath("userData") + "\\GMEdit\\config\\builder-preferences.json") == true) {
                Builder.Preferences = JSON.parse(Electron_FS.readFileSync(Electron_App.getPath("userData") + "\\GMEdit\\config\\builder-preferences.json"));
            } else {
                Builder.Save();
            }

            // Create builder settings menu
            let preferences = $gmedit["ui.Preferences"];
            preferences.addInput(Builder.Settings, "Runtime Location", Builder.Preferences.runtimeLocation, function(v) {
                Builder.Preferences.runtimeLocation = v;
                Builder.Save();
            });
            preferences.addButton(Builder.Settings, "Reset Location", function() {
                Builder.Preferences.runtimeLocation = process.env.ProgramData + "\\GameMakerStudio2\\Cache\\runtimes\\";
                Builder.Settings.children[1].value = Builder.Preferences.runtimeLocation;
                Builder.Save();
            });
            preferences.addButton(Builder.Settings, "Reload Runtimes", function() {
                try {
                    Builder.Preferences.runtimeList = Electron_FS.readdirSync(Builder.Preferences.runtimeLocation);
                    Builder.Settings.children[3].children[1].innerHTML = "";
                    Builder.Preferences.runtimeList.forEach((e, i) => {
                        let o = document.createElement("option");
                        o.value = i;
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
            preferences.addButton(Builder.Settings, "Back", function() {
                preferences.setMenu(preferences.menuMain);
                Builder.Save();
            });
            preferences.addText(Builder.Settings, "Builder v0.1 - Developed by Nommiin")

            // Hook into preferences menu
            let buildMain = preferences.buildMain;
            preferences.buildMain = (arguments) => {
                let _return = buildMain.apply(this, arguments);
                preferences.addButton(_return, "Builder settings", function() {
                    preferences.setMenu(Builder.Settings);
                });
                return _return;
            }            
        }
    });

    GMEdit.on("projectOpen", function(project) {
        for(var i = 0; i < 1/*2*/; i++) {
            $gmedit["ui.MainMenu"].menu.items[Builder.Index + i].enabled = true;
        }

        //console.log(project.path);
        $gmedit["ui.treeview.TreeView"].element.appendChild($gmedit["ui.treeview.TreeView"].makeAssetDir("Configurations", ""));
    });

    GMEdit.on("projectClose", function() {
        for(var i = 0; i < 1/*2*/; i++) {
            $gmedit["ui.MainMenu"].menu.items[Builder.Index + i].enabled = false;
        }
    });
})();
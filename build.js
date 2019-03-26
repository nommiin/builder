Builder.Random = function() {
    return Math.round(Math.random() * 4294967295).toString(16).padStart(8, "0").toUpperCase();
}

Builder = Object.assign(Builder, {
    Drive: "",
    Running: 0,
    Compiler: undefined,
    RunArgs: [],
    Runner: undefined,
    Errors: []
});

Builder.Parse = function(bString, bType) {
    if (bType == 0) { // GMAssetCompiler
        let bContents = (bString.toString()).split("\n");
        for(let i = 0; i < bContents.length; i++) {
            if (bContents[i].includes("Error : ") == true) {
                Builder.Errors.push(bContents[i].slice(7).trim());
            } else if (bContents[i].includes("Final Compile") == true && Builder.Errors.length > 0) {
                return 1;
            }
        }
    } else if (bType == 1) { // Runner
        if (bString.includes("ERROR!!! :: ") == true) {
            let bContents = bString.split("\n");
            for(let i = 0; i < bContents.length; i++) {
                if (bContents[i].toLowerCase().includes("stack frame is") == true) {
                    var eName = "", bType = bContents[i + 1].slice(4, bContents[i + 1].indexOf("_", 4)), bAsset = bContents[i + 1].slice(bContents[i + 1].indexOf("_", 4) + 1), bLine = parseInt(bContents[i + 1].slice(bContents[i + 1].lastIndexOf("line") + 4, bContents[i + 1].lastIndexOf(")")).trim());
                    if (bType == "Script") {
                        bAsset = bAsset.slice(0, bAsset.indexOf("(") - 1);
                    } else if (bType == "Object") {
                        let bEvent = bContents[i + 1].slice(bContents[i + 1].lastIndexOf("_", bContents[i + 1].lastIndexOf("_") -1) + 1, bContents[i + 1].lastIndexOf("(")).trim();
                        bAsset = bAsset.slice(0, bAsset.lastIndexOf("_")); bAsset = bAsset.slice(0, bAsset.lastIndexOf("_"));

                        // get GMEdit name
                        let eMain = bEvent.slice(0, bEvent.lastIndexOf("_")), eSub = parseInt(bEvent.slice(bEvent.lastIndexOf("_") + 1).trim());
                        for(var j = 0; j < $gmedit["parsers.GmlEvent"].t2sc.length; j++) {
                            if ($gmedit["parsers.GmlEvent"].t2sc[j] == eMain) {
                                eName = $gmedit["parsers.GmlEvent"].i2s[j][eSub];
                                break;
                            }
                        }
                    }

                    if ($gmedit["ui.OpenDeclaration"].openLocal(bAsset, 0) == true) {
                        setTimeout(() => {
                            let bOffset = 0;
                            if (eName != "") {
                                for(let i = 0; i < aceEditor.session.getLength(); i++) {
                                    if (aceEditor.session.getLine(i).includes("#event " + eName) == true) {
                                        bOffset = ++i;
                                        break;
                                    }
                                }
                            }
                            aceEditor.gotoLine(bOffset + bLine);
                        }, 500);
                    }

                }
            }
        }
    }
    return 0;
}

Builder.Run = function() {
    // collect local settings
    var tempdir = require("os").tmpdir();
    if (Builder.Version == 2) {
        var userpath = JSON.parse(Electron_FS.readFileSync((Builder.Platform == "win" ? Electron_App.getPath("appData") : ("/Users/" + process.env.LOGNAME + "/.config")) + "/GameMakerStudio2/um.json")); userpath = (Builder.Platform == "win" ? Electron_App.getPath("appData") : ("/Users/" + process.env.LOGNAME + "/.config")) + "/GameMakerStudio2/" + userpath.login.slice(0, userpath.login.indexOf("@")) + "_" + userpath.userID;
        var usersettings = JSON.parse(Electron_FS.readFileSync(userpath + "/local_settings.json"));
        var projectnameg = $gmedit["gml.Project"].current.name.slice(0, $gmedit["gml.Project"].current.name.indexOf(".yyp"));
        var temppath = (usersettings["machine.General Settings.Paths.IDE.TempFolder"] || (Builder.Platform == "win" ? (process.env.LOCALAPPDATA + "/GameMakerStudio2") : (tempdir.slice(0, tempdir.length - 1 * (tempdir[tempdir.length - 1] == "T")) + "GameMakerStudio2")) + "/GMS2TEMP" + (Builder.Platform == "mac" ? "/" : ""));
        var runtimepath = Builder.Preferences.runtimeLocation + Builder.Preferences.runtimeSelection;
    } else {
        var projectnameg = $gmedit["gml.Project"].current.name.slice(0, $gmedit["gml.Project"].current.name.indexOf(".project.gmx"));
        var temppath = tempdir + "\\GameMakerStudio"//;(usersettings["machine.General Settings.Paths.IDE.TempFolder"] || (Builder.Platform == "win" ? (process.env.LOCALAPPDATA + "/GameMakerStudio2") : (tempdir.slice(0, tempdir.length - 1 * (tempdir[tempdir.length - 1] == "T")) + "GameMakerStudio2")) + "/GMS2TEMP" + (Builder.Platform == "mac" ? "/" : ""));
        var runtimepath = Builder.Preferences.gmsLocation;
    }
    var projectname = projectnameg.replace(new RegExp(" ", 'g'), "_");
    var cmd = require("child_process");
    var ext = (Builder.Platform == "win" ? "win" : "ios");

    // create temp path if needed
    if (Electron_FS.existsSync(temppath) == false) {
        Electron_FS.mkdirSync(temppath);
    }

    // create output tab
    let t = new Date(), p = performance.now();
    gmout = new $gmedit["gml.file.GmlFile"](`Output (${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}:${t.getSeconds().toString().padStart(2, "0")})`, null, $gmedit["file.kind.misc.KPlain"].inst, `Compile Started: ${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}:${t.getSeconds().toString().padStart(2, "0")}\nUsing runtime: ${runtimepath}\n`);
    gmout.write = (e) => {
        gmout.editor.session.setValue(gmout.editor.session.getValue() + e);
        if (document.querySelector(".chrome-tab-current").gmlFile == gmout) aceEditor.gotoLine(aceEditor.session.getLength());
    }
    $gmedit["gml.file.GmlFile"].openTab(gmout);
    
    // make sure assetcompiler exists
    if (Electron_FS.existsSync(`${runtimepath}${Builder.Version == 2 ? "/bin/" : ""}GMAssetCompiler.exe`) == false) {
        Electron_Dialog.showErrorBox("Failed to compile project.", "Could not find \"GMAssetCompiler.exe\" in " + runtimepath + "/bin/");
        gmout.write(`\n!!!\n   Could not compile project as "GMAssetCompiler.exe" could not be found in ${runtimepath}\\bin\\\n!!!\n\n`);
        return;
    }

    // create subst drive
    gmout.write(`Using temporary directory: ${temppath}\n`);
    if (Builder.Platform == "win") {
        let drives = cmd.execSync("wmic logicaldisk get caption").toString().replace("Caption", "").split(":").map(c => c.trim());
        while (Builder.Drive == "" || drives.includes(Builder.Drive) == true) {
            Builder.Drive = String.fromCharCode(65 + Math.round((Math.random() * 26)));
        }
        gmout.write(`Creating virtual drive: ${Builder.Drive}\n`);
        cmd.execSync(`subst ${Builder.Drive}: ${temppath}`);
        window.localStorage.setItem("builder:drives", (window.localStorage.getItem("builder:drives") || "") + Builder.Drive);
        temppath = Builder.Drive + "://";
    }
    let outpath = temppath + projectname + "_" + Builder.Random();
    gmout.write(`Using output directory: ${outpath}\n`);

    // enable stop button
    $gmedit["ui.MainMenu"].menu.items[Builder.Index + 1].enabled = true;
    Builder.Running = 1;

    // run compiler!
    if (Builder.Version == 2) {
        Builder.Compiler = cmd.exec(`${(Builder.Platform == "mac" ? "/Library/Frameworks/Mono.framework/Versions/Current/Commands/mono " : "")}${runtimepath}${Builder.Version == 2 ? "/bin/" : ""}GMAssetCompiler.exe /c /zpex /mv=1 /iv=0 /rv=0 /bv=0 /j=4 /gn="${projectname}" /td="${temppath}" /zpuf="${userpath}" /m=${Builder.Platform == "win" ? "windows" : "mac"} /tgt=64 /nodnd /cfg="${$gmedit["gml.Project"].current.config}" /o="${outpath}" /sh=True /cvm /baseproject="${runtimepath}/BaseProject/BaseProject.yyp" "${$gmedit["gml.Project"].current.path}" /v /bt=run`);
    } else {
        Builder.Compiler = cmd.exec(`${runtimepath}GMAssetCompiler.exe /c /tp=2048 /obob=True /obpp=False /obru=True /obes=False /mv=1 /iv=0 /rv=0 /bv=0 /j=4 /gn="${projectname}" /td="${require("os").tmpdir()}" /m=${Builder.Platform == "win" ? "windows" : "mac"} /tgt=64 /config="${$gmedit["gml.Project"].current.config}" /o="${outpath}" /sh=True /cvm "${$gmedit["gml.Project"].current.path}"`);
    }

    // add compiler output
    Builder.Compiler.stdout.on("data", (e) => {
        if (Builder.Compiler == undefined) return;
        switch (Builder.Parse(e, 0)) {
            case 1: Builder.Stop(); break;
            default: gmout.write(e); break;
            //case 1: Builder.Compiler.kill(); break;
        }
    });
    
    Builder.Compiler.addListener("close", function() {
        // check for errors
        if (Builder.Errors.length > 0) {
            let gmer = new $gmedit["gml.file.GmlFile"](`Compilation Errors`, null, $gmedit["file.kind.gml.KGmlSearchResults"].inst, `// Compile failed with ${Builder.Errors.length} error${(Builder.Errors.length == 1 ? "" : "s")}\n\n`);
            gmer.write = (e) => {
                gmer.editor.session.setValue(gmer.editor.session.getValue() + e + "\n");
            }

            for(var i = 0; i < Builder.Errors.length; i++) {
                var eError = Builder.Errors[i].slice(Builder.Errors[i].indexOf(":") + 1).trim(), eTrace = Builder.Errors[i].slice(0, Builder.Errors[i].indexOf(":")).trim().slice(4), eType = eTrace.slice(0, eTrace.indexOf("_")), eLine = eTrace.slice(eTrace.lastIndexOf("(") + 1, -1), eAsset = "";
                switch (eType) {
                    case "Script": case "Room": {
                        eAsset = eTrace.slice(eTrace.indexOf("_") + 1, eTrace.lastIndexOf("("));
                        let eGUID = $gmedit["gml.Project"].current.yyResourceGUIDs[eAsset], eELine = "";
                        if (eGUID != undefined) {
                            let ePath = $gmedit["gml.Project"].current.yyResources[eGUID].Value.resourcePath,
                                eCode = $gmedit["electron.FileWrap"].readTextFileSync($gmedit["gml.Project"].current.dir + "/" + ePath.slice(0, ePath.lastIndexOf("\\") + 1) + eAsset + ".gml").split("\n");
                            eELine = eCode[parseInt(eLine)];
                        }

                        gmer.write(`// Error in ${eType[0].toLowerCase() + eType.slice(1)} at @[${eAsset}:${eLine}]:\n// ${eError[0].toUpperCase() + eError.slice(1)}${(eELine != "" ? "\n" + eELine : "")}\n`);
                        break;
                    }

                    case "Object": {
                        eAsset = eTrace.slice(7, eTrace.lastIndexOf("_", eTrace.lastIndexOf("_") - 1));
                        var eMain = eTrace.slice(eTrace.lastIndexOf("_", eTrace.lastIndexOf("_") - 1) + 1), eSub = eMain.slice(eMain.indexOf("_") + 1);
                        eMain = eMain.slice(0, eMain.indexOf("_"));
                        eSub = eSub.slice(0, eSub.indexOf("("));
                    
                        // get gmlive event
                        for(var j = 0; j < $gmedit["parsers.GmlEvent"].t2sc.length; j++) {
                            if ($gmedit["parsers.GmlEvent"].t2sc[j] == eMain) {
                                eName = $gmedit["parsers.GmlEvent"].i2s[j][eSub];
                                break;
                            }
                        }

                        // capture line
                        let eGUID = $gmedit["gml.Project"].current.yyResourceGUIDs[eAsset], eELine = "";
                        if (eGUID != undefined) {
                            let ePath = $gmedit["gml.Project"].current.yyResources[eGUID].Value.resourcePath, eCode = $gmedit["electron.FileWrap"].readTextFileSync($gmedit["gml.Project"].current.dir + "/" + ePath.slice(0, ePath.lastIndexOf("/") + 1) + eMain + "_" + eSub + ".gml").split("\n");
                            eELine = eCode[parseInt(eLine)];
                        }

                        gmer.write(`// Error in object at @[${eAsset}(${eName}):${eLine}]:\n// ${eError[0].toUpperCase() + eError.slice(1)}${(eELine != "" ? "\n" + eELine + "" : "")}\n`);
                        break;
                    }

                    default: {
                        eAsset = eTrace.slice(eTrace.indexOf("_") + 1, eTrace.lastIndexOf("("));
                        gmer.write(`// Error in ${eAsset} at line ${eLine}:\n// ${eError[0].toUpperCase() + eError.slice(1)}\n`);
                        break;
                    }
                }
            }
            $gmedit["gml.file.GmlFile"].openTab(gmer);
            Builder.Errors = [];
            return;
        }
        if (Builder.Compiler == undefined) return;
        
        // rename output
        Electron_FS.renameSync(`${outpath}/${projectnameg}.${ext}`, `${outpath}/game.${ext}`)

        // finished compiling, now run!
        Builder.Running = 2;
        Builder.Compiler = undefined;
        $gmedit["ui.MainMenu"].menu.items[Builder.Index + 2].enabled = true; // Fork button
        gmout.write(`Compile completed in ${(performance.now() - p).toFixed(1)}ms\n`);
        // check if runner exists
        if (Electron_FS.existsSync(`${runtimepath}${Builder.Version == 2 ? "/windows/" : ""}Runner.exe`) == false) {
            Electron_Dialog.showErrorBox("Failed to run game.", "Could not find \"Runner.exe\" in " + runtimepath + Builder.Version == 2 ? "/windows/" : "");
            gmout.write(`\n!!!\n   Could not run project as "Runner.exe" could not be found in ${runtimepath}${Builder.Version == 2 ? "/windows/" : ""}\n!!!\n\n`);
            gmout.write(`Removing virtual drive: ${Builder.Drive}\n`);
            cmd.exec("subst /d " + Builder.Drive + ":");
            Builder.Runner = undefined; Builder.Compiler = undefined;
            return;
        }

        Builder.RunArgs = [(Builder.Platform == "win" ? `${runtimepath}${Builder.Version == 2 ? "/windows/" : ""}Runner.exe` : `${runtimepath}/mac/YoYo Runner.app/Contents/MacOS/Mac_Runner`), ["-game", `${outpath}/game.${ext}`]];
        Builder.Runner = cmd.spawn(Builder.RunArgs[0], Builder.RunArgs[1]);
        Builder.Runner.addListener("close", function() {
            if (Builder.Platform == "win") {
                gmout.write(`Removing virtual drive: ${Builder.Drive}\n`);
                cmd.exec("subst /d " + Builder.Drive + ":");

                let vds = window.localStorage.getItem("builder:drives") || "";
                window.localStorage.setItem("builder:drives", vds.slice(0, vds.indexOf(Builder.Drive)) + vds.slice(vds.indexOf(Builder.Drive) + 1));
            }
            for(var i = 0; i < 2; i++) {
                $gmedit["ui.MainMenu"].menu.items[Builder.Index + 1 + i].enabled = false;
            }
            Builder.Running = 0;
            Builder.RunArgs = [];
            Builder.Runner = undefined; Builder.Compiler = undefined;
        });

        // add runner output
        Builder.Runner.stdout.on("data", (e) => {
            switch (Builder.Parse(e, 1)) {
                default: gmout.write(e); break;
            }
        });
    });
}

Builder.Stop = function() {
    let t = new Date(), cmd = require("child_process");
    gmout.write(`${(Builder.Running == 1 ? "Compile" : (Builder.Running == 2 ? "Runner" : ""))} Stopped: ${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}:${t.getSeconds().toString().padStart(2, "0")}\n`);
    if (Builder.Compiler != undefined) (Builder.Platform == "win" ? cmd.execSync("taskkill /F /IM GMAssetCompiler.exe") : ""); Builder.Compiler = undefined;
    if (Builder.Runner != undefined) Builder.Runner.kill(); Builder.Runner = undefined;
    if (Builder.Platform == "win") {
        cmd.exec("subst /d " + Builder.Drive + ":");
        let vds = window.localStorage.getItem("builder:drives") || "";
        window.localStorage.setItem("builder:drives", vds.slice(0, vds.indexOf(Builder.Drive)) + vds.slice(vds.indexOf(Builder.Drive) + 1));
    }
    for(var i = 0; i < 2; i++) $gmedit["ui.MainMenu"].menu.items[Builder.Index + 1 + i].enabled = false;
    Builder.Running = 0;
}

Builder.Fork = function() {
    if (Builder.RunArgs.length > 0) {
        require("child_process").spawn(Builder.RunArgs[0], Builder.RunArgs[1].concat([Builder.Preferences.forkArguments])).stdout.on("data", (e) => {
            switch (Builder.Parse(e, 1)) {
                default: gmout.write((e.toString()).replace(new RegExp("\n", 'g'), "[FORK] - ")); break;
            }
        });
    }
}
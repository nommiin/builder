Builder.Random = function() {
    return Math.round(Math.random() * 4294967295).toString(16).padStart(8, "0").toUpperCase();
}

Builder.Running = false;
Builder.Drive = "";
Builder.Parse = function(bString, bType) {
    if (bType == 0) { // GMAssetCompiler
        if (bString.includes("Error : ") == true) {
            // TODO: THIS!
            /*let bInfo = bString.slice(7, bString.slice(7).indexOf(":") + 7).trim(), bError = bString.slice(8 + bString.slice(7).indexOf(":")).trim();
            Electron_Dialog.showErrorBox("Compile Error", "INFO: " + bError);*/
            return 0;
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
                    }

                }
            }
        }
    }
    return 0;
}

Builder.Run = function() {
    // collect local settings
    let userpath = JSON.parse(Electron_FS.readFileSync(Electron_App.getPath("appData") + "\\GameMakerStudio2\\um.json")); userpath = Electron_App.getPath("appData") + "\\GameMakerStudio2\\" + userpath.login.slice(0, userpath.login.indexOf("@")) + "_" + userpath.userID;
    let usersettings = JSON.parse(Electron_FS.readFileSync(userpath + "\\local_settings.json"));
    let projectname = buildname = $gmedit["gml.Project"].current.name.slice(0, $gmedit["gml.Project"].current.name.indexOf(".yyp"));
    let temppath = usersettings["machine.General Settings.Paths.IDE.TempFolder"] + "GMS2TEMP";
    let runtimepath = Builder.Preferences.runtimeLocation + Builder.Preferences.runtimeSelection;

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
    if (Electron_FS.existsSync(`${runtimepath}\\bin\\GMAssetCompiler.exe`) == false) {
        Electron_Dialog.showErrorBox("Failed to compile project.", "Could not find \"GMAssetCompiler.exe\" in " + runtimepath + "\\bin\\");
        gmout.write(`\n!!!\n   Could not compile project as "GMAssetCompiler.exe" could not be found in ${runtimepath}\\bin\\\n!!!\n\n`);
        return;
    }

    // create subst drive
    let cmd = require("child_process"), drives = cmd.execSync("wmic logicaldisk get caption").toString().replace("Caption", "").split(":").map(c => c.trim());
    while (Builder.Drive == "" || drives.includes(Builder.Drive) == true) {
        Builder.Drive = String.fromCharCode(65 + Math.round((Math.random() * 26)));
    }
    gmout.write(`Using temporary directory: ${temppath}\n`);
    gmout.write(`Creating virtual drive: ${Builder.Drive}\n`);
    cmd.execSync(`subst ${Builder.Drive}: ${temppath}`);
    window.localStorage.setItem("builder:drives", (window.localStorage.getItem("builder:drives") || "") + Builder.Drive);
    temppath = Builder.Drive + "://";
    let outpath = temppath + projectname + "_" + Builder.Random();
    gmout.write(`Using output directory: ${outpath}\n`);

    Builder.Running = true;
    // run compiler!
    let gmac = cmd.exec(`${runtimepath}\\bin\\GMAssetCompiler.exe /c /zpex /mv=1 /iv=0 /rv=0 /bv=0 /j=4 /gn="${projectname}" /td="${temppath}" /zpuf="${userpath}" /m=windows /tgt=64 /nodnd /cfg="${$gmedit["gml.Project"].current.config}" /o="${outpath}" /sh=True /cvm /baseproject="${runtimepath}\\BaseProject\\BaseProject.yyp" "${$gmedit["gml.Project"].current.path}" /v /bt=run`);
    // add compiler output
    gmac.stdout.on("data", (e) => {
        switch (Builder.Parse(e, 0)) {
            case 0: gmout.write(e); break;
            case 1: gmac.kill(); break;
        }
    });
    
    gmac.addListener("close", function() {
        // finished compiling, now run!
        gmout.write(`Compile completed in ${(performance.now() - p).toFixed(1)}ms\n`);
        // check if runner exists
        if (Electron_FS.existsSync(`${runtimepath}\\windows\\Runner.exe`) == false) {
            Electron_Dialog.showErrorBox("Failed to run game.", "Could not find \"Runner.exe\" in " + runtimepath + "\\windows\\");
            gmout.write(`\n!!!\n   Could not run project as "Runner.exe" could not be found in ${runtimepath}\\windows\\\n!!!\n\n`);
            gmout.write(`Removing virtual drive: ${Builder.Drive}\n`);
            cmd.exec("subst /d " + Builder.Drive + ":");
            return;
        }

        let gmrn = cmd.exec(`${runtimepath}\\windows\\Runner.exe -game "${outpath}/${projectname}.win"`);
        gmrn.addListener("close", function() {
            gmout.write(`Removing virtual drive: ${Builder.Drive}\n`);
            cmd.exec("subst /d " + Builder.Drive + ":");

            let vds = window.localStorage.getItem("builder:drives") || "";
            window.localStorage.setItem("builder:drives", vds.slice(0, vds.indexOf(Builder.Drive)) + vds.slice(vds.indexOf(Builder.Drive) + 1));
            Builder.Running = false;
        });

        // add runner output
        gmrn.stdout.on("data", (e) => {
            switch (Builder.Parse(e, 1)) {
                default: gmout.write(e); break;
            }
        });
    });
}
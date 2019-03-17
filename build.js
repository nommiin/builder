Builder.Random = function() {
    return Math.round(Math.random() * 4294967295).toString(16).padStart(8, "0").toUpperCase();
}

Builder.Running = false;
Builder.Drive = "";
Builder.Run = function() {
    // collect local settings
    let userpath = JSON.parse(Electron_FS.readFileSync(Electron_App.getPath("appData") + "\\GameMakerStudio2\\um.json")); userpath = Electron_App.getPath("appData") + "\\GameMakerStudio2\\" + userpath.login.slice(0, userpath.login.indexOf("@")) + "_" + userpath.userID;
    let usersettings = JSON.parse(Electron_FS.readFileSync(userpath + "\\local_settings.json"));
    let projectname = buildname = $gmedit["gml.Project"].current.name.slice(0, $gmedit["gml.Project"].current.name.indexOf(".yyp"));
    let temppath = usersettings["machine.General Settings.Paths.IDE.TempFolder"] + "GMS2TEMP";
    let runtimepath = Builder.Preferences.runtimeLocation + Builder.Preferences.runtimeSelection;

    // create subst drive
    let cmd = require("child_process"), drives = cmd.execSync("wmic logicaldisk get caption").toString().replace("Caption", "").split(":").map(c => c.trim());
    while (Builder.Drive == "" || drives.includes(Builder.Drive) == true) {
        Builder.Drive = String.fromCharCode(65 + Math.round((Math.random() * 26)));
    }
    console.log("Using Drive Letter:", Builder.Drive);
    cmd.exec(`subst ${Builder.Drive}: ${temppath}`);
    temppath = Builder.Drive + "://";
    let outpath = temppath + projectname + "_" + Builder.Random();

    // run compile
    Builder.Running = true;
    cmd.exec(`${runtimepath}\\bin\\GMAssetCompiler.exe /c /zpex /mv=1 /iv=0 /rv=0 /bv=0 /j=4 /gn="${projectname}" /td="${temppath}" /zpuf="${userpath}" /m=windows /tgt=64 /nodnd /cfg="default" /o="${outpath}" /sh=True /cvm /baseproject="${runtimepath}\\BaseProject\\BaseProject.yyp" "${$gmedit["gml.Project"].current.path}" /v /bt=run`, (on, tw, th) => {
        console.log(tw);
    }).addListener("close", function() {
        // finished compiling, now run!
        cmd.exec(`${runtimepath}\\windows\\Runner.exe -game "${outpath}/${projectname}.win"`).addListener("close", function() {
            cmd.exec("subst /d " + Builder.Drive + ":");
        });
    });
}

Builder.Debug = function() {

}